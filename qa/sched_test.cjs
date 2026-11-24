// Schedule test: 17 games over 18 weeks, one bye in weeks 5-14, division rivals twice, home 8/9, slots, Thanksgiving, international.
// run: node tools/build.mjs && node qa/sched_test.cjs
const path = require('path');
const { LG } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };
for (const real of [false, true]) for (let season = 0; season < 6; season++) {
  if (season === 0) { LG.newLeague({ diff: 'pro', qlen: 60, real }); LG.chooseTeam(3, 'X'); }
  const L = LG.state(); const t0 = Date.now();
  if (season > 0) { L.year++; LG._t.makeSchedule(); }
  const ms = Date.now() - t0, S = L.sched;
  ok(S.length === 18, `${real ? 'real' : 'gen'} y${L.year}: 18 weeks (${S.length})`);
  const gp = {}, home = {}, bye = {}, pairs = {};
  S.forEach((wk, w) => { const seen = new Set(); for (const g of wk) { ok(!seen.has(g.h) && !seen.has(g.a), `team twice in week ${w + 1}`); seen.add(g.h); seen.add(g.a); gp[g.h] = (gp[g.h] || 0) + 1; gp[g.a] = (gp[g.a] || 0) + 1; if (!g.neutral) home[g.h] = (home[g.h] || 0) + 1; const k = Math.min(g.h, g.a) + '-' + Math.max(g.h, g.a); pairs[k] = (pairs[k] || 0) + 1; ok(!!g.slot, 'slot set'); }
    for (const t of L.teams) if (!seen.has(t.id)) (bye[t.id] = bye[t.id] || []).push(w); });
  ok(L.teams.every(t => gp[t.id] === 17), '17 games each');
  ok(L.teams.every(t => bye[t.id] && bye[t.id].length === 1 && bye[t.id][0] >= 4 && bye[t.id][0] <= 13), 'one bye in weeks 5-14');
  for (const a of L.teams) for (const b of L.teams) if (a.id < b.id && a.conf === b.conf && a.div === b.div) ok(pairs[a.id + '-' + b.id] === 2, `division rivals twice ${a.abbr}-${b.abbr}`);
  ok(Object.values(pairs).every(n => n <= 2), 'no third meeting');
  const hv = Object.values(home); const hd = {}; for (const v of hv) hd[v] = (hd[v] || 0) + 1;
  const slots = {}; for (const wk of S) for (const g of wk) slots[g.slot] = (slots[g.slot] || 0) + 1;
  const tg = S[11].filter(g => g.slot === 'thanksgiving').length, intl = S.flat().filter(g => g.neutral);
  ok(tg >= 2 && tg <= 3, `2-3 Thanksgiving games (${tg})`); ok(intl.length >= 2 && intl.length <= 4 && intl.every(g => g.site && g.slot === 'intl'), `2-4 international games (${intl.length})`);
  ok(S.every((wk, w) => wk.filter(g => g.slot === 'snf').length === 1), 'one Sunday night game a week');
  if (season < 2) console.log(`${real ? 'real' : 'gen'} ${L.year}: ${ms} ms, home games ${JSON.stringify(hd)}, slots ${JSON.stringify(slots)}, abroad: ${intl.map(g => `${g.site} wk${S.findIndex(w => w.includes(g)) + 1} ${L.teams[g.a].abbr}-${L.teams[g.h].abbr}`).join(', ')}, byes/wk ${S.map(w => (32 - w.length * 2) / 1).slice(4, 14).join(',')}`);
}
// an old save: 17-week schedule without slots, old-style records, no game logs / box scores / record books
{
  LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(2, 'Old'); let L = LG.state(); LG.instantUserGame();
  const d = JSON.parse(LG.serialize()); d.sched = d.sched.slice(0, 17).map(w => w.map(g => { delete g.slot; delete g.neutral; delete g.site; return g; }));
  delete d.recQ; delete d.rcar; delete d.qlS; d.rec = { mine: { passYdsG: { v: 410, pid: 1, name: 'Old Timer', pos: 'QB', team: 'XX', y: 2025 } }, lg: {} };
  for (const id in d.P) { delete d.P[id].gl; for (const h of d.P[id].hist || []) delete h.gl; } for (const r of d.results) delete r.bx;
  LG.deserialize(JSON.stringify(d)); L = LG.state();
  ok(L.recOld && L.recOld.mine.passYdsG && L.recQ && L.rcar, 'old records kept as the old-sim book');
  ok(Object.values(L.P).every(p => Array.isArray(p.gl)), 'game logs added');
  let err = null; try { let g = 0; while (L.phase === 'regular' && g++ < 25) LG.instantUserGame(); } catch (e) { err = e; }
  ok(!err && L.phase === 'playoffs', 'old 17-week season plays to the playoffs ' + (err ? err.stack : L.phase));
  ok(L.results.filter(r => r.y === L.year && r.bx).length >= 200, 'box scores on the new games');
}
console.log(fails ? `${fails} FAILURES` : 'ALL PASS'); process.exit(fails ? 1 : 0);
