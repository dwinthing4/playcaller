// ============================================================
//  PLAY SIMULATION: 22 physical players, blocking, coverage, pursuit, tackling, passing.
//  The offense always attacks +z. Line of scrimmage = losZ (meters from the offense's own goal line).
// ============================================================
(() => {
const { G, DT, FIELD, v2, len2, cl, lp, smooth, sstep, V3, add3, sub3, mul3, dot3, norm3, wrapAng, physFrom, Player, slewHeading, locomote, startFall, balance, gait, hitBody, bodyDynamics, bodyOverlap, quickCaps, poseBody, poseArms } = PHYS._;
const OLS = { LT: 1, LG: 1, C: 1, RG: 1, RT: 1 };
const DIFF = { rookie: { ai: -6, user: 6, react: 0.08, tk: -0.06 }, pro: { ai: 0, user: 0, react: 0, tk: 0 }, allpro: { ai: 4, user: 0, react: -0.03, tk: 0.04 }, legend: { ai: 8, user: -2, react: -0.06, tk: 0.08 } };

const R_TB = k => k === 'punt' ? 'Into the end zone: touchback' : 'He takes a knee: touchback';
class Play {
  // o: { losZ, ballX, down, togo, op, dp, off:{tid,list:[{slot,pos,rp,dx,dy}],bonus,style}, def:{tid,list,bonus,style}, userSide:'O'|'D'|null, userSlot, diff, seed, weather, fatigue, lateTrail }
  constructor(o) {
    this.o = o; this.rand = seededRng(o.seed >>> 0 || 1); this.t = 0; this.phase = 'pre'; this.liveT = 0; this.deadT = 0; this.result = null;
    this.fx = []; this.events = []; this.poses = {}; this.near = {}; this.stats = {}; this.perf = {}; this.bigHit = 0; this.broken = 0;
    this.losZ = o.losZ; this.ballX = cl(o.ballX || 0, -FIELD.hashX, FIELD.hashX); this.op = o.op; this.dp = o.dp; this.offUnit = 'O';
    this.pass = o.op.type === 'pass'; this.kind = this.pass ? 'pass' : 'run'; this.air = false; this.thrown = false; this.handed = false;
    this.diff = DIFF[o.diff || 'pro'] || DIFF.pro; this.userSide = o.userSide || null;
    this.input = { x: 0, z: 0 }; this.userTouched = false; this.contactZ = null; this.fpZ = null;
    this.env = (o.weather === 'rain' || o.weather === 'snow') ? { mu: 0.78, wet: true } : { mu: 1.2, wet: false };
    this.setup(); if (o.ret) this.setupReturn(o.ret);
  }
  r() { return this.rand(); }
  gauss() { let u = 0, v = 0; while (!u) u = this.r(); while (!v) v = this.r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  emit(text, kind = 'info', at) { this.events.push({ t: this.t, text, kind }); }
  st(p) { if (!p || p.pid == null) return {}; return this.stats[p.pid] || (this.stats[p.pid] = {}); }
  add(p, k, v = 1) { if (!p || p.pid == null) return; const s = this.st(p); s[k] = (s[k] || 0) + v; }
  note(p, good, text) { if (!p || p.pid == null) return; const f = this.perf[p.pid] || (this.perf[p.pid] = { good: 0, bad: 0, notes: [] }); if (good) f.good++; else f.bad++; if (text && f.notes.length < 4) f.notes.push(text); }

  // ---------------- setup ----------------
  setup() {
    const o = this.o, op = this.op, dp = this.dp, los = this.losZ, bx = this.ballX, flip = op.flip ? -1 : 1;
    const fat = o.fatigue || {};
    const mk = (e, unit, bonus) => {
      const pr = physFrom(e.rp, bonus, fat[e.rp.id] ?? 1);
      const dyM = (unit === 'O' ? flip : 1) * e.dy * YD;
      const x = cl(bx - dyM, -FIELD.halfW + 0.8, FIELD.halfW - 0.8), z = los + e.dx * YD * (unit === 'O' ? 1 : 1);
      return new Player(Object.assign(pr, { id: unit + e.slot, pid: e.rp.id, rp: e.rp, unit, slot: e.slot, posName: e.rp.pos || e.pos, label: e.slot, num: e.rp.num, name: e.rp.ln, x, z: unit === 'O' ? Math.min(z, los - 0.7) : Math.max(z, los + 0.75), heading: unit === 'O' ? 0 : Math.PI }));
    };
    const offB = (o.off.bonus || 0) + (this.userSide === 'O' ? this.diff.user : this.userSide === 'D' ? this.diff.ai : 0);
    const defB = (o.def.bonus || 0) + (this.userSide === 'D' ? this.diff.user : this.userSide === 'O' ? this.diff.ai : 0);
    this.O = o.off.list.map(e => mk(e, 'O', offB)); this.D = o.def.list.map(e => mk(e, 'D', defB));
    this.players = this.O.concat(this.D);
    const bySlot = s => this.O.find(p => p.slot === s);
    this.qb = bySlot('QB') || this.O.find(p => p.posName === 'QB') || this.O[5];
    const R = op.routes || {};
    // ---- offense roles ----
    for (const p of this.O) {
      if (OLS[p.slot]) { p.role = 'block'; p.ol = true; p.stance = true; p.stance3 = true; p.crouch = p.crouchT = 0.55; continue; }
      if (p === this.qb) { p.role = 'qb'; continue; }
      if (op.type === 'run' && op.carrier === p.slot) { p.role = 'rb'; continue; }
      const rt = R[p.slot];
      if (op.type === 'pass' && rt && rt !== 'block' && ROUTES[rt]) { p.role = 'route'; p.routeName = rt; }
      else if (op.paths && op.paths[p.slot] && op.type === 'pass') { p.role = 'route'; p.routeName = 'custom'; }
      else p.role = (op.type === 'pass' && (p.slot === 'RB' || p.slot === 'FB' || p.posName === 'TE')) ? 'pp' : 'block';
      if (p.posName === 'TE' && Math.abs(p.p.x - bx) < 8) { p.stance = true; p.crouch = p.crouchT = 0.45; }
    }
    if (op.type === 'run' && op.carrier === 'QB') { this.qb.role = 'qb'; this.qbRun = true; }
    for (const p of this.O) if (!p.stance) { p.stance = true; if (p !== this.qb) p.crouch = p.crouchT = 0.25; }     // everyone else in a two-point stance
    this.receivers = this.O.filter(p => p.role === 'route');
    for (const r of this.receivers) this.buildRoute(r);
    this.carrier = this.qb; this.ball = { state: 'snap', p: V3(bx, 0.3, los), v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0), t: 0 };
    // ---- run design: playside and the hole ----
    let side = op.rside === 'L' ? -1 : op.rside === 'R' ? 1 : (op.sideFixed || (this.r() < 0.5 ? -1 : 1)); side *= flip;      // + = offense's right
    const cp = op.paths && op.carrier && op.paths[op.carrier];
    if (cp && cp.length) { const last = cp.find(q => q[0] >= -0.5) || cp[cp.length - 1]; side = (last[1] < 0 ? -1 : 1) * flip; }
    this.side = side; this.sideX = -side;                                  // playside as a world-x sign
    const gy = GAPS[op.gap || (op.dir === 'outside' ? 'D' : 'B')] || 3.3;
    this.gapX = cl(bx - side * gy * YD, -FIELD.halfW + 2, FIELD.halfW - 2); this.holeX = this.gapX;
    const blocks = resolveBlocks(op, side);
    for (const p of this.O) {
      if (p.ol) p.asg = blocks[p.slot] || { t: 'pass', d: 0 };
      else if (p.role === 'block') {
        if (op.type === 'run') { if (p.slot === 'FB' || p.slot === 'RB') p.asg = { t: 'lead', d: side }; else if (p.posName === 'WR') p.asg = { t: 'stalk', d: 0 }; else { const ps = (bx - p.p.x) * side > 0; p.asg = ps ? { t: op.scheme === 'power' || op.scheme === 'counter' ? 'down' : 'reach', d: op.scheme === 'power' || op.scheme === 'counter' ? -side : side } : { t: 'drive', d: 0 }; } }
        else p.asg = { t: p.posName === 'WR' ? 'stalk' : 'pass', d: 0 };
      } else if (p.role === 'pp') p.asg = { t: 'pass', d: 0 };
      if (p.asg) p.asgX = -(p.asg.d || 0);                                   // lateral drive direction in world x
    }
    if (op.motion) { const m = this.O.find(p => p.slot === op.motion.slot); if (m) { const inward = m.p.x > bx ? -1 : 1; this.motion = { p: m, type: op.motion.type, then: op.motion.then || 'route', tx: op.motion.type === 'across' ? cl(bx + (bx - m.p.x) * 0.85, -FIELD.halfW + 3, FIELD.halfW - 3) : op.motion.type === 'jet' ? bx + inward * -1.2 : m.p.x + inward * 4 }; } }
    // ---- defense: rush, coverage ----
    const blitz = new Set(dp.blitz || []);
    for (const d of this.D) {
      d.seenV = v2(); d.dl = d.posName === 'DE' || d.posName === 'DT' || /^D[ET]\d/.test(d.slot);
      d.edge = d.posName === 'DE' || (d.posName === 'LB' && Math.abs(d.p.x - bx) > 4);
      if (d.dl || blitz.has(d.slot)) { d.job = 'rush'; d.rushMove = this.pickRushMove(d); }
      if (d.dl) { d.stance = true; d.stance3 = d.posName !== 'LB'; d.crouch = d.crouchT = 0.6; }
      else { d.stance = true; d.crouch = d.crouchT = d.posName === 'LB' ? 0.42 : 0.3; }     // linebackers and DBs: athletic two-point stance
      const awr = d.A.awr; d.recog = d.dl ? 0.05 : d.posName === 'LB' ? cl(0.5 - awr / 300, 0.16, 0.45) : cl(0.75 - awr / 260, 0.3, 0.7);
      d.recog += this.diff.react * (this.userSide === 'O' ? 1 : this.userSide === 'D' ? -1 : 0);
      d.react = cl(0.3 - awr / 520 + (this.userSide === 'O' ? this.diff.react : 0), 0.08, 0.36);
    }
    this.assignCoverage(); this.applyFilm();
    // receivers and corners line up in a staggered stance: the inside foot back
    for (const p of this.players) { if (p.posName !== 'WR' && p.posName !== 'CB') continue; const back = p.unit === 'O' ? -1 : 1, inX = Math.sign(this.ballX - p.p.x) || 1, r = p.right();
      const f = p.feet.slice().sort((a, b) => ((b.x - p.p.x) * inX) - ((a.x - p.p.x) * inX))[0]; if (f) f.z += back * 0.32; }
    // ---- pass protection lanes ----
    if (op.type === 'pass') {
      const bl = this.O.filter(p => p.asg && p.asg.t === 'pass').sort((a, b) => a.p.x - b.p.x), rs = this.D.filter(d => d.job === 'rush').sort((a, b) => a.p.x - b.p.x), used = new Set();
      for (const b of bl.filter(x => x.ol)) { let best = null, bd = 99; for (const d of rs) { if (used.has(d)) continue; const dd = Math.abs(d.p.x - b.p.x) + (d.p.z - b.p.z) * 0.2; if (dd < bd) { bd = dd; best = d; } } if (best && bd < 5) { b.passT = best; used.add(best); } }
      for (const b of bl.filter(x => !x.ol)) { let best = null, bd = 99; for (const d of rs) { if (used.has(d)) continue; const dd = Math.abs(d.p.x - b.p.x); if (dd < bd) { bd = dd; best = d; } } if (best) { b.passT = best; used.add(best); } }
    }
    // ---- user control ----
    this.userD = null;
    if (this.userSide === 'D') this.userD = this.D.find(d => d.slot === o.userSlot) || this.D.find(d => d.posName === 'LB') || this.D[4];
    this.updatePoses();
  }
  pickRushMove(d) {
    const A = d.A, sp = A.prs * 0.6 + A.spd * 0.4, pw = A.pow * 0.6 + A.str * 0.4, fi = A.prs * 0.5 + A.agi * 0.5;
    const opts = [['speed', sp * (d.posName === 'DE' || d.posName === 'LB' ? 1.1 : 0.7)], ['bull', pw * (d.posName === 'DT' ? 1.1 : 0.9)], ['swim', fi * 0.9], ['spin', fi * 0.8]];
    let tot = 0; for (const q of opts) { q[1] = Math.pow(Math.max(1, q[1] - 40), 2); tot += q[1]; }
    let r = this.r() * tot; for (const q of opts) { r -= q[1]; if (r <= 0) return q[0]; } return 'bull';
  }
  assignCoverage() {
    const dp = this.dp, los = this.losZ, bx = this.ballX, cov = dp.cov || 'c3', cand = this.D.filter(d => d.job !== 'rush');
    const press = (this.o.def.style === 'Man Press' || dp.press);
    const recs = this.receivers.slice().sort((a, b) => Math.abs(b.p.x - bx) - Math.abs(a.p.x - bx));
    const toZ = (depth, y) => ({ x: -(y - MID_YD) * YD, z: los + depth * YD, deep: depth >= 13 });
    if (MAN_COVERAGES[cov]) {
      let pool = cand.slice();
      if (cov === 'c1') { const s = pool.filter(d => d.posName === 'S').sort((a, b) => b.p.z - a.p.z)[0] || pool[pool.length - 1]; if (s) { s.job = 'deep'; pool = pool.filter(x => x !== s); } }
      if (cov === 'c2m') { const ss = pool.filter(d => d.posName === 'S').slice(0, 2); ss.forEach((s, i) => { s.job = 'zone'; s.zone = toZ(16, i ? 40 : 13); }); pool = pool.filter(x => !ss.includes(x)); }
      const order = ['CB', 'S', 'LB'];
      for (const r of recs) {
        let best = null, bv = 1e9;
        for (const d of pool) { const pr = order.indexOf(d.posName); const wide = Math.abs(r.p.x - bx) > 11; const v = (wide ? Math.max(0, pr) * 20 : (d.posName === 'CB' ? 15 : 0)) + Math.abs(d.p.x - r.p.x) * 0.6; if (v < bv) { bv = v; best = d; } }
        // out of cover men (a 6-man pressure): the closest non-lineman blitzer peels off and takes him; failing that, the free safety comes down
        if (!best) { const peel = this.D.filter(x => x.job === 'rush' && !x.dl && !x.cover).sort((a, b) => Math.abs(a.p.x - r.p.x) - Math.abs(b.p.x - r.p.x))[0] || this.D.find(x => x.job === 'deep');
          if (!peel) break; best = peel; best.rushMove = null; }
        best.job = 'man'; best.cover = r; pool = pool.filter(x => x !== best);
        best.p.x = r.p.x + (r.p.x > bx ? -0.7 : 0.7);
        if (best.posName === 'CB' || Math.abs(r.p.x - bx) > 9) best.p.z = los + (press ? 1.3 : 4.2);
        if (press && best.posName === 'CB') r.jam = cl(0.22 + (best.A.mcv + best.A.str * 0.3 - r.A.rte - r.A.str * 0.3) / 90, 0, 0.7);
        this.resetFeet(best);
      }
      for (const d of pool) { d.job = cov === 'c0' ? 'rush' : 'spy'; if (d.job === 'rush') d.rushMove = 'speed'; }
    } else {
      const Z = COV_ZONES[cov] || COV_ZONES.c3; let pool = cand.slice();
      for (const z of Z) { if (!pool.length) break; const zz = toZ(z[0], z[1]); let c = pool.filter(d => d.posName === z[2]); if (!c.length) c = pool;
        c.sort((a, b) => Math.hypot(a.p.x - zz.x, a.p.z - zz.z) - Math.hypot(b.p.x - zz.x, b.p.z - zz.z)); const d = c[0]; d.job = 'zone'; d.zone = zz; pool = pool.filter(x => x !== d); }
      for (const d of pool) d.job = 'spy';
      // corners line up over the widest receivers even in zone
      for (const d of this.D.filter(x => x.posName === 'CB')) { const r = recs.filter(q => Math.sign(q.p.x - bx) === Math.sign(d.p.x - bx))[0]; if (r && Math.abs(r.p.x - bx) > 9) { d.p.x = r.p.x + (r.p.x > bx ? -1 : 1); this.resetFeet(d); } }
    }
  }
  // the defense has seen this play before (it ran it on them earlier): it reads it faster and keys on what hurt it, the side the run went or the receiver the ball went to
  applyFilm() {
    const F = this.dp && this.dp.film, k = F ? cl(F.k || 0, 0, 0.9) : 0; this.filmK = k; if (!k) return;
    for (const d of this.D) { d.recog = Math.max(0.03, d.recog - 0.22 * k); d.react = Math.max(0.06, d.react - 0.06 * k); }
    if (F.type === 'run') { for (const d of this.D) if (!d.dl && (d.posName === 'LB' || d.posName === 'S') && d.job !== 'man' && d.job !== 'deep') { d.p.x = cl(d.p.x + this.sideX * 1.4 * k, -FIELD.halfW + 1, FIELD.halfW - 1); this.resetFeet(d); } return; }
    const r = F.tgt && this.receivers.find(x => x.slot === F.tgt); if (!r) return;
    const man = this.D.find(d => d.cover === r); if (man) { man.jump = k; return; }
    const key = r.route && r.route[Math.min(1, r.route.length - 1)]; if (!key) return;
    const z = this.D.filter(d => d.zone && !d.zone.deep).sort((a, b) => Math.hypot(a.zone.x - key.x, a.zone.z - key.z) - Math.hypot(b.zone.x - key.x, b.zone.z - key.z))[0];
    if (z) { z.zone = { x: lp(z.zone.x, key.x, 0.45 * k), z: lp(z.zone.z, key.z, 0.45 * k), deep: false }; z.jump = k; }
  }
  resetFeet(p) { const r = p.right(); p.feet.forEach(f => { f.x = p.p.x + r.x * f.side * 0.15; f.z = p.p.z + r.z * f.side * 0.15; }); }
  buildRoute(r) {
    const bx = this.ballX, inward = r.p.x > bx + 0.3 ? -1 : r.p.x < bx - 0.3 ? 1 : (r.slot === 'RB' ? 1 : -1), flip = this.op.flip ? -1 : 1;
    const cp = this.op.paths && this.op.paths[r.slot];
    const pts = cp && cp.length ? cp.map(([f, l]) => v2(cl(r.p.x - flip * l * YD, -FIELD.halfW + 0.8, FIELD.halfW - 0.8), r.p.z + f * YD))
      : (ROUTES[r.routeName] || []).map(([f, i]) => v2(cl(r.p.x + i * inward * YD, -FIELD.halfW + 0.8, FIELD.halfW - 0.8), r.p.z + f * YD));
    r.route = pts; r.ri = 0; r.settle = !!SETTLE_ROUTES[r.routeName]; r.deepR = !!DEEP_ROUTES[r.routeName]; r.start = v2(r.p.x, r.p.z); r.startX = r.p.x;
  }

  // ---------------- public control ----------------
  snap() { if (this.phase !== 'pre') return; if (this.motion && !this.motion.done) { this.motion.go = true; return; } this.goLive(); }
  goLive() {
    this.phase = 'live'; this.liveT = 0; for (const p of this.players) { p.stance = false; }
    this.ball.state = 'snap'; this.ball.t = 0; this.ball.from = V3(this.ballX, 0.3, this.losZ); this.ball.to = this.qb;
    if (this.motion && this.motion.then === 'block') { const m = this.motion.p; m.role = 'block'; m.asg = { t: 'stalk', d: 0 }; }
    if (this.motion && this.motion.then === 'route' && this.motion.p.role === 'route') this.buildRoute(this.motion.p);
    this.fx.push({ kind: 'snap' });
  }
  controlled() {
    if (this.userSide === 'O') { const c = this.carrier; if (c && c.unit === 'O' && (c === this.qb ? (this.ball.state === 'held' && (this.op.type === 'pass' || this.qbRun)) : true)) return c; return null; }
    if (this.userSide === 'D') return this.userD; return null;
  }
  switchDefender() { // to the defender nearest the ball
    if (this.userSide !== 'D') return; const B = this.ball.state === 'air' ? this.ball.land : (this.carrier ? this.carrier.p : this.ball.p);
    let best = null, bd = 1e9; for (const d of this.D) { if (!d.upright()) continue; const x = Math.hypot(d.p.x - B.x, d.p.z - B.z); if (x < bd) { bd = x; best = d; } } if (best) this.userD = best;
  }

  // ---------------- main step ----------------
  step(dt) {
    this.t += dt; const env = this.env, inp = this.input;
    if (this.phase === 'live') this.liveT += dt; else if (this.phase === 'dead') this.deadT += dt;
    if (!isFinite(inp.x) || !isFinite(inp.z)) { inp.x = 0; inp.z = 0; }
    if (Math.hypot(inp.x, inp.z) > 0.2) this.userTouched = true;
    for (const p of this.players) for (const k of ['jukeT', 'spinT', 'stiffT', 'truckT', 'lungeT', 'cooldown', 'disengageT', 'diveCd', 'moveCd', 'swatT']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
    for (const p of this.players) { if (p.jumpT > 0) { p.jumpT = Math.max(0, p.jumpT - dt); const u = 1 - p.jumpT / 0.52; p.jumpY = p.jumpT > 0 && p.upright() ? p.jumpH * 4 * u * (1 - u) : 0; } else p.jumpY = 0; }
    const c = this.carrier;
    if (this.phase === 'pre') { this.preStep(dt); }
    else {
      for (const p of this.players) { p.isCarrier = p === c && this.ball.state === 'held'; if (p.secureT > 0) p.secureT -= dt; p.propK = p.secureT > 0 ? 0.5 : 1; p.balS = p.isCarrier ? p.balCarry * (this.wrapCount > 1 ? 1 / (1 + 0.25 * (this.wrapCount - 1)) : 1) : p.strength; }
      if (c && this.ball.state === 'held') { const nw = this.D.concat(this.O).filter(d => d.wrapped && d.unit !== c.unit).reduce((s, d) => s + d.wq * Math.min(1, 0.45 + d.gripT * 1.4), 0); c.propK = 1 - 0.72 * Math.min(1, nw * 1.1); }   // a wrap saps his leg drive, more the longer it holds
      if (this.phase === 'live') this.ai(dt, env); else this.deadAI(dt, env);
      this.ballStep(dt);
      this.interactions(dt);
      this.trips();
      if (c) { const n = this.nearestFoe(c, 5); c.look = n ? v2(n.d.p.x - c.p.x, n.d.p.z - c.p.z) : len2(c.vel) > 1 ? v2(c.vel.x, c.vel.z) : v2(0, c.unit === 'O' ? 1 : -1); for (const d of this.foes(c)) d.look = v2(c.p.x - d.p.x, c.p.z - d.p.z); }
    }
    for (const p of this.players) {
      p.crouch += (p.crouchT - p.crouch) * Math.min(1, dt * 6); bodyDynamics(p, dt);
      p.stK = p.stance ? 1 : Math.max(0, (p.stK || 0) - dt / 0.16);           // stance pose eases out over ~0.16 s after the snap
      let leanT = v2();
      if (p.upright()) { const f = p.fwd(), r = p.right(), af = p.acc.x * f.x + p.acc.z * f.z, ar = p.acc.x * r.x + p.acc.z * r.z; const lf = cl(af / G * 0.75, -0.3, 0.55), ls = cl(ar / G * 0.42, -0.3, 0.3); leanT = v2(f.x * lf + r.x * ls, f.z * lf + r.z * ls); }
      const k = Math.min(1, dt / 0.09); p.lean.x += (leanT.x - p.lean.x) * k; p.lean.z += (leanT.z - p.lean.z) * k;
      balance(p, dt, this); gait(p, dt); p.p.x += p.vel.x * dt; p.p.z += p.vel.z * dt;
    }
    if (this.phase === 'live') this.whistle();
  }
  preStep(dt) {
    const env = this.env, m = this.motion;
    for (const p of this.players) {
      if (m && m.go && p === m.p) { const dx = m.tx - p.p.x, sp = m.type === 'jet' ? 7.5 : m.type === 'across' ? 6.8 : 5; locomote(p, v2(Math.sign(dx) * Math.min(sp, Math.abs(dx) * 3), 0), dt, env); p.crouchT = 0.1;
        if (Math.abs(dx) < (m.type === 'jet' ? 2.2 : 0.4)) { m.done = true; this.goLive(); return; } continue; }
      locomote(p, v2(), dt, env);
      if (p.unit === 'D' && !p.dl) { const cv = p.cover; if (cv) slewHeading(p, Math.atan2(cv.p.x - p.p.x, cv.p.z - p.p.z), 4, dt); }
    }
    // man defenders shadow the motion man
    if (m && m.go) for (const d of this.D) if (d.cover === m.p) { const tx = m.p.p.x + (m.p.p.x > this.ballX ? -0.8 : 0.8); locomote(d, v2(cl((tx - d.p.x) * 3, -7, 7), 0), dt, env); }
  }

  // ---------------- kick returns: kickoffs and punts, played out ----------------
  // (R_TB below: the touchback text)
  // The receiving team is the offense (attacking +z, as always); the kicking team is the defense. R = { kind: 'kickoff'|'punt', kickX, kickZ, landX, landZ, hang, retSlot, losZ }
  setupReturn(R) {
    this.ret = R; this.kind = 'return'; this.pass = false; this.handed = true; this.qbRun = true; this.op = Object.assign({}, this.op, { type: 'run', name: R.kind === 'punt' ? 'Punt return' : 'Kick return' });
    const ret = this.O.find(p => p.slot === R.retSlot) || this.O[0], punt = R.kind === 'punt', land = v2(cl(R.landX, -FIELD.halfW + 2, FIELD.halfW - 2), R.landZ);
    this.qb = ret; this.returner = ret; this.receivers = []; this.losZ = -40; this.motion = null; this.phase = 'live'; this.liveT = 0; this.air = true; this.carrier = null;
    const place = (p, x, z, h, vz) => { p.p = v2(cl(x, -FIELD.halfW + 1, FIELD.halfW - 1), z); p.heading = h; p.vel = v2(0, vz || 0); p.stance = false; p.stK = 0; p.crouch = p.crouchT = 0.12; p.role = 'block'; p.asg = { t: 'ret', d: 0 }; p.asgX = 0; p.ol = false; p.job = null; p.cover = null; p.zone = null; this.resetFeet(p); };
    // the returner: deep, a few steps from where it will come down
    place(ret, land.x + this.gauss() * 1.2, land.z - 3 - this.r() * 2, 0); ret.role = 'returner';
    // the return team: a front line at the restraining line (kickoff) or the line of scrimmage (punt), backed by a second wave; each has a wall spot to get to
    const blk = this.O.filter(p => p !== ret), fx = [-19, -10, -3.5, 3.5, 10, 19], frontZ = punt ? R.losZ - 0.8 : R.kickZ - 10 * YD;
    blk.forEach((p, i) => { const front = i < 6, x = front ? fx[i] : [-7, 7, -2, 2][i - 6] || 0, z = front ? frontZ : (punt ? R.losZ - 6 - (i - 6) * 3 : R.kickZ - 22 * YD - (i - 6) * 4);
      place(p, x, z, punt ? 0 : Math.PI); p.wallX = x; p.wallD = (front ? 13 : 8) + (i % 3) * 1.6; p.wall = v2(lp(x, land.x, 0.35) * 0.8, land.z + p.wallD); });
    // the kicking team: spread across the field in lanes, running at the ball (punt: the gunners split wide and get a head start)
    const lanes = [-22, -17, -12, -7, -2.5, 2.5, 7, 12, 17, 22], cov = this.D.slice().sort((a, b) => (a.posName === 'K' || a.posName === 'P') - (b.posName === 'K' || b.posName === 'P'));
    cov.forEach((d, i) => { const kicker = i === 10, lx = kicker ? 0 : lanes[i], gun = punt && (i === 0 || i === 9);
      const z = kicker ? R.kickZ + (punt ? 0 : 1.5) : punt ? (gun ? R.losZ + 0.8 : R.losZ + 1 + (i % 2) * 1.2) : R.kickZ + 0.9;
      place(d, kicker ? R.kickX : lx, z, Math.PI, kicker ? 0 : -(punt ? (gun ? 3.5 : 1.5) : 5.5)); d.role = 'cover'; d.lane = lx; d.gunner = gun; d.kicker = kicker; d.dl = false;
      d.safe = punt && (i === 4 || i === 5); d.fit = kicker || d.safe ? 'alley' : Math.abs(lx) >= 17 ? 'contain' : 'attack'; d.react = cl(0.3 - d.A.awr / 520, 0.08, 0.3); d.seenV = v2(); });
    if (this.userSide === 'D') this.userD = cov[4] || this.D[0];
    { const bs = blk.slice().sort((a, b) => a.p.x - b.p.x), cs = cov.filter(d => !d.kicker).sort((a, b) => a.p.x - b.p.x); bs.forEach((b, i) => { b.assign = cs[i] || null; b.retMan = b.assign; }); }
    // your kick: everyone lines up and waits for the power meter (kickNow); otherwise the ball is in the air right away
    if (R.wait) { this.phase = 'pre'; this.air = false; this.ball = { state: 'dead', p: V3(R.kickX, 0.3, R.kickZ), v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0) }; }
    else this.launchKick(R);
    this.updatePoses();
  }
  launchKick(R) {
    const land = v2(cl(R.landX, -FIELD.halfW + 2, FIELD.halfW - 2), cl(R.landZ, -9.5 * YD, FIELD.goalZ)), T = R.hang, x0 = R.kickX, z0 = R.kickZ, y0 = 0.3, yL = 1.3, ret = this.returner;
    this.phase = 'live'; this.liveT = 0; this.air = true; this.carrier = null;
    // deep in the end zone he takes a knee; a punt inside his 9 he lets bounce (it is downed where it stops)
    this.kneel = R.kind === 'kickoff' ? land.z < -3 * YD : land.z < 0; this.letGo = R.kind === 'punt' && !this.kneel && land.z < 9 * YD;
    for (const p of this.O) if (p.wallD != null) p.wall = v2(lp(p.wallX, land.x, 0.35) * 0.8, land.z + p.wallD);
    if (R.wait) { ret.p = v2(cl(land.x + this.gauss() * 1.2, -FIELD.halfW + 1, FIELD.halfW - 1), Math.min(land.z - 3 - this.r() * 2, ret.p.z)); this.resetFeet(ret); }
    this.ball = { state: 'air', p: V3(x0, y0, z0), v: V3((land.x - x0) / T, (yL - y0 + 0.5 * G * T * T) / T, (land.z - z0) / T), t: 0, T, land, target: ret, ret: true, rot: V3(0, 0, 0), spin: V3(0, 0, 0), from: v2(x0, z0), fromZ: z0 };
    this.fx.push({ kind: 'snap' });
  }
  kickNow(landX, landZ, hang) { if (!this.ret || this.phase !== 'pre') return false; Object.assign(this.ret, { landX, landZ, hang, wait: false }); this.ret.wait = true; this.launchKick(this.ret); this.ret.wait = false; return true; }
  fairCatchCall() { if (this.ret && this.ret.kind === 'punt' && this.air && !this.fairCatch) { this.fairCatch = true; this.emit(`${this.returner.name} waves for a fair catch`, 'info'); return true; } return false; }
  retCatch() {
    const B = this.ball, r = this.returner, d = Math.hypot(r.p.x - B.p.x, r.p.z - B.p.z); this.air = false;
    if (this.kneel) { this.carrier = r; this.ball = { state: 'held', p: B.p, v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0) }; this.endPlay('touchback', R_TB(this.ret.kind), r, -1); return; }
    if (this.letGo) { const z = B.land.z - (1 + this.r() * 5) * YD; this.ball = { state: 'dead', p: V3(B.land.x, 0.15, Math.max(z, -1)), v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0) }; this.endPlay('downed', 'Downed', null, z < 0 ? -1 : z); return; }
    if (this.fairCatch && r.upright()) { this.carrier = r; this.ball = { state: 'held', p: B.p, v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0) }; this.endPlay('fair', 'Fair catch', r, r.p.z); return; }
    const near = this.D.some(q => q.upright() && Math.hypot(q.p.x - r.p.x, q.p.z - r.p.z) < 2.2), muffP = cl(0.012 + (62 - r.A.cth) / 700 + (near ? 0.05 : 0) + (d > 1.8 ? 0.15 : 0), 0.004, 0.3);
    if (!r.upright() || this.r() < muffP) { this.fumbler = r; this.emit(`${r.name} muffs the kick!`, 'bad'); this.ball = { state: 'loose', p: V3(r.p.x, 0.6, r.p.z), v: V3(this.gauss() * 1.5, 2, this.gauss() * 2), rot: V3(0, 0, 0), spin: V3(6, 2, 6), looseT: 0 }; return; }
    this.carrier = r; this.catchT = this.t; r.role = 'carrier'; r.secureT = 0.2; r.propK = d > 1.2 ? 0.45 : 0.75; r.ballSide = r.p.x > 0 ? 1 : -1;
    this.ball = { state: 'held', p: B.p, v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0) };
    for (const q of this.D) q.runRead = this.t; this.emit(`${r.name} fields it`, 'info');
  }
  retAI(dt, env) {
    const c = this.carrier, B = this.ball, uc = this.controlled(), inF = this.air && B.state === 'air', R = this.ret, ret = this.returner, L = B.land || v2(ret.p.x, ret.p.z);
    for (const p of this.O) {
      if (p === uc && this.userDriven(p)) { this.userMove(p, dt, env); continue; }
      if (p === ret && inF && this.letGo) { const tx = L.x - p.p.x, tz = L.z + 8 - p.p.z, m = Math.hypot(tx, tz) || 1, sp = Math.min(p.vmax * 0.8, m * 2); locomote(p, m > 0.4 ? v2(tx / m * sp, tz / m * sp) : v2(), dt, env); slewHeading(p, Math.atan2(B.p.x - p.p.x, B.p.z - p.p.z), 6, dt); continue; }    // too close to the goal line: let it bounce
      if (p === ret && inF) {      // get under it, eyes up
        const tl = Math.max(0.05, B.T - B.t), tx = L.x - p.p.x, tz = L.z - 0.5 - p.p.z, m = Math.hypot(tx, tz), sp = Math.min(p.vmax, m / Math.max(0.25, tl - 0.25) + (m > 0.5 ? 0.8 : 0));
        locomote(p, m > 0.12 ? v2(tx / m * sp, tz / m * sp) : v2(), dt, env); slewHeading(p, Math.atan2(B.p.x - p.p.x, B.p.z - p.p.z), 6, dt); p.crouchT = 0.08;
        if (R.kind === 'punt' && !this.fairCatch && !this.fairDecided && this.userSide !== 'O' && tl < 0.8) { this.fairDecided = true; const g = Math.min(...this.D.map(d => Math.hypot(d.p.x - L.x, d.p.z - L.z))); if (this.r() < (g < 7 ? 0.95 : g < 17 ? (17 - g) / 10 : 0.04)) this.fairCatchCall(); }     // a gunner bearing down: wave it off
        continue; }
      if (c === p && B.state === 'held') { this.runnerAI(p, dt, env); continue; }
      if (B.state === 'loose') { const dx = B.p.x - p.p.x, dz = B.p.z - p.p.z, m = Math.hypot(dx, dz) || 1; locomote(p, v2(dx / m * p.vmax, dz / m * p.vmax), dt, env); continue; }
      if (inF && p.retMan && p.retMan.upright() && !p.bond) {      // go get your man: get between him and the ball, square up, and take him on
        const d = p.retMan, gx = L.x - d.p.x, gz = L.z - d.p.z, gm = Math.hypot(gx, gz) || 1, far = Math.hypot(d.p.x - p.p.x, d.p.z - p.p.z) > 22 && R.kind !== 'punt';
        const tx = far ? p.wall.x : d.p.x + gx / gm * 1.1, tz = far ? p.wall.z : d.p.z + gz / gm * 1.1, mx = tx - p.p.x, mz = tz - p.p.z, mm = Math.hypot(mx, mz) || 1, sp = Math.min(p.vmax * 0.95, mm * 2.6);
        locomote(p, v2(mx / mm * sp, mz / mm * sp), dt, env); slewHeading(p, Math.atan2(d.p.x - p.p.x, d.p.z - p.p.z), 6, dt); p.crouchT = mm < 3 ? 0.42 : 0.15; continue; }
      if (inF) {                   // drop to the wall, turn and find a man coming down
        const thr = this.D.filter(d => d.upright() && !d.bondBy).sort((a, b) => Math.hypot(a.p.x - p.p.x, a.p.z - p.p.z) - Math.hypot(b.p.x - p.p.x, b.p.z - p.p.z))[0], dd = thr ? Math.hypot(thr.p.x - p.p.x, thr.p.z - p.p.z) : 99;
        if (thr && dd < 5) { const ax = thr.p.x - p.p.x, az = thr.p.z - p.p.z, am = dd || 1; locomote(p, v2(ax / am * 3, az / am * 3), dt, env); slewHeading(p, Math.atan2(ax, az), 7, dt); p.crouchT = 0.4; }
        else { const w = p.wall, wx = w.x - p.p.x, wz = w.z - p.p.z, wm = Math.hypot(wx, wz), sp = Math.min(p.vmax * 0.92, wm * 2.2); locomote(p, wm > 0.3 ? v2(wx / wm * sp, wz / wm * sp) : v2(), dt, env); slewHeading(p, wm > 2.5 ? Math.atan2(wx, wz) : 0, 5, dt); p.crouchT = 0.15; }
        continue; }
      this.blockerAI(p, dt, env);
    }
    for (const d of this.D) {
      if (d === uc && this.userDriven(d)) { this.userMove(d, dt, env); continue; }
      if (c === d && B.state === 'held') { this.runnerAI(d, dt, env); continue; }
      if (B.state === 'loose') { const dx = B.p.x - d.p.x, dz = B.p.z - d.p.z, m = Math.hypot(dx, dz) || 1; locomote(d, v2(dx / m * d.vmax, dz / m * d.vmax), dt, env); continue; }
      if (inF && R.kind === 'punt' && !d.gunner && !d.kicker && this.liveT < 0.3) { locomote(d, v2(), dt, env); continue; }     // protect the punter first
      if (inF) {                   // down the lane, squeezing toward the ball as he gets close; the kicker hangs back as the last man
        const prog = cl(1 - (d.p.z - L.z) / Math.max(10, R.kickZ - L.z), 0, 1), tx = d.kicker ? lp(d.p.x, L.x, 0.3) : lp(d.lane, L.x, 0.2 + 0.65 * prog), tz = d.kicker ? Math.max(L.z + 22, d.p.z - 4) : d.safe ? Math.max(L.z + 11, d.p.z - 6) : L.z + (d.gunner ? 1.5 : 3);
        const mx = tx - d.p.x, mz = tz - d.p.z, mm = Math.hypot(mx, mz) || 1, sp = d.kicker ? Math.min(d.vmax * 0.6, mm * 2) : d.vmax * (d.gunner ? 0.96 : 0.92);
        if (d.bondBy) { this.pursueAI(d, dt, env, d.fit); continue; }
        locomote(d, v2(mx / mm * sp, mz / mm * sp), dt, env); slewHeading(d, Math.atan2(mx, mz), 6, dt); d.crouchT = 0.05; continue; }
      if (!c) { locomote(d, v2(), dt, env); continue; }
      this.pursueAI(d, dt, env, d.fit || 'attack');
    }
  }

  // ---------------- AI dispatch ----------------
  ai(dt, env) {
    if (this.ret) return this.retAI(dt, env);
    const c = this.carrier, uc = this.controlled(), inp = this.input;
    if (this.qb.windup) this.windupStep(this.qb, dt);
    if (this.userD && inp.tackle) { inp.tackle = false; const p = this.userD, cc = this.carrier; if (cc && cc.unit === 'O' && p.upright() && p.cooldown <= 0 && !p.engaged && this.facing(p, cc) > -0.6) { const dd = Math.hypot(cc.p.x - p.p.x, cc.p.z - p.p.z); if (dd < 3.4) this.startLunge(p, cc, dd > 2.1); } }
    if (this.pass && !this.thrown && c === this.qb && !this.pressured && this.liveT > 0.3 && this.pressureOn(this.qb) < 2.0) this.pressured = true;
    if (uc === this.qb && this.pass && !this.thrown && !this.scramble && this.qb.p.z > this.losZ + 0.4) { this.scramble = true; this.kind = 'scramble'; this.emit(`${this.qb.name} scrambles`, 'info'); }
    for (const p of this.O) {
      if (p === uc && this.userDriven(p)) { this.userMove(p, dt, env); continue; }
      if (c && c.unit === 'D') { this.pursueAI(p, dt, env, 'attack'); continue; }            // turnover: offense chases
      const qbHolding = p === this.qb && !this.qbRun && ((this.pass && !this.thrown && p.p.z < this.losZ + 0.5 && !this.scramble) || (!this.pass && !this.handed));
      if (p === c && this.ball.state === 'held' && !qbHolding) { this.runnerAI(p, dt, env); continue; }
      if (p === this.qb) { this.qbAI(p, dt, env); continue; }
      if (p.role === 'rb' && !this.handed) { this.rbPreAI(p, dt, env); continue; }
      if (p.role === 'route') { this.routeAI(p, dt, env); continue; }
      this.blockerAI(p, dt, env);
    }
    for (const d of this.D) {
      if (d === uc && this.userDriven(d)) { this.userMove(d, dt, env); continue; }
      if (c === d && this.ball.state === 'held') { this.runnerAI(d, dt, env); continue; }
      this.defenderAI(d, dt, env);
    }
  }
  userDriven(p) { if (!p.upright()) return false; if (p.unit === 'O') return this.userTouched || p === this.qb; return Math.hypot(this.input.x, this.input.z) > 0.18 || p.lungeT > 0; }
  // user stick: snappy cuts, auto-run forward for a carrier who lets go of the stick
  userMove(p, dt, env) {
    const inp = this.input, m = Math.hypot(inp.x, inp.z);
    if (p.lungeT > 0) { locomote(p, p.lungeVel, dt, env, { lunge: true }); slewHeading(p, Math.atan2(p.lungeDir.x, p.lungeDir.z), 8, dt); return; }
    let des;
    const qbPocket = p === this.qb && this.pass && !this.thrown && !this.scramble;
    if (m > 0.15) des = v2(inp.x / Math.max(1, m) * p.vmax * Math.min(1, m * 1.25), inp.z / Math.max(1, m) * p.vmax * Math.min(1, m * 1.25));
    else if (qbPocket) { if (this.qbStartZ === undefined) this.qbStartZ = p.p.z; if (!this.qbSetZ) this.qbSetZ = this.qbStartZ < this.losZ - 3.5 ? (this.losZ - this.qbStartZ) + 1.6 : 6.4; const dz = (this.losZ - this.qbSetZ) - p.p.z; des = Math.abs(dz) > 0.25 && this.liveT < 1.6 ? v2(0, Math.sign(dz) * Math.min(5.5, Math.abs(dz) * 4)) : v2(); }
    else if (p.unit === 'O' && p === this.carrier) { const sp = len2(p.vel); des = sp > 2 ? v2(p.vel.x / sp * p.vmax * 0.35, p.vmax) : v2(0, p.vmax); }  // let go = keep running downfield
    else des = v2();
    if (p === this.carrier) this.applyMoves(p, inp, des);
    if (p.jukeT > 0) { des = v2(p.vel.x * 0.55 + p.jukeDir.x * 4.5, p.vel.z * 0.55 + p.jukeDir.z * 4.5); const k = Math.sin(Math.PI * (1 - p.jukeT / 0.24)); p.fakeLean = v2(p.jukeDir.x * 0.28 * k, p.jukeDir.z * 0.28 * k); } else p.fakeLean = v2();
    if (p.spinT > 0) des = v2(p.vel.x * 0.8, p.vel.z * 0.8);
    if (p.bal === 'stumble') des = v2(des.x * 0.55, des.z * 0.55);
    const n = this.foes(p).filter(d => d.wrapped).length; if (n && p === this.carrier) { const k = Math.pow(0.62, n); des = v2(des.x * k, des.z * k); }
    const near = this.nearestFoe(p, 3.2);
    p.crouchT = p.truckT > 0 ? 0.6 : (p.unit === 'D' && near && near.dist < 3) ? 0.55 : near && near.dist < 2 ? 0.18 : 0.04;
    locomote(p, des, dt, env, { user: true });
    if (p.unit === 'D' && near && near.dist < 1.7 && this.carrier && near.d === this.carrier && p.cooldown <= 0 && !p.engaged && !p.bondBy && this.facing(p, this.carrier) > -0.25) this.startLunge(p, this.carrier, false);
    if (inp.tackle && p.unit === 'D') { inp.tackle = false; const cc = this.carrier; if (cc && cc.unit === 'O') { const dd = Math.hypot(cc.p.x - p.p.x, cc.p.z - p.p.z); if (dd < 3.4 && p.cooldown <= 0 && this.facing(p, cc) > -0.6) this.startLunge(p, cc, dd > 2.1); } }
    this.faceMove(p, dt, qbPocket);
  }
  faceMove(p, dt, qbPocket) {
    if (!p.upright()) return;
    if (p.spinT > 0) { p.heading = wrapAng(p.heading + p.spinSign * (2 * Math.PI / 0.5) * dt); return; }
    const s = len2(p.vel); let tgt = s > 1 ? Math.atan2(p.vel.x, p.vel.z) : p.heading;
    if (qbPocket && (s < 3.2 || p.vel.z < 0)) tgt = p.windTarget && p.windTarget.p && p.windup ? Math.atan2(p.windTarget.p.x - p.p.x, p.windTarget.p.z - p.p.z) : this.aimAt ? Math.atan2(this.aimAt.x - p.p.x, Math.max(0.5, this.aimAt.z - p.p.z)) : 0;
    if (p.unit === 'D' && this.carrier && Math.hypot(this.carrier.p.x - p.p.x, this.carrier.p.z - p.p.z) < 4 && s < 6) tgt = Math.atan2(this.carrier.p.x - p.p.x, this.carrier.p.z - p.p.z);
    slewHeading(p, tgt, Math.abs(p.yawVel) > 0.6 ? 2.5 : 9, dt);
    if (p === this.carrier) { const n = this.nearestFoe(p, 6); if (!(p === this.qb && this.pass && !this.thrown) && n) { const r = p.right(); p.ballSide = ((n.d.p.x - p.p.x) * r.x + (n.d.p.z - p.p.z) * r.z) > 0 ? -1 : 1; } p.ballSideV += (p.ballSide - p.ballSideV) * Math.min(1, dt * 7); if (Math.abs(p.ballSideV) < 0.15) p.ballSideV = 0.15 * Math.sign(p.ballSide || 1); }
  }
  // juke / spin / stiff arm / truck, from the user (inp flags) or the runner AI (want flags)
  applyMoves(c, inp, des) {
    if (!c.upright()) { inp.juke = inp.spin = inp.stiff = inp.truck = false; return; }
    const sp = len2(c.vel);
    if (inp.juke && c.jukeT <= 0 && c.spinT <= 0) {
      const vd = sp > 1 ? v2(c.vel.x / sp, c.vel.z / sp) : v2(0, c.unit === 'O' ? 1 : -1), perp = v2(-vd.z, vd.x);
      let s = Math.sign(inp.x * perp.x + inp.z * perp.z); if (Math.abs(inp.x * perp.x + inp.z * perp.z) < 0.15) s = inp.jukeSide || (this.r() < 0.5 ? 1 : -1);
      c.jukeDir = v2(-perp.x * s, -perp.z * s); c.jukeT = 0.24; this.add(c, '_jukes');
      // the man in front has to guess: elusive backs freeze him
      const b = this.nearestFoe(c, 3.6, true);
      if (b && b.d.upright() && !b.d.engaged) { const pj = 0.24 +((c.A.elu + c.A.agi) / 2 - (b.d.A.tak + b.d.A.awr) / 2) / 85 + (c.tr.includes('juke') ? 0.12 : 0) - (b.d.tr.includes('surehands_t') ? 0.1 : 0);
        if (this.r() < cl(pj, 0.06, 0.6)) { b.d.stun = Math.max(b.d.stun, 0.5); b.d.cooldown = Math.max(b.d.cooldown, 0.55); b.d.seenV = v2(-c.jukeDir.x * 4, -c.jukeDir.z * 4); this.emit(`${c.name} jukes ${b.d.name}`, 'good'); } }
    }
    if (inp.spin && c.spinT <= 0) { c.spinT = 0.5; c.spinSign = this.r() < 0.5 ? 1 : -1; }
    if (inp.stiff && c.stiffT <= 0) { c.stiffT = 0.45; const n = this.nearestFoe(c, 2.2); c.stiffTarget = n ? n.d : null; }
    if (inp.truck && c.truckT <= 0) { c.truckT = 0.7; }
    inp.juke = inp.spin = inp.stiff = inp.truck = false;
  }
  foes(p) { return p.unit === 'O' ? this.D : this.O; }
  mates(p) { return p.unit === 'O' ? this.O : this.D; }
  nearestFoe(p, maxD, ahead) {
    let best = null, bd = maxD; const dirZ = p.unit === 'O' ? 1 : -1;
    for (const d of this.foes(p)) { if (!d.upright()) continue; if (ahead && (d.p.z - p.p.z) * dirZ < -0.6) continue; const dd = Math.hypot(d.p.x - p.p.x, d.p.z - p.p.z); if (dd < bd) { bd = dd; best = d; } }
    return best ? { d: best, dist: bd } : null;
  }

  // ---------------- offense AI ----------------
  qbAI(q, dt, env) {
    if (!q.upright()) { locomote(q, v2(), dt, env); return; }
    const op = this.op, los = this.losZ;
    if (this.ball.state === 'snap') { locomote(q, v2(), dt, env); return; }
    if (op.type === 'run' && !this.qbRun) {          // hand off, then carry out the fake
      const rb = this.O.find(p => p.role === 'rb');
      if (!this.handed && rb) { const mx = (rb.p.x + q.p.x) / 2, tx = cl(mx, q.p.x - 1.2, q.p.x + 1.2); locomote(q, v2((tx - q.p.x) * 2, (q.p.z > los - 1.6 ? -2 : 0)), dt, env); slewHeading(q, Math.atan2(rb.p.x - q.p.x, rb.p.z - q.p.z), 8, dt); }
      else { const away = -this.sideX; locomote(q, v2(away * 3, -1.2), dt, env); slewHeading(q, Math.atan2(away, 0.3), 5, dt); }
      return;
    }
    if (this.qbRun && this.ball.state === 'held' && this.carrier === q) { if (this.liveT < (op.scheme === 'draw' ? 0.7 : 0.3)) { locomote(q, v2(0, -1.5), dt, env); return; } this.runnerAI(q, dt, env); return; }
    if (this.thrown || this.carrier !== q) { locomote(q, v2(q.vel.x * 0.3, q.vel.z * 0.3), dt, env); return; }
    // pocket passer
    if (this.qbStartZ === undefined) this.qbStartZ = q.p.z;
    const setZ = this.qbSetZ = this.qbSetZ || (this.qbStartZ < los - 3.5 ? (los - this.qbStartZ) + (op.deep ? 2.0 : 1.4) : (op.deep ? 7.0 : 6.0));
    const dz = (los - setZ) - q.p.z;
    if (op.pa && this.liveT < 0.65) { locomote(q, v2(-this.sideX * 1.2, -1.5), dt, env); slewHeading(q, Math.atan2(-this.sideX, -0.4), 7, dt); return; }
    if (q.windup) { locomote(q, v2(q.vel.x * 0.4, q.vel.z * 0.4), dt, env); slewHeading(q, q.windTarget && q.windTarget.p ? Math.atan2(q.windTarget.p.x - q.p.x, q.windTarget.p.z - q.p.z) : 0, 9, dt); return; }
    // slide away from pressure
    let px = 0, pz = 0; for (const d of this.D) { if (d.bondBy || !d.upright()) continue; const dd = Math.hypot(d.p.x - q.p.x, d.p.z - q.p.z); if (dd < 4) { px += (q.p.x - d.p.x) / dd / dd; pz += (q.p.z - d.p.z) / dd / dd; } }
    let des = Math.abs(dz) > 0.25 && this.liveT < 1.5 ? v2(0, Math.sign(dz) * Math.min(5.5, Math.abs(dz) * 4)) : v2(px * 2.4, pz * 1.2);
    locomote(q, des, dt, env); slewHeading(q, 0, 6, dt); q.crouchT = 0.12;
    if (this.userSide === 'O') return;                           // user throws by tapping receivers
    this.qbRead(q);
  }
  // progression: primary reads in order, then check-down; pressure speeds it up; sack-avoidance
  qbRead(q) {
    const awr = q.A.awr, op = this.op;
    // the drop sets the clock: quick game is out in ~1 s, a normal read starts after a full drop, deep shots and play action take longer
    if (this.quickGame === undefined) this.quickGame = !op.pa && !op.deep && this.receivers.every(r => !r.deepR);
    const t0 = (op.pa ? 1.75 : op.deep ? 1.55 : this.quickGame ? 0.95 : 1.3) + (80 - awr) / 160, rt = 0.5 + (85 - awr) / 200;
    if (this.liveT < t0) return;
    if (!this.reads) { const rs = this.receivers.slice(), keys = Object.keys(op.routes || {}); rs.sort((a, b) => keys.indexOf(a.slot) - keys.indexOf(b.slot)); const check = rs.filter(r => ['RB', 'FB'].includes(r.slot) || /flat|drag|angle|screen/.test(r.routeName || '')); this.reads = { main: rs.filter(r => !check.includes(r)).slice(0, 3), check: check.length ? check : rs.slice(-1) }; }
    const pr = this.pressureOn(q), pressured = pr < 1.8, idx = Math.floor((this.liveT - t0) / rt), need = -0.45 - awr / 400, wt = cl(0.3 - awr / 650, 0.12, 0.28);
    if (q.windup || this.D.some(d => d.wrapped)) return;
    // receivers are thrown to in rhythm: at the top of the last break, not while they are still stemming; vertical routes need time to clear
    const ready = r => { const n = r.route ? r.route.length : 0; if (r.routeName === 'screen' || r.routeName === 'flat') return true; if (r.deepR && this.liveT < 2.05) return false; if (n <= 1) return this.liveT > (r.deepR ? 2.1 : 1.3); return r.ri >= n - 1; };
    // a longer ball hangs in the air, so it needs a bigger window; a QB under duress sees less
    const tryR = (r, th, any) => { if (!r || !r.upright() || (!any && !ready(r))) return false; const o = this.openness(q, r); if (o.d > this.maxThrow(q)) return false; const deepK = Math.max(0, o.d - 15) * 0.12; if (o.open >= th + deepK) { q.windup = wt; q.windTarget = r; q.throwAnim = 0.45; return true; } return false; };
    if (op.name && /Screen/.test(op.name)) { const s = this.receivers.find(r => r.routeName === 'screen'); if (s && this.liveT > t0 + 0.25 && tryR(s, 0.6)) return; }
    if (idx < this.reads.main.length && !pressured) { if (tryR(this.reads.main[idx], need)) return; }
    if (pressured || idx >= this.reads.main.length) {
      for (const r of this.reads.check) if (tryR(r, pressured ? -0.4 : -0.6, pressured)) return;
      for (const r of this.reads.main) if (tryR(r, pressured ? 0.2 : -0.3, false)) return;
      if (pressured && q.A.spd > 72 && this.r() < 0.025 * (q.A.spd - 60) / 20) { this.scramble = true; this.emit(`${q.name} takes off`, 'info'); return; }
      // nothing there: smart QBs throw it away, others hold on and take the sack; nobody forces it into coverage
      if (this.liveT > 4.6 || pr < 0.95) { if (q.bailT === undefined) q.bailT = this.r() < 0.25 + awr / 200 ? 0 : 9;
        if (q.bailT === 0) { q.windup = wt; q.windTarget = 'away'; q.throwAnim = 0.45; } }
    }
  }
  windupStep(q, dt) {
    if (!q.upright() || this.thrown || this.carrier !== q) { q.windup = 0; return; }
    if (this.D.some(d => d.wrapped && d.gripT > 0.12)) { q.windup = 0; q.throwAnim = 0; return; }        // wrapped up: the throw never comes out
    // the defense reads the throwing motion: note where it is going so the nearest defenders can break before the release
    if (!this.windSpot && q.windTarget && q.windTarget.spot) { this.windSpot = v2(q.windTarget.p.x, q.windTarget.p.z); this.windT = this.t; }
    if (!this.windSpot && q.windTarget && q.windTarget !== 'away' && q.windTarget.p) { const r = q.windTarget, d0 = Math.hypot(r.p.x - q.p.x, r.p.z - q.p.z); this.windSpot = this.predictRoute(r, d0 / (q.arm * 0.9) + q.windup); this.windT = this.t; }
    q.windup -= dt; q.vel.x *= Math.exp(-dt * 6); q.vel.z *= Math.exp(-dt * 6);
    if (q.windup <= 0) { q.windup = 0; if (q.windTarget === 'away') this.throwAway(q); else if (q.windTarget && q.windTarget.spot) this.launchSpot(q.windTarget.p); else if (q.windTarget) this.launch(q.windTarget); }
  }
  pressureOn(q) { let m = 99; for (const d of this.D) { if (d.bondBy || !d.upright()) continue; m = Math.min(m, Math.hypot(d.p.x - q.p.x, d.p.z - q.p.z)); } return m; }
  // the window: how far short of the catch point the closest defender still is when the ball gets there, if he breaks on it now
  openness(q, r) { if (!r.upright()) return { open: -9, d: 99, f: v2(r.p.x, r.p.z) }; let d = Math.hypot(r.p.x - q.p.x, r.p.z - q.p.z), T = d / (q.arm * 0.9), f = this.predictRoute(r, T); d = Math.hypot(f.x - q.p.x, f.z - q.p.z); T = d / (q.arm * 0.9); f = this.predictRoute(r, T);
    let open = 99; for (const df of this.D) { if ((df.job === 'rush' && !df.zone) || df.bondBy || !df.upright()) continue; const gx = f.x - df.p.x, gz = f.z - df.p.z, gap = Math.hypot(gx, gz) || 1e-6, vTo = Math.max(0, (df.vel.x * gx + df.vel.z * gz) / gap), run = vTo * Math.min(T, 0.3) + df.vmax * Math.max(0, T - 0.3) * 0.92, o = gap - run; if (o < open) open = o; }
    const edge = Math.abs(f.x) - (FIELD.halfW - 2.5); if (edge > 0) open -= edge * 1.5;      // running out of room at the sideline
    return { open, d, f }; }
  maxThrow(q) { return q.range || cl(q.arm * 2.3, 30, 68); }
  // quick release from awareness (a 50 holds it ~0.07 s longer than a 95)
  windupFor(q) { return cl(0.25 - q.A.awr * 0.0015, 0.1, 0.22); }
  // how far a throw strays: distance, accuracy rating, a throw at the edge of his arm, pressure (awareness keeps him calm), throwing on the move
  throwSigma(q, d, pressure, user) {
    const A = q.A, gen = q.tr.includes('general') ? 0.65 : 1, base = 0.22 + d * 0.024 + Math.max(0, d - 24) * 0.017, strain = 1 + Math.max(0, d / (q.range || 55) - 0.78) * 1.6;
    const press = 1 + pressure * cl(1.95 - A.awr / 100, 0.9, 1.6) * gen, moving = len2(q.vel) > 3 ? 1.08 + Math.max(0, 88 - A.tha) / 110 + Math.max(0, 80 - A.awr) / 250 : 1;
    return base * (q.accK || 0.9) * strain * press * moving * (user ? 0.75 : 1);
  }
  pressureOn(q) { let pressure = 0; for (const d of this.D) { if (d.bondBy || !d.upright()) continue; const dd = Math.hypot(d.p.x - q.p.x, d.p.z - q.p.z); if (dd < 3) pressure = Math.max(pressure, 1 - dd / 3); } return pressure; }
  rbPreAI(rb, dt, env) {
    const q = this.qb, op = this.op;
    if (op.delay && this.liveT < 0.9) { locomote(rb, v2(), dt, env); rb.crouchT = 0.3; return; }
    if (this.ball.state !== 'held' || this.carrier !== q) { locomote(rb, v2(), dt, env); return; }
    // from the gun the mesh is already downhill (in front of the QB, at speed); under center it is a softer exchange
    const gun = q.p.z < this.losZ - 3.5, tx = q.p.x + (this.gapX > q.p.x ? 0.55 : -0.55), tz = q.p.z + (gun ? 0.55 : 0.35), dx = tx - rb.p.x, dz = tz - rb.p.z, m = Math.hypot(dx, dz) || 1, cap = rb.vmax * (gun ? 0.95 : 0.88);
    locomote(rb, v2(dx / m * Math.min(cap, m * 4 + 2), dz / m * Math.min(cap, m * 4 + 2)), dt, env); slewHeading(rb, Math.atan2(this.gapX - rb.p.x, this.losZ - rb.p.z), 8, dt);
    if (Math.hypot(rb.p.x - q.p.x, rb.p.z - q.p.z) < 1.2 && this.liveT > 0.1) { this.handed = true; this.carrier = rb; rb.role = 'carrier'; this.ball.state = 'held'; this.kind = 'run'; rb.ballSide = this.gapX > rb.p.x ? -1 : 1;
      for (const d of this.D) d.runRead = this.t + d.recog * (this.op.pa ? 1.6 : 1); }
  }
  // ball carrier AI: design gap behind the line, then field vision in the open
  runnerAI(c, dt, env) {
    const dirZ = c.unit === 'O' ? 1 : -1, los = this.losZ, inp = c._ai || (c._ai = { juke: false, spin: false, stiff: false, truck: false, x: 0, z: 0 });
    let des;
    const behind = c.unit === 'O' && this.kind === 'run' && c.p.z < los + 0.6 && !this.thrown;
    if (behind && c !== this.qb) { this.readGap(c); const tx = this.holeX, tz = los + 1.5, dx = tx - c.p.x, dz = Math.max(0.6, tz - c.p.z), m = Math.hypot(dx, dz) || 1; des = v2(dx / m * c.vmax, dz / m * c.vmax); }
    else {
      const want = this.o.lateTrail && c.unit === 'O' && (c.p.z - los) > 2;
      c.aiT = (c.aiT || 0) - dt;
      if (c.aiT <= 0 || !c.aiDir) { c.aiT = 0.15; c.aiDir = this.bestLane(c, dirZ, want); }
      des = v2(c.aiDir.x * c.vmax, c.aiDir.z * c.vmax);
    }
    // moves when contact is coming
    const n = this.nearestFoe(c, 2.6, true);
    if (n && c.upright() && c.moveCd <= 0 && !n.d.bondBy) {
      c.moveCd = 0.3; const A = c.A, skill = (A.awr + A.elu) / 200;
      if (this.r() < 0.28 + 0.3 * skill) {
        const power = (A.btk + A.str) / 2, shift = (A.elu + A.agi) / 2, r = this.r();
        if (shift > power + 4 ? r < 0.7 : r < 0.3) { inp.juke = true; inp.jukeSide = Math.sign((c.p.x - n.d.p.x) * dirZ) || 1; }
        else if (c.posName !== 'QB' && r < 0.85) { if (power > 75 && n.dist < 1.8) inp.truck = true; else inp.stiff = true; }
        else if (A.agi > 78) inp.spin = true;
      }
    }
    this.applyMoves(c, inp, des);
    if (c.jukeT > 0) { des = v2(c.vel.x * 0.55 + c.jukeDir.x * 4.5, c.vel.z * 0.55 + c.jukeDir.z * 4.5); const k = Math.sin(Math.PI * (1 - c.jukeT / 0.24)); c.fakeLean = v2(c.jukeDir.x * 0.28 * k, c.jukeDir.z * 0.28 * k); } else c.fakeLean = v2();
    if (c.spinT > 0) des = v2(c.vel.x * 0.8, c.vel.z * 0.8);
    if (c.bal === 'stumble') des = v2(des.x * 0.55, des.z * 0.55);
    const nw = this.foes(c).filter(d => d.wrapped).length; if (nw) { const k = Math.pow(0.62, nw); des = v2(des.x * k, des.z * k); }
    c.crouchT = c.truckT > 0 ? 0.6 : n && n.dist < 2 ? 0.18 : 0.03;
    { const cap = c.vmax * 0.96, m = len2(des); if (m > cap) des = v2(des.x / m * cap, des.z / m * cap); }     // the ball in one arm costs a little top speed
    locomote(c, des, dt, env); this.faceMove(c, dt, false);
  }
  readGap(c) {
    this.nextGap = this.nextGap || 0; if (this.t < this.nextGap) return; this.nextGap = this.t + 0.12;
    const bx = this.ballX, cands = [this.gapX]; for (const g of Object.values(GAPS)) cands.push(bx + g * YD, bx - g * YD);
    const vis = c.A.awr; let best = this.holeX, bs = -1e9;
    for (const gx of cands) { if (Math.abs(gx) > FIELD.halfW - 1) continue; const px = this.losZ + 0.8; let open = 6;
      for (const d of this.D) { const dd = Math.hypot(d.p.x - gx, d.p.z - px); open = Math.min(open, dd / (d.bondBy ? 2.2 : 1)); }
      const sc = open - Math.abs(gx - c.p.x) * 0.25 + (Math.abs(gx - this.gapX) < 0.5 ? 1.0 : 0) + this.gauss() * (100 - vis) / 50;
      if (sc > bs) { bs = sc; best = gx; } }
    this.holeX += (best - this.holeX) * 0.35;
  }
  // open-field vision: try headings toward the goal and pick the one with the most room
  bestLane(c, dirZ, wantOOB) {
    // human vision: he sees what is in front of him (and anyone close), and his read is only as good as his awareness/elusiveness
    const fx0 = len2(c.vel) > 1 ? c.vel.x / len2(c.vel) : 0, fz0 = len2(c.vel) > 1 ? c.vel.z / len2(c.vel) : dirZ;
    const foes = this.foes(c).filter(d => { if (!d.upright() || d.bondBy) return false; const ex = d.p.x - c.p.x, ez = d.p.z - c.p.z, dd = Math.hypot(ex, ez); return dd < 3.2 || (ex * fx0 + ez * fz0) > -0.35 * dd; }), prev = c.aiDir; let best = null, bs = -1e9;
    const noise = Math.max(0.1, (96 - (c.A.awr + c.A.elu) / 2) / 60);
    for (let i = -6; i <= 6; i++) {
      const a = i * 0.24, ux = Math.sin(a), uz = Math.cos(a) * dirZ; let sc = uz * dirZ * 1.6 + (prev ? (ux * prev.x + uz * prev.z) * 0.5 : 0) + this.gauss() * noise;
      for (const tau of [0.35, 0.8]) { const px = c.p.x + ux * c.vmax * tau, pz = c.p.z + uz * c.vmax * tau;
        if (Math.abs(px) > FIELD.halfW - 1.2) sc -= wantOOB ? -2 : 3;
        for (const d of foes) { const m = Math.hypot(d.p.x - px, d.p.z - pz) - d.vmax * tau * 0.95; if (m < 1.8) sc -= (1.8 - m) * (tau < 0.5 ? 1.2 : 0.7); } }
      if (wantOOB) sc += Math.abs(ux) * Math.sign(ux) * Math.sign(c.p.x || 1) * 1.5;
      if (sc > bs) { bs = sc; best = v2(ux, uz); }
    }
    return best || v2(0, dirZ);
  }
  routeAI(r, dt, env) {
    if (!r.upright()) { locomote(r, v2(), dt, env); return; }
    r.crouchT = 0.05; const B = this.ball;
    if (this.ball.state === 'snap' && r.jam > 0) { locomote(r, v2(), dt, env); return; }
    if (this.playsBall(r)) { this.trackBall(r, dt, env); return; }
    if ((this.thrown && !this.air && this.carrier !== r && this.carrier && this.carrier.unit === 'O') || (this.handed && this.kind === 'run')) { this.blockerAI(r, dt, env); return; }
    if (this.scramble && this.carrier === this.qb) { this.scrambleDrill(r, dt, env); return; }
    if (r.jam > 0 && this.liveT < r.jam) { const d = this.D.find(x => x.cover === r); locomote(r, v2(0, 0.8), dt, env); if (d) d.vel.x *= 0.9; return; }
    let des;
    if (r.ri < r.route.length) {
      const w = r.route[r.ri], dx = w.x - r.p.x, dz = w.z - r.p.z, d = Math.hypot(dx, dz) || 1e-6, nxt = r.route[r.ri + 1], sp = len2(r.vel); let vT = r.vmax;
      if (nxt) { const ax = nxt.x - w.x, az = nxt.z - w.z, am = Math.hypot(ax, az) || 1, cosT = (dx * ax + dz * az) / (d * am), sharp = (r.A.rte - 60) / 40;
        const vBreak = (cosT < 0 ? 3.6 : cosT < 0.5 ? 5.2 : cosT < 0.8 ? 7.2 : r.vmax) * (1 + 0.12 * cl(sharp, -1, 1)); const brake = (sp * sp - vBreak * vBreak) / (2 * 8.5); if (d < brake + 0.6) vT = vBreak; }
      else if (r.settle) vT = Math.min(r.vmax, d * 2.2 + 1);
      des = v2(dx / d * vT, dz / d * vT); if (d < (nxt ? 0.7 : 0.5)) r.ri++;
    } else if (r.settle) { this.settleSpot(r, dt, env); return; }
    else if (r.deepR && r.p.z > FIELD.goalZ - 0.5) { this.findSpace(r, dt, env, FIELD.goalZ + 1, FIELD.goalZ + 8.5); return; }
    else { const n = r.route.length, a = n >= 1 ? r.route[n - 1] : r.p, b0 = n >= 2 ? r.route[n - 2] : (r.start || v2(a.x, a.z - 1)); let ex = a.x - b0.x, ez = a.z - b0.z; const em = Math.hypot(ex, ez) || 1; ex /= em; ez /= em;
      if (Math.abs(r.p.x) > FIELD.halfW - 2 && ex * r.p.x > 0) { ex = 0; ez = 1; }        // out of room: turn upfield along the sideline
      des = v2(ex * r.vmax, ez * r.vmax);                                                   // otherwise keep running the last leg (that is where the QB leads him)
      if (this.liveT > 3.2 && !r.deepR) { this.findSpace(r, dt, env, Math.max(this.losZ + 3, r.p.z - 4), r.p.z + 4); return; } }     // a go / post / fade / seam keeps running: the QB can still put it out in front of him
    locomote(r, this.aroundCarrier(r, des), dt, env); if (len2(r.vel) > 1.5) slewHeading(r, Math.atan2(r.vel.x, r.vel.z), 9, dt);
  }
  settleSpot(r, dt, env) {     // sit in the window, slide away from the closest defender
    let px = 0; for (const d of this.D) { const dd = Math.hypot(d.p.x - r.p.x, d.p.z - r.p.z); if (dd < 3.5) px += (r.p.x - d.p.x) / (dd * dd + 0.2); }
    locomote(r, v2(cl(px * 3, -3, 3), 0), dt, env); slewHeading(r, Math.atan2(this.qb.p.x - r.p.x, this.qb.p.z - r.p.z), 6, dt);
  }
  findSpace(r, dt, env, z0, z1) {
    r.fsT = (r.fsT || 0) - dt;
    if (r.fsT <= 0 || !r.fsSpot) { r.fsT = 0.7; let best = null, bs = -1; for (let i = 0; i < 12; i++) { const s = v2(cl(r.p.x + (this.r() - 0.5) * 12, -FIELD.halfW + 1.5, FIELD.halfW - 1.5), lp(z0, z1, this.r())); let m = 99; for (const d of this.D) m = Math.min(m, Math.hypot(d.p.x - s.x, d.p.z - s.z)); if (m > bs) { bs = m; best = s; } } r.fsSpot = best; }
    const dx = r.fsSpot.x - r.p.x, dz = r.fsSpot.z - r.p.z, m = Math.hypot(dx, dz) || 1, sp = Math.min(r.vmax * 0.8, m * 3);
    locomote(r, v2(dx / m * sp, dz / m * sp), dt, env); slewHeading(r, Math.atan2(this.qb.p.x - r.p.x, this.qb.p.z - r.p.z), 6, dt);
  }
  scrambleDrill(r, dt, env) { this.findSpace(r, dt, env, Math.max(this.losZ + 2, this.qb.p.z + 4), this.qb.p.z + 16); }
  // ---------------- blocking ----------------
  blockerAI(b, dt, env) {
    if (!b.upright()) { locomote(b, v2(), dt, env); return; }
    const c = this.carrier;
    if (this.ball.state === 'snap' && b.ol) { locomote(b, v2(0, 0.6), dt, env); b.crouchT = 0.5; return; }
    const passPro = this.pass && !this.thrown && c === this.qb && !this.scramble && !(this.op.name && /Screen/.test(this.op.name) && this.liveT > 1.3);
    if (passPro || (b.asg && b.asg.t === 'draw' && this.liveT < 0.9)) return this.passPro(b, dt, env);
    let t = b.bond;
    if (t) {      // engaged: drive him along the assignment, then away from the runner
      const ax = t.p.x - b.p.x, az = t.p.z - b.p.z, am = Math.hypot(ax, az) || 1;
      let ux = b.asgX || 0, uz = 0.9; if (b.asg && b.asg.t === 'drive') ux = this.kind === 'run' ? (Math.sign(t.p.x - this.holeX) || 1) * 0.7 : ux * 0.2;     // base block: turn him away from the hole
      if (b.asg && (b.asg.t === 'pull' || b.asg.t === 'lead')) ux = Math.sign(t.p.x - this.holeX) || ux;
      if (c && this.bondAge(t) > 0.9) { const awX = t.p.x - c.p.x, awZ = t.p.z - c.p.z, aw = Math.hypot(awX, awZ) || 1; ux = ux * 0.4 + awX / aw * 0.6; uz = uz * 0.4 + awZ / aw * 0.6; }
      const dx = ax / am * 0.55 + ux * 0.45, dz = az / am * 0.55 + uz * 0.45, dm = Math.hypot(dx, dz) || 1;
      locomote(b, v2(dx / dm * 2.3, dz / dm * 2.3), dt, env); b.crouchT = 0.45; slewHeading(b, Math.atan2(ax, az), 6, dt); return;
    }
    if (!b.assign || !b.assign.upright() || b.assign.bondBy || b.assign.wrapped || (b.assign.shedCd > 0 && b.assign.lastShedBy === b)) b.assign = this.pickBlockTarget(b);
    t = b.assign; let tx, tz;
    const a = b.asg || { t: 'drive' };
    if (a.t === 'pull' && this.liveT < 0.95) { tx = b.p.x + this.sideX * 5.5; tz = this.losZ - 1.1; }
    else if (t) { const rc = c || this.qb, dz = rc.p.z - t.p.z, dx = rc.p.x - t.p.x, dm = Math.hypot(dx, dz) || 1; tx = t.p.x + dx / dm * 0.5; tz = t.p.z + dz / dm * 0.5; if (t.p.z > b.p.z) tz = Math.max(tz, b.p.z + 0.25); }
    else { const rc = c || this.qb; tx = rc.p.x + this.sideX * 1.5; tz = rc.p.z + 3; }
    const mx = tx - b.p.x, mz = tz - b.p.z, mm = Math.hypot(mx, mz) || 1, sp = Math.min(b.vmax, mm * 4);
    locomote(b, this.aroundCarrier(b, v2(mx / mm * sp, mz / mm * sp)), dt, env); b.crouchT = t && mm < 3 ? 0.42 : 0.15;
    if (t) slewHeading(b, Math.atan2(t.p.x - b.p.x, t.p.z - b.p.z), 7, dt); else if (len2(b.vel) > 1) slewHeading(b, Math.atan2(b.vel.x, b.vel.z), 7, dt);
  }
  bondAge(d) { return d.bondT || 0; }
  // technique-aware target choice (zone/reach go playside, down blocks go inside, climb goes to the second level)
  pickBlockTarget(b) {
    const a = b.asg || { t: 'drive', d: 0 }, sX = b.asgX || 0, rc = this.carrier || this.qb; let best = null, bv = 1e9;
    for (const d of this.D) {
      if (!d.upright() || d.bondBy || d.wrapped || (d.shedCd > 0 && d.lastShedBy === b)) continue;
      const lat = d.p.x - b.p.x, fw = d.p.z - b.p.z; if (fw < (a.t === 'ret' ? -4 : -2.2) || fw > (a.t === 'stalk' || a.t === 'lead' || a.t === 'ret' ? 25 : 9)) continue;
      let ok = true, sc = Math.hypot(lat, fw);
      if (a.t === 'drive') ok = Math.abs(lat) < 2.2 || !d.dl;
      else if (a.t === 'zone' || a.t === 'reach') { ok = lat * sX > -0.8 && lat * sX < 3.2; sc += lat * sX < 0 ? 2 : 0; }
      else if (a.t === 'down') ok = lat * sX > 0.2 && lat * sX < 3.6;
      else if (a.t === 'climb') { ok = !d.dl; sc = Math.abs(lat) + fw * 0.3; }
      else if (a.t === 'ret') { ok = true; sc = Math.hypot(lat, fw) + Math.hypot(d.p.x - rc.p.x, d.p.z - rc.p.z) * 0.25; }
      else if (a.t === 'stalk') { ok = d.posName === 'CB' || d.posName === 'S' || d.job === 'man' || d.job === 'zone'; sc = Math.hypot(lat, fw) + Math.hypot(d.p.x - rc.p.x, d.p.z - rc.p.z) * 0.15; }
      else if (a.t === 'lead' || a.t === 'pull') { sc = Math.hypot(d.p.x - this.holeX, d.p.z - this.losZ) * 1.2 + Math.hypot(lat, fw) * 0.4; ok = !d.dl || Math.abs(d.p.x - this.holeX) < 3; }
      if (!ok) continue; if (d.p.z > this.losZ + 3.5 && a.t !== 'climb' && a.t !== 'stalk' && a.t !== 'lead') sc += 3;
      if (this.O.some(o => o !== b && o.assign === d)) sc += 4;
      if (sc < bv) { bv = sc; best = d; }
    }
    if (!best && a.t !== 'climb' && a.t !== 'stalk') return this.pickBlockTarget(Object.assign(Object.create(Object.getPrototypeOf(b)), b, { asg: { t: 'climb', d: 0 } }));
    return best;
  }
  passPro(b, dt, env) {
    const q = this.qb, los = this.losZ, go = (x, z, cap) => { const mx = x - b.p.x, mz = z - b.p.z, mm = Math.hypot(mx, mz); const sp = Math.min(cap, mm * 5); locomote(b, this.aroundCarrier(b, mm > 0.04 ? v2(mx / mm * sp, mz / mm * sp) : v2()), dt, env); };
    if (this.ball.state === 'snap') { const inLane = !b.ol && Math.abs(b.p.x - q.p.x) < 0.9 && b.p.z < q.p.z;      // a back lined up right behind the QB clears the drop lane first
      locomote(b, inLane ? v2((Math.sign(b.p.x - q.p.x) || this.sideX || 1) * 3.2, 0) : v2(0, -0.5), dt, env); b.crouchT = 0.5; return; }
    if (b.bond) { const t = b.bond, ux = q.p.x - t.p.x, uz = q.p.z - t.p.z, m = Math.hypot(ux, uz) || 1; go(t.p.x + ux / m * 0.72, t.p.z + uz / m * 0.72, 4); b.crouchT = 0.5; slewHeading(b, Math.atan2(-ux, -uz), 6, dt); return; }
    let t = b.passT;
    if (t && ((t.bondBy && t.bondBy !== b) || !t.upright() || t.p.z < q.p.z - 1 || (t.shedCd > 0 && t.lastShedBy === b))) t = null;
    if (!t) { let best = null, bd = 1e9; for (const d of this.D) { if (d.job !== 'rush' || d.bondBy || !d.upright()) continue; const lat = Math.abs(d.p.x - b.p.x); if (lat > (b.ol ? 3.2 : 5)) continue; if (this.O.some(o => o !== b && o.passT === d && !o.bond)) continue; const dd = Math.hypot(d.p.x - b.p.x, d.p.z - b.p.z) + lat * 1.8; if (dd < bd) { bd = dd; best = d; } } t = best; }
    b.passT = t;
    if (!t && b.ol && this.liveT > 0.35) { let h = null, hd = 2.8; for (const d of this.D) { if (!d.bondBy || d.bondBy === b || d.helper) continue; const dd = Math.hypot(d.p.x - b.p.x, d.p.z - b.p.z); if (dd < hd) { hd = dd; h = d; } }
      if (h) { h.helper = b; b.help = h; const side = Math.sign(h.p.x - q.p.x) || 1; go(h.p.x - side * 0.55, h.p.z - 0.65, 4); b.crouchT = 0.5; return; } }
    if (!t && !b.ol && b.role === 'pp' && this.liveT > 1.3) { b.role = 'route'; b.routeName = 'flat'; this.buildRoute(b); this.receivers.push(b);   // nobody came: release to the flat
      // the defender with eyes on the backfield picks him up: a spy / hook player in man, the nearest underneath zone defender otherwise
      const pk = this.D.filter(x => x.upright() && !x.bondBy && (x.job === 'spy' || (x.zone && !x.zone.deep) || (x.job === 'rush' && !x.dl && Math.hypot(x.p.x - b.p.x, x.p.z - b.p.z) < 5))).sort((a, c2) => Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z) - Math.hypot(c2.p.x - b.p.x, c2.p.z - b.p.z))[0];
      if (pk && (pk.job === 'spy' || pk.job === 'rush')) { pk.job = 'man'; pk.cover = b; pk.cush = 1.5; }
      return; }
    if (t) { const ux = q.p.x - t.p.x, uz = q.p.z - t.p.z, m = Math.hypot(ux, uz) || 1; let sx = t.p.x + ux / m * 1.0, sz = t.p.z + uz / m * 1.0;
      if (t.edge && t.rushMove === 'speed') { sx = t.p.x + (q.p.x - t.p.x) * 0.12; sz = Math.min(sz, t.p.z - 0.6); }
      sz = cl(sz, q.p.z + 0.9, los + 0.2); go(sx, sz, b.vmax); b.crouchT = 0.45; slewHeading(b, Math.atan2(t.p.x - b.p.x, t.p.z - b.p.z), 7, dt); }
    else if (b.ol) { go((b.homeX ?? (b.homeX = b.p.x)) * 0.85 + this.ballX * 0.15, los - 1.4, 3); b.crouchT = 0.4; slewHeading(b, 0, 5, dt); }
    else {     // a back with nobody to block yet sets up beside the QB's launch point, never in his drop lane
      const hx = b.homeX ?? (b.homeX = b.p.x), sd = Math.abs(hx - q.p.x) > 0.4 ? Math.sign(hx - q.p.x) : (this.sideX || 1);
      go(q.p.x + sd * 1.45, Math.min(los - 1.6, q.p.z + 1.0), 3.5); b.crouchT = 0.4; slewHeading(b, 0, 5, dt); }
  }

  // ---------------- defense AI ----------------
  defenderAI(d, dt, env) {
    d.shedCd = Math.max(0, (d.shedCd || 0) - dt);
    const c = this.carrier;
    if (c && c.unit === 'D' && c !== d && this.ball.state === 'held') return this.escortAI(d, dt, env);
    if (!d.upright() || d.wrapped || d.lungeT > 0 || d.bondBy || d.engaged) return this.pursueAI(d, dt, env, d.fit);
    if (this.ball.state === 'snap') { locomote(d, v2(), dt, env); return; }
    if (this.air) { if (this.t - this.throwT > (d.react || 0.25)) return this.ballAI(d, dt, env); return this.coverAI(d, dt, env); }
    if (this.ball.state === 'loose') return this.looseAI(d, dt, env);
    const qbHolds = this.pass && !this.thrown && c === this.qb && !this.qbRun;
    if (qbHolds) {
      if ((c.p.z > this.losZ + 0.5 || this.scramble) && (!d.dl || Math.hypot(c.p.x - d.p.x, c.p.z - d.p.z) < 6)) { if (!d.scrT) d.scrT = this.t + d.react; if (this.t > d.scrT) return this.pursueAI(d, dt, env, 'attack'); }
      if (this.op.pa && this.liveT < 0.6 && !d.dl && d.job !== 'rush' && (d.posName === 'LB' || d.posName === 'S')) { locomote(d, v2(-this.sideX * 1.5 * (d.A.awr < 70 ? 1 : 0.3), -1.8 * (d.A.awr < 70 ? 1 : 0.3)), dt, env); return; }
      if (d.job === 'rush') return this.rushAI(d, dt, env);
      const W = this.windSpot;
      if (W && this.t - this.windT > d.react * 0.8 + (80 - d.A.awr) / 400) { const wx = W.x - d.p.x, wz = W.z + 0.7 - d.p.z, wm = Math.hypot(wx, wz) || 1;
        if (wm < 13) { const sp = wm > 1 ? d.vmax : wm * 3; locomote(d, v2(wx / wm * sp, wz / wm * sp), dt, env); slewHeading(d, Math.atan2(wx, wz), 8, dt); d.crouchT = 0.08; return; } }
      if (d.job === 'spy') return this.spyAI(d, dt, env);
      return this.coverAI(d, dt, env);
    }
    // run (or catch made): read, fit, pursue
    // a draw shows pass first: the rush goes upfield and the linebackers drop until they see the handoff
    if (!this.handed && this.kind === 'run' && !this.qbRun && (this.op.scheme === 'draw' || this.op.delay)) return d.job === 'rush' || d.dl ? this.rushAI(d, dt, env, false) : this.coverAI(d, dt, env);
    if (!this.handed && this.kind === 'run' && !this.qbRun) {     // mesh point: linebackers flow with the backfield, line attacks gaps
      if (d.dl) return this.rushAI(d, dt, env, true);
      if (this.t > (d.flowT || (d.flowT = this.t + d.recog * 0.8))) return this.flowAI(d, dt, env);
      return d.job === 'man' || d.job === 'zone' ? this.coverAI(d, dt, env) : this.flowAI(d, dt, env);
    }
    const readAt = d.runRead || (d.runRead = this.t + (this.catchT ? 0.12 : d.recog));
    if (this.t < readAt) { if (this.catchT) { locomote(d, v2(d.vel.x * 0.97, d.vel.z * 0.97), dt, env); return; }   // the beat after a catch: he carries his momentum, he doesn't go back to his zone
      return d.job === 'rush' ? this.rushAI(d, dt, env, true) : this.coverAI(d, dt, env); }
    // after a catch there are no run fits: everyone runs to the ball; a deep safety still keeps the top on (alley) until he is close
    if (!d.fit) d.fit = this.catchT ? (d.posName === 'S' && (d.p.z - c.p.z) > 6 ? 'alley' : 'attack') : this.assignFit(d);
    return this.pursueAI(d, dt, env, d.fit);
  }
  // run-fit roles once the run is read: edge keeps contain, safeties fill the alley, backside watches the cutback
  assignFit(d) {
    const c = this.carrier; if (!c) return 'attack'; const dirZ = c.unit === 'O' ? 1 : -1;
    if (c.unit !== 'O') return 'attack';
    const ps = Math.sign((c.p.x - this.ballX) || this.sideX) || this.sideX;
    if (!this.fits) {
      this.fits = new Map();
      const front = this.D.filter(x => x.upright() && Math.abs(x.p.z - this.losZ) < 7 && x.posName !== 'S');
      const playEdge = front.filter(x => (x.p.x - this.ballX) * ps > 0).sort((a, b) => (b.p.x - a.p.x) * ps)[0];
      const backEdge = front.filter(x => (x.p.x - this.ballX) * ps < 0).sort((a, b) => (a.p.x - b.p.x) * ps)[0];
      if (playEdge) this.fits.set(playEdge, 'contain'); if (backEdge) this.fits.set(backEdge, 'cutback');
      const saf = this.D.filter(x => x.posName === 'S').sort((a, b) => b.p.z - a.p.z); if (saf[0]) this.fits.set(saf[0], 'alley'); if (saf[1]) this.fits.set(saf[1], 'alley');
      for (const x of this.D) if (x.posName === 'LB' && !this.fits.has(x)) this.fits.set(x, 'fill');
    }
    return this.fits.get(d) || 'attack';
  }
  escortAI(d, dt, env) {     // after a takeaway: get between the returner and the nearest chaser
    const c = this.carrier; if (!d.upright()) { locomote(d, v2(), dt, env); return; }
    let best = null, bd = 1e9; for (const o of this.O) { if (!o.upright()) continue; const dc = Math.hypot(o.p.x - c.p.x, o.p.z - c.p.z), de = Math.hypot(o.p.x - d.p.x, o.p.z - d.p.z); if (de > 12) continue; const v = de + dc * 0.6; if (v < bd) { bd = v; best = o; } }
    let tx, tz; if (best) { const ux = c.p.x - best.p.x, uz = c.p.z - best.p.z, m = Math.hypot(ux, uz) || 1; tx = best.p.x + ux / m * 0.8; tz = best.p.z + uz / m * 0.8; } else { tx = c.p.x + (d.p.x - c.p.x) * 0.5; tz = c.p.z - 3; }
    const dx = tx - d.p.x, dz = tz - d.p.z, m = Math.hypot(dx, dz) || 1; locomote(d, v2(dx / m * Math.min(d.vmax, m * 4), dz / m * Math.min(d.vmax, m * 4)), dt, env); d.crouchT = 0.35; if (len2(d.vel) > 1) slewHeading(d, Math.atan2(d.vel.x, d.vel.z), 7, dt);
  }
  flowAI(d, dt, env) {     // read-step with the backfield, stay square, don't overrun
    const rb = this.O.find(p => p.role === 'rb') || this.qb, tx = lp(d.p.x, this.gapX, 0.5), tz = Math.max(this.losZ + 2.5, d.p.z - 1);
    const dx = tx - d.p.x, dz = tz - d.p.z, m = Math.hypot(dx, dz) || 1, sp = Math.min(d.vmax * 0.55, m * 2.5);
    locomote(d, v2(dx / m * sp, dz / m * sp), dt, env); d.crouchT = 0.35; slewHeading(d, Math.atan2(rb.p.x - d.p.x, rb.p.z - d.p.z), 6, dt);
  }
  rushAI(d, dt, env, runRead) {
    const q = this.carrier && this.carrier.unit === 'O' ? this.carrier : this.qb, dx = q.p.x - d.p.x, dz = q.p.z - d.p.z, dist = Math.hypot(dx, dz) || 1;
    if (dist < 2.4) return this.pursueAI(d, dt, env, 'attack');
    let tx = q.p.x, tz = q.p.z;
    if (runRead) { tx = lp(d.p.x, this.carrier.p.x, 0.35); tz = this.losZ - 0.6; }      // play the gap, don't fly upfield past the run
    else if (d.edge && d.rushMove === 'speed' && d.p.z > q.p.z + 1.2) { const out = Math.sign(d.p.x - q.p.x) || 1; tx = q.p.x + out * 2.4; tz = q.p.z - 0.4; }
    const mx = tx - d.p.x, mz = tz - d.p.z, mm = Math.hypot(mx, mz) || 1, sp = runRead ? Math.min(d.vmax, mm * 3 + 1) : d.vmax;
    locomote(d, v2(mx / mm * sp, mz / mm * sp), dt, env); d.crouchT = this.liveT < 0.6 ? 0.45 : 0.25; slewHeading(d, Math.atan2(dx, dz), 8, dt);
  }
  spyAI(d, dt, env) { const q = this.qb, tx = q.p.x, tz = Math.max(this.losZ + 4, q.p.z + 6.5), dx = tx - d.p.x, dz = tz - d.p.z, m = Math.hypot(dx, dz) || 1, sp = Math.min(d.vmax, m * 2.5);
    locomote(d, v2(dx / m * sp, dz / m * sp), dt, env); d.crouchT = 0.3; slewHeading(d, Math.atan2(q.p.x - d.p.x, q.p.z - d.p.z), 6, dt); }
  coverAI(d, dt, env) {
    const los = this.losZ, k = Math.min(1, dt / (d.react + 0.05));
    const lagged = r => { d.seenV.x += (r.vel.x - d.seenV.x) * k; d.seenV.z += (r.vel.z - d.seenV.z) * k; return d.seenV; };
    let tx, tz, track = null;
    if (d.job === 'deep') { let deepest = null; for (const r of this.receivers) if (!deepest || r.p.z > deepest.p.z) deepest = r; tx = deepest ? lp(0, deepest.p.x, 0.6) : 0; tz = Math.max(los + 13, deepest ? deepest.p.z + 5 : 0); }
    else if (d.job === 'man' && d.cover) {
      const r = d.cover, v = lagged(r), inside = r.p.x > this.ballX ? -0.55 : 0.55, depth = r.p.z - los;
      if (d.cush === undefined) d.cush = cl(d.p.z - r.p.z, 1, 5);
      const tight = (d.A.mcv - r.A.rte) / 40 + (d.jump || 0) * 0.4 + (d.tr.includes('shutdown') ? 0.3 : 0) - (r.tr.includes('deep') && r.vel.z > 6 ? 0.3 : 0);
      // the cushion is respect for the vertical: a receiver who is not threatening downfield (screen, flat, swing, under the line) gets closed on
      const vert = !this.pass || (this.op.pa && this.liveT < 0.9) || (v.z > 2.2 && depth > -0.5), cush = vert ? cl(d.cush - Math.max(0, depth) * 0.5 - tight * 0.45, 0.7, d.cush) : cl(1.4 - tight * 0.3, 0.8, 1.6);
      tx = r.p.x + v.x * 0.3 + (vert ? inside : 0); tz = vert ? Math.max(r.p.z + cush, r.p.z + v.z * 0.3 + 0.9) : Math.max(r.p.z + cush, Math.min(this.losZ + 0.6, r.p.z + 3)); track = r;
    } else if (d.zone) {
      const lx = d.zone.x, lz = d.zone.z, deep = d.zone.deep, rad = deep ? 16 : 10.5 + (d.A.zcv - 60) / 10;
      // deep defenders own a slice of the field (half or third): the deepest route in it that has cleared 7 yards is theirs
      const nDeep = this.D.filter(x => x.zone && x.zone.deep).length, slice = nDeep <= 1 ? 99 : nDeep === 2 ? FIELD.halfW + 2 : FIELD.halfW * 0.72;
      let threat = null, best = -1e9;
      for (const r of this.receivers) { if (!r.upright()) continue; const dd = Math.hypot(r.p.x - lx, r.p.z - lz);
        if (deep) { if (Math.abs(r.p.x - lx) > slice || r.p.z - los < 6.4) continue; } else if (dd > rad) continue;
        const sc = deep ? r.p.z + (r.vel.z > 4 ? 3 : 0) - Math.abs(r.p.x - lx) * 0.15 : -dd; if (sc > best) { best = sc; threat = r; } }
      tx = lx + (this.qb.p.x - this.ballX) * 0.2; tz = lz;
      if (threat) { const v = lagged(threat), w = deep ? 0.7 : cl(0.82 + (d.A.zcv - 70) / 150, 0.7, 0.95); tx = lx + (threat.p.x + v.x * 0.3 - lx) * w; tz = lz + (threat.p.z + v.z * 0.3 - lz) * w;
        if (deep) { const cush = 2.6 + (d.A.zcv - 70) / 40 + Math.max(0, threat.vel.z) * 0.25; tz = Math.max(tz, threat.p.z + cush); } track = threat; }
    } else { tx = this.qb.p.x; tz = los + 5; }
    const ex = tx - d.p.x, ez = tz - d.p.z, em = Math.hypot(ex, ez), sp = Math.min(d.vmax, em * 2.8 + (track ? len2(d.seenV) * 0.95 : 0));
    locomote(d, em > 0.05 ? v2(ex / em * sp, ez / em * sp) : v2(), dt, env); d.crouchT = 0.2;
    const vel = len2(d.vel), away = d.vel.z > 3.5;
    if (away && vel > 4.5) slewHeading(d, Math.atan2(d.vel.x, d.vel.z), 8, dt); else slewHeading(d, Math.atan2(this.qb.p.x - d.p.x, this.qb.p.z - d.p.z), 6, dt);
  }
  ballAI(d, dt, env) {
    const L = this.ball.land, dx = L.x - d.p.x, dz = L.z - d.p.z, m = Math.hypot(dx, dz) || 1, eta = this.ball.T - this.ball.t;
    if (m > 18 || (d.job === 'rush' && m > 8)) return d.job === 'rush' ? this.pursueAI(d, dt, env, 'attack') : this.coverAI(d, dt, env);
    // drive on the ball flat out, aiming just downfield of the catch point: contest it, or be there to stop the run after it
    const tx2 = L.x - d.p.x, tz2 = L.z + 0.9 - d.p.z, m2 = Math.hypot(tx2, tz2) || 1, sp = m2 > 1.2 ? d.vmax : Math.min(d.vmax, m2 * 3);
    locomote(d, v2(tx2 / m2 * sp, tz2 / m2 * sp), dt, env); slewHeading(d, Math.atan2(dx, dz), 8, dt); d.crouchT = 0.05;
    // at the catch point: get a hand on it (and go up for it if the receiver does)
    if (eta < 0.34 && m < 1.7 && !d.swatTry && d.upright()) { d.swatTry = true; if (this.r() < 0.5 + ((d.A.mcv + d.A.zcv) / 2 - 65) / 120 + (d.jump || 0) * 0.25) { d.swatT = 0.38; if (this.ball.high || this.r() < 0.35) this.jump(d); } }
  }
  // a jump: airborne for half a second, height from his jumping rating
  jump(p) { if (p.jumpT > 0 || !p.upright()) return; p.jumpT = 0.52; p.jumpH = cl(0.28 + ((p.A.jmp || 60) - 50) / 220, 0.2, 0.55); }
  // receivers play the ball: time the run to where it comes down, attack it on its line, eyes and hands to it, go up when it is contested
  playsBall(r) { const B = this.ball; if (!this.air || !B.land || !r.upright() || r.ol || r === this.qb) return false; if (B.target === r) return true; const eta = Math.max(0.05, B.T - B.t), dl = Math.hypot(B.land.x - r.p.x, B.land.z - r.p.z); if (eta < 1.4 && dl < 4.5) return true;
    if (r.deepR && !B.away && (B.land.z - r.p.z) > -2 && Math.abs(B.land.x - r.p.x) < 9 && dl / eta < r.vmax * 1.12 && (!B.target || !B.target.upright() || Math.hypot(B.target.p.x - B.land.x, B.target.p.z - B.land.z) > dl)) return true;
    return false; }
  trackBall(r, dt, env) {
    const B = this.ball, eta = Math.max(0.04, B.T - B.t), hv = Math.hypot(B.v.x, B.v.z) || 1, ux = B.v.x / hv, uz = B.v.z / hv;
    const ax = B.land.x - ux * 0.45, az = B.land.z - uz * 0.45, dx = ax - r.p.x, dz = az - r.p.z, m = Math.hypot(dx, dz) || 1e-6;
    const sp = m > 4 ? r.vmax : Math.min(r.vmax, m / eta * 1.15 + 0.6);
    locomote(r, v2(dx / m * sp, dz / m * sp), dt, env); r.crouchT = 0.08;
    const vx = r.vel.x, vz = r.vel.z, vs = Math.hypot(vx, vz), away = vs > 4 && (vx * ux + vz * uz) / vs > 0.55;      // running away from the QB: over-the-shoulder catch in stride
    slewHeading(r, away ? Math.atan2(vx, vz) : eta < 0.7 ? Math.atan2(-ux, -uz) : Math.atan2(dx, dz), 9, dt);
    if (eta < 0.3 && m < 1.5 && (B.high || this.D.some(d => d.upright() && Math.hypot(d.p.x - B.land.x, d.p.z - B.land.z) < 1.9))) this.jump(r);
  }
  looseAI(p, dt, env) { const b = this.ball.p, dx = b.x - p.p.x, dz = b.z - p.p.z, m = Math.hypot(dx, dz) || 1, ranked = this.players.filter(x => x.unit === p.unit && x.upright()).sort((a, bb) => Math.hypot(a.p.x - b.x, a.p.z - b.z) - Math.hypot(bb.p.x - b.x, bb.p.z - b.z));
    if (ranked.indexOf(p) < 3) { locomote(p, v2(dx / m * p.vmax, dz / m * p.vmax), dt, env); p.crouchT = m < 2 ? 0.6 : 0.1; slewHeading(p, Math.atan2(dx, dz), 8, dt); } else locomote(p, v2(dx / m * 3, dz / m * 3), dt, env); }
  // ---------------- pursuit: one continuous law, role-based leverage, late breakdown ----------------
  pursueAI(d, dt, env, mode = 'attack') {
    const c = this.carrier;
    if (!d.upright() || !c) { locomote(d, v2(), dt, env); return; }
    if (this.ball.state === 'loose') return this.looseAI(d, dt, env);
    const toC = v2(c.p.x - d.p.x, c.p.z - d.p.z), dist = len2(toC) || 1e-6;
    if (d.bondBy) { const m = dist, b = d.bondBy, pr = this.pass && !this.thrown;
      // pass rush: a bull rusher walks the blocker back only if his power beats the anchor; finesse rushers work the hands, the pocket holds
      const push = pr ? (d.rushMove === 'bull' ? cl(1.3 + ((d.A.pow + d.A.str) / 2 - (b.A.pbk + b.A.str) / 2) / 30, 0.6, 2.4) : cl(0.8 + (d.A.prs - b.A.pbk) / 50, 0.4, 1.4)) : 2.2; locomote(d, v2(toC.x / m * push, toC.z / m * push), dt, env); d.crouchT = 0.4; slewHeading(d, Math.atan2(d.bondBy.p.x - d.p.x, d.bondBy.p.z - d.p.z), 5, dt); return; }
    if (d.wrapped) { const n = v2(toC.x / dist, toC.z / dist), cs = len2(c.vel); locomote(d, v2(n.x * (cs + 2.5), n.z * (cs + 2.5)), dt, env); d.crouchT = 0.5; slewHeading(d, Math.atan2(n.x, n.z), 6, dt); d.headOffset *= 0.98; return; }
    if (d.lungeT > 0) { this.lungeStep(d, c, dt, env); return; }
    d.headOffset *= 0.9;
    if (d.engaged && d.disengageT <= 0 && d.cooldown <= 0) d.engaged = false;
    // perceived carrier velocity: smoothed, so a cut takes a beat to register (better awareness = shorter beat)
    const tau = (d.react || 0.2) + 0.04, k = Math.min(1, dt / tau); d.seenV.x += (c.vel.x - d.seenV.x) * k; d.seenV.z += (c.vel.z - d.seenV.z) * k;
    const V = d.seenV, dirZ = c.unit === 'O' ? 1 : -1, s = d.vmax * 0.96;
    // intercept time: |rel + V t| = s t
    const A = V.x * V.x + V.z * V.z - s * s, Bq = 2 * (toC.x * V.x + toC.z * V.z), Cq = dist * dist;
    let tI; if (Math.abs(A) < 1e-6) tI = Bq < 0 ? -Cq / Bq : dist / s; else { const disc = Bq * Bq - 4 * A * Cq; if (disc < 0) tI = dist / s; else { const r1 = (-Bq - Math.sqrt(disc)) / (2 * A), r2 = (-Bq + Math.sqrt(disc)) / (2 * A); tI = [r1, r2].filter(x => x > 0).sort((a, b) => a - b)[0] ?? dist / s; } }
    tI = Math.min(tI, 4.2) * (mode === 'cutback' ? 1.15 : 1) * cl(0.6 + (d.A.pur || 60) / 220, 0.75, 1.04);     // pursuit rating: a poor one under-leads and ends up chasing      // far pursuers take the true angle (to where they can meet him), not a chase
    let ax = c.p.x + V.x * tI, az = c.p.z + V.z * tI;
    const out = Math.sign(c.p.x) || 1;      // toward the nearer sideline
    if (mode === 'contain' && dist > 3.5 && (d.p.z - c.p.z) * dirZ > 1) { ax = out > 0 ? Math.max(ax, c.p.x + 1.4) : Math.min(ax, c.p.x - 1.4); }
    else if (mode === 'cutback' && dist > 4) ax = c.p.x - out * 1.0 + V.x * tI * 0.8;
    else if (mode === 'alley' && dist > 6) az = c.p.z + dirZ * Math.max(2.5, (az - c.p.z) * dirZ);
    else if (mode === 'fill' && c.unit === 'O' && c.p.z < this.losZ + 0.5 && dist > 4) { ax = lp(this.holeX, c.p.x, 0.4); az = this.losZ + 0.9; }
    ax = cl(ax, -FIELD.halfW + 0.3, FIELD.halfW + 0.3);
    let fx = ax - d.p.x, fz = az - d.p.z; const fm = Math.hypot(fx, fz) || 1; fx = fx / fm * d.vmax; fz = fz / fm * d.vmax;
    // close quarters: constant-bearing pursuit. Match his sideways motion so the angle holds, spend what speed is left closing in.
    const lead = 0.3, na = norm3(V3(toC.x + V.x * lead, 0, toC.z + V.z * lead)), close = cl(dist * 1.3, 2.2, 4.5);
    const Vpar = V.x * na.x + V.z * na.z, pX = V.x - Vpar * na.x, pZ = V.z - Vpar * na.z, pM = Math.hypot(pX, pZ), budget = Math.sqrt(Math.max(0, d.vmax * d.vmax - pM * pM));
    let sAl = Math.min(budget, Math.max(0, Vpar) + close), kP = 1;
    // up close he must actually close: running level with the carrier, matching his speed would leave nothing to close with (the shadowing bug), so give up some of the matching
    const minC = dist < 4.5 ? cl(2.6 - dist * 0.3, 1.2, 2.4) : 0, needA = Math.min(d.vmax, Math.max(0, Vpar) + minC);
    if (minC && sAl < needA && pM > 1e-3) { kP = Math.sqrt(Math.max(0, d.vmax * d.vmax - needA * needA)) / pM; kP = Math.min(1, kP); sAl = needA; }
    let cx = pX * kP + na.x * sAl, cz = pZ * kP + na.z * sAl;
    const w = sstep(2.2, 5.5, dist);
    let dx = lp(cx, fx, w), dz = lp(cz, fz, w);
    // don't stack on a teammate's line; slip around blockers in the way
    for (const m of this.mates(d)) { if (m === d || !m.upright()) continue; const rx = d.p.x - m.p.x, rz = d.p.z - m.p.z, rr = Math.hypot(rx, rz); if (rr < 1.4 && rr > 1e-3 && Math.hypot(m.p.x - c.p.x, m.p.z - c.p.z) < dist) { const push = (1.4 - rr) * 2.2; dx += rx / rr * push; dz += rz / rr * push; } }
    if (dist > 2.5) for (const b of this.foes(d)) { if (b === c || !b.upright() || b.bond) continue; const bx = b.p.x - d.p.x, bz = b.p.z - d.p.z, bd = Math.hypot(bx, bz); if (bd < 2.2 && (bx * toC.x + bz * toC.z) > 0) { const side = Math.sign(bx * toC.z - bz * toC.x) || 1; dx += -toC.z / dist * side * 2.2; dz += toC.x / dist * side * 2.2; } }
    // last resort: runner pulling away and nobody else between him and the goal -> dive at the legs
    { const away = (c.vel.x * toC.x + c.vel.z * toC.z) / dist, closing = len2(d.vel) - len2(c.vel);
      if (!d.engaged && d.cooldown <= 0 && !(d.diveCd > 0) && dist > 1.3 && dist < 2.2 && away > 1.5 && closing < 0.8 && closing > -1.5 && this.facing(d, c) > -0.1 && this.lastLine(d, c)) { d.diveCd = 1.2; if (this.r() < 0.6) { this.startLunge(d, c, true); return; } } }
    d.crouchT = dist < 3.2 ? 0.55 : dist < 6 ? 0.22 : 0.03;
    locomote(d, v2(dx, dz), dt, env);
    if (d.cooldown <= 0 && !d.engaged && d.disengageT <= 0 && this.facing(d, c) > -0.25) { const n = v2(toC.x / dist, toC.z / dist), relLat = Math.abs((V.x - d.vel.x) * n.z - (V.z - d.vel.z) * n.x), side = Math.abs(n.x * V.z - n.z * V.x) / (len2(V) || 1);
      // square up and fire inside 1.7 m; from alongside (runner level with him) he can reach out a little further
      const closingNow0 = (d.vel.x * n.x + d.vel.z * n.z) - (V.x * n.x + V.z * n.z);
      if ((dist < 1.0 && relLat < 3.0) || (dist < 1.3 && relLat < 2.6 && closingNow0 > 0.6) || (dist < 1.55 && relLat < 2.4 && closingNow0 > 1.5) || (dist < 1.75 && side > 0.75 && relLat < 2.2 && len2(V) > 4 && closingNow0 > 0)) { this.startLunge(d, c, false); return; }
      // level with (or ahead of) a runner going by: leave your feet and take his legs
      const ahead = -(toC.x * V.x + toC.z * V.z) / (len2(V) || 1), closingNow = (d.vel.x * n.x + d.vel.z * n.z) - (V.x * n.x + V.z * n.z);
      if (dist < 2.0 && dist >= 1.45 && ahead > -0.6 && len2(V) > 5 && closingNow > 1.2 && !(d.diveCd > 0)) { d.diveCd = 1.0; this.startLunge(d, c, dist > 1.9 && ahead < 0.3 && this.lastLine(d, c)); return; } }
    if (dist < 3 && this.facing(d, c) < 0.2) slewHeading(d, Math.atan2(toC.x, toC.z), 11, dt);      // he got behind me: whip around
    else if (dist < 4 && len2(d.vel) < 6.5) slewHeading(d, Math.atan2(toC.x, toC.z), 7, dt); else if (len2(d.vel) > 1) slewHeading(d, Math.atan2(d.vel.x, d.vel.z), 7, dt);
  }
  // how squarely a defender faces the runner: 1 = straight at him, 0 = side-on, -1 = his back is turned
  facing(d, c) { const fx = Math.sin(d.heading), fz = Math.cos(d.heading), dx = c.p.x - d.p.x, dz = c.p.z - d.p.z, m = Math.hypot(dx, dz) || 1; return (fx * dx + fz * dz) / m; }
  lastLine(d, c) { const dirZ = c.unit === 'O' ? 1 : -1; const nearGoal = c.unit === 'O' ? FIELD.goalZ - c.p.z < 9 : c.p.z < 9; if (nearGoal) return true;
    for (const m of this.mates(d)) { if (m === d || !m.upright()) continue; if ((m.p.z - c.p.z) * dirZ > 0 && Math.hypot(m.p.x - c.p.x, m.p.z - c.p.z) < 9) return false; } return true; }
  startLunge(d, c, dive) {
    const lt = dive ? 0.42 : 0.24, V = d.seenV.x || d.seenV.z ? d.seenV : c.vel, px = c.p.x + V.x * lt - d.p.x, pz = c.p.z + V.z * lt - d.p.z, pm = Math.hypot(px, pz) || 1;
    d.lungeDir = v2(px / pm, pz / pm); const ls = len2(d.vel) + (dive ? 2.4 : 3.2); d.lungeVel = v2(d.lungeDir.x * ls, d.lungeDir.z * ls); d.lungeT = dive ? 0.42 : 0.36; d.lungeSeen = v2(V.x, V.z);
    const toC = Math.hypot(c.p.x - d.p.x, c.p.z - d.p.z), n = v2((c.p.x - d.p.x) / (toC || 1), (c.p.z - d.p.z) / (toC || 1)), closing = -((c.vel.x - d.vel.x) * n.x + (c.vel.z - d.vel.z) * n.z);
    d.brokeDown = !dive && d.crouch > 0.45 && closing < 7.5; d.diving = dive;
    if (dive) { d.contactH = 0.38; d.om.x += d.lungeDir.x * 3.0; d.om.z += d.lungeDir.z * 3.0; d.reflexT = 0.4; }
    else { const r = this.r(); d.contactH = d.brokeDown ? (r < 0.55 ? 0.62 : 0.92) : (r < 0.5 ? 1.22 : 0.92); const lat = c.vel.x * d.lungeDir.z - c.vel.z * d.lungeDir.x; d.headOffset = -Math.sign(lat || 1) * 0.35; }
  }
  // the lunge is a burst of closing speed on top of the runner's velocity, re-aimed as he goes; a sharp cut can still beat it
  lungeStep(d, c, dt, env) {
    const k = Math.min(1, dt * (4 + d.A.agi / 25) * (d.diving ? 0.45 : 1)), ax = c.p.x + c.vel.x * 0.08 - d.p.x, az = c.p.z + c.vel.z * 0.08 - d.p.z, am = Math.hypot(ax, az) || 1;
    let lx = d.lungeDir.x + (ax / am - d.lungeDir.x) * k, lz = d.lungeDir.z + (az / am - d.lungeDir.z) * k; const lm = Math.hypot(lx, lz) || 1; d.lungeDir = v2(lx / lm, lz / lm);
    const close = d.diving ? 4.0 : 3.4 + d.A.acc / 55, base = d.diving ? 0.85 : 0.97;
    d.lungeVel = v2(d.lungeSeen.x * base + d.lungeDir.x * close, d.lungeSeen.z * base + d.lungeDir.z * close);
    { const along = d.lungeVel.x * d.lungeDir.x + d.lungeVel.z * d.lungeDir.z, cur = d.vel.x * d.lungeDir.x + d.vel.z * d.lungeDir.z, need = cur + 0.9;   // a lunge never brakes him: at least his current closing speed plus a burst
      if (along < need) { d.lungeVel.x += d.lungeDir.x * (need - along); d.lungeVel.z += d.lungeDir.z * (need - along); } }
    d.lungeSeen.x += (c.vel.x - d.lungeSeen.x) * Math.min(1, dt / 0.15); d.lungeSeen.z += (c.vel.z - d.lungeSeen.z) * Math.min(1, dt / 0.15);
    locomote(d, d.lungeVel, dt, env, { lunge: true }); slewHeading(d, Math.atan2(d.lungeDir.x, d.lungeDir.z), 9, dt);
    if (d.lungeT <= dt + 1e-9 && !d.engaged) {     // whiff: a stumble, not a faceplant (agile players recover)
      const kk = cl(len2(d.vel) * 0.04, 0.12, 0.4) * (1.25 - d.A.agi / 200) * (d.diving ? 4 : 1); d.om.x += d.lungeDir.x * kk; d.om.z += d.lungeDir.z * kk; d.cooldown = 0.5; d.headOffset = 0;
      if (c === this.carrier && c.unit !== d.unit) { this.note(d, false, 'Missed tackle'); this.add(c, '_avoid'); }
    }
  }

  // ---------------- passing ----------------
  throwTo(r) { const q = this.qb; if (!(this.pass && !this.thrown && this.carrier === q && !this.scramble && q.upright() && !q.windup) || this.phase !== 'live' || this.ball.state !== 'held') return false; if (q.p.z > this.losZ + 0.3) return false; if (this.foes(q).some(d => d.wrapped)) return false; q.windup = this.windupFor(q); q.windTarget = r; q.throwAnim = 0.45; return true; }
  // user passing (drag back to aim): can he throw right now, the flight to an aim point, and the throw itself
  canThrow() { const q = this.qb; return this.phase === 'live' && this.pass && !this.thrown && this.carrier === q && !this.scramble && q.upright() && !q.windup && this.ball.state === 'held' && q.p.z <= this.losZ + 0.3 && !this.foes(q).some(d => d.wrapped); }
  spotFlight(x, z) {
    const q = this.qb, hand = this.handPos(q, 0), mx = this.maxThrow(q); let dx = x - hand.x, dz = z - hand.z; const d0 = Math.hypot(dx, dz) || 1e-6, d = Math.min(d0, mx); dx *= d / d0; dz *= d / d0;
    const T = Math.max(0.35, d / (q.arm * 0.9)), L = v2(hand.x + dx, hand.z + dz), vy = (1.3 - hand.y + 0.5 * G * T * T) / T;
    return { hand, L, T, d, v: V3(dx / T, vy, dz / T), max: mx, capped: d0 > mx + 0.5, sigma: this.throwSigma(q, d, this.pressureOn(q), true) };
  }
  spotTarget(L, T) { let r = null, best = 5.5; for (const p of this.receivers) { if (!p.upright()) continue; const at = this.predictRoute(p, T), m = Math.hypot(at.x - L.x, at.z - L.z) - Math.min(p.vmax * T * 0.3, 3);
      const reach = Math.hypot(L.x - p.p.x, L.z - p.p.z), late = (reach / (p.vmax * 0.97) + 0.2 - T) * p.vmax, ahead = (L.z - p.p.z) > 0 && p.deepR ? Math.max(0, late) : 99, sc = Math.min(m, ahead);
      if (sc < best) { best = sc; r = p; } } return r; }
  throwSpot(x, z) { const q = this.qb; if (!this.canThrow()) return false; q.windup = this.windupFor(q); q.windTarget = { spot: true, p: v2(x, z) }; q.throwAnim = 0.45; return true; }
  launchSpot(spot) {
    const q = this.qb, f = this.spotFlight(spot.x, spot.z), hand = f.hand, T = f.T; let L = v2(f.L.x, f.L.z);
    const sigma = this.throwSigma(q, f.d, this.pressureOn(q), true);   // you aimed it yourself: a bit tighter than the AI's read-and-throw
    L = v2(L.x + this.gauss() * sigma * 0.8, L.z + this.gauss() * sigma);
    const r = this.spotTarget(L, T), high = this.contestedAt(L, T), vy = ((high ? 1.8 : 1.3) - hand.y + 0.5 * G * T * T) / T;
    this.ball = { state: 'air', p: { ...hand }, v: V3((L.x - hand.x) / T, vy, (L.z - hand.z) / T), t: 0, T, land: L, target: r, high, rot: V3(0, 0, 0), spin: V3(0, 0, 0), from: v2(q.p.x, q.p.z), fromZ: q.p.z };
    this.air = true; this.thrown = true; this.throwT = this.t; this.passer = q; this.carrier = null; this.add(q, 'pa'); if (r) this.add(r, 'tgt');
    for (const d of this.D) d.react = cl(0.36 - d.A.awr / 500 - (d.posName === 'S' ? 0.06 : 0) + (this.userSide === 'O' ? this.diff.react : 0), 0.08, 0.45);
    this.emit(r ? `${q.name} throws for ${r.name}` : `${q.name} lets it fly`, 'info'); this.fx.push({ kind: 'throw' });
  }
  // will a defender be on top of the catch point when the ball gets there? then it is a jump ball, thrown up higher
  contestedAt(L, T) { for (const d of this.D) { if (!d.upright() || (d.job === 'rush' && !d.zone)) continue; const k = Math.min(T, 1.2) * 0.6; if (Math.hypot(d.p.x + d.vel.x * k - L.x, d.p.z + d.vel.z * k - L.z) < 1.6 + T * 0.5) return true; } return false; }
  throwAwayUser() { const q = this.qb; if (this.pass && !this.thrown && this.carrier === q && q.upright() && !q.windup) { q.windup = 0.12; q.windTarget = 'away'; q.throwAnim = 0.45; } }
  predictRoute(r, T) {
    let x = r.p.x, z = r.p.z, t = T; const sp = Math.max(4.5, Math.min(r.vmax, len2(r.vel) + 0.5));
    for (let i = r.ri || 0; r.route && i < r.route.length && t > 0; i++) { const w = r.route[i], d = Math.hypot(w.x - x, w.z - z), step = sp * t; if (step >= d) { const px = x, pz = z; x = w.x; z = w.z; t -= d / sp;
        const nx = r.route[i + 1]; if (nx && t > 0) { const ax = x - px, az = z - pz, bx = nx.x - x, bz = nx.z - z, cs = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1); t -= cs < 0 ? 0.32 : cs < 0.5 ? 0.22 : cs < 0.8 ? 0.1 : 0; } }   // he has to gear down through a sharp break
      else { x += (w.x - x) / d * step; z += (w.z - z) / d * step; t = 0; } }
    if (t > 0 && !r.settle && r.route) { const n = r.route.length; let ex = n >= 2 ? r.route[n - 1].x - r.route[n - 2].x : (n === 1 ? r.route[0].x - (r.startX ?? r.route[0].x) : r.vel.x), ez = n >= 2 ? r.route[n - 1].z - r.route[n - 2].z : (n === 1 ? 1 : r.vel.z || 1); const em = Math.hypot(ex, ez) || 1; ex /= em; ez /= em;
      if (Math.abs(x) > FIELD.halfW - 2 && ex * x > 0) { ex = 0; ez = 1; }     // mirrors routeAI: at the sideline he turns upfield
      x += ex * sp * t * 0.9; z += ez * sp * t * 0.9; }
    return v2(cl(x, -FIELD.halfW + 0.5, FIELD.halfW - 0.5), Math.min(z, FIELD.goalZ + 9));
  }
  handPos(p, i) { const J = this.poses[p.id]; return J && J.arms ? J.arms[i].hand : V3(p.p.x, 1.5, p.p.z); }
  launch(r) {
    const q = this.qb, hand = this.handPos(q, 0), vb = q.arm; let L = v2(r.p.x, r.p.z), T = 0.4;
    for (let i = 0; i < 4; i++) { const d = Math.hypot(L.x - hand.x, L.z - hand.z); T = Math.max(0.35, d / (vb * 0.9)); L = this.predictRoute(r, T + 0.05); }
    const dist = Math.hypot(L.x - hand.x, L.z - hand.z);
    const sigma = this.throwSigma(q, dist, this.pressureOn(q), false);
    L.x = cl(L.x, -FIELD.halfW + 1.8, FIELD.halfW - 1.8);                 // QBs keep sideline throws inside, so the catch is made in bounds
    L = v2(L.x + this.gauss() * sigma * 0.8, L.z + this.gauss() * sigma);
    const high = this.contestedAt(L, T), catchH = high ? 1.8 : 1.3, dx = L.x - hand.x, dz = L.z - hand.z, vy = (catchH - hand.y + 0.5 * G * T * T) / T;
    this.ball = { state: 'air', p: { ...hand }, v: V3(dx / T, vy, dz / T), t: 0, T, land: L, target: r, high, rot: V3(0, 0, 0), spin: V3(0, 0, 0), from: v2(q.p.x, q.p.z), fromZ: q.p.z };
    this.air = true; this.thrown = true; this.throwT = this.t; this.passer = q; this.carrier = null; this.add(q, 'pa'); this.add(r, 'tgt');
    for (const d of this.D) d.react = cl(0.36 - d.A.awr / 500 - (d.posName === 'S' ? 0.06 : 0) + (this.userSide === 'O' ? this.diff.react : 0), 0.08, 0.45);
    this.emit(`${q.name} throws for ${r.name}`, 'info'); this.fx.push({ kind: 'throw' });
  }
  throwAway(q) { const hand = this.handPos(q, 0), side = q.p.x >= 0 ? 1 : -1, L = v2(side * (FIELD.halfW + 4), this.losZ + 6), d = Math.hypot(L.x - hand.x, L.z - hand.z), T = Math.max(0.5, d / (q.arm * 0.9));
    this.ball = { state: 'air', p: { ...hand }, v: V3((L.x - hand.x) / T, (1.2 - hand.y + 0.5 * G * T * T) / T, (L.z - hand.z) / T), t: 0, T, land: L, target: null, away: true, rot: V3(0, 0, 0), spin: V3(0, 0, 0), from: v2(q.p.x, q.p.z) };
    this.air = true; this.thrown = true; this.throwT = this.t; this.passer = q; this.carrier = null; this.add(q, 'pa'); this.emit(`${q.name} throws it away`, 'info'); }
  ballStep(dt) {
    const B = this.ball;
    if (B.state === 'snap') { B.t += dt; const q = this.qb, u = Math.min(1, B.t / 0.22), h = this.handPos(q, 0); B.p = V3(lp(B.from.x, h.x, u), lp(B.from.y, h.y, u) + Math.sin(Math.PI * u) * 0.2, lp(B.from.z, h.z, u)); if (u >= 1) { B.state = 'held'; this.carrier = q; } return; }
    if (B.state === 'air') {
      B.v.y -= G * dt; B.p = add3(B.p, mul3(B.v, dt)); B.t += dt; B.axis = norm3(B.v); B.rot.z += 38 * dt;
      // user defender swat / jump in the last instant of flight
      const ud = this.userD; if (ud && this.input.swat && B.T - B.t < 0.35 && ud.upright()) { this.input.swat = false; ud.swatT = 0.35; }
      if (B.t >= B.T - 0.01 || B.p.y < 0.25) this.catchPoint();
      return;
    }
    if (B.state === 'loose') {
      B.v.y -= G * dt; B.p = add3(B.p, mul3(B.v, dt)); B.rot = add3(B.rot, mul3(B.spin, dt));
      if (B.p.y < 0.11 && B.v.y < 0) { B.p.y = 0.11; B.v.y = -B.v.y * 0.42; const a = (this.r() - 0.5) * 1.4, cs = Math.cos(a), sn = Math.sin(a), vx = B.v.x * cs - B.v.z * sn, vz = B.v.x * sn + B.v.z * cs; B.v.x = vx * 0.7; B.v.z = vz * 0.7; B.spin = V3((this.r() - 0.5) * 18, (this.r() - 0.5) * 8, (this.r() - 0.5) * 18); if (Math.abs(B.v.y) < 0.4) { B.v.y = 0; const k = Math.exp(-3 * dt * 10); B.v.x *= k; B.v.z *= k; } }
      B.looseT = (B.looseT || 0) + dt;
      if (Math.abs(B.p.x) > FIELD.halfW || B.p.z < -10 * YD || B.p.z > FIELD.goalZ + 10 * YD) { this.endPlay('oob', 'Fumble rolls out of bounds', this.fumbler ? this.fumbler : null, B.p.z, { fumbleOOB: true }); return; }
      if (B.looseT > 0.25 && B.p.y < 0.8) { for (const p of shuffle(this.players.slice())) { if (!(p.upright() || p.bal === 'fall') || Math.hypot(p.p.x - B.p.x, p.p.z - B.p.z) > 0.8) continue; if (this.r() < dt * (3 + p.A.awr / 30 + p.A.agi / 60)) { this.recoverFumble(p); return; } } }
      if (B.looseT > 6) this.recoverFumble(this.players.slice().sort((a, b) => Math.hypot(a.p.x - B.p.x, a.p.z - B.p.z) - Math.hypot(b.p.x - B.p.x, b.p.z - B.p.z))[0]);
    }
  }
  catchPoint() {
    if (this.ret) return this.retCatch();
    const B = this.ball, at = v2(B.p.x, B.p.z);
    if (B.away) { this.air = false; this.ball = { state: 'dead', p: B.p, v: mul3(B.v, 0.3), rot: V3(0, 0, 0), spin: V3(4, 2, 4) }; this.endPlay('inc', 'Thrown away', null, this.losZ); return; }
    const near = (list, base) => { let best = null, bd = 1e9; for (const p of list) { if (!p.upright() && !p.diving) continue; const J = this.poses[p.id], c = J ? J.chest : V3(p.p.x, 1.3, p.p.z); const reach = (p.size - 1) * 0.6 + (p.A.jmp - 60) / 200 + (p.swatT > 0 ? 0.35 : 0) + (p.jumpY > 0.08 ? 0.22 : 0); const d = Math.hypot(c.x - at.x, c.z - at.z) - reach - 0.1; if (d < base && d < bd) { bd = d; best = p; } } return best ? { p: best, d: bd } : null; };
    const off = near(this.O.filter(p => p !== this.qb && !p.ol), 1.45), def = near(this.D, 1.1), lineDrive = B.p.y > 2.7 + Math.max(off ? off.p.jumpY || 0 : 0, def ? def.p.jumpY || 0 : 0) * 1.6 && !(def && def.p.swatT > 0);
    let result = 'inc', who = null;
    // a jump ball goes to the better hands, leaper and body: catching + jumping + strength + height against the defender's ball skills
    const battle = off && def ? cl((off.p.jball - def.p.dball) / 45 + (off.p.size - def.p.size) * 1.5 + ((off.p.jumpY || 0) - (def.p.jumpY || 0)) * 0.8, -0.5, 0.5) : 0;
    if (!lineDrive) {
      if (def && (!off || def.d <= off.d + 0.25)) {
        const dA = def.p.A, ballhawk = def.p.tr.includes('ballhawk') ? 0.1 : 0;
        const pInt = cl(0.05 + (off ? 0 : 0.16) + (0.95 - def.d) * 0.12 + (dA.hnd - 60) / 260 + ballhawk + (def.p.swatT > 0 ? -0.02 : 0), 0.02, 0.45), pPD = cl(0.45 + ((dA.mcv + dA.zcv) / 2 - 65) / 150 + (def.p.swatT > 0 ? 0.22 : 0) - (off ? battle * 0.25 : 0), 0.2, 0.8);
        const r = this.r(); if (r < pInt) { result = 'int'; who = def.p; } else if (r < pInt + pPD || !off) { result = 'pbu'; who = def.p; }
      }
      if (result === 'inc' && off) {
        let pc = off.p.hands + 0.07 - Math.max(0, off.d - 0.75) * 0.3;
        if (def) pc -= cl(1 - def.d / 1.8, 0, 1) * cl(0.42 - battle * 0.3 - (off.p.tr.includes('hands') ? 0.1 : 0), 0.1, 0.62);
        pc -= Math.max(0, Math.hypot(at.x - B.from.x, at.z - B.from.z) / YD - 22) * 0.011;     // a long ball comes in over the shoulder: harder to track and secure
        if (this.env.wet) pc -= 0.04;
        if (this.r() < cl(pc, 0.05, 0.97)) { result = 'catch'; who = off.p; } else result = off.d < 0.85 && !(def && def.d < 1.2) ? 'drop' : 'off';
        // a contested ball that gets away can be tipped up and picked: the defender at the catch point has a shot at the carom
        if (result !== 'catch' && def && def.d < 1.3 && this.r() < 0.18 * (1.3 - def.d) * (0.6 + def.p.A.hnd / 150)) { result = 'int'; who = def.p; }
      }
    }
    this.air = false;
    if (result === 'catch' && Math.abs(who.p.x) > FIELD.halfW + 0.15) result = 'oobcatch';
    if (result === 'catch') {
      this.carrier = who; this.catcher = who; this.catchT = this.t; this.catchZ = who.p.z; who.role = 'carrier'; this.ball = { state: 'held', p: B.p, v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0) };
      who.ballSide = who.p.x > 0 ? 1 : -1; who.vel.x *= 0.65; who.vel.z *= 0.65; who.propK = 0.5; who.secureT = 0.25; this.contactZ = null;
      this.add(this.passer, 'pc'); this.add(who, 'rec'); this.note(who, true, 'Catch');
      for (const d of this.D) d.runRead = this.t + 0.06 + d.react * 0.3;
      this.emit(`Caught by ${who.name}`, 'good'); this.fx.push({ kind: 'grab', j: 200 });
      if (who.p.z >= FIELD.goalZ) this.endPlay('td', 'Touchdown catch', who, who.p.z);
      return;
    }
    this.ball = { state: 'dead', p: B.p, v: mul3(B.v, result === 'pbu' ? -0.25 : 0.4), rot: V3(0, 0, 0), spin: V3(8, 3, 6) };
    if (result === 'int') {
      this.add(this.passer, 'pint'); this.add(who, 'int'); this.add(who, 'pd'); this.note(who, true, 'Interception'); this.note(this.passer, false, 'Threw an interception');
      this.carrier = who; who.role = 'carrier'; this.ball = { state: 'held', p: B.p, v: V3(0, 0, 0), rot: V3(0, 0, 0), spin: V3(0, 0, 0) }; this.turnover = 'int'; this.catchT = this.t; this.contactZ = null;
      for (const o of this.O) { o.bond = null; o.role = o === this.qb ? 'qb' : o.role; } for (const d of this.D) { d.bondBy = null; d.wrapped = false; d.engaged = false; }
      this.emit(`INTERCEPTED by ${who.name}!`, 'bad'); this.fx.push({ kind: 'hit', j: 300, at: V3(at.x, 1.2, at.z) }); return;
    }
    if (result === 'pbu') { this.add(who, 'pd'); this.note(who, true, 'Pass breakup'); }
    if (result === 'drop' && off) this.note(off.p, false, 'Dropped a catchable ball');
    const why = result === 'pbu' ? `${who.name} breaks it up` : result === 'drop' ? `${off.p.name} drops it` : result === 'off' ? `Off ${off.p.name}'s fingertips` : result === 'oobcatch' ? 'Caught out of bounds' : lineDrive ? 'Sails over everyone' : B.target && B.target.p ? ((at.z - B.target.p.z) * 1 + Math.abs(at.x - B.target.p.x) * 0.3 > 0.8 ? 'Overthrown' : 'Off target') : 'Nobody there';
    this.fx.push({ kind: result === 'pbu' ? 'hit' : 'grab', j: 260, at: V3(at.x, 1.2, at.z) });
    this.endPlay('inc', why, null, this.losZ);
  }
  fumble(n, J) {
    const c = this.carrier, hand = this.handPos(c, c.ballSideV > 0 ? 0 : 1);
    this.ball = { state: 'loose', p: { ...hand }, v: V3(c.vel.x + n.x * 2 + (this.r() - 0.5) * 3, 2.2 + this.r() * 2, c.vel.z + n.z * 2 + (this.r() - 0.5) * 3), spin: V3((this.r() - 0.5) * 20, (this.r() - 0.5) * 10, (this.r() - 0.5) * 20), rot: V3(0, 0, 0), looseT: 0 };
    this.fumbler = c; this.stripSack = c === this.qb && this.pass && !this.thrown && !this.scramble; this.add(c, 'fum'); const by = c.lastHitBy; if (by) { this.add(by, 'ff'); this.note(by, true, 'Forced a fumble'); } this.note(c, false, 'Fumbled');
    this.carrier = null; for (const d of this.players) { d.wrapped = false; d.engaged = false; d.bond = null; d.bondBy = null; }
    this.emit(`FUMBLE! ${c.name} loses it`, 'bad'); this.fx.push({ kind: 'hit', j: J, at: V3(c.p.x, 1, c.p.z) });
  }
  recoverFumble(p) {
    if (!p) return; const unit = p.unit, offRec = unit === 'O';
    this.emit(`${offRec ? 'Recovered by the offense' : 'Defense recovers'}: ${p.name}`, offRec ? 'info' : 'bad');
    if (!offRec) this.note(p, true, 'Recovered a fumble');
    this.endPlay(offRec ? 'fumbleKept' : 'fumbleLost', offRec ? 'Fumble, offense recovers' : 'Fumble recovered by the defense', p, p.p.z, { recovered: p });
  }

  // ---------------- contact ----------------
  interactions(dt) {
    const c = this.carrier, live = this.phase === 'live';
    if (c && c.stiffT > 0 && c.stiffTarget && c.upright()) {
      const d = c.stiffTarget, dx = d.p.x - c.p.x, dz = d.p.z - c.p.z, dist = Math.hypot(dx, dz);
      if (dist < 1.35 && dist > 0.01 && d.upright()) { const n = v2(dx / dist, dz / dist), F = 450 + 6 * c.A.str; d.vel.x += n.x * F / d.mass * dt; d.vel.z += n.z * F / d.mass * dt; c.vel.x -= n.x * F * 0.25 / c.mass * dt; c.vel.z -= n.z * F * 0.25 / c.mass * dt; d.ext.x += n.x * (4 + c.A.str / 25); d.ext.z += n.z * (4 + c.A.str / 25); }
    }
    const caps = this.caps = {}; for (const p of this.players) caps[p.id] = quickCaps(p);
    for (const b of this.O) if (b.bond) this.blockBond(b, b.bond, dt);
    this.wrapCount = c ? this.foes(c).filter(d => d.wrapped).length : 0;
    const P = this.players;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const A = P[i], B = P[j]; if (Math.abs(A.p.x - B.p.x) > 2.4 || Math.abs(A.p.z - B.p.z) > 2.4) continue;
      if (c && this.ball.state === 'held' && ((A === c && B.unit !== c.unit) || (B === c && A.unit !== c.unit))) {
        const d = A === c ? B : A, dx = c.p.x - d.p.x, dz = c.p.z - d.p.z, dist = Math.hypot(dx, dz) || 1e-6, n = v2(dx / dist, dz / dist), ov = bodyOverlap(caps[c.id], caps[d.id]);
        if (d.wrapped) this.gripConstraint(d, n, dist, dt);
        // a blocked defender can only reach a runner who passes on his free side: if his blocker is between them, he is shielded
        const shielded = d.bondBy && (() => { const b = d.bondBy, ex = c.p.x - d.p.x, ez = c.p.z - d.p.z, el = Math.hypot(ex, ez) || 1, bx = b.p.x - d.p.x, bz = b.p.z - d.p.z, along = (bx * ex + bz * ez) / el, lat = Math.abs(bx * ez - bz * ex) / el; return along > 0.1 && along < el + 0.2 && lat < 0.55; })();
        // he has to see the runner to wrap him: a defender with his back turned just gets bumped (and turns around)
        const seen = d.lungeT > 0 || d.bondBy || this.facing(d, c) > -0.15;      // (a blocked man is judged by the shield test below: he can reach a runner going by on his free side)
        if (!d.wrapped && live && seen && !d.engaged && d.disengageT <= 0 && (d.upright() || (d.diving && d.lungeT > 0)) && c.bal !== 'down' && !(d.bondBy && (dist > 1.05 || shielded))) {
          if (ov) { const hm = Math.hypot(ov.n.x, ov.n.z), nn = hm > 0.3 ? v2(ov.n.x / hm, ov.n.z / hm) : n; this.contact(d, nn, dist, ov.kb !== 'arms' && !d.bondBy, ov.at.y); if (d.bondBy) this.shed(d.bondBy, d, null); continue; }
          if (d.lungeT > 0 && d.lungeT < 0.12 && dist < 1.15) { this.contact(d, n, dist, false, d.diving ? 0.38 : 0.95); continue; }
        }
        if (ov) this.resolve(c, d, ov);
        continue;
      }
      const ov = bodyOverlap(caps[A.id], caps[B.id]);
      const bl = A.unit === 'O' && B.unit === 'D' ? A : B.unit === 'O' && A.unit === 'D' ? B : null, df = bl === A ? B : bl === B ? A : null;
      const canBlock = bl && live && this.canBlock(bl) && (c ? c.unit === 'O' : !!this.ret);
      const armLen = canBlock ? Math.hypot(A.p.x - B.p.x, A.p.z - B.p.z) < 1.05 : false;
      if (!ov && !armLen) continue;
      // after a catch the other receivers need a beat to turn into blockers (they were running routes)
      const lateB = !!(bl && this.catchT && !bl.ol && this.t - this.catchT < 0.45);
      if (canBlock && !lateB && !bl.bond && !df.bondBy && !(df.shedCd > 0 && df.lastShedBy === bl) && bl.upright() && df.upright() && df !== this.userD) { bl.bond = df; df.bondBy = bl; df.bondT = 0; df.shedNeed = undefined; }
      if (canBlock && !bl.bond && df === this.userD && !df.bondBy && bl.upright() && df.upright() && !(df.shedCd > 0)) { bl.bond = df; df.bondBy = bl; df.bondT = 0; df.shedNeed = undefined; }
      if (ov) { if (bl && bl.bond === df && ov.depth < 0.08) continue; this.resolve(A, B, ov); }
    }
    this.near = {}; for (const p of P) { const arr = []; for (const q of P) if (q !== p && Math.abs(q.p.x - p.p.x) < 1.6 && Math.abs(q.p.z - p.p.z) < 1.6) arr.push(caps[q.id][0], caps[q.id][1]); this.near[p.id] = arr; }
  }
  canBlock(b) { return b.role === 'block' || b.role === 'pp' || b.ol || (this.thrown && !this.air && this.carrier !== b) || (this.handed && this.kind === 'run' && b !== this.carrier); }
  // A block is a breakable bond: the blocker holds and drives, the defender works to shed. Ratings decide who wins.
  blockBond(b, d, dt) {
    if (!b.upright() || !d.upright() || this.phase !== 'live') return this.shed(b, d, null);
    const dx = d.p.x - b.p.x, dz = d.p.z - b.p.z, dist = Math.hypot(dx, dz) || 1e-6, n = v2(dx / dist, dz / dist);
    if (dist > (d.bondT < 0.4 ? 2.4 : 2.0)) return this.shed(b, d, null);     // a block just forming has some slack while they come together
    const F = Math.max(0, 3000 * (dist - 0.72));
    b.vel.x += n.x * F / b.mass * dt; b.vel.z += n.z * F / b.mass * dt; d.vel.x -= n.x * F / d.mass * dt; d.vel.z -= n.z * F / d.mass * dt;
    const pp = this.pass && !this.thrown && this.carrier === this.qb && !this.scramble, Ab = b.A, Ad = d.A;
    if (pp) { const q = this.qb, ax = d.p.x - q.p.x, az = d.p.z - q.p.z, am = Math.hypot(ax, az) || 1, F2 = 300 + 6 * Ab.pbk; d.vel.x += ax / am * F2 / d.mass * dt; d.vel.z += az / am * F2 / d.mass * dt; }
    else { const c = this.carrier || this.qb, side = Math.sign(d.p.x - c.p.x) || Math.sign(d.p.x - b.p.x) || 1; let ux = (b.asgX && this.bondAge(d) < 0.9 ? b.asgX : side) * 0.75 + n.x * 0.35, uz = 0.55 + n.z * 0.35; const um = Math.hypot(ux, uz) || 1; ux /= um; uz /= um;
      const drive = 400 + 9 * Ab.rbk + (b.tr.includes('mauler') ? 150 : 0); d.vel.x += ux * drive / d.mass * dt; d.vel.z += uz * drive / d.mass * dt; }
    d.bondT += dt;
    if (d.helper && (d.helper.help !== d || Math.hypot(d.helper.p.x - d.p.x, d.helper.p.z - d.p.z) > 1.6)) { if (d.helper.help === d) d.helper.help = null; d.helper = null; }
    if (d.shedNeed === undefined) {
      const massK = Math.pow(b.mass / d.mass, 0.25);
      let adv;
      if (pp) {
        const mv = d.rushMove;
        if (mv === 'bull') adv = (Ab.pbk * 0.6 + Ab.str * 0.4 + (b.tr.includes('wall') ? 6 : 0)) / (Ad.pow * 0.6 + Ad.str * 0.4 + (d.tr.includes('bullrush') ? 6 : 0)) * massK;
        else if (mv === 'speed') adv = (Ab.pbk * 0.65 + Ab.agi * 0.2 + Ab.awr * 0.15 + (b.tr.includes('wall') ? 6 : 0)) / (Ad.prs * 0.6 + Ad.spd * 0.25 + Ad.acc * 0.15 + (d.tr.includes('speedrush') ? 6 : 0));
        else adv = (Ab.pbk * 0.6 + Ab.awr * 0.4) / (Ad.prs * 0.5 + Ad.agi * 0.3 + Ad.awr * 0.2);
        if (!b.ol) adv *= b.posName === 'TE' ? 0.9 : 0.8;
        if (d.helper) adv *= 1.6;
        // an even matchup holds past 2.5 s about nine times in ten (NFL pass-block win rate); a great rusher on a weak tackle wins a third of the time
        d.shedNeed = (1.6 + 3.5 * Math.pow(adv, 3)) * (0.55 + this.r() * 0.9);
      } else {
        adv = (Ab.rbk * 0.7 + Ab.str * 0.3 + (b.tr.includes('mauler') ? 6 : 0)) / (Ad.bsh * 0.7 + Ad.str * 0.3) * massK;
        if (!d.dl) adv *= 1.1; if (!b.ol) adv *= (b.posName === 'TE' || b.posName === 'FB') ? 0.95 : 0.85;
        // an even run block holds past ~2.5 s about two times in three; a dominant tackle wins early more often
        d.shedNeed = (1.45 + 2.8 * Math.pow(adv, 3)) * (0.55 + this.r() * 0.9) * (this.ret ? (this.ret.kind === 'punt' ? 1.0 : 1.2) : 1);     // return blocks are open-field shields: harder to shed in time
        if (!b.ol && this.catchT) d.shedNeed *= 0.5;      // a skill player blocking in space is a stalk, not a drive block: it holds a second or so
      }
      if (d === this.userD) d.shedNeed *= 0.75;      // user can fight off a block faster by working the stick
    }
    const cc = this.carrier, cd = cc ? Math.hypot(cc.p.x - d.p.x, cc.p.z - d.p.z) : 9;
    // he can only rip off the block for a runner going by on his free side (not through his blocker)
    let reach = cd < 1.1 && d.bondT > d.shedNeed * 0.7; if (reach) { const ex = cc.p.x - d.p.x, ez = cc.p.z - d.p.z, el = cd || 1, bx = b.p.x - d.p.x, bz = b.p.z - d.p.z, al = (bx * ex + bz * ez) / el, lat = Math.abs(bx * ez - bz * ex) / el; if (al > 0.1 && al < el + 0.2 && lat < 0.55) reach = false; }
    if (d.bondT > d.shedNeed || reach) this.shed(b, d, reach ? 'reaches off the block' : 'sheds the block');
  }
  shed(b, d, why) {
    const pp = this.pass && !this.thrown && this.carrier === this.qb && why;
    b.bond = null; d.bondBy = null; d.bondT = 0; d.shedNeed = undefined; d.shedCd = 0.9; b.assign = null; d.lastShedBy = b;
    if (d.helper) { d.helper.help = null; d.helper = null; }
    if (pp) { const q = this.qb, ux = q.p.x - d.p.x, uz = q.p.z - d.p.z, um = Math.hypot(ux, uz) || 1, side = Math.sign((d.p.x - b.p.x) * uz - (d.p.z - b.p.z) * ux) || (this.r() < 0.5 ? 1 : -1);
      const px = -uz / um * side, pz = ux / um * side, burst = d.rushMove === 'bull' ? 1.2 : 2.6; d.vel.x += ux / um * burst + px * burst * 0.8; d.vel.z += uz / um * burst + pz * burst * 0.8; b.vel.x *= 0.4; b.vel.z *= 0.4; b.reflexT = 0.25;
      this.note(b, false, 'Gave up pressure'); this.note(d, true, 'Beat his blocker'); this.emit(`${d.name} beats ${b.name}`, 'bad'); return; }
    if (why && this.phase === 'live') { this.note(d, true, 'Shed a block'); }
  }
  // Two bodies overlap: soft positional correction + inelastic momentum exchange + balance kick at the contact height.
  resolve(a, b, ov) {
    const n = ov.n, hm = Math.hypot(n.x, n.z);
    if (Math.abs(n.y) > 0.7 || hm < 0.3) { const top = n.y > 0 ? a : b; top.yOff = Math.min(0.18, (top.yOff || 0) + ov.depth * 0.3); return; }
    const nh = v2(n.x / hm, n.z / hm), mates = a.unit === b.unit;
    // the ball carrier (or the QB with the ball) is never moved by a teammate: the teammate gives way
    const cA = mates && a === this.carrier, cB = mates && b === this.carrier, cw = this.carrier === this.qb ? 50 : 4;    // a runner can still be slowed by his own blocker's back
    const ma = a.mass * (a.upright() ? 1 : 4) * (cA ? cw : 1), mb = b.mass * (b.upright() ? 1 : 4) * (cB ? cw : 1), wa = mb / (ma + mb), wb = 1 - wa;
    const push = Math.max(0, ov.depth * hm - 0.01) * 0.55;
    a.p.x += nh.x * push * wa; a.p.z += nh.z * push * wa; b.p.x -= nh.x * push * wb; b.p.z -= nh.z * push * wb;
    const vn = (a.vel.x - b.vel.x) * nh.x + (a.vel.z - b.vel.z) * nh.z; if (vn >= 0) return;
    if (mates) {     // teammates slide off each other: no bounce, no knockdown, and the carrier keeps his speed
      const j = -vn / (1 / ma + 1 / mb); a.vel.x += nh.x * j / ma; a.vel.z += nh.z * j / ma; b.vel.x -= nh.x * j / mb; b.vel.z -= nh.z * j / mb;
      if (j > 260 && !cA && !cB && a !== this.qb && b !== this.qb) { hitBody(a, nh.x * j / a.mass * 0.3, nh.z * j / a.mass * 0.3, ov.at.y, j * 0.3); hitBody(b, -nh.x * j / b.mass * 0.3, -nh.z * j / b.mass * 0.3, ov.at.y, j * 0.3); }
      return;
    }
    const j = -1.08 * vn / (1 / a.mass + 1 / b.mass);
    a.vel.x += nh.x * j / a.mass; a.vel.z += nh.z * j / a.mass; b.vel.x -= nh.x * j / b.mass; b.vel.z -= nh.z * j / b.mass;
    const blockHit = a.bond === b || b.bond === a || a.role === 'block' || b.role === 'block', kh = blockHit ? 0.35 : 1;
    if (j > 45 && !mates) {
      hitBody(a, nh.x * j / a.mass * kh, nh.z * j / a.mass * kh, ov.at.y, j * kh); hitBody(b, -nh.x * j / b.mass * kh, -nh.z * j / b.mass * kh, ov.at.y, j * kh);
      const c = this.carrier; if (c && ((a === c) || (b === c))) { c.lastHitBy = a === c ? b : a; c.lastHitT = this.t; }
      if (this.phase === 'live' && j > 200) { if (c && (a === c || b === c) && this.contactZ === null) { this.contactZ = c.p.z; this.contactT = this.t; } this.bigHit = Math.max(this.bigHit, j); this.fx.push({ kind: 'hit', at: ov.at, j }); }
    }
  }
  // steer a teammate around the ball carrier instead of through him (the back setting up in protection, a lineman pulling past the QB)
  aroundCarrier(p, des) {
    const c = this.carrier; if (!c || c === p || c.unit !== p.unit || this.ball.state !== 'held') return des;
    const rx = c.p.x - p.p.x, rz = c.p.z - p.p.z, dist = Math.hypot(rx, rz); if (dist > 3.2) return des;
    const sp = len2(des); if (sp < 0.3 && dist > 0.75) return des;
    const ux = sp > 0.3 ? des.x / sp : -rx / (dist || 1), uz = sp > 0.3 ? des.z / sp : -rz / (dist || 1);
    const along = rx * ux + rz * uz, lat = rx * uz - rz * ux, clear = 0.95;      // lat > 0: he is to my right of travel
    if (dist < 0.75) { const k = (0.75 - dist) / 0.75 * 4; return v2(des.x - rx / (dist || 1) * k, des.z - rz / (dist || 1) * k); }   // too close: back off
    if (along <= 0 || Math.abs(lat) > clear) return des;
    const side = lat > 0 ? -1 : 1, px = uz * side, pz = -ux * side, k = (clear - Math.abs(lat)) / clear * Math.max(sp, 2.5) * 1.3;   // slide to the open side
    return v2(des.x + px * k, des.z + pz * k);
  }
  trips() {
    for (const a of this.players) {
      if (!a.upright() || (a.tripCd = Math.max(0, (a.tripCd || 0) - DT)) > 0) continue; const sp = len2(a.vel); if (sp < 2.5) continue;
      for (const b of this.players) {
        if (b === a || (b.bal !== 'down' && b.bal !== 'fall')) continue;
        const t = len2(b.th) || 1, ex = b.p.x + b.th.x / t * 1.5, ez = b.p.z + b.th.z / t * 1.5, vx = ex - b.p.x, vz = ez - b.p.z, u = cl(((a.p.x - b.p.x) * vx + (a.p.z - b.p.z) * vz) / (vx * vx + vz * vz), 0, 1);
        if (Math.hypot(a.p.x - (b.p.x + vx * u), a.p.z - (b.p.z + vz * u)) < 0.36) {
          if (this.r() < 0.72 + a.A.agi / 500) { a.tripCd = 0.8; a.om.x += a.vel.x / sp * 0.5; a.om.z += a.vel.z / sp * 0.5; break; }
          a.om.x += a.vel.x / sp * sp * 0.3; a.om.z += a.vel.z / sp * sp * 0.3; a.reflexT = 0.1; a.stun = 0.5; a.tripCd = 1.2; a.vel.x *= 0.7; a.vel.z *= 0.7; break;
        }
      }
    }
  }
  // First contact: momentum exchange + balance kicks where the hit lands + the wrap.
  contact(d, n, dist, shoulder, h) {
    const c = this.carrier; d.contactH = h;
    const face = d.lungeT > 0 || d.bondBy ? 1 : this.facing(d, c), sideOn = face < 0.35 ? 0.5 + 0.5 * cl((face + 0.15) / 0.5, 0, 1) : 1;   // side-on with no lunge: an arm tackle at best
    const vn = (c.vel.x - d.vel.x) * n.x + (c.vel.z - d.vel.z) * n.z, mC = c.mass * (c.truckT > 0 ? 1.2 : 1), mD = d.mass * (d.lungeT > 0 ? 1.1 : 1);
    let J = vn < 0 ? -1.05 * vn / (1 / mC + 1 / mD) * (shoulder ? 1 : 0.3) : 0;
    c.vel.x += n.x * J / c.mass; c.vel.z += n.z * J / c.mass; d.vel.x -= n.x * J / d.mass; d.vel.z -= n.z * J / d.mass;
    const hC = 1.0 - 0.2 * c.crouch, lowness = cl((hC - d.contactH) / hC, -0.6, 0.6); d.lowness = lowness;
    // truck stick: a lowered shoulder takes less and gives more, if the runner has the power
    const tk = c.truckT > 0, pwr = tk ? cl(((c.A.btk + c.A.str) / 2 - (d.A.tak + d.A.str) / 2) / 40, -0.5, 0.7) : 0, kc = tk ? 0.55 - pwr * 0.2 : 1, kd = tk ? 1.2 + pwr : 0.75;
    hitBody(c, n.x * J / c.mass * kc, n.z * J / c.mass * kc, d.contactH, J * kc); hitBody(d, -n.x * J / d.mass * kd, -n.z * J / d.mass * kd, tk ? 1.25 : 1.2, J * (tk ? 1.2 : 0.8));
    c.lastHitBy = d; c.lastHitT = this.t;
    // wrap quality: tackling skill, square-ness, breakdown; carrier moves make it harder but rarely impossible
    const tq = (d.A.tak * 0.65 + d.A.str * 0.2 + d.A.awr * 0.15) / 99, fd = d.fwd(), square = cl(fd.x * n.x + fd.z * n.z, 0, 1);
    let wq = (shoulder ? 0.6 + 0.4 * tq : 0.34 + 0.32 * tq) * (0.72 + 0.28 * square) * (d.brokeDown ? 1 : 0.9)
      * (c.spinT > 0 ? 0.72 : 1) * (c.stiffT > 0 && c.stiffTarget === d ? 0.8 : 1) * (tk ? 0.85 - pwr * 0.15 : 1) * (c.jukeT > 0 ? 0.8 : 1) * (d.diving ? 0.85 : 1) * sideOn;
    if (vn >= 0) wq *= 0.9;                                     // chasing from behind
    if (d.bondBy) wq *= 0.6;                                    // reaching out of a block: arm tackle
    wq *= 1 + (this.userSide === 'O' && d !== this.userD ? this.diff.tk : this.userSide === 'D' && d === this.userD ? -this.diff.tk * 0.5 : 0);
    wq = cl(wq, 0.05, 1);
    d.engaged = true; d.wq = wq; d.gripT = 0; d.lungeT = 0; d.restLen = Math.max(0.6, dist); d.restMin = Math.max(0.58, dist - 0.1);
    if (this.contactZ === null) { this.contactZ = c.p.z; this.contactT = this.t; }
    if (this.fpZ === null) this.fpZ = c.p.z;
    this.bigHit = Math.max(this.bigHit, J); this.fx.push({ kind: shoulder ? 'hit' : 'grab', at: V3((c.p.x + d.p.x) / 2, h, (c.p.z + d.p.z) / 2), j: J });
    this.contacts = (this.contacts || 0) + 1; this.sumJ = (this.sumJ || 0) + J;
    { const t = v2(-n.z, n.x), vt = (c.vel.x - d.vel.x) * t.x + (c.vel.z - d.vel.z) * t.z, Ft = -Math.sign(vt) * 0.45 * J * Math.min(1, Math.abs(vt) / 2.5);
      const yc = ((-n.z * 0.3) * (t.x * Ft) - (-n.x * 0.3) * (t.z * Ft)) / 3.2, yd = ((n.z * 0.3) * (-t.x * Ft) - (n.x * 0.3) * (-t.z * Ft)) / 3.4;
      c.yawVel = cl(c.yawVel + yc, -4.5, 4.5); d.yawVel = cl(d.yawVel + yd, -4.5, 4.5); c.twistV += yc * 0.8; d.twistV += yd * 0.8; }
    if (wq > 0.2) d.wrapped = true;
    else { d.disengageT = 0.5; d.cooldown = 0.6; this.bounces = (this.bounces || 0) + 1; this.note(d, false, 'Bounced off the runner'); this.add(c, '_broken'); }
    if (tk && J > 300 && pwr > 0.15) { d.stun = Math.max(d.stun, 0.6); this.emit(`${c.name} trucks ${d.name}!`, 'good'); }
    // ball security: a big shot on the ball side can beat the carry grip
    if (this.ball.state === 'held') {
      const r = c.right(), fromSide = -(n.x * r.x + n.z * r.z) * Math.sign(c.ballSideV), shock = J * cl(0.35 + fromSide, 0, 1.2) * (this.env.wet ? 1.2 : 1) * (shoulder ? 1 : 0.5);
      const pocketQB = c === this.qb && this.pass && !this.thrown && !this.scramble;
      const carF = cl(1.3 - c.A.car / 100, 0.25, 1), pF = ((pocketQB ? 0.02 : 0.0055) + 0.02 * cl((shock - 60) / 300, 0, 1.5)) * carF * (this.env.wet ? 1.3 : 1);
      if (this.r() < pF) this.fumble(n, J);
    }
  }
  // Wrap = breakable spring constraint. Load above grip capacity = broken tackle.
  gripConstraint(d, n, dist, dt) {
    const c = this.carrier;
    d.restLen = Math.max(d.restMin || 0.6, d.restLen - 1.2 * dt);
    const stretch = dist - d.restLen, relv = (c.vel.x - d.vel.x) * n.x + (c.vel.z - d.vel.z) * n.z;
    const F = Math.max(0, 5000 * stretch + 420 * relv); let load = F;
    if (c.spinT > 0) load += cl(500 + 12 * (c.A.elu - 60), 300, 1100) * (1 - 0.5 * d.wq);
    if (c.stiffT > 0 && c.stiffTarget === d) load += cl(350 + 10 * (c.A.str - 60), 200, 800);
    if (c.truckT > 0) load += cl((c.A.btk - 60) * 9, 0, 450);
    const others = this.foes(c).filter(x => x.wrapped && x !== d).length;
    const cap = d.grip * d.wq * 1.2 * (d.upright() ? 1 : 0.85) * (1 + 0.35 * others) * (1 + Math.min(0.3, d.gripT * 0.5));   // a grip that has held gets stronger (he gets his hands locked)
    d.loadS = d.gripT === 0 ? Math.min(load, cap * 0.7) : d.loadS + (load - d.loadS) * Math.min(1, dt / 0.16);   // arms ride out a jolt; a sustained pull breaks the grip
    d.gripLoad = d.loadS; d.gripCap = cap; d.gripT += dt;
    if (d.loadS > cap && d.gripT > 0.22 && c.upright()) {
      d.wrapped = false; d.disengageT = 0.6; d.cooldown = 0.9; d.om.x += n.x * 1.6; d.om.z += n.z * 1.6;
      this.broken++; this.add(c, '_broken'); this.note(c, true, 'Broke a tackle'); this.note(d, false, 'Missed tackle');
      c.vel.x *= 0.82; c.vel.z *= 0.82;                       // breaking free costs speed
      this.emit(`${c.name} breaks the tackle!`, 'good'); return;
    }
    c.vel.x -= n.x * F / c.mass * dt; c.vel.z -= n.z * F / c.mass * dt; d.vel.x += n.x * F / d.mass * dt; d.vel.z += n.z * F / d.mass * dt;
    if (!c.upright()) return;
    // drag-down: the tackler's hanging weight and leg drive tip the carrier
    const sp = len2(c.vel), vd = sp > 0.5 ? v2(c.vel.x / sp, c.vel.z / sp) : v2(), lowF = cl(d.lowness * 2, 0, 1), behind = cl(-((-n.x) * vd.x + (-n.z) * vd.z) * 1.5, 0, 1);
    const fw = Math.max(0.9 * lowF, 2.2 * behind); let tx = -n.x + vd.x * fw, tz = -n.z + vd.z * fw; const tm = Math.hypot(tx, tz) || 1; tx /= tm; tz /= tm;
    const drag = d.wq * Math.pow(d.mass / c.mass, 0.7) * G * 0.85 * (1 + 3.4 * d.gripT) * (1 + 0.6 * Math.max(0, d.lowness)) * (d.upright() ? 1 : 2.2) * (0.85 + d.A.tak / 330);
    c.ext.x += tx * drag; c.ext.z += tz * drag; d.ext.x += n.x * drag * 0.3; d.ext.z += n.z * drag * 0.3;
  }

  // ---------------- whistle ----------------
  onStumble(p) {}
  onFall(p) {}
  whistle() {
    if (this.air || this.ball.state === 'loose' || this.ball.state === 'snap') return;
    const c = this.carrier; if (!c) return; const dirZ = c.unit === 'O' ? 1 : -1;
    if (c.unit === 'O' && c.p.z >= FIELD.goalZ) return this.endPlay('td', 'Touchdown', c, FIELD.goalZ);
    if (c.unit === 'D' && c.p.z <= 0) return this.endPlay('deftd', 'Returned for a touchdown', c, 0);
    if (Math.abs(c.p.x) > FIELD.halfW) return this.endPlay('oob', 'Out of bounds', c, this.spotOf(c));
    // forward progress: wrapped and going nowhere
    if (this.wrapCount > 0) { c.stoodT = (c.stoodT || 0) + DT; this.fpZ = this.fpZ === null ? c.p.z : dirZ > 0 ? Math.max(this.fpZ, c.p.z) : Math.min(this.fpZ, c.p.z); const prog = ((c.p.z - (c.stoodZ ?? (c.stoodZ = c.p.z))) * dirZ); if (prog > 0.35) { c.stoodZ = c.p.z; c.stoodT = 0; }
      if (c.stoodT > 1.15) { const tk = this.foes(c).filter(d => d.wrapped || d.engaged); return this.endPlay(c === this.qb && this.pass && !this.thrown && !this.qbRun && this.spotOf(c) < this.losZ ? 'sack' : 'tackle', 'Forward progress stopped', c, this.spotOf(c), { tacklers: tk }); } }
    else { c.stoodT = 0; c.stoodZ = c.p.z; this.fpZ = null; }
    if ((c.bal === 'fall' && len2(c.th) > 0.95) || c.bal === 'down') {
      let tk = this.foes(c).filter(d => d.wrapped || d.engaged || (c.lastHitBy === d && this.t - c.lastHitT < 1.2));
      // nobody touched him (he slipped, or tripped over a teammate): he is not down until a defender touches him; otherwise he gets up
      if (!tk.length) { const n = this.foes(c).filter(d => d.upright() && Math.hypot(d.p.x - c.p.x, d.p.z - c.p.z) < 1.1); if (n.length) tk = n; else { c.canRise = true; c.riseDelay = 0.45; return; } }
      if (tk.length && c === this.qb && this.pass && !this.thrown && !this.qbRun && this.spotOf(c) < this.losZ) return this.endPlay('sack', `${tk.map(d => d.name).join(' and ')} sack the QB`, c, this.spotOf(c), { tacklers: tk });
      if (tk.length) return this.endPlay('tackle', `${tk.map(d => d.name).join(' and ')} bring him down`, c, this.spotOf(c), { tacklers: tk });
      return this.endPlay('down', 'Down by contact', c, this.spotOf(c));
    }
    if (this.liveT > 25) return this.endPlay('tackle', 'Whistle', c, this.spotOf(c));
  }
  spotOf(c) { if (c.unit === 'O' && this.fpZ !== null) return Math.max(c.p.z, this.fpZ); return c.p.z; }
  // end of play: compute the result and the stat lines
  endPlay(type, text, who, spotZ, extra = {}) {
    if (this.phase === 'dead') return;
    this.phase = 'dead'; this.deadT = 0;
    const c = who || this.carrier, los = this.losZ, off = this.turnover !== 'int';
    let res = { type, text, spotZ, t: this.liveT, kind: this.kind, carrier: c ? c.pid : null, unit: c ? c.unit : 'O', passer: this.passer ? this.passer.pid : null, catcher: this.catcher ? this.catcher.pid : null,
      turnover: this.turnover || null, bigHit: this.bigHit, broken: this.broken, bounces: this.bounces || 0, contactZ: this.contactZ, tacklers: (extra.tacklers || []).map(d => d.pid),
      contacts: this.contacts || 0, sumJ: this.sumJ || 0, airYds: this.catchZ != null ? (this.catchZ - los) / YD : null, pressured: !!this.pressured, throwT: this.throwT != null ? this.throwT - (this.t - this.liveT) : null };
    const yd = z => (z - los) / YD;
    res.fumbler = this.fumbler ? this.fumbler.pid : null;
    if (type === 'inc') { res.yards = 0; res.clockStop = true; }
    else if (this.turnover === 'int') {
      res.turnover = 'int'; res.clockStop = true; res.returnSpot = spotZ; res.defTD = type === 'deftd'; res.yards = 0;
      if (c) { const ry = (this.catchZ - spotZ) / YD; this.add(c, 'intRY', Math.round(ry)); }
    } else if (type === 'fumbleLost') { res.turnover = 'fumble'; res.clockStop = true; res.yards = yd(spotZ); res.recPid = extra.recovered && extra.recovered.pid; if (!this.stripSack) this.creditYards(this.fumbler, res.yards, false); }
    else if (type === 'fumbleKept' || (type === 'oob' && extra.fumbleOOB)) { res.yards = yd(spotZ); res.clockStop = type === 'oob'; if (!this.stripSack) this.creditYards(this.fumbler, res.yards, false); }
    else {
      res.yards = yd(spotZ); res.td = type === 'td'; res.clockStop = type === 'oob' || type === 'td';
      if (type === 'sack') { res.sack = true; const tk = extra.tacklers || []; tk.forEach((d, i) => { this.add(d, 'sk', i === 0 ? 1 : 0.5); this.add(d, 'tk'); this.note(d, true, 'Sack'); }); this.noteSackAllowed(tk[0]); this.add(this.qb, 'sacked'); }
      else this.creditYards(c, res.yards, res.td);
      if (type === 'tackle' || type === 'down') (extra.tacklers || []).forEach((d, i) => { this.add(d, 'tk'); if (i === 0) this.note(d, true, 'Tackle'); });
      if (spotZ <= 0 && c && c.unit === 'O' && type !== 'td') { res.safety = true; res.clockStop = true; }
    }
    // everyone wrapped goes down with him; the scorer celebrates
    for (const d of this.players) if (d.wrapped && c && (type === 'tackle' || type === 'sack' || type === 'down')) { if (d.upright()) { d.th = v2(c.th.x * 0.7, c.th.z * 0.7); d.om = v2(c.om.x * 0.8, c.om.z * 0.8); startFall(d); } }
    if ((type === 'td' || type === 'deftd') && c) c.celebrate = true;
    for (const p of this.players) p.canRise = true;
    res.stats = this.stats; res.perf = this.perf; res.events = this.events;
    this.result = res; this.fx.push({ kind: type === 'td' || type === 'deftd' ? 'td' : 'whistle' });
  }
  creditYards(c, yards, td) {
    if (!c) return; if (this.ret) { if (td) this.note(c, true, "Return touchdown"); else if (yards >= 25) this.note(c, true, "Long return"); return; } const y = Math.round(yards);
    if (this.catcher && c === this.catcher) { this.add(this.passer, 'py', y); this.add(c, 'recy', y); if (td) { this.add(this.passer, 'ptd'); this.add(c, 'rectd'); this.note(c, true, 'Touchdown catch'); this.note(this.passer, true, 'Touchdown pass'); } }
    else { this.add(c, 'ra'); this.add(c, 'ry', y); if (td) { this.add(c, 'rtd'); this.note(c, true, 'Rushing touchdown'); } if (y >= 10) this.note(c, true, `${y}-yard run`); }
  }
  noteSackAllowed(sacker) { if (!sacker) return; const b = sacker.lastShedBy || this.O.filter(o => o.ol || o.role === 'pp').sort((a, b2) => Math.hypot(a.p.x - sacker.p.x, a.p.z - sacker.p.z) - Math.hypot(b2.p.x - sacker.p.x, b2.p.z - sacker.p.z))[0]; if (b) this.note(b, false, 'Allowed a sack'); }
  deadAI(dt, env) {
    const star = this.result && (this.result.type === 'td' || this.result.type === 'deftd') ? this.players.find(p => p.celebrate && p.pid === this.result.carrier) : null;
    for (const p of this.players) {
      if (p.celebrate && p.upright()) { locomote(p, v2(0, 0), dt, env); continue; }
      // teammates near the scorer run in to celebrate with him
      if (star && p.unit === star.unit && p.upright() && !p.wrapped && this.deadT > 0.4) { const dx = star.p.x - p.p.x, dz = star.p.z - p.p.z, m = Math.hypot(dx, dz) || 1;
        if (m < 20) { if (m < 1.7) { p.celebrate = true; locomote(p, v2(), dt, env); } else { const sp = Math.min(6, m * 1.5); locomote(p, v2(dx / m * sp, dz / m * sp), dt, env); slewHeading(p, Math.atan2(dx, dz), 6, dt); } continue; } }
      if (p.wrapped || p.bal !== 'up') { locomote(p, v2(), dt, env); continue; }
      const sp = len2(p.vel); locomote(p, v2(p.vel.x * Math.max(0, 1 - dt * 2.5), p.vel.z * Math.max(0, 1 - dt * 2.5)), dt, env); if (sp < 0.5 && this.carrier) slewHeading(p, Math.atan2(this.carrier.p.x - p.p.x, this.carrier.p.z - p.p.z), 3, dt);
    }
    if (this.deadT > 0.8) for (const p of this.players) { p.wrapped = false; p.engaged = false; p.bond = null; p.bondBy = null; }
  }
  updatePoses() {
    const B = this.ball, ballLook = B && B.state === 'air' && B.land ? B.p : null;     // eyes on the ball for anyone playing it
    for (const p of this.players) this.poses[p.id] = poseBody(p, ballLook && Math.hypot(p.p.x - B.land.x, p.p.z - B.land.z) < 14 && p !== this.qb && !p.ol ? ballLook : p.unit === 'D' && this.carrier ? this.carrier.p : null);
    for (const p of this.players) poseArms(p, this.poses[p.id], this);
    const c = this.carrier, J = c && this.poses[c.id];
    if (this.ball.state === 'held' && J && J.arms && !(c === this.qb && this.pass && !this.thrown)) { const A = J.arms[c.ballSideV > 0 ? 0 : 1], fa = norm3(sub3(A.hand, A.elbow)); this.ball.axis = norm3(add3(fa, mul3(J.tu, 0.35))); this.ball.p = add3(add3(add3(A.hand, mul3(this.ball.axis, -0.11)), mul3(J.rT, -0.045 * Math.sign(c.ballSideV))), mul3(J.tu, 0.035)); }
    else if (this.ball.state === 'held' && J && J.arms) { const h0 = J.arms[0].hand, h1 = J.arms[1].hand; this.ball.p = V3((h0.x + h1.x) / 2, (h0.y + h1.y) / 2, (h0.z + h1.z) / 2); this.ball.axis = J.rT; }
  }
}
PHYS.Play = Play; PHYS.DIFF = DIFF;
})();
