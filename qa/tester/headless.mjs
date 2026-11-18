import { SNAP_CODE } from './snapcode.mjs';
// Headless checks on the frozen dist/sim.cjs engine (same build as playcaller_qa.html):
//  A) user QB throwing to the most-open receiver at human timings vs the CPU QB
//  B) user defender steering at the carrier and pressing TACKLE vs pure AI defense
//  C) scramble past the line then tackled -> recorded as a sack?
import fs from 'fs'; import vm from 'vm';
import { makeTeam, starters } from '../engine_lib.mjs';
const code = SNAP_CODE;
const ctx = vm.createContext({ console, Math, Date, JSON }); const E = vm.runInContext(code, ctx);
const { PHYS } = E; const DT = PHYS.DT || 1 / 120; const YD = 0.9144;
const book = E.buildPlaybook(), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line' && !/Screen/.test(p.name)), runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const opts = (op, dp, userSide) => ({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: 0, list: starters(E, makeTeam(72), op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, makeTeam(72), dp.form, 'D'), bonus: 0 }, userSide, userSlot: 'LB1', diff: 'pro', seed: (Math.random() * 1e9) | 0 });
function run(pl, hook) { let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); } if (pl.phase === 'pre') pl.goLive(); let m = 0; while (pl.phase === 'live' && m < 120 * 30) { if (hook) hook(pl); pl.step(DT); m++; if (m % 4 === 0) pl.updatePoses(); } return pl.result; }
const N = +(process.argv[2] || 300);
// ---------- A
const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
for (const mode of ['cpu', 'user@1.2', 'user@1.8', 'user@2.4']) {
  const why = {}; let att = 0, comp = 0, yds = 0, sacks = 0, nob = 0, openSum = 0;
  for (let i = 0; i < N; i++) {
    const pl = new PHYS.Play(opts(pick(passes), pick(defs), mode === 'cpu' ? null : 'O')); const at = mode === 'cpu' ? 0 : +mode.split('@')[1]; let tried = false, openAt = null;
    const r = run(pl, p => { if (mode === 'cpu' || tried || p.liveT < at || !p.qb.upright() || p.ball.state !== 'held' || p.carrier !== p.qb) return; let best = null, bo = -9; for (const rc of p.receivers) { const o = p.openness(p.qb, rc).open; if (o > bo) { bo = o; best = rc; } } if (best && p.throwTo(best)) { tried = true; openAt = bo; } });
    if (r.sack) { sacks++; continue; } if (r.passer == null) continue; att++; if (openAt != null) openSum += openAt;
    if (r.type === 'inc') { tally(why, r.text.replace(/^(Off |)\S+?('s|) /, '$1X ').replace(/\S+ (drops it|breaks it up)/, 'X $1')); if (r.text === 'Nobody there') nob++; } else if (r.catcher != null && r.turnover !== 'int') { comp++; yds += r.yards; } else if (r.turnover === 'int') tally(why, 'INT');
  }
  console.log(`A ${mode.padEnd(9)} att ${att} comp ${(comp / att * 100).toFixed(0)}% ypa ${(yds / att).toFixed(1)} sacks ${sacks}  'Nobody there' ${(nob / att * 100).toFixed(1)}%  avg openness at throw ${(openSum / Math.max(1, att)).toFixed(2)}  inc reasons ${JSON.stringify(why)}`);
}
// ---------- B: run plays; user LB steers at the carrier and presses TACKLE inside 2.6 m (once per 0.4 s)
for (const mode of ['ai', 'user']) {
  let n = 0, yds = 0, lunges = 0, lungeTk = 0, broken = 0, yac = 0, nC = 0; const big = [];
  for (let i = 0; i < N; i++) {
    const pl = new PHYS.Play(opts(pick(runs), pick(defs), mode === 'ai' ? null : 'D')); let lastT = -1, lungedAt = null, myLunge = 0, myWrap = false;
    const r = run(pl, p => { if (mode === 'ai') return; const me = p.userD, c = p.carrier; if (!me || !c || c.unit !== 'O') { p.input.x = p.input.z = 0; return; }
      const dx = c.p.x + c.vel.x * 0.25 - me.p.x, dz = c.p.z + c.vel.z * 0.25 - me.p.z, m = Math.hypot(dx, dz) || 1; p.input.x = dx / m; p.input.z = dz / m;
      if (m < 2.6 && p.t - lastT > 0.4) { lastT = p.t; p.input.tackle = true; if (me.lungeT <= 0) myLunge++; }
      if (me.wrapped) myWrap = true; });
    n++; yds += r.yards; broken += r.broken || 0; if (r.contactZ != null) { yac += r.yards - (r.contactZ - pl.losZ) / YD; nC++; }
    if (mode === 'user') { lunges += myLunge > 0 ? 1 : 0; lungeTk += myWrap ? 1 : 0; }
    if (r.yards > 20) big.push(Math.round(r.yards));
  }
  console.log(`B ${mode.padEnd(5)} runs ${n} ypc ${(yds / n).toFixed(2)} broken/run ${(broken / n).toFixed(2)} yds after contact ${(yac / Math.max(1, nC)).toFixed(2)} 20+ runs ${big.length}${mode === 'user' ? `  plays where user pressed TACKLE ${lunges}, where his man wrapped the carrier ${lungeTk}` : ''}`);
}
// ---------- C: user QB scrambles straight upfield on a pass play
{ let n = 0, sacksPastLos = 0, sackYds = []; for (let i = 0; i < Math.min(N, 150); i++) { const pl = new PHYS.Play(opts(pick(passes), pick(defs), 'O'));
  const r = run(pl, p => { if (p.liveT > 0.8) { p.input.x = 0.25; p.input.z = 1; } }); n++; if (r.sack && r.yards > 0) { sacksPastLos++; sackYds.push(+r.yards.toFixed(1)); } }
  console.log(`C scrambles ${n}: recorded as SACK with positive yards ${sacksPastLos} (${sackYds.slice(0, 12).join(', ')})`); }
