// Passing breakdown: why incompletions happen, how long completions go, who throws when.
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const N = +process.argv[2] || 200;
const book = E.buildPlaybook(), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const why = {}, comp = [], tds = [], cov = {};
for (let i = 0; i < N; i++) {
  const op = pick(passes), dp = pick(defs);
  const res = E.PHYS.runPlay(playOpts(E, makeTeam(72), makeTeam(72), op, dp));
  const k = (E.FB.MAN_COVERAGES[dp.cov] ? 'man' : 'zone'); cov[k] = cov[k] || { n: 0, c: 0, yds: 0 }; cov[k].n++;
  if (res.type === 'inc') why[res.text] = (why[res.text] || 0) + 1;
  if (res.catcher != null && res.turnover !== 'int') { comp.push([Math.round(res.airYds), Math.round(res.yards), `${op.name} vs ${dp.name} (${dp.cov})`]); cov[k].c++; cov[k].yds += res.yards; }
  if (res.td) tds.push(`${op.name} vs ${dp.name}: air ${Math.round(res.airYds)} total ${Math.round(res.yards)}`);
}
console.log('incompletions:', JSON.stringify(why));
console.log('coverage:', JSON.stringify(cov));
const b = { '<0': 0, '0-9': 0, '10-19': 0, '20-39': 0, '40+': 0 }; for (const [a, t] of comp) b[t < 0 ? '<0' : t < 10 ? '0-9' : t < 20 ? '10-19' : t < 40 ? '20-39' : '40+']++;
console.log('completion length:', JSON.stringify(b));
console.log('longest:\n ' + comp.slice().sort((a, b) => b[1] - a[1]).slice(0, 14).map(c => `air ${c[0]} total ${c[1]}  ${c[2]}`).join('\n '));
console.log('air-yard buckets of 30+ completions:', JSON.stringify(comp.filter(c => c[1] >= 30).reduce((o, c) => { const k = c[0] < 10 ? 'short' : c[0] < 20 ? 'mid' : 'deep'; o[k] = (o[k] || 0) + 1; return o; }, {})));
