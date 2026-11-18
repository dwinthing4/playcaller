// Round 2 headless checks on the engine code taken from dist/playcaller_qa2.html (snapcode2.mjs).
//  A) user QB throwing to the most-open receiver at human timings vs the CPU QB (+ 'Nobody there', bubble colour at throw)
//  B) user defender steering + TACKLE vs pure AI defense on runs
//  C) user scramble straight upfield: sack only when downed behind the LOS? QB credited with a run?
//  D) bubble colour buckets (green > 0.6, yellow (-1, 0.6], red <= -1) -> completion rate, when the user throws to that receiver
//  E) runs by scheme: draw vs others (ypc, TFL rate); CPU passing line (comp, ypa, sack, int, throw-away)
//  F) runner after a move-button tap with no stick (userTouched, zero input) vs the AI runner
//  G) CPU QB: how often does it throw to a receiver who is on the ground at release?
import vm from 'vm';
import { SNAP_CODE } from './snapcode2.mjs';
import { makeTeam, starters } from '../../engine_lib.mjs';
const E = vm.runInContext(SNAP_CODE, vm.createContext({ console, Math, Date, JSON }));
const { PHYS } = E; const DT = PHYS.DT || 1 / 120; const YD = 0.9144;
const book = E.buildPlaybook();
const passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line' && !/Screen/.test(p.name));
const runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line' && !p.qbRun);
const defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const opts = (op, dp, userSide) => ({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: 0, list: starters(E, makeTeam(72), op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, makeTeam(72), dp.form, 'D'), bonus: 0 }, userSide, userSlot: 'LB1', diff: 'pro', seed: (Math.random() * 1e9) | 0 });
function run(pl, hook) { let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); } if (pl.phase === 'pre') pl.goLive(); let m = 0; while (pl.phase === 'live' && m < 120 * 30) { if (hook) hook(pl); pl.step(DT); m++; if (m % 4 === 0) pl.updatePoses(); } return pl.result; }
const N = +(process.argv[2] || 300);
const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
const colour = o => o <= -1.0 ? 'red' : o <= 0.6 ? 'yellow' : 'green';
// ---------- A + D
const bucket = { green: { n: 0, c: 0, y: 0, int: 0 }, yellow: { n: 0, c: 0, y: 0, int: 0 }, red: { n: 0, c: 0, y: 0, int: 0 } };
for (const mode of ['cpu', 'user@1.2', 'user@1.8', 'user@2.4']) {
  const why = {}; let att = 0, comp = 0, yds = 0, sacks = 0, nob = 0, openSum = 0, ints = 0, away = 0, plays = 0, colAt = {};
  for (let i = 0; i < N; i++) {
    const pl = new PHYS.Play(opts(pick(passes), pick(defs), mode === 'cpu' ? null : 'O')); const at = mode === 'cpu' ? 0 : +mode.split('@')[1]; let tried = false, openAt = null, col = null;
    const r = run(pl, p => { if (mode === 'cpu' || tried || p.liveT < at || !p.qb.upright() || p.ball.state !== 'held' || p.carrier !== p.qb) return; let best = null, bo = -99; for (const rc of p.receivers) { const o = p.openness(p.qb, rc).open; if (o > bo) { bo = o; best = rc; } } if (best && p.throwTo(best)) { tried = true; openAt = bo; col = colour(bo); } });
    plays++;
    if (r.sack) { sacks++; continue; } if (r.passer == null) continue; att++; if (openAt != null) openSum += openAt;
    if (/away/i.test(r.text || '')) away++;
    const caught = r.type !== 'inc' && r.catcher != null && r.turnover !== 'int';
    if (r.type === 'inc') { tally(why, (r.text || '').replace(/^(Off |)\S+?('s|) /, '$1X ').replace(/\S+ (drops it|breaks it up)/, 'X $1')); if (r.text === 'Nobody there') nob++; } else if (caught) { comp++; yds += r.yards; } else if (r.turnover === 'int') { ints++; tally(why, 'INT'); }
    if (col) { tally(colAt, col); const B = bucket[col]; B.n++; if (caught) { B.c++; B.y += r.yards; } if (r.turnover === 'int') B.int++; }
  }
  console.log(`A ${mode.padEnd(9)} plays ${plays} att ${att} comp ${(comp / att * 100).toFixed(0)}% ypa ${(yds / att).toFixed(1)} sack% ${(sacks / plays * 100).toFixed(1)} int ${ints} throwaways ${away} 'Nobody there' ${(nob / att * 100).toFixed(1)}% avg openness at throw ${(openSum / Math.max(1, att)).toFixed(2)} colour at throw ${JSON.stringify(colAt)}  inc ${JSON.stringify(why)}`);
}
for (const k in bucket) { const B = bucket[k]; console.log(`D throws at a ${k.padEnd(6)} bubble: ${B.n}, completed ${(B.c / Math.max(1, B.n) * 100).toFixed(0)}%, yds/att ${(B.y / Math.max(1, B.n)).toFixed(1)}, INT ${B.int}`); }
// ---------- B
for (const mode of ['ai', 'user']) {
  let n = 0, yds = 0, lunges = 0, lungeTk = 0, broken = 0, yac = 0, nC = 0; const big = [];
  for (let i = 0; i < N; i++) {
    const pl = new PHYS.Play(opts(pick(runs), pick(defs), mode === 'ai' ? null : 'D')); let lastT = -1, myLunge = 0, myWrap = false;
    const r = run(pl, p => { if (mode === 'ai') return; const me = p.userD, c = p.carrier; if (!me || !c || c.unit !== 'O') { p.input.x = p.input.z = 0; return; }
      const dx = c.p.x + c.vel.x * 0.25 - me.p.x, dz = c.p.z + c.vel.z * 0.25 - me.p.z, m = Math.hypot(dx, dz) || 1; p.input.x = dx / m; p.input.z = dz / m;
      if (m < 2.6 && p.t - lastT > 0.4) { lastT = p.t; p.input.tackle = true; if (me.lungeT <= 0) myLunge++; }
      if (me.wrapped) myWrap = true; });
    n++; yds += r.yards; broken += r.broken || 0; if (r.contactZ != null) { yac += r.yards - (r.contactZ - pl.losZ) / YD; nC++; }
    if (mode === 'user') { lunges += myLunge > 0 ? 1 : 0; lungeTk += myWrap ? 1 : 0; }
    if (r.yards > 20) big.push(Math.round(r.yards));
  }
  console.log(`B ${mode.padEnd(5)} runs ${n} ypc ${(yds / n).toFixed(2)} broken/run ${(broken / n).toFixed(2)} yds after contact ${(yac / Math.max(1, nC)).toFixed(2)} 20+ runs ${big.length}${mode === 'user' ? `  TACKLE pressed on ${lunges} plays, his man wrapped the carrier on ${lungeTk}` : ''}`);
}
// ---------- C
{ let n = 0, sackPos = 0, sackNeg = 0, runPos = 0, runNeg = 0, other = {}, qbRa = 0, sackYds = [], runBehind = 0;
  for (let i = 0; i < Math.min(N, 200); i++) { const pl = new PHYS.Play(opts(pick(passes), pick(defs), 'O'));
    const r = run(pl, p => { if (p.liveT > 0.8) { p.input.x = 0.25; p.input.z = 1; } }); n++;
    const qbSt = r.stats && r.stats[pl.qb.pid] || {};
    if (r.sack) { if (r.yards > 0) { sackPos++; sackYds.push(+r.yards.toFixed(1)); } else sackNeg++; }
    else if (r.type === 'tackle' || r.type === 'down' || r.type === 'oob' || r.type === 'td') { if (r.yards >= 0) runPos++; else { runNeg++; } if (qbSt.ra) qbRa++; if (r.yards < 0 && r.type !== 'oob') runBehind++; }
    else tally(other, r.type + (r.kind ? ':' + r.kind : '')); }
  console.log(`C user scrambles ${n}: SACK with positive yards ${sackPos} ${sackYds.slice(0, 10).join(',')} | SACK behind LOS ${sackNeg} | run >=0 yds ${runPos} | run <0 yds ${runNeg} (tackled behind LOS but not a sack: ${runBehind}) | QB credited a rush ${qbRa} | other ${JSON.stringify(other)}`); }
// ---------- E
{ const by = {}; for (let i = 0; i < N * 2; i++) { const op = pick(runs); const pl = new PHYS.Play(opts(op, pick(defs), null)); const r = run(pl); const k = op.scheme || 'none'; const o = by[k] || (by[k] = { n: 0, y: 0, tfl: 0, big: 0 }); o.n++; o.y += r.yards; if (r.yards < 0) o.tfl++; if (r.yards >= 10) o.big++; }
  console.log('E runs by scheme (AI v AI):', Object.entries(by).map(([k, o]) => `${k}: n ${o.n} ypc ${(o.y / o.n).toFixed(2)} TFL ${(o.tfl / o.n * 100).toFixed(0)}% 10+ ${(o.big / o.n * 100).toFixed(0)}%`).join(' | ')); }
// ---------- F
for (const mode of ['ai', 'tapMove']) {
  let n = 0, yds = 0, fired = 0, big = 0; const head = [];
  for (let i = 0; i < N; i++) { const pl = new PHYS.Play(opts(pick(runs), pick(defs), 'O')); let done = false, firedHere = false;
    const r = run(pl, p => { const c = p.carrier; if (mode === 'ai' || done || !c || c === p.qb || p.ball.state !== 'held' || !p.controlled()) return; if (p.liveT < 0.15) return; p.input.juke = true; p.userTouched = true; done = true; });
    n++; yds += r.yards; if (r.yards >= 10) big++; }
  console.log(`F ${mode.padEnd(8)} runs ${n} ypc ${(yds / n).toFixed(2)} 10+ ${(big / n * 100).toFixed(0)}%   (tapMove = one Juke tap right after the handoff, then no stick: the runner is user-driven and only 'keeps running downfield')`);
}
// ---------- G
{ let thr = 0, down = 0, nob = 0; for (let i = 0; i < N; i++) { const pl = new PHYS.Play(opts(pick(passes), pick(defs), null)); let seen = false;
  const r = run(pl, p => { if (!seen && p.thrown && p.ball.target) { seen = true; thr++; if (!p.ball.target.upright()) down++; } }); if (r.text === 'Nobody there') nob++; }
  console.log(`G CPU QB throws ${thr}: target on the ground at release ${down}; 'Nobody there' ${nob}`); }
