// YAC anatomy on league-realistic short completions: yards before first contact vs after, time to first contact,
// how many defenders were within 5 m at the catch, and how the play ended.
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const N = +(process.argv[2] || 400), YD = 0.9144;
{ let s = +(process.env.SEED || 20261117) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } // SEEDED_LEAGUE: same league every run
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id);
const passes = L.plays.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line');
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
const rows = [];
for (let i = 0; i < N; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], yl = 25 + (i * 13) % 45;
  const op = passes[i % passes.length], dp = byId(LG.cpuCall(d.id, 'D', { side: 'D', tid: d.id, oppTid: o.id, down: 1, togo: 10, yl, q: 1, clock: 100, qlen: 120, sd: 0, offForm: op.form }));
  let catchT = null, catchZ = null, n5 = 0, near = 0, contactT = null, contactZ = null, spd = 0, chasers = 0;
  const res = PHYS.runPlay({ losZ: yl * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0 }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: i * 77 + 5, fatigue: {} }, pl => {
    const c = pl.carrier; if (!c || pl.catcher !== c) return;
    if (catchT === null) { catchT = pl.t; catchZ = c.p.z; const ds = pl.D.filter(x => x.upright()).map(x => Math.hypot(x.p.x - c.p.x, x.p.z - c.p.z)); near = Math.min(...ds); n5 = ds.filter(x => x < 5).length; chasers = pl.D.filter(x => x.upright() && x.p.z > c.p.z).length; }
    if (contactT === null && pl.D.some(x => x.wrapped || (x.engaged && Math.hypot(x.p.x - c.p.x, x.p.z - c.p.z) < 1.3))) { contactT = pl.t; contactZ = c.p.z; spd = Math.hypot(c.vel.x, c.vel.z); }
  });
  if (catchT === null || res.turnover) continue;
  const air = res.airYds, yac = res.yards - air; if (air > 10) continue;
  rows.push({ air, yac, before: contactZ != null ? (contactZ - catchZ) / YD : yac, after: contactZ != null ? (res.spotZ - contactZ) / YD : 0, tc: contactT != null ? contactT - catchT : null, near, n5, chasers, type: res.type, td: !!res.td, broken: res.broken, op: op.name, dp: dp.name });
}
const avg = (a, k) => (a.reduce((s, r) => s + (r[k] ?? 0), 0) / Math.max(1, a.length)).toFixed(2);
console.log(`${rows.length} short completions (air <= 10): YAC ${avg(rows, 'yac')}  before first contact ${avg(rows, 'before')}  after contact ${avg(rows, 'after')}  time to contact ${avg(rows.filter(r => r.tc != null), 'tc')}s  nearest def at catch ${avg(rows, 'near')}m  defs within 5m ${avg(rows, 'n5')}  defs downfield ${avg(rows, 'chasers')}`);
console.log(`no contact before the whistle: ${rows.filter(r => r.tc == null).length} (TD ${rows.filter(r => r.td).length}, oob ${rows.filter(r => r.type === 'oob').length})`);
const big = rows.filter(r => r.yac >= 12); console.log(`YAC >= 12: ${big.length}: before ${avg(big, 'before')} after ${avg(big, 'after')} near ${avg(big, 'near')} n5 ${avg(big, 'n5')} t->contact ${avg(big.filter(r => r.tc != null), 'tc')}`);
const small = rows.filter(r => r.yac < 4); console.log(`YAC < 4: ${small.length}: near ${avg(small, 'near')} n5 ${avg(small, 'n5')}`);
const byOp = {}; for (const r of rows) (byOp[r.op] = byOp[r.op] || []).push(r); console.log(Object.entries(byOp).map(([k, a]) => `${k} ${a.length}x yac ${avg(a, 'yac')}`).join(' | '));
