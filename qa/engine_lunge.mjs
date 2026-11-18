// How often do lunges connect, and how close do misses get?
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const book = E.buildPlaybook(), plays = book.filter(p => p.side === 'O' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const L = { n: 0, hit: 0, miss: 0, missDist: [], startDist: [], fallAfterMiss: 0, dive: 0, diveHit: 0 };
for (let i = 0; i < 150; i++) {
  const track = new Map();
  E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), pick(plays), pick(defs)), pl => {
    const c = pl.carrier; if (!c) return;
    for (const d of pl.D) {
      const dist = Math.hypot(d.p.x - c.p.x, d.p.z - c.p.z);
      if (d.lungeT > 0) { let t = track.get(d); if (!t) { t = { start: dist, min: dist, dive: d.diving, hit: false, end: null }; track.set(d, t); L.n++; if (d.diving) L.dive++; L.startDist.push(dist); } t.min = Math.min(t.min, dist); if (d.engaged || d.wrapped) t.hit = true; }
      else { const t = track.get(d); if (t && t.end === null) { t.end = pl.t; if (d.engaged || d.wrapped || t.hit) { L.hit++; if (t.dive) L.diveHit++; } else { L.miss++; L.missDist.push(t.min); t.watch = pl.t; } } if (t && t.watch && pl.t - t.watch < 0.8 && !d.upright()) { L.fallAfterMiss++; t.watch = null; } if (t && !d.lungeT && t.end !== null && pl.t - t.end > 0.4) track.delete(d); }
    }
  });
}
const avg = a => (a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)).toFixed(2);
console.log(`lunges ${L.n}  hit ${L.hit}  miss ${L.miss}  (${(100 * L.hit / Math.max(1, L.hit + L.miss)).toFixed(0)}% connect)  avg start dist ${avg(L.startDist)}  avg closest on a miss ${avg(L.missDist)}  fell after a miss ${L.fallAfterMiss}  dives ${L.dive} (hit ${L.diveHit})`);
const h = {}; for (const m of L.missDist) { const k = m.toFixed(1); h[k] = (h[k] || 0) + 1; } console.log('closest-approach histogram on misses:', JSON.stringify(Object.fromEntries(Object.entries(h).sort())));
