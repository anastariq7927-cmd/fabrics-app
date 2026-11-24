import crypto from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler, supabaseService, resolveLocale, HttpError, LOCALES, t } from '@fabrics/shared';
import { loadCatalog, localizeCatalog } from './catalog.js';
import { estimate, tierFor, PROFILES, FRAMES } from './pricing.js';
import { notifyClient, notifyTeam } from './notify.js';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const BUCKET = 'fab-files';

export const publicRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const requestSchema = z.object({
  service_key: z.string(),
  // The price tier is derived from profile + project_frame (tierFor); a client-sent tier is ignored.
  profile: z.enum(PROFILES),
  profile_other: optionalText(160),
  project_frame: z.enum(FRAMES).optional().nullable(),
  frame_other: optionalText(300),
  association_name: optionalText(160),
  service_other: optionalText(300),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: optionalText(40),
  organization: optionalText(160),
  material_key: z.string().optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  infill: z.number().int().min(0).max(100).optional().nullable(),
  layer_height: z.number().min(0.05).max(1).optional().nullable(),
  quantity: z.number().int().min(1).max(500),
  deadline: z.string().date().optional().nullable(),
  notes: optionalText(5000),
  consent: z.literal(true),
  locale: z.enum(LOCALES).default('fr'),
  analysis: z
    .object({
      bbox: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), z: z.number().nonnegative() }),
      volume_cm3: z.number().nonnegative().max(1e6),
      triangles: z.number().int().nonnegative(),
      watertight: z.boolean(),
    })
    .optional()
    .nullable(),
});

// Fields that become required depending on other answers (same rules as the form).
function contextErrors(input) {
  const errors = {};
  if (input.profile === 'autre' && !input.profile_other) errors.profile_other = ['Required when the profile is "autre"'];
  if (input.profile !== 'entreprise_collectivite') {
    if (!input.project_frame) errors.project_frame = ['Required'];
    if (input.project_frame === 'autre' && !input.frame_other) errors.frame_other = ['Required when the frame is "autre"'];
  }
  if (input.service_key === 'conseil' && !input.service_other) errors.service_other = ['Describe the service or advice you need'];
  return errors;
}

publicRouter.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(localizeCatalog(await loadCatalog(), resolveLocale(req.query.locale)));
  }),
);

// Multer errors (size, field count) become clean 400s instead of 500s.
function receiveFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return next(new HttpError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 50 MB)' : err.message));
    }
    next(err);
  });
}

publicRouter.post(
  '/requests',
  receiveFile,
  asyncHandler(async (req, res) => {
    let raw;
    try {
      raw = JSON.parse(req.body?.data ?? '');
    } catch {
      throw new HttpError(400, 'Invalid request', { data: ['Expected a JSON "data" field'] });
    }
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, 'Invalid request', parsed.error.flatten().fieldErrors);
    const input = parsed.data;
    const missing = contextErrors(input);
    if (Object.keys(missing).length) throw new HttpError(400, 'Invalid request', missing);
    // Companies have no frame; drop the fields that do not apply to the chosen answers.
    const isCompany = input.profile === 'entreprise_collectivite';
    const frame = isCompany ? null : input.project_frame;
    const tier = tierFor(input.profile, frame);

    const catalog = await loadCatalog();
    const service = catalog.services.find((s) => s.key === input.service_key);
    if (!service) throw new HttpError(400, 'Invalid request', { service_key: ['Unknown service'] });

    const material = input.material_key ? catalog.materials.find((m) => m.key === input.material_key) : null;
    if (input.material_key && material?.service_key !== service.key) {
      throw new HttpError(400, 'Invalid request', { material_key: ['Material not available for this service'] });
    }

    const file = req.file;
    const fileRequired = ['impression-3d', 'laser'].includes(service.key);
    if (fileRequired && !file) throw new HttpError(400, 'Invalid request', { file: ['A design file is required'] });

    const id = crypto.randomUUID();
    let fileFields = {};
    if (file) {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      if (!service.accepted_formats.includes(ext)) {
        throw new HttpError(400, 'Invalid request', { file: [`Accepted formats: ${service.accepted_formats.join(', ')}`] });
      }
      const safeName = path.basename(file.originalname).replace(/[^\w.-]+/g, '_').slice(-120);
      const filePath = `${id}/${safeName}`;
      const { error } = await supabaseService()
        .storage.from(BUCKET)
        .upload(filePath, file.buffer, { contentType: file.mimetype || 'application/octet-stream', upsert: false });
      if (error) throw error;
      fileFields = { file_path: filePath, file_name: safeName, file_size: file.size, file_format: ext };
    }

    const analysis = service.has_estimator ? input.analysis : null;
    const discountRate = Number(catalog.settings.discounts[tier] ?? 0);
    const est =
      analysis && material
        ? estimate({
            volumeCm3: analysis.volume_cm3,
            material,
            infill: input.infill ?? 25,
            quantity: input.quantity,
            setupFee: catalog.settings.setup_fee,
            discountRate,
          })
        : null;

    const row = {
      id,
      service_key: service.key,
      tier,
      profile: input.profile,
      profile_other: input.profile === 'autre' ? input.profile_other : null,
      project_frame: frame,
      frame_other: frame === 'autre' ? input.frame_other : null,
      association_name: frame === 'associatif' ? input.association_name : null,
      service_other: service.key === 'conseil' ? input.service_other : null,
      name: input.name,
      email: input.email,
      phone: input.phone,
      organization: input.organization,
      ...fileFields,
      bbox: analysis?.bbox ?? null,
      volume_cm3: analysis?.volume_cm3 ?? null,
      triangles: analysis?.triangles ?? null,
      watertight: analysis?.watertight ?? null,
      material_key: material?.key ?? null,
      color: input.color ?? null,
      infill: service.has_estimator ? (input.infill ?? null) : null,
      layer_height: service.has_estimator ? (input.layer_height ?? null) : null,
      quantity: input.quantity,
      deadline: input.deadline ?? null,
      notes: input.notes,
      consent_at: new Date().toISOString(),
      locale: input.locale,
      estimate_eur: est?.total ?? null,
    };

    const db = supabaseService();
    const { data: created, error } = await db.from('fab_requests').insert(row).select().single();
    if (error) {
      if (fileFields.file_path) await db.storage.from(BUCKET).remove([fileFields.file_path]);
      throw error;
    }
    await db.from('fab_request_events').insert({ request_id: id, type: 'submitted', public: true, actor: created.name });

    notifyClient('submitted', created);
    notifyTeam(created);

    res.status(201).json({ reference: created.reference, token: created.tracking_token, estimate: est });
  }),
);

publicRouter.get(
  '/track/:token',
  asyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{48}$/.test(req.params.token)) throw new HttpError(404, 'Request not found');
    const l = resolveLocale(req.query.locale);
    const db = supabaseService();
    const { data: r, error } = await db.from('fab_requests').select('*').eq('tracking_token', req.params.token).maybeSingle();
    if (error) throw error;
    if (!r) throw new HttpError(404, 'Request not found');

    const { data: events, error: evError } = await db
      .from('fab_request_events')
      .select('type, message, created_at')
      .eq('request_id', r.id)
      .eq('public', true)
      .order('created_at', { ascending: false });
    if (evError) throw evError;

    const catalog = await loadCatalog();
    const service = catalog.services.find((s) => s.key === r.service_key);
    const material = catalog.materials.find((m) => m.key === r.material_key);

    res.set('Cache-Control', 'no-store');
    res.json({
      reference: r.reference,
      status: r.status,
      name: r.name,
      tier: r.tier,
      organization: r.organization,
      service: { key: service.key, title: t(service.title, l), icon: service.icon },
      material: material ? { key: material.key, name: t(material.name, l), unit: material.unit } : null,
      color: t(material?.colors.find((c) => c.key === r.color)?.name, l) ?? r.color,
      infill: r.infill,
      layerHeight: r.layer_height === null ? null : Number(r.layer_height),
      quantity: r.quantity,
      deadline: r.deadline,
      file: r.file_name ? { name: r.file_name, size: r.file_size, format: r.file_format } : null,
      bbox: r.bbox,
      volumeCm3: r.volume_cm3 === null ? null : Number(r.volume_cm3),
      estimate: r.estimate_eur === null ? null : Number(r.estimate_eur),
      quote: r.quote,
      paymentUrl: ['quoted'].includes(r.status) ? r.payment_url : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      events,
    });
  }),
);
