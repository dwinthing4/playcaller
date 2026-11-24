// The field at the line and the flags: plays run like MATCH runs them (generated league, depth-chart starters, CPU calls both sides).
// Reports press / jam / release outcomes, receivers and DBs who go down before the throw (should be ~0), foul events the players
// commit by kind (with how plain they were), the flags the officials would throw (RULES.chance), and basic pass / run numbers.
// run: node tools/build.mjs && node qa/field_test.cjs [plays=400] [press=0..1: force press-man on that share of pass plays]
const path = require('path');
let seed = +(process.env.SEED || 20261124) >>> 0; Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const { PHYS, LG } = require(process.env.SIM || path.join(__dirname, '..', 'dist', 'sim.cjs'));
const RULES = require('vm').runInNewContext(require('fs').readFileSync(path.join(__dirname, '..', 'src', 'core', '40_rules.js'), 'utf8') + ';RULES', { Math });
const N = +(process.argv[2] || 400), PRESS = +(process.argv[3] || 0), YD = 0.9144, DT = PHYS.DT;
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id);
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy })).filter(e => e.rp);
const manD = L.plays.filter(p => p.side === 'D' && ['c0', 'c1', 'c2m'].includes(p.cov));
const jam = { clean: 0, fight: 0, jam: 0 }, moves = {}, ev = {}, evSev = {}, flags = {}; let falls = 0, fallsIn5 = 0, pressPlays = 0, pass = 0, comp = 0, yds = 0, runs = 0, ry = 0, sacks = 0, ints = 0, att = 0;
const fallLog = [];
for (let i = +(process.env.FROM || 0); i < N; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], down = 1 + (i % 3), togo = [10, 6, 3][i % 3], yl = 20 + (i * 13) % 55;
  const ctx = { side: 'O', tid: o.id, oppTid: d.id, down, togo, yl, q: 1 + (i % 4), clock: 100, qlen: 120, sd: 0 };
  const op = byId(LG.cpuCall(o.id, 'O', ctx)); let dp = byId(LG.cpuCall(d.id, 'D', Object.assign({}, ctx, { side: 'D', tid: d.id, oppTid: o.id, offForm: op.form })));
  const force = op.type === 'pass' && Math.random() < PRESS; if (force) dp = Object.assign({}, manD[i % manD.length], { press: true });
  const opts = { losZ: yl * YD, ballX: [0, -5.6, 5.6][i % 3] * 0.9, down, togo, op: Object.assign({}, op, { flip: i % 2 === 1 }), dp,
    off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0, style: o.offStyle }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0, style: force ? 'Man Press' : d.defStyle }, userSide: null, diff: 'pro', seed: i * 7919 + 13 };
  const pl = new PHYS.Play(opts); let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); }
  if (pl.phase === 'pre') pl.goLive();
  const seenJ = new Set(), downSeen = new Set(); let any = false;
  const TR = process.env.TRACE != null && +process.env.TRACE === i, tw = TR ? pl.players.find(p => p.label === (process.env.WHO || 'X')) : null;
  for (let m = 0; pl.phase === 'live' && m < 120 * 40; m++) { pl.step(DT); if (m % 4 === 0) pl.updatePoses();
    if (tw && m % 6 === 0) { const nb = pl.players.filter(q => q !== tw).sort((a, b) => Math.hypot(a.p.x - tw.p.x, a.p.z - tw.p.z) - Math.hypot(b.p.x - tw.p.x, b.p.z - tw.p.z))[0]; console.log(`t=${pl.liveT.toFixed(2)} ${tw.label} ${tw.role} ${tw.bal} th=${Math.hypot(tw.th.x, tw.th.z).toFixed(2)} v=${Math.hypot(tw.vel.x, tw.vel.z).toFixed(1)} near ${nb.unit}${nb.label} ${nb.role || nb.job} ${Math.hypot(nb.p.x - tw.p.x, nb.p.z - tw.p.z).toFixed(2)} thrown=${pl.thrown}`); }
    for (const r of pl.receivers) { if (r.hf && !seenJ.has(r.id)) { seenJ.add(r.id); jam[r.hf.res]++; moves[r.hf.move] = (moves[r.hf.move] || 0) + 1; any = true; } }
    if (!pl.thrown && pl.pass) for (const r of pl.receivers) { const ds = pl.D.filter(x => !x.dl && Math.hypot(x.p.x - r.p.x, x.p.z - r.p.z) < 2.5); for (const p of [r, ...ds]) { if ((p.bal === 'fall' || p.bal === 'down') && !downSeen.has(p.id) && pl.carrier === pl.qb) { downSeen.add(p.id); falls++; if ((r.p.z - pl.losZ) / YD < 5) fallsIn5++; if (fallLog.length < 14) { const nb = pl.players.filter(q => q !== p).sort((a, b) => Math.hypot(a.p.x - p.p.x, a.p.z - p.p.z) - Math.hypot(b.p.x - p.p.x, b.p.z - p.p.z))[0]; fallLog.push(`#${i} ${p.unit}${p.label} ${p.posName} t=${pl.liveT.toFixed(2)} dz=${((r.p.z - pl.losZ) / YD).toFixed(1)} nearest ${nb.unit}${nb.label} ${nb.bal} ${Math.hypot(nb.p.x - p.p.x, nb.p.z - p.p.z).toFixed(2)}m  ${op.name} vs ${dp.name}`); } } } }
  }
  if (pl.phase === 'live') pl.endPlay('tackle', 'Whistle', pl.carrier, pl.carrier ? pl.carrier.p.z : pl.losZ);
  if (any) pressPlays++;
  for (const e of pl.flagEv) { ev[e.k] = (ev[e.k] || 0) + 1; if (e.sev != null) (evSev[e.k] = evSev[e.k] || []).push(e.sev); flags[e.k] = (flags[e.k] || 0) + RULES.chance(e, { k: 1 }); }
  const res = pl.result;
  if (op.type === 'pass') { pass++; if (res.sack) sacks++; else { att++; if (res.type !== 'inc' && res.turnover !== 'int' && pl.catcher) comp++; if (res.turnover === 'int') ints++; yds += res.turnover === 'int' ? 0 : (res.yards || 0); } }
  else { runs++; ry += res.yards || 0; }
}
const f = x => x.toFixed(2), pc = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '-';
console.log(`${N} plays: pass ${pass} (att ${att}, comp ${pc(comp, att)}, ypa ${f(yds / Math.max(1, att))}, sack ${pc(sacks, pass)}, int ${pc(ints, att)})  run ${runs} ypc ${f(ry / Math.max(1, runs))}`);
const jt = jam.clean + jam.fight + jam.jam; console.log(`press at the line: ${jt} hand fights on ${pressPlays} plays: clean release ${pc(jam.clean, jt)}, even ${pc(jam.fight, jt)}, jammed ${pc(jam.jam, jt)}; moves ${JSON.stringify(moves)}`);
console.log(`receivers / DBs down before the throw: ${falls} (${fallsIn5} inside 5 yards)`); for (const l of fallLog) console.log('   ' + l);
console.log('foul events per 100 plays (avg sev) -> expected flags per 100 plays:');
for (const k of Object.keys(ev).sort()) { const s = evSev[k]; console.log(`   ${k.padEnd(6)} ${f(ev[k] / N * 100).padStart(6)}  sev ${s ? f(s.reduce((a, b) => a + b, 0) / s.length) : '  - '}  -> ${f(flags[k] / N * 100)}`); }
const tot = Object.values(flags).reduce((a, b) => a + b, 0); console.log(`   all live flags per 100 plays: ${f(tot / N * 100)}`);
