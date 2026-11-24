// Staff back office. The gateway has already verified the admin; queries run as that user so
// RLS (private.is_admin()) stays the final guard.
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate, supabaseAsUser, bearerToken, HttpError } from '@fabrics/shared';
import { loadCatalog } from './catalog.js';
import { quoteTotals } from './pricing.js';
import { notifyClient } from './notify.js';
import { BUCKET } from './public.js';

export const adminRouter = Router();

const STATUSES = ['submitted', 'in_review', 'needs_info', 'quoted', 'paid', 'in_production', 'ready', 'delivered', 'rejected'];
// Status changes that the requester hears about by email.
const CLIENT_EMAIL = { needs_info: 'needs_info', rejected: 'rejected', ready: 'ready' };

adminRouter.use((req, res, next) => {
  const token = bearerToken(req);
  if (!token) return next(new HttpError(401, 'Unauthorized'));
  req.db = supabaseAsUser(token);
  req.actor = req.headers['x-admin-email'] || 'staff';
  res.set('Cache-Control', 'no-store');
  next();
});

function check({ data, error }) {
  if (error) throw error;
  if (data === null) throw new HttpError(404, 'Request not found');
  return data;
}

async function loadRequest(db, id) {
  return check(await db.from('fab_requests').select('*').eq('id', id).maybeSingle());
}

async function addEvent(db, request_id, type, message, isPublic, actor) {
  const { error } = await db.from('fab_request_events').insert({ request_id, type, message, public: isPublic, actor });
  if (error) throw error;
}

adminRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const { status, service, tier, q } = req.query;
    let query = req.db
      .from('fab_requests')
      .select(
        'id, reference, created_at, updated_at, status, service_key, tier, name, email, organization, file_name, file_size, material_key, quantity, estimate_eur, quote, deadline',
      )
      .order('created_at', { ascending: false })
      .limit(200);
    if (STATUSES.includes(status)) query = query.eq('status', status);
    if (service) query = query.eq('service_key', service);
    if (['etudiant', 'association', 'externe'].includes(tier)) query = query.eq('tier', tier);
    if (q) {
      const term = String(q).replace(/[%,()]/g, ' ').trim().slice(0, 80);
      if (term) query = query.or(`reference.ilike.%${term}%,name.ilike.%${term}%,email.ilike.%${term}%,organization.ilike.%${term}%`);
    }
    const rows = check(await query);

    // KPI counts across all requests, independent of the filters above.
    const all = check(await req.db.from('fab_requests').select('status'));
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of all) counts[r.status] += 1;

    res.json({ rows, counts, total: all.length });
  }),
);

adminRouter.get(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.db, req.params.id);
    const events = check(
      await req.db.from('fab_request_events').select('*').eq('request_id', request.id).order('created_at', { ascending: false }),
    );
    let fileUrl = null;
    if (request.file_path) {
      const { data, error } = await req.db.storage.from(BUCKET).createSignedUrl(request.file_path, 600);
      if (!error) fileUrl = data.signedUrl;
    }
    res.json({ ...request, events, fileUrl });
  }),
);

const quoteSchema = z.object({
  lines: z
    .array(z.object({ label: z.string().trim().min(1).max(160), amount: z.number().min(-10000).max(100000) }))
    .min(1)
    .max(20),
  discount_rate: z.number().min(0).max(1),
  payment_url: z.string().url().startsWith('https://').nullable().optional(),
  message: z.string().trim().max(2000).optional(),
});

adminRouter.post(
  '/requests/:id/quote',
  validate(quoteSchema),
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.db, req.params.id);
    const { settings } = await loadCatalog();
    const validUntil = new Date(Date.now() + settings.quote_validity_days * 86400000).toISOString().slice(0, 10);
    const quote = { lines: req.body.lines, ...quoteTotals(req.body.lines, req.body.discount_rate), valid_until: validUntil };

    const updated = check(
      await req.db
        .from('fab_requests')
        .update({ quote, payment_url: req.body.payment_url ?? null, status: 'quoted' })
        .eq('id', request.id)
        .select()
        .maybeSingle(),
    );
    await addEvent(req.db, request.id, 'quoted', req.body.message || null, true, req.actor);
    notifyClient('quoted', updated, req.body.message);
    res.json(updated);
  }),
);

const statusSchema = z.object({
  status: z.enum(STATUSES),
  message: z.string().trim().max(2000).optional(),
});

adminRouter.post(
  '/requests/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const { status, message } = req.body;
    if (['needs_info', 'rejected'].includes(status) && !message) {
      throw new HttpError(400, 'Invalid request', { message: ['A message for the requester is required'] });
    }
    const request = await loadRequest(req.db, req.params.id);
    const updated = check(
      await req.db.from('fab_requests').update({ status }).eq('id', request.id).select().maybeSingle(),
    );
    await addEvent(req.db, request.id, status, message || null, true, req.actor);
    if (CLIENT_EMAIL[status]) notifyClient(CLIENT_EMAIL[status], updated, message);
    res.json(updated);
  }),
);

adminRouter.post(
  '/requests/:id/notes',
  validate(z.object({ note: z.string().trim().min(1).max(2000) })),
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.db, req.params.id);
    const staff_notes = [request.staff_notes, req.body.note].filter(Boolean).join('\n');
    check(await req.db.from('fab_requests').update({ staff_notes }).eq('id', request.id).select('id').maybeSingle());
    await addEvent(req.db, request.id, 'note', req.body.note, false, req.actor);
    res.status(204).end();
  }),
);
