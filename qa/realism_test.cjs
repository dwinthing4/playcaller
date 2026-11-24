// Player realism, headless: measurables on every player, combine + pro days + draft stock, role archetypes, draft-guide reports,
// "plays like" comps, training camp, private workouts, aging moving the 40, and old saves back-filling without touching a rating.
// run: node tools/build.mjs && node qa/realism_test.cjs [seasons=2]
const path = require('path');
const { LG } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
const T = LG._t; let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };
const SEASONS = +(process.argv[2] || 2), t0 = Date.now();
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(3, 'Test Coach'); let L = LG.state();
const all = () => Object.values(L.P);
// measurables everywhere, in range
const bad = all().filter(p => { const m = T.msrOf(p); return !(m.forty > 4.1 && m.forty < 6 && m.ten > 1.3 && m.ten < 2.1 && m.cone > 6.2 && m.cone < 8.8 && m.shuttle > 3.7 && m.shuttle < 5.3 && m.vert > 15 && m.vert < 48 && m.broad > 75 && m.broad < 150 && m.bench >= 2 && m.bench < 50 && m.arm > 28 && m.arm < 37.5 && m.hand > 7.8 && m.hand < 11.5); });
ok(!bad.length, `measurables in range (${bad.length} out: ${bad.slice(0, 2).map(p => p.pos + ' ' + JSON.stringify(T.msrOf(p))).join(' | ')})`);
// role archetypes by position
const ra = {}; for (const p of all()) { const r = T.rarchOf(p, p.a); if (!r) continue; (ra[p.pos] = ra[p.pos] || {})[r.n] = (ra[p.pos][r.n] || 0) + 1; }
console.log('role archetypes:'); for (const pos in ra) console.log('  ', pos.padEnd(3), Object.entries(ra[pos]).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', '));
for (const pos of ['QB', 'RB', 'WR', 'TE', 'OT', 'DE', 'DT', 'LB', 'CB', 'S']) ok(Object.keys(ra[pos] || {}).length >= 2, `${pos} gets more than one archetype`);
// weekly scouting writes draft-guide reports
for (let w = 0; w < 6; w++) T.scoutingWeek();
const scouted = L.draft.map(id => L.P[id]).filter(p => p.sc && p.sc.dgs);
ok(scouted.length > 20, `draft-guide reports filed (${scouted.length})`);
const reps = scouted.slice(0, 40).map(p => T.dgrLatest(p));
ok(reps.every(r => r && r.sum && r.pros.length === 3 && r.cons.length >= 2 && r.cons.length <= 3 && r.proj && r.grade >= 4.5 && r.grade <= 7.9), 'reports have summary, 3 strengths, 2-3 weaknesses, projection, grade');
const sents = new Set(); reps.forEach(r => [r.sum, ...r.pros, ...r.cons].forEach(s => sents.add(s)));
ok(sents.size > reps.length * 3.5, `report wording varies (${sents.size} unique sentences in ${reps.length} reports)`);
ok(reps.every(r => !/\{\w+\}/.test([r.sum, ...r.pros, ...r.cons].join(' '))), 'no unfilled tokens');
for (const r of reps.slice(0, 2)) console.log('\nSAMPLE REPORT by', r.by, '| grade', r.grade, r.band, '|', r.ra, '\n ', r.sum, '\n  +', r.pros.join('\n  + '), '\n  -', r.cons.join('\n  - '), '\n  Projection:', r.proj, '|', r.comp || 'no comp');
// a weak scout and a great scout disagree more than two great ones
{ const p = scouted[0], s1 = { id: 9001, r: 2, spec: 'all' }, s2 = { id: 9002, r: 10, spec: 'all' }, s3 = { id: 9003, r: 10, spec: 'all' };
  const g = s => T.dgrReport(s, p, 0).grade; ok(Math.abs(g(s2) - g(s3)) <= 0.6, `great scouts agree (${g(s2)} vs ${g(s3)})`); }
// the season, then the combine
const simSeason = () => { let g = 0; while (L.phase === 'regular' && g++ < 30) LG.instantUserGame(); g = 0; while (L.phase === 'playoffs' && g++ < 10) { if (T.userPlayoffGame()) LG.instantUserGame(); else LG.simPlayoffRound(); } };
const vet = all().filter(p => p.tid != null && p.age >= 30 && p.age <= 31 && p.pos === 'WR').sort((a, b) => b.a.spd - a.a.spd)[0], vet40 = [T.msrOf(vet).forty];
for (let season = 0; season < SEASONS; season++) {
  L = LG.state(); simSeason(); ok(L.phase === 'offseason' && L.off === 'resign', 'reached offseason');
  const pros = L.draft.map(id => L.P[id]), withC = pros.filter(p => p.comb), inv = withC.filter(p => p.comb.inv), ran = withC.filter(p => p.comb.forty != null);
  ok(withC.length === pros.length, 'every prospect has a combine line');
  ok(inv.length > pros.length * 0.7 && inv.length < pros.length * 0.98, `most but not all invited (${inv.length}/${pros.length})`);
  ok(ran.length < inv.length, `some invited prospects skipped the 40 (${inv.length - ran.length})`);
  const f = T.cmbTop('forty', 3); console.log(`\n${L.year} combine: fastest ${f.map(p => p.pos + ' ' + p.ln + ' ' + p.comb.forty.toFixed(2)).join(', ')}; ${ran.length} ran the 40 of ${inv.length} invited`);
  // combine numbers read back close to the truth
  const errs = ran.map(p => Math.abs(T.cmbRead(p).spd - p.a.spd)); ok(errs.reduce((s, v) => s + v, 0) / errs.length < 2.5, `combine 40 reads speed within ~2 (${(errs.reduce((s, v) => s + v, 0) / errs.length).toFixed(2)})`);
  // CPU stock follows the workout: big testers rise
  const bumps = pros.filter(p => p.combBump); ok(bumps.length > 50 && bumps.some(p => p.combBump >= 2) && bumps.some(p => p.combBump <= -2), 'combine moves draft stock both ways');
  ok(T.pwoOpen(), 'private workouts open in the offseason');
  const wo = pros.filter(p => !p.sc || p.sc.lvl < 2).slice(0, 4); const lv = wo[0].sc ? wo[0].sc.lvl : 0; const rw = T.pwoApply(wo[0].id, 80); ok(rw.ok && wo[0].sc.lvl > lv && wo[0].sc.wo === 80, 'workout sharpens the read: ' + rw.msg);
  T.pwoApply(wo[1].id, 20); T.pwoApply(wo[2].id, 50); ok(!T.pwoApply(wo[3].id, 50).ok, 'workouts are limited per draft');
  ok(LG.offseasonNext().ok && L.off === 'draft', 'to draft');
  ok(L.draft.map(id => L.P[id]).filter(p => p.comb && p.comb.inv === false && p.comb.forty != null && p.comb.pd.forty).length > 10, 'pro days posted numbers for prospects who were not invited');
  const order = L.draft.map(id => L.P[id]).filter(p => p.combZ != null);
  T.simDraftUntilUser(); let g = 0; while (T.userOnClock() && g++ < 10) { const best = L.draft.map(id => L.P[id]).sort((a, b) => b.scout - a.scout)[0]; T.userDraft(best.id); }
  ok(LG.offseasonNext().ok && L.off === 'fa', 'to free agency');
  { const dr = order.filter(p => p.drafted); const hi = dr.filter(p => p.combZ >= 0.8), lo = dr.filter(p => p.combZ <= -0.8), avg = a => a.reduce((s, p) => s + p.drafted.pick, 0) / Math.max(1, a.length);
    console.log(`draft: strong testers went at pick ${avg(hi).toFixed(0)} on average (n=${hi.length}), weak testers at ${avg(lo).toFixed(0)} (n=${lo.length})`); ok(avg(hi) < avg(lo), 'strong testers drafted earlier'); }
  // training camp
  ok(T.tcampOpen(), 'camp open in free agency'); const U = T.UT(), young = U.roster.map(id => L.P[id]).filter(p => p.age <= 24).sort((a, b) => a.age - b.age);
  const p1 = young[0], xp0 = JSON.stringify(p1.xp || {}) + JSON.stringify(p1.a); const rc = T.tcampApply(p1.id, 95); ok(rc.ok && JSON.stringify(p1.xp || {}) + JSON.stringify(p1.a) !== xp0, 'camp drill gives development: ' + rc.msg);
  ok(!T.tcampApply(p1.id, 95).ok, 'one drill per player per camp'); const ra2 = T.tcampAuto(); ok(ra2.ok && T.tcampLeft() === 0, 'auto camp fills the rest: ' + ra2.msg);
  const dn = T.tcampState().done; console.log('camp:', Object.entries(dn).map(([id, d]) => `${L.P[id].pos} ${L.P[id].ln} ${d.s}${d.auto ? 'a' : ''}${d.ups.length ? ' +' + d.ups.length : ''}`).join(', '));
  const U2 = T.UT(); while (U2.roster.length > 53) { const w = U2.roster.map(id => L.P[id]).sort((a, b) => a.ovr - b.ovr)[0]; T.releasePlayer(w.id); }
  while (T.capRoom(U2) < 0) { const w = U2.roster.map(id => L.P[id]).sort((a, b) => b.sal / b.ovr - a.sal / a.ovr)[0]; T.releasePlayer(w.id); }
  const r = LG.offseasonNext(); ok(r.ok, 'new season: ' + (r.msg || '')); ok(T.tcampOpen(), 'camp still open in week 1 before the game');
  if (L.P[vet.id]) vet40.push(T.msrOf(vet).forty);
  ok((L.cpool || []).length > 10, `plays-like pool grows (${(L.cpool || []).length})`);
}
console.log(`\naging: WR ${vet.ln} 40 by season ${vet40.join(' -> ')} (age ${vet.age})`); ok(vet40.length < 2 || vet40[vet40.length - 1] >= vet40[0], 'an aging receiver does not get faster');
// comps: the new class once the scouts have seen it, plus young players on rosters
for (let w = 0; w < 4; w++) T.scoutingWeek();
const cps = L.draft.map(id => L.P[id]).filter(p => p.sc && p.sc.lvl >= 1).concat(Object.values(L.P).filter(p => p.tid != null && p.age <= 23)).slice(0, 80).map(p => [p, T.plkFor(p)]).filter(x => x[1]);
ok(cps.length > 20, `prospects get comps (${cps.length})`); ok(new Set(cps.map(x => x[1].txt)).size > 8, 'comps vary');
console.log('comps:', cps.slice(0, 5).map(([p, c]) => `${p.pos} ${p.ln} -> ${c.txt} (${c.tag}; ${c.why})`).join('\n       '));
L.P[L.draft[0]].comp = 'a famous old-timer'; ok(T.plkFor(L.P[L.draft[0]]).file, 'roster-file comp wins');
// old save: strip the measurables, load, nothing about the ratings changes
const s1 = LG.serialize(), d = JSON.parse(s1); for (const id in d.P) delete d.P[id].ms; const sig = x => Object.values(x.P).map(p => JSON.stringify(p.a)).join('|');
const before = sig(d); LG.deserialize(JSON.stringify(d)); L = LG.state(); ok(sig(L) === before, 'old save loads with ratings untouched'); ok(Object.values(L.P).every(p => p.ms && p.ms.v === 1), 'old save players get measurables');
const m1 = T.msrOf(Object.values(L.P)[5]); LG.deserialize(JSON.stringify(d)); ok(JSON.stringify(T.msrOf(Object.values(LG.state().P)[5])) === JSON.stringify(m1), 'back-filled measurables are the same every load');
console.log(`\n${SEASONS} seasons, save ${(s1.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`); console.log(fails ? `${fails} FAILURES` : 'ALL PASS'); process.exit(fails ? 1 : 0);
