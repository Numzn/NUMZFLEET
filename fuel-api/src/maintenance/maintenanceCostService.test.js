import test from 'node:test';
import assert from 'node:assert/strict';

const { breakdownForRow, resolveCostAmount } = await import('./maintenanceCostService.js');

test('resolveCostAmount prefers actualCost over legacy cost', () => {
  assert.equal(resolveCostAmount({ actualCost: 100, cost: 50 }), 100);
  assert.equal(resolveCostAmount({ cost: 75 }), 75);
  assert.equal(resolveCostAmount({}), 0);
});

test('breakdownForRow allocates full cost to parts/labour when split missing', () => {
  const b = breakdownForRow({ actualCost: 1000 });
  assert.equal(b.total, 1000);
  assert.ok(b.parts > b.labour);
  assert.ok(b.labour > 0);
});

test('breakdownForRow uses explicit labour/parts/other when set', () => {
  const b = breakdownForRow({
    actualCost: 500,
    labourCost: 200,
    partsCost: 250,
    otherCost: 50,
  });
  assert.equal(b.labour, 200);
  assert.equal(b.parts, 250);
  assert.equal(b.other, 50);
  assert.equal(b.total, 500);
});

test('budget remaining math', () => {
  const monthTotal = 133000;
  const monthlyBudget = 350000;
  const remaining = Math.max(0, monthlyBudget - monthTotal);
  const usedPct = Math.round((monthTotal / monthlyBudget) * 100);
  assert.equal(remaining, 217000);
  assert.equal(usedPct, 38);
});
