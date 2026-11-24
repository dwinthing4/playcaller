// What the defensive calls at the line do, headless: the same plays (same teams, play, defense and seed) with and without each call.
// usage: node qa/calls_stats.mjs [plays per call]
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine(), N = +process.argv[2] || 300;
const book = E.buildPlaybook(), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line' && !p.motion), runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line' && !p.motion), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0, pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
function trial(kind, calls, i, qbSpd) {
  const rnd = E.U.seededRng(1000 + i * 7), offR = makeTeam(72, rnd, 'O'), defR = makeTeam(72, rnd, 'D');
  for (const ps of Object.values(offR)) for (const p of ps) p.ovr = 70; offR.WR[0].ovr = 88; offR.WR[0].a.spd = 93; offR.WR[0].a.cth = 90; offR.WR[0].a.rte = 88;
  if (qbSpd) offR.QB[0].a.spd = qbSpd;
  const pool = kind === 'run' ? runs : passes, op = pool[Math.floor(rnd() * pool.length)], dp = defs[Math.floor(rnd() * defs.length)];
  const o = playOpts(E, offR, defR, op, calls ? Object.assign({}, dp, { calls }) : dp, { seed: 77 + i * 131 });
  const res = E.PHYS.runPlay(o); return { res, star: offR.WR[0].id };
}
function run(kind, calls, qbSpd) {
  const o = { n: 0, yds: [], sack: 0, press: 0, comp: 0, att: 0, ttt: [], star: 0, starY: 0, scr: 0, scrY: [], int: 0 };
  for (let i = 0; i < N; i++) { let t; try { t = trial(kind, calls, i, qbSpd); } catch (e) { console.error(e.stack); continue; } const r = t.res; o.n++;
    if (r.type === 'sack') o.sack++; if (r.pressured) o.press++; if (r.throwT != null) o.ttt.push(r.throwT);
    if (kind === 'pass' && r.type !== 'sack') { o.att++; if (r.catcher != null && r.turnover !== 'int') o.comp++; if (r.turnover === 'int') o.int++; }
    if (r.catcher === t.star && r.turnover !== 'int') { o.star++; o.starY += r.yards || 0; }
    if (r.kind === 'scramble') { o.scr++; o.scrY.push(r.yards || 0); }
    if (r.turnover !== 'int') o.yds.push(r.yards || 0); }
  return o;
}
const line = (name, o) => console.log(`${name.padEnd(22)} yds/play ${avg(o.yds).toFixed(2).padStart(5)}  sack ${pct(o.sack, o.n).padStart(6)}  pressured ${pct(o.press, o.n).padStart(6)}  comp ${pct(o.comp, o.att).padStart(6)}  INT ${o.int}  throw ${avg(o.ttt).toFixed(2)}s  star WR ${o.star} catches ${o.starY.toFixed(0)} yds  scrambles ${o.scr} (${avg(o.scrY).toFixed(1)} yds)`);
console.log(`PASS PLAYS (${N} each, paired)`);
line('as called', run('pass', null)); line('spy the QB', run('pass', { spy: true })); line('double WR', run('pass', { dbl: true }));
line('blitz B gap', run('pass', { gap: 'B', gx: 1 })); line('blitz A gap', run('pass', { gap: 'A', gx: -1 })); line('show blitz, drop', run('pass', { show: true }));
console.log(`\nA QB WITH WHEELS (SPD 92), PASS PLAYS`);
line('as called', run('pass', null, 92)); line('spy the QB', run('pass', { spy: true }, 92));
console.log(`\nRUN PLAYS (${N} each)`);
line('as called', run('run', null)); line('blitz B gap', run('run', { gap: 'B', gx: 1 })); line('blitz C gap', run('run', { gap: 'C', gx: -1 }));
