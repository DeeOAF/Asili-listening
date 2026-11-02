/* Tupande Farm Planner: user interface. Calculations live in calc.js. */
(function () {
  'use strict';
  var C = window.TupandeCalc, AS = C.ASSUMPTIONS;
  var STORE = 'tupande-farm-planner-v1';
  var COLOURS = { maize: '#E8B757', groundnut: '#754C3D', oldFruit: '#80B2A4', newFruit: '#2B7F68', woodlot: '#2F6067', free: '#F5F2EA', ink: '#22302D', teal: '#2F6067', paper: '#FFFDF8' };
  var CONTROL_ORDER = ['ent.extraMaize.acres', 'ent.fruit.avocado', 'ent.fruit.mango', 'ent.timber.count', 'ent.chickens.perBatch', 'ent.chickens.batches'];

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  /* ---------- State ---------- */
  function defaults() {
    return {
      step: 1,
      field: { acres: 0, perimeterM: 0, source: null, confirmed: false, points: null, accuracies: [], walkDone: false, steps: null },
      cash: null, year: 1, bags: null, shortRains: null, hasTrees: null,
      existing: { avocado: { count: 0, age: 0 }, mango: { count: 0, age: 0 } },
      ent: {
        extraMaize: { on: false, acres: 0 }, groundnut: { on: false },
        fruit: { on: false, avocado: 0, mango: 0 },
        timber: { on: false, mode: 'boundary', count: 0 },
        chickens: { on: false, perBatch: 0, batches: 1 }
      },
      expanded: {}
    };
  }
  var state = load() || defaults();

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return null;
      var s = JSON.parse(raw), d = defaults();
      return Object.assign(d, s, { field: Object.assign(d.field, s.field), ent: Object.assign(d.ent, s.ent), existing: Object.assign(d.existing, s.existing) });
    } catch (e) { return null; }
  }
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable: plan lives in memory only */ } }, 200);
  }
  function getPath(path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, state); }
  function setPath(path, v) { var ks = path.split('.'), last = ks.pop(); ks.reduce(function (o, k) { return o[k]; }, state)[last] = v; }

  /* ---------- Formatting ---------- */
  var nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  function kes(v) { return 'KES ' + nf0.format(Math.round(v)); }
  function n0(v) { return nf0.format(Math.round(v)); }
  function signed(v) { var r = Math.round(v); return (r > 0 ? '+' : r < 0 ? '−' : '') + nf0.format(Math.abs(r)); }
  function range(lo, hi, pre) { pre = pre === undefined ? 'KES ' : pre; return Math.round(lo) === Math.round(hi) ? pre + n0(lo) : pre + n0(lo) + '–' + n0(hi); }
  function ac(v) { return (Math.round(v * 100) / 100).toFixed(2) + (Math.abs(v - 1) < 0.005 ? ' acre' : ' acres'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Numeric inputs: free typing, validate on leave or Enter ---------- */
  function bindNumber(el, onCommit, bounds) {
    el.addEventListener('focus', function () { el.dataset.prev = el.value; setTimeout(function () { el.select(); }, 0); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('blur', function () {
      var raw = el.value.trim().replace(/[,\s]/g, '');
      if (raw === '' || !isFinite(Number(raw))) { el.value = el.dataset.prev || ''; return; }
      var b = bounds ? bounds() : {}, v = Number(raw);
      var min = b.min !== undefined ? b.min : Number(el.dataset.min || 0);
      var max = b.max !== undefined ? b.max : Number(el.dataset.max || Infinity);
      var dec = Number(el.dataset.decimals || 0), f = Math.pow(10, dec);
      v = Math.round(Math.min(Math.max(v, min), max) * f) / f;
      onCommit(v);
    });
  }
  function showNumber(el, v, dec) {
    if (document.activeElement === el) return;
    if (v === null || v === undefined || v === '') { el.value = ''; return; }
    el.value = dec ? String(Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec)) : (el.dataset.key === 'cash' ? n0(v) : String(Math.round(v)));
  }

  /* ---------- Steps ---------- */
  function canEnter(step) {
    if (step >= 2 && !(state.field.confirmed && state.cash !== null)) return false;
    if (step >= 3 && !(state.bags !== null && state.shortRains !== null && state.hasTrees !== null && C.foodChecks(state).ok)) return false;
    if (step >= 4 && C.violations(state).length) return false;
    return true;
  }
  function go(step) {
    if (!canEnter(step)) return;
    if (step === 3) clampPlan();
    state.step = step;
    save(); render();
    window.scrollTo(0, 0);
    if (step === 1) window.TupandeField.invalidate(); else window.TupandeField.onLeave();
    if (step === 5) buildShare();
  }

  /* ---------- Step 3: enterprises ---------- */
  function ctlCap(el) { return el.dataset.cap === 'field' ? Math.max(0, state.field.acres) : Number(el.dataset.cap); }

  // Keep the plan inside the limits after earlier answers change.
  function clampPlan() {
    var changed = false;
    if (state.ent.groundnut.on && C.violations(state).indexOf('land') >= 0) {
      var t = C.clone(state); t.ent.groundnut.on = false;
      if (C.violations(t).length < C.violations(state).length) { state.ent.groundnut.on = false; changed = true; }
    }
    CONTROL_ORDER.slice().reverse().forEach(function (path) {
      if (!C.violations(state).length) return;
      var el = $('.ctl[data-path="' + path + '"]');
      var m = C.maxFeasible(state, path, ctlCap(el), Number(el.dataset.step));
      if (getPath(path) > m.max) { setPath(path, Math.max(m.max, Number(el.dataset.min || 0))); changed = true; }
    });
    return changed;
  }

  var LIMIT_TEXT = { cash: 'Cash limit reached', land: 'Land limit reached', boundary: 'Boundary limit reached' };
  var CAP_TEXT = {
    'ent.chickens.perBatch': 'Prototype limit: 100 chicks per batch. This is not a farm carrying-capacity recommendation.',
    'ent.chickens.batches': 'Prototype limit: six batches a year. This is not a farm recommendation.'
  };

  function renderControls() {
    $$('.ctl').forEach(function (el) {
      var path = el.dataset.path, step = Number(el.dataset.step), min = Number(el.dataset.min || 0);
      var m = C.maxFeasible(state, path, ctlCap(el), step);
      var max = Math.max(m.max, min), val = getPath(path);
      var r = $('input[type=range]', el), box = $('.ctl-num', el), lim = $('[data-limit]', el);
      r.min = min; r.max = max; r.step = step;
      r.disabled = max <= min && min === 0 && m.reason !== 'cap';
      if (document.activeElement !== r) r.value = val;
      showNumber(box, val, step < 1 ? 2 : 0);
      var atMax = val >= max - 1e-9;
      lim.className = 'limit';
      if (atMax && m.reason !== 'cap') lim.textContent = LIMIT_TEXT[m.reason] + (max === 0 ? '. There is no room for this right now.' : '.');
      else if (atMax && CAP_TEXT[path]) { lim.textContent = CAP_TEXT[path]; lim.className = 'limit cap'; }
      else lim.textContent = '';
      el.hidden = path === 'ent.chickens.batches' && !(state.ent.chickens.perBatch > 0);
    });
  }

  function tileSummary(k) {
    var e = state.ent, d = C.derive(state);
    if (k === 'extraMaize') return e.extraMaize.acres > 0 ? ac(e.extraMaize.acres) + ' · ' + n0(d.extraBags) + ' bags to sell' : 'Choose an area';
    if (k === 'groundnut') return 'Groundnut package selected';
    if (k === 'fruit') return (e.fruit.avocado || e.fruit.mango) ? n0(e.fruit.avocado) + ' avocado, ' + n0(e.fruit.mango) + ' mango' : 'Choose how many seedlings';
    if (k === 'timber') return e.timber.count > 0 ? n0(e.timber.count) + (e.timber.mode === 'woodlot' ? ' in a woodlot' : ' on the boundary') : 'Choose how many seedlings';
    if (k === 'chickens') return e.chickens.perBatch > 0 ? n0(e.chickens.perBatch) + ' chicks × ' + e.chickens.batches + (e.chickens.batches === 1 ? ' batch' : ' batches') : 'Choose how many chicks';
  }
  var IDLE_SUMMARY = {};

  function renderTiles() {
    var d = C.derive(state);
    $('#famSummary').textContent = ac(d.minMaize) + ' kept for ' + n0(state.bags || 0) + ' bags' + (state.shortRains ? ', both seasons' : ', long rains');
    $$('.tile[data-ent]').forEach(function (t) {
      var k = t.dataset.ent, on = !!state.ent[k].on, open = !!state.expanded[k];
      t.classList.toggle('on', on);
      $('.tile-toggle', t).setAttribute('aria-pressed', on);
      $('.tile-expand', t).setAttribute('aria-expanded', open);
      $('.tile-body', t).hidden = !open;
      var sum = $('[data-summary]', t);
      if (!IDLE_SUMMARY[k]) IDLE_SUMMARY[k] = sum.textContent;
      sum.textContent = on ? tileSummary(k) : IDLE_SUMMARY[k];
    });
    $('[data-gn-banner]').hidden = !state.ent.groundnut.on;
    var gnTest = C.clone(state); gnTest.ent.groundnut.on = true;
    $('[data-gn-limit]').textContent = !state.ent.groundnut.on && C.violations(gnTest).length ? 'Land limit reached. The package needs 0.25 acres of free land.' : '';
    $$('input[name=timberMode]').forEach(function (r) { r.checked = r.value === state.ent.timber.mode; });
    $('#timberNote').textContent = state.ent.timber.mode === 'woodlot'
      ? 'Woodlot trees are spaced 3 × 3 m, so each seedling takes 9 m² of land. Only this year\'s planting is modelled.'
      : 'Up to ' + n0(d.boundaryMax) + ' trees along your ' + n0(state.field.perimeterM) + ' m boundary, one every 5 m. Boundary trees do not take crop land in this plan, but they can shade crops nearby; your agent should judge the spacing.';
    renderControls();
  }

  function toggleTile(k) {
    var e = state.ent[k];
    if (e.on) {
      // Unticking releases the land and cash.
      e.on = false;
      if (k === 'extraMaize') e.acres = 0;
      if (k === 'fruit') { e.avocado = 0; e.mango = 0; }
      if (k === 'timber') e.count = 0;
      if (k === 'chickens') { e.perBatch = 0; e.batches = 1; }
      state.expanded[k] = false;
    } else {
      if (k === 'groundnut') {
        var t = C.clone(state); t.ent.groundnut.on = true;
        if (C.violations(t).length) { state.expanded[k] = true; save(); render(); return; }
      }
      e.on = true;
      state.expanded[k] = true;
    }
    save(); render();
  }

  /* ---------- Field allocation diagram ---------- */
  function clipX(poly, c, keepLeft) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var ina = keepLeft ? a[0] <= c : a[0] >= c, inb = keepLeft ? b[0] <= c : b[0] >= c;
      if (ina) out.push(a);
      if (ina !== inb) { var t = (c - a[0]) / (b[0] - a[0]); out.push([c, a[1] + t * (b[1] - a[1])]); }
    }
    return out;
  }
  function polyArea(p) { var s = 0; for (var i = 0; i < p.length; i++) { var j = (i + 1) % p.length; s += p[i][0] * p[j][1] - p[j][0] * p[i][1]; } return Math.abs(s) / 2; }

  function fieldShape() {
    var xy = window.TupandeField.shapeXY() || [[0, 0], [1, 0], [1, 0.62], [0, 0.62]];
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    xy.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    var W = 320, H = 210, pad = 18, s = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
    var ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
    return xy.map(function (p) { return [ox + (p[0] - minX) * s, oy + (p[1] - minY) * s]; });
  }

  function sections() {
    var d = C.derive(state);
    return [
      { key: 'maize', label: 'Maize', acres: d.M, fill: COLOURS.maize },
      { key: 'groundnut', label: 'Groundnuts', acres: d.gnAcres, fill: COLOURS.groundnut },
      { key: 'oldFruit', label: 'Existing fruit trees', acres: d.existingFruit, fill: COLOURS.oldFruit },
      { key: 'newFruit', label: 'New fruit trees', acres: d.newFruit, fill: COLOURS.newFruit },
      { key: 'woodlot', label: 'Timber woodlot', acres: d.woodlot, fill: COLOURS.woodlot },
      { key: 'free', label: 'Available', acres: Math.max(0, d.available), fill: COLOURS.free }
    ].filter(function (s) { return s.acres > 1e-6; });
  }

  function fieldSVG(opts) {
    opts = opts || {};
    var shape = fieldShape(), total = polyArea(shape), d = C.derive(state), secs = sections();
    var sum = secs.reduce(function (a, s) { return a + s.acres; }, 0) || 1;
    var minX = Math.min.apply(null, shape.map(function (p) { return p[0]; })), maxX = Math.max.apply(null, shape.map(function (p) { return p[0]; }));
    function cutAt(frac) {
      var lo = minX, hi = maxX;
      for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (polyArea(clipX(shape, mid, true)) / total < frac) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    }
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 210" role="img" aria-label="Field allocation: ' +
      esc(secs.map(function (s) { return s.label + ' ' + ac(s.acres); }).join(', ')) + '">' +
      '<defs><pattern id="rows' + (opts.id || '') + '" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><path d="M0 4h8" stroke="rgba(117,76,61,.25)" stroke-width="1.5"/></pattern></defs>';
    var acc = 0, prev = minX - 1;
    secs.forEach(function (s, i) {
      acc += s.acres;
      var next = i === secs.length - 1 ? maxX + 1 : cutAt(acc / sum);
      var part = clipX(clipX(shape, prev, false), next, true);
      prev = next;
      if (part.length < 3) return;
      var dstr = 'M' + part.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z';
      out += '<path d="' + dstr + '" fill="' + s.fill + '"/>';
      if (s.key === 'maize') out += '<path d="' + dstr + '" fill="url(#rows' + (opts.id || '') + ')"/>';
      s.part = part;
    });
    var outline = 'M' + shape.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z';
    out += '<path d="' + outline + '" fill="none" stroke="' + COLOURS.ink + '" stroke-width="2.5" stroke-linejoin="round"/>';
    if (d.q.T > 0 && !d.q.woodlot) out += boundaryDots(shape, Math.min(d.q.T, 70));
    if (opts.labels !== false) secs.forEach(function (s) {
      if (!s.part) return;
      var xs = s.part.map(function (p) { return p[0]; }), ys = s.part.map(function (p) { return p[1]; });
      var w = Math.max.apply(null, xs) - Math.min.apply(null, xs);
      if (w < 46) return;
      var cx = (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2, cy = (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2;
      var dark = s.key === 'groundnut' || s.key === 'newFruit' || s.key === 'woodlot';
      out += '<text x="' + cx.toFixed(1) + '" y="' + (cy - 2).toFixed(1) + '" text-anchor="middle" font-family="Georama, Arial, sans-serif" font-weight="700" font-size="11" fill="' + (dark ? COLOURS.paper : COLOURS.ink) + '">' + esc(s.label.replace('Existing fruit trees', 'Existing trees').replace('New fruit trees', 'New trees')) + '</text>' +
             '<text x="' + cx.toFixed(1) + '" y="' + (cy + 12).toFixed(1) + '" text-anchor="middle" font-family="Georama, Arial, sans-serif" font-weight="700" font-size="11" fill="' + (dark ? COLOURS.paper : COLOURS.ink) + '">' + (Math.round(s.acres * 100) / 100).toFixed(2) + ' ac</text>';
    });
    return out + '</svg>';
  }

  function boundaryDots(shape, count) {
    var lens = [], total = 0;
    for (var i = 0; i < shape.length; i++) { var a = shape[i], b = shape[(i + 1) % shape.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); lens.push(l); total += l; }
    var out = '', stepLen = total / count;
    for (var k = 0; k < count; k++) {
      var dist = (k + 0.5) * stepLen, e = 0;
      while (dist > lens[e]) { dist -= lens[e]; e++; }
      var p = shape[e], q = shape[(e + 1) % shape.length], t = dist / lens[e];
      out += '<circle cx="' + (p[0] + t * (q[0] - p[0])).toFixed(1) + '" cy="' + (p[1] + t * (q[1] - p[1])).toFixed(1) + '" r="3.6" fill="' + COLOURS.teal + '" stroke="' + COLOURS.paper + '" stroke-width="1.4"/>';
    }
    return out;
  }

  function legendHTML() {
    var d = C.derive(state);
    var items = sections().map(function (s) { return '<li><span class="sw" style="background:' + s.fill + '"></span>' + esc(s.label) + ' ' + (Math.round(s.acres * 100) / 100).toFixed(2) + ' ac</li>'; });
    if (d.q.T > 0 && !d.q.woodlot) items.push('<li><span class="sw ring"></span>' + n0(d.q.T) + ' boundary timber trees</li>');
    return items.join('');
  }

  function renderFields() {
    $$('[data-field-svg]').forEach(function (el, i) { el.innerHTML = fieldSVG({ id: i }); });
    $$('[data-legend]').forEach(function (el) { el.innerHTML = legendHTML(); });
  }

  /* ---------- Review ---------- */
  function row(label, value, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td><td>' + value + '</td></tr>'; }

  function renderNow() {
    var d = C.derive(state), q = d.q, rows1 = '', rows2 = '';
    rows1 += row('Long-rains maize inputs, ' + ac(d.M), n0(d.lrInputs));
    rows1 += row('Less Tupande credit (ceiling ' + n0(d.L) + ')', '−' + n0(d.borrow));
    if (q.Av) rows1 += row(n0(q.Av) + ' avocado seedlings', n0(q.Av * AS.avocado.seedling));
    if (q.Mg) rows1 += row(n0(q.Mg) + ' mango seedlings', n0(q.Mg * AS.mango.seedling));
    if (q.T) rows1 += row(n0(q.T) + ' Grevillea seedlings' + (q.T <= AS.timber.free ? ' (free)' : ' (first 50 free)'), n0(Math.max(q.T - AS.timber.free, 0) * AS.timber.extraSeedling));
    if (q.N) rows1 += row(n0(q.N) + ' chicks, first batch', n0(d.firstBatch));
    rows1 += row('Cash needed to start', n0(d.cashStart), 'total');
    rows1 += row('Cash left uncommitted', n0(d.cashLeft));

    if (q.E) rows2 += row('Extra maize sold, ' + n0(d.extraBags) + ' bags', n0(d.extraSales));
    if (q.gn) rows2 += row('Groundnuts, gross', n0(d.gnGross));
    if (q.N) rows2 += row('Chickens, ' + (Math.round(d.birds * 10) / 10) + ' birds', range(d.chLo, d.chHi, ''));
    rows2 += row('Less listed costs', '−' + n0(d.costs));
    rows2 += row('Cash return after listed costs', range(d.cashReturnLo, d.cashReturnHi, ''), 'sub');
    rows2 += row('Maize kept for food, ' + n0(d.B) + ' bags', n0(d.foodValue));
    rows2 += row('Annual benefit', range(d.benefitLo, d.benefitHi, ''), 'total');

    var costs = '<li>Maize inputs, ' + ac(d.M) + (d.S === 2 ? ' in both seasons' : '') + ': ' + kes(d.maizeCosts) + '. Credit repays the long-rains inputs, so they are counted once.</li>';
    if (q.gn) costs += '<li>Groundnut inputs and financing: ' + kes(d.gnCost) + ', deducted from the sale.</li>';
    if (q.N) costs += '<li>Chick purchases for ' + q.K + (q.K === 1 ? ' batch' : ' batches') + ': ' + kes(d.chickCost) + '.</li>';
    if (d.treeCost) costs += '<li>Seedlings bought this year: ' + kes(d.treeCost) + '.</li>';
    var notes = d.S === 2 ? '<p class="note">Short-rains inputs of ' + kes(d.srInputs) + ' are assumed to be paid later from long-rains proceeds, so they are not reserved from your cash now. The planner does not check that those proceeds will be enough.</p>' : '';
    $('#panel-now').innerHTML =
      '<div class="page"><table class="ledger"><caption>Cash to start (KES)</caption><tbody>' + rows1 + '</tbody></table></div>' +
      '<div class="page"><table class="ledger"><caption>Annual result (KES)</caption><tbody>' + rows2 + '</tbody></table>' + notes + '</div>' +
      '<details class="more"><summary>What the listed costs include</summary><ul>' + costs +
      '<li>Not included: labour, transport, harvesting, maintenance, feed, housing and other costs you pay yourself.</li></ul></details>';
  }

  function renderFuture() {
    var fr = C.fruitByYear(state, 5), tv = C.timberValues(state), q = C.quantities(state);
    var hasFruit = fr.some(function (r) { return r.total > 0; }), html = '';
    if (hasFruit) {
      var rows = fr.map(function (r, i) {
        var label = i === 4 ? 'Year 5 onwards' : 'Year ' + r.year;
        var split = r.existingFruit && r.newFruit ? ' <small class="note">(' + n0(r.existingFruit) + ' existing, ' + n0(r.newFruit) + ' new)</small>' : '';
        return row(label + split, n0(r.total), i === 4 ? 'total' : '');
      }).join('');
      html += '<div class="page"><table class="ledger"><caption>Fruit sales a year (KES, gross)</caption><tbody>' + rows + '</tbody></table>' +
        '<p class="note">Avocado at KES 30/kg, mango at KES 20/kg. New seedlings assume 70% survive; existing trees use their current age.</p></div>';
    }
    if (q.T > 0) {
      var trows = tv.map(function (t) { return row('Sell at year ' + t.age, n0(t.value), t.age === 10 ? 'total' : ''); }).join('');
      html += '<div class="page"><table class="ledger"><caption>Grevillea, ' + (Math.round(tv[0].surviving * 10) / 10) + ' surviving trees (one-off sale, KES)</caption><tbody>' + trows + '</tbody></table>' +
        '<p class="note">These are alternatives: sell once, at one age. Waiting longer raises the value but delays the cash, and after harvest these trees have no further value. Values are illustrative, not buyer quotes.</p></div>';
    }
    if (!html) html = '<div class="page"><p class="empty">No trees in this plan yet. Add fruit or timber trees to see future values.</p></div>';
    $('#panel-future').innerHTML = html;
  }

  function deltaCell(label, lo, hi) {
    var cls = (lo + hi) / 2 > 0.5 ? 'up' : (lo + hi) / 2 < -0.5 ? 'down' : '';
    var txt = Math.round(lo) === Math.round(hi) ? signed(lo) : signed(lo) + ' to ' + signed(hi).replace('+', '');
    return '<div><small>' + label + '</small><strong class="' + cls + '">' + (Math.round(lo) === 0 && Math.round(hi) === 0 ? 'No change' : 'KES ' + txt) + '</strong></div>';
  }
  var alts = [];
  function renderAlts() {
    alts = C.alternatives(state);
    $('#alts').innerHTML = alts.length ? alts.map(function (a, i) {
      return '<article class="alt"><h3>' + esc(a.title) + '</h3><p>' + esc(a.detail) + '</p><div class="deltas">' +
        deltaCell('Annual benefit', a.dBenefitLo, a.dBenefitHi) +
        deltaCell('Cash needed to start', a.dCashStart, a.dCashStart).replace(/class="(up|down)"/, function (m, c) { return 'class="' + (c === 'up' ? 'down' : 'up') + '"'; }) +
        deltaCell('Future fruit a year', a.dFruit, a.dFruit) +
        deltaCell('Timber at year 10', a.dTimber, a.dTimber) +
        '</div><button class="btn btn-quiet btn-sm" type="button" data-alt="' + i + '">Use this alternative</button></article>';
    }).join('') : '<p class="empty">No other plan fits your land and cash better right now. You can keep this plan.</p>';
  }

  /* ---------- Share picture and text ---------- */
  function planLines() {
    var d = C.derive(state), q = d.q, L = [];
    L.push('Family maize: ' + ac(d.minMaize) + ' for ' + n0(d.B) + ' bags a year' + (d.S === 2 ? ' (long and short rains)' : ' (long rains)'));
    if (q.E) L.push('Extra maize: ' + ac(q.E) + ', about ' + n0(d.extraBags) + ' bags to sell');
    if (q.gn) L.push('Groundnut package: 0.25 acres');
    if (q.Av || q.Mg) L.push('New fruit trees: ' + n0(q.Av) + ' avocado, ' + n0(q.Mg) + ' mango');
    if (state.hasTrees && (state.existing.avocado.count || state.existing.mango.count)) L.push('Existing trees: ' + n0(state.existing.avocado.count) + ' avocado, ' + n0(state.existing.mango.count) + ' mango');
    if (q.T) L.push('Grevillea: ' + n0(q.T) + (q.woodlot ? ' in a woodlot' : ' on the boundary'));
    if (q.N) L.push('Chickens: ' + n0(q.N) + ' chicks × ' + q.K + (q.K === 1 ? ' batch' : ' batches'));
    return L;
  }

  function summaryText() {
    var d = C.derive(state), fr = C.fruitByYear(state, 5), tv = C.timberValues(state), t = [];
    t.push('*Tupande farm plan* (Kakamega)');
    t.push('Field: ' + ac(d.field));
    t.push('');
    planLines().forEach(function (l) { t.push('• ' + l); });
    t.push('');
    t.push('*This year* (estimates after listed costs)');
    t.push('• Annual benefit: ' + range(d.benefitLo, d.benefitHi) + ', including ' + kes(d.foodValue) + ' of maize kept for food');
    t.push('• Cash return: ' + range(d.cashReturnLo, d.cashReturnHi));
    t.push('• Cash needed to start: ' + kes(d.cashStart));
    t.push('• Tupande credit for long-rains maize inputs: ' + kes(d.borrow));
    if (d.q.gn) t.push('• Groundnut inputs of ' + kes(d.gnCost) + ' are deducted at sale');
    if (d.S === 2) t.push('• Short-rains inputs of ' + kes(d.srInputs) + ' to be paid later from long-rains proceeds');
    if (fr[4].total || d.q.T) {
      t.push('');
      t.push('*Future*');
      if (fr[4].total) t.push('• Fruit sales: about ' + kes(fr[2].total) + ' in year 3, ' + kes(fr[4].total) + ' a year from year 5');
      if (d.q.T) t.push('• Timber: ' + kes(tv[0].value) + ' if sold at year 5, or ' + kes(tv[5].value) + ' at year 10 (one or the other)');
    }
    t.push('');
    t.push('Not included: labour, transport, feed and other costs you pay yourself. Prices, yields and survival are planning assumptions, not guarantees. Credit is subject to agent confirmation.');
    return t.join('\n');
  }

  function loadImage(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function wrapText(ctx, text, maxW) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    return lines;
  }

  var pngBlob = null, pngUrl = null;
  function buildShare() {
    $('#summaryText').value = summaryText();
    $('#shareFallback').hidden = true;
    var svg = fieldSVG({ id: 'png', labels: false });
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return ready.then(function () {
      return Promise.all([
        loadImage('../assets/tupande-by-oaf-horizontal.png').catch(function () { return null; }),
        loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))
      ]);
    }).then(function (imgs) { return drawPng(imgs[0], imgs[1]); }).then(function (blob) {
      pngBlob = blob;
      if (pngUrl) URL.revokeObjectURL(pngUrl);
      pngUrl = URL.createObjectURL(blob);
      $('#pngPreview').src = pngUrl;
    });
  }

  function drawPng(logo, fieldImg) {
    var d = C.derive(state), fr = C.fruitByYear(state, 5), tv = C.timberValues(state);
    var W = 1080, P = 64, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = W; cv.height = 3400;
    var F = function (w, s) { return w + ' ' + s + 'px Georama, "Arial Narrow", Arial, sans-serif'; };
    var B = function (w, s) { return w + ' ' + s + 'px "Source Sans 3", Arial, sans-serif'; };
    ctx.fillStyle = '#F5F2EA'; ctx.fillRect(0, 0, W, cv.height);
    // Header with logo
    ctx.fillStyle = '#FFFDF8'; ctx.fillRect(0, 0, W, 150);
    if (logo) ctx.drawImage(logo, P, 38, 74 * logo.width / logo.height, 74);
    ctx.fillStyle = '#5A6461'; ctx.font = B('600', 30); ctx.textAlign = 'right'; ctx.fillText('Farm Planner', W - P, 88); ctx.textAlign = 'left';
    // Poster band
    var y = 150;
    ctx.fillStyle = '#2B7F68'; ctx.fillRect(0, y, W, 230);
    ctx.fillStyle = '#E8B757'; ctx.font = F('700', 28); ctx.fillText('KAKAMEGA · ' + ac(d.field).toUpperCase() + ' FIELD', P, y + 70);
    ctx.fillStyle = '#FFFFFF'; ctx.font = F('800', 76); ctx.fillText('My farm plan', P, y + 160);
    ctx.strokeStyle = '#E8B757'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(P + 250, y + 186); ctx.quadraticCurveTo(P + 395, y + 212, P + 540, y + 186); ctx.stroke();
    y += 230;
    // Totals strip: columns sized to their figures, text shrunk to fit
    ctx.fillStyle = '#E8B757'; ctx.fillRect(0, y, W, 150);
    var cells = [['Annual benefit*', range(d.benefitLo, d.benefitHi), 1.5], ['Cash needed to start', kes(d.cashStart), 1], ['Acres available', (Math.round(Math.max(0, d.available) * 100) / 100).toFixed(2), 0.8]];
    var unit = (W - 2 * P) / 3.3, cx0 = P;
    cells.forEach(function (c, i) {
      var cw = unit * c[2], cx = cx0 + cw / 2, size = 46;
      ctx.font = F('800', size);
      while (ctx.measureText(c[1]).width > cw - 20 && size > 26) { size -= 2; ctx.font = F('800', size); }
      ctx.textAlign = 'center'; ctx.fillStyle = '#22302D'; ctx.fillText(c[1], cx, y + 72);
      ctx.font = B('700', 26); ctx.fillText(c[0], cx, y + 112);
      if (i) { ctx.fillStyle = 'rgba(34,48,45,.25)'; ctx.fillRect(cx0 - 1, y + 30, 2, 90); }
      cx0 += cw;
    });
    ctx.textAlign = 'left';
    y += 150;
    // Field diagram card, sized to the diagram and its legend
    y += 40;
    var dw = W - 2 * P - 80, dh = dw * 210 / 320;
    ctx.font = B('600', 26);
    var leg = sections().map(function (s) { return [s.fill, s.label + ' ' + (Math.round(s.acres * 100) / 100).toFixed(2) + ' ac']; });
    if (d.q.T && !d.q.woodlot) leg.push(['ring', n0(d.q.T) + ' boundary trees']);
    var lx = 0, lrow = 0, placed = leg.map(function (l) {
      var w = ctx.measureText(l[1]).width + 48;
      if (lx + w > dw && lx > 0) { lx = 0; lrow++; }
      var at = { l: l, x: lx, row: lrow }; lx += w; return at;
    });
    var cardH = 30 + dh + 24 + (lrow + 1) * 40 + 24;
    roundRect(ctx, P, y, W - 2 * P, cardH, 28, '#FFFDF8');
    ctx.drawImage(fieldImg, P + 40, y + 30, dw, dh);
    var ly0 = y + 30 + dh + 24;
    placed.forEach(function (a) {
      var x = P + 40 + a.x, yy = ly0 + a.row * 40, l = a.l;
      if (l[0] === 'ring') { ctx.strokeStyle = '#2F6067'; ctx.lineWidth = 4; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(x + 11, yy + 11, 9, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      else { roundRect(ctx, x, yy, 22, 22, 5, l[0]); if (l[0] === COLOURS.free) { ctx.strokeStyle = '#D9D2BF'; ctx.lineWidth = 2; ctx.stroke(); } }
      ctx.fillStyle = '#22302D'; ctx.fillText(l[1], x + 32, yy + 19);
    });
    y += cardH;
    // Sections of text
    y += 40;
    function heading(t) { ctx.fillStyle = '#2F6067'; ctx.font = F('800', 40); ctx.fillText(t, P, y); y += 22; ctx.fillStyle = '#CF482B'; ctx.fillRect(P, y, 80, 5); y += 46; }
    function bullet(t, bold) {
      ctx.font = B(bold ? '700' : '400', 30); ctx.fillStyle = '#22302D';
      wrapText(ctx, t, W - 2 * P - 34).forEach(function (line, i) { if (i === 0) { ctx.fillStyle = '#2B7F68'; ctx.beginPath(); ctx.arc(P + 9, y - 10, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#22302D'; } ctx.fillText(line, P + 34, y); y += 40; });
      y += 6;
    }
    heading('The plan');
    planLines().forEach(function (l) { bullet(l); });
    y += 20; heading('This year');
    bullet('Annual benefit ' + range(d.benefitLo, d.benefitHi) + ', including ' + kes(d.foodValue) + ' of maize kept for food', true);
    bullet('Cash return after listed costs: ' + range(d.cashReturnLo, d.cashReturnHi));
    bullet('Cash needed to start: ' + kes(d.cashStart));
    bullet('Tupande credit for long-rains maize inputs: ' + kes(d.borrow));
    if (d.q.gn) bullet('Groundnut inputs of ' + kes(d.gnCost) + ' deducted at sale; ' + kes(d.gnPayment) + ' paid to you');
    if (d.S === 2) bullet('Short-rains inputs of ' + kes(d.srInputs) + ' assumed paid later from long-rains proceeds');
    if (fr[4].total || d.q.T) {
      y += 20; heading('Future');
      if (fr[4].total) bullet('Fruit sales about ' + kes(fr[2].total) + ' in year 3 and ' + kes(fr[4].total) + ' a year from year 5');
      if (d.q.T) bullet('Timber: ' + kes(tv[0].value) + ' if sold at year 5, or ' + kes(tv[5].value) + ' at year 10. One or the other, not both.');
    }
    y += 20;
    var foot = ['*Annual benefit includes the value of maize kept for food.', 'Estimates, not guarantees. Excludes labour, transport, feed, housing and other costs you pay yourself. Prices, yields and survival rates are planning assumptions. Credit is subject to agent confirmation.'];
    ctx.font = B('400', 25);
    var fl = [];
    foot.forEach(function (f) { fl = fl.concat(wrapText(ctx, f, W - 2 * P - 48)); });
    roundRect(ctx, P, y, W - 2 * P, fl.length * 34 + 44, 20, '#FAF1DD');
    ctx.fillStyle = '#5A6461';
    fl.forEach(function (l, i) { ctx.fillText(l, P + 24, y + 46 + i * 34); });
    y += fl.length * 34 + 44 + 50;
    ctx.fillStyle = '#2B7F68'; ctx.fillRect(0, y, W, 110);
    ctx.fillStyle = '#FFFFFF'; ctx.font = F('800', 40); ctx.fillText('Together, we rise.', P, y + 68);
    ctx.font = B('400', 24); ctx.textAlign = 'right'; ctx.fillText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - P, y + 66); ctx.textAlign = 'left';
    y += 110;
    // Crop to content
    var out = document.createElement('canvas'); out.width = W; out.height = y;
    out.getContext('2d').drawImage(cv, 0, 0);
    return new Promise(function (res) { out.toBlob(res, 'image/png'); });
  }
  function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  function downloadPng() {
    if (!pngUrl) return;
    var a = document.createElement('a');
    a.href = pngUrl; a.download = 'tupande-farm-plan.png';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function sharePlan() {
    var text = summaryText();
    var file = pngBlob && typeof File === 'function' ? new File([pngBlob], 'tupande-farm-plan.png', { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], text: text, title: 'Tupande farm plan' }).catch(function (e) {
        if (e && e.name !== 'AbortError') showFallback(text);
      });
      return;
    }
    showFallback(text);
  }
  // No file sharing: download the picture and say plainly that it must be attached by hand.
  function showFallback(text) {
    downloadPng();
    $('#waLink').href = 'https://wa.me/?text=' + encodeURIComponent(text);
    $('#shareFallback').hidden = false;
  }

  /* ---------- Render ---------- */
  function render() {
    var s = state.step;
    $$('.step').forEach(function (el) { el.hidden = Number(el.dataset.step) !== s; });
    $$('.progress li').forEach(function (li) {
      var n = Number(li.dataset.step);
      li.classList.toggle('done', n < s); li.classList.toggle('current', n === Math.min(s, 4));
      if (n === Math.min(s, 4)) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });

    // Step 1
    window.TupandeField.render();
    showNumber($('#cash'), state.cash, 0);
    $('#year').value = String(state.year);
    $('#creditOut').textContent = kes(C.creditCeiling(state.year));
    $('#to2').disabled = !canEnter(2);
    $('#to2Hint').textContent = canEnter(2) ? '' : !state.field.confirmed ? 'Confirm your field to continue.' : 'Enter the cash you can invest now (0 is fine).';

    // Step 2
    showNumber($('#bags'), state.bags, 1);
    $$('input[name=shortRains]').forEach(function (r) { r.checked = state.shortRains !== null && (r.value === 'yes') === state.shortRains; });
    $$('input[name=hasTrees]').forEach(function (r) { r.checked = state.hasTrees !== null && (r.value === 'yes') === state.hasTrees; });
    $('#treeDetails').hidden = state.hasTrees !== true;
    showNumber($('#exAvCount'), state.existing.avocado.count, 0); showNumber($('#exAvAge'), state.existing.avocado.age, 0);
    showNumber($('#exMgCount'), state.existing.mango.count, 0); showNumber($('#exMgAge'), state.existing.mango.age, 0);
    $('#srNote').textContent = state.shortRains
      ? 'Each acre gives 20 bags per harvest, twice a year. Short-rains inputs are assumed to be paid later from long-rains proceeds.'
      : 'Each acre gives 20 bags per harvest.';
    renderChecks();

    // Steps 3 and 4
    if (s >= 3) { renderTiles(); renderFields(); }
    $('#toReview').disabled = !canEnter(4);
    if (s === 4) { $('#rvAcres').textContent = ac(state.field.acres); renderNow(); renderFuture(); renderAlts(); }

    // Rolling totals
    var showTotals = s === 3 || s === 4;
    $('#totals').hidden = !showTotals;
    document.body.classList.toggle('has-totals', showTotals);
    if (showTotals) {
      var d = C.derive(state);
      $('#tBenefit').textContent = range(d.benefitLo, d.benefitHi);
      $('#tCash').textContent = kes(d.cashStart);
      $('#tCash').classList.toggle('bad', d.cashStart > d.C + 1e-9);
      $('#tAcres').textContent = (Math.round(d.available * 100) / 100).toFixed(2);
      $('#tAcres').classList.toggle('bad', d.available < -1e-9);
    }
  }

  function renderChecks() {
    var ready = state.bags !== null && state.shortRains !== null && state.hasTrees !== null;
    var f = C.foodChecks(state), L = $('#checkLand'), M = $('#checkFund');
    $('#landSum').textContent = ac(f.minMaize) + ' maize' + (f.existingFruit ? ' + ' + ac(f.existingFruit) + ' existing trees' : '') + ' of ' + ac(state.field.acres || 0);
    $('#fundSum').textContent = kes(f.needCash) + ' inputs vs ' + kes(f.funding) + ' cash and credit';
    L.className = 'check' + (ready ? (f.landOk ? ' ok' : ' fail') : '');
    M.className = 'check' + (ready ? (f.fundOk ? ' ok' : ' fail') : '');
    $('#landResult').textContent = !ready ? 'Answer the questions above.' : f.landOk ? 'Yes. Family maize is protected on this land.' : 'Not enough land. You are ' + ac(f.landShortfall) + ' short. Check the field, tree numbers or bags needed.';
    $('#fundResult').textContent = !ready ? 'Answer the questions above.' : f.fundOk ? 'Yes. Your cash and credit cover the family maize inputs.' : 'Not enough money. You are ' + kes(f.fundShortfall) + ' short. Check your cash, customer year or bags needed.';
    $('#to3').disabled = !canEnter(3);
  }

  /* ---------- Wiring ---------- */
  bindNumber($('#cash'), function (v) { state.cash = v; save(); render(); });
  $('#year').addEventListener('change', function (e) { state.year = Number(e.target.value); save(); render(); });
  $('#to2').addEventListener('click', function () { go(2); });

  bindNumber($('#bags'), function (v) { state.bags = v; save(); render(); });
  [['#exAvCount', 'existing.avocado.count'], ['#exAvAge', 'existing.avocado.age'], ['#exMgCount', 'existing.mango.count'], ['#exMgAge', 'existing.mango.age']].forEach(function (p) {
    bindNumber($(p[0]), function (v) { setPath(p[1], v); save(); render(); });
  });
  $$('input[name=shortRains]').forEach(function (r) { r.addEventListener('change', function () { state.shortRains = r.value === 'yes'; save(); render(); }); });
  $$('input[name=hasTrees]').forEach(function (r) { r.addEventListener('change', function () { state.hasTrees = r.value === 'yes'; save(); render(); }); });
  $('#to3').addEventListener('click', function () { go(3); });

  $$('.tile[data-ent]').forEach(function (t) {
    var k = t.dataset.ent;
    $('.tile-toggle', t).addEventListener('click', function () { toggleTile(k); });
    $('.tile-expand', t).addEventListener('click', function () { state.expanded[k] = !state.expanded[k]; save(); render(); });
  });
  $$('.ctl').forEach(function (el) {
    var path = el.dataset.path, r = $('input[type=range]', el), box = $('.ctl-num', el);
    var ent = path.split('.')[1];
    function apply(v) { state.ent[ent].on = true; setPath(path, v); save(); render(); }
    r.addEventListener('input', function () { apply(Number(r.value)); });
    bindNumber(box, apply, function () {
      var m = C.maxFeasible(state, path, ctlCap(el), Number(el.dataset.step)), min = Number(el.dataset.min || 0);
      return { min: min, max: Math.max(m.max, min) };
    });
  });
  $$('input[name=timberMode]').forEach(function (r) {
    r.addEventListener('change', function () {
      state.ent.timber.mode = r.value;
      var el = $('.ctl[data-path="ent.timber.count"]'), m = C.maxFeasible(state, 'ent.timber.count', ctlCap(el), 1);
      if (state.ent.timber.count > m.max) state.ent.timber.count = m.max;
      save(); render();
    });
  });
  $('#toReview').addEventListener('click', function () { go(4); });

  $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.dataset.go)); }); });
  $$('[role=tab]').forEach(function (tab, i, tabs) {
    function select(t) { tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; }); }
    tab.addEventListener('click', function () { select(tab); });
    tab.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; select(n); n.focus();
    });
  });
  $('#alts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-alt]');
    if (!b) return;
    state.ent = alts[Number(b.dataset.alt)].state.ent;
    save(); render();
    $('#step-4').scrollIntoView();
  });
  $('#happy').addEventListener('click', function () { go(5); });
  $('#sharePlan').addEventListener('click', sharePlan);
  $('#downloadPng').addEventListener('click', downloadPng);
  function newPlan() {
    if (!window.confirm('Start a new plan? This clears the current plan on this device.')) return;
    state = defaults();
    try { localStorage.removeItem(STORE); } catch (e) { /* nothing stored */ }
    window.TupandeField.reset();
    render(); window.scrollTo(0, 0);
  }
  $('#newPlan').addEventListener('click', newPlan);
  $('#newPlan2').addEventListener('click', newPlan);

  window.TupandeField.init(function () { return state; }, function () { save(); render(); });
  if (!canEnter(state.step)) state.step = 1;
  render();
  if (state.step === 5) buildShare();
})();
