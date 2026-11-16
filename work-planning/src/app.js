(function () {
  'use strict';
  var WP = window.WP, M = WP.METRICS, DAYS = WP.DAYS;
  var DATA = WP.generateData();
  var sum = WP.sum;

  var S = { role: 'rm', sArea: null, sZone: null, sTa: null, sDa: null, at: null, showWk: false, tab: 'home', region: 'mkc', day: 2, prio: null, zone: null, ta: null, open: {}, prios: {}, uid: 10, wk: 1, acc: {}, accRole: 'zs', accArea: null, accEdit: null, accErr: {}, tu: null, tlevel: 'area', rvArea: null, rvZone: null, wkPrios: {}, wkPub: {}, plans: {}, edit: false, editTa: null, whatif: null, level: 'region', err: {} };
  S.dprios = {};
  DATA.regions.forEach(function (r) { S.prios[r.id] = WP.defaultPriorities(r.id); S.dprios[r.id] = WP.defaultDukaPriorities(r.id); });
  function dprios(regId) { return S.dprios[regId || S.region]; }

  var SHORT = { clients: 'Clients', groups: 'Groups', scoped: 'Scoping', repaid: 'Repay', hvc: 'HVC', training: 'Training', glcalls: 'Calls', duka: 'Duka' };
  var TABS = [['overview', 'Regions'], ['priorities', 'RM priorities'], ['accept', 'Accept priorities'], ['cascade', 'Cascade'], ['review', 'Scorecards'], ['trend', 'Week on week'], ['team', 'Zone team'], ['week', 'TA week'], ['data', 'Data spec']];

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function region() { return DATA.byId[S.region]; }
  var ROLES = [['rm', 'Regional Manager'], ['ac', 'Area Coordinator'], ['zs', 'Zone Supervisor'], ['ta', 'Tupande Agent'], ['da', 'Duka Assistant']];
  function isDA(p) { return WP.ownedByDA(p.metric); }
  function sArea() { var a = S.sArea && DATA.byId[S.sArea]; return a && a.regionId === S.region && a.zones ? a : region().areas[0]; }
  function sZone() { if (S.role === 'da') return DATA.byId[sDa().zoneId]; var z = S.sZone && DATA.byId[S.sZone]; return z && z.regionId === S.region && z.tas ? z : allZones(region())[0]; }
  function sTa() {
    var t = S.sTa && DATA.byId[S.sTa]; if (t && t.regionId === S.region && !t.role && t.zoneId) return t;
    var d = null; region().areas.forEach(function (a) { a.zones.forEach(function (z) { z.tas.forEach(function (x) { if (x.name === 'Doreen Achieng') d = x; }); }); });
    return d || allZones(region())[0].tas[0];
  }
  function scopeZones() { return S.role === 'ac' ? sArea().zones : S.role === 'zs' || S.role === 'da' ? [sZone()] : S.role === 'ta' ? [DATA.byId[sTa().zoneId]] : allZones(region()); }
  function copyOf(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }
  function sreg() {
    var reg = region(); if (S.role === 'rm') return reg;
    var o = copyOf(reg), a = copyOf(S.role === 'ac' ? sArea() : S.role === 'ta' ? DATA.byId[sTa().areaId] : DATA.byId[sZone().areaId]);
    if (S.role === 'zs' || S.role === 'da') a.zones = [sZone()];
    if (S.role === 'ta') { var zc = copyOf(DATA.byId[sTa().zoneId]); zc.tas = [sTa()]; a.zones = [zc]; }
    o.areas = [a]; return o;
  }
  function sres(res) {
    res = res || comp(S.region); if (S.role === 'rm') return res;
    var rows = scopeIds().map(function (id) { return res.byTA[id]; });
    var o = copyOf(res); o.rows = rows; return o;
  }
  function scopeIds() { if (S.role === 'ta') return [sTa().id]; var o = []; scopeZones().forEach(function (z) { z.tas.forEach(function (t) { o.push(t.id); }); }); return o; }
  function scopeUnit() {
    var reg = region();
    if (S.role === 'ac') { var a = sArea(); return { level: 'Area', name: a.name, sub: 'AC ' + a.ac, id: a.id }; }
    if (S.role === 'zs') { var z = sZone(); return { level: 'Zone', name: z.name, sub: 'ZS ' + z.zs, id: z.id }; }
    if (S.role === 'ta') { var t = sTa(); return { level: 'Territory', name: t.territory, sub: 'TA ' + t.name, id: t.id }; }
    return { level: 'Region', name: reg.name, sub: 'RM ' + reg.rm, id: reg.id };
  }
  var ROLE_TABS = { rm: ['home', 'priorities', 'team', 'overview', 'cascade', 'review', 'trend', 'week', 'data'], ac: ['home', 'priorities', 'team', 'cascade', 'review', 'trend', 'week', 'data'], zs: ['home', 'priorities', 'team', 'cascade', 'review', 'trend', 'week', 'data'], ta: ['home', 'priorities', 'week', 'review', 'trend', 'data'], da: ['home', 'priorities', 'data'] };
  var MAIN_TABS = ['home', 'priorities', 'team'];
  var TAB_GROUPS = [['Plan', ['overview', 'priorities', 'accept']], ['Track', ['cascade', 'review', 'trend']], ['Act', ['team', 'week']], ['Reference', ['data']]];
  function tabLabel(id) {
    return { home: S.role === 'ta' || S.role === 'da' ? 'My week' : 'Home', priorities: 'Priorities', team: S.role === 'zs' ? 'Plans to approve' : 'Plans in my zones',
      overview: 'All regions', cascade: 'Detailed table', review: 'Scorecards', trend: 'Week on week', week: S.role === 'ta' ? 'Change my plan' : 'A territory’s full plan', data: 'How it works' }[id] || id;
  }
  function pTag(metric) { var k = WP.pillarOf(metric); return '<span class="ptag pt-' + k + '">' + esc(WP.PILLARS[k].short) + '</span>'; }
  function trendUnit() {
    var u = S.tu && DATA.byId[S.tu] && DATA.byId[S.tu].regionId === S.region ? DATA.byId[S.tu] : null;
    if (u && S.role === 'ac') { if ((u.zones ? u.id : u.areaId) !== sArea().id) u = null; }
    if (S.role === 'ta') return sTa();
    if (u && S.role === 'zs') { if ((u.tas ? u.id : (u.zones ? null : u.zoneId)) !== sZone().id) u = null; }
    if (!u && S.role === 'ac') u = sArea();
    if (!u && S.role === 'zs') u = sZone();
    return u;
  }
  var WEEKS = [['2 Nov', 'week before'], ['9 Nov', 'last week, closed'], ['16 Nov', 'this week']];
  function wkKey() { return S.region + '|' + S.wk; }
  function prios() {
    if (S.wk === 1) return S.prios[S.region];
    var k = wkKey();
    if (!S.wkPrios[k]) S.wkPrios[k] = S.wk === 0 ? WP.defaultPriorities(S.region) : JSON.parse(JSON.stringify(S.prios[S.region]));
    return S.wkPrios[k];
  }
  function pById(id, list) { var l = list || prios(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return l[0]; }
  function pIndex(id) { var l = prios(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return 0; }

  var cache = {};
  function comp(regId) {
    var zw = zoneWeights(regId), key = regId + '|' + S.day + '|' + JSON.stringify(S.prios[regId]) + '|' + JSON.stringify(S.dprios[regId]) + '|' + JSON.stringify(zw);
    if (!cache[key]) { var k = Object.keys(cache); if (k.length > 40) cache = {}; cache[key] = WP.computeRegion(DATA.byId[regId], S.prios[regId], S.day, { zoneWeights: zw, duka: S.dprios[regId] }); }
    return cache[key];
  }

  function num(metric, x, signed) {
    var m = M[metric], a = Math.abs(x), s;
    if (m.unit === 'KES') s = a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : Math.round(a / 1000) + 'k';
    else if (metric === 'groups') s = a.toFixed(1);
    else s = String(Math.round(a));
    var zero = (m.unit === 'KES' ? (a < 500) : metric === 'groups' ? (a < 0.05) : (a < 0.5));
    if (zero) return signed ? '0' : s;
    var pre = x < 0 ? '−' : (signed ? '+' : '');
    return pre + s;
  }
  function unitOf(metric) { return M[metric].unit === 'KES' ? 'KES' : M[metric].unit; }
  function withUnit(metric, x, signed) { return M[metric].unit === 'KES' ? (x < 0 ? '−' : (signed ? '+' : '')) + 'KES ' + num(metric, Math.abs(x)) : num(metric, x, signed) + ' ' + M[metric].unit; }
  function dl(p) { return DAYS[p.deadline] + (p.metric === 'glcalls' && p.deadline === 2 ? ' 11am' : ''); }
  function targetText(p) {
    var k = M[p.metric].kind;
    if (k === 'season') return p.target + '% of the season target by ' + dl(p);
    if (k === 'rate') return p.target + '% repaid by ' + dl(p);
    return p.target + ' ' + M[p.metric].unit + ' each by ' + dl(p);
  }
  function readAs(p) { return WP.KIND_LABEL[M[p.metric].kind] + ' · ' + M[p.metric].label + ' · ' + targetText(p) + (p.norm ? ' · norm ' + p.norm + ' a day' : ''); }
  var ST = { done: ['Target met', 'c-done'], ahead: ['Ahead', 'c-ahead'], on: ['On track', 'c-on'], slip: ['Slipping', 'c-slip'], behind: ['Behind', 'c-behind'], critical: ['Well behind', 'c-crit'] };
  function chip(st) { return '<span class="chip ' + ST[st][1] + '">' + ST[st][0] + '</span>'; }
  function fcls(st) { return st === 'critical' ? 'f-crit' : 'f-' + st; }
  function dist(distance, need, status) {
    var r = need > 0 ? Math.max(-1, Math.min(1, distance / need)) : 0;
    var cls = r < 0 ? 's-' + (status === 'critical' ? 'crit' : status) : '';
    return '<span class="dist" aria-hidden="true"><span class="neg ' + cls + '" style="width:' + (r < 0 ? -r * 100 : 0) + '%"></span><span class="pos" style="width:' + (r > 0 ? r * 100 : 0) + '%"></span></span>';
  }
  function statusBar(counts, n) {
    var order = ['done', 'ahead', 'on', 'slip', 'behind', 'critical'], h = '<div class="stack" role="img" aria-label="Status of ' + n + ' TAs">';
    order.forEach(function (k) { if (counts[k]) h += '<i class="' + fcls(k) + '" style="flex:' + counts[k] + '"></i>'; });
    return h + '</div>';
  }
  function zoneRows(res, zone) { return zone.tas.map(function (t) { return res.byTA[t.id]; }); }
  function avgScore(rows) { return sum(rows, function (r) { return r.score; }) / rows.length; }
  function allZones(reg) { var z = []; reg.areas.forEach(function (a) { a.zones.forEach(function (x) { z.push(x); }); }); return z; }
  function statusFromScore(s) { return s >= 95 ? 'on' : s >= 82 ? 'slip' : s >= 60 ? 'behind' : 'critical'; }
  function countStatus(rows) { var c = { done: 0, ahead: 0, on: 0, slip: 0, behind: 0, critical: 0 }; rows.forEach(function (r) { c[r.status]++; }); return c; }
  function lowestZone(res, reg) { var best = null, bs = 1e9; allZones(reg).forEach(function (z) { var s = avgScore(zoneRows(res, z)); if (s < bs) { bs = s; best = z; } }); return best; }

  function prios0(id) { return S.prios[id]; }
  function ensure() {
    var reg = region(), l = prios(), res = comp(S.region);
    if (!S.prio || !l.some(function (p) { return p.id === S.prio; })) S.prio = l[0].id;
    S.sArea = sArea().id; S.sZone = sZone().id; S.sTa = sTa().id;
    var zs = scopeZones();
    if (!S.zone || !zs.some(function (z) { return z.id === S.zone; })) {
      var best = null, bs = 1e9; zs.forEach(function (z) { var sc = avgScore(zoneRows(res, z)); if (sc < bs) { bs = sc; best = z; } }); S.zone = best.id;
    }
    var ids = scopeIds();
    if (S.role === 'ta') S.ta = S.sTa;
    if (!S.ta || ids.indexOf(S.ta) < 0 || DATA.byId[S.ta].zoneId !== S.zone && S.role !== 'rm' && S.role !== 'ac') {
      var d = null;
      DATA.tas.forEach(function (t) { if (t.name === 'Doreen Achieng' && ids.indexOf(t.id) >= 0) d = t; });
      if (d) S.ta = d.id;
      else { var rows = zoneRows(res, DATA.byId[S.zone]).slice().sort(function (a, b) { return a.score - b.score; }); S.ta = rows[0].ta.id; }
    }
    S.accRole = S.role; S.accArea = sArea().id;
    if (ROLE_TABS[S.role].indexOf(S.tab) < 0) S.tab = 'home';
    S.sDa = sDa().id;
  }

  /* ---------- plan approval workflow ---------- */
  var PLAN_LABEL = { proposed: ['Recommended', 'c-on'], active: ['Active', 'c-done'], pending: ['Waiting for ZS', 'c-slip'], returned: ['Returned', 'c-behind'] };
  function fmtH(h) { return (Math.round(h * 100) / 100).toFixed(2).replace(/\.?0+$/, ''); }
  function rowOf(taId) { var c = comp(DATA.byId[taId].regionId); return c.byTA[taId] || c.byDA[taId]; }
  function setOf(id) { return DATA.byId[id].role === 'DA' ? dprios(DATA.byId[id].regionId) : S.prios[DATA.byId[id].regionId]; }
  function planKey(taId) {
    var l = setOf(taId);
    return taId + '|' + S.day + '|' + JSON.stringify(l.map(function (p) { return [p.id, p.metric, p.target, p.deadline, p.weight, p.norm]; })) + '|' + JSON.stringify(zoneWeights(DATA.byId[taId].regionId)[DATA.byId[taId].zoneId] || null);
  }
  function peekPlan(taId) { return S.plans[planKey(taId)] || null; }
  function getPlan(taId) {
    var k = planKey(taId);
    if (!S.plans[k]) S.plans[k] = { key: k, taId: taId, status: 'proposed', days: null, prev: null, reason: '', comment: '', log: [] };
    return S.plans[k];
  }
  function cloneDays(days) {
    return days.map(function (d) {
      return { i: d.i, label: d.label, date: d.date, cap: d.cap, blocks: d.blocks.map(function (b) { S.uid++; var c = {}; Object.keys(b).forEach(function (k) { c[k] = b[k]; }); c.bid = 'b' + S.uid; c.rec = b.hours; c.edited = false; return c; }) };
    });
  }
  function dayHours(d) { return sum(d.blocks, function (b) { return b.hours; }); }
  function hoursOf(days, pid) { return sum(days, function (d) { return sum(d.blocks.filter(function (b) { return b.pid === pid; }), function (b) { return b.hours; }); }); }
  function daysSig(days) { return days.map(function (d) { return d.blocks.map(function (b) { return b.pid + ':' + b.hours; }).sort().join(','); }).join('|'); }
  function effDays(plan, row) { return plan.days || row.plan.days; }
  function findBlock(plan, bid) { for (var i = 0; i < plan.days.length; i++) for (var j = 0; j < plan.days[i].blocks.length; j++) if (plan.days[i].blocks[j].bid === bid) return { day: plan.days[i], block: plan.days[i].blocks[j], j: j }; return null; }
  function impactOf(row, days) {
    var l = S.prios[row.ta.regionId], rows = [], flags = [], cov = 0, recCov = 0;
    row.plan.items.forEach(function (it) {
      var rec = hoursOf(row.plan.days, it.pid), now = hoursOf(days, it.pid), need = it.needH;
      var c = need > 0.05 ? Math.min(1, now / need) : 1, rc = need > 0.05 ? Math.min(1, rec / need) : 1;
      cov += it.weight * c; recCov += it.weight * rc;
      rows.push({ it: it, rec: rec, now: now, need: need, cover: c, recCover: rc });
      var lack = Math.max(0, need - now), hrs = M[it.p.metric].hrs;
      if (need > 0.05 && now < rec - 0.05 && now < need - 0.25) flags.push({ level: 'warn', text: it.p.title + ': ' + fmtH(now) + ' h planned against ' + fmtH(need) + ' h the target needs. About ' + withUnit(it.p.metric, lack / hrs) + ' would not get done' + (it.overdue ? ', and its deadline has already passed' : '') + '.' });
      else if (need > 0.05 && now > need + 0.3) flags.push({ level: 'info', text: it.p.title + ': ' + fmtH(now) + ' h planned is more than the ' + fmtH(need) + ' h the target needs.' });
    });
    var used = sum(days, dayHours), cap = sum(days, function (d) { return d.cap; });
    var ag = sum(days, function (d) { return sum(d.blocks.filter(function (b) { return b.pid === 'ageing'; }), function (b) { return b.hours; }); });
    if (cap - used > 1.0) flags.push({ level: 'info', text: fmtH(cap - used) + ' h of the week are not planned.' });
    return { rows: rows, flags: flags, cov: cov, recCov: recCov, used: used, cap: cap };
  }
  function impactHTML(row, days, compact) {
    var im = impactOf(row, days), h = '';
    h += '<table><thead><tr><th>Priority</th><th class="r">Recommended</th><th class="r">Your plan</th><th class="r">Needs</th><th>Covers the need</th></tr></thead><tbody>';
    im.rows.forEach(function (x) {
      var st = x.need <= 0.05 ? 'done' : x.cover >= 0.99 ? 'ahead' : x.cover >= 0.8 ? 'slip' : 'behind';
      h += '<tr><td>' + esc(x.it.p.title) + '</td><td class="r n">' + fmtH(x.rec) + ' h</td><td class="r n"><b>' + fmtH(x.now) + ' h</b></td><td class="r n">' + fmtH(x.need) + ' h</td><td><span class="chip ' + ST[st][1] + '">' + (x.need <= 0.05 ? 'Nothing needed' : Math.round(x.cover * 100) + '%') + '</span></td></tr>';
    });
    h += '</tbody></table><p class="sub" style="margin-top:8px">Weighted coverage of the RM’s targets: recommended <b>' + Math.round(im.recCov) + '</b>, your plan <b>' + Math.round(im.cov) + '</b> out of 100.</p>';
    if (im.flags.length) h += '<ul class="flags">' + im.flags.map(function (f) { return '<li class="' + f.level + '">' + esc(f.text) + '</li>'; }).join('') + '</ul>';
    else h += '<p class="sub" style="margin-top:6px">No flags. The plan covers what the targets need.</p>';
    return h;
  }
  function pendingIn(reg, zoneId) {
    var out = [];
    Object.keys(S.plans).forEach(function (k) {
      var p = S.plans[k]; if (p.status !== 'pending') return;
      var t = DATA.byId[p.taId]; if (!t || t.regionId !== reg || planKey(p.taId) !== p.key) return;
      if (zoneId && t.zoneId !== zoneId) return;
      out.push(p);
    });
    return out;
  }

  /* ---------- views ---------- */
  function viewOverview() {
    var h = '<p class="sub" style="margin-bottom:14px">Each region’s RM sets about three weighted priorities. The cards show what was set, and how far the region’s TAs are from it as of the end of <b>' + DAYS[S.day] + '</b>.</p><div class="rcards">';
    var allRows = [], zoneList = [];
    DATA.regions.forEach(function (reg) {
      var res = comp(reg.id), l = S.prios[reg.id], rows = res.rows;
      rows.forEach(function (r) { allRows.push({ r: r, reg: reg }); });
      var avg = avgScore(rows), counts = countStatus(rows), wz = lowestZone(res, reg), wzs = avgScore(zoneRows(res, wz));
      allZones(reg).forEach(function (z) { zoneList.push({ z: z, reg: reg, s: avgScore(zoneRows(res, z)) }); });
      h += '<article class="panel rcard"><header><div><h3>' + esc(reg.name) + '</h3><p class="sub">Regional Manager: ' + esc(reg.rm) + '</p></div>' +
        '<div class="score">' + Math.round(avg) + '<small>Score vs pace</small></div></header><ul class="plist">';
      l.forEach(function (p) {
        h += '<li><span class="t">' + esc(p.title) + '</span><span class="w">' + p.weight + '%</span><span class="q">' + esc(targetText(p)) + '</span><span class="wbar"><i style="width:' + p.weight + '%"></i></span></li>';
      });
      h += '</ul><div>' + statusBar(counts, rows.length) + '<div class="legend" style="margin-top:6px">';
      ['ahead', 'on', 'slip', 'behind', 'critical'].forEach(function (k) { if (counts[k] || k === 'ahead') h += '<span>' + counts[k] + ' ' + ST[k][0].toLowerCase() + '</span>'; });
      h += '</div></div><p class="sub">Needs support first: <b>' + esc(wz.name) + '</b> (score ' + Math.round(wzs) + ')</p>' +
        '<p class="muted" style="font-size:12.5px">' + esc(reg.basis) + '</p>' +
        '<div><button class="btn solid small" data-act="goRegion" data-id="' + reg.id + '">Open cascade</button> <button class="btn small" data-act="goPrios" data-id="' + reg.id + '">Edit priorities</button></div></article>';
    });
    h += '</div>';
    zoneList.sort(function (a, b) { return a.s - b.s; });
    var stars = DATA.regions.map(function (reg) {
      var best = allRows.filter(function (x) { return x.reg.id === reg.id; }).sort(function (a, b) {
        var pa = prios0(reg.id), sa = sum(pa, function (p) { return a.r.calcs[p.id].need > 0 ? a.r.calcs[p.id].distance / a.r.calcs[p.id].need : 0; });
        var sb = sum(pa, function (p) { return b.r.calcs[p.id].need > 0 ? b.r.calcs[p.id].distance / b.r.calcs[p.id].need : 0; });
        return (b.r.score - a.r.score) || (sb - sa);
      })[0];
      return best;
    });
    h += '<div class="grid2 sec"><div class="panel"><h3>Celebrate this week</h3><p class="sub">The strongest TA in each region: highest score against pace, then furthest ahead of it.</p><table><tbody>';
    stars.forEach(function (x) {
      h += '<tr><td><button class="btn small" data-act="plan" data-id="' + x.r.ta.id + '">' + esc(x.r.ta.name) + '</button></td><td class="sub">' + esc(x.reg.name) + '</td><td class="r n"><b>' + Math.round(x.r.score) + '</b></td></tr>';
    });
    h += '</tbody></table></div><div class="panel"><h3>Zones to support first</h3><p class="sub">Lowest average score against pace.</p><table><tbody>';
    zoneList.slice(0, 5).forEach(function (x) {
      h += '<tr><td>' + esc(x.z.name) + '</td><td class="sub">' + esc(x.reg.name) + '</td><td class="r n"><b>' + Math.round(x.s) + '</b></td></tr>';
    });
    h += '</tbody></table></div></div>';
    h += '<p class="footer">Score vs pace is each TA\u2019s weighted progress against where the RM expects them to be today. 100 means on or ahead of the pace line on every priority. A TA is on pace from 95, slipping from 82, behind from 60 and critical below that. On each priority, distance from the pace line is compared with the week\u2019s requirement: 8% above is ahead, within 8% is on pace, then 25% and 50% below mark slipping, behind and critical.</p>';
    return h;
  }

  /* RM priorities editor */
  function editorCard(p, i, n) {
    var m = M[p.metric], kind = m.kind;
    var h = '<article class="panel edit" data-card="' + i + '"><div class="row"><label class="field grow"><span>Priority name</span><input type="text" id="t' + i + '" data-f="title" data-i="' + i + '" value="' + esc(p.title) + '"></label>' +
      '<label class="field"><span>Measure</span><select id="m' + i + '" data-f="metric" data-i="' + i + '">';
    Object.keys(M).forEach(function (k) { h += '<option value="' + k + '"' + (k === p.metric ? ' selected' : '') + '>' + esc(M[k].label) + '</option>'; });
    h += '</select></label><span class="kind">' + WP.KIND_LABEL[kind] + '</span></div>' +
      '<label class="field"><span>What the RM writes</span><textarea rows="2" id="x' + i + '" data-f="text" data-i="' + i + '">' + esc(p.text) + '</textarea></label>' +
      '<div class="row"><label class="field"><span>' + (kind === 'count' ? 'Number each' : '% target') + '</span><input type="number" id="g' + i + '" min="0" step="1" data-f="target" data-i="' + i + '" value="' + p.target + '"></label>' +
      '<label class="field"><span>Deadline</span><select id="d' + i + '" data-f="deadline" data-i="' + i + '">';
    [0, 1, 2, 3, 4, 5].forEach(function (d) { h += '<option value="' + d + '"' + (d === p.deadline ? ' selected' : '') + '>' + DAYS[d] + '</option>'; });
    h += '</select></label>';
    if (kind === 'season') h += '<label class="field"><span>Daily norm (0 = none)</span><input type="number" id="n' + i + '" min="0" step="1" data-f="norm" data-i="' + i + '" value="' + p.norm + '"></label>';
    h += '<div class="field"><span>Weight</span><div class="wt"><input type="range" id="r' + i + '" min="0" max="100" step="5" data-f="weight" data-i="' + i + '" value="' + p.weight + '" aria-label="Weight"><b class="num" id="wv' + i + '">' + p.weight + '%</b></div></div>' +
      (n > 1 ? '<button class="btn small" data-act="remove" data-i="' + i + '">Remove</button>' : '') + '</div>' +
      '<div class="readas" id="ra' + i + '">Read as: ' + esc(readAs(p)) + '</div></article>';
    return h;
  }

  function panelHTML() {
    var reg = region(), l = prios(), wc = WP.weekCheck(reg, l), nc = WP.normCheck(reg, l);
    var total = sum(l, function (p) { return p.weight; });
    var h = '<div class="wc">';
    wc.items.forEach(function (it, i) {
      var p = l[i], fit, st, det;
      if (it.owner === 'DA') { h += '<div class="wcrow"><div class="wchead"><b>' + esc(p.title) + '</b><span class="num">' + p.weight + '%</span></div><div><span class="chip c-on">Carried by Duka Assistants</span> <span class="sub">no TA hours are budgeted for it</span></div></div>'; return; }
      if (it.short > 0.05) { st = 'behind'; fit = 'Short'; det = it.short.toFixed(1) + ' h short, about ' + num(p.metric, it.shortUnits) + ' ' + unitOf(p.metric) + ' will not fit'; }
      else if (it.needH > it.budget + 0.05) { st = 'slip'; fit = 'Borrows spare time'; det = 'uses ' + (it.needH - it.budget).toFixed(1) + ' h from other priorities'; }
      else { st = 'ahead'; fit = 'Covered'; det = (it.budget - it.needH).toFixed(1) + ' h to spare'; }
      h += '<div class="wcrow"><div class="wchead"><b>' + esc(p.title) + '</b><span class="num">' + p.weight + '%</span></div>' +
        '<div class="wcnums"><span>Budget <b class="num">' + it.budget.toFixed(1) + ' h</b></span><span>Work needs <b class="num">' + it.needH.toFixed(1) + ' h</b></span></div>' +
        '<div><span class="chip ' + ST[st][1] + '">' + fit + '</span> <span class="sub">' + esc(det) + '</span></div></div>';
    });
    h += '</div><p class="sub" style="margin-top:8px">Average TA: ' + WP.WEEK_HOURS + ' productive hours a week. The priorities need <b>' + wc.totalNeed.toFixed(1) + ' h</b> in total' +
      (wc.totalNeed > WP.WEEK_HOURS + 0.05 ? ', which is <b>' + (wc.totalNeed - WP.WEEK_HOURS).toFixed(1) + ' h more than a week holds</b>. Lower a target or move weight.' : ', leaving about <b>' + (WP.WEEK_HOURS - wc.totalNeed).toFixed(1) + ' h</b> free. There is room for another priority.') + '</p>';
    nc.forEach(function (n) {
      var p = pById(n.pid), bad = n.ratio > 1.5 || n.ratio < 0.67;
      h += '<p class="note ' + (bad ? 'warn' : '') + '" style="margin-top:8px">Daily norm for “' + esc(p.title) + '”: ' + n.norm + ' a day over 5 days is ' + n.implied + ' ' + unitOf(p.metric) + ' a week, and the target needs about ' + n.needUnits.toFixed(1) + ' per TA. ' +
        (bad ? 'The norm is ' + (n.ratio >= 1 ? n.ratio.toFixed(1) + ' times the requirement' : 'well under the requirement') + '. Change one of them before publishing.' : 'The norm and the target agree.') + '</p>';
    });
    h += '<input type="hidden" id="wtTot" value="' + total + '">';
    return h;
  }

  function totalHTML() {
    var t = sum(prios(), function (p) { return p.weight; });
    return '<span class="total ' + (t === 100 ? 'good' : 'bad') + '">Weights total ' + t + '%' + (t === 100 ? '' : ' (must be 100)') + '</span>';
  }

  function viewPriorities() {
    var reg = region(), l = prios();
    var ro = S.wk === 0 || S.role !== 'rm', pub = !!S.wkPub[wkKey()];
    var banner = S.wk === 1 ? '' : S.wk === 0 ? '<div class="banner active" style="margin-top:12px"><div class="bhead"><span class="chip c-done">Closed</span><span class="sub">Published and closed. Read only.</span></div><div class="bact"><button class="btn small" data-act="copyTo">Copy to this week</button></div></div>' :
      '<div class="banner ' + (pub ? 'active' : 'pending') + '" style="margin-top:12px"><div class="bhead"><span class="chip ' + (pub ? 'c-done' : 'c-slip') + '">' + (pub ? 'Published' : 'Draft') + '</span><span class="sub">' + (pub ? 'Sent to ACs, ZSs and TAs. Plans are generated from these priorities.' : 'This week’s priorities, not yet visible to the team. Publish when the weights total 100.') + '</span></div><div class="bact"><button class="btn small" data-act="copyCur">Copy last week’s priorities</button> <button class="btn solid small" data-act="publish"' + (pub || sum(l, function (p) { return p.weight; }) !== 100 ? ' disabled' : '') + '>Publish</button></div></div>';
    if (S.role !== 'rm') banner = '<div class="banner active" style="margin-top:12px"><div class="bhead"><span class="chip c-on">Set by the RM</span><span class="sub">' + (S.role === 'ta' ? 'Read only for you. Your plan is on My week, where you can accept it or change it for your ZS to approve.' : S.role === 'da' ? 'Read only for you. Your duka plan is on My week.' : 'Read only for you. Accept them or change the time split for your ' + (S.role === 'ac' ? 'area' : 'zone') + ' above.') + '</span></div>' + (S.role === 'ta' || S.role === 'da' ? '<div class="bact"><button class="btn small solid" data-tab="home">My week</button></div>' : '') + '</div>';
    var h = '<div class="top-row"><h2 style="font-size:20px">Priorities set by ' + esc(reg.rm) + ' for the week of ' + WEEKS[S.wk][0] + ' 2026</h2>' + banner +
      '<p class="sub" style="margin-top:4px">' + (S.role === 'rm' ? 'Change a target, deadline or weight. Everything else recalculates. In the full tool the RM types the sentence and the structure below is read from it; here you set the numbers.' : 'These are the priorities your RM published. Each has a pillar, a target, a deadline and a weight. The right-hand column says what is asked of each level.') + '</p></div>' +
      '<fieldset' + (ro ? ' disabled' : '') + ' style="border:0;padding:0;margin:0;min-width:0"><div class="split sec"><div style="display:flex;flex-direction:column;gap:14px" id="editors">';
    l.forEach(function (p, i) { h += editorCard(p, i, l.length); });
    h += '<div class="panel" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><span id="totalBox">' + totalHTML() + '</span>' +
      '<button class="btn small" data-act="balance">Balance to 100</button>' +
      '<span style="flex:1"></span><label class="field" style="flex-direction:row;align-items:center;gap:8px"><span>Add</span><select id="addMetric">';
    Object.keys(M).forEach(function (k) { h += '<option value="' + k + '">' + esc(M[k].label) + '</option>'; });
    h += '</select></label><button class="btn small" data-act="add"' + (l.length >= 5 ? ' disabled' : '') + '>Add priority</button><button class="btn small" data-act="reset">Reset region</button></div></div>';
    h += '<div style="display:flex;flex-direction:column;gap:14px"><div class="panel"><h3>What the weights mean for a TA’s week</h3><p class="sub" style="margin-bottom:10px">A weight sets the share of a TA’s hours a priority gets. The engine compares that budget with the work the target needs.</p><div id="wcPanel">' + panelHTML() + '</div></div>' +
      '<div class="panel"><h3>What each level is asked to do</h3><div style="margin-top:10px;display:flex;flex-direction:column;gap:12px">';
    l.forEach(function (p) {
      h += '<div><b>' + esc(p.title) + '</b><ul class="brief" style="margin-top:4px"><li><b>AC</b><span>' + esc(p.aud.AC || 'Monitor progress.') + '</span></li><li><b>ZS</b><span>' + esc(p.aud.ZS || 'Support your TAs.') + '</span></li>' + (isDA(p) ? '<li><b>DA</b><span>' + esc(p.aud.DA || 'Check your dukas.') + '</span></li>' : '<li><b>TA</b><span>' + esc(p.aud.TA || 'Deliver your share.') + '</span></li>') + '</ul></div>';
    });
    var al = reg.also;
    h += '</div>' + ((al.AC && al.AC.length) || (al.ZS && al.ZS.length) ? '<p class="sub" style="margin-top:12px"><b>Also this week.</b> AC: ' + esc((al.AC || []).join(' ')) + ' ZS: ' + esc((al.ZS || []).join(' ')) + '</p>' : '') + '</div></div></div></fieldset>';
    return h;
  }

  function refreshLive() {
    var p = $('wcPanel'); if (p) p.innerHTML = panelHTML();
    var t = $('totalBox'); if (t) t.innerHTML = totalHTML();
    prios().forEach(function (pr, i) { var ra = $('ra' + i); if (ra) ra.textContent = 'Read as: ' + readAs(pr); var w = $('wv' + i); if (w) w.textContent = pr.weight + '%'; });
  }

  /* cascade */
  function briefLines(reg, res, p) {
    var zs = allZones(reg).map(function (z) { var a = WP.aggregate(zoneRows(res, z), p); return { z: z, a: a, r: a.need > 0 ? a.distance / a.need : 0 }; });
    zs.sort(function (x, y) { return x.r - y.r; });
    var worst = zs.slice(0, 2).filter(function (x) { return x.r < -0.05; });
    var ag = WP.aggregate(res.rows, p), m = M[p.metric];
    var out = [];
    if (worst.length) out.push(['AC', 'Support ' + worst.map(function (x) { return esc(x.z.name) + ' (' + withUnit(p.metric, x.a.distance, true) + ' against pace)'; }).join(' and ') + ' first. ' + esc(p.aud.AC || '')]);
    else out.push(['AC', 'Every zone is at or near pace on this priority. ' + esc(p.aud.AC || '')]);
    var wz = zs[0].z, zrows = (isDA(p) ? (res.dRows || []).filter(function (r) { return r.zone.id === wz.id; }) : zoneRows(res, wz)).filter(function (r) { return r.calcs[p.id].ask > 0; }).sort(function (a, b) { return b.calcs[p.id].ask - a.calcs[p.id].ask; });
    var tot = sum(zrows, function (r) { return r.calcs[p.id].ask; });
    if (zrows.length && tot > 0) {
      var top = zrows.slice(0, 3), share = sum(top, function (r) { return r.calcs[p.id].ask; }) / tot * 100;
      out.push(['ZS', 'In ' + esc(wz.name) + ', ' + top.length + (isDA(p) ? ' Duka Assistants carry ' : ' TAs carry ') + Math.round(share) + '% of the ' + withUnit(p.metric, tot) + ' still to deliver: ' + top.map(function (r) { return esc(r.ta.name) + ' (' + num(p.metric, r.calcs[p.id].ask) + ')'; }).join(', ') + '. ' + esc(p.aud.ZS || '')]);
    } else out.push(['ZS', 'Nothing extra is assigned in ' + esc(wz.name) + '. ' + esc(p.aud.ZS || '')]);
    if (isDA(p)) out.push(['DA', 'Duka Assistants carry this priority, not TAs. It is not part of a TA’s score or time plan.']);
    else out.push(['TA', esc(p.aud.TA || 'Deliver your share.') + ' Each TA’s number and plan are on the TA week tab.']);
    return out;
  }

  function valsFromCalc(c) {
    return { need: c.need, expected: c.expected, gain: c.gain, distance: c.distance, ask: c.ask, status: c.status, curPct: c.S ? (c.A0 + c.gain) / c.S * 100 : null };
  }
  function line(kind, id, label, v, p, extra) {
    var open = extra && extra.open, tog = extra && extra.toggle;
    var ind = kind === 'lv-reg' ? '' : kind === 'lv-area' ? 'ind1' : kind === 'lv-zone' ? 'ind2' : 'ind3';
    var c1 = tog ? '<button class="tog" data-act="toggle" data-id="' + id + '" aria-expanded="' + !!open + '" aria-label="' + (open ? 'Collapse ' : 'Expand ') + esc(label) + '">' + (open ? '▾' : '▸') + '</button>' : '<span style="display:inline-block;width:22px"></span>';
    var sub = v.curPct != null ? '<small>standing ' + v.curPct.toFixed(1) + '%</small>' : '';
    var act = extra && extra.plan ? ' <button class="btn small" data-act="plan" data-id="' + extra.plan + '">Plan</button>' : '';
    var showAsk = M[p.metric].kind === 'season' || true;
    return '<tr class="' + kind + '"><td class="' + ind + '"><span class="lbl">' + c1 + esc(label) + '</span>' + act + '</td>' +
      '<td class="r n">' + num(p.metric, v.need) + '</td><td class="r n">' + num(p.metric, v.expected) + '</td><td class="r n twolines">' + num(p.metric, v.gain) + sub + '</td>' +
      '<td class="n"><span class="dist-wrap">' + dist(v.distance, v.need, v.status) + '<span>' + num(p.metric, v.distance, true) + '</span></span></td>' +
      '<td class="r n">' + (showAsk ? num(p.metric, v.ask) : '') + '</td><td>' + chip(v.status) + '</td><td>' + (extra && extra.fo ? tbarHTML(extra.fo) + '<div class="muted tsn">' + esc(shiftText(extra.fo)) + '</div>' : '') + '</td></tr>';
  }
  function isOpen(id, def) { return S.open[id] === undefined ? def : S.open[id]; }

  function viewCascade() {
    var reg = sreg(), res = sres(), l = prios(), p = pById(S.prio), m = M[p.metric], su = scopeUnit();
    var ag = WP.aggregate(res.rows, p);
    var h = '<div class="pills" role="group" aria-label="Priority">';
    l.forEach(function (q) { h += '<button class="pill" data-act="prio" data-id="' + q.id + '" aria-pressed="' + (q.id === p.id) + '">' + esc(q.title) + '<small>' + q.weight + '%</small></button>'; });
    h += '</div><div class="panel" style="margin-top:14px"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="kind">' + WP.KIND_LABEL[m.kind] + '</span><span class="sub">' + esc(readAs(p)) + '</span></div><p class="quote">“' + esc(p.text) + '” <span class="sub">— ' + esc(reg.rm) + '</span></p>' +
      '<ul class="brief">';
    briefLines(reg, res, p).forEach(function (b) { h += '<li><b>' + b[0] + '</b><span>' + b[1] + '</span></li>'; });
    h += '</ul></div><div class="tiles">';
    var standing = ag.curPct != null ? ag.curPct.toFixed(1) + '%' : (num(p.metric, ag.gain / ag.n) + ' per TA');
    var tsub = ag.curPct != null ? 'target ' + p.target + '% · pace line ' + ag.expPct.toFixed(1) + '%' : 'target ' + p.target + ' each · expected ' + num(p.metric, ag.expected / ag.n);
    var weekTarget = ag.curPct != null ? '' : '';
    h += '<div class="tile"><div class="k">' + su.level + ' standing today</div><div class="v">' + (ag.curPct != null ? ag.curPct.toFixed(1) + '%' : num(p.metric, (ag.gain) / ag.n)) + '</div><div class="s">' + esc(tsub) + '</div></div>' +
      '<div class="tile"><div class="k">Distance from pace</div><div class="v">' + withUnit(p.metric, ag.distance, true) + '</div><div class="s">' + chip(ag.status) + '</div></div>' +
      '<div class="tile"><div class="k">Still to deliver by ' + esc(dl(p)) + '</div><div class="v">' + withUnit(p.metric, ag.ask) + '</div><div class="s">assigned to ' + (isDA(p) ? 'Duka Assistants who are behind' : 'TAs who are behind') + '</div></div>' +
      '<div class="tile"><div class="k">' + (isDA(p) ? 'Duka Assistants' : 'TAs') + ' behind or critical</div><div class="v">' + (ag.counts.behind + ag.counts.critical) + ' of ' + ag.n + '</div><div class="s">' + ag.counts.slip + ' more slipping</div></div></div>';
    var wl = l.filter(function (q) { return !isDA(q); });
    h += '<div class="panel" style="margin-bottom:14px"><div class="legend" style="margin-bottom:8px"><b>RM weights for TA time</b>' + wl.map(function (q) { var i = l.indexOf(q); return '<span><span class="sw pc' + Math.min(i, 4) + '"></span>' + esc(q.title) + ' ' + q.weight + '%</span>'; }).join('') + '</div><div class="tbar" role="img" aria-label="RM weights">' + wl.map(function (q) { return '<i class="pc' + Math.min(l.indexOf(q), 4) + '" style="flex:' + Math.max(q.weight, 0.01) + '"></i>'; }).join('') + '</div><p class="sub" style="margin-top:8px">The last column of the table below sets each unit’s planned time against these weights. Where a unit is ahead on one priority, its plan moves hours to the others, so the bar can differ from the RM’s split.' + (l.some(isDA) ? ' Duka is carried by Duka Assistants and takes no TA time.' : '') + '</p></div>';
    h += '<div class="panel"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline"><h3>From ' + su.level.toLowerCase() + ' to TA</h3><span><button class="btn small" data-act="expandAll">Show every TA</button> <button class="btn small" data-act="collapseAll">Collapse to zones</button></span></div>' +
      '<p class="sub" style="margin-bottom:8px">Units: ' + esc(m.unit) + '. “RM expects” is the week’s requirement; “Still to deliver” is what each unit must add before the deadline.' +
      (m.kind === 'season' ? ' A zone’s gap is shared between the TAs who are behind, in proportion to the farmers and groups each can still reach. A zone that is ahead does not cover for one that is behind, so the totals above can exceed the region\u2019s net gap.' : m.kind === 'rate' ? ' Every unit carries the same rate, converted to KES to collect.' : ' Every person owes the same number.') + '</p><div class="scroll"><table><thead><tr><th>Unit</th><th class="r">RM expects</th><th class="r">Expected by now</th><th class="r">Done</th><th>Distance</th><th class="r">Still to deliver</th><th>Status</th><th style="min-width:170px">Where the time goes <span class="muted" style="text-transform:none;letter-spacing:0">(planned, rest of week)</span></th></tr></thead><tbody>';
    function zoneLine(z) {
      var zr = zoneRows(res, z), od = isOpen(z.id, S.role === 'zs');
      h += line('lv-zone', z.id, z.name + ' · ZS ' + z.zs, valsFromAgg(WP.aggregate(zr, p)), p, { toggle: true, open: od, fo: WP.focusOf(zr, l) });
      var kids = isDA(p) ? (res.dRows || []).filter(function (r) { return r.zone.id === z.id; }) : zr;
      if (od) kids.slice().sort(function (x, y) { return x.calcs[p.id].distance / (x.calcs[p.id].need || 1) - y.calcs[p.id].distance / (y.calcs[p.id].need || 1); }).forEach(function (r) {
        h += line('lv-ta', r.ta.id, r.ta.name + (r.isDA ? ' · Duka Assistant' : ''), valsFromCalc(r.calcs[p.id]), p, r.isDA ? {} : { plan: r.ta.id, fo: WP.focusOf([r], l) });
      });
    }
    function areaLine(a) {
      var arows = []; a.zones.forEach(function (z) { zoneRows(res, z).forEach(function (r) { arows.push(r); }); });
      h += line('lv-area', a.id, a.name + ' · AC ' + a.ac, valsFromAgg(WP.aggregate(arows, p)), p, { toggle: true, open: isOpen(a.id, true), fo: WP.focusOf(arows, l) });
      if (isOpen(a.id, true)) a.zones.forEach(zoneLine);
    }
    if (S.role === 'rm') {
      h += line('lv-reg', reg.id, reg.name, valsFromAgg(ag), p, { toggle: true, open: isOpen(reg.id, true), fo: WP.focusOf(res.rows, l) });
      if (isOpen(reg.id, true)) reg.areas.forEach(areaLine);
    } else if (S.role === 'ac') areaLine(reg.areas[0]);
    else zoneLine(reg.areas[0].zones[0]);
    h += '</tbody></table></div></div>';
    return h;
  }
  function valsFromAgg(a) { return { need: a.need, expected: a.expected, gain: a.gain, distance: a.distance, ask: a.ask, status: a.status, curPct: a.curPct != null ? a.curPct : null }; }

  /* zone team */
  function planChip(taId) {
    var p = peekPlan(taId);
    if (!p) return '<span class="muted">Not accepted yet</span>';
    if (p.status === 'proposed') return p.days ? '<span class="chip c-slip">Draft</span>' : '<span class="muted">Not accepted yet</span>';
    return '<span class="chip ' + PLAN_LABEL[p.status][1] + '">' + PLAN_LABEL[p.status][0] + '</span>';
  }
  function zoneButtons(all, except) {
    var seen = {}, out = [];
    all.forEach(function (p) { var zid = DATA.byId[p.taId].zoneId; if (zid === except || seen[zid]) return; seen[zid] = 1; out.push('<button class="btn small" data-act="zone" data-id="' + zid + '">' + esc(DATA.byId[zid].name) + '</button>'); });
    return out.join(' ');
  }
  function approvalsHTML(reg, z, res) {
    var list = pendingIn(reg.id, z.id), all = pendingIn(reg.id), others = all.length - list.length;
    var h = '<div class="panel sec"><h3>Plans waiting for your approval</h3><p class="sub" style="margin-bottom:8px">A TA or Duka Assistant who changes the recommended plan sends it to the ZS. It stays inactive until you approve it. You are seeing this as ' + esc(z.zs) + '.</p>';
    if (!list.length) h += '<p class="empty">Nothing is waiting in this zone.' + (others > 0 ? ' ' + others + ' plan' + (others > 1 ? 's are' : ' is') + ' waiting in other zones of this region: ' + zoneButtons(all, z.id) : ' When a TA edits a plan and sends it, it appears here.') + '</p>';
    list.forEach(function (p) {
      var row = rowOf(p.taId), im = impactOf(row, p.days), cut = im.rows.filter(function (x) { return x.now < x.rec - 0.05; }), more = im.rows.filter(function (x) { return x.now > x.rec + 0.05; });
      h += '<div class="appr"><div class="ahead"><b>' + esc(row.ta.name) + '</b><span class="muted">' + esc(row.isDA ? 'Duka Assistant' : 'Territory ' + row.ta.territory) + '</span>' + chip(row.status) + '</div>' +
        '<p><b>Reason:</b> ' + esc(p.reason) + '</p>' +
        '<p class="sub">' + (cut.length ? 'Less time on ' + cut.map(function (x) { return esc(x.it.p.title) + ' (' + fmtH(x.rec) + ' → ' + fmtH(x.now) + ' h)'; }).join(', ') + '. ' : '') + (more.length ? 'More time on ' + more.map(function (x) { return esc(x.it.p.title) + ' (' + fmtH(x.rec) + ' → ' + fmtH(x.now) + ' h)'; }).join(', ') + '. ' : '') + 'Coverage of the RM’s targets goes from ' + Math.round(im.recCov) + ' to ' + Math.round(im.cov) + '.</p>';
      if (im.flags.length) h += '<ul class="flags">' + im.flags.map(function (f) { return '<li class="' + f.level + '">' + esc(f.text) + '</li>'; }).join('') + '</ul>';
      h += '<div class="arow"><button class="btn solid small" data-act="approve" data-id="' + p.taId + '">Approve</button><label class="sr" for="cm' + p.taId + '">Comment</label><input type="text" id="cm' + p.taId + '" placeholder="Comment (needed to return it)" data-cm="' + p.taId + '" value="' + esc(p.draftComment || '') + '"><button class="btn small" data-act="return" data-id="' + p.taId + '">Return</button><button class="btn small" data-act="plan" data-id="' + p.taId + '">Open plan</button></div>';
      if (S.err[p.taId]) h += '<p class="note warn" role="alert" style="margin-top:6px">' + esc(S.err[p.taId]) + '</p>';
      h += '</div>';
    });
    return h + '</div>';
  }

  function viewTeam() {
    var reg = sreg(), res = comp(S.region), l = prios(), z = DATA.byId[S.zone], area = DATA.byId[z.areaId], rows = zoneRows(res, z).slice().sort(function (a, b) { return a.score - b.score; });
    var h = '<div class="ctl" style="margin-bottom:14px"><label for="zoneSel" class="lab">Zone</label><select id="zoneSel">';
    reg.areas.forEach(function (a) {
      h += '<optgroup label="' + esc(a.name) + '">';
      a.zones.forEach(function (x) { h += '<option value="' + x.id + '"' + (x.id === z.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; });
      h += '</optgroup>';
    });
    h += '</select><span class="sub">ZS ' + esc(z.zs) + ' · AC ' + esc(area.ac) + '</span></div>';
    var zs = unitScore(rows.map(function (r) { return r.ta.id; }), S.day);
    h += '<div class="tiles"><div class="tile"><div class="k">Zone score vs pace</div><div class="v">' + Math.round(zs) + '</div><div class="s">' + chip(statusFromScore(zs)) + '</div></div>';
    l.slice(0, 3).forEach(function (p) {
      var a = WP.aggregate(rows, p);
      h += '<div class="tile"><div class="k">' + esc(p.title) + '</div><div class="v">' + withUnit(p.metric, a.distance, true) + '</div><div class="s">against pace · ' + withUnit(p.metric, a.ask) + ' still to deliver</div></div>';
    });
    h += '</div><div class="panel"><h3>Where the ZS spends the week</h3><ul class="brief" style="margin-top:8px">';
    var help = rows.filter(function (r) { return r.status === 'behind' || r.status === 'critical'; });
    h += '<li><b>Help</b><span>' + (help.length ? help.slice(0, 3).map(function (r) { return esc(r.ta.name); }).join(', ') + ' ' + (help.length > 1 ? 'are' : 'is') + ' furthest behind. Start with ' + esc(help[0].ta.name) + ', who is behind on ' + l.filter(function (p) { var s = help[0].calcs[p.id].status; return s === 'behind' || s === 'critical' || s === 'slip'; }).map(function (p) { return esc(p.title); }).join(', ') + '.' : 'Nobody is behind or critical. Check the slipping TAs on the next call.') + '</span></li>';
    l.forEach(function (p) {
      var src = isDA(p) ? (res.dRows || []).filter(function (r) { return r.zone.id === z.id; }) : rows;
      var asks = src.filter(function (r) { return r.calcs[p.id].ask > 0; }).sort(function (a, b) { return b.calcs[p.id].ask - a.calcs[p.id].ask; });
      var tot = sum(asks, function (r) { return r.calcs[p.id].ask; });
      h += '<li><b>' + esc(SHORT[p.metric]) + '</b><span>' + (tot > 0 ? withUnit(p.metric, tot) + ' still to deliver, carried by ' + asks.length + (isDA(p) ? ' Duka Assistants: ' : ' TAs: ') + asks.slice(0, 3).map(function (r) { return esc(r.ta.name) + ' (' + num(p.metric, r.calcs[p.id].ask) + ')'; }).join(', ') + '.' : 'Nothing left to assign. The zone has met its share.') + '</span></li>';
    });
    var star = rows.filter(function (r) { return r.status === 'ahead' || r.status === 'done'; });
    if (star.length) h += '<li><b>Thank</b><span>' + star.map(function (r) { return esc(r.ta.name); }).join(', ') + ' ' + (star.length > 1 ? 'are' : 'is') + ' ahead of pace on every priority. Say so on the next call.</span></li>';
    h += '</ul></div>';
    h += approvalsHTML(reg, z, res);
    h += '<div class="panel sec"><h3>TAs in this zone, furthest behind first</h3><div class="scroll"><table><thead><tr><th>TA</th>';
    l.forEach(function (p) { h += '<th>' + esc(p.title) + ' <span class="muted">' + p.weight + '%</span></th>'; });
    h += '<th class="r">Score</th><th>Status</th><th>Plan</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td>' + esc(r.ta.name) + '<div class="muted" style="font-size:12px">' + esc(r.ta.territory) + '</div></td>';
      l.forEach(function (p) {
        var c = r.calcs[p.id];
        if (c.na) { h += '<td class="muted">Duka Assistants</td>'; return; }
        h += '<td class="n"><span class="dist-wrap">' + dist(c.distance, c.need, c.status) + '<span>' + num(p.metric, c.distance, true) + '</span></span></td>';
      });
      h += '<td class="r n"><b>' + Math.round(r.score) + '</b></td><td>' + chip(r.status) + '</td><td>' + planChip(r.ta.id) + '</td><td><button class="btn small" data-act="plan" data-id="' + r.ta.id + '">Plan</button></td></tr>';
    });
    h += '</tbody></table></div><p class="sub" style="margin-top:8px">Each bar shows the distance from the pace line in the priority’s own unit. Bars to the left are behind.</p></div>';
    return h;
  }

  /* TA week */
  function explain(r, p) {
    var c = r.calcs[p.id], m = M[p.metric], ta = r.ta, zone = r.zone, h = [];
    if (m.kind === 'season') {
      h.push('The RM wants ' + p.target + '% of the season target by ' + dl(p) + '. Your season target is ' + c.S + ' ' + m.unit + ', so that is ' + c.base.toFixed(1) + '.');
      h.push('You began the week on ' + c.A0 + ' (' + (c.A0 / c.S * 100).toFixed(1) + '%), so this week’s requirement is ' + c.need.toFixed(1) + '.');
    } else if (m.kind === 'rate') {
      h.push('The RM wants ' + p.target + '% repaid by ' + dl(p) + '. Your portfolio is KES ' + c.S.toLocaleString('en-US') + ' due, so that is KES ' + Math.round(c.base).toLocaleString('en-US') + ' repaid in total.');
      h.push('You began the week on KES ' + c.A0.toLocaleString('en-US') + ' (' + (c.A0 / c.S * 100).toFixed(1) + '%), so you need KES ' + Math.round(c.need).toLocaleString('en-US') + ' more this week.');
    } else {
      h.push('The RM wants ' + p.target + ' ' + m.unit + ' from every TA by ' + dl(p) + '. You began the week on ' + c.A0 + ', so you need ' + c.need + ' this week.');
    }
    h.push('The pace line expects ' + withUnit(p.metric, c.expected) + ' by the end of ' + DAYS[S.day] + '. You have done ' + withUnit(p.metric, c.gain) + '.');
    if (m.kind === 'season') {
      var za = comp(S.region).zoneAlloc[zone.id][p.id];
      if (c.ask > 0) h.push('Your zone still needs ' + withUnit(p.metric, za.gap) + ' to reach its combined target. That gap is shared between the TAs who are behind, in proportion to the ' + (p.metric === 'groups' ? 'groups' : p.metric === 'scoped' ? 'GLs' : 'farmers') + ' each can still reach. Your share is ' + (c.share * 100).toFixed(0) + '%, which is ' + withUnit(p.metric, c.ask) + '.');
      else if (c.remaining > 0) h.push('You are behind your own share, but the zone’s combined gap is already covered by the others, so nothing extra is assigned to you. Keep your daily pace.');
      else h.push('Your share is met. You are not asked for more.');
    } else {
      h.push(c.ask > 0 ? 'What is left is yours: ' + withUnit(p.metric, c.ask) + '. It is not shared because every ' + (m.kind === 'rate' ? 'portfolio carries the same rate' : 'TA owes the same number') + '.' : 'Your share is met.');
    }
    return h;
  }

  function viewWeek() {
    var reg = sreg(), res = comp(S.region), l = prios(), r = res.byTA[S.ta], ta = r.ta, z = r.zone, a = r.area, d = S.day;
    var h = '<div class="ctl"' + (S.role === 'ta' ? ' hidden' : '') + ' style="margin-bottom:14px"><label for="taSel" class="lab">TA</label><select id="taSel">';
    reg.areas.forEach(function (ar) { ar.zones.forEach(function (zn) {
      h += '<optgroup label="' + esc(zn.name) + '">';
      zn.tas.forEach(function (t) { h += '<option value="' + t.id + '"' + (t.id === ta.id ? ' selected' : '') + '>' + esc(t.name) + '</option>'; });
      h += '</optgroup>';
    }); });
    h += '</select></div><div class="panel" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center"><div><h2 style="font-size:22px">' + esc(ta.name) + '</h2><p class="sub">Tupande Agent · territory ' + esc(ta.territory) + ' · ' + esc(z.name) + ' · ZS ' + esc(z.zs) + ' · AC ' + esc(a.ac) + ' · RM ' + esc(reg.rm) + '</p></div>' +
      '<div style="text-align:right"><div class="score">' + Math.round(r.score) + '<small>Score vs pace as of ' + DAYS[d] + '</small></div><div style="margin-top:6px">' + chip(r.status) + '</div></div></div>';

    h += '<div class="sec"><h2>Where you stand against the RM’s expectation</h2><div class="grid3" style="margin-top:10px">';
    l.forEach(function (p) {
      if (isDA(p)) return;
      var c = r.calcs[p.id], m = M[p.metric];
      var pct = c.need > 0 ? c.progress * 100 : 100, tick = c.need > 0 ? c.pace * 100 : 100;
      h += '<article class="panel pcard"><div class="head"><b>' + esc(p.title) + '</b><span class="muted">' + (r.plan.items[pIndex(p.id)] ? r.plan.items[pIndex(p.id)].weight : p.weight) + '% of your time</span></div><div class="sub">' + esc(targetText(p)) + '</div>' +
        '<div class="prog"><div class="fill ' + fcls(c.status) + '" style="width:' + pct + '%"></div><div class="tick' + (tick > 88 ? ' end' : '') + '" style="left:' + Math.min(99, tick) + '%"></div></div>' +
        '<div class="head"><span class="big">' + num(p.metric, c.gain) + ' <span class="muted" style="font-size:14px;font-weight:400">of ' + num(p.metric, c.need) + ' ' + (m.unit === 'KES' ? 'KES' : m.unit) + '</span></span>' + chip(c.status) + '</div>' +
        '<div class="lines"><div>Expected by now<b>' + num(p.metric, c.expected) + '</b></div><div>Distance<b>' + num(p.metric, c.distance, true) + '</b></div><div>Assigned to finish<b>' + num(p.metric, c.ask) + '</b></div></div>' +
        '<details><summary>Why this number</summary>' + explain(r, p).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</details></article>';
    });
    h += '</div>' + (l.some(isDA) ? '<p class="note" style="margin-top:10px"><b>Duka compliance</b> (' + l.filter(isDA).map(function (p) { return p.weight + '%'; }).join(', ') + ' of the RM’s weighting) is carried by the Duka Assistants in your zone: ' + z.das.map(function (o) { return esc(o.name); }).join(' and ') + '. It is not part of your score or your time plan.</p>' : '') + '</div>';

    h += '<div class="split sec"><div class="panel"><h3>Your time for the rest of the week</h3><p class="sub" style="margin-bottom:10px">' +
      (r.plan.Hrem > 0 ? r.plan.Hrem + ' productive hours remain. Every priority that still has work shares them by weight. When a priority is met, its hours go to the others in proportion to their weights. Time nobody needs goes to ageing check-ins, not filler visits.' : 'The week is over, so there is nothing left to plan.') + '</p>' +
      (r.localWeights ? '<p class="note" style="margin-bottom:10px">Your ' + (peekAcc(z.id) && peekAcc(z.id).status === 'active' && peekAcc(z.id).weights ? 'ZS' : 'AC') + ' changed the time split to <b>' + r.localWeights.join(' / ') + '</b> (the RM set ' + l.map(function (q) { return q.weight; }).join(' / ') + '), and it was approved. Your score is still measured against the RM’s weights.</p>' : '');
    if (r.plan.Hrem > 0) {
      h += '<div class="scroll"><table><thead><tr><th>Priority</th><th class="r">Weight</th><th class="r">Budget</th><th class="r">Needs</th><th class="r">Planned</th><th>Note</th></tr></thead><tbody>';
      r.plan.items.forEach(function (it) {
        if (it.daOwned) return;
        var note = it.met ? '<span class="chip c-done">Met · ' + it.released.toFixed(1) + ' h shared out</span>' :
          it.short > 0.05 ? '<span class="chip c-behind">About ' + num(it.p.metric, it.shortUnits) + ' ' + esc(unitOf(it.p.metric)) + ' will not fit</span>' :
          it.topUp > 0.05 ? '<span class="chip c-slip">+' + it.topUp.toFixed(1) + ' h borrowed</span>' :
          it.gained > 0.05 ? '<span class="chip c-on">+' + it.gained.toFixed(1) + ' h from met priorities</span>' : '<span class="chip c-ahead">Fits</span>';
        h += '<tr><td>' + esc(it.p.title) + '</td><td class="r n">' + it.weight + '%</td><td class="r n">' + it.budget.toFixed(1) + ' h</td><td class="r n">' + it.needH.toFixed(1) + ' h</td><td class="r n">' + it.alloc.toFixed(1) + ' h</td><td>' + note + '</td></tr>';
      });
      h += '</tbody></table></div>' + (r.plan.ageHours > 0 ? '<p class="sub" style="margin-top:8px">' + r.plan.ageHours.toFixed(2).replace(/\.?0+$/, '') + ' h that no priority needs go to check-ins with groups left alone for six weeks or more.</p>' : '') +
        (r.plan.free > 0.2 ? '<p class="sub" style="margin-top:8px">' + r.plan.free.toFixed(1) + ' h are left free. The engine does not fill them with extra visits.</p>' : '');
    }
    h += '</div><div class="panel"><h3>The week so far</h3><p class="sub" style="margin-bottom:10px">Done each day. Empty days have not happened yet.</p>';
    l.forEach(function (p) {
      if (isDA(p)) return;
      var arr = ta.daily[p.metric];
      h += '<div style="margin-bottom:10px"><div style="font-weight:600;margin-bottom:4px">' + esc(p.title) + '</div><div class="mini"><span></span>' + DAYS.map(function (x) { return '<span class="h">' + x + '</span>'; }).join('') + '<span class="muted">Done</span>' +
        arr.map(function (v, i) { return i <= d ? '<span class="c">' + num(p.metric, v) + '</span>' : '<span class="c fut">·</span>'; }).join('') + '</div></div>';
    });
    h += '</div></div>';
    h += whatIfHTML(r, l);
    h += planSection(r, l);
    return h;
  }

  function rowsUnderPressure(regId) {
    return comp(regId).rows.filter(function (r) { return r.plan.items.some(function (i) { return i.short > 0.05; }); }).sort(function (a, b) {
      return sum(b.plan.items, function (i) { return i.short; }) - sum(a.plan.items, function (i) { return i.short; });
    });
  }
  /* what changes when a priority is met */
  function whatIfHTML(r, l) {
    if (!(r.plan.Hrem > 0)) return '';
    var ln = l.filter(function (q) { return !isDA(q); });
    var pid = S.whatif && ln.some(function (p) { return p.id === S.whatif; }) ? S.whatif : ln[0].id;
    var idx = pIndex(pid), p = l[idx], base = r.plan, bi = base.items[idx];
    var h = '<div class="panel sec"><h3>What changes when you hit a priority</h3><p class="sub" style="margin-bottom:10px">Pick a priority and see the week as if it were already met. Its hours are shared among the others by weight.</p><div class="pills" role="group" aria-label="Priority to meet">';
    ln.forEach(function (q, i) { h += '<button class="pill" data-act="whatif" data-id="' + q.id + '" aria-pressed="' + (q.id === pid) + '">' + (i + 1) + ' · ' + esc(q.title) + '<small>' + q.weight + '%</small></button>'; });
    h += '</div>';
    if (bi.met) {
      h += '<p class="note" style="margin-top:12px"><b>' + esc(p.title) + '</b> is already met. Its ' + bi.released.toFixed(1) + ' h are already shared among the others, so the plan above is the “after” picture.</p></div>';
      return h;
    }
    var w = WP.planTA(r, l, S.day, { met: pid }), wi = w.items;
    var others = [];
    wi.forEach(function (it, i) { if (i !== idx && !it.met) { var dh = it.alloc - base.items[i].alloc; others.push({ it: it, dh: dh, bud: it.budget - base.items[i].budget }); } });
    var moved = bi.alloc;
    h += '<p style="margin-top:12px">Meeting <b>' + esc(p.title) + '</b> frees <b>' + fmtH(moved) + ' h</b> that were planned for it. ';
    if (others.length) {
      var wts = others.map(function (o) { return o.it.weight; }).join(' : ');
      h += 'They go to ' + others.map(function (o) { return '<b>' + esc(o.it.p.title) + '</b> (' + (o.dh >= 0.05 ? '+' + fmtH(o.dh) + ' h' : 'no change, its work is already fully covered') + ')'; }).join(' and ') + ', in the ratio of their weights (' + wts + ').';
    }
    var ageDiff = w.ageHours - base.ageHours;
    var noShift = others.every(function (o) { return o.dh < 0.05; });
    if (ageDiff > 0.05) h += ' Time that nobody needs, ' + fmtH(ageDiff) + ' h, goes to ageing check-ins.';
    h += '</p>';
    if (noShift) {
      var tight = rowsUnderPressure(S.region)[0];
      h += '<p class="note" style="margin-top:8px">Nothing shifts for ' + esc(r.ta.name) + ' because the other priorities already had all the time their work needs: unused hours were being lent to them. The change shows up for a TA who is short of time' + (tight ? ', for example <button class="btn small" data-act="plan" data-id="' + tight.ta.id + '">' + esc(tight.ta.name) + '</button>.' : '.') + '</p>';
    }
    h += '<div class="scroll" style="margin-top:10px"><table><thead><tr><th>Priority</th><th class="r">Budget now</th><th class="r">Budget if met</th><th class="r">Planned now</th><th class="r">Planned if met</th><th class="r">Change</th></tr></thead><tbody>';
    wi.forEach(function (it, i) {
      if (it.daOwned) return;
      var b = base.items[i], dh = it.alloc - b.alloc;
      h += '<tr' + (i === idx ? ' class="lv-reg"' : '') + '><td>' + esc(it.p.title) + (i === idx ? ' <span class="chip c-done">Met</span>' : '') + '</td><td class="r n">' + b.budget.toFixed(1) + ' h</td><td class="r n">' + it.budget.toFixed(1) + ' h</td><td class="r n">' + b.alloc.toFixed(1) + ' h</td><td class="r n">' + it.alloc.toFixed(1) + ' h</td><td class="r n"><b>' + (Math.abs(dh) < 0.05 ? '0' : (dh > 0 ? '+' : '−') + fmtH(Math.abs(dh))) + ' h</b></td></tr>';
    });
    h += '<tr><td>Ageing check-ins</td><td class="r n">–</td><td class="r n">–</td><td class="r n">' + base.ageHours.toFixed(1) + ' h</td><td class="r n">' + w.ageHours.toFixed(1) + ' h</td><td class="r n"><b>' + (Math.abs(ageDiff) < 0.05 ? '0' : (ageDiff > 0 ? '+' : '−') + fmtH(Math.abs(ageDiff))) + ' h</b></td></tr></tbody></table></div>';
    h += '<p class="sub" style="margin:10px 0 6px">Day by day, what the plan would look like</p><div class="whatif-days">';
    w.days.forEach(function (day, di) {
      var bd = base.days[di], parts = [];
      var ids = ln.map(function (q) { return q.id; }).concat(['ageing']);
      ids.forEach(function (id) {
        var a = sum(bd.blocks.filter(function (b) { return b.pid === id; }), function (b) { return b.hours; }), c = sum(day.blocks.filter(function (b) { return b.pid === id; }), function (b) { return b.hours; });
        if (Math.abs(a - c) < 0.01) return;
        var title = id === 'ageing' ? 'Ageing check-ins' : pById(id, l).title;
        parts.push('<li>' + esc(title) + ' <b class="num">' + fmtH(a) + ' → ' + fmtH(c) + ' h</b></li>');
      });
      h += '<div class="wd"><b>' + day.label + ' ' + day.date + '</b>' + (parts.length ? '<ul>' + parts.join('') + '</ul>' : '<p class="muted">No change</p>') + '</div>';
    });
    h += '</div></div>';
    return h;
  }

  /* the plan, its status and the edit controls */
  function planSection(r, l) {
    var plan = getPlan(r.ta.id), editing = S.edit && S.editTa === r.ta.id && S.editKey === plan.key && !!plan.days, days = effDays(plan, r), zs = r.zone.zs;
    var h = '<div class="sec"><h2>Your plan for the rest of the week</h2>';
    if (!r.plan.days.length) return h + '<p class="empty">Nothing left to plan. Move the “as of” day earlier to see a plan.</p></div>';
    var draft = plan.status === 'proposed' && plan.days && !editing;
    var st = editing ? 'Editing' : draft ? 'Draft' : PLAN_LABEL[plan.status][0];
    var cls = editing || draft ? 'c-slip' : PLAN_LABEL[plan.status][1];
    var msg, btns = '';
    if (editing) {
      msg = 'Change the hours, move blocks to another day, remove them or add your own. Then say why, and send it to ' + zs + ' for approval. The plan only becomes active once ' + zs + ' approves.';
      btns = '<button class="btn small" data-act="editCancel">Cancel</button> <button class="btn small" data-act="useRec">Use recommended plan</button>';
    } else if (plan.status === 'proposed' && !draft) {
      msg = 'The engine’s recommended plan. It is not active yet. Accept it as it is, or change it and send it to ' + zs + ' for approval.';
      btns = '<button class="btn solid" data-act="accept">Accept plan</button> <button class="btn" data-act="editStart">Edit plan</button>';
    } else if (draft) {
      msg = 'You have changes that have not been sent. The plan is not active.';
      btns = '<button class="btn solid" data-act="editStart">Continue editing</button> <button class="btn" data-act="useRec">Discard changes</button>';
    } else if (plan.status === 'active') {
      msg = (plan.approvedBy ? 'Approved by ' + plan.approvedBy + '. ' : 'You accepted the recommended plan. ') + 'This is the plan you work to. Changing it needs ' + zs + '’s approval again.';
      btns = '<button class="btn" data-act="editStart">Edit plan</button>';
    } else if (plan.status === 'pending') {
      msg = 'Sent to ' + zs + '. It is not active until approved.';
      btns = '<button class="btn" data-act="withdraw">Withdraw and edit</button>';
    } else {
      msg = zs + ' returned the plan' + (plan.comment ? ': “' + plan.comment + '”' : '.') + ' Change it and send it again, or accept the recommended plan.';
      btns = '<button class="btn solid" data-act="editStart">Edit again</button> <button class="btn" data-act="useRecAccept">Accept recommended plan</button>';
    }
    h += '<div class="banner ' + (editing ? 'pending' : draft ? 'pending' : plan.status) + '"><div class="bhead"><span class="chip ' + cls + '">' + st + '</span><span class="sub">' + esc(msg) + '</span></div>' + (btns ? '<div class="bact">' + btns + '</div>' : '') + '</div>';
    if (S.err[r.ta.id]) h += '<p class="note warn" role="alert" style="margin-top:10px">' + esc(S.err[r.ta.id]) + '</p>';
    h += '<p class="sub" style="margin-top:10px">Blocks, not a clock. The order follows the rules: deadlines that have passed, then weight. ' + (r.isDA ? 'Dukas are taken in turn from your list.' : 'Group choices come from the ranking and the six-week ageing rule.') + '</p><div class="days" style="margin-top:10px">';
    days.forEach(function (day) {
      var used = dayHours(day);
      h += '<article class="panel day"><h4><span>' + day.label + ' ' + day.date + '</span><span class="muted num">' + fmtH(used) + ' of ' + day.cap + ' h</span></h4>';
      if (!day.blocks.length) h += '<p class="empty">Nothing planned.</p>';
      day.blocks.forEach(function (b) {
        var title = b.pid === 'ageing' ? 'Ageing check-ins' : (b.title || pById(b.pid).title);
        h += '<div class="block' + (b.edited || b.added ? ' edited' : '') + '"><div class="meta"><span><b>' + esc(title) + '</b> · ' + b.part + (b.overdue ? ' · <span class="todo">deadline passed</span>' : '') + (b.added ? ' · added by you' : b.edited ? ' · edited' : '') + '</span><span class="num">' + fmtH(b.hours) + ' h</span></div><div class="act">' + esc(b.text) + '</div>';
        var why = b.reasons.join(' · ');
        if ((b.edited || b.added) && b.metric) why = 'At ' + fmtH(b.hours) + ' h this block covers about ' + withUnit(b.metric, b.hours / M[b.metric].hrs) + (b.edited ? '. The amounts in the sentence above are for the recommended ' + fmtH(b.rec) + ' h.' : '.');
        h += '<div class="why">' + esc(why) + '</div>';
        if (editing) {
          h += '<div class="bctl"><button class="btn small" data-act="bminus" data-b="' + b.bid + '" aria-label="Less time"' + (b.hours <= 0.25 ? ' disabled' : '') + '>−15 min</button><button class="btn small" data-act="bplus" data-b="' + b.bid + '" aria-label="More time"' + (used + 0.25 > day.cap + 1e-9 ? ' disabled' : '') + '>+15 min</button><label class="sr" for="mv' + b.bid + '">Move to day</label><select id="mv' + b.bid + '" data-move="' + b.bid + '">';
          h += '<option value="">Move to…</option>';
          days.forEach(function (dd) { if (dd.i !== day.i) h += '<option value="' + dd.i + '">' + dd.label + '</option>'; });
          h += '</select><button class="btn small" data-act="bremove" data-b="' + b.bid + '">Remove</button></div>';
        }
        h += '</div>';
      });
      h += '</article>';
    });
    h += '</div>';
    if (editing) {
      h += '<div class="panel" style="margin-top:14px"><h3>Add a block</h3><div class="row" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:8px"><label class="field"><span>Priority</span><select id="addPid">';
      l.forEach(function (p) { h += '<option value="' + p.id + '">' + esc(p.title) + '</option>'; });
      h += '</select></label><label class="field"><span>Day</span><select id="addDay">';
      days.forEach(function (dd) { h += '<option value="' + dd.i + '">' + dd.label + '</option>'; });
      h += '</select></label><button class="btn" data-act="addBlock">Add 30 minutes</button></div></div>';
    }
    if (editing || plan.status === 'pending' || draft || plan.status === 'returned' || (plan.days && plan.status === 'active')) {
      h += '<div class="panel" style="margin-top:14px"><h3>What your changes do to the targets</h3><p class="sub" style="margin-bottom:8px">Compared with the recommended plan. This is what ' + esc(zs) + ' sees when deciding.</p>' + impactHTML(r, days) + '</div>';
    }
    if (editing) {
      h += '<div class="panel" style="margin-top:14px"><h3>Send to ' + esc(zs) + '</h3><label class="field" style="margin-top:8px"><span>Why are you changing it?</span><textarea id="planReason" rows="3" placeholder="For example: market day in Kapwera on Friday, so enrolment moves to Saturday.">' + esc(plan.reason) + '</textarea></label>' +
        '<div style="margin-top:10px"><button class="btn solid" data-act="send">Send for approval</button></div></div>';
    } else if (plan.reason && plan.status !== 'proposed') {
      h += '<p class="sub" style="margin-top:12px"><b>Your reason:</b> ' + esc(plan.reason) + '</p>';
    }
    if (plan.log.length) h += '<p class="sub" style="margin-top:10px"><b>History:</b> ' + plan.log.map(esc).join(' · ') + '</p>';
    h += '</div>';
    return h;
  }

  /* focus by level: where time goes, from actual performance, against the RM's weights */
  function tbarHTML(fo) {
    if (fo.over) return '<div class="tbar" aria-hidden="true"></div>';
    var h = '<div class="tbar" role="img" aria-label="Share of time by priority">';
    fo.items.forEach(function (it, i) { if (it.share > 0) h += '<i class="pc' + Math.min(i, 4) + '" style="flex:' + it.share + '"></i>'; });
    return h + '</div>';
  }
  function shiftText(fo) {
    if (fo.over) return 'Nothing is left to plan: every priority is met, or the week is over.';
    var s = fo.items.filter(function (i) { return i.delta != null; }).sort(function (a, b) { return b.delta - a.delta; }), up = s[0], dn = s[s.length - 1];
    if (!s.length) return 'No time shift to show.';
    if (up.delta < 5 && dn.delta > -5) return 'Close to the RM’s weights.';
    var t = [];
    if (up.delta >= 5) t.push('More on ' + up.p.title + ' (' + Math.round(up.share) + '% against ' + Math.round(up.weightEff) + '%)');
    if (dn.delta <= -5) t.push('less on ' + dn.p.title + ' (' + Math.round(dn.share) + '% against ' + Math.round(dn.weightEff) + '%)');
    return t.join(', ') + '.';
  }
  function gapText(rows, l) {
    var worst = null, wr = 0;
    l.forEach(function (p) { var a = WP.aggregate(rows, p), r = a.need > 0 ? a.distance / a.need : 0; if (r < wr) { wr = r; worst = { p: p, a: a }; } });
    return worst && wr < -0.05 ? esc(worst.p.title) + ' <span class="muted">(' + withUnit(worst.p.metric, worst.a.distance, true) + ' against pace)</span>' : '<span class="muted">None behind pace</span>';
  }
  function rankHTML(fo) {
    if (fo.over) return '<span class="muted">All met</span>';
    var order = fo.items.map(function (it, i) { return { it: it, i: i }; }).filter(function (x) { return x.it.share > 0.5; }).sort(function (a, b) { return b.it.share - a.it.share; });
    return '<ol class="rank">' + order.map(function (x) { return '<li><span class="sw pc' + Math.min(x.i, 4) + '"></span>' + esc(x.it.p.title) + ' <b class="num">' + Math.round(x.it.share) + '%</b></li>'; }).join('') + '</ol>';
  }
  function viewFocus() {
    var reg = sreg(), res = sres(), l = prios(), rows = res.rows, tot = focusTotal(res, l), su = scopeUnit();
    var levels = S.role === 'rm' ? [['region', 'Region'], ['area', 'Areas'], ['zone', 'Zones'], ['ta', 'Territories']] : S.role === 'ac' ? [['region', 'My area'], ['zone', 'Zones'], ['ta', 'Territories']] : [['region', 'My zone'], ['ta', 'Territories']];
    if (!levels.some(function (x) { return x[0] === S.level; })) S.level = 'region';
    var h = '<p class="sub" style="margin-bottom:12px">The RM’s weights say how time <i>should</i> be split. This view shows how the remaining work is actually distributed once each unit’s own numbers are in. A unit that is ahead on one priority needs less time there and more elsewhere.</p>';
    h += '<div class="pills" role="group" aria-label="Level" style="margin-bottom:14px">';
    levels.forEach(function (x) { h += '<button class="pill" data-act="level" data-id="' + x[0] + '" aria-pressed="' + (S.level === x[0]) + '">' + x[1] + '</button>'; });
    h += '</div><div class="panel"><div class="legend" style="margin-bottom:8px"><b>RM weights</b>';
    l.forEach(function (p, i) { h += '<span><span class="sw pc' + Math.min(i, 4) + '"></span>' + esc(p.title) + ' ' + p.weight + '%</span>'; });
    h += '</div><div class="tbar" role="img" aria-label="RM weights">' + l.map(function (p, i) { return '<i class="pc' + Math.min(i, 4) + '" style="flex:' + Math.max(p.weight, 0.01) + '"></i>'; }).join('') + '</div></div>';

    if (S.level === 'region') {
      var fo = tot;
      h += '<div class="panel sec"><h3>' + esc(su.name) + ' · ' + esc(su.sub) + '</h3><p style="margin:6px 0 10px">' + (fo.over ? esc(shiftText(fo)) : 'Across ' + fo.n + ' TAs, the work still to do calls for this split of time. ' + esc(shiftText(fo)) + (fo.ageH > 0.5 ? ' A further ' + Math.round(fo.ageH) + ' h that no priority needs go to ageing check-ins.' : '')) + '</p>' + tbarHTML(fo) +
        '<div class="scroll" style="margin-top:12px"><table><thead><tr><th>Priority</th><th class="r">RM weight</th><th class="r">Time the data calls for</th><th class="r">Shift</th><th class="r">Work left</th><th class="r">TAs who have met it</th><th>Region against pace</th></tr></thead><tbody>';
      fo.items.forEach(function (it, i) {
        var a = it.agg;
        h += '<tr><td><span class="sw pc' + Math.min(i, 4) + '"></span>' + esc(it.p.title) + '</td><td class="r n">' + it.weight + '%</td><td class="r n">' + (it.share == null ? '–' : Math.round(it.share) + '%') + '</td><td class="r n"><b>' + (it.delta == null ? '–' : (it.delta > 0.5 ? '+' : it.delta < -0.5 ? '−' : '') + Math.abs(Math.round(it.delta)) + ' pts') + '</b></td><td class="r n">' + (it.daOwned ? '–' : fmtH(it.needH) + ' h') + '</td><td class="r n">' + (it.daOwned ? 'Duka Assistants' : it.metCount + ' of ' + fo.n) + '</td><td>' + chip(a.status) + ' <span class="sub">' + withUnit(it.p.metric, a.distance, true) + '</span></td></tr>';
      });
      h += '</tbody></table></div><p class="sub" style="margin-top:8px">“Time the data calls for” is each TA’s planned hours for the rest of the week, added up and shown as a share. It is the weights, adjusted for who is ahead, who is behind and what is already met.' + (l.some(isDA) ? ' Duka work belongs to the Duka Assistants’ own set, so it takes no TA time.' : '') + '</p></div>';
      return h;
    }

    var units = [], title;
    if (S.level === 'area') { title = 'Areas'; reg.areas.forEach(function (a) { var rr = []; a.zones.forEach(function (z) { zoneRows(res, z).forEach(function (x) { rr.push(x); }); }); units.push({ name: a.name, sub: 'AC ' + a.ac, rows: rr }); }); }
    else if (S.level === 'zone') { title = 'Zones'; allZones(reg).forEach(function (z) { units.push({ name: z.name, sub: 'ZS ' + z.zs, rows: zoneRows(res, z) }); }); }
    else {
      title = 'Territories';
      var z = DATA.byId[S.zone];
      h += '<div class="ctl" style="margin:14px 0 0"><label for="zoneSel" class="lab">Zone</label><select id="zoneSel">';
      reg.areas.forEach(function (a) { h += '<optgroup label="' + esc(a.name) + '">'; a.zones.forEach(function (x) { h += '<option value="' + x.id + '"' + (x.id === z.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }); h += '</optgroup>'; });
      h += '</select></div>';
      zoneRows(res, z).forEach(function (r) { units.push({ name: r.ta.name, sub: r.ta.territory, rows: [r], ta: r.ta.id }); });
    }
    h += '<div class="panel sec"><h3>' + title + '</h3><div class="scroll" style="margin-top:8px"><table><thead><tr><th>Unit</th><th style="min-width:180px">Where the time goes</th><th>Priority order</th><th>Furthest behind pace</th><th>Shift from RM weights</th>' + (S.level === 'ta' ? '<th></th>' : '') + '</tr></thead><tbody>';
    units.forEach(function (u) {
      var fo = WP.focusOf(u.rows, l);
      h += '<tr><td>' + esc(u.name) + '<div class="muted" style="font-size:12px">' + esc(u.sub) + '</div></td><td>' + tbarHTML(fo) + '</td><td>' + rankHTML(fo) + '</td><td>' + gapText(u.rows, l) + '</td><td>' + esc(shiftText(fo)) + '</td>' + (S.level === 'ta' ? '<td><button class="btn small" data-act="plan" data-id="' + u.ta + '">Plan</button></td>' : '') + '</tr>';
    });
    h += '</tbody></table></div><p class="sub" style="margin-top:8px">Each row uses that unit’s own TAs’ remaining work and plans. The first priority in the order is where the most time will go.</p></div>';
    return h;
  }
  function focusTotal(res, l) { return WP.focusOf(res.rows, l); }


  /* scorecards: one card per priority at every level, with the score building through the week */
  var rvDay = {};
  function resDay(d) {
    var key = S.region + '|' + d + '|' + JSON.stringify(S.prios[S.region]) + '|' + JSON.stringify(dprios());
    if (!rvDay[key]) { var k = Object.keys(rvDay); if (k.length > 40) rvDay = {}; rvDay[key] = WP.computeRegion(region(), S.prios[S.region], d, { duka: dprios() }); }
    return rvDay[key];
  }
  var SC_LABEL = { on: 'On track', slip: 'Slipping', behind: 'Behind', critical: 'Well behind' };
  function scoreAt(ids, p, d) {
    var r = resDay(d);
    if (isDA(p)) {
      if (ids.length === 1) return null;
      var seen = {}, vals = [];
      ids.forEach(function (id) { var row = r.byTA[id]; if (!seen[row.zone.id]) { seen[row.zone.id] = 1; row.das.forEach(function (o) { vals.push(o.calcs[p.id].paceProg); }); } });
      return vals.length ? sum(vals) / vals.length * 100 : null;
    }
    return sum(ids, function (id) { return r.byTA[id].calcs[p.id].paceProg; }) / ids.length * 100;
  }
  /* a unit's overall score: the RM's weights over every priority it is accountable for (a single TA is not accountable for duka) */
  function unitScore(ids, d) {
    var acc = 0, ws = 0;
    S.prios[S.region].forEach(function (p) { var v = scoreAt(ids, p, d); if (v == null) return; acc += p.weight * v; ws += p.weight; });
    return ws ? acc / ws : 0;
  }
  function scoreCard(p, ids, selected) {
    var r5 = resDay(S.day), rows = ids.map(function (id) { return r5.byTA[id]; }), a = WP.aggregate(rows, p), m = M[p.metric];
    var score = scoreAt(ids, p, S.day);
    if (score == null) return '<div class="sc na"><span class="sct"><b>' + pTag(p.metric) + esc(p.title) + '</b><span class="muted">' + p.weight + '%</span></span><span class="scl">Carried by the Duka Assistants in the zone. <span class="muted">It is not part of a TA’s score.</span></span></div>';
    var st = statusFromScore(score), days = [];
    for (var d = 0; d <= 5; d++) days.push(d <= S.day ? scoreAt(ids, p, d) : null);
    var head = a.curPct != null ? 'at ' + a.curPct.toFixed(a.curPct < 10 ? 1 : 0) + '%' : num(p.metric, a.gain / a.n) + ' ' + m.unit + (isDA(p) ? ' per assistant' : ' per TA');
    var sub = a.curPct != null ? (S.day < 5 && S.day < p.deadline ? 'pace line ' + a.expPct.toFixed(a.expPct < 10 ? 1 : 0) + '%, ' : '') + 'target ' + p.target + '% by ' + DAYS[p.deadline] : 'asked ' + num(p.metric, a.need / a.n) + (isDA(p) ? ' each' : '') + ' by ' + DAYS[p.deadline];
    var spark = '<span class="spark" role="img" aria-label="Score by day: ' + days.filter(function (x) { return x != null; }).map(function (x) { return Math.round(x); }).join(', ') + '">' +
      days.map(function (x, i) { return x == null ? '<i class="fut" style="height:8%" title="' + DAYS[i] + ' not yet"></i>' : '<i class="' + fcls(statusFromScore(x)) + '" style="height:' + Math.max(8, x) + '%" title="' + DAYS[i] + ' ' + Math.round(x) + '"></i>'; }).join('') + '</span>';
    return '<button class="sc" data-act="rprio" data-id="' + p.id + '" aria-pressed="' + selected + '"><span class="sct"><b>' + pTag(p.metric) + esc(p.title) + '</b><span class="muted">' + p.weight + '%</span></span>' +
      '<span class="scl">' + esc(head) + ' <span class="muted">' + esc(sub) + '</span></span>' +
      '<span class="scr"><span class="chip ' + ST[st][1] + '">' + SC_LABEL[st] + '</span><span class="scn num">' + Math.round(score) + '</span></span>' + spark + '</button>';
  }
  function unitBlock(label, name, sub, ids, l, selId, opts) {
    var ov = unitScore(ids, S.day), st = statusFromScore(ov);
    var h = '<section class="ublock"><header><div><span class="muted ulv">' + esc(label) + '</span><h4>' + esc(name) + '</h4><div class="sub">' + esc(sub) + '</div></div><div class="ovr"><span class="chip ' + ST[st][1] + '">' + SC_LABEL[st] + '</span><span class="scn num">' + Math.round(ov) + '</span><small>overall</small>' + (opts && opts.btn ? opts.btn : '') + '</div></header><div class="cards">';
    l.forEach(function (p) { h += scoreCard(p, ids, p.id === selId); });
    return h + '</div></section>';
  }
  function idsOf(zones) { var o = []; zones.forEach(function (z) { z.tas.forEach(function (t) { o.push(t.id); }); }); return o; }
  function scorecardsHTML(reg, l, selId) {
    if (S.role === 'ta') { var tt = sTa(); return '<div class="sec"><h2>Scorecards</h2><p class="sub" style="margin:4px 0 12px">One card per priority for your territory. The score is how much of the pace line you delivered; the bars show it at the end of each day so far. Duka work belongs to the Duka Assistants’ own set and is not part of your score.</p>' + unitBlock('Territory', tt.territory, 'TA ' + tt.name, [tt.id], l, selId) + '</div>'; }
    var area = S.rvArea && DATA.byId[S.rvArea] && DATA.byId[S.rvArea].regionId === reg.id ? DATA.byId[S.rvArea] : null;
    var zone = area && S.rvZone && DATA.byId[S.rvZone] && DATA.byId[S.rvZone].areaId === area.id ? DATA.byId[S.rvZone] : null;
    if (S.role === 'ac') { area = reg.areas[0]; if (zone && zone.areaId !== area.id) zone = null; }
    if (S.role === 'zs') { zone = reg.areas[0].zones[0]; area = DATA.byId[zone.areaId]; }
    var r5 = resDay(S.day), cr = [];
    if (S.role === 'rm') cr.push('<button class="btn small" data-act="rvup" data-to="region"' + (!area ? ' aria-current="true"' : '') + '>' + esc(reg.name) + '</button>');
    if (area && S.role !== 'zs') cr.push('<button class="btn small" data-act="rvup" data-to="area"' + (!zone ? ' aria-current="true"' : '') + '>' + esc(area.name) + '</button>');
    if (zone) cr.push('<span class="btn small" aria-current="true">' + esc(zone.name) + '</span>');
    var crumbs = '<nav class="crumbs" aria-label="Level">' + cr.join(' › ') + '</nav>';
    var h = '<div class="sec"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline"><h2>Scorecards</h2>' + crumbs + '</div>' +
      '<p class="sub" style="margin:4px 0 12px">One card per priority. The score is how much of the pace line each TA delivered, averaged over the unit’s TAs, with each TA capped at 100 so a strong TA cannot cover for a weak one. The bars show the score at the end of each day so far; days still to come are empty. Open a unit to see the level below. Click a card for the detail further down.</p>';
    var cur, curIds, label, children, childLabel;
    if (!area) { cur = reg; curIds = idsOf(allZones(reg)); label = 'Regional level'; childLabel = 'Area level'; }
    else if (!zone) { cur = area; curIds = idsOf(area.zones); label = 'Area level'; childLabel = 'Zone level'; }
    else { cur = zone; curIds = zone.tas.map(function (t) { return t.id; }); label = 'Zone level'; childLabel = 'Territory level'; }
    h += unitBlock(label, cur.name, !area ? 'RM ' + reg.rm : !zone ? 'AC ' + area.ac : 'ZS ' + zone.zs, curIds, l, selId);
    var kids = [];
    if (!area) reg.areas.forEach(function (a) { kids.push({ ids: idsOf(a.zones), name: a.name, sub: 'AC ' + a.ac, lv: 'area', id: a.id }); });
    else if (!zone) area.zones.forEach(function (z) { kids.push({ ids: z.tas.map(function (t) { return t.id; }), name: z.name, sub: 'ZS ' + z.zs, lv: 'zone', id: z.id }); });
    else zone.tas.forEach(function (t) { kids.push({ ids: [t.id], name: t.territory, sub: 'TA ' + t.name, lv: 'ta', id: t.id }); });
    kids.forEach(function (k) { k.ov = unitScore(k.ids, S.day); });
    kids.sort(function (a, b) { return a.ov - b.ov; });
    h += '<h3 style="margin:18px 0 8px">' + childLabel + ' <span class="muted" style="font-weight:400;font-size:13px">· lowest score first</span></h3><div class="ublocks">';
    kids.forEach(function (k) {
      var btn = k.lv === 'ta' ? '<button class="btn small" data-act="plan" data-id="' + k.id + '">TA week</button>' : '<button class="btn small solid" data-act="rvopen" data-lv="' + k.lv + '" data-id="' + k.id + '">Open</button>';
      h += unitBlock(childLabel.replace(' level', ''), k.name, k.sub, k.ids, l, selId, { btn: btn });
    });
    return h + '</div></div>';
  }

  /* closed-week review: result against the priority, and against each unit's own recent average */
  var RV2 = { 'met-up': 'On pace · improving', 'met-flat': 'On pace · no clear gain', 'short-up': 'Behind pace · improving', 'short-flat': 'Behind pace · not moving' };
  var RV = { 'met-up': ['Met · improved', 'c-done'], 'met-flat': ['Met · no clear gain', 'c-on'], 'short-up': ['Short · improving', 'c-slip'], 'short-flat': ['Short · not moving', 'c-behind'] };
  var rvCache = {};
  function res5() {
    var key = S.region + '|' + JSON.stringify(S.prios[S.region]);
    if (!rvCache[key]) rvCache[key] = WP.computeRegion(region(), S.prios[S.region], 5);
    return rvCache[key];
  }
  function pctTxt(x) { if (x == null) return '–'; var r = Math.round(x * 100); return r === 0 ? '0%' : (r > 0 ? '+' : '−') + Math.abs(r) + '%'; }
  function rvChip(v) { return '<span class="chip ' + RV[v][1] + '">' + (S.day >= 5 ? RV[v][0] : RV2[v]) + '</span>'; }
  function nameBtn(r) { return r.isDA ? esc(r.ta.name) + ' <span class="muted">· DA</span>' : '<button class="btn small" data-act="plan" data-id="' + r.ta.id + '">' + esc(r.ta.name) + '</button>'; }
  function viewReview() {
    var reg = sreg(), su = scopeUnit(), l = S.prios[S.region], res = sres(resDay(S.day)), p = pById(S.rprio && l.some(function (q) { return q.id === S.rprio; }) ? S.rprio : l[0].id, l), pi = pIndex(p.id);
    var all = WP.reviewUnit(res.rows, l, S.day), it = all.items[l.indexOf(p)], m = M[p.metric];
    var h = '<p class="sub" style="margin-bottom:12px">' + (S.day >= 5 ? 'Results for the week of 9 Nov, closed on Saturday 14 Nov. ' : 'The week of 9 Nov is still open. Scores are as of the end of <b>' + DAYS[S.day] + '</b>; move the day selector to watch them build, or pick Sat for the closed week. ') + 'Start with the scorecards, open a level to go deeper, then use the detail below. Results are also set against each unit’s own average for the four weeks before. <b>That history is generated for the prototype</b>; the real tool reads it from weekly snapshots.</p>';
    h += scorecardsHTML(reg, l, p.id);
    h += '<div class="sec"><h2>Detail for one priority</h2></div><div class="pills" role="group" aria-label="Priority" style="margin-top:8px">';
    l.forEach(function (q) { h += '<button class="pill" data-act="rprio" data-id="' + q.id + '" aria-pressed="' + (q.id === p.id) + '">' + esc(q.title) + '<small>' + q.weight + '%</small></button>'; });
    h += '</div>' + (it.na ? '<div class="panel" style="margin-top:14px"><b>' + esc(p.title) + '</b> is carried by Duka Assistants, so there is no TA result to review here. Open a zone, area or region to see it.</div>' : '') + '<div class="tiles" style="margin-top:14px' + (it.na ? ';display:none' : '') + '">' +
      '<div class="tile"><div class="k">' + (S.day >= 5 ? 'Delivered against the ask' : 'Delivered so far') + '</div><div class="v">' + Math.round(it.achieved * 100) + '%</div><div class="s">' + withUnit(p.metric, it.gain) + ' of ' + withUnit(p.metric, it.need) + ' needed' + (it.achieved >= 0.98 && it.met / it.n < 0.8 ? '. The total covers the ask, but not every TA met their own.' : '') + '</div></div>' +
      '<div class="tile"><div class="k">' + (S.day >= 5 ? 'TAs who met it' : 'TAs who have met it so far') + '</div><div class="v">' + it.met + ' of ' + it.n + '</div><div class="s">' + (it.n - it.met) + ' fell short</div></div>' +
      '<div class="tile"><div class="k">' + (S.day >= 5 ? 'Against the four weeks before' : 'Against the usual week to this point') + '</div><div class="v">' + pctTxt(it.change) + '</div><div class="s">' + withUnit(p.metric, it.prior) + ' a week on average</div></div>' +
      '<div class="tile"><div class="k">Verdict</div><div class="v" style="font-size:16px;padding-top:6px">' + rvChip(it.verdict) + '</div><div class="s">' + esc(su.name) + '</div></div></div>';

    /* did the priorities move the needle */
    h += '<div class="panel sec"><h3>Did the priorities move the needle?</h3><p class="sub" style="margin-bottom:8px">Change in weekly output against the four weeks before, for the priorities and for the measures that were not priorities.</p><div class="scroll"><table><thead><tr><th>Measure</th><th class="r">RM weight</th><th class="r">Delivered vs ask</th><th class="r">TAs who met it</th><th class="r">Change vs before</th><th>Verdict</th></tr></thead><tbody>';
    all.items.forEach(function (x) {
      if (x.na) return;
      h += '<tr><td><b>' + esc(x.p.title) + '</b></td><td class="r n">' + x.weight + '%</td><td class="r n">' + Math.round(x.achieved * 100) + '%</td><td class="r n">' + x.met + ' of ' + x.n + '</td><td class="r n"><b>' + pctTxt(x.change) + '</b></td><td>' + rvChip(x.verdict) + '</td></tr>';
    });
    all.others.forEach(function (x) {
      h += '<tr class="muted"><td>' + esc(M[x.metric].label) + ' <span class="muted">(not a priority)</span></td><td class="r n">–</td><td class="r n">–</td><td class="r n">–</td><td class="r n">' + pctTxt(x.change) + '</td><td></td></tr>';
    });
    var gap = all.prioChange != null && all.otherChange != null ? (all.prioChange - all.otherChange) * 100 : null;
    h += '</tbody></table></div><p style="margin-top:10px">' + (gap == null ? '' : 'Priority measures changed <b>' + pctTxt(all.prioChange) + '</b> on average, against <b>' + pctTxt(all.otherChange) + '</b> for measures that were not priorities, a gap of <b>' + Math.round(Math.abs(gap)) + ' points</b> ' + (gap > 3 ? 'in favour of the priorities.' : gap < -3 ? 'against the priorities.' : 'that is too small to call.')) + '</p>' +
      '<p class="note warn" style="margin-top:8px">This is a guide, not proof. It is one week, there is no control group, and the weeks before may differ in season, weather or market days. The real tool would track this over several weeks and flag the priorities whose gap holds up.</p></div>';

    if (S.role === 'ta') return h;
    /* recognise and follow up */
    var zset = {}; scopeZones().forEach(function (z) { zset[z.id] = 1; });
    var rows = (isDA(p) ? (res.dRows || []).filter(function (r) { return zset[r.zone.id]; }) : res.rows).map(function (r) { var c = r.calcs[p.id], pr = WP.reviewUnit([r], [p], S.day).items[0]; return { r: r, c: c, v: pr }; });
    var best = rows.filter(function (x) { return x.v.met === 1 && x.v.change != null; }).sort(function (a, b) { return b.v.change - a.v.change; }).slice(0, 3);
    var follow = rows.filter(function (x) { return x.v.verdict === 'short-flat'; }).sort(function (a, b) { return a.v.achieved - b.v.achieved; }).slice(0, 3);
    h += '<div class="grid2 sec"><div class="panel"><h3>Celebrate</h3><p class="sub">Met the target and improved most on their own recent average.</p><table><tbody>' +
      (best.length ? best.map(function (x) { return '<tr><td><button class="btn small" data-act="plan" data-id="' + x.r.ta.id + '">' + esc(x.r.ta.name) + '</button></td><td class="sub">' + esc(x.r.zone.name) + '</td><td class="r n"><b>' + pctTxt(x.v.change) + '</b></td></tr>'; }).join('') : '<tr><td class="empty">Nobody met the target and improved.</td></tr>') +
      '</tbody></table></div><div class="panel"><h3>Follow up</h3><p class="sub">Short of the target and not moving against their own average.</p><table><tbody>' +
      (follow.length ? follow.map(function (x) { return '<tr><td><button class="btn small" data-act="plan" data-id="' + x.r.ta.id + '">' + esc(x.r.ta.name) + '</button></td><td class="sub">' + esc(x.r.zone.name) + ' · ' + Math.round(x.v.achieved * 100) + '% of ask</td><td class="r n"><b>' + pctTxt(x.v.change) + '</b></td></tr>'; }).join('') : '<tr><td class="empty">Nobody is short and flat.</td></tr>') +
      '</tbody></table></div></div>';

    /* by level */
    var levels = S.role === 'rm' ? [['area', 'Areas'], ['zone', 'Zones'], ['ta', 'Territories']] : S.role === 'ac' ? [['zone', 'Zones'], ['ta', 'Territories']] : [['ta', 'Territories']], lv = S.rlevel || 'zone', units = [];
    if (!levels.some(function (x) { return x[0] === lv; })) lv = levels[0][0];
    if (lv === 'area') reg.areas.forEach(function (a) { var rr = []; a.zones.forEach(function (z) { z.tas.forEach(function (t) { rr.push(res.byTA[t.id]); }); }); units.push({ name: a.name, sub: 'AC ' + a.ac, rows: rr }); });
    else if (lv === 'zone') allZones(reg).forEach(function (z) { units.push({ name: z.name, sub: 'ZS ' + z.zs, rows: z.tas.map(function (t) { return res.byTA[t.id]; }) }); });
    else if (isDA(p)) { DATA.byId[S.zone].das.forEach(function (o) { units.push({ name: o.name, sub: 'Duka Assistant · ' + o.territory, rows: [res.byDA[o.id]] }); }); }
    else { var zz = DATA.byId[S.zone]; zz.tas.forEach(function (t) { var r = res.byTA[t.id]; units.push({ name: t.name, sub: t.territory, rows: [r], ta: t.id }); }); }
    h += '<div class="panel sec"><div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center"><h3>' + esc(p.title) + ' by level</h3><div class="pills" role="group" aria-label="Level">';
    levels.forEach(function (x) { h += '<button class="pill" data-act="rlevel" data-id="' + x[0] + '" aria-pressed="' + (lv === x[0]) + '">' + x[1] + '</button>'; });
    h += '</div></div>';
    if (lv === 'ta') {
      h += '<div class="ctl" style="margin:10px 0 0"><label for="zoneSel" class="lab">Zone</label><select id="zoneSel">';
      reg.areas.forEach(function (a) { h += '<optgroup label="' + esc(a.name) + '">'; a.zones.forEach(function (x) { h += '<option value="' + x.id + '"' + (x.id === S.zone ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }); h += '</optgroup>'; });
      h += '</select></div>';
    }
    h += '<div class="scroll" style="margin-top:10px"><table><thead><tr><th>Unit</th><th class="r">Asked</th><th class="r">Delivered</th><th style="min-width:130px">Against the ask</th><th class="r">Met</th><th class="r">Four weeks before</th><th class="r">Change</th><th>Verdict</th>' + (lv === 'ta' ? '<th></th>' : '') + '</tr></thead><tbody>';
    units.slice().sort(function (a, b) { return WP.reviewUnit(a.rows, [p], S.day).items[0].achieved - WP.reviewUnit(b.rows, [p], S.day).items[0].achieved; }).forEach(function (u) {
      var x = WP.reviewUnit(u.rows, [p], S.day).items[0], pct = Math.min(100, x.achieved * 100);
      h += '<tr><td>' + esc(u.name) + '<div class="muted" style="font-size:12px">' + esc(u.sub) + '</div></td><td class="r n">' + num(p.metric, x.need) + '</td><td class="r n">' + num(p.metric, x.gain) + '</td><td><div class="prog" style="margin:0"><div class="fill ' + (x.achieved >= 0.98 ? 'f-done' : x.achieved >= 0.8 ? 'f-slip' : 'f-behind') + '" style="width:' + pct + '%"></div></div><span class="sub">' + Math.round(x.achieved * 100) + '%</span></td><td class="r n">' + x.met + ' of ' + x.n + '</td><td class="r n">' + num(p.metric, x.prior) + '</td><td class="r n"><b>' + pctTxt(x.change) + '</b></td><td>' + rvChip(x.verdict) + '</td>' + (lv === 'ta' ? '<td><button class="btn small" data-act="plan" data-id="' + u.ta + '">Plan</button></td>' : '') + '</tr>';
    });
    h += '</tbody></table></div><p class="sub" style="margin-top:8px">“Asked” is the week’s requirement in ' + esc(m.unit) + '. “Met” counts TAs who delivered their full requirement. A unit is met when it delivered the ask and at least 80% of its TAs met it. “Improved” means more than 5% above the unit’s average for the four weeks before.</p></div>';
    return h;
  }

  /* week on week: how the priorities have gone over eight weeks, from the RM down to a TA */
  var hCache = {};
  function histFor() {
    var key = S.region + '|' + S.day + '|' + JSON.stringify(S.prios[S.region]);
    if (!hCache[key]) { var k = Object.keys(hCache); if (k.length > 12) hCache = {}; hCache[key] = WP.history(region(), S.prios[S.region], resDay(S.day), S.day); }
    return hCache[key];
  }
  function sparkWeeks(U) {
    return '<span class="spark wk" role="img" aria-label="Score by week: ' + U.weeks.map(function (w) { return Math.round(w.score); }).join(', ') + '">' +
      U.weeks.map(function (w) { return '<i class="' + fcls(statusFromScore(w.score)) + '" style="height:' + Math.max(8, (w.score - 50) * 2) + '%" title="' + w.label + ' ' + Math.round(w.score) + '"></i>'; }).join('') + '</span>';
  }
  function ptsTxt(x) { if (x == null) return '–'; var r = Math.round(x * 10) / 10; return r === 0 ? '0' : (r > 0 ? '+' : '−') + Math.abs(r).toFixed(1); }
  function lvCell(x) { return '<td class="r n">' + (x.n ? '<b>' + x.met + '</b> of ' + x.n : '<span class="muted">–</span>') + '</td>'; }
  function liftVerdict(x) {
    if (x.owner === 'DA' && x.prioIdx == null) return '<span class="chip c-on">Duka Assistants</span>';
    if (x.lift == null || x.weeksPrio < 2) return '<span class="chip c-on">Not enough weeks</span>';
    return x.lift >= 0.08 ? '<span class="chip c-done">Clear lift</span>' : x.lift >= 0.03 ? '<span class="chip c-ahead">Small lift</span>' : '<span class="chip c-slip">No clear effect</span>';
  }
  function viewTrend() {
    var reg = sreg(), l = prios(), H = histFor(), ids, name, sub, u = trendUnit(), crumbs;
    var area = null, zone = null;
    if (u && u.zones) area = u; else if (u && u.tas) { zone = u; area = DATA.byId[u.areaId]; } else if (u) { zone = DATA.byId[u.zoneId]; area = DATA.byId[u.areaId]; }
    if (!u) { ids = idsOf(allZones(reg)); name = reg.name; sub = 'RM ' + reg.rm; }
    else if (u.zones) { ids = idsOf(u.zones); name = u.name; sub = 'AC ' + u.ac; }
    else if (u.tas) { ids = u.tas.map(function (t) { return t.id; }); name = u.name; sub = 'ZS ' + u.zs; }
    else { ids = [u.id]; name = u.name + ' · ' + u.territory; sub = 'Territory ' + u.territory; }
    var cb = [];
    if (S.role === 'rm') cb.push('<button class="btn small" data-act="tuset" data-id=""' + (!u ? ' aria-current="true"' : '') + '>' + esc(reg.name) + '</button>');
    if (area && S.role !== 'zs' && S.role !== 'ta') cb.push('<button class="btn small" data-act="tuset" data-id="' + area.id + '"' + (u === area ? ' aria-current="true"' : '') + '>' + esc(area.name) + '</button>');
    if (zone && S.role !== 'ta') cb.push('<button class="btn small" data-act="tuset" data-id="' + zone.id + '"' + (u === zone ? ' aria-current="true"' : '') + '>' + esc(zone.name) + '</button>');
    if (u && !u.zones && !u.tas) cb.push('<span class="btn small" aria-current="true">' + esc(u.name) + '</span>');
    crumbs = '<nav class="crumbs" aria-label="Unit">' + cb.join(' › ') + '</nav>';
    var U = WP.histUnit(H, ids);
    var h = '<p class="sub" style="margin-bottom:12px">How each week’s priorities went, over eight weeks. The latest week is the live data' + (S.day < 5 ? ' as of ' + DAYS[S.day] : '') + '; <b>the seven weeks before it are generated for the prototype</b>. The real tool reads them from the weekly snapshots and the priorities each RM published.</p>';
    h += '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline"><div><h2 style="font-size:20px">' + esc(name) + '</h2><p class="sub">' + esc(sub) + ' · ' + ids.length + ' TA' + (ids.length > 1 ? 's' : '') + '</p></div>' + crumbs + '</div>';
    h += '<div class="tiles" style="margin-top:12px"><div class="tile"><div class="k">Average score, 8 weeks</div><div class="v">' + Math.round(U.avg) + '</div><div class="s">against the priorities set each week</div></div>' +
      '<div class="tile"><div class="k">Direction</div><div class="v">' + ptsTxt(U.trend) + ' pts</div><div class="s">last four weeks against the first four</div></div>' +
      '<div class="tile"><div class="k">Priorities delivered</div><div class="v">' + Math.round(U.hitRate * 100) + '%</div><div class="s">of weekly priorities where the unit reached 95% of the pace line</div></div>' +
      '<div class="tile"><div class="k">Lift when a priority</div><div class="v">' + (U.lift == null ? '–' : pctTxt(U.lift)) + '</div><div class="s">output in weeks a measure was a priority against weeks it was not</div></div></div>';
    h += '<div class="panel sec"><h3>Week by week</h3><div class="scroll" style="margin-top:8px"><table><thead><tr><th>Week of</th><th>Priorities set</th><th style="min-width:150px">Score</th><th class="r">Areas met</th><th class="r">Zones met</th><th class="r">Territories met</th><th class="r">Priorities delivered</th><th class="r">Against week before</th></tr></thead><tbody>';
    for (var i = U.weeks.length - 1; i >= 0; i--) {
      var w = U.weeks[i], prev = i > 0 ? U.weeks[i - 1].score : null;
      h += '<tr><td>' + w.label + (w.live ? ' <span class="chip c-on">' + (S.day < 5 ? 'in progress' : 'latest') + '</span>' : '') + '</td><td>' + w.prios.map(function (p) { return '<span class="wchip">' + pTag(p.metric) + esc(p.title) + ' ' + p.weight + '%</span>'; }).join(' ') + '</td>' +
        '<td><div class="prog" style="margin:0"><div class="fill ' + fcls(statusFromScore(w.score)) + '" style="width:' + w.score + '%"></div></div><span class="sub"><b>' + Math.round(w.score) + '</b></span></td>' + lvCell(w.lv.areas) + lvCell(w.lv.zones) + lvCell(w.lv.tas) + '<td class="r n">' + w.hits + ' of ' + w.n + '</td><td class="r n"><b>' + (prev == null ? '–' : ptsTxt(w.score - prev)) + '</b></td></tr>';
    }
    h += '</tbody></table></div><p class="sub" style="margin-top:8px"><b>Met</b> means the unit reached 95% of the pace line on every priority it is accountable for that week. A territory is not accountable for duka work, which has its own set for the Duka Assistants. A dash means that level is not part of this view.</p></div>';
    h += '<div class="panel sec"><h3>Pillars each week’s priorities targeted</h3><p class="sub" style="margin-bottom:8px">Each priority belongs to a pillar. A cell shows the unit’s score on the priorities that targeted that pillar in that week (weight-averaged if there were two). An empty cell means the pillar was not a priority that week. Output lift compares the pillar’s output in the weeks it was targeted against the weeks it was not.</p><div class="scroll"><table class="pgrid"><thead><tr><th>Pillar</th>' + U.weeks.map(function (w) { return '<th class="c">' + esc(w.label) + (w.live ? '<span class="live">now</span>' : '') + '</th>'; }).join('') + '<th class="r">Weeks targeted</th><th class="r">Avg score</th><th class="r">Output lift</th></tr></thead><tbody>';
    U.pillars.forEach(function (pl) {
      h += '<tr' + (pl.weeksPrio === 0 ? ' class="muted"' : '') + '><td><span class="ptag pt-' + pl.key + '">' + esc(WP.PILLARS[pl.key].label) + '</span>' + (pl.owner === 'DA' ? ' <span class="muted" style="font-size:12px">Duka Assistants</span>' : '') + '</td>';
      U.weeks.forEach(function (w) {
        var c = w.pil && w.pil[pl.key];
        h += c ? '<td class="c"><span class="pcell ' + fcls(statusFromScore(c.score)) + '" title="' + esc(c.titles.join(', ')) + ' · ' + c.weight + '%">' + Math.round(c.score) + '</span></td>' : '<td class="c"><span class="pnone">·</span></td>';
      });
      h += '<td class="r n">' + pl.weeksPrio + ' of 8</td><td class="r n">' + (pl.avgScore == null ? '–' : Math.round(pl.avgScore)) + '</td><td class="r n"><b>' + (pl.lift == null || pl.weeksPrio < 2 ? '–' : pctTxt(pl.lift)) + '</b></td></tr>';
    });
    h += '</tbody></table></div><div class="legend" style="margin-top:8px"><span><span class="sw" style="background:var(--s-on)"></span>On track 95+</span><span><span class="sw" style="background:var(--s-slip)"></span>Slipping 82+</span><span><span class="sw" style="background:var(--s-behind)"></span>Behind 60+</span><span><span class="sw" style="background:var(--s-crit)"></span>Critical</span></div></div>';
    var ls = U.lifts.slice().sort(function (a, b) { return b.weeksPrio - a.weeksPrio; }), good = ls.filter(function (x) { return x.lift != null && x.weeksPrio >= 2; });
    h += '<div class="panel sec"><h3>How effective has setting priorities been?</h3><p class="sub" style="margin-bottom:8px">For each measure, the unit’s output in the weeks it was a priority against the weeks it was not, as a share of that TA’s usual week.</p><div class="scroll"><table><thead><tr><th>Measure</th><th>Pillar</th><th class="r">Weeks as a priority</th><th class="r">Output when a priority</th><th class="r">Output when not</th><th class="r">Lift</th><th>Verdict</th></tr></thead><tbody>';
    ls.forEach(function (x) {
      h += '<tr' + (x.weeksPrio === 0 ? ' class="muted"' : '') + '><td>' + esc(x.title) + '</td><td>' + pTag(x.metric) + '</td><td class="r n">' + x.weeksPrio + ' of 8</td><td class="r n">' + (x.prioIdx == null ? '–' : Math.round(x.prioIdx * 100)) + '</td><td class="r n">' + (x.nonIdx == null ? '–' : Math.round(x.nonIdx * 100)) + '</td><td class="r n"><b>' + (x.lift == null ? '–' : pctTxt(x.lift)) + '</b></td><td>' + liftVerdict(x) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (good.length) h += '<p style="margin-top:10px">Across the ' + good.length + ' measures that were priorities for at least two weeks, output ran <b>' + pctTxt(U.lift) + '</b> higher in the weeks they were priorities.</p>';
    h += '<p class="note warn" style="margin-top:8px">A lift is not proof that the priority caused it. Season, weather and market days move output too, and the RM chooses what to prioritise. The real tool would flag the measures whose lift holds across many weeks, and the ones where it does not.</p></div>';

    if (S.role === 'ta') return h;
    var levels = S.role === 'rm' ? [['area', 'Areas'], ['zone', 'Zones'], ['ta', 'Territories']] : S.role === 'ac' ? [['zone', 'Zones'], ['ta', 'Territories']] : [['ta', 'Territories']], lv = S.tlevel || 'area', units = [];
    if (!levels.some(function (x) { return x[0] === lv; })) lv = levels[0][0];
    if (lv === 'area') reg.areas.forEach(function (a) { units.push({ n: a.name, s: 'AC ' + a.ac, ids: idsOf(a.zones), id: a.id }); });
    else if (lv === 'zone') allZones(reg).forEach(function (z) { units.push({ n: z.name, s: 'ZS ' + z.zs, ids: z.tas.map(function (t) { return t.id; }), id: z.id }); });
    else DATA.byId[S.zone].tas.forEach(function (t) { units.push({ n: t.territory, s: 'TA ' + t.name, ids: [t.id], id: t.id }); });
    h += '<div class="panel sec"><div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center"><h3>Every level, eight weeks</h3><div class="pills" role="group" aria-label="Level">';
    levels.forEach(function (x) { h += '<button class="pill" data-act="tlevel" data-id="' + x[0] + '" aria-pressed="' + (lv === x[0]) + '">' + x[1] + '</button>'; });
    h += '</div></div>';
    if (lv === 'ta') {
      h += '<div class="ctl" style="margin:10px 0 0"><label for="zoneSel" class="lab">Zone</label><select id="zoneSel">';
      reg.areas.forEach(function (a) { h += '<optgroup label="' + esc(a.name) + '">'; a.zones.forEach(function (x) { h += '<option value="' + x.id + '"' + (x.id === S.zone ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }); h += '</optgroup>'; });
      h += '</select></div>';
    }
    h += '<div class="scroll" style="margin-top:10px"><table><thead><tr><th>Unit</th><th>Score by week, oldest to latest</th><th class="r">Average</th><th class="r">Direction</th><th class="r">Priorities delivered</th><th class="r">Lift</th><th></th></tr></thead><tbody>';
    units.forEach(function (x) { x.U = WP.histUnit(H, x.ids); });
    units.sort(function (a, b) { return a.U.avg - b.U.avg; });
    units.forEach(function (x) {
      h += '<tr><td>' + esc(x.n) + '<div class="muted" style="font-size:12px">' + esc(x.s) + '</div></td><td>' + sparkWeeks(x.U) + '</td><td class="r n"><b>' + Math.round(x.U.avg) + '</b></td><td class="r n">' + ptsTxt(x.U.trend) + '</td><td class="r n">' + Math.round(x.U.hitRate * 100) + '%</td><td class="r n">' + (x.U.lift == null ? '–' : pctTxt(x.U.lift)) + '</td><td><button class="btn small" data-act="tuset" data-id="' + x.id + '">View</button></td></tr>';
    });
    h += '</tbody></table></div><p class="sub" style="margin-top:8px">Lowest average first. “View” shows that unit’s weeks and measures above.</p></div>';
    return h;
  }

  /* accepting or modifying the RM's priorities at area and zone level */
  function accKey(unitId) { return unitId + '|' + JSON.stringify(S.prios[DATA.byId[unitId].regionId].map(function (p) { return [p.id, p.metric, p.target, p.deadline, p.weight]; })); }
  function peekAcc(unitId) { return S.acc[accKey(unitId)] || null; }
  function getAcc(unitId) {
    var k = accKey(unitId);
    if (!S.acc[k]) S.acc[k] = { key: k, unit: unitId, status: 'proposed', weights: null, proposed: null, draft: null, reason: '', comment: '', log: [] };
    return S.acc[k];
  }
  function zoneWeights(regId) {
    var out = {}, reg = DATA.byId[regId];
    reg.areas.forEach(function (a) {
      var aa = peekAcc(a.id), aw = aa && aa.status === 'active' && aa.weights ? aa.weights : null;
      a.zones.forEach(function (z) { var za = peekAcc(z.id), zw = za && za.status === 'active' && za.weights ? za.weights : null; var w = zw || aw; if (w) out[z.id] = w; });
    });
    return out;
  }
  function pendingAcc(regId) {
    var out = [];
    Object.keys(S.acc).forEach(function (k) {
      var a = S.acc[k]; if (a.status !== 'pending') return;
      var u = DATA.byId[a.unit]; if (!u || u.regionId !== regId || accKey(a.unit) !== a.key) return;
      out.push(a);
    });
    return out;
  }
  function approverOf(unit) { var reg = DATA.byId[unit.regionId]; return unit.zones ? { who: 'RM ' + reg.rm, role: 'rm' } : { who: 'AC ' + DATA.byId[unit.areaId].ac, role: 'ac' }; }
  function ownerOf(unit) { return unit.zones ? 'AC ' + unit.ac : 'ZS ' + unit.zs; }
  function accStatusChip(unitId) {
    var a = peekAcc(unitId);
    if (!a || a.status === 'proposed') return '<span class="muted">Not accepted yet</span>';
    if (a.status === 'active') return '<span class="chip c-done">' + (a.weights ? 'Modified' : 'Accepted') + '</span>';
    return '<span class="chip ' + PLAN_LABEL[a.status][1] + '">' + PLAN_LABEL[a.status][0] + '</span>';
  }
  function accFlags(l, ids, w) {
    var out = [];
    if (sum(w, function (x) { return x; }) !== 100) out.push({ level: 'warn', text: 'The weights total ' + sum(w, function (x) { return x; }) + '%. They must total 100.' });
    l.forEach(function (p, i) {
      var d = w[i] - p.weight, sc = scoreAt(ids, p, S.day);
      if (Math.abs(d) > 20) out.push({ level: 'warn', text: p.title + ': a change of ' + Math.abs(d) + ' points is more than the 20 allowed.' });
      else if (d <= -5 && sc < 82) out.push({ level: 'warn', text: p.title + ': weight goes from ' + p.weight + '% to ' + w[i] + '%, while the unit scores ' + Math.round(sc) + ' on it.' });
      else if (d >= 5 && sc >= 95) out.push({ level: 'info', text: p.title + ': weight goes up to ' + w[i] + '%, but the unit is already on track (score ' + Math.round(sc) + ').' });
    });
    return out;
  }
  function unitAcceptHTML(unit) {
    var reg = region(), l = prios(), isArea = !!unit.zones, ids = isArea ? idsOf(unit.zones) : unit.tas.map(function (t) { return t.id; });
    var acc = getAcc(unit.id), ap = approverOf(unit), editing = S.accEdit === unit.id && !!acc.draft;
    var res = comp(S.region), rows = ids.map(function (id) { return res.byTA[id]; }), fo = WP.focusOf(rows, l);
    var cur = acc.status === 'active' && acc.weights ? acc.weights : l.map(function (p) { return p.weight; });
    var show = editing ? acc.draft : (acc.status === 'pending' || acc.status === 'returned') ? acc.proposed : cur;
    var st = editing ? 'Editing' : acc.status === 'proposed' ? 'Not accepted' : acc.status === 'active' ? (acc.weights ? 'Modified' : 'Accepted') : PLAN_LABEL[acc.status][0];
    var cls = editing ? 'c-slip' : acc.status === 'proposed' ? 'c-on' : PLAN_LABEL[acc.status][1];
    var msg, btns = '';
    if (editing) { msg = 'Shift the weights, say why, and send them to ' + ap.who + '. They only apply once approved.'; btns = '<button class="btn small" data-act="accCancel">Cancel</button> <button class="btn small" data-act="accReset">Reset to the RM’s weights</button>'; }
    else if (acc.status === 'proposed') { msg = 'The RM’s priorities apply as set until you accept them or change the time split.'; btns = '<button class="btn solid" data-act="accAccept">Accept as set</button> <button class="btn" data-act="accEdit">Modify the weights</button>'; }
    else if (acc.status === 'active') { msg = acc.weights ? 'Approved by ' + (acc.approvedBy || ap.who) + '. The TAs’ plans now use these weights.' : 'You accepted the priorities as the RM set them.'; btns = '<button class="btn" data-act="accEdit">Modify the weights</button>'; }
    else if (acc.status === 'pending') { msg = 'Sent to ' + ap.who + '. The RM’s weights still apply until it is approved.'; btns = '<button class="btn" data-act="accWithdraw">Withdraw and edit</button>'; }
    else { msg = ap.who + ' returned it' + (acc.comment ? ': “' + acc.comment + '”' : '.') + ' Change it and send it again, or accept the RM’s weights.'; btns = '<button class="btn solid" data-act="accEdit">Edit again</button> <button class="btn" data-act="accAccept">Accept as set</button>'; }
    var h = '<div class="panel"><h3>' + esc(unit.name) + ' · ' + esc(ownerOf(unit)) + '</h3><p class="sub" style="margin-bottom:10px">' + ids.length + ' TAs. Weights decide how a TA’s time is split between the priorities. You can move each weight by up to 20 points. Targets and deadlines stay the RM’s, and scores are still measured against the RM’s weights.</p>';
    h += '<div class="banner ' + (editing ? 'pending' : acc.status) + '"><div class="bhead"><span class="chip ' + cls + '">' + st + '</span><span class="sub">' + esc(msg) + '</span></div><div class="bact">' + btns + '</div></div>';
    if (S.accErr[unit.id]) h += '<p class="note warn" role="alert" style="margin-top:10px">' + esc(S.accErr[unit.id]) + '</p>';
    h += '<div class="scroll" style="margin-top:12px"><table><thead><tr><th>Priority</th><th class="r">RM’s weight</th><th>Where the unit stands</th><th class="r">Time the data calls for</th><th class="r">' + (editing ? 'Your weight' : (acc.status === 'pending' || acc.status === 'returned') ? 'Proposed' : 'Weight in use') + '</th></tr></thead><tbody>';
    l.forEach(function (p, i) {
      var sc = scoreAt(ids, p, S.day), sst = statusFromScore(sc), it = fo.items[i];
      h += '<tr><td>' + esc(p.title) + '<div class="muted" style="font-size:12px">' + esc(targetText(p)) + '</div></td><td class="r n">' + p.weight + '%</td><td><span class="chip ' + ST[sst][1] + '">' + SC_LABEL[sst] + '</span> <span class="num">' + Math.round(sc) + '</span></td><td class="r n">' + (it.share == null ? '–' : Math.round(it.share) + '%') + '</td><td class="r n">' +
        (editing ? '<input type="number" min="0" max="100" step="5" class="awin" data-aw="' + i + '" value="' + acc.draft[i] + '" aria-label="Weight for ' + esc(p.title) + '">' : '<b>' + show[i] + '%</b>' + (show[i] !== p.weight ? ' <span class="muted">(' + (show[i] > p.weight ? '+' : '−') + Math.abs(show[i] - p.weight) + ')</span>' : '')) + '</td></tr>';
    });
    var tot = sum(show, function (x) { return x; });
    h += '<tr><td><b>Total</b></td><td class="r n">100%</td><td></td><td></td><td class="r n"><b class="' + (tot === 100 ? '' : 'bad') + '">' + tot + '%</b></td></tr></tbody></table></div>';
    if (editing || acc.status === 'pending' || acc.status === 'returned') {
      var fl = accFlags(l, ids, show);
      h += fl.length ? '<ul class="flags">' + fl.map(function (f) { return '<li class="' + f.level + '">' + esc(f.text) + '</li>'; }).join('') + '</ul>' : '<p class="sub" style="margin-top:8px">No flags. The change fits where the unit stands.</p>';
    }
    if (editing) h += '<label class="field" style="margin-top:12px"><span>Why are you changing it?</span><textarea id="accReason" rows="3" placeholder="For example: most farmers here are already enrolled, so repayment needs the time.">' + esc(acc.reason) + '</textarea></label><div style="margin-top:10px"><button class="btn solid" data-act="accSend">Send to ' + esc(ap.who) + '</button></div>';
    else if (acc.reason && acc.status !== 'proposed') h += '<p class="sub" style="margin-top:10px"><b>Reason:</b> ' + esc(acc.reason) + '</p>';
    if (acc.log.length) h += '<p class="sub" style="margin-top:10px"><b>History:</b> ' + acc.log.map(esc).join(' · ') + '</p>';
    return h + '</div>';
  }
  function proposalsHTML(list, title, lead) {
    var l = prios(), h = '<div class="panel sec"><h3>' + esc(title) + '</h3><p class="sub" style="margin-bottom:8px">' + esc(lead) + '</p>';
    if (!list.length) return h + '<p class="empty">Nothing is waiting.</p></div>';
    list.forEach(function (a) {
      var u = DATA.byId[a.unit], ids = u.zones ? idsOf(u.zones) : u.tas.map(function (t) { return t.id; }), fl = accFlags(l, ids, a.proposed);
      h += '<div class="appr"><div class="ahead"><b>' + esc(u.name) + '</b><span class="muted">' + esc(ownerOf(u)) + '</span><span class="chip c-slip">Waiting</span></div><p><b>Reason:</b> ' + esc(a.reason) + '</p>' +
        '<p class="sub">' + l.map(function (p, i) { return esc(p.title) + ' ' + p.weight + '% → <b>' + a.proposed[i] + '%</b>'; }).join(' · ') + '</p>' +
        (fl.length ? '<ul class="flags">' + fl.map(function (f) { return '<li class="' + f.level + '">' + esc(f.text) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="arow"><button class="btn solid small" data-act="accApprove" data-id="' + a.unit + '">Approve</button><label class="sr" for="acm' + a.unit + '">Comment</label><input type="text" id="acm' + a.unit + '" placeholder="Comment (needed to return it)" data-acm="' + a.unit + '" value="' + esc(a.draftComment || '') + '"><button class="btn small" data-act="accReturn" data-id="' + a.unit + '">Return</button></div>' +
        (S.accErr[a.unit] ? '<p class="note warn" role="alert" style="margin-top:6px">' + esc(S.accErr[a.unit]) + '</p>' : '') + '</div>';
    });
    return h + '</div>';
  }
  function statusTable(reg, onlyArea) {
    var h = '<div class="panel sec"><h3>Acceptance across ' + (onlyArea ? esc(onlyArea.name) : 'the region') + '</h3><div class="scroll" style="margin-top:8px"><table><thead><tr><th>Unit</th><th>Owner</th><th>Status</th><th>Weights in use</th></tr></thead><tbody>';
    var l = prios();
    function row(u, ind) {
      var a = peekAcc(u.id), w = a && a.status === 'active' && a.weights ? a.weights : null;
      return '<tr><td class="' + ind + '">' + esc(u.name) + '</td><td>' + esc(ownerOf(u)) + '</td><td>' + accStatusChip(u.id) + '</td><td class="n">' + (w ? w.map(function (x) { return x + '%'; }).join(' / ') : '<span class="muted">' + l.map(function (p) { return p.weight + '%'; }).join(' / ') + ' (RM)</span>') + '</td></tr>';
    }
    reg.areas.forEach(function (a) { if (onlyArea && onlyArea.id !== a.id) return; if (!onlyArea) h += row(a, ''); a.zones.forEach(function (z) { h += row(z, onlyArea ? '' : 'ind1'); }); });
    return h + '</tbody></table></div><p class="sub" style="margin-top:8px">A zone’s own weights win over its area’s. Where neither changed anything, the RM’s weights apply.</p></div>';
  }
  function viewAccept() {
    var reg = region(), l = prios(), role = S.role;
    var area = sArea(), zone = sZone();
    var h = '<p class="sub" style="margin-bottom:12px">The RM publishes the week’s priorities. Each AC and ZS can accept them as set, or shift the weights for their own area or zone when local facts call for it. A change goes up one level for approval and only then reaches the TAs’ plans.</p>';
    h += '<div class="panel"><h3>Priorities for the week, set by ' + esc(reg.rm) + '</h3><div class="scroll" style="margin-top:8px"><table><thead><tr><th>Priority</th><th class="r">Weight</th><th>Target</th></tr></thead><tbody>';
    l.forEach(function (p) { h += '<tr><td>' + esc(p.title) + '</td><td class="r n">' + p.weight + '%</td><td>' + esc(targetText(p)) + '</td></tr>'; });
    h += '</tbody></table></div></div>';
    h += '<p class="note" style="margin-top:14px"><b>' + (role === 'rm' ? 'Regional Manager view.' : role === 'ac' ? 'Area Coordinator view.' : 'Zone Supervisor view.') + '</b> ' + (role === 'rm' ? 'You approve the time splits your ACs propose.' : role === 'ac' ? 'You accept or change the split for your area, and approve proposals from your ZSs.' : 'You accept or change the split for your zone. Your AC approves a change.') + ' Use “Viewing as” at the top to try another role.</p>';
    if (role === 'rm') {
      h += proposalsHTML(pendingAcc(S.region).filter(function (a) { return !!DATA.byId[a.unit].zones; }), 'Area proposals waiting for you', 'Each AC has asked to change the time split for their area.');
      h += statusTable(reg, null);
    } else if (role === 'ac') {
      h += unitAcceptHTML(area);
      h += proposalsHTML(pendingAcc(S.region).filter(function (a) { var u = DATA.byId[a.unit]; return !u.zones && u.areaId === area.id; }), 'Zone proposals waiting for you', 'Each ZS in ' + area.name + ' has asked to change the time split for their zone.');
      h += statusTable(reg, area);
    } else {
      h += unitAcceptHTML(zone);
    }
    return h;
  }

  /* data spec */
  function compactJSON(o) {
    return JSON.stringify(o, null, 1).replace(/\[\s*(-?\d[\d,\s]*?)\s*\]/g, function (m, a) { return '[' + a.replace(/\s+/g, ' ') + ']'; });
  }
  function viewData() {
    var tas = DATA.tas, ta = DATA.byId[S.ta] || tas[0], ng = sum(tas, function (t) { return t.groups.length; });
    var areas = sum(DATA.regions, function (r) { return r.areas.length; }), zones = sum(DATA.regions, function (r) { return sum(r.areas, function (a) { return a.zones.length; }); });
    var rows = [
      ['Org unit and person', 'region, area, zone, territory ids and names; person id, role, manager, language', 'Hierarchy file kept by HR or Operations', DATA.regions.length + ' regions, ' + areas + ' areas, ' + zones + ' zones, ' + tas.length + ' TAs'],
      ['Season targets', 'per TA: clients, groups, GLs to scope; KES due on the credit portfolio', 'Season plan and the Healthy Path sheet', 'e.g. ' + ta.name + ': ' + ta.season.clients + ' clients, ' + ta.season.groups + ' groups, ' + ta.season.scoped + ' GLs, KES ' + ta.due.toLocaleString('en-US') + ' due'],
      ['Standing at the start of the week', 'per TA and measure: units achieved so far this season', 'Enrolment and repayment trackers', 'e.g. ' + ta.name + ': ' + ta.A0.clients + ' clients, ' + ta.A0.groups + ' groups, KES ' + ta.A0.repaid.toLocaleString('en-US') + ' repaid'],
      ['Daily activity', 'date, TA, measure, units done', 'Activity forms in FieldPro, later FieldSmart', 'Mon to Sat for every TA and measure, ' + (tas.length * 6 * Object.keys(M).length).toLocaleString('en-US') + ' daily values'],
      ['Headroom', 'per TA: clients and groups still available to enrol; GLs still to scope', 'Farmer and group registry', 'e.g. ' + ta.name + ': ' + ta.pool.clients + ' clients, ' + ta.pool.groups + ' groups'],
      ['Groups in the portfolio', 'name, village, members, not yet enrolled, arrears KES, days since last contact', 'Group registry and repayment tracker', ng.toLocaleString('en-US') + ' groups, ' + ta.groups.length + ' per TA'],
      ['Pace line', 'share of the week’s requirement expected by each day, up to the deadline', 'Healthy Path sheet for percentage targets; a straight line to the deadline here', 'Mon 20%, Tue 40%, Wed 60%, Thu 80%, Fri 100% for a Friday deadline'],
      ['Priority (set by the RM)', 'measure, target, deadline, weight, optional daily norm, the RM’s sentence, lines for AC, ZS and TA', 'Entered by the RM', '5 regions, 3 priorities each'],
      ['Plan approval record', 'TA, day, status (recommended, active, waiting, returned), edited blocks, TA’s reason, ZS comment, who decided and when', 'Written by the tool, read by the ZS', 'Kept in the browser here; one record per TA per day and set of priorities'],
      ['Weekly history and results', 'per TA and measure: closed weekly totals for at least four weeks before, the week’s final result; which priorities were published each week, with dates', 'Weekly snapshot taken at Saturday close', 'Generated here: eight weeks, the latest is the live activity and the seven before it are made up'],
      ['Priority acceptance record', 'unit (area or zone), week, status (not accepted, accepted, modified, waiting, returned), proposed weights, reason, approver’s comment, who decided and when', 'Written by the tool, read by the next level up', 'Kept in the browser here; one record per area or zone per week'],
      ['Allocation (engine output)', 'unit, priority, requirement, expected by now, done, distance, assigned to finish, status, rule applied', 'Calculated', 'Every number on the cascade and TA week tabs']
    ];
    var h = '<p class="sub" style="margin-bottom:12px">The prototype runs on generated data with a fixed seed, so every number is repeatable. Each row says what the real tool would read and from where.</p><div class="panel"><div class="scroll"><table><thead><tr><th>Entity</th><th>Fields</th><th>Likely source</th><th>In this prototype</th></tr></thead><tbody>';
    rows.forEach(function (x) { h += '<tr><td><b>' + esc(x[0]) + '</b></td><td>' + esc(x[1]) + '</td><td>' + esc(x[2]) + '</td><td>' + esc(x[3]) + '</td></tr>'; });
    h += '</tbody></table></div></div><div class="grid2 sec"><div class="panel"><h3>How the numbers are made</h3><ul class="brief" style="margin-top:8px">' +
      '<li><b>Need</b><span>Target minus where the TA started the week. A % target is applied to that TA’s season target (or KES due for repayment).</span></li>' +
      '<li><b>Pace</b><span>Need times the pace line for today. Distance is done minus pace.</span></li>' +
      '<li><b>Status</b><span>Distance as a share of need: 8% or more above is ahead, within 8% on pace, to 25% below slipping, to 50% behind, beyond that critical.</span></li>' +
      '<li><b>Assigned</b><span>For trajectory priorities, the zone’s remaining gap is shared between TAs who are behind in proportion to headroom, capped by each TA’s own shortfall. Rate and per-person priorities are not shared.</span></li>' +
      '<li><b>Score</b><span>Sum of weight times progress against pace, capped at 100% per priority.</span></li>' +
      '<li><b>Time</b><span>38 productive hours a week (7 a day, 3 on Saturday). Budget is hours times weight. Hours per unit: client 0.6, group 4.5, GL scoped 1.1, KES 20,000 collected 1, HVC visit 0.5, module 1.5, call 0.25. Duka work takes no TA time. Duka Assistants (two per zone, a separate branch under the ZS) sell for cash and look after duka stock. They have their own priority set with its own weights: cash sales (KES 25,000 an hour), TMS validations (0.4 h each), inventory variances (1.25 h each), seed expiry risks (0.75 h each) and compliance visits (1 h each). Their plans go to the ZS for approval like a TA’s.</span></li></ul></div>' +
      '<div class="panel"><h3>Sample record: ' + esc(ta.name) + '</h3><p class="sub">One TA as the engine reads it.</p><pre><code>' + esc(compactJSON({ id: ta.id, name: ta.name, zone: ta.zoneId, territory: ta.territory, season: ta.season, due: ta.due, startOfWeek: ta.A0, headroom: ta.pool, dailyClients: ta.daily.clients, dailyRepaid: ta.daily.repaid, groups: ta.groups.slice(0, 2) })) + '</code></pre></div></div>' +
      '<p class="footer">All names, places and figures here are made up for the prototype. Regional priorities for Mount Kenya and Coast and Lower Western follow the style of the weekly notes; the other three regions are illustrative.</p>';
    return h;
  }

  /* ---------- simple views: one home per role, walked down Region > Area > Zone > Territory ---------- */
  function sDa() { var d = S.sDa && DATA.byId[S.sDa]; return d && d.role === 'DA' && d.regionId === S.region ? d : allZones(region())[0].das[0]; }
  function levelOf(u) { return u.areas ? 'Region' : u.zones ? 'Area' : u.tas ? 'Zone' : u.role === 'DA' ? 'Duka Assistant' : 'Territory'; }
  function unitName(u) { return u.areas || u.zones || u.tas ? u.name : u.role === 'DA' ? u.name : u.territory; }
  function personOf(u) { return u.areas ? 'RM ' + u.rm : u.zones ? 'AC ' + u.ac : u.tas ? 'ZS ' + u.zs : u.role === 'DA' ? 'Duka Assistant, ' + DATA.byId[u.zoneId].name : 'TA ' + u.name; }
  function homeUnit() { return S.role === 'ac' ? sArea() : S.role === 'zs' ? sZone() : S.role === 'ta' ? sTa() : S.role === 'da' ? sDa() : region(); }
  function pathOf(u) {
    if (u.areas) return [u];
    if (u.zones) return [DATA.byId[u.regionId], u];
    if (u.tas) return [DATA.byId[u.regionId], DATA.byId[u.areaId], u];
    return [DATA.byId[u.regionId], DATA.byId[u.areaId], DATA.byId[u.zoneId], u];
  }
  function curUnit() {
    var h = homeUnit(), u = S.at && DATA.byId[S.at];
    if (u && u.regionId !== undefined || u && u.areas) { if (pathOf(u).some(function (x) { return x.id === h.id; })) return u; }
    return h;
  }
  function idsUnder(u) {
    if (u.role === 'DA') return [];
    if (u.areas) return idsOf(allZones(u));
    if (u.zones) return idsOf(u.zones);
    if (u.tas) return idsOf([u]);
    return [u.id];
  }
  /* two workforces, two scores: TAs (credit sales and extension) on the TA set, Duka Assistants (cash sales) on the duka set */
  function scoreOf(u) {
    if (u.role === 'DA') return comp(S.region).byDA[u.id].score;
    return unitScore(idsUnder(u), S.day);
  }
  function dasUnder(u) { var z = u.areas ? allZones(u) : u.zones ? u.zones : u.tas ? [u] : []; var o = []; z.forEach(function (x) { x.das.forEach(function (d) { o.push(d); }); }); return o; }
  function dukaScoreOf(u) {
    if (u.role === 'DA') return comp(S.region).byDA[u.id].score;
    var d = dasUnder(u), c = comp(S.region); if (!d.length || !dprios().length) return null;
    return sum(d, function (x) { return c.byDA[x.id].score; }) / d.length;
  }
  function prioScore(u, p) {
    if (u.role === 'DA') return isDA(p) ? comp(S.region).byDA[u.id].calcs[p.id].paceProg * 100 : null;
    if (isDA(p)) { var d = dasUnder(u), c = comp(S.region); return d.length ? sum(d, function (x) { return c.byDA[x.id].calcs[p.id].paceProg; }) / d.length * 100 : null; }
    return scoreAt(idsUnder(u), p, S.day);
  }
  function childrenOf(u) {
    if (u.areas) return u.areas;
    if (u.zones) return u.zones;
    if (u.tas) return u.tas.concat(dprios().length ? u.das : []);
    return [];
  }
  function weakest(u, set) {
    var w = null, ws = 1e9;
    (set || (u.role === 'DA' ? dprios() : prios())).forEach(function (p) { var v = prioScore(u, p); if (v != null && v < ws) { ws = v; w = p; } });
    return w ? { p: w, v: ws } : null;
  }
  function amt(metric, x) { return M[metric].unit === 'KES' ? withUnit(metric, x) : Math.round(x).toLocaleString('en-GB') + ' ' + (Math.round(x) === 1 ? M[metric].unit.replace(/s$/, '') : M[metric].unit); }
  function stateLine(v) { var st = statusFromScore(v); return '<span class="chip ' + ST[st][1] + '">' + SC_LABEL[st] + '</span>'; }
  function upTo() { return 'up to ' + DAYS_LONG[S.day]; }
  var DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function sayOf(v) { var st = statusFromScore(v); return st === 'on' ? 'on track' : st === 'slip' ? 'a little behind' : st === 'behind' ? 'behind' : 'well behind'; }
  function scoreBox(label, v) { return '<div class="ou-score"><span class="sbl">' + label + '</span><span class="scn num">' + Math.round(v) + '</span>' + stateLine(v) + '</div>'; }
  function unitCard(u) {
    var unitLv = !!(u.areas || u.zones || u.tas), v = scoreOf(u), dv = unitLv ? dukaScoreOf(u) : null, w = weakest(u), dw = unitLv && dv != null ? weakest(u, dprios()) : null;
    var who = u.role === 'DA' ? 'Duka work is ' : unitLv ? 'TA work is ' : 'This territory is ';
    var say = who + sayOf(v) + ', ' + upTo() + '.' + (w && w.v < 95 ? ' Most help needed on <b>' + esc(w.p.title) + '</b>.' : '');
    if (dv != null) say += '<br>Duka work is ' + sayOf(dv) + '.' + (dw && dw.v < 95 ? ' Most help needed on <b>' + esc(dw.p.title) + '</b>.' : '');
    var h = '<section class="ou" aria-label="' + esc(levelOf(u)) + '"><div class="ou-main"><div class="ou-id"><span class="ou-lv">' + esc(levelOf(u)) + '</span><h2>' + esc(unitName(u)) + '</h2>' +
      '<div class="ou-meta"><span><b>' + esc(personOf(u)) + '</b></span></div></div><div class="ou-scores">' +
      scoreBox(u.role === 'DA' ? 'Duka' : 'TAs', v) + (dv != null ? scoreBox('Duka', dv) : '') + '</div></div>' +
      '<p class="answer">' + say + '</p></section>';
    return h;
  }
  function prioLine(u, p) {
    var v = prioScore(u, p), m = M[p.metric];
    if (v == null) {
      var z = DATA.byId[u.zoneId] || u;
      return '<li class="pl na"><div class="pl-t">' + pTag(p.metric) + '<b>' + esc(p.title) + '</b></div><p class="pl-s">Done by the Duka Assistants in ' + esc(z.name) + ': ' + z.das.map(function (o) { return esc(o.name); }).join(' and ') + '. Not part of this territory’s score.</p></li>';
    }
    var rows = u.role === 'DA' ? [comp(S.region).byDA[u.id]] : idsUnder(u).map(function (id) { return comp(S.region).byTA[id]; });
    var a = WP.aggregate(rows, p), st = statusFromScore(v);
    var who = '';
    var left = rows.length === 1 ? Math.max(0, a.need - a.gain) : a.ask, by = ' by ' + DAYS_LONG[p.deadline];
    var sofar = (a.gain > a.need ? 'Done so far: ' + amt(p.metric, a.gain) + ', more than the ' + amt(p.metric, a.need) + ' needed in total.' : 'Done so far: ' + amt(p.metric, a.gain) + ' of ' + amt(p.metric, a.need) + '.') +
      (left <= 0.5 ? ' Nothing more is needed.' : rows.length === 1 ? ' Still to do' + by + ': ' + amt(p.metric, left) + '.' : ' Still owed' + by + ' by those behind: ' + amt(p.metric, left) + '.');
    return '<li class="pl"><div class="pl-t">' + pTag(p.metric) + '<b>' + esc(p.title) + '</b><span class="pl-n num">' + Math.round(v) + '</span>' + stateLine(v) + '</div>' +
      '<div class="oup-bar"><i class="' + fcls(st) + '" style="width:' + Math.min(100, v) + '%"></i></div>' +
      '<p class="pl-s">' + sofar + who + '</p>' +
      '<details><summary>How is this worked out?</summary><p>' + esc(p.text) + '</p><p>Target: ' + esc(targetText(p)) + '. Weight ' + p.weight + '% of the ' + (isDA(p) ? 'duka' : 'TA') + ' set.</p>' +
      '<p>By ' + DAYS_LONG[S.day] + ' about ' + amt(p.metric, a.expected) + ' should be done to keep pace for the deadline. The number (' + Math.round(v) + ') is how much of that is done, out of 100.</p></details></li>';
  }
  function prioList(u) {
    var ta = '<section class="sec"><h2>' + (u.role === 'DA' ? 'Duka priorities' : 'TA priorities') + '</h2><p class="sub">' + (u.role === 'DA' ? 'Cash sales and stock at the dukas. Weights total 100.' : 'Credit sales and extension. Weights total 100.') + '</p><ul class="plist2">' +
      (u.role === 'DA' ? dprios() : prios()).map(function (p) { return prioLine(u, p); }).join('') + '</ul></section>';
    if (u.role === 'DA' || !(u.areas || u.zones || u.tas) || !dprios().length) return ta;
    return ta + '<section class="sec"><h2>Duka priorities</h2><p class="sub">Done by the Duka Assistants: cash sales and stock at the dukas. A separate set with its own weights.</p><ul class="plist2">' + dprios().map(function (p) { return prioLine(u, p); }).join('') + '</ul></section>';
  }
  function childRow(c) {
    var v = scoreOf(c), w = weakest(c), dv = c.areas || c.zones || c.tas ? dukaScoreOf(c) : null;
    var two = dv != null ? '<span class="cr-two"><span><small>TAs</small> <b class="num">' + Math.round(v) + '</b></span><span><small>Duka</small> <b class="num">' + Math.round(dv) + '</b></span></span>' + stateLine(Math.min(v, dv)) : '<span class="cr-s num">' + Math.round(v) + '</span>' + stateLine(v);
    return '<li><button class="crow" data-act="goto" data-id="' + c.id + '"><span class="cr-n"><b>' + esc(unitName(c)) + '</b><small>' + esc(personOf(c)) + (w && w.v < 82 ? ' · most behind on ' + esc(w.p.title) : '') + '</small></span>' + two + '<span class="cr-go" aria-hidden="true">›</span></button></li>';
  }
  function childList(u) {
    var kids = childrenOf(u); if (!kids.length) return '';
    var terr = kids.filter(function (c) { return c.role !== 'DA'; }), das = kids.filter(function (c) { return c.role === 'DA'; });
    var lv = u.areas ? 'Areas' : u.zones ? 'Zones' : 'Territories';
    var h = '<section class="sec"><h2>' + lv + ' in ' + esc(u.name) + '</h2><p class="sub">Lowest first. Tap one to open it.</p><ul class="clist">' +
      terr.slice().sort(function (a, b) { var da = dukaScoreOf(a), db = dukaScoreOf(b); return Math.min(scoreOf(a), da == null ? 1e9 : da) - Math.min(scoreOf(b), db == null ? 1e9 : db); }).map(childRow).join('') + '</ul>';
    if (das.length) h += '<h3 class="sec2">Duka Assistants in ' + esc(u.name) + '</h3><ul class="clist">' + das.slice().sort(function (a, b) { return scoreOf(a) - scoreOf(b); }).map(childRow).join('') + '</ul>';
    return h + '</section>';
  }
  function waitingHTML() {
    if (S.role === 'ta' || S.role === 'da') return '';
    var np = S.role === 'zs' ? pendingIn(S.region, sZone().id).length : pendingIn(S.region).length, na = waitingAcc().length, out = [];
    if (np) out.push('<button class="btn solid" data-tab="team">' + np + (np === 1 ? ' plan' : ' plans') + ' to approve</button>');
    if (na) out.push('<button class="btn solid" data-tab="priorities">' + na + (na === 1 ? ' weight change' : ' weight changes') + ' to approve</button>');
    return out.length ? '<div class="waiting"><b>Waiting for you</b>' + out.join('') + '</div>' : '';
  }
  function waitingAcc() {
    return pendingAcc(S.region).filter(function (a) { var u = DATA.byId[a.unit]; return S.role === 'rm' ? !!u.zones : S.role === 'ac' ? !u.zones && u.areaId === sArea().id : false; });
  }
  function dayBlocks(days) {
    if (!days.length) return '<p class="empty">The week is over, so there is nothing left to plan.</p>';
    return days.map(function (dd, i) {
      var inner = dd.blocks.length ? dd.blocks.map(function (b) { return '<li><span class="bh num">' + fmtH(b.hours) + ' h</span><span>' + esc(b.text) + '</span></li>'; }).join('') : '<li class="muted">Nothing planned.</li>';
      return '<details class="dayd"' + (i === 0 ? ' open' : '') + '><summary><b>' + DAYS_LONG[dd.i] + '</b> <span class="muted">' + dd.date + ' · ' + fmtH(dd.used) + ' of ' + dd.cap + ' h</span></summary><ul class="blocks">' + inner + '</ul></details>';
    }).join('');
  }
  function territoryHome(t) {
    S.ta = t.id; S.zone = t.zoneId;
    var r = comp(S.region).byTA[t.id], pl = peekPlan(t.id), days = pl ? effDays(pl, r) : r.plan.days, mine = S.role === 'ta';
    var h = unitCard(t) + prioList(t);
    h += '<section class="sec"><h2>' + (mine ? 'Your plan' : 'The plan') + ' for the rest of the week</h2><div class="planhd">' + planChip(t.id) +
      (mine ? (!pl || pl.status === 'proposed' ? ' <button class="btn solid" data-act="accept">Accept this plan</button>' : '') + ' <button class="btn" data-tab="week">Change the plan</button>' : ' <button class="btn" data-tab="week">Open the full plan</button>') + '</div>' + dayBlocks(days) + '</section>';
    return h;
  }
  function daHome(o) {
    S.ta = o.id; S.zone = o.zoneId;
    var r = comp(S.region).byDA[o.id], h = unitCard(o) + prioList(o);
    h += S.role === 'da' ? planSection(r, dprios()) : '<section class="sec"><h2>The plan for the rest of the week</h2><div class="planhd">' + planChip(o.id) + '</div>' + dayBlocks(effDays(peekPlan(o.id) || {}, r)) + '</section>';
    h += '<section class="sec"><h2>' + (S.role === 'da' ? 'Your dukas' : 'Dukas') + '</h2><ul class="clist">' + o.dukas.map(function (d) { return '<li class="crow static"><span class="cr-n"><b>' + esc(d.name) + '</b><small>' + esc(d.village) + '</small></span></li>'; }).join('') + '</ul></section>';
    return h;
  }
  function viewHome() {
    if (S.wk !== 1) return offWeek();
    var u = curUnit();
    if (u.role === 'DA') return daHome(u);
    if (!u.areas && !u.zones && !u.tas) return territoryHome(u);
    return unitCard(u) + waitingHTML() + prioList(u) + childList(u);
  }
  function dukaSetHTML() {
    var l = dprios(), ro = S.role !== 'rm', tot = sum(l, function (p) { return p.weight; });
    var h = '<section class="panel sec dset"><h2>Duka priorities</h2><p class="sub" style="margin:4px 0 12px">For the Duka Assistants, a separate workforce that sells for cash at the dukas. Its weights total 100 on their own and split a Duka Assistant’s time. ' + (ro ? 'Set by the RM.' : 'Change a measure, target, deadline or weight.') + '</p>';
    h += '<div class="scroll"><table><thead><tr><th>Priority</th><th>Measure</th><th class="r">Target each</th><th>By</th><th class="r">Weight</th>' + (ro ? '' : '<th></th>') + '</tr></thead><tbody>';
    l.forEach(function (p, i) {
      if (ro) { h += '<tr><td>' + pTag(p.metric) + esc(p.title) + '<div class="muted" style="font-size:13px">' + esc(p.text) + '</div></td><td>' + esc(M[p.metric].label) + '</td><td class="r n">' + amt(p.metric, p.target) + '</td><td>' + DAYS[p.deadline] + '</td><td class="r n">' + p.weight + '%</td></tr>'; return; }
      h += '<tr><td><input type="text" data-df="title" data-di="' + i + '" value="' + esc(p.title) + '" aria-label="Priority name"></td><td><select data-df="metric" data-di="' + i + '" aria-label="Measure">' +
        Object.keys(M).filter(function (k) { return M[k].owner === 'DA'; }).map(function (k) { return '<option value="' + k + '"' + (k === p.metric ? ' selected' : '') + '>' + esc(M[k].label) + '</option>'; }).join('') + '</select></td>' +
        '<td class="r"><input type="number" min="0" data-df="target" data-di="' + i + '" value="' + p.target + '" aria-label="Target each" style="width:110px"></td>' +
        '<td><select data-df="deadline" data-di="' + i + '" aria-label="Deadline">' + DAYS.map(function (d, j) { return '<option value="' + j + '"' + (j === p.deadline ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></td>' +
        '<td class="r"><input type="number" min="0" max="100" data-df="weight" data-di="' + i + '" value="' + p.weight + '" aria-label="Weight" style="width:70px"></td><td><button class="btn small" data-act="dremove" data-i="' + i + '"' + (l.length <= 1 ? ' disabled' : '') + '>Remove</button></td></tr>';
    });
    h += '</tbody><tfoot><tr><td colspan="4"><b>Total</b></td><td class="r n"><span class="total ' + (tot === 100 ? 'good' : 'bad') + '">' + tot + '%</span></td>' + (ro ? '' : '<td></td>') + '</tr></tfoot></table></div>';
    if (!ro) h += '<div class="planhd" style="margin-top:10px">' + (tot !== 100 ? '<span class="note warn">The duka weights total ' + tot + '%. They must total 100.</span>' : '') + '<button class="btn small" data-act="dbalance">Balance to 100</button><button class="btn small" data-act="dadd"' + (l.length >= 5 ? ' disabled' : '') + '>Add a duka priority</button><button class="btn small" data-act="dreset">Reset</button></div>';
    return h + '</section>';
  }
  function viewPrioMerged() {
    if (S.role === 'rm') {
      var l = waitingAcc();
      return (l.length ? proposalsHTML(l, 'Weight changes waiting for you', 'An AC has asked to change the time split for their area.') : '') + viewPriorities() + dukaSetHTML() +
        '<details class="sec"><summary>Who has accepted the priorities</summary>' + statusTable(region(), null) + '</details>';
    }
    if (S.role === 'ac' || S.role === 'zs') {
      var unit = S.role === 'ac' ? sArea() : sZone(), h = unitAcceptHTML(unit);
      if (S.role === 'ac') { var zl = waitingAcc(); if (zl.length) h += proposalsHTML(zl, 'Weight changes waiting for you', 'A ZS in ' + unit.name + ' has asked to change the time split for their zone.'); }
      return h + '<details class="sec"><summary>Each TA priority in full</summary>' + viewPriorities() + '</details>' + dukaSetHTML();
    }
    return S.role === 'da' ? dukaSetHTML() : viewPriorities();
  }

  var VIEWS = { home: viewHome, overview: viewOverview, priorities: viewPrioMerged, cascade: viewCascade, review: viewReview, trend: viewTrend, accept: viewAccept, team: viewTeam, week: viewWeek, data: viewData };


  /* ---------- shell ---------- */
  function shell() {
    var h = '<header class="hd"><div class="hd-row"><div class="brand"><img class="logo" src="../tupande-farm-planner/assets/tupande-by-oaf-horizontal.png" alt="Tupande by One Acre Fund" width="900" height="267"><div class="prod"><b>Work Planning</b><small>Prototype · made-up data</small></div></div>' +
      '<div class="ctl who"><label class="lab" for="roleSel">Viewing as</label><select id="roleSel">' + ROLES.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select><select id="whoSel" aria-label="Which one"></select></div></div>' +
      '<div class="hd-row hd-sub"><nav class="path" id="path" aria-label="Where you are"></nav><span class="bsp"></span><div class="wkline"><span id="wkTxt"></span> <button class="linkbtn" data-act="wkToggle" aria-expanded="false" id="wkBtn">Change</button></div></div>' +
      '<div class="hd-row hd-sub" id="wkRow" hidden><div class="ctl"><label class="lab" for="wkSel">Week of</label><select id="wkSel">';
    WEEKS.forEach(function (w, i) { h += '<option value="' + i + '">' + w[0] + ' (' + w[1] + ')</option>'; });
    h += '</select></div><div class="ctl" id="dayCtl"><span class="lab" id="dayLab">Up to</span><div class="seg" role="group" aria-labelledby="dayLab">';
    DAYS.forEach(function (d, i) { h += '<button data-day="' + i + '" aria-pressed="false">' + d + '</button>'; });
    h += '</div></div></div></header>' +
      '<div class="wrap"><nav class="tabs" id="tabs" aria-label="Views"></nav><main id="view"></main></div>';
    $('app').innerHTML = h;
  }

  function tabsHTML() {
    var allowed = ROLE_TABS[S.role], np = S.role === 'zs' ? pendingIn(S.region, sZone().id).length : pendingIn(S.region).length, na = waitingAcc().length, h = '<div class="tgb">';
    MAIN_TABS.forEach(function (t) {
      if (allowed.indexOf(t) < 0) return;
      var n = t === 'team' ? np : t === 'priorities' ? na : 0;
      h += '<button data-tab="' + t + '" aria-selected="' + (t === S.tab) + '">' + esc(tabLabel(t)) + (n ? ' <span class="badge" aria-label="' + n + ' waiting">' + n + '</span>' : '') + '</button>';
    });
    var more = allowed.filter(function (t) { return MAIN_TABS.indexOf(t) < 0; });
    if (more.length) {
      var inMore = more.indexOf(S.tab) >= 0;
      h += '<details class="more"' + (inMore ? ' open' : '') + '><summary' + (inMore ? ' class="on"' : '') + '>More' + (inMore ? ': ' + esc(tabLabel(S.tab)) : '') + '</summary><div class="more-m">' +
        more.map(function (t) { return '<button data-tab="' + t + '" aria-selected="' + (t === S.tab) + '">' + esc(tabLabel(t)) + '</button>'; }).join('') + '</div></details>';
    }
    return h + '</div>';
  }
  function whoOptions() {
    var h = '';
    if (S.role === 'rm') return DATA.regions.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('');
    DATA.regions.forEach(function (rg) {
      if (S.role === 'ac') { h += '<optgroup label="' + esc(rg.name) + '">' + rg.areas.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + ' · ' + esc(a.ac) + '</option>'; }).join('') + '</optgroup>'; return; }
      rg.areas.forEach(function (a) {
        if (S.role === 'zs') { h += '<optgroup label="' + esc(rg.name + ' › ' + a.name) + '">' + a.zones.map(function (z) { return '<option value="' + z.id + '">' + esc(z.name) + ' · ' + esc(z.zs) + '</option>'; }).join('') + '</optgroup>'; return; }
        a.zones.forEach(function (z) {
          var list = S.role === 'da' ? z.das : z.tas;
          h += '<optgroup label="' + esc(rg.name + ' › ' + z.name) + '">' + list.map(function (t) { return '<option value="' + t.id + '">' + esc(S.role === 'da' ? t.name : t.territory + ' · ' + t.name) + '</option>'; }).join('') + '</optgroup>';
        });
      });
    });
    return h;
  }
  function pathHTML() {
    var u = curUnit(), home = homeUnit(), p = pathOf(u), below = false;
    return p.map(function (x, i) {
      var lv = levelOf(x), cur = x.id === u.id, mineOrBelow = below || x.id === home.id;
      if (x.id === home.id) below = true;
      var name = esc(unitName(x));
      var body = '<small>' + esc(lv) + '</small>' + (cur ? '<b aria-current="page">' + name + '</b>' : mineOrBelow ? '<button class="linkbtn" data-act="goto" data-id="' + x.id + '">' + name + '</button>' : '<span>' + name + '</span>');
      return (i ? '<span class="sep" aria-hidden="true">›</span>' : '') + '<span class="crumb">' + body + '</span>';
    }).join('');
  }

  function render() {
    ensure();
    $('roleSel').value = S.role;
    var ws = $('whoSel'); ws.innerHTML = whoOptions();
    ws.value = S.role === 'rm' ? S.region : S.role === 'ac' ? S.sArea : S.role === 'zs' ? S.sZone : S.role === 'ta' ? S.sTa : S.sDa;
    $('wkSel').value = String(S.wk); $('dayCtl').hidden = S.wk !== 1;
    $('wkRow').hidden = !S.showWk; $('wkBtn').setAttribute('aria-expanded', String(S.showWk)); $('wkBtn').textContent = S.showWk ? 'Done' : 'Change';
    $('wkTxt').innerHTML = 'Week of <b>' + WEEKS[S.wk][0] + '</b>' + (S.wk === 1 ? ', ' + upTo() : ' · ' + WEEKS[S.wk][1]);
    document.querySelectorAll('[data-day]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.day === S.day)); });
    $('path').innerHTML = pathHTML();
    $('tabs').innerHTML = tabsHTML();
    $('view').innerHTML = (S.wk !== 1 && S.tab !== 'priorities' && S.tab !== 'data' && S.tab !== 'home') ? offWeek() : VIEWS[S.tab]();
    try { history.replaceState(null, '', '#' + S.tab); } catch (e) { /* hash is a convenience only */ }
  }

  function leaveEdit() {
    if (!S.edit) return;
    var pl = S.plans[S.editKey];
    if (pl && pl.snap && pl.status !== 'proposed') { pl.days = pl.snap.days; pl.reason = pl.snap.reason; }
    if (pl) pl.snap = null;
    S.edit = false;
  }
  function startEdit(taId) {
    var r = rowOf(taId), pl = getPlan(taId);
    if (!pl.days) pl.days = cloneDays(r.plan.days);
    pl.snap = { days: JSON.parse(JSON.stringify(pl.days)), reason: pl.reason };
    S.edit = true; S.editTa = taId; S.editKey = pl.key; S.err[taId] = '';
  }
  function offWeek() {
    return '<div class="panel"><h3>No performance data for the week of ' + WEEKS[S.wk][0] + '</h3><p class="sub" style="margin:6px 0 12px">' + (S.wk === 0 ? 'The prototype holds activity for the week of 9 November only. In the real tool, last week’s numbers and plans would be here, read only.' : 'No activity has been recorded yet this week, so there are no results or plans. Plans are generated from the priorities the RM publishes.') + '</p><button class="btn solid small" data-act="thisWeek">Go to this week</button> <button class="btn small" data-act="goPriosWk">See the priorities for this week</button></div>';
  }
  function setTab(t) { leaveEdit(); S.tab = t; render(); window.scrollTo(0, 0); }

  function defaultTarget(k) { return { clients: 8, groups: 8, scoped: 70, repaid: 66, hvc: 20, training: 3, glcalls: 10, duka: 10, dsales: 150000, tms: 18, invvar: 5, expiry: 6 }[k]; }

  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) return setTab(b.dataset.tab);
    if (b.dataset.day !== undefined) { leaveEdit(); S.day = +b.dataset.day; return render(); }
    var act = b.dataset.act; if (!act) return;
    if (act === 'goto') { leaveEdit(); S.at = b.dataset.id; var gu = DATA.byId[S.at]; if (gu.zoneId) S.zone = gu.zoneId; if (gu.tas) S.zone = gu.id; S.tab = 'home'; render(); window.scrollTo(0, 0); return; }
    if (act === 'wkToggle') { S.showWk = !S.showWk; return render(); }
    var dl0 = dprios();
    if (act === 'dremove') { dl0.splice(+b.dataset.i, 1); return render(); }
    if (act === 'dbalance') { var dt = sum(dl0, function (p) { return p.weight; }); dl0.forEach(function (p) { p.weight = dt ? Math.round(p.weight / dt * 100) : Math.round(100 / dl0.length); }); dl0[0].weight += 100 - sum(dl0, function (p) { return p.weight; }); return render(); }
    if (act === 'dadd') { var used = dl0.map(function (p) { return p.metric; }), nk = Object.keys(M).filter(function (k) { return M[k].owner === 'DA' && used.indexOf(k) < 0; })[0] || 'duka'; S.uid++; dl0.push({ id: 'dn' + S.uid, metric: nk, title: M[nk].label, text: 'New duka priority for the week.', target: defaultTarget(nk), deadline: 4, weight: 0, norm: 0, aud: {} }); return render(); }
    if (act === 'dreset') { S.dprios[S.region] = WP.defaultDukaPriorities(S.region); return render(); }
    if (act === 'goRegion') { S.region = b.dataset.id; S.zone = null; S.ta = null; S.prio = null; return setTab('cascade'); }
    if (act === 'goPrios') { S.region = b.dataset.id; S.zone = null; S.ta = null; S.prio = null; return setTab('priorities'); }
    if (act === 'goAccept') return setTab('accept');
    if (act === 'goWeek') return setTab('week');
    if (act === 'prio') { S.prio = b.dataset.id; return render(); }
    if (act === 'toggle') { var id = b.dataset.id, def = id === S.region || id.indexOf('-a') > -1 && id.indexOf('-z') < 0 || (S.role === 'zs' && id === sZone().id); S.open[id] = !isOpen(id, def); return render(); }
    if (act === 'expandAll') { allZones(region()).forEach(function (z) { S.open[z.id] = true; S.open[z.areaId] = true; }); S.open[S.region] = true; return render(); }
    if (act === 'collapseAll') { allZones(region()).forEach(function (z) { S.open[z.id] = false; S.open[z.areaId] = true; }); return render(); }
    if (act === 'plan') { leaveEdit(); var t = DATA.byId[b.dataset.id]; S.region = t.regionId; S.ta = t.id; S.zone = t.zoneId; S.prio = null; return setTab('week'); }
    if (act === 'thisWeek') { S.wk = 1; return render(); }
    if (act === 'goPriosWk') { S.tab = 'priorities'; return render(); }
    if (act === 'copyCur') { S.wkPrios[S.region + '|2'] = JSON.parse(JSON.stringify(S.prios[S.region])); S.wkPub[S.region + '|2'] = false; return render(); }
    if (act === 'copyTo') { S.wkPrios[S.region + '|2'] = JSON.parse(JSON.stringify(prios())); S.wkPub[S.region + '|2'] = false; S.wk = 2; return render(); }
    if (act === 'publish') { S.wkPub[wkKey()] = true; return render(); }
    if (act === 'tuset') { S.tu = b.dataset.id || null; if (S.tu && DATA.byId[S.tu] && !DATA.byId[S.tu].zones && !DATA.byId[S.tu].tas) S.zone = DATA.byId[S.tu].zoneId; return render(); }
    if (act === 'tlevel') { S.tlevel = b.dataset.id; return render(); }
    if (act === 'role') {
      leaveEdit(); var nr = b.dataset.id, zz = S.zone && DATA.byId[S.zone];
      if (nr === 'ac' && zz) S.sArea = zz.areaId;
      if (nr === 'zs' && zz) S.sZone = zz.id;
      if (nr === 'ta' && S.ta && DATA.byId[S.ta] && !DATA.byId[S.ta].role) S.sTa = S.ta;
      S.role = nr; S.accEdit = null; S.tu = null; S.rvArea = null; S.rvZone = null; S.level = 'region'; S.rlevel = null; S.tlevel = null; S.zone = null; S.ta = null; S.open = {};
      return render();
    }
    var au = S.accRole === 'ac' ? S.accArea : S.zone, ac0 = null;
    if (act === 'accAccept') { ac0 = getAcc(au); ac0.status = 'active'; ac0.weights = null; ac0.draft = null; ac0.proposed = null; ac0.reason = ''; ac0.comment = ''; ac0.log.push('Accepted as set'); S.accEdit = null; S.accErr[au] = ''; return render(); }
    if (act === 'accEdit' || act === 'accWithdraw') {
      ac0 = getAcc(au);
      if (act === 'accWithdraw') { ac0.status = 'proposed'; ac0.log.push('Withdrawn'); }
      ac0.draft = (ac0.proposed && (act === 'accWithdraw' || ac0.status === 'returned') ? ac0.proposed : ac0.weights || prios().map(function (p) { return p.weight; })).slice();
      S.accEdit = au; S.accErr[au] = ''; return render();
    }
    if (act === 'accCancel') { ac0 = getAcc(au); ac0.draft = null; S.accEdit = null; S.accErr[au] = ''; return render(); }
    if (act === 'accReset') { ac0 = getAcc(au); ac0.draft = prios().map(function (p) { return p.weight; }); return render(); }
    if (act === 'accSend') {
      ac0 = getAcc(au); var rmw = prios().map(function (p) { return p.weight; }), dr = ac0.draft || rmw, totw = sum(dr, function (x) { return x; });
      var tooFar = dr.some(function (x, i) { return Math.abs(x - rmw[i]) > 20; });
      var ap0 = approverOf(DATA.byId[au]);
      if (totw !== 100) S.accErr[au] = 'The weights total ' + totw + '%. They must total 100.';
      else if (tooFar) S.accErr[au] = 'A weight can move by at most 20 points from the RM’s.';
      else if (dr.join() === rmw.join()) S.accErr[au] = 'The weights are the same as the RM’s. Accept them as set instead.';
      else if (!(ac0.reason || '').trim()) S.accErr[au] = 'Say why you are changing the weights. ' + ap0.who + ' needs it to decide.';
      else { ac0.proposed = dr.slice(); ac0.status = 'pending'; ac0.comment = ''; ac0.draft = null; ac0.log.push('Sent to ' + ap0.who); S.accEdit = null; S.accErr[au] = ''; }
      return render();
    }
    if (act === 'accApprove' || act === 'accReturn') {
      var uid = b.dataset.id; ac0 = peekAcc(uid); if (!ac0) return;
      var ap1 = approverOf(DATA.byId[uid]);
      if (act === 'accApprove') { ac0.status = 'active'; ac0.weights = ac0.proposed.slice(); ac0.approvedBy = ap1.who; ac0.log.push(ap1.who + ' approved'); S.accErr[uid] = ''; }
      else {
        var cm2 = ($('acm' + uid).value || '').trim();
        if (!cm2) { S.accErr[uid] = 'Add a comment so they know what to change.'; return render(); }
        ac0.status = 'returned'; ac0.comment = cm2; ac0.draftComment = ''; ac0.log.push(ap1.who + ' returned it'); S.accErr[uid] = '';
      }
      return render();
    }
    if (act === 'rprio') { S.rprio = b.dataset.id; return render(); }
    if (act === 'rvopen') { if (b.dataset.lv === 'area') { S.rvArea = b.dataset.id; S.rvZone = null; } else { S.rvZone = b.dataset.id; S.zone = b.dataset.id; } return render(); }
    if (act === 'rvup') { if (b.dataset.to === 'region') { S.rvArea = null; S.rvZone = null; } else S.rvZone = null; return render(); }
    if (act === 'rlevel') { S.rlevel = b.dataset.id; return render(); }
    if (act === 'zone') { S.zone = b.dataset.id; return render(); }
    if (act === 'whatif') { S.whatif = b.dataset.id; return render(); }
    if (act === 'level') { S.level = b.dataset.id; return render(); }
    var ta0 = S.ta, pl = S.plans[planKey(ta0)] || null, r0 = null;
    if (act === 'accept' || act === 'useRecAccept') {
      pl = getPlan(ta0); pl.status = 'active'; pl.days = null; pl.approvedBy = null; pl.snap = null; pl.reason = ''; pl.comment = '';
      pl.log.push('You accepted the recommended plan'); S.err[ta0] = ''; S.edit = false; return render();
    }
    if (act === 'editStart') { startEdit(ta0); return render(); }
    if (act === 'editCancel') { leaveEdit(); S.err[ta0] = ''; return render(); }
    if (act === 'useRec') { pl = getPlan(ta0); pl.days = null; pl.reason = ''; pl.snap = null; if (pl.status !== 'proposed') { pl.status = 'proposed'; } pl.log.push('You went back to the recommended plan'); S.edit = false; S.err[ta0] = ''; return render(); }
    if (act === 'withdraw') { pl = getPlan(ta0); pl.status = 'proposed'; pl.log.push('You withdrew the plan'); startEdit(ta0); return render(); }
    if (act === 'send') {
      pl = getPlan(ta0); r0 = rowOf(ta0);
      if (!pl.days || daysSig(pl.days) === daysSig(r0.plan.days)) S.err[ta0] = 'Nothing has changed from the recommended plan. Change a block first, or accept the plan as it is.';
      else if (!(pl.reason || '').trim()) S.err[ta0] = 'Say why you are changing the plan. ' + r0.zone.zs + ' needs it to decide.';
      else { pl.status = 'pending'; pl.comment = ''; pl.snap = null; pl.log.push('You sent it to ' + r0.zone.zs); S.edit = false; S.err[ta0] = ''; }
      return render();
    }
    if (act === 'bminus' || act === 'bplus' || act === 'bremove') {
      pl = getPlan(ta0); if (!pl.days) return;
      var fb = findBlock(pl, b.dataset.b); if (!fb) return;
      if (act === 'bremove') fb.day.blocks.splice(fb.j, 1);
      else {
        var nh = fb.block.hours + (act === 'bplus' ? 0.25 : -0.25);
        if (nh < 0.25 || (act === 'bplus' && dayHours(fb.day) + 0.25 > fb.day.cap + 1e-9)) return;
        fb.block.hours = nh; fb.block.edited = true; if (fb.block.metric) fb.block.units = nh / M[fb.block.metric].hrs;
      }
      S.err[ta0] = ''; return render();
    }
    if (act === 'addBlock') {
      pl = getPlan(ta0); if (!pl.days) return;
      var apid = $('addPid').value, aday = +$('addDay').value, ap = pById(apid, setOf(ta0)), dd = pl.days.filter(function (x) { return x.i === aday; })[0];
      if (!dd) return;
      if (dayHours(dd) + 0.5 > dd.cap + 1e-9) { S.err[ta0] = dd.label + ' is full. Remove or shorten something there first.'; return render(); }
      S.uid++;
      dd.blocks.push({ bid: 'b' + S.uid, pid: apid, title: ap.title, metric: ap.metric, hours: 0.5, units: 0.5 / M[ap.metric].hrs, text: 'Your own addition: time on ' + ap.title + '.', reasons: [DATA.byId[ta0].role === 'DA' ? 'Added by the Duka Assistant' : 'Added by the TA'], part: 'Added', overdue: false, added: true, edited: false, rec: 0 });
      S.err[ta0] = ''; return render();
    }
    if (act === 'approve' || act === 'return') {
      var tid = b.dataset.id; pl = peekPlan(tid); if (!pl) return;
      var zsn = DATA.byId[DATA.byId[tid].zoneId].zs;
      if (act === 'approve') { pl.status = 'active'; pl.approvedBy = zsn; pl.log.push(zsn + ' approved it'); S.err[tid] = ''; }
      else {
        var cm = ($('cm' + tid).value || '').trim();
        if (!cm) { S.err[tid] = 'Add a comment so the TA knows what to change.'; return render(); }
        pl.status = 'returned'; pl.comment = cm; pl.draftComment = ''; pl.log.push(zsn + ' returned it'); S.err[tid] = '';
      }
      return render();
    }
    var l = prios();
    if (act === 'remove') { l.splice(+b.dataset.i, 1); return render(); }
    if (act === 'balance') {
      var tot = sum(l, function (p) { return p.weight; });
      if (tot === 0) l.forEach(function (p) { p.weight = Math.round(100 / l.length); });
      else l.forEach(function (p) { p.weight = Math.round(p.weight / tot * 100); });
      var diff = 100 - sum(l, function (p) { return p.weight; }); l[0].weight += diff;
      return render();
    }
    if (act === 'add') {
      var k = $('addMetric').value; S.uid++;
      l.push({ id: 'n' + S.uid, metric: k, title: M[k].label, text: 'New priority for the week.', target: defaultTarget(k), deadline: 4, weight: 0, norm: 0, aud: {} });
      return render();
    }
    if (act === 'reset') { S.prios[S.region] = WP.defaultPriorities(S.region); S.prio = null; return render(); }
  }

  function onInput(e) {
    if (e.target.id === 'accReason') { var unitR = S.accRole === 'ac' ? S.accArea : S.zone; getAcc(unitR).reason = e.target.value; return; }
    if (e.target.dataset.acm) { var pa = peekAcc(e.target.dataset.acm); if (pa) pa.draftComment = e.target.value; return; }
    if (e.target.dataset.aw !== undefined) return;
    if (e.target.id === 'planReason') { getPlan(S.ta).reason = e.target.value; return; }
    if (e.target.dataset.cm) { var pc = peekPlan(e.target.dataset.cm); if (pc) pc.draftComment = e.target.value; return; }
    var f = e.target.dataset.f; if (!f) return;
    var i = +e.target.dataset.i, p = prios()[i], v = e.target.value;
    if (f === 'title' || f === 'text') p[f] = v;
    else if (f === 'metric') return; // handled on change
    else p[f] = Math.max(0, Number(v) || 0);
    if (f === 'deadline') return;
    refreshLive();
  }
  function onChange(e) {
    var t = e.target;
    if (t.dataset.df) {
      var dp = dprios()[+t.dataset.di], df = t.dataset.df;
      if (df === 'metric') { if (dp.title === M[dp.metric].label) dp.title = M[t.value].label; dp.metric = t.value; dp.target = defaultTarget(t.value); }
      else if (df === 'title') dp.title = t.value || M[dp.metric].label;
      else dp[df] = Math.max(0, Math.round(Number(t.value) || 0));
      return render();
    }
    if (t.dataset.move) {
      var pl2 = getPlan(S.ta), fb2 = pl2.days ? findBlock(pl2, t.dataset.move) : null, to = t.value === '' ? null : +t.value;
      if (!fb2 || to === null) return render();
      var td = pl2.days.filter(function (x) { return x.i === to; })[0];
      if (dayHours(td) + fb2.block.hours > td.cap + 1e-9) { S.err[S.ta] = td.label + ' does not have ' + fmtH(fb2.block.hours) + ' h free. Shorten something there first.'; return render(); }
      fb2.day.blocks.splice(fb2.j, 1); fb2.block.edited = true; td.blocks.push(fb2.block); S.err[S.ta] = ''; return render();
    }
    if (t.dataset.aw !== undefined) { var unitW = S.accRole === 'ac' ? S.accArea : S.zone, aw = getAcc(unitW); if (aw.draft) { aw.draft[+t.dataset.aw] = Math.max(0, Math.round(Number(t.value) || 0)); } return render(); }
    if (t.id === 'roleSel') {
      leaveEdit(); var cu = curUnit(); S.role = t.value; S.at = null; S.accEdit = null; S.tu = null; S.rvArea = null; S.rvZone = null; S.level = 'region'; S.rlevel = null; S.tlevel = null; S.open = {};
      if (cu.zoneId) { S.sZone = cu.zoneId; S.sArea = cu.areaId; if (cu.role === 'DA') S.sDa = cu.id; else S.sTa = cu.id; } else if (cu.tas) { S.sZone = cu.id; S.sArea = cu.areaId; } else if (cu.zones) S.sArea = cu.id;
      S.zone = null; S.ta = null; S.tab = 'home'; return render();
    }
    if (t.id === 'whoSel') {
      leaveEdit(); var wu = DATA.byId[t.value]; S.region = wu.areas ? wu.id : wu.regionId; S.at = null; S.zone = null; S.ta = null; S.prio = null; S.accEdit = null; S.tu = null; S.rvArea = null; S.rvZone = null;
      if (S.role === 'ac') S.sArea = wu.id; else if (S.role === 'zs') S.sZone = wu.id; else if (S.role === 'ta') S.sTa = wu.id; else if (S.role === 'da') S.sDa = wu.id;
      return render();
    }
    if (t.id === 'wkSel') { leaveEdit(); S.wk = +t.value; if (S.wk !== 1 && S.tab !== 'data' && S.tab !== 'home') S.tab = 'priorities'; return render(); }
    if (t.id === 'zoneSel') S.accEdit = null;
    if (t.id === 'regSel' || t.id === 'zoneSel' || t.id === 'taSel') leaveEdit();
    if (t.id === 'regSel') { S.rvArea = null; S.rvZone = null; S.tu = null; S.accArea = null; S.accEdit = null; S.sArea = null; S.sZone = null; S.sTa = null; }
    if (t.id === 'unitSel') { leaveEdit(); if (S.role === 'ac') S.sArea = t.value; else if (S.role === 'ta') S.sTa = t.value; else S.sZone = t.value; S.accEdit = null; S.tu = null; S.rvArea = null; S.rvZone = null; S.zone = null; S.ta = null; return render(); }
    if (t.id === 'regSel') { S.region = t.value; S.zone = null; S.ta = null; S.prio = null; return render(); }
    if (t.id === 'zoneSel') { S.zone = t.value; return render(); }
    if (t.id === 'taSel') { S.ta = t.value; S.zone = DATA.byId[t.value].zoneId; return render(); }
    var f = t.dataset.f; if (!f) return;
    var p = prios()[+t.dataset.i];
    if (f === 'metric') {
      p.metric = t.value; p.target = defaultTarget(t.value); if (M[t.value].kind !== 'season') p.norm = 0;
      if (p.title === 'New priority' || Object.keys(M).some(function (k) { return M[k].label === p.title; })) p.title = M[t.value].label;
      return render();
    }
    if (f === 'deadline') { p.deadline = +t.value; }
    refreshLive();
    // other tabs read the model fresh on the next render
  }

  function init() {
    shell();
    var h = (location.hash || '').replace('#', '');
    if (VIEWS[h]) S.tab = h;
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    window.addEventListener('hashchange', function () { var x = (location.hash || '').replace('#', ''); if (VIEWS[x] && x !== S.tab) { S.tab = x; render(); } });
    render();
  }
  window.__WP = { S: S, DATA: DATA, render: render, setTab: setTab };
  init();
})();
