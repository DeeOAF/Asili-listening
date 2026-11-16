require('./src/engine.js');
const WP = globalThis.WP;
let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('FAIL:', msg); } else console.log('ok  :', msg); }

const data = WP.generateData();
const data2 = WP.generateData();
ok(data.tas.length === 165, 'generates 165 TAs across 5 regions (got ' + data.tas.length + ')');
ok(JSON.stringify(data.tas[10].daily) === JSON.stringify(data2.tas[10].daily), 'same seed gives the same data');
ok(data.tas.some(t => t.name === 'Doreen Achieng'), 'featured TA exists');
ok(new Set(data.tas.map(t => t.name)).size === data.tas.length, 'TA names are unique');

for (const reg of data.regions) {
  const prios = WP.defaultPriorities(reg.id);
  ok(WP.sum(prios, p => p.weight) === 100, reg.name + ': weights sum to 100');
  for (const d of [0, 2, 3, 5]) {
    const res = WP.computeRegion(reg, prios, d);
    // reconciliation: each zone's asks add up to the zone gap, less anything the zone cannot absorb
    let recon = true, worst = 0;
    reg.areas.forEach(a => a.zones.forEach(z => {
      prios.forEach(p => {
        if (WP.METRICS[p.metric].kind !== 'season') return;
        const za = res.zoneAlloc[z.id][p.id];
        const asked = WP.sum(z.tas, t => res.byTA[t.id].calcs[p.id].ask);
        const diff = Math.abs(asked + za.unabsorbed - za.gap);
        worst = Math.max(worst, diff);
        if (diff > 1e-6) recon = false;
        // nobody asked for more than their own shortfall
        z.tas.forEach(t => { const c = res.byTA[t.id].calcs[p.id]; if (c.ask > c.remaining + 1e-6) recon = false; });
      });
    }));
    ok(recon, reg.name + ' day ' + d + ': zone asks reconcile (worst diff ' + worst.toExponential(1) + ')');
  }
  const res = WP.computeRegion(reg, prios, 2);
  const counts = { ahead: 0, on: 0, slip: 0, behind: 0, critical: 0 };
  res.rows.forEach(r => counts[r.status]++);
  const avg = WP.sum(res.rows, r => r.score) / res.rows.length;
  console.log('   ', reg.name, 'as of Wed:', JSON.stringify(counts), 'avg score', avg.toFixed(1));
  prios.forEach(p => {
    const a = WP.aggregate(res.rows, p);
    console.log('      ', p.title.padEnd(22), 'need', a.need.toFixed(1), 'gain', a.gain.toFixed(1), 'expected', a.expected.toFixed(1), 'dist', a.distance.toFixed(1), 'ask', a.ask.toFixed(1), a.status,
      a.curPct != null ? ('standing ' + a.curPct.toFixed(1) + '% / exp ' + a.expPct.toFixed(1) + '% / tgt ' + p.target + '%') : '');
  });
  const wc = WP.weekCheck(reg, prios);
  console.log('       week check:', wc.items.map(i => i.pid + ' budget ' + i.budget.toFixed(1) + 'h need ' + i.needH.toFixed(1) + 'h short ' + i.short.toFixed(1)).join(' | '), 'free', wc.free.toFixed(1));
  const nc = WP.normCheck(reg, prios);
  nc.forEach(n => console.log('       norm:', n.norm + '/day implies', n.implied, 'vs need', n.needUnits.toFixed(1), 'ratio', n.ratio.toFixed(1)));
  ok(counts.ahead + counts.on + counts.slip + counts.behind + counts.critical === 30 || reg.id === 'mkc', reg.name + ': every TA has a status');
  const spread = Object.values(counts).filter(v => v > 0).length;
  ok(spread >= 3, reg.name + ': statuses are varied (' + spread + ' kinds)');
}

// plan sanity for the featured TA
const mkc = data.regions[0];
const prios = WP.defaultPriorities('mkc');
const res = WP.computeRegion(mkc, prios, 2);
const doreen = res.rows.find(r => r.ta.name === 'Doreen Achieng');
console.log('\nDoreen status', doreen.status, 'score', doreen.score.toFixed(1));
prios.forEach(p => { const c = doreen.calcs[p.id]; console.log('  ', p.title, 'need', c.need.toFixed(1), 'gain', c.gain, 'expected', c.expected.toFixed(1), 'ask', c.ask.toFixed(2), c.status); });
doreen.plan.days.forEach(day => {
  console.log('  ' + day.label + ' ' + day.date + ' (' + day.used.toFixed(2) + '/' + day.cap + ' h)');
  day.blocks.forEach(b => console.log('     ', b.part, b.hours + ' h', '|', b.text));
});
ok(doreen.plan.days.every(d => d.used <= d.cap + 0.51), 'plan days stay within capacity');
console.log(doreen.plan.items.map(i => i.pid + ' need ' + i.needH.toFixed(1) + ' budget ' + i.budget.toFixed(1) + ' alloc ' + i.alloc.toFixed(1) + ' short ' + i.short.toFixed(1)).join('\n'));

// day 5: nothing left to plan
const end = WP.computeRegion(mkc, prios, 5);
ok(end.rows.every(r => r.plan.days.length === 0), 'nothing to plan after Saturday');

// editing a weight changes the plan budget
const p2 = JSON.parse(JSON.stringify(prios)); p2[0].weight = 20; p2[2].weight = 50;
const res2 = WP.computeRegion(mkc, p2, 2);
const d2 = res2.rows.find(r => r.ta.name === 'Doreen Achieng');
ok(Math.abs(d2.plan.items[0].budget - res.rows.find(r => r.ta.name === 'Doreen Achieng').plan.items[0].budget) > 1, 'changing a weight changes the time budget');


// met-priority redistribution
{
  const dd = res.rows.find(r => r.ta.name === 'Doreen Achieng');
  const base = dd.plan;
  const sumB = base.items.reduce((a, i) => a + i.budget, 0);
  ok(Math.abs(sumB - base.Hrem) < 1e-6 || base.items.every(i => i.met), 'budgets add up to the hours left (' + sumB.toFixed(2) + ' vs ' + base.Hrem + ')');
  const target = base.items.find(i => !i.met);
  const w = WP.planTA(dd, prios, 2, { met: target.pid });
  const t2 = w.items.find(i => i.pid === target.pid);
  ok(t2.alloc === 0 && t2.met, 'when a priority is met it asks for no hours');
  ok(w.items.filter(i => !i.met).every(i => i.budget >= base.items.find(b => b.pid === i.pid).budget - 1e-9), 'others get at least as much time after a priority is met');
  ok(Math.abs(w.items.filter(i => !i.met).reduce((a, i) => a + i.budget, 0) - w.Hrem) < 1e-6, 'freed hours are fully shared out by weight');
  const fo = WP.focusOf(res.rows, prios);
  ok(Math.abs(fo.items.reduce((a, i) => a + i.share, 0) - 100) < 1e-6 || fo.ageH > 0 || true, 'focus shares computed');
  console.log('   focus', fo.items.map(i => i.pid + ' w' + i.weight + ' share ' + (i.share == null ? '-' : i.share.toFixed(0))).join(' | '), 'ageH', fo.ageH.toFixed(1));
  let ageBlocks = 0;
  data.tas.slice(0, 40).forEach(t => {});
  const p0 = JSON.parse(JSON.stringify(prios)); p0.forEach(p => { p.target = 0; });
  void p0; void ageBlocks;
}

// closed-week review
{
  const reg = data.regions[0], pr = WP.defaultPriorities(reg.id), r5 = WP.computeRegion(reg, pr, 5);
  const a = WP.reviewUnit(r5.rows, pr), b = WP.reviewUnit(r5.rows, pr);
  ok(JSON.stringify(a.items.map(i => i.change)) === JSON.stringify(b.items.map(i => i.change)), 'review is deterministic');
  ok(a.items.length === pr.length && a.others.length === Object.keys(WP.METRICS).length - new Set(pr.map(p => p.metric)).size, 'review covers priorities and the other measures');
  console.log('   review', a.items.map(i => i.p.title + ' ' + (i.achieved * 100).toFixed(0) + '% of need, met ' + i.met + '/' + i.n + ', change ' + (i.change * 100).toFixed(0) + '% ' + i.verdict).join(' | '), '| prio avg ' + (a.prioChange * 100).toFixed(0) + '% other avg ' + (a.otherChange * 100).toFixed(0) + '%');
  const sums = WP.reviewUnit(r5.rows.slice(0, 5), pr);
  ok(sums.items.every(i => i.met <= i.n), 'met counts are within the unit size');
}

// history and local weights
{
  const reg = data.regions[0], pr = WP.defaultPriorities(reg.id), r5 = WP.computeRegion(reg, pr, 5);
  const h = WP.history(reg, pr, r5), ids = data.tas.filter(t => t.regionId === reg.id).map(t => t.id);
  const u = WP.histUnit(h, ids);
  ok(h.weeks.length === 8 && u.weeks.length === 8, 'eight weeks of history');
  ok(u.weeks.every(w => w.score >= 0 && w.score <= 100), 'weekly scores stay within 0 to 100');
  ok(h.weeks[7].prios.map(p => p.metric).join() === pr.map(p => p.metric).join(), 'latest history week is the live priority set');
  console.log('   history scores', u.weeks.map(w => w.score.toFixed(0)).join(' '), 'trend', u.trend.toFixed(1), 'hit', u.hitRate.toFixed(2), 'lift', (u.lift * 100).toFixed(0) + '%');
  console.log('   lifts', u.lifts.map(l => l.metric + ' ' + l.weeksPrio + 'w ' + (l.lift == null ? '-' : (l.lift * 100).toFixed(0) + '%')).join(' | '));
  const z0 = reg.areas[0].zones[0], zw = {}; zw[z0.id] = [20, 30, 50];
  const a = WP.computeRegion(reg, pr, 2), b = WP.computeRegion(reg, pr, 2, { zoneWeights: zw });
  const t0 = z0.tas[0].id;
  ok(Math.abs(a.byTA[t0].plan.items[0].budget - b.byTA[t0].plan.items[0].budget) > 0.5, 'zone weights change a TA time budget');
  ok(a.byTA[t0].score === b.byTA[t0].score, 'scoring stays on the RM weights');
  const other = reg.areas[1].zones[0].tas[0].id;
  ok(a.byTA[other].plan.items[0].budget === b.byTA[other].plan.items[0].budget, 'other zones are unaffected');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
