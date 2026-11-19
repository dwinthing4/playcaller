// ============================================================
//  PLAYER MODELS (ported from Gridiron character lab): SDF sculpting -> surface nets -> skinned mesh.
//  Colors are not baked: every vertex stores weights over a small palette of "slots" (jersey, trim, pants, skin...),
//  so one sculpted body is recolored per team / kit / skin tone by the shader.
// ============================================================
const R3D = { _: {} };
(() => {
const cl = (x, a, b) => x < a ? a : x > b ? b : x, lp = (a, b, t) => a + (b - a) * t;
function sstep(a, b, x) { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function smin(a, b, k) { if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
function hash3(i, j, k) { let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; h = h ^ (h >>> 16); return (h & 0xffffff) / 0xffffff; }
function vnoise(x, y, z) { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z); let fx = x - i, fy = y - j, fz = z - k; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = hash3(i, j, k), b = hash3(i + 1, j, k), c = hash3(i, j + 1, k), d = hash3(i + 1, j + 1, k), e = hash3(i, j, k + 1), f = hash3(i + 1, j, k + 1), g = hash3(i, j + 1, k + 1), h = hash3(i + 1, j + 1, k + 1);
  return lp(lp(lp(a, b, fx), lp(c, d, fx), fy), lp(lp(e, f, fx), lp(g, h, fx), fy), fz); }
function fbm(x, y, z) { return vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15; }
// ---- palette slots ----
// body: 0 jersey 1 collar (trim) 2 pants 3 pantsStripe (unused since v9) 4 socks 5 skin 6 glove 7 cleat 8 sole 9 spat (cleat collar) 10 belt 11 ankle (lower sock) 12-13 spare (old baked dirt) 14 neckRoll
//       15-18 left arm: upper, elbow, forearm, wrist   19-22 right arm: upper, elbow, forearm, wrist   23-26 tattoo pattern: upper L, forearm L, upper R, forearm R
//       27 glove palm 28 glove cuff 29 cleat heel / toe accent 30-31 spare
// Each player sets these per region, so one sculpted body shows bare arms, full / elbow / half sleeves on either arm, tape, bands, tattoos, spats...
// Stripes, seams, dirt and fabric are not baked into the slots: the mesh stores smooth "design coordinates" (dz) and a baked
// ambient occlusion term, and the player shader draws crisp stripes / stitching / stains from them per kit (see 20_scene.js).
const NS = 32, NSH = 12, NSG = 12;
const SLOT = n => { const a = new Float32Array(NS); a[n] = 1; return a; }, ZERO = new Float32Array(NS);
function mixc(a, b, t) { const o = new Float32Array(NS); for (let i = 0; i < NS; i++) o[i] = a[i] + (b[i] - a[i]) * t; return o; }
function scl(a, s) { const o = new Float32Array(NS); for (let i = 0; i < NS; i++) o[i] = a[i] * s; return o; }
// ---- primitives ----
class Prim { constructor() { Object.assign(this, { t: 0, cx: 0, cy: 0, cz: 0, rx: 1, ry: 1, rz: 1, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r1: 0, r2: 0, bax: 0, bay: 0, baz: 0, l2: 1, rr: 0, a2: 1, il2: 1, hx: 0, hy: 0, hz: 0, rad: 0, ang: 0, k: 0.03, g: 0, bone: 0, wr: 0, dirt: 0, num: 0, skin: 0, col: null, _t: 0, bx0: 0, by0: 0, bz0: 0, br: 0 }); } opt(o) { if (o) for (const k in o) this[k] = o[k]; return this; } }
function E(c, r, o) { const P = new Prim(); P.t = 0; P.cx = c[0]; P.cy = c[1]; P.cz = c[2]; P.rx = r[0]; P.ry = r[1]; P.rz = r[2]; return P.opt(o); }
function C(a, b, r1, r2, o) { const P = new Prim(); P.t = 1; P.ax = a[0]; P.ay = a[1]; P.az = a[2]; P.bx = b[0]; P.by = b[1]; P.bz = b[2]; P.r1 = r1; P.r2 = r2; P.opt(o);
  P.bax = P.bx - P.ax; P.bay = P.by - P.ay; P.baz = P.bz - P.az; P.l2 = P.bax * P.bax + P.bay * P.bay + P.baz * P.baz; P.rr = r1 - r2; P.a2 = P.l2 - P.rr * P.rr; P.il2 = 1 / P.l2; return P; }
function T(c, Rr, r, o) { const P = new Prim(); P.t = 3; P.cx = c[0]; P.cy = c[1]; P.cz = c[2]; P.rx = Rr; P.ry = r; P.rz = 1; return P.opt(o); }
function B(c, hs, rad, o) { const P = new Prim(); P.t = 2; P.cx = c[0]; P.cy = c[1]; P.cz = c[2]; P.hx = hs[0]; P.hy = hs[1]; P.hz = hs[2]; P.rad = rad; P.k = 0.01; return P.opt(o); }
function sdP(P, x, y, z) {
  if (P.t === 0) { const X = (x - P.cx) / P.rx, Y = (y - P.cy) / P.ry, Z = (z - P.cz) / P.rz, k0 = Math.sqrt(X * X + Y * Y + Z * Z), X1 = X / P.rx, Y1 = Y / P.ry, Z1 = Z / P.rz, k1 = Math.sqrt(X1 * X1 + Y1 * Y1 + Z1 * Z1); P._t = 0; return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(P.rx, P.ry, P.rz); }
  if (P.t === 1) { const px = x - P.ax, py = y - P.ay, pz = z - P.az, yy = px * P.bax + py * P.bay + pz * P.baz, zz = yy - P.l2, qx = px * P.l2 - P.bax * yy, qy = py * P.l2 - P.bay * yy, qz = pz * P.l2 - P.baz * yy, x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * P.l2, z2 = zz * zz * P.l2, k = Math.sign(P.rr) * P.rr * P.rr * x2; P._t = cl(yy * P.il2, 0, 1);
    if (Math.sign(zz) * P.a2 * z2 > k) return Math.sqrt(x2 + z2) * P.il2 - P.r2; if (Math.sign(yy) * P.a2 * y2 < k) return Math.sqrt(x2 + y2) * P.il2 - P.r1; return (Math.sqrt(x2 * P.a2 * P.il2) + yy * P.rr) * P.il2 - P.r1; }
  if (P.t === 3) { const px = x - P.cx, pz = z - P.cz, py = (y - P.cy) / P.rz, q = Math.sqrt(px * px + pz * pz) - P.rx; P._t = 0; return Math.sqrt(q * q + py * py) - P.ry; }
  if (P.ang) { const dx = x - P.cx, dy = y - P.cy, ca = Math.cos(P.ang), sa = Math.sin(P.ang); x = P.cx + dx * ca + dy * sa; y = P.cy - dx * sa + dy * ca; }
  const qx = Math.abs(x - P.cx) - P.hx + P.rad, qy = Math.abs(y - P.cy) - P.hy + P.rad, qz = Math.abs(z - P.cz) - P.hz + P.rad; P._t = 0;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0); return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - P.rad;
}
function axisRadial(P, x, y, z) { const t = P._t, ox = x - (P.ax + P.bax * t), oy = y - (P.ay + P.bay * t), oz = z - (P.az + P.baz * t), l = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1; return [ox / l, oy / l, oz / l]; }
// ---- surface nets mesher with a coarse pass ----
function meshSDF(model) {
  const [x0, y0, z0, x1, y1, z1] = model.bounds, h = model.h, sdf = model.sdf, nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const F = new Float32Array(nx * ny * nz), Cs = 4, cnx = Math.ceil((nx - 1) / Cs) + 1, cny = Math.ceil((ny - 1) / Cs) + 1, cnz = Math.ceil((nz - 1) / Cs) + 1, CF = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) CF[i + cnx * (j + cny * k)] = sdf(x0 + i * Cs * h, y0 + j * Cs * h, z0 + k * Cs * h);
  const thr = Cs * 0.5 * h * 1.8 + 0.02;
  for (let k = 0; k < nz; k++) { const ck = Math.min(Math.round(k / Cs), cnz - 1); for (let j = 0; j < ny; j++) { const cj = Math.min(Math.round(j / Cs), cny - 1); for (let i = 0; i < nx; i++) {
    const ci = Math.min(Math.round(i / Cs), cnx - 1), cv = CF[ci + cnx * (cj + cny * ck)], n = i + nx * (j + ny * k); F[n] = Math.abs(cv) > thr ? cv : sdf(x0 + i * h, y0 + j * h, z0 + k * h); } } }
  const vidx = new Int32Array(nx * ny * nz).fill(-1), pos = [], E12 = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], v = new Float32Array(8), sx = 1, sy = nx, sz = nx * ny;
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const n = i + nx * (j + ny * k); let mask = 0; for (let c = 0; c < 8; c++) { v[c] = F[n + co[c][0] * sx + co[c][1] * sy + co[c][2] * sz]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue; let ax = 0, ay = 0, az = 0, cnt = 0;
    for (const [a, b] of E12) if ((v[a] < 0) !== (v[b] < 0)) { const t = v[a] / (v[a] - v[b]); ax += co[a][0] + (co[b][0] - co[a][0]) * t; ay += co[a][1] + (co[b][1] - co[a][1]) * t; az += co[a][2] + (co[b][2] - co[a][2]) * t; cnt++; }
    vidx[n] = pos.length / 3; pos.push(x0 + (i + ax / cnt) * h, y0 + (j + ay / cnt) * h, z0 + (k + az / cnt) * h);
  }
  const idx = []; const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const n = i + nx * (j + ny * k), f0 = F[n] < 0;
    if (f0 !== (F[n + sx] < 0)) quad(vidx[n - sy - sz], vidx[n - sz], vidx[n], vidx[n - sy], !f0);
    if (f0 !== (F[n + sy] < 0)) quad(vidx[n - sz - sx], vidx[n - sx], vidx[n], vidx[n - sz], !f0);
    if (f0 !== (F[n + sz] < 0)) quad(vidx[n - sx - sy], vidx[n - sy], vidx[n], vidx[n - sx], !f0); }
  const nv = pos.length / 3, P = new Float32Array(pos), N = new Float32Array(nv * 3), e = model.eps || h * 0.3;
  for (let q = 0; q < nv; q++) { const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2]; let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e); const l = Math.hypot(gx, gy, gz) || 1; N[q * 3] = gx / l; N[q * 3 + 1] = gy / l; N[q * 3 + 2] = gz / l; }
  const out = { position: P, normal: N, index: nv > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), count: nv };
  if (model.attribs) model.attribs(out);
  return out;
}
// ---- body build: proportions from height / weight / muscle ----
function bodyParams(o) { const Hm = o.heightIn * 0.0254, kg = o.weightLb * 0.4536, bmi = kg / (Hm * Hm), H = Hm / 1.88, g = Math.sqrt(bmi / 27), m = o.muscle, fat = cl((bmi - 28) / 11, 0, 1) * (1 - m * 0.6); return { H, g, m, fat, bmi, Hm }; }
const BONES = ['root', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR']; const BI = {}; BONES.forEach((b, i) => BI[b] = i);
function skeleton(bp) {
  const { H, g } = bp, Y = v => v * H, J = {};
  J.root = [0, Y(0.98), 0]; J.spine = [0, Y(1.12), 0]; J.chest = [0, Y(1.30), 0]; J.neck = [0, Y(1.52), -0.01]; J.head = [0, Y(1.715) + 0.04 * (H - 1), 0.004];
  const sx = 0.185 * H * (0.55 + 0.45 * g);
  for (const [s, L] of [[1, 'L'], [-1, 'R']]) { const ex = sx + 0.072 * H + (g - 1) * 0.16, wx = ex + 0.028 * H + (g - 1) * 0.06; J['sh' + L] = [s * sx, Y(1.50), -0.005]; J['el' + L] = [s * ex, Y(1.18), -0.035]; J['wr' + L] = [s * wx, Y(0.925), 0.03];
    const hx = 0.092 * H * (0.5 + 0.5 * g); J['hip' + L] = [s * hx, Y(0.95), 0]; J['kn' + L] = [s * (hx + 0.03 * H), Y(0.52), 0.025]; J['an' + L] = [s * (hx + 0.058 * H), 0.09, -0.012]; }
  return J;
}
const PADS = { speed: { box: [0.112, 0.05, 0.138, 0.045, 0.22], capY: 1.505, capX: 0.012, cap: [0.118, 0.063, 0.142], arch: [0.20, 0.092, 0.152], archY: 1.475, plate: 1, sl: 0.082, slT: 0.30, roll: 0, stripes: 2, hole: 1 },
  sleek: { cap: [0.10, 0.052, 0.13], capY: 1.512, capX: -0.004, arch: [0.185, 0.08, 0.145], archY: 1.47, plate: 0.75, sl: 0.072, slT: 0.25, roll: 0, stripes: 1, hole: 0.96 },
  trench: { capY: 1.508, capX: 0.035, cap: [0.108, 0.056, 0.13], arch: [0.175, 0.098, 0.156], archY: 1.48, plate: 1.1, sl: 0.088, slT: 0.27, roll: 1, stripes: 0, hole: 1.1 } };
// o: {heightIn, weightLb, muscle, pads:'speed'|'sleek'|'trench', arms:{L:{item,wrist},R:{item,wrist}}, spats, res}
function makeBodyModel(o) {
  const PS = PADS[o.pads || 'speed'], bp = bodyParams(o), { H, g, m, fat } = bp, J = skeleton(bp), Rg = H * g, mf = 0.85 + 0.3 * m, Y = v => v * H, prims = [], add = p => { prims.push(p); return p; }, belt = Y(1.045);
  const cJ = SLOT(0), cT = SLOT(1), cP = SLOT(2), cS = SLOT(4), cSk = SLOT(5), cGl = SLOT(6), cCl = SLOT(7), cSo = SLOT(8), cSpat = SLOT(9), cBelt = SLOT(10), cAnk = SLOT(11), cRoll = SLOT(14), cPalm = SLOT(27), cCuff = SLOT(28), cAcc = SLOT(29);
  const torsoCol = (x, y, z) => { const b = sstep(belt - 0.004, belt + 0.004, y); let c = mixc(cP, cJ, b); const bb = sstep(belt - 0.024, belt - 0.019, y) * (1 - sstep(belt - 0.007, belt - 0.003, y)); return mixc(c, cBelt, bb); };
  // du: how much a region picks up dirt / grass when the player goes to the ground on his chest or back (dirt: legs, knees, cleats)
  add(E([0, Y(0.985), -0.01], [0.160 * Rg, 0.105 * H, 0.112 * Rg], { k: 0, bone: BI.root, col: torsoCol, wr: 1, dirt: 0.25, du: 0.35 }));
  for (const s of [1, -1]) add(E([s * 0.064 * H * g, Y(0.925), -0.062 * Rg], [0.084 * Rg, 0.088 * H, 0.078 * Rg * (0.9 + 0.25 * m)], { k: 0.04, bone: BI.root, col: () => cP, wr: 1, dirt: 0.3, du: 0.4 }));
  add(E([0, Y(1.13), 0.005 + fat * 0.035], [0.148 * Rg, 0.13 * H, (0.105 + fat * 0.06) * Rg], { k: 0.06, bone: BI.spine, col: torsoCol, num: 1, wr: 1.3, du: 0.75 }));
  add(E([0, Y(1.32), 0.008], [0.168 * Rg * (0.95 + 0.1 * m), 0.16 * H, 0.118 * Rg * (0.95 + 0.1 * m) + fat * 0.02], { k: 0.06, bone: BI.chest, col: () => cJ, num: 1, wr: 1, du: 0.8 }));
  add(E([0, Y(1.30), -0.02], [0.18 * Rg, 0.12 * H, 0.10 * Rg], { k: 0.05, bone: BI.chest, col: () => cJ, num: 1, wr: 1, du: 0.7 }));
  const PW = H * (0.88 + 0.12 * g), PD = H * (0.85 + 0.2 * g), sx = J.shL[0], holeR = 0.085 * H * (0.8 + 0.25 * g) * PS.hole;
  const padCol = (x, y, z) => { const rr = Math.sqrt(x * x + (z + 0.005) * (z + 0.005)), col = (1 - sstep(holeR + 0.014, holeR + 0.02, rr)) * sstep(Y(1.47), Y(1.49), y); return mixc(cJ, cT, col); };
  add(E([0, Y(PS.archY), 0], [PS.arch[0] * PW, PS.arch[1], PS.arch[2] * PD], { g: 1, k: 0, bone: BI.chest, col: padCol, num: 1, wr: 0.35, du: 0.45 }));
  for (const s of [1, -1]) { if (PS.box) { const b = PS.box; add(B([s * (sx + PS.capX), Y(PS.capY), 0], [b[0] * PW, b[1], b[2] * PD], b[3], { g: 1, k: 0.035, ang: -s * b[4], bone: BI.chest, col: padCol, wr: 0.35, du: 0.55 })); }
    else add(E([s * (sx + PS.capX), Y(PS.capY), 0], [PS.cap[0] * PW, PS.cap[1], PS.cap[2] * PD], { g: 1, k: 0.035, bone: BI.chest, col: padCol, wr: 0.35, du: 0.55 })); }
  add(E([0, Y(1.405), 0.052 * Rg + 0.01], [0.165 * PW, 0.115 * H, 0.06 * PS.plate], { g: 1, k: 0.04, bone: BI.chest, col: padCol, num: 1, wr: 0.3, du: 0.7 }));
  add(E([0, Y(1.41), -0.05 * Rg - 0.01], [0.17 * PW, 0.12 * H, 0.06 * PS.plate], { g: 1, k: 0.04, bone: BI.chest, col: padCol, num: 1, wr: 0.3, du: 0.6 }));
  if (PS.roll) add(T([0, Y(1.572), -0.006], holeR + 0.01, 0.02, { g: 4, k: 0, bone: BI.chest, col: () => cRoll }));
  const sleeves = {};
  for (const [s, L] of [[1, 'L'], [-1, 'R']]) { const sh = J['sh' + L], el = J['el' + L], t = PS.slT, b = [lp(sh[0], el[0], t), lp(sh[1], el[1], t), lp(sh[2], el[2], t)], ar = lp(0.056 * Rg * mf, 0.043 * Rg, t) + 0.011;
    sleeves[s] = { a: [sh[0] + s * 0.005, sh[1] + 0.005, sh[2]], b, r: PS.sl * PW };
    add(C(sleeves[s].a, b, PS.sl * PW, ar, { g: 3, k: 0.02, bone: BI['sh' + L], col: () => cJ, wr: 0.25, du: 0.5 })); }
  add(C([0, Y(1.47), -0.012], [0, Y(1.69), 0.005], 0.064 * Rg * (0.9 + 0.25 * m), 0.054 * Rg, { k: 0.03, bone: BI.neck, col: () => cSk, skin: 1 }));
  for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
    const sh = J['sh' + L], el = J['el' + L], wr = J['wr' + L], lq = (a, b, t) => [lp(a[0], b[0], t), lp(a[1], b[1], t), lp(a[2], b[2], t)];
    const AG = (o.arms && o.arms[L]) || { item: 'full', wrist: 'tape' };
    // colour regions, set per player: upper arm (under and below the jersey sleeve), elbow, forearm, wrist; tattoo ink patterns on the upper arm and forearm
    const sU = SLOT(s > 0 ? 15 : 19), sE = SLOT(s > 0 ? 16 : 20), sF = SLOT(s > 0 ? 17 : 21), sW = SLOT(s > 0 ? 18 : 22), sTU = SLOT(s > 0 ? 23 : 25), sTF = SLOT(s > 0 ? 24 : 26), cA = sE;
    const ink = (x, y, z, t, a0, a1) => { const band = sstep(a0, a0 + 0.05, t) * (1 - sstep(a1 - 0.05, a1, t)); if (band <= 0) return 0; return band * sstep(0.46, 0.52, fbm(x * 30 + s * 7, y * 26, z * 30)); };
    const armCol = (x, y, z, t) => { const c = mixc(sU, sE, sstep(0.82, 0.86, t)), p = ink(x, y, z, t, 0.3, 0.8); return p > 0 ? mixc(c, sTU, p) : c; };
    const faCol = (x, y, z, t) => { let c = mixc(sE, sF, sstep(0.26, 0.3, t)); const p = ink(x, y, z, t, 0.36, 0.76); if (p > 0) c = mixc(c, sTF, p); return mixc(c, sW, sstep(0.8, 0.815, t)); };
    const thick = AG.item === 'bare' ? 0 : 0.0025;
    const ua = add(C(sh, el, 0.056 * Rg * mf + thick * 0.4, 0.043 * Rg + thick, { k: 0.025, bone: BI['sh' + L], col: armCol, wr: AG.item === 'full' ? 0.5 : 0, du: 0.25 }));
    add(E([sh[0] + s * 0.015, sh[1] - 0.02, sh[2]], [0.06 * Rg * mf, 0.07 * Rg, 0.065 * Rg * mf], { k: 0.03, bone: BI['sh' + L], col: () => cJ }));
    const bc = lq(sh, el, 0.52); add(E([bc[0], bc[1], bc[2] + 0.022 * Rg], [0.038 * Rg * (0.7 + 0.6 * m), 0.075 * H, 0.036 * Rg * (0.7 + 0.6 * m)], { k: 0.03, bone: BI['sh' + L], col: (x, y, z) => { sdP(ua, x, y, z); return armCol(x, y, z, ua._t); } }));
    const tc = lq(sh, el, 0.42); add(E([tc[0] + s * 0.005, tc[1], tc[2] - 0.028 * Rg], [0.04 * Rg * (0.7 + 0.6 * m), 0.085 * H, 0.036 * Rg * (0.7 + 0.6 * m)], { k: 0.03, bone: BI['sh' + L], col: (x, y, z) => { sdP(ua, x, y, z); return armCol(x, y, z, ua._t); } }));
    const fa = add(C(el, wr, 0.045 * Rg * (0.9 + 0.2 * m) + thick, 0.03 * Rg + thick + (AG.wrist !== 'none' ? 0.002 : 0), { k: 0.025, bone: BI['el' + L], col: faCol, wr: AG.item === 'half' || AG.item === 'full' ? 0.4 : 0, du: 0.7 }));
    const fc = lq(el, wr, 0.22); add(E([fc[0] + s * 0.008, fc[1], fc[2] + 0.006], [0.046 * Rg * (0.75 + 0.45 * m), 0.075 * H, 0.042 * Rg * (0.75 + 0.45 * m)], { k: 0.03, bone: BI['el' + L], col: (x, y, z) => { sdP(fa, x, y, z); return faCol(x, y, z, fa._t); } }));
    if (AG.item === 'pad') add(E([el[0] + s * 0.006, el[1] + 0.005, el[2] - 0.03 * Rg], [0.045 * Rg, 0.06 * H, 0.035 * Rg], { k: 0.02, bone: BI['el' + L], col: () => cA }));
    // glove: cuff band at the wrist, darker grip palm on the inner (thigh-facing) side of the hanging hand
    const w = wr, hs = Math.pow(H, 0.6) * 1.12, GB = BI['wr' + L], gc = (x, y, z) => { let c = mixc(cGl, cPalm, 1 - sstep(-0.007, 0.004, (x - (w[0] - s * 0.008 * hs)) * s)); return mixc(c, cCuff, sstep(w[1] - 0.026, w[1] - 0.018, y)); };
    add(C([w[0], w[1] + 0.005, w[2]], [w[0], w[1] - 0.03, w[2] + 0.005], 0.031 * hs, 0.03 * hs, { k: 0.012, bone: GB, col: gc }));
    add(E([w[0], w[1] - 0.06 * hs, w[2] + 0.008], [0.022 * hs, 0.05 * hs, 0.045 * hs], { k: 0.015, bone: GB, col: gc }));
    const zs = [0.03, 0.011, -0.008, -0.026], ls = [0.92, 1.0, 0.96, 0.8], coarse = (o.res || 0.016) > 0.012;
    // at game resolution 1 cm fingers fall below the voxel size and mesh as spikes: use a rounded mitt (fingers together) instead
    if (coarse) { add(E([w[0] - s * 0.008 * hs, w[1] - 0.105 * hs, w[2] + 0.004], [0.026 * hs, 0.062 * hs, 0.05 * hs], { k: 0.02, bone: GB, col: gc }));
      add(E([w[0] - s * 0.02 * hs, w[1] - 0.05 * hs, w[2] + 0.042 * hs], [0.017 * hs, 0.034 * hs, 0.02 * hs], { k: 0.015, bone: GB, col: gc })); }
    for (let f = 0; f < (coarse ? 0 : 4); f++) { const ky = w[1] - 0.098 * hs, zz = w[2] + zs[f] * hs, l = ls[f] * hs, k1 = [w[0] + s * 0.002, ky, zz], k2 = [w[0] - s * 0.012 * l, ky - 0.042 * l, zz + 0.003], k3 = [w[0] - s * 0.032 * l, ky - 0.058 * l, zz + 0.004];
      add(C(k1, k2, 0.0108 * hs, 0.0098 * hs, { k: 0.008, bone: GB, col: gc })); add(C(k2, k3, 0.0098 * hs, 0.0086 * hs, { k: 0.006, bone: GB, col: gc })); }
    if (!coarse) add(C([w[0] - s * 0.012 * hs, w[1] - 0.035 * hs, w[2] + 0.038 * hs], [w[0] - s * 0.026 * hs, w[1] - 0.082 * hs, w[2] + 0.052 * hs], 0.0125 * hs, 0.0105 * hs, { k: 0.012, bone: GB, col: gc }));
  }
  for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
    const hp = J['hip' + L], kn = J['kn' + L], an = J['an' + L], lq = (a, b, t) => [lp(a[0], b[0], t), lp(a[1], b[1], t), lp(a[2], b[2], t)];
    const thCol = () => cP;
    add(C(hp, kn, 0.088 * Rg * mf, 0.056 * Rg, { k: 0.05, bone: BI['hip' + L], col: thCol, wr: 1.2, dirt: 0.5 }));
    const q = lq(hp, kn, 0.45); add(E([q[0] + s * 0.008, q[1], q[2] + 0.028 * Rg], [0.066 * Rg * (0.75 + 0.45 * m), 0.15 * H, 0.06 * Rg * (0.75 + 0.45 * m)], { k: 0.04, bone: BI['hip' + L], col: thCol, wr: 1, dirt: 0.6 }));
    const hm = lq(hp, kn, 0.4); add(E([hm[0], hm[1], hm[2] - 0.03 * Rg], [0.065 * Rg * (0.75 + 0.35 * m), 0.15 * H, 0.055 * Rg * (0.75 + 0.35 * m)], { k: 0.04, bone: BI['hip' + L], col: thCol, wr: 1 }));
    const tp = lq(hp, kn, 0.42); add(E([tp[0] + s * 0.003, tp[1], tp[2] + 0.072 * Rg * mf], [0.058 * Rg, 0.085 * H, 0.022], { k: 0.03, bone: BI['hip' + L], col: thCol, wr: 0.4, dirt: 0.7 }));
    add(E([kn[0], kn[1] + 0.015, kn[2] + 0.042 * Rg], [0.05 * Rg, 0.058 * H, 0.026 * Rg], { k: 0.025, bone: BI['kn' + L], col: () => cP, wr: 0.6, dirt: 1 }));
    const shCol = (x, y, z, t) => mixc(mixc(cP, cS, sstep(0.085, 0.095, t)), cAnk, sstep(0.7, 0.73, t));
    const sh = add(C(kn, [an[0], an[1] + 0.02, an[2]], 0.054 * Rg, 0.034 * Rg, { k: 0.03, bone: BI['kn' + L], col: shCol, wr: 0.5, dirt: 0.3 }));
    const cf = lq(kn, an, 0.27); add(E([cf[0] + s * 0.004, cf[1], cf[2] - 0.032 * Rg], [0.05 * Rg * (0.7 + 0.5 * m), 0.10 * H, 0.048 * Rg * (0.7 + 0.5 * m)], { k: 0.03, bone: BI['kn' + L], col: (x, y, z) => { sdP(sh, x, y, z); return shCol(x, y, z, sh._t); }, wr: 0.4 }));
    // cleat: sole, upper with a contrast heel counter and toe cap, then the collar / spat
    const ax = an[0], az = an[2], AB = BI['an' + L], clCol = (x, y, z) => { const acc = Math.max(1 - sstep(az - 0.06, az - 0.035, z), sstep(az + 0.14, az + 0.165, z)) * (1 - sstep(0.048, 0.056, y)); return mixc(mixc(cSo, mixc(cCl, cAcc, acc), sstep(0.019, 0.023, y)), cSpat, sstep(0.055, 0.065, y)); };
    add(C([ax, 0.052, az - 0.05], [ax + s * 0.012, 0.042, az + 0.168], 0.046, 0.037, { g: 2, k: 0, bone: AB, col: clCol, dirt: 0.4 }));
    add(C([ax, 0.05, az - 0.012], [ax, Y(0.16), az - 0.014], 0.05, 0.042, { g: 2, k: 0.03, bone: AB, col: clCol }));
    add(B([ax + s * 0.006, 0.012, az + 0.06], [0.05, 0.012, 0.142], 0.01, { g: 2, k: 0.01, bone: AB, col: clCol }));
  }
  const n = prims.length, D = new Float64Array(n);
  for (const P of prims) { if (P.t === 0) { P.bx0 = P.cx; P.by0 = P.cy; P.bz0 = P.cz; P.br = Math.max(P.rx, P.ry, P.rz); } else if (P.t === 1) { P.bx0 = (P.ax + P.bx) / 2; P.by0 = (P.ay + P.by) / 2; P.bz0 = (P.az + P.bz) / 2; P.br = Math.sqrt(P.l2) / 2 + Math.max(P.r1, P.r2); }
    else if (P.t === 3) { P.bx0 = P.cx; P.by0 = P.cy; P.bz0 = P.cz; P.br = P.rx + P.ry; } else { P.bx0 = P.cx; P.by0 = P.cy; P.bz0 = P.cz; P.br = Math.sqrt(P.hx * P.hx + P.hy * P.hy + P.hz * P.hz); } }
  const nhR = holeR, nhY = Y(1.44), wrAmp = 0.0024;
  // spatial index: per 5 cm cell, only the primitives that can shape the surface inside it (exact at the cell centre, Lipschitz bound + blend margin)
  const CQ = 0.05, cells = new Map(), ubuf = new Float64Array(n);
  function cellList(x, y, z) {
    const i = Math.floor(x / CQ), j = Math.floor(y / CQ), k = Math.floor(z / CQ), key = ((i + 256) * 1024 + (j + 256)) * 1024 + (k + 256);
    let Lc = cells.get(key); if (Lc) return Lc;
    const cx = (i + 0.5) * CQ, cy = (j + 0.5) * CQ, cz = (k + 0.5) * CQ, rc = CQ * 0.8660254; let mn = 1e9;
    for (let p = 0; p < n; p++) { const v = sdP(prims[p], cx, cy, cz); ubuf[p] = v; if (v < mn) mn = v; }
    const lim = mn + 2 * rc + 0.12, out = []; for (let p = 0; p < n; p++) if (ubuf[p] < lim) out.push(p);
    Lc = Int16Array.from(out); cells.set(key, Lc); return Lc;
  }
  // mask (optional): bit set of bones whose primitives count (the AO bake looks at one limb chain at a time, so a hanging arm does not shadow the torso)
  function sdf(x, y, z, store, mask) {
    let d0 = 1e9, d1 = 1e9, d2 = 1e9, d3 = 1e9, d4 = 1e9, best = 0, bd = 1e9; const list = cellList(x, y, z), nl = list.length;
    if (store) D.fill(1e9);
    for (let li = 0; li < nl; li++) { const i = list[li], P = prims[i]; if (mask && !((mask >> P.bone) & 1)) continue; let d; const ex = x - P.bx0, ey = y - P.by0, ez = z - P.bz0, lb = Math.sqrt(ex * ex + ey * ey + ez * ez) - P.br, cur = P.g === 0 ? d0 : P.g === 1 ? d1 : P.g === 2 ? d2 : P.g === 3 ? d3 : d4;
      if (!store && lb > cur + 0.07 && lb > 0.02) d = lb; else d = sdP(P, x, y, z); if (store) D[i] = d; if (d < bd) { bd = d; best = i; }
      if (P.g === 0) d0 = d0 > 1e8 ? d : smin(d0, d, P.k); else if (P.g === 1) d1 = d1 > 1e8 ? d : smin(d1, d, P.k); else if (P.g === 2) d2 = d2 > 1e8 ? d : smin(d2, d, P.k); else if (P.g === 3) d3 = Math.min(d3, d); else d4 = Math.min(d4, d); }
    const cd = Math.max(Math.sqrt(x * x + (z + 0.005) * (z + 0.005)) - nhR, nhY - y); d1 = smax(d1, -cd, 0.012); d2 = smax(d2, -y, 0.002);
    let d = smin(d0, d1, 0.045); d = smin(d, d3, 0.008); d = Math.min(d, d4); d = smin(d, d2, 0.02);
    if (bd > 1e8) return 1;
    const w = prims[best].wr; if (w && bd < 0.03) { const nn = fbm(x * 14, y * 9, z * 14); d += wrAmp * w * (Math.sin(y * 95 + nn * 9 + x * 20) * 0.6 + nn * 0.8 - 0.4); }
    return d;
  }
  // design coordinates: pants stripe = arc distance (m) from the outer-leg line, from the belt to the knee (the leg axis carried up to the waist);
  // sleeve = distance (m) above the jersey sleeve hem along the upper arm (bands, hem stitching, TV numbers)
  const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, legA = {}, slA = {};
  for (const [s, L] of [[1, 'L'], [-1, 'R']]) { const hp = J['hip' + L], kn = J['kn' + L], ax = nrm3([kn[0] - hp[0], kn[1] - hp[1], kn[2] - hp[2]]), dt = s * ax[0], o = nrm3([s - ax[0] * dt, -ax[1] * dt, -ax[2] * dt]); legA[s] = { hp, ax, o };
    const S = sleeves[s], sa = nrm3([S.b[0] - S.a[0], S.b[1] - S.a[1], S.b[2] - S.a[2]]); slA[s] = { b: S.b, ax: sa, r: S.r }; }
  const kneeY = J.knL[1];
  function pantsCoord(x, y, z) {
    if (y > belt + 0.03 || y < kneeY - 0.14) return 1;
    const s = x >= 0 ? 1 : -1, A = legA[s], px = x - A.hp[0], py = y - A.hp[1], pz = z - A.hp[2], t = px * A.ax[0] + py * A.ax[1] + pz * A.ax[2];
    const rx = px - A.ax[0] * t, ry = py - A.ax[1] * t, rz = pz - A.ax[2] * t, rl = Math.hypot(rx, ry, rz) || 1e-6;
    return Math.acos(cl((rx * A.o[0] + ry * A.o[1] + rz * A.o[2]) / rl, -1, 1)) * rl;
  }
  function sleeveCoord(x, y, z) {
    const s = x >= 0 ? 1 : -1, A = slA[s], px = x - A.b[0], py = y - A.b[1], pz = z - A.b[2], t = px * A.ax[0] + py * A.ax[1] + pz * A.ax[2];
    const rx = px - A.ax[0] * t, ry = py - A.ax[1] * t, rz = pz - A.ax[2] * t; if (Math.hypot(rx, ry, rz) > A.r + 0.025) return 1;   // 'not on the sleeve' must sit above the band range, so blends never cross it
    return -t;
  }
  // AO bake: a few SDF probes along the normal, against the vertex's own limb chain plus the torso piece it hangs from
  const MASK = { torso: 0b1111, L: (1 << 2) | (1 << 5) | (1 << 6) | (1 << 7), R: (1 << 2) | (1 << 8) | (1 << 9) | (1 << 10), LL: 1 | (1 << 11) | (1 << 12) | (1 << 13), RL: 1 | (1 << 14) | (1 << 15) | (1 << 16) };
  const boneMask = b => b <= 4 ? MASK.torso : b <= 7 ? MASK.L : b <= 10 ? MASK.R : b <= 13 ? MASK.LL : MASK.RL;
  const AOD = [0.01, 0.024, 0.045, 0.075], AOW = [1, 0.8, 0.55, 0.4];
  function aoAt(x, y, z, nx, ny, nz, mask) { let occ = 0; for (let k = 0; k < AOD.length; k++) { const d = AOD[k], v = sdf(x + nx * d, y + ny * d, z + nz * d, false, mask); occ += AOW[k] * Math.max(0, d - Math.max(0, v)) / d; } return cl(1 - occ * 0.42, 0.22, 1); }
  const bounds = [-(J.wrL[0] + 0.12), -0.01, -0.3 * Rg - 0.03, (J.wrL[0] + 0.12), Y(1.78), 0.32 * Rg + 0.07];
  const model = { prims, J, bp, bounds, h: o.res || 0.016, sdf: (x, y, z) => sdf(x, y, z, false), eps: 0.0025 };
  model.attribs = function (out) {
    const nv = out.count, P = out.position, N = out.normal, W = new Float32Array(nv * NS), uv = new Float32Array(nv * 2), nm = new Float32Array(nv), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), bw = new Float64Array(BONES.length), Yc = Y(1.30), acc = new Float32Array(NS);
    const dz = new Float32Array(nv * 4), ao = new Float32Array(nv);
    for (let q = 0; q < nv; q++) {
      const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2]; sdf(x, y, z, true); let dmin = 1e9; for (let i = 0; i < n; i++) if (D[i] < dmin) dmin = D[i];
      acc.fill(0); let wsum = 0, num = 0, dirt = 0, du = 0; bw.fill(0);
      for (let i = 0; i < n; i++) { const dd = D[i] - dmin; if (dd > 0.05) continue; const P2 = prims[i], wc = Math.exp(-dd / 0.0018);
        if (wc > 0.002) { sdP(P2, x, y, z); const c = P2.col(x, y, z, P2._t); for (let s = 0; s < NS; s++) acc[s] += c[s] * wc; wsum += wc; if (P2.num) num += wc; dirt += (P2.dirt || 0) * wc; du += (P2.du || 0) * wc; }
        bw[P2.bone] += Math.exp(-dd / 0.016); }
      const c = new Float32Array(NS); for (let s = 0; s < NS; s++) c[s] = acc[s] / wsum; num /= wsum; dirt /= wsum; du /= wsum;
      W.set(c, q * NS); nm[q] = num * sstep(0.15, 0.4, Math.abs(N[q * 3 + 2]));
      if (z >= 0) uv[q * 2] = 0.25 + x / 0.84; else uv[q * 2] = 0.75 - x / 0.84; uv[q * 2 + 1] = 0.5 + (y - Yc) / 0.42;
      const order = [0, 0, 0, 0], ov = [-1, -1, -1, -1]; for (let bi = 0; bi < bw.length; bi++) { const vv = bw[bi]; if (vv > ov[3]) { let k = 3; while (k > 0 && vv > ov[k - 1]) { ov[k] = ov[k - 1]; order[k] = order[k - 1]; k--; } ov[k] = vv; order[k] = bi; } }
      let ws = 0; for (let k = 0; k < 4; k++) ws += Math.max(ov[k], 0); for (let k = 0; k < 4; k++) { si[q * 4 + k] = order[k]; sw[q * 4 + k] = Math.max(ov[k], 0) / ws; }
      // dirt-prone fields: legs mostly on the front (knees, shins, thighs), the torso front and back, elbows; varied by a little noise so stains are patchy
      const nz = N[q * 3 + 2], fz = 0.4 + 0.6 * Math.max(0, nz), low = 1 - sstep(Y(0.55), Y(0.95), y) * 0.5, nn = 0.75 + 0.5 * fbm(x * 9 + 3, y * 7, z * 9);
      const b0 = order[0], onSleeve = b0 === BI.shL || b0 === BI.shR || b0 === BI.elL || b0 === BI.elR;
      dz[q * 4] = c[2] + c[3] > 0.05 ? pantsCoord(x, y, z) : 1; dz[q * 4 + 1] = onSleeve && Math.abs(x) > sx * 0.55 ? sleeveCoord(x, y, z) : 1;
      dz[q * 4 + 2] = cl(dirt * fz * low * nn, 0, 1); dz[q * 4 + 3] = cl(du * (0.55 + 0.45 * Math.abs(nz)) * nn, 0, 1);
      ao[q] = aoAt(x, y, z, N[q * 3], N[q * 3 + 1], nz, boneMask(b0));
    }
    out.W = W; out.uv = uv; out.nm = nm; out.skinIndex = si; out.skinWeight = sw; out.dz = dz; out.ao = ao;
  };
  return model;
}
// rest-space landmarks the player shader needs for kit designs and seams (cheap: no meshing, so it works for meshes loaded from the cache)
function bodyDesign(o) {
  const PS = PADS[o.pads || 'speed'], bp = bodyParams(o), { H, g, m } = bp, J = skeleton(bp), Rg = H * g, Y = v => v * H, PW = H * (0.88 + 0.12 * g);
  const sh = J.shL, el = J.elL, t = PS.slT, b = [lp(sh[0], el[0], t), lp(sh[1], el[1], t), lp(sh[2], el[2], t)], a = [sh[0] + 0.005, sh[1] + 0.005, sh[2]], al = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), ax = [(b[0] - a[0]) / al, (b[1] - a[1]) / al, (b[2] - a[2]) / al];
  const kn = J.knL, an = J.anL, shin = (tt => lp(kn[1], an[1] + 0.02, tt));
  return { belt: Y(1.045), hem: shin(0.09), sockT: shin(0.09), ankT: shin(0.7), kneeY: kn[1], ankY: an[1], wrY: J.wrL[1], wrX: J.wrL[0],
    holeR: 0.085 * H * (0.8 + 0.25 * g) * PS.hole + 0.017, collarY: Y(1.48), loopX: sh[0] + PS.capX, loopY: Y(1.455), capTop: Y(PS.capY) + 0.04, yokeF: Y(1.405), yokeB: Y(1.43), chestW: 0.168 * Rg * (0.95 + 0.1 * m), armpit: Y(1.36),
    seamZ: -0.012, pseamZ: 0.006, collar: Y(0.16) + 0.02, anX: an[0], anZ: an[2], elX: el[0], elY: el[1], tv: [b[0] - ax[0] * 0.05, b[1] - ax[1] * 0.05, b[2] - ax[2] * 0.05], slR: PS.sl * PW, H };
}
// ---- head (face under the helmet). slots: 0 skin, 1 lip dark, 2 eye white, 3 iris ----
function makeHeadModel(o) {
  const s = o.headScale || 1, cSk = SLOT(0), cLipD = SLOT(1), cWhite = SLOT(2), cIris = SLOT(3), pr = [], a = p => pr.push(p);
  a(E([0, 0.005, -0.005], [0.078, 0.10, 0.098], { k: 0 })); a(E([0, -0.058, 0.03], [0.062, 0.052, 0.064], { k: 0.04 })); a(E([0, -0.098, 0.068], [0.024, 0.02, 0.018], { k: 0.025 }));
  for (const sx of [1, -1]) { a(E([sx * 0.042, -0.018, 0.062], [0.026, 0.02, 0.022], { k: 0.02 })); a(E([sx * 0.052, -0.062, 0.035], [0.022, 0.03, 0.03], { k: 0.03 })); }
  a(E([0, 0.028, 0.074], [0.056, 0.012, 0.017], { k: 0.03 })); a(C([0, 0.006, 0.088], [0, -0.032, 0.108], 0.009, 0.0125, { k: 0.012 }));
  for (const sx of [1, -1]) a(E([sx * 0.012, -0.036, 0.096], [0.01, 0.007, 0.008], { k: 0.01 }));
  a(E([0, -0.063, 0.093], [0.024, 0.008, 0.011], { k: 0.01 })); a(E([0, -0.075, 0.09], [0.021, 0.008, 0.011], { k: 0.01 }));
  const sockets = [[0.033, 0.008, 0.088], [-0.033, 0.008, 0.088]];
  function sdf(x, y, z) { x /= s; y /= s; z /= s; let d = 1e9; for (const P of pr) { const di = sdP(P, x, y, z); d = d > 1e8 ? di : smin(d, di, P.k); }
    for (const c of sockets) { const ds = Math.hypot(x - c[0], (y - c[1]) * 1.3, z - c[2]) - 0.017; d = smax(d, -ds, 0.012); }
    for (const c of sockets) { const de = Math.hypot(x - c[0], y - c[1], z - (c[2] - 0.004)) - 0.0118; d = Math.min(d, de); }        // eyeballs
    const mo = Math.hypot(x / 0.02, (y + 0.069) / 0.0016, (z - 0.1) / 0.02) - 1; d = smax(d, -mo * 0.0016, 0.002); return d * s; }
  return { bounds: [-0.11 * s, -0.14 * s, -0.12 * s, 0.11 * s, 0.12 * s, 0.14 * s], h: (o.res || 0.006) * s, sdf, eps: 0.0012,
    // slots: 0 skin 1 lip 2 eye white 3 iris 4 mustache 5 chin 6 jaw / cheeks 7 eye black 8 eye-black streak 9 nose strip 10 brows 11 socket shade
    // (beards, eye black and nose strips are colours on these regions, so every player shares one face mesh per build)
    attribs(out) { const nv = out.count, P = out.position, W = new Float32Array(nv * NSH), S = n => { const a = new Float32Array(NSH); a[n] = 1; return a; }, mx = (a, b, t) => { if (t <= 0) return a; const o2 = new Float32Array(NSH); for (let i = 0; i < NSH; i++) o2[i] = a[i] + (b[i] - a[i]) * t; return o2; };
      const SK = S(0), LP = S(1), WH = S(2), IR = S(3), MU = S(4), CH = S(5), JW = S(6), EB = S(7), EL = S(8), NSt = S(9), BR = S(10), SO = S(11);
      for (let q = 0; q < nv; q++) { const x = P[q * 3] / s, y = P[q * 3 + 1] / s, z = P[q * 3 + 2] / s, ax = Math.abs(x); let c = SK;
        let eye = null, dso = 1; for (const e of sockets) { const de = Math.hypot(x - e[0], y - e[1], z - (e[2] - 0.004)); if (de < 0.0125) eye = e; dso = Math.min(dso, Math.hypot(x - e[0], (y - e[1]) * 1.25, z - e[2])); }
        if (eye) { const front = z - (eye[2] - 0.004), ir = Math.hypot(x - eye[0], y - eye[1]); c = front > 0.0075 && ir < 0.0058 ? IR : WH; }
        else {
          c = mx(c, SO, (1 - sstep(0.017, 0.027, dso)) * 0.85);
          const yTop = lp(-0.06, -0.03, sstep(0.03, 0.072, ax)), jaw = (1 - sstep(yTop - 0.006, yTop + 0.004, y)) * sstep(-0.05, -0.022, z); c = mx(c, JW, jaw);
          const chin = (1 - sstep(0.024, 0.034, ax)) * (1 - sstep(-0.088, -0.082, y)) * sstep(0.015, 0.045, z); c = mx(c, CH, chin);
          const mu = (1 - sstep(0.025, 0.031, ax)) * sstep(-0.066, -0.061, y) * (1 - sstep(-0.05, -0.045, y)) * sstep(0.072, 0.082, z); c = mx(c, MU, mu);
          const lip = (1 - sstep(0.02, 0.026, ax)) * sstep(-0.084, -0.08, y) * (1 - sstep(-0.058, -0.054, y)) * sstep(0.085, 0.09, z); c = mx(c, LP, lip * 0.3);
          const br = sstep(0.012, 0.016, ax) * (1 - sstep(0.05, 0.056, ax)) * sstep(0.027, 0.031, y) * (1 - sstep(0.04, 0.044, y)) * sstep(0.07, 0.08, z); c = mx(c, BR, br * 0.9);
          const ns = (1 - sstep(0.022, 0.03, ax)) * sstep(-0.027, -0.021, y) * (1 - sstep(-0.009, -0.003, y)) * sstep(0.084, 0.094, z); c = mx(c, NSt, ns);
          const eb = sstep(0.016, 0.02, ax) * (1 - sstep(0.05, 0.056, ax)) * sstep(-0.037, -0.03, y) * (1 - sstep(-0.02, -0.013, y)) * sstep(0.05, 0.06, z); c = mx(c, EB, eb);
          const el = sstep(0.022, 0.027, ax) * (1 - sstep(0.044, 0.05, ax)) * sstep(-0.084, -0.074, y) * (1 - sstep(-0.036, -0.03, y)) * sstep(0.04, 0.055, z); c = mx(c, EL, el); }
        W.set(c, q * NSH); }
      out.W12 = W; } };
}
// ---- helmets. slots: 0 shell, 1 stripe, 2 stripe2, 3 rubber, 4 inner ----
const HELMS = { sleek: { dome: [[0, 0.022, -0.004], [0.131, 0.14, 0.156]], jaw: [[0, -0.062, 0.026], [0.12, 0.072, 0.11]], back: [[0, -0.04, -0.06], [0.12, 0.09, 0.106]], taper: 0.2, cutBack: -0.094 },
  speed: { dome: [[0, 0.025, -0.006], [0.128, 0.143, 0.158]], jaw: [[0, -0.064, 0.03], [0.118, 0.075, 0.114]], back: [[0, -0.035, -0.072], [0.116, 0.095, 0.104]], taper: 0.18, cutBack: -0.098 },
  classic: { dome: [[0, 0.022, -0.004], [0.125, 0.138, 0.152]], jaw: [[0, -0.058, 0.02], [0.116, 0.07, 0.104]], back: [[0, -0.03, -0.06], [0.112, 0.09, 0.1]], taper: 0.12, cutBack: -0.088 },
  pro: { dome: [[0, 0.026, -0.008], [0.129, 0.144, 0.16]], jaw: [[0, -0.064, 0.028], [0.12, 0.074, 0.112]], back: [[0, -0.038, -0.07], [0.118, 0.094, 0.106]], taper: 0.24, cutBack: -0.1 } };
function makeHelmetModel(o) {
  const kind = HELMS[o.kind] ? o.kind : 'sleek', K = HELMS[kind], HD = E(...K.dome), HJ = E(...K.jaw), HB = E(...K.back);
  const jaw = (x, y, z) => { const f = 1 - K.taper * sstep(-0.02, 0.12, z); return sdP(HJ, x / f, y, z) * Math.min(1, f + 0.1); };
  const base = (x, y, z) => { let d = smin(sdP(HD, x, y, z), jaw(x, y, z), 0.05); return smin(d, sdP(HB, x, y, z), 0.045); };
  const proj = p => { p = p.slice(); for (let i = 0; i < 8; i++) { const e = 0.0008, d = base(...p), g = [base(p[0] + e, p[1], p[2]) - base(p[0] - e, p[1], p[2]), base(p[0], p[1] + e, p[2]) - base(p[0], p[1] - e, p[2]), base(p[0], p[1], p[2] + e) - base(p[0], p[1], p[2] - e)], l = Math.hypot(...g) || 1; p = [p[0] - g[0] / l * d, p[1] - g[1] / l * d, p[2] - g[2] / l * d]; } return p; };
  const curve = (pts, r, sink) => { const P = pts.map(proj).map(p => { if (!sink) return p; const c0 = K.dome[0], v = [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]], l = Math.hypot(...v); return [p[0] - v[0] / l * sink, p[1] - v[1] / l * sink, p[2] - v[2] / l * sink]; }); const out = []; for (let i = 0; i < P.length - 1; i++) out.push(C(P[i], P[i + 1], r, r)); return out; };
  const arc = (f, n) => { const a = []; for (let i = 0; i <= n; i++) a.push(f(i / n)); return a; };
  const cutY = z => K.cutBack - 0.12 * Math.max(0, -z - 0.02) + (-0.112 - K.cutBack) * sstep(-0.04, 0.06, z);
  const bArc = (a0, a1, n) => arc(t => { const a = lp(a0, a1, t), z = -Math.cos(a) * 0.2; return [Math.sin(a) * 0.2, cutY(z * 0.75) - 0.004, z]; }, n);
  const ridges = [], grooves = [], bumpers = [], wide = [], brow = (r, sink) => ridges.push(...curve(arc(t => [lp(-0.08, 0.08, t), 0.05, 0.2], 8), r, sink));
  if (kind === 'sleek') { for (const xo of [0, 0.048, -0.048]) grooves.push(...curve(arc(t => { const a = lp(-0.25, 2.6, t); return [xo, 0.03 + Math.sin(a) * 0.2, Math.cos(a) * 0.2]; }, 14), 0.004, 0)); for (const s of [1, -1]) grooves.push(...curve(arc(t => { const a = lp(0.6, 2.7, t); return [s * 0.2, Math.sin(a) * 0.06 - 0.02, Math.cos(a) * 0.12]; }, 10), 0.0035, 0)); brow(0.0042, 0.0025); }
  else if (kind === 'speed') { brow(0.0052, 0.002); for (const s of [1, -1]) ridges.push(...curve([[s * 0.16, 0.02, 0.03], [s * 0.16, -0.03, 0.045], [s * 0.155, -0.08, 0.05], [s * 0.145, -0.112, 0.04]], 0.0038, 0.0018)); bumpers.push(...curve(bArc(-1.0, 1.0, 12), 0.0065, 0.003)); }
  else if (kind === 'classic') bumpers.push(...curve(bArc(-0.7, 0.7, 10), 0.0075, 0.003));
  else { wide.push(...curve(arc(t => { const a = lp(-0.15, 2.5, t); return [0, 0.03 + Math.sin(a) * 0.2, Math.cos(a) * 0.2]; }, 16), 0.024, 0.021)); brow(0.005, 0.002); for (const s of [1, -1]) for (const yo of [0.0, 0.022]) grooves.push(...curve([[s * 0.2, 0.07 + yo, -0.06], [s * 0.2, 0.05 + yo, -0.11]], 0.0038, 0)); bumpers.push(...curve(bArc(-0.9, 0.9, 12), 0.006, 0.003)); }
  // an 11 mm shell is thinner than a game-resolution voxel: the two skins cancel inside a cell and leave holes. At coarse res the
  // helmet is meshed solid (the face opening and the rim are still carved, and their walls get the dark liner colour), and the
  // fine grooves / brow ridge (under 6 mm, smaller than a voxel) are left out because they only mesh as dents
  const solid = (o.res || 0.006) > 0.0062;
  if (solid) { for (const Lst of [ridges, grooves]) { const keep = Lst.filter(P => Math.max(P.r1, P.r2) >= 0.006); Lst.length = 0; Lst.push(...keep); } }
  for (const Lst of [ridges, grooves, bumpers, wide]) { const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const P of Lst) { const r = Math.max(P.r1, P.r2); bb[0] = Math.min(bb[0], P.ax - r, P.bx - r); bb[1] = Math.min(bb[1], P.ay - r, P.by - r); bb[2] = Math.min(bb[2], P.az - r, P.bz - r); bb[3] = Math.max(bb[3], P.ax + r, P.bx + r); bb[4] = Math.max(bb[4], P.ay + r, P.by + r); bb[5] = Math.max(bb[5], P.az + r, P.bz + r); } Lst.bb = bb; }
  const minOf = (Lst, x, y, z) => { const b = Lst.bb, ox = Math.max(b[0] - x, 0, x - b[3]), oy = Math.max(b[1] - y, 0, y - b[4]), oz = Math.max(b[2] - z, 0, z - b[5]), bd = Math.sqrt(ox * ox + oy * oy + oz * oz); if (bd > 0.03) return bd;
    let d = 1e9; for (const P of Lst) d = Math.min(d, sdP(P, x, y, z)); return d; };
  function outer(x, y, z, dB) { let d = dB != null ? dB : base(x, y, z); if (wide.length) d = smin(d, minOf(wide, x, y, z), 0.012); if (ridges.length) d = smin(d, minOf(ridges, x, y, z), 0.005); if (bumpers.length) d = smin(d, minOf(bumpers, x, y, z), 0.004); if (grooves.length) d = smax(d, -minOf(grooves, x, y, z), 0.003); return d; }
  const FO = B([0, -0.05, 0.13], [0.082, 0.08, 0.1], 0.026), VENT = [C([0.038, 0.163, -0.03], [0.04, 0.158, 0.03], 0.0055, 0.0055), C([-0.038, 0.163, -0.03], [-0.04, 0.158, 0.03], 0.0055, 0.0055), C([0.05, 0.09, -0.14], [0.045, 0.04, -0.16], 0.006, 0.006), C([-0.05, 0.09, -0.14], [-0.045, 0.04, -0.16], 0.006, 0.006)], useVents = kind === 'speed' || kind === 'classic';
  function sdf(x, y, z) { const dB = base(x, y, z); if (dB > 0.045) return dB - 0.012; if (!solid && dB < -0.05) return -(dB + 0.011); const dO = outer(x, y, z, dB); let d = solid ? dO : Math.max(dO, -(dB + 0.011)); d = smax(d, -(y - cutY(z)), 0.009); d = smax(d, -sdP(FO, x, y, z), 0.008);
    const ear = Math.max(Math.sqrt((y + 0.022) * (y + 0.022) + (z + 0.004) * (z + 0.004)) - 0.016, 0.08 - Math.abs(x)); d = smax(d, -ear, 0.004); if (useVents) for (const V of VENT) d = smax(d, -sdP(V, x, y, z), 0.003); return d; }
  const stripe = o.stripe || 'single';
  return { bounds: [-0.16, -0.17, -0.2, 0.16, 0.2, 0.21], h: o.res || 0.006, sdf, eps: 0.0009,
    attribs(out) { const nv = out.count, P = out.position, Nn = out.normal, W = new Float32Array(nv * 8), uv = new Float32Array(nv * 2), nm = new Float32Array(nv);
      for (let q = 0; q < nv; q++) { const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2], dB = base(x, y, z), isOut = solid ? (dB > -0.012 ? 1 : 0) : (Math.abs(outer(x, y, z, dB)) <= Math.abs(dB + 0.011) ? 1 : 0); let c = [1, 0, 0, 0, 0];   // shell skin vs liner (carved walls)
        const ax = Math.abs(x), top = sstep(-0.06, -0.02, y + z * 0.2), sw = kind === 'pro' ? 1.6 : 1, m5 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), S1 = [0, 1, 0, 0, 0], S2 = [0, 0, 1, 0, 0], RB = [0, 0, 0, 1, 0];
        const bl = solid ? 0.002 : 0;     // at coarse res the stripe edge blends over about a voxel, so it reads straight instead of zig-zag
        if (stripe === 'single') { c = m5(c, S1, (1 - sstep((0.011 - bl) * sw, (0.0125 + bl) * sw, ax)) * top); c = m5(c, S2, sstep((0.0155 - bl) * sw, (0.017 + bl) * sw, ax) * (1 - sstep((0.0215 - bl) * sw, (0.023 + bl) * sw, ax)) * top); }
        else if (stripe === 'double') { c = m5(c, S1, sstep(0.006, 0.0075, ax) * (1 - sstep(0.0165, 0.018, ax)) * top); c = m5(c, S2, (1 - sstep(0.0045, 0.006, ax)) * top); }
        else if (stripe === 'wide') c = m5(c, S1, (1 - sstep(0.024, 0.026, ax)) * top);
        let rub = 0; if (bumpers.length) rub = 1 - sstep(0.002, 0.004, minOf(bumpers, x, y, z)); const fo = Math.abs(sdP(FO, x, y, z)); rub = Math.max(rub, (1 - sstep(0.0035, 0.006, fo)) * (y < 0.03 ? 1 : 0)); rub = Math.max(rub, 1 - sstep(0.003, 0.0055, Math.abs(y - cutY(z))));
        c = m5(c, RB, rub); if (!isOut) c = [0, 0, 0, 0, 1];
        W.set(c, q * 8); const sg = x >= 0 ? 1 : -1; uv[q * 2] = 0.5 - sg * (z + 0.03) / 0.13; uv[q * 2 + 1] = 0.5 + (y - 0.035) / 0.13; nm[q] = (o.logo === false ? 0 : 1) * isOut * (1 - rub) * sstep(0.45, 0.7, Math.abs(Nn[q * 3])); }
      out.W8 = W; out.uv = uv; out.nm = nm; } };
}
// facemask bar paths per style (rest coordinates relative to the helmet)
function maskBars(style) {
  const sym = pts => pts.concat(pts.slice(0, -1).reverse().map(p => [-p[0], p[1], p[2]]));
  const brow = sym([[0.098, 0.03, 0.086], [0.07, 0.035, 0.13], [0, 0.038, 0.149]]), eye = sym([[0.104, -0.022, 0.07], [0.085, -0.024, 0.135], [0.045, -0.026, 0.168], [0, -0.026, 0.176]]), eyeHi = sym([[0.104, -0.016, 0.07], [0.085, -0.018, 0.135], [0.045, -0.02, 0.166], [0, -0.02, 0.174]]),
    mouth = sym([[0.103, -0.06, 0.07], [0.08, -0.068, 0.146], [0.04, -0.075, 0.178], [0, -0.077, 0.184]]), chin = sym([[0.086, -0.11, 0.07], [0.06, -0.124, 0.13], [0.03, -0.132, 0.158], [0, -0.135, 0.165]]), nose = sym([[0.1, -0.042, 0.09], [0.075, -0.046, 0.152], [0.035, -0.05, 0.18], [0, -0.051, 0.185]]);
  const post = [[0, -0.026, 0.176], [0, -0.077, 0.184], [0, -0.106, 0.18], [0, -0.135, 0.165]], postLow = [[0, -0.077, 0.184], [0, -0.106, 0.18], [0, -0.135, 0.165]];
  const sides = s => [[[s * 0.083, -0.024, 0.142], [s * 0.077, -0.068, 0.152], [s * 0.058, -0.124, 0.132]], [[s * 0.092, 0.032, 0.106], [s * 0.096, -0.023, 0.118]]], S = [...sides(1), ...sides(-1)];
  const vert = (x, sx) => [[sx * x, -0.025, 0.168 + (0.04 - x) * 0.55], [sx * x, -0.05, 0.178 + (0.04 - x) * 0.6], [sx * x, -0.075, 0.178 + (0.04 - x) * 0.6], [sx * (x - 0.007), -0.13, 0.158 + (0.04 - x) * 0.75]];
  const v2 = x => [vert(x, 1), vert(x, -1)], postFull = [[0, 0.038, 0.149], [0, 0.008, 0.166], [0, -0.026, 0.176], [0, -0.077, 0.184], [0, -0.106, 0.18], [0, -0.135, 0.165]];
  const eyeLow = sym([[0.104, -0.03, 0.07], [0.085, -0.032, 0.134], [0.045, -0.034, 0.168], [0, -0.034, 0.176]]), topV = x => [[[x, 0.036, 0.143], [x + 0.002, -0.032, 0.171]], [[-x, 0.036, 0.143], [-x - 0.002, -0.032, 0.171]]];
  switch (style) {
    case '2bar': return { r: 0.0048, bars: [brow, eye, chin, ...S] };                                        // kickers: two thin bars
    case 'egop': return { r: 0.0055, bars: [brow, eye, mouth, chin, ...S] };                                 // open three-bar, no centre post
    case 'opo': return { r: 0.0055, bars: [brow, eye, mouth, chin, post, ...S] };
    case 'ropo': return { r: 0.0056, bars: [brow, eye, nose, mouth, chin, post, ...S] };                     // backs: three bars and a post
    case 'cage': return { r: 0.0062, bars: [brow, eye, nose, mouth, chin, post, ...S, ...v2(0.04)] };        // LB / TE cage
    case 'bigcage': return { r: 0.0068, bars: [brow, eye, nose, mouth, chin, postFull, ...S, ...v2(0.04), ...v2(0.07)] };   // linemen
    case 'robo': return { r: 0.0076, bars: [brow, eyeLow, mouth, chin, postFull, ...S, ...v2(0.036), ...v2(0.068), ...topV(0.034)] };   // heavy "robot" mask
    default: return { r: 0.0046, bars: [brow, eyeHi, chin, postLow, ...S] }; }                               // 'bullet': thin open skill mask
}
// ---- gear: small add-ons (hair out of the helmet, beards, mouthguards, towel, hand warmer, elbow pads, knee braces, neck roll) ----
// built from plain tubes and ellipsoids in the rest pose and skinned to the body's skeleton, so one cheap mesh per player follows the pose.
// gear slots: 0 hair 1 hair tips 2 towel 3 elbow pad 4 brace 5 hinge metal 6 mouthguard 7 hand warmer 8 neck roll 9 beard 10 strap 11 spare
const gearBodies = {}, gearParts = {};
function makeGear(A, hsc, spec) {
  const bp = bodyParams(A), J = skeleton(bp), { H, g } = bp, Rg = H * g, Y = v => v * H, belt = Y(1.045);
  const key = [A.heightIn, A.weightLb, A.muscle, A.pads].join('|'), BM = gearBodies[key] || (gearBodies[key] = makeBodyModel(Object.assign({}, A, { res: 0.02 })));
  // every part is built once per build (and head size) and cached; a player's gear mesh is just the parts he wears, concatenated
  let Pp, Nn, Ww, SI, SWt, IX, nv = 0; const list = [];
  const part = (name, fn) => { const k = key + '|' + hsc.toFixed(3) + '|' + name; let pc = gearParts[k]; if (!pc) { Pp = []; Nn = []; Ww = []; SI = []; SWt = []; IX = []; nv = 0; fn(); pc = gearParts[k] = { P: Pp, N: Nn, W: Ww, SI, SW: SWt, IX, nv }; } if (pc.nv) list.push(pc); };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, lq = (a, b, t) => [lp(a[0], b[0], t), lp(a[1], b[1], t), lp(a[2], b[2], t)];
  const vtx = (p, n, slot, bw) => { Pp.push(p[0], p[1], p[2]); Nn.push(n[0], n[1], n[2]); const w = new Array(NSG).fill(0); if (typeof slot === 'number') w[slot] = 1; else for (const [k, v] of slot) w[k] += v; for (const v of w) Ww.push(v);
    for (let k = 0; k < 4; k++) { SI.push(bw[k] ? bw[k][0] : 0); SWt.push(bw[k] ? bw[k][1] : 0); } return nv++; };
  // body surface along a ray from inside (steps back first if the start is outside)
  const surf = (p, d) => { let q = p.slice(), k = 0; while (BM.sdf(q[0], q[1], q[2]) > 0 && k++ < 80) q = sub(q, mul(d, 0.004)); for (k = 0; k < 120; k++) { const n2 = addv(q, mul(d, 0.003)); if (BM.sdf(n2[0], n2[1], n2[2]) > 0) return n2; q = n2; } return q; };
  const grad = q => { const e = 0.003, F = (x, y, z) => BM.sdf(x, y, z); return nrm([F(q[0] + e, q[1], q[2]) - F(q[0] - e, q[1], q[2]), F(q[0], q[1] + e, q[2]) - F(q[0], q[1] - e, q[2]), F(q[0], q[1], q[2] + e) - F(q[0], q[1], q[2] - e)]); };
  const clearOf = (q, m, dir) => { for (let k = 0; k < 40; k++) { const d = BM.sdf(q[0], q[1], q[2]); if (d >= m) break; q = addv(q, dir ? mul(dir, Math.max(0.002, m - d)) : mul(grad(q), m - d + 0.001)); } return q; };
  // tube along pts; rad(t) -> [radius along u, radius along v]; up(i) -> reference for u; caps close the ends
  function tube(pts, rad, up, seg, slotF, boneF, caps) {
    const n = pts.length, rings = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1), T = nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])); let u = up(i, t); u = sub(u, mul(T, dot(u, T))); if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = Math.abs(T[1]) < 0.9 ? sub([0, 1, 0], mul(T, T[1])) : sub([1, 0, 0], mul(T, T[0])); u = nrm(u);
      const v = cross(T, u), [ra, rb] = rad(t), ring = [];
      for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), p = [pts[i][0] + u[0] * ra * ca + v[0] * rb * sa, pts[i][1] + u[1] * ra * ca + v[1] * rb * sa, pts[i][2] + u[2] * ra * ca + v[2] * rb * sa];
        ring.push(vtx(p, nrm([u[0] * ca / ra + v[0] * sa / rb, u[1] * ca / ra + v[1] * sa / rb, u[2] * ca / ra + v[2] * sa / rb]), slotF(t), boneF(p, t))); }
      rings.push(ring); }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = rings[i][k], b = rings[i][(k + 1) % seg], c = rings[i + 1][(k + 1) % seg], d = rings[i + 1][k]; IX.push(a, b, c, a, c, d); }
    if (caps) for (const [i, sg] of [[0, -1], [n - 1, 1]]) { const t = i / (n - 1), T = mul(nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])), sg), c = vtx(pts[i], T, slotF(t), boneF(pts[i], t));
      const ring = rings[i].map(id => vtx([Pp[id * 3], Pp[id * 3 + 1], Pp[id * 3 + 2]], T, slotF(t), boneF([Pp[id * 3], Pp[id * 3 + 1], Pp[id * 3 + 2]], t)));
      for (let k = 0; k < seg; k++) { if (sg > 0) IX.push(c, ring[k], ring[(k + 1) % seg]); else IX.push(c, ring[(k + 1) % seg], ring[k]); } }
  }
  // ellipsoid with radii r along the right-handed axes ax = [ex, ey, ez]
  function ellip(c, r, ax, nLat, nLon, slot, boneF) {
    const [ex, ey, ez] = ax, rows = [];
    for (let i = 0; i <= nLat; i++) { const th = i / nLat * Math.PI, st = Math.sin(th), ct = Math.cos(th), row = [];
      for (let j = 0; j <= nLon; j++) { const ph = j / nLon * Math.PI * 2, d = [st * Math.cos(ph), ct, st * Math.sin(ph)];
        const p = [c[0] + ex[0] * r[0] * d[0] + ey[0] * r[1] * d[1] + ez[0] * r[2] * d[2], c[1] + ex[1] * r[0] * d[0] + ey[1] * r[1] * d[1] + ez[1] * r[2] * d[2], c[2] + ex[2] * r[0] * d[0] + ey[2] * r[1] * d[1] + ez[2] * r[2] * d[2]];
        const nn = nrm([ex[0] * d[0] / r[0] + ey[0] * d[1] / r[1] + ez[0] * d[2] / r[2], ex[1] * d[0] / r[0] + ey[1] * d[1] / r[1] + ez[1] * d[2] / r[2], ex[2] * d[0] / r[0] + ey[2] * d[1] / r[1] + ez[2] * d[2] / r[2]]);
        row.push(vtx(p, nn, slot, boneF(p))); } rows.push(row); }
    for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) { const a = rows[i][j], b = rows[i][j + 1], cc = rows[i + 1][j + 1], d = rows[i + 1][j]; IX.push(a, b, cc, a, cc, d); }
  }
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], HJ = J.head, hp = p => [HJ[0] + hsc * p[0], HJ[1] + hsc * p[1], HJ[2] + hsc * p[2]], onHead = () => [[BI.head, 1]];
  let sd = 1; const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // hair out of the back of the helmet (helmet space, mapped onto the head bone)
  const hx = spec.hair | 0, tipSlot = t => spec.tip && t > 0.55 ? [[0, 1 - sstep(0.55, 0.8, t)], [1, sstep(0.55, 0.8, t)]] : 0;
  // one strand / lock from under the back rim: spread = how far it fans out, back = how far it falls away from the neck, wob = sideways sway, ins = root inset (inner layer)
  const strand = (a, L, r0, r1, o) => { o = o || {}; const sa = Math.sin(a), ca = Math.cos(a), ins = o.ins || 1, rx = 0.088 * sa * ins, rz = -0.045 - 0.092 * ca * ins, side = 1 - 0.42 * Math.min(1, Math.abs(a) / 1.35); L *= side;
    const k = o.spread || 1.16, bk = o.back || 0.038, wb = o.wob || 0, y1 = -0.112 - 0.006 * (1 - Math.abs(sa)), tx = ca, tz = sa;   // sway is along the rim tangent
    const C0 = [[rx, -0.07, rz], [rx * 1.05, y1, rz - 0.01], [rx * lp(1.05, k, 0.45) + tx * wb * 0.35, y1 - L * 0.45, rz - bk * 0.62 + tz * wb * 0.35], [rx * lp(1.05, k, 0.75) + tx * wb * 0.7, y1 - L * 0.76, rz - bk * 0.86 + tz * wb * 0.7], [rx * k + tx * wb, y1 - L, rz - bk + tz * wb]].map(hp);
    const rad = (o.flat ? o.flat[0] : r0) * hsc, pts = [C0[0], C0[1]]; for (let i = 1; i < 4; i++) for (const t of [0.5, 1]) pts.push(clearOf(lq(C0[i], C0[i + 1], t), rad + 0.005, nrm([sa * 0.6, 0, -ca])));   // hang behind the pads, never through them
    const radial = nrm([sa, 0, -ca]);
    tube(pts, t => o.flat ? [o.flat[0] * hsc * (1 - 0.3 * t), o.flat[1] * hsc * (1 - 0.35 * t)] : [lp(r0, r1, t) * hsc, lp(r0, r1, t) * hsc], () => radial, o.flat ? 6 : 5, tipSlot, hairBones, true); };
  const J1 = () => rr() - 0.5, hairBones = (p, t) => { const wh = 1 - sstep(0.25, 0.95, t) * 0.75, wc = sstep(0.55, 1, t) * 0.4; return wh >= 1 ? [[BI.head, 1]] : [[BI.head, wh], [BI.neck, 1 - wh - wc], [BI.chest, wc]]; };   // lower hair rides on the pads, not the head
  if (hx) part('hair' + hx + (spec.tip ? 't' : ''), () => { sd = 9871 + hx * 7919;
  if (hx === 1) { for (let i = 0; i < 16; i++) { const r0 = 0.0085 + 0.002 * rr(); strand(lp(-1.32, 1.32, i / 15) + J1() * 0.09, 0.11 + 0.1 * rr(), r0, r0 * 0.78, { spread: 1.1 + 0.24 * rr(), back: 0.03 + 0.03 * rr(), wob: J1() * 0.026 }); }
    for (let i = 0; i < 8; i++) strand(lp(-1.0, 1.0, i / 7) + J1() * 0.1, 0.09 + 0.07 * rr(), 0.0085, 0.0068, { ins: 0.9, spread: 1.08 + 0.1 * rr(), back: 0.045 + 0.02 * rr(), wob: J1() * 0.02 }); }
  else if (hx === 2) for (let i = 0; i < 22; i++) strand(lp(-1.32, 1.32, i / 21) + J1() * 0.05, 0.07 + 0.08 * rr(), 0.0056, 0.0043, { spread: 1.08 + 0.1 * rr(), back: 0.03 + 0.02 * rr(), wob: J1() * 0.012 });
  else if (hx === 3) { ellip(hp([0, -0.122, -0.118]), [0.082 * hsc, 0.026 * hsc, 0.04 * hsc], I3, 5, 12, 0, onHead);
    for (let i = 0; i < 13; i++) strand(lp(-1.32, 1.32, i / 12) + J1() * 0.06, 0.06 + 0.06 * rr(), 0, 0, { flat: [0.0075, 0.024], spread: 1.14 + 0.2 * rr(), back: 0.045 + 0.025 * rr(), wob: J1() * 0.02 }); }
  else if (hx === 4) for (let i = 0; i < 22; i++) { const row = i < 14 ? 0 : 1, a = (row ? lp(-1.0, 1.0, (i - 14) / 7) : lp(-1.28, 1.28, i / 13)) + J1() * 0.07, rad = 0.014 + 0.008 * rr(), rf = row ? 1.12 : 1.0;
    ellip(clearOf(hp([0.09 * Math.sin(a) * rf, -0.114 - 0.012 * rr() - row * 0.016, -0.05 - 0.098 * Math.cos(a) * rf]), rad * hsc * 0.7), [rad * hsc, rad * hsc * 0.9, rad * hsc], I3, 5, 7, 0, onHead); }
  else if (hx === 5) { tube([[0, -0.085, -0.13], [0, -0.13, -0.165], [0, -0.19, -0.19], [0, -0.25, -0.2]].map(hp), t => [lp(0.024, 0.014, t) * hsc, lp(0.022, 0.013, t) * hsc], () => [1, 0, 0], 8, tipSlot, hairBones, true);
    for (let i = 0; i < 5; i++) strand(lp(-0.95, 0.95, i / 4), 0.08, 0.007, 0.0055, { spread: 1.12, back: 0.035 }); } });
  // beard volume below the face (full / long), mouthguard
  if (spec.beard) part('beard' + spec.beard, () => { ellip(hp([0, -0.1, 0.05]), [0.055 * hsc, 0.035 * hsc, 0.05 * hsc], I3, 6, 10, 9, onHead); if (spec.beard > 1) ellip(hp([0, -0.148, 0.058]), [0.04 * hsc, 0.054 * hsc, 0.04 * hsc], I3, 6, 10, 9, onHead); });
  if (spec.mg) part('mg' + spec.mg, () => { if (spec.mg === 1) { tube([[0.003, -0.074, 0.103], [0.006, -0.08, 0.112], [0.008, -0.086, 0.118]].map(hp), () => [0.0045 * hsc, 0.0045 * hsc], () => [0, 0, 1], 5, () => 6, onHead, true); ellip(hp([0.008, -0.097, 0.119]), [0.019 * hsc, 0.014 * hsc, 0.0055 * hsc], I3, 5, 8, 6, onHead); }
  else if (spec.mg === 2) ellip(hp([0, -0.07, 0.099]), [0.021 * hsc, 0.0065 * hsc, 0.01 * hsc], I3, 4, 8, 6, onHead); });
  // towel tucked into the front of the pants, draping over the thigh (lower half follows the leg)
  if (spec.tw) part('tw' + spec.tw, () => { const s = spec.tw === 1 ? 1 : -1, x0 = s * 0.078 * Rg, pts = [], hipB = BI[s > 0 ? 'hipL' : 'hipR'];
    for (let i = 0; i < 7; i++) { const t = i / 6, y = belt - 0.004 - t * 0.24, x = x0 + s * 0.014 * t, q = surf([x, y, 0], [0, 0, 1]); pts.push([x, y, q[2] + (i === 0 ? 0.001 : 0.006) + 0.003 * Math.sin(t * 3.1)]); }
    tube(pts, t => [0.052 * (1 - 0.08 * t), 0.0042], () => [1, 0, 0], 8, () => 2, p => { const w = sstep(belt - 0.03, belt - 0.17, p[1]) * 0.85; return [[BI.root, 1 - w], [hipB, w]]; }, true); });
  // hand warmer pouch around the front of the waist
  if (spec.hw) part('hw', () => { const pts = []; for (let i = 0; i < 9; i++) { const x = lp(-0.105, 0.105, i / 8) * Rg, d = nrm([x, 0, 0.1]), q = surf([x * 0.5, belt + 0.008, -0.01], d); pts.push(addv(q, mul(d, 0.012))); }
    tube(pts, () => [0.04, 0.019], () => [0, 1, 0], 8, () => 7, () => [[BI.root, 1]], true); });
  // elbow pads
  for (const [bit, L] of [[1, 'L'], [2, 'R']]) if ((spec.ep | 0) & bit) part('ep' + L, () => { const sh = J['sh' + L], el = J['el' + L], wr = J['wr' + L], ax = nrm(sub(wr, sh)), ex = nrm(cross(ax, [0, 0, 1])), ez = cross(ex, ax);
    ellip([el[0], el[1] - 0.004, el[2] - 0.014], [0.075 * Rg, 0.07, 0.074 * Rg], [ex, ax, ez], 8, 12, 3, p => { const w = sstep(-0.025, 0.025, dot(sub(p, el), ax)); return [[BI['sh' + L], 1 - w], [BI['el' + L], w]]; }); });
  // hinged knee braces (bars and hinges both sides, two straps)
  for (const [bit, L, s] of [[1, 'L', 1], [2, 'R', -1]]) if ((spec.kb | 0) & bit) part('kb' + L, () => {
    const hpJ = J['hip' + L], kn = J['kn' + L], an = J['an' + L], lh = Math.hypot(...sub(hpJ, kn)), la = Math.hypot(...sub(an, kn)), legPt = dy => dy >= 0 ? lq(kn, hpJ, dy / lh) : lq(kn, an, -dy / la);
    const bH = BI['hip' + L], bK = BI['kn' + L], wDy = dy => { const w = sstep(-0.015, 0.015, dy); return [[bK, 1 - w], [bH, w]]; };
    for (const side of [1, -1]) { const dir = [s * side, 0, 0], pts = [];
      for (let i = 0; i < 7; i++) { const dy = lp(0.15, -0.15, i / 6), a = legPt(dy), q = surf(a, dir); pts.push([q[0] + dir[0] * 0.006, a[1], q[2]]); }
      tube(pts, () => [0.0055, 0.012], () => dir, 6, () => 4, (p, t) => wDy(lp(0.15, -0.15, t)), true);
      const a0 = legPt(0), q0 = surf(a0, dir), hr = side > 0 ? 0.025 : 0.019; ellip([q0[0] + dir[0] * 0.011, a0[1], q0[2]], [0.008, hr, hr], [dir, [0, 1, 0], cross(dir, [0, 1, 0])], 4, 10, 5, () => [[bK, 0.5], [bH, 0.5]]); }
    for (const dy of [0.105, -0.105]) { const a = legPt(dy), pts = [], ups = [];
      for (let k = 0; k <= 8; k++) { const ang = k / 8 * Math.PI, d = [s * Math.cos(ang), 0, Math.sin(ang)], q = surf(a, d); pts.push(addv(q, mul(d, 0.004))); ups.push(d); }
      tube(pts, () => [0.0035, 0.016], i => ups[i], 6, () => 10, () => dy > 0 ? [[bH, 1]] : [[bK, 1]], true); } });
  // neck roll on top of the pads (the trench pads have one sculpted in)
  if (spec.nr) part('nr', () => { const PS = PADS[A.pads || 'speed'], R0 = 0.085 * H * (0.8 + 0.25 * g) * PS.hole + 0.02, pts = [];
    for (let k = 0; k <= 12; k++) { const a = lp(-2.05, 2.05, k / 12), x = R0 * Math.sin(a), z = -R0 * Math.cos(a) - 0.005, q = surf([x, Y(1.42), z], [0, 1, 0]); pts.push([x, q[1] + 0.011, z]); }
    tube(pts, t => { const e = 0.55 + 0.45 * Math.min(1, Math.min(t, 1 - t) * 6); return [0.02 * e, 0.023 * e]; }, () => [0, 1, 0], 8, () => 8, () => [[BI.chest, 1]], true); });
  let tv = 0, ti = 0; for (const pc of list) { tv += pc.nv; ti += pc.IX.length; } if (!tv) return null;
  const out = { position: new Float32Array(tv * 3), normal: new Float32Array(tv * 3), index: tv > 65535 ? new Uint32Array(ti) : new Uint16Array(ti), count: tv, W: new Float32Array(tv * NSG), skinIndex: new Uint16Array(tv * 4), skinWeight: new Float32Array(tv * 4) };
  let v0 = 0, i0 = 0; for (const pc of list) { out.position.set(pc.P, v0 * 3); out.normal.set(pc.N, v0 * 3); out.W.set(pc.W, v0 * NSG); out.skinIndex.set(pc.SI, v0 * 4); out.skinWeight.set(pc.SW, v0 * 4); for (let k = 0; k < pc.IX.length; k++) out.index[i0 + k] = pc.IX[k] + v0; v0 += pc.nv; i0 += pc.IX.length; }
  return out;
}
// ---- one player's 3D look from his lk + the team kit: palettes for body / face / gear, mask, visor, per-bone girth, gear spec ----
function hexMix(a, b, t) { const p = h => { const s = String(h || '#808080').replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) || 0); }, A = p(a), B2 = p(b); return '#' + A.map((v, i) => Math.round(v + (B2[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function hexLum(h) { const s = String(h || '#808080').replace('#', ''), v = [0, 2, 4].map(i => (parseInt(s.slice(i, i + 2), 16) || 0) / 255); return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]; }
const POS_MASK3 = { QB: 'opo', RB: 'ropo', FB: 'ropo', WR: 'bullet', TE: 'cage', OT: 'bigcage', OG: 'bigcage', C: 'bigcage', DE: 'cage', DT: 'bigcage', LB: 'cage', CB: 'bullet', S: 'egop', K: '2bar', P: '2bar' };
function lookOf(rp) { return (typeof ensureLook === 'function' && rp ? ensureLook(rp) : rp && rp.lk) || {}; }
function maskStyle(rp) { const lk = lookOf(rp), M2 = typeof LK_MASKS !== 'undefined' ? LK_MASKS : null; return (M2 && lk.fm != null && M2[lk.fm]) || POS_MASK3[rp && rp.pos] || 'opo'; }
// fabric whites are never paper white (they read as plastic): pull very light colours toward a warm, slightly grey off-white
function fabric(h) { const l = hexLum(h); return l > 0.8 ? hexMix(h, '#d9d4c9', cl((l - 0.8) / 0.2, 0, 1) * 0.55) : h; }
// kit design options (the league defines the lists and per-team defaults; these fallbacks keep old saves and bare kits working)
const KSTY0 = { jstyle: ['stripes', 'triple', 'loops', 'yoke', 'panel', 'plain'], pstyle: ['solid', 'double', 'tri', 'outline', 'thin', 'none'], hstyle: ['single', 'double', 'tri', 'wide', 'none'],
  hfinish: ['gloss', 'matte', 'metal', 'satin'], sstyle: ['solid', 'stripes', 'hoops', 'twotone'], nfont: ['block', 'pro', 'italic', 'slab'], nstyle: ['outline', 'double', 'plain', 'shadow'], tvnum: ['none', 'sleeve'] };
const KSTY_DEF = { jstyle: 'stripes', pstyle: 'solid', hstyle: 'single', hfinish: 'gloss', sstyle: 'solid', nfont: 'block', nstyle: 'outline', tvnum: 'none' };
function kitStyle(k) {
  k = k || {}; const L = (typeof KIT_STYLES !== 'undefined' && KIT_STYLES) || KSTY0, o = {};
  for (const f in KSTY_DEF) o[f] = L[f] && L[f].includes(k[f]) ? k[f] : KSTY_DEF[f];
  o.nbar = k.nbar ? 1 : 0; o.trim2 = k.trim2 || k.numOutline || '#151517'; return o;
}
function look3(rp, kit, arch) {
  const lk = lookOf(rp); kit = kit || {}; const KS = kitStyle(kit);
  const SKN = (typeof SKIN !== 'undefined' && SKIN) || ['#bd8152'], HC = (typeof HAIRC !== 'undefined' && HAIRC) || ['#16110e'], EC = (typeof EYEC !== 'undefined' && EYEC) || ['#3b2416'];
  const skin = SKN[lk.sk] || (rp && rp.id != null ? SKN[rp.id % SKN.length] : SKN[4]) || '#bd8152', hair = HC[lk.hc] || HC[0], big = arch === 'BIG';
  const J0 = fabric(kit.jersey || '#7a7a7a'), T0 = fabric(kit.trim || '#ffffff'), WH = '#e2ded5', BK = '#18181b', TAPE = '#e6e1d4';
  // per-slot surface: [roughness, jersey knit, pants twill, rib knit, skin]; the shader blends them with the slot weights
  const SK = [0.5, 0, 0, 0, 1], KN = [0.84, 1, 0, 0, 0], TW = [0.62, 0, 1, 0, 0], RB = [0.8, 0, 0, 1, 0], CMP = [0.5, 0, 0, 0.55, 0], TP = [0.86, 0, 0.35, 0, 0];
  // arms: item 0 bare / 1 full / 2 elbow / 3 half; wrist 0 bare / 1 tape / 2 band; tattoo ink only shows on bare skin
  const sleeve = [BK, WH, J0, T0][lk.ac | 0] || BK, band = [WH, BK, J0, T0][lk.wc | 0] || WH, ink = hexMix(skin, '#1a222e', hexLum(skin) > 0.45 ? 0.55 : 0.38);
  const arm = (item, wrist, tat) => { const up = item === 1 ? sleeve : skin, elb = item ? sleeve : skin, fo = item === 1 || item === 3 ? sleeve : skin, wr = wrist === 1 ? TAPE : wrist === 2 ? band : item === 1 ? sleeve : skin;
    const mt = [item === 1 ? CMP : SK, item ? CMP : SK, item === 1 || item === 3 ? CMP : SK, wrist === 1 ? TP : wrist === 2 ? RB : item === 1 ? CMP : SK];
    return { c: [up, elb, fo, wr, tat && up === skin ? ink : up, tat && fo === skin ? ink : fo], m: [...mt, mt[0], mt[2]] }; };
  const AL = arm(lk.aL | 0, lk.wL | 0, lk.tat && (lk.ta & 1)), AR = arm(lk.aR | 0, lk.wR | 0, lk.tat && (lk.ta & 2));
  const bare = (lk.gl | 0) === 5, glove = fabric([kit.glove || BK, BK, '#eceae4', J0, T0, skin][lk.gl | 0] || kit.glove || BK);
  const palm = bare ? skin : hexLum(glove) > 0.62 ? hexMix(glove, '#8d8b84', 0.45) : hexMix(glove, '#0c0c0e', 0.4);
  const cuff = bare ? skin : [T0, J0, KS.trim2, BK, WH].find(c => Math.abs(hexLum(c) - hexLum(glove)) > 0.22) || BK;
  let cleat = fabric([kit.cleat || BK, BK, '#efede7', J0, T0][lk.clc | 0] || BK), spat = cleat, ankle = fabric(kit.socks || J0); const sole = hexLum(cleat) > 0.7 ? '#cfccc4' : '#2a2b30', sp = lk.sp | 0;
  let acc = hexLum(cleat) > 0.6 ? (hexLum(J0) < 0.6 ? J0 : BK) : (hexLum(T0) > 0.45 && T0 !== cleat ? T0 : WH);
  if (sp === 1 || sp === 2 || sp === 4) { cleat = spat = ankle = acc = sp === 1 ? '#e8e5dd' : sp === 2 ? BK : J0; } else if (sp === 3) spat = ankle = TAPE;
  const roll = ['#2a2b30', J0, '#eceae4', T0][lk.nrc | 0] || '#2a2b30';
  const collar = KS.jstyle === 'plain' ? hexMix(J0, hexLum(J0) > 0.5 ? '#000000' : '#ffffff', 0.12) : T0, pants = fabric(kit.pants || '#e8e8e8');
  const belt = hexLum(pants) < 0.12 ? '#3a3b40' : '#1d1d20', body = [J0, collar, pants, pants, fabric(kit.socks || J0), skin, glove, cleat, sole, spat, belt, ankle, pants, pants, roll, AL.c[0], AL.c[1], AL.c[2], AL.c[3], AR.c[0], AR.c[1], AR.c[2], AR.c[3], AL.c[4], AL.c[5], AR.c[4], AR.c[5], palm, cuff, acc, J0, J0];
  const spatM = sp === 1 || sp === 2 || sp === 4 ? [0.5, 0, 0.3, 0, 0] : sp === 3 ? TP : [0.5, 0, 0.22, 0, 0], ankM = sp === 1 || sp === 2 || sp === 4 ? spatM : sp === 3 ? TP : RB;
  const bodyMat = [KN, RB, TW, TW, RB, SK, bare ? SK : [0.55, 0, 0.3, 0, 0], [0.5, 0, 0.22, 0, 0], [0.7, 0, 0, 0, 0], spatM, [0.45, 0, 0, 0, 0], ankM, TW, TW, RB, ...AL.m.slice(0, 4), ...AR.m.slice(0, 4), AL.m[4], AL.m[5], AR.m[4], AR.m[5], bare ? SK : [0.45, 0, 0.45, 0, 0], bare ? SK : [0.75, 0, 0, 0.6, 0], [0.45, 0, 0, 0, 0], KN, KN];
  // face: [mustache, chin, jaw] per beard style, eye black, nose strip, brows
  const st = k => hexMix(skin, hair, k), bd = lk.bd | 0;
  const BEARD = { 1: [st(.35), st(.35), st(.35)], 2: [hair, hair, skin], 3: [hair, hair, hair], 4: [hair, skin, skin], 5: [hair, skin, hair], 6: [skin, st(.75), st(.75)], 7: [skin, st(.6), skin], 8: [hair, hair, hair], 9: [st(.55), st(.55), st(.55)], 10: [hair, st(.3), skin] }[bd] || [skin, skin, skin];
  const ebOn = lk.ey && lk.eb, eb = ebOn ? '#121214' : skin, ebl = ebOn && lk.eb === 3 ? '#121214' : skin;
  const head = [skin, hexMix(skin, '#4a1f1a', 0.42), hexMix('#bcb0a2', skin, 0.45), EC[lk.ec] || '#2a1a10', BEARD[0], BEARD[1], BEARD[2], eb, ebl, lk.ns ? '#e4dfd3' : skin, hexMix(hair, '#120c08', 0.3), hexMix(skin, '#000000', 0.2)];
  // gear
  const tip = lk.ht === 1 ? '#e3cf98' : lk.ht === 2 ? '#b5532a' : hair; let towel = ['#e9e6de', J0, T0, BK][lk.twc | 0] || '#e9e6de';
  if (Math.abs(hexLum(towel) - hexLum(pants)) < 0.18) towel = hexLum(pants) > 0.5 ? (hexLum(J0) < 0.55 ? J0 : hexLum(T0) < 0.55 ? T0 : BK) : '#e9e6de';   // a towel has to read against the pants
  const epad = [BK, '#e9e7e1', J0, T0][lk.ac | 0] || BK;
  const mgc = ['#dce6e8', BK, J0, T0][lk.mgc | 0] || '#dce6e8', warmer = hexLum(J0) > 0.8 ? T0 : J0;
  const gearPal = [hair, tip, towel, epad, '#1c1d21', '#aab0b8', mgc, warmer, roll, hexMix(hair, '#000000', 0.12), '#141416', J0];
  const spec = { hair: lk.hx | 0, tip: lk.ht ? 1 : 0, beard: bd === 8 ? 2 : bd === 3 ? 1 : 0, mg: lk.mg | 0, tw: lk.tw | 0, hw: lk.hw | 0, ep: lk.ep | 0, kb: lk.kb | 0, nr: !big && lk.nr ? 1 : 0 };
  const gearKey = Object.values(spec).join(''), hasGear = /[1-9]/.test(gearKey);
  // build: per-bone girth (x/z) from the build type and how heavy he is for his height at his position
  const BD = (typeof BODY !== 'undefined' && BODY[rp && rp.pos]) || null; let rel = 0;
  if (BD && rp.ht && rp.wt) { const hu = cl((rp.ht - BD[0]) / Math.max(1, BD[1] - BD[0]), 0, 1), wexp = BD[2] + hu * (BD[3] - BD[2]); rel = cl((rp.wt - wexp) / Math.max(6, (BD[3] - BD[2]) / 2), -1.2, 1.2); }
  const bt = lk.bt == null ? 1 : lk.bt, f = (lean, thick, kr) => (bt === 0 ? lean : bt === 2 ? thick : 1) + kr * rel;
  const up = f(0.88, 1.12, 0.03), fo = f(0.9, 1.08, 0.02), th = f(0.925, 1.08, 0.03), sh = f(0.94, 1.05, 0.015);
  const girth = [f(0.955, 1.045, 0.025), f(0.93, 1.07, 0.05), f(0.965, 1.035, 0.015), f(0.95, 1.1, 0.03), 1, up, fo, 1, up, fo, 1, th, sh, 1, th, sh, 1];
  const visor = lk.vz ? ((typeof LK_VISOR !== 'undefined' && LK_VISOR[lk.vt | 0]) || 'smoke') : null;
  return { body, bodyMat, head, gearPal, spec, gearKey, hasGear, girth, visor, mask: maskStyle(rp), kit: KS, skin, ink, spat: sp };
}
Object.assign(R3D._, { NS, NSH, NSG, meshSDF, bodyParams, skeleton, BONES, BI, makeBodyModel, makeHeadModel, makeHelmetModel, maskBars, HELMS, makeGear, look3, maskStyle, bodyDesign, kitStyle, fabric, hexMix, hexLum });
})();
