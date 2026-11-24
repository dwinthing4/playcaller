// Flag watch: how often the engine records foul candidates (beaten blocks, grabs, contact on a ball in the air, late hits, tackles),
// and the expected flags per play with RULES.chance. Calibrates the penalty rates without running full games.
// usage: node qa/penalty_events.mjs [plays]
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
import fs from 'fs'; import path from 'path'; import vm from 'vm';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const E = loadEngine();
const RULES = vm.runInContext(fs.readFileSync(path.join(root, 'src/core/40_rules.js'), 'utf8') + ';RULES', vm.createContext({ Math, console }));
const book = E.buildPlaybook(), runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line'), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const N = +process.argv[2] || 300;
const pick = a => a[Math.floor(Math.random() * a.length)];
const cnt = {}, exp = {}, per = { run: 0, pass: 0 };
for (let i = 0; i < N; i++) {
  const offR = makeTeam(72, Math.random, 'O'), defR = makeTeam(72, Math.random, 'D');
  for (const kind of ['run', 'pass']) {
    const op = pick(kind === 'run' ? runs : passes), dp = pick(defs); let pl = null;
    const res = E.PHYS.runPlay(playOpts(E, offR, defR, op, dp), p => { pl = p; });
    per[kind]++;
    for (const ev0 of (pl ? pl.flagEv : [])) { const evs = [ev0]; if (ev0.k === 'grab' && !ev0.trail) evs.push(Object.assign({}, ev0, { k: 'push' })); if (ev0.k === 'tk' && ev0.qb && ev0.h > 1.5) evs.push(Object.assign({}, ev0, { k: 'helm' }));
      for (const ev of evs) { const key = kind + ':' + ev.k; cnt[key] = (cnt[key] || 0) + 1; const c = RULES.chance(ev, {}); exp[key] = (exp[key] || 0) + c; } }
  }
}
console.log(`plays: ${per.run} runs, ${per.pass} passes`);
for (const k of Object.keys(cnt).sort()) { const kind = k.split(':')[0]; console.log(`${k.padEnd(12)} events/play ${(cnt[k] / per[kind]).toFixed(3)}   expected flags/play ${(exp[k] / per[kind] * 100).toFixed(2)}%`); }
const tot = kind => Object.keys(exp).filter(k => k.startsWith(kind)).reduce((s, k) => s + exp[k], 0) / per[kind] * 100;
console.log(`live-ball flags per run play ${tot('run').toFixed(2)}%  per pass play ${tot('pass').toFixed(2)}%`);
