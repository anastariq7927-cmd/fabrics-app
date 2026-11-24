// Live preview of the estimate. Mirrors services/fabrication/src/pricing.js, which is authoritative.
const round2 = (n) => Math.round(n * 100) / 100;

export const infillFactor = (infill = 25) => 0.35 + 0.65 * (Math.min(Math.max(infill, 0), 100) / 100);

export function estimate({ volumeCm3, material, infill, quantity, setupFee, discountRate }) {
  if (!volumeCm3 || !material) return null;
  const unitsPerPart = material.unit === 'ml' ? volumeCm3 : volumeCm3 * (material.density ?? 1.2) * infillFactor(infill);
  const units = unitsPerPart * quantity;
  const materialCost = units * material.price;
  const gross = materialCost + setupFee;
  const discount = gross * discountRate;
  return {
    units: round2(units),
    unit: material.unit,
    material: round2(materialCost),
    setup: round2(setupFee),
    gross: round2(gross),
    discount: round2(discount),
    total: round2(gross - discount),
  };
}

export const formatEUR = (n, lang = 'fr') =>
  new Intl.NumberFormat({ fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT' }[lang] ?? 'fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export const formatBytes = (n) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
