import { Router } from 'express';
import { asyncHandler, supabasePublic, resolveLocale, t, HttpError } from '@fabrics/shared';

export const publicRouter = Router();

// Public content changes rarely; let browsers and CDNs cache it briefly.
publicRouter.use((req, res, next) => {
  req.locale = resolveLocale(req.query.locale);
  res.set('Cache-Control', 'public, max-age=60');
  next();
});

const mapIntention = (row, l) => ({
  key: row.key,
  position: row.position,
  icon: row.icon,
  image: row.image_url,
  title: t(row.title, l),
  summary: t(row.summary, l),
  description: t(row.description, l),
  audience: t(row.audience, l),
  caption: t(row.caption, l),
});

const mapNews = (row, l) => ({
  id: row.id,
  slug: row.slug,
  date: row.published_at,
  source: row.source,
  title: t(row.title, l),
  summary: t(row.summary, l),
  body: t(row.body, l),
  url: row.external_url,
  image: row.image_url,
});

const mapProject = (row, l) => ({
  slug: row.slug,
  title: t(row.title, l),
  tagline: t(row.tagline, l),
  summary: t(row.summary, l),
  image: row.image_url,
  featured: row.is_featured,
  pillars: row.pillars.map((p) => ({ icon: p.icon, title: t(p.title, l), text: t(p.text, l) })),
  objectives: row.objectives.map((o) => ({ title: t(o.title, l), text: t(o.text, l) })),
});

publicRouter.get(
  '/intentions',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabasePublic().from('intentions').select('*').order('position');
    if (error) throw error;
    res.json(data.map((row) => mapIntention(row, req.locale)));
  }),
);

publicRouter.get(
  '/news',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const { data, error } = await supabasePublic()
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data.map((row) => mapNews(row, req.locale)));
  }),
);

publicRouter.get(
  '/news/:slug',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabasePublic()
      .from('news')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('is_published', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'News not found');
    res.json(mapNews(data, req.locale));
  }),
);

publicRouter.get(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabasePublic().from('projects').select('*').eq('slug', req.params.slug).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Project not found');
    res.json(mapProject(data, req.locale));
  }),
);

publicRouter.get(
  '/partners',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabasePublic().from('partners').select('name, url, logo_url').order('position');
    if (error) throw error;
    res.json(data.map((p) => ({ name: p.name, url: p.url, logo: p.logo_url })));
  }),
);
