// Ratings and measurables by position over generated leagues: a before/after check that deriving the athletic ratings
// from measurables leaves the engine's inputs where they were, plus the 40 / 3-cone / vertical / bench spread per position.
// usage: node tools/build.mjs && node qa/msr_dist.cjs [leagues=3] [sim=dist/sim.cjs] [compare.json]
const path = require('path'), fs = require('fs');
const N = +(process.argv[2] || 3), simPath = path.resolve(process.argv[3] || path.join(__dirname, '..', 'dist', 'sim.cjs')), cmp = process.argv[4];
// SEED=n: the same leagues every run (the bundle captures Math.random at load, so seed it first). The measurables code draws
// nothing from R(), so a seeded before/after pair is the same league with only the measurables step changed.
if (process.env.SEED) { let s = +process.env.SEED >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const { LG } = require(simPath);
const acc = {}, ms = {};
for (let i = 0; i < N; i++) {
  LG.newLeague({ diff: 'pro', qlen: 120 }); const L = LG.state();
  for (const id in L.P) {
    const p = L.P[id]; const g = (acc[p.pos] = acc[p.pos] || { n: 0, s: {}, q: {} }); g.n++;
    const add = (k, v) => { g.s[k] = (g.s[k] || 0) + v; g.q[k] = (g.q[k] || 0) + v * v; };
    for (const k in p.a) add(k, p.a[k]); add('ovr', p.ovr); add('pot', p.pot); add('ht', p.ht); add('wt', p.wt);
    if (LG._t.msrOf) { const m = LG._t.msrOf(p); const h = (ms[p.pos] = ms[p.pos] || {}); for (const k of ['forty', 'ten', 'cone', 'shuttle', 'vert', 'broad', 'bench', 'arm', 'hand']) (h[k] = h[k] || []).push(m[k]); }
  }
}
const out = {};
for (const pos in acc) { const g = acc[pos]; out[pos] = { n: g.n }; for (const k in g.s) { const m = g.s[k] / g.n; out[pos][k] = [+m.toFixed(2), +Math.sqrt(Math.max(0, g.q[k] / g.n - m * m)).toFixed(2)]; } }
const keys = ['spd', 'acc', 'agi', 'str', 'jmp', 'cth', 'pbk', 'prs', 'mcv', 'ovr', 'pot', 'ht', 'wt'];
const base = cmp && fs.existsSync(cmp) ? JSON.parse(fs.readFileSync(cmp, 'utf8')) : null;
console.log('mean ± sd by position' + (base ? '   (Δmean vs ' + path.basename(cmp) + ' in brackets)' : ''));
console.log('pos  ' + keys.map(k => k.padStart(base ? 16 : 11)).join(''));
for (const pos of Object.keys(out)) console.log(pos.padEnd(5) + keys.map(k => { const v = out[pos][k]; if (!v) return '-'.padStart(base ? 16 : 11); const b = base && base[pos] && base[pos][k]; return (v[0].toFixed(1) + '±' + v[1].toFixed(1) + (b ? ' [' + (v[0] - b[0] >= 0 ? '+' : '') + (v[0] - b[0]).toFixed(1) + ']' : '')).padStart(base ? 16 : 11); }).join(''));
if (process.env.SAVE) fs.writeFileSync(process.env.SAVE, JSON.stringify(out, null, 1));
if (Object.keys(ms).length) {
  const q = (a, f) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * f))] : null; };
  const f = (v, d) => v == null ? '-' : v.toFixed(d);
  console.log('\nmeasurables by position: median [10th..90th percentile]');
  for (const pos of Object.keys(ms)) { const h = ms[pos];
    console.log(pos.padEnd(4), ['forty', 'ten', 'cone', 'shuttle', 'vert', 'broad', 'bench', 'arm', 'hand'].map(k => { const d = ['vert', 'arm', 'hand'].includes(k) ? 1 : ['broad', 'bench'].includes(k) ? 0 : 2; return `${k} ${f(q(h[k], .5), d)} [${f(q(h[k], .1), d)}..${f(q(h[k], .9), d)}]`; }).join('  ')); }
}
