import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

// Every service reads the single .env at the repo root (docker-compose injects env directly).
const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
dotenv.config({ path: rootEnv });

export const LOCALES = ['fr', 'en', 'pt'];
export const DEFAULT_LOCALE = 'fr';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

// Service role: bypasses RLS. Only for writes that anonymous visitors trigger (contact form).
let serviceClient;
export function supabaseService() {
  serviceClient ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), clientOptions);
  return serviceClient;
}

// Publishable key: subject to RLS, enough for public reads.
let publicClient;
export function supabasePublic() {
  publicClient ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_PUBLISHABLE_KEY'), clientOptions);
  return publicClient;
}

// Acts as the signed-in user, so RLS (private.is_admin()) decides what they can touch.
export function supabaseAsUser(accessToken) {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_PUBLISHABLE_KEY'), {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Links built by supabase-js start with SUPABASE_URL. On a self-hosted server that is the internal
// gateway (http://supabase-api:8000), which browsers cannot reach, so links handed to the browser
// are rewritten to SUPABASE_PUBLIC_URL (proxied by Caddy). Unchanged when it is not set.
export function toPublicSupabaseUrl(url) {
  const publicBase = process.env.SUPABASE_PUBLIC_URL?.replace(/\/+$/, '');
  const internalBase = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  if (!url || !publicBase || !internalBase || publicBase === internalBase) return url;
  return url.startsWith(internalBase) ? publicBase + url.slice(internalBase.length) : url;
}

export function bearerToken(req) {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function resolveLocale(value) {
  return LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

// Picks one language out of a {fr,en,pt} jsonb column, falling back to French.
export function t(field, locale) {
  if (!field || typeof field !== 'object') return field ?? null;
  return field[locale] || field[DEFAULT_LOCALE] || null;
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new HttpError(400, 'Invalid request', result.error.flatten().fieldErrors));
    }
    req[source === 'body' ? 'body' : 'validated'] = result.data;
    next();
  };
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createService(name) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ service: name, status: 'ok', time: new Date().toISOString() }));

  const listen = (port) => {
    app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
    app.use((err, _req, res, _next) => {
      const status = err.status ?? 500;
      if (status >= 500) console.error(`[${name}]`, err);
      res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message, details: err.details });
    });
    return app.listen(port, () => console.log(`[${name}] listening on :${port}`));
  };

  return { app, listen };
}
