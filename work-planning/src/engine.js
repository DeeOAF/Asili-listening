/* Work Planning engine: illustrative data generator + deterministic cascade.
   No DOM access. All arithmetic is plain code; nothing here calls a language model. */
(function (root) {
  'use strict';

  /* ---------- constants ---------- */
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY_DATES = ['9 Nov', '10 Nov', '11 Nov', '12 Nov', '13 Nov', '14 Nov'];
  var DAY_CAP = [7, 7, 7, 7, 7, 3]; // productive hours per day
  var WEEK_HOURS = 38;
  var AGEING_DAYS = 42;

  // kind: season = cumulative % of a season target (gap is shared down by headroom)
  //       rate   = ratio that applies to every unit (converted to KES to collect)
  //       count  = a fixed number each person owes (visits, modules, calls)
  var METRICS = {
    clients:  { label: 'Clients enrolled',        unit: 'clients', kind: 'season', hrs: 0.6,       mean: 6.0 },
    groups:   { label: 'Groups enrolled',         unit: 'groups',  kind: 'season', hrs: 4.5,       mean: 1.05 },
    scoped:   { label: 'GLs scoped',              unit: 'GLs',     kind: 'season', hrs: 1.1,       mean: 1.55 },
    repaid:   { label: 'Repayment collected',     unit: 'KES',     kind: 'rate',   hrs: 1 / 20000, mean: 58000 },
    hvc:      { label: 'HVC client visits',       unit: 'visits',  kind: 'count',  hrs: 0.5,       mean: 5.7 },
    training: { label: 'Training modules passed', unit: 'modules', kind: 'count',  hrs: 1.5,       mean: 0.42 },
    glcalls:  { label: 'GL validation calls',     unit: 'calls',   kind: 'count',  hrs: 0.25,      mean: 4.1 },
    duka:     { label: 'Duka compliance visits',  unit: 'dukas',   kind: 'count',  hrs: 1,         mean: 5, owner: 'DA' }
  };
  /* the pillar each measure serves, so a priority can be read as a push on enrolment, repayment, HVC, extension or the duka network */
  var PILLARS = {
    enrolment: { label: 'Enrolment', short: 'Enrol', metrics: ['clients', 'groups'] },
    repayment: { label: 'Repayment', short: 'Repay', metrics: ['repaid'] },
    hvc:       { label: 'HVC', short: 'HVC', metrics: ['hvc'] },
    extension: { label: 'Extension', short: 'Ext', metrics: ['training', 'scoped', 'glcalls'] },
    duka:      { label: 'Duka', short: 'Duka', metrics: ['duka'] }
  };
  function ownedByDA(metric) { return METRICS[metric].owner === 'DA'; }
  function pillarOf(metric) { for (var k in PILLARS) if (PILLARS[k].metrics.indexOf(metric) >= 0) return k; return null; }

  var KIND_LABEL = { season: 'Trajectory', rate: 'Rate', count: 'Per person' };

  /* ---------- default regional priorities (illustrative) ---------- */
  function P(id, metric, title, text, target, deadline, weight, extra) {
    var o = { id: id, metric: metric, title: title, text: text, target: target, deadline: deadline, weight: weight, norm: 0, aud: {} };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  var REGION_DEFS = [
    {
      id: 'mkc', name: 'Mount Kenya and Coast', rm: 'Njeri Mwangi', basis: 'Style taken from the weekly enrolment and repayment notes',
      areas: [['Mt Kenya A', 'Caroline Wafula'], ['Mt Kenya B', 'Ibrahim Salim'], ['Coast', 'Zawadi Mwalimu']],
      also: { AC: ['Review the Healthy Path with your ZSs and agree an execution plan for each zone.', 'Check progress every morning and support the lagging zones first.'],
              ZS: ['Help each TA build a workplan and pick the clients and GLs to start with.', 'Review progress with every TA each day.'] },
      prios: [
        P('p1', 'groups', 'Group enrolment', 'Reach 8% of our group target by Friday and 35% by 30 November. Every TA enrols at least 3 groups a day, starting with last season finishers and GLs already scoped.', 8, 4, 45, { norm: 3,
          aud: { AC: 'Rank zones by gap and support the furthest behind first.', ZS: 'Sit with the TAs carrying most of the gap and fix their week.', TA: 'Enrol groups daily, finishers and scoped GLs first.' } }),
        P('p2', 'repaid', 'Repayment', 'Lift portfolio repayment to 66% by Friday. Chase the biggest arrears first.', 66, 4, 25, {
          aud: { AC: 'Watch zone repayment each morning.', ZS: 'Pair TAs with the biggest arrears for joint visits.', TA: 'Collect from the largest arrears first.' } }),
        P('p3', 'glcalls', 'GL validation calls', 'Finish 12 GL validation calls each by Wednesday 11am.', 12, 2, 15, {
          aud: { AC: 'Confirm every ZS has the call list.', ZS: 'Check calls are done before the Wednesday deadline.', TA: 'Call your GLs before any group visit.' } }),
        P('d1', 'duka', 'Duka compliance', 'Every Duka Assistant checks 25 dukas for compliance by Friday, the dukas with the most farmer orders first.', 25, 4, 15, {
          aud: { AC: 'Check each zone\'s duka visits on Wednesday.', ZS: 'Agree the duka list with your Duka Assistants on Monday.', DA: 'Check about 5 dukas a day, nearest first.' } })
      ]
    },
    {
      id: 'rift', name: 'Rift', rm: 'Kiprono Cheruiyot', basis: 'Illustrative priorities: no Rift notes seen yet',
      areas: [['Rift North', 'Jepkoech Langat'], ['Rift South', 'Mutai Kiprop']],
      also: { AC: ['Plan HVC visits by zone so no zone is left for Friday.'], ZS: ['Book training slots for your TAs on Monday.'] },
      prios: [
        P('p1', 'hvc', 'HVC visits', 'Every TA visits 30 HVC clients this week, soya and sunflower first.', 30, 4, 35, {
          aud: { AC: 'Make sure each zone has a visit plan by Tuesday.', ZS: 'Cluster HVC visits by village.', TA: 'Visit 6 HVC clients a day, soya and sunflower first.' } }),
        P('p2', 'clients', 'Client enrolment', 'Reach 9% of clients enrolled by Friday.', 9, 4, 30, {
          aud: { AC: 'Support zones below the Healthy Path.', ZS: 'Agree each TA\'s enrolment list.', TA: 'Enrol within groups you already know.' } }),
        P('p3', 'training', 'Training', 'All TAs and ZSs complete 4 training modules and pass at 80%.', 4, 4, 20, {
          aud: { AC: 'Block training time in your zones.', ZS: 'Complete your own modules first.', TA: 'Finish one module each day.' } }),
        P('d1', 'duka', 'Duka compliance', 'Every Duka Assistant checks 20 dukas for compliance by Friday, starting with dukas not visited this month.', 20, 4, 15, {
          aud: { AC: 'Check each zone\'s duka visits on Wednesday.', ZS: 'Agree the duka list with your Duka Assistants on Monday.', DA: 'Check about 5 dukas a day, nearest first.' } })
      ]
    },
    {
      id: 'uw', name: 'Upper Western', rm: 'Namukhula Wekesa', basis: 'Illustrative priorities: no Upper Western notes seen yet',
      areas: [['Upper Western East', 'Simiyu Barasa'], ['Upper Western West', 'Nekesa Wanyama']],
      also: { AC: ['Review GL scoping lists with each ZS on Tuesday.'], ZS: ['Confirm scoped GLs with a call before enrolment.'] },
      prios: [
        P('p1', 'repaid', 'Repayment', 'Reach 68% repayment by Friday. Every TA works their own arrears list.', 68, 4, 40, {
          aud: { AC: 'Compare zone repayment daily.', ZS: 'Joint visits for the three largest arrears per TA.', TA: 'Work your arrears list from the largest.' } }),
        P('p2', 'scoped', 'GL scoping', 'Scope 70% of target GLs by the end of the week.', 70, 4, 30, {
          aud: { AC: 'Track scoping by zone.', ZS: 'Review each TA\'s scoped list.', TA: 'Scope the GLs with the most farmers first.' } }),
        P('p3', 'hvc', 'HVC visits', 'Each TA visits 20 HVC clients, groundnut and soya first.', 20, 4, 15, {
          aud: { AC: 'No action beyond monitoring.', ZS: 'Cluster visits by village.', TA: 'About 4 HVC visits a day.' } }),
        P('d1', 'duka', 'Duka compliance', 'Every Duka Assistant checks 25 dukas for compliance by Friday.', 25, 4, 15, {
          aud: { AC: 'Check each zone\'s duka visits on Wednesday.', ZS: 'Agree the duka list with your Duka Assistants on Monday.', DA: 'Check about 5 dukas a day, nearest first.' } })
      ]
    },
    {
      id: 'lw', name: 'Lower Western', rm: 'Otieno Ouma', basis: 'Style taken from the Weekly Focus note and the Stawi Station note',
      areas: [['Lower Western North', 'Atieno Opiyo'], ['Lower Western South', 'Awino Onyango']],
      also: { AC: ['Support the lagging zones on repayment first.'], ZS: ['Stawi Station: finish socketing by Thursday.', 'Send the weekly KPI form by Friday noon.'] },
      prios: [
        P('p1', 'repaid', 'Repayment completion', 'Lift repayment to 70% by Friday. Every TA reaches 70% on their own portfolio.', 70, 4, 40, {
          aud: { AC: 'Support lagging zones on repayment.', ZS: 'Joint visits for the largest arrears.', TA: 'Collect from the largest arrears first.' } }),
        P('p2', 'scoped', 'GL scoping', 'Scope 70% of target GLs by Friday.', 70, 4, 25, {
          aud: { AC: 'Track scoping by zone.', ZS: 'Check scoped lists with each TA.', TA: 'Scope the biggest GLs first.' } }),
        P('p3', 'glcalls', 'GL validation calls', 'Complete GL validation calls by Wednesday 11am, 10 each.', 10, 2, 20, {
          aud: { AC: 'Confirm ZS call lists.', ZS: 'Check calls before the deadline.', TA: 'Call before visiting.' } }),
        P('d1', 'duka', 'Duka compliance', 'Every Duka Assistant checks 25 dukas for compliance by Friday, Stawi Station dukas first.', 25, 4, 15, {
          aud: { AC: 'Check each zone\'s duka visits on Wednesday.', ZS: 'Agree the duka list with your Duka Assistants on Monday.', DA: 'Check about 5 dukas a day, nearest first.' } })
      ]
    },
    {
      id: 'nyz', name: 'Nyanza', rm: 'Achieng Awino', basis: 'Illustrative priorities: no Nyanza notes seen yet',
      areas: [['Nyanza North', 'Auma Odhiambo'], ['Nyanza South', 'Omondi Okoth']],
      also: { AC: ['Keep one training day free in every zone.'], ZS: ['Share the enrolment list with TAs on Monday.'] },
      prios: [
        P('p1', 'clients', 'Client enrolment', 'Reach 10% of clients enrolled by Friday.', 10, 4, 35, {
          aud: { AC: 'Support zones below the Healthy Path.', ZS: 'Agree enrolment lists with TAs.', TA: 'Enrol within groups you already know.' } }),
        P('p2', 'repaid', 'Repayment', 'Lift repayment to 66% by Friday.', 66, 4, 30, {
          aud: { AC: 'Watch zone repayment daily.', ZS: 'Joint visits for the largest arrears.', TA: 'Collect from the largest arrears first.' } }),
        P('p3', 'training', 'Training', 'All TAs and ZSs complete 3 training modules with an 80% pass rate.', 3, 4, 20, {
          aud: { AC: 'Protect training time.', ZS: 'Complete your own modules first.', TA: 'Finish a module a day.' } }),
        P('d1', 'duka', 'Duka compliance', 'Every Duka Assistant checks 20 dukas for compliance by Friday.', 20, 4, 15, {
          aud: { AC: 'Check each zone\'s duka visits on Wednesday.', ZS: 'Agree the duka list with your Duka Assistants on Monday.', DA: 'Check about 5 dukas a day, nearest first.' } })
      ]
    }
  ];

  /* ---------- random helpers ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clip(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sum(arr, f) { var s = 0; for (var i = 0; i < arr.length; i++) s += f ? f(arr[i], i) : arr[i]; return s; }

  var FIRST = ['Achieng', 'Wanjiru', 'Kiprop', 'Naliaka', 'Otieno', 'Mwende', 'Cheptoo', 'Barasa', 'Akinyi', 'Kamau', 'Nekesa', 'Wambui', 'Kibet', 'Atieno', 'Mutua', 'Chebet', 'Simiyu', 'Adhiambo', 'Njoroge', 'Auma', 'Kiplagat', 'Nafula', 'Omondi', 'Wairimu', 'Rotich', 'Awino', 'Nyambura', 'Juma', 'Faith', 'Brian', 'Grace', 'Peter', 'Mercy', 'Samuel', 'Esther', 'Joseph', 'Lucy', 'Daniel', 'Beatrice', 'Collins', 'Dorcas', 'Emmanuel', 'Hellen', 'Isaac', 'Joyce', 'Kennedy', 'Lilian', 'Moses'];
  var LAST = ['Mwangi', 'Odhiambo', 'Wekesa', 'Kiptoo', 'Mutiso', 'Ochieng', 'Karanja', 'Chelimo', 'Wafula', 'Onyango', 'Kimani', 'Langat', 'Masinde', 'Owino', 'Njuguna', 'Koech', 'Wanyama', 'Okoth', 'Gitau', 'Cheruiyot', 'Barasa', 'Opiyo', 'Maina', 'Sang', 'Mulwa', 'Anyango', 'Kariuki', 'Ruto', 'Nyaga', 'Akello'];
  var GROUP_NAMES = ['Tumaini', 'Umoja', 'Jipe Moyo', 'Harambee', 'Bidii', 'Amani', 'Imani', 'Upendo', 'Pamoja', 'Baraka', 'Neema', 'Furaha', 'Maendeleo', 'Nuru', 'Ushindi', 'Subira', 'Mwangaza', 'Tegemeo', 'Chemichemi', 'Faraja'];
  var VIL_A = ['Ki', 'Ka', 'Mu', 'Ng', 'Ol', 'Ch', 'Kap', 'Ndu', 'Mwa', 'Bu', 'Sia', 'Oya'];
  var VIL_B = ['lima', 'tungu', 'bogo', 'wera', 'ndiri', 'mbini', 'sabuli', 'tiet', 'nyoro', 'kembu', 'rongo', 'taru'];

  /* ---------- data generator ---------- */
  function generateData(seed) {
    var rng = mulberry32(seed || 20261109);
    function rand() { return rng(); }
    function randn() { var u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    function rint(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
    function prob(x) { var f = Math.floor(x); return f + (rng() < x - f ? 1 : 0); }
    function pick(a) { return a[Math.floor(rng() * a.length)]; }
    var used = {};
    function personName() {
      for (var tries = 0; tries < 50; tries++) {
        var n = pick(FIRST) + ' ' + pick(LAST);
        if (!used[n]) { used[n] = 1; return n; }
      }
      var m = pick(FIRST) + ' ' + String.fromCharCode(65 + rint(0, 25)) + '. ' + pick(LAST);
      used[m] = 1; return m;
    }
    function village() { return pick(VIL_A) + pick(VIL_B); }

    var data = { regions: [], tas: [], byId: {}, seed: seed || 20261109 };
    var idc = 0;

    REGION_DEFS.forEach(function (rd) {
      var region = { id: rd.id, name: rd.name, rm: rd.rm, basis: rd.basis, also: rd.also, areas: [] };
      var storyArea = rd.areas.length - 1; // last area carries the weak zone
      rd.areas.forEach(function (ad, ai) {
        var area = { id: rd.id + '-a' + (ai + 1), name: ad[0], ac: ad[1], zones: [], regionId: rd.id };
        for (var zi = 0; zi < 3; zi++) {
          var zoneEffect = (ai === storyArea && zi === 1) ? 0.58 : 0.82 + rand() * 0.36;
          var zone = { id: area.id + '-z' + (zi + 1), name: ad[0] + ' Z' + (zi + 1), zs: personName(), tas: [], areaId: area.id, regionId: rd.id, effect: zoneEffect };
          for (var ti = 0; ti < 5; ti++) {
            var featured = (rd.id === 'mkc' && ai === 0 && zi === 0 && ti === 2);
            var f = clip((1 + 0.22 * randn()) * zoneEffect, 0.3, 1.7);
            if (featured) f = 0.86;
            var S = { clients: rint(340, 460), groups: rint(85, 115), scoped: rint(26, 34) };
            var due = Math.round(rint(2000000, 2900000) / 1000) * 1000;
            var A0 = {
              clients: Math.round(S.clients * clip(0.030 + 0.011 * randn(), 0.005, 0.07)),
              groups: Math.round(S.groups * clip(0.036 + 0.014 * randn(), 0.005, 0.08)),
              scoped: Math.round(S.scoped * clip(0.41 + 0.08 * randn(), 0.15, 0.7)),
              repaid: Math.round(due * clip(0.58 + 0.07 * randn(), 0.35, 0.78) / 1000) * 1000,
              hvc: 0, glcalls: 0, duka: 0, training: rint(0, 2)
            };
            var pool = {
              clients: Math.round(S.clients * (0.35 + rand() * 0.55)),
              groups: Math.round(S.groups * (0.25 + rand() * 0.45)),
              scoped: Math.max(1, S.scoped - A0.scoped)
            };
            var daily = {};
            Object.keys(METRICS).forEach(function (mk) {
              if (mk === 'duka') return;
              var arr = [];
              for (var di = 0; di < 6; di++) {
                var dayF = di === 5 ? 0.4 : 1;
                var noise = clip(1 + 0.35 * randn(), 0.2, 2.2);
                var v = METRICS[mk].mean * f * dayF * noise;
                if (mk === 'repaid') v = Math.round(v / 500) * 500;
                else if (mk === 'training') v = rng() < METRICS[mk].mean * f * dayF ? 1 : 0;
                else v = prob(v);
                arr.push(v);
              }
              daily[mk] = arr;
            });
            daily.duka = [0, 0, 0, 0, 0, 0]; // Duka compliance belongs to the zone's Duka Assistants
            // training can never pass 4 modules in total
            var tcap = 4 - A0.training, ts = 0;
            daily.training = daily.training.map(function (v) { var k = Math.min(v, Math.max(0, tcap - ts)); ts += k; return k; });
            var village1 = village();
            var gl = [];
            var gcount = 9;
            for (var gi = 0; gi < gcount; gi++) {
              var members = rint(8, 24);
              gl.push({
                name: GROUP_NAMES[(gi * 3 + ti + zi) % GROUP_NAMES.length],
                village: gi % 3 === 0 ? village1 : village(),
                members: members,
                unenrolled: Math.round(members * rand() * 0.6),
                arrears: rng() < 0.7 ? Math.round(rint(4000, 70000) / 500) * 500 : 0,
                lastContact: rint(3, 70)
              });
            }
            var ta = {
              id: 'ta' + (++idc), name: featured ? 'Doreen Achieng' : personName(),
              regionId: rd.id, areaId: area.id, zoneId: zone.id, territory: village1,
              f: f, season: S, due: due, A0: A0, pool: pool, daily: daily, groups: gl
            };
            if (featured) used['Doreen Achieng'] = 1;
            zone.tas.push(ta);
            data.tas.push(ta);
            data.byId[ta.id] = ta;
          }
          area.zones.push(zone);
          data.byId[zone.id] = zone;
        }
        region.areas.push(area);
        data.byId[area.id] = area;
      });
      data.regions.push(region);
      data.byId[region.id] = region;
    });
    // Duka Assistants: a separate branch under the zone, two per zone, generated last
    data.das = [];
    var dn = 0;
    data.regions.forEach(function (rg) { rg.areas.forEach(function (ar) { ar.zones.forEach(function (zn) {
      zn.das = [0, 1].map(function (k) {
        var id = 'da' + (++dn), f = clip((1 + 0.18 * gauss('dof|' + id)) * zn.effect, 0.35, 1.6), arr = [], hr = hashRng('dod|' + id);
        for (var di = 0; di < 6; di++) {
          var x = METRICS.duka.mean * f * DAYF[di] * clip(1 + 0.3 * gauss('dd|' + id + '|' + di), 0.3, 2), fl = Math.floor(x);
          arr.push(fl + (hr() < x - fl ? 1 : 0));
        }
        var o = { id: id, name: personName(), role: 'DA', regionId: rg.id, areaId: ar.id, zoneId: zn.id, territory: null, f: f, season: {}, due: 0, A0: { duka: 0 }, pool: {}, daily: { duka: arr }, groups: [], dukas: [] };
        var dk = ['Agrovet', 'Farm Shop', 'Stores', 'Duka', 'Agro Centre', 'Traders'];
        for (var j = 0; j < 6; j++) { var vv = village(); o.dukas.push({ name: vv + ' ' + dk[(j + k) % dk.length], village: vv }); }
        o.patch = o.dukas[0].village + ' to ' + o.dukas[5].village;
        data.das.push(o); data.byId[id] = o; return o;
      });
    }); }); });
    return data;
  }

  function defaultPriorities(regionId) {
    var rd = REGION_DEFS.filter(function (r) { return r.id === regionId; })[0];
    return JSON.parse(JSON.stringify(rd.prios));
  }

  /* ---------- per-TA, per-priority calculation ---------- */
  function paceAt(d, dl) { return Math.min(1, (d + 1) / (dl + 1)); }

  function calcTA(ta, p, d) {
    var m = METRICS[p.metric], S = null, base;
    if (m.kind === 'season') { S = ta.season[p.metric]; base = p.target / 100 * S; }
    else if (m.kind === 'rate') { S = ta.due; base = p.target / 100 * S; }
    else { base = p.target; }
    var A0 = ta.A0[p.metric] || 0;
    var gain = 0;
    for (var i = 0; i <= d; i++) gain += ta.daily[p.metric][i];
    var raw = base - A0;
    var need = Math.max(0, raw);
    var pace = paceAt(d, p.deadline);
    var expected = need * pace;
    var distance = gain - expected;
    var remaining = Math.max(0, need - gain);
    var progress = need > 0 ? Math.min(1, gain / need) : 1;
    var paceProg = need > 0 ? Math.min(1, gain / Math.max(1e-9, need * pace)) : 1;
    var poolLeft = m.kind === 'season' ? Math.max(0, ta.pool[p.metric] - gain) : Infinity;
    var c = {
      pid: p.id, metric: p.metric, kind: m.kind, S: S, base: base, A0: A0, raw: raw, need: need, gain: gain,
      pace: pace, expected: expected, distance: distance, remaining: remaining,
      progress: progress, paceProg: paceProg, poolLeft: poolLeft, ask: remaining
    };
    c.status = statusOf(c);
    return c;
  }

  function naCalc(p) {
    return { pid: p.id, metric: p.metric, kind: 'count', S: null, base: 0, A0: 0, raw: 0, need: 0, gain: 0, pace: 1, expected: 0, distance: 0, remaining: 0, progress: 1, paceProg: 1, poolLeft: 0, ask: 0, status: 'done', na: true };
  }
  /* Duka priorities are carried by Duka Assistants: a unit above the TA is read from its zones' assistants, a single TA carries nothing */
  function daRowsFor(rows) {
    if (rows.length && rows[0].isDA) return rows;
    if (rows.length === 1) return [];
    var seen = {}, out = [];
    rows.forEach(function (r) { if (!seen[r.zone.id]) { seen[r.zone.id] = 1; (r.das || []).forEach(function (d) { out.push(d); }); } });
    return out;
  }
  function statusOf(c) {
    if (c.need <= 0) return 'done';
    if (c.gain >= c.need) return 'done';
    var r = c.distance / c.need;
    if (r >= 0.08) return 'ahead';
    if (r >= -0.08) return 'on';
    if (r >= -0.25) return 'slip';
    if (r >= -0.5) return 'behind';
    return 'critical';
  }

  /* Share a zone's remaining gap between its TAs by headroom.
     Only TAs who are behind their own share carry it, and nobody is asked for
     more than their own shortfall or the farmers/groups they still have left. */
  function allocateZone(rows, pid) {
    var gap = Math.max(0, sum(rows, function (r) { return r.calcs[pid].raw - r.calcs[pid].gain; }));
    var cands = [];
    rows.forEach(function (r) {
      var c = r.calcs[pid];
      var own = c.raw - c.gain;
      c.ask = 0;
      if (own > 1e-9) cands.push({ c: c, cap: Math.min(own, c.poolLeft), w: Math.max(0.5, c.poolLeft), got: 0 });
    });
    var left = gap, active = cands.slice(), guard = 0;
    while (left > 1e-6 && active.length && guard++ < 20) {
      var W = sum(active, function (a) { return a.w; }), used = 0, next = [];
      active.forEach(function (a) {
        var give = Math.min(left * a.w / W, a.cap - a.got);
        a.got += give; used += give;
        if (a.cap - a.got > 1e-6) next.push(a);
      });
      left -= used; active = next;
      if (used < 1e-9) break;
    }
    cands.forEach(function (a) { a.c.ask = a.got; a.c.share = gap > 0 ? a.got / gap : 0; });
    return { gap: gap, unabsorbed: Math.max(0, left), gross: sum(cands, function (a) { return a.c.raw - a.c.gain; }) };
  }

  /* ---------- weights to time, then time to a day-by-day plan ---------- */
  function hrsFor(metric, units) { return units * METRICS[metric].hrs; }

  function planTA(row, prios, d, opts) {
    opts = opts || {};
    var days = [];
    for (var i = d + 1; i <= 5; i++) days.push(i);
    var Hrem = sum(days, function (i) { return DAY_CAP[i]; });

    var wTA = sum(prios, function (p) { return ownedByDA(p.metric) ? 0 : p.weight; }) || 100;
    // 1. what each priority still needs, in hours
    var items = prios.map(function (p) {
      var c = row.calcs[p.id];
      var ask = opts.met === p.id ? 0 : c.ask;
      var needH = hrsFor(p.metric, ask);
      return { pid: p.id, p: p, weight: p.weight, ask: ask, needH: needH, met: needH < 0.05, daOwned: ownedByDA(p.metric), baseBudget: ownedByDA(p.metric) ? 0 : Hrem * p.weight / wTA, budget: 0, alloc: 0, overdue: false };
    });

    // 2. weights share the time, but only among priorities that still have work:
    //    when one is met, its hours go to the others in proportion to their weights
    var activeW = sum(items, function (it) { return it.met ? 0 : it.weight; });
    items.forEach(function (it) {
      it.overdue = d > it.p.deadline && !it.met;
      it.budget = (!it.met && activeW > 0) ? Hrem * it.weight / activeW : 0;
      it.alloc = it.met ? 0 : Math.min(it.needH, it.budget);
    });

    // 3. a priority that needs less than its share gives the rest back; passed deadlines, then weight, take it first
    var spare = Hrem - sum(items, function (it) { return it.alloc; });
    var order = items.filter(function (it) { return !it.met; }).sort(function (a, b) { return (b.overdue - a.overdue) || (b.weight - a.weight); });
    order.forEach(function (it) {
      var add = Math.min(spare, it.needH - it.alloc);
      if (add > 1e-9) { it.alloc += add; spare -= add; }
    });
    items.forEach(function (it) {
      var m = METRICS[it.p.metric];
      it.short = Math.max(0, it.needH - it.alloc);
      it.shortUnits = it.short / m.hrs;
      it.topUp = Math.max(0, it.alloc - it.budget);
      it.released = it.met ? it.baseBudget : 0;
      it.gained = it.met ? 0 : Math.max(0, it.budget - it.baseBudget);
    });
    var free = Math.max(0, Hrem - sum(items, function (it) { return it.alloc; }));

    // 4. time still left goes to groups nobody has contacted for six weeks, never to filler visits
    var ageing = row.ta.groups.filter(function (g) { return g.lastContact >= AGEING_DAYS; }).sort(function (a, b) { return b.lastContact - a.lastContact; });
    var ageH = Hrem > 0 ? Math.min(Math.floor(free * 4) / 4, ageing.length) : 0;
    if (ageH < 0.5) ageH = 0;
    free = Math.max(0, free - ageH);

    var ptr = {}, aptr = 0;
    var dayPlans = days.map(function (di) {
      var cap = DAY_CAP[di], blocks = [];
      var sorted = items.slice().sort(function (a, b) { return (b.overdue - a.overdue) || (b.weight - a.weight); });
      var clock = 0;
      sorted.forEach(function (it) {
        if (it.alloc <= 0.01 || Hrem <= 0) return;
        var hours = Math.round(it.alloc * cap / Hrem * 4) / 4;
        if (hours < 0.25) return;
        var units = hours / METRICS[it.p.metric].hrs;
        var act = actionFor(row.ta, it.p, units, hours, ptr, row.calcs[it.pid], it, Hrem);
        blocks.push({ pid: it.pid, title: it.p.title, metric: it.p.metric, hours: hours, units: units, text: act.text, reasons: act.reasons, part: di === 5 ? 'Morning' : (clock + hours / 2 < 3.5 ? 'Morning' : 'Afternoon'), overdue: it.overdue });
        clock += hours;
      });
      if (ageH > 0) {
        var ah = Math.round(ageH * cap / Hrem * 4) / 4;
        if (ah >= 0.25) {
          var g1 = ageing[aptr % ageing.length], g2 = ageing[(aptr + 1) % ageing.length];
          aptr += 2;
          blocks.push({ pid: 'ageing', title: 'Ageing check-ins', metric: null, hours: ah, units: null,
            text: 'Check in with ' + g1.name + ' (' + g1.lastContact + ' days since last contact)' + (ageing.length > 1 && ah >= 1 ? ' and ' + g2.name + ' (' + g2.lastContact + ' days)' : ''),
            reasons: ['Ageing rule: time that no priority needs goes to groups left alone for six weeks or more'], part: di === 5 ? 'Morning' : 'Afternoon', overdue: false });
        }
      }
      var over = sum(blocks, function (b) { return b.hours; }) - cap;
      while (over > 1e-9 && blocks.length) {
        var big = blocks.slice().sort(function (a, b) { return b.hours - a.hours; })[0];
        big.hours -= 0.25; big.units = big.metric ? big.hours / METRICS[big.metric].hrs : null; over -= 0.25;
      }
      blocks = blocks.filter(function (b) { return b.hours >= 0.25; });
      return { i: di, label: DAYS[di], date: DAY_DATES[di], cap: cap, blocks: blocks, used: sum(blocks, function (b) { return b.hours; }) };
    });
    return { days: dayPlans, Hrem: Hrem, items: items, free: free, ageHours: ageH, activeW: activeW };
  }

  /* where a group of TAs will really spend their time, against what the RM's weights say */
  function focusOf(rows, prios) {
    var items = prios.map(function (p, i) {
      var agg = aggregate(rows, p);
      return {
        pid: p.id, p: p, weight: p.weight, agg: agg, daOwned: ownedByDA(p.metric),
        alloc: sum(rows, function (r) { return r.plan.items[i].alloc; }),
        needH: sum(rows, function (r) { return r.plan.items[i].needH; }),
        metCount: sum(rows, function (r) { return r.plan.items[i].met ? 1 : 0; })
      };
    });
    var ageH = sum(rows, function (r) { return r.plan.ageHours || 0; });
    var total = sum(items, function (it) { return it.alloc; });
    var wT = sum(items, function (it) { return it.daOwned ? 0 : it.weight; }) || 1;
    items.forEach(function (it) {
      it.weightEff = it.daOwned ? null : it.weight / wT * 100;
      it.share = (total > 0 && !it.daOwned) ? it.alloc / total * 100 : null;
      it.delta = it.share == null ? null : it.share - it.weightEff;
    });
    return { items: items, total: total, ageH: ageH, n: rows.length, over: total <= 0 };
  }

  function ranked(ta, key, fn) {
    ta._rank = ta._rank || {};
    if (!ta._rank[key]) ta._rank[key] = ta.groups.slice().sort(fn);
    return ta._rank[key];
  }

  function actionFor(ta, p, units, hours, ptr, calc, item, Hrem) {
    var m = p.metric, reasons = [];
    reasons.push('Weight ' + p.weight + '% gives ' + item.budget.toFixed(1) + ' h of ' + Hrem + ' h left' + (item.gained > 0.05 ? ', which includes ' + item.gained.toFixed(1) + ' h freed because another priority is already met' : '') + (item.topUp > 0.05 ? ', plus ' + item.topUp.toFixed(1) + ' h of spare time' : ''));
    if (item.overdue) reasons.unshift('Deadline passed, so this goes first');
    var text;
    var k = ptr[p.id] || 0;
    if (m === 'clients' || m === 'groups') {
      var list = ranked(ta, 'enrol', function (a, b) { return ((b.lastContact >= AGEING_DAYS) - (a.lastContact >= AGEING_DAYS)) || (b.unenrolled - a.unenrolled); });
      var g1 = list[k % list.length], g2 = list[(k + 1) % list.length];
      ptr[p.id] = k + 2;
      if (m === 'clients') {
        text = 'Enrol about ' + Math.max(1, Math.round(units)) + ' clients in ' + g1.name + ' (' + g1.unenrolled + ' not yet enrolled) and ' + g2.name + ' (' + g2.unenrolled + ')';
      } else {
        var n = Math.max(1, Math.round(units));
        text = 'Enrol ' + n + (n === 1 ? ' group' : ' groups') + ' around ' + g1.village + ', last season finishers first';
      }
      if (g1.lastContact >= AGEING_DAYS) reasons.push('Ageing rule: ' + g1.name + ' has had no contact for ' + g1.lastContact + ' days');
    } else if (m === 'scoped') {
      var l2 = ranked(ta, 'scope', function (a, b) { return b.members - a.members; });
      var s1 = l2[k % l2.length];
      ptr[p.id] = k + 1;
      text = 'Scope about ' + Math.max(1, Math.round(units)) + ' GLs, starting with the group leader of ' + s1.name + ' (' + s1.members + ' members)';
    } else if (m === 'repaid') {
      var l3 = ranked(ta, 'arrears', function (a, b) { return b.arrears - a.arrears; });
      var r1 = l3[k % l3.length], r2 = l3[(k + 1) % l3.length];
      ptr[p.id] = k + 2;
      text = 'Collect about KES ' + (Math.round(units / 1000) * 1000).toLocaleString('en-US') + ': ' + r1.name + ' (arrears KES ' + r1.arrears.toLocaleString('en-US') + ') and ' + r2.name + ' (KES ' + r2.arrears.toLocaleString('en-US') + ')';
    } else if (m === 'hvc') {
      var v = ta.groups[k % ta.groups.length].village;
      ptr[p.id] = k + 1;
      text = 'Visit ' + Math.max(1, Math.round(units)) + ' HVC clients around ' + v + ', in one loop';
    } else if (m === 'training') {
      var mod = Math.min(4, ta.A0.training + calc.gain + 1 + k);
      ptr[p.id] = k + 1;
      text = 'Training module ' + mod + ' and its assessment (80% to pass)';
    } else if (m === 'duka') {
      var dl = ta.dukas && ta.dukas.length ? ta.dukas : ta.groups, d1 = dl[k % dl.length];
      ptr[p.id] = k + 1;
      text = 'Check ' + Math.max(1, Math.round(units)) + ' dukas for compliance around ' + d1.village + (ta.dukas ? ', starting with ' + d1.name : ', nearest first');
    } else {
      var l4 = ranked(ta, 'calls', function (a, b) { return b.members - a.members; });
      var c1 = l4[k % l4.length];
      ptr[p.id] = k + 1;
      text = 'Call ' + Math.max(1, Math.round(units)) + ' GLs, starting with ' + c1.name;
    }
    return { text: text, reasons: reasons };
  }

  /* ---------- compute a whole region ---------- */
  function computeRegion(region, prios, d, opts) {
    opts = opts || {};
    var rows = [], byTA = {}, zoneAlloc = {}, dRows = [], byDA = {};
    var taP = prios.filter(function (p) { return !ownedByDA(p.metric); }), daP = prios.filter(function (p) { return ownedByDA(p.metric); });
    region.areas.forEach(function (area) {
      area.zones.forEach(function (zone) {
        var zrows = zone.tas.map(function (ta) {
          var calcs = {};
          prios.forEach(function (p) { calcs[p.id] = ownedByDA(p.metric) ? naCalc(p) : calcTA(ta, p, d); });
          return { ta: ta, zone: zone, area: area, calcs: calcs };
        });
        var zd = (zone.das || []).map(function (o) {
          var calcs = {};
          daP.forEach(function (p) { calcs[p.id] = calcTA(o, p, d); });
          var wsD = sum(daP, function (p) { return p.weight; }) || 1;
          var sc = daP.length ? sum(daP, function (p) { return p.weight * calcs[p.id].paceProg; }) / wsD * 100 : 100;
          var rowD = { ta: o, zone: zone, area: area, calcs: calcs, isDA: true, score: sc, status: sc >= 95 ? 'on' : sc >= 82 ? 'slip' : sc >= 60 ? 'behind' : 'critical' };
          rowD.plan = planTA(rowD, daP, d);
          dRows.push(rowD); byDA[o.id] = rowD; return rowD;
        });
        zrows.forEach(function (r) { r.das = zd; });
        zoneAlloc[zone.id] = {};
        prios.forEach(function (p) {
          if (METRICS[p.metric].kind === 'season') zoneAlloc[zone.id][p.id] = allocateZone(zrows, p.id);
        });
        var wsum = sum(taP, function (p) { return p.weight; }) || 1;
        zrows.forEach(function (r) {
          r.score = sum(taP, function (p) { return p.weight * r.calcs[p.id].paceProg; }) / wsum * 100;
          var allGood = taP.every(function (p) { var s = r.calcs[p.id].status; return s === 'ahead' || s === 'done'; });
          r.status = allGood ? 'ahead' : r.score >= 95 ? 'on' : r.score >= 82 ? 'slip' : r.score >= 60 ? 'behind' : 'critical';
          var zw = opts.zoneWeights && opts.zoneWeights[zone.id];
          r.plan = planTA(r, zw ? prios.map(function (p, i) { var c = {}; Object.keys(p).forEach(function (k) { c[k] = p[k]; }); c.weight = zw[i]; return c; }) : prios, d);
          r.localWeights = zw || null;
          rows.push(r); byTA[r.ta.id] = r;
        });
      });
    });
    return { rows: rows, byTA: byTA, dRows: dRows, byDA: byDA, zoneAlloc: zoneAlloc, d: d, prios: prios };
  }

  /* roll a list of TA rows up into one line for a priority */
  function aggregate(rows, p) {
    var m = METRICS[p.metric];
    if (ownedByDA(p.metric)) rows = daRowsFor(rows);
    var a = { n: rows.length, need: 0, gain: 0, expected: 0, distance: 0, remaining: 0, ask: 0, A0: 0, S: 0, counts: { done: 0, ahead: 0, on: 0, slip: 0, behind: 0, critical: 0 } };
    rows.forEach(function (r) {
      var c = r.calcs[p.id];
      a.need += c.need; a.gain += c.gain; a.expected += c.expected; a.distance += c.distance;
      a.remaining += c.remaining; a.ask += c.ask; a.A0 += c.A0; a.S += (c.S || 0);
      a.counts[c.status]++;
    });
    a.status = a.need <= 0 ? 'done' : a.gain >= a.need ? 'done' : (function () {
      var r = a.distance / a.need;
      return r >= 0.08 ? 'ahead' : r >= -0.08 ? 'on' : r >= -0.25 ? 'slip' : r >= -0.5 ? 'behind' : 'critical';
    })();
    if (m.kind !== 'count' && a.S > 0) {
      a.curPct = (a.A0 + a.gain) / a.S * 100;
      a.expPct = (a.A0 + a.expected) / a.S * 100;
    }
    a.na = rows.length === 0;
    return a;
  }

  /* what the weights imply for time, before the week starts */
  function weekCheck(region, prios) {
    var tas = [];
    region.areas.forEach(function (a) { a.zones.forEach(function (z) { z.tas.forEach(function (t) { tas.push(t); }); }); });
    var wT = sum(prios, function (p) { return ownedByDA(p.metric) ? 0 : p.weight; }) || 1;
    var out = prios.map(function (p) {
      if (ownedByDA(p.metric)) return { pid: p.id, weight: p.weight, budget: 0, needUnits: 0, needH: 0, owner: 'DA' };
      var needUnits = sum(tas, function (t) { return calcTA(t, p, -1).need; }) / tas.length;
      var needH = needUnits * METRICS[p.metric].hrs;
      return { pid: p.id, weight: p.weight, budget: WEEK_HOURS * p.weight / wT, needUnits: needUnits, needH: needH };
    });
    var spare = WEEK_HOURS - sum(out, function (o) { return Math.min(o.needH, o.budget); });
    var order = out.slice().sort(function (a, b) { return b.weight - a.weight; });
    out.forEach(function (o) { o.alloc = Math.min(o.needH, o.budget); });
    order.forEach(function (o) { var add = Math.min(spare, o.needH - o.alloc); if (add > 1e-9) { o.alloc += add; spare -= add; } });
    out.forEach(function (o) { o.short = Math.max(0, o.needH - o.alloc); o.shortUnits = o.short / METRICS[prios.filter(function (p) { return p.id === o.pid; })[0].metric].hrs; });
    return { items: out, totalNeed: sum(out, function (o) { return o.needH; }), free: Math.max(0, spare), tas: tas.length };
  }

  /* does a daily norm agree with what the target needs? */
  function normCheck(region, prios) {
    var tas = [];
    region.areas.forEach(function (a) { a.zones.forEach(function (z) { z.tas.forEach(function (t) { tas.push(t); }); }); });
    var res = [];
    prios.forEach(function (p) {
      if (!p.norm || ownedByDA(p.metric)) return;
      var needUnits = sum(tas, function (t) { return calcTA(t, p, -1).need; }) / tas.length;
      var implied = p.norm * 5;
      res.push({ pid: p.id, norm: p.norm, implied: implied, needUnits: needUnits, ratio: needUnits > 0 ? implied / needUnits : Infinity });
    });
    return res;
  }


  /* ---------- closed-week review ---------- */
  function hashRng(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return mulberry32(h >>> 0);
  }
  /* Prototype only: stands in for the average of the four weeks before, which the real tool reads from weekly snapshots.
     Priority measures are given a slightly lower history so the review has something to find. */
  var NONPRIO = 0.88;
  var DAYF = [1, 1, 1, 1, 1, 0.4];
  function dayShare(d) { var a = 0, b = 0; for (var i = 0; i < 6; i++) { b += DAYF[i]; if (i <= d) a += DAYF[i]; } return a / b; }
  function priorAvg(ta, metric, isPriority) {
    var r = hashRng(ta.id + '|' + metric), u = 0, v = 0;
    while (u === 0) u = r(); while (v === 0) v = r();
    var z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v), typical = 0;
    for (var d = 0; d < 6; d++) typical += METRICS[metric].mean * ta.f * (d === 5 ? 0.4 : 1);
    var ratio = Math.max(0.4, Math.min(1.6, NONPRIO + 0.16 * z));
    return typical * ratio;
  }
  function weekGain(ta, metric, d) { var t = 0; for (var i = 0; i <= (d == null ? 5 : d); i++) t += ta.daily[metric][i]; return t; }
  function reviewUnit(rows, prios, d) {
    d = d == null ? 5 : d; var share = dayShare(d);
    var ids = {}; prios.forEach(function (p) { ids[p.metric] = true; });
    var items = prios.map(function (p) {
      var need = 0, gain = 0, prior = 0, met = 0, pp = 0, rr = ownedByDA(p.metric) ? daRowsFor(rows) : rows;
      if (!rr.length) return { pid: p.id, p: p, weight: p.weight, need: 0, gain: 0, prior: 0, met: 0, n: 0, achieved: 1, change: null, verdict: 'met-flat', na: true };
      rr.forEach(function (r) {
        var c = r.calcs[p.id];
        need += c.need; gain += c.gain; prior += priorAvg(r.ta, p.metric, true) * share; pp += c.paceProg;
        if (c.remaining <= 1e-9) met++;
      });
      var achieved = need > 0 ? gain / need : 1, change = prior > 0 ? (gain - prior) / prior : null, v;
      var isMet = d >= 5 ? (achieved >= 0.98 && met / rr.length >= 0.8) : (pp / rr.length >= 0.95), up = change != null && change > 0.05;
      v = isMet ? (up ? 'met-up' : 'met-flat') : (up ? 'short-up' : 'short-flat');
      return { pid: p.id, p: p, weight: p.weight, need: need, gain: gain, prior: prior, met: met, n: rr.length, achieved: achieved, change: change, verdict: v };
    });
    var others = Object.keys(METRICS).filter(function (k) { return !ids[k]; }).map(function (k) {
      var gain = 0, prior = 0;
      (ownedByDA(k) ? daRowsFor(rows) : rows).forEach(function (r) { gain += weekGain(r.ta, k, d) * NONPRIO; prior += priorAvg(r.ta, k, false) * share; });
      return { metric: k, gain: gain, prior: prior, change: prior > 0 ? (gain - prior) / prior : null };
    });
    function avg(a) { var x = a.filter(function (i) { return i.change != null; }); return x.length ? sum(x, function (i) { return i.change; }) / x.length : null; }
    return { items: items, others: others, prioChange: avg(items), otherChange: avg(others), n: rows.length };
  }


  /* ---------- eight-week history (prototype: generated, except the latest week which is the live data) ---------- */
  var HIST_WEEKS = ['21 Sep', '28 Sep', '5 Oct', '12 Oct', '19 Oct', '26 Oct', '2 Nov', '9 Nov'];
  var WSETS = [[50, 30, 20], [40, 40, 20], [40, 30, 30], [60, 20, 20], [45, 35, 20]];
  function gauss(key) { var r = hashRng(key), u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function typicalWeek(ta, metric) { var t = 0; for (var d = 0; d < 6; d++) t += METRICS[metric].mean * ta.f * DAYF[d]; return t; }
  /* weights for a generated past week: the weight set over the first three, 15 for any fourth, scaled back to 100 */
  function histPrios(metrics, ws, w2) {
    var raw = metrics.map(function (m, i) { return i < ws.length ? ws[i] : 15; }), tot = sum(raw);
    var out = metrics.map(function (m, i) { return { id: 'h' + w2 + i, metric: m, title: METRICS[m].label, weight: Math.round(raw[i] * 100 / tot) }; });
    out[0].weight += 100 - sum(out, function (p) { return p.weight; });
    return out;
  }
  function history(region, prios, rows5, dd) {
    dd = dd == null ? 5 : dd;
    var keys = Object.keys(METRICS), r = hashRng('hist|' + region.id), sets = [];
    var cur = prios.map(function (p) { return p.metric; });
    sets[7] = cur;
    for (var w = 6; w >= 0; w--) {
      var s = sets[w + 1].slice();
      if (r() < 0.55) { var i = Math.floor(r() * s.length), pool = keys.filter(function (k) { return s.indexOf(k) < 0; }); s[i] = pool[Math.floor(r() * pool.length)]; }
      sets[w] = s;
    }
    var tas = [], struct = [];
    region.areas.forEach(function (a) { var sa = { id: a.id, zones: [] }; a.zones.forEach(function (z) { var sz = { id: z.id, tas: [], das: (z.das || []) }; z.tas.forEach(function (t) { tas.push(t); sz.tas.push(t.id); }); sa.zones.push(sz); }); struct.push(sa); });
    var weeks = [];
    function zf(zoneId, w2) { return 1.0 + 0.012 * (w2 + 1) * (gauss('zs|' + zoneId) > 0 ? 1 : -0.6) + 0.07 * gauss('zw|' + zoneId + '|' + w2) + 0.03 * gauss('rw|' + region.id + '|' + w2); }
    for (var w2 = 0; w2 < 8; w2++) {
      var live = w2 === 7;
      var pl = live ? prios.map(function (p) { return { id: p.id, metric: p.metric, title: p.title, weight: p.weight }; })
        : histPrios(sets[w2], WSETS[Math.floor(hashRng('w|' + region.id + w2)() * WSETS.length)], w2);
      var wk = { label: HIST_WEEKS[w2], live: live, prios: pl, idx: {}, p: {}, score: {}, dp: {}, zidx: {} };
      var wT = sum(pl, function (p) { return ownedByDA(p.metric) ? 0 : p.weight; }) || 1;
      // Duka Assistants, one value per zone
      struct.forEach(function (sa) { sa.zones.forEach(function (sz) {
        var zi = {}, dpz = [];
        keys.filter(ownedByDA).forEach(function (m) {
          var isP = pl.some(function (p) { return p.metric === m; });
          if (live) {
            var vals = sz.das.map(function (o) { var t = typicalWeek(o, m); return t > 0 ? weekGain(o, m, dd) / (t * dayShare(dd)) : 1; });
            zi[m] = (sum(vals) / (vals.length || 1)) * (isP ? 1 : NONPRIO);
          } else zi[m] = Math.max(0.35, Math.min(1.6, (isP ? 1.0 : NONPRIO) * zf(sz.id, w2) + 0.14 * gauss(sz.id + '|do|' + w2 + '|' + m)));
        });
        pl.forEach(function (p) {
          if (!ownedByDA(p.metric)) { dpz.push(null); return; }
          if (live) { var rr = (rows5.dRows || []).filter(function (x) { return x.zone.id === sz.id; }); dpz.push(rr.length ? sum(rr, function (x) { return x.calcs[p.id].paceProg; }) / rr.length : 1); }
          else dpz.push(Math.max(0, Math.min(1, zi[p.metric] * 1.02)));
        });
        wk.dp[sz.id] = dpz; wk.zidx[sz.id] = zi;
      }); });
      tas.forEach(function (ta) {
        var idx = {}, pr = [];
        var zfa = zf(ta.zoneId, w2);
        keys.forEach(function (m) {
          if (ownedByDA(m)) { idx[m] = wk.zidx[ta.zoneId][m]; return; }
          var isP = pl.some(function (p) { return p.metric === m; });
          if (live) { var t = typicalWeek(ta, m); idx[m] = (t > 0 ? weekGain(ta, m, dd) / (t * dayShare(dd)) : 1) * (isP ? 1 : NONPRIO); }
          else idx[m] = Math.max(0.35, Math.min(1.6, (isP ? 1.0 : NONPRIO) * zfa + 0.14 * gauss(ta.id + '|' + w2 + '|' + m)));
        });
        pl.forEach(function (p) { pr.push(ownedByDA(p.metric) ? null : (live ? rows5.byTA[ta.id].calcs[p.id].paceProg : Math.max(0, Math.min(1, idx[p.metric] * 1.02)))); });
        wk.idx[ta.id] = idx; wk.p[ta.id] = pr;
        wk.score[ta.id] = sum(pl, function (p, i) { return pr[i] == null ? 0 : p.weight * pr[i]; }) / wT * 100;
      });
      weeks.push(wk);
    }
    return { weeks: weeks, keys: keys, struct: struct };
  }
  function histUnit(h, ids) {
    function mean(a) { a = a.filter(function (x) { return x != null; }); return a.length ? sum(a) / a.length : null; }
    var single = ids.length === 1, inIds = {}; ids.forEach(function (id) { inIds[id] = 1; });
    var zones = [], areas = [];
    h.struct.forEach(function (sa) {
      var full = true, zs = [];
      sa.zones.forEach(function (sz) {
        var n = sz.tas.filter(function (id) { return inIds[id]; }).length;
        if (n > 0) zones.push(sz);
        if (n === sz.tas.length) zs.push(sz); else full = false;
      });
      if (full && sa.zones.length) areas.push(sa);
    });
    var fullZones = zones.filter(function (sz) { return sz.tas.every(function (id) { return inIds[id]; }); });
    // progress on priority i for a set of TAs and the zones they belong to
    function prog(wk, i, taIds, zIds) {
      if (ownedByDA(wk.prios[i].metric)) return (single && taIds.length === 1) ? null : mean(zIds.map(function (z) { return wk.dp[z][i]; }));
      return mean(taIds.map(function (id) { return wk.p[id][i]; }));
    }
    function allMet(wk, taIds, zIds, th) {
      var any = false, ok = true;
      wk.prios.forEach(function (p, i) { var v = prog(wk, i, taIds, zIds); if (v == null) return; any = true; if (v < th) ok = false; });
      return any && ok;
    }
    var weeks = h.weeks.map(function (wk) {
      var zIds = zones.map(function (z) { return z.id; });
      var wsum = 0, acc = 0, hits = 0, n = 0;
      wk.prios.forEach(function (p, i) { var v = prog(wk, i, ids, zIds); if (v == null) return; wsum += p.weight; acc += p.weight * v; n++; if (v >= 0.95) hits++; });
      var sc = wsum ? acc / wsum * 100 : null;
      var met = ids.filter(function (id) { return wk.p[id].every(function (x) { return x == null || x >= 0.98; }); }).length / ids.length;
      var lv = {
        areas: { met: areas.filter(function (a) { return allMet(wk, [].concat.apply([], a.zones.map(function (z) { return z.tas; })), a.zones.map(function (z) { return z.id; }), 0.95); }).length, n: areas.length },
        zones: { met: fullZones.filter(function (z) { return allMet(wk, z.tas, [z.id], 0.95); }).length, n: fullZones.length },
        tas: { met: ids.filter(function (id) { return allMet(wk, [id], [], 0.95); }).length, n: ids.length }
      };
      return { label: wk.label, live: wk.live, prios: wk.prios, score: sc, met: met, hits: hits, n: n, lv: lv };
    });
    var lifts = h.keys.map(function (m) {
      var pi = [], ni = [];
      h.weeks.forEach(function (wk) {
        var v = mean(ids.map(function (id) { return wk.idx[id][m]; }));
        if (wk.prios.some(function (p) { return p.metric === m; })) pi.push(v); else ni.push(v);
      });
      var a = mean(pi), b = mean(ni), blocked = single && ownedByDA(m);
      return { metric: m, title: METRICS[m].label, owner: ownedByDA(m) ? 'DA' : 'TA', weeksPrio: pi.length, prioIdx: blocked ? null : a, nonIdx: blocked ? null : b, lift: (!blocked && a != null && b != null && b > 0) ? a / b - 1 : null };
    });
    var pillars = Object.keys(PILLARS).map(function (k) {
      var ms = PILLARS[k].metrics, pi = [], ni = [], sc = [], tw = 0, blocked = single && ms.every(ownedByDA);
      weeks.forEach(function (w, wi) {
        var wk = h.weeks[wi], hit = wk.prios.some(function (p) { return pillarOf(p.metric) === k; });
        var v = mean(ms.map(function (m) { return mean(ids.map(function (id) { return wk.idx[id][m]; })); }));
        (hit ? pi : ni).push(v);
        var parts = [], zIds = zones.map(function (z) { return z.id; });
        wk.prios.forEach(function (p, i) { if (pillarOf(p.metric) === k) { var pv = prog(wk, i, ids, zIds); if (pv != null) parts.push({ w: p.weight, s: pv, t: p.title }); } });
        w.pil = w.pil || {};
        if (parts.length) { var ws = sum(parts, function (x) { return x.w; }); w.pil[k] = { score: sum(parts, function (x) { return x.w * x.s; }) / (ws || 1) * 100, weight: ws, titles: parts.map(function (x) { return x.t; }) }; sc.push(w.pil[k].score); tw++; }
        else w.pil[k] = null;
      });
      var a = mean(pi), b = mean(ni);
      return { key: k, label: PILLARS[k].label, owner: ms.every(ownedByDA) ? 'DA' : 'TA', weeksPrio: blocked ? 0 : tw, avgScore: mean(sc), prioIdx: a, nonIdx: b, lift: (!blocked && a != null && b != null && b > 0) ? a / b - 1 : null };
    });
    var scores = weeks.map(function (w) { return w.score; });
    var trend = mean(scores.slice(4)) - mean(scores.slice(0, 4));
    var totHits = sum(weeks, function (w) { return w.hits; }), tot = sum(weeks, function (w) { return w.n; });
    var ls = lifts.filter(function (x) { return x.lift != null && x.weeksPrio >= 2; });
    return { pillars: pillars, weeks: weeks, lifts: lifts, avg: mean(scores), trend: trend, hitRate: tot ? totHits / tot : 0, lift: ls.length ? mean(ls.map(function (x) { return x.lift; })) : null };
  }

  root.WP = {
    DAYS: DAYS, DAY_DATES: DAY_DATES, DAY_CAP: DAY_CAP, WEEK_HOURS: WEEK_HOURS, METRICS: METRICS, PILLARS: PILLARS, pillarOf: pillarOf, ownedByDA: ownedByDA, daRowsFor: daRowsFor, KIND_LABEL: KIND_LABEL,
    REGION_DEFS: REGION_DEFS, generateData: generateData, defaultPriorities: defaultPriorities,
    calcTA: calcTA, computeRegion: computeRegion, aggregate: aggregate, focusOf: focusOf, reviewUnit: reviewUnit, history: history, histUnit: histUnit, weekCheck: weekCheck, normCheck: normCheck,
    allocateZone: allocateZone, planTA: planTA, paceAt: paceAt, sum: sum
  };
})(typeof window !== 'undefined' ? window : globalThis);
