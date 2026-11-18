// Step trace of the first long-YAC short completion: carrier and the 4 nearest defenders every 0.15 s after the catch.
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const YD = 0.9144, skip = +(process.argv[2] || 0);
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id);
const passes = L.plays.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line');
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
let found = 0;
for (let i = 0; i < 400; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], yl = 25 + (i * 13) % 45;
  const op = passes[i % passes.length], dp = byId(LG.cpuCall(d.id, 'D', { side: 'D', tid: d.id, oppTid: o.id, down: 1, togo: 10, yl, q: 1, clock: 100, qlen: 120, sd: 0, offForm: op.form }));
  const lines = []; let catchT = null, lastT = -1;
  const res = PHYS.runPlay({ losZ: yl * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0 }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: i * 77 + 5, fatigue: {} }, pl => {
    const c = pl.carrier; if (!c || pl.catcher !== c) return; if (catchT === null) catchT = pl.t;
    if (pl.t - lastT < 0.3 || pl.t - catchT > 1.9) return; lastT = pl.t;
    const ds = pl.D.map(x => ({ x, dist: Math.hypot(x.p.x - c.p.x, x.p.z - c.p.z) })).sort((a, b) => a.dist - b.dist).slice(0, 5);
    lines.push(`t+${(pl.t - catchT).toFixed(2)} C(${c.p.x.toFixed(1)},${((c.p.z - pl.losZ) / YD).toFixed(1)}yd) v=(${c.vel.x.toFixed(1)},${c.vel.z.toFixed(1)}) | ` + ds.map(({ x, dist }) => { const n = { x: (c.p.x - x.p.x) / dist, z: (c.p.z - x.p.z) / dist }, cl = (x.vel.x - c.vel.x) * n.x + (x.vel.z - c.vel.z) * n.z;
      return `${x.slot}:${dist.toFixed(1)}m sp${Math.hypot(x.vel.x, x.vel.z).toFixed(1)} cl${cl.toFixed(1)} ${x.fit || '-'}${x.bondBy ? ' BLOCKED' : ''}${x.lungeT > 0 ? ' LUNGE' : ''}${x.wrapped ? ' WRAP' : ''}${!x.upright() ? ' DOWN' : ''}${x.cooldown > 0 ? ' cd' : ''}`; }).join(' | '));
  });
  if (catchT === null || res.turnover) continue; const air = res.airYds, yac = res.yards - air; if (air > 10 || yac < 12) continue;
  if (found++ < skip) continue;
  console.log(`${op.name} vs ${dp.name}: air ${air.toFixed(1)} yac ${yac.toFixed(1)} end ${res.type}`); console.log(lines.join('\n')); break;
}
