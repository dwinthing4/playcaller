// Several seasons headless: league leaders per season next to what one team's players reach, save size by part, sim speed.
// run: node tools/build.mjs && node qa/league_seasons.cjs [seasons=3] [qlen=60]
const path = require('path');
const { LG } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
const T = LG._t, NS = +(process.argv[2] || 3), QL = +(process.argv[3] || 60);
LG.newLeague({ diff: 'pro', qlen: QL }); LG.chooseTeam(5, 'Test Coach'); let L = LG.state();
const wk = [];
for (let s = 0; s < NS; s++) {
  L = LG.state(); let guard = 0;
  while (L.phase === 'regular' && guard++ < 30) { const t0 = Date.now(); LG.instantUserGame(); wk.push(Date.now() - t0); }
  guard = 0; while (L.phase === 'playoffs' && guard++ < 10) { if (T.userPlayoffGame()) LG.instantUserGame(); else LG.simPlayoffRound(); }
  const row = L.lhist[L.lhist.length - 1];
  const res = L.results.filter(r => r.y === L.year && !r.po), ppg = res.reduce((a, r) => a + r.hs + r.as, 0) / res.length / 2;
  console.log(`\n${L.year} (${QL}s quarters): ${ppg.toFixed(1)} pts/team-game, ${row.ppg} plays/team-game, champion ${row.champ}, MVP ${row.mvp}`);
  for (const [k, lab] of [['py', 'Pass yds'], ['ptd', 'Pass TD'], ['ry', 'Rush yds'], ['recy', 'Rec yds'], ['rec', 'Receptions'], ['sk', 'Sacks'], ['int', 'INT'], ['tk', 'Tackles']]) {
    const top = (row.ld[k] || []).map(x => `${x[1]} ${x[2]} ${x[3]} (${(x[3] / x[4]).toFixed(1)}/g)`).join(' | ');
    console.log(`  ${lab.padEnd(11)} ${top}`);
  }
  // the user's team: his QB's season next to the league's
  const U = T.UT(), qb = Object.values(L.P).filter(p => p.pos === 'QB' && (p.hist || []).some(h => h.y === L.year && h.t === U.id)).map(p => p.hist.find(h => h.y === L.year && h.t === U.id)).sort((a, b) => b.py - a.py)[0];
  if (qb) console.log(`  your QB: ${qb.pc}/${qb.pa} ${qb.py} yds ${qb.ptd} TD ${qb.pint} INT in ${qb.gp} games`);
  if (s < NS - 1) {
    const ex = T.expiring(U).map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 3); for (const p of ex) T.resignPlayer(p.id, 3);
    LG.offseasonNext(); T.simDraftUntilUser(); guard = 0; while (T.userOnClock() && guard++ < 10) { const best = L.draft.map(id => L.P[id]).sort((a, b) => b.scout - a.scout)[0]; T.userDraft(best.id); }
    LG.offseasonNext(); while (U.roster.length > 53) { const w = U.roster.map(id => L.P[id]).sort((a, b) => a.ovr - b.ovr)[0]; T.releasePlayer(w.id); }
    while (T.capRoom(U) < 0) { const w = U.roster.map(id => L.P[id]).sort((a, b) => b.sal / b.ovr - a.sal / a.ovr)[0]; T.releasePlayer(w.id); }
    const r = LG.offseasonNext(); if (!r.ok) console.log('new season failed', r.msg);
  }
}
const s = LG.serialize(), size = x => JSON.stringify(x).length;
let gl = 0, hgl = 0; for (const id in L.P) { const p = L.P[id]; gl += size(p.gl || []); for (const h of p.hist || []) if (h.gl) hgl += size(h.gl); }
let bx = 0; for (const r of L.results || []) if (r.bx) bx += size(r.bx);
console.log(`\nsave ${(s.length / 1024).toFixed(0)} KB: game logs this season ${(gl / 1024).toFixed(0)} KB, archived logs ${(hgl / 1024).toFixed(0)} KB, box scores ${(bx / 1024).toFixed(0)} KB, players ${Object.keys(L.P).length}`);
wk.sort((a, b) => a - b); console.log(`week sim (all 16 games + weekly hooks): median ${wk[wk.length >> 1]} ms, max ${wk[wk.length - 1]} ms`);
console.log('career passing yards:', (L.rcar.py || []).slice(0, 3).map(e => `${e.name} ${e.v}`).join(' | '), ' dynasties:', T.histDynasties().length);
