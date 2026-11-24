// Pricing rules shared by the automatic estimate and the staff quote.
// frontend/src/fabrication/pricing.js mirrors estimate() for the live preview; this file is authoritative.

const round2 = (n) => Math.round(n * 100) / 100;

// Share of the solid volume actually printed: walls/top/bottom (~35 %) plus the infill.
export const infillFactor = (infill = 25) => 0.35 + 0.65 * (Math.min(Math.max(infill, 0), 100) / 100);

/**
 * Automatic estimate for a 3D print.
 * @param {{volumeCm3:number, material:{unit:string, price_per_unit:number, density:number}, infill:number,
 *          quantity:number, setupFee:number, discountRate:number}} input
 */
export function estimate({ volumeCm3, material, infill, quantity, setupFee, discountRate }) {
  if (!volumeCm3 || !material) return null;
  const price = Number(material.price_per_unit);
  // Resin is sold by volume and printed solid; filaments by weight with infill.
  const unitsPerPart =
    material.unit === 'ml' ? volumeCm3 : volumeCm3 * Number(material.density ?? 1.2) * infillFactor(infill);
  const units = unitsPerPart * quantity;
  const materialCost = units * price;
  const gross = materialCost + Number(setupFee);
  const discount = gross * discountRate;
  return {
    units: round2(units),
    unit: material.unit,
    material: round2(materialCost),
    setup: round2(Number(setupFee)),
    gross: round2(gross),
    discount: round2(discount),
    total: round2(gross - discount),
  };
}

/** Totals for a staff quote made of free-form lines. */
export function quoteTotals(lines, discountRate) {
  const gross = lines.reduce((sum, l) => sum + Number(l.amount), 0);
  const discount = gross * discountRate;
  return { gross: round2(gross), discount_rate: discountRate, discount: round2(discount), total: round2(gross - discount) };
}

// Who is asking and in which setting. frontend/src/fabrication/pricing.js mirrors these.
export const PROFILES = ['etudiant_cotisant', 'etudiant_non_cotisant', 'personnel_interne', 'entreprise_collectivite', 'autre'];
export const FRAMES = ['eleves', 'academique', 'associatif', 'personnel', 'externe', 'autre'];

// Price tier from the profile and the project frame: members (cotisants) get the student rate,
// projects run for a CS association or club get the association rate, everyone else the full rate.
export function tierFor(profile, frame) {
  if (profile === 'etudiant_cotisant') return 'etudiant';
  if (profile !== 'entreprise_collectivite' && frame === 'associatif') return 'association';
  return 'externe';
}
