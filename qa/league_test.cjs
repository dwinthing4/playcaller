// Headless league test: 3 seasons with offseasons, trades, scouting, coordinators, save/load.
// run: node tools/build.mjs && node qa/league_test.cjs
const path = require('path');
const { LG } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
const T = LG._t; let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };
const t0 = Date.now();
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(5, 'Test Coach');
let L = LG.state();
ok(L.teams.length === 32, '32 teams');
ok(L.teams.every(t => t.roster.length === 53), 'all rosters 53');
// coordinators + cpu calls for every situation
const scens = ['1st', '2short', '2med', '2long', '3short', '3med', '3long', '4short', 'red', 'goal', '2min'];
const ctxFor = (k, side) => { const m = { '1st': [1, 10, 25], '2short': [2, 2, 40], '2med': [2, 5, 40], '2long': [2, 9, 40], '3short': [3, 1, 50], '3med': [3, 5, 50], '3long': [3, 9, 50], '4short': [4, 1, 55], red: [1, 10, 85], goal: [1, 2, 98], '2min': [2, 8, 40] }[k];
  return { side, tid: L.user, oppTid: LG.currentUserGame().h === L.user ? LG.currentUserGame().a : LG.currentUserGame().h, down: m[0], togo: m[1], yl: m[2], q: k === '2min' ? 4 : 2, clock: k === '2min' ? 60 : 600, qlen: 120, sd: k === '2min' ? -4 : 0, scen: k }; };
const plan = LG.ensurePlan(); ok(plan && Object.keys(plan.O).length === scens.length, 'plan covers every scenario');
const says = new Set();
for (const k of scens) for (const side of ['O', 'D']) {
  const c = LG.coordCall(ctxFor(k, side)); ok(c.picks.length >= 1 && c.picks.length <= 3, `coordCall picks ${side}${k}`); ok(typeof c.say === 'string' && c.say.length > 10, `coordCall say ${side}${k}`); ok(c.who && c.who.role === (side === 'O' ? 'OC' : 'DC'), 'who');
  says.add(c.say); ok(!!plan.say[side][k], 'plan line ' + side + k);
  const id = LG.cpuCall(ctxFor(k, side).oppTid, side, ctxFor(k, side)); ok(L.plays.some(p => p.id === id && p.side === side), `cpuCall ${side}${k}`);
}
ok(says.size >= 16, `coordinator lines vary (${says.size} unique of 22)`);
console.log('sample OC 3rd & long:', LG.coordCall(ctxFor('3long', 'O')).say);
console.log('sample DC goal line:', LG.coordCall(ctxFor('goal', 'D')).say);
console.log('plan intro OC:', plan.intro.O);
ok(['go', 'fg', 'punt'].includes(LG.cpuFourth(0, { yl: 60, togo: 4, q: 2, clock: 300, qlen: 120, sd: 0 })), 'cpuFourth');
// starters contract
const st = LG.starters(T.UT(), 'Shotgun', 'O'); ok(st.length === 11 && st.every(s => s.pid != null && s.slot && s.pos), 'offense starters 11');
const sd = LG.starters(T.UT(), 'Nickel', 'D'); ok(sd.length === 11, 'defense starters 11');
const kit = LG.kitFor(T.UT(), true); ok(['jersey', 'trim', 'pants', 'pstripe', 'socks', 'helmet', 'hstripe', 'hstripe2', 'mask', 'num', 'numOutline', 'glove', 'cleat', 'logo', 'logo2'].every(k => /^#[0-9a-f]{6}$/i.test(kit[k])), 'kit colors');
// a trade: overpay with a first-round pick for a backup
const O = L.teams[(L.user + 1) % 32]; const backup = L.P[O.depth.WR[3]]; const pk = T.UT().picks.find(p => p.r === 1);
const tr = T.proposeTrade(O.id, [pk], [backup.id]); ok(tr.ok || tr.gm, 'trade accepted or GM objected: ' + tr.msg);
let reports = 0, weeksPlayed = 0, offers = 0;
for (let season = 0; season < 3; season++) {
  L = LG.state();
  let guard = 0;
  while (L.phase === 'regular' && guard++ < 30) { if (L.week === 2 && season === 0) T.genIncomingOffer(); LG.instantUserGame(); weeksPlayed++; }
  offers += (L.inOffers || []).length;
  guard = 0; while (L.phase === 'playoffs' && guard++ < 10) { if (T.userPlayoffGame()) LG.instantUserGame(); else LG.simPlayoffRound(); }
  ok(L.phase === 'offseason' && L.off === 'resign', `season ${season + 1} reached offseason (${L.phase}/${L.off})`);
  ok(L.teams.every(t => t.w + t.l + t.tie === 17), 'every team played 17 games');
  const res = L.results.filter(r => r.y === L.year && !r.po); const avg = res.reduce((s, r) => s + r.hs + r.as, 0) / res.length / 2;
  ok(avg > 12 && avg < 35, `avg points per team ${avg.toFixed(1)}`);
  ok(L.champs.length === season + 1, 'champion crowned');
  reports += Object.values(L.P).filter(p => p.sc && p.sc.reports && p.sc.reports.length).length;
  // offseason: re-sign the best three expiring players
  const ex = T.expiring(T.UT()).map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 3); for (const p of ex) T.resignPlayer(p.id, 3);
  ok(LG.offseasonNext().ok && L.off === 'draft', 'to draft');
  T.meetProspect(L.draft[0]); T.proDay(L.draft[1]);
  T.simDraftUntilUser(); guard = 0; while (T.userOnClock() && guard++ < 10) { const best = L.draft.map(id => L.P[id]).sort((a, b) => b.scout - a.scout)[0]; T.userDraft(best.id); }
  ok(LG.offseasonNext().ok && L.off === 'fa', 'to free agency');
  const fa = L.fa.map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr)[0]; if (fa) T.signOffer(fa.id, fa.ask || T.askingSalary(fa), 2);
  const U = T.UT(); while (U.roster.length > 53) { const w = U.roster.map(id => L.P[id]).sort((a, b) => a.ovr - b.ovr)[0]; T.releasePlayer(w.id); }
  while (T.capRoom(U) < 0) { const w = U.roster.map(id => L.P[id]).sort((a, b) => b.sal / b.ovr - a.sal / a.ovr)[0]; T.releasePlayer(w.id); }
  const r = LG.offseasonNext(); ok(r.ok, 'new season starts: ' + (r.msg || ''));
  ok(L.phase === 'regular' && L.week === 0, 'new season regular');
  ok(L.teams.every(t => t.roster.length >= 45 && t.roster.length <= 55), 'roster sizes ' + L.teams.map(t => t.roster.length).join(','));
  ok(L.teams.filter(t => t.id !== L.user).every(t => T.capRoom(t) > -15), 'cpu cap sane');
  ok(Object.values(L.P).every(p => Number.isFinite(p.ovr) && p.ovr >= 25 && p.ovr <= 99), 'ovr finite');
  ok(L.draft.length > 200, 'new draft class');
}
ok(reports > 30, `scout reports filed (${reports})`);
ok(L.inbox.some(m => m.from === 'gm') && L.inbox.some(m => m.from === 'owner') && L.inbox.some(m => m.from === 'scout'), 'inbox has gm, owner and scout messages');
const dev = (L.devHist || []).length; ok(dev > 0, 'development reports exist (' + dev + ')');
// owner meeting
T.ownerMeeting('midseason'); if (L.ownerMeet && !L.ownerMeet.done) ok(T.ownerChoose(0).ok, 'owner choice');
// save / load round trip
const s1 = LG.serialize(); const sig = x => [x.year, x.week, x.teams.map(t => t.roster.length).join(','), Object.keys(x.P).length].join('|');
const before = sig(LG.state()); LG.deserialize(s1); ok(sig(LG.state()) === before, 'save/load round trip');
console.log(`seasons: 3, weeks played: ${weeksPlayed}, players: ${Object.keys(LG.state().P).length}, save size: ${(s1.length / 1024).toFixed(0)} KB, inbox: ${LG.state().inbox.length}, scout reports seen: ${reports}, time: ${Date.now() - t0} ms`);
console.log(fails ? `${fails} FAILURES` : 'ALL PASS'); process.exit(fails ? 1 : 0);
