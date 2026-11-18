// Trace a man-coverage rep that ends with the defender > 5 m from his receiver at the catch.
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const YD = 0.9144, skip = +(process.argv[2] || 0);
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state();
const passes = L.plays.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line');
const mans = L.plays.filter(p => p.side === 'D' && ['c0', 'c1', 'c2m'].includes(p.cov) && p.form !== 'Goal Line D');
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
let found = 0;
for (let i = 0; i < 200; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], op = passes[i % passes.length], dp = mans[i % mans.length];
  const tr = new Map(); let out = null;
  PHYS.runPlay({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0 }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: i * 13 + 1, fatigue: {} }, pl => {
    if (out) return;
    for (const r of pl.receivers) { const m = pl.D.find(x => x.cover === r); if (!m) continue; const a = tr.get(r) || []; tr.set(r, a);
      if (Math.round(pl.liveT * 100) % 20 === 0) a.push(`t=${pl.liveT.toFixed(2)} R ${r.slot}/${r.routeName} (${r.p.x.toFixed(1)},${((r.p.z - pl.losZ) / YD).toFixed(1)}yd) v(${r.vel.x.toFixed(1)},${r.vel.z.toFixed(1)}) ri=${r.ri} | ${m.slot}(${m.posName} mcv${m.A.mcv} spd${m.A.spd}) (${m.p.x.toFixed(1)},${((m.p.z - pl.losZ) / YD).toFixed(1)}yd) v(${m.vel.x.toFixed(1)},${m.vel.z.toFixed(1)}) d=${Math.hypot(m.p.x - r.p.x, m.p.z - r.p.z).toFixed(1)} ${m.bondBy ? 'BLOCKED ' : ''}${m.upright() ? '' : 'DOWN '}${m.bal}${m.stun > 0 ? ' stun' : ''} job=${m.job}`); }
    if (pl.catcher && pl.carrier === pl.catcher) { const r = pl.catcher, m = pl.D.find(x => x.cover === r); if (m && Math.hypot(m.p.x - r.p.x, m.p.z - r.p.z) > 5) out = { r, m, a: tr.get(r) }; else out = 'no'; }
  });
  if (out && out !== 'no') { if (found++ < skip) continue; console.log(`${op.name} vs ${dp.name}`); console.log(out.a.join('\n')); break; }
}
