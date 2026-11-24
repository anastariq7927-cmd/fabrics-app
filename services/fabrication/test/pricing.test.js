import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, infillFactor, quoteTotals } from '../src/pricing.js';

const pla = { unit: 'g', price_per_unit: 0.08, density: 1.24 };

test('infill factor stays between walls-only and solid', () => {
  assert.equal(infillFactor(0), 0.35);
  assert.equal(infillFactor(100), 1);
  assert.equal(infillFactor(250), 1);
});

test('filament estimate uses density, infill, quantity, setup and discount', () => {
  const e = estimate({ volumeCm3: 10, material: pla, infill: 100, quantity: 2, setupFee: 2, discountRate: 0.25 });
  // 10 cm³ × 1.24 g/cm³ × 1 × 2 = 24.8 g → 1.984 € + 2 € setup = 3.984 € → −25 %
  assert.equal(e.units, 24.8);
  assert.equal(e.material, 1.98);
  assert.equal(e.gross, 3.98);
  assert.equal(e.total, 2.99);
});

test('resin is priced by solid volume', () => {
  const e = estimate({
    volumeCm3: 8,
    material: { unit: 'ml', price_per_unit: 0.22, density: 1.1 },
    infill: 10,
    quantity: 1,
    setupFee: 0,
    discountRate: 0,
  });
  assert.equal(e.units, 8);
  assert.equal(e.total, 1.76);
});

test('no estimate without a volume', () => {
  assert.equal(estimate({ volumeCm3: 0, material: pla, infill: 20, quantity: 1, setupFee: 2, discountRate: 0 }), null);
});

test('quote totals apply the tier discount', () => {
  const q = quoteTotals([{ label: 'a', amount: 40 }, { label: 'b', amount: 20 }], 0.25);
  assert.deepEqual(q, { gross: 60, discount_rate: 0.25, discount: 15, total: 45 });
});
