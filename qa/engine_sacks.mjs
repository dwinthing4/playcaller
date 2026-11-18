// Who gets the sacks, how fast, and were they ever blocked?
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const book = E.buildPlaybook(), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const S = { n: 0, sacks: 0, by: {}, never: 0, shed: 0, t: [], rushers: [], blockers: [], qbz: [], noBlockers: 0 };
for (let i = 0; i < 250; i++) {
  const op = pick(passes), dp = pick(defs); const bonded = new Set(); let info = null;
  const res = E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), op, dp), pl => {
    for (const d of pl.D) if (d.bondBy) bonded.add(d.slot);
    if (!info && pl.liveT > 0.5) info = { rush: pl.D.filter(d => d.job === 'rush').length, pro: pl.O.filter(o => o.ol || o.role === 'pp').length };
  });
  S.n++;
  if (res.type === 'sack') {
    S.sacks++; S.t.push(res.t); S.rushers.push(info ? info.rush : 0); S.blockers.push(info ? info.pro : 0);
    const pid = res.tacklers[0]; const pl = null;
    const st = Object.entries(res.stats).find(([k, v]) => v.sk >= 1);
    const who = st ? st[0] : '?'; S.by[who] = 1;
  }
}
const avg = a => (a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)).toFixed(2);
console.log(`dropbacks ${S.n}  sacks ${S.sacks}  avg sack time ${avg(S.t)}s  rushers ${avg(S.rushers)}  protectors ${avg(S.blockers)}`);
const h = {}; for (const t of S.t) { const k = (Math.floor(t * 2) / 2).toFixed(1); h[k] = (h[k] || 0) + 1; } console.log('sack time histogram:', JSON.stringify(Object.fromEntries(Object.entries(h).sort())));
