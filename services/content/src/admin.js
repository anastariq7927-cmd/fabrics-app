// Admin routes. The gateway has already checked the user is an admin; queries still run
// as that user so RLS (private.is_admin()) is the final guard.
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate, supabaseAsUser, bearerToken, HttpError } from '@fabrics/shared';

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  const token = bearerToken(req);
  if (!token) return next(new HttpError(401, 'Unauthorized'));
  req.db = supabaseAsUser(token);
  res.set('Cache-Control', 'no-store');
  next();
});

const localized = z.object({ fr: z.string().min(1), en: z.string().default(''), pt: z.string().default('') });

const newsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-with-dashes'),
  published_at: z.string().date(),
  source: z.enum(['fabrics', 'linkedin', 'press']),
  title: localized,
  summary: localized,
  external_url: z.string().url().nullable().optional(),
  image_url: z.string().nullable().optional(),
  is_published: z.boolean().default(true),
});

function check({ data, error }, notFound = 'Not found') {
  if (error) throw error.code === '23505' ? new HttpError(409, 'Slug already exists') : error;
  if (data === null) throw new HttpError(404, notFound);
  return data;
}

adminRouter.get(
  '/news',
  asyncHandler(async (req, res) => {
    res.json(check(await req.db.from('news').select('*').order('published_at', { ascending: false })));
  }),
);

adminRouter.post(
  '/news',
  validate(newsSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(check(await req.db.from('news').insert(req.body).select().single()));
  }),
);

adminRouter.patch(
  '/news/:id',
  validate(newsSchema.partial()),
  asyncHandler(async (req, res) => {
    res.json(check(await req.db.from('news').update(req.body).eq('id', req.params.id).select().maybeSingle()));
  }),
);

adminRouter.delete(
  '/news/:id',
  asyncHandler(async (req, res) => {
    check(await req.db.from('news').delete().eq('id', req.params.id).select('id').maybeSingle());
    res.status(204).end();
  }),
);

adminRouter.get(
  '/messages',
  asyncHandler(async (req, res) => {
    let query = req.db.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200);
    if (['new', 'read', 'archived'].includes(req.query.status)) query = query.eq('status', req.query.status);
    res.json(check(await query));
  }),
);

adminRouter.patch(
  '/messages/:id',
  validate(z.object({ status: z.enum(['new', 'read', 'archived']) })),
  asyncHandler(async (req, res) => {
    res.json(
      check(await req.db.from('contact_messages').update(req.body).eq('id', req.params.id).select().maybeSingle()),
    );
  }),
);
