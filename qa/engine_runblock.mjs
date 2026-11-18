// Run blocking diagnostics: bonds at the handoff, where first contact happens and who makes it.
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const book = E.buildPlaybook(), runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line' && p.carrier !== 'QB'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const S = { n: 0, handT: [], bondsAtHand: [], dlBondedAtHand: [], contactYd: [], who: {}, shedBefore: 0, unblocked: 0, sheds: [], bondsTotal: [], olNoBond: [] };
for (let i = 0; i < 200; i++) {
  let handed = false, contacted = false, sheds = 0;
  const op = pick(runs), dp = pick(defs);
  E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), op, dp), pl => {
    if (!handed && pl.handed) { handed = true; S.handT.push(pl.liveT); S.bondsAtHand.push(pl.O.filter(o => o.bond).length); S.dlBondedAtHand.push(pl.D.filter(d => d.dl && d.bondBy).length + '/' + pl.D.filter(d => d.dl).length); S.olNoBond.push(pl.O.filter(o => o.ol && !o.bond).map(o => o.slot + ':' + o.asg.t).join(',')); }
    for (const d of pl.D) if (d.lastShedBy && !d._shedSeen) { d._shedSeen = 1; sheds++; }
    if (handed && !contacted && pl.contactZ !== null) { contacted = true; const tk = pl.D.find(d => d.engaged || d.wrapped); S.contactYd.push((pl.contactZ - pl.losZ) / 0.9144); if (tk) { S.who[tk.posName] = (S.who[tk.posName] || 0) + 1; if (tk.lastShedBy) S.shedBefore++; else S.unblocked++; } }
  });
  S.sheds.push(sheds); S.n++;
}
const avg = a => (a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)).toFixed(2);
console.log(`runs ${S.n}  handoff at ${avg(S.handT)}s  OL/TE bonds at handoff ${avg(S.bondsAtHand)}  DL engaged at handoff: ${JSON.stringify(S.dlBondedAtHand.slice(0, 20))}`);
console.log(`first contact at ${avg(S.contactYd)} yds from LOS  (behind LOS: ${S.contactYd.filter(y => y < 0).length}/${S.contactYd.length})  made by ${JSON.stringify(S.who)}  shed first ${S.shedBefore}  never blocked ${S.unblocked}  sheds/play ${avg(S.sheds)}`);
console.log('OL without a block at handoff (sample):', S.olNoBond.slice(0, 12).join(' | '));
