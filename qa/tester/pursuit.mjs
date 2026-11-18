import { SNAP_CODE } from './snapcode.mjs';
// Pursuit sanity: once the carrier is past the line, how much of the time do free (unblocked, upright, not
// lunging) defenders within 12 m run AWAY from him, stand still, or reverse direction (jitter)?
import fs from 'fs'; import vm from 'vm';
import { starters, makeTeam } from '../engine_lib.mjs';
const code = SNAP_CODE;
const E = vm.runInContext(code, vm.createContext({ console, Math, Date, JSON })); const { PHYS } = E; const DT = 1 / 120, YD = 0.9144;
const book = E.buildPlaybook(), offs = book.filter(p => p.side === 'O' && p.form !== 'Goal Line' && !/Kneel/.test(p.name)), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
let samples = 0, away = 0, still = 0, flips = 0, flipBase = 0; const worst = [];
for (let i = 0; i < +(process.argv[2] || 300); i++) {
  const op = pick(offs), dp = pick(defs);
  const pl = new PHYS.Play({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: 0, list: starters(E, makeTeam(72), op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, makeTeam(72), dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: (Math.random() * 1e9) | 0 });
  let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); } if (pl.phase === 'pre') pl.goLive();
  const lastDir = new Map(); let m = 0, playAway = 0, playS = 0;
  while (pl.phase === 'live' && m < 3600) { pl.step(DT); m++; if (m % 4) continue; pl.updatePoses();
    const c = pl.carrier; if (!c || c.unit !== 'O' || pl.ball.state !== 'held' || c.p.z < pl.losZ + 1 || c === pl.qb && pl.pass && !pl.thrown) continue;
    for (const d of pl.D) { if (!d.upright() || d.bondBy || d.wrapped || d.lungeT > 0 || d.engaged) continue; const dx = c.p.x - d.p.x, dz = c.p.z - d.p.z, dist = Math.hypot(dx, dz); if (dist > 12 || dist < 1.2) continue;
      const sp = Math.hypot(d.vel.x, d.vel.z); samples++; playS++;
      if (sp < 1.0) still++; else { const dot = (d.vel.x * dx + d.vel.z * dz) / (sp * dist); if (dot < -0.2) { away++; playAway++; } }
      const ld = lastDir.get(d.id); if (sp > 2.5) { const a = Math.atan2(d.vel.x, d.vel.z); if (ld != null) { flipBase++; let da = Math.abs(a - ld); if (da > Math.PI) da = 2 * Math.PI - da; if (da > 2.0) flips++; } lastDir.set(d.id, a); } }
  }
  if (playS > 30) worst.push({ f: +(playAway / playS).toFixed(2), op: op.name, dp: dp.name, res: pl.result && `${pl.result.type} ${Math.round(pl.result.yards)}` });
}
console.log(`samples ${samples}: running AWAY from the carrier ${(away / samples * 100).toFixed(1)}%, standing (<1 m/s) ${(still / samples * 100).toFixed(1)}%, >115deg direction flips per 33ms ${(flips / Math.max(1, flipBase) * 100).toFixed(2)}%`);
console.log('plays with most away-running:', JSON.stringify(worst.sort((a, b) => b.f - a.f).slice(0, 6)));
