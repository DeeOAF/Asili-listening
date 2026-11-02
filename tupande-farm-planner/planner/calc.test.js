// Run with: node --test tupande-farm-planner/planner/calc.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./calc.js');

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);

// The 1-acre worked example used on the landing page.
function example() {
  return {
    field: { acres: 1, perimeterM: C.squarePerimeter(1) },
    cash: 5000, year: 2, bags: 10, shortRains: false, hasTrees: false, existing: {},
    ent: {
      extraMaize: { on: true, acres: 0.1 },
      groundnut: { on: true },
      fruit: { on: true, avocado: 8, mango: 0 },
      timber: { on: true, mode: 'boundary', count: 50 },
      chickens: { on: true, perBatch: 10, batches: 1 }
    }
  };
}

test('credit ceilings rise by customer year to KES 30,000', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(C.creditCeiling), [10000, 15000, 20000, 25000, 30000, 30000]);
});

test('minimum family maize area halves with short rains', () => {
  close(C.minMaizeAcres({ bags: 10 }), 0.5, 'long rains');
  close(C.minMaizeAcres({ bags: 10, shortRains: true }), 0.25, 'both seasons');
});

test('worked example matches the landing page figures', () => {
  const d = C.derive(example());
  close(d.lrInputs, 7950, 'long-rains inputs');
  close(d.borrow, 7950, 'credit');
  close(d.cashStart, 2100, 'cash needed to start');
  close(d.costs, 16550, 'listed costs');
  close(d.cashReturnLo, 16150, 'cash return low');
  close(d.cashReturnHi, 16600, 'cash return high');
  close(d.benefitLo, 46150, 'benefit low');
  close(d.benefitHi, 46600, 'benefit high');
  close(d.available, 1 - 0.6 - 0.25 - 8 * 64.8 / 4046.8564224, 'available acres');
  assert.equal(d.boundaryMax, 50);
  assert.deepEqual(C.violations(example()), []);
});

test('groundnut package: KES 15,250 after deduction, no own cash', () => {
  const s = example(); s.ent = { groundnut: { on: true } };
  const d = C.derive(s);
  close(d.gnPayment, 15250, 'payment');
  close(d.cashStart, 0, 'family maize on credit, groundnuts deducted at sale');
});

test('chickens example: 10 chicks cost 1,500 and return 3,450–3,900', () => {
  const s = example(); s.ent = { chickens: { on: true, perBatch: 10, batches: 1 } };
  const d = C.derive(s);
  close(d.chickCost, 1500, 'chick cost');
  close(d.chLo - d.chickCost, 3450, 'low');
  close(d.chHi - d.chickCost, 3900, 'high');
});

test('only the first chicken batch needs cash now; every batch is a cost', () => {
  const s = example(); s.ent = { chickens: { on: true, perBatch: 10, batches: 3 } };
  const d = C.derive(s);
  close(d.firstBatch, 1500, 'first batch');
  close(d.chickCost, 4500, 'all batches');
});

test('timber: 50 seedlings give 35 trees worth 52,500 at year 5 or 175,000 at year 10', () => {
  const v = C.timberValues(example());
  close(v[0].value, 52500, 'year 5');
  close(v[5].value, 175000, 'year 10');
  const s = example(); s.ent = { timber: { on: true, mode: 'boundary', count: 60 } };
  close(C.derive(s).treeCost, 50, 'ten paid seedlings at KES 5');
});

test('credit cannot pay for trees or chicks', () => {
  const s = example();
  s.cash = 0; s.year = 5; s.ent = { chickens: { on: true, perBatch: 1, batches: 1 } };
  assert.deepEqual(C.violations(s), ['cash']);
});

test('short-rains inputs count in annual costs but not in cash to start', () => {
  const s = example(); s.shortRains = true; s.ent = {};
  const d = C.derive(s);
  close(d.M, 0.25, 'maize area');
  close(d.srInputs, 0.25 * 13250, 'short-rains inputs');
  close(d.cashStart, 0, 'no upfront short-rains cash');
  close(d.costs, 0.5 * 13250, 'both seasons in costs');
});

test('credit is counted once: annual costs include inputs, not repayment again', () => {
  const s = example(); s.ent = {};
  const d = C.derive(s);
  close(d.costs, 6625, 'costs equal inputs');
  close(d.benefitLo, 30000 - 6625, 'benefit');
});

test('food-security hard stops report land and funding shortfalls', () => {
  const s = { field: { acres: 0.4 }, cash: 0, year: 1, bags: 20, hasTrees: false };
  const f = C.foodChecks(s);
  assert.equal(f.landOk, false); close(f.landShortfall, 0.6, 'land');
  assert.equal(f.fundOk, false); close(f.fundShortfall, 13250 - 10000, 'funding');
  const ok = C.foodChecks({ field: { acres: 2 }, cash: 0, year: 1, bags: 10 });
  assert.equal(ok.ok, true);
});

test('existing trees reserve land and yield from their current age, no survival discount', () => {
  const s = { field: { acres: 1 }, bags: 0, hasTrees: true,
    existing: { avocado: { count: 10, age: 4 }, mango: { count: 0, age: 0 } } };
  close(C.existingFruitAcres(s), 648 / 4046.8564224, 'area');
  const f = C.fruitByYear(s, 3);
  close(f[0].existingFruit, 10 * 50 * 30, 'year 1 at age 4');
  close(f[1].existingFruit, 10 * 60 * 30, 'year 2 at age 5');
});

test('new fruit: 70% survival, first harvest in year 3', () => {
  const s = example();
  const f = C.fruitByYear(s, 5);
  close(f[1].newFruit, 0, 'year 2');
  close(f[2].newFruit, 6720, 'year 3');
  close(f[3].newFruit, 8400, 'year 4');
  close(f[4].newFruit, 10080, 'year 5');
});

test('sliders stop at the binding limit and say which one', () => {
  const s = example();
  const m = C.maxFeasible(s, 'ent.chickens.perBatch', 100, 1);
  assert.equal(m.max, 29); assert.equal(m.reason, 'cash'); // 2,900 spare cash / 150 = 19 more chicks
  const t = C.maxFeasible(s, 'ent.timber.count', 500, 1);
  assert.equal(t.max, 50); assert.equal(t.reason, 'boundary');
  const e = C.maxFeasible(s, 'ent.extraMaize.acres', 1, 0.01);
  assert.equal(e.max, 0.12); assert.equal(e.reason, 'land');
  const c = C.maxFeasible(s, 'ent.chickens.batches', 6, 1);
  assert.equal(c.max, 6); assert.equal(c.reason, 'cap');
});

test('alternatives all pass the limits and keep family maize', () => {
  const s = example(); s.cash = 20000; s.field.acres = 2; s.field.perimeterM = C.squarePerimeter(2);
  const alts = C.alternatives(s);
  assert.ok(alts.length >= 1 && alts.length <= 3);
  for (const a of alts) {
    assert.deepEqual(C.violations(a.state), [], a.id);
    close(C.derive(a.state).minMaize, 0.5, 'family maize kept');
  }
});

test('field measurement rejects crossing and tiny shapes', () => {
  // ~63.6 m square near Kakamega ≈ 1 acre
  const lat = 0.2827, lng = 34.7519, dLat = 63.6149 / 111195, dLng = dLat / Math.cos(lat * Math.PI / 180);
  const sq = [[lat, lng], [lat, lng + dLng], [lat + dLat, lng + dLng], [lat + dLat, lng]];
  const m = C.measureField(sq);
  assert.ok(m.valid); assert.ok(Math.abs(m.acres - 1) < 0.01, `acres ${m.acres}`);
  assert.ok(Math.abs(m.perimeterM - 254.46) < 1, `perimeter ${m.perimeterM}`);
  const bow = [sq[0], sq[2], sq[1], sq[3]];
  assert.equal(C.measureField(bow).valid, false);
  const tiny = sq.map(p => [lat + (p[0] - lat) / 100, lng + (p[1] - lng) / 100]);
  assert.equal(C.measureField(tiny).valid, false);
});
