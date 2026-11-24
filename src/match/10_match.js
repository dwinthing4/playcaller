// ============================================================
//  MATCH: one game. Rules (downs, clock, scoring, kicks, overtime), play calling (your coordinators talk,
//  the CPU calls from its playbook), the live 22-man physics play drawn in 3D, HUD + touch controls,
//  and the stat result handed back to the league (PLAN.md shape).
// ============================================================
const MATCH = (() => {
const DT = PHYS.DT, FIELD = PHYS.FIELD, YDm = YD;
const KEEP = ['pa', 'pc', 'py', 'ptd', 'pint', 'ra', 'ry', 'rtd', 'rec', 'recy', 'rectd', 'tgt', 'tk', 'sk', 'int', 'pd', 'ff', 'fum', 'fgm', 'fga', 'xpm', 'xpa', 'pnt', 'pnty'];
const INJ = ['ankle', 'knee', 'shoulder', 'hamstring', 'concussion', 'hand', 'ribs', 'groin'];
let G = null, el = {}, inited = false, glOk = false, raf = 0, lastT = 0, acc = 0, actKey = '', bubKey = '';
const keys = new Set(), stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const has = f => typeof LG !== 'undefined' && typeof LG[f] === 'function';
const Lst = () => (has('state') ? LG.state() : null);
const P = pid => (pid != null && has('player') ? LG.player(pid) : null);
const pnm = pid => { const p = P(pid); return p ? `${p.fn ? p.fn[0] + '. ' : ''}${p.ln}` : 'Unknown'; };
const playById = id => { const L0 = Lst(); return (L0 && L0.plays ? L0.plays : DEFBOOK()).find(p => p.id === id) || null; };
let _book = null; const DEFBOOK = () => _book || (_book = buildPlaybook());
const opp = tid => (tid === G.hid ? G.aid : G.hid);
const TM = tid => G.T[tid];
const isU = tid => tid === G.user;
const userCalls = tid => G.mode === 'play' && isU(tid);
const ord = n => ['1st', '2nd', '3rd', '4th'][n - 1] || n + 'th';
const clockTxt = s => { s = Math.max(0, Math.ceil(s - 1e-6)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const qTxt = q => (q <= 4 ? 'Q' + q : q === 5 ? 'OT' : (q - 4) + 'OT');
const togoTxt = () => (G.yl + G.togo >= 99.5 ? 'Goal' : G.togo < 0.6 ? 'inches' : String(Math.max(1, Math.round(G.togo))));
const spotTxt = (yl, off) => { const y = Math.round(yl); return y === 50 ? 'the 50' : y < 50 ? `${TM(off).abbr} ${y}` : `${TM(opp(off)).abbr} ${100 - y}`; };
const ddTxt = () => `${ord(G.down)} & ${togoTxt()} · ${spotTxt(G.yl, G.poss)}`;
const wait = ms => (G && G.sim ? 0 : ms);

// ------------------------------------------------------------ setup
function init() {
  if (inited) return; inited = true;
  el.game = document.getElementById('game'); el.canvas = document.getElementById('gl'); el.hud = document.getElementById('hud'); el.gui = document.getElementById('gui');
  el.hud.innerHTML = `<div class="sb"><div class="sbT a"><canvas width="56" height="56"></canvas><b></b><span class="sc">0</span><i class="pz"></i><span class="tos"></span></div><div class="sbM"><span class="qc"></span><span class="dd"></span></div><div class="sbT h"><span class="sc">0</span><b></b><canvas width="56" height="56"></canvas><i class="pz"></i><span class="tos"></span></div></div>
    <div class="tick"></div><div class="ban"></div><div class="bub"></div><div class="csay"><canvas width="96" height="96"></canvas><p></p></div>
    <button class="mbtn pause on" aria-label="Pause">II</button><button class="mbtn camb on" aria-label="Camera" title="Camera (C)"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M4 7h3l1.6-2h6.8L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm8 2.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg></button><button class="mbtn spd on" hidden>1×</button><div class="pchip"></div>`;
  el.gui.innerHTML = `<div class="touch"></div><div class="stick"><i></i></div><div class="joy"><i></i></div><div class="campnl"></div><div class="kbar"></div><div class="spdbar"><b>SIM SPEED</b><input type="range" min="0" max="4" step="1" value="0"><span class="sv">1×</span><button class="take">Take over</button></div><div class="acts"></div><div class="hint"></div><div class="sheet on"></div><div class="ovl"></div><div class="fade"></div>`;
  el.hud.insertAdjacentHTML('beforeend', '<div class="gday"><div class="crowd" title="Crowd noise: the road offense is more likely to jump early"><b>CROWD</b><i></i><i></i><i></i><i></i><i></i></div><div class="wxc"></div></div><div class="refc"></div>');
  const q = s => el.hud.querySelector(s) || el.gui.querySelector(s);
  Object.assign(el, { sb: q('.sb'), tA: q('.sbT.a'), tH: q('.sbT.h'), qc: q('.qc'), dd: q('.dd'), tick: q('.tick'), ban: q('.ban'), bub: q('.bub'), say: q('.csay'), pause: q('.pause'), spd: q('.spd'), pchip: q('.pchip'), camBtn: q('.camb'), joy: q('.joy'), cam: q('.campnl'), kbar: q('.kbar'), spdBar: q('.spdbar'), spdIn: q('.spdbar input'), spdV: q('.spdbar .sv'),
    wxc: q('.wxc'), crowd: q('.crowd'), ref: q('.refc'), touch: q('.touch'), stick: q('.stick'), acts: q('.acts'), hint: q('.hint'), sheet: q('.sheet'), ovl: q('.ovl'), fade: q('.fade') });
  el.pause.onclick = () => G && pauseMenu();
  el.spd.hidden = true;
  el.spdIn.addEventListener('input', () => { if (G) setSpeed(SPEEDS[+el.spdIn.value] || 1); });
  el.spdBar.querySelector('.take').onclick = () => { if (!G) return; if (G.auto) endAuto('You have the call'); else { G.mode = 'play'; setSpeed(1); speedBar(false); } };
  el.sheet.addEventListener('click', onSheetClick);
  el.kbar.addEventListener('pointerdown', e => { if (e.target.closest('[data-kick]')) { e.preventDefault(); if (G && G.kpow) G.kpow(); else kickAimGo(); } });
  el.touch.addEventListener('pointerdown', () => { if (G && G.kaim) kickAimGo(); });
  el.acts.addEventListener('pointerdown', onAct); el.bub.addEventListener('pointerdown', onBubble);
  el.camBtn.onclick = () => { if (!G) return; if (el.cam.classList.contains('show')) closeCam(); else camPanel(); };
  el.cam.addEventListener('input', onCamInput); el.cam.addEventListener('change', onCamInput); el.cam.addEventListener('click', onCamClick);
  el.game.addEventListener('wheel', onWheel, { passive: false });
  el.touch.addEventListener('pointerdown', fieldDown); el.joy.addEventListener('pointerdown', joyDown); addEventListener('pointermove', fieldMove); addEventListener('pointerup', fieldUp); addEventListener('pointercancel', fieldUp);
  R3D.cam = cam;
  addEventListener('keydown', onKey); addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('resize', () => applyRot()); addEventListener('orientationchange', () => setTimeout(applyRot, 120));
}
function ensureGL() { if (glOk) return true; try { R3D.init(el.canvas); glOk = true; } catch (e) { console.error(e); glOk = false; } return glOk; }

function open(o) {
  init();
  if (G) teardown();
  const L0 = Lst(), qlen = (has('qlen') && LG.qlen()) || 120, H = o.home, A = o.away;
  G = { o, g: o.g, mode: o.mode || 'play', user: o.userTid, H, A, hid: H.id, aid: A.id, T: { [H.id]: H, [A.id]: A },
    kits: { [H.id]: has('kitFor') ? LG.kitFor(H, true) : null, [A.id]: has('kitFor') ? LG.kitFor(A, false) : null },
    score: { [H.id]: 0, [A.id]: 0 }, q: 1, qlen, clock: qlen, to: { [H.id]: 3, [A.id]: 3 }, poss: H.id, yl: 25, down: 1, togo: 10, ballX: 0,
    runoff: 0, RUN: clamp(qlen * 0.035, 3, 22), WARN: Math.min(120, qlen * 0.25), warned: {}, toChecked: false,
    st: {}, snaps: {}, perf: {}, injuries: [], pbp: [], drives: [], drive: null, fat: {}, ts: { [H.id]: { fd: 0, to: 0 }, [A.id]: { fd: 0, to: 0 } },
    stage: 'load', play: null, speed: 1, time: 0, timers: [], pat: null, kickNext: null, freeKick: false, recvFirst: null, over: false, sim: null,
    diff: (L0 && L0.diff) || 'pro', playoffs: !!(L0 && L0.phase === 'playoffs'), seed: (Math.random() * 1e9) >>> 0, playN: 0, userSlot: 'LB1', flip: false,
    userSide: null, sheet: null, ready: false, lastEv: 0, bubT: 0, open: {} };
  G.wx = conditions(H, L0); G.pen = { [H.id]: { n: 0, yds: 0 }, [A.id]: { n: 0, yds: 0 } }; G.fouls = []; G.fev = 0; G.pre = null; G.penK = 1; condKey = crowdKey = '';
  G.phone = phoneMode(); PHYS.setWidth(G.phone ? PHONE_W : 1); if (typeof R3D !== 'undefined') R3D.phone = G.phone; document.body.classList.toggle('phonemode', G.phone);
  document.body.classList.add('ingame'); el.game.hidden = false; setTimeout(applyRot, 0); el.ovl.className = 'ovl'; el.sheet.className = 'sheet on';
  G.auto = null; setSpeed(1); speedBar(G.mode === 'watch');
  paintScorebugStatic();
  if (G.mode === 'instant' || !ensureGL()) { G.sim = 'game'; G.ready = true; G.stage = 'kick'; simCard(); startGame(); loopStart(); return; }
  R3D.resize(); if (R3D.applyWidth) R3D.applyWidth(); R3D.setField(H, A, H, 25 * YDm, 35 * YDm, false);
  const players = []; for (const T of [H, A]) for (const pid of (T.roster || [])) { const p = P(pid); if (p) players.push(p); }
  introCard(0);
  R3D.prepare(players, [G.kits[H.id], G.kits[A.id]].filter(Boolean), H, (f, building) => { if (G) introCard(f, building); }).then(() => { if (!G) return; G.ready = true; introCard(1); if (G.mode === 'watch') after(700, () => { closeOverlay(); G.stage = 'kick'; startGame(); }); })
    .catch(e => { console.error(e); if (G) { G.ready = true; introCard(1); } });
  loopStart();
}
function teardown() { cancelAnimationFrame(raf); raf = 0; sling.id = null; sling.mode = null; closeCam(); speedBar(false); if (glOk) { R3D.overlay(null); R3D.aim(null); aimOn = false; R3D.clearPlayers(); R3D.camOverride = null; R3D.kickAim(null); if (R3D.flag) R3D.flag(null); R3D.windV = null; } if (el.kbar) el.kbar.classList.remove("show", "on"); if (G) { G.kickAnim = null; G.kaim = null; } G = null; }
function close(result) {
  const o = G.o; teardown(); el.game.hidden = true; applyRot(); PHYS.setWidth(1); document.body.classList.remove('phonemode'); document.body.classList.remove('ingame'); el.sheet.classList.remove('show'); el.ovl.className = 'ovl'; el.ovl.innerHTML = ''; el.acts.innerHTML = ''; el.bub.innerHTML = ''; actKey = '';
  try { if (o.onDone) o.onDone(result); } catch (e) { console.error(e); }
}
function quit() { for (const i of G.injuries) { const p = P(i.pid); if (p) p.inj = i.prev; } close({ quit: true }); }

// ------------------------------------------------------------ timers + loop
function after(ms, fn) { G.timers.push({ t: G.time + wait(ms) / 1000, fn }); }
function runTimers() { const due = G.timers.filter(x => x.t <= G.time); if (!due.length) return; G.timers = G.timers.filter(x => x.t > G.time); for (const x of due) { if (!G) return; x.fn(); } }
function loopStart() { lastT = performance.now(); acc = 0; if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = requestAnimationFrame(frame); if (!G) return;
  const dt = Math.min(0.1, Math.max(0.001, (now - lastT) / 1000)); lastT = now;
  if (!G.paused) {
    G.time += dt * (G.mode === 'watch' ? G.speed : 1);
    if (G.sim) { const t0 = performance.now(); do { runTimers(); } while (G && G.sim && performance.now() - t0 < 24 && G.timers.length && G.timers.some(x => x.t <= G.time)); if (!G) return; G.time += 0.0001; }
    else runTimers();
    if (!G) return;
    const pl = G.play;
    if (pl && !G.sim && (G.stage === 'pre' || G.stage === 'live' || G.stage === 'dead' || G.stage === 'call')) {
      applyInput(pl); acc += dt * G.speed; let n = 0;
      while (acc >= DT && n < 60) { pl.step(DT); if (G.rot) LG.rotStep(G.rot, pl, DT); acc -= DT; n++;
        if (G.stage === 'pre' && pl.phase === 'live') { G.stage = 'live'; R3D.overlay(null); el.say.classList.remove('show'); }
        if (G.stage === 'live' && pl.phase === 'dead') { onWhistle(); break; } }
      if (acc > DT * 4) acc = 0;
    }
  }
  if (!G) return;
  if (G.kickAnim && !G.paused) { kickFrame(dt); if (!G) return; }
  if (G.kaim && !G.paused) kickAimFrame();
  if (glOk && !G.sim) { aimFrame(); const pl = G.play; R3D.draw(pl, dt * (G.mode === 'watch' ? Math.min(G.speed || 1, 3) : 1), { ctl: pl && G.userSide && G.stage === 'live' ? pl.controlled() : (pl && G.userSide === 'D' && G.stage === 'pre' ? pl.userD : null), target: pl && pl.ball && pl.ball.state === 'air' && pl.ball.land ? pl.ball.land : null, camMode: G.camMode || 'O', bigBall: !!G.kickAnim, zoom: pl && pl.result && (pl.result.type === 'td' || pl.result.type === 'deftd') ? Math.max(0.72, 1 - pl.deadT * 0.2) : 1, focus: pl && G.userSide === 'D' && G.mode === 'play' ? pl.userD : null }); }
  hudFrame();
}

// ------------------------------------------------------------ game flow
function startGame() {
  G.recvFirst = R() < 0.5 ? G.hid : G.aid;
  banner('KICKOFF', `${TM(G.recvFirst).name} receive`, 'good', 1500);
  after(1300, () => doKickoff(opp(G.recvFirst)));
}
// kickoffs: deep (the usual), squib (a low skipper: no big return, but a shorter field), onside (a live ball at 10 yards: about 1 in 10 when
// they expect it, half the time as a surprise). The kicking unit picks: you on the power bar, the CPU by the score and the clock.
function doKickoff(kicker, free, q) {
  const recv = opp(kicker), KT = TM(kicker), k = P(has('depthPick') ? LG.depthPick(KT, 'K', 0) : null), kp = k ? k.a.kpw : 70;
  G.freeKick = false; G.stage = 'kick';
  const visual = glOk && !G.sim && G.mode !== 'instant', from = free ? 20 : 35, wy = RULES.kickYds(kickWx(kicker)), user = userCalls(kicker) && !G.sim, kind = user ? null : kickKindFor(kicker, free);
  if (visual) {
    const drift = -windFor(kicker).x * 0.35, spec = qq => { const dist = clamp(57 + (kp - 60) * 0.3 + (qq != null ? (qq - 0.6) * 16 : gauss() * 5) - (free ? 8 : 0) + wy, 38, 80);
      return { landYd: Math.max(-9, 100 - from - dist), hang: clamp(3.75 + (kp - 60) / 90 + (qq != null ? (qq - 0.5) * 0.6 : gauss() * 0.25), 3.2, 4.8), x: clamp(gauss() * 6 + drift, -20, 20) }; };
    if (user) { if (retPlay('kickoff', kicker, 0, 0, 4, from, true)) return kickPower('kickoff', k, (qq, kk) => kickoffGo(kicker, free, kk || 'deep', qq, spec), kickKindFor(kicker, free)); }
    else if (kind !== 'deep' || kobRoll(k, null)) { const k2 = kind !== 'deep' ? kind : 'oob'; if (retPlay('kickoff', kicker, 0, 0, 4, from, true)) { const pl = G.play; return after(1100, () => { if (G && G.play === pl) kickoffGo(kicker, free, k2, null, spec); }); } }
    else { const sp = spec(null); if (retPlay('kickoff', kicker, sp.landYd, sp.x, sp.hang, from)) return; }
  }
  const kk = kind || 'deep';
  if (kk === 'deep' && kobRoll(k, null)) return kickOOB(kicker);
  if (kk === 'onside') { const exp = onsideExpected(recv, kicker), got = R() < onsideOdds(exp, k), spot = from + Math.round(10 + R() * 3); noteOnside(kicker);
    G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} ${KT.abbr} onside kick: recovered by ${got ? KT.abbr : TM(recv).abbr}`); G.clock = Math.max(0, G.clock - 3);
    banner(got ? 'ONSIDE KICK!' : 'ONSIDE KICK', `${got ? KT.name : TM(recv).name} recover`, isU(got ? kicker : recv) ? 'good' : 'bad', 1800); return after(1800, () => got ? setPossession(kicker, spot, 'Onside') : setPossession(recv, 100 - spot, 'kick')); }
  if (kk === 'squib') { const ret = clamp(Math.round(30 + gauss() * 5), 15, 48), muff = R() < 0.015; G.clock = Math.max(0, G.clock - 5);
    banner(muff ? 'LOOSE BALL!' : `SQUIB · ${TM(recv).abbr} ${ret}`, muff ? `${KT.name} recover` : 'Fielded on the hop', '', 1500); return after(1500, () => muff ? setPossession(kicker, 100 - ret, 'kick') : setPossession(recv, ret, 'kick')); }
  const tb = !free && R() < clamp(0.38 + (kp - 60) * 0.012 + wy * 0.02, 0.15, 0.88), deep = tb ? 72 : clamp(60 + gauss() * 5 - (free ? 12 : 0) + wy, 45, 70);
  const RT = TM(recv), rid = has('depthPick') ? LG.depthPick(RT, 'WR', 2) : null, ret = clamp(Math.round(23 + gauss() * 7 + (free ? 9 : 0) + (R() < 0.06 ? 18 : 0)), 5, 60), retTD = !tb && R() < 0.01, muff = !tb && !retTD && R() < 0.008;
  kickoffVisual(kicker, deep, () => {
    if (tb) { banner('TOUCHBACK', `${TM(recv).name} start at the 25`, '', 1500); return after(1500, () => setPossession(recv, 25, 'kick')); }
    G.clock = Math.max(0, G.clock - 5);
    if (retTD) { banner('KICK RETURN TD!', `${pnm(rid)} takes it the distance`, isU(recv) ? 'good' : 'bad', 2400); return after(2400, () => score(recv, 6, 'Kick return TD', true)); }
    if (muff) { banner('FUMBLE!', `${KT.name} recover the kickoff`, isU(kicker) ? 'good' : 'bad', 2000); return after(2000, () => setPossession(kicker, 100 - ret, 'kick')); }
    banner(`RETURN TO THE ${ret > 50 ? 100 - ret : ret}`, `${pnm(rid)} brings it back`, '', 1500); after(1500, () => setPossession(recv, simRetFoul(recv, kicker, ret), 'kick'));
  });
}
// the kick is away (a played-out return): deep through kickGo, squib and onside through the engine's own kick types
function kickoffGo(kicker, free, kind, qq, spec) {
  const k = kickerOf(kicker, 'K'), pl = G.play, recv = opp(kicker);
  if (kind === 'oob' || (kind === 'deep' && kobRoll(k, qq))) return kickOOB(kicker);
  if (kind === 'onside' || kind === 'squib') {
    const expect = kind === 'onside' && onsideExpected(recv, kicker), sp = PHYS.KICKS[kind](R() < 0.5 ? -1 : 1, qq != null ? qq : 0.5 + R() * 0.45, 100 - (free ? 20 : 35)); if (kind === 'onside') noteOnside(kicker);
    if (pl && pl.kickSpecial && pl.kickSpecial(kind, sp.x, sp.landYd * YDm, sp.hang, expect)) { if (G.retPlay) Object.assign(G.retPlay, { landYd: sp.landYd, hang: sp.hang, special: kind }); G.stage = 'live'; G.preT = G.time; tick(kind === 'onside' ? (expect ? 'Onside kick! They were ready for it' : 'Surprise onside kick!') : 'A squib kick along the ground'); return; }
  }
  const sp = spec(qq); kickGo(sp.landYd, sp.x, sp.hang);
}
// which kickoff the kicking team wants: onside when it needs the ball back late, a squib to keep it away from a dangerous returner late in a half
function kickKindFor(kicker, free) {
  if (free || G.pat) return 'deep'; const sd = G.score[kicker] - G.score[opp(kicker)], late4 = G.q >= 4 ? G.clock / G.qlen : 9;
  if (sd < 0 && sd >= -16 && late4 < (sd >= -8 ? 0.28 : 0.5)) return 'onside';
  if (sd < 0 && G.q >= 3 && R() < 0.006) return 'onside';                                         // the odd surprise
  const rr = TM(opp(kicker)).roster && retThreat(opp(kicker)), lateH = (G.q === 2 || G.q >= 4) && G.clock < G.qlen * 0.15;
  if ((lateH && sd >= 0 && R() < 0.45) || (rr && R() < 0.15)) return 'squib';
  return 'deep';
}
function retThreat(tid) { const T = TM(tid); return (T.roster || []).map(P).some(p => p && ['WR', 'RB', 'CB'].includes(p.pos) && p.a.spd >= 92 && p.a.elu >= 86); }
// the receiving team is ready (the hands team is on) when the kicking team trails late, or has already tried one today
function onsideExpected(recv, kicker) { const sd = G.score[kicker] - G.score[recv]; return (G.q >= 4 && sd < 0 && G.clock < G.qlen * 0.55) || !!(G.onsides && G.onsides[kicker]); }
function noteOnside(kicker) { (G.onsides = G.onsides || {})[kicker] = ((G.onsides || {})[kicker] || 0) + 1; }
function onsideOdds(expect, k) { return clamp((expect ? 0.11 : 0.52) + (k ? (k.a.kac - 70) / 600 : 0), 0.04, 0.65); }       // measured in the engine (qa/onside_test.cjs)
// a kickoff that sails out of bounds: the receiving team takes it at its 40
function kobRoll(k, qq) { const p = qq != null ? (qq < 0.08 ? 0.5 : qq < 0.16 ? 0.15 : 0.003) : 0.006 * RULES.disc(k ? k.a.kac : 65); return R() < p; }
// a return that is not played out (instant games): now and then a block in the back or a hold on it, 10 yards back from where it ended
function simRetFoul(recv, kicker, yl) {
  if (G.noFlags === true || G.noFlags === 'live' || R() > 0.07 * (G.penK || 1)) return yl; const blk = stUnit(recv, 10, new Set(), false), p = blk.length ? pick(blk) : null, f = { code: R() < 0.65 ? 'IBB' : 'RH', by: recv, pid: p ? p.id : null };
  let yds = 10; if (yds > yl / 2) yds = yl / 2; countFoul(f, yds, 'accepted'); return Math.max(1, yl - yds);
}
function kickOOB(kicker) {
  const recv = opp(kicker), k = kickerOf(kicker, 'K'), f = { code: 'KOB', by: kicker, pid: k ? k.id : null }; G.retPlay = null; G.fouls = [];
  countFoul(f, 5, 'accepted'); G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} ${TM(kicker).abbr} kickoff out of bounds: ${TM(recv).abbr} ball at the 40`);
  const sx = R() < 0.5 ? -1 : 1, fin = () => { if (!G) return; throwFlag(sx * (FIELD.halfW - 0.5), 35 * YDm + 52 * YDm); refCall(f, { yds: 0, text: `${TM(recv).abbr} ball at the 40` }, 'accepted'); after(2800, () => setPossession(recv, 40, 'kick')); };
  kickoffVisual(kicker, 52, fin, sx * (FIELD.halfW + 3));
}
function setPossession(tid, yl, why) {
  if (G.drive) closeDrive(why || 'Turnover');
  G.poss = tid; G.yl = clamp(yl, 1, 99); G.down = 1; G.togo = Math.min(10, 100 - G.yl); G.ballX = 0; G.fat = {};
  G.drive = { tid, startYl: Math.round(G.yl), plays: 0, yds: 0, q: G.q, clock: Math.round(G.clock), result: '' };
  if (G.auto && G.auto.kind === 'drive' && G.poss !== G.auto.tid) endAuto('Drive over: back to you');
  nextSnap();
}
function closeDrive(result) { const d = G.drive; if (!d) return; d.result = result; G.drives.push({ tid: d.tid, start: d.startYl, plays: d.plays, yds: Math.round(d.yds), q: d.q, result, pen: d.pen || 0, penY: d.penY || 0, dpen: d.dpen || 0, dpenY: d.dpenY || 0 }); G.drive = null; }
function score(tid, pts, why, td) {
  G.score[tid] += pts; G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} — ${TM(tid).abbr} ${why} (${TM(G.aid).abbr} ${G.score[G.aid]}, ${TM(G.hid).abbr} ${G.score[G.hid]})`);
  if (isU(tid) && G.mode === 'play') buzz(60);
  if (G.q >= 5) { G.over = true; closeDrive(why); return after(1800, finish); }
  if (td) { closeDrive('TD'); G.pat = { tid }; G.kickNext = tid; after(1500, nextSnap); return; }
  G.kickNext = tid; after(1600, nextSnap);
}
function nextSnap() {
  if (!G || G.over) return;
  G.userSide = null; actsFor('none');
  if (G.pat) return patStage();
  if (G.clock <= 0) return endQuarter();
  if (G.kickNext != null) { const k = G.kickNext, fr = G.freeKick; G.kickNext = null; return doKickoff(k, fr); }
  if ((G.q === 2 || G.q === 4) && !G.warned[G.q] && G.clock > G.WARN && G.clock - G.runoff <= G.WARN) {
    G.clock = G.WARN; G.runoff = 0; G.warned[G.q] = true; banner('TWO-MINUTE WARNING', '', '', 1700); return after(1700, nextSnap); }
  if (!G.toChecked) { G.toChecked = true; if (cpuTimeout()) return after(1300, nextSnap); }
  const off = G.poss;
  if (G.down === 4 && (!userCalls(off) || G.sim)) { const d = has('cpuFourth') ? LG.cpuFourth(off, ctxFor(off, 'O')) : (G.yl > 62 ? 'fg' : 'punt'); if (d === 'punt' && G.yl < 72) return cpuFake(off, 'punt') ? fakePlay('punt', off) : punt(off); if (d === 'fg' && G.yl >= 52) return cpuFake(off, 'fg') ? fakePlay('fg', off) : fieldGoal(off); }
  if (G.sim) return after(0, simPlay);
  if (G.mode === 'play') return showSheet(isU(off) ? 'O' : 'D');
  autoCalls();
}
function endQuarter() {
  const q = G.q; G.runoff = 0; G.toChecked = false; if (G.rot) LG.rotRest(G.rot, q === 2 ? 'half' : 'quarter');
  if (G.auto && G.auto.kind === 'drive' && (q === 2 || q >= 4)) endAuto('End of the half: back to you');
  if (q === 2) { closeDrive('End of half'); G.q = 3; G.clock = G.qlen; G.to[G.hid] = G.to[G.aid] = 3; G.kickNext = G.recvFirst; G.freeKick = false; banner('HALFTIME', `${TM(G.aid).abbr} ${G.score[G.aid]} — ${TM(G.hid).abbr} ${G.score[G.hid]}`, '', 2600); return after(2600, nextSnap); }
  if (q === 1 || q === 3) { G.q++; G.clock = G.qlen; banner(`END OF ${qTxt(q)}`, '', '', 1300); return after(1300, nextSnap); }
  const tie = G.score[G.hid] === G.score[G.aid];
  if (tie && (q === 4 || G.playoffs)) { closeDrive('End of regulation'); G.q++; G.clock = G.qlen; G.to[G.hid] = G.to[G.aid] = 2; G.kickNext = null; G.pat = null;
    const recv = R() < 0.5 ? G.hid : G.aid; banner('OVERTIME', `Next score wins · ${TM(recv).name} receive`, 'good', 2600); return after(2600, () => doKickoff(opp(recv))); }
  closeDrive('End of game'); G.over = true; banner('FINAL', `${TM(G.aid).abbr} ${G.score[G.aid]} — ${TM(G.hid).abbr} ${G.score[G.hid]}`, '', 2200); after(2200, finish);
}
function cpuTimeout() {
  if (G.runoff <= 0) return false;
  for (const tid of [G.poss, opp(G.poss)]) {
    if (userCalls(tid) || G.to[tid] <= 0) continue;
    const sd = G.score[tid] - G.score[opp(tid)], late4 = G.q >= 4 && G.clock < G.qlen * 0.45, late2 = G.q === 2 && G.clock < G.qlen * 0.3;
    if ((late4 && sd < 0) || (late4 && sd === 0 && tid === G.poss && G.yl > 40) || (late2 && tid === G.poss && G.yl > 45)) { callTimeout(tid); return true; }
  }
  return false;
}
function callTimeout(tid) { G.to[tid]--; G.runoff = 0; if (G.rot) LG.rotRest(G.rot, 'timeout'); banner('TIMEOUT', `${TM(tid).name} · ${G.to[tid]} left`, '', 1200); G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} — Timeout ${TM(tid).abbr}`); }

// ------------------------------------------------------------ play calling
function ctxFor(tid, side) {
  const off = G.poss, sdO = G.score[off] - G.score[opp(off)], clock = Math.max(0, G.clock - G.runoff), togo = Math.max(1, Math.round(G.togo)), yl = Math.round(G.yl);
  return { side, tid, oppTid: opp(tid), down: G.down, togo, yl, q: Math.min(G.q, 4), clock, qlen: G.qlen, sd: G.score[tid] - G.score[opp(tid)], scen: scenKeyFor(G.down, togo, yl, Math.min(G.q, 4), clock, G.qlen, sdO), gameT: G.time };
}
function poolFor(tid, side) { const p = has('playsFor') ? LG.playsFor(tid, side) : null; return p && p.length ? p : DEFBOOK().filter(x => x.side === side); }
function callFor(tid, side, offForm) {
  const ctx = Object.assign(ctxFor(tid, side), offForm ? { offForm } : {});
  if (side === 'D' && !isU(tid) && G.film) ctx.film = filmThreats(offForm);
  if (side === 'D' && !isU(tid)) ctx.scout = qbScout();
  if (G.yl >= 98 && side === 'O') ctx.yl = 98;
  let id = null, say = null, who = null;
  // the coordinator mixes his top three calls (a play caller who always runs his favourite gets read)
  // the run/pass decision follows the team's style and the situation (as the CPU caller does); the coordinator's own picks of that type come first
  if (isU(tid) && has('coordCall')) { try { const c = LG.coordCall(ctx), pk = ((c && c.picks) || []).map(playById).filter(Boolean); say = c && c.say; who = c && c.who;
    let want = null; if (side === 'O' && has('cpuCall')) { const cp = playById(LG.cpuCall(tid, 'O', ctx)); want = cp ? cp.type : null; if (cp && !pk.some(p => p.type === want)) id = cp.id; }
    if (!id) { const m = want ? pk.filter(p => p.type === want) : pk, r = R(), pool2 = m.length ? m : pk; const p = pool2[r < 0.6 || pool2.length < 2 ? 0 : r < 0.85 || pool2.length < 3 ? 1 : 2]; id = p && p.id; } } catch (e) { console.error(e); } }
  if (!id && has('cpuCall')) { try { id = LG.cpuCall(tid, side, ctx); } catch (e) { console.error(e); } }
  let play = id ? playById(id) : null; if (!play || play.side !== side) play = pick(poolFor(tid, side));
  return { play, say, who, ctx };
}
function autoCalls() {
  const off = G.poss, def = opp(off), O = callFor(off, 'O'), D = callFor(def, 'D', O.play.form), mine = isU(off) ? O : isU(def) ? D : null;
  if (mine && mine.say && G.speed <= 2) sayBubble(mine.who, mine.say, isU(off) ? 'O' : 'D');
  startPlay(O.play, D.play, R() < 0.5);
}
function startPlay(op, dp, flip, custom) {
  hideSheet(); closeOverlay();
  if (G.runoff > 0 && G.clock - G.runoff <= 0 && !G.pat) { G.clock = 0; G.runoff = 0; banner('CLOCK RUNS OUT', '', '', 1300); return after(1300, nextSnap); }
  G.wasRunning = G.runoff > 0; G.clock = Math.max(0, G.clock - G.runoff); G.runoff = 0; G.toChecked = false;
  const off = G.poss, def = opp(off), opts = custom || buildOpts(op, dp, flip); G.fakeKind = null;
  G.noise = crowdNoise(off); if (G.noise > 0) opts.off.bonus = (opts.off.bonus || 0) - G.noise * 0.9;     // a loud building: the road line works on a silent count
  applyConditions(opts, off); G.fouls = []; G.fev = 0; G.flagUp = false; G.pre = preRoll(opts); if (glOk && R3D.flag) R3D.flag(null);
  const uO = isU(off), uD = isU(def);
  if (has('noteCall')) { try { if (uO) LG.noteCall(G.user, op.id, ctxFor(off, 'O')); if (uD) LG.noteCall(G.user, dp.id, ctxFor(def, 'D')); } catch (e) { } }
  G.cur = { op, dp, off, def, yl0: G.yl, down0: G.down, togo0: G.togo, clock0: G.clock, lists: [opts.off.list, opts.def.list] };
  G.userSide = opts.userSide;
  const pl = new PHYS.Play(opts); G.play = pl; acc = 0;
  if (glOk) {
    R3D.setPlayers(pl, u => TM(u === 'O' ? off : def), u => G.kits[u === 'O' ? off : def] || {});
    G.camMode = G.userSide === 'D' ? 'D' : 'O';      // the camera stays behind the offense unless you turned on 'behind my defense'
    G.fieldArgs = [TM(off), TM(def), G.H, G.yl * YDm, Math.min(100, G.yl + G.togo) * YDm, G.yl + G.togo >= 99.5]; R3D.setField(...G.fieldArgs, camView());
    const ov = G.mode === 'play' ? G.userSide : (uO ? 'O' : uD ? 'D' : null); R3D.overlay(ov ? pl : null, ov);
    R3D.snapCamera(pl, { camMode: G.camMode }); flash();
  }
  G.stage = 'pre'; G.preT = G.time;
  actsFor(G.userSide === 'O' ? 'preO' : G.userSide === 'D' ? 'preD' : 'none');
  if (G.userSide !== 'O') after(G.userSide === 'D' ? 3000 : 1300, () => { if (G && G.play === pl && G.stage === 'pre' && pl.phase === 'pre') snapCall(pl); });
}
function buildOpts(op, dp, flip, noRot) {
  const off = G.poss, def = opp(off), OT = TM(off), DT2 = TM(def);
  // the 11 for this snap: roles, snap shares and breathers (G.rot = this game's stamina + rotation state; noRot = a kick scene, not a snap)
  if (!G.rot && has('rotInit')) G.rot = LG.rotInit(G.H, G.A); const rs = noRot ? null : G.rot;
  const list = (T, form, side) => { const l = rs && has('lineup') ? LG.lineup(T, form, side, Object.assign(ctxFor(T.id, side), { play: side === 'O' ? op : dp }), rs) : has('starters') ? LG.starters(T, form, side) : [];
    if (l.notes && l.notes.length && (G.mode === 'watch' || isU(T.id))) tick(l.notes.slice(0, 2).join(' · '));
    return l.map(s => ({ slot: s.slot, pos: s.pos, rp: P(s.pid != null ? s.pid : s.id), dx: s.dx, dy: s.dy })).filter(e => e.rp); };
  const fat = {}; if (G.rot) for (const pid in G.rot.E) fat[pid] = clamp(G.rot.E[pid], 0.35, 1);
  const bonus = (T, side) => { const c = T.coach, co = side === 'O' ? T.oc : T.dc; return clamp((c ? ((side === 'O' ? c.off : c.def) - 5) * 0.5 : 0) + (co && co.r != null ? (co.r - 5) * 0.35 : 0) + (T.id === G.hid ? 0.6 : 0), -4, 5); };
  const userSide = G.mode === 'play' ? (isU(off) ? 'O' : isU(def) ? 'D' : null) : null;
  const film = isU(off) ? filmFor(op) : null, scout = isU(off) ? qbScout() : null;
  return { losZ: G.yl * YDm, ballX: G.ballX, down: G.down, togo: G.togo, op: Object.assign({}, op, { flip: !!flip }), dp: film || scout ? Object.assign({}, dp, film ? { film } : {}, scout ? { scout } : {}) : dp,
    off: { tid: off, list: list(OT, op.form, 'O'), bonus: bonus(OT, 'O'), style: OT.offStyle }, def: { tid: def, list: list(DT2, dp.form, 'D'), bonus: bonus(DT2, 'D'), style: DT2.defStyle },
    userSide, userSlot: G.userSlot, diff: G.diff, seed: (G.seed + (++G.playN) * 7919) >>> 0, weather: 'clear', fatigue: fat };
}

// ------------------------------------------------------------ the whistle: score the play
function onWhistle() {
  const pl = G.play; if (pl && pl.ret) return retWhistle(pl);
  G.stage = 'dead'; actsFor('none'); R3D.overlay(null);
  const c = pl.carrier, x = c ? c.p.x : (pl.ball && pl.ball.p ? pl.ball.p.x : G.ballX);
  flagWatch(pl); const delay = judge(pl.result, { lists: G.cur.lists, lastX: x, target: pl.ball && pl.ball.target ? pl.ball.target.pid : null });
  if (delay >= 0) after(delay, nextSnap);
}
function simPlay(fake) {
  if (!G || G.over) return;
  const off = G.poss, def = opp(off), O = fake && fake.op ? { play: fake.op } : callFor(off, 'O'), D = fake && fake.dp ? { play: fake.dp } : callFor(def, 'D', O.play.form);
  if (G.runoff > 0 && G.clock - G.runoff <= 0 && !G.pat) { G.clock = 0; G.runoff = 0; return nextSnap(); }
  G.wasRunning = G.runoff > 0; G.clock = Math.max(0, G.clock - G.runoff); G.runoff = 0; G.toChecked = false;
  const opts = fake && fake.opts ? fake.opts : buildOpts(O.play, D.play, R() < 0.5); opts.userSide = null;
  G.noise = crowdNoise(off); if (G.noise > 0) opts.off.bonus = (opts.off.bonus || 0) - G.noise * 0.9; applyConditions(opts, off); G.fouls = []; G.fev = 0;
  G.cur = { op: O.play, dp: D.play, off, def, yl0: G.yl, down0: G.down, togo0: G.togo, clock0: G.clock, lists: [opts.off.list, opts.def.list] };
  { const pre = preRoll(opts); if (pre && pre.dead) { const d = applyFoul(pre, null, null); simProgress(); if (d >= 0) after(0, nextSnap); return; } if (pre) G.fouls.push(pre); }
  const pl = new PHYS.Play(opts); let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 20) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); }
  if (pl.phase === 'pre') pl.goLive();                       // long motion: snap anyway
  let m = 0; while (pl.phase === 'live' && m < 120 * 30) { pl.step(DT); if (G.rot) LG.rotStep(G.rot, pl, DT); m++; if (m % 4 === 0) pl.updatePoses(); }
  if (pl.phase === 'live' || !pl.result) { pl.phase = 'live'; pl.endPlay('tackle', 'Whistle', pl.carrier, pl.carrier ? pl.carrier.p.z : pl.losZ); }
  flagWatch(pl); const c = pl.carrier, d = judge(pl.result, { lists: G.cur.lists, lastX: c ? c.p.x : 0 });
  simProgress(); if (d >= 0) after(0, nextSnap);
}
function processResult(res, info) {
  const off = G.poss, def = opp(off), yl0 = G.yl, togo0 = G.togo, clock0 = G.clock, two = G.pat && G.pat.two, uOff = isU(off);
  const desc = describe(res, info), y = Math.round(res.yards || 0);
  if (uOff && !two && G.cur && G.cur.op) filmNote(G.cur.op, res, info);
  if (uOff && !two && PHYS.qbScout) { const k0 = (qbScout() || { k: 0 }).k; G.qbs = PHYS.qbScout.note(G.qbs, res, G.playN || 0); if (k0 < 0.4 && (qbScout() || { k: 0 }).k >= 0.4) after(1100, () => tick('They have seen your QB run: expect a spy on him and the ends keeping contain')); }
  if (G.cur && G.cur.op && G.cur.op.type === 'run') (G.runLog = G.runLog || []).push({ n: G.cur.op.name, sc: G.cur.op.scheme, f: G.cur.op.form, yl: Math.round(yl0), d: G.cur.down0, t: Math.round(togo0), y: res.yards || 0, ty: res.type, k: res.kind, dp: G.cur.dp.name });   // QA: run breakdown
  if (!two) {
    for (const pid in (res.stats || {})) { const s = res.stats[pid]; for (const k of KEEP) if (s[k]) addSt(pid, k, s[k]); }
    for (const pid in (res.perf || {})) { const f = res.perf[pid], t = G.perf[pid] || (G.perf[pid] = { good: 0, bad: 0, notes: [] }); t.good += f.good; t.bad += f.bad; for (const n of f.notes) if (t.notes.length < 6 && !t.notes.includes(n)) t.notes.push(n); }
  }
  for (const lst of info.lists) for (const e of lst) { const pid = e.rp.id; G.snaps[pid] = (G.snaps[pid] || 0) + 1; }
  if (G.rot) LG.rotSnap(G.rot, info.lists, res, false, G.cur && G.cur.op);      // stamina: effort drained, the sideline recovers; the rotation books the snap
  rollInjury(res);
  if (!two) G.clock = Math.max(0, G.clock - (res.t || 0));
  let stop = !!res.clockStop, warn = false;
  if ((G.q === 2 || G.q === 4) && !G.warned[G.q] && clock0 > G.WARN && G.clock <= G.WARN) { G.warned[G.q] = true; warn = true; stop = true; }
  if (G.drive) { G.drive.plays++; }
  const pbp = t => G.pbp.push(`${qTxt(G.q)} ${clockTxt(clock0)} ${TM(off).abbr} ${ord(G.cur.down0)}&${Math.max(1, Math.round(togo0))} at ${spotTxt(yl0, off)}: ${t}`);
  const good = v => (v ? (uOff ? 'good' : 'bad') : (uOff ? 'bad' : 'good'));
  G.ballX = clamp(info.lastX != null ? info.lastX : G.ballX, -FIELD.hashX, FIELD.hashX);
  G.runoff = 0;
  // ---- two-point try
  if (two) { const ok = res.td && !res.turnover; pbp(`Two-point try: ${desc}`); G.pat = null; if (ok) { G.score[off] += 2; banner('TWO-POINT GOOD', TM(off).name, good(true), 1800); } else banner('NO GOOD', 'Two-point try fails', good(false), 1700); G.ballX = 0; return 1900; }
  pbp(desc);
  const spot = res.spotZ / YDm;
  if (res.turnover === 'int') {
    G.ts[off].to++;
    if (res.defTD) { banner('PICK SIX!', `${pnm(res.carrier)} takes it back`, good(false), 2400); closeDrive('INT'); G.poss = def; after(2300, () => score(def, 6, 'Interception return TD', true)); return -1; }
    let nyl = 100 - spot; if (nyl < 1) nyl = 20;
    banner('INTERCEPTED', `${pnm(res.carrier)} picks it off`, good(false), 2000); closeDrive('INT'); after(2000, () => setPossession(def, nyl, 'INT')); return -1;
  }
  if (res.type === 'fumbleLost') {
    G.ts[off].to++;
    if (spot <= 0) { banner('FUMBLE — TOUCHDOWN', `${pnm(res.recPid)} falls on it in the end zone`, good(false), 2400); closeDrive('Fumble'); G.poss = def; after(2300, () => score(def, 6, 'Fumble recovery TD', true)); return -1; }
    let nyl = 100 - spot; if (nyl <= 0.5) nyl = 20;
    banner('FUMBLE', `Recovered by ${pnm(res.recPid)}`, good(false), 2000); closeDrive('Fumble'); after(2000, () => setPossession(def, nyl, 'Fumble')); return -1;
  }
  if (res.safety) { G.score[def] += 2; banner('SAFETY', `${TM(def).name} +2`, good(false), 2200); closeDrive('Safety'); G.pbp.push(`${TM(def).abbr} safety`); if (G.q >= 5) { G.over = true; after(2000, finish); return -1; } G.kickNext = off; G.freeKick = true; return 2300; }
  if (res.td) { G.yl = 100; if (G.drive) G.drive.yds += 100 - yl0; banner('TOUCHDOWN', `${pnm(res.carrier)} · ${TM(off).name}`, good(true) === 'good' ? 'td' : 'bad', 2600); buzz(uOff ? 120 : 30); after(2400, () => score(off, 6, desc, true)); return -1; }
  if (res.type === 'inc') { G.down++; stop = true; banner('INCOMPLETE', res.text || '', '', 1300); }
  else {
    const ny = clamp(spot, 0.5, 99.5); if (G.drive) G.drive.yds += ny - yl0; G.yl = ny;
    if (G.yl >= yl0 + togo0 - 1e-6) { G.down = 1; G.togo = Math.min(10, 100 - G.yl); G.ts[off].fd++; banner(`${y >= 0 ? '+' : ''}${y} YDS`, 'FIRST DOWN', good(true), 1500); }
    else { G.down++; G.togo = yl0 + togo0 - G.yl; if (res.sack) banner('SACK', `${y} yds · ${pnm((res.tacklers || [])[0])}`, good(false), 1500); else banner(`${y >= 0 ? '+' : ''}${y} YD${Math.abs(y) === 1 ? '' : 'S'}`, G.down <= 4 ? `${ord(G.down)} & ${togoTxt()}` : '', y >= 8 ? good(true) : y <= 0 ? good(false) : '', 1300); }
  }
  if (G.down > 4) { banner('TURNOVER ON DOWNS', `${TM(def).name} take over`, good(false), 2000); const ny = 100 - G.yl; closeDrive('Downs'); after(2000, () => setPossession(def, ny, 'Downs')); return -1; }
  G.runoff = stop ? 0 : G.RUN * (0.85 + R() * 0.3);
  if (res.type === 'oob' && !warn && !((G.q === 2 && G.clock <= G.WARN) || (G.q >= 4 && G.clock <= G.qlen / 3))) G.runoff = G.RUN * 0.5;     // the clock starts again when the ball is spotted
  if (warn) after(1500, () => banner('TWO-MINUTE WARNING', '', '', 1500));
  return warn ? 3000 : 1650;
}
function describe(res, info) {
  const y = Math.round(res.yards || 0), yd = `${y} yd${Math.abs(y) === 1 ? '' : 's'}`;
  if (res.turnover === 'int') return `${pnm(res.passer)} INTERCEPTED by ${pnm(res.carrier)}${res.defTD ? ', returned for a TD' : ''}`;
  if (res.type === 'fumbleLost') return `FUMBLE by ${pnm(res.fumbler != null ? res.fumbler : res.carrier)}, recovered by ${pnm(res.recPid)}`;
  if (res.type === 'inc') return `${pnm(res.passer)} pass incomplete${info && info.target ? ' to ' + pnm(info.target) : ''} (${res.text || 'incomplete'})`;
  if (res.sack) return `${pnm(res.carrier)} sacked for ${y}`;
  if (res.catcher != null && res.carrier === res.catcher) return `${pnm(res.passer)} to ${pnm(res.catcher)} for ${yd}${res.td ? ', TOUCHDOWN' : ''}`;
  return `${pnm(res.carrier)} ${res.kind === 'scramble' ? 'scrambles' : 'runs'} for ${yd}${res.td ? ', TOUCHDOWN' : res.type === 'oob' ? ', out of bounds' : ''}`;
}
function addSt(pid, k, v) { const s = G.st[pid] || (G.st[pid] = {}); s[k] = (s[k] || 0) + v; }
function rollInjury(res) {
  const big = res.bigHit || 0; if (big < 650 || G.injuries.length >= 5 || R() > 0.009 * (big / 650)) return;
  const cand = [res.carrier].concat(res.tacklers || []).filter(pid => pid != null && P(pid) && !G.injuries.some(i => i.pid === pid)); if (!cand.length) return;
  const pid = R() < 0.65 ? cand[0] : pick(cand), p = P(pid), r = R(), weeks = r < 0.5 ? 1 : r < 0.82 ? ri(2, 3) : ri(4, 8), type = pick(INJ);
  G.injuries.push({ pid, weeks, type, prev: p.inj || 0 }); p.inj = Math.max(p.inj || 0, weeks);
  G.pbp.push(`Injury: ${p.pos} ${pnm(pid)} (${type})`); after(1700, () => tick(`Injury: ${p.pos} ${pnm(pid)} is hurt (${type})`));
}

// ------------------------------------------------------------ kicks
// the kicking unit lines up at the spot (players hold their stance) and the ball flies its arc; the camera sits behind the kick
function kickScene(kind, tid) {
  const book = DEFBOOK(), op = kind === 'punt' ? book.find(p => p.side === 'O' && p.form === 'Shotgun' && p.type === 'pass') : book.find(p => p.side === 'O' && p.form === 'Goal Line');
  const dp = book.find(p => p.side === 'D' && p.form === (kind === 'punt' ? '4-3' : 'Goal Line D')) || book.find(p => p.side === 'D');
  if (!op || !dp) return null;
  const sv = [G.poss, G.yl, G.ballX]; G.poss = tid; if (kind === 'xp') { G.yl = 85; G.ballX = 0; }
  const opts = buildOpts(op, dp, false, true); opts.userSide = null; [G.poss, G.yl, G.ballX] = sv;
  let pl; try { pl = new PHYS.Play(opts); } catch (e) { return null; }
  G.play = pl; G.userSide = null; actsFor('none'); R3D.overlay(null); el.say.classList.remove('show');
  R3D.setPlayers(pl, u => TM(u === 'O' ? tid : opp(tid)), u => G.kits[u === 'O' ? tid : opp(tid)] || {}); R3D.setField(TM(tid), TM(opp(tid)), G.H, opts.losZ, opts.losZ, true, 1);
  const los = opts.losZ, x0 = opts.ballX;
  return { kind, tid, pl, los, x0, posts: FIELD.goalZ + 10 * YDm, start: { x: x0, y: 0.35, z: los - (kind === 'punt' ? 13 : 7) * YDm } };
}
function kickVisual(kind, tid, info, done) {
  if (!glOk || G.sim || G.mode === 'instant') return done();
  const S = G.kscene && G.kscene.kind === kind && G.kscene.tid === tid ? G.kscene : kickScene(kind, tid); G.kscene = null; if (!S) return done();
  const pl = S.pl, los = S.los, x0 = S.x0, posts = S.posts, start = S.start; let end, apex, dur;
  if (kind === 'punt') { end = { x: clamp(x0 + gauss() * 4, -FIELD.halfW + 2, FIELD.halfW - 2), y: 0.4, z: Math.min(los + info.dist * YDm, FIELD.goalZ + 8) }; apex = 15 + info.dist * 0.12; dur = 3.0; }
  else if (info.end) { end = info.end; apex = 4 + (info.dist || 30) * 0.08; dur = 0.95 + (info.dist || 30) / 55; }
  else { const short = info.miss === 'short'; end = info.good ? { x: x0 * 0.2 + rnd(-1.6, 1.6), y: 5 + rnd(0, 3), z: posts + 5 } : short ? { x: x0 * 0.3, y: 0.3, z: posts - 2 } : { x: (info.miss === 'wide left' ? 1 : -1) * rnd(3.4, 5.5), y: 4.5, z: posts + 5 };
    apex = 4 + (info.dist || 30) * 0.08; dur = 0.95 + (info.dist || 30) / 55; }
  G.stage = 'kick'; G.kickAnim = { t: 0, dur, start, end, apex, kind, done, pl };
}
// kickoff: the ball flies from the kicking team's 35 deep toward the return man; the stand-in "play" holds no players
function kickoffVisual(kicker, landYds, done, endX) {
  if (!glOk || G.sim || G.mode === 'instant') return done();
  const losZ = 35 * YDm, pl = { players: [], poses: {}, fx: [], O: [], D: [], receivers: [], ball: { state: 'air', p: { x: 0, y: 0.3, z: losZ }, rot: { x: 0, y: 0, z: 0 } }, phase: 'pre', losZ, ballX: 0, pass: false, thrown: false, carrier: null, qb: null, liveT: 0, deadT: 0, events: [], input: { x: 0, z: 0 }, userD: null, result: null, updatePoses() {}, step() {}, controlled() { return null; }, snap() {} };
  G.play = pl; G.userSide = null; actsFor('none'); R3D.overlay(null); el.say.classList.remove('show');
  R3D.setPlayers(pl, () => TM(kicker), () => G.kits[kicker] || {}); R3D.setField(TM(kicker), TM(opp(kicker)), G.H, losZ, losZ, true, 1);
  G.stage = 'kick'; G.kickAnim = { t: 0, dur: 2.6, start: { x: 0, y: 0.3, z: losZ }, end: { x: endX != null ? endX : gauss() * 4, y: 0.4, z: Math.min(FIELD.goalZ + 8, losZ + landYds * YDm) }, apex: 20, kind: 'punt', done, pl };
}
function kickFrame(dt) {
  const K = G.kickAnim, pl = K.pl; K.t += dt * (G.speed || 1); const u = Math.min(1, K.t / K.dur), s = K.start, e = K.end;
  const p = { x: lerp(s.x, e.x, u), y: lerp(s.y, e.y, u) + K.apex * 4 * u * (1 - u), z: lerp(s.z, e.z, u) }, du = 0.01, q = { x: lerp(s.x, e.x, u + du), y: lerp(s.y, e.y, u + du) + K.apex * 4 * (u + du) * (1 - u - du), z: lerp(s.z, e.z, u + du) };
  const vx = q.x - p.x, vy = q.y - p.y, vz = q.z - p.z, vm = Math.hypot(vx, vy, vz) || 1;
  pl.ball = { state: 'air', p, axis: { x: vx / vm, y: vy / vm, z: vz / vm }, rot: { x: 0, y: 0, z: K.t * 22 }, land: null, target: null };
  R3D.camOverride = K.kind === 'punt' ? { pos: [lerp(s.x, p.x, 0.5), 9, Math.min(p.z, e.z) - 14], look: [(p.x + e.x) / 2, Math.min(p.y * 0.62, 12), (p.z + e.z) / 2], fov: 58 } : { pos: [s.x * 0.7, 3.4, s.z - 8], look: [e.x * 0.3, 3.5, FIELD.goalZ + 10 * YDm], fov: 46 };
  if (u >= 1) { G.kickAnim = null; R3D.camOverride = null; flash(); K.done(); }
}
// ---- aiming a kick: a green triangle runs from the ball to the two uprights (long and thin from far out), a needle sweeps across it; stop it inside.
// The needle moves faster for a less accurate kicker and a longer kick; the kicker's leg (KPW) decides whether it gets there at all.
function kickAim(kind, tid, fg, k, done) {
  const S = kickScene(kind, tid); if (!S) return done(null);
  G.kscene = S; G.stage = 'kick'; hideSheet(); closeOverlay();
  const kac = k ? k.a.kac : 70, kpw = k ? k.a.kpw : 70, ax = S.start.x, az = S.start.z, pz = S.posts, PX = 2.82;
  const a1 = Math.atan2(-PX - ax, pz - az), a2 = Math.atan2(PX - ax, pz - az), lo = Math.min(a1, a2), hi = Math.max(a1, a2), mid = (lo + hi) / 2, amp = (hi - lo) / 2 * 2.5 + 0.03;
  const hz = 0.42 * (1 + (90 - kac) / 45) * (1 + (fg.d || 30) / 55), per = 1 / clamp(hz, 0.3, 2.2), kw = kickWx(tid), wsh = clamp(kw.cross * 0.0042 * ((fg.d || 30) / 35), -0.06, 0.06), wyd = RULES.kickYds(kw);
  G.kaim = { t0: performance.now(), mid: mid - wsh, amp, per, lo: lo - wsh, hi: hi - wsh, wsh, wyd, ax, az, pz, kac, kpw, fg, done, kind, tid, theta: mid };
  const rng = Math.round(40 + kpw * 0.2 + wyd), far = (fg.d || 30) > rng;
  el.kbar.innerHTML = `<div class="kt"><b>${kind === 'xp' ? 'Extra point' : (fg.d || 0) + '-yard field goal'}</b><span>${k ? esc(k.fn[0] + '. ' + k.ln) + ' · ' : ''}KPW ${kpw} · KAC ${kac} · range ~${rng} yds${far ? ' · <em>beyond his range</em>' : ''}${wxKickTxt(tid, true)}</span></div><div class="kh">Stop the needle inside the green</div><button class="pri big on" data-kick="1">KICK</button>`;
  el.kbar.classList.add('show', 'on');
  R3D.camOverride = { pos: [ax * 0.7, 7.5, az - 10], look: [ax * 0.2, 0.5, az + (pz - az) * 0.62], fov: 48 };
}
function kickAimFrame() {
  const A = G.kaim; if (!A) return; const ph = (((performance.now() - A.t0) / 1000) / A.per) % 1, tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
  A.theta = A.mid - A.amp + 2 * A.amp * tri; R3D.kickAim({ ax: A.ax, az: A.az, pz: A.pz, px: 2.82, theta: A.theta, inside: A.theta >= A.lo && A.theta <= A.hi });
}
function kickAimGo() {
  const A = G.kaim; if (!A) return; G.kaim = null; R3D.kickAim(null); el.kbar.classList.remove('show', 'on'); R3D.camOverride = null; buzz(20);
  const th = A.theta + (A.wsh || 0) + gauss() * (100 - A.kac) / 2600, rng = 40 + A.kpw * 0.2 + (A.wyd || 0), d = A.fg.d || 30, short = d > rng + 3 || (d > rng && R() < 0.5);
  const lo0 = A.lo + (A.wsh || 0), hi0 = A.hi + (A.wsh || 0), tol = 0.003, inside = th >= lo0 + tol && th <= hi0 - tol, doink = !inside && (Math.abs(th - lo0) < 0.012 || Math.abs(th - hi0) < 0.012);
  const good = !short && (inside || (doink && R() < 0.45)), miss = good ? null : short ? 'short' : th > hi0 ? 'wide left' : 'wide right';
  const ez = A.pz + 6, end = short ? { x: A.ax + Math.tan(th) * (A.pz - 3 - A.az), y: 0.3, z: A.pz - 3 } : { x: A.ax + Math.tan(th) * (ez - A.az), y: 5 + R() * 3, z: ez };
  if (doink) after(700, () => tick(good ? 'Off the upright... and in!' : 'Doink! Off the upright'));
  A.done({ good, miss, end, doink });
}
// ---- kick returns, played out. In the engine the return team is the offense (going +z) and the kicking team the defense.
function stUnit(tid, n, excl, cover) {
  const T = TM(tid), starter = id => Object.values(T.depth || {}).some(a => a && a[0] === id), pref = { LB: 3, S: 3, CB: 2.6, TE: 2.4, FB: 2.8, RB: 2.2, WR: 2.2 };
  const ps = (T.roster || []).filter(id => !excl.has(id)).map(P).filter(p => p && pref[p.pos] && !(p.inj > 0) && !p.holdout && !p.redshirt);
  const v = p => pref[p.pos] - (starter(p.id) ? 1.2 : 0) + ((cover ? p.a.tak + p.a.pur : p.a.rbk + p.a.str) + p.a.spd) / 120;
  return ps.sort((a, b) => v(b) - v(a)).slice(0, n);
}
// your kick is away: the power meter set the distance and the hang time
function kickGo(landYd, landX, hang) { const pl = G.play; if (!pl || !pl.kickNow || !pl.kickNow(landX, landYd * YDm, hang)) return; if (G.retPlay) Object.assign(G.retPlay, { landYd, hang }); G.stage = 'live'; G.preT = G.time; }
function retPlay(kind, kicker, landYd, landX, hang, fromYd, wait) {
  const recv = opp(kicker), RT = TM(recv), used = new Set();
  // the return man: the most dangerous runner with the ball in his hands
  const cands = (RT.roster || []).map(P).filter(p => p && ['WR', 'RB', 'CB', 'S'].includes(p.pos) && !(p.inj > 0) && !p.holdout && !p.redshirt && (RT.depth.QB || [])[0] !== p.id);
  const rr = cands.sort((a, b) => (b.a.spd * 0.45 + b.a.elu * 0.35 + b.a.cth * 0.2) - (a.a.spd * 0.45 + a.a.elu * 0.35 + a.a.cth * 0.2))[0]; if (!rr) return false;
  used.add(rr.id); const blk = stUnit(recv, 10, used, false); blk.forEach(p => used.add(p.id));
  const kk = kickerOf(kicker, kind === 'punt' ? 'P' : 'K') || kickerOf(kicker, 'K'), used2 = new Set(kk ? [kk.id] : []), cov = stUnit(kicker, 10, used2, true);
  if (blk.length < 10 || cov.length < 10 || !kk) return false;
  const off = [{ slot: 'KR', pos: rr.pos, rp: rr, dx: -8, dy: 0 }].concat(blk.map((p, i) => ({ slot: 'B' + (i + 1), pos: p.pos, rp: p, dx: -3, dy: (i - 4.5) * 3 })));
  const def = cov.map((p, i) => ({ slot: 'C' + (i + 1), pos: p.pos, rp: p, dx: 3, dy: (i - 4.5) * 3 })).concat([{ slot: 'K', pos: kk.pos, rp: kk, dx: 8, dy: 0 }]);
  const fat = {}; if (G.rot) for (const pid in G.rot.E) fat[pid] = clamp(G.rot.E[pid], 0.35, 1);
  const userSide = G.mode === 'play' ? (isU(recv) ? 'O' : isU(kicker) ? 'D' : null) : null, losR = kind === 'punt' ? fromYd : null;
  const kickZ = kind === 'punt' ? (fromYd + 14) * YDm : (100 - fromYd) * YDm;
  const opts = { losZ: kind === 'punt' ? losR * YDm : landYd * YDm, ballX: 0, down: 1, togo: 10, op: { id: 'ret', name: kind === 'punt' ? 'Punt return' : 'Kick return', side: 'O', form: 'Kick', type: 'run', carrier: 'KR', scheme: 'zone', gap: 'B', rside: 'R', routes: {} },
    dp: { id: 'cov', name: 'Coverage', side: 'D', form: 'Kick', cov: 'c3', blitz: [] }, off: { tid: recv, list: off, bonus: 0 }, def: { tid: kicker, list: def, bonus: 0 },
    userSide, userSlot: 'C5', diff: G.diff, seed: (G.seed + (++G.playN) * 7919) >>> 0, weather: 'clear', fatigue: fat,
    ret: { kind, kickX: kind === 'punt' ? -G.ballX * 0.5 : 0, kickZ, landX, landZ: landYd * YDm, hang, retSlot: 'KR', losZ: kind === 'punt' ? losR * YDm : null, wait: !!wait } };
  applyConditions(opts, recv); G.fouls = []; G.fev = 0; G.flagUp = false; if (glOk && R3D.flag) R3D.flag(null);
  let pl; try { pl = new PHYS.Play(opts); } catch (e) { console.error(e); return false; }
  G.cur = { op: opts.op, dp: opts.dp, off: recv, def: kicker, yl0: G.yl, down0: 1, togo0: 10, clock0: G.clock, lists: [off, def] };
  G.retPlay = { kind, kicker, recv, landYd, hang }; G.userSide = userSide; G.play = pl; acc = 0; hideSheet(); closeOverlay();
  if (glOk) { R3D.setPlayers(pl, u => TM(u === 'O' ? recv : kicker), u => G.kits[u === 'O' ? recv : kicker] || {}); G.camMode = 'O';
    G.fieldArgs = [TM(recv), TM(kicker), G.H, -60, -60, false]; R3D.setField(...G.fieldArgs, camView()); R3D.overlay(null); R3D.snapCamera(pl, { camMode: 'O' }); flash(); }
  G.stage = wait ? 'kick' : 'live'; G.preT = G.time; el.say.classList.remove('show');
  if (kind === 'kickoff') tick(`${pnm(kk.id)} kicks off · ${pnm(rr.id)} back to receive`); else tick(`${pnm(kk.id)} punts · ${pnm(rr.id)} back to receive`);
  return true;
}
function retWhistle(pl) {
  const R = G.retPlay, res = pl.result; G.retPlay = null; G.stage = 'dead'; actsFor('none'); R3D.overlay(null);
  if (!R || !res) { const r2 = R || {}; return after(800, () => setPossession(r2.recv != null ? r2.recv : opp(G.poss), 25, 'kick')); }
  const { kind, kicker, recv } = R, spot = res.spotZ / YDm, who = pnm(res.carrier);
  flagWatch(pl);
  for (const pid in (res.stats || {})) { const st = res.stats[pid]; for (const k of KEEP) if (st[k]) addSt(pid, k, st[k]); }
  for (const pid in (res.perf || {})) { const fx = res.perf[pid], t = G.perf[pid] || (G.perf[pid] = { good: 0, bad: 0, notes: [] }); t.good += fx.good; t.bad += fx.bad; for (const n of fx.notes) if (t.notes.length < 6 && !t.notes.includes(n)) t.notes.push(n); }
  for (const lst of G.cur.lists) for (const e of lst) { const pid = e.rp.id; G.snaps[pid] = (G.snaps[pid] || 0) + 1; }
  if (G.rot) LG.rotSnap(G.rot, G.cur.lists, res, true);      // special-teams snap: stamina only, no rotation bookkeeping
  G.clock = Math.max(0, G.clock - Math.max(0, (res.t || 0) - R.hang));       // the clock starts when the return man touches it
  const k = kind === 'punt' ? 'PUNT' : 'KICK', u = isU(recv);
  G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} ${TM(kicker).abbr} ${kind === 'punt' ? 'punt' : 'kickoff'}: ${res.text || res.type}`);
  if (G.fouls && G.fouls.length && retFoul(R, res, spot)) return;
  if (R.special === 'onside' && res.type === 'fumbleLost') { banner('ONSIDE KICK!', `${TM(kicker).name} recover`, u ? 'bad' : 'good', 2200); G.pbp.push(`${TM(kicker).abbr} recover the onside kick`); return after(2200, () => setPossession(kicker, clamp(100 - spot, 1, 99), 'Onside')); }
  if (R.special === 'onside' && res.type !== 'td') { const y = clamp(Math.round(spot), 1, 99); banner('ONSIDE KICK', `${TM(recv).name} recover`, u ? 'good' : 'bad', 1800); return after(1800, () => setPossession(recv, y, 'kick')); }
  if (res.type === 'fumbleLost') { G.ts[recv].to++; if (spot <= 0) { banner('FUMBLE — TOUCHDOWN', `${TM(kicker).name} recover in the end zone`, u ? 'bad' : 'good', 2400); G.poss = kicker; return after(2300, () => score(kicker, 6, 'Fumble recovery TD', true)); } banner('MUFFED!', `${TM(kicker).name} recover`, u ? 'bad' : 'good', 2000); return after(2000, () => setPossession(kicker, clamp(100 - spot, 1, 99), 'Fumble')); }
  if (res.type === 'deftd') { banner('TOUCHDOWN', `${TM(kicker).name} take it back`, u ? 'bad' : 'td', 2400); G.poss = kicker; return after(2300, () => score(kicker, 6, 'Fumble return TD', true)); }
  if (res.td) { banner(`${k} RETURN TD!`, `${who} takes it the distance`, u ? 'td' : 'bad', 2600); buzz(u ? 120 : 30); G.poss = recv; return after(2400, () => score(recv, 6, `${kind === 'punt' ? 'Punt' : 'Kick'} return TD`, true)); }
  if (res.type === 'downed') { if (spot <= 0.5) { banner('TOUCHBACK', `${TM(recv).name} start at the 20`, '', 1500); return after(1500, () => setPossession(recv, 20, 'Punt')); } const y = clamp(Math.round(spot), 1, 99); banner(`DOWNED AT THE ${y}`, 'He let it bounce', isU(kicker) ? 'good' : '', 1600); return after(1600, () => setPossession(recv, y, 'Punt')); }
  if (res.type === 'fair') { const y = clamp(Math.round(spot), 1, 99); banner('FAIR CATCH', `${who} at the ${y > 50 ? 100 - y : y}`, '', 1500); return after(1500, () => setPossession(recv, y, 'Punt')); }
  if (spot <= 0.5) { banner('TOUCHBACK', `${TM(recv).name} start at the ${kind === 'punt' ? 20 : 25}`, '', 1500); return after(1500, () => setPossession(recv, kind === 'punt' ? 20 : 25, 'kick')); }
  const y = clamp(Math.round(spot), 1, 99), ry = Math.max(0, Math.round(spot - R.landYd)), big = ry >= 30;
  banner(big ? `${ry}-YARD RETURN` : `RETURN TO THE ${y > 50 ? 100 - y : y}`, `${who}${big ? '' : ' · ' + ry + ' yd return'}`, big ? (u ? 'good' : 'bad') : '', 1500);
  after(1500, () => setPossession(recv, y, kind === 'punt' ? 'Punt' : 'kick'));
}
// your kickoff or punt: stop the power needle in the green for a full-strength kick (accuracy slows the needle)
function kickPower(kind, k, done, pick0) {
  G.stage = 'kick'; hideSheet(); const kac = k ? k.a.kac : 65, kpw = k ? k.a.kpw : 65, t0 = performance.now(); let stopped = false, pos = 0, pick = pick0 || 'deep';
  const spd = clamp(1.25 - kac / 200, 0.7, 1.1) * 1.4;
  el.kbar.innerHTML = `<div class="kt"><b>${kind === 'punt' ? 'Punt' : 'Kickoff'}</b><span>${k ? esc(k.fn[0] + '. ' + k.ln) + ' · ' : ''}KPW ${kpw} · KAC ${kac}${wxKickTxt(kind === 'punt' ? G.poss : opp(G.retPlay ? G.retPlay.recv : opp(G.poss)))}</span></div>${kind === 'kickoff' ? `<div class="kk3">${[['deep', 'Deep'], ['squib', 'Squib'], ['onside', 'Onside']].map(([v, t], i) => `<button class="on${v === pick ? ' sel' : ''}" data-kk="${v}">${t}<small>${i + 1}</small></button>`).join('')}</div>` : ''}<div class="kpow"><i></i></div><button class="pri big on" data-kick="1">KICK</button>`;
  el.kbar.classList.add('show', 'on'); const nd = el.kbar.querySelector('.kpow i');
  G.kpick = v => { pick = v; el.kbar.querySelectorAll('[data-kk]').forEach(b => b.classList.toggle('sel', b.dataset.kk === v)); }; el.kbar.querySelectorAll('[data-kk]').forEach(b => b.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); G.kpick(b.dataset.kk); });
  const anim = () => { if (stopped || !G) return; const ph = ((performance.now() - t0) / 1000 * spd) % 2; pos = ph < 1 ? ph : 2 - ph; nd.style.left = (pos * 100) + '%'; requestAnimationFrame(anim); }; anim();
  G.kpow = () => { if (stopped) return; stopped = true; G.kpow = null; el.kbar.classList.remove('show', 'on'); buzz(20); const q = 1 - Math.abs(pos - 0.82) / 0.82; G.kpick = null; setTimeout(() => done(clamp(q, 0, 1), pick), 150); };
}
function wxKickTxt(tid, aim) { if (!G.wx || G.wx.dome) return ''; const kw = kickWx(tid), m = G.wx.wind ? G.wx.wind.mph : 0; if (m < 4 && G.wx.weather === 'clear' && G.wx.temp >= 40) return ''; const al = kw.along, cr = kw.cross;
  const w = m < 4 ? '' : ` · wind ${m} mph ${Math.abs(al) > Math.abs(cr) * 1.4 ? (al > 0 ? 'at his back' : 'in his face') : `${cr > 0 ? 'right to left' : 'left to right'}${aim ? `: aim ${cr > 0 ? 'right' : 'left'} of the posts` : ''}`}`;
  return w + (G.wx.temp < 40 ? ` · ${G.wx.temp}° cold` : '') + (G.wx.weather !== 'clear' ? ` · ${G.wx.weather}` : ''); }
function kickerOf(tid, pos) { const id = has('depthPick') ? LG.depthPick(TM(tid), pos, 0) : null; return P(id); }
function clockOut() { if (G.runoff > 0 && G.clock - G.runoff <= 0 && !G.pat) { G.clock = 0; G.runoff = 0; hideSheet(); banner('CLOCK RUNS OUT', '', '', 1300); after(1300, nextSnap); return true; } return false; }
function punt(tid, pq) {
  if (pq == null && clockOut()) return;
  G.stage = 'kick'; G.toChecked = false; G.clock = Math.max(0, G.clock - G.runoff); G.runoff = 0; const recv = opp(tid), pp = kickerOf(tid, 'P'), kp = pp ? pp.a.kpw : 65;
  const visual = glOk && !G.sim && G.mode !== 'instant';
  if (visual && pq == null && userCalls(tid)) { if (retPlay('punt', tid, 40, 0, 4.2, 100 - G.yl, true)) return kickPower('punt', pp, qq => punt(tid, qq)); return kickPower('punt', pp, qq => punt(tid, qq)); }
  const dist = Math.round(clamp(41 + (kp - 70) * 0.25 + (pq != null ? (pq - 0.6) * 14 + gauss() * 2 : gauss() * 5.5) + RULES.kickYds(kickWx(tid)), 22, 70)), land = G.yl + dist; G.clock = Math.max(0, G.clock - (visual ? 1 : 6));
  if (pp) { addSt(pp.id, 'pnt', 1); addSt(pp.id, 'pnty', dist); }
  G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} ${TM(tid).abbr} punts ${dist} yds`);
  closeDrive('Punt');
  // played out: the gunners run down, the return man fields it (or fair-catches it, or lets it bounce inside his 10)
  if (visual) { const landR = 100 - land, hang = clamp(4.0 + (kp - 65) / 70 + (pq != null ? (pq - 0.5) * 0.5 : gauss() * 0.3), 3.3, 5.0), lx = clamp(gauss() * 5 - windFor(tid).x * 0.35, -20, 20);
    if (G.play && G.play.ret && G.play.phase === 'pre') { kickGo(landR, lx, hang); return; }
    if (retPlay('punt', tid, landR, lx, hang, 100 - G.yl)) return;
    if (landR < 9 && land < 99) { const roll = Math.max(0, landR - Math.round(rnd(0, 6))); return kickVisual('punt', tid, { dist: Math.min(dist, 100 - G.yl + 5) }, () => { if (roll <= 0) { banner('PUNT · TOUCHBACK', `${dist}-yard punt`, '', 1700); return after(1700, () => setPossession(recv, 20, 'Punt')); } banner(`PUNT · DOWNED AT THE ${roll}`, `${dist}-yard punt`, isU(tid) ? 'good' : '', 1700); after(1700, () => setPossession(recv, roll, 'Punt')); }); } }
  const fair = R() < 0.36, ret = fair ? 0 : Math.max(0, Math.round(7 + gauss() * 5 + (R() < 0.04 ? 25 : 0))), retTD = !fair && R() < 0.006;
  kickVisual('punt', tid, { dist: Math.min(dist, 100 - G.yl + 5) }, () => {
    if (land >= 99) { banner('PUNT · TOUCHBACK', `${dist}-yard punt`, '', 1700); return after(1700, () => setPossession(recv, 20, 'Punt')); }
    if (retTD) { banner('PUNT RETURN TD!', TM(recv).name, isU(recv) ? 'good' : 'bad', 2400); G.poss = recv; return after(2300, () => score(recv, 6, 'Punt return TD', true)); }
    const ryl = clamp(100 - land + ret, 1, 99);
    banner(`PUNT · ${dist} YDS`, fair ? 'Fair catch' : `Returned ${ret} yds`, '', 1700); after(1700, () => setPossession(recv, fair ? ryl : simRetFoul(recv, tid, ryl), 'Punt'));
  });
}
function fieldGoal(tid, quality, aimR) {
  if (quality == null && clockOut()) return;
  G.stage = 'kick'; G.toChecked = false; G.clock = Math.max(0, G.clock - G.runoff); G.runoff = 0;
  const fg = fgOdds(tid, G.yl), k = kickerOf(tid, 'K');
  if (quality == null && userCalls(tid) && !G.sim) { if (glOk && G.mode !== 'instant') return kickAim('fg', tid, fg, k, r => fieldGoal(tid, 1, r)); return kickMeter(fg, q2 => fieldGoal(tid, q2), k); }
  const p = quality == null ? fg.p : clamp(fg.p + (quality - 0.7) * 0.5, 0.02, 0.995), good = aimR ? aimR.good : R() < p, dist = fg.d;
  G.clock = Math.max(0, G.clock - 4); if (k) { addSt(k.id, 'fga', 1); if (good) addSt(k.id, 'fgm', 1); }
  G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} ${TM(tid).abbr} ${dist}-yd field goal ${good ? 'GOOD' : 'no good'}`);
  const miss = good ? null : aimR ? aimR.miss : pick(['wide left', 'wide right', dist > 45 ? 'short' : 'wide right']), ny = Math.max(20, 100 - (G.yl - 7));
  kickVisual('fg', tid, { dist, good, miss, end: aimR && aimR.end }, () => {
    if (good) { closeDrive('FG'); banner("IT'S GOOD!", `${dist}-yard field goal`, isU(tid) ? 'good' : 'bad', 2000); return after(1900, () => score(tid, 3, `${dist}-yd FG`)); }
    closeDrive('Missed FG'); banner('NO GOOD', `${dist}-yarder ${miss}`, isU(tid) ? 'bad' : 'good', 2000);
    after(2000, () => setPossession(opp(tid), ny, 'Missed FG'));
  });
}
function kickXP(tid, aimR) {
  G.stage = 'kick'; const fg = (has('fgProb') && fgOdds(tid, 85)) || { p: 0.94 }, k = kickerOf(tid, 'K');
  if (!aimR && userCalls(tid) && !G.sim && glOk && G.mode !== 'instant') return kickAim('xp', tid, { d: 33, p: fg.p }, k, r => kickXP(tid, r));
  const good = aimR ? aimR.good : R() < fg.p;
  if (k) { addSt(k.id, 'xpa', 1); if (good) addSt(k.id, 'xpm', 1); }
  G.pat = null;
  kickVisual('xp', tid, { dist: 33, good, miss: good ? null : aimR ? aimR.miss : pick(['wide left', 'wide right']), end: aimR && aimR.end }, () => {
    if (good) G.score[tid] += 1;
    banner(good ? 'EXTRA POINT GOOD' : 'EXTRA POINT NO GOOD', `${TM(G.aid).abbr} ${G.score[G.aid]} — ${TM(G.hid).abbr} ${G.score[G.hid]}`, good === isU(tid) ? 'good' : 'bad', 1500);
    after(1500, nextSnap);
  });
}
function cpuGoFor2(tid) { const d = G.score[tid] - G.score[opp(tid)]; return G.q >= 4 && G.clock < G.qlen * 0.6 && [-2, 1, 5, -5, -10, -12].includes(d); }
function patStage() {
  const t = G.pat.tid;
  if (G.pat.two) return; // in progress
  if (G.sim) return kickXP(t);
  if (userCalls(t)) return showSheet('PAT');
  if (!cpuGoFor2(t)) return kickXP(t);
  startTwo(t);
}
function startTwo(t) {
  G.pat.two = true; G.poss = t; G.yl = 98; G.down = 1; G.togo = 2; G.ballX = 0; G.runoff = 0;
  if (G.sim) return after(0, simPlay);
  if (G.mode === 'play') return showSheet(isU(t) ? 'O' : 'D');
  autoCalls();
}
function kneel() { const yl = G.yl; if (clockOut()) return;
  const warn = (G.q === 2 || G.q === 4) && !G.warned[G.q] && G.clock > G.WARN && G.clock - G.runoff - 1.5 <= G.WARN;      // the two-minute warning stops a kneel too
  if (warn) { G.warned[G.q] = true; G.runoff = Math.max(0, G.clock - G.WARN - 1.5); after(1300, () => banner('TWO-MINUTE WARNING', '', '', 1500)); }
  G.clock = Math.max(0, G.clock - G.runoff - 1.5); G.runoff = warn ? 0 : G.RUN * 2.2; G.yl = Math.max(1, G.yl - 1); G.down++; G.togo += yl - G.yl; G.toChecked = false; G.pbp.push(`${TM(G.poss).abbr} QB kneels`); hideSheet(); banner('KNEEL', `${ord(Math.min(4, G.down))} & ${togoTxt()}`, '', 1100); if (G.down > 4) { const ny = 100 - G.yl; closeDrive('Downs'); return after(1200, () => setPossession(opp(G.poss), ny, 'Downs')); } after(1200, nextSnap); }
function spike() { G.clock = Math.max(0, G.clock - Math.min(G.runoff, 2) - 1); G.runoff = 0; G.down++; G.toChecked = false; G.pbp.push(`${TM(G.poss).abbr} spikes the ball`); hideSheet(); banner('SPIKE', 'Clock stopped', '', 1000); after(1100, nextSnap); }

// ------------------------------------------------------------ game day: the weather, the wind, the crowd (src/core/30_venue.js, src/core/40_rules.js)
function conditions(H, L0) { let w = null; try { if (typeof VENUE !== 'undefined') w = VENUE.today(H, L0, typeof R3D !== 'undefined' ? R3D.venueOverride : null); } catch (e) { console.error(e); } return w || { weather: 'clear', wind: { mph: 0, dir: 0 }, temp: 65, dome: false, tod: 'day' }; }
// the home team attacks one end in the 1st and 3rd quarters (and overtime), the other end in the 2nd and 4th
function fieldDir(tid) { return (tid === G.hid ? 1 : -1) * (G.q % 2 === 1 ? 1 : -1); }
// the wind in a play's frame, m/s (the team going +z in the engine is tid)
function windFor(tid) { const w = G.wx && G.wx.wind; if (!w || !w.mph) return { x: 0, z: 0 }; const s = w.mph * 0.447 * fieldDir(tid); return { x: Math.sin(w.dir) * s, z: Math.cos(w.dir) * s }; }
function applyConditions(opts, tid) { if (!G.wx) return opts; opts.weather = G.wx.weather; opts.wx = { weather: G.wx.weather, wind: windFor(tid), temp: G.wx.temp }; if (glOk && !G.sim) R3D.windV = opts.wx.wind; return opts; }
// a kick by tid: the wind along (+ = at his back) and across (+ = toward his left), the cold, the wet
function kickWx(tid) { const w = windFor(tid); return { along: w.z, cross: w.x, temp: G.wx ? G.wx.temp : 60, weather: G.wx ? G.wx.weather : 'clear' }; }
// field-goal odds today: a headwind or the cold makes it play longer, a crosswind or a wet ball costs accuracy
function fgOdds(tid, yl) {
  const base = has('fgProb') ? LG.fgProb(tid, Math.round(yl)) : { p: clamp(1.1 - (117 - yl) / 60, 0.05, 0.95), d: Math.round(117 - yl) };
  if (!G.wx || !base) return base; const k = kickWx(tid), adj = RULES.kickYds(k); let p = base.p;
  if (Math.abs(adj) >= 0.5 && has('fgProb')) { const alt = LG.fgProb(tid, Math.round(clamp(yl + adj, 1, 99))); if (alt && alt.p != null) p = alt.p; }
  p *= 1 - Math.min(0.22, Math.abs(k.cross) * 0.011 * ((base.d || 30) / 40)); if (k.weather !== 'clear') p -= 0.02;
  return Object.assign({}, base, { p: clamp(p, 0.01, 0.995), wxYds: adj });
}
function crowdNoise(off) {
  if (!G.wx || off !== G.aid || G.pat) return 0; const H = TM(G.hid);
  return RULES.noise({ awayBall: true, down: G.down, sd: G.score[G.hid] - G.score[G.aid], q: G.q, clock: G.clock, qlen: G.qlen, yl: G.yl, dome: !!G.wx.dome, playoffs: G.playoffs, fan: H.fanSup });
}
const WXI = { sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" fill="none"/>', moon: '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.5 7 7 0 0 1-5-13.5z"/>',
  cloud: '<path d="M7 18h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 18z"/>', rain: '<path d="M7 14h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="currentColor" stroke-width="2" fill="none"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2" stroke="currentColor" stroke-width="1.6" fill="none"/>', dome: '<path d="M2 18a10 10 0 0 1 20 0z"/><path d="M2 20h20" stroke="currentColor" stroke-width="2"/>' };
function wxIcon(w) { const k = w.dome ? 'dome' : w.weather === 'rain' ? 'rain' : w.weather === 'snow' ? 'snow' : w.tod === 'overcast' ? 'cloud' : w.tod === 'night' ? 'moon' : 'sun'; return `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">${WXI[k]}</svg>`; }
const ARROW = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 .8 10.6 6.6H7.4V11.2H4.6V6.6H1.4Z" fill="currentColor"/></svg>';
let condT = 0, condKey = '', crowdKey = '';
// the weather chip (sky, temperature, a wind arrow turned to the camera) and the crowd meter when the visitors have the ball
function condHud() {
  if (!el.wxc || !G || !G.wx || G.sim) return; const now = performance.now(); if (now - condT < 200) return; condT = now;
  const w = G.wx, pl = G.play, show = G.stage !== 'load' && G.stage !== 'final', tid = G.retPlay ? G.retPlay.recv : G.poss;
  let ang = null; const mph = w.wind ? w.wind.mph : 0;
  if (show && glOk && pl && mph >= 2 && R3D.project) { const wv = windFor(tid), m = Math.hypot(wv.x, wv.z) || 1, bx = pl.ballX || 0, bz = pl.losZ > -30 ? pl.losZ : 0, a = R3D.project(bx, 0, bz), b = R3D.project(bx + wv.x / m * 9, 0, bz + wv.z / m * 9); if (!a.behind && !b.behind && Math.hypot(b.x - a.x, b.y - a.y) > 2) ang = Math.atan2(b.x - a.x, -(b.y - a.y)) * 180 / Math.PI; }
  const key = [show, w.weather, w.tod, w.temp, mph, ang == null ? 'n' : Math.round(ang / 6)].join('|');
  if (key !== condKey) { condKey = key; el.wxc.classList.toggle('show', show);
    el.wxc.title = w.dome ? 'Indoors: no wind or weather' : `${w.weather === 'clear' ? (w.tod === 'overcast' ? 'Overcast' : 'Clear') : w.weather === 'rain' ? 'Rain: slick footing, wet ball' : 'Snow: slick footing, shorter kicks'} · ${w.temp}°F · wind ${mph} mph`;
    el.wxc.innerHTML = `${wxIcon(w)}<b>${w.dome ? 'DOME' : w.temp + '°'}</b>${w.dome ? '' : mph < 2 ? '<span class="wd">CALM</span>' : `<span class="wd">${ang == null ? '' : `<i style="transform:rotate(${Math.round(ang)}deg)">${ARROW}</i>`}${mph}<small>MPH</small></span>`}`; }
  const n = show && G.stage !== 'kick' && !(pl && pl.ret) && !G.kickAnim ? crowdNoise(G.poss) : 0, lvl = n < 0.12 ? 0 : Math.min(5, Math.ceil(n * 5)), ck = lvl + '|' + (n >= 0.7);
  if (ck !== crowdKey) { crowdKey = ck; el.crowd.classList.toggle('show', lvl > 0); el.crowd.classList.toggle('loud', n >= 0.7); el.crowd.querySelectorAll('i').forEach((x, i) => x.classList.toggle('on', i < lvl)); }
}

// ------------------------------------------------------------ penalties: the flag, the call, the enforcement (the rule book is RULES in src/core/40_rules.js)
// The players commit the fouls on the field and you can see each one: before the snap the guilty man moves (a lineman flinches, a
// defender jumps into the neutral zone); live, the engine records what a player actually did (a blocker hanging on to a man who beat
// him, a DB with a fistful of jersey, a shove, a late hit) and how plain it was. Here the officials flag the plain ones, the offended
// team takes the penalty or the play (you choose when it matters, the CPU picks the better), and it goes in the books.
// Every foul in G.fouls: { code, by (team), pid (the offender), t (seconds after the snap; 0 before it), at (engine time), x, z, what }.
const OLSM = { LT: 1, LG: 1, C: 1, RG: 1, RT: 1 };
const EV2PEN = { hold: 'OH', rhold: 'RH', grab: 'DH', ic: 'IC', push: 'OPI', pi: 'DPI', opi: 'OPI', late: 'RTP', rel: 'RTP', helm: 'RTP', fm: 'FM', ur: 'UR', ibb: 'IBB', grd: 'IG' };
const EV_BY_O = { hold: 1, rhold: 1, push: 1, opi: 1, grd: 1, ibb: 1 };
const avgAwr = (list, test) => { const a = list.filter(test).map(e => (e.rp && e.rp.a && e.rp.a.awr) || 60); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 65; };
const isOL = e => OLSM[e.slot] || e.pos === 'TE', isDL = e => /^D[ET]/.test(e.slot) || e.pos === 'DE' || e.pos === 'DT';
// who jumps: the least aware man of the group that can commit it (with some luck in it)
function foulGuy(list, code) {
  const fit = code === 'FS' ? list.filter(e => OLSM[e.slot]) : code === 'DOG' ? list.filter(e => e.slot === 'QB') : code === 'ILF' ? list.filter(e => e.pos === 'WR' || e.pos === 'TE') : list.filter(e => isDL(e));
  const pool = fit.length ? fit : list, who = pool.slice().sort((a, b) => ((a.rp.a.awr || 60) + R() * 30) - ((b.rp.a.awr || 60) + R() * 30))[0];
  return who && who.rp ? who.rp.id : null;
}
// before the snap: does somebody jump? (dead-ball fouls stop it right there; offside and illegal formation are live: a free play)
function preRoll(opts) {
  if (G.pat || G.noFlags === true || G.noFlags === 'pre' || !opts || !opts.off || !opts.def) return null;
  const off = opts.off.tid, def = opts.def.tid, ol = opts.off.list || [], dl = opts.def.list || [], qb = ol.find(e => e.slot === 'QB');
  const code = RULES.preSnap({ k: G.penK, noise: G.noise || 0, oAwr: avgAwr(ol, isOL), dAwr: avgAwr(dl, isDL), qbAwr: qb && qb.rp ? qb.rp.a.awr : 70, cpuO: !userCalls(off) || G.mode !== 'play', late: (G.q === 2 || G.q >= 4) && G.clock < G.WARN * 1.6, audible: !!G.audLoud }, R);
  G.audLoud = false; if (!code) return null;
  const P0 = RULES.PEN[code], byO = P0.side === 'O';
  return { code, by: byO ? off : def, pid: foulGuy(byO ? ol : dl, code), pre: true, dead: !!P0.dead, t: 0, at: 0, x: G.ballX || 0, z: G.yl * YDm };
}
// what he did, in a few words, for the flag card ("#24 Jones grabbed the receiver 9 yards downfield")
function foulWhat(f, ev) {
  const p = P(f.pid), who = p ? `#${p.num} ${p.ln}` : (RULES.PEN[f.code] || {}).side === 'O' ? 'The offense' : 'The defense', yd = v => `${Math.max(5, Math.round(v || 0))} yards downfield`;
  switch (f.code) {
    case 'FS': return `${who} moved before the snap`;
    case 'ENC': return `${who} jumped into the neutral zone and hit a lineman`;
    case 'NZI': return `${who} jumped into the neutral zone and drew a flinch`;
    case 'OFS': return `${who} was across the line at the snap`;
    case 'DOG': return 'The play clock ran out';
    case 'ILF': return 'Not enough men on the line';
    case 'KOB': return 'The kickoff went out of bounds';
  }
  const k = ev && ev.k;
  if (k === 'hold') return ev.down ? `${who} pulled ${ev.pp ? 'the rusher' : 'his man'} down` : `${who} grabbed ${ev.pp ? 'the rusher' : 'his man'} and wouldn't let go`;
  if (k === 'rhold') return `${who} grabbed a cover man on the return`;
  if (k === 'grab') return `${who} grabbed the receiver ${yd(ev.dz)}`;
  if (k === 'ic') return `${who} knocked the receiver off his route ${yd(ev.dz)}`;
  if (k === 'push') return `${who} pushed off at the top of his route`;
  if (k === 'pi') return ev.grab ? `${who} grabbed the receiver's arm before the ball got there` : `${who} ran into the receiver before the ball got there`;
  if (k === 'opi') return ev.shove ? `${who} shoved the defender off the ball` : `${who} ran through the defender to get to the ball`;
  if (k === 'late') return `${who} hit the quarterback well after the throw`;
  if (k === 'rel') return `${who} drove the quarterback into the ground`;
  if (k === 'helm') return `${who} hit the quarterback in the head`;
  if (k === 'fm') return `${who} grabbed the face mask making the tackle`;
  if (k === 'ur') return `${who} drove the runner out with a late shot`;
  if (k === 'ibb') return `${who} blocked a man in the back`;
  if (k === 'grd') return `${who} threw it away with no receiver near`;
  return '';
}
// every snap goes through here: a man who jumps before it is flagged instead
function snapCall(pl) {
  if (!pl) return; const f = G.pre; G.pre = null;
  if (f && f.dead && pl.phase === 'pre' && !pl.ret) return deadBall(pl, f);
  if (G.fakeKind && !G.sim) { banner(G.fakeKind === 'punt' ? 'FAKE PUNT!' : 'FAKE FIELD GOAL!', '', isU(G.poss) ? 'good' : 'bad', 1300); } G.fakeKind = null;
  if (f) {      // a live foul: offside (he jumps a beat early, the ball is snapped with him across) or an illegal formation
    const p = f.code === 'OFS' && !G.sim && pl.preFoul ? pl.preFoul('OFS', f.pid) : pl.players.find(q => q.pid === f.pid);
    Object.assign(f, { at: pl.t, x: p ? p.p.x : pl.ballX, z: p ? p.p.z : pl.losZ }); f.what = foulWhat(f); G.fouls.push(f);
    if (!G.sim && f.code === 'OFS' && p) { after(170, () => { if (!G || G.play !== pl) return; throwFlag(p.p.x, pl.losZ + 0.5); if (pl.phase === 'pre') pl.snap(); }); return; }
    if (!G.sim) throwFlag(p ? p.p.x : pl.ballX, pl.losZ + (f.by === G.poss ? -0.5 : 0.5));
  }
  pl.snap();
}
// a dead-ball foul: you see him go (a lineman flinches up out of his stance, a defender jumps into the neutral zone), then the whistle
function deadBall(pl, f) {
  G.stage = 'dead'; actsFor('none'); if (glOk) R3D.overlay(null); el.say.classList.remove('show'); slingEnd(false);
  const p = f.code !== 'DOG' && pl.preFoul ? pl.preFoul(f.code, f.pid) : pl.players.find(q => q.pid === f.pid);
  Object.assign(f, { t: 0, at: pl.t, x: p ? p.p.x : pl.ballX, z: p ? p.p.z : pl.losZ }); f.what = foulWhat(f);
  after(f.code === 'DOG' ? 0 : 420, () => { if (!G || G.play !== pl) return;
    throwFlag(p ? p.p.x : pl.ballX, pl.losZ + (p && p.unit === 'D' ? 0.7 : -0.7)); tick(f.code === 'DOG' ? 'The play clock hits zero' : f.what); buzz(30);
    after(1000, () => { if (!G) return; const d = applyFoul(f, null, null); if (d >= 0) after(d, nextSnap); }); });
}
function throwFlag(x, z) { G.flagUp = true; if (glOk && !G.sim && R3D.flag) R3D.flag({ x, z }); if (!G.sim) tick('FLAG on the play'); }
// new engine events since the last look: does the flag come out? (RULES.chance: the plain ones)
function flagWatch(pl) {
  if (!pl || !pl.flagEv || (G.pat && G.pat.two) || G.noFlags === true || G.noFlags === 'live') return;
  const evs = pl.flagEv, from = G.fev || 0; G.fev = evs.length;
  for (let i = from; i < evs.length; i++) {
    const ev = evs[i]; let code = EV2PEN[ev.k]; if (!code) continue; if (code === 'OH' && ev.pp && !ev.down && R() < 0.08) code = 'IUH';     // (hands to the face)
    const byO = !!EV_BY_O[ev.k], tid = pl.ret ? (byO ? G.retPlay && G.retPlay.recv : G.retPlay && G.retPlay.kicker) : (byO ? G.cur.off : G.cur.def);
    if (tid == null || G.fouls.length >= 2 || G.fouls.some(f => f.code === code && f.by === tid)) continue;
    if (R() >= RULES.chance(ev, { k: G.penK }) * (G.fouls.some(f => f.by !== tid) ? 0.3 : 1)) continue;     // a flag on both sides (offsetting) is rare
    const pid = byO ? (ev.k === 'push' || ev.k === 'opi' ? ev.r : ev.b != null ? ev.b : ev.q) : ev.d;
    const f = { code, by: tid, pid, x: ev.x, z: ev.z, spotYl: ev.z / YDm, t: ev.t, at: ev.at, ev: ev.k }; f.what = foulWhat(f, ev); G.fouls.push(f);
    if (!G.sim) throwFlag(ev.x, ev.z);
  }
}
const ddAt = (yl, down, togo, tid) => `${ord(down)} & ${yl + togo >= 99.5 ? 'Goal' : togo < 0.6 ? 'inches' : Math.max(1, Math.round(togo))} at ${spotTxt(yl, tid)}`;
// the play as it stands, and its value for the offense (expected points)
function standsOf(res) {
  const yl0 = G.yl, d0 = G.down, t0 = G.togo, off = G.poss, def = opp(off), spot = res.spotZ / YDm, y = Math.round(res.yards || 0), yt = `${y >= 0 ? '+' : ''}${y} yd${Math.abs(y) === 1 ? '' : 's'}`;
  if (res.turnover === 'int') { const nyl = 100 - spot < 1 ? 20 : 100 - spot; return res.defTD ? { kind: 'to', ep: -RULES.EP_TD, txt: 'Pick six', sub: `${TM(def).name} touchdown stands` } : { kind: 'to', ep: -RULES.ep1(nyl), txt: 'Interception', sub: `${TM(def).abbr} ball at ${spotTxt(nyl, def)}` }; }
  if (res.type === 'fumbleLost') { const nyl = 100 - spot <= 0.5 ? 20 : 100 - spot; return spot <= 0 ? { kind: 'to', ep: -RULES.EP_TD, txt: 'Fumble returned', sub: `${TM(def).name} touchdown stands` } : { kind: 'to', ep: -RULES.ep1(nyl), txt: 'Lost fumble', sub: `${TM(def).abbr} ball at ${spotTxt(nyl, def)}` }; }
  if (res.safety) return { kind: 'safety', ep: RULES.EP_SAFETY, txt: 'Safety', sub: `${TM(def).name} +2` };
  if (res.td) return { kind: 'td', ep: RULES.EP_TD, txt: 'Touchdown', sub: 'The score stands' };
  if (res.type === 'inc') { const dn = d0 + 1; return dn > 4 ? { kind: 'to', ep: -RULES.ep1(100 - yl0), txt: 'Turnover on downs', sub: 'Incomplete on 4th down' } : { kind: 'inc', ep: RULES.ep(yl0, dn, t0), txt: ddAt(yl0, dn, t0, off), sub: 'Incomplete pass' }; }
  const ny = clamp(spot, 0.5, 99.5);
  if (ny >= yl0 + t0 - 1e-6) return { kind: 'normal', ep: RULES.ep(ny, 1, Math.min(10, 100 - ny)), txt: ddAt(ny, 1, Math.min(10, 100 - ny), off), sub: `${yt}, first down` };
  const dn = d0 + 1, tg = yl0 + t0 - ny; if (dn > 4) return { kind: 'to', ep: -RULES.ep1(100 - ny), txt: 'Turnover on downs', sub: `${yt}, short of the line` };
  return { kind: 'normal', ep: RULES.ep(ny, dn, tg), txt: ddAt(ny, dn, tg, off), sub: res.sack ? `Sack, ${yt}` : yt };
}
// the penalty taken: where the ball goes, and its value for the offense
function acceptOf(f, res, st) {
  const P0 = RULES.PEN[f.code], off = G.poss; let o, mode = 'nullify';
  if (P0.add && res && st && st.kind === 'td') return { mode: 'stands', ep: st.ep, txt: st.txt, sub: st.sub, o: { yds: 0, text: 'declined (touchdown)' } };
  if (P0.add && res && st && (st.kind === 'normal' || (st.kind === 'inc' && G.down < 4))) { const ny = res.type === 'inc' ? G.yl : clamp(res.spotZ / YDm, 0.5, 99.5); o = RULES.enforce({ yl: ny, down: G.down, togo: G.togo }, { code: f.code, endYl: ny }); mode = 'add'; }
  else o = RULES.enforce({ yl: G.yl, down: G.down, togo: G.togo }, { code: f.code, spotYl: f.spotYl });
  const ep = o.safety ? RULES.EP_SAFETY : o.downs ? -RULES.ep1(100 - o.yl) : RULES.ep(o.yl, o.down, o.togo);
  return { mode, o, ep, txt: o.safety ? 'Safety' : o.downs ? 'Turnover on downs' : ddAt(o.yl, o.down, o.togo, off), sub: `${RULES.yardsTxt(o, P0)}, ${o.text}${mode === 'add' ? ' (added to the play)' : mode === 'nullify' && res ? ' · no play' : ''}` };
}
function foulRank(f) { const P0 = RULES.PEN[f.code]; return (P0.add ? 20 : 0) + (P0.spot ? Math.max(5, (f.spotYl || 0) - G.yl) : P0.yds || 0) + (P0.af ? 4 : 0); }
// at the whistle: no flag, the play stands; a flag, the offended team decides
function judge(res, info) {
  const fouls = G.fouls || []; G.fouls = []; G.flagUp = false;
  if (!fouls.length || !res || (G.pat && G.pat.two)) return processResult(res, info);
  const off = G.poss, def = opp(off), oF = fouls.filter(f => f.by === off), dF = fouls.filter(f => f.by === def);
  if (oF.length && dF.length) { countFoul(oF[0], 0, 'offset'); countFoul(dF[0], 0, 'offset'); G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} Offsetting penalties: replay ${ord(G.down)} down`);
    return noPlay(oF[0], res, info, { yl: G.yl, down: G.down, togo: G.togo, yds: 0, text: `replay ${ord(G.down)} down` }, 'offsetting'); }
  const list = (oF.length ? oF : dF).slice().sort((a, b) => foulRank(b) - foulRank(a)), f = list[0], st = standsOf(res), ac = acceptOf(f, res, st), offended = opp(f.by);
  const gain = (offended === off ? 1 : -1) * (ac.ep - st.ep), rec = ac.mode === 'stands' ? 'dec' : gain >= -0.05 ? 'acc' : 'dec';
  for (const x of list.slice(1)) countFoul(x, 0, 'declined');
  if (ac.mode !== 'stands' && isU(offended) && G.mode === 'play' && !G.sim && !G.auto && (Math.abs(gain) < 1.0 || rec === 'dec' || G.penAsk)) {
    G.stage = 'flag'; penChoice(f, ac, st, rec, ch => { if (!G) return; closeOverlay(); const d = settle(f, res, info, ch === 'acc', ac, st); if (d >= 0) after(d, nextSnap); }); return -1; }
  return settle(f, res, info, rec === 'acc', ac, st);
}
function settle(f, res, info, accept, ac, st) {
  const off = G.poss;
  if (!accept || ac.mode === 'stands') { countFoul(f, 0, 'declined'); const d = processResult(res, info); after(d < 0 ? 300 : 700, () => refCall(f, null, 'declined')); return d < 0 ? d : d + 900; }
  if (ac.mode === 'add') {      // a personal foul on top of the play: the play counts, then 15 more and a first down
    const fd0 = G.ts[off].fd, y0 = G.yl, d = processResult(res, info), o = ac.o; if (d < 0) return d;
    countFoul(f, o.yds, 'accepted'); G.yl = o.yl; G.down = o.down; G.togo = o.togo; if (G.ts[off].fd === fd0) G.ts[off].fd++; if (G.drive) G.drive.yds += o.yl - y0;
    G.runoff = 0; after(650, () => refCall(f, o, 'accepted')); return d + 1500;
  }
  countFoul(f, ac.o.yds, 'accepted');
  return noPlay(f, res, info, ac.o, 'accepted');
}
// the flag wipes out the play (or it never happened): the clock, the snap counts and injuries still do
function noPlay(f, res, info, o, status) {
  const off = G.poss, def = opp(off), yl0 = G.yl, clock0 = G.clock;
  if (res && info) { for (const lst of info.lists) for (const e of lst) { const pid = e.rp.id; G.snaps[pid] = (G.snaps[pid] || 0) + 1; } if (G.rot) LG.rotSnap(G.rot, info.lists, res, false, G.cur && G.cur.op); rollInjury(res); G.clock = Math.max(0, G.clock - (res.t || 0)); }
  if (G.drive && res) G.drive.plays++;
  if ((G.q === 2 || G.q === 4) && !G.warned[G.q] && clock0 > G.WARN && G.clock <= G.WARN) { G.warned[G.q] = true; after(2600, () => banner('TWO-MINUTE WARNING', '', '', 1500)); }
  G.ballX = G.ballX || 0; G.flagUp = false; actsFor('none');
  if (o.safety) { G.score[def] += 2; refCall(f, o, status); after(1800, () => banner('SAFETY', `${TM(def).name} +2`, isU(off) ? 'bad' : 'good', 2000)); closeDrive('Safety'); G.pbp.push(`${TM(def).abbr} safety (penalty in the end zone)`); if (G.q >= 5) { G.over = true; after(3600, finish); return -1; } G.kickNext = off; G.freeKick = true; return 4000; }
  if (o.downs) { refCall(f, o, status); const ny = 100 - o.yl; closeDrive('Downs'); after(2800, () => setPossession(def, ny, 'Downs')); return -1; }
  if (G.drive) G.drive.yds += o.yl - yl0;
  G.yl = o.yl; G.down = o.down; G.togo = o.togo; if (o.first) G.ts[off].fd++;
  // the clock stops for the flag and starts again on the ready signal, except inside the two-minute warning
  const late = (G.q === 2 || G.q >= 4) && G.clock <= G.WARN;
  G.runoff = late || (res && res.clockStop) || !G.wasRunning ? 0 : G.RUN * 0.55;
  // 10-second runoff: a foul by the offense with the clock running in the last minute of a half
  if (status === 'accepted' && f.by === off && (G.q === 2 || G.q === 4) && G.clock <= G.WARN * 0.5 && G.wasRunning && !(res && res.clockStop)) { const r10 = Math.max(1, G.RUN * 0.26); G.clock = Math.max(0, G.clock - r10); G.runoff = 0; G.pbp.push(`${qTxt(G.q)} 10-second runoff`); after(2700, () => tick('10-second runoff')); }
  refCall(f, o, status);
  return 2900;
}
function countFoul(f, yds, how) {
  const P0 = RULES.PEN[f.code], T = TM(f.by), p = P(f.pid), who = p ? ` (#${p.num} ${pnm(f.pid)})` : '', y = Math.round(Math.abs(yds || 0));
  if (how === 'accepted') { const t = G.pen[f.by] || (G.pen[f.by] = { n: 0, yds: 0 }); t.n++; t.yds += y; const d = G.drive; if (d) { if (f.by === d.tid) { d.pen = (d.pen || 0) + 1; d.penY = (d.penY || 0) + y; } else { d.dpen = (d.dpen || 0) + 1; d.dpenY = (d.dpenY || 0) + y; } }
    if (p) { const s = G.perf[p.id] || (G.perf[p.id] = { good: 0, bad: 0, notes: [] }); s.bad++; if (s.notes.length < 6 && !s.notes.includes('Penalty: ' + P0.n)) s.notes.push('Penalty: ' + P0.n); } }
  G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} PENALTY ${T.abbr}: ${P0.n}${who}, ${how === 'accepted' ? `${y} yds, accepted` : how === 'offset' ? 'offsetting' : 'declined'}`);
}
// the referee's call, broadcast style
let refT = 0;
function refCall(f, o, status) {
  if (!G || G.sim || !el.ref) return; const P0 = RULES.PEN[f.code], T = TM(f.by), p = P(f.pid);
  const unit = G.retPlay ? (f.by === G.retPlay.recv ? 'return team' : 'kicking team') : P0.side === 'K' ? 'kicking team' : P0.side === 'R' ? 'return team' : f.by === G.poss ? 'offense' : 'defense';
  const line = status === 'declined' ? 'Declined' : status === 'offsetting' ? 'Offsetting penalties · replay the down' : o ? `${o.yds ? RULES.yardsTxt(o, P0) + ' · ' : ''}${o.text || ''}` : '';
  el.ref.innerHTML = `<div class="rt"><span class="fl">FLAG</span><b>${esc(P0.n)}</b></div><div class="rs">${esc(T.abbr)} ${unit}${p ? ` · #${p.num} ${esc(pnm(f.pid))}` : ''}</div>${f.what ? `<div class="rw">${esc(f.what)}</div>` : ''}${line ? `<div class="rl ${status}">${esc(line)}${status === 'accepted' ? ' · <em>accepted</em>' : ''}</div>` : ''}`;
  el.ref.style.setProperty('--rc', T.c1 || '#333'); el.ref.classList.remove('show'); void el.ref.offsetWidth; el.ref.classList.add('show');
  clearTimeout(refT); refT = setTimeout(() => el.ref && el.ref.classList.remove('show'), 3400); buzz(25);
}
// take the penalty or the play: your call when it matters (the coordinator's pick is starred)
function penChoice(f, ac, st, rec, done) {
  const P0 = RULES.PEN[f.code], T = TM(f.by), p = P(f.pid);
  const btn = (k, lab, x) => `<button class="${rec === k ? 'pri' : ''} on pc2" data-pc="${k}">${rec === k ? '<span class="star">COACH</span>' : ''}<em>${lab}</em><b>${esc(x.txt)}</b><span>${esc(x.sub)}</span></button>`;
  overlay(`<div class="card penc"><div class="ph"><span class="fl">FLAG</span><div><h2>${esc(P0.n)}</h2><div class="small mute">${esc(T.name)}${p ? ` · #${p.num} ${esc(p.fn ? p.fn[0] + '. ' : '')}${esc(p.ln)}` : ''}</div></div></div>
    ${f.what ? `<div class="penw">${esc(f.what)}</div>` : ''}<div class="small" style="margin:8px 0 6px">The referee needs your answer, coach: take the penalty, or keep the play?</div>
    <div class="pcs">${btn('acc', 'ACCEPT', ac)}${btn('dec', 'DECLINE', st)}</div><div class="small mute kk">A accept · D decline · Space takes the coach's pick</div></div>`);
  G.penWait = k => { if (!G.penWait) return; G.penWait = null; buzz(20); done(k); };
  el.ovl.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => G.penWait && G.penWait(b.dataset.pc)); G.penRec = rec;
}
// a foul by the return team on a kick return: 10 yards from the spot of the foul (or from the end of the return, whichever is farther back)
function retFoul(Rp, res, spot) {
  const f = (G.fouls || []).filter(x => x.by === Rp.recv).sort((a, b) => a.spotYl - b.spotYl)[0]; G.fouls = []; G.flagUp = false;
  if (!f || res.type === 'fumbleLost' || res.type === 'deftd') return null;
  const end = res.td ? 100 : res.type === 'downed' || res.type === 'touchback' || spot <= 0.5 ? (Rp.kind === 'punt' ? 20 : 25) : clamp(spot, 1, 99), from = Math.max(1, Math.min(end, f.spotYl > 0 ? f.spotYl : end));
  let yds = 10; if (yds > from / 2) yds = from / 2; const ny = Math.max(1, from - yds), o = { yl: ny, yds, half: yds < 10, text: `${TM(Rp.recv).abbr} ball at ${spotTxt(ny, Rp.recv)}` };
  countFoul(f, yds, 'accepted'); G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} ${TM(Rp.kicker).abbr} ${Rp.kind}: return wiped out by the flag${res.td ? ' (touchdown called back)' : ''}`);
  if (res.td) banner('CALLED BACK', 'Flag on the return', isU(Rp.recv) ? 'bad' : 'good', 1700);
  after(res.td ? 900 : 200, () => refCall(f, o, 'accepted'));
  after(res.td ? 3600 : 3000, () => setPossession(Rp.recv, ny, 'kick')); return true;
}
// a dead-ball foul (or a kickoff out of bounds) outside a play
function applyFoul(f, res, info) {
  if (f.code === 'KOB') return -1;
  const o = RULES.enforce({ yl: G.yl, down: G.down, togo: G.togo }, { code: f.code, spotYl: f.spotYl }); countFoul(f, o.yds, 'accepted');
  return noPlay(f, res, info, o, 'accepted');
}

// ------------------------------------------------------------ fakes: the punt or field-goal unit lines up, then runs it or throws it
// The defense is in its return / block look and reads it late. Run when it is short, throw when it is long.
function fakeOpts(kind, tid) {
  const T = TM(tid), DT0 = TM(opp(tid)), used = new Set(), ok = p => p && !(p.inj > 0) && !p.holdout && !p.redshirt;
  const take = (team, pos, n, by) => (team.roster || []).map(P).filter(p => ok(p) && pos.includes(p.pos) && !used.has(p.id)).sort((a, b) => (by ? by(b) - by(a) : (b.ovr || 0) - (a.ovr || 0))).slice(0, n).map(p => (used.add(p.id), p));
  const st = has('starters') ? LG.starters(T, 'Shotgun', 'O') : [], ol = st.filter(e => OLSM[e.slot]).map(e => ({ slot: e.slot, pos: e.pos, rp: P(e.pid != null ? e.pid : e.id), dx: e.dx, dy: e.dy })).filter(e => e.rp);
  ol.forEach(e => used.add(e.rp.id)); if (ol.length < 5) return null;
  const short = G.togo <= (kind === 'punt' ? 3 : 2), run = short, E = (slot, p, dx, dy) => p ? { slot, pos: p.pos, rp: p, dx, dy } : null;
  const runner = p => p.a.spd + p.a.btk * 0.6 + p.a.car * 0.4, arm = p => p.a.thp + p.a.tha;
  let O = ol.slice(), op;
  if (kind === 'punt') {
    const pp = take(T, ['FB', 'RB'], 1, runner)[0], pk = kickerOf(tid, 'P'); if (pk) used.add(pk.id); const wg = take(T, ['TE', 'FB'], 2), gn = take(T, ['WR'], 2, p => p.a.spd);
    if (!pp || !pk || wg.length < 2 || gn.length < 2) return null;
    if (run) { O.push(E('QB', pp, -5, 0), E('P', pk, -14, 0)); op = { id: 'fakeP', name: 'Fake punt', side: 'O', form: 'Punt', type: 'run', carrier: 'QB', scheme: 'power', gap: 'C', rside: R() < 0.5 ? 'L' : 'R', routes: {} }; }
    else { O.push(E('QB', pk, -14, 0), E('RB', pp, -5, 0)); op = { id: 'fakeP', name: 'Fake punt pass', side: 'O', form: 'Punt', type: 'pass', routes: { X: 'go', Z: 'out', TE: 'flat', TE2: 'seam' } }; }
    O.push(E('TE', wg[0], -1.5, -5.6), E('TE2', wg[1], -1.5, 5.6), E('X', gn[0], -1, -21), E('Z', gn[1], -1, 21));
  } else {
    const hq = (has('depthPick') && P(LG.depthPick(T, 'QB', 1))) || kickerOf(tid, 'P'), kk = kickerOf(tid, 'K'); if (hq) used.add(hq.id); if (kk) used.add(kk.id);
    const wg = take(T, ['TE'], 2), wg2 = take(T, ['FB', 'TE', 'RB'], 2); if (!hq || !kk || wg.length < 2 || wg2.length < 2) return null;
    O.push(E('QB', hq, -7, 0), E('K', kk, -9.5, -1.6), E('TE', wg[0], -1, -5.6), E('TE2', wg[1], -1, 5.6), E('SL', wg2[0], -1.6, -7.4), E('RB', wg2[1], -1.6, 7.4));
    op = run ? { id: 'fakeF', name: 'Fake field goal', side: 'O', form: 'Field goal', type: 'run', carrier: 'QB', scheme: 'outside', gap: 'D', rside: R() < 0.5 ? 'L' : 'R', routes: {} }
      : { id: 'fakeF', name: 'Fake field goal pass', side: 'O', form: 'Field goal', type: 'pass', routes: { TE: 'flat', TE2: 'flat', SL: 'stick' } };      // a quick throw to the flat: the wings leak out, the rest protect the holder
  }
  O = O.filter(Boolean); if (O.length !== 11) return null;
  // the other side: punt return (eight up, two jammers, a deep man) or field-goal block (everyone on the line)
  const dl = take(DT0, ['DE'], 2).concat(take(DT0, ['DT'], kind === 'punt' ? 2 : 3)), lb = take(DT0, ['LB'], 3), cb = take(DT0, ['CB'], kind === 'punt' ? 3 : 2), sf = take(DT0, ['S'], 1);
  if (dl.length < 4 || lb.length < 3 || cb.length < 2 || !sf.length) return null;
  const D = [];
  dl.forEach((p, i) => D.push({ slot: (p.pos === 'DE' ? 'DE' : 'DT') + (i + 1), pos: p.pos, rp: p, dx: 1, dy: [-5.5, 5.5, -1.6, 1.6, 0][i] }));
  lb.forEach((p, i) => D.push({ slot: 'LB' + (i + 1), pos: p.pos, rp: p, dx: kind === 'punt' ? 1.6 : 1.2, dy: [-3.4, 3.4, kind === 'punt' ? -8 : 8][i] }));
  if (kind === 'punt') { D.push({ slot: 'CB1', pos: cb[0].pos, rp: cb[0], dx: 1, dy: -21 }, { slot: 'CB2', pos: cb[1].pos, rp: cb[1], dx: 1, dy: 21 }); if (cb[2]) D.push({ slot: 'CB3', pos: cb[2].pos, rp: cb[2], dx: 36, dy: 0 }); D.push({ slot: 'S1', pos: 'S', rp: sf[0], dx: 13, dy: 0 }); }
  else { D.push({ slot: 'CB1', pos: cb[0].pos, rp: cb[0], dx: 2.5, dy: -10 }, { slot: 'CB2', pos: cb[1].pos, rp: cb[1], dx: 2.5, dy: 10 }, { slot: 'S1', pos: 'S', rp: sf[0], dx: 8, dy: 0 }); }
  if (D.length !== 11) return null;
  const dp = { id: 'fakeD', name: kind === 'punt' ? 'Punt return' : 'Field goal block', side: 'D', form: 'Kick', cov: 'c3', blitz: [], surprise: true };
  const fat = {}; if (G.rot) for (const pid in G.rot.E) fat[pid] = clamp(G.rot.E[pid], 0.35, 1);
  const userSide = G.mode === 'play' ? (isU(tid) ? 'O' : isU(opp(tid)) ? 'D' : null) : null;
  const opts = { losZ: G.yl * YDm, ballX: G.ballX, down: G.down, togo: G.togo, op: Object.assign({ flip: false }, op), dp, off: { tid, list: O, bonus: 0, style: T.offStyle }, def: { tid: opp(tid), list: D, bonus: 0, style: DT0.defStyle },
    userSide, userSlot: 'LB1', diff: G.diff, seed: (G.seed + (++G.playN) * 7919) >>> 0, weather: 'clear', fatigue: fat };
  return { op: opts.op, dp, opts };
}
function fakePlay(kind, tid) {
  tid = tid != null ? tid : G.poss; hideSheet();
  const F = fakeOpts(kind, tid); if (!F) return kind === 'punt' ? punt(tid) : fieldGoal(tid);
  G.pbp.push(`${qTxt(G.q)} ${clockTxt(G.clock)} ${TM(tid).abbr} fake ${kind === 'punt' ? 'punt' : 'field goal'} (${F.op.type})`);
  if (G.sim) return after(0, () => simPlay(F));
  startPlay(F.op, F.dp, false, F.opts); G.fakeKind = kind;
}
// the CPU fakes now and then: mostly on 4th and short around midfield (punt) or 4th and a yard or two (field goal)
function cpuFake(tid, kind) { if (G.pat || G.q >= 5) return false; const sd = G.score[tid] - G.score[opp(tid)], p = kind === 'punt' ? (G.togo <= 3 && G.yl >= 30 && G.yl <= 60 ? 0.04 : 0.004) : (G.togo <= 2 ? 0.03 : 0.003); return R() < (G.fakeP != null ? G.fakeP : p * (sd < 0 ? 1.5 : 1)); }

// ------------------------------------------------------------ the end
function finish() {
  G.over = true; G.stage = 'final'; hideSheet(); actsFor('none'); G.sim = null;
  for (const pid in G.snaps) addSt(pid, 'gp', 1);
  const pog = playerOfGame();
  G.result = { hs: G.score[G.hid], as: G.score[G.aid], st: G.st, snaps: G.snaps, perf: G.perf, injuries: G.injuries.map(i => ({ pid: i.pid, weeks: i.weeks, type: i.type })), pbp: G.pbp, drives: G.drives, pog, quit: false, runLog: G.runLog || [], pen: G.pen, wx: G.wx };
  if (G.rot && has('rotReport')) G.result.rot = LG.rotReport(G.rot);      // scrimmage snaps per player (the depth chart shows last game's share)
  if (G.mode === 'instant') return close(G.result);
  finalCard(pog);
}
function pogScore(s) { return (s.py || 0) / 22 + (s.ptd || 0) * 4 - (s.pint || 0) * 3 + ((s.ry || 0) + (s.recy || 0)) / 9 + ((s.rtd || 0) + (s.rectd || 0)) * 6 + (s.tk || 0) * 1.2 + (s.sk || 0) * 4 + (s.int || 0) * 6 + (s.ff || 0) * 4 + (s.pd || 0) * 1.5 + (s.fgm || 0) * 2.5 - (s.fum || 0) * 3; }
function playerOfGame() { const win = G.score[G.hid] >= G.score[G.aid] ? G.hid : G.aid; let best = null, bv = -1e9; for (const pid in G.st) { const p = P(pid); if (!p) continue; const v = pogScore(G.st[pid]) + (p.tid === win ? 3 : 0); if (v > bv) { bv = v; best = +pid; } } return best; }
function teamTotals(tid) { const T = TM(tid), ids = new Set(T.roster || []); let py = 0, ry = 0, sk = 0, pc = 0, pa = 0; for (const pid in G.st) { if (!ids.has(+pid)) continue; const s = G.st[pid]; py += s.py || 0; ry += s.ry || 0; sk += s.sk || 0; pc += s.pc || 0; pa += s.pa || 0; } const pn = (G.pen && G.pen[tid]) || { n: 0, yds: 0 }; return { py, ry, ty: py + ry, sk, pc, pa, fd: G.ts[tid].fd, to: G.ts[tid].to, pen: `${pn.n}-${pn.yds}` }; }
function leader(tid, key, fmt) { const ids = new Set(TM(tid).roster || []); let best = null, bv = 0; for (const pid in G.st) if (ids.has(+pid) && (G.st[pid][key] || 0) > bv) { bv = G.st[pid][key]; best = pid; } return best ? `${pnm(best)} ${fmt(G.st[best])}` : '—'; }

// ------------------------------------------------------------ HUD
function paintScorebugStatic() {
  for (const [box, T] of [[el.tA, G.A], [el.tH, G.H]]) { box.querySelector('b').textContent = T.abbr; const cv = box.querySelector('canvas'), x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); if (typeof drawLogo === 'function') { try { drawLogo(x, T, cv.width); } catch (e) { } } box.style.setProperty('--sbc', T.c1); box.style.setProperty('--sbc2', T.c2 || T.c1); box.style.setProperty('--sbink', typeof lum === 'function' && lum(T.c1) > 0.6 ? '#10141c' : '#ffffff'); }
}
function shadeHex(h, k) { const n = parseInt(String(h).slice(1), 16), f = c => Math.round(clamp(k < 0 ? c * (1 + k) : c + (255 - c) * k, 0, 255)); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join(''); }
let hudCache = '';
function hudFrame() {
  const pl = G.play, live = G.stage === 'live' && pl ? pl.liveT : 0, clock = Math.max(0, G.clock - (G.stage === 'call' ? G.runoff : 0) - live);
  const running = G.stage === 'live' || (G.stage === 'call' && G.runoff > 0);
  const dd = G.flagUp && G.stage !== 'call' ? 'FLAG' : G.retPlay ? (G.retPlay.kind === 'punt' ? 'PUNT' : 'KICKOFF') : G.pat ? (G.pat.two ? 'Two-point try' : 'Extra point') : G.stage === 'kick' || G.stage === 'load' || G.yl >= 99.9 || G.stage === 'final' ? '' : ddTxt();
  const key = [G.score[G.aid], G.score[G.hid], qTxt(G.q), clockTxt(clock), running, dd, G.poss, G.to[G.aid], G.to[G.hid], G.yl >= 80].join('|');
  if (key !== hudCache) { hudCache = key;
    el.tA.querySelector('.sc').textContent = G.score[G.aid]; el.tH.querySelector('.sc').textContent = G.score[G.hid];
    el.qc.textContent = `${qTxt(G.q)} ${clockTxt(clock)}`; el.qc.classList.toggle('run', running);
    el.dd.textContent = dd; el.dd.classList.toggle('rz', G.yl >= 80 && !G.pat && dd !== 'FLAG'); el.dd.classList.toggle('flag', dd === 'FLAG');
    el.tA.classList.toggle('has', G.poss === G.aid); el.tH.classList.toggle('has', G.poss === G.hid);
    for (const [box, tid] of [[el.tA, G.aid], [el.tH, G.hid]]) box.querySelector('.tos').innerHTML = [0, 1, 2].map(i => `<i class="${i < G.to[tid] ? '' : 'u'}"></i>`).join('');
  }
  // event ticker from the live play
  if (pl && pl.events.length > G.lastEv) { const e = pl.events[pl.events.length - 1]; G.lastEv = pl.events.length; if (G.stage === 'live' && !/throws for|Caught by/.test(e.text)) tick(e.text); }
  if (pl && pl.events.length < G.lastEv) G.lastEv = pl.events.length;
  // context controls + receiver bubbles
  actsFor(ctxKey());
  bubbles(); pchip();
  if (pl && G.stage === 'live' && pl.flagEv && pl.flagEv.length > (G.fev || 0)) flagWatch(pl);
  condHud();
}
// the player you control and the ratings that matter for what he is doing right now
const CHIP_KEYS = { pass: ['thp', 'tha', 'awr'], run: ['spd', 'elu', 'btk'], rec: ['spd', 'cth', 'elu'], def: ['spd', 'tak', 'pur'], cov: ['spd', 'mcv', 'zcv'], rush: ['prs', 'pow', 'spd'] };
const CHIP_LAB = { thp: 'ARM', tha: 'ACC', awr: 'IQ', spd: 'SPD', elu: 'ELU', btk: 'BTK', cth: 'CTH', tak: 'TAK', pur: 'PUR', mcv: 'MAN', zcv: 'ZONE', prs: 'RUSH', pow: 'PWR' };
let chipKey = '';
function pchip() {
  const pl = G && G.play, live = pl && (G.stage === 'live' || G.stage === 'call') && G.mode === 'play' && G.userSide;
  let c = live ? (pl.controlled() || (G.userSide === 'O' ? pl.qb : pl.userD)) : null; const rp = c && c.rp;
  if (!rp) { if (chipKey) { el.pchip.classList.remove('show'); chipKey = ''; } return; }
  const pos = rp.pos, kind = c.unit === 'D' ? (['CB', 'S'].includes(pos) ? 'cov' : ['DE', 'DT'].includes(pos) ? 'rush' : 'def') : c === pl.qb && pl.ball.state === 'held' && !pl.scramble && !pl.qbRun ? 'pass' : ['WR', 'TE'].includes(pos) ? 'rec' : 'run';
  const en = G.rot && has('rotEnergy') ? LG.rotEnergy(G.rot, rp.id, pl) : null;      // stamina, drops as he runs
  const k = rp.id + kind + '|' + (en == null ? '' : Math.round(en * 20)); if (k === chipKey) return; chipKey = k;
  const ks = CHIP_KEYS[kind], col = v => 'var(--rt' + (v >= 88 ? 5 : v >= 78 ? 4 : v >= 68 ? 3 : v >= 58 ? 2 : 1) + ')', ec = en >= 0.86 ? 'var(--rt5)' : en >= 0.72 ? 'var(--rt3)' : 'var(--rt1)';      // green fresh, amber tiring, red: he sits next snap
  el.pchip.innerHTML = `<div class="pcn"><b>#${rp.num || ''}</b> ${esc(pos)} ${esc((rp.fn || '')[0] || '')}. ${esc(rp.ln || '')}<i style="background:${col(rp.ovr || 60)}">${rp.ovr || ''}</i></div><div class="pcr">${ks.map(x => `<span><em>${CHIP_LAB[x]}</em><b style="color:${col(rp.a[x] || 0)}">${rp.a[x] || 0}</b><u style="width:${clamp(rp.a[x] || 0, 0, 99)}%;background:${col(rp.a[x] || 0)}"></u></span>`).join('')}${en == null ? '' : `<span class="sta" title="Stamina"><em>STA</em><b>${Math.round(en * 100)}</b><u style="width:${Math.round(en * 100)}%;background:${ec}"></u></span>`}</div>`;
  el.pchip.classList.add('show');
}
let tickT = 0;
function tick(text) { if (!G || G.sim) return; el.tick.textContent = text; el.tick.classList.add('show'); clearTimeout(tickT); tickT = setTimeout(() => el.tick.classList.remove('show'), 1800); }
let banT = 0;
function banner(text, sub, cls, ms = 1500) { if (!G || G.sim) return; el.ban.innerHTML = `<b class="${cls || ''}">${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; el.ban.classList.remove('show'); void el.ban.offsetWidth; el.ban.classList.add('show'); clearTimeout(banT); banT = setTimeout(() => el.ban.classList.remove('show'), ms); }
let sayT = 0;
function sayBubble(who, text, side) {
  if (!who || !text || G.sim) return; const p = el.say.querySelector('p'), cv = el.say.querySelector('canvas');
  p.innerHTML = `<b>${side === 'O' ? 'OC' : 'DC'} ${esc(who.fn)} ${esc(who.ln)}</b>${esc(text)}`;
  const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 96, 96); if (typeof drawBust === 'function' && who.lk) { try { drawBust(x, { coach: true, lk: who.lk }, TM(G.user)); } catch (e) { } }
  el.say.classList.add('show'); clearTimeout(sayT); sayT = setTimeout(() => el.say.classList.remove('show'), 2600);
}
function flash() { el.fade.classList.add('show'); setTimeout(() => el.fade.classList.remove('show'), 60); }
function buzz(ms) { try { const L0 = Lst(); if ((!L0 || !L0.settings || L0.settings.haptics !== false) && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

// ------------------------------------------------------------ camera (your settings, saved on this device)
const CAMP = { behind: { view: 'behind', height: 0.32, zoom: 0.6 }, side: { view: 'side', height: 0.3, zoom: 0.5 }, sky: { view: 'behind', height: 0.84, zoom: 0.4 } }, CAMORD = ['behind', 'side', 'sky'];
let cam = loadCam();
function loadCam() { let c = null; try { c = JSON.parse(localStorage.getItem('pc_cam_v1') || 'null'); } catch (e) { } return Object.assign({ preset: 'behind', view: 'behind', height: 0.32, zoom: 0.6, flipD: false, fit: true, pan: true }, c && typeof c === 'object' ? c : {}); }
function saveCam() { try { localStorage.setItem('pc_cam_v1', JSON.stringify(cam)); } catch (e) { } if (typeof R3D !== 'undefined') R3D.cam = cam; }
function camView() { return G && G.userSide === 'D' && cam.flipD && cam.view !== 'side' ? -1 : 1; }      // field art faces the camera
// phone mode: on a phone-sized touch screen (or when turned on in Settings). PC, laptop and tablet keep the full field.
const PHONE_W = 0.62;
function phoneMode() { let pref = 'auto'; try { pref = localStorage.getItem('pc_phone') || 'auto'; } catch (e) { } if (pref === 'on') return true; if (pref === 'off') return false;
  return matchMedia('(pointer: coarse)').matches && Math.min(screen.width || innerWidth, screen.height || innerHeight) < 600; }
function camRefresh() { if (G && G.fieldArgs && glOk) R3D.setField(...G.fieldArgs, camView()); applyRot(); }
// sideline view on a phone held upright: turn the whole game sideways so the field runs across the long side of the screen (turn the phone to play)
let rotOn = false;
const PX = e => rotOn ? e.clientY : e.clientX, PY = e => rotOn ? innerWidth - e.clientX : e.clientY;
function applyRot() {
  if (!el.game) return; const want = !!(G && !el.game.hidden && cam.view === 'side' && innerHeight > innerWidth && matchMedia('(pointer: coarse)').matches), key = innerWidth + 'x' + innerHeight;
  if (want === rotOn && (!want || el.game._rw === key)) return;
  rotOn = want; const g = el.game;
  if (want) { g.classList.add('rot'); g.style.width = innerHeight + 'px'; g.style.height = innerWidth + 'px'; g.style.transform = `translateX(${innerWidth}px) rotate(90deg)`; g._rw = key; }
  else { g.classList.remove('rot'); g.style.width = g.style.height = g.style.transform = ''; g._rw = ''; }
  bubKey = ''; if (glOk && R3D.resize) { R3D.resize(); R3D.snapNext = true; }
  if (want && !G.rotTold) { G.rotTold = true; tick('Sideline view: turn your phone sideways'); }
}
function setPreset(k) { const p = CAMP[k]; if (!p) return; const sw = cam.view !== p.view; Object.assign(cam, p, { preset: k }); saveCam(); camRefresh(); camSync(); if (sw && glOk) R3D.snapNext = true; }      // switching sides of the field: cut, don't swing
function nudgeCam(key, d) { cam[key] = clamp(cam[key] + d, 0, 1); cam.preset = 'custom'; saveCam(); camSync(); }
function camSync() { if (!el.cam || !el.cam.classList.contains('show')) return; el.cam.querySelectorAll('[data-cv]').forEach(b => b.classList.toggle('sel', b.dataset.cv === cam.preset)); for (const k of ['height', 'zoom']) { const i = el.cam.querySelector(`[data-cs=${k}]`); if (i) i.value = Math.round(cam[k] * 100); } }
function camPanel() {
  if (!G || el.cam.classList.contains('show')) return; G.camWasPaused = !!G.paused; G.paused = true;
  const chip = (k, t) => `<button class="on" data-cv="${k}">${t}</button>`;
  el.cam.innerHTML = `<div class="ch"><b>Camera</b><button class="on x" data-cx="1" aria-label="Close">✕</button></div>
    <div class="cv">${chip('behind', 'Behind QB')}${chip('side', 'Sideline')}${chip('sky', 'All-22')}</div>
    <label>Height<input class="on" type="range" min="0" max="100" data-cs="height"></label>
    <label>Zoom<input class="on" type="range" min="0" max="100" data-cs="zoom"></label>
    <label class="tg on"><input class="on" type="checkbox" data-cs="flipD"${cam.flipD ? ' checked' : ''}><span>On defense, turn the camera around to sit behind my defense</span></label>
    <label class="tg on"><input class="on" type="checkbox" data-cs="fit"${cam.fit !== false ? " checked" : ""}><span>Zoom out by itself to keep every receiver on screen</span></label>
    <label class="tg on"><input class="on" type="checkbox" data-cs="pan"${cam.pan !== false ? " checked" : ""}><span>Pan toward where I'm aiming a pass (see more of that side)</span></label>
    <div class="kk">Mouse wheel or − / = zoom · PgUp / PgDn height · C changes the view</div>
    <button class="pri on" data-cx="1">Done</button>`;
  el.cam.classList.add('show', 'on'); camSync();
}
function closeCam() { if (!el.cam.classList.contains('show')) return; el.cam.classList.remove('show', 'on'); el.cam.innerHTML = ''; if (G && !G.camWasPaused) { G.paused = false; lastT = performance.now(); } }
function onCamInput(e) { const t = e.target, k = t && t.dataset && t.dataset.cs; if (!k) return; if (k === 'flipD' || k === 'fit' || k === 'pan') { cam[k] = !!t.checked; saveCam(); camRefresh(); return; } cam[k] = clamp(+t.value / 100, 0, 1); cam.preset = 'custom'; saveCam(); camSync(); }
function onCamClick(e) { const b = e.target.closest('[data-cv],[data-cx]'); if (!b) return; if (b.dataset.cx) return closeCam(); setPreset(b.dataset.cv); }
function onWheel(e) { if (!G || el.game.hidden || e.target.closest('.sheet,.ovl,.campnl')) return; e.preventDefault(); nudgeCam('zoom', -Math.sign(e.deltaY) * Math.min(0.08, Math.abs(e.deltaY) * 0.0007)); }

// ------------------------------------------------------------ controls
// Offense: tap / click the field to snap. In the pocket, drag back to aim (the dotted arc is the ball's real flight) and let go
// to throw; drag toward the defense instead and the QB tucks it and runs. The stick bottom-left (or WASD) moves him in the pocket.
// Ball carriers and defenders: drag anywhere, the stick, or WASD to move.
function ctxKey() {
  const pl = G.play; if (!pl || G.mode !== 'play' || !G.userSide || G.paused) return 'none';
  if (G.stage === 'pre') return pl.motion && pl.motion.go && !pl.motion.done ? 'motion' : G.userSide === 'O' ? 'preO' : 'preD';
  if (G.stage !== 'live') return 'none';
  if (pl.ret) return G.userSide === 'O' ? (pl.air ? (pl.ret.kind === 'punt' && !pl.fairCatch ? 'retAir' : 'none') : pl.controlled() ? 'run' : 'none') : 'd';
  if (G.userSide === 'O' && pl.chaseOn && pl.chaseOn()) return pl.ball.state === 'air' ? 'dAir' : 'd';      // picked off / fumbled: you are the defense now
  if (G.userSide === 'O') { if (pl.pass && !pl.thrown && pl.carrier === pl.qb && pl.ball.state === 'held' && !pl.scramble) return 'qb';
    if (!pl.pass && !pl.handed && !pl.qbRun && pl.ball.state !== 'loose') return 'run';      // run play: the stick is live from the snap, so you have the back the instant he has the ball
    return pl.controlled() ? 'run' : 'none'; }
  if (pl.carrier && pl.carrier === pl.userD && pl.ball.state === 'held') return 'run';      // your man picked it off: run with it
  return pl.ball.state === 'air' ? 'dAir' : 'd';
}
const ACTS = {     // [buttons, hint with a mouse + keyboard, hint on a touch screen]
  none: ['', '', ''],
  motion: [`<button class="a wide" style="opacity:.7">Motion…</button>`, 'Man in motion: the ball is snapped when he gets set', 'Man in motion…'],
  preO: [`<button class="a big on" data-a="snap">SNAP</button><button class="a wide on" data-a="audible">Audible</button>`, 'Click the field (or Space) to snap · pass plays: click a tag for a hot route', 'Tap to snap · tap a tag: hot route'],
  preD: [`<button class="a on" data-a="switch">Switch</button><button class="a on" data-a="audible">Audible</button>`, 'E switch player · WASD move after the snap', 'Switch picks your defender'],
  qb: [`<button class="a wide on" data-a="away">Throw away</button>`, 'Drag back to aim, let go to throw · drag forward to run · WASD moves in the pocket', 'Drag back to throw · drag forward to run · stick moves the QB'],
  run: [`<button class="a on" data-a="juke">Juke<span class="key">J</span></button><button class="a on" data-a="spin">Spin<span class="key">K</span></button><button class="a on" data-a="stiff">Stiff arm<span class="key">L</span></button><button class="a hot on" data-a="truck">Truck<span class="key">I</span></button>`, 'WASD or drag to run · let go and he keeps running', ''],
  d: [`<button class="a on" data-a="switch">Switch<span class="key">E</span></button><button class="a big on" data-a="tackle">TACKLE<span class="key">Space</span></button>`, 'WASD or drag to take over · let go and he plays on his own', ''],
  retAir: [`<button class="a big on" data-a="fair">FAIR CATCH<span class="key">F</span></button>`, 'F (or the button) for a fair catch · or field it and run', 'Fair catch, or field it and run'],
  dAir: [`<button class="a on" data-a="switch">Switch<span class="key">E</span></button><button class="a big on" data-a="swat">SWAT<span class="key">F</span></button>`, 'Swat or jump the route', ''],
};
const MOVE_CTX = { qb: 1, run: 1, d: 1, dAir: 1 };
function actsFor(k) { if (k === actKey) return; actKey = k; const a = ACTS[k] || ACTS.none; el.acts.innerHTML = a[0]; el.hint.textContent = matchMedia('(pointer: fine)').matches ? a[1] : G && G.phone ? a[2].replace(/ · (the )?stick [^·]*/g, '') : a[2];
  el.touch.classList.toggle('on', k !== 'none' && k !== 'motion'); const js = !!MOVE_CTX[k] && !(G && G.phone); el.joy.classList.toggle('show', js); el.joy.classList.toggle('on', js);
  if (k === 'none') { stickUp({ pointerId: stick.id }); joyUp({ pointerId: joy.id }); slingEnd(false); }
  if (k !== 'qb' && sling.mode === 'aim') slingEnd(false); }
function doAct(a) {
  const pl = G.play; if (!pl) return; const inp = pl.input;
  if (a === 'snap' && G.stage === 'pre') snapCall(pl);
  else if (a === 'audible' && G.stage === 'pre') { if (G.userSide === 'O' && G.noise > 0.5) { G.audLoud = true; tick('Loud in here: the line strains to hear the audible'); } G.stage = 'call'; R3D.overlay(null); G.keepO = G.userSide === 'D' && G.cur ? G.cur.op : null; G.keepFlip = G.keepO && pl.op ? !!pl.op.flip : null; showSheet(G.userSide); }
  else if (a === 'switch') { if (G.stage === 'pre') { const ds = pl.D.slice().sort((a, b) => Math.hypot(a.p.x - pl.ballX, a.p.z - pl.losZ) - Math.hypot(b.p.x - pl.ballX, b.p.z - pl.losZ)), i = ds.indexOf(pl.userD); pl.userD = ds[(i + 1) % ds.length]; /* nearest the ball first, then outward */ G.userSlot = pl.userD.slot; } else { pl.switchDefender(); if (pl.userD) G.userSlot = pl.userD.slot; } }
  else if (a === 'away') { slingEnd(false); pl.throwAwayUser(); }
  else if (a === 'hard') hardCount(pl);
  else if (a === 'tackle') inp.tackle = true;
  else if (a === 'swat') inp.swat = true;
  else if (a === 'fair' && pl.fairCatchCall) pl.fairCatchCall();
  else if (['juke', 'spin', 'stiff', 'truck'].includes(a)) { inp[a] = true; pl.userTouched = true; }
}
function onAct(e) { const b = e.target.closest('[data-a]'); if (!b || !G) return; e.preventDefault(); doAct(b.dataset.a); }
function onKey(e) {
  if (!G || el.game.hidden) return; const c = e.code;
  if (c === 'Escape') { e.preventDefault(); if (el.cam.classList.contains('show')) closeCam(); else if (G.paused) resume(); else pauseMenu(); return; }
  if (G.stage === 'kick' && G.kickCb && (c === 'Space' || c === 'Enter')) { e.preventDefault(); G.kickCb(); return; }
  if (G.kaim && (c === 'Space' || c === 'Enter')) { e.preventDefault(); kickAimGo(); return; }
  if (G.kpow && (c === 'Space' || c === 'Enter')) { e.preventDefault(); G.kpow(); return; }
  if (G.kpow && G.kpick) { const m = { Digit1: 'deep', Digit2: 'squib', Digit3: 'onside' }[c]; if (m) { e.preventDefault(); G.kpick(m); return; } }
  if (G.penWait) { const k = c === 'KeyA' ? 'acc' : c === 'KeyD' ? 'dec' : c === 'Space' || c === 'Enter' ? G.penRec : null; if (k) { e.preventDefault(); G.penWait(k); } return; }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'PageUp', 'PageDown'].includes(c)) e.preventDefault();
  // camera keys work any time in a game
  if (c === 'Minus' || c === 'NumpadSubtract') return nudgeCam('zoom', -0.06);
  if (c === 'Equal' || c === 'NumpadAdd') return nudgeCam('zoom', 0.06);
  if (c === 'PageUp') return nudgeCam('height', 0.06);
  if (c === 'PageDown') return nudgeCam('height', -0.06);
  if (c === 'KeyC' && !e.repeat) { const i = CAMORD.indexOf(cam.preset); setPreset(CAMORD[(i + 1) % CAMORD.length]); tick(`Camera: ${{ behind: 'Behind QB', side: 'Sideline', sky: 'All-22' }[cam.preset]}`); return; }
  keys.add(c); if (e.repeat) return;
  const k = ctxKey(), pl = G.play;
  if (c === 'Space') { if (k === 'preO') doAct('snap'); else if (k === 'd' || k === 'dAir') doAct(k === 'dAir' ? 'swat' : 'tackle'); }
  if ((c === 'KeyE' || c === 'Tab') && (k === 'd' || k === 'dAir' || k === 'preD')) doAct('switch');
  if (c === 'KeyF' && k === 'dAir') doAct('swat');
  if (c === 'KeyF' && k === 'retAir') doAct('fair');
  if (c === 'KeyH' && k === 'preO') doAct('hard');
  if (k === 'qb') { if (c === 'KeyQ') doAct('away'); const m = /^Digit([1-6])$/.exec(c); if (m) { const r = recvOrder(pl)[+m[1] - 1]; if (r) { slingEnd(false); pl.throwTo(r); } } }
  if (k === 'run') { const mv = { KeyJ: 'juke', KeyK: 'spin', KeyL: 'stiff', KeyI: 'truck' }[c]; if (mv) doAct(mv); }
}
// ------------------------------------------------------------ hard count (your offense, before the snap: H or the button)
// The QB barks a hard count to draw the defense offside. Sometimes a defensive lineman jumps (more often a low-awareness one, and
// against a rookie-level CPU; less each time you use it in a game): a free 5 yards, and you see him go. Now and then your own
// low-awareness lineman flinches instead (false start). Otherwise nobody bites and the play clock runs a bit. Once a snap.
ACTS.preO[0] += `<button class="a wide on" data-a="hard">Hard count<span class="key">H</span></button>`;
function hardCount(pl) {
  if (!pl || !G.cur || G.stage !== 'pre' || G.userSide !== 'O' || pl.phase !== 'pre' || pl.ret || G.pat || (pl.motion && pl.motion.go) || G.hcPl === pl) return;
  G.hcPl = pl; const off = G.poss, def = opp(off), H = G.hc || (G.hc = {}), n = H[off] || 0; H[off] = n + 1;
  const b = el.acts.querySelector('[data-a="hard"]'); if (b) b.classList.add('used');
  const ol = G.cur.lists[0] || [], dl = G.cur.lists[1] || [];
  const code = G.noFlags === true || G.noFlags === 'pre' ? null : RULES.hardCount({ dAwr: avgAwr(dl, isDL), oAwr: avgAwr(ol, isOL), uses: n, diff: G.diff, noise: G.noise || 0 }, R);
  tick(`${pnm(pl.qb && pl.qb.pid)}: hard count…`); buzz(15);
  if (!code) { if (G.wasRunning) G.clock = Math.max(1, G.clock - 2); after(700, () => { if (G && G.play === pl && G.stage === 'pre') tick(n >= 2 ? 'They are not biting any more' : 'Nobody bites'); }); return; }
  const byO = code === 'FS', f = { code, by: byO ? off : def, pid: foulGuy(byO ? ol : dl, code), pre: true, dead: true, hc: true };
  G.pre = null;     // what really happened replaces any jump rolled for this snap
  after(280, () => { if (G && G.play === pl && G.stage === 'pre' && pl.phase === 'pre') deadBall(pl, f); });
}
// --- the field layer: a tap snaps, a drag in the pocket is the sling, a drag anywhere else is a floating stick
let tap = null;
function fieldDown(e) {
  if (!G || !G.play) return; const k = ctxKey();
  if (k === 'preO') { tap = { id: e.pointerId, x: PX(e), y: PY(e), t: performance.now() }; return; }
  if (k === 'qb') { if (sling.id != null) return; Object.assign(sling, { id: e.pointerId, sx: PX(e), sy: PY(e), dx: 0, dy: 0, mode: null }); return; }
  stickDown(e);
}
function fieldMove(e) { if (e.pointerId === sling.id) slingMove(e); else stickMove(e); joyMove(e); }
function fieldUp(e) {
  if (tap && e.pointerId === tap.id) { const ok = e.type === 'pointerup' && Math.hypot(PX(e) - tap.x, PY(e) - tap.y) < 16 && performance.now() - tap.t < 700 && ctxKey() === 'preO' && G.time - G.preT > 0.35; tap = null; if (ok) doAct('snap'); }
  if (e.pointerId === sling.id) slingEnd(e.type === 'pointerup');
  stickUp(e); joyUp(e);
}
// --- the sling: pull back from where you put your finger down; the throw goes the other way, longer pull = longer throw
const sling = { id: null, sx: 0, sy: 0, dx: 0, dy: 0, mode: null, wx: 0, wz: 1, dist: 0 };
function slingMove(e) {
  const pl = G.play; if (!pl) return; sling.dx = PX(e) - sling.sx; sling.dy = PY(e) - sling.sy; const len = Math.hypot(sling.dx, sling.dy);
  if (sling.mode === 'run') { stickTo(sling.sx, sling.sy, sling.dx, sling.dy); return; }
  if (ctxKey() !== 'qb') return;
  if (len < 12) { sling.mode = null; return; }
  const b = glOk ? R3D.basis() : { fx: 0, fz: 1, rx: -1, rz: 0 }, ax = -sling.dx, ay = -sling.dy;
  let wx = b.rx * ax - b.fx * ay, wz = b.rz * ax - b.fz * ay; const wm = Math.hypot(wx, wz) || 1; wx /= wm; wz /= wm;
  if (wz < -0.25) { if (len >= 24) { sling.mode = 'run'; pl.aimAt = null; stickTo(sling.sx, sling.sy, sling.dx, sling.dy); } return; }    // aiming behind him = he wants to run
  const span = Math.max(150, Math.min(innerWidth, innerHeight) * 0.38), fr = clamp((len - 12) / span, 0, 1);
  // the same drag means the same distance for every QB; a weak arm just runs out of range sooner (the arc turns orange at his limit)
  Object.assign(sling, { mode: 'aim', wx, wz, dist: 3 + Math.pow(fr, 1.15) * 64 });
}
function slingSpot(pl) { const q = pl.qb; return { x: q.p.x + sling.wx * sling.dist, z: q.p.z + sling.wz * sling.dist }; }
function slingEnd(release) {
  if (sling.id == null && !sling.mode) return; const pl = G && G.play;
  if (release && sling.mode === 'aim' && pl && pl.canThrow()) { const L = slingSpot(pl); pl.throwSpot(L.x, L.z); }
  if (sling.mode === 'run') { stick.x = stick.y = 0; if (stick.id == null) el.stick.classList.remove('show'); }
  sling.id = null; sling.mode = null; if (pl) pl.aimAt = null;
}
// draw the aim every frame (the QB keeps moving, so the arc does too)
let aimOn = false;
function aimFrame() {
  const pl = G && G.play, on = !!(pl && sling.mode === 'aim' && ctxKey() === 'qb' && pl.canThrow());
  if (!on) { if (aimOn) { R3D.aim(null); aimOn = false; } G.aimTgt = null; return; }
  const L = slingSpot(pl), f = pl.spotFlight(L.x, L.z), r = pl.spotTarget(f.L, f.T); pl.aimAt = f.L; G.aimTgt = r ? r.id : null; R3D.aim({ hand: f.hand, v: f.v, wa: f.wa, T: f.T, L: f.L, hit: !!r, capped: f.capped, sigma: f.sigma, max: f.max, q: pl.qb.p }); aimOn = true;
}
// --- floating stick (drag anywhere) and the fixed stick bottom-left
const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
function stickTo(ox, oy, dx, dy) { const m = Math.hypot(dx, dy), R0 = 56; if (m > R0) { dx *= R0 / m; dy *= R0 / m; } stick.x = dx / R0; stick.y = dy / R0; el.stick.style.left = ox + 'px'; el.stick.style.top = oy + 'px'; el.stick.classList.add('show'); el.stick.firstChild.style.transform = `translate(${dx}px,${dy}px)`; }
function stickDown(e) { if (stick.id != null) return; stick.id = e.pointerId; stick.ox = PX(e); stick.oy = PY(e); stickTo(stick.ox, stick.oy, 0, 0); }
function stickMove(e) { if (e.pointerId !== stick.id) return; stickTo(stick.ox, stick.oy, PX(e) - stick.ox, PY(e) - stick.oy); }
function stickUp(e) { if (e && e.pointerId !== stick.id) return; stick.id = null; if (sling.mode === 'run') return; stick.x = stick.y = 0; el.stick.classList.remove('show'); }
function joyDown(e) { if (joy.id != null || !G) return; e.preventDefault(); e.stopPropagation(); joy.id = e.pointerId; joy.cx = el.joy.offsetLeft + el.joy.offsetWidth / 2; joy.cy = el.joy.offsetTop + el.joy.offsetHeight / 2; joyMove(e); if (G.play && ctxKey() !== 'qb') G.play.userTouched = true; }
function joyMove(e) { if (e.pointerId !== joy.id) return; let dx = PX(e) - joy.cx, dy = PY(e) - joy.cy; const m = Math.hypot(dx, dy), R0 = 40; if (m > R0) { dx *= R0 / m; dy *= R0 / m; } joy.x = dx / R0; joy.y = dy / R0; el.joy.firstChild.style.transform = `translate(${dx}px,${dy}px)`; }
function joyUp(e) { if (e && e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; if (el.joy) el.joy.firstChild.style.transform = ''; }
function applyInput(pl) {
  if (!G.userSide || G.mode !== 'play') { pl.input.x = pl.input.z = 0; return; }
  let sx = stick.x, sy = stick.y; if (joy.id != null) { sx = joy.x; sy = joy.y; }
  const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0), ky = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
  if (kx || ky) { const m = Math.hypot(kx, ky); sx = kx / m; sy = ky / m; }
  if (!glOk) { pl.input.x = -sx; pl.input.z = -sy; return; }
  const b = R3D.basis(); pl.input.x = b.rx * sx - b.fx * sy; pl.input.z = b.rz * sx - b.fz * sy;
}
function recvOrder(pl) { return pl.receivers.slice().sort((a, b) => b.p.x - a.p.x); }
// hot routes: tap a man's tag before the snap to cycle his route (pass plays)
const HOT = ['go', 'slant', 'out', 'curl', 'block'], HOT_LAB = { go: 'GO', slant: 'SLANT', out: 'OUT', curl: 'CURL', block: 'BLOCK', custom: 'DRAWN', in: 'IN', post: 'POST', corner: 'CORNER', hitch: 'HITCH', stick: 'STICK', comeback: 'COMEBACK', seam: 'SEAM', flat: 'FLAT', drag: 'DRAG', wheel: 'WHEEL', screen: 'SCREEN', angle: 'ANGLE', fade: 'FADE' };
function onBubble(e) {
  const b = e.target.closest('.rb.hr'); if (!b || !G || !G.play || ctxKey() !== 'preO') return; e.preventDefault(); e.stopPropagation();
  const pl = G.play, slot = b.dataset.slot, cur = (pl.op.routes || {})[slot] || 'block', nx = HOT[(HOT.indexOf(cur) + 1) % HOT.length];
  if (pl.hotRoute && pl.hotRoute(slot, nx)) { bubKey = ''; if (glOk) R3D.overlay(pl, 'O'); tick(`Hot route: ${pnm((pl.O.find(p => p.slot === slot) || {}).pid)} ${nx === 'block' ? 'stays in to block' : 'runs a ' + nx}`); buzz(10); }
}
// receiver name tags before the snap (last name, OVR; on a keyboard, the 1-5 throw key). Gone once the ball is snapped so they never block the play.
function bubbles() {
  const k = ctxKey(), pl = G.play, show = k === 'preO';
  if (!show) { if (bubKey) { el.bub.innerHTML = ''; bubKey = ''; } return; }
  const ro = recvOrder(pl), rs = pl.pass ? pl.O.filter(p => !p.ol && p !== pl.qb).sort((a, b) => b.p.x - a.p.x) : ro, rtOf = r => (pl.op.routes || {})[r.slot] || (r.role === 'route' ? r.routeName : 'block'), sig = k + rs.map(r => r.id + rtOf(r)).join(',');
  if (sig !== bubKey) { bubKey = sig; const keys = matchMedia('(pointer: fine)').matches; el.bub.innerHTML = rs.map(r => { const i = ro.indexOf(r); return `<div class="rb pre${pl.pass ? ' on hr' : ''}${r.role === 'route' ? '' : ' blk'}" data-r="${r.id}" data-slot="${esc(r.slot)}">${esc((r.rp && r.rp.ln) || r.slot)}${keys && i >= 0 ? `<small>${i + 1}</small>` : ''}${r.rp && r.rp.ovr ? `<em>${r.rp.ovr}</em>` : ''}${pl.pass ? `<u>${esc(HOT_LAB[rtOf(r)] || String(rtOf(r)).toUpperCase())}</u>` : ''}</div>`; }).join(''); }
  const nodes = el.bub.children, upd = G.time - G.bubT > 0.12; if (upd) G.bubT = G.time;
  const W = el.game.clientWidth || innerWidth, H = el.game.clientHeight || innerHeight;
  // receivers split out wide can be off screen: pin their tag to the edge
  const P2 = rs.map((r, i) => { const n = nodes[i], w = n ? (n._w || (n._w = n.offsetWidth || 60)) : 60, J = pl.poses[r.id], y = J ? J.head.y + 0.85 : 2.7, s = R3D.project(J ? J.head.x : r.p.x, y, J ? J.head.z : r.p.z), x = clamp(s.behind ? (s.x < W / 2 ? 0 : W) : s.x, w / 2 + 6, W - w / 2 - 6), yy = clamp(s.y, 120, H - 150); return { x, y: yy, w, edge: x !== s.x || yy !== s.y }; });
  for (let it = 0; it < 4; it++) for (let i = 0; i < P2.length; i++) for (let j = i + 1; j < P2.length; j++) {     // keep tags from stacking on each other
    const a = P2[i], b = P2[j], dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) >= (a.w + b.w) / 2 + 4 || Math.abs(dy) >= 30) continue;
    const push = (30 - Math.abs(dy)) / 2 * (dy >= 0 ? 1 : -1); a.y = clamp(a.y - push, 110, H - 140); b.y = clamp(b.y + push, 110, H - 140); }
  rs.forEach((r, i) => { const n = nodes[i]; if (!n) return; const p = P2[i]; if (n._x == null || Math.abs(n._x - p.x) > 260) { n._x = p.x; n._y = p.y; } else { n._x += (p.x - n._x) * 0.35; n._y += (p.y - n._y) * 0.35; }   // glide, don't jump
    n.style.left = n._x + 'px'; n.style.top = n._y + 'px'; n.classList.toggle('edge', p.edge); n.classList.toggle('tg', k === 'qb' && G.aimTgt === r.id);
    if (upd && k === 'qb') { const o = pl.openness(pl.qb, r).open; n.classList.toggle('y', o <= 0.6 && o > -1.0); n.classList.toggle('r', o <= -1.0); } });     // window: green open, yellow tight, red covered
}

// ------------------------------------------------------------ sim drive / sim to the end: the coordinators call it and you watch every snap, at the speed you pick
const SPEEDS = [1, 2, 4, 10, 20];
function setSpeed(s) { if (G) G.speed = s; const i = SPEEDS.indexOf(s); if (el.spdIn) el.spdIn.value = String(i < 0 ? 0 : i); if (el.spdV) el.spdV.textContent = s + '×'; }
function speedBar(on) { if (!el.spdBar) return; el.spdBar.classList.toggle('show', !!on); el.spdBar.classList.toggle('on', !!on); if (el.game) el.game.classList.toggle('spdon', !!on); }
function startAuto(kind) {
  if (!G || G.over) return; G.auto = { kind, tid: G.poss }; G.autoFrom = G.mode; G.mode = 'watch';
  slingEnd(false); G.userSide = null; if (G.play) G.play.userSide = null; actsFor('none'); hideSheet(); closeOverlay();
  setSpeed(kind === 'rest' ? 10 : 4); speedBar(true); tick(kind === 'drive' ? 'Your coordinator has the call: watching the drive' : 'Coordinators have the call: watching to the end');
  if (G.stage === 'call') { if (G.sheet && G.sheet.side === 'PAT') kickXP(G.pat.tid); else autoCalls(); }
  else if (G.stage === 'pre') { const pl = G.play; after(500, () => { if (G && G.play === pl && pl.phase === 'pre' && G.stage === 'pre') snapCall(pl); }); }
}
function endAuto(msg) { if (!G || !G.auto) return; G.auto = null; G.mode = G.autoFrom === 'watch' ? 'watch' : 'play'; G.autoFrom = null; setSpeed(1); speedBar(G.mode === 'watch'); if (msg) tick(msg); }

// ------------------------------------------------------------ play-call sheet
function showSheet(side) {
  G.stage = 'call'; actsFor('none');
  const off = G.poss, tid = G.user, s = { side, filter: 'coach', cc: null, pool: [], cpuO: null };
  if (side === 'PAT') { G.sheet = s; renderSheet(); return; }
  const ctx = ctxFor(tid, side);
  if (has('coordCall')) { try { s.cc = LG.coordCall(ctx); } catch (e) { console.error(e); } }
  if (side === 'D') { s.cpuO = G.keepO || callFor(off, 'O').play; s.cpuFlip = G.keepO ? G.keepFlip : null; G.keepO = null; G.keepFlip = null; }
  s.pool = poolFor(tid, side);
  if (G.pat && G.pat.two && side === 'O') s.pool = s.pool.filter(p => p.form !== 'Goal Line' || true);
  G.sheet = s; renderSheet();
}
function playCard(p, rec) { const fe = p.side === 'O' && G && G.film && G.film[p.id], seen = fe ? Math.round(filmSeen(fe)) : 0; return `<button class="pc on${rec ? ' rec' : ''}" data-id="${esc(p.id)}">${rec ? '<span class="star">COACH</span>' : ''}${seen >= 2 ? `<span class="seen" title="The defense has seen this play ${seen} times and will key on it">SEEN ×${seen}</span>` : ''}<canvas width="150" height="100" data-pa="${esc(p.id)}"></canvas><b>${esc(p.name)}</b><span>${esc(typeof playSub === 'function' ? playSub(p) : p.form)}</span></button>`; }
// key matchups from the ratings: who is faster, who can throw how far, who wins up front (cached per possession)
function matchups(side) {
  const key = G.poss + ':' + side + ':' + G.drives.length; if (G.mu && G.mu.key === key) return G.mu.html;
  const me = TM(G.user), them = TM(opp(G.user)), dp = (T, pos, i) => P(has('depthPick') ? LG.depthPick(T, pos, i) : null), nm = p => `#${p.num} ${esc(p.ln)}`;
  const out = [], top = (T, pos, n, k) => Array.from({ length: n }, (_, i) => dp(T, pos, i)).filter(Boolean).sort((a, b) => b.a[k] - a.a[k]);
  const yds = p => typeof PHYS !== 'undefined' && PHYS._ && PHYS._.physFrom ? Math.round(PHYS._.physFrom(p).range / 0.9144) : null;
  if (side === 'O') {
    const wr = top(me, 'WR', 3, 'spd')[0], cb = top(them, 'CB', 3, 'spd').pop(), qb = dp(me, 'QB', 0), de = top(them, 'DE', 2, 'prs')[0], lt = dp(me, 'OT', 0);
    if (wr && cb) { const d = wr.a.spd - cb.a.spd; out.push(d >= 5 ? ['good', `${nm(wr)} (SPD ${wr.a.spd}) can run past CB ${nm(cb)} (SPD ${cb.a.spd})`] : d <= -5 ? ['bad', `CB ${nm(cb)} (SPD ${cb.a.spd}) is faster than your WRs`] : ['', `WR ${nm(wr)} SPD ${wr.a.spd} vs CB ${nm(cb)} SPD ${cb.a.spd}`]); }
    if (qb) { const y = yds(qb); if (y) out.push([y >= 60 ? 'good' : y < 48 ? 'bad' : '', `${nm(qb)} can throw it about ${y} yards (ARM ${qb.a.thp}, ACC ${qb.a.tha})`]); }
    if (de && lt && de.a.prs - lt.a.pbk >= 6) out.push(['bad', `DE ${nm(de)} (RUSH ${de.a.prs}) beats your tackle ${nm(lt)} (PBK ${lt.a.pbk}): get it out fast`]);
  } else {
    const wr = top(them, 'WR', 3, 'spd')[0], cb = top(me, 'CB', 3, 'spd').pop(), qb = dp(them, 'QB', 0);
    if (qb) { const y = yds(qb); if (y) out.push([y < 50 ? 'good' : y >= 62 ? 'bad' : '', y < 50 ? `Their QB ${nm(qb)} can't throw past ~${y} yards: squeeze the short stuff` : `Their QB ${nm(qb)} has a ${y}-yard arm (ARM ${qb.a.thp})`]); }
    if (wr && cb) { const d = wr.a.spd - cb.a.spd; if (d >= 5) out.push(['bad', `Their WR ${nm(wr)} (SPD ${wr.a.spd}) outruns CB ${nm(cb)} (SPD ${cb.a.spd}): keep a safety deep`]); }
    const rb = dp(them, 'RB', 0); if (rb && rb.a.btk >= 85) out.push(['bad', `RB ${nm(rb)} breaks tackles (BTK ${rb.a.btk}): gang tackle`]);
  }
  const html = out.length ? `<div class="mups">${out.slice(0, 3).map(([c, t]) => `<div class="mu ${c}">${t}</div>`).join('')}</div>` : '';
  G.mu = { key, html }; return html;
}
// ---- the defense learns: every play you run goes on film; run it again and they read it faster, jump the route you went to, crowd the side you ran
function filmSeen(e) { return e.n * Math.pow(0.94, Math.max(0, (G.playN || 0) - (e.last || 0)) / 2); }
function filmNote(op, res, info) {
  const F = G.film || (G.film = {}), e = F[op.id] || (F[op.id] = { n: 0, yds: 0, big: 0, stops: 0, tgt: {}, last: 0, name: op.name, form: op.form, type: op.type, deep: !!op.deep });
  const y = res.type === 'inc' ? 0 : (res.yards || 0); e.n = filmSeen(e) + 1; e.last = G.playN || 0; e.yds += y; if (y >= 12 || res.td) e.big++; if (y <= 1 || res.turnover) e.stops++;
  const tp = info && info.target; if (tp != null && info.lists) { const ent = info.lists[0].find(x => x.rp && x.rp.id === tp); if (ent) e.tgt[ent.slot] = (e.tgt[ent.slot] || 0) + 1; }
  if (G.lastFilmK >= 0.4 && (y <= 1 || res.turnover) && !res.td) after(900, () => tick(`They saw it coming: the defense has seen ${op.name} ${Math.round(e.n - 1)} times`));
}
function filmFor(op) {
  const e = G.film && G.film[op.id]; G.lastFilmK = 0; if (!e) return null; const n = filmSeen(e); if (n < 0.8) return null;
  const k = clamp(0.24 * n + 0.08 * e.big - 0.04 * e.stops, 0, 0.85); G.lastFilmK = k;
  const tg = Object.entries(e.tgt).sort((a, b) => b[1] - a[1])[0];
  return { k, type: op.type, deep: !!op.deep, tgt: tg ? tg[0] : null };
}
// what has hurt the defense from this formation: the CPU coordinator calls against it
function filmThreats(form) { return Object.values(G.film || {}).filter(e => !form || e.form === form).map(e => ({ type: e.type, deep: e.deep, w: filmSeen(e) * (Math.max(0, e.yds / Math.max(1, e.n)) + 2 + e.big * 3) })).filter(x => x.w > 2); }
// the defense scouts a QB who keeps taking off (PHYS.qbScout): after two or three scrambles they spy him and rush to contain
function qbScout() { return G && G.qbs && PHYS.qbScout ? PHYS.qbScout.read(G.qbs, G.playN || 0) : null; }
function filmLine() {
  const sc = qbScout(), qbN = sc && sc.k >= 0.35 ? `<div class="mu bad">They have seen your QB take off ${Math.round(sc.n)} times: expect a spy and the ends keeping contain.</div>` : '';
  const top = Object.values(G.film || {}).map(e => [e, filmSeen(e)]).filter(x => x[1] >= 2.5).sort((a, b) => b[1] - a[1])[0];
  return top || qbN ? `<div class="mups">${top ? `<div class="mu bad">They have seen ${esc(top[0].name)} ${Math.round(top[1])} times. Mix it up or they will jump it.</div>` : ''}${qbN}</div>` : '';
}
function renderSheet() {
  const s = G.sheet, sh = el.sheet, T = TM(G.user), off = G.poss;
  if (s.side === 'PAT') {
    sh.innerHTML = `<div class="sh-top"><span class="side">AFTER THE TOUCHDOWN</span><span class="sit">${esc(T.name)} ${G.score[G.user]} — ${G.score[opp(G.user)]} ${esc(TM(opp(G.user)).name)}</span></div>
      <div class="coord"><div><div class="who">YOUR CALL</div><p>Kick the extra point, or go for two from the 2-yard line.</p></div></div>
      <div class="sh-acts"><button class="pri on" data-act="xp">Kick extra point</button><button class="on" data-act="two">Go for two</button></div>`;
    sh.classList.add('show'); return;
  }
  const side = s.side, cc = s.cc, picks = (cc && cc.picks ? cc.picks : []).map(playById).filter(p => p && p.side === side), pool = s.pool;
  const forms = [...new Set(pool.map(p => p.form))];
  const f = s.filter, shown = f === 'coach' ? (picks.length ? [] : pool) : pool.filter(p => f === 'all' || (f === 'run' && p.type === 'run') || (f === 'pass' && p.type === 'pass') || (f === 'blitz' && p.blitz && p.blitz.length) || (f === 'man' && MAN_COVERAGES[p.cov]) || (f === 'zone' && p.side === 'D' && !MAN_COVERAGES[p.cov]) || p.form === f);
  const chips = (side === 'O' ? [['coach', 'Coach picks'], ['all', 'All'], ['run', 'Run'], ['pass', 'Pass']] : [['coach', 'Coach picks'], ['all', 'All'], ['blitz', 'Blitz'], ['man', 'Man'], ['zone', 'Zone']]).concat(forms.map(x => [x, x]));
  const fg = has('fgProb') ? fgOdds(G.user, G.yl) : null, late = G.q >= 4 || G.q === 2, lead = G.score[G.user] - G.score[opp(G.user)];
  const clockNote = G.runoff > 0 && G.clock - G.runoff <= 0 ? `<div class="small" style="color:var(--bad);margin-top:4px">The clock runs out before the snap unless you call timeout.</div>` : '';
  const four = side === 'O' && G.down === 4 && has('cpuFourth') ? LG.cpuFourth(G.user, ctxFor(G.user, 'O')) : null, fourTxt = four ? ` On 4th down I'd ${four === 'go' ? 'go for it' : four === 'fg' ? 'kick the field goal' : 'punt it'}.` : '';
  const who = cc && cc.who ? cc.who : null, say = (cc && cc.say ? cc.say : 'Your call, coach.') + fourTxt;
  sh.innerHTML = `<div class="sh-top"><span class="side ${side === 'D' ? 'd' : ''}">${side === 'O' ? 'OFFENSE' : 'DEFENSE'}</span><span class="sit">${G.pat && G.pat.two ? 'Two-point try' : esc(ddTxt())}</span><span class="sp"></span><span class="small mute">${qTxt(G.q)} ${clockTxt(G.clock - G.runoff)}${G.runoff > 0 ? ' <i class="clk">running</i>' : ''}</span></div>${clockNote}
    <div class="coord">${who && typeof lookC === 'function' ? lookC(who.lk, 50, G.user) : ''}<div><div class="who">${who ? `${who.role} ${esc(who.fn)} ${esc(who.ln)}` : 'COORDINATOR'}</div><p>${esc(say)}</p></div></div>
    ${matchups(side)}${side === 'O' ? filmLine() : ''}
    ${picks.length && f === 'coach' ? `<div class="picks">${picks.slice(0, 3).map(p => playCard(p, true)).join('')}</div>` : ''}
    <div class="chips">${chips.map(([k, n]) => `<button class="sm on ${f === k ? 'on2' : ''}" data-f="${esc(k)}">${esc(n)}</button>`).join('')}</div>
    ${shown.length ? `<div class="plist">${shown.map(p => playCard(p, false)).join('')}</div>` : ''}
    <div class="sh-acts">
      ${G.to[G.user] > 0 && !G.pat && G.runoff > 0 ? `<button class="on pri" data-act="to">Timeout (${G.to[G.user]})</button>` : ''}
      ${side === 'O' ? `<button class="on ${G.flip ? 'pri' : ''}" data-act="flip">Flip ⇄</button>` : ''}
      ${side === 'O' && !G.pat && fg && G.yl >= 50 ? `<button class="on ${four === 'fg' ? 'pri' : ''}" data-act="fg">FG ${fg.d} yd · ${Math.round(fg.p * 100)}%</button>` : ''}
      ${side === 'O' && !G.pat && G.yl < 72 && (G.down === 4 || G.yl < 40) ? `<button class="on ${four === 'punt' ? 'pri' : ''}" data-act="punt">Punt</button>` : ''}
      ${side === 'O' && !G.pat && G.down === 4 && G.yl < 72 ? `<button class="on ghost" data-act="fakep" title="Line up to punt, then ${G.togo <= 3 ? 'run it' : 'throw it'}">Fake punt</button>` : ''}
      ${side === 'O' && !G.pat && G.down === 4 && fg && G.yl >= 55 ? `<button class="on ghost" data-act="fakefg" title="Line up for the kick, then ${G.togo <= 2 ? 'run it' : 'throw it'}">Fake FG</button>` : ''}
      ${side === 'O' && !G.pat && late && lead > 0 && G.down < 4 ? `<button class="on" data-act="kneel">Kneel</button>` : ''}
      ${side === 'O' && !G.pat && G.runoff > 0 && G.down < 4 ? `<button class="on" data-act="spike">Spike</button>` : ''}
      <span class="grp"><button class="on ghost" data-act="min">▾</button><button class="on ghost" data-act="simd">Sim drive</button><button class="on ghost" data-act="menu">☰</button></span>
    </div>`;
  sh.classList.add('show'); sh.classList.remove('min'); G.sheetT = performance.now();
  if (typeof paintArt === 'function') { try { paintArt(sh); } catch (e) { } }
  if (typeof drawPlayArt === 'function') sh.querySelectorAll('canvas[data-pa]').forEach(cn => { const p = playById(cn.dataset.pa); if (p) { try { drawPlayArt(cn, p); } catch (e) { } } });
}
function hideSheet() { el.sheet.classList.remove('show'); }
function onSheetClick(e) {
  if (!G || !G.sheet) return; const s = G.sheet, t = e.target.closest('[data-id],[data-act],[data-f]'); if (!t) return;
  if (t.dataset.f) { s.filter = t.dataset.f; renderSheet(); return; }
  if (G.stage !== 'call') return;                 // a second tap after the call was made
  { const now = performance.now(), key = t.dataset.act || t.dataset.id; const quick = now - (G.tapT || 0) < 350 && G.tapKey && G.tapKey !== key && G.sheetT > G.tapT;
    G.tapT = now; G.tapKey = key; if (quick) return; }      // the sheet re-rendered under a double tap: the second tap would hit a different button (e.g. Timeout -> Flip)
  const a = t.dataset.act;
  if (a === 'xp') { hideSheet(); return kickXP(G.pat.tid); }
  if (a === 'two') { hideSheet(); return startTwo(G.pat.tid); }
  if (a === 'to') { callTimeout(G.user); renderSheet(); return; }
  if (a === 'flip') { G.flip = !G.flip; renderSheet(); return; }
  if (a === 'fg') { hideSheet(); return fieldGoal(G.user); }
  if (a === 'punt') { hideSheet(); return punt(G.user); }
  if (a === 'fakep' || a === 'fakefg') return fakePlay(a === 'fakep' ? 'punt' : 'fg', G.user);
  if (a === 'kneel') return kneel();
  if (a === 'spike') return spike();
  if (a === 'min') { el.sheet.classList.toggle('min'); return; }
  if (a === 'simd') return startAuto('drive');
  if (a === 'menu') return pauseMenu();
  const id = t.dataset.id; if (!id) return; const p = playById(id); if (!p) return;
  if (s.side === 'O') { const D = callFor(opp(G.user), 'D', p.form); startPlay(p, D.play, G.flip); }
  else { const op = s.cpuO || callFor(G.poss, 'O').play; startPlay(op, p, s.cpuFlip != null ? s.cpuFlip : R() < 0.5); }
}

// ------------------------------------------------------------ overlays
function overlay(html) { el.ovl.innerHTML = html; el.ovl.classList.add('show', 'on'); }
function closeOverlay() { el.ovl.classList.remove('show', 'on'); el.ovl.innerHTML = ''; }
function introCard(f, building) {
  if (G.stage !== 'load') return;
  const side = T => `<div class="t">${typeof logoC === 'function' ? logoC(T, 64) : ''}<b>${esc(T.city || '')} ${esc(T.name)}</b><span>${T.w != null ? `${T.w}-${T.l}${T.tie ? '-' + T.tie : ''}` : ''}</span></div>`;
  const ready = G.ready, uSide = G.user === G.hid ? 'home' : 'away';
  overlay(`<div class="card"><div class="small mute" style="text-align:center;letter-spacing:.08em">${G.playoffs ? 'PLAYOFFS' : G.g && G.g.wk != null ? 'WEEK ' + (G.g.wk + 1) : 'GAME DAY'} · ${G.mode === 'watch' ? 'WATCHING' : 'YOU COACH THE ' + uSide.toUpperCase() + ' TEAM'}</div>
    <div class="mu">${side(G.A)}<div class="at">@</div>${side(G.H)}</div>
    ${ready ? '' : `<div class="small mute" style="text-align:center">${building ? 'Sculpting players (first game only)…' : 'Loading…'}</div><div class="prog"><i style="width:${Math.round(f * 100)}%"></i></div>`}
    <div class="row" style="margin-top:10px">${ready ? `<button class="pri big on" id="mKick">${G.mode === 'watch' ? 'Starting…' : 'Kick off'}</button>` : ''}<button class="ghost on" id="mBack">Back</button></div></div>`);
  if (typeof paintArt === 'function') { try { paintArt(el.ovl); } catch (e) { } }
  const k = document.getElementById('mKick'); if (k && G.mode !== 'watch') k.onclick = () => { closeOverlay(); G.stage = 'kick'; startGame(); };
  document.getElementById('mBack').onclick = () => close({ quit: true });
}
function simCard() { overlay(`<div class="card"><h2>Simulating…</h2><div class="small mute">Both coordinators call it; every snap is still played out with the full physics.</div><div class="prog"><i></i></div></div>`); }
function simProgress() { if (G.sim === 'game' && !el.ovl.querySelector('.prog')) simCard(); const i = el.ovl.querySelector('.prog i'); if (i && G.sim === 'game') { const t = ((Math.min(G.q, 4) - 1) * G.qlen + (G.qlen - G.clock)) / (4 * G.qlen); i.style.width = Math.round(t * 100) + '%'; } }
function pauseMenu() {
  if (!G || G.stage === 'final' || G.stage === 'load' || G.kickCb || G.penWait) return; G.paused = true;
  overlay(`<div class="card"><h2>Paused</h2><div class="small mute">${esc(TM(G.aid).abbr)} ${G.score[G.aid]} — ${esc(TM(G.hid).abbr)} ${G.score[G.hid]} · ${qTxt(G.q)} ${clockTxt(G.clock)}</div>
    <div class="row" style="margin-top:14px;flex-direction:column;align-items:stretch"><button class="pri on" data-m="resume">Resume</button><button class="on" data-m="cam">Camera…</button>${G.mode === 'watch' ? '<button class="on" data-m="take">Take over (play)</button>' : '<button class="on" data-m="watch">Sim to the end (watch, any speed)</button>'}<button class="on" data-m="simg">Finish instantly</button><button class="bad on" data-m="quit">Quit game (not saved)</button></div></div>`);
  el.ovl.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const m = b.dataset.m; if (m === 'resume') return resume();
    if (m === 'cam') { closeOverlay(); G.paused = false; camPanel(); G.camWasPaused = false; return; }
    if (m === 'take') { resume(); if (G.auto) endAuto(); else { G.mode = 'play'; setSpeed(1); speedBar(false); } return; }
    if (m === 'watch') { resume(); return startAuto('rest'); }
    if (m === 'simg') { G.paused = false; hideSheet(); G.auto = null; speedBar(false); const st = G.stage; G.sim = 'game'; if (G.kickCb) G.kickCb(); simCard(); if (st === 'call' || st === 'pre' || st === 'live') { G.play = null; after(0, nextSnap); } return; }
    if (m === 'quit') { if (confirm('Quit this game? The result will not count.')) quit(); }
  });
}
function resume() { G.paused = false; closeOverlay(); lastT = performance.now(); }
function kickMeter(fg, done, k) {
  // the kicker's ratings set the meter: accuracy = a slower needle and a wider green zone, power = the range in fgProb
  const kac = k ? k.a.kac : 70, kpw = k ? k.a.kpw : 70, gw = clamp(0.025 + (kac - 40) / 1200, 0.02, 0.075);
  G.stage = 'kick'; let t0 = performance.now(), stopped = false; const spd = (1.6 + clamp((fg.d - 25) / 30, 0, 1.4)) * clamp(1.45 - kac / 160, 0.8, 1.2);
  const g0 = (50 - gw * 100).toFixed(1), g1 = (50 + gw * 100).toFixed(1), y0 = (50 - gw * 100 - 14).toFixed(1), y1 = (50 + gw * 100 + 14).toFixed(1);
  overlay(`<div class="card"><h2>${fg.d}-yard field goal</h2><div class="small mute">${k ? esc(k.fn[0] + '. ' + k.ln) + ' · KPW ' + kpw + ' · KAC ' + kac + ' · ' : ''}odds ${Math.round(fg.p * 100)}% · stop the needle in the green</div><div class="meterK" style="background:linear-gradient(90deg,#c2453a,#d39a19 ${y0}%,#2f9e57 ${g0}%,#2f9e57 ${g1}%,#d39a19 ${y1}%,#c2453a)"><i></i></div><div class="row"><button class="pri big on" id="mK">KICK</button></div></div>`);
  const nd = el.ovl.querySelector('.meterK i'); let pos = 0.5;
  const anim = () => { if (stopped || !G) return; pos = 0.5 + 0.5 * Math.sin((performance.now() - t0) / 1000 * spd * Math.PI); nd.style.left = (pos * 100) + '%'; requestAnimationFrame(anim); }; anim();
  const go = () => { if (stopped) return; stopped = true; G.kickCb = null; const q = 1 - clamp((Math.abs(pos - 0.5) - gw) / (0.5 - gw), 0, 1); setTimeout(() => { closeOverlay(); done(q); }, 350); };
  G.kickCb = go; document.getElementById('mK').onclick = go;
}
// drive chart and play-by-play (penalties included) under the box score
function gameLogs() {
  const rs = { TD: 'Touchdown', FG: 'Field goal' }, dl = G.drives.map(d => `<tr><td>${qTxt(d.q)}</td><td>${esc(TM(d.tid).abbr)}</td><td>${esc(spotTxt(d.start, d.tid))}</td><td>${d.plays}-${d.yds}</td><td>${d.pen ? `${d.pen}-${d.penY}` : ''}${d.dpen ? `<i>+${d.dpen}</i>` : ''}</td><td>${esc(rs[d.result] || d.result)}</td></tr>`).join('');
  const pb = G.pbp.map(t => `<li class="${/PENALTY/.test(t) ? 'pn' : /TD|TOUCHDOWN|field goal GOOD/.test(t) ? 'sc' : ''}">${esc(t)}</li>`).join('');
  return `<details class="dlog on"><summary class="on">Drive chart</summary><table class="dch"><tr><td>Q</td><td></td><td>Start</td><td>Plays-yds</td><td>Pen</td><td>Result</td></tr>${dl}</table></details><details class="dlog on"><summary class="on">Play-by-play</summary><ol class="pbp">${pb}</ol></details>`;
}
function finalCard(pog) {
  const a = teamTotals(G.aid), h = teamTotals(G.hid), A = TM(G.aid), H = TM(G.hid), won = G.score[G.user] > G.score[opp(G.user)], tie = G.score[G.hid] === G.score[G.aid];
  const row = (n, x, y) => `<tr><td>${n}</td><td>${x}</td><td>${y}</td></tr>`, pg = P(pog), ps = pg ? G.st[pog] || {} : {};
  const line = s => [s.pa ? `${s.pc || 0}/${s.pa} ${s.py || 0} yds ${s.ptd || 0} TD` : '', s.ra ? `${s.ra} car ${s.ry || 0} yds` : '', s.rec ? `${s.rec} rec ${s.recy || 0} yds` : '', (s.rtd || 0) + (s.rectd || 0) ? `${(s.rtd || 0) + (s.rectd || 0)} TD` : '', s.tk ? `${s.tk} tk` : '', s.sk ? `${s.sk} sk` : '', s.int ? `${s.int} INT` : '', s.fgm ? `${s.fgm} FG` : ''].filter(Boolean).join(' · ');
  const L1 = (k, f, lab) => `<div><b>${lab}</b>${esc(A.abbr)}: ${esc(leader(G.aid, k, f))}<br>${esc(H.abbr)}: ${esc(leader(G.hid, k, f))}</div>`;
  overlay(`<div class="card fin"><div class="small mute" style="text-align:center;letter-spacing:.08em">FINAL${G.q >= 5 ? ' / OT' : ''}</div>
    <div class="mu"><div class="t">${typeof logoC === 'function' ? logoC(A, 56) : ''}<b>${esc(A.name)}</b><span class="big${G.score[G.aid] >= G.score[G.hid] ? '' : ' lo'}">${G.score[G.aid]}</span></div><div class="at">@</div><div class="t">${typeof logoC === 'function' ? logoC(H, 56) : ''}<b>${esc(H.name)}</b><span class="big${G.score[G.hid] >= G.score[G.aid] ? '' : ' lo'}">${G.score[G.hid]}</span></div></div>
    ${G.mode === 'play' ? `<div style="text-align:center;font:600 26px var(--disp);color:${tie ? 'var(--mute)' : won ? 'var(--good)' : 'var(--bad)'}">${tie ? 'TIE GAME' : won ? 'VICTORY' : 'DEFEAT'}</div>` : ''}
    <table>${row('', esc(A.abbr), esc(H.abbr))}${row('Total yards', a.ty, h.ty)}${row('Passing', a.py, h.py)}${row('Rushing', a.ry, h.ry)}${row('Comp / Att', `${a.pc}/${a.pa}`, `${h.pc}/${h.pa}`)}${row('First downs', a.fd, h.fd)}${row('Turnovers', a.to, h.to)}${row('Sacks', a.sk, h.sk)}${row('Penalties', a.pen, h.pen)}</table>
    <div class="ld">${L1('py', s => `${s.py} yds`, 'PASSING')}${L1('ry', s => `${s.ry} yds`, 'RUSHING')}${L1('recy', s => `${s.recy} yds`, 'RECEIVING')}${L1('tk', s => `${s.tk} tk`, 'TACKLES')}</div>
    ${pg ? `<div class="pog">${typeof bustC === 'function' ? bustC(pg, 48) : ''}<div><div class="small" style="color:var(--gold);font-weight:700;letter-spacing:.06em">PLAYER OF THE GAME</div><b>${esc(pg.pos)} ${esc(pg.fn)} ${esc(pg.ln)}</b><div class="small mute">${esc(line(ps))}</div></div></div>` : ''}
    ${G.injuries.length ? `<div class="small" style="margin-top:8px;color:var(--bad)">Injuries: ${G.injuries.map(i => `${esc(pnm(i.pid))} (${esc(i.type)}, ${i.weeks} wk)`).join(', ')}</div>` : ''}
    ${gameLogs()}
    <div class="row" style="margin-top:14px"><button class="pri big on" id="mDone">Continue</button></div></div>`);
  if (typeof paintArt === 'function') { try { paintArt(el.ovl); } catch (e) { } }
  document.getElementById('mDone').onclick = () => close(G.result);
}

return { init, open, phoneMode, get _G() { return G; }, _: { processResult, describe, fieldGoal, punt, kickXP, doKickoff, nextSnap, RULES: typeof RULES !== 'undefined' ? RULES : null,
    // QA: put a flag on the current play (code from RULES.PEN; by: 'O' | 'D'), as if the officials had thrown it
    foul: (code, by) => { if (!G || !G.play) return false; const pl = G.play, tid = by === 'D' ? G.cur.def : G.cur.off, list = (by === 'D' ? pl.D : pl.O).filter(p => !p.ol || code === 'OH'), p = list[Math.floor(R() * list.length)] || pl.players[0]; const z = code === 'DPI' ? pl.losZ + 18 * YDm : p.p.z; G.fouls.push({ code, by: tid, pid: p.pid, x: p.p.x, z, spotYl: z / YDm, t: pl.liveT }); throwFlag(p.p.x, z); return true; }, ctl: () => ({ ctx: G ? ctxKey() : null, sling: Object.assign({}, sling), stick: Object.assign({}, stick), joy: Object.assign({}, joy), input: G && G.play ? Object.assign({}, G.play.input) : null }) } };
})();
