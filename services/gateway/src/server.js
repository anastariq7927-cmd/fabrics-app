// API gateway: the only service the browser talks to. Routes HTTP calls to the internal services.
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { createService, asyncHandler } from '@fabrics/shared';
import { requireUser, requireAdmin } from './auth.js';

const PORT = Number(process.env.GATEWAY_PORT ?? 4000);
const CONTENT_URL = process.env.CONTENT_SERVICE_URL ?? 'http://localhost:4001';
const CONTACT_URL = process.env.CONTACT_SERVICE_URL ?? 'http://localhost:4002';
const EMAIL_URL = process.env.EMAIL_SERVICE_URL ?? 'http://localhost:4003';
const FABRICATION_URL = process.env.FABRICATION_SERVICE_URL ?? 'http://localhost:4004';

const { app, listen } = createService('gateway');
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
  }),
);

// express.json() already consumed the body, so it has to be re-written onto the proxied request.
// Admin routes also tell the service who is acting, for its audit trail.
const proxy = (target, pathRewrite) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.removeHeader('x-admin-email');
        if (req.user?.isAdmin) proxyReq.setHeader('x-admin-email', req.user.email);
        // Only re-write bodies express.json() actually consumed (body-parser sets req._body).
        // Uploads (multipart) are left untouched and streamed: fixRequestBody would otherwise see the
        // empty `{}` body-parser leaves behind and replace the file with an empty form whenever the
        // first chunk hasn't arrived yet ("Unexpected end of form" upstream, 504 here).
        if (req._body) fixRequestBody(proxyReq, req);
      },
    },
  });

// Anti-spam limits apply in production only (the Docker image sets NODE_ENV=production);
// locally they would just lock developers and scripts/test.sh out for an hour.
const limited = (windowMs, limit) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => process.env.NODE_ENV !== 'production' });
const contactLimiter = limited(15 * 60 * 1000, 5);
const fabricationLimiter = limited(60 * 60 * 1000, 10);

app.use('/api/content', proxy(CONTENT_URL));
app.post('/api/contact', contactLimiter, proxy(CONTACT_URL, () => '/messages'));
app.post('/api/fabrication/requests', fabricationLimiter);
app.use('/api/fabrication', proxy(FABRICATION_URL));
app.get('/api/auth/me', requireUser, (req, res) => res.json(req.user));
app.use('/api/admin/fabrication', requireAdmin, proxy(FABRICATION_URL, (path) => `/admin${path}`));
app.use('/api/admin', requireAdmin, proxy(CONTENT_URL, (path) => `/admin${path}`));

// Aggregated health check across every service.
app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    const services = { content: CONTENT_URL, contact: CONTACT_URL, email: EMAIL_URL, fabrication: FABRICATION_URL };
    const entries = await Promise.all(
      Object.entries(services).map(async ([name, url]) => {
        try {
          const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
          return [name, r.ok ? 'ok' : `http ${r.status}`];
        } catch {
          return [name, 'down'];
        }
      }),
    );
    const status = Object.fromEntries(entries);
    res.status(entries.every(([, s]) => s === 'ok') ? 200 : 503).json({ gateway: 'ok', ...status });
  }),
);

listen(PORT);
