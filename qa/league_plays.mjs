// Plays run exactly like MATCH runs them: a generated league, depth-chart starters, CPU play calls for both sides.
// Reports run / pass outcomes overall and per play family, so engine tuning targets what real games produce.
// run: node tools/build.mjs && node qa/league_plays.mjs [plays=600]
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const N = +(process.argv[2] || 600), YD = 0.9144;
{ let s = +(process.env.SEED || 20261117) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } // SEEDED_LEAGUE: same league every run
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id);
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
const rows = [], MANS = { c0: 1, c1: 1, c2m: 1 };
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32];
  const down = 1 + (i % 3), togo = [10, 6, 3][i % 3], yl = 20 + (i * 13) % 55;
  const ctx = { side: 'O', tid: o.id, oppTid: d.id, down, togo, yl, q: 1 + (i % 4), clock: 100, qlen: 120, sd: 0 };
  const op = byId(LG.cpuCall(o.id, 'O', ctx)), dp = byId(LG.cpuCall(d.id, 'D', Object.assign({}, ctx, { side: 'D', tid: d.id, oppTid: o.id, offForm: op.form })));
  let tgtAir = null, sep = null, sepJob = null, tgtRoute = null, land = null, tgt = null, missD = null; const hook = pl => { if (tgtAir === null && pl.ball.state === 'air' && pl.ball.target) { tgtAir = (pl.ball.land.z - pl.losZ) / YD; let m = 99, mj = null; for (const dd of pl.D) { const x = Math.hypot(dd.p.x - pl.ball.target.p.x, dd.p.z - pl.ball.target.p.z); if (x < m) { m = x; mj = dd.cover === pl.ball.target ? 'his man' : dd.job + (dd.zone ? (dd.zone.deep ? '-deep' : '-under') : ''); } } sep = m; sepJob = mj; tgtRoute = pl.ball.target.routeName + (pl.ball.target.ri >= (pl.ball.target.route || []).length ? '(done)' : `(leg ${pl.ball.target.ri})`); land = pl.ball.land; tgt = pl.ball.target; }
    if (land && !missD && pl.ball.state !== 'air') { missD = Math.hypot(tgt.p.x - land.x, tgt.p.z - land.z); } };
  const res = PHYS.runPlay({ losZ: yl * YD, ballX: [0, -5.6, 5.6][i % 3] * 0.9, down, togo, op: Object.assign({}, op, { flip: i % 2 === 1 }), dp,
    off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0, style: o.offStyle }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0, style: d.defStyle }, userSide: null, diff: 'pro', seed: i * 7919 + 13, fatigue: process.env.FAT ? new Proxy({}, { get: () => +process.env.FAT }) : {} }, hook);
  rows.push({ op, dp, res, y: res.yards || 0, tgtAir, sep, sepJob, tgtRoute, missD });
}
const sec = (Date.now() - t0) / 1000;
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : '-');
const runs = rows.filter(r => r.op.type === 'run'), passes = rows.filter(r => r.op.type === 'pass');
const sum = (a, f) => a.reduce((s, r) => s + f(r), 0), med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const runLine = a => `n=${a.length} ypc ${(sum(a, r => r.y) / Math.max(1, a.length)).toFixed(2)} med ${med(a.map(r => r.y)).toFixed(1)} <=0 ${pct(a.filter(r => r.y <= 0).length, a.length)} 10+ ${pct(a.filter(r => r.y >= 10).length, a.length)} 20+ ${pct(a.filter(r => r.y >= 20).length, a.length)} fum ${a.filter(r => r.res.type === 'fumbleLost').length}`;
console.log(`${N} plays in ${sec.toFixed(1)}s`);
console.log('RUN  ', runLine(runs));
const sacks = passes.filter(r => r.res.sack), att = passes.filter(r => !r.res.sack && r.res.passer != null), comp = att.filter(r => r.res.catcher != null && r.res.turnover !== 'int'), ints = passes.filter(r => r.res.turnover === 'int');
const scr = passes.filter(r => !r.res.sack && r.res.passer == null);
console.log(`PASS  n=${passes.length} att ${att.length} comp ${pct(comp.length, att.length)} ypa ${(sum(att, r => r.res.turnover === 'int' ? 0 : r.y) / Math.max(1, att.length)).toFixed(2)} sack ${pct(sacks.length, passes.length)} int ${pct(ints.length, att.length)} scrambles ${scr.length} (avg ${(sum(scr, r => r.y) / Math.max(1, scr.length)).toFixed(1)})`);
console.log(`      air ${(sum(comp, r => r.res.airYds || 0) / Math.max(1, comp.length)).toFixed(1)} yac ${(sum(comp, r => r.y - (r.res.airYds || 0)) / Math.max(1, comp.length)).toFixed(1)}  20+ ${pct(comp.filter(r => r.y >= 20).length, att.length)} 40+ ${pct(comp.filter(r => r.y >= 40).length, att.length)} TD ${comp.filter(r => r.res.td).length}  pressured ${pct(passes.filter(r => r.res.pressured).length, passes.length)} throwT ${(sum(att, r => r.res.throwT || 0) / Math.max(1, att.length)).toFixed(2)}s`);
{ const tg = passes.filter(r => r.tgtAir !== null), B = [[-10, 0], [0, 10], [10, 20], [20, 99]];
  { const cc = comp.map(r => r.y - (r.res.airYds || 0)).sort((a, b) => a - b), q = f => cc[Math.floor(cc.length * f)]?.toFixed(1); console.log(`YAC per completion: p25 ${q(0.25)} median ${q(0.5)} p75 ${q(0.75)} p90 ${q(0.9)} p95 ${q(0.95)}`); }
  console.log('targets by depth (air yards at the throw):'); for (const [a, b] of B) { const x = tg.filter(r => r.tgtAir >= a && r.tgtAir < b), c = x.filter(r => r.res.catcher != null && r.res.turnover !== 'int'); console.log(`   ${String(a).padStart(3)}..${b}: ${pct(x.length, tg.length)} of targets, comp ${pct(c.length, x.length)}, int ${x.filter(r => r.res.turnover === 'int').length}, avg gain ${(sum(x, r => r.res.turnover === 'int' ? 0 : r.y) / Math.max(1, x.length)).toFixed(1)}, sep at throw ${(sum(x, r => r.sep) / Math.max(1, x.length)).toFixed(1)}m`); }
  { const sh = tg.filter(r => r.tgtAir < 10), g = {}; for (const r of sh) { const k = `${MANS[r.dp.cov] ? 'man ' : 'zone'} nearest=${r.sepJob}`; (g[k] = g[k] || []).push(r); }
    console.log('short targets, separation at the throw by who is nearest:'); for (const [k, a] of Object.entries(g).sort((x, y) => y[1].length - x[1].length).slice(0, 8)) console.log(`   ${k.padEnd(30)} n=${String(a.length).padStart(3)} sep ${(sum(a, r => r.sep) / a.length).toFixed(1)}m gain ${(sum(a, r => r.y) / a.length).toFixed(1)}`); }
  { const nb = passes.filter(r => r.res.type === 'inc' && /Nobody/.test(r.res.text || '')), g = {}; for (const r of nb) g[r.tgtRoute] = (g[r.tgtRoute] || 0) + 1;
    console.log(`"nobody there": ${nb.length}, receiver ${(sum(nb, r => r.missD || 0) / Math.max(1, nb.length)).toFixed(1)}m from the landing spot; air ${(sum(nb, r => r.tgtAir || 0) / Math.max(1, nb.length)).toFixed(1)}yd; by route`, JSON.stringify(g)); }
  const inc = {}; for (const r of passes.filter(r => r.res.type === 'inc')) { const k = (r.res.text || '').replace(/^[A-Z][^ ]* [^ ]+ /, '').replace(/[A-Z]\. ?[A-Za-z']+/g, 'X'); inc[k] = (inc[k] || 0) + 1; } console.log('incompletions:', JSON.stringify(inc)); }
const by = (a, k) => { const m = {}; for (const r of a) (m[k(r)] = m[k(r)] || []).push(r); return m; };
console.log('\nruns by scheme:'); for (const [k, a] of Object.entries(by(runs, r => r.op.scheme || r.op.dir || '?'))) console.log('  ', k.padEnd(9), runLine(a));
console.log('runs by def front:'); for (const [k, a] of Object.entries(by(runs, r => r.dp.form))) console.log('  ', k.padEnd(11), runLine(a));
console.log('passes by coverage:'); for (const [k, a] of Object.entries(by(passes, r => r.dp.cov))) { const at = a.filter(r => !r.res.sack && r.res.passer != null), c = at.filter(r => r.res.catcher != null && r.res.turnover !== 'int'); console.log('  ', k.padEnd(5), `n=${a.length} comp ${pct(c.length, at.length)} ypa ${(sum(at, r => r.res.turnover === 'int' ? 0 : r.y) / Math.max(1, at.length)).toFixed(1)} sack ${pct(a.filter(r => r.res.sack).length, a.length)}`); }
const types = {}; for (const r of rows) types[r.res.type] = (types[r.res.type] || 0) + 1; console.log('\nend types', JSON.stringify(types));
