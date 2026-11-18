// ============================================================
//  PHYSICS BODY (ported from Gridiron Physics Lab)
//  Units: meters, seconds, kilograms, newtons. x = sideline to sideline (+x = offense's left), z = downfield, y = up.
// ============================================================
const PHYS = { _: {} };
(() => {
const G = 9.81, DT = 1 / 120;
const FIELD = { halfW: 26.667 * YD, goalZ: 100 * YD, hashX: 2.82, wk: 1 };
// lateral distance (yards from the ball) -> meters on this field: the first 4 yards are kept (the line, the box), anything wider shrinks with the field
const latM = dy => { const a = Math.abs(dy), s = dy < 0 ? -1 : 1; return s * (a <= 4 ? a : 4 + (a - 4) * FIELD.wk) * YD; };
const v2 = (x = 0, z = 0) => ({ x, z });
const len2 = a => Math.hypot(a.x, a.z);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lp = (a, b, t) => a + (b - a) * t;
const frac = x => x - Math.floor(x);
const smooth = t => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(cl((x - a) / (b - a), 0, 1));
const V3 = (x, y, z) => ({ x, y, z });
const add3 = (a, b) => V3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub3 = (a, b) => V3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul3 = (a, s) => V3(a.x * s, a.y * s, a.z * s);
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len3 = a => Math.hypot(a.x, a.y, a.z);
const norm3 = a => { const l = len3(a); return l > 1e-9 ? mul3(a, 1 / l) : V3(0, 1, 0); };
const wrapAng = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ---------- ratings -> physical profile ----------
// rp = roster player (league object). bonus = rating points added for difficulty/coaching. fat = 0..1 energy (1 fresh)
function physFrom(rp, bonus = 0, fat = 1) {
  const A = {}; for (const k of ATTRS) A[k] = cl(((rp.a && rp.a[k]) ?? 50) + bonus, 10, 105);
  const ht = rp.ht || 73, wt = rp.wt || 220, tr = rp.traits || [];
  const e = 0.9 + 0.1 * cl(fat, 0, 1);                       // a tired player loses up to 10% of his burst
  const o = {
    mass: wt * 0.4536, size: ht / 73,
    // every rating shows up on the field: the spreads are wide enough that a 95 and a 65 play visibly differently
    vmax: (5.0 + A.spd * 0.06) * (0.96 + 0.04 * e), a0: (5.6 + A.acc * 0.068) * e, cut: 0.3 + A.agi * 0.009,
    strength: 0.3 + A.str * 0.0125,
    balCarry: 0.3 + (0.5 * A.str + 0.5 * A.btk) * 0.0125 + (tr.includes('bruiser') ? 0.12 : 0),
    grip: (2600 + 25 * A.tak + 8 * A.str) * (tr.includes('surehands_t') ? 1.12 : 1),
    hands: cl(0.42 + A.cth * 0.0056 + (tr.includes('hands') ? 0.04 : 0), 0.35, 0.985),
    // QB: throw power = ball speed AND how far he can throw it (a 50 arm tops out near 40 yards, a 99 near 70); accuracy = how tight his throws land
    arm: 14.5 + A.thp * 0.135 + (tr.includes('gunslinger') ? 1.2 : 0), accu: cl(0.45 + A.tha * 0.0055 - (tr.includes('gunslinger') ? 0.03 : 0), 0.3, 1),
    range: cl(26 + (A.thp - 30) * 0.6 + (tr.includes('gunslinger') ? 3 : 0), 24, 69), accK: cl(0.38 + (100 - A.tha) / 50 + (tr.includes('gunslinger') ? 0.06 : 0), 0.36, 1.8),
    // jump balls: who wins the ball in the air
    jball: (A.cth * 0.4 + A.jmp * 0.35 + A.str * 0.25), dball: (A.hnd * 0.3 + (A.mcv + A.zcv) * 0.15 + A.jmp * 0.25 + A.str * 0.15),
    A, tr,
  };
  return o;
}

// ---------- player ----------
class Player {
  constructor(o) {
    Object.assign(this, {
      id: o.id, pid: o.pid, rp: o.rp, unit: o.unit, slot: o.slot, pos: o.posName, posName: o.posName, role: o.role || 'idle', label: o.label || o.posName, num: o.num || 0,
      name: o.name || '', size: o.size || 1, girth: Math.sqrt((o.mass || 95) / (95 * Math.pow(o.size || 1, 3))),
      mass: o.mass, vmax: o.vmax, a0: o.a0, cut: o.cut, strength: o.strength, balCarry: o.balCarry, grip: o.grip, hands: o.hands, arm: o.arm, accu: o.accu, range: o.range || 50, accK: o.accK || 0.9, jball: o.jball || 50, dball: o.dball || 50, A: o.A, tr: o.tr || [],
      p: v2(o.x, o.z), vel: v2(), acc: v2(), heading: o.heading || 0,
      crouch: 0.1, crouchT: 0.1, lean: v2(), th: v2(), om: v2(), ext: v2(),
      bal: 'up', fallT: 0, stumbleT: 0, cycle: 0, stepFreq: 2, beta: 0.6, moving: false, gripUse: 0, slipMeter: 0,
      jukeT: 0, jukeDir: v2(), spinT: 0, spinSign: 1, stiffT: 0, stiffTarget: null, truckT: 0,
      lungeT: 0, lungeVel: v2(), lungeDir: v2(), cooldown: 0, engaged: false, wrapped: false,
      wq: 0, gripT: 0, gripLoad: 0, gripCap: 0, contactH: 0.9, brokeDown: false, lowness: 0,
      ballSide: 1, ballSideV: 1, restLen: 0.62, prevVel: v2(),
      flex: v2(), flexV: v2(), nk: v2(), nkV: v2(), twist: 0, twistV: 0, yawVel: 0, fakeLean: v2(), headOffset: 0, disengageT: 0,
      propK: 1, balS: 0, seenV: v2(), stun: 0, reflexT: 0,
    });
    // `pos` is kept as the position name (QB, WR...); the 2D location lives in `p` (alias getter below)
    const r = this.right();
    this.feet = [1, -1].map(s => ({ side: s, x: o.x + r.x * s * 0.15, z: o.z + r.z * s * 0.15, h: 0, pitch: 0, planted: true, fx: 0, fz: 0, tx: 0, tz: 0 }));
  }
  fwd() { return v2(Math.sin(this.heading), Math.cos(this.heading)); }
  right() { const f = this.fwd(); return v2(-f.z, f.x); }
  upright() { return this.bal === 'up' || this.bal === 'stumble'; }
}

function slewHeading(p, target, rate, dt) { const d = wrapAng(target - p.heading); p.heading = wrapAng(p.heading + cl(d, -rate * dt, rate * dt)); }

// Ground-force-limited locomotion. Desired velocity in, real acceleration out.
function locomote(p, desired, dt, env, opts = {}) {
  if (p.bal === 'down' || p.bal === 'rise') { const k = Math.exp(-5 * dt); p.vel.x *= k; p.vel.z *= k; p.acc = v2(); p.gripUse = 0; return; }
  if (p.bal === 'fall') { const k = Math.exp(-1.6 * dt); p.vel.x *= k; p.vel.z *= k; p.acc = v2(); p.gripUse = 0; return; }
  if (p.jumpY > 0.03) { p.acc = v2(); p.gripUse = 0; return; }            // in the air: no ground to push on
  // the player under the user's thumb gets a quicker first step and sharper cuts (a game has to answer the stick right away)
  const U = opts.user ? 1 : 0, grip = env.mu * G * (U ? 1.12 : 1), tau = U ? 0.065 : 0.1;
  let ax = (desired.x - p.vel.x) / tau, az = (desired.z - p.vel.z) / tau;
  const sp = len2(p.vel); let dx, dz;
  if (sp > 0.3) { dx = p.vel.x / sp; dz = p.vel.z / sp; }
  else { const m = Math.hypot(ax, az); if (m > 1e-6) { dx = ax / m; dz = az / m; } else { const f = p.fwd(); dx = f.x; dz = f.z; } }
  let par = ax * dx + az * dz; let px = ax - par * dx, pz = az - par * dz;
  const propMax = (opts.lunge ? grip : p.a0 * (U ? 1.35 : 1) * Math.max(U ? 0.22 : 0, 1 - sp / p.vmax)) * (p.propK ?? 1);
  par = par > 0 ? Math.min(par, propMax) : Math.max(par, -grip * 0.95);
  const pm = Math.hypot(px, pz), latMax = grip * p.cut * (U ? 1.3 : 1), cutDemand = pm / latMax;
  if (pm > latMax) { px *= latMax / pm; pz *= latMax / pm; }
  ax = par * dx + px; az = par * dz + pz;
  let am = Math.hypot(ax, az); if (am > grip) { ax *= grip / am; az *= grip / am; am = grip; }
  p.gripUse = am / grip; p.slipped = false;
  if (env.wet && sp > 6 && cutDemand > 1 && p.upright()) {
    p.slipMeter += dt;
    if (p.slipMeter > 0.14) { p.slipMeter = 0; p.slipped = true; const s = 1 / Math.max(pm, 1e-6); p.om.x -= px * s * 2.4; p.om.z -= pz * s * 2.4; p.vel.x *= 0.75; p.vel.z *= 0.75; }
  } else p.slipMeter = Math.max(0, p.slipMeter - dt);
  const gf = cl(1 - len2(p.th) / 0.65, 0, 1) * (p.bal === 'stumble' ? 0.6 : 1);   // off balance = can't push the ground as hard
  ax *= gf; az *= gf; p.acc.x = ax; p.acc.z = az; p.vel.x += ax * dt; p.vel.z += az * dt;
}

function startFall(p, play) {
  if (p.bal === 'fall' || p.bal === 'down') return;
  p.bal = 'fall'; p.fallT = 0;
  if (len2(p.th) < 1e-3) p.th = v2(p.fwd().x * 0.6, p.fwd().z * 0.6);
  if (play) play.onFall(p);
}
// Inverted-pendulum balance with saturating muscle torque.
function balance(p, dt, play) {
  if (p.bal === 'down') {
    p.om = v2(); p.ext = v2(); p.downT = (p.downT || 0) + dt;
    if ((p.canRise || (!p.wrapped && !p.isCarrier)) && p.downT > (p.riseDelay || 1.1)) p.bal = 'rise';
    return;
  }
  if (p.bal === 'rise') {
    const k = Math.min(1, dt * 1.9); p.th.x -= p.th.x * k; p.th.z -= p.th.z * k; p.om = v2(); p.ext = v2();
    p.crouch = 0.1 + 0.75 * cl(len2(p.th) / 0.8, 0, 1);
    if (len2(p.th) < 0.06) { p.bal = 'up'; p.downT = 0; p.th = v2(); }
    return;
  }
  const L = 1.0 - 0.22 * p.crouch, gl = G / L, t0 = len2(p.th);
  let gx = 0, gz = 0; if (t0 > 1e-6) { const s = gl * Math.sin(t0) / t0; gx = p.th.x * s; gz = p.th.z * s; }
  let mx, mz;
  p.stun = (p.stun || 0) * Math.exp(-dt / 0.45);
  if (p.reflexT > 0 && p.upright()) { p.reflexT -= dt; mx = -1.5 * p.om.x; mz = -1.5 * p.om.z; }
  else if (p.upright()) {
    const kp = 34, kd = 9.5; mx = -(kp * p.th.x + kd * p.om.x); mz = -(kp * p.th.z + kd * p.om.z);
    let cap = (p.balS || p.strength) * 7.5 * (1 + 0.45 * p.crouch) * (p.truckT > 0 ? 1.35 : 1);
    if (p.bal === 'stumble') cap *= 1.25;
    cap *= 1 - p.stun;
    const mm = Math.hypot(mx, mz); if (mm > cap) { mx *= cap / mm; mz *= cap / mm; }
  } else { mx = -3.2 * p.om.x; mz = -3.2 * p.om.z; }
  p.om.x += (gx + mx + p.ext.x) * dt; p.om.z += (gz + mz + p.ext.z) * dt; p.ext.x = 0; p.ext.z = 0;
  const om = len2(p.om); if (om > 6) { p.om.x *= 6 / om; p.om.z *= 6 / om; }
  p.th.x += p.om.x * dt; p.th.z += p.om.z * dt;
  const t = len2(p.th);
  if (p.bal === 'up') { if (t > 0.6) startFall(p, play); else if (t > 0.17) { p.bal = 'stumble'; p.stumbleT = 0; if (play) play.onStumble(p); } }
  else if (p.bal === 'stumble') { p.stumbleT += dt; if (t > 0.6) startFall(p, play); else if (t < 0.06 && len2(p.om) < 0.6) p.bal = 'up'; }
  else if (p.bal === 'fall') {
    p.fallT += dt;
    if (t >= 1.36) { const hitV = len2(p.om); p.th.x *= 1.36 / t; p.th.z *= 1.36 / t; p.om = v2(); p.bal = 'down'; p.downT = 0;
      if (play) play.fx.push({ kind: 'land', at: V3(p.p.x + p.th.x / 1.36 * 0.8, 0.1, p.p.z + p.th.z / 1.36 * 0.8), j: p.mass * hitV }); }
  }
}

// Foot placement: stance feet locked to the turf; swing feet fly to a landing spot predicted from velocity.
function gait(p, dt) {
  const sp = len2(p.vel), r = p.right(), T = v2(p.lean.x + p.th.x, p.lean.z + p.th.z), hx = p.p.x + T.x * 0.85, hz = p.p.z + T.z * 0.85;
  if (!p.upright()) {
    for (const ft of p.feet) {
      const tl = len2(p.th), cx = tl > 1e-3 ? p.th.x / tl : 0, cz = tl > 1e-3 ? p.th.z / tl : 0, tuck = 0.32 * cl(tl / 1.2, 0, 1) * (ft.side > 0 ? 1 : 0.7);
      const tx = p.p.x + r.x * ft.side * 0.16 + cx * tuck, tz = p.p.z + r.z * ft.side * 0.16 + cz * tuck, k = 1 - Math.exp(-8 * dt);
      ft.x += (tx - ft.x) * k; ft.z += (tz - ft.z) * k; ft.h *= Math.exp(-12 * dt); ft.pitch = (ft.pitch || 0) * Math.exp(-8 * dt); ft.planted = true;
    }
    p.moving = false; return;
  }
  let far = false;
  for (const ft of p.feet) { const nx = hx + r.x * ft.side * 0.15, nz = hz + r.z * ft.side * 0.15; if (Math.hypot(ft.x - nx, ft.z - nz) > 0.42) far = true; }
  const active = sp > 0.35 || far || p.bal === 'stumble' || p.spinT > 0;
  let freq = 1.9 + 0.26 * sp; if (p.crouch > 0.45) freq += 1.4 * p.crouch; if (p.bal === 'stumble') freq = Math.max(freq, 4.4);
  p.stepFreq = freq; const beta = cl(0.62 - 0.042 * sp, 0.2, 0.62); p.beta = beta; p.moving = active;
  if (active) p.cycle += freq * 0.5 * dt;
  const Ts = 2 / freq;
  for (let i = 0; i < 2; i++) {
    const ft = p.feet[i];
    if (!active) {
      if (!ft.planted) {
        const nx = hx + r.x * ft.side * 0.15, nz = hz + r.z * ft.side * 0.15, k = 1 - Math.exp(-14 * dt);
        ft.x += (nx - ft.x) * k; ft.z += (nz - ft.z) * k; ft.h *= Math.exp(-14 * dt); ft.pitch = (ft.pitch || 0) * Math.exp(-10 * dt);
        if (ft.h < 0.01 && Math.hypot(nx - ft.x, nz - ft.z) < 0.03) { ft.planted = true; ft.h = 0; }
      }
      continue;
    }
    const ph = frac(p.cycle + i * 0.5);
    if (ph < beta) {
      if (!ft.planted) { ft.x = ft.tx; ft.z = ft.tz; ft.h = 0; ft.planted = true; }
      ft.pitch = -0.55 * Math.min(1, sp / 5) * smooth(cl((ph / beta - 0.55) / 0.45, 0, 1));
    } else {
      if (ft.planted) { ft.planted = false; ft.fx = ft.x - hx; ft.fz = ft.z - hz; }
      const s = (ph - beta) / (1 - beta), lead = (1 - ph) * Ts + beta * Ts * 0.5, lat = sp > 4 ? 0.07 : 0.14;
      ft.tx = hx + p.vel.x * lead + r.x * ft.side * lat - p.acc.x * 0.022; ft.tz = hz + p.vel.z * lead + r.z * ft.side * lat - p.acc.z * 0.022;
      const e = smooth(s), A = Math.min(1, sp / 6);
      const vdx = sp > 0.3 ? p.vel.x / sp : 0, vdz = sp > 0.3 ? p.vel.z / sp : 0, kick = 0.1 * A * Math.sin(Math.PI * Math.min(1, s * 1.8));
      ft.x = hx + lp(ft.fx, ft.tx - hx, e) - vdx * kick; ft.z = hz + lp(ft.fz, ft.tz - hz, e) - vdz * kick;
      ft.h = Math.sin(Math.PI * s) * (0.06 + 0.013 * sp) + Math.min(0.34, sp * 0.036) * Math.exp(-Math.pow((s - 0.36) / 0.2, 2));
      ft.pitch = -1.05 * A * Math.exp(-Math.pow((s - 0.12) / 0.16, 2)) + 0.18 * A * Math.exp(-Math.pow((s - 0.92) / 0.08, 2));
    }
  }
}

// A hit: velocity change (dvx,dvz) landing at height h. Low = legs taken out, high = knocked back.
function hitBody(p, dvx, dvz, h, J) {
  if (p.bal === 'down') return;
  const hC = 1.0 - 0.2 * p.crouch, low = cl((hC - h) / hC, -0.6, 0.6), k = (0.55 - 1.6 * low) * 0.95;
  p.om.x += dvx * k; p.om.z += dvz * k; p.reflexT = 0.11; p.stun = Math.max(p.stun || 0, cl((J - 120) / 800, 0, 0.8));
}
// Upper body and head ride on the pelvis as spring-damped masses; hits and cuts whip them.
function bodyDynamics(p, dt) {
  const f = p.fwd(), r = p.right(), dvx = p.vel.x - p.prevVel.x, dvz = p.vel.z - p.prevVel.z; p.prevVel = v2(p.vel.x, p.vel.z);
  const df = dvx * f.x + dvz * f.z, dr = dvx * r.x + dvz * r.z, up = p.upright(), K = up ? 70 : 30, C = up ? 9 : 7;
  p.flexV.x += (-K * p.flex.x - C * p.flexV.x) * dt - df * 0.9; p.flexV.z += (-K * p.flex.z - C * p.flexV.z) * dt - dr * 0.9;
  p.flex.x = cl(p.flex.x + p.flexV.x * dt, -0.45, 0.55); p.flex.z = cl(p.flex.z + p.flexV.z * dt, -0.45, 0.45);
  p.nkV.x += (-170 * p.nk.x - 15 * p.nkV.x) * dt - df * 1.3; p.nkV.z += (-170 * p.nk.z - 15 * p.nkV.z) * dt - dr * 1.3;
  p.nk.x = cl(p.nk.x + p.nkV.x * dt, -0.45, 0.45); p.nk.z = cl(p.nk.z + p.nkV.z * dt, -0.45, 0.45);
  let tt = 0; if (up && p.look) { const la = Math.atan2(p.look.x, p.look.z); tt = cl(wrapAng(la - p.heading), -1.2, 1.2) * 0.45; }
  if (p.stiffT > 0) tt += 0.35 * (p.ballSideV > 0 ? -1 : 1);
  p.twistV += (60 * (tt - p.twist) - 11 * p.twistV) * dt; p.twist = cl(p.twist + p.twistV * dt, -0.8, 0.8);
  { const v2s = p.vel.x * p.vel.x + p.vel.z * p.vel.z, rate = v2s > 4 ? (p.vel.z * p.acc.x - p.vel.x * p.acc.z) / v2s : 0;
    const tgt = up ? cl(rate * 0.12, -0.32, 0.32) : 0; p.turnYaw = (p.turnYaw || 0) + (tgt - (p.turnYaw || 0)) * Math.min(1, dt / 0.12); }
  p.heading = wrapAng(p.heading + p.yawVel * dt); p.yawVel *= Math.exp(-(up ? 2.6 : 1.4) * dt);
}

// ---------- collision geometry ----------
function segSeg(p1, q1, p2, q2) {
  const d1 = sub3(q1, p1), d2 = sub3(q2, p2), r = sub3(p1, p2), a = dot3(d1, d1), e = dot3(d2, d2), f = dot3(d2, r);
  let s, t;
  if (a < 1e-9 && e < 1e-9) { s = 0; t = 0; } else if (a < 1e-9) { s = 0; t = cl(f / e, 0, 1); }
  else { const c = dot3(d1, r); if (e < 1e-9) { t = 0; s = cl(-c / a, 0, 1); } else { const b = dot3(d1, d2), den = a * e - b * b;
    s = den > 1e-9 ? cl((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e;
    if (t < 0) { t = 0; s = cl(-c / a, 0, 1); } else if (t > 1) { t = 1; s = cl((b - c) / a, 0, 1); } } }
  return { c1: add3(p1, mul3(d1, s)), c2: add3(p2, mul3(d2, t)) };
}
function bodyOverlap(A, B) {
  let best = null;
  for (const ca of A) for (const cb of B) {
    const { c1, c2 } = segSeg(ca.a, ca.b, cb.a, cb.b), d = sub3(c1, c2), dist = len3(d), depth = ca.r + cb.r - dist;
    if (depth > 0 && (!best || depth > best.depth)) { const n = dist > 1e-6 ? mul3(d, 1 / dist) : V3(0, 1, 0); best = { depth, n, at: add3(c2, mul3(n, cb.r)), ka: ca.k, kb: cb.k }; }
  }
  return best;
}
function pushOut(pt, caps, margin) {
  for (const c of caps) { const cc = segSeg(c.a, c.b, pt, pt).c1, d = sub3(pt, cc), dist = len3(d), rr = c.r + margin; if (dist < rr) pt = dist > 1e-6 ? add3(cc, mul3(d, rr / dist)) : add3(cc, V3(0, rr, 0)); }
  return pt;
}
// Cheap collision volumes straight from the physics state (no IK): pads, head, thighs.
// Shins are left out on purpose: swinging lower legs shoving whole bodies was a source of jitter.
function quickCaps(p) {
  const T = v2(p.lean.x + p.th.x, p.lean.z + p.th.z), tl = len2(T), a = Math.min(tl, 1.4), dx = tl > 1e-5 ? T.x / tl : 0, dz = tl > 1e-5 ? T.z / tl : 0;
  const S = p.size || 1, W = S * (p.girth || 1), U = V3(Math.sin(a) * dx, Math.cos(a), Math.sin(a) * dz);
  const f3 = V3(Math.sin(p.heading), 0, Math.cos(p.heading)), run = p.upright();
  const pelvis = add3(V3(p.p.x, 0, p.p.z), mul3(U, (0.93 - 0.22 * p.crouch) * S));
  const bend = !run ? 0.38 : 0.85 * p.crouch + (p.lungeT > 0 ? 0.55 : 0) + (p.truckT > 0 ? 0.35 : 0) + (p.wrapped ? 0.3 : 0);
  const tu = norm3(add3(U, mul3(f3, bend))), chest = add3(pelvis, mul3(tu, 0.5 * S)), head = add3(chest, mul3(tu, 0.26 * S));
  const rx = -f3.z, rz = f3.x, out = [{ a: add3(pelvis, mul3(tu, -0.05)), b: chest, r: 0.2 * W, k: 'torso' }, { a: head, b: head, r: 0.16 * W, k: 'head' }];
  for (const ft of p.feet) { const hip = V3(pelvis.x + rx * ft.side * 0.1 * W, pelvis.y, pelvis.z + rz * ft.side * 0.1 * W), knee = V3((hip.x + ft.x) / 2, Math.max(0.3, (hip.y + ft.h) / 2 + 0.03), (hip.z + ft.z) / 2); out.push({ a: hip, b: knee, r: 0.1 * W, k: 'leg' }); }
  if (p.lungeT > 0) out.push({ a: chest, b: add3(add3(chest, mul3(f3, 0.62)), mul3(tu, -0.12)), r: 0.11, k: 'arms' });
  return out;
}
function bodyCaps(J, p) {
  const L = J.legs, w = p ? (p.size || 1) * (p.girth || 1) : 1;
  return [{ a: add3(J.pelvis, mul3(J.tuL || J.tu, -0.05)), b: J.chest, r: 0.2 * w, k: 'torso' }, { a: J.head, b: J.head, r: 0.16 * w, k: 'head' },
    { a: L[0].hip, b: L[0].knee, r: 0.1 * w, k: 'leg' }, { a: L[1].hip, b: L[1].knee, r: 0.1 * w, k: 'leg' },
    { a: L[0].knee, b: L[0].ankle, r: 0.065 * w, k: 'leg' }, { a: L[1].knee, b: L[1].ankle, r: 0.065 * w, k: 'leg' }];
}

// ---------- pose: world joint positions from physics state (drives the skinned meshes) ----------
function ik2(root, target, l1, l2, hint) {
  const d = sub3(target, root), dist = len3(d), dir = dist > 1e-6 ? mul3(d, 1 / dist) : V3(0, -1, 0);
  const dc = cl(dist, Math.abs(l1 - l2) + 0.02, (l1 + l2) * 0.999), end = add3(root, mul3(dir, dc));
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let b = sub3(hint, mul3(dir, dot3(hint, dir))); const bl = len3(b);
  b = bl < 1e-4 ? norm3(cross3(dir, Math.abs(dir.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0))) : mul3(b, 1 / bl);
  return { mid: add3(add3(root, mul3(dir, a)), mul3(b, h)), end };
}
const BODY = { thigh: 0.44, shin: 0.42, ankle: 0.1, uarm: 0.31, farm: 0.29, torso: 0.5 };
function rotAbout(v, axis, ang) { const c = Math.cos(ang), sn = Math.sin(ang); return add3(add3(mul3(v, c), mul3(cross3(axis, v), sn)), mul3(axis, dot3(axis, v) * (1 - c))); }
function poseBody(p, lookAt) {
  const T = v2(p.lean.x + p.th.x + p.fakeLean.x, p.lean.z + p.th.z + p.fakeLean.z), tl = len2(T), a = Math.min(tl, 1.4);
  const dx = tl > 1e-5 ? T.x / tl : 0, dz = tl > 1e-5 ? T.z / tl : 0, U = V3(Math.sin(a) * dx, Math.cos(a), Math.sin(a) * dz);
  const sp = len2(p.vel), run = p.upright(), bounce = run && p.moving ? 0.028 * Math.min(1, sp / 4) * Math.cos(4 * Math.PI * p.cycle) : 0;
  // stance: three-point for linemen (hips low, back flat-ish), two-point for the rest; eased out over ~0.15 s after the snap (p.stK)
  const stK = sstep(0, 1, p.stK || 0), st3 = p.stance3 ? stK : 0, st2 = p.stance3 ? 0 : stK, engaged = run && (p.bond || p.bondBy) ? 1 : 0;
  const S = p.size || 1, W = S * (p.girth || 1), pelvisH = (0.93 - 0.22 * p.crouch - Math.min(0.06, sp * 0.006) + bounce - 0.16 * st3 - 0.06 * st2 - 0.05 * engaged) * S;
  const f3 = V3(Math.sin(p.heading), 0, Math.cos(p.heading)), hinge = run ? (0.17 * p.crouch + 0.1 * st3) * S : 0;
  const jy = run ? (p.jumpY || 0) : 0, pelvis = add3(add3(V3(p.p.x, (p.yOff || 0) + jy, p.p.z), mul3(U, pelvisH)), mul3(f3, -hinge));
  const bend = !run ? (p.bal === 'rise' ? 0.6 : 0.38) : (0.85 * p.crouch + 0.014 * sp + (p.lungeT > 0 ? 0.55 : 0) + (p.truckT > 0 ? 0.35 : 0) + (p.wrapped ? 0.3 : 0) + 1.25 * st3 + 0.25 * st2 + 0.4 * engaged);
  const tu = norm3(add3(U, mul3(f3, bend))), c1 = cross3(f3, tu); let rT;
  if (len3(c1) > 0.3) rT = norm3(c1); else { const rw = V3(-f3.z, 0, f3.x); rT = norm3(sub3(rw, mul3(tu, dot3(rw, tu)))); }
  if (p.headOffset) rT = norm3(rotAbout(rT, tu, -p.headOffset));
  const twAmp = run && p.moving ? Math.min(0.17, 0.03 + sp * 0.015) : 0, tw = Math.cos(2 * Math.PI * p.cycle) * twAmp, ty = p.turnYaw || 0;
  const rH = norm3(rotAbout(rT, tu, tw + ty)); let rS = norm3(rotAbout(rT, tu, -tw * 1.25 + ty * 0.55));
  const fH = cross3(tu, rH), fT0 = cross3(tu, rS), spine = add3(pelvis, mul3(tu, BODY.torso * 0.5 * S));
  const tuU = norm3(add3(add3(tu, mul3(fT0, p.flex.x)), mul3(rS, p.flex.z)));
  rS = norm3(rotAbout(sub3(rS, mul3(tuU, dot3(rS, tuU))), tuU, p.twist));
  const fT = cross3(tuU, rS), chest = add3(spine, mul3(tuU, BODY.torso * 0.5 * S)), neck = add3(chest, mul3(tuU, 0.1 * S));
  let hu = run ? norm3(add3(mul3(tuU, 0.4), V3(0, 0.6, 0))) : tuU; hu = norm3(add3(add3(hu, mul3(fT, p.nk.x)), mul3(rS, p.nk.z)));
  let hf0 = V3(fT.x, run ? 0 : fT.y, fT.z);
  if (lookAt && run) { const d = norm3(V3(lookAt.x - neck.x, 0, lookAt.z - neck.z)), fh = norm3(V3(fT.x, 0, fT.z)); hf0 = dot3(d, fh) > -0.2 ? norm3(add3(mul3(fh, 0.35), mul3(d, 0.65))) : fh; }
  // engaged linemen put their head to one side of the man across from them instead of helmet-into-helmet
  const hf = norm3(sub3(hf0, mul3(hu, dot3(hf0, hu)))), hr = cross3(hf, hu), head = add3(add3(add3(neck, mul3(hu, 0.15 * S)), mul3(hf, 0.03 * S)), mul3(rS, 0.085 * S * engaged));
  const sh = [add3(add3(chest, mul3(rS, 0.2 * W)), mul3(tuU, -0.03 * S)), add3(add3(chest, mul3(rS, -0.2 * W)), mul3(tuU, -0.03 * S))];
  const hips = [add3(add3(pelvis, mul3(rH, 0.1 * W)), mul3(tu, -0.03 * S)), add3(add3(pelvis, mul3(rH, -0.1 * W)), mul3(tu, -0.03 * S))];
  const kneeHint = run ? add3(f3, mul3(fH, 0.3)) : add3(fH, V3(0, 0.05, 0));
  const legs = p.feet.map((ft, i) => {
    const pitch = ft.pitch || 0, prone = !run && fH.y < -0.3;
    const target = V3(ft.x, BODY.ankle * S + ft.h + Math.max(0, -pitch) * 0.05 + (prone ? 0.2 : 0) + (run ? jy * (i ? 0.78 : 0.92) : (p.yOff || 0)), ft.z);
    let k = ik2(hips[i], target, BODY.thigh * S, BODY.shin * S, kneeHint);
    for (let it = 0; it < 6 && k.mid.y < 0.075; it++) { target.y += (0.075 - k.mid.y) * 1.6 + 0.01; k = ik2(hips[i], target, BODY.thigh * S, BODY.shin * S, kneeHint); }
    k.end.y = Math.max(k.end.y, 0.06);
    const fp = prone || !run ? 0.35 : pitch, fd = norm3(add3(mul3(f3, Math.cos(fp)), V3(0, Math.sin(fp), 0)));
    const toe = add3(add3(k.end, mul3(fd, 0.16 * S)), V3(0, -0.055 * S * Math.cos(fp), 0)); toe.y = Math.max(toe.y, 0.03);
    return { hip: hips[i], knee: k.mid, ankle: k.end, toe, pitch };
  });
  return { U, tu: tuU, tuL: tu, rT: rS, rH, fT, fH, f3, pelvis, spine, chest, neck, head, hu, hf, hr, sh, hips, legs, heading: p.heading };
}
// arms: game is the Play (needs carrier, qb, ball, pass, thrown, poses, caps, players)
function poseArms(p, J, game) {
  const sp = len2(p.vel), { tu, rT, fT, chest, sh, pelvis } = J, A = Math.min(1, sp / 8), arms = [];
  const fallDir = (() => { const t = len2(p.th); return t > 1e-3 ? V3(p.th.x / t, 0, p.th.z / t) : J.f3; })();
  const c = game.carrier, B = game.ball;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    let tgt, hint = norm3(add3(add3(mul3(fT, -0.7), mul3(tu, -0.5)), mul3(rT, side * 0.35)));
    const isBallArm = p === c && B && B.state === 'held' && Math.sign(p.ballSideV || 1) === side && !(p === game.qb && game.pass && !game.thrown);
    const eta = B && B.state === 'air' ? B.T - B.t : 9;
    const reachBall = B && B.state === 'air' && B.land && p.upright() && eta < 0.55 && p !== game.qb && !p.ol && (B.target === p || Math.hypot(p.p.x - B.land.x, p.p.z - B.land.z) < (p.unit !== game.offUnit ? 1.8 : 2.2));
    if (p === game.qb && game.pass && i === 0 && (p.windup > 0 || p.throwAnim > 0)) {
      const k = p.windup > 0 ? 0 : smooth(Math.min(1, (1 - p.throwAnim / 0.45) * 2.2));
      const cocked = add3(add3(add3(sh[i], mul3(tu, 0.2)), mul3(fT, -0.2)), mul3(rT, 0.06)), through = add3(add3(add3(chest, mul3(fT, 0.5)), mul3(tu, -0.18)), mul3(rT, -0.18));
      tgt = add3(mul3(cocked, 1 - k), mul3(through, k)); hint = norm3(add3(mul3(rT, 0.7), mul3(tu, -0.3)));
    } else if (p === game.qb && game.pass && !game.thrown && c === p && p.upright()) {
      tgt = add3(add3(add3(chest, mul3(fT, 0.25)), mul3(tu, 0.03)), mul3(rT, side * 0.06)); hint = norm3(add3(mul3(tu, -0.7), mul3(rT, side * 0.5)));
    } else if (reachBall) {      // hands to the ball (a defender swatting goes over the top of it)
      const sw = p.unit !== game.offUnit && p.swatT > 0, bx = B.p.x + (sw ? 0 : rT.x * side * 0.08), bz = B.p.z + (sw ? 0 : rT.z * side * 0.08);
      tgt = V3(bx, B.p.y + (sw ? (i === 0 ? 0.16 : -0.1) : -0.04), bz); hint = norm3(add3(mul3(tu, -0.5), mul3(rT, side * 0.6))); }
    else if (isBallArm) { const bs = p.ballSideV; tgt = add3(add3(add3(chest, mul3(rT, bs * 0.13)), mul3(fT, 0.24)), mul3(tu, -0.15)); hint = norm3(add3(mul3(fT, -0.5), add3(mul3(tu, -0.8), mul3(rT, side * 0.2)))); }
    else if (!p.upright()) { tgt = add3(add3(pelvis, mul3(fallDir, 0.8)), mul3(rT, side * 0.28)); tgt.y = 0.06; hint = norm3(add3(mul3(rT, side), mul3(tu, -0.3))); }
    else if (p.stance3 && i === 0 && (p.stK || 0) > 0.5) { tgt = add3(sh[i], mul3(J.f3, 0.26)); tgt.y = 0.04; hint = norm3(add3(mul3(fT, -0.4), mul3(rT, 0.5))); }      // down hand on the turf
    else if (p.stance && game.qb === p && game.phase === 'pre') { tgt = add3(add3(add3(chest, mul3(fT, 0.28)), mul3(tu, -0.08)), mul3(rT, side * 0.07)); hint = norm3(add3(mul3(tu, -0.7), mul3(rT, side * 0.5))); }   // QB: hands ready for the snap
    else if ((p.stK || 0) > 0.5) { const L = J.legs[i]; tgt = add3(add3(mul3(add3(L.knee, L.hip), 0.5), mul3(J.fH, 0.08)), mul3(J.rH, side * 0.02)); hint = norm3(add3(mul3(rT, side), mul3(fT, -0.2))); }     // hands on the thighs / knee
    else if (p === c && p.stiffT > 0 && p.stiffTarget) { const o = game.poses[p.stiffTarget.id]; tgt = o ? add3(o.chest, mul3(o.tu, 0.05)) : add3(sh[i], mul3(fT, 0.6)); hint = norm3(add3(mul3(tu, -1), mul3(rT, side * 0.3))); }
    else if ((p.wrapped || p.lungeT > 0) && c && p.unit !== c.unit) {
      const o = game.poses[c.id], toC = norm3(V3(c.p.x - p.p.x, 0, c.p.z - p.p.z));
      if (p.wrapped && o) { const s2 = Math.sign(dot3(rT, o.rT) || 1) * side, waist = add3(o.pelvis, mul3(o.tu, 0.2)); tgt = add3(add3(waist, mul3(o.rT, s2 * 0.25)), mul3(toC, 0.1)); }
      else tgt = add3(add3(J.chest, mul3(fT, 0.55)), mul3(rT, side * 0.2));
      hint = norm3(add3(mul3(rT, side * 0.9), mul3(tu, -0.2)));
    } else if ((p.bond || p.bondBy) && p.upright()) {
      const o = game.poses[(p.bond || p.bondBy).id];
      // hands inside on his chest plate, elbows bent: the reach is clamped so the arms never lock out
      tgt = o ? add3(add3(add3(o.chest, mul3(o.tu, -0.1)), mul3(o.fT, 0.12)), mul3(o.rT, side * 0.1 * (dot3(rT, o.rT) < 0 ? -1 : 1))) : add3(chest, mul3(fT, 0.4));
      { const reach = (BODY.uarm + BODY.farm) * (p.size || 1) * 0.82, d = sub3(tgt, sh[i]), dl = len3(d); if (dl > reach) tgt = add3(sh[i], mul3(d, reach / dl)); }
      hint = norm3(add3(add3(mul3(tu, -0.9), mul3(rT, side * 0.45)), mul3(fT, -0.2)));
    } else if (p.bal === 'stumble') { tgt = add3(add3(add3(sh[i], mul3(rT, side * 0.42)), mul3(tu, -0.12)), mul3(fT, 0.12)); hint = norm3(add3(mul3(tu, -0.6), mul3(fT, -0.4))); }
    else if (p.unit !== game.offUnit && p.crouch > 0.28) { tgt = add3(add3(add3(chest, mul3(fT, 0.42)), mul3(rT, side * 0.16)), mul3(tu, -0.2)); hint = norm3(add3(add3(mul3(rT, side * 0.35), mul3(tu, -0.85)), mul3(fT, -0.15))); }
    else if (p.celebrate) { const ph = Math.sin((game.t || 0) * 7 + i * 3); tgt = add3(add3(sh[i], mul3(tu, 0.5 + 0.1 * ph)), mul3(rT, side * 0.15)); hint = norm3(add3(mul3(rT, side), mul3(fT, -0.3))); }
    else {
      const s = -side * Math.cos(2 * Math.PI * p.cycle) * (p.moving ? 1 : 0), fwdAmt = s > 0 ? 0.26 * s : 0.24 * s, up = s > 0 ? 0.2 * s : 0;
      tgt = add3(add3(add3(sh[i], mul3(fT, (0.08 + fwdAmt) * (0.35 + 0.65 * A))), mul3(tu, -0.4 + up * (0.4 + 0.6 * A))), mul3(rT, side * (0.02 - 0.05 * Math.max(0, s))));
    }
    const others = game.near && game.near[p.id] ? game.near[p.id] : null;
    if (others && others.length) tgt = pushOut(tgt, others, 0.035);
    const k = ik2(sh[i], tgt, BODY.uarm * (p.size || 1), BODY.farm * (p.size || 1), hint);
    if (others && others.length) { k.mid = pushOut(k.mid, others, 0.03); k.end = pushOut(k.end, others, 0.035); }
    k.mid.y = Math.max(k.mid.y, 0.06); k.end.y = Math.max(k.end.y, 0.05);
    arms.push({ sh: sh[i], elbow: k.mid, hand: k.end });
  }
  J.arms = arms; return J;
}
PHYS.setWidth = k => { FIELD.wk = Math.max(0.5, Math.min(1, +k || 1)); FIELD.halfW = 26.667 * YD * FIELD.wk; };     // phone games use a narrower field
Object.assign(PHYS._, { G, DT, FIELD, latM, v2, len2, cl, lp, frac, smooth, sstep, V3, add3, sub3, mul3, dot3, cross3, len3, norm3, wrapAng, physFrom, Player, slewHeading, locomote, startFall, balance, gait, hitBody, bodyDynamics, segSeg, bodyOverlap, pushOut, quickCaps, bodyCaps, ik2, BODY, rotAbout, poseBody, poseArms });
Object.assign(PHYS, { G, DT, FIELD, physFrom, poseBody, poseArms, BODY });
})();
