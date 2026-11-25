// Win-probability calibration (src/core/50_wp.js) on fast-sim games, which play on the same clock rules as a live match.
// Every step of every game is a sample: when the model says 70%, about 70% of those teams should win (a tie counts half).
// run: node tools/build.mjs && node qa/wp_calib.cjs [games per quarter length, default 400] [--fit]
//   --fit also refits the model's constants (final-margin spread per quarter length, the pregame edge, the drive terms) and prints them
const path = require('path');
const { LG } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
const WP = LG.WPM, K = WP.K, fit = process.argv.includes('--fit'), N = +(process.argv.find(a => /^\d+$/.test(a)) || 400);
const QL = [60, 120, 180, 300, 900];
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const games = [];
const t0 = Date.now();
for (const qlen of QL) {
  LG.newLeague({ diff: 'pro', qlen }); const L = LG.state(); L.ghost = true;
  const n = qlen >= 900 ? Math.round(N / 3) : N;
  for (let i = 0; i < n; i++) {
    let h = Math.floor(rnd() * 32), a = Math.floor(rnd() * 32); if (a === h) a = (h + 1) % 32;
    const g = { h, a, wk: 0 }, m = LG.wpPower(h, a), S = [];
    const r = LG._t.fastGame(g, { playoffs: false, onSnap: (s, hid) => { if (rnd() < 0.5) S.push({ hs: s.score[hid], as: s.score[a], q: s.q, clock: Math.max(0, s.clock - (s.runoff || 0)), qlen, poss: s.poss === hid ? 'h' : 'a', yl: s.yl, down: Math.min(4, s.down), togo: s.togo, toH: s.to[hid], toA: s.to[a], kick: s.pat ? null : s.kickNext == null ? null : s.kickNext === hid ? 'h' : 'a', pat: s.pat ? (s.pat.tid === hid ? 'h' : 'a') : null }); } });
    games.push({ qlen, m, mg: r.hs - r.as, y: r.hs > r.as ? 1 : r.hs < r.as ? 0 : 0.5, S });
  }
}
console.log(`${games.length} games, ${games.reduce((s, g) => s + g.S.length, 0)} states in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
// ---- final margin vs the pregame power difference, per quarter length
const reg = qlen => { const G = games.filter(g => g.qlen === qlen), n = G.length, mx = G.reduce((s, g) => s + g.m, 0) / n, my = G.reduce((s, g) => s + g.mg, 0) / n;
  const b = G.reduce((s, g) => s + (g.m - mx) * (g.mg - my), 0) / G.reduce((s, g) => s + (g.m - mx) ** 2, 0), c = my - b * mx, sd = Math.sqrt(G.reduce((s, g) => s + (g.mg - c - b * g.m) ** 2, 0) / n);
  return { n, b, c, sd, ties: G.filter(g => g.y === 0.5).length / n }; };
console.log('\nqlen  games  pts/power  home  sd(margin)  ties   model sd');
const R = {}; for (const q of QL) { R[q] = reg(q); console.log(`${String(q).padStart(4)}  ${String(R[q].n).padStart(5)}  ${R[q].b.toFixed(3).padStart(9)}  ${R[q].c.toFixed(2).padStart(4)}  ${R[q].sd.toFixed(2).padStart(10)}  ${(R[q].ties * 100).toFixed(1).padStart(4)}%  ${WP.sigG(q).toFixed(2).padStart(8)}`); }
const setEdge = () => { for (const g of games) { const e = WP.edgePts(g.m, true, g.qlen); for (const s of g.S) s.edge = e; } };
const loss = () => { let ll = 0, br = 0, n = 0; for (const g of games) for (const s of g.S) { const p = Math.min(0.999, Math.max(0.001, WP.of(s))); ll -= g.y * Math.log(p) + (1 - g.y) * Math.log(1 - p); br += (p - g.y) ** 2; n++; } return { ll: ll / n, br: br / n }; };
if (fit) {
  K.sg = QL.map(q => [q, +R[q].sd.toFixed(2)]); K.ek = QL.map(q => [q, +R[q].b.toFixed(3)]); const hm = QL.map(q => R[q].c), hAvg = hm.reduce((a, b) => a + b, 0) / hm.length; K.eh = QL.map((q, i) => [q, +Math.max(0, 0.5 * hm[i] + 0.5 * hAvg * Math.sqrt(q / 300)).toFixed(2)]); setEdge();
  const grid = { sk: [0.85, 0.9, 0.95, 1, 1.05], sp: [2.8, 3.2, 3.6, 4.0, 4.5, 5], dp: [0.5, 1, 2, 3, 4], to: [0, 0.2, 0.35, 0.5] };
  for (let pass = 0; pass < 2; pass++) for (const k of Object.keys(grid)) { let best = null; for (const v of grid[k]) { K[k] = v; const l = loss().ll; if (!best || l < best.l) best = { v, l }; } K[k] = best.v; }
  console.log('\nfitted WP.K =', JSON.stringify(K));
}
setEdge();
// ---- the calibration table
const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 })), ph = {};
for (const g of games) for (const s of g.S) { const p = WP.of(s), b = bins[Math.min(9, Math.floor(p * 10))]; b.n++; b.p += p; b.y += g.y;
  const k = s.q >= 5 ? 'OT' : s.q === 4 && s.clock <= s.qlen * 0.25 ? 'Q4 last quarter-of-a-quarter' : 'Q' + s.q; const B = ph[k] || (ph[k] = { n: 0, e: 0, p: 0, y: 0 }); B.n++; B.e += (p - g.y) ** 2; B.p += p; B.y += g.y; }
console.log('\nmodel says   states   mean said   actually won');
let worst = 0; for (let i = 0; i < 10; i++) { const b = bins[i]; if (!b.n) continue; const d = Math.abs(b.p / b.n - b.y / b.n); if (b.n > 200) worst = Math.max(worst, d);
  console.log(`${String(i * 10).padStart(3)}-${String(i * 10 + 10).padEnd(3)}%  ${String(b.n).padStart(7)}   ${(b.p / b.n * 100).toFixed(1).padStart(8)}%   ${(b.y / b.n * 100).toFixed(1).padStart(10)}%`); }
console.log('\nphase                          states   Brier   mean said   won');
for (const k of Object.keys(ph).sort()) { const B = ph[k]; console.log(`${k.padEnd(30)} ${String(B.n).padStart(7)}   ${(B.e / B.n).toFixed(3)}   ${(B.p / B.n * 100).toFixed(1).padStart(8)}%   ${(B.y / B.n * 100).toFixed(1)}%`); }
const L1 = loss(); let base = 0, nb = 0; for (const g of games) for (const s of g.S) { const p = 0.5; base += (p - g.y) ** 2; nb++; }
console.log(`\nBrier ${L1.br.toFixed(4)} (coin flip ${(base / nb).toFixed(4)}), log loss ${L1.ll.toFixed(4)}; worst bin gap ${(worst * 100).toFixed(1)} pts`);
// ---- spot checks a viewer would notice
const chk = (lab, s, lo, hi) => { const p = WP.of(Object.assign({ qlen: 120, toH: 3, toA: 3, edge: 0, kick: null, pat: null }, s)) * 100; const ok = p >= lo && p <= hi; console.log(`${ok ? 'ok  ' : 'FAIL'} ${lab}: ${p.toFixed(1)}% (want ${lo}-${hi})`); return ok; };
let okAll = worst < 0.05;
okAll = chk('kickoff, even teams', { hs: 0, as: 0, q: 1, clock: 120, kick: 'a', poss: 'h', yl: 25, down: 1, togo: 10 }, 45, 56) && okAll;
okAll = chk('up 3, own ball, 0:20 left, Q4, they have 0 TO', { hs: 20, as: 17, q: 4, clock: 20, poss: 'h', yl: 40, down: 1, togo: 10, toA: 0 }, 97, 100) && okAll;
okAll = chk('down 3, ball at their 25, 0:05 left', { hs: 17, as: 20, q: 4, clock: 5, poss: 'h', yl: 75, down: 1, togo: 10 }, 25, 60) && okAll;
okAll = chk('down 10, their ball, 0:40 left', { hs: 10, as: 20, q: 4, clock: 40, poss: 'a', yl: 50, down: 1, togo: 10 }, 0, 2) && okAll;
okAll = chk('up 7 at the half', { hs: 14, as: 7, q: 3, clock: 120, kick: 'a', poss: 'h', yl: 25, down: 1, togo: 10 }, 62, 85) && okAll;
okAll = chk('tied, OT, own ball at the 50', { hs: 10, as: 10, q: 5, clock: 100, poss: 'h', yl: 50, down: 1, togo: 10, po: true }, 55, 75) && okAll;
console.log(okAll ? '\nWP calibration OK' : '\nWP calibration: CHECK THE TABLE'); process.exitCode = okAll ? 0 : 1;
