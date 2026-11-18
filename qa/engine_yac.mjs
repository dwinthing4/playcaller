// What does the defense look like at the moment of the catch, for long gains vs short ones?
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const book = E.buildPlaybook(), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const rows = [];
for (let i = 0; i < 300; i++) {
  let snap = null;
  const res = E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), pick(passes), pick(defs)), pl => {
    if (!snap && pl.catcher && pl.carrier === pl.catcher) { const c = pl.catcher; const ds = pl.D.filter(d => d.upright()).map(d => Math.hypot(d.p.x - c.p.x, d.p.z - c.p.z)).sort((a, b) => a - b);
      const ahead = pl.D.filter(d => d.upright() && d.p.z > c.p.z).length; snap = { near: ds[0], n5: ds.filter(x => x < 5).length, ahead, sp: Math.hypot(c.vel.x, c.vel.z) }; }
  });
  if (snap && res.catcher != null && res.turnover !== 'int') { const miss = Object.values(res.perf).reduce((s, f) => s + f.notes.filter(n => n === 'Missed tackle').length, 0); rows.push({ yac: res.yards - res.airYds, ...snap, miss, br: res.broken }); }
}
const grp = (f) => { const r = rows.filter(f); const a = k => (r.reduce((s, x) => s + x[k], 0) / Math.max(1, r.length)).toFixed(2); return `n=${r.length} nearestDef ${a('near')}m  within5m ${a('n5')}  defendersAhead ${a('ahead')}  catchSpeed ${a('sp')}  missedTackles ${a('miss')}  gripBreaks ${a('br')}`; };
console.log('YAC >= 20:', grp(r => r.yac >= 20));
console.log('YAC < 5  :', grp(r => r.yac < 5));
