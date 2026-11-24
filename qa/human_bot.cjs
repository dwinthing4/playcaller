// "Human bot" harness: drives the user's player through play.input (stick, world x/z) and the action flags (juke / stiff arm),
// the way a person does, against the CPU defense. Same league, seeds and play calls every run, so builds can be compared.
//   ret : kick and punt returner who reads the coverage, takes the open lane and jukes / cuts when a cover man closes in
//         (CPU vs CPU returns with the same kicks are printed next to it)
//   qb  : QB who breaks the pocket and runs on EVERY pass play, 24 snaps in a row per matchup, with the in-game film + QB scouting the match keeps
//         (he throws it away about 60% of the time when trapped behind the line, like a person would)
//   rb  : RB on run plays who follows the hole, then jukes / cuts when a defender in his path closes (CPU runner on the same plays next to it)
//   'juke bite' = how much the far defenders (>6 m) move toward the jab while it lasts (0 = they keep their angle)
// run: node tools/build.mjs && node qa/human_bot.cjs [all|ret|qb|rb] [scale=1]      SIM=path/to/sim.cjs runs another build
//      DIFF=rookie|pro|allpro|legend (default pro)
const path = require('path');
const SIMF = process.env.SIM || path.join(__dirname, '..', 'dist', 'sim.cjs');
const MODE = process.argv[2] || 'all', SCALE = +(process.argv[3] || 1), DIFF = process.env.DIFF || 'pro';
let seed = 20261124; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = rnd;                                       // before the bundle loads: it keeps its own reference (R = Math.random), so league + CPU calls are seeded
const { PHYS, LG } = require(SIMF);
const YD = 0.9144, DT = PHYS.DT || 1 / 120, FIELD = PHYS.FIELD;
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
LG.newLeague({ diff: DIFF, qlen: 120 }); LG.chooseTeam(0, 'Bot');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id), P = id => L.P[id];
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy })).filter(e => e.rp);
const cl = (x, a, b) => Math.max(a, Math.min(b, x)), hyp = Math.hypot;
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0, med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const f1 = x => x.toFixed(1), pc = (n, d) => d ? Math.round(n / d * 100) + '%' : '-';

// ------------------------------------------------------------ the match's in-game film (same rules as src/match/10_match.js)
function Film() { return { film: {}, playN: 0, scr: null }; }
const filmSeen = (G, e) => e.n * Math.pow(0.94, Math.max(0, G.playN - (e.last || 0)) / 2);
function filmNote(G, op, res) { const F = G.film, e = F[op.id] || (F[op.id] = { n: 0, yds: 0, big: 0, stops: 0, tgt: {}, last: 0, name: op.name, form: op.form, type: op.type, deep: !!op.deep });
  const y = res.type === 'inc' ? 0 : (res.yards || 0); e.n = filmSeen(G, e) + 1; e.last = G.playN; e.yds += y; if (y >= 12 || res.td) e.big++; if (y <= 1 || res.turnover) e.stops++; }
function filmFor(G, op) { const e = G.film[op.id]; if (!e) return null; const n = filmSeen(G, e); if (n < 0.8) return null; return { k: cl(0.24 * n + 0.08 * e.big - 0.04 * e.stops, 0, 0.85), type: op.type, deep: !!op.deep, tgt: null }; }
const filmThreats = (G, form) => Object.values(G.film).filter(e => !form || e.form === form).map(e => ({ type: e.type, deep: e.deep, w: filmSeen(G, e) * (Math.max(0, e.yds / Math.max(1, e.n)) + 2 + e.big * 3) })).filter(x => x.w > 2);
const SCOUT = PHYS.qbScout || null;                      // QB-run scouting (added with the smarter defense; absent in older builds)

// ------------------------------------------------------------ the bot's thumb
// a person re-aims ~8 times a second, sees the whole field (camera above), and hits juke when a man is about to arrive
function newBot() { return { next: 0, sx: 0, sz: 1, hold: 0, cd: 0, jukes: 0, cuts: 0, stiffs: 0, log: [] }; }
function threat(pl, me) {
  let thr = null, td = 99, tc = 0;
  for (const d of pl.D) { if (!d.upright() || d.bondBy) continue; const dx = d.p.x - me.p.x, dz = d.p.z - me.p.z, dd = hyp(dx, dz) || 1e-6; if (dz < -0.8 && dd > 1.6) continue;
    const closing = -((d.vel.x - me.vel.x) * dx + (d.vel.z - me.vel.z) * dz) / dd; if (dd < td) { td = dd; thr = d; tc = closing; } }
  return thr ? { d: thr, dist: td, closing: tc } : null;
}
function lane(pl, me, B, fwdOnly) {
  const foes = pl.D.filter(d => d.upright() && !d.bondBy), sp = hyp(me.vel.x, me.vel.z); let best = null, bs = -1e9;
  for (let i = -10; i <= 10; i++) {
    const a = i * (fwdOnly ? 0.11 : 0.15), ux = Math.sin(a), uz = Math.cos(a);
    let sc = uz * 1.7 + (sp > 1 ? (ux * me.vel.x + uz * me.vel.z) / sp * 0.45 : 0) + gauss() * 0.25;
    for (const tau of [0.4, 0.9, 1.5]) { const px = me.p.x + ux * me.vmax * tau, pz = me.p.z + uz * me.vmax * tau;
      if (Math.abs(px) > FIELD.halfW - 1.5) sc -= 2.5 * (Math.abs(px) - FIELD.halfW + 1.5);
      for (const d of foes) { const m = hyp(d.p.x - px, d.p.z - pz) - d.vmax * tau * 0.85; if (m < 2.4) sc -= (2.4 - m) * (tau < 0.5 ? 1.2 : tau < 1 ? 0.8 : 0.45); } }
    if (sc > bs) { bs = sc; best = [ux, uz]; }
  }
  return best;
}
function botRun(pl, me, B, opt = {}) {
  const inp = pl.input;
  if (B.hold > 0) { B.hold -= DT; inp.x = B.sx; inp.z = B.sz; return; }
  if (pl.t < B.next) { inp.x = B.sx; inp.z = B.sz; return; }
  B.next = pl.t + 0.09 + rnd() * 0.07;
  const T = threat(pl, me);
  const sp = hyp(me.vel.x, me.vel.z), fx = sp > 1 ? me.vel.x / sp : 0, fz = sp > 1 ? me.vel.z / sp : 1, px = -fz, pz = fx;   // perp = left of travel
  const inPath = T && ((T.d.p.x - me.p.x) * fx + (T.d.p.z - me.p.z) * fz) / Math.max(0.5, T.dist) > 0.5;     // a person jukes the man in his way, he just runs away from the rest
  if (T && inPath && me.upright() && pl.t > B.cd && T.dist < (opt.jukeR || 3.0) && T.dist > 1.2 && T.closing > 1.5) {
    const lat = (T.d.p.x - me.p.x) * px + (T.d.p.z - me.p.z) * pz, away = -(Math.sign(lat) || (rnd() < 0.5 ? 1 : -1));           // +1: escape to the left of travel
    const ex = px * away, ez = pz * away, r = rnd();
    if (r < 0.5) { inp.juke = true; B.sx = ex * 0.85 + fx * 0.35; B.sz = ez * 0.85 + fz * 0.35; B.jukes++; }          // stick toward the escape side + juke
    else if (r < 0.72) { inp.juke = true; B.sx = fx; B.sz = fz; B.jukes++; }                                         // juke with the stick straight ahead
    else { B.sx = ex * 0.95 + fx * 0.3; B.sz = ez * 0.95 + fz * 0.3; B.cuts++; }                                    // a hard stick cut
    B.log.push({ t: pl.t, me, isJuke: !!inp.juke, far: pl.D.filter(d => d.upright() && !d.bondBy && hyp(d.p.x - me.p.x, d.p.z - me.p.z) > 6).map(d => ({ d, vx: d.vel.x, vz: d.vel.z })) });
    B.cd = pl.t + 0.8 + rnd() * 0.5; B.hold = 0.2 + rnd() * 0.1; pl.userTouched = true; inp.x = B.sx; inp.z = B.sz; return;
  }
  if (T && T.dist < 1.5 && pl.t > B.cd && rnd() < 0.3) { inp.stiff = true; B.stiffs++; B.cd = pl.t + 0.6; }
  const L2 = opt.hole ? opt.hole() : lane(pl, me, B, !!opt.fwd); B.sx = L2[0]; B.sz = L2[1]; inp.x = B.sx; inp.z = B.sz; pl.userTouched = true;
}
// the "whole defense faked out" number: how hard the far defenders (>6 m) bite on the jab. Velocity change toward the jab direction
// over the 0.25 s the jab lasts (m/s; 0 = they ignored it, ~3+ = they all lunged at the fake)
function ripple(pl, B) {
  for (const j of B.log) { if (j.done || pl.t < j.t + 0.25) continue; j.done = true; const jd = j.me.jukeT > 0 || j.me.jukeDir ? j.me.jukeDir : null; if (!jd || !j.isJuke) continue; let s = 0, m = 0;
    for (const f of j.far) { const d = f.d; if (!d.upright() || d.bondBy) continue; m++; s += (d.vel.x - f.vx) * jd.x + (d.vel.z - f.vz) * jd.z; }
    if (m) j.bite = s / m; }
}
function runOne(opts, drive) {
  const pl = new PHYS.Play(opts); let n = 0;
  while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); }
  if (pl.phase === 'pre') pl.goLive();
  let m = 0; while (pl.phase === 'live' && m < 120 * 40) { if (drive) drive(pl); pl.step(DT); m++; if (m % 4 === 0) pl.updatePoses(); }
  if (pl.phase === 'live') pl.endPlay('tackle', 'Whistle', pl.carrier, pl.carrier ? pl.carrier.p.z : pl.losZ);
  return { pl, res: pl.result };
}
function playOpts(o, d, op, dp, yl, userSide, flip, sd, G) {
  const film = userSide === 'O' && G ? filmFor(G, op) : null, scr = userSide === 'O' && G && SCOUT ? SCOUT.read(G.scr) : null;
  const dp2 = Object.assign({}, dp, film ? { film } : {}, scr ? { scout: scr } : {});
  return { losZ: yl * YD, ballX: [0, -2.4, 2.4][sd % 3], down: 1 + (sd % 3), togo: 10, op: Object.assign({}, op, { flip }), dp: dp2,
    off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0, style: o.offStyle }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0, style: d.defStyle },
    userSide, userSlot: 'LB1', diff: DIFF, seed: (sd * 7919 + 13) >>> 0, weather: 'clear', fatigue: {} };
}
function defCall(o, d, op, yl, G, down) {
  const ctx = { side: 'D', tid: d.id, oppTid: o.id, down: down || 1, togo: 10, yl, q: 1, clock: 100, qlen: 120, sd: 0, offForm: op.form };
  if (G) { ctx.film = filmThreats(G, op.form); if (SCOUT) ctx.scout = SCOUT.read(G.scr); }
  return byId(LG.cpuCall(d.id, 'D', ctx));
}

// ------------------------------------------------------------ kick / punt returns
const PREF = { LB: 3, S: 3, CB: 2.6, TE: 2.4, FB: 2.8, RB: 2.2, WR: 2.2 };
function stUnit(T, n, excl, cover) { const st = id => Object.values(T.depth || {}).some(a => a && a[0] === id), v = p => PREF[p.pos] - (st(p.id) ? 1.2 : 0) + ((cover ? p.a.tak + p.a.pur : p.a.rbk + p.a.str) + p.a.spd) / 120;
  return T.roster.map(P).filter(p => p && PREF[p.pos] && !excl.has(p.id)).sort((a, b) => v(b) - v(a)).slice(0, n); }
function retOpts(kind, recvT, kickT, sd, userSide) {
  const used = new Set(), rr = recvT.roster.map(P).filter(p => ['WR', 'RB', 'CB', 'S'].includes(p.pos) && (recvT.depth.QB || [])[0] !== p.id).sort((a, b) => (b.a.spd * 0.45 + b.a.elu * 0.35 + b.a.cth * 0.2) - (a.a.spd * 0.45 + a.a.elu * 0.35 + a.a.cth * 0.2))[0]; used.add(rr.id);
  const blk = stUnit(recvT, 10, used, false), kk = kickT.roster.map(P).find(p => p.pos === (kind === 'punt' ? 'P' : 'K')), cov = stUnit(kickT, 10, new Set([kk.id]), true);
  const off = [{ slot: 'KR', pos: rr.pos, rp: rr, dx: -8, dy: 0 }].concat(blk.map((p, i) => ({ slot: 'B' + (i + 1), pos: p.pos, rp: p, dx: -3, dy: (i - 4.5) * 3 })));
  const def = cov.map((p, i) => ({ slot: 'C' + (i + 1), pos: p.pos, rp: p, dx: 3, dy: (i - 4.5) * 3 })).concat([{ slot: 'K', pos: kk.pos, rp: kk, dx: 8, dy: 0 }]);
  const kp = kk.a.kpw; let landYd, hang, lx, losR = null, kickZ;
  if (kind === 'kickoff') { const dist = cl(57 + (kp - 60) * 0.3 + gauss() * 5, 38, 80); landYd = Math.max(-9, 100 - 35 - dist); hang = cl(3.75 + (kp - 60) / 90 + gauss() * 0.25, 3.2, 4.8); lx = gauss() * 6; kickZ = 65 * YD; }
  else { const from = 25 + Math.round(rnd() * 20), dist = Math.round(cl(41 + (kp - 70) * 0.25 + gauss() * 5.5, 22, 68)); losR = 100 - from; landYd = 100 - (from + dist); hang = cl(4.0 + (kp - 65) / 70 + gauss() * 0.3, 3.3, 5.0); lx = gauss() * 5; kickZ = (losR + 14) * YD; }
  return { landYd, opts: { losZ: kind === 'punt' ? losR * YD : landYd * YD, ballX: 0, down: 1, togo: 10, op: { id: 'ret', name: 'Kick return', side: 'O', form: 'Kick', type: 'run', carrier: 'KR', scheme: 'zone', gap: 'B', rside: 'R', routes: {} },
    dp: { id: 'cov', name: 'Coverage', side: 'D', form: 'Kick', cov: 'c3', blitz: [] }, off: { tid: recvT.id, list: off, bonus: 0 }, def: { tid: kickT.id, list: def, bonus: 0 },
    userSide, userSlot: 'C5', diff: DIFF, seed: (sd * 7919 + 13) >>> 0, weather: 'clear', fatigue: {},
    ret: { kind, kickX: 0, kickZ, landX: lx, landZ: landYd * YD, hang, retSlot: 'KR', losZ: kind === 'punt' ? losR * YD : null } } };
}
function retBot(B) { return pl => { const r = pl.returner;
  if (pl.air) { if (pl.ret.kind === 'punt' && !pl.fairCatch && pl.ball.state === 'air' && pl.ball.T - pl.ball.t < 0.7 && !B.fcd) { B.fcd = true; const L2 = pl.ball.land, g = Math.min(...pl.D.map(d => hyp(d.p.x - L2.x, d.p.z - L2.z))); if (g < 5.5) pl.fairCatchCall(); } pl.input.x = pl.input.z = 0; return; }
  if (pl.carrier === r && pl.ball.state === 'held' && r.upright()) { botRun(pl, r, B, { jukeR: 3.2 }); ripple(pl, B); } else { pl.input.x = pl.input.z = 0; } }; }
function retSuite(N) {
  seed = 7001;
  const out = { bot: { kickoff: [], punt: [] }, cpu: { kickoff: [], punt: [] } }, ripples = [];
  for (const kind of (process.env.RETK ? [process.env.RETK] : ['kickoff', 'punt'])) for (let i = 0; i < N; i++) {
    const recvT = L.teams[(i * 5 + 1) % 32], kickT = L.teams[(i * 5 + 4) % 32];
    const s0 = 50000 + i * 97 + (kind === 'punt' ? 7 : 0);
    for (const who of ['bot', 'cpu']) {
      seed = s0; const { landYd, opts } = retOpts(kind, recvT, kickT, 500 + i, who === 'bot' ? 'O' : null);   // same kick for both
      const B = newBot(), { res, pl } = runOne(opts, who === 'bot' ? retBot(B) : null);
      if (who === 'bot') for (const j of B.log) if (j.bite != null) ripples.push(j.bite);
      const spot = res.type === 'touchback' || (res.type === 'downed' && res.spotZ <= 0.5) ? (kind === 'punt' ? 20 : 25) : res.spotZ / YD; out[who][kind].push({ type: res.type, spot, ret: ['fair', 'touchback', 'downed'].includes(res.type) ? null : spot - landYd, td: !!res.td, jukes: B.jukes });
    }
  }
  const show = (who, kind) => { const a = out[who][kind], r = a.filter(x => x.ret != null), types = a.reduce((m, o) => (m[o.type] = (m[o.type] || 0) + 1, m), {});
    return `${who.padEnd(3)} ${kind.padEnd(7)} n=${a.length} avg spot ${f1(avg(a.map(x => x.spot)))}  return yds avg ${f1(avg(r.map(x => x.ret)))} med ${f1(med(r.map(x => x.ret)))}  30+ ${pc(r.filter(x => x.ret >= 30).length, r.length)}  TD ${a.filter(x => x.td).length}  ${JSON.stringify(types)}`; };
  console.log('\n=== RETURNS (bot = human-like returner, cpu = CPU returner; same kicks, CPU coverage) ===');
  for (const kind of (process.env.RETK ? [process.env.RETK] : ['kickoff', 'punt'])) for (const who of ['bot', 'cpu']) console.log(show(who, kind));
  console.log(`juke bite: far defenders (>6 m) moved ${avg(ripples).toFixed(2)} m/s toward the jab during it (n=${ripples.length} jukes)`);
  return out;
}

// ------------------------------------------------------------ QB who runs every pass play
function qbBot(B) { return pl => { const q = pl.qb, inp = pl.input; if (B.spies == null) B.spies = pl.D.filter(x => x.job === 'spy').length;
  if (pl.carrier !== q || pl.ball.state !== 'held' || !q.upright()) { inp.x = inp.z = 0; return; }
  if (!B.awayTried && q.p.z < pl.losZ - 0.3 && pl.liveT > 0.8 && !pl.thrown) { const T = threat(pl, q); if (T && T.dist < 1.7 && T.closing > 1) { B.awayTried = true; if (rnd() < 0.6) { pl.throwAwayUser(); B.away = true; return; } } }     // trapped: throw it away (most of the time)
  if (pl.scramble || q.p.z > pl.losZ + 0.4) { botRun(pl, q, B, { jukeR: 2.8 }); ripple(pl, B); return; }
  if (B.tDrop == null) B.tDrop = 0.75 + rnd() * 0.6;
  let pr = 99; for (const d of pl.D) if (d.upright() && !d.bondBy) pr = Math.min(pr, hyp(d.p.x - q.p.x, d.p.z - q.p.z));
  if (pl.liveT < B.tDrop && pr > 2.4) { inp.x = inp.z = 0; return; }                           // let the drop happen
  if (!B.side) { let l = 0, r = 0; for (const d of pl.D) { if (!d.upright()) continue; const dz = d.p.z - q.p.z; if (dz > 9) continue; if (d.p.x < q.p.x) l += 1 / (1 + Math.abs(d.p.x - q.p.x)); else r += 1 / (1 + Math.abs(d.p.x - q.p.x)); }
    B.side = Math.abs(l - r) < 0.05 ? (rnd() < 0.5 ? -1 : 1) : (l < r ? -1 : 1); B.wide = 3.5 + rnd() * 3.5; }
  // out of the pocket toward the open side; turn it up once outside the box or a lane upfield opens
  const wide = Math.abs(q.p.x - pl.ballX) > B.wide, L2 = lane(pl, q, B, true), clear = L2 && Math.abs(L2[0]) < 0.45 && pr > 3;
  if (wide || clear || pl.liveT > B.tDrop + 1.6) { botRun(pl, q, B, { jukeR: 2.6, fwd: true }); return; }
  if (pl.t > B.next) { B.next = pl.t + 0.1; B.sx = B.side * 0.95; B.sz = 0.3; }
  const T = threat(pl, q); if (T && T.dist < 2.2 && T.closing > 1 && pl.t > B.cd) { inp.juke = true; B.cd = pl.t + 0.7; B.jukes++; }
  inp.x = B.sx; inp.z = B.sz; }; }
function qbSuite(nSeq, len) {
  seed = 7002;
  const rows = [];
  const passPool = tid => LG.playsFor(tid, 'O').filter(p => p.type === 'pass' && p.form !== 'Goal Line' && !/Screen/.test(p.name));
  for (let s = 0; s < nSeq; s++) {
    const o = L.teams[(s * 7 + 2) % 32], d = L.teams[(s * 7 + 5) % 32], G = Film(), pool = passPool(o.id);
    for (let i = 0; i < len; i++) {
      G.playN++; seed = 60000 + s * 1000 + i * 13; const op = pool[Math.floor(rnd() * pool.length)], yl = 25 + ((s * 11 + i * 7) % 45), dp = defCall(o, d, op, yl, G, 1 + (i % 3));
      const B = newBot(), opts = playOpts(o, d, op, dp, yl, 'O', rnd() < 0.5, s * 1000 + i, G), { res, pl } = runOne(opts, qbBot(B));
      const y = res.type === 'inc' ? 0 : (res.yards || 0); filmNote(G, op, res);
      if (SCOUT) G.scr = SCOUT.note(G.scr, res, G.playN);
      rows.push({ s, i, y, type: res.type, away: !!B.away, sack: !!res.sack, scr: res.kind === 'scramble', spy: B.spies || 0, cov: dp.cov, td: !!res.td, jukes: B.jukes });
    }
  }
  console.log(`\n=== QB SCRAMBLES (bot breaks the pocket and runs on every pass play; ${nSeq} matchups x ${len} snaps in a row) ===`);
  const blk = Math.max(1, Math.round(len / 4));
  for (let b = 0; b < len; b += blk) { const a = rows.filter(r => r.i >= b && r.i < b + blk), y = a.map(r => r.y);
    console.log(`snaps ${String(b + 1).padStart(2)}-${String(Math.min(len, b + blk)).padEnd(2)}: avg ${f1(avg(y))} yd  med ${f1(med(y))}  10+ ${pc(a.filter(r => r.y >= 10).length, a.length)}  20+ ${pc(a.filter(r => r.y >= 20).length, a.length)}  sacks ${pc(a.filter(r => r.sack).length, a.length)}  away ${pc(a.filter(r => r.away).length, a.length)}  TD ${a.filter(r => r.td).length}  spies/snap ${f1(avg(a.map(r => r.spy)))}`); }
  const y = rows.map(r => r.y); console.log(`all ${rows.length}: avg ${f1(avg(y))} med ${f1(med(y))} 10+ ${pc(rows.filter(r => r.y >= 10).length, rows.length)} sacks ${pc(rows.filter(r => r.sack).length, rows.length)} thrown away ${pc(rows.filter(r => r.away).length, rows.length)} scrambled ${pc(rows.filter(r => r.scr).length, rows.length)} types ${JSON.stringify(rows.reduce((m, r) => (m[r.type] = (m[r.type] || 0) + 1, m), {}))}`);
  return rows;
}

// ------------------------------------------------------------ RB who jukes
function rbBot(B) { return pl => { const c = pl.carrier, inp = pl.input;
  if (!pl.handed || !c || c.unit !== 'O' || c === pl.qb || pl.ball.state !== 'held' || !c.upright()) { inp.x = inp.z = 0; return; }
  if (c.p.z < pl.losZ + 0.5) { botRun(pl, c, B, { jukeR: 2.4, hole: () => { const dx = pl.holeX - c.p.x, dz = Math.max(0.8, pl.losZ + 1.5 - c.p.z), m = hyp(dx, dz); return [dx / m, dz / m]; } }); return; }
  botRun(pl, c, B, { jukeR: 3.0 }); ripple(pl, B); }; }
function rbSuite(N) {
  seed = 7003;
  const runs = L.plays.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line' && p.carrier !== 'QB'), rows = { bot: [], cpu: [] }, ripples = [];
  const G = { bot: Film(), cpu: Film() };
  for (let i = 0; i < N; i++) {
    const o = L.teams[(i * 7 + 1) % 32], d = L.teams[(i * 7 + 4) % 32], op = runs[(i * 5) % runs.length], yl = 25 + (i * 13) % 50;
    const s0 = 70000 + i * 31;
    for (const who of ['bot', 'cpu']) {
      seed = s0; const g = G[who]; g.playN++; const dp = defCall(o, d, op, yl, who === 'bot' ? g : null, 1 + (i % 3)), flip = rnd() < 0.5;
      const B = newBot(), { res } = runOne(playOpts(o, d, op, dp, yl, who === 'bot' ? 'O' : null, flip, 3000 + i, who === 'bot' ? g : null), who === 'bot' ? rbBot(B) : null);
      if (who === 'bot') { filmNote(g, op, res); for (const j of B.log) if (j.bite != null) ripples.push(j.bite); }
      rows[who].push({ y: res.yards || 0, td: !!res.td, type: res.type, jukes: B.jukes, cuts: B.cuts });
    }
  }
  console.log(`\n=== RB RUNS (${N} run plays; bot = human-like juking runner, cpu = CPU runner on the same calls) ===`);
  for (const who of ['bot', 'cpu']) { const a = rows[who], y = a.map(r => r.y); console.log(`${who}: ypc ${f1(avg(y))} med ${f1(med(y))} <=0 ${pc(a.filter(r => r.y <= 0).length, a.length)} 10+ ${pc(a.filter(r => r.y >= 10).length, a.length)} 20+ ${pc(a.filter(r => r.y >= 20).length, a.length)} TD ${a.filter(r => r.td).length}${who === 'bot' ? `  jukes/run ${f1(avg(a.map(r => r.jukes)))} cuts/run ${f1(avg(a.map(r => r.cuts)))}` : ''}`); }
  console.log(`juke bite: far defenders (>6 m) moved ${avg(ripples).toFixed(2)} m/s toward the jab during it (n=${ripples.length} jukes)`);
  return rows;
}

module.exports = { PHYS, LG, L, byId, list, rnd, gauss, Film, filmNote, filmFor, filmThreats, newBot, threat, lane, botRun, runOne, playOpts, defCall, retOpts, retBot, qbBot, rbBot, setSeed: v => { seed = v >>> 0; } };
if (require.main === module) {
const t0 = Date.now();
console.log(`sim ${path.basename(path.dirname(SIMF))}/${path.basename(SIMF)}  diff ${DIFF}  scouting ${SCOUT ? 'on' : 'n/a'}`);
if (MODE === 'all' || MODE === 'ret') retSuite(Math.round(60 * SCALE));
if (MODE === 'all' || MODE === 'qb') qbSuite(Math.max(1, Math.round(6 * SCALE)), 24);
if (MODE === 'all' || MODE === 'rb') rbSuite(Math.round(300 * SCALE));
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
