// Headless (qa2 engine): for every offensive play with pre-snap motion, does the play go live after snap()?
// The live game (MATCH.startPlay) has no "snap anyway" fallback, unlike simPlay; a motion man who never reaches his mark = stuck at the line.
import vm from 'vm';
import { SNAP_CODE } from './snapcode2.mjs';
import { makeTeam, starters } from '../../engine_lib.mjs';
const E = vm.runInContext(SNAP_CODE, vm.createContext({ console, Math, Date, JSON }));
const { PHYS } = E; const DT = PHYS.DT || 1 / 120; const YD = 0.9144;
const book = E.buildPlaybook(); const defs = book.filter(p => p.side === 'D');
const offs = book.filter(p => p.side === 'O');
const rows = []; let stuckN = 0, total = 0;
for (const op of offs) {
  for (const flip of [false, true]) for (const ballX of [-2.82, 0, 2.82]) for (const losYd of [30, 97]) for (let k = 0; k < 3; k++) {
    const dp = defs[(k * 7 + op.id.length) % defs.length];
    const pl = new PHYS.Play({ losZ: losYd * YD, ballX, down: 1, togo: 10, op: Object.assign({}, op, { flip }), dp, off: { tid: 0, list: starters(E, makeTeam(72), op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, makeTeam(72), dp.form, 'D'), bonus: 0 }, userSide: 'O', diff: 'pro', seed: (Math.random() * 1e9) | 0 });
    if (!pl.motion) break;
    total++; let n = 0; pl.snap(); while (pl.phase === 'pre' && n < 120 * 20) { pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); }
    const m = pl.motion; const r = { play: op.name, form: op.form, flip, ballX, los: losYd, type: m.type, live: pl.phase === 'live', secs: +(n * DT).toFixed(2), man: m.p.slot, dx: +(m.tx - m.p.p.x).toFixed(2), tx: +m.tx.toFixed(2) };
    if (!r.live) stuckN++; rows.push(r);
  }
}
const stuck = rows.filter(r => !r.live), slow = rows.filter(r => r.live && r.secs > 2.5);
console.log(`motion plays tested: ${total} cases over ${new Set(rows.map(r => r.play)).size} plays; never went live within 20 s: ${stuck.length}; took > 2.5 s: ${slow.length}`);
const by = {}; for (const r of stuck) { const k = `${r.play} (${r.form}, ${r.type})`; (by[k] = by[k] || []).push(`flip ${r.flip} ballX ${r.ballX} los ${r.los}: ${r.man} still ${r.dx} m from mark x=${r.tx}`); }
for (const k in by) console.log('STUCK', k, '\n   ' + by[k].slice(0, 6).join('\n   '));
console.log('motion times (s):', rows.filter(r => r.live).map(r => r.secs).sort((a, b) => a - b).filter((x, i, a) => i % Math.ceil(a.length / 12) === 0).join(' '));
