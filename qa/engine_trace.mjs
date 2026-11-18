// Trace a run play until a long gain happens, then print what every defender was doing.
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const book = E.buildPlaybook(), runs = book.filter(p => p.side === 'O' && p.type === (process.argv[2] || 'run') && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
for (let tries = 0; tries < 200; tries++) {
  const op = pick(runs), dp = pick(defs), log = [];
  const res = E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), op, dp), pl => {
    if (Math.abs(pl.liveT * 2 - Math.round(pl.liveT * 2)) < 0.004 && pl.carrier) {
      const c = pl.carrier;
      log.push(`t=${pl.liveT.toFixed(1)} carrier ${c.slot} at x=${c.p.x.toFixed(1)} z=${((c.p.z - pl.losZ) / 0.9144).toFixed(1)}yd v=${Math.hypot(c.vel.x, c.vel.z).toFixed(1)} bal=${c.bal} handed=${pl.handed}`);
      for (const d of pl.D) log.push(`   ${d.slot.padEnd(4)} ${d.posName} job=${d.job} fit=${d.fit || '-'} bal=${d.bal} bond=${d.bondBy ? d.bondBy.slot : '-'} wr=${d.wrapped ? 1 : 0} lunge=${d.lungeT.toFixed(2)} cd=${d.cooldown.toFixed(2)} dist=${Math.hypot(d.p.x - c.p.x, d.p.z - c.p.z).toFixed(1)} v=${Math.hypot(d.vel.x, d.vel.z).toFixed(1)}/${d.vmax.toFixed(1)} dz=${((d.p.z - c.p.z)).toFixed(1)}`);
    }
  });
  if (res.yards > 25) { console.log(`${op.name} vs ${dp.name}: ${res.type} ${res.yards.toFixed(1)} yds, broken ${res.broken}`); console.log(log.slice(0, 160).join('\n')); break; }
}
