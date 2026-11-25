// ============================================================
//  REPLAYS. The recorder keeps every live play (the second before the snap through the whistle and a beat after) at 30 Hz:
//  each player's pose exactly as the renderer draws it (the same joints R3D's updateSkin reads) and the ball, packed into
//  16-bit arrays. Playback feeds those poses back through R3D.draw, so a replay looks exactly like the live play.
//  On top of it: instant replays (two or three angles, slow motion on the key moment, a REPLAY bug, pause / scrub / skip),
//  flag replays (the offender ringed with his name and what he did), the officials' call on close plays (spot, goal line,
//  sideline catch, fumble) with coach's challenges and booth reviews, and the highlight reel (halftime and after the game).
//  Memory: the last few plays and the game's best dozen, never saved. Sim drives and instant games are not recorded.
//  Hooks in src/match/10_match.js: init, frame, onWhistle, retWhistle, deadBall, endQuarter, finalCard (search RPLY).
//  Setting: localStorage 'pc_replay' = auto (replay big plays) | ask (the Replay button lights up) | off.
// ============================================================
const RPLY = (() => {
const HZ = 30, NV = 75, PRE_S = 1.4, POST_S = 1.8, KEEP_R = 4, KEEP_H = 12, HI_MIN = 16, MAXF = 1400;
const BST = { held: 0, air: 1, loose: 2, dead: 3, snap: 4 }, BSN = ['held', 'air', 'loose', 'dead', 'snap'];
let M = null, ui = null, lastG = null, home = new Set(), cur = null, recent = [], hi = [], seq = 0, seen = new WeakSet();
let rp = null, win = null, nudge = 0, force = null, btnKey = '', cardT = 0;
const g0 = () => (typeof MATCH !== 'undefined' ? MATCH._G : null);
const setting = () => { try { return localStorage.getItem('pc_replay') || 'auto'; } catch (e) { return 'auto'; } };
const FD = () => PHYS.FIELD;
const other = (g, tid) => (tid === g.hid ? g.aid : g.hid);
const abbr = (g, tid) => (g.T[tid] && g.T[tid].abbr) || '';
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const qp = v => { v = Math.round(v * 256); return v > 32767 ? 32767 : v < -32767 ? -32767 : v; };
const qd = v => Math.round(cl(v, -1, 1) * 32000);
const E0 = {}, E2 = [];
const ptsOf = J => { const a = J.arms || E2, l = J.legs || E2, s = J.sh || E2, a0 = a[0] || E0, a1 = a[1] || E0, l0 = l[0] || E0, l1 = l[1] || E0;
  return [J.pelvis, J.chest, J.neck, J.head, s[0], s[1], a0.hand, a0.elbow, a1.hand, a1.elbow, l0.hip, l0.knee, l0.ankle, l0.toe, l1.hip, l1.knee, l1.ankle, l1.toe]; };
const dirsOf = J => [J.tu, J.tuL || J.tu, J.rT, J.rH || J.rT, J.fT, J.hr, J.hu];
const nm = pid => { const p = typeof LG !== 'undefined' && LG.player ? LG.player(pid) : null; return p ? `${p.fn ? p.fn[0] + '. ' : ''}${p.ln}` : ''; };
const numName = pid => { const p = typeof LG !== 'undefined' && LG.player ? LG.player(pid) : null; return p ? `#${p.num} ${p.ln}` : ''; };

// how much presentation the game gets right now: 'full' (you are playing or watching at normal speed), 'brief' (an
// offense-only / defense-only auto drive: the biggest moments, short) or 'none' (sim drives, fast watching, instant)
function pres(g) {
  if (!g || g.sim || g.mode === 'instant' || g.stage === 'final') return 'none';
  if (g.auto) return g.auto.side && (g.speed || 1) <= 4 ? 'brief' : 'none';
  if (g.mode === 'watch') return (g.speed || 1) <= 2 ? 'full' : (g.speed || 1) <= 4 ? 'brief' : 'none';
  return 'full';
}

// ------------------------------------------------------------ setup
function init(api) {
  M = api; if (ui) return;
  const d = document.createElement('div'); d.className = 'rpui';
  d.innerHTML = `<div class="rptap"></div><div class="rpbug"><b>REPLAY</b></div><div class="rptag"><b></b></div>
    <div class="rplt"><small></small><b></b><span></span></div>
    <div class="rpbar"><button class="rpb on" data-rp="pause" aria-label="Pause">${ICO.pause}</button><input type="range" min="0" max="1000" value="0" aria-label="Scrub"><button class="rpb on" data-rp="next">Next</button><button class="rpb on" data-rp="skip">Skip</button></div>
    <div class="rpwipe"><i><b>REPLAY</b></i></div>`;
  M.el.gui.appendChild(d);
  const b = document.createElement('div'); b.className = 'rpbtns'; M.el.gui.appendChild(b);
  const w = document.createElement('div'); w.className = 'rpcall'; M.el.gui.appendChild(w);
  const k = document.createElement('div'); k.className = 'rpcard'; M.el.gui.appendChild(k);
  const f = document.createElement('div'); f.className = 'rpflag'; f.innerHTML = '<i class="rf"></i><div><small>CHALLENGE</small><b></b></div>'; M.el.gui.appendChild(f);
  ui = { root: d, tap: d.querySelector('.rptap'), bug: d.querySelector('.rpbug b'), tag: d.querySelector('.rptag'), lt: d.querySelector('.rplt'), bar: d.querySelector('.rpbar'), rng: d.querySelector('.rpbar input'),
    pz: d.querySelector('[data-rp="pause"]'), nx: d.querySelector('[data-rp="next"]'), wipe: d.querySelector('.rpwipe'), btns: b, call: w, card: k, flag: f };
  d.addEventListener('click', e => { const t = e.target.closest('[data-rp]'); if (!t || !rp) return; e.stopPropagation(); const a = t.dataset.rp; if (a === 'pause') rp.paused = !rp.paused; else if (a === 'next') nextSeg(true); else if (a === 'skip') stop(true); });
  ui.tap.addEventListener('pointerdown', e => { if (rp && !rp.opt.noTap) { e.preventDefault(); stop(true); } });
  ui.rng.addEventListener('pointerdown', () => { if (rp) rp.scrub = true; });
  ui.rng.addEventListener('input', () => { if (!rp || !rp.seg) return; rp.scrub = true; const s = rp.seg; rp.t = s.t0 + (s.t1 - s.t0) * (+ui.rng.value / 1000); rp.hold = 0; });
  const up = () => { if (rp) rp.scrub = false; }; ui.rng.addEventListener('change', up); ui.rng.addEventListener('pointerup', up);
  b.addEventListener('click', e => { const t = e.target.closest('[data-rp]'); if (!t) return; e.stopPropagation(); if (t.dataset.rp === 'replay') userReplay(); });
  w.addEventListener('click', e => { const t = e.target.closest('[data-rp]'); if (!t || !win) return; e.stopPropagation(); const a = t.dataset.rp; if (a === 'chal') closeWin('chal'); else if (a === 'playon') closeWin('play'); else if (a === 'replay') userReplay(); });
  k.addEventListener('click', () => { if (k.onDone) k.onDone(); });
  addEventListener('keydown', onKey, true);
}
const ICO = { pause: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/></svg>', play: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 5l12 7-12 7z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M5 3h1.6v18H5zM7.4 4h11l-2.6 4 2.6 4h-11z"/></svg>' };
function reset(g) {
  if (rp) { const r = rp; rp = null; try { exit(r); } catch (e) { } }
  lastG = g; cur = null; recent = []; hi = []; win = null; nudge = 0; btnKey = ''; seen = new WeakSet(); home = new Set(g && g.H && g.H.roster || []);
  if (typeof RPV !== 'undefined') RPV.clear(); if (ui) { ui.btns.innerHTML = ''; ui.call.classList.remove('show'); ui.card.classList.remove('show'); ui.flag.classList.remove('show'); }
}

// ------------------------------------------------------------ the recorder (every drawn frame, after R3D.draw)
function newClip(g, pl, kind) {
  const K = kind === 'kick' ? g.kickAnim : null, ps = pl.players.filter(p => p.rp).map(p => ({ bid: p.id, pid: p.pid != null ? p.pid : p.rp.id, rp: p.rp, unit: p.unit, ha: home.has(p.rp.id) ? 'H' : 'A' }));
  const c = { id: ++seq, kind, pl, ps, pi: new Map(ps.map((p, i) => [p.pid, i])), T: [], F: [], B: [], ev: {}, q: g.q, clock: g.clock, off: g.poss, yl0: g.yl, down0: g.down, togo0: g.togo, los: pl.losZ,
    field: kind === 'kick' ? [g.T[g.poss], g.T[other(g, g.poss)], g.H, pl.losZ, pl.losZ, true] : g.fieldArgs ? g.fieldArgs.slice() : null, view: kind === 'kick' ? 1 : (M.camView ? M.camView() : 1),
    snapT: null, endT: null, meta: null, wp0: wpSafe(g), kick: K ? { start: K.start, end: K.end, dur: K.dur, kind: K.kind } : null };
  return c;
}
function rec() {
  const g = g0(); if (!g) return; if (g !== lastG) reset(g);
  if (g.sim || rp) return;
  const pl = g.play, K = g.kickAnim && g.kickAnim.pl === pl ? g.kickAnim : null;
  if (cur && (cur.pl !== pl || (cur.kind === 'kick' && !K))) { const c = cur; cur = null; finalize(g, c); }
  if (!cur && pl && pl.players && pl.players.length && pl.poses && !seen.has(pl) && (K ? K.kind === 'fg' : g.stage !== 'kick' && g.stage !== 'load')) { seen.add(pl); cur = newClip(g, pl, K ? 'kick' : pl.ret ? 'ret' : 'scrim'); }
  if (cur && !cur.stop && cur.pl === pl) sample(g, cur, pl, K);
  buttons(g);
}
function sample(g, c, pl, K) {
  const t = K ? K.t : pl.t, ev = c.ev;
  if (!K) {
    if (c.snapT == null && pl.phase !== 'pre') c.snapT = Math.max(0, pl.t - (pl.liveT || 0) - (pl.phase === 'dead' ? pl.deadT || 0 : 0));
    if (pl.phase === 'dead' && c.endT == null) c.endT = pl.t - (pl.deadT || 0);
    if (pl.catchT != null && ev.catchT == null) { const w = pl.turnover === 'int' ? pl.carrier : pl.catcher; ev.catchT = pl.catchT; ev.catchPid = w ? w.pid : null; if (w) { ev.cx = w.p.x; ev.cz = w.p.z; } if (pl.catcher && !pl.turnover) liveCatch(g, c, pl); }
    if (pl.thrown && ev.throwT == null) ev.throwT = t;
    if (pl.ball && pl.ball.state === 'loose' && pl.fumbler && ev.fumT == null) { ev.fumT = t; ev.fumPid = pl.fumbler.pid; ev.fx = pl.fumbler.p.x; ev.fz = pl.fumbler.p.z; }
    if ((pl.bigHit || 0) > (ev.hitJ || 0) + 1) { ev.hitJ = pl.bigHit; ev.hitT = t; ev.hitPid = pl.carrier ? pl.carrier.pid : null; }
  }
  const n = c.T.length;
  if (n && t - c.T[n - 1] < 1 / HZ - 0.002) return;
  if (!K && pl.phase === 'pre' && g.stage !== 'dead') { const cut = t - PRE_S; while (c.T.length && c.T[0] < cut) { c.T.shift(); c.F.shift(); c.B.shift(); } }
  if (!K && pl.phase === 'pre' && g.stage === 'dead' && c.deadPre == null) c.deadPre = t;
  pushFrame(c, pl, t);
  if (c.T.length >= MAXF || (!K && c.endT != null && t > c.endT + POST_S) || (c.deadPre != null && t > c.deadPre + 2.4)) c.stop = true;
}
function pushFrame(c, pl, t) {
  const np = c.ps.length, A = new Int16Array(np * NV), prev = c.F.length ? c.F[c.F.length - 1] : null;
  for (let i = 0; i < np; i++) { const J = pl.poses[c.ps[i].bid], o0 = i * NV;
    if (!J) { if (prev) A.set(prev.subarray(o0, o0 + NV), o0); continue; }
    let o = o0; const P = ptsOf(J); for (let k = 0; k < 18; k++) { const v = P[k]; if (v) { A[o] = qp(v.x); A[o + 1] = qp(v.y); A[o + 2] = qp(v.z); } o += 3; }
    const D = dirsOf(J); for (let k = 0; k < 7; k++) { const v = D[k]; if (v) { A[o] = qd(v.x); A[o + 1] = qd(v.y); A[o + 2] = qd(v.z); } o += 3; } }
  const b = pl.ball, B = new Float32Array(10);
  if (b && b.p) { B[0] = b.p.x; B[1] = b.p.y; B[2] = b.p.z; if (b.axis) { B[3] = b.axis.x; B[4] = b.axis.y; B[5] = b.axis.z; } if (b.rot) { B[6] = b.rot.x % 6.2832; B[7] = b.rot.y % 6.2832; B[8] = b.rot.z % 6.2832; } B[9] = BST[b.state] != null ? BST[b.state] : 3; } else B[9] = -1;
  c.T.push(t); c.F.push(A); c.B.push(B);
}
// a catch right at the sideline: the nearest official makes his call as the receiver comes down. If he gets it wrong (he
// called a ball that was in, out) the whistle goes right there, and only a review gets the catch back.
function liveCatch(g, c, pl) {
  const w = pl.catcher, F = FD(); if (!w || pl.phase !== 'live' || g.pat || (g.fouls && g.fouls.length) || w.p.z >= F.goalZ || pres(g) === 'none') return;
  const m = F.halfW + 0.15 - Math.abs(w.p.x);                 // metres inside the line when he came down
  if (!(m >= 0 && m < 0.35)) return;
  const close = 1 - m / 0.35;
  if (R() >= 0.28 * close) { c.near = { m, close, pid: w.pid, x: w.p.x, z: w.p.z, t: pl.t }; return; }
  c.ruledOut = { m, close, pid: w.pid, x: w.p.x, z: w.p.z, t: pl.t, passer: pl.passer ? pl.passer.pid : null };
  pl.endPlay('inc', 'Ruled out of bounds', null, pl.losZ);
}
function finalize(g, c) {
  c.pl = null; if (c.T.length < 6) return;
  if (c.kind === 'kick' && !c.meta) kickMeta(g, c);
  if (!c.meta) c.meta = { desc: '', big: 0, keyT: c.endT != null ? c.endT : c.T[c.T.length - 1], keyPid: null, res: null };
  c.wp1 = wpSafe(g); c.score = [g.score[g.aid], g.score[g.hid]];
  if (c.kind === 'kick' && c.meta.good) c.score[c.off === g.hid ? 1 : 0] += 3;      // (the kick clip closes before the points go up)
  c.imp = importance(c); c.bytes = c.T.length * (c.ps.length * NV * 2 + 48);
  recent.push(c); while (recent.length > KEEP_R) recent.shift();
  if (c.imp >= HI_MIN && c.meta.desc) { hi.push(c); hi.sort((a, b) => b.imp - a.imp); if (hi.length > KEEP_H) hi.length = KEEP_H; }
  if (c.kind === 'kick' && c.meta.big) autoAfter(g, c, []);
}
function kickMeta(g, c) {
  const k = c.kick, F = FD(), posts = F.goalZ + 10 * YD, good = k.end.z > posts && Math.abs(k.end.x) < 2.9 && k.end.y > 3.05, dist = Math.round(100 - c.yl0 + 17), late = c.q >= 4 && g.clock < 40 && Math.abs(g.score[g.hid] - g.score[g.aid]) <= 3;
  c.meta = { desc: `${dist}-yard field goal ${good ? 'is good' : 'no good'}`, good, dist, big: good && (dist >= 45 || late) ? (late ? 2 : 1) : 0, keyT: k.dur, keyPid: null, res: null };
}
// how much a play belongs in the highlights: the win-probability swing when the broadcast has one (wpNow), else points,
// turnovers, yards and the hit, worth more late in a close game
function importance(c) {
  const m = c.meta || {}, r = m.res || {}; let v = 0;
  if (c.kind === 'kick') v = m.good ? 12 + Math.max(0, m.dist - 35) * 1.3 + (m.big >= 2 ? 30 : 0) : 0;
  else { if (r.td) v += 60; if (r.turnover) v += 48 + (r.defTD ? 20 : 0); if (r.safety) v += 40; const y = r.yards || 0; if (y >= 12) v += y * 1.1; if (r.sack) v += 14; if ((c.ev.hitJ || 0) > 800) v += 8; if (c.kind === 'ret' && (m.retY || 0) >= 25) v += m.retY * 0.8; if (m.review === 'overturned') v += 10; }
  const sd = c.score ? Math.abs(c.score[0] - c.score[1]) : 0; if (c.q >= 4 && sd <= 8) v *= 1.35; if (c.q >= 5) v *= 1.5;
  if (c.wp0 != null && c.wp1 != null) v = Math.max(v * 0.5, Math.abs(c.wp1 - c.wp0) * 220);
  return v;
}
function wpSafe(g) {
  try { const f = typeof wpNow === 'function' ? wpNow : typeof MATCH !== 'undefined' && typeof MATCH.wpNow === 'function' ? MATCH.wpNow : null; if (!f) return null;
    const v = f(g), h = typeof v === 'number' ? v : v && typeof v === 'object' ? (v.home != null ? v.home : v.h != null ? v.h : v.wp) : null; return typeof h === 'number' && isFinite(h) ? h : null; } catch (e) { return null; }
}
const lastClip = () => (cur && cur.endT != null && cur.T.length > 6 ? cur : recent[recent.length - 1] || null);
function mem() { const s = new Set(recent.concat(hi)); if (cur) s.add(cur); let b = 0, n = 0; for (const c of s) { b += c.bytes || c.T.length * (c.ps.length * NV * 2 + 48); n++; } return { clips: n, bytes: b, recent: recent.length, hi: hi.length }; }

// ------------------------------------------------------------ playback
// a replay = a list of items (one per play), each a list of segments: { cam, t0, t1 (clip time), rate, slow:[a,b,k],
// hold (s frozen at the end), pid (who the tight camera follows), ring:{pid,col}, tag:{pid,txt}, flagAt:{t,x,z}, marks(), lt }
function play(items, opt, done) {
  const g = g0(); items = (items || []).filter(it => it && it.c && it.c.T.length > 4 && it.segs && it.segs.length);
  if (!g || rp || !items.length || !M) { if (done) done(true); return false; }
  const q = []; for (const it of items) for (const s of it.segs) { clampSeg(it.c, s); q.push({ it, s }); }
  rp = { g, q, qi: -1, opt: opt || {}, done, t: 0, hold: 0, paused: false, scrub: false, cut: 0.28, pend: 0, prevCam: R3D.camOverride || null, entered: false, cam: null, reflag: opt && opt.reflag || null };
  g.rp = true; win && ui.call.classList.add('dim'); stinger(rp.opt.wipe || 'REPLAY'); return true;
}
function clampSeg(c, s) { const a = c.T[0], b = c.T[c.T.length - 1]; s.t0 = cl(s.t0, a, b); s.t1 = cl(s.t1, s.t0, b); }
function frame(dt) {
  const g = g0();
  if (win && (!g || g.sim || win.g !== g)) closeWin('play');
  const r = rp; if (!r) return false;
  if (!g || g !== r.g) { rp = null; return false; }
  if (g.sim) { stop(true); return false; }
  if (r.cut > 0) { r.cut -= dt; if (r.cut > 0) return true; applySeg(); if (!rp) return false; }
  if (!g.paused && !r.paused && !r.scrub) advance(dt);
  if (rp !== r) return true;
  draw(dt, g);
  return true;
}
function nextSeg(user) {
  const r = rp; if (!r) return; const e = r.q[r.qi + 1];
  if (!e) return stop(!!user);
  if (r.qi >= 0 && e.it !== r.q[r.qi].it) { r.cut = 0.28; r.pend = 1; stinger(r.opt.wipe || 'REPLAY'); return; }     // a new play: wipe across first
  applySeg();
}
function applySeg() {
  const r = rp; r.qi++; const e = r.q[r.qi]; if (!e) return stop(false);
  const c = e.it.c, s = e.s; if (!r.entered || r.c !== c) enter(c);
  r.seg = s; r.t = s.t0; r.hold = 0; r.snapCam = true; s.flagDone = false;
  RPV.clear(); if (s.flagAt) R3D.flag(null); if (s.marks) { try { s.marks(); } catch (err) { console.error(err); } }
  ui.root.classList.add('show'); ui.root.classList.toggle('notap', !!r.opt.noTap); ui.bug.textContent = s.bug || r.opt.bug || 'REPLAY';
  const lt = s.lt || e.it.lt; ui.lt.classList.toggle('show', !!lt);
  if (lt) { ui.lt.querySelector('small').textContent = lt.k || ''; ui.lt.querySelector('b').textContent = lt.b || ''; ui.lt.querySelector('span').textContent = lt.s || ''; ui.lt.classList.toggle('flag', !!lt.flag); }
  ui.tag.classList.remove('show'); ui.nx.textContent = r.q[r.qi + 1] ? (r.q[r.qi + 1].it !== e.it ? 'Next play' : 'Next angle') : 'Done';
  if (e.it.onStart && r.q.findIndex(x => x.it === e.it) === r.qi) e.it.onStart();
}
const ramp = (s, t) => { const base = s.rate || 1; if (!s.slow) return base; const [a, b, k] = s.slow, w = 0.25; if (t <= a - w || t >= b + w) return base; if (t >= a && t <= b) return k; return t < a ? base + (k - base) * (t - (a - w)) / w : k + (base - k) * (t - b) / w; };
function advance(dt) {
  const r = rp, s = r.seg; if (!s) return;
  if (r.hold > 0) { r.hold -= dt; if (r.hold <= 0) nextSeg(); return; }
  r.t += dt * ramp(s, r.t);
  if (s.flagAt && !s.flagDone && r.t >= s.flagAt.t) { s.flagDone = true; R3D.flag({ x: s.flagAt.x, z: s.flagAt.z }); }
  if (r.t >= s.t1) { r.t = s.t1; if (s.hold) r.hold = s.hold; else nextSeg(); }
}
function stop(aborted) {
  const r = rp; if (!r) return; rp = null; if (r.g) r.g.rp = false;
  try { exit(r); } catch (e) { console.error(e); }
  const d = r.done; r.done = null; if (d) { try { d(aborted); } catch (e) { console.error(e); } }
}
function enter(c) {
  const r = rp, g = r.g;
  if (!r.entered) { r.entered = true; R3D.noDirt = true; R3D.overlay(null); if (R3D.aim) R3D.aim(null); M.el.game.classList.add('rpOn'); }
  r.c = c; r.fake = fakeOf(c); R3D.setPlayers(r.fake, u => (u === 'H' ? g.H : g.A), u => g.kits[u === 'H' ? g.hid : g.aid] || {});
  if (c.field) R3D.setField(...c.field, c.view); R3D.flag(null);
}
function exit(r) {
  const g = r.g; RPV.clear(); R3D.camOverride = r.prevCam || null; R3D.noDirt = false;
  if (M && M.el.game) M.el.game.classList.remove('rpOn', 'rpOvl');
  if (ui) { ui.root.classList.remove('show'); ui.lt.classList.remove('show'); ui.tag.classList.remove('show'); ui.call.classList.remove('dim'); }
  if (r.entered && g && g === g0()) {
    const pl = g.play; if (pl && pl.players) R3D.setPlayers({ players: pl.players.filter(p => p.rp).map(p => ({ rp: p.rp, unit: home.has(p.rp.id) ? 'H' : 'A' })) }, u => (u === 'H' ? g.H : g.A), u => g.kits[u === 'H' ? g.hid : g.aid] || {});
    if (g.stage === 'kick' && pl && pl.losZ != null) R3D.setField(g.T[g.poss], g.T[other(g, g.poss)], g.H, pl.losZ, pl.losZ, true, 1); else if (g.fieldArgs) R3D.setField(...g.fieldArgs, M.camView ? M.camView() : 1);
    R3D.flag(null); for (const f of r.reflag || []) R3D.flag(f); R3D.snapNext = true;
    stinger(null);
  }
}
function fakeOf(c) {
  const NOPE = () => false, players = c.ps.map((p, i) => ({ id: i, rp: p.rp, unit: p.ha, pid: p.pid, p: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, feet: [], upright: NOPE })), poses = {}, tg = [];
  const P3 = () => ({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < players.length; i++) { const J = { pelvis: P3(), chest: P3(), neck: P3(), head: P3(), sh: [P3(), P3()], arms: [{ hand: P3(), elbow: P3() }, { hand: P3(), elbow: P3() }], legs: [{ hip: P3(), knee: P3(), ankle: P3(), toe: P3() }, { hip: P3(), knee: P3(), ankle: P3(), toe: P3() }], tu: P3(), tuL: P3(), rT: P3(), rH: P3(), fT: P3(), hr: P3(), hu: P3() };
    poses[i] = J; tg.push({ P: ptsOf(J), D: dirsOf(J) }); }
  return { players, poses, tg, fx: [], O: [], D: [], receivers: [], phase: 'live', carrier: null, qb: null, pass: false, thrown: false, losZ: c.los, ballX: 0, ret: null, ball: { state: 'dead', p: P3(), axis: { x: 0, y: 0, z: 1 }, rot: P3() }, updatePoses() {}, controlled() { return null; } };
}
// frame k and the blend a for clip time t
function at(c, t) { const T = c.T, n = T.length; if (t <= T[0]) return [0, 0]; if (t >= T[n - 1]) return [n - 2 < 0 ? 0 : n - 2, 1]; let lo = 0, hi2 = n - 1; while (hi2 - lo > 1) { const m = (lo + hi2) >> 1; if (T[m] <= t) lo = m; else hi2 = m; } return [lo, (t - T[lo]) / Math.max(1e-6, T[lo + 1] - T[lo])]; }
function poseAt(c, t, f) {
  const [k, a] = at(c, t), A = c.F[k], B = c.F[Math.min(k + 1, c.F.length - 1)], b = 1 - a;
  for (let i = 0; i < f.players.length; i++) { const o0 = i * NV, tg = f.tg[i]; let o = o0;
    for (let j = 0; j < 18; j++) { const v = tg.P[j]; v.x = (A[o] * b + B[o] * a) / 256; v.y = (A[o + 1] * b + B[o + 1] * a) / 256; v.z = (A[o + 2] * b + B[o + 2] * a) / 256; o += 3; }
    for (let j = 0; j < 7; j++) { const v = tg.D[j]; let x = A[o] * b + B[o] * a, y = A[o + 1] * b + B[o + 1] * a, z = A[o + 2] * b + B[o + 2] * a; const L = Math.hypot(x, y, z) || 1; v.x = x / L; v.y = y / L; v.z = z / L; o += 3; }
    const p = f.players[i]; p.p.x = tg.P[0].x; p.p.z = tg.P[0].z; }
  const BA = c.B[k], BB = c.B[Math.min(k + 1, c.B.length - 1)], ball = f.ball, near = a < 0.5 ? BA : BB;
  if (near[9] < 0) { ball.p.y = -50; ball.state = 'dead'; return; }
  ball.p.x = BA[0] * b + BB[0] * a; ball.p.y = BA[1] * b + BB[1] * a; ball.p.z = BA[2] * b + BB[2] * a;
  const ax = BA[3] * b + BB[3] * a, ay = BA[4] * b + BB[4] * a, az = BA[5] * b + BB[5] * a, L = Math.hypot(ax, ay, az); if (L > 1e-3) { ball.axis.x = ax / L; ball.axis.y = ay / L; ball.axis.z = az / L; }
  ball.state = BSN[near[9]] || 'dead'; ball.rot.x = near[6]; ball.rot.y = near[7]; ball.rot.z = ball.state === 'air' ? t * 24 : near[8];
}
// one player's pelvis at clip time t straight from the arrays (cameras, rings, name tags)
function pelAt(c, pid, t) { const i = c.pi.get(pid); if (i == null) return null; const [k, a] = at(c, t), A = c.F[k], B = c.F[Math.min(k + 1, c.F.length - 1)], o = i * NV, b = 1 - a; return { x: (A[o] * b + B[o] * a) / 256, y: (A[o + 1] * b + B[o + 1] * a) / 256, z: (A[o + 2] * b + B[o + 2] * a) / 256 }; }
function ballAt(c, t) { const [k, a] = at(c, t), A = c.B[k], B = c.B[Math.min(k + 1, c.B.length - 1)], b = 1 - a; return { x: A[0] * b + B[0] * a, y: A[1] * b + B[1] * a, z: A[2] * b + B[2] * a }; }
function velAt(c, pid, t) { const p0 = pelAt(c, pid, t - 0.15), p1 = pelAt(c, pid, t + 0.15); return p0 && p1 ? { x: (p1.x - p0.x) / 0.3, z: (p1.z - p0.z) / 0.3 } : { x: 0, z: 0 }; }
function draw(dt, g) {
  const r = rp, c = r.c, s = r.seg; if (!c || !s) return;
  poseAt(c, r.t, r.fake);
  const still = g.paused || r.paused || r.scrub || r.hold > 0, ft = still ? 0 : dt * ramp(s, r.t);
  camera(r, s, dt);
  if (s.ring) { const p = pelAt(c, s.ring.pid, r.t); if (p) RPV.ring(p.x, p.z, s.ring.col, dt); }
  R3D.draw(r.fake, ft, { camMode: 'O' });
  if (s.tag) { const p = pelAt(c, s.tag.pid, r.t), q = p && R3D.project(p.x, 2.35, p.z); if (q && !q.behind) { ui.tag.style.transform = `translate(${Math.round(q.x)}px,${Math.round(q.y)}px) translate(-50%,-100%)`; ui.tag.querySelector('b').textContent = s.tag.txt; ui.tag.classList.add('show'); } else ui.tag.classList.remove('show'); }
  if (!r.scrub) ui.rng.value = String(Math.round(1000 * (r.t - s.t0) / Math.max(0.01, s.t1 - s.t0)));
  const pz = r.paused ? 'p' : 'r'; if (ui.pz.dataset.st !== pz) { ui.pz.dataset.st = pz; ui.pz.innerHTML = r.paused ? ICO.play : ICO.pause; }
}
// the angles: side (high sideline, the TV game camera), end (end zone, telephoto), tight (low, beside the key player),
// sky (high behind the play), kick / posts (field goals), rev (a fixed review angle along the line in question), flag
function camera(r, s, dt) {
  const c = r.c, t = r.t, F = FD(), gw = M.el.game.clientWidth || innerWidth, gh = M.el.game.clientHeight || innerHeight, asp = Math.max(0.3, gw / Math.max(1, gh)), port = asp < 1;
  const b = r.fake.ball.p.y > -10 ? r.fake.ball.p : { x: 0, y: 0, z: c.los }, foc = s.pid != null ? pelAt(c, s.pid, t) : null;
  let pos, look, hf;
  if (s.cam === 'rev') { pos = s.pos; look = s.look; hf = port ? s.hf * 1.3 : s.hf; }
  else if (s.cam === 'end') { const dir = s.dir || 1, ze = dir > 0 ? F.goalZ + 22 : -22, d = Math.max(14, Math.abs(ze - b.z)); pos = [b.x * 0.2, 8 + d * 0.1, ze]; look = [b.x * 0.85, 0.9, b.z]; hf = cl(2 * Math.atan(15 / d) * 57.3, 13, 55) * (port ? 1.45 : 1); }
  else if (s.cam === 'tight' || s.cam === 'flag') {
    const p = foc || b, v = s.pid != null ? velAt(c, s.pid, t) : { x: 0, z: 0 }, sp = Math.hypot(v.x, v.z); let dx = r.dirX, dz = r.dirZ;
    if (sp > 1.2 || dx == null) { dx = sp > 0.3 ? v.x / sp : 0; dz = sp > 0.3 ? v.z / sp : 1; } r.dirX = dx; r.dirZ = dz;
    let px = -dz, pz = dx; if (px > 0.01 || (Math.abs(px) <= 0.01 && pz > 0)) { px = -px; pz = -pz; }
    if (s.cam === 'flag') { const D = port ? 11 : 9; pos = [p.x + px * D - dx * 4, 4.4, p.z + pz * D - dz * 4]; look = [p.x, 0.9, p.z]; hf = port ? 50 : 40; }
    else { const D = port ? 8.5 : 7.2, ld = Math.min(2.6, sp * 0.35); pos = [p.x + px * D + dx * ld, 2.3, p.z + pz * D + dz * ld]; look = [p.x + dx * 1.1, 1.0, p.z + dz * 1.1]; hf = port ? 44 : 32; }
  }
  else if (s.cam === 'sky') { pos = [b.x * 0.6, 34, b.z - 20]; look = [b.x * 0.8, 0, b.z + 4]; hf = port ? 70 : 58; }
  else if (s.cam === 'kick') { const k = c.kick; pos = [k.start.x * 0.7, 3.4, k.start.z - 8]; look = [k.end.x * 0.3, 3.5, F.goalZ + 10 * YD]; hf = port ? 62 : 50; }
  else if (s.cam === 'posts') { pos = [0, 6.5, F.goalZ + 10 * YD + 24]; look = [b.x, Math.max(1, b.y), b.z]; hf = port ? 42 : 30; }
  else { pos = [-(F.halfW + 32), 17, b.z - 5]; look = [b.x * 0.45, 0.6, b.z + 1]; hf = port ? 48 : 34; }      // side
  const fov = cl(2 * Math.atan(Math.tan(hf * Math.PI / 360) / asp) * 180 / Math.PI, 8, 82);
  if (!r.cam || r.snapCam) { r.cam = { pos: pos.slice(), look: look.slice() }; r.snapCam = false; }
  else { const k1 = 1 - Math.exp(-dt * (s.cam === 'rev' ? 30 : 5)), k2 = 1 - Math.exp(-dt * (s.cam === 'rev' ? 30 : 7)); for (let i = 0; i < 3; i++) { r.cam.pos[i] += (pos[i] - r.cam.pos[i]) * k1; r.cam.look[i] += (look[i] - r.cam.look[i]) * k2; } }
  R3D.camOverride = { pos: r.cam.pos.slice(), look: r.cam.look.slice(), fov };
}
// the broadcast wipe between the live picture and a replay (and between plays in the reel)
function stinger(txt) {
  if (!ui) return; const w = ui.wipe; w.querySelector('b').textContent = txt || ''; w.classList.toggle('out', !txt);
  w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
}

// ------------------------------------------------------------ the plans
function keyOf(c, r) {
  const ev = c.ev, e = c.endT != null ? c.endT : c.T[c.T.length - 1];
  if (!r) return { t: e - 0.4, pid: null };
  if (c.kind === 'ret') return { t: r.type === 'fumbleLost' && ev.fumT != null ? ev.fumT : e - 1.2, pid: r.type === 'fumbleLost' ? ev.fumPid : r.carrier };
  if (r.turnover === 'int') return { t: ev.catchT != null ? ev.catchT + 0.2 : e - 1, pid: r.carrier };
  if (r.type === 'fumbleLost' || (r.turnover === 'fumble')) return { t: ev.fumT != null ? ev.fumT : e - 0.4, pid: ev.fumPid != null ? ev.fumPid : r.fumbler };
  if (r.sack) return { t: ev.hitT != null && ev.hitT <= e ? ev.hitT : e - 0.3, pid: (r.tacklers && r.tacklers[0]) != null ? r.tacklers[0] : r.carrier };
  if (r.catcher != null && r.carrier === r.catcher && ev.catchT != null) return { t: r.td && e - ev.catchT < 1.2 ? ev.catchT : r.td ? e - 0.6 : ev.catchT + 0.5, pid: r.catcher };
  if ((ev.hitJ || 0) > 800 && ev.hitT != null && !r.td) return { t: ev.hitT, pid: ev.hitPid };
  return { t: e - (r.td ? 0.5 : 0.6), pid: r.carrier };
}
function planOf(c, style) {
  const m = c.meta || {}, ks = m.keyT != null ? m.keyT : c.T[c.T.length - 1], pid = m.keyPid, s0 = c.snapT != null ? c.snapT : c.T[0], e0 = c.endT != null ? c.endT : c.T[c.T.length - 1];
  if (c.kind === 'kick') { const d = c.kick.dur; return style === 'brief' ? [{ cam: 'posts', t0: d * 0.3, t1: d, slow: [d * 0.6, d, 0.55] }] : [{ cam: 'kick', t0: 0, t1: d }, { cam: 'posts', t0: d * 0.3, t1: d, slow: [d * 0.6, d, 0.45], hold: 0.4 }]; }
  const ba = ballAt(c, Math.min(e0, ks + 1)), bk = ballAt(c, ks - 0.6), dir = ba.z < bk.z - 1 ? -1 : 1, run = !(c.ev.throwT != null);
  const tight = { cam: 'tight', t0: ks - 1.8, t1: ks + 1.1, slow: [ks - 0.7, ks + 0.5, 0.35], pid };
  if (style === 'brief') return [{ cam: 'tight', t0: ks - 1.5, t1: ks + 0.8, slow: [ks - 0.5, ks + 0.4, 0.55], pid }];
  const main = { cam: (run || dir < 0) && style !== 'full3' ? 'end' : 'side', t0: s0 - 0.45, t1: e0 + 0.5, dir };
  if (style === 'full3') return [main, { cam: 'end', t0: Math.max(s0 - 0.2, ks - 3.2), t1: ks + 1.0, rate: 0.75, dir }, tight];
  return [main, tight];
}
function reelSegs(c, top) {
  const m = c.meta || {}, ks = m.keyT != null ? m.keyT : c.T[c.T.length - 1], s0 = c.snapT != null ? c.snapT : c.T[0], e0 = c.endT != null ? c.endT : c.T[c.T.length - 1];
  if (c.kind === 'kick') return planOf(c, top ? 'full' : 'brief');
  const run = c.ev.throwT == null, ba = ballAt(c, e0), bk = ballAt(c, ks - 0.6), dir = ba.z < bk.z - 1 ? -1 : 1;
  const segs = [{ cam: run || dir < 0 ? 'end' : 'side', t0: Math.max(s0 - 0.3, ks - 5.5), t1: Math.min(e0 + 0.4, ks + 3), dir }];
  if (top) segs.push({ cam: 'tight', t0: ks - 1.4, t1: ks + 0.9, slow: [ks - 0.5, ks + 0.4, 0.4], pid: m.keyPid });
  return segs;
}
function ltOf(c, k) { const m = c.meta || {}, g = g0(); return { k: k || `${M.qTxt(c.q)} ${M.clockTxt(c.clock)}${c.score && g ? ` · ${abbr(g, g.aid)} ${c.score[0]} – ${abbr(g, g.hid)} ${c.score[1]}` : ''}`, b: m.desc || '', s: '' }; }
function playPlan(c, style, done) { return play([{ c, segs: planOf(c, style), lt: style === 'brief' ? null : ltOf(c, 'REPLAY') }], { wipe: 'REPLAY' }, done); }
function flagItem(c, f) {
  const P0 = (typeof RULES !== 'undefined' && RULES.PEN[f.code]) || { n: 'Penalty' }, pre = !f.t || f.pre, at0 = f.at || (c.snapT || c.T[c.T.length - 1]), who = numName(f.pid);
  const seg = { cam: pre ? 'rev' : 'flag', t0: at0 - (pre ? 1.1 : 1.9), t1: at0 + (pre ? 0.9 : 1.1), slow: [at0 - (pre ? 0.25 : 0.6), at0 + 0.6, 0.35], hold: 0.8, pid: f.pid, ring: { pid: f.pid, col: 0xffd21a }, tag: who ? { pid: f.pid, txt: who } : null, flagAt: { t: at0 + (pre ? 0.4 : 0.15), x: f.x, z: f.z },
    lt: { k: 'FLAG', b: P0.n, s: f.what || '', flag: true }, bug: 'REPLAY' };
  if (pre) { const F = FD(), p = pelAt(c, f.pid, at0) || { x: f.x || 0, z: c.los }; seg.pos = [-(F.halfW + 5), 1.9, c.los + (f.by === c.off ? -1.5 : 1.5)]; seg.look = [p.x, 0.75, c.los]; seg.hf = 30; }
  return { c, segs: [seg] };
}

// ------------------------------------------------------------ the officials' call on close plays
// Every call has two outcomes: what really happened (A, the engine's truth) and the other one (B). The official on the field
// gets it wrong now and then, more often the closer it was; a review always finds the truth (the recording).
const yardsOf = (z, los) => (z - los) / YD;
function stAdd(st, list) { const o = Object.assign({}, st || {}); for (const [pid, k, v] of list) { if (pid == null || !v) continue; const s = o[pid] = Object.assign({}, o[pid] || {}); s[k] = Math.max(0, (s[k] || 0) + v); } return o; }
const tdCredit = (r, sg) => (r.catcher != null && r.carrier === r.catcher ? [[r.passer, 'ptd', sg], [r.catcher, 'rectd', sg]] : [[r.carrier, 'rtd', sg]]);
function judgeCall(g, pl, res, c) {
  if (!res || g.pat || (g.fouls && g.fouls.length) || pl.ret || pres(g) === 'none') return null;
  const F = FD(), los = pl.losZ, off = g.poss, def = other(g, off), fz = force, e = c.endT != null ? c.endT : pl.t;
  const mk = (kind, close, wrong, A, B, aFavO, tA, tB, view, qn) => { const ruled = wrong ? B : A, rFavO = wrong ? !aFavO : aFavO; return { kind, close, wrong, truth: A, other: B, ruled, aFavO, hurts: rFavO ? def : off, tA, tB, rTxt: wrong ? tB : tA, view, q: qn }; };
  const k = pl.carrier;
  // a sideline catch the official called out (the whistle blew at the catch): truth = a catch, spotted where he went out
  if (c.ruledOut) {
    const o = c.ruledOut, y = Math.round(yardsOf(o.z, los)), A = Object.assign({}, res, { type: 'oob', td: false, spotZ: o.z, yards: yardsOf(o.z, los), clockStop: true, carrier: o.pid, catcher: o.pid, unit: 'O', text: 'Caught at the sideline', stats: stAdd(res.stats, [[o.passer, 'py', y], [o.pid, 'recy', y]]) });
    const B = Object.assign({}, res, { catcher: null, text: 'Ruled out of bounds', stats: stAdd(res.stats, [[o.passer, 'pc', -1], [o.pid, 'rec', -1]]) });
    return mk('side', o.close, true, A, B, true, 'Complete: both feet in bounds', 'Incomplete: out of bounds', { t: o.t, x: o.x, z: o.z, pid: o.pid }, 'Did he get both feet in?');
  }
  // caught out of bounds by a few inches: the official might give him the catch
  if (res.type === 'inc' && res.text === 'Caught out of bounds') {
    let w = null, bd = 9; const bp = pl.ball && pl.ball.p; if (bp) for (const p of pl.players) if (p.unit === 'O') { const d = Math.hypot(p.p.x - bp.x, p.p.z - bp.z); if (d < bd) { bd = d; w = p; } }
    const m = w ? Math.abs(w.p.x) - (F.halfW + 0.15) : 9;
    if (w && m < 0.3) { const close = 1 - Math.max(0, m) / 0.3, wrong = R() < 0.28 * close, td = w.p.z >= F.goalZ, z = td ? F.goalZ : w.p.z, y = Math.round(yardsOf(z, los));
      const B = Object.assign({}, res, { type: td ? 'td' : 'oob', td, spotZ: z, yards: yardsOf(z, los), clockStop: true, carrier: w.pid, catcher: w.pid, unit: 'O', text: 'Caught at the sideline', stats: stAdd(res.stats, [[res.passer, 'pc', 1], [w.pid, 'rec', 1], [res.passer, 'py', y], [w.pid, 'recy', y]].concat(td ? [[res.passer, 'ptd', 1], [w.pid, 'rectd', 1]] : [])) });
      return mk('side', close, wrong, res, B, false, 'Incomplete: out of bounds', td ? 'Touchdown catch' : 'Complete at the sideline', { t: e, x: w.p.x, z: w.p.z, pid: w.pid }, 'Did he get both feet in?'); }
  }
  // the near miss the other way: in by inches and called in (the defense might throw the flag; it can only stand)
  if (c.near && res.catcher === c.near.pid && !res.turnover) { const o = c.near; return mk('side', o.close, false, res, null, true, 'Complete: both feet in bounds', 'Incomplete', { t: o.t, x: o.x, z: o.z, pid: o.pid }, 'Did he get both feet in?'); }
  // the goal line: did the ball break the plane?
  if (k && k.unit === 'O' && !res.turnover && res.type !== 'inc') {
    if (res.td && res.type === 'td' && res.text === 'Touchdown') {
      const contact = pl.wrapCount > 0 || k.bal !== 'up' || (pl.contactT != null && pl.t - pl.contactT < 1.2), pylon = Math.abs(k.p.x) > F.halfW - 1.0, fg = fz && fz.kind === 'goal';
      if (contact || pylon || fg) { const close = fg ? 0.85 : contact ? 0.75 : 0.6, wrong = fg ? fz.wrong !== false : R() < 0.22 * close, sz = F.goalZ - (0.12 + R() * 0.25) * YD;
        const B = Object.assign({}, res, { type: pylon ? 'oob' : 'tackle', td: false, spotZ: sz, yards: yardsOf(sz, los), clockStop: pylon, text: pylon ? 'Out at the 1' : 'Down short of the goal line', stats: stAdd(res.stats, tdCredit(res, -1)) });
        return mk('goal', close, wrong, res, B, true, 'Touchdown', 'Short of the goal line', { t: e, x: k.p.x, z: F.goalZ, sz: res.spotZ, pid: k.pid, pylon }, 'Did the ball cross the goal line?'); }
    } else if (!res.td && !res.safety && ['tackle', 'down', 'oob'].includes(res.type) && (res.spotZ >= F.goalZ - 0.8 * YD || (fz && fz.kind === 'goal' && res.spotZ >= F.goalZ - 3 * YD))) {
      const m = (F.goalZ - res.spotZ) / YD, fg = fz && fz.kind === 'goal', close = fg ? 0.85 : 1 - m / 0.8, wrong = fg ? fz.wrong !== false : R() < 0.3 * close;
      const B = Object.assign({}, res, { type: 'td', td: true, spotZ: F.goalZ, yards: yardsOf(F.goalZ, los), clockStop: true, text: 'Touchdown', stats: stAdd(res.stats, tdCredit(res, 1)) });
      return mk('goal', close, wrong, res, B, false, 'Short of the goal line', 'Touchdown', { t: e, x: k.p.x, z: F.goalZ, sz: res.spotZ, pid: k.pid }, 'Did the ball cross the goal line?');
    }
  }
  // the spot: first down or not (QA: force = {kind:'spot', made, wrong} moves the line to gain next to the spot)
  if (!res.td && !res.turnover && !res.safety && ['tackle', 'down', 'oob', 'sack'].includes(res.type) && g.yl + g.togo < 99.5) {
    const s = res.spotZ / YD; if (fz && fz.kind === 'spot') g.togo = cl(s - (fz.made === false ? -0.14 : 0.14) - g.yl, 0.3, 40);
    const lg = g.yl + g.togo, m = s - lg;
    if (Math.abs(m) < 0.6 && lg < 99.5) { const fs = fz && fz.kind === 'spot', close = fs ? 0.78 : 1 - Math.abs(m) / 0.6, wrong = fs ? fz.wrong !== false : R() < 0.3 * close, os = lg - Math.sign(m || 1) * (0.05 + R() * 0.16);
      const B = Object.assign({}, res, { spotZ: os * YD, yards: yardsOf(os * YD, los) }), bx = ballAt(c, e).x;
      return mk('spot', close, wrong, res, B, m >= 0, m >= 0 ? 'First down' : 'Short of the line to gain', m >= 0 ? 'Short of the line to gain' : 'First down', { t: e, x: bx, z: lg * YD, sz: res.spotZ, pid: res.carrier }, 'Did he get the first down?'); }
  }
  // fumble or down by contact: was his knee down before the ball came out?
  if (res.type === 'fumbleLost' && !pl.stripSack && c.ev.fumT != null) {
    const i = c.pi.get(c.ev.fumPid), dn = i == null ? null : downAfter(c, i, c.ev.fumT);
    if (dn != null && dn >= 0 && dn < 0.3) { const close = 1 - dn / 0.3, wrong = R() < 0.32 * close, ff = Object.keys(res.stats || {}).find(p => res.stats[p] && res.stats[p].ff > 0), fzz = c.ev.fz;
      const B = Object.assign({}, res, { type: 'tackle', turnover: null, td: false, defTD: false, recPid: null, carrier: c.ev.fumPid, unit: 'O', spotZ: fzz, yards: yardsOf(fzz, los), clockStop: false, text: 'Down by contact', stats: stAdd(res.stats, [[c.ev.fumPid, 'fum', -1], [ff != null ? +ff : null, 'ff', -1]]) });
      return mk('fumble', close, wrong, res, B, false, 'Fumble: the ball came out first', 'Down by contact', { t: c.ev.fumT, x: c.ev.fx, z: fzz, pid: c.ev.fumPid, dn }, 'Was he down before the ball came out?'); }
  }
  return null;
}
// seconds from the ball coming out until his knee (or his body) hits the turf, from the recorded poses
function downAfter(c, i, t0) { const o = i * NV; for (let k = 0; k < c.T.length; k++) { const t = c.T[k]; if (t < t0 - 0.05) continue; if (t > t0 + 0.6) break; const A = c.F[k], knee = Math.min(A[o + 11 * 3 + 1], A[o + 15 * 3 + 1]) / 256, chest = A[o + 3 + 1] / 256; if (knee < 0.17 || chest < 0.72) return t - t0; } return null; }

// ------------------------------------------------------------ challenges and reviews
function chal(g, tid) { const C = g.rpc || (g.rpc = {}); return C[tid] || (C[tid] = { left: 2, used: 0, won: 0, bonus: false }); }
const lateOf = (g, res) => g.q >= 5 || ((g.q === 2 || g.q === 4) && g.clock - ((res && res.t) || 0) <= g.WARN);
function canChal(g, tid, res) { const ch = chal(g, tid); return ch.left > 0 && (g.to[tid] || 0) > 0 && !lateOf(g, res); }
function resolve(g, c, C, done) {
  const sc = C.ruled.td || C.ruled.turnover || C.ruled.safety;
  if (sc) { if (C.wrong || (C.close > 0.45 && R() < 0.55)) return booth(g, c, C, done); return done(C.ruled); }   // every score and turnover is looked at upstairs
  if (lateOf(g, C.ruled)) { if (C.wrong ? R() < 0.92 : R() < 0.35 * C.close) return booth(g, c, C, done); return done(C.ruled); }
  const t = C.hurts, uPlay = g.mode === 'play' && !g.auto && t === g.user;
  if (uPlay) { if (canChal(g, t, C.ruled) && pres(g) === 'full') return offer(g, c, C, done); return done(C.ruled); }
  if (canChal(g, t, C.ruled) && cpuWants(g, C)) return challenge(g, c, C, done, t);
  done(C.ruled);
}
// the CPU's booth upstairs sees most of it: it throws the flag when it thinks the call was wrong (and rarely on a hunch)
function cpuWants(g, C) { const read = R() < 0.74 ? C.wrong : !C.wrong, lev = g.down >= 3 || C.kind === 'goal' || C.kind === 'fumble' ? 1 : 0.6; return R() < (read ? 0.72 * lev : 0.04); }
function perk() { try { return !!(typeof LG !== 'undefined' && LG.coachPerk && LG.coachPerk('str4')); } catch (e) { return false; } }
// your call: the ruling, a Challenge button (red flag) and Play on. With the Sideline genius perk your replay assistant
// tells you what he sees: right about 85% of the time (it is his read of the replay, not the answer).
function offer(g, c, C, done) {
  const ch = chal(g, g.user), tm = g.T[g.user];
  let tip = `Close one. ${ch.left} challenge${ch.left === 1 ? '' : 's'} left; a lost one costs a timeout.`;
  if (perk()) { const read = R() < 0.85 ? C.wrong : !C.wrong; tip = read ? `Replay assistant: "Throw it, coach. I have it as ${C.tB.toLowerCase()}."` : `Replay assistant: "They got it right. Save the challenge."`; }
  win = { g, c, C, done };
  ui.call.innerHTML = `<div class="rk">RULING ON THE FIELD</div><b>${esc(C.rTxt)}</b><div class="rq">${esc(C.q)}</div><div class="ra">${esc(tip)}</div>
    <div class="rr"><button class="rpp chal on" data-rp="chal">${ICO.flag}<span>Challenge</span></button><button class="rpp on" data-rp="replay">Replay</button><button class="rpp on" data-rp="playon">Play on</button></div><i class="rt"></i>`;
  ui.call.style.setProperty('--rc', (tm && tm.c1) || '#c8202a'); ui.call.classList.remove('show', 'dim'); void ui.call.offsetWidth; ui.call.classList.add('show');
  M.after(9000, () => { if (win && win.C === C) closeWin('play'); });
}
function closeWin(choice) {
  const w = win; if (!w) return; win = null; ui.call.classList.remove('show');
  if (choice === 'chal' && canChal(w.g, w.g.user, w.C.ruled)) return challenge(w.g, w.c, w.C, w.done, w.g.user);
  w.done(w.C.ruled);
}
function challenge(g, c, C, done, tid) {
  const ch = chal(g, tid); ch.left--; ch.used++; C.by = tid;
  g.pbp.push(`${M.qTxt(g.q)} ${M.clockTxt(g.clock)} — ${abbr(g, tid)} challenge: ${C.q.replace(/\?$/, '')}`);
  if (pres(g) !== 'full') return decide(g, c, C, tid, done, true);
  redFlag(g, tid, () => review(g, c, C, `CHALLENGE · ${abbr(g, tid)}`, () => decide(g, c, C, tid, done)));
}
function booth(g, c, C, done) {
  g.pbp.push(`${M.qTxt(g.q)} ${M.clockTxt(g.clock)} — Booth review: ${C.q.replace(/\?$/, '')}`);
  if (pres(g) !== 'full') return decide(g, c, C, null, done, true);
  M.tick('The booth is taking a look'); review(g, c, C, 'BOOTH REVIEW', () => decide(g, c, C, null, done));
}
function review(g, c, C, kicker, then) {
  const v = C.view, F = FD(), kT = v.t, sx = v.x >= 0 ? 1 : -1, segs = [];
  segs.push({ cam: C.kind === 'fumble' ? 'tight' : 'side', t0: kT - 2.8, t1: kT + 0.2, pid: v.pid, lt: { k: kicker, b: C.q, s: `Ruling on the field: ${C.rTxt}` } });
  const rv = { cam: 'rev', t0: kT - 1.1, t1: kT, slow: [kT - 1.2, kT + 0.1, 0.3], hold: 1.8, bug: 'REVIEW', lt: { k: kicker, b: C.q, s: `Ruling on the field: ${C.rTxt}` } };
  if (C.kind === 'spot' || C.kind === 'goal') {
    const z = v.z; rv.pos = [-(F.halfW + (C.kind === 'goal' ? 1.2 : 6)), C.kind === 'goal' ? 0.9 : 1.5, z]; rv.look = [cl(v.x, -F.halfW + 2, F.halfW), 0.35, z]; rv.hf = C.kind === 'goal' ? 34 : 24;
    rv.marks = () => { RPV.band(-F.halfW, z, F.halfW, z, 0.1, C.kind === 'goal' ? 0xffffff : 0xffd21a, 0.95); const b = ballAt(c, kT); RPV.spot(b.x, v.sz != null ? v.sz : b.z, 0, 0xff7a1a); };
  } else if (C.kind === 'side') {
    rv.pos = [sx * (F.halfW + 0.7), 1.1, v.z - 7.5]; rv.look = [sx * F.halfW, 0.3, v.z + 1]; rv.hf = 30; rv.ring = { pid: v.pid, col: 0xffffff };
    rv.marks = () => RPV.band(sx * F.halfW, v.z - 9, sx * F.halfW, v.z + 9, 0.12, 0xff3b30, 0.95);
  } else {
    const p = pelAt(c, v.pid, kT) || { x: v.x, z: v.z }; rv.pos = [p.x - 4.6, 1.6, p.z - 2.6]; rv.look = [p.x, 0.55, p.z]; rv.hf = 34; rv.ring = { pid: v.pid, col: 0xffd21a };
    rv.marks = () => { const b = ballAt(c, kT); RPV.spot(b.x, b.z, Math.max(0, b.y - 0.55), 0xff7a1a); };
  }
  segs.push(rv);
  play([{ c, segs }], { wipe: 'REVIEW', bug: 'REVIEW' }, () => then());
}
function decide(g, c, C, tid, done, quiet) {
  const word = C.wrong ? 'overturned' : C.close > 0.62 ? 'stands' : 'confirmed', res = C.truth; C.word = word;
  let note = '';
  if (tid != null) { const ch = chal(g, tid); if (C.wrong) { ch.won++; if (ch.won >= 2 && !ch.bonus) { ch.bonus = true; ch.left++; } note = `${abbr(g, tid)} win the challenge${ch.bonus && ch.won === 2 ? ' and get a third' : ''}`; } else { g.to[tid] = Math.max(0, (g.to[tid] || 0) - 1); note = `${abbr(g, tid)} lose the challenge and a timeout`; } }
  g.pbp.push(`${M.qTxt(g.q)} ${M.clockTxt(g.clock)} — After review, the ruling on the field ${word === 'overturned' ? 'is overturned' : word === 'stands' ? 'stands' : 'is confirmed'}: ${C.wrong ? C.tA : C.rTxt}`);
  if (c) c.review = word;
  if (quiet) { M.tick(`After review: ${word === 'overturned' ? 'overturned, ' + C.tA.toLowerCase() : 'the call ' + word}`); return done(res); }
  const big = word === 'overturned' ? 'RULING OVERTURNED' : word === 'stands' ? 'RULING STANDS' : 'RULING CONFIRMED';
  ui.card.innerHTML = `<div class="rk">AFTER REVIEW</div><b class="${word}">${big}</b><div class="rs">The ruling on the field ${word === 'overturned' ? 'is overturned' : word === 'stands' ? 'stands' : 'is confirmed'}: ${esc(C.wrong ? C.tA : C.rTxt)}.</div>${note ? `<div class="rn">${esc(note)}</div>` : ''}<div class="rh">Tap to continue</div>`;
  ui.card.classList.remove('show'); void ui.card.offsetWidth; ui.card.classList.add('show'); if (M.buzz) M.buzz(word === 'overturned' ? 40 : 15);
  let fin = false; const go = () => { if (fin) return; fin = true; ui.card.onDone = null; ui.card.classList.remove('show'); done(res); };
  ui.card.onDone = go; M.after(3000, go);
}
function redFlag(g, tid, then) {
  const f = ui.flag, T = g.T[tid]; f.querySelector('b').textContent = (T && (T.name || T.abbr) || '').toUpperCase(); f.style.setProperty('--rc', (T && T.c1) || '#333');
  f.classList.remove('show'); void f.offsetWidth; f.classList.add('show'); if (M.buzz) M.buzz(25);
  M.after(1500, () => { f.classList.remove('show'); then(); });
}

// ------------------------------------------------------------ hooks from the match
// the whistle (onWhistle): the flag replay, the call on the field and any review, then the play is scored with what stands;
// a big play gets its replay a beat later (the game clock and the next snap wait while it runs)
function whistle(pl, info, go) {
  let once = false; const fin = r => { if (once) return; once = true; go(r); };
  const g = g0(), res = pl && pl.result, c = cur && cur.pl === pl ? cur : null;
  try {
    if (!g || g.sim || !res || !c) return fin(res);
    const fouls = (g.fouls || []).slice(), P = pres(g), S = setting();
    let C = null; try { C = judgeCall(g, pl, res, c); } catch (e) { console.error(e); } force = null;
    const done = r => { try { noteMeta(g, c, r, info, fouls); } catch (e) { console.error(e); } fin(r); try { autoAfter(g, c, fouls); } catch (e) { console.error(e); } };
    const step2 = () => { if (!C) return done(res); try { resolve(g, c, C, done); } catch (e) { console.error(e); done(res); } };
    const f0 = fouls.find(f => f.pid != null && f.at != null);
    if (f0) { c.foul = f0; if (S === 'ask' && P === 'full') nudge = c.id; }
    if (f0 && S === 'auto' && P === 'full' && !(g.pat && g.pat.two)) return flagGo(c, f0, fouls, step2);
    step2();
  } catch (e) { console.error(e); fin(res); }
}
function flagGo(c, f, fouls, then) { if (!play([flagItem(c, f)], { wipe: 'REPLAY', reflag: fouls.map(x => ({ x: x.x, z: x.z })) }, () => then())) then(); }
function noteMeta(g, c, r, info, fouls) {
  const k = keyOf(c, r);
  c.meta = { res: r ? { type: r.type, td: !!r.td, yards: r.yards || 0, turnover: r.turnover || null, defTD: !!r.defTD, sack: !!r.sack, safety: !!r.safety, carrier: r.carrier, catcher: r.catcher } : null,
    desc: r && M.describe ? M.describe(r, info || {}) : '', keyT: k.t, keyPid: k.pid, big: fouls && fouls.length ? 0 : bigOf(c, r), review: c.review || null };
}
function bigOf(c, r) { if (!r) return 0; if (r.td || r.turnover || r.safety) return 2; if ((r.yards || 0) >= 20 || r.sack || (c.ev.hitJ || 0) > 800) return 1; return 0; }
function autoAfter(g, c, fouls) {
  const m = c.meta; if (!m || !m.big || (fouls && fouls.length)) return; const P = pres(g), S = setting();
  if (S === 'off' || P === 'none' || (P === 'brief' && m.big < 2)) return;
  if (S === 'ask') { if (P === 'full') nudge = c.id; return; }
  M.after(P === 'brief' ? 900 : c.kind === 'kick' ? 700 : 1250, () => autoGo(c, P === 'brief' ? 'brief' : c.kind === 'kick' ? 'full' : m.big >= 2 ? 'full3' : 'full'));
}
function autoGo(c, style) {
  const g = g0(); if (!g || g !== lastG || g.sim || rp || win || g.penWait || g.paused || g.stage === 'flag' || g.stage === 'pre' || g.stage === 'live' || g.stage === 'final' || (M.el.ovl && M.el.ovl.classList.contains('show'))) return;
  if (pres(g) === 'none') return; playPlan(c, style);
}
// a kick or punt return (retWhistle): the long ones and the touchdowns get a replay
function ret(pl, res, R0) {
  const g = g0(), c = cur && cur.pl === pl ? cur : null; if (!g || !c || !res) return;
  const spot = res.spotZ / YD, ry = R0 && R0.landYd != null ? Math.max(0, Math.round(spot - R0.landYd)) : 0, k = keyOf(c, res), flagged = g.fouls && g.fouls.length;
  c.meta = { res: { type: res.type, td: !!res.td, yards: ry, turnover: res.type === 'fumbleLost' ? 'fumble' : null }, retY: ry, desc: res.td ? `${nm(res.carrier)} ${R0 && R0.kind === 'punt' ? 'punt' : 'kick'} return touchdown` : res.type === 'fumbleLost' ? 'Muffed, and the kicking team recovers' : ry >= 25 ? `${nm(res.carrier)} ${ry}-yard return` : '',
    keyT: k.t, keyPid: k.pid, big: flagged ? 0 : res.td || res.type === 'fumbleLost' || res.type === 'deftd' ? 2 : ry >= 35 ? 1 : 0 };
  autoAfter(g, c, flagged ? g.fouls : []);
}
// a dead-ball foul before the snap (deadBall): see him go, then the flag card
function preFlag(pl, f, go) {
  const g = g0(), c = cur && cur.pl === pl ? cur : null;
  if (!g || !c || f.pid == null || f.code === 'DOG' || setting() !== 'auto' || pres(g) !== 'full') return go();
  c.foul = f; if (!play([flagItem(c, f)], { wipe: 'REPLAY', reflag: [{ x: f.x, z: f.z }] }, () => go())) go();
}
// halftime (endQuarter): the first half's best plays, short; then the second-half kickoff
function half(cont) {
  const g = g0(); if (!g || g.sim || g.mode === 'instant' || g.auto || g.daily || setting() === 'off' || pres(g) !== 'full') return cont();
  const n = hi.filter(c => c.q <= 2).length; if (n < 2) return cont();
  if (setting() === 'ask') { nudgeHalf(g, cont); return; }
  if (!reel('half', () => cont())) cont();
}
function nudgeHalf(g, cont) {
  let fin = false; const go = w => { if (fin) return; fin = true; ui.btns.querySelector('.rph') && ui.btns.querySelector('.rph').remove(); if (w) { if (!reel('half', () => cont())) cont(); } else cont(); };
  ui.btns.insertAdjacentHTML('beforeend', '<button class="rpp rph on">Halftime highlights</button>'); ui.btns.querySelector('.rph').onclick = () => go(true);
  M.after(6000, () => go(false));
}
function reel(kind, done) {
  const g = g0(); if (!g) return false;
  let L = hi.filter(c => kind !== 'half' || c.q <= 2).slice().sort((a, b) => b.imp - a.imp).slice(0, kind === 'half' ? 4 : 8);
  if (!L.length) return false;
  const top = new Set(L.slice(0, 3).map(c => c.id)); L = L.sort((a, b) => a.id - b.id);
  const items = L.map((c, i) => ({ c, segs: reelSegs(c, top.has(c.id)), lt: ltOf(c) }));
  items[0].segs[0].lt = Object.assign(ltOf(L[0]), { k: (kind === 'half' ? 'HALFTIME HIGHLIGHTS · ' : 'GAME HIGHLIGHTS · ') + ltOf(L[0]).k });
  return play(items, { wipe: 'HIGHLIGHTS', bug: 'HIGHLIGHTS' }, () => { if (done) done(); });
}
// the final card (finalCard): a Highlights button; on Auto the reel plays first
function final(ovl) {
  const g = g0(); if (!g || !ovl || !hi.length || g.daily) return;
  const dn = ovl.querySelector('#mDone'), row = dn && dn.parentNode; if (!row) return;
  row.insertAdjacentHTML('afterbegin', '<button class="on rphl" id="mHl">Highlights</button>');
  const go = () => { if (rp) return; M.el.game.classList.add('rpOvl'); if (!reel('final', () => M.el.game.classList.remove('rpOvl'))) M.el.game.classList.remove('rpOvl'); };
  row.querySelector('#mHl').onclick = go;
  if (setting() === 'auto' && g.mode === 'play' && !g.auto) M.after(900, () => { if (g0() === g && g.stage === 'final') go(); });
}

// ------------------------------------------------------------ the Replay button, keys
function replayable(g) { return !!(g && !rp && !win && !g.sim && !g.paused && !g.over && pres(g) === 'full' && (g.stage === 'dead' || g.stage === 'call') && !g.penWait && lastClip() && !(M.el.ovl && M.el.ovl.classList.contains('show'))); }
function userReplay() {
  const g = g0(), c = lastClip(); if (!g || !c || rp || g.sim) return; nudge = 0;
  if (c.foul) return void play([flagItem(c, c.foul)], { wipe: 'REPLAY' });
  if (c.kind !== 'kick' && !c.meta) c.meta = Object.assign({ desc: '' }, { keyT: keyOf(c, null).t });
  playPlan(c, c.kind === 'kick' ? 'full' : c.meta && c.meta.big >= 2 ? 'full3' : 'full');
}
function buttons(g) {
  const ok = replayable(g), sheet = M.el.sheet, up = ok && g.stage === 'call' && sheet && sheet.classList.contains('show') && sheet.offsetLeft < 150 ? sheet.offsetHeight + 8 : 0;
  const key = ok ? `${lastClip().id}|${nudge === lastClip().id ? 1 : 0}|${up}` : '-';
  if (key === btnKey) return; btnKey = key;
  const hb = ui.btns.querySelector('.rph'); ui.btns.innerHTML = ok ? `<button class="rpp on${nudge === lastClip().id ? ' hot' : ''}" data-rp="replay" title="Replay (R)">${ICO.play}<span>Replay</span></button>` : ''; if (hb) ui.btns.appendChild(hb);
  ui.btns.style.bottom = up ? `${up}px` : '';
}
function onKey(e) {
  const g = g0(); if (!g || !M || M.el.game.hidden) return; const c = e.code;
  if (rp) {
    if (c === 'Space' || c === 'KeyP') rp.paused = !rp.paused;
    else if (c === 'Escape' || c === 'Enter') stop(true);
    else if (c === 'KeyN' || c === 'Tab') nextSeg(true);
    else if (c === 'ArrowLeft' || c === 'ArrowRight') { const s = rp.seg; if (s) { rp.t = cl(rp.t + (c === 'ArrowLeft' ? -0.25 : 0.25), s.t0, s.t1); rp.hold = 0; rp.paused = true; } }
    else return;
    e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  if (ui && ui.card.classList.contains('show') && (c === 'Space' || c === 'Enter')) { e.preventDefault(); e.stopImmediatePropagation(); if (ui.card.onDone) ui.card.onDone(); return; }
  if (win) { if (c === 'KeyF') closeWin('chal'); else if (c === 'Enter' || c === 'Space') closeWin('play'); else if (c === 'KeyR') userReplay(); else return; e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (c === 'KeyR' && !e.repeat && replayable(g)) { e.preventDefault(); e.stopImmediatePropagation(); userReplay(); }
}

return { init, rec, frame, whistle, ret, preFlag, half, final, reel, setting,
  _: { mem, clips: () => ({ recent: recent.map(c => ({ id: c.id, kind: c.kind, n: c.T.length, imp: c.imp, desc: c.meta && c.meta.desc })), hi: hi.map(c => ({ id: c.id, q: c.q, imp: Math.round(c.imp), desc: c.meta && c.meta.desc })), cur: cur ? { id: cur.id, n: cur.T.length, kind: cur.kind } : null }),
    force: f => { force = f; }, state: () => ({ rp: !!rp, seg: rp && rp.seg ? rp.seg.cam : null, bug: rp ? ui.bug.textContent : null, t: rp ? rp.t : null, win: win ? { kind: win.C.kind, wrong: win.C.wrong, ruled: win.C.rTxt } : null, card: ui && ui.card.classList.contains('show') ? ui.card.textContent : null }),
    replay: userReplay, skip: () => stop(true), next: () => nextSeg(true), pause: v => { if (rp) rp.paused = v == null ? !rp.paused : !!v; }, choose: k => closeWin(k), chal: () => { const g = g0(); return g && g.rpc ? JSON.parse(JSON.stringify(g.rpc)) : null; }, last: () => { const c = lastClip(); return c ? { id: c.id, meta: c.meta, foul: c.foul ? { code: c.foul.code, pid: c.foul.pid } : null, review: c.review } : null; } } };
})();
