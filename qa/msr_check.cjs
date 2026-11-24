// What deriving the athletic ratings from measurables does to a player: generate leagues with an OLD bundle (no measurables step),
// run this build's msrGen on a copy of every player and report the per-rating change (mean and spread) by position.
// Also checks that the back-fill for old saves (msrEnsure + msrOf) never touches a rating, and that msrRead(msrOf(p)) gives the ratings back.
// usage: node qa/msr_check.cjs <old sim.cjs> [leagues=2]
const path = require('path');
const OLD = require(path.resolve(process.argv[2])).LG, NEW = require(path.join(__dirname, '..', 'dist', 'sim.cjs')).LG;
const N = +(process.argv[3] || 2), T = NEW._t, keys = ['spd', 'acc', 'agi', 'str', 'jmp', 'pbk', 'prs', 'mcv', 'cth', 'car', 'tha', 'bsh', 'rbk'];
const d = {}, rt = {}; let touched = 0, n = 0;
for (let i = 0; i < N; i++) {
  OLD.newLeague({ diff: 'pro', qlen: 120 }); const L = OLD.state();
  for (const id in L.P) {
    const p = L.P[id], before = JSON.stringify(p.a); n++;
    const q = JSON.parse(JSON.stringify(p)); T.msrEnsure(q); T.msrOf(q); if (JSON.stringify(q.a) !== before) touched++;        // back-fill: ratings untouched
    const m = T.msrOf(q), r = T.msrRead(q.pos, m, q.ht, q.wt, q.ms), e = (rt[q.pos] = rt[q.pos] || {});
    for (const k in r) (e[k] = e[k] || []).push(r[k] - q.a[k]);                                                            // round trip
    const g = JSON.parse(JSON.stringify(p)); T.msrGen(g); const h = (d[p.pos] = d[p.pos] || {});
    for (const k of keys) (h[k] = h[k] || []).push(g.a[k] - p.a[k]);
  }
}
const ms = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; return [m, Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length)]; };
console.log(`${n} players. back-fill changed ratings for ${touched} of them (must be 0).`);
console.log('\nround trip msrRead(msrOf(p)) - rating, mean / max abs, by position');
for (const pos in rt) console.log(pos.padEnd(4), Object.entries(rt[pos]).map(([k, a]) => `${k} ${ms(a)[0].toFixed(2)}/${Math.max(...a.map(Math.abs)).toFixed(1)}`).join('  '));
console.log('\nmsrGen change to each rating: mean ± sd (new player = old generation + measurables step)');
for (const pos in d) console.log(pos.padEnd(4), keys.map(k => { const [m, s] = ms(d[pos][k]); return `${k} ${m >= 0 ? '+' : ''}${m.toFixed(2)}±${s.toFixed(1)}`; }).join('  '));
