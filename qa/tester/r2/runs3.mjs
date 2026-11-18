// Headless (qa2 engine): run schemes in depth. Per scheme: ypc, TFL rate, where the first contact happens, who makes it (DL/LB/DB),
// handoff time and depth. Draws are meant to "fool the rush": do rushers still reach the back behind the line?
import vm from 'vm';
import { SNAP_CODE } from './snapcode2.mjs';
import { makeTeam, starters } from '../../engine_lib.mjs';
const E = vm.runInContext(SNAP_CODE, vm.createContext({ console, Math, Date, JSON }));
const { PHYS } = E; const DT = PHYS.DT || 1 / 120; const YD = 0.9144;
const book = E.buildPlaybook();
const runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line' && !p.qbRun);
const defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const N = +(process.argv[2] || 250);
const by = {};
for (const sch of [...new Set(runs.map(p => p.scheme))]) {
  const pool = runs.filter(p => p.scheme === sch); const o = by[sch] = { plays: pool.map(p => p.name).join('/'), n: 0, y: 0, tfl: 0, c0: 0, contactYd: 0, nC: 0, byPos: {}, handT: 0, handZ: 0, nH: 0 };
  for (let i = 0; i < N; i++) {
    const op = pick(pool), dp = pick(defs);
    const pl = new PHYS.Play({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: 0, list: starters(E, makeTeam(72), op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, makeTeam(72), dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: (Math.random() * 1e9) | 0 });
    let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); } if (pl.phase === 'pre') pl.goLive();
    let m = 0, handed = false, first = null;
    while (pl.phase === 'live' && m < 3600) { pl.step(DT); m++; if (m % 4 === 0) pl.updatePoses();
      if (!handed && pl.handed) { handed = true; o.handT += pl.liveT; o.handZ += (pl.carrier ? (pl.carrier.p.z - pl.losZ) / YD : 0); o.nH++; }
      if (!first && pl.carrier && pl.carrier !== pl.qb && pl.contactZ != null) { const d = pl.D.filter(x => x.wrapped).concat(pl.D.filter(x => x.engaged === pl.carrier))[0] || pl.D.slice().sort((a, b) => Math.hypot(a.p.x - pl.carrier.p.x, a.p.z - pl.carrier.p.z) - Math.hypot(b.p.x - pl.carrier.p.x, b.p.z - pl.carrier.p.z))[0]; first = { z: (pl.contactZ - pl.losZ) / YD, pos: d.dl ? 'DL' : d.posName === 'LB' ? 'LB' : 'DB', t: pl.liveT }; } }
    const r = pl.result; o.n++; o.y += r.yards; if (r.yards < 0) o.tfl++; if (first) { o.nC++; o.contactYd += first.z; if (first.z < 0) o.c0++; o.byPos[first.pos] = (o.byPos[first.pos] || 0) + 1; }
  }
}
for (const k in by) { const o = by[k]; console.log(`${k.padEnd(8)} n ${o.n} ypc ${(o.y / o.n).toFixed(2)} TFL ${(o.tfl / o.n * 100).toFixed(0)}% | first contact at ${(o.contactYd / Math.max(1, o.nC)).toFixed(2)} yd (behind LOS ${(o.c0 / Math.max(1, o.nC) * 100).toFixed(0)}%) by ${JSON.stringify(o.byPos)} | handoff at ${(o.handT / Math.max(1, o.nH)).toFixed(2)} s, ${(o.handZ / Math.max(1, o.nH)).toFixed(1)} yd | plays ${o.plays}`); }
