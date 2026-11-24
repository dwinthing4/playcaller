// Fast play-by-play sim: every game that is not played live (CPU vs CPU, the user's Instant game, Sim week, Sim to playoffs).
// It runs on the same clock as a live match at L.qlen (src/match/10_match.js): the quarter length, the runoff between snaps
// (RUN = qlen x 0.035, 3..22 s), the two-minute warning, timeouts, the clock stopping on incompletions / out of bounds / scores,
// halftime, overtime, kickoffs and punts, field goals by kicker range and 4th-down calls by situation (cpuFourth / fgProb, 80_cpu.js).
// Each snap's outcome is drawn from distributions driven by the matchup (OL vs DL, QB and receivers vs coverage, back + line vs the
// front, coaching) and credited to real players picked by the rotation (rotSimShares, 25_rotation.js: roles, snap shares).
// League-average targets per play: ~1.9 points a drive, 62-66% completions, 7-8.5 yds/att, 4-4.5 yds/carry, sacks ~6.5% of dropbacks,
// INTs ~2.2% of attempts. qa/sim_compare.mjs prints this sim next to full engine games at the same quarter length.
// Output: { hs, as, st:{pid:{...}}, snaps:{pid:n}, box } (box = compact box score + drive chart, stored on the game as g.bx).

// live seconds per snap, fitted to the engine (qa/sim_compare.mjs engine ...): base + per yard gained
const FSIM_T = { run: [2.35, 0.07], pass: [3.0, 0.07], inc: 2.35, incDeep: 2.7, sack: 3.4, scr: [2.4, 0.13] };
// throw depth: [share when the call is not a deep shot, share on a deep call], completion base, INT base, air yards, yards after the catch
const FSIM_DEPTH = { s: { sh: [0.65, 0.3], c: 0.775, i: 0.012, air: [-1, 7], yac: 3.4 }, m: { sh: [0.28, 0.35], c: 0.6, i: 0.025, air: [10, 9], yac: 2.7 }, d: { sh: [0.07, 0.35], c: 0.4, i: 0.04, air: [20, 16], yac: 4 } };
const FSIM_K = { sack: 0.05, scr: 0.032, runMu: 3.3, runSd: 2.7, runBig: 0.052, fumRun: 0.012, fumCatch: 0.008, fumSack: 0.08, pen: 0.085, comp: -0.08, int: 0.86 };
let FSIM_NORM = null;   // league-average unit ratings (the matchup edges are measured against them), cached per league + season

function fsimAvg(ids, f) { let s = 0, n = 0; for (const id of ids) { const p = L.P[id]; if (!p) continue; s += f(p.a || {}, p); n++; } return n ? s / n : 60; }
function fsimTop(T, pos, n) { const out = (T.depth[pos] || []).filter(available).slice(0, n); if (out.length < n) for (const fp of FALLBACK[pos] || []) for (const id of (T.depth[fp] || []).filter(available)) { if (out.length >= n) break; if (!out.includes(id)) out.push(id); } return out; }
const FSIM_V = { pass: a => a.pbk || 50, run: a => a.rbk || 50, rush: a => (a.prs || 50) * 0.7 + (a.pow || 50) * 0.3, stop: a => (a.bsh || 50) * 0.6 + (a.str || 50) * 0.2 + (a.tak || 50) * 0.2, lb: a => (a.tak || 50) * 0.45 + (a.pur || 50) * 0.3 + (a.bsh || 50) * 0.25,
  cov: a => (a.mcv || 50) * 0.4 + (a.zcv || 50) * 0.4 + (a.spd || 50) * 0.2, tak: a => a.tak || 50, rb: a => (a.spd || 50) * 0.3 + (a.btk || 50) * 0.25 + (a.elu || 50) * 0.25 + (a.car || 50) * 0.2,
  sep: a => (a.rte || 50) * 0.5 + (a.spd || 50) * 0.3 + (a.cth || 50) * 0.2, qb: a => (a.tha || 50) * 0.7 + (a.awr || 50) * 0.3 };
// unit ratings of one team (healthy players only, the rotation's top of the depth chart)
function fsimUnits(T) {
  const qb = fsimTop(T, 'QB', 1)[0], ol = fsimTop(T, 'OT', 2).concat(fsimTop(T, 'OG', 2), fsimTop(T, 'C', 1)), dl = fsimTop(T, 'DE', 2).concat(fsimTop(T, 'DT', 2)), lb = fsimTop(T, 'LB', 3), cb = fsimTop(T, 'CB', 3), sf = fsimTop(T, 'S', 2);
  const G = {}; for (const pos of ROT_GROUPS) G[pos] = rotSimShares(T, pos);
  const Q = L.P[qb] || { a: {} }, qa = Q.a || {};
  // pass catchers: [id, pos, role, share, sep, cth, yac]
  const rc = []; const add = (pos, g) => g.order.forEach((id, i) => { const e = g.e[i]; if (e <= 0.005) return; const p = L.P[id]; if (!p) return; const a = p.a || {}, rl = g.rl || {};
    const role = pos === 'WR' ? (rl.X === id ? 'X' : rl.Z === id ? 'Z' : rl.SL === id ? 'SL' : 'W') : pos === 'TE' ? (rl.Y === id ? 'Y' : 'IN') : (rl.PD === id && rl.LEAD !== id ? 'PD' : 'B');
    rc.push({ id, pos, role, e, rz: pos === 'WR' && rl.RZ === id, sep: FSIM_V.sep(a), cth: a.cth || 50, yac: ((a.spd || 50) + (a.elu || 50) + (a.btk || 50)) / 3 }); });
  add('WR', G.WR); add('TE', G.TE); add('RB', G.RB);
  const rbs = G.RB.order.map((id, i) => ({ id, e: G.RB.e[i], v: FSIM_V.rb((L.P[id] || {}).a || {}), lead: G.RB.rl.LEAD === id, pd: G.RB.rl.PD === id, gl: G.RB.rl.GL === id })).filter(x => x.e > 0.005 && L.P[x.id]);
  if (!rbs.length && qb != null) rbs.push({ id: qb, e: 1, v: 50, lead: true });
  const k = fsimTop(T, 'K', 1)[0], pu = fsimTop(T, 'P', 1)[0], c = T.coach || {};
  return { T, qb, ol, G, rc, rbs, k, p: pu, fb: fsimTop(T, 'FB', 1)[0],
    qbAcc: FSIM_V.qb(qa), qbAwr: qa.awr || 50, qbMob: qa.spd || 50, olPass: fsimAvg(ol, FSIM_V.pass), olRun: fsimAvg(ol, FSIM_V.run),
    rcvSep: rc.length ? rc.filter(r => r.pos !== 'RB').slice(0, 4).reduce((s, r) => s + r.sep, 0) / Math.max(1, Math.min(4, rc.filter(r => r.pos !== 'RB').length)) : 55,
    dlRush: fsimAvg(dl, FSIM_V.rush), dlStop: fsimAvg(dl, FSIM_V.stop), lbStop: fsimAvg(lb, FSIM_V.lb), cov: (fsimAvg(cb, FSIM_V.cov) * 2 + fsimAvg(sf, FSIM_V.cov)) / 3, tack: fsimAvg(lb.concat(sf, cb.slice(0, 2)), FSIM_V.tak),
    rbBest: rbs.length ? rbs[0].v : 50,
    coachO: ((c.off || 5) - 5) * 0.6 + (T.oc ? ((T.oc.r || 5) - 5) * 0.4 : 0) + (T.morale != null ? (T.morale - 60) / 15 : 0),
    coachD: ((c.def || 5) - 5) * 0.6 + (T.dc ? ((T.dc.r || 5) - 5) * 0.4 : 0) + (T.morale != null ? (T.morale - 60) / 15 : 0),
    st: OFF_STYLES[T.offStyle] || OFF_STYLES.Balanced, ds: DEF_STYLES[T.defStyle] || DEF_STYLES.Balanced, ps: T.oc ? T.oc.persona : 'adaptive', dps: T.dc ? T.dc.persona : 'adaptive' };
}
function fsimNorm() {
  const key = L.year + '|' + L.teams.length;
  if (FSIM_NORM && FSIM_NORM.L === L && FSIM_NORM.key === key) return FSIM_NORM;
  const us = L.teams.map(fsimUnits), m = k => us.reduce((s, u) => s + u[k], 0) / us.length;
  FSIM_NORM = { L, key }; for (const k of ['qbAcc', 'qbAwr', 'olPass', 'olRun', 'rcvSep', 'dlRush', 'dlStop', 'lbStop', 'cov', 'tack', 'rbBest']) FSIM_NORM[k] = m(k);
  return FSIM_NORM;
}
// matchup edges for one offense against one defense (rating points, about 0 for an average matchup)
function fsimEdge(O, D, N, bonus) {
  const gen = (O.coachO - D.coachD) * 0.5 + bonus;
  return { gen, pr: (O.olPass - N.olPass) - (D.dlRush - N.dlRush) + gen * 0.5,
    cv: (O.rcvSep - N.rcvSep) * 0.6 + (O.qbAcc - N.qbAcc) * 0.6 - (D.cov - N.cov) + gen,
    rn: (O.olRun - N.olRun) * 0.55 + (O.rbBest - N.rbBest) * 0.35 - (D.dlStop - N.dlStop) * 0.45 - (D.lbStop - N.lbStop) * 0.35 + gen,
    yac: -(D.tack - N.tack) * 0.6 + gen * 0.5, awr: (O.qbAwr - N.qbAwr) - (D.cov - N.cov) * 0.5 };
}
const fsimSig = x => 1 / (1 + Math.exp(-x)), fsimLogit = p => Math.log(p / (1 - p));
function fsimPickW(list, w) { let s = 0; for (let i = 0; i < list.length; i++) s += w(list[i], i); let r = R() * s; for (let i = 0; i < list.length; i++) { r -= w(list[i], i); if (r <= 0) return list[i]; } return list[list.length - 1]; }
function fsimExp(mean) { return -Math.log(1 - R() * 0.999) * mean; }
function fsimShort(p) { return p ? `${p.fn ? p.fn[0] + '. ' : ''}${p.ln}` : '—'; }

// ---------- one game ----------
function fastGame(g, opt) {
  opt = opt || {};
  const H = L.teams[g.h], A = L.teams[g.a], qlen = L.qlen || 120, N = fsimNorm(), po = opt.playoffs != null ? !!opt.playoffs : L.phase === 'playoffs';
  const U = { [H.id]: fsimUnits(H), [A.id]: fsimUnits(A) };
  const dif = DIFFS[L.diff] || DIFFS.pro, ub = T => (T.id === L.user && !L.ghost ? dif.user * 0.3 : 0) - ((T.id === H.id ? A : H).id === L.user && !L.ghost ? dif.ai * 0.12 : 0);
  const homeB = g.neutral ? 0 : 0.8;
  const E = { [H.id]: fsimEdge(U[H.id], U[A.id], N, homeB * 0.5 + ub(H)), [A.id]: fsimEdge(U[A.id], U[H.id], N, -homeB * 0.5 + ub(A)) };
  const S = { q: 1, qlen, clock: qlen, RUN: clamp(qlen * 0.035, 3, 22), WARN: Math.min(120, qlen * 0.25), warned: {}, to: { [H.id]: 3, [A.id]: 3 }, score: { [H.id]: 0, [A.id]: 0 },
    poss: H.id, yl: 25, down: 1, togo: 10, runoff: 0, toChecked: false, pat: null, kickNext: null, freeKick: false, over: false, recvFirst: R() < 0.5 ? H.id : A.id, wasRunning: false };
  const st = {}; let buf = null;      // a snap's credits wait in buf until the play stands (a flag can wipe it out)
  const add = (pid, k, v) => { if (pid == null) return; const B = buf ? buf.st : st, s = B[pid] || (B[pid] = {}); s[k] = (s[k] || 0) + (v == null ? 1 : v); };
  const tadd = (i, k, v) => { if (buf) buf.ts.push(i, k, v == null ? 1 : v); else TS[i][k] += (v == null ? 1 : v); };
  const commit = () => { const b = buf; buf = null; if (!b) return; for (const pid in b.st) for (const k in b.st[pid]) add(+pid, k, b.st[pid][k]); for (let i = 0; i < b.ts.length; i += 3) TS[b.ts[i]][b.ts[i + 1]] += b.ts[i + 2]; };
  const opp = tid => (tid === H.id ? A.id : H.id), side = tid => (tid === H.id ? 0 : 1);
  const TS = [0, 1].map(() => ({ fd: 0, py: 0, ry: 0, pa: 0, pc: 0, ra: 0, sk: 0, sky: 0, to: 0, pen: 0, peny: 0, tdc: 0, tda: 0, top: 0, plays: 0, snaps: 0, pts: 0, drives: 0, tds: 0, ptd: 0, rtd: 0, pint: 0, fumL: 0, pnt: 0, fga: 0, fgm: 0, xpa: 0, tos: 0 }));
  const LS = [[0, 0, 0, 0], [0, 0, 0, 0]], DR = []; let drive = null, guard = 0;
  const tm = tid => L.teams[tid], P = id => L.P[id];
  const tick = sec => { const s = Math.max(0, Math.min(S.clock, sec)); S.clock -= s; if (drive) TS[side(drive.tid)].top += s; };
  const openDrive = () => { drive = { tid: S.poss, q: Math.min(S.q, 5), clk: Math.round(S.clock), yl0: Math.round(S.yl), plays: 0, yds: 0, res: '', txt: '' }; TS[side(S.poss)].drives++; };
  const closeDrive = (res, txt) => { if (!drive) return; drive.res = res; if (txt) drive.txt = txt; DR.push(drive); drive = null; };
  const setPoss = (tid, yl, why) => { if (drive) closeDrive(why || 'Turnover'); S.poss = tid; S.yl = clamp(yl, 1, 99); S.down = 1; S.togo = Math.min(10, 100 - S.yl); openDrive(); };
  const scoreIt = (tid, pts, why, td, txt) => {
    S.score[tid] += pts; TS[side(tid)].pts += pts; LS[side(tid)][Math.min(S.q, 5) - 1] = (LS[side(tid)][Math.min(S.q, 5) - 1] || 0) + pts;
    if (S.q >= 5) { if (td) TS[side(tid)].tds++; S.over = true; closeDrive(why, txt); return; }
    if (td) { TS[side(tid)].tds++; closeDrive(why, txt); S.pat = { tid }; S.kickNext = tid; return; }
    S.kickNext = tid;
  };
  const late = () => (S.q === 2 && S.clock <= S.WARN) || (S.q >= 4 && S.clock <= S.qlen / 3);
  // ---- special teams (the match's non-visual paths: doKickoff, punt, fieldGoal, kickXP)
  const kickoff = (kicker, free) => {
    const recv = opp(kicker), KU = U[kicker], k = P(KU.k), kp = k ? k.a.kpw : 70, kac = k ? k.a.kac : 65, from = free ? 20 : 35; S.freeKick = false;
    if (k) add(k.id, 'ko', 1);
    const sd = S.score[kicker] - S.score[recv], late4 = S.q >= 4 ? S.clock / S.qlen : 9, lateH = (S.q === 2 || S.q >= 4) && S.clock < S.qlen * 0.15;
    let kind = 'deep'; if (!free) { if (sd < 0 && sd >= -16 && late4 < (sd >= -8 ? 0.28 : 0.5)) kind = 'onside'; else if (sd < 0 && S.q >= 3 && R() < 0.006) kind = 'onside'; else if (lateH && sd >= 0 && R() < 0.45) kind = 'squib'; }
    if (kind === 'deep' && R() < 0.006 * clamp(1 + (70 - kac) * 0.015, 0.55, 1.45)) { TS[side(kicker)].pen++; TS[side(kicker)].peny += 5; return setPoss(recv, 40, 'kick'); }
    if (kind === 'onside') { const exp = (S.q >= 4 && sd < 0 && S.clock < S.qlen * 0.55), got = R() < clamp((exp ? 0.11 : 0.52) + (kac - 70) / 600, 0.04, 0.65), spot = from + Math.round(10 + R() * 3); tick(3); return got ? setPoss(kicker, spot, 'Onside') : setPoss(recv, 100 - spot, 'kick'); }
    if (kind === 'squib') { const ret = clamp(Math.round(30 + gauss() * 5), 15, 48); tick(5); return R() < 0.015 ? setPoss(kicker, 100 - ret, 'kick') : setPoss(recv, ret, 'kick'); }
    const tb = !free && R() < clamp(0.38 + (kp - 60) * 0.012, 0.15, 0.88);
    if (tb) return setPoss(recv, 25, 'kick');
    tick(5); const ret = clamp(Math.round(23 + gauss() * 7 + (free ? 9 : 0) + (R() < 0.06 ? 18 : 0)), 5, 60);
    if (R() < 0.01) { S.poss = recv; return scoreIt(recv, 6, 'Kick return TD', true, `${tm(recv).abbr} kick return touchdown`); }
    if (R() < 0.008) return setPoss(kicker, 100 - ret, 'kick');
    setPoss(recv, R() < 0.07 ? Math.max(1, ret - 10) : ret, 'kick');
  };
  const punt = tid => {
    S.clock = Math.max(0, S.clock - S.runoff); S.runoff = 0; S.toChecked = false;
    const recv = opp(tid), pp = P(U[tid].p), kp = pp ? pp.a.kpw : 65, dist = Math.round(clamp(41 + (kp - 70) * 0.25 + gauss() * 5.5, 22, 70)), land = S.yl + dist; tick(6);
    if (pp) { add(pp.id, 'pnt', 1); add(pp.id, 'pnty', dist); } TS[side(tid)].pnt++;
    closeDrive('Punt');
    if (land >= 99) return setPoss(recv, 20, 'Punt');
    const fair = R() < 0.36, ret = fair ? 0 : Math.max(0, Math.round(7 + gauss() * 5 + (R() < 0.04 ? 25 : 0)));
    if (!fair && R() < 0.006) { S.poss = recv; openDrive(); return scoreIt(recv, 6, 'Punt return TD', true, `${tm(recv).abbr} punt return touchdown`); }
    const ryl = clamp(100 - land + ret, 1, 99); setPoss(recv, !fair && R() < 0.07 ? Math.max(1, ryl - 10) : ryl, 'Punt');
  };
  const fieldGoal = tid => {
    S.clock = Math.max(0, S.clock - S.runoff); S.runoff = 0; S.toChecked = false;
    const fg = fgProb(tm(tid), Math.round(S.yl)), k = P(U[tid].k), good = R() < fg.p; tick(4);
    if (k) { add(k.id, 'fga', 1); if (good) add(k.id, 'fgm', 1); } TS[side(tid)].fga++; if (good) TS[side(tid)].fgm++;
    if (good) { closeDrive('FG', `${fsimShort(k)} ${fg.d}-yd FG`); return scoreIt(tid, 3, `${fg.d}-yd FG`); }
    closeDrive('Missed FG', `${fsimShort(k)} ${fg.d}-yd FG no good`); setPoss(opp(tid), Math.max(20, 100 - (S.yl - 7)), 'Missed FG');
  };
  const pat = () => {
    const t = S.pat.tid, d = S.score[t] - S.score[opp(t)];
    if (S.q >= 4 && S.clock < S.qlen * 0.6 && [-2, 1, 5, -5, -10, -12].includes(d)) {
      const e = E[t], pass = R() < 0.55, ok = R() < clamp(0.47 + (pass ? e.cv : e.rn) * 0.012, 0.25, 0.7); TS[side(t)].plays++;
      if (ok) { S.score[t] += 2; TS[side(t)].pts += 2; LS[side(t)][Math.min(S.q, 5) - 1] += 2; }
      S.pat = null; return;
    }
    const fg = fgProb(tm(t), 85), k = P(U[t].k), good = R() < fg.p; if (k) { add(k.id, 'xpa', 1); if (good) add(k.id, 'xpm', 1); } TS[side(t)].xpa++;
    if (good) { S.score[t] += 1; TS[side(t)].pts += 1; LS[side(t)][Math.min(S.q, 5) - 1] += 1; }
    S.pat = null;
  };
  const endQuarter = () => {
    const q = S.q; S.runoff = 0; S.toChecked = false;
    if (q === 2) { closeDrive('End of half'); S.q = 3; S.clock = S.qlen; S.to[H.id] = S.to[A.id] = 3; S.kickNext = S.recvFirst; S.freeKick = false; return; }
    if (q === 1 || q === 3) { S.q++; S.clock = S.qlen; return; }
    const tie = S.score[H.id] === S.score[A.id];
    if (tie && (q === 4 || po)) { closeDrive('End of regulation'); S.q++; S.clock = S.qlen; S.to[H.id] = S.to[A.id] = 2; S.pat = null; S.kickNext = R() < 0.5 ? H.id : A.id; if (LS[0].length < 5) { LS[0].push(0); LS[1].push(0); } return; }
    closeDrive('End of game'); S.over = true;
  };
  const cpuTimeout = () => {
    if (S.runoff <= 0) return false;
    for (const tid of [S.poss, opp(S.poss)]) {
      if (S.to[tid] <= 0) continue; const sd = S.score[tid] - S.score[opp(tid)], late4 = S.q >= 4 && S.clock < S.qlen * 0.45, late2 = S.q === 2 && S.clock < S.qlen * 0.3;
      if ((late4 && sd < 0) || (late4 && sd === 0 && tid === S.poss && S.yl > 40) || (late2 && tid === S.poss && S.yl > 45)) { S.to[tid]--; S.runoff = 0; TS[side(tid)].tos++; return true; }
    }
    return false;
  };
  // ---- defenders credited on a play (rotation shares inside each position)
  const DW = { run: [['DE', 2.2], ['DT', 2], ['LB', 4.5], ['S', 1.4], ['CB', 1]], short: [['LB', 3.3], ['CB', 3.5], ['S', 2.4], ['DE', 0.4], ['DT', 0.3]], deep: [['CB', 5], ['S', 4.5], ['LB', 0.6]],
    sack: [['DE', 5.5], ['DT', 2.6], ['LB', 1.5], ['S', 0.2], ['CB', 0.2]], blitz: [['DE', 4.2], ['DT', 2], ['LB', 3], ['S', 0.6], ['CB', 0.5]], pd: [['CB', 6], ['S', 2.5], ['LB', 1.5]], int: [['CB', 4.5], ['S', 4], ['LB', 1.5]] };
  const RANKW = [1, 0.95, 0.75, 0.6, 0.5, 0.45];
  const defPick = (dtid, kind) => { const G = U[dtid].G, pos = fsimPickW(DW[kind], x => (G[x[0]] && G[x[0]].order.length ? x[1] : 0))[0], g2 = G[pos]; if (!g2 || !g2.order.length) return null;
    return fsimPickW(g2.order, (id, i) => g2.e[i] * RANKW[Math.min(i, 5)]); };
  const tackle = (dtid, kind, solo) => { const a = defPick(dtid, kind); if (a == null) return null; add(a, 'tk'); if (!solo && R() < 0.3) { const b = defPick(dtid, kind); if (b != null && b !== a) add(b, 'tk'); } return a; };
  // ---- one scrimmage snap: returns a result like the engine's ({type, y, t, clockStop, td, ...}) and credits the players
  const snap = () => {
    const off = S.poss, def = opp(off), so = side(off), O = U[off], D = U[def], e = E[off], yl = S.yl, down = S.down, togo = S.togo, sd = S.score[off] - S.score[def];
    // run or pass: the CPU caller's logic (cpuCall, 80_cpu.js)
    let pass = O.st.pass; if (down === 3 && togo >= 6) pass = 0.88; else if (down >= 3 && togo <= 2) pass = 0.35;
    const lt = S.q >= 4 && S.clock < S.qlen * 0.45; if (lt && sd < 0) pass = Math.max(pass, 0.8); if (lt && sd > 0) pass = Math.min(pass, 0.3);
    if (O.ps === 'conservative') pass -= 0.06; if (O.ps === 'aggressive') pass += 0.05;
    const isPass = R() < pass, blitz = R() < D.ds.blitz + (D.dps === 'blitz' ? 0.2 : D.dps === 'conservative' ? -0.1 : 0) * (lt && sd < 0 ? 0.5 : 1);
    const toGoal = 100 - yl, rz = yl >= 80;
    const res = { y: 0, t: 0, type: 'tackle', clockStop: false, td: false, turnover: null, desc: '' };
    const qbP = P(O.qb);
    if (isPass) {
      const deepCall = R() < O.st.deep + (O.ps === 'aggressive' ? 0.15 : 0) && yl < 85;
      const pSack = clamp(FSIM_K.sack * Math.exp(-0.05 * e.pr) * (blitz ? 1.35 : 0.92) * (deepCall ? 1.15 : 0.95) * (1 - (O.qbMob - 65) * 0.004), 0.012, 0.2);
      if (R() < pSack) {
        const y = -Math.round(3 + R() * 6.5); res.type = 'sack'; res.y = y; res.t = FSIM_T.sack + R() * 0.8; res.sack = true;
        const sk = defPick(def, blitz ? 'blitz' : 'sack'); if (sk != null) { add(sk, 'sk', 1); add(sk, 'tk'); if (R() < 0.12) { const s2 = defPick(def, 'sack'); if (s2 != null && s2 !== sk) { add(s2, 'sk', 0.5); add(s2, 'tk'); } } }
        tadd(so, 'sk'); tadd(so, 'sky', -(res.y));
        if (R() < FSIM_K.fumSack) { add(O.qb, 'fum'); if (sk != null) add(sk, 'ff'); if (R() < 0.5) { res.turnover = 'fumble'; res.recBy = def; res.clockStop = true; } }
        res.desc = `${fsimShort(qbP)} sacked for ${res.y}`;
        return res;
      }
      if (R() < clamp(FSIM_K.scr + (O.qbMob - 70) * 0.0018 + (blitz ? 0.01 : 0), 0.006, 0.09)) {
        let y = Math.round(1.5 + fsimExp(4.2) + (O.qbMob - 70) * 0.06 + e.rn * 0.04); if (R() < 0.12) y = -Math.round(R() * 2); y = Math.min(y, toGoal);
        res.type = R() < 0.32 ? 'oob' : 'tackle'; res.y = y; res.t = FSIM_T.scr[0] + Math.max(0, y) * FSIM_T.scr[1]; res.kind = 'scramble'; add(O.qb, 'ra'); add(O.qb, 'ry', y); tadd(so, 'ra'); tadd(so, 'ry', y);
        if (y >= toGoal) { res.td = true; res.type = 'td'; res.clockStop = true; add(O.qb, 'rtd'); tadd(so, 'rtd'); } else if (res.type === 'tackle') tackle(def, 'run', true); else res.clockStop = late();
        res.desc = `${fsimShort(qbP)} scrambles for ${y}${res.td ? ', TOUCHDOWN' : ''}`;
        return res;
      }
      // the throw
      let dk = R() < FSIM_DEPTH.d.sh[deepCall ? 1 : 0] / (FSIM_DEPTH.d.sh[deepCall ? 1 : 0] + FSIM_DEPTH.m.sh[deepCall ? 1 : 0] + FSIM_DEPTH.s.sh[deepCall ? 1 : 0]) ? 'd' : null;
      if (!dk) dk = R() < FSIM_DEPTH.m.sh[deepCall ? 1 : 0] / (FSIM_DEPTH.m.sh[deepCall ? 1 : 0] + FSIM_DEPTH.s.sh[deepCall ? 1 : 0]) ? 'm' : 's';
      if (toGoal < 12 && dk === 'd') dk = 'm'; if (toGoal < 6 && dk === 'm') dk = 's';
      if (down >= 3 && togo >= 8 && dk === 's' && R() < 0.4) dk = 'm';
      const DP = FSIM_DEPTH[dk], third = down === 3 && togo >= 7;
      const tg = fsimPickW(O.rc, r => { let w = r.e * (r.pos === 'WR' ? 1 : r.pos === 'TE' ? 0.62 : 0.34) * (1 + (r.sep - 60) * 0.012);
        if (dk === 'd') w *= r.role === 'X' ? 2 : r.role === 'Z' ? 1.1 : r.role === 'SL' ? 0.6 : r.pos === 'TE' ? 0.45 : r.pos === 'RB' ? 0.04 : 0.8;
        else if (dk === 'm') w *= r.role === 'X' ? 1.05 : r.role === 'Z' ? 1.25 : r.role === 'SL' ? 1 : r.pos === 'TE' ? 1.1 : r.pos === 'RB' ? 0.3 : 0.9;
        else w *= r.role === 'SL' ? 1.35 : r.role === 'Z' ? 1.1 : r.role === 'X' ? 0.75 : r.pos === 'TE' ? 1.1 : r.pos === 'RB' ? (r.role === 'PD' && third ? 2.6 : 1.7) : 0.9;
        if (rz && r.rz) w *= 1.6; if (rz && r.pos === 'TE') w *= 1.25; return Math.max(0.0001, w); });
      const tp = tg ? P(tg.id) : null; add(O.qb, 'pa'); tadd(so, 'pa'); if (tg) add(tg.id, 'tgt');
      const cth = tg ? tg.cth : 55, sep = tg ? tg.sep : 55;
      let pc = fsimSig(fsimLogit(DP.c) + FSIM_K.comp + e.cv * 0.035 + (cth - 68) * 0.012 + (sep - 66) * 0.008 - (blitz ? 0.04 : 0) - (rz ? 0.18 : 0) - (third ? 0.08 : 0));
      const pInt = clamp(DP.i * FSIM_K.int * Math.exp(-0.035 * e.awr - 0.02 * e.cv) * (blitz ? 1.1 : 1) * (third ? 1.15 : 1), 0.003, 0.09);
      if (R() < pInt) {
        const air = Math.round(DP.air[0] + R() * DP.air[1]), spot = clamp(yl + Math.max(1, air), 1, 110), who = defPick(def, 'int'); res.type = 'int'; res.turnover = 'int'; res.clockStop = true; res.t = FSIM_T.inc + 1.5 + R();
        add(O.qb, 'pint'); tadd(so, 'pint'); if (who != null) { add(who, 'int'); add(who, 'pd'); }
        const ret = Math.round(fsimExp(9)); res.retYl = spot >= 100 ? 20 : clamp(100 - spot + ret, 1, 99); res.defTD = spot < 100 && (100 - spot + ret >= 100 || R() < 0.03); res.recBy = def;
        res.desc = `${fsimShort(qbP)} INTERCEPTED by ${fsimShort(P(who))}${res.defTD ? ', returned for a TD' : ''}`; res.intBy = who;
        return res;
      }
      if (R() >= pc) {
        res.type = 'inc'; res.clockStop = true; res.t = dk === 'd' ? FSIM_T.incDeep : FSIM_T.inc; if (R() < 0.3) { const d2 = defPick(def, 'pd'); if (d2 != null) add(d2, 'pd'); }
        res.desc = `${fsimShort(qbP)} pass incomplete${tp ? ' to ' + fsimShort(tp) : ''}`; return res;
      }
      const air = Math.round(DP.air[0] + R() * DP.air[1] * (dk === 'd' ? R() * 0.9 + 0.35 : 1));
      let yac = Math.round(fsimExp(DP.yac) * (1 + ((tg ? tg.yac : 60) - 68) * 0.012 + e.yac * 0.02)); if (R() < (dk === 's' ? 0.03 : 0.022) * (1 + e.yac * 0.03)) yac += Math.round(10 + fsimExp(18));
      let y = air + yac; const td = y >= toGoal; if (td) y = toGoal;
      res.y = y; res.t = FSIM_T.pass[0] + Math.max(0, y) * FSIM_T.pass[1] + R() * 0.6; res.kind = 'pass'; res.catcher = tg && tg.id;
      add(O.qb, 'pc'); add(O.qb, 'py', y); tadd(so, 'pc'); tadd(so, 'py', y); if (tg) { add(tg.id, 'rec'); add(tg.id, 'recy', y); }
      if (td) { res.td = true; res.type = 'td'; res.clockStop = true; add(O.qb, 'ptd'); if (tg) add(tg.id, 'rectd'); tadd(so, 'ptd'); }
      else if (R() < 0.075 + (late() ? 0.08 : 0)) { res.type = 'oob'; res.clockStop = late(); if (R() < 0.5) tackle(def, dk === 'd' ? 'deep' : 'short', true); }
      else { const tk = tackle(def, dk === 'd' ? 'deep' : 'short'); if (R() < FSIM_K.fumCatch) { if (tg) add(tg.id, 'fum'); if (tk != null) add(tk, 'ff'); if (R() < 0.55) { res.turnover = 'fumble'; res.recBy = def; res.clockStop = true; res.type = 'fumbleLost'; } } }
      res.desc = `${fsimShort(qbP)} to ${fsimShort(tp)} for ${y} yd${Math.abs(y) === 1 ? '' : 's'}${res.td ? ', TOUCHDOWN' : ''}`;
      return res;
    }
    // ---- run: who carries (lead back, 3rd-down back, short-yardage back, now and then the QB)
    const shortY = (down >= 3 && togo <= 2) || yl >= 97, thirdL = down >= 3 && togo >= 7;
    let car = null; if (R() < clamp(0.03 + (O.qbMob - 72) * 0.004, 0, 0.12)) car = { id: O.qb, v: (O.qbMob + 50) / 2, qb: 1 };
    if (!car) car = fsimPickW(O.rbs, r => r.e * (shortY && r.gl ? 4 : 1) * (thirdL && r.pd ? 2.5 : 1));
    const cp = P(car.id), crn = e.rn + (car.v - N.rbBest) * 0.35;
    let mu = FSIM_K.runMu + crn * 0.075, sdv = FSIM_K.runSd;
    if (yl >= 95) { mu = 1.4 + crn * 0.05; sdv = 1.8; } else if (togo <= 2 && down >= 3) { mu = 2.4 + crn * 0.06; sdv = 2.1; }
    let y = Math.round(mu + sdv * gauss()); if (y < -4) y = -4 + Math.round(R()); if (yl < 95 && R() < clamp(FSIM_K.runBig + crn * 0.003, 0.015, 0.11)) y += Math.round(5 + fsimExp(13));
    if (y >= toGoal) y = toGoal; if (yl + y <= 0) y = -yl;
    res.y = y; res.t = FSIM_T.run[0] + Math.max(0, y) * FSIM_T.run[1] + R() * 0.5; res.kind = 'run'; add(car.id, 'ra'); add(car.id, 'ry', y); tadd(so, 'ra'); tadd(so, 'ry', y);
    if (y >= toGoal) { res.td = true; res.type = 'td'; res.clockStop = true; add(car.id, 'rtd'); tadd(so, 'rtd'); }
    else if (R() < 0.015 + (late() ? 0.03 : 0)) { res.type = 'oob'; res.clockStop = late(); }
    else { const tk = tackle(def, 'run'); if (R() < FSIM_K.fumRun * (1 + (70 - ((cp && cp.a.car) || 70)) * 0.03)) { add(car.id, 'fum'); if (tk != null) add(tk, 'ff'); if (R() < 0.55) { res.turnover = 'fumble'; res.recBy = def; res.clockStop = true; res.type = 'fumbleLost'; } } }
    res.desc = `${fsimShort(cp)} runs for ${y} yd${Math.abs(y) === 1 ? '' : 's'}${res.td ? ', TOUCHDOWN' : ''}`;
    return res;
  };
  // pre-snap and post-snap flags (yards only; the engine calls them in full)
  const flag = () => {
    if (R() >= FSIM_K.pen) return null; const offF = R() < 0.55, r = R();
    if (offF) return r < 0.42 ? { by: S.poss, y: -5, dead: true } : r < 0.92 ? { by: S.poss, y: -10 } : { by: S.poss, y: -15 };
    return r < 0.35 ? { by: opp(S.poss), y: 5, dead: true } : r < 0.7 ? { by: opp(S.poss), y: 5, auto: true } : r < 0.9 ? { by: opp(S.poss), y: Math.round(8 + R() * 22), auto: true } : { by: opp(S.poss), y: 15, auto: true };
  };
  const applyFlag = f => {
    TS[side(f.by)].pen++; TS[side(f.by)].peny += Math.abs(f.y);
    const off = f.by === S.poss; let y = f.y; if (off) y = -Math.min(-y, Math.floor(S.yl / 2)); else y = Math.min(y, Math.max(1, Math.floor((100 - S.yl) / 2)), 99 - S.yl);
    S.yl = clamp(S.yl + y, 1, 99); if (drive) drive.yds += y; S.togo -= y;
    if (!off && (f.auto || S.togo <= 0)) { S.down = 1; S.togo = Math.min(10, 100 - S.yl); TS[side(S.poss)].fd++; } else if (S.togo <= 0) { S.down = 1; S.togo = Math.min(10, 100 - S.yl); }
  };
  // ---- the game loop: nextSnap() of the match, step for step
  S.poss = S.recvFirst; S.kickNext = opp(S.recvFirst);
  while (!S.over && guard++ < 2000) {
    if (S.pat) { pat(); continue; }
    if (S.clock <= 0) { endQuarter(); continue; }
    if (S.kickNext != null) { const k = S.kickNext, fr = S.freeKick; S.kickNext = null; kickoff(k, fr); continue; }
    if ((S.q === 2 || S.q === 4) && !S.warned[S.q] && S.clock > S.WARN && S.clock - S.runoff <= S.WARN) { S.clock = S.WARN; S.runoff = 0; S.warned[S.q] = true; continue; }
    if (!S.toChecked) { S.toChecked = true; if (cpuTimeout()) continue; }
    const off = S.poss;
    if (S.down === 4) { const d = cpuFourth(off, { yl: Math.round(S.yl), togo: Math.max(1, Math.round(S.togo)), q: Math.min(S.q, 4), clock: Math.max(0, S.clock - S.runoff), qlen: S.qlen, sd: S.score[off] - S.score[opp(off)] });
      if ((d === 'punt' && S.yl < 72) || (d === 'fg' && S.yl >= 52)) { if (S.runoff > 0 && S.clock - S.runoff <= 0) { S.clock = 0; S.runoff = 0; continue; } if (d === 'punt') punt(off); else fieldGoal(off); continue; } }
    // the snap
    if (S.runoff > 0 && S.clock - S.runoff <= 0) { tick(S.clock); S.runoff = 0; continue; }
    S.wasRunning = S.runoff > 0; tick(S.runoff); S.runoff = 0; S.toChecked = false;
    const f = flag(), so = side(off);
    if (f && f.dead) { applyFlag(f); S.runoff = late() || !S.wasRunning ? 0 : S.RUN * 0.55; continue; }
    const yl0 = S.yl, togo0 = S.togo, clock0 = S.clock, down0 = S.down, def = opp(off);
    buf = { st: {}, ts: [] }; const res = snap();
    tick(res.t);
    let stop = !!res.clockStop, warn = false;
    if ((S.q === 2 || S.q === 4) && !S.warned[S.q] && clock0 > S.WARN && S.clock <= S.WARN) { S.warned[S.q] = true; warn = true; stop = true; }
    // a flag on the play: the other side takes the better of the play and the penalty. Accepted = the play is wiped out (its stats too)
    if (f && (f.by === off ? !res.turnover : !(res.td || (res.type !== 'inc' && !res.turnover && res.y >= f.y)))) {
      buf = null; TS[so].snaps++;
      applyFlag(f); S.runoff = late() || stop || !S.wasRunning ? 0 : S.RUN * 0.55; continue;
    }
    commit(); tadd(so, 'plays'); tadd(so, 'snaps'); if (drive) drive.plays++;
    if (down0 === 3) { tadd(so, 'tda'); }
    if (res.turnover === 'int') { tadd(so, 'to'); closeDrive('INT', res.desc); if (res.defTD) { S.poss = def; openDrive(); scoreIt(def, 6, 'Interception return TD', true, `${fsimShort(P(res.intBy))} interception return TD`); } else setPoss(def, res.retYl, 'INT'); continue; }
    if (res.turnover === 'fumble') { tadd(so, 'to'); tadd(so, 'fumL'); const spot = clamp(yl0 + res.y, 1, 99); closeDrive('Fumble', res.desc); if (R() < 0.02) { S.poss = def; openDrive(); scoreIt(def, 6, 'Fumble return TD', true, 'Fumble return touchdown'); } else setPoss(def, 100 - spot, 'Fumble'); continue; }
    if (yl0 + res.y <= 0 && !res.td) { S.score[def] += 2; TS[side(def)].pts += 2; LS[side(def)][Math.min(S.q, 5) - 1] += 2; closeDrive('Safety', `${tm(def).abbr} safety`); if (S.q >= 5) { S.over = true; break; } S.kickNext = off; S.freeKick = true; continue; }
    if (res.td) { if (drive) drive.yds += 100 - yl0; if (down0 === 3) tadd(so, 'tdc'); S.yl = 100; scoreIt(off, 6, 'TD', true, res.desc); continue; }
    if (res.type === 'inc') { S.down++; stop = true; }
    else { const ny = clamp(yl0 + res.y, 0.5, 99.5); if (drive) drive.yds += ny - yl0; S.yl = ny;
      if (S.yl >= yl0 + togo0 - 1e-6) { S.down = 1; S.togo = Math.min(10, 100 - S.yl); tadd(so, 'fd'); if (down0 === 3) tadd(so, 'tdc'); } else { S.down++; S.togo = yl0 + togo0 - S.yl; } }
    if (S.down > 4) { const ny = 100 - S.yl; closeDrive('Downs'); setPoss(def, ny, 'Downs'); continue; }
    S.runoff = stop ? 0 : S.RUN * (0.85 + R() * 0.3);
    if (res.type === 'oob' && !warn && !late()) S.runoff = S.RUN * 0.5;
  }
  if (drive) closeDrive('End of game');
  // snaps: each player's rotation share of his unit's plays (the quick sim's snap model, now on the real play count)
  const snaps = {};
  for (const T of [H, A]) { const u = U[T.id], oP = TS[side(T.id)].snaps, dP = TS[1 - side(T.id)].snaps;
    for (const pos of ROT_GROUPS) { const g2 = u.G[pos], n = DEF_POS.includes(pos) ? dP : oP; g2.order.forEach((id, i) => { const v = Math.round(n * g2.e[i]); if (v > 0) snaps[id] = v; }); }
    if (u.qb != null) snaps[u.qb] = oP; for (const id of u.ol) snaps[id] = oP; if (u.fb != null) snaps[u.fb] = Math.max(snaps[u.fb] || 0, Math.round(oP * 0.15));
    const kicks = (st[u.k] ? (st[u.k].fga || 0) + (st[u.k].xpa || 0) + (st[u.k].ko || 0) : 0); if (u.k != null && kicks) snaps[u.k] = kicks; if (u.p != null && st[u.p] && st[u.p].pnt) snaps[u.p] = st[u.p].pnt; }
  for (const pid in st) delete st[pid].ko;
  for (const pid in snaps) (st[pid] = st[pid] || {}).snaps = snaps[pid];
  const box = fsimBox(H, A, TS, LS, DR, st, S.q);
  return { hs: S.score[H.id], as: S.score[A.id], st, snaps, box, t: { h: TS[0], a: TS[1] }, q: S.q };
}
// ---------- box scores ----------
// g.bx = { v:1, q: quarters played, ls: [[away by quarter], [home by quarter]], ts: [away, home] team totals, dr: drive chart [q, clock, side(0 away / 1 home), plays, yds, result, text], pl: [away lines, home lines] }
const FSIM_BOXK = ['pa', 'pc', 'py', 'ptd', 'pint', 'ra', 'ry', 'rtd', 'rec', 'recy', 'rectd', 'tgt', 'tk', 'sk', 'int', 'pd', 'ff', 'fum', 'fgm', 'fga', 'xpm', 'xpa', 'pnt', 'pnty'];
function fsimBox(H, A, TS, LS, DR, st, q) {
  const tsOut = s => ({ fd: s.fd, py: s.py - s.sky, ry: s.ry, ty: s.py - s.sky + s.ry, pa: s.pa, pc: s.pc, ra: s.ra, sk: s.sk, to: s.to, pen: s.pen, peny: s.peny, td3: `${s.tdc}-${s.tda}`, top: Math.round(s.top), plays: s.plays });
  const lines = T => { const ids = new Set(T.roster); const out = []; for (const pid in st) { if (!ids.has(+pid)) continue; const c = glPack(st[pid], true); if (c) out.push([+pid, c]); } return out; };
  return { v: 1, q, ls: [LS[1].slice(), LS[0].slice()], ts: [tsOut(TS[1]), tsOut(TS[0])], dr: DR.map(d => [d.q, d.clk, d.tid === H.id ? 1 : 0, d.plays, Math.round(d.yds), d.res, d.txt || '']), pl: [lines(A), lines(H)] };
}
// a box score for a game played live, from the match result (same shape as the fast sim's)
function fsimBoxFromResult(g, result) {
  const H = L.teams[g.h], A = L.teams[g.a], st = {};
  for (const pid in (result.st || {})) { st[pid] = Object.assign({}, result.st[pid]); }
  const tot = T => { const ids = new Set(T.roster), o = { fd: 0, py: 0, ry: 0, pa: 0, pc: 0, ra: 0, sk: 0, sky: 0, to: 0, pen: 0, peny: 0, tdc: 0, tda: 0, top: 0, plays: 0 };
    for (const pid in st) { if (!ids.has(+pid)) continue; const s = st[pid]; o.py += s.py || 0; o.ry += s.ry || 0; o.pa += s.pa || 0; o.pc += s.pc || 0; o.ra += s.ra || 0; }
    const opp = T === H ? A : H, oids = new Set(opp.roster); for (const pid in st) if (oids.has(+pid)) o.sk += st[pid].sk || 0; o.sk = Math.round(o.sk);
    const pn = (result.pen && result.pen[T.id]) || { n: 0, yds: 0 }; o.pen = pn.n || 0; o.peny = pn.yds || 0;
    for (const d of (result.drives || [])) if (d.tid === T.id) { o.plays += d.plays || 0; if (d.result === 'INT' || d.result === 'Fumble') o.to++; }
    return o; };
  const TH = tot(H), TA = tot(A);
  const dr = (result.drives || []).map(d => ({ tid: d.tid, q: d.q, clk: 0, plays: d.plays, yds: d.yds, res: d.result, txt: '' }));
  // the scoring plays' text from the play-by-play ("Q1 1:12 — ABC <how> (score)")
  const sc = (result.pbp || []).filter(l => / — /.test(l) && /\(/.test(l) && !/Timeout/.test(l)); let si = 0;
  for (const d of dr) if (/TD|FG/.test(d.res) && sc[si]) { const m = / — \S+ (.*) \(/.exec(sc[si++]); if (m) d.txt = m[1].slice(0, 70); }
  // line score from the scoring lines ("Q2 1:12 — ABC how (AWY 7, HOM 3)"): what the totals gained beyond the score itself is the
  // previous touchdown's extra point (or a safety), so it goes to that quarter; the last PAT is what the final adds
  const ot = (result.pbp || []).some(l => /^\d*OT /.test(l)), LH = [0, 0, 0, 0], LA = [0, 0, 0, 0]; if (ot) { LH.push(0); LA.push(0); }
  let pa = 0, ph = 0, lq = 0;
  for (const l of sc) { const m = /^(?:Q(\d)|\d*OT) \S+ — (\S+) (.*) \((\S+) (\d+), (\S+) (\d+)\)$/.exec(l); if (!m) continue;
    const q = Math.min(5, m[1] ? +m[1] : 5) - 1, a = +m[5], h = +m[7], ev = /FG/.test(m[3]) ? 3 : 6, home = m[2] === H.abbr;
    let da = a - pa, dh = h - ph; if (home) dh -= ev; else da -= ev;
    LA[lq] = (LA[lq] || 0) + da; LH[lq] = (LH[lq] || 0) + dh; if (home) LH[q] = (LH[q] || 0) + ev; else LA[q] = (LA[q] || 0) + ev; pa = a; ph = h; lq = q; }
  LA[lq] += (result.as || 0) - pa; LH[lq] += (result.hs || 0) - ph;
  const box = fsimBox(H, A, [TH, TA], [LH, LA], dr, st, ot ? 5 : 4); box.live = 1;
  return box;
}
// keep play-by-play only for recent weeks (the box score and the scoring drives stay all season)
function fsimPruneBoxes() {
  if (!L.sched) return; for (let w = 0; w < L.week - 3; w++) for (const g of L.sched[w] || []) if (g.bx && g.bx.dr && !g.bx.pruned && !(g.h === L.user || g.a === L.user)) { g.bx.dr = g.bx.dr.filter(d => /TD|FG|Safety/.test(d[5])); g.bx.pruned = 1; }
}
