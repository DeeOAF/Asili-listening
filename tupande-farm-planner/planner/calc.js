/* Tupande Farm Planner: calculation engine.
   Every figure and rule here comes from "Tupande Farm Planner — Updated MVP" (sections 4–8, 10).
   Pure functions only, so the same code runs in the browser and in node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TupandeCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var A = {
    acreM2: 4046.8564224,
    bagsPerAcre: 20,
    maizeBagPrice: 3000,
    maizeInputsPerAcre: 13250, // 5 seed bags × 850 + DAP 6,000 + CAN 3,000
    credit: { 1: 10000, 2: 15000, 3: 20000, 4: 25000, 5: 30000 },
    groundnut: { acres: 0.25, inputs: 6500, kg: 150, pricePerKg: 145 },
    avocado: { seedling: 75, pricePerKg: 30, areaM2: 64.8, yieldKg: { 3: 40, 4: 50, 5: 60 } },
    mango: { seedling: 20, pricePerKg: 20, areaM2: 80, yieldKg: { 3: 75, 4: 90, 5: 100 } },
    newTreeSurvival: 0.7,
    timber: { free: 50, extraSeedling: 5, boundarySpacingM: 5, woodlotM2: 9,
      saleValue: { 5: 1500, 6: 2200, 7: 2900, 8: 3600, 9: 4300, 10: 5000 } },
    chicken: { chick: 150, saleLow: 550, saleHigh: 600, survival: 0.9, maxPerBatch: 100, maxBatches: 6 }
  };
  var EPS = 1e-9;

  function num(v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; }
  function int(v) { return Math.floor(num(v)); }

  function creditCeiling(year) { return A.credit[Math.min(Math.max(int(year) || 1, 1), 5)]; }

  function seasons(s) { return s.shortRains ? 2 : 1; }

  function minMaizeAcres(s) { return num(s.bags) / (A.bagsPerAcre * seasons(s)); }

  function existingFruitAcres(s) {
    if (!s.hasTrees) return 0;
    var e = s.existing || {};
    return (int(e.avocado && e.avocado.count) * A.avocado.areaM2 +
            int(e.mango && e.mango.count) * A.mango.areaM2) / A.acreM2;
  }

  // Quantities that count, given which enterprise tiles are ticked.
  function quantities(s) {
    var e = s.ent || {};
    var timberOn = e.timber && e.timber.on;
    var chickOn = e.chickens && e.chickens.on;
    return {
      E: e.extraMaize && e.extraMaize.on ? num(e.extraMaize.acres) : 0,
      gn: !!(e.groundnut && e.groundnut.on),
      Av: e.fruit && e.fruit.on ? int(e.fruit.avocado) : 0,
      Mg: e.fruit && e.fruit.on ? int(e.fruit.mango) : 0,
      T: timberOn ? int(e.timber.count) : 0,
      woodlot: !!(timberOn && e.timber.mode === 'woodlot'),
      N: chickOn ? int(e.chickens.perBatch) : 0,
      K: chickOn && int(e.chickens.perBatch) > 0 ? Math.max(1, int(e.chickens.batches)) : 0
    };
  }

  function boundaryMax(s) { return Math.floor(num(s.field && s.field.perimeterM) / A.timber.boundarySpacingM); }

  function derive(s) {
    var q = quantities(s);
    var S = seasons(s), B = num(s.bags), L = creditCeiling(s.year), C = num(s.cash);
    var field = num(s.field && s.field.acres);
    var minMaize = minMaizeAcres(s);
    var M = minMaize + q.E;

    var existingFruit = existingFruitAcres(s);
    var newFruit = (q.Av * A.avocado.areaM2 + q.Mg * A.mango.areaM2) / A.acreM2;
    var woodlot = q.woodlot ? q.T * A.timber.woodlotM2 / A.acreM2 : 0;
    var gnAcres = q.gn ? A.groundnut.acres : 0;
    var available = field - M - existingFruit - newFruit - woodlot - gnAcres;

    var lrInputs = M * A.maizeInputsPerAcre;
    var borrow = Math.min(lrInputs, L);
    var treeCost = q.Av * A.avocado.seedling + q.Mg * A.mango.seedling +
                   Math.max(q.T - A.timber.free, 0) * A.timber.extraSeedling;
    var firstBatch = q.N * A.chicken.chick;
    var cashStart = lrInputs - borrow + treeCost + firstBatch;
    var srInputs = S === 2 ? M * A.maizeInputsPerAcre : 0;

    var foodValue = B * A.maizeBagPrice;
    var extraBags = q.E * A.bagsPerAcre * S;
    var extraSales = extraBags * A.maizeBagPrice;
    var gnGross = q.gn ? A.groundnut.kg * A.groundnut.pricePerKg : 0;
    var gnCost = q.gn ? A.groundnut.inputs : 0;
    var birds = q.N * A.chicken.survival * q.K;
    var chLo = birds * A.chicken.saleLow, chHi = birds * A.chicken.saleHigh;
    var chickCost = q.N * q.K * A.chicken.chick;
    var maizeCosts = lrInputs + srInputs;
    var costs = maizeCosts + gnCost + chickCost + treeCost;
    var salesLo = extraSales + gnGross + chLo, salesHi = extraSales + gnGross + chHi;

    return {
      q: q, S: S, B: B, L: L, C: C, field: field,
      minMaize: minMaize, M: M, existingFruit: existingFruit, newFruit: newFruit,
      woodlot: woodlot, gnAcres: gnAcres, available: available, boundaryMax: boundaryMax(s),
      lrInputs: lrInputs, borrow: borrow, treeCost: treeCost, firstBatch: firstBatch,
      cashStart: cashStart, cashLeft: C - cashStart, srInputs: srInputs,
      foodValue: foodValue, extraBags: extraBags, extraSales: extraSales,
      gnGross: gnGross, gnCost: gnCost, gnPayment: gnGross - gnCost,
      birds: birds, chLo: chLo, chHi: chHi, chickCost: chickCost,
      maizeCosts: maizeCosts, costs: costs,
      cashReturnLo: salesLo - costs, cashReturnHi: salesHi - costs,
      benefitLo: salesLo - costs + foodValue, benefitHi: salesHi - costs + foodValue
    };
  }

  // Step-two hard stops (spec 5.3).
  function foodChecks(s) {
    var field = num(s.field && s.field.acres);
    var minMaize = minMaizeAcres(s), trees = existingFruitAcres(s);
    var needLand = minMaize + trees;
    var needCash = minMaize * A.maizeInputsPerAcre;
    var funding = num(s.cash) + creditCeiling(s.year);
    return {
      minMaize: minMaize, existingFruit: trees, needLand: needLand,
      landOk: needLand <= field + EPS, landShortfall: Math.max(0, needLand - field),
      needCash: needCash, funding: funding,
      fundOk: needCash <= funding + EPS, fundShortfall: Math.max(0, needCash - funding),
      ok: needLand <= field + EPS && needCash <= funding + EPS
    };
  }

  // Which hard limits the plan breaks, if any.
  function violations(s) {
    var d = derive(s), v = [];
    if (d.available < -EPS) v.push('land');
    if (d.cashStart > d.C + EPS) v.push('cash');
    if (d.q.T > 0 && !d.q.woodlot && d.q.T > d.boundaryMax) v.push('boundary');
    return v;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function getPath(o, path) { return path.split('.').reduce(function (x, k) { return x && x[k]; }, o); }
  function setPath(o, path, val) {
    var ks = path.split('.'), last = ks.pop();
    ks.reduce(function (x, k) { return x[k] = x[k] || {}; }, o)[last] = val;
  }

  /* Largest value for one control that keeps the plan within land, cash and boundary,
     holding everything else fixed. step: 1 for counts, 0.01 for acres. cap: operational limit.
     Returns { max, reason } where reason is the limit that stops the next step:
     'land' | 'cash' | 'boundary' | 'cap'. */
  function maxFeasible(s, path, cap, step) {
    var t = clone(s);
    var units = Math.floor(cap / step + EPS);
    function ok(u) { setPath(t, path, round(u * step, step)); return violations(t).length === 0; }
    if (!ok(0)) return { max: 0, reason: firstReason(t) };
    var lo = 0, hi = units;
    if (ok(hi)) return { max: round(hi * step, step), reason: 'cap' };
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (ok(mid)) lo = mid; else hi = mid; }
    ok(hi);
    return { max: round(lo * step, step), reason: firstReason(t) };
  }
  function firstReason(t) { var v = violations(t); return v[0] || 'cap'; }
  function round(v, step) { return step < 1 ? Math.round(v * 100) / 100 : Math.round(v); }

  // Yield (kg per tree) at a given tree age in years.
  function yieldAt(species, age) {
    var y = A[species].yieldKg;
    if (age < 3) return 0;
    return age >= 5 ? y[5] : y[age];
  }

  /* Future annual fruit proceeds (gross), year 1 = the coming year.
     New seedlings are age 1 in year 1 and carry 70% survival; existing trees age from their
     current average age with no survival discount. */
  function fruitByYear(s, years) {
    var q = quantities(s), e = s.existing || {}, out = [];
    for (var y = 1; y <= years; y++) {
      var newAv = q.Av * A.newTreeSurvival * yieldAt('avocado', y) * A.avocado.pricePerKg;
      var newMg = q.Mg * A.newTreeSurvival * yieldAt('mango', y) * A.mango.pricePerKg;
      var exAv = 0, exMg = 0;
      if (s.hasTrees) {
        exAv = int(e.avocado && e.avocado.count) * yieldAt('avocado', num(e.avocado && e.avocado.age) + y - 1) * A.avocado.pricePerKg;
        exMg = int(e.mango && e.mango.count) * yieldAt('mango', num(e.mango && e.mango.age) + y - 1) * A.mango.pricePerKg;
      }
      out.push({ year: y, newFruit: newAv + newMg, existingFruit: exAv + exMg, total: newAv + newMg + exAv + exMg });
    }
    return out;
  }

  // Alternative one-off sale values for this year's Grevillea cohort. Never add these together.
  function timberValues(s) {
    var q = quantities(s), surviving = q.T * A.newTreeSurvival, out = [];
    for (var age = 5; age <= 10; age++) out.push({ age: age, surviving: surviving, value: surviving * A.timber.saleValue[age] });
    return out;
  }

  function matureFruit(s) { return fruitByYear(s, 5)[4].total; }
  function timberAt(s, age) { return quantities(s).T * A.newTreeSurvival * A.timber.saleValue[age]; }

  function ensureEnt(s) {
    s.ent = s.ent || {};
    ['extraMaize', 'groundnut', 'fruit', 'timber', 'chickens'].forEach(function (k) { s.ent[k] = s.ent[k] || {}; });
    return s;
  }

  /* Up to three feasible alternatives (spec 10). Each keeps food-security land and funding,
     passes the same limits, and never touches existing trees. */
  function alternatives(s) {
    var base = derive(s), out = [];
    function tryAlt(id, title, detail, mutate) {
      var t = ensureEnt(clone(s));
      if (mutate(t) === false) return;
      if (violations(t).length) return;
      if (JSON.stringify(t.ent) === JSON.stringify(s.ent)) return;
      var d = derive(t);
      out.push({
        id: id, title: title, detail: detail, state: t,
        dBenefitLo: d.benefitLo - base.benefitLo, dBenefitHi: d.benefitHi - base.benefitHi,
        dCashStart: d.cashStart - base.cashStart,
        dFruit: matureFruit(t) - matureFruit(s),
        dTimber: timberAt(t, 10) - timberAt(s, 10)
      });
    }
    var q = base.q;

    tryAlt('groundnut', 'Add the groundnut package', 'A quarter acre of groundnuts. Inputs are deducted from the sale, so no cash is needed now.', function (t) {
      if (q.gn) return false;
      t.ent.groundnut.on = true;
    });

    tryAlt('spare-maize', 'Use spare land for extra maize', 'Plant extra maize on land that is still free, as far as your credit and cash allow.', function (t) {
      if (base.available < 0.05) return false;
      t.ent.extraMaize.on = true;
      t.ent.extraMaize.acres = q.E;
      var m = maxFeasible(t, 'ent.extraMaize.acres', q.E + base.available, 0.01);
      if (m.max - q.E < 0.05) return false;
      t.ent.extraMaize.acres = m.max;
    });

    tryAlt('chicks', 'Add affordable chicks', 'Ten more chicks in your first batch, paid from your own cash.', function (t) {
      var n0 = q.N;
      t.ent.chickens.on = true;
      t.ent.chickens.batches = q.K || 1;
      t.ent.chickens.perBatch = n0;
      var m = maxFeasible(t, 'ent.chickens.perBatch', Math.min(n0 + 10, A.chicken.maxPerBatch), 1);
      if (m.max <= n0) return false;
      t.ent.chickens.perBatch = m.max;
    });

    tryAlt('trees-to-maize', 'Swap some new trees for extra maize', 'Plant half the new fruit trees and use the space for extra maize.', function (t) {
      if (q.Av + q.Mg < 2) return false;
      var keepAv = Math.ceil(q.Av / 2), keepMg = Math.ceil(q.Mg / 2);
      var freed = ((q.Av - keepAv) * A.avocado.areaM2 + (q.Mg - keepMg) * A.mango.areaM2) / A.acreM2;
      t.ent.fruit.avocado = keepAv; t.ent.fruit.mango = keepMg;
      t.ent.extraMaize.on = true; t.ent.extraMaize.acres = q.E;
      var m = maxFeasible(t, 'ent.extraMaize.acres', q.E + Math.floor(freed * 100) / 100, 0.01);
      if (m.max - q.E < 0.01) return false;
      t.ent.extraMaize.acres = m.max;
    });

    tryAlt('maize-to-trees', 'Swap some extra maize for fruit trees', 'Plant avocado on half of your extra maize land, for income from year three.', function (t) {
      if (q.E < 0.05) return false;
      var move = Math.round(q.E / 2 * 100) / 100;
      t.ent.extraMaize.acres = Math.round((q.E - move) * 100) / 100;
      t.ent.fruit.on = true; t.ent.fruit.avocado = q.Av; t.ent.fruit.mango = q.Mg;
      var room = Math.floor(move * A.acreM2 / A.avocado.areaM2);
      var m = maxFeasible(t, 'ent.fruit.avocado', q.Av + room, 1);
      if (m.max <= q.Av) return false;
      t.ent.fruit.avocado = m.max;
    });

    tryAlt('keep-cash', 'Keep more cash uncommitted', 'Halve the chicks and paid seedlings, and keep timber to the 50 free seedlings.', function (t) {
      if (base.cashStart - base.lrInputs + base.borrow <= 0) return false;
      t.ent.chickens.perBatch = Math.floor(q.N / 2);
      t.ent.fruit.avocado = Math.floor(q.Av / 2);
      t.ent.fruit.mango = Math.floor(q.Mg / 2);
      if (q.T > A.timber.free) t.ent.timber.count = A.timber.free;
      if (derive(t).cashStart >= base.cashStart) return false;
    });

    return out.slice(0, 3);
  }

  /* Field geometry. Points are [lat, lng]; projected to local metres around the centroid,
     which is accurate for farm-sized fields. */
  function project(points) {
    var R = 6371008.8, lat0 = 0, lng0 = 0;
    points.forEach(function (p) { lat0 += p[0]; lng0 += p[1]; });
    lat0 /= points.length; lng0 /= points.length;
    var k = Math.PI / 180, c = Math.cos(lat0 * k);
    return points.map(function (p) { return [R * (p[1] - lng0) * k * c, R * (p[0] - lat0) * k]; });
  }
  function areaM2(xy) {
    var a = 0;
    for (var i = 0; i < xy.length; i++) { var j = (i + 1) % xy.length; a += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1]; }
    return Math.abs(a) / 2;
  }
  function perimeterM(xy) {
    var p = 0;
    for (var i = 0; i < xy.length; i++) { var j = (i + 1) % xy.length; p += Math.hypot(xy[j][0] - xy[i][0], xy[j][1] - xy[i][1]); }
    return p;
  }
  function segmentsCross(a, b, c, d) {
    function o(p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); }
    var d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function selfCrossing(xy) {
    var n = xy.length;
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(xy[i], xy[(i + 1) % n], xy[j], xy[(j + 1) % n])) return true;
    }
    return false;
  }
  // Returns { acres, perimeterM, valid, problem }
  function measureField(points) {
    if (!points || points.length < 4 || points.length > 6) return { acres: 0, perimeterM: 0, valid: false, problem: 'Use four to six corners.' };
    var xy = project(points), a = areaM2(xy) / A.acreM2, p = perimeterM(xy);
    if (selfCrossing(xy)) return { acres: a, perimeterM: p, valid: false, problem: 'The boundary crosses itself. Move the corners so the edges do not cross.' };
    if (a < 0.01) return { acres: a, perimeterM: p, valid: false, problem: 'The field is too small to plan. Spread the corners along the real boundary.' };
    return { acres: a, perimeterM: p, valid: true, problem: '' };
  }
  // Manual entry assumes a square field to estimate the perimeter (spec 4.2).
  function squarePerimeter(acres) { return 4 * Math.sqrt(num(acres) * A.acreM2); }

  return {
    ASSUMPTIONS: A, creditCeiling: creditCeiling, minMaizeAcres: minMaizeAcres,
    existingFruitAcres: existingFruitAcres, quantities: quantities, derive: derive,
    foodChecks: foodChecks, violations: violations, maxFeasible: maxFeasible,
    yieldAt: yieldAt, fruitByYear: fruitByYear, timberValues: timberValues,
    alternatives: alternatives, measureField: measureField, squarePerimeter: squarePerimeter,
    project: project, clone: clone
  };
});
