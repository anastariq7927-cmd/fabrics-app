import { supabaseService, t } from '@fabrics/shared';

// Catalogue rarely changes; keep it in memory for a minute to avoid three queries per request.
let cache = { at: 0, data: null };

export async function loadCatalog() {
  if (cache.data && Date.now() - cache.at < 60_000) return cache.data;
  const db = supabaseService();
  const [services, materials, settings] = await Promise.all([
    db.from('fab_services').select('*').order('position'),
    db.from('fab_materials').select('*').eq('active', true).order('position'),
    db.from('fab_settings').select('*').single(),
  ]);
  for (const r of [services, materials, settings]) if (r.error) throw r.error;
  cache = { at: Date.now(), data: { services: services.data, materials: materials.data, settings: settings.data } };
  return cache.data;
}

export function localizeCatalog({ services, materials, settings }, l) {
  return {
    services: services.map((s) => ({
      key: s.key,
      icon: s.icon,
      title: t(s.title, l),
      summary: t(s.summary, l),
      leadTime: t(s.lead_time, l),
      hasEstimator: s.has_estimator,
      formats: s.accepted_formats,
    })),
    materials: materials.map((m) => ({
      key: m.key,
      service: m.service_key,
      name: t(m.name, l),
      hint: t(m.hint, l),
      price: Number(m.price_per_unit),
      unit: m.unit,
      density: m.density === null ? null : Number(m.density),
      colors: m.colors.map((c) => ({ key: c.key, hex: c.hex, name: t(c.name, l) })),
    })),
    settings: {
      setupFee: Number(settings.setup_fee),
      discounts: settings.discounts,
      quoteValidityDays: settings.quote_validity_days,
      // Public HelloAsso page, pre-filled in each new staff quote.
      defaultPaymentUrl: settings.default_payment_url ?? null,
    },
  };
}
