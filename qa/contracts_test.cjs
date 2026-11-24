// Headless contracts test: 3 seasons with offseasons. Checks the rookie scale, dead money (normal and June 1 cuts, trades),
// 5th-year options (CPU and the user's), compensatory picks, CPU cap sanity, old-save migration and the coach tree.
// run: node tools/build.mjs && node qa/contracts_test.cjs
const path = require('path');
const { LG } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
const T = LG._t; let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };
const near = (a, b, e = 0.25) => Math.abs(a - b) <= e;
const t0 = Date.now();
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(7, 'Test Coach');
let L = LG.state(); const U = () => T.UT();
// ---- structure of a new league
const rostered = L.teams.flatMap(t => t.roster.map(id => L.P[id]));
ok(rostered.every(p => near(p.sal, T.kBase(p) + (p.pr || 0), 0.11)), 'cap hit = base + proration for every contract');
ok(rostered.filter(p => p.pr > 0).length > 300, 'big contracts carry signing-bonus proration (' + rostered.filter(p => p.pr > 0).length + ')');
ok(rostered.every(p => (p.prYrs || 0) <= 5 && (p.prYrs || 0) <= Math.max(p.yrs, 0)), 'proration never longer than 5 years or the contract');
ok(L.teams.every(t => Array.isArray(t.deadL) && t.dead === 0), 'dead money ledgers start empty');
ok(L.teams.every(t => T.capRoom(t) >= -2), 'every team starts under the cap');
const rk0 = rostered.filter(p => p.rk && p.rk.r === 1); ok(rk0.length >= 60, 'first-rounders from recent drafts on rookie deals (' + rk0.length + ')');
// ---- dead money: a normal cut and a June 1 cut
const me = U(); const cy = T.capYear();
const byPr = me.roster.map(id => L.P[id]).filter(p => p.pr > 0 && p.prYrs >= 2).sort((a, b) => b.pr * b.prYrs - a.pr * a.prYrs);
ok(byPr.length >= 3, 'user team has players with multi-year proration');
const cut1 = byPr[2], s1 = T.ctSplit(cut1, false), d0 = me.dead;
const r1 = T.releasePlayer(cut1.id, false); ok(r1.ok, 'normal cut ok');
ok(near(me.dead, d0 + s1.now), `normal cut: all remaining proration + guarantee hits now (${s1.now})`);
ok(near(T.ctDeadFor(me, cy + 1), 0), 'normal cut: nothing next year');
const cut2 = byPr[1], s2 = T.ctSplit(cut2, true), d1 = me.dead;
ok(s2.next > 0 && near(s2.now, cut2.pr + (cut2.guar || 0)), 'June 1 split: this year = one year of proration + guarantee');
const j1before = T.ctJ1Left(me); ok(j1before === 2, 'two June 1 cuts a year');
ok(T.releasePlayer(cut2.id, true).ok, 'June 1 cut ok');
ok(near(me.dead, d1 + s2.now) && near(T.ctDeadFor(me, cy + 1), s2.next), `June 1 cut: ${s2.now} now, ${s2.next} next year`);
ok(T.ctJ1Left(me) === 1, 'June 1 count used');
// ---- trade: the old team keeps the bonus
const O = L.teams[(L.user + 3) % 32]; const tp = me.roster.map(id => L.P[id]).filter(p => p.pr > 0 && p.prYrs >= 2 && T.capRoom(me) + p.sal - T.ctTradeDead(p) >= 0 && T.capRoom(O) >= T.kBase(p)).sort((a, b) => b.pr - a.pr)[0];
ok(!!tp, 'a tradeable player with proration');
if (tp) { const td = T.ctTradeDead(tp), dd = me.dead, base = T.kBase(tp); const pkO = O.picks.find(k => k.r === 7);
  const r = T.execTrade(O, [T.toAsset(tp.id)], pkO ? [T.toAsset(pkO)] : []); ok(r.ok, 'trade executes: ' + r.msg);
  if (r.ok) { ok(near(me.dead, dd + td), `trade: ${td} of proration stays as dead money`); ok(tp.tid === O.id && near(tp.sal, base) && !tp.pr, 'traded player costs his new team only his base'); } }
// ---- three seasons
let optUser = 0, optCpuYes = 0, optCpuNo = 0, compSeen = 0, compRounds = new Set(), capOk = true, rookieOk = true, optYears = 0, j1Next = 0;
for (let season = 0; season < 3; season++) {
  L = LG.state(); let guard = 0;
  while (L.phase === 'regular' && guard++ < 30) LG.instantUserGame();
  guard = 0; while (L.phase === 'playoffs' && guard++ < 10) { if (T.userPlayoffGame()) LG.instantUserGame(); else LG.simPlayoffRound(); }
  ok(L.phase === 'offseason' && L.off === 'resign', `season ${season + 1} reached the offseason`);
  // the June 1 cut from last year is on this year's books
  if (season === 0) { j1Next = T.ctDeadFor(U(), T.capYear()); ok(near(U().dead, j1Next) && j1Next >= s2.next - 0.05, `last year's June 1 money is on the new cap year (${j1Next})`); }
  // 5th-year options: CPU decided, user's open
  for (const t of L.teams) for (const id of t.roster) { const p = L.P[id]; if (!p.rk || p.rk.r !== 1 || p.rk.y + 2 !== L.year) continue;
    if (t.id === L.user) { ok(T.ctOptOpen(p), 'user option open'); optUser++; } else { ok(p.rk.opt === 'yes' || p.rk.opt === 'no', 'CPU decided its option'); if (p.rk.opt === 'yes') { optCpuYes++; ok(p.yrs === 2 && p.rk.price > 0, 'exercised option adds a year'); } else optCpuNo++; } }
  const mine = U().roster.map(id => L.P[id]).filter(p => T.ctOptOpen(p));
  if (mine.length) { ok(L.inbox.some(m => m.title === 'Fifth-year options'), 'user gets an inbox item about options'); const p = mine[0], pr = T.ctOptPrice(p), y0 = p.yrs; ok(T.optionDecide(p.id, true).ok && p.yrs === y0 + 1 && p.rk.price === pr, 'user picks up an option'); }
  // option years switch on
  for (const t of L.teams) for (const id of t.roster) { const p = L.P[id]; if (p.rk && p.rk.opt === 'yes' && p.rk.on) { optYears++; if (!near(T.kBase(p), p.rk.price, 0.11)) ok(false, 'option year salary = option price'); } }
  // comp picks
  const comp = (L.draftOrder || []).filter(s => s.comp);
  if (comp.length) { compSeen += comp.length; comp.forEach(s => compRounds.add(s.r));
    ok(comp.every(s => s.r >= 3 && s.r <= 7), 'comp picks only in rounds 3-7');
    ok(comp.every(s => { const i = L.draftOrder.indexOf(s); const nx = L.draftOrder[i + 1]; return !nx || nx.r !== s.r || nx.comp; }), 'comp picks sit at the end of their round');
    ok(comp.length <= 32 && L.teams.every(t => comp.filter(s => s.owner === t.id).length <= 4), 'at most 32 comp picks, 4 per team');
    ok(comp.some(s => s.owner !== L.user), 'CPU teams get comp picks'); }
  const ex = T.expiring(U()).map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 2); for (const p of ex) T.resignPlayer(p.id, 3);
  ok(LG.offseasonNext().ok && L.off === 'draft', 'to draft');
  T.simDraftUntilUser(); guard = 0; while (T.userOnClock() && guard++ < 12) { const best = L.draft.map(id => L.P[id]).sort((a, b) => b.scout - a.scout)[0]; T.userDraft(best.id); }
  ok(LG.offseasonNext().ok && L.off === 'fa', 'to free agency');
  // rookie scale
  const rookies = Object.values(L.P).filter(p => p.drafted && p.drafted.y === L.year + 1 && p.tid != null);
  const at = n => rookies.find(p => p.drafted.pick === n);
  const a1 = at(1), a32 = at(32), a100 = at(100);
  if (a1 && a32 && a100) { if (!(a1.sal > a32.sal && a32.sal > a100.sal)) rookieOk = false; if (!(a1.yrs === 4 && a1.rk && a1.rk.r === 1 && a100.rk && a100.rk.r >= 3)) rookieOk = false; }
  if (season === 0) console.log(`rookie scale: #1 ${a1 && a1.sal}  #16 ${at(16) && at(16).sal}  #32 ${a32 && a32.sal}  #64 ${at(64) && at(64).sal}  #100 ${a100 && a100.sal}`);
  const fa = L.fa.map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr)[0]; if (fa) T.signOffer(fa.id, fa.ask || T.askingSalary(fa), 2);
  const Ut = U(); while (Ut.roster.length > 53) { const w = Ut.roster.map(id => L.P[id]).sort((a, b) => a.ovr - b.ovr)[0]; T.releasePlayer(w.id); }
  guard = 0; while (T.capRoom(Ut) < 0 && guard++ < 40) { const w = Ut.roster.map(id => L.P[id]).sort((a, b) => (b.sal - T.ctSplit(b).now) - (a.sal - T.ctSplit(a).now))[0]; T.releasePlayer(w.id, T.ctJ1Left(Ut) > 0); }
  const r = LG.offseasonNext(); ok(r.ok, 'new season starts: ' + (r.msg || ''));
  const worst = Math.min(...L.teams.filter(t => t.id !== L.user).map(t => T.capRoom(t))); if (worst < -1) capOk = false;
  console.log(`season ${season + 1}: worst CPU cap room ${worst.toFixed(1)}  dead money (league) ${L.teams.reduce((s, t) => s + t.dead, 0).toFixed(1)}  comp picks ${comp.length}  options so far: cpu yes ${optCpuYes} / no ${optCpuNo}, user ${optUser}`);
  ok(L.teams.every(t => t.roster.length >= 45 && t.roster.length <= 55), 'roster sizes ' + L.teams.map(t => t.roster.length).join(','));
  ok(L.teams.every(t => t.roster.every(id => { const p = L.P[id]; return near(p.sal, T.kBase(p) + (p.pr || 0), 0.11) && p.sal >= 0.85; })), 'cap hits stay consistent');
}
ok(rookieOk, 'rookie scale: #1 > #32 > #100, 4 years, rounds recorded');
ok(capOk, 'every CPU team is under the cap (within $1M) when the season starts');
ok(optCpuYes > 0 && optCpuNo > 0, `CPU picks up some options and declines others (${optCpuYes}/${optCpuNo})`);
ok(optUser > 0, 'the user had options to decide');
ok(optYears > 0, 'option years kicked in');
ok(compSeen > 0 && compRounds.size >= 2, `comp picks awarded (${compSeen}, rounds ${[...compRounds].sort().join(',')})`);
// ---- old save: strip the new fields and load it
const s = JSON.parse(LG.serialize()); delete s.ctV; delete s.compLog; for (const t of s.teams) { delete t.deadL; t.dead = 3.3; } for (const id in s.P) { const p = s.P[id]; delete p.rk; delete p.ctV; if (p.tid != null && p.sal > 5 && Math.random() < 0.5) { p.pr = 0; p.prYrs = 0; p.guar = 0; p.base = p.sal; } }
LG.deserialize(JSON.stringify(s)); L = LG.state();
ok(L.teams.every(t => Array.isArray(t.deadL) && near(t.dead, 3.3)), 'old save: dead money moved into the ledger');
ok(L.teams.every(t => t.roster.every(id => L.P[id].ctV || L.P[id].rk !== undefined)), 'old save: contracts migrated');
// ---- coach tree
const C = T.coachTree(); ok(C && C.lvl >= 2, `coach earned levels (level ${C && C.lvl}, ${C && C.log.length} XP events)`);
ok(T.coachLearn('mot1').ok && T.coachPerk('mot1'), 'learn a tier-1 perk');
ok(!T.coachLearn('mot3').ok, 'tier 3 needs tier 2 first');
const pts = C.pts; U().coach.pts = 50; ok(T.coachRespec().ok && !T.coachPerk('mot1') && C.pts === pts + 1, 'respec gives the points back');
console.log(`coach: level ${C.lvl}, ${C.pts} points, xp ${C.xp}; recent: ${C.log.slice(0, 3).map(l => l.why + ' +' + l.n).join('; ')}`);
console.log(`time ${Date.now() - t0} ms`);
console.log(fails ? `${fails} FAILURES` : 'ALL PASS'); process.exit(fails ? 1 : 0);
