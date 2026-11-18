// Find a long gain and print the chase: who was closest, their speed, mode, and why they didn't close.
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const kind = process.argv[2] || 'run';
const book = E.buildPlaybook(), plays = book.filter(p => p.side === 'O' && p.type === kind && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
let J = [];
for (let tries = 0; tries < 300; tries++) {
  const op = pick(plays), dp = pick(defs), log = []; let lastT = -1;
  const res = E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), op, dp), pl => {
    const c = pl.carrier; if (!c || pl.ball.state !== 'held') return;
    if (pl.liveT - lastT < 0.4) return; lastT = pl.liveT;
    const ds = pl.D.map(d => ({ d, dist: Math.hypot(d.p.x - c.p.x, d.p.z - c.p.z) })).sort((a, b) => a.dist - b.dist).slice(0, 4);
    log.push(`t=${pl.liveT.toFixed(1)} ${c.slot} x=${c.p.x.toFixed(1)} +${((c.p.z - pl.losZ) / 0.9144).toFixed(1)}yd v=${Math.hypot(c.vel.x, c.vel.z).toFixed(1)}/${c.vmax.toFixed(1)} bal=${c.bal} wraps=${pl.wrapCount}`);
    for (const { d, dist } of ds) log.push(`   ${d.slot.padEnd(4)} ${d.posName} fit=${d.fit || '-'} job=${d.job} bal=${d.bal} bond=${d.bondBy ? d.bondBy.slot : '-'} eng=${d.engaged ? 1 : 0} wr=${d.wrapped ? 1 : 0} lunge=${d.lungeT.toFixed(2)} cd=${d.cooldown.toFixed(2)} dist=${dist.toFixed(1)} v=${Math.hypot(d.vel.x, d.vel.z).toFixed(1)}/${d.vmax.toFixed(1)} behind=${((c.p.z - d.p.z)).toFixed(1)} crouch=${d.crouch.toFixed(2)} des=${d._dbg ? d._dbg.map(x => x.toFixed(1)).join(',') : '-'} vel=${d.vel.x.toFixed(1)},${d.vel.z.toFixed(1)} toC=${(c.p.x - d.p.x).toFixed(1)},${(c.p.z - d.p.z).toFixed(1)} cvel=${c.vel.x.toFixed(1)},${c.vel.z.toFixed(1)} gf=${d.gripUse.toFixed(2)} th=${Math.hypot(d.th.x, d.th.z).toFixed(2)}`);
  });
  if (res.yards > 30) { console.log(`${op.name} vs ${dp.name}: ${res.type} ${res.yards.toFixed(1)} yds, grip breaks ${res.broken}, bounces ${res.bounces}`); console.log(log.slice(0, 90).join('\n')); console.log(res.events.map(e => `${e.t.toFixed(1)} ${e.text}`).join('\n')); break; }
}
