// Step-by-step print of a lunge that misses.
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const book = E.buildPlaybook(), plays = book.filter(p => p.side === 'O' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
for (let i = 0; i < 300; i++) {
  const logs = new Map(); let done = false;
  E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), pick(plays), pick(defs)), pl => {
    if (done) return; const c = pl.carrier; if (!c) return;
    for (const d of pl.D) {
      if (d.lungeT > 0) { const L = logs.get(d) || []; logs.set(d, L); if (L.length % 3 === 0) L.push(`  lT=${d.lungeT.toFixed(2)} dist=${Math.hypot(d.p.x - c.p.x, d.p.z - c.p.z).toFixed(2)} dvel=${d.vel.x.toFixed(1)},${d.vel.z.toFixed(1)} want=${d.lungeVel.x.toFixed(1)},${d.lungeVel.z.toFixed(1)} cvel=${c.vel.x.toFixed(1)},${c.vel.z.toFixed(1)} bal=${d.bal} grip=${d.gripUse.toFixed(2)} th=${Math.hypot(d.th.x, d.th.z).toFixed(2)} dive=${d.diving ? 1 : 0} eng=${d.engaged ? 1 : 0} cjuke=${c.jukeT > 0 ? 1 : 0}`); else L.push(null); }
      else if (logs.has(d)) { const L = logs.get(d).filter(Boolean); if (!d.engaged && !d.wrapped && L.length) { console.log(`MISS by ${d.slot} on ${c.slot}`); console.log(L.join('\n')); done = true; } logs.delete(d); }
    }
  });
  if (done) break;
}
