// 2D art for menus: portraits (busts), team logos and the illustrated stadium. v4 portraits, v3 logos.
// ---------------- portraits ----------------
// One consistent illustrated style: a slight three-quarter turn, a key light from the upper left with hard-edged shadow planes,
// a cool rim light on the shadow side, warm ink lines that are heavier on the shadow side, and real hair masses with texture.
// The head is laid out as a simple 3D form (half-width X, depth Z) and projected with a small yaw, so every feature sits on the turned face.
// lk fields: sk hs hc head jaw ear eye ec bw nose mo bd bl bt hb tat ta er fr sc ex ey eb ns aL aR ac ht hx (documented in league/10_data.js)
function ART_rgb(h) { const s = String(h || '#808080').replace('#', ''), n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s.slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function ART_hex(r, g, b) { return '#' + ((1 << 24) | (Math.max(0, Math.min(255, Math.round(r))) << 16) | (Math.max(0, Math.min(255, Math.round(g))) << 8) | Math.max(0, Math.min(255, Math.round(b)))).toString(16).slice(1); }
function ART_mix(a, b, t) { const A = ART_rgb(a), B = ART_rgb(b); return ART_hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
function ART_a(h, a) { const c = ART_rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function ART_sat(h, k) { const [r, g, b] = ART_rgb(h), m = (r + g + b) / 3; return ART_hex(m + (r - m) * k, m + (g - m) * k, m + (b - m) * k); }
// smooth curve through points (Catmull-Rom as cubic Beziers); adds to the current path
function ART_spline(x, pts, closed, move = true) {
  const n = pts.length; if (n < 2) return; const P = i => closed ? pts[(i + n) % n] : pts[i < 0 ? 0 : i >= n ? n - 1 : i];
  if (move) x.moveTo(pts[0][0], pts[0][1]); else x.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0, m = closed ? n : n - 1; i < m; i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    x.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
  if (closed) x.closePath();
}
// a tapered stroke along a quadratic curve (width w0 at the start to w1 at the end), added to the current path for a fill: the hand-inked line
function ART_taper(x, ax, ay, cx, cy, bx, by, w0, w1) {
  const N = 6, Lf = [], Rt = []; for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t, px = u * u * ax + 2 * u * t * cx + t * t * bx, py = u * u * ay + 2 * u * t * cy + t * t * by, dx = u * (cx - ax) + t * (bx - cx), dy = u * (cy - ay) + t * (by - cy), d = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
    Lf.push(px - dy / d * w, py + dx / d * w); Rt.push(px + dy / d * w, py - dx / d * w); }
  x.moveTo(Lf[0], Lf[1]); for (let i = 2; i < Lf.length; i += 2) x.lineTo(Lf[i], Lf[i + 1]); for (let i = Rt.length - 2; i >= 0; i -= 2) x.lineTo(Rt[i], Rt[i + 1]); x.closePath();
}
function BUST_rng(lk, salt) { let h = (2166136261 ^ (salt | 0)) >>> 0; for (const k of ['sk', 'hs', 'hc', 'head', 'jaw', 'ear', 'eye', 'ec', 'bw', 'nose', 'mo', 'bd', 'bl', 'bt', 'ex', 'sc', 'fr', 'er']) h = Math.imul(h ^ ((((lk[k] | 0) + 3) * 2654435761) >>> 0), 16777619) >>> 0; return seededRng(h); }
function BUST_star(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const q = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); }
// skin ramp: light plane, highlight, base, shadow plane, deep shadow, ink, lips, rim light
const BUST_SKC = {};
function BUST_skin(sk) {
  if (BUST_SKC[sk]) return BUST_SKC[sk]; const L0 = lum(sk), sk0 = sk;
  if (L0 < 0.26) sk = ART_mix(ART_sat(sk, 1.1), '#8a5a3e', 0.24 - L0 * 0.5);   // the deepest tones get a little lift so the features still read at list sizes
  const L = lum(sk), lite = L > 0.55, dk = L < 0.33;
  return BUST_SKC[sk0] = { base: sk, lt: ART_mix(sk, dk ? '#f0c8a8' : '#fff0dc', lite ? 0.3 : dk ? 0.22 : 0.17), hi: ART_mix(sk, dk ? '#f2dccc' : '#fff7ee', lite ? 0.55 : dk ? 0.42 : 0.4),
    sh: ART_mix(ART_sat(sk, 1.12), lite ? '#8a3f44' : dk ? '#1d0b0d' : '#4a1d1f', lite ? 0.3 : dk ? 0.32 : 0.36), sh2: ART_mix(sk, lite ? '#55222a' : '#120507', lite ? 0.5 : dk ? 0.48 : 0.56),
    ink: ART_mix(sk, '#1d0e0a', lite ? 0.72 : 0.66), lip: ART_mix(sk, lite ? '#b4625f' : dk ? '#4a2422' : '#7e3c35', lite ? 0.4 : 0.36), lipD: ART_mix(sk, lite ? '#7e3337' : '#22100f', lite ? 0.5 : 0.52),
    warm: lite ? 'rgba(214,92,84,.09)' : 'rgba(150,50,40,.08)', rim: ART_mix(sk, '#d8ecff', dk ? 0.38 : 0.5), L };
}
const BUST_HCC = {};
function BUST_hairC(hc) {   // hair ramp: highlight, base, shadow, deep
  if (BUST_HCC[hc]) return BUST_HCC[hc]; const L = lum(hc), c = ART_rgb(hc), grey = Math.abs(c[0] - c[2]) < 12 && L > 0.3;
  return BUST_HCC[hc] = { base: hc, hi: L < 0.12 ? ART_mix(hc, '#7d8aa0', 0.42) : grey ? ART_mix(hc, '#ffffff', 0.5) : ART_mix(hc, '#fff1cf', L > 0.5 ? 0.5 : 0.32),
    sh: L < 0.12 ? ART_mix(hc, '#000000', 0.55) : ART_mix(hc, grey ? '#2c3240' : '#2a140a', L > 0.5 ? 0.42 : 0.45), dd: ART_mix(hc, '#000000', 0.7), L };
}
// head layout. yaw > 0 turns the face toward the viewer's right (that side is then the far side). P(X, Z) projects a point on the head to screen x.
function BUST_geo(lk, big) {
  const r = BUST_rng(lk, 5), hd = lk.head | 0, jw = lk.jaw | 0, bt = lk.bt == null ? 1 : lk.bt;
  // [half width, top, chin, cheekbone k, jaw k, chin k]: 0 oval, 1 broad, 2 square, 3 long, 4 heavy, 5 heart
  const HS = [[16.5, 12.6, 61.0, 0.98, 0.85, 0.42], [17.4, 12.6, 60.6, 1.0, 0.91, 0.48], [16.9, 12.8, 61.6, 0.98, 0.96, 0.56], [15.9, 11.6, 62.2, 0.97, 0.85, 0.42], [17.8, 13.0, 61.8, 1.0, 0.98, 0.55], [17.0, 12.3, 61.2, 1.04, 0.8, 0.35]][hd] || [16.5, 12.6, 61.0, 0.98, 0.85, 0.42];
  const R = HS[0] + big * 0.5 + (r() - 0.5) * 0.8, T = HS[1] + (r() - 0.5) * 1.1, C = HS[2] + (r() - 0.5) * 1.3 + big * 0.45, H = C - T;
  const eyeY = T + H * (0.47 + (r() - 0.5) * 0.03), browY = eyeY - 3.3 - r() * 0.7, noseY = eyeY + (C - eyeY) * (0.46 + (r() - 0.5) * 0.06), mouthY = noseY + (C - noseY) * (0.37 + (r() - 0.5) * 0.06);
  const yaw = (r() < 0.5 ? -1 : 1) * (0.2 + r() * 0.16), sn = Math.sin(yaw), cs = Math.cos(yaw), cx = 48 - sn * R * 0.3;
  const g = { R, T, C, H, eyeY, browY, noseY, mouthY, gonY: mouthY + 0.6 + (r() - 0.5) * 1.2 - (jw === 2 ? 0.5 : 0), cheekY: eyeY + 3.6,
    Wk: R * HS[3], Wj: R * (HS[4] + [-0.05, 0, 0.06][jw] + big * 0.03 + (r() - 0.5) * 0.05), Wch: R * (HS[5] + (jw - 1) * 0.04 + (r() - 0.5) * 0.06), sq: jw === 2 || hd === 2 || hd === 4,
    yaw, sn, cs, cx, sf: yaw > 0 ? 1 : -1,
    eyeSep: R * (0.4 + (r() - 0.5) * 0.05), eyeW: 3.25 + (r() - 0.5) * 0.45 + (lk.eye === 2 ? 0.25 : 0), eyeH: [1.4, 1.1, 1.62][lk.eye | 0] || 1.4, tilt: (r() - 0.45) * 0.7,
    noseW: [1.95, 2.5, 3.2][lk.nose | 0] + (r() - 0.5) * 0.4, noseP: 3.1 + r() * 1.7, hook: r() < 0.18 ? 0.6 : 0, mouthW: 4.9 + r() * 1.2 + (lk.nose === 2 ? 0.5 : 0), lipF: 0.68 + r() * 0.45,
    hollow: bt === 0 ? 1 : bt === 1 ? 0.6 : 0.3, cleft: r() < 0.18, browA: 0.4 + r() * 0.7, hl: 0.115 + r() * 0.045, gaze: (r() - 0.5) * 0.5, adam: r() < 0.5, age: 0 };
  g.P = (X, Z) => g.cx + X * cs + Z * sn;
  g.Z = (X, d) => d * Math.sqrt(Math.max(0, 1 - (X / (R * 1.06)) ** 2));
  g.k = X => { const a = Math.asin(Math.max(-0.99, Math.min(0.99, X / (R * 1.06)))); return Math.cos(a + yaw) / Math.cos(a); };
  g.cr = { hx: g.cx - 0.1 * R * sn, yc: eyeY, A: R * Math.hypot(cs, 1.12 * sn), B: eyeY - T };
  return g;
}
const BUST_crPt = (g, t, th) => [g.cr.hx + (g.cr.A + th) * Math.sin(t), g.cr.yc - (g.cr.B + th) * Math.cos(t)];
const BUST_crT = (g, y, s) => s * Math.acos(Math.max(-1, Math.min(1, (g.cr.yc - y) / g.cr.B)));
// head silhouette: far cheek (cheekbone bump, hollow, jaw corner) and chin, the cranium, then the near side down past the ear to the jaw
function BUST_headPts(g) {
  if (g._hp) return g._hp; const { R, P, sf } = g, nr = -sf, pts = [];
  pts.push([P(0, 0.86 * R), g.C]);
  pts.push([P(sf * g.Wch, 0.8 * R), g.C - 1.1]);
  pts.push([P(sf * (g.Wj * 0.55 + g.Wch * 0.45), 0.5 * R), g.gonY + (g.C - g.gonY) * 0.62]);
  if (g.sq) pts.push([P(sf * g.Wj * 0.99, 0.12 * R), g.gonY + 0.9]);
  pts.push([P(sf * g.Wj, 0.04 * R), g.gonY - (g.sq ? 0.6 : 0)]);
  pts.push([P(sf * (g.Wk * 0.42 + g.Wj * 0.58) * (1 - g.hollow * 0.012), 0.27 * R), (g.cheekY + g.gonY) / 2 + 1]);
  pts.push([P(sf * g.Wk, 0.34 * R), g.cheekY]);
  const tF = BUST_crT(g, g.browY - 0.6, sf), tN = BUST_crT(g, g.noseY + 1.4, nr);
  for (let i = 0; i <= 10; i++) pts.push(BUST_crPt(g, tF + (tN - tF) * i / 10, 0));
  pts.push([P(nr * g.Wj * 1.03, -0.14 * R), g.gonY - 3.6]);
  if (g.sq) pts.push([P(nr * g.Wj * 1.01, -0.02 * R), g.gonY + 0.3]);
  pts.push([P(nr * g.Wj, 0.06 * R), g.gonY + (g.sq ? 1.3 : 0.8)]);
  pts.push([P(nr * (g.Wj * 0.55 + g.Wch * 0.45), 0.5 * R), g.gonY + (g.C - g.gonY) * 0.62]);
  pts.push([P(nr * g.Wch, 0.8 * R), g.C - 1.1]);
  return g._hp = pts;
}
function BUST_hairFill(x, hc, y0, y1) { const c = BUST_hairC(hc), gr = x.createLinearGradient(38, y0, 58, y1); gr.addColorStop(0, c.hi); gr.addColorStop(0.5, hc); gr.addColorStop(1, c.sh); return gr; }
// ---- the neck (behind the head): a column with the head's cast shadow, tendons and the far side in shadow
function BUST_neck(x, lk, sk, big, gear, g) {
  g = g || BUST_geo(lk, big); const S = BUST_skin(sk), bt = lk.bt == null ? 1 : lk.bt, nw = g.R * (0.66 + big * 0.1 + bt * 0.05), nx = g.cx - 0.28 * g.R * g.sn, y0 = g.noseY, y1 = 81, fl = 5 + big * 2;
  const side = (s, move) => { const a = nx + s * nw; if (move) x.moveTo(a, y0); else x.lineTo(a, y0); x.bezierCurveTo(a + s * 0.4, 58, a + s * 0.6, 63, a + s * fl, 70); };
  const neck = () => { x.beginPath(); x.moveTo(nx - nw - fl, 70); x.bezierCurveTo(nx - nw - 0.6, 63, nx - nw - 0.4, 58, nx - nw, y0); x.lineTo(nx + nw, y0); x.bezierCurveTo(nx + nw + 0.4, 58, nx + nw + 0.6, 63, nx + nw + fl, 70); x.lineTo(nx + nw + fl, y1); x.lineTo(nx - nw - fl, y1); x.closePath(); };
  x.fillStyle = S.base; neck(); x.fill();
  x.save(); neck(); x.clip();
  x.fillStyle = S.sh; x.fillRect(nx + nw * 0.25, y0, 40, 40);                                                       // far half in shadow
  x.fillStyle = ART_a(S.sh2, 0.85); x.save(); x.translate(1.3, 3.6); x.beginPath(); ART_spline(x, BUST_headPts(g), true); x.fill(); x.restore();   // the head's cast shadow
  x.strokeStyle = ART_a(S.sh2, 0.5); x.lineWidth = 0.8; x.beginPath(); x.moveTo(nx - nw * 0.75, g.C - 1); x.quadraticCurveTo(nx - nw * 0.45, 64, nx - 1.6, 71); x.moveTo(nx + nw * 0.8, g.C - 1); x.quadraticCurveTo(nx + nw * 0.5, 64, nx + 1.8, 71); x.stroke();
  if (g.adam && !lk.bd) { x.fillStyle = ART_a(S.lt, 0.5); x.beginPath(); x.ellipse(nx + 0.4, g.C + 5.6, 1.1, 1.7, 0, 0, 7); x.fill(); }
  x.restore();
  x.strokeStyle = S.ink; x.lineWidth = 0.8; x.beginPath(); side(-1, true); side(1, true); x.stroke();
  if (gear && lk.tat) { const tx = nx + nw - 3; x.save(); x.globalAlpha = 0.55; x.strokeStyle = x.fillStyle = ART_mix(sk, '#141a26', 0.7); x.lineWidth = 0.7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(tx - 1.6, 63); x.quadraticCurveTo(tx + 1.4, 64.4, tx - 0.5, 66.2); x.quadraticCurveTo(tx - 2.1, 68, tx + 0.8, 69); x.stroke(); BUST_star(x, tx + 0.2, 61, 1.3); x.restore(); }
}
// ---- hair. k: shape (cap over the skull, flow = long hair with a part, afro, curly cap, block = high-top, mohawk); top / side: thickness over the skull;
// rec: temple recession; tex: texture; tuft: spiky silhouette; fade: shaved-sides strength
const BUST_HS = {
  1: { k: 'cap', top: 2.4, side: 1.1, rec: 0.8, tex: 'strand', tuft: 0.7 }, 2: { k: 'cap', top: 1.4, side: 0.8, rec: 3.8, tex: 'short', thin: 1, a: 0.9 }, 3: { k: 'afro', tex: 'coil' },
  4: { k: 'cap', top: 3.0, side: 2.2, rec: 0.4, tex: 'loc', locs: 70 }, 25: { k: 'cap', top: 3.4, side: 2.4, rec: 0.4, tex: 'loc', locs: 84 },
  5: { k: 'flow', top: 3.4, len: 71, part: 0.05 }, 10: { k: 'flow', top: 3.0, len: 69, band: 1, part: 0.05 }, 23: { k: 'flow', top: 3.8, len: 60, bangs: 1 },
  6: { k: 'mohawk', w: 3.2, h: 8.5, fade: 0.42 }, 17: { k: 'mohawk', w: 5.2, h: 8, curly: 1, fade: 0.5 }, 21: { k: 'mohawk', w: 7.6, h: 9, curly: 1, fade: 0.5 },
  7: { k: 'curly', top: 4.8, side: 1.2, rec: 0.4, fade: 0.55, tex: 'curl' }, 13: { k: 'curly', top: 5.4, side: 2.6, rec: 0.2, tex: 'coil' }, 20: { k: 'cap', top: 5.6, side: 2.2, rec: 0.2, tex: 'twist' },
  8: { k: 'cap', top: 1.6, side: 0.8, rec: 1.0, tex: 'short', tuft: 0.35 }, 9: { k: 'cap', top: 3.3, side: 1.2, rec: 1.0, tex: 'strand', part: 1, tuft: 0.6 }, 11: { k: 'cap', top: 0.7, side: 0.5, rec: 0.8, tex: 'short', a: 0.86 },
  12: { k: 'cap', top: 0.9, side: 0.6, rec: 0.5, tex: 'short', a: 0.94, sharp: 1 }, 14: { k: 'cap', top: 2.3, side: 1.3, rec: 0.6, tex: 'slick', bun: 1 }, 15: { k: 'cap', top: 2.8, side: 1.3, rec: 1.6, tex: 'slick' },
  16: { k: 'block', h: 4.4, fade: 0.5, tex: 'coil' }, 19: { k: 'block', h: 8.2, fade: 0.5, tex: 'coil' }, 18: { k: 'cap', top: 1.3, side: 1.0, rec: 0.2, tex: 'rows', braids: 1 }, 22: { k: 'cap', top: 2.0, side: 1.3, rec: 0.3, tex: 'loc', knot: 1 },
  24: { k: 'cap', top: 1.0, side: 0.6, rec: 0.5, tex: 'waves', a: 0.95, sharp: 1 } };
function BUST_hairline(g, st, y0) {   // the front hairline from the far side to the near side, on the turned forehead
  const { R, P, sf } = g, rec = st.rec || 0, side = st.sideY != null ? st.sideY : g.eyeY + 1.5;
  const out = [[1.0, side, 0.06], [0.93, g.browY - 0.9, 0.33], [0.76, y0 + rec, 0.6], [0.46, y0 + rec * 0.28 + 0.25, 0.86], [0, y0 + (st.peak || 0), 0.98]];
  const pts = []; for (const [u, yy, z] of out) pts.push([P(sf * u * R, z * R), yy]); for (let i = out.length - 2; i >= 0; i--) { const [u, yy, z] = out[i]; pts.push([P(-sf * u * R, z * R), yy]); }
  if (st.sharp) { pts.splice(2, 0, [P(sf * 0.86 * R, 0.45 * R), g.browY - 1.6]); pts.splice(pts.length - 2, 0, [P(-sf * 0.86 * R, 0.45 * R), g.browY - 1.6]); }
  return pts;
}
// outer edge of a hair mass over the skull, from the near sideburn to the far one (odd points become tuft tips when tuft > 0)
function BUST_hairOuter(g, top, side, yS, tuft, rr) {
  const nr = -g.sf, tN = BUST_crT(g, yS, nr), tF = BUST_crT(g, yS, g.sf), pts = [], N = tuft ? 30 : 14;
  for (let i = 0; i <= N; i++) { const t = tN + (tF - tN) * i / N, c = Math.max(0, Math.cos(t)), th = side + (top - side) * Math.pow(c, 1.4) + (tuft && i % 2 ? tuft * (0.5 + (rr ? rr() : 0.5)) : 0); pts.push(BUST_crPt(g, t, th)); }
  return pts;
}
// add an edge through points: smooth, pointed tufts (odd points are tips, leaning with the flow), or scallops bulging away from (cx, cy)
function BUST_edge(x, pts, mode, move, cx, cy, amt) {
  if (move !== false) x.moveTo(pts[0][0], pts[0][1]); else x.lineTo(pts[0][0], pts[0][1]);
  if (!mode) { ART_spline(x, pts, false, false); return; }
  if (mode === 'tuft') { for (let i = 1; i < pts.length; i += 2) { const a = pts[i - 1], t = pts[i], b = pts[i + 1] || t, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tx = t[0] + (b[0] - a[0]) * 0.35, ty = t[1] + (b[1] - a[1]) * 0.35;
      x.quadraticCurveTo(m[0] + (a[0] - m[0]) * 0.2, m[1] + (a[1] - m[1]) * 0.2, tx, ty); x.quadraticCurveTo(m[0], m[1], b[0], b[1]); } return; }
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1; x.quadraticCurveTo(mx + dx / d * amt, my + dy / d * amt, b[0], b[1]); }
}
// a hairline across the forehead that ends in clump tips instead of a smooth curve (points as from BUST_hairline; continues the current path)
function BUST_lineTufts(x, line, d) {
  const n = line.length; ART_spline(x, line.slice(0, 3), false, false);
  for (let i = 2; i < n - 3; i++) { const a = line[i], b = line[i + 1]; for (let k = 0; k < 2; k++) { const f0 = k / 2, f1 = (k + 1) / 2, ax = a[0] + (b[0] - a[0]) * f0, ay = a[1] + (b[1] - a[1]) * f0, bx = a[0] + (b[0] - a[0]) * f1, by = a[1] + (b[1] - a[1]) * f1, tx = ax + (bx - ax) * 0.62, ty = (ay + by) / 2 + d * (0.7 + ((i + k) % 3) * 0.2);
      x.quadraticCurveTo(ax + (bx - ax) * 0.3, (ay + by) / 2 + d * 0.15, tx, ty); x.quadraticCurveTo(tx + (bx - tx) * 0.2, (ty + by) / 2 - d * 0.2, bx, by); } }
  ART_spline(x, line.slice(n - 3), false, false);
}
// fill a mass with hard-edged light: highlight rim toward the light, shadow rim away from it
function BUST_mass(x, path, C, a, b, alpha) {
  x.save(); x.globalAlpha = alpha == null ? 1 : alpha; x.beginPath(); path(); x.clip();
  x.fillStyle = C.hi; x.fillRect(0, 0, 96, 96);
  x.fillStyle = C.base; x.save(); x.translate(a * 0.85, a); x.beginPath(); path(); x.fill(); x.restore();
  x.fillStyle = C.sh; x.beginPath(); x.rect(-10, -10, 116, 116); x.save(); x.translate(-b, -b * 0.55); path(); x.restore(); x.fill('evenodd');
  x.restore();
}
// soft hairline: short strokes from the hair out onto the forehead
function BUST_fringe(x, line, col, len, a) {
  x.strokeStyle = ART_a(col, a); x.lineWidth = 0.42; x.beginPath();
  for (let i = 1; i < line.length - 2; i++) { const p = line[i], q = line[i + 1]; for (let k = 0; k < 4; k++) { const f = k / 4, px = p[0] + (q[0] - p[0]) * f, py = p[1] + (q[1] - p[1]) * f; x.moveTo(px, py - 0.6); x.lineTo(px + (k % 2 ? 0.3 : -0.3), py + len * (0.6 + (k % 3) * 0.25)); } }
  x.stroke();
}
function BUST_backHair(x, lk, hc, g) {   // hair that falls behind the head, neck and shoulders
  g = g || BUST_geo(lk, 0); const st = BUST_HS[lk.hs] || {}, C = BUST_hairC(hc), r = BUST_rng(lk, 77), { R } = g, hx = g.cr.hx, A = g.cr.A;
  if (st.k === 'flow') { const L = st.len + 3, w = A + st.top + 1.2; const path = () => { x.moveTo(hx - w, g.browY); x.bezierCurveTo(hx - w - 2.5, g.eyeY + 12, hx - w - 3, L - 8, hx - w - 1, L); x.lineTo(hx + w + 1, L); x.bezierCurveTo(hx + w + 3, L - 8, hx + w + 2.5, g.eyeY + 12, hx + w, g.browY); x.closePath(); };
    x.fillStyle = C.sh; x.beginPath(); path(); x.fill(); x.save(); x.beginPath(); path(); x.clip(); x.strokeStyle = C.dd; x.globalAlpha = 0.6; x.lineWidth = 0.6; x.beginPath(); for (let i = 0; i < 14; i++) { const xx = hx - w + 1 + i * (2 * w - 2) / 13; x.moveTo(xx, g.eyeY); x.lineTo(xx + (xx - hx) * 0.1, L); } x.stroke(); x.restore(); }
  if (st.locs || st.braids) { const L = st.locs || 72, n = st.braids ? 4 : 6, wd = st.braids ? 1.9 : 2.5; x.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const bx = hx + s * (R * 0.55 + i * (st.braids ? 2.2 : 2.3)), ex = bx + s * (1.2 + i * 0.5), ey = L - Math.abs(i - n / 2) * 2.2 - r() * 3;
      x.strokeStyle = C.dd; x.lineWidth = wd + 0.9; x.beginPath(); x.moveTo(bx, g.eyeY - 2); x.quadraticCurveTo(bx + s * 2.2, (g.eyeY + ey) / 2, ex, ey); x.stroke();
      x.strokeStyle = i % 2 ? C.sh : C.base; x.lineWidth = wd; x.stroke(); x.setLineDash([1.1, 1.3]); x.strokeStyle = C.hi; x.globalAlpha = 0.5; x.lineWidth = 0.6; x.stroke(); x.setLineDash([]); x.globalAlpha = 1; } }
}
// long hair: from a part over the top, framing the face and falling past the jaw; or a shaggy cut with bangs. Returns the path and strand guides
function BUST_flow(g, st, x) {
  const { R, P, sf } = g, nr = -sf, hx = g.cr.hx, A = g.cr.A, top = st.top, len = st.len, hlY = g.T + g.H * g.hl;
  const partX = P(-sf * (st.part || 0) * R, 0.98 * R), partY = hlY - 1.8, sides = {};
  for (const s of [nr, sf]) { const far = s === sf, faceX = far ? P(sf * g.Wk, 0.34 * R) : hx + s * A * 0.97;
    sides[s] = { inner: [[partX + s * 0.4, partY], [P(s * 0.5 * R, 0.86 * R), hlY + 1.2], [P(s * 0.9 * R, 0.42 * R) - s * 0.4, g.browY - 0.4], [faceX - s * (far ? 0.9 : 1.4), g.cheekY + 1], [faceX - s * (far ? 0.2 : 0.6), (g.gonY + len) / 2], [faceX + s * 0.6, len - 2.2]],
      outer: [BUST_crPt(g, s * 0.12, top), BUST_crPt(g, s * 0.8, top * 0.95), [hx + s * (A + top * 0.75), g.browY - 1.5], [hx + s * (A + top * 0.6 + 1.4), g.cheekY + 1], [hx + s * (A + 2.4), (g.gonY + len) / 2], [hx + s * (A + 1.6), len]] }; }
  const tips = (s, from, to) => { const n = 3; for (let i = 1; i <= n * 2; i++) { const f = i / (n * 2), px = from[0] + (to[0] - from[0]) * f, py = from[1] + (to[1] - from[1]) * f + (i % 2 ? 2.4 : 0); x.lineTo(px, py); } };
  const path = () => { const N = sides[nr], F = sides[sf];
    ART_spline(x, N.outer.slice().reverse(), false); ART_spline(x, F.outer, false, false); tips(sf, F.outer[5], F.inner[5]);
    if (st.bangs) { ART_spline(x, F.inner.slice(2).reverse(), false, false); const y = g.browY - 1.3; for (let i = 0; i <= 10; i++) { const u = sf * (0.9 - 1.8 * i / 10); x.lineTo(P(u * R, g.Z(u * R, R)), y + (i % 2 ? -2.4 : 0.9) + Math.abs(u) * 1.5); } ART_spline(x, N.inner.slice(2), false, false); }
    else { ART_spline(x, F.inner.slice().reverse(), false, false); ART_spline(x, N.inner, false, false); }
    tips(nr, N.inner[5], N.outer[5]); x.closePath(); };
  return { path, sides };
}
// ---- hair on top of the head
function BUST_hair(x, lk, hc, c2, hw, ht0, g) {
  g = g || BUST_geo(lk, 0); const hs = lk.hs | 0, C = BUST_hairC(hc), S = BUST_skin(SKIN[lk.sk] || SKIN[0]), r = BUST_rng(lk, 31), { R, P, sf } = g, st = BUST_HS[hs] || { k: 'cap', top: 2, side: 1, rec: 1, tex: 'short' };
  const hlY = g.T + g.H * (g.hl + (st.thin ? 0.04 : 0)), tip = lk.ht === 1 ? '#e3cf98' : lk.ht === 2 ? '#c0602e' : null, hx = g.cr.hx, A = g.cr.A;
  if (hs === 0) {   // shaved head: scalp sheen and a shadow of regrowth
    x.save(); x.beginPath(); ART_spline(x, BUST_headPts(g), true); x.clip();
    x.fillStyle = ART_a(C.base, 0.13); x.beginPath(); ART_spline(x, BUST_hairOuter(g, 0.2, 0.2, g.eyeY + 1, 0), false); ART_spline(x, BUST_hairline(g, { rec: 2.5, sideY: g.eyeY + 1 }, g.T + g.H * g.hl - 1), false, false); x.fill();
    x.fillStyle = ART_a(S.hi, 0.5); x.beginPath(); x.ellipse(hx - R * 0.35, g.T + 5, R * 0.38, 2.6, -0.45, 0, 7); x.fill(); x.fillStyle = ART_a('#ffffff', 0.3); x.beginPath(); x.ellipse(hx - R * 0.4, g.T + 4.4, R * 0.16, 1, -0.45, 0, 7); x.fill(); x.restore(); return; }
  const sideY = st.fade ? g.eyeY + 0.5 : g.eyeY + 2, line = BUST_hairline(g, { ...st, sideY }, hlY), lineRL = sf > 0 ? line : line.slice().reverse();
  // faded sides: a thin layer of short hair, darker toward the top
  if (st.fade) { const o = BUST_hairOuter(g, 0.5, 0.3, sideY, 0); x.save(); x.beginPath(); ART_spline(x, o, false); ART_spline(x, line, false, false); x.closePath(); x.clip();
    const gr = x.createLinearGradient(0, g.eyeY + 2, 0, g.T + 4); gr.addColorStop(0, ART_a(C.base, 0.1)); gr.addColorStop(0.6, ART_a(C.base, st.fade)); gr.addColorStop(1, ART_a(C.base, 0.85)); x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
    x.fillStyle = ART_a(C.dd, 0.35); for (let i = 0; i < 40; i++) x.fillRect(hx - A + r() * 2 * A, g.T + r() * (g.eyeY - g.T), 0.4, 0.4); x.restore(); }
  let main, fl = null, edgeTex = null;
  if (st.k === 'flow') { fl = BUST_flow(g, st, x); main = fl.path; }
  else if (st.k === 'afro' || st.k === 'curly') {
    const pts = []; let cx, cy;
    if (st.k === 'afro') { cx = hx; cy = g.T + 7.5; const rx = A + 7.4, ry = (g.eyeY - g.T) * 0.66 + 7; for (let i = 0; i <= 26; i++) { const a = Math.PI * (0.9 + 1.2 * i / 26); pts.push([cx + Math.cos(a) * rx * (0.97 + r() * 0.05), cy + Math.sin(a) * ry * (0.97 + r() * 0.05) + (Math.sin(a) > 0 ? 2 : 0)]); } }
    else { cx = hx; cy = g.cr.yc; const o = BUST_hairOuter(g, st.top, st.side, sideY, 0); for (let i = 0; i < o.length; i++) pts.push(o[i]); }
    const al = st.k === 'afro' ? BUST_hairline(g, { rec: 0.2, sideY: g.eyeY + 1.5 }, hlY - 0.4) : line, alRL = sf > 0 ? al : al.slice().reverse(), ord = st.k === 'afro' ? alRL : al, amt = st.k === 'afro' ? 1.5 : 1.1;
    main = () => { BUST_edge(x, pts, 'scallop', true, cx, cy, amt); ART_spline(x, ord, false, false); x.closePath(); }; }
  else if (st.k === 'block') { const w = R * 0.84, top = g.T - st.h, yb = g.T + 7.5; main = () => { x.moveTo(hx - w - 1.3, yb + 4); x.lineTo(hx - w, top + 1.6); x.quadraticCurveTo(hx - w, top, hx - w + 2, top - 0.2); x.lineTo(hx + w - 2, top - 0.2); x.quadraticCurveTo(hx + w, top, hx + w, top + 1.6); x.lineTo(hx + w + 1.3, yb + 4); ART_spline(x, lineRL.slice(1, -1), false, false); x.closePath(); }; }
  else if (st.k === 'mohawk') { const fx = P(0, R), w = st.w, h = st.h; main = () => { x.moveTo(fx - w * (st.curly ? 0.62 : 1), hlY + 1);
    if (!st.curly) { x.lineTo(fx - w * 1.05, g.T); for (let i = 0; i < 5; i++) { const xx = fx - w + (i + 0.5) * w * 0.4; x.lineTo(xx, g.T - h + Math.abs(i - 2) * 1.2); x.lineTo(xx + w * 0.2, g.T - h * 0.55); } x.lineTo(fx + w * 1.05, g.T); }
    else { const pts = [[fx - w * 0.62, hlY - 1], [fx - w * 0.95, g.T + 3]]; for (let i = 0; i <= 12; i++) { const a = Math.PI * (1.04 + 0.92 * i / 12); pts.push([fx + Math.cos(a) * w * 1.12, g.T + 2 - h * 0.25 + Math.sin(a) * h * 0.85]); } pts.push([fx + w * 0.95, g.T + 3], [fx + w * 0.62, hlY - 1]);
      x.lineTo(fx - w * 0.62, hlY + 1); BUST_edge(x, pts, 'scallop', false, fx, g.T + 4, 1.0); x.lineTo(fx + w * 0.62, hlY + 1); x.closePath(); return; }
    x.lineTo(fx + w, hlY + 1); x.closePath(); }; }
  else { const o = BUST_hairOuter(g, st.top, st.side, sideY, st.tuft || 0, r); main = () => { BUST_edge(x, o, st.tuft ? 'tuft' : 0, true); if (st.tex === 'strand') BUST_lineTufts(x, line, 1.4); else ART_spline(x, line, false, false); x.closePath(); }; }
  // the mass, lit from the upper left
  const fine = st.tex === 'short';
  BUST_mass(x, main, C, fine ? 0.8 : 1.6, fine ? 0.9 : 1.9, st.a);
  x.save(); x.beginPath(); main(); x.clip(); x.lineCap = 'round';
  const top = g.T - (st.top || 0), fx = P(0, R), lit = (px, py) => px < hx + R * 0.15 && py < g.eyeY - 2;
  if (fl) {   // long hair: clumps that follow the shape from the part to the tips
    for (const s of [-1, 1]) { const sd = fl.sides[s]; for (let j = 0; j < 6; j++) { const f = 0.1 + j * 0.16 + (r() - 0.5) * 0.05, pts = sd.inner.map((p, k) => [p[0] + (sd.outer[k][0] - p[0]) * f, p[1] + (sd.outer[k][1] - p[1]) * f]);
      x.strokeStyle = ART_a(C.dd, 0.6); x.lineWidth = 0.6; x.beginPath(); ART_spline(x, pts, false); x.stroke();
      if (s < 0 || j < 2) { x.strokeStyle = ART_a(C.hi, s < 0 ? 0.75 : 0.4); x.lineWidth = 0.7; x.beginPath(); ART_spline(x, pts.slice(0, 4).map(p => [p[0] + 0.8, p[1] + 0.3]), false); x.stroke(); } } }
    x.fillStyle = ART_a(C.hi, 0.35); x.beginPath(); x.ellipse(hx - R * 0.45, top + 3.5, R * 0.42, 1.6, -0.5, 0, 7); x.fill(); }
  else if (st.tex === 'strand') {   // short straight hair: clumps sweeping back from the hairline, or across from a side part
    const part = st.part ? P(-0.45 * R * sf, 0.85 * R) : null, n = 9;   // tapered gaps between clumps (thick at the hairline), lit clumps get a tapered sheen
    for (const [col, k, a] of [[C.dd, 0, 0.65], [C.hi, 1, 0.8]]) { x.fillStyle = ART_a(col, a); x.beginPath();
      for (let i = 0; i < n; i++) { const u = -0.92 + 1.84 * (i + (k ? 0.45 : 0) + r() * 0.15) / n, sx = P(u * R, g.Z(u * R, R)), sy = hlY + 0.2 + Math.abs(u) * 3 + (k ? -1.4 : 0);
        if (k && !lit(sx, sy - 3)) continue; const w = k ? 1.1 : 0.95;
        if (part) { const tx = part + (u + 0.9) * 0.7; ART_taper(x, sx + (sx - part) * 0.06, sy + 1.2, sx - (sx - tx) * 0.2, top + 0.8, tx, top + 1.6, w, 0); }
        else ART_taper(x, sx, sy + (k ? 0 : 0.9), sx + (sx - hx) * 0.18, (sy + top) / 2, hx + (sx - hx) * 0.45, top + 0.6, w, 0); } x.fill(); }
    if (part) { x.fillStyle = C.dd; x.beginPath(); ART_taper(x, part + 0.3, hlY + 0.5, part - 0.4, hlY - 3, part, top + 1.5, 0.9, 0.1); x.fill(); } }
  else if (st.tex === 'short') {   // buzz / short crop: stipple over the scalp and a soft sheen
    const t0 = g.T - 1; x.fillStyle = ART_a(C.dd, 0.5); for (let i = 0; i < 80; i++) x.fillRect(hx - A - 2 + r() * (2 * A + 4), t0 + r() * (g.eyeY - t0), 0.45, 0.55);
    x.fillStyle = ART_a(C.hi, 0.45); for (let i = 0; i < 34; i++) { const px = hx - A + r() * A * 1.15, py = t0 + r() * (hlY - t0); x.fillRect(px, py, 0.45, 0.5); } }
  else if (st.tex === 'curl' || st.tex === 'coil' || st.curly) {   // curls and coils: small open loops, light ones only where the light hits
    const big2 = st.k === 'afro', blk = st.k === 'block', n = big2 ? 110 : st.k === 'mohawk' ? 26 : blk ? 50 : 60, rad = st.tex === 'curl' ? 1.25 : 0.85, y0 = big2 ? g.T - 14 : blk ? g.T - st.h - 1 : top - 3, y1 = big2 ? g.eyeY + 2 : hlY + 2, w0 = big2 ? A + 8 : A + 3;
    if (blk) { x.fillStyle = ART_a(C.hi, 0.28); x.fillRect(hx - R * 0.84, g.T - st.h + 0.6, R * 0.9, 1.3); }
    for (const [col, k] of [[C.dd, 0], [C.hi, 1]]) { x.strokeStyle = ART_a(col, k ? 0.75 : 0.7); x.lineWidth = k ? 0.5 : 0.55; x.beginPath();
      for (let i = 0; i < n * (k ? 0.6 : 1); i++) { const a = r() * Math.PI * 2, yy = y0 + r() * (y1 - y0), xx = hx + (r() * 2 - 1) * w0; if (k && !(xx < hx + R * 0.2 && yy < (big2 ? g.T + 4 : hlY))) continue;
        x.moveTo(xx + Math.cos(a) * rad, yy + Math.sin(a) * rad); x.arc(xx, yy, rad, a, a + 4); } x.stroke(); } }
  else if (st.tex === 'twist') {   // twists: rows of short twisted strands standing off the scalp
    for (let row = 0; row < 3; row++) for (let i = 0; i < 11 - row * 2; i++) { const u = -0.95 + 1.9 * (i + 0.5) / (11 - row * 2), xx = hx + u * (R + 2 - row * 2), yy = g.T + 3 - row * 3.2 + Math.abs(u) * 6, ang = u * 0.5;
      x.save(); x.translate(xx, yy); x.rotate(ang); x.fillStyle = C.sh; x.beginPath(); x.ellipse(0, 0, 1.6, 3.6, 0, 0, 7); x.fill(); x.fillStyle = (i + row) % 2 ? C.base : C.hi; x.beginPath(); x.ellipse(-0.3, -0.4, 1.1, 3.0, 0, 0, 7); x.fill();
      x.strokeStyle = ART_a(C.dd, 0.6); x.lineWidth = 0.35; x.beginPath(); for (let k = -2; k <= 2; k++) { x.moveTo(-1, k * 1.2); x.lineTo(1, k * 1.2 - 0.7); } x.stroke(); if (tip) { x.fillStyle = tip; x.beginPath(); x.ellipse(-0.2, -2.6, 0.9, 0.9, 0, 0, 7); x.fill(); } x.restore(); } }
  else if (st.tex === 'waves') {   // 360 waves
    x.strokeStyle = ART_a(C.hi, 0.42); x.lineWidth = 0.5; x.beginPath(); for (let rr = 2.5; rr < 26; rr += 1.9) { x.moveTo(fx - 2 + rr, g.T + 8); x.arc(fx - 2, g.T + 8, rr, 0, Math.PI, true); } x.stroke(); }
  else if (st.tex === 'slick') {   // slicked back: long glossy strands and a hard shine band
    x.strokeStyle = ART_a(C.dd, 0.65); x.lineWidth = 0.5; x.beginPath(); for (let i = 0; i < 12; i++) { const u = -0.9 + 1.8 * (i + 0.5) / 12, sx = P(u * R, g.Z(u * R, R)); x.moveTo(sx, hlY + 0.5 + Math.abs(u) * 2.5); x.bezierCurveTo(sx, hlY - 4, hx + (sx - hx) * 0.8, top + 2, hx + (sx - hx) * 0.7, top); } x.stroke();
    x.fillStyle = ART_a('#ffffff', C.L < 0.12 ? 0.18 : 0.26); x.beginPath(); x.ellipse(hx - R * 0.25, top + 4.2, R * 0.55, 1.3, -0.12, 0, 7); x.fill(); }
  else if (st.tex === 'loc') {   // locs: root partings and rope segments on top
    x.strokeStyle = ART_a(C.dd, 0.7); x.lineWidth = 0.55; x.beginPath(); for (let i = 0; i < 9; i++) { const u = -0.88 + 1.76 * (i + 0.5) / 9, sx = P(u * R, g.Z(u * R, R)); x.moveTo(sx, hlY + 1); x.quadraticCurveTo(sx + (sx - hx) * 0.2, (hlY + top) / 2, hx + (sx - hx) * 0.4, top + 0.5); } x.stroke();
    x.strokeStyle = ART_a(C.hi, 0.45); x.lineWidth = 0.5; x.setLineDash([1, 1.4]); x.beginPath(); for (let i = 0; i < 9; i++) { const u = -0.8 + 1.76 * (i + 0.5) / 9, sx = P(u * R, g.Z(u * R, R)) - 1; x.moveTo(sx, hlY); x.quadraticCurveTo(sx + (sx - hx) * 0.2, (hlY + top) / 2, hx + (sx - hx) * 0.4 - 1, top + 1); } x.stroke(); x.setLineDash([]); }
  else if (st.tex === 'rows') {   // cornrows: braided rows running back from the hairline
    for (let i = 0; i < 7; i++) { const u = -0.82 + 1.64 * i / 6, sx = P(u * R, g.Z(u * R, R)), sy = hlY + 0.6 + Math.abs(u) * 2.4, ex2 = hx + (sx - hx) * 0.35;
      x.strokeStyle = C.dd; x.lineWidth = 2.3; x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + (sx - hx) * 0.08, (sy + g.T) / 2 - 1, ex2, g.T - 1); x.stroke(); x.strokeStyle = C.base; x.lineWidth = 1.6; x.stroke();
      x.strokeStyle = C.hi; x.lineWidth = 0.6; x.setLineDash([0.9, 1.1]); x.stroke(); x.setLineDash([]); } }
  x.restore();
  // locs that frame the face, top knot / bun
  if (st.locs) { x.lineCap = 'round'; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const bx = hx + s * (A - 1.6 + i * 1.9), L = (st.locs > 80 ? g.C + 10 : g.C + 3) - i * 2.5 + r() * 2;
      x.strokeStyle = C.dd; x.lineWidth = 3; x.beginPath(); x.moveTo(bx, g.browY - 3); x.quadraticCurveTo(bx + s * 1.4, (g.browY + L) / 2, bx + s * 0.6, L); x.stroke(); x.strokeStyle = s > 0 || i ? C.sh : C.base; x.lineWidth = 2.2; x.stroke();
      x.setLineDash([1, 1.3]); x.strokeStyle = ART_a(C.hi, 0.6); x.lineWidth = 0.6; x.stroke(); x.setLineDash([]); if (tip) { x.strokeStyle = tip; x.lineWidth = 2.2; x.beginPath(); x.moveTo(bx + s * 0.6, L - 3); x.lineTo(bx + s * 0.6, L); x.stroke(); } } }
  if (st.knot || st.bun) { const kx = hx + 0.5, ky = g.T - (st.knot ? 3.5 : 2.4), kr = st.knot ? 4.6 : 3.8; for (let k = 0; k < (st.knot ? 7 : 1); k++) { const a = k / 7 * Math.PI * 2, px = st.knot ? kx + Math.cos(a) * 2.6 : kx, py = st.knot ? ky + Math.sin(a) * 1.9 : ky;
      x.fillStyle = C.sh; x.beginPath(); x.arc(px + 0.4, py + 0.4, st.knot ? 2.3 : kr, 0, 7); x.fill(); x.fillStyle = k % 2 ? C.base : C.hi; x.beginPath(); x.arc(px - 0.3, py - 0.3, st.knot ? 1.9 : kr - 0.7, 0, 7); x.fill(); }
    if (tip && st.knot) { x.fillStyle = tip; x.beginPath(); x.arc(kx, ky - 1.2, 2.2, 0, 7); x.fill(); } x.fillStyle = c2; x.fillRect(kx - 3, ky + (st.knot ? 2.6 : 3.2), 6, 1.2); }
  x.strokeStyle = ART_a(C.dd, 0.8); x.lineWidth = 0.55; x.beginPath(); main(); x.stroke();
  if (st.k === 'cap' || st.k === 'curly' || st.k === 'afro') BUST_fringe(x, st.k === 'afro' ? (sf > 0 ? BUST_hairline(g, { rec: 0.2, sideY: g.eyeY + 1.5 }, hlY - 0.4) : BUST_hairline(g, { rec: 0.2, sideY: g.eyeY + 1.5 }, hlY - 0.4)) : line, C.base, fine ? 0.7 : 1.0, 0.55);
  if (st.band) BUST_band(x, g, c2, hlY + 1.4);
}
function BUST_band(x, g, c2, y) {   // headband wrapping the forehead, following the turn; it disappears round the sides of the head
  const pts = [], R = g.R, hb = 2.7; for (let i = 0; i <= 10; i++) { const u = -1 + 2 * i / 10; pts.push([g.P(u * R * 1.04, g.Z(u * R, R * 1.06)), y + u * u * 1.8]); }
  const band = a => { ART_spline(x, a, false); ART_spline(x, a.map(p => [p[0], p[1] + hb]).reverse(), false, false); x.closePath(); };
  x.save(); x.beginPath(); x.ellipse(g.cr.hx, g.cr.yc, g.cr.A + 1.4, g.cr.B + 3, 0, 0, 7); x.clip();
  x.beginPath(); band(pts); x.fillStyle = c2; x.fill(); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.5; x.stroke();
  x.save(); x.beginPath(); band(pts); x.clip(); x.fillStyle = 'rgba(8,10,22,.3)'; x.fillRect(g.cr.hx + R * 0.45, 0, 40, 96); x.restore();
  x.fillStyle = 'rgba(255,255,255,.32)'; x.beginPath(); ART_spline(x, pts.slice(1, 6), false); ART_spline(x, pts.slice(1, 6).map(p => [p[0], p[1] + 0.7]).reverse(), false, false); x.fill();
  x.restore();
}
// ---- facial hair. BUST_beard draws what sits on the jaw and chin (before the mouth); BUST_stache the hair over the upper lip (after it)
function BUST_beardGeo(g) {
  const { R, P, sf } = g, nr = -sf, mY = g.mouthY;
  const jaw = drop => [[P(nr * R * 0.97, 0.12 * R), g.eyeY + 2.2], [P(nr * g.Wj * 1.02, 0.02 * R), g.gonY + drop * 0.3], [P(nr * (g.Wj * 0.55 + g.Wch * 0.45), 0.5 * R), g.gonY + (g.C - g.gonY) * 0.62 + drop * 0.75],
    [P(0, 0.88 * R), g.C + drop], [P(sf * (g.Wj * 0.55 + g.Wch * 0.45), 0.5 * R), g.gonY + (g.C - g.gonY) * 0.62 + drop * 0.75], [P(sf * g.Wj * 1.02, 0.02 * R), g.gonY + drop * 0.3], [P(sf * R * 0.97, 0.12 * R), g.eyeY + 2.2]];
  // the beard's upper edge: from the far sideburn diagonally across the cheek to the mouth corner, under the lower lip, and back up to the near sideburn
  const a = [[0.94, g.eyeY + 2.6, 0.2], [0.8, g.noseY - 0.4, 0.5], [0.58, mY - 0.2, 0.74], [0.3, mY + 2.8, 0.9], [0, mY + 3.0, 0.97]], inner = [];
  for (const [u, yy, z] of a) inner.push([P(sf * u * R, z * R), yy]); for (let i = a.length - 2; i >= 0; i--) { const [u, yy, z] = a[i]; inner.push([P(-sf * u * R, z * R), yy]); }
  return { jaw, inner };
}
function BUST_beard(x, lk, hc, sk, g) {
  g = g || BUST_geo(lk, 0); const bd = lk.bd | 0; if (!bd || bd === 4 || bd === 10) return; const C = BUST_hairC(ART_mix(hc, sk, 0.14)), r = BUST_rng(lk, 53), { R, P } = g, mY = g.mouthY, mw = g.mouthW, jc = P(0, R), { jaw, inner } = BUST_beardGeo(g);
  const full = drop => () => { ART_spline(x, jaw(drop), false); ART_spline(x, inner, false, false); x.closePath(); };
  const stip = (path, a, n) => { x.save(); x.beginPath(); path(); x.clip(); x.fillStyle = ART_a(C.base, a * 0.5); x.fillRect(0, 0, 96, 96); x.fillStyle = ART_a(C.dd, a); for (let i = 0; i < n; i++) x.fillRect(jc - 19 + r() * 38, g.noseY - 1 + r() * (g.C - g.noseY + 3), 0.45, 0.45); x.restore(); };
  if (bd === 1 || bd === 9) { stip(full(0.3), bd === 9 ? 0.5 : 0.28, bd === 9 ? 170 : 100); return; }
  if (bd === 3 || bd === 8) { const drop = bd === 8 ? 12 : 2.6, J = jaw(drop), bot = [];   // full / long beard: jagged bottom edge, strands, soft cheek line
    for (let i = 0; i < J.length - 1; i++) { bot.push(J[i]); if (i >= 1 && i < J.length - 2) for (let k = 1; k < 3; k++) { const f = k / 3, px = J[i][0] + (J[i + 1][0] - J[i][0]) * f, py = J[i][1] + (J[i + 1][1] - J[i][1]) * f; bot.push([px + (r() - 0.5) * 0.6, py + 0.9 + r() * 0.8]); } } bot.push(J[J.length - 1]);
    const path = () => { x.moveTo(bot[0][0], bot[0][1]); for (const p of bot) x.lineTo(p[0], p[1]); ART_spline(x, inner, false, false); x.closePath(); };
    BUST_mass(x, path, C, 1.1, 1.5);
    x.save(); x.beginPath(); path(); x.clip(); x.lineCap = 'round';
    for (const [col, a, n] of [[C.dd, 0.55, bd === 8 ? 34 : 26], [C.hi, 0.5, 10]]) { x.strokeStyle = ART_a(col, a); x.lineWidth = 0.5; x.beginPath(); for (let i = 0; i < n; i++) { const xx = jc - 14 + r() * 28, yy = mY + r() * (drop + g.C - mY); if (col === C.hi && xx > jc) continue; x.moveTo(xx, yy); x.lineTo(xx + (xx - jc) * 0.06, yy + 1.8 + r()); } x.stroke(); }
    x.restore(); stip(() => { ART_spline(x, inner, false); ART_spline(x, inner.map(p => [p[0], p[1] - 1.6]).reverse(), false, false); x.closePath(); }, 0.3, 50); return; }
  if (bd === 2 || bd === 7) { const cx2 = P(0, 0.95 * R), w = bd === 7 ? 1.3 : 3.1, top = bd === 7 ? mY + 2.7 : mY + 2.3, b = bd === 7 ? g.C - 1.4 : g.C + 1.8;
    const path = () => { x.moveTo(cx2 - w, top); x.quadraticCurveTo(cx2 - w * 1.15, b - 1, cx2, b); x.quadraticCurveTo(cx2 + w * 1.15, b - 1, cx2 + w, top); x.quadraticCurveTo(cx2, top + 0.7, cx2 - w, top); };
    BUST_mass(x, path, C, 0.7, 0.9); x.strokeStyle = ART_a(C.dd, 0.6); x.lineWidth = 0.45; x.beginPath(); for (let i = 0; i < 5; i++) { const xx = cx2 - w * 0.6 + i * w * 0.3; x.moveTo(xx, top + 1); x.lineTo(xx + (xx - cx2) * 0.1, b - 0.8); } x.stroke(); return; }
  if (bd === 6) { const path = () => { ART_spline(x, jaw(0.7), false); ART_spline(x, jaw(0.7).map(p => [p[0] + (jc - p[0]) * 0.07, p[1] - 1.9]).reverse(), false, false); x.closePath(); }; BUST_mass(x, path, C, 0.8, 0.9); }
  if (bd === 5) for (const s of [-1, 1]) {   // mutton chops: down each cheek from the sideburn, along the jaw, stopping short of the chin
    const pts = [[P(s * R * 0.98, 0.1 * R), g.eyeY + 1], [P(s * g.Wj * 1.03, 0.02 * R), g.gonY + 0.8], [P(s * (g.Wj * 0.55 + g.Wch * 0.45), 0.5 * R), g.gonY + (g.C - g.gonY) * 0.62 + 1],
      [P(s * (mw + 1.3), 0.78 * R), mY + 2.4], [P(s * (mw + 2.8), 0.72 * R), mY + 0.2], [P(s * 0.8 * R, 0.55 * R), g.noseY - 0.6], [P(s * 0.9 * R, 0.4 * R), g.eyeY + 1.4]];
    BUST_mass(x, () => ART_spline(x, pts, true), C, 0.7, 0.9); }
}
function BUST_stache(x, lk, hc, g) {
  const bd = lk.bd | 0; if (!bd || bd === 5 || bd === 6 || bd === 7) return; const C = BUST_hairC(ART_mix(hc, SKIN[lk.sk] || SKIN[0], 0.12)), { R, P } = g, mY = g.mouthY, mw = g.mouthW;
  const light = bd === 1 || bd === 9, L = P(-mw - 0.3, 0.8 * R), Rr = P(mw + 0.3, 0.8 * R), c = P(0, 1.02 * R), droop = bd === 10 ? 0.8 : 0.35, top = g.noseY + 1.5 + (bd === 4 ? -0.2 : 0);
  const path = () => { x.moveTo(L, mY + droop); x.bezierCurveTo(L + 1, mY - 1.2, c - 3, top + 0.4, c, top); x.bezierCurveTo(c + 3, top + 0.4, Rr - 1, mY - 1.2, Rr, mY + droop); x.bezierCurveTo(Rr - 1.6, mY - 0.5, c + 1.5, mY - 0.7, c, mY - 0.45); x.bezierCurveTo(c - 1.5, mY - 0.7, L + 1.6, mY - 0.5, L, mY + droop); x.closePath(); };
  if (light) { x.fillStyle = ART_a(C.base, bd === 9 ? 0.42 : 0.22); x.beginPath(); path(); x.fill(); return; }
  BUST_mass(x, path, C, 0.45, 0.6); x.strokeStyle = ART_a(C.dd, 0.55); x.lineWidth = 0.35; x.beginPath(); for (let i = -4; i <= 4; i++) { const xx = c + i * mw * 0.22; x.moveTo(xx, top + 0.5 + Math.abs(i) * 0.25); x.lineTo(xx + i * 0.3, mY - 0.5); } x.stroke();
  if (bd === 10) { x.strokeStyle = C.base; x.lineWidth = 1.15; x.lineCap = 'round'; x.beginPath(); for (const s of [-1, 1]) { const px = s < 0 ? L : Rr; x.moveTo(px + s * 0.2, mY); x.lineTo(px + s * 0.5, mY + 5.4); } x.stroke(); }
}
// ---- the whole head: ears, skull and face with planes of light and shadow, features, beard, hair. o: { sk, hc, big, c2, gear, g, noBack }
function BUST_head(x, lk, o) {
  const big = o.big || 0, g = o.g || BUST_geo(lk, big), S = BUST_skin(o.sk), hc = o.hc, ex = lk.ex | 0, { R, P, sf, sn } = g, nr = -sf, mo = lk.mo | 0, r = BUST_rng(lk, 19), hs = lk.hs | 0;
  if (!o.noBack) BUST_backHair(x, lk, hc, g);
  // ears: the near one shows its shell, the far one only peeks out
  const es = lk.ear ? 1.22 : 1;
  for (const s of [sf, nr]) { const near = s === nr, ex0 = P(s * R * 0.95, -0.12 * R) + s * (near ? 0.2 : -0.6), out = (near ? 2.6 + Math.abs(sn) * 3.2 : 2.2 - Math.abs(sn) * 2.4) * es; if (out < 0.4) continue;
    const top = g.browY + 0.8, bot = g.noseY + 1.6, shell = () => { x.beginPath(); x.moveTo(ex0 - s * 1.2, top); x.bezierCurveTo(ex0 + s * out * 1.15, top - 1.6, ex0 + s * out * 1.2, (top + bot) / 2, ex0 + s * out * 0.55, bot); x.quadraticCurveTo(ex0 + s * out * 0.1, bot + 1.6, ex0 - s * 1.6, bot - 0.4); x.closePath(); };
    x.fillStyle = s > 0 ? S.sh : S.base; shell(); x.fill(); x.strokeStyle = S.ink; x.lineWidth = 0.6; shell(); x.stroke();
    if (near && out > 2) { x.strokeStyle = ART_a(S.sh2, 0.8); x.lineWidth = 0.55; x.beginPath(); x.moveTo(ex0 + s * 0.4, top + 1.6); x.bezierCurveTo(ex0 + s * out * 0.85, top + 0.6, ex0 + s * out * 0.85, bot - 3, ex0 + s * out * 0.4, bot - 1.4); x.stroke();
      x.fillStyle = ART_a(S.sh2, 0.55); x.beginPath(); x.ellipse(ex0 + s * out * 0.32, (top + bot) / 2 + 0.6, out * 0.22, 1.6, 0, 0, 7); x.fill(); }
    if (o.gear && lk.er && (near || lk.er === 2)) { x.fillStyle = '#f2efe6'; x.beginPath(); x.arc(ex0 + s * out * 0.35, bot + 0.3, 0.85, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(ex0 + s * out * 0.35 + 0.3, bot + 0.6, 0.45, 0, 7); x.fill(); } }
  const hp = BUST_headPts(g), head = () => { x.beginPath(); ART_spline(x, hp, true); };
  x.fillStyle = S.ink; x.save(); x.translate(0.5, 0.65); head(); x.fill(); x.restore();             // ink weight on the shadow side
  x.fillStyle = S.base; head(); x.fill();
  x.save(); head(); x.clip();
  // shadow plane: the terminator runs down the right side, pushed in at the eye socket and under the cheekbone, out over the cheekbone and jaw
  const hx = g.cr.hx, tx = (y, d) => { const q = (y - g.cr.yc) / (g.cr.B + 2), w = g.cr.A * Math.sqrt(Math.max(0, 1 - q * q)); return hx + w * 0.5 + d; };
  const ts = [[hx + R * 0.8, g.T - 1], [tx(g.browY - 6, 0.6), g.browY - 6], [tx(g.browY, 1.2), g.browY], [tx(g.eyeY + 0.5, -1.4 - (sf > 0 ? 1.2 : 0)), g.eyeY + 0.5], [tx(g.cheekY + 1, 1.3), g.cheekY + 1], [tx(g.cheekY + 5, -1.2 - g.hollow * 1.8), g.cheekY + 5], [P(sf * g.Wj * 0.62, 0.62 * R) + 0.5, g.gonY + 1.5], [P(0, 0.9 * R) + 3, g.C - 1.4], [P(0, 0.9 * R) - 2, g.C + 1]];
  x.fillStyle = S.sh; x.beginPath(); ART_spline(x, ts, false); x.lineTo(100, g.C + 4); x.lineTo(100, g.T - 4); x.closePath(); x.fill();
  // reflected light just inside the shadow edge of the cheek, then the warm flush
  x.fillStyle = ART_a(S.base, 0.35); x.beginPath(); x.ellipse(P(sf * g.Wk * 0.92, 0.3 * R) + 0.2, g.cheekY + 3, 1.6, 5.5, 0.1, 0, 7); x.fill();
  x.fillStyle = S.warm; x.beginPath(); x.ellipse(P(-0.55 * R, 0.7 * R), g.cheekY + 2.2, 4.2, 2.6, 0, 0, 7); x.ellipse(P(0.55 * R, 0.7 * R), g.cheekY + 2.2, 3.6, 2.4, 0, 0, 7); x.ellipse(P(0, 1.1 * R + g.noseP), g.noseY - 1.2, 1.8, 1.4, 0, 0, 7); x.fill();
  // light planes: forehead, near cheekbone, chin ball
  x.fillStyle = S.lt; x.beginPath(); x.moveTo(P(-0.75 * R, 0.6 * R), g.browY - 1.2); x.quadraticCurveTo(P(-0.6 * R, 0.8 * R), g.T + 4, P(0.15 * R, 0.98 * R), g.T + 6); x.quadraticCurveTo(P(0.05 * R, 0.98 * R), g.browY - 3.5, P(-0.75 * R, 0.6 * R), g.browY - 1.2); x.fill();
  x.beginPath(); x.moveTo(P(-0.85 * R, 0.4 * R), g.cheekY - 0.6); x.quadraticCurveTo(P(-0.5 * R, 0.8 * R), g.cheekY - 2.2, P(-0.25 * R, 0.92 * R), g.cheekY + 0.4); x.quadraticCurveTo(P(-0.55 * R, 0.78 * R), g.cheekY + 1.6, P(-0.85 * R, 0.4 * R), g.cheekY - 0.6); x.fill();
  x.beginPath(); x.ellipse(P(-0.12 * R, 0.9 * R), g.C - 2.6, 2.4, 1.3, 0, 0, 7); x.fill();
  // under-cheekbone hollow and the jaw's underside
  x.fillStyle = ART_a(S.sh, 0.4 + g.hollow * 0.3); x.beginPath(); x.ellipse(P(-0.72 * R, 0.55 * R), g.cheekY + 5.5, 1.5, 3.6, 0.35, 0, 7); x.fill();
  x.fillStyle = ART_a(S.sh2, 0.55); x.beginPath(); ART_spline(x, hp.slice(0, 5), false); ART_spline(x, hp.slice(0, 5).map(p => [p[0] - 0.5, p[1] - 1.6]).reverse(), false, false); x.fill();
  // eye sockets
  for (const s of [-1, 1]) { const X = s * g.eyeSep, ex0 = P(X, g.Z(X, 0.8 * R)), w = g.eyeW * g.k(X);   // the brow ridge overhangs the socket; the inner corner by the bridge is deepest
    x.fillStyle = ART_a(S.sh, s === 1 ? 0.8 : 0.55); x.beginPath(); x.ellipse(ex0 - s * w * 0.25, g.eyeY - 0.9, w * 1.4, 2.7, 0, 0, 7); x.fill();
    x.fillStyle = ART_a(S.sh2, 0.35); x.beginPath(); x.ellipse(ex0 - s * w * 1.05, g.eyeY - 0.6, 1.3, 2.2, s * 0.3, 0, 7); x.fill();
    if (s < 0) { x.fillStyle = ART_a(S.lt, 0.8); x.beginPath(); x.ellipse(ex0 + w * 0.1, g.browY - 1.6, w * 1.2, 0.9, -0.08, 0, 7); x.fill(); } }
  if (g.age || lk.hc === 8 || lk.hc === 9) { x.strokeStyle = ART_a(S.sh2, 0.4); x.lineWidth = 0.45; x.beginPath(); for (let i = 0; i < 3; i++) { const yy = g.browY - 3.5 - i * 1.7; x.moveTo(P(-0.4 * R, 0.9 * R), yy + 0.3); x.quadraticCurveTo(P(0, R), yy - 0.4, P(0.4 * R, 0.9 * R), yy + 0.3); } x.stroke(); }
  x.restore();
  x.strokeStyle = S.ink; x.lineWidth = 0.7; head(); x.stroke();
  // nose: shadow side plane, underside, nostrils, the cast shadow and a crease around each wing
  { const bt = P(0, R * 0.98), by = g.browY + 1.4, tipX = P(0, R + g.noseP), tY = g.noseY - 1.1, nW = g.noseW, aL = P(-nW, 0.93 * R + 0.8), aR = P(nW, 0.93 * R + 0.8), aY = g.noseY - 0.5, base = P(0, R + g.noseP * 0.5), sideR = sf > 0;
    x.fillStyle = ART_a(S.sh, sideR ? 0.9 : 0.75); x.beginPath(); x.moveTo(bt + 0.9, by + 0.5); x.quadraticCurveTo(tipX + 1.4 + g.hook, (by + tY) / 2, tipX + nW * 0.55, tY + 0.2); x.lineTo(aR + 0.3, aY + 0.4); x.quadraticCurveTo(tipX + 0.4, aY - 1.8, tipX - 0.2, (by + tY) / 2 + 2); x.quadraticCurveTo(bt + 0.4, by + 3, bt + 0.9, by + 0.5); x.fill();
    x.fillStyle = S.sh2; x.beginPath(); x.moveTo(aL - 0.4, aY + 0.4); x.quadraticCurveTo(base, g.noseY + 1.4, aR + 0.4, aY + 0.4); x.quadraticCurveTo(tipX + 0.6, tY + 1.6, tipX, tY + 1.1); x.quadraticCurveTo(tipX - 0.6, tY + 1.6, aL - 0.4, aY + 0.4); x.fill();
    x.fillStyle = ART_a(S.ink, 0.85); x.beginPath(); x.ellipse((aL + base) / 2 + 0.2, g.noseY + 0.1, 0.95 * g.k(-nW), 0.45, 0.2, 0, 7); x.ellipse((aR + base) / 2 - 0.1, g.noseY + 0.1, 0.85 * g.k(nW), 0.42, -0.2, 0, 7); x.fill();
    x.fillStyle = ART_a(S.sh, 0.6); x.beginPath(); x.moveTo(base - 1.5, g.noseY + 0.8); x.quadraticCurveTo(base + 3.5, g.noseY + 1.4, aR + 2.6, aY - 0.6); x.quadraticCurveTo(aR + 1.6, g.noseY + 2.6, base - 1.5, g.noseY + 0.8); x.fill();
    x.strokeStyle = ART_a(S.ink, 0.75); x.lineWidth = 0.55; x.beginPath(); x.moveTo(aL + 0.6, aY - 1.7); x.quadraticCurveTo(aL - 1.1, aY - 0.6, aL - 0.1, aY + 0.6); x.moveTo(aR - 0.6, aY - 1.7); x.quadraticCurveTo(aR + 1.1, aY - 0.6, aR + 0.1, aY + 0.6); x.stroke();
    if (sideR) { x.strokeStyle = ART_a(S.ink, 0.6); x.lineWidth = 0.55; x.beginPath(); x.moveTo(bt + 1, by + 2.5); x.quadraticCurveTo(tipX + 1.3 + g.hook, (by + tY) / 2 + 1, tipX + nW * 0.5, tY + 0.1); x.stroke(); }
    else { x.strokeStyle = ART_a(S.sh2, 0.55); x.lineWidth = 0.5; x.beginPath(); x.moveTo(bt - 1, by + 2.5); x.quadraticCurveTo(tipX - 1.3, (by + tY) / 2 + 1, tipX - nW * 0.5, tY + 0.2); x.stroke(); }
    x.fillStyle = S.hi; x.beginPath(); x.ellipse(tipX - 0.5, tY - 0.5, 0.9, 0.6, 0, 0, 7); x.fill(); x.strokeStyle = ART_a(S.lt, 0.9); x.lineWidth = 0.6; x.beginPath(); x.moveTo(bt - 0.4, by + 1.5); x.quadraticCurveTo(tipX - 0.6, (by + tY) / 2, tipX - 0.7, tY - 1.4); x.stroke();
    if (o.gear && lk.ns) { x.fillStyle = '#ece7dc'; x.beginPath(); x.moveTo(P(-nW - 1.8, 0.85 * R), g.eyeY + 3.4); x.quadraticCurveTo(tipX, g.eyeY + 2.6, P(nW + 1.8, 0.85 * R), g.eyeY + 3.4); x.lineTo(P(nW + 1.8, 0.85 * R), g.eyeY + 5.2); x.quadraticCurveTo(tipX, g.eyeY + 4.4, P(-nW - 1.8, 0.85 * R), g.eyeY + 5.2); x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(tipX, g.eyeY + 2.8, 4, 2.6); } }
  BUST_beard(x, lk, hc, o.sk, g);
  // mouth: shadowed upper lip, parting line, lit lower lip with the shadow under it
  { const mY = g.mouthY, cL = P(-g.mouthW, 0.8 * R), cR = P(g.mouthW, 0.8 * R), cM = P(0, 0.99 * R), lf = g.lipF * (mo === 2 ? 0.75 : 1);
    const up = mo === 1 ? -0.7 : mo === 2 ? 0.35 : mo === 4 ? -0.9 : 0, upL = mo === 3 ? (sf > 0 ? 0.2 : -1.0) : up, upR = mo === 3 ? (sf > 0 ? -1.0 : 0.2) : up;
    const part = () => { x.moveTo(cL, mY + upL); x.bezierCurveTo((cL + cM) / 2, mY + 0.25 + upL * 0.3, cM - 1, mY + 0.35, cM, mY + 0.3); x.bezierCurveTo(cM + 1, mY + 0.35, (cR + cM) / 2, mY + 0.25 + upR * 0.3, cR, mY + upR); };
    x.fillStyle = ART_a(S.sh, 0.7); x.beginPath(); x.ellipse(cM + 0.4, mY + 2.8 * lf + 1.2, 3.2 * g.k(0), 1.2, 0, 0, 7); x.fill();
    x.fillStyle = S.lip; x.beginPath(); part(); x.bezierCurveTo((cR + cM) / 2 + 0.5, mY + 2.1 * lf, cM + 1.5, mY + 2.4 * lf, cM, mY + 2.4 * lf); x.bezierCurveTo(cM - 1.5, mY + 2.4 * lf, (cL + cM) / 2 - 0.5, mY + 2.1 * lf, cL, mY + upL); x.fill();
    x.fillStyle = ART_a(S.hi, 0.45); x.beginPath(); x.ellipse(cM - 1.2, mY + 1.3 * lf, 1.4, 0.45, 0, 0, 7); x.fill();
    if (mo === 4) { x.fillStyle = '#3a1512'; x.beginPath(); part(); x.bezierCurveTo((cR + cM) / 2, mY + 1.6, cM + 1, mY + 1.9, cM, mY + 1.9); x.bezierCurveTo(cM - 1, mY + 1.9, (cL + cM) / 2, mY + 1.6, cL, mY + upL); x.fill();
      x.save(); x.clip(); x.fillStyle = '#ece5d8'; x.fillRect(cL, mY - 1, cR - cL, 1.8); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(cM + 1.5, mY - 1, cR - cM, 2); x.restore(); }
    x.fillStyle = S.lipD; x.beginPath(); part(); x.bezierCurveTo((cR + cM) / 2 + 0.3, mY - 0.9 * lf + upR * 0.4, cM + 1.3, mY - 1.25 * lf, cM + 0.2, mY - 0.95 * lf); x.quadraticCurveTo(cM - 0.2, mY - 0.85 * lf, cM - 1.3, mY - 1.25 * lf); x.bezierCurveTo((cL + cM) / 2 - 0.3, mY - 0.9 * lf + upL * 0.4, cL + 0.4, mY + upL - 0.2, cL, mY + upL); x.fill();
    x.strokeStyle = S.ink; x.lineWidth = 0.7; x.beginPath(); part(); x.stroke();
    x.fillStyle = S.ink; x.beginPath(); x.arc(cL + 0.2, mY + upL, 0.4, 0, 7); x.arc(cR - 0.2, mY + upR, 0.4, 0, 7); x.fill();
    const fold = mo === 1 || mo === 4 ? 0.55 : g.age ? 0.45 : 0.22; x.strokeStyle = ART_a(S.sh2, fold); x.lineWidth = 0.5; x.beginPath(); x.moveTo(P(-g.noseW - 1.2, 0.9 * R), g.noseY - 0.4); x.quadraticCurveTo(P(-g.mouthW - 2.2, 0.8 * R), mY - 1.5, P(-g.mouthW - 1.4, 0.78 * R), mY + 2); x.moveTo(P(g.noseW + 1.2, 0.9 * R), g.noseY - 0.4); x.quadraticCurveTo(P(g.mouthW + 2.2, 0.8 * R), mY - 1.5, P(g.mouthW + 1.4, 0.78 * R), mY + 2); x.stroke();
    if (g.cleft && !lk.bd) { x.strokeStyle = ART_a(S.sh2, 0.45); x.lineWidth = 0.5; x.beginPath(); x.moveTo(P(0.2, 0.9 * R), g.C - 3.6); x.lineTo(P(0.2, 0.9 * R), g.C - 1.6); x.stroke(); } }
  BUST_stache(x, lk, hc, g);
  // eyes and brows
  const bc = hs === 0 || lum(hc) > 0.5 ? ART_mix(hc, '#2a1c14', hs === 0 ? 0.75 : 0.45) : ART_mix(hc, '#000000', 0.15);
  for (const s of [-1, 1]) { const X = s * g.eyeSep, ex0 = P(X, g.Z(X, 0.8 * R)), k = g.k(X), far = s === sf, w = g.eyeW, h = g.eyeH * (ex === 1 ? 0.78 : ex === 3 ? 0.84 : ex === 2 && far ? 0.86 : 1), ey = g.eyeY;
    const lift = ex === 1 ? [1.0, 0.1] : ex === 3 ? [-0.5, -0.5] : ex === 2 && far ? [-0.4, -1.0] : [0, 0], bw = [1.15, 0.85, 1.5][lk.bw | 0] || 1.15;   // brow: tapered from the inner end over the arch
    const B = [[0.13, g.browY + 0.7 + lift[0], 1.45 * bw], [0.3, g.browY - 0.25 - g.browA * 0.4 + lift[0] * 0.5, 1.35 * bw], [0.48, g.browY - g.browA + lift[1], 1.0 * bw], [0.66, g.browY + 0.6 + lift[1] * 0.6, 0.3]].map(([u, yy, t]) => [P(s * u * R, g.Z(s * u * R, 0.9 * R)), yy, t]);
    x.fillStyle = bc; x.beginPath(); ART_spline(x, B.map(b => [b[0], b[1] - b[2] / 2]), false); ART_spline(x, B.map(b => [b[0], b[1] + b[2] / 2]).reverse(), false, false); x.closePath(); x.fill();
    x.strokeStyle = ART_a(bc, 0.8); x.lineWidth = 0.35; x.beginPath(); for (let i = 0; i < 4; i++) { const xx = B[0][0] + (B[1][0] - B[0][0]) * (i / 4); x.moveTo(xx, B[0][1] + 0.7 - i * 0.3); x.lineTo(xx + s * 1.1, B[0][1] - 0.7 - i * 0.35); } x.stroke();
    x.save(); x.translate(ex0, ey + (far ? 0.1 : 0)); x.scale(k * s, 1);   // local eye space: +u points outward
    const tl = g.tilt, lidTop = () => { x.moveTo(-w, 0.15); x.bezierCurveTo(-w * 0.55, -h * 1.45, w * 0.45, -h * 1.5 + tl * 0.4, w, -tl * 0.5); }, lidBot = () => { x.bezierCurveTo(w * 0.5, h * (ex === 3 ? 0.6 : 0.95), -w * 0.45, h * 0.95, -w, 0.15); };
    x.fillStyle = ART_mix('#eee7dc', o.sk, 0.18); x.beginPath(); lidTop(); lidBot(); x.fill();
    const ix = -s * g.gaze - s * sn * 0.6; x.save(); x.clip(); x.fillStyle = EYEC[lk.ec] || '#3b2416'; x.beginPath(); x.arc(ix, -0.15, 1.55, 0, 7); x.fill(); x.fillStyle = '#0b0807'; x.beginPath(); x.arc(ix, -0.15, 0.72, 0, 7); x.fill();
    x.fillStyle = ART_a(S.sh2, 0.55); x.fillRect(-w - 1, -h * 2, w * 2 + 2, h * 1.25 + (ex === 1 ? 0.5 : 0)); x.restore();
    x.strokeStyle = S.ink; x.lineWidth = 0.95; x.lineCap = 'round'; x.beginPath(); lidTop(); x.lineTo(w + 0.7, -tl * 0.5 - 0.5); x.stroke();
    x.strokeStyle = ART_a(S.sh2, 0.7); x.lineWidth = 0.45; x.beginPath(); x.moveTo(w * 0.85, 0.2); x.bezierCurveTo(w * 0.5, h * (ex === 3 ? 0.65 : 1.0), -w * 0.3, h * 1.0, -w * 0.6, h * 0.55); x.stroke();
    x.beginPath(); x.moveTo(-w * 0.7, -h * 1.45 - 0.6); x.bezierCurveTo(-w * 0.3, -h * 2.0 - 0.6, w * 0.4, -h * 2.0 - 0.4, w * 0.95, -h * 0.9 - 0.3); x.stroke();
    if (ex === 3 || g.age) { x.beginPath(); x.moveTo(w + 0.8, 0.3); x.lineTo(w + 2, -0.3); x.moveTo(w + 0.8, 0.9); x.lineTo(w + 2, 1.3); x.stroke(); }
    x.restore();
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(ex0 + ix * k * s - 0.55, ey - 0.75, 0.32, 0, 7); x.fill();
    if (lk.sc === 1 && !far) { x.strokeStyle = ART_a(S.hi, 0.9); x.lineWidth = 0.7; x.beginPath(); x.moveTo(B[1][0] - 0.4, B[1][1] - 1.4); x.lineTo(B[1][0] + 0.6, B[1][1] + 1.4); x.stroke(); } }
  // eye black: 1 grease smudge, 2 strip, 3 strip with streaks down the cheeks
  if (o.gear && lk.ey && lk.eb) for (const s of [-1, 1]) {   // on the cheekbone under each eye, bending with the face
    const X = s * g.eyeSep * 1.08, ex0 = P(X, g.Z(X, 0.8 * R)), k = g.k(X), y = g.eyeY + 3.9, w = 3.3 * k, h = lk.eb === 1 ? 2.1 : 1.7; x.fillStyle = '#16161a';
    const patch = (ww, hh, a) => { x.globalAlpha = a; x.beginPath(); x.moveTo(ex0 - ww, y - hh * 0.4 - s * 0.2); x.quadraticCurveTo(ex0, y - hh * 0.75, ex0 + ww, y - hh * 0.4 + s * 0.2); x.quadraticCurveTo(ex0 + ww * 1.05, y + hh * 0.5, ex0 + ww * 0.8, y + hh * 0.6); x.quadraticCurveTo(ex0, y + hh * 0.85, ex0 - ww * 0.8, y + hh * 0.6); x.quadraticCurveTo(ex0 - ww * 1.05, y + hh * 0.5, ex0 - ww, y - hh * 0.4 - s * 0.2); x.fill(); };
    if (lk.eb === 1) { patch(w * 1.12, h * 1.2, 0.35); patch(w, h, 0.75); }
    else { patch(w, h, 0.95); if (lk.eb === 3) { x.strokeStyle = '#16161a'; x.lineWidth = 0.65; x.lineCap = 'round'; x.beginPath(); x.moveTo(ex0 - 1.4 * k, y + 0.8); x.lineTo(ex0 - 1.6 * k, y + 5.4); x.moveTo(ex0 + 1.2 * k, y + 0.8); x.lineTo(ex0 + 1.1 * k, y + 3.8); x.stroke(); }
      x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.ellipse(ex0 - w * 0.25, y - h * 0.3, w * 0.5, 0.3, 0, 0, 7); x.fill(); }
    x.globalAlpha = 1; }
  if (lk.fr) { x.fillStyle = ART_a(S.sh2, 0.4); for (let i = 0; i < 18; i++) { const s = i % 2 ? 1 : -1, u = 0.2 + r() * 0.45; x.beginPath(); x.arc(P(s * u * R, g.Z(s * u * R, R)), g.eyeY + 2.6 + r() * 3.6, 0.38, 0, 7); x.fill(); } }
  if (lk.sc === 2) { x.strokeStyle = ART_a(S.hi, 0.8); x.lineWidth = 0.6; x.beginPath(); x.moveTo(P(0.5 * R, 0.75 * R), g.cheekY + 1.5); x.lineTo(P(0.62 * R, 0.68 * R), g.cheekY + 5); x.stroke(); }
  // cool rim light down the shadow side of the face (under the hair)
  x.save(); head(); x.clip(); x.beginPath(); x.rect(hx + R * 0.55, g.browY - 6, 40, g.gonY - g.browY + 8); x.clip(); x.strokeStyle = ART_a(S.rim, 0.7); x.lineWidth = 1.3; head(); x.stroke(); x.restore();
  BUST_hair(x, lk, hc, o.c2, 0, 0, g);
  if (o.gear && lk.hb && hs !== 10 && hs !== 0) BUST_band(x, g, o.c2, g.T + g.H * g.hl - 0.6);
}
// jersey over shoulder pads, the arms under the sleeves (bare, tattooed or in a compression sleeve, matching the 3D player); the collar is drawn after the neck
function BUST_torso(x, p, lk, c1, c2, sk, big) {
  const bt = lk.bt == null ? 1 : lk.bt, sw = 33 + big * 5 + bt * 1.2, S = BUST_skin(sk), ink = ART_mix(c1, '#05070c', 0.72), aw = 10 + bt * 1.6 + big * 1.4, sleeve = ['#17181b', '#eeece6', c1, c2][lk.ac | 0] || '#17181b', tink = ART_mix(sk, '#141a26', S.L > 0.45 ? 0.6 : 0.4);
  const lt = ART_mix(c1, '#ffffff', lum(c1) > 0.7 ? 0.08 : 0.16), dd = ART_mix(c1, '#05060c', 0.6), vw = 7.2 + big * 1.2;
  for (const s of [-1, 1]) {   // s > 0: viewer's right = the player's left arm
    const item = s > 0 ? (lk.aL | 0) : (lk.aR | 0), col = item === 1 ? sleeve : S.base, xo = 48 + s * (sw + 1);
    const arm = () => { x.beginPath(); x.moveTo(xo - s * aw * 0.6, 76); x.quadraticCurveTo(xo + s * aw * 0.95, 80, xo + s * aw * 0.7, 100); x.lineTo(xo - s * aw * 0.6, 100); x.closePath(); };
    x.fillStyle = col; arm(); x.fill(); x.save(); arm(); x.clip(); x.fillStyle = item === 1 ? ART_mix(col, '#000000', 0.4) : S.sh; x.fillRect(s > 0 ? xo - 2 : xo - 22, 70, 20, 40); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(xo - 20, 70, 40, 9);
    if (lk.tat && (lk.ta & (s > 0 ? 1 : 2)) && item !== 1) { x.strokeStyle = x.fillStyle = tink; x.globalAlpha = 0.6; x.lineWidth = 0.9; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(xo - aw * 0.7, 87.5 + i * 3.4); x.quadraticCurveTo(xo + s * 1.5, 84.6 + i * 3.4, xo + aw * 0.8, 88.5 + i * 3.4); x.stroke(); } BUST_star(x, xo + s * 1.2, 95.5, 1.8); }
    x.restore(); x.strokeStyle = S.ink; x.lineWidth = 0.7; arm(); x.stroke();
  }
  const jp = () => { x.beginPath(); x.moveTo(48 - sw + 3, 100); x.lineTo(48 - sw + 3.4, 85); x.quadraticCurveTo(48 - sw - 4, 85.5, 48 - sw - 8, 82); x.bezierCurveTo(48 - sw - 9.5, 74, 48 - sw - 3, 67.5, 48 - sw + 7, 66); x.quadraticCurveTo(48 - vw - 6, 63.2, 48 - vw - 3, 63.6); x.lineTo(48, 78.5); x.lineTo(48 + vw + 3, 63.6); x.quadraticCurveTo(48 + vw + 6, 63.2, 48 + sw - 7, 66);
    x.bezierCurveTo(48 + sw + 3, 67.5, 48 + sw + 9.5, 74, 48 + sw + 8, 82); x.quadraticCurveTo(48 + sw + 4, 85.5, 48 + sw - 3.4, 85); x.lineTo(48 + sw - 3, 100); x.closePath(); };
  x.fillStyle = c1; jp(); x.fill();
  x.save(); jp(); x.clip();
  if (p.num != null && !p.nonum) { const ns = String(p.num), dark = lum(c1) > 0.62, nf = dark ? ART_mix(c1, '#0c0e16', 0.85) : c2, no = dark ? c2 : ART_mix(lum(c2) > 0.8 ? c1 : c2, '#06070c', 0.55);
    x.font = `700 ${ns.length > 1 ? 23 : 25}px ${CANVAS_FONT}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.lineWidth = 2.6; x.strokeStyle = no; x.strokeText(ns, 48, 100); x.fillStyle = nf; x.fillText(ns, 48, 100); }
  // pad caps with a lit top plane, the drape under them, the shadow side of the chest
  x.fillStyle = 'rgba(8,10,22,.34)'; x.beginPath(); x.moveTo(48 + 5, 100); x.quadraticCurveTo(48 + 9, 80, 48 + sw - 10, 74); x.lineTo(100, 70); x.lineTo(100, 100); x.closePath(); x.fill();
  for (const s of [-1, 1]) { const px = 48 + s * (sw - 6); x.fillStyle = s < 0 ? lt : ART_mix(c1, '#ffffff', 0.04); x.beginPath(); x.ellipse(px, 69.5, 10.5, 4.6, s * 0.22, Math.PI, Math.PI * 2); x.ellipse(px, 69.5, 10.5, 2.2, s * 0.22, 0, Math.PI); x.fill();
    x.strokeStyle = ART_a(dd, 0.55); x.lineWidth = 0.7; x.beginPath(); x.moveTo(px - s * 9.5, 73); x.quadraticCurveTo(px, 75.8, px + s * 10.5, 72.5); x.stroke();
    x.strokeStyle = ART_a(dd, 0.45); x.lineWidth = 0.6; x.beginPath(); x.moveTo(48 + s * (sw - 1.5), 84); x.quadraticCurveTo(48 + s * (sw - 6), 90, 48 + s * (sw - 5), 100); x.moveTo(48 + s * (sw - 13), 77); x.quadraticCurveTo(48 + s * (sw - 16), 82, 48 + s * (sw - 14.5), 86); x.stroke(); }
  x.strokeStyle = c2; x.lineWidth = 1.7; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(48 + s * (sw + 7.9), 77.6); x.quadraticCurveTo(48 + s * (sw + 2), 80.6, 48 + s * (sw - 3.6), 80.6); x.stroke(); }
  x.strokeStyle = ART_a(ink, 0.5); x.lineWidth = 0.5; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(48 + s * (sw + 8.2), 79.4); x.quadraticCurveTo(48 + s * (sw + 2), 82.4, 48 + s * (sw - 3.6), 82.4); x.stroke(); }
  x.restore();
  x.strokeStyle = ink; x.lineWidth = 0.9; jp(); x.stroke();
}
function BUST_collar(x, lk, c1, c2, big, line) {   // V-neck trim on the jersey's neckline; neck-roll pieces over the shoulders for linemen
  const ink = ART_mix(c1, '#05070c', 0.72), w = 7.2 + big * 1.2, top = 63.6, bot = 78.5;
  x.fillStyle = c2; x.beginPath(); x.moveTo(48 - w - 3, top); x.lineTo(48, bot); x.lineTo(48 + w + 3, top); x.lineTo(48 + w + 6.2, top + 0.2); x.lineTo(48, bot + 3.6); x.lineTo(48 - w - 6.2, top + 0.2); x.closePath(); x.fill();
  x.fillStyle = 'rgba(8,10,22,.3)'; x.beginPath(); x.moveTo(48, bot); x.lineTo(48 + w + 3, top); x.lineTo(48 + w + 6.2, top + 0.2); x.lineTo(48, bot + 3.6); x.closePath(); x.fill();
  x.strokeStyle = ink; x.lineWidth = 0.7; x.beginPath(); x.moveTo(48 - w - 3, top); x.lineTo(48, bot); x.lineTo(48 + w + 3, top); x.moveTo(48 - w - 6.2, top + 0.2); x.lineTo(48, bot + 3.6); x.lineTo(48 + w + 6.2, top + 0.2); x.stroke();
  if (line || lk.nr) { const rc = ['#2a2b30', c1, '#eceae4', c2][lk.nrc | 0] || '#2a2b30'; x.lineCap = 'round';
    for (const s of [-1, 1]) { const roll = () => { x.beginPath(); x.moveTo(48 + s * (w + 2.6), top + 0.2); x.bezierCurveTo(48 + s * (w + 1.8), top - 3.4, 48 + s * (w + 5.5), top - 5.2, 48 + s * (w + 9), top - 2.6); x.bezierCurveTo(48 + s * (w + 12.5), top - 0.6, 48 + s * (w + 12), top + 2.4, 48 + s * (w + 10.5), top + 3.4); x.quadraticCurveTo(48 + s * (w + 6), top + 1.2, 48 + s * (w + 2.6), top + 0.2); x.closePath(); };
      x.fillStyle = s > 0 ? ART_mix(rc, '#05060c', 0.35) : rc; roll(); x.fill(); x.save(); roll(); x.clip(); x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.ellipse(48 + s * (w + 5.5), top - 3.4, 3.6, 1.3, s * 0.3, 0, 7); x.fill();
      x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(48 + s * (w + 7), top + 2.4, 5, 1.4, s * 0.2, 0, 7); x.fill(); x.restore(); x.strokeStyle = ink; x.lineWidth = 0.7; roll(); x.stroke(); } }
}
// card background: a muted team-colour field, a soft light behind the head and a screen-print dot texture in the trim colour
const BUST_DOTS = {};
function BUST_dots(col) {
  let cv = BUST_DOTS[col]; if (cv) return cv; cv = document.createElement('canvas'); cv.width = cv.height = 192; const d = cv.getContext('2d'); d.fillStyle = col;
  for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) { const px = i * 5 + (j % 2) * 2.5, py = j * 5, t = Math.max(0, 1 - Math.hypot(192 - px, py * 1.2) / 150); if (t > 0.02) { d.beginPath(); d.arc(px, py, Math.min(2.3, t * 2.8), 0, 7); d.fill(); } }
  return BUST_DOTS[col] = cv;
}
function BUST_bg(x, c1, c2) {
  x.fillStyle = ART_mix(ART_sat(c1, 0.75), '#151820', lum(c1) > 0.6 ? 0.55 : 0.42); x.fillRect(0, 0, 96, 96);
  const gl = x.createRadialGradient(40, 34, 2, 44, 40, 58); gl.addColorStop(0, ART_a(ART_mix(c1, '#ffffff', 0.25), 0.55)); gl.addColorStop(1, ART_a(c1, 0)); x.fillStyle = gl; x.fillRect(0, 0, 96, 96);
  x.save(); x.globalAlpha = 0.2; x.drawImage(BUST_dots(c2), 0, 0, 96, 96); x.restore();
  x.fillStyle = ART_a(c2, 0.07); x.beginPath(); x.moveTo(62, 0); x.lineTo(78, 0); x.lineTo(30, 96); x.lineTo(14, 96); x.closePath(); x.fill();
  const vg = x.createLinearGradient(0, 50, 0, 96); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = vg; x.fillRect(0, 0, 96, 96);
}
// portraits are cached by look + colours + size: a roster paints 50+ of them on every render
const BUST_CACHE = new Map(); let BUST_CPX = 0;
function BUST_cached(x, key, draw) {
  const m = x.getTransform ? x.getTransform() : { a: 1, b: 0 }, sc = Math.max(0.25, Math.min(4, Math.hypot(m.a, m.b) || 1)), px = Math.round(96 * sc), k = key + '|' + px;
  let cv = BUST_CACHE.get(k);
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d'); c.setTransform(px / 96, 0, 0, px / 96, 0, 0); draw(c);
    BUST_CACHE.set(k, cv); BUST_CPX += px * px; while (BUST_CPX > 6e6 && BUST_CACHE.size > 1) { const [k0, c0] = BUST_CACHE.entries().next().value; BUST_CPX -= c0.width * c0.width; BUST_CACHE.delete(k0); } }
  else { BUST_CACHE.delete(k); BUST_CACHE.set(k, cv); }
  x.save(); x.clearRect(0, 0, 96, 96); x.drawImage(cv, 0, 0, 96, 96); x.restore();
}
function BUST_key(p, lk, a, b) { let s = ''; for (const k in lk) s += k + lk[k] + ','; return s + '|' + (p.num != null && !p.nonum ? p.num : '') + (p.nobg ? 'n' : '') + (p.headonly ? 'h' : '') + (p.coach ? 'c' : '') + (p.pos || '') + '|' + a + '|' + b; }
function drawBustSuit(x, p, T) {   // coaches and staff: suit and tie, a team quarter-zip, or a polo with the headset on
  const lk = ensureLook(p), c1 = T ? T.c1 : '#4a5878', c2 = T ? (lum(T.c2) < 0.12 && lum(T.c1) < 0.2 ? '#d9d9d9' : T.c2) : '#cfd6e6';
  BUST_cached(x, BUST_key(p, lk, c1, c2), x => {
    const sk = SKIN[lk.sk] || SKIN[0], hc = HAIRC[lk.hc] || HAIRC[0], g = BUST_geo(lk, 0), r = BUST_rng(lk, 91), kind = (r() * 3) | 0, ink = '#0d1018';
    g.age = r() < 0.6 ? 1 : 0;
    BUST_bg(x, c1, c2);
    BUST_backHair(x, lk, hc, g); BUST_neck(x, lk, sk, 0, false, g);
    const sw = 35, body = () => { x.beginPath(); x.moveTo(48 - sw - 8, 100); x.bezierCurveTo(48 - sw - 8, 76, 48 - sw - 3, 70, 48 - 12, 67); x.quadraticCurveTo(48, 64, 48 + 12, 67); x.bezierCurveTo(48 + sw + 3, 70, 48 + sw + 8, 76, 48 + sw + 8, 100); x.closePath(); };
    const cloth = kind === 0 ? '#23283a' : c1;
    x.fillStyle = cloth; body(); x.fill(); x.save(); body(); x.clip(); x.fillStyle = 'rgba(8,10,22,.38)'; x.beginPath(); x.moveTo(52, 100); x.quadraticCurveTo(56, 80, 70, 72); x.lineTo(100, 72); x.lineTo(100, 100); x.fill(); x.fillStyle = ART_a('#ffffff', 0.08); x.beginPath(); x.ellipse(28, 72, 14, 4, -0.15, Math.PI, 7); x.fill(); x.restore();
    if (kind === 0) {   // suit: shirt, tie in the team colour, lapels, pocket square
      x.fillStyle = '#f1f1ee'; x.beginPath(); x.moveTo(40, 66); x.lineTo(48, 90); x.lineTo(56, 66); x.lineTo(52, 64.5); x.lineTo(48, 70); x.lineTo(44, 64.5); x.closePath(); x.fill(); x.fillStyle = '#cfd2d6'; x.beginPath(); x.moveTo(48, 70); x.lineTo(56, 66); x.lineTo(50, 86); x.closePath(); x.fill();
      x.fillStyle = c1; x.beginPath(); x.moveTo(46.4, 70.6); x.lineTo(49.6, 70.6); x.lineTo(51, 89); x.lineTo(48, 93); x.lineTo(45, 89); x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.moveTo(48.2, 70.6); x.lineTo(49.6, 70.6); x.lineTo(51, 89); x.lineTo(48.2, 93); x.fill();
      x.fillStyle = ART_mix(c1, '#000000', 0.2); x.beginPath(); x.moveTo(46, 68.6); x.lineTo(50, 68.6); x.lineTo(49.6, 71.4); x.lineTo(46.4, 71.4); x.fill();
      x.fillStyle = '#1a1e2c'; x.beginPath(); x.moveTo(40, 66); x.lineTo(46, 86); x.lineTo(41, 80); x.lineTo(35.5, 82); x.closePath(); x.moveTo(56, 66); x.lineTo(50, 86); x.lineTo(55, 80); x.lineTo(60.5, 82); x.closePath(); x.fill();
      x.strokeStyle = ink; x.lineWidth = 0.6; x.stroke(); x.fillStyle = c2; x.beginPath(); x.moveTo(62, 83); x.lineTo(68, 82); x.lineTo(66.5, 85); x.closePath(); x.fill(); }
    else {   // quarter-zip or polo in the team colour
      x.fillStyle = 'rgba(8,10,22,.45)'; x.beginPath(); x.moveTo(38, 65); x.quadraticCurveTo(48, 70, 58, 65); x.lineTo(59, 61.5); x.quadraticCurveTo(48, 66, 37, 61.5); x.closePath(); x.fill();
      x.fillStyle = cloth; x.beginPath(); x.moveTo(37.5, 61.8); x.quadraticCurveTo(48, 66.4, 58.5, 61.8); x.lineTo(57, 66); x.quadraticCurveTo(48, 71, 39, 66); x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = 0.6; x.stroke();
      if (kind === 1) { x.strokeStyle = c2; x.lineWidth = 1.1; x.beginPath(); x.moveTo(48, 68.5); x.lineTo(48, 86); x.stroke(); x.fillStyle = '#d8d8d8'; x.fillRect(47.2, 74, 1.6, 2.6); }
      else { x.fillStyle = c2; x.beginPath(); x.moveTo(44, 66.5); x.lineTo(48, 74); x.lineTo(52, 66.5); x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = 0.5; x.stroke(); x.fillStyle = '#e8e6e0'; x.beginPath(); x.arc(48, 77, 0.6, 0, 7); x.arc(48, 80.5, 0.6, 0, 7); x.fill(); }
      x.fillStyle = c2; x.beginPath(); x.arc(30, 79, 3, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(30.5, 79.5, 1.5, 0, 7); x.fill(); }
    x.strokeStyle = ink; x.lineWidth = 0.9; body(); x.stroke();
    BUST_head(x, lk, { sk, hc, big: 0, c2, gear: false, g, noBack: true });
    if (kind === 2) {   // headset over the head with the boom mic
      const c = g.cr, nr = -g.sf, ex0 = g.P(nr * g.R * 0.95, -0.12 * g.R) + nr * 1.5, th = (BUST_HS[lk.hs] || {}).top || 0.5, ey = (g.browY + g.noseY) / 2 + 1, mx = g.P(nr * g.mouthW * 1.1, 0.9 * g.R);
      x.strokeStyle = '#1b1d22'; x.lineWidth = 1.9; x.beginPath(); x.ellipse(c.hx, c.yc - 1, c.A + th * 0.6 + 1.6, c.B + th + 1.4, 0, Math.PI * 1.02, Math.PI * 1.98); x.stroke(); x.strokeStyle = '#4a4e58'; x.lineWidth = 0.6; x.stroke();
      x.fillStyle = '#1b1d22'; x.beginPath(); x.ellipse(ex0, ey, 3.3, 4.6, 0, 0, 7); x.fill(); x.fillStyle = '#3a3e48'; x.beginPath(); x.ellipse(ex0 - 0.6, ey - 0.8, 1.8, 2.8, 0, 0, 7); x.fill();
      x.strokeStyle = '#1b1d22'; x.lineWidth = 1.1; x.lineCap = 'round'; x.beginPath(); x.moveTo(ex0 - nr, ey + 3); x.quadraticCurveTo(ex0 - nr * 3, g.mouthY + 2, mx, g.mouthY + 0.6); x.stroke(); x.fillStyle = '#1b1d22'; x.beginPath(); x.arc(mx, g.mouthY + 0.6, 1.2, 0, 7); x.fill(); }
  });
}
function drawBust(x, p, T) {
  if (p.photo && !p.coach && BUST_photo(x, p, T)) return;   // a photo from a roster file (86_roster.js)
  const lk = ensureLook(p); if (p.coach && !p.headonly) { drawBustSuit(x, p, T); return; }
  const K = T ? (T.kit || T) : null; const c1 = K ? (K.c1 || K.jersey) : '#4a5878', c2 = K ? (lum(K.c2 || K.trim) < 0.12 && lum(c1) < 0.2 ? '#d9d9d9' : (K.c2 || K.trim)) : '#cfd6e6';
  BUST_cached(x, BUST_key(p, lk, c1, c2), x => {
    const sk = SKIN[lk.sk] || SKIN[0], hc = HAIRC[lk.hc] || HAIRC[0], big = lk.bl === 2 ? 1 : lk.bl === 0 ? -1 : 0, gear = !p.coach, g = BUST_geo(lk, big), line = ['OT', 'OG', 'C', 'DT', 'DE'].includes(p.pos);
    if (!p.nobg) BUST_bg(x, c1, c2);
    BUST_backHair(x, lk, hc, g);
    BUST_neck(x, lk, sk, big, gear, g);
    if (!p.headonly) { BUST_torso(x, p, lk, c1, c2, sk, big); BUST_collar(x, lk, c1, c2, big, line); }
    BUST_head(x, lk, { sk, hc, big, c2, gear, g, noBack: true });
  });
}
const CANVAS_FONT = '"Teko","Barlow Condensed","Arial Narrow",Impact,sans-serif';
// ---------------- logos ----------------
// Designed marks in the team colours: every emblem is a flat silhouette (100 x 100 box) inked with a dark outline and a halo in the trim colour,
// with interior detail in the second colour. Constructions (t.logo): sh = container shape (circle, shield, diamond, hex, badge),
// st = 0 'Classic' emblem in the container, 1 'Modern' standalone mark, 2 'Bold' mark over a name banner; icon null = monogram / wordmark.
// polygon helpers: curves are flattened to points so every piece can be wound the same way (pieces union, holes cut)
function LG_path(cmds) {
  const pts = []; let px = 0, py = 0;
  for (const c of cmds) {
    if (typeof c[0] === 'number') { pts.push([c[0], c[1]]); px = c[0]; py = c[1]; continue; }
    if (c[0] === 'c') { for (let i = 1; i <= 14; i++) { const t = i / 14, u = 1 - t; pts.push([u * u * u * px + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * py + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]); } px = c[5]; py = c[6]; }
    else if (c[0] === 'q') { for (let i = 1; i <= 10; i++) { const t = i / 10, u = 1 - t; pts.push([u * u * px + 2 * u * t * c[1] + t * t * c[3], u * u * py + 2 * u * t * c[2] + t * t * c[4]]); } px = c[3]; py = c[4]; }
  }
  return pts;
}
function LG_taper(a, c, b, w0, w1, n = 12) {   // tapered stroke along a quadratic curve as a polygon
  const Lf = [], Rt = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, px = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], py = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], dx = u * (c[0] - a[0]) + t * (b[0] - c[0]), dy = u * (c[1] - a[1]) + t * (b[1] - c[1]), d = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
    Lf.push([px - dy / d * w, py + dx / d * w]); Rt.push([px + dy / d * w, py - dx / d * w]); }
  return Lf.concat(Rt.reverse());
}
function LG_cres(a, c, b, w, n = 16) {   // crescent: thickest in the middle, pointed at both ends
  const Lf = [], Rt = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, px = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], py = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], dx = u * (c[0] - a[0]) + t * (b[0] - c[0]), dy = u * (c[1] - a[1]) + t * (b[1] - c[1]), d = Math.hypot(dx, dy) || 1, ww = w * Math.sin(Math.PI * t) / 2;
    Lf.push([px - dy / d * ww, py + dx / d * ww]); Rt.push([px + dy / d * ww, py - dx / d * ww]); }
  return Lf.concat(Rt.reverse());
}
const LG_ell = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 32) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; };
const LG_star = (cx, cy, R, r, n = 5, rot = -Math.PI / 2) => { const p = []; for (let i = 0; i < n * 2; i++) { const q = i % 2 ? r : R, a = rot + i * Math.PI / n; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p; };
const LG_rot = (pts, ang, cx, cy, s = 1, tx = 0, ty = 0) => pts.map(([px, py]) => { const dx = px - cx, dy = py - cy; return [cx + tx + (dx * Math.cos(ang) - dy * Math.sin(ang)) * s, cy + ty + (dx * Math.sin(ang) + dy * Math.cos(ang)) * s]; });
const LG_mir = pts => pts.map(([px, py]) => [100 - px, py]).reverse();
function LG_add(x, pts, hole) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } const P = (a > 0) === !hole ? pts : pts.slice().reverse();
  x.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) x.lineTo(P[i][0], P[i][1]); x.closePath(); }
// ---- the emblems: pieces [points, hole?]
const LG_DEF = {
  bolt: () => [[LG_path([[63, 2], [19, 57], [44, 57], [32, 98], [83, 37], [57, 37], [73, 2]])]],
  flame: () => [[LG_path([[50, 2], ['c', 60, 20, 79, 30, 81, 55], ['c', 83, 79, 68, 97, 50, 97], ['c', 30, 97, 15, 81, 18, 60], ['c', 20, 46, 29, 38, 33, 25], ['c', 38, 35, 41, 41, 44, 45], ['c', 42, 30, 45, 15, 50, 2]])], [LG_path([[71, 18], ['c', 80, 28, 84, 38, 80, 50], ['c', 76, 44, 72, 40, 66, 38], ['c', 70, 32, 72, 26, 71, 18]])]],
  star: () => [[LG_star(50, 54, 48, 20.5)]],
  comet: () => [[LG_star(67, 33, 27, 11.5, 5, -Math.PI / 2 + 0.3)], [LG_taper([56, 47], [36, 62], [4, 90], 17, 0)], [LG_taper([62, 56], [50, 76], [26, 96], 10, 0)], [LG_taper([50, 36], [30, 40], [6, 60], 9, 0)]],
  anchor: () => { const arm = LG_ell(50, 52, 39, 36, 0.06 * Math.PI, 0.94 * Math.PI, 30).concat(LG_ell(50, 52, 29.5, 27, 0.94 * Math.PI, 0.06 * Math.PI, 30));
    return [[LG_ell(50, 13, 10, 10)], [LG_ell(50, 13, 4.2, 4.2), 1], [LG_path([[24, 23], [76, 23], [80, 27], [76, 31], [24, 31], [20, 27]])], [LG_path([[44.5, 18], [55.5, 18], [55.5, 86], [44.5, 86]])], [arm],
      [LG_path([[2, 64], [13, 40], [24, 60]])], [LG_path([[98, 64], [87, 40], [76, 60]])], [LG_path([[38, 84], [50, 96], [62, 84]])]]; },
  wave: () => [[LG_path([[2, 94], ['c', 4, 62, 22, 26, 58, 14], ['c', 78, 8, 97, 18, 97, 34], ['c', 97, 46, 87, 54, 77, 50], ['c', 69, 47, 67, 37, 75, 33], ['c', 64, 30, 55, 39, 57, 51], ['c', 59, 63, 74, 71, 91, 67], [98, 94]])]],
  mountain: () => [[LG_path([[2, 90], [33, 24], [45, 42], [62, 10], [98, 90]])]],
  crown: () => [[LG_path([[11, 88], [8, 32], [29, 54], [50, 16], [71, 54], [92, 32], [89, 88]])], [LG_ell(8, 29, 6.5, 6.5)], [LG_ell(50, 13, 7, 7)], [LG_ell(92, 29, 6.5, 6.5)]],
  wing: () => [[LG_path([[5, 34], ['c', 30, 16, 66, 12, 97, 25], [84, 34], [97, 41], [79, 49], [91, 57], [71, 63], [81, 73], [56, 75], ['c', 34, 75, 15, 60, 5, 34]])]],
  horns: () => [[LG_path([[22, 72], ['c', 20, 44, 33, 29, 50, 29], ['c', 67, 29, 80, 44, 78, 72]])], [LG_taper([30, 52], [5, 50], [8, 4], 16, 0)], [LG_taper([70, 52], [95, 50], [92, 4], 16, 0)], [LG_path([[18, 64], [82, 64], [84, 78], [16, 78]])], [LG_path([[44.5, 64], [55.5, 64], [53.5, 95], [46.5, 95]])]],
  claw: () => [0, 1, 2].map(i => [LG_cres([36 + i * 20, 3], [30 + i * 20 - 14, 46], [12 + i * 20, 97], 15)]),
  sun: () => { const rays = []; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 - Math.PI / 2, L = i % 2 ? 40 : 49, w = i % 2 ? 0.17 : 0.2; rays.push([[[50 + Math.cos(a - w) * 25, 50 + Math.sin(a - w) * 25], [50 + Math.cos(a) * L, 50 + Math.sin(a) * L], [50 + Math.cos(a + w) * 25, 50 + Math.sin(a + w) * 25]]]); } return [[LG_ell(50, 50, 27, 27)], ...rays]; },
  hoof: () => { const o = LG_ell(50, 47, 41, 45, Math.PI * 0.62, Math.PI * 2.38, 40), i = LG_ell(50, 47, 25, 29, Math.PI * 2.4, Math.PI * 0.6, 34); return [[[[30, 96], [10, 92], ...o.slice(1, -1), [90, 92], [70, 96], ...i]]]; },
  wolf: () => [[LG_path([[15, 97], ['c', 9, 77, 11, 58, 20, 44], [22, 34], ['c', 24, 22, 28, 12, 33, 1], [41, 16], ['c', 45, 22, 49, 25, 55, 25], ['c', 63, 25, 68, 28, 72, 32], [89, 41], ['c', 95, 43, 99, 47, 98, 52], [90, 55], ['c', 86, 57, 80, 59, 73, 60], [63, 62], [80, 65], ['c', 79, 71, 72, 75, 63, 75], [68, 81], [57, 80], [61, 87], [50, 86], [54, 95], [43, 92], [44, 99]])]],
  bear: () => [[LG_ell(24, 25, 13.5, 13.5)], [LG_ell(76, 25, 13.5, 13.5)], [LG_path([[50, 14], ['c', 75, 14, 92, 32, 91, 55], ['c', 90, 77, 72, 95, 50, 96], ['c', 28, 95, 10, 77, 9, 55], ['c', 8, 32, 25, 14, 50, 14]])]],
  cat: () => [[LG_path([[50, 24], [62, 25], [81, 5], [84, 36], ['c', 93, 46, 95, 60, 89, 70], [97, 76], [82, 79], ['c', 76, 87, 68, 91, 60, 93], [56, 100], [52, 91], [48, 91], [44, 100], [40, 93], ['c', 32, 91, 24, 87, 18, 79], [3, 76], [11, 70], ['c', 5, 60, 7, 46, 16, 36], [19, 5], [38, 25]])]],
  snake: () => [[LG_taper([10, 93], [56, 100], [64, 72], 3, 15)], [LG_taper([64, 72], [70, 50], [40, 52], 15, 15)], [LG_taper([40, 52], [14, 52], [34, 32], 15, 13)], [LG_taper([34, 32], [42, 23], [58, 23], 13, 11)],
    [LG_path([[52, 16], ['c', 58, 8, 76, 5, 88, 10], ['c', 96, 13, 100, 20, 97, 26], ['c', 92, 32, 80, 34, 66, 33], [52, 30]])]],
  gator: () => [[LG_path([[4, 74], ['c', 6, 54, 18, 42, 34, 37], ['c', 40, 27, 53, 24, 58, 32], ['c', 68, 33, 84, 36, 94, 42], ['c', 99, 45, 99, 51, 95, 53], [90, 53], [87, 57], [83, 53], [78, 57], [74, 53], [69, 57], [65, 53], [60, 56], [48, 58], [60, 61], [65, 65], [70, 61], [75, 65], [80, 61], [85, 65], [90, 63], ['c', 94, 65, 94, 71, 88, 73], ['c', 70, 78, 50, 82, 32, 88], [6, 90]])]],
  bird: () => [[LG_path([[19, 97], ['c', 11, 76, 13, 54, 23, 40], ['c', 32, 26, 48, 18, 62, 20], ['c', 72, 21, 80, 25, 86, 31], ['c', 96, 37, 100, 48, 94, 60], [89, 52], [85, 49], [72, 52], [80, 56], [70, 61], ['c', 60, 65, 53, 72, 51, 82], [57, 86], [47, 88], [53, 96], [41, 94], [42, 99]])]],
  horse: () => [[LG_path([[25, 97], ['c', 18, 78, 20, 56, 30, 40], [34, 26], [36, 4], [45, 21], ['c', 55, 21, 65, 28, 73, 38], ['c', 81, 50, 90, 59, 95, 67], ['c', 99, 74, 97, 83, 88, 83], [81, 81], [82, 87], [73, 87], ['c', 65, 86, 60, 78, 56, 70], ['c', 52, 64, 46, 64, 44, 70], ['c', 44, 80, 48, 89, 53, 97]])],
    [LG_path([[36, 22], [22, 28], [8, 34], [17, 42], [2, 52], [15, 58], [4, 72], [18, 74], [10, 90], [26, 84], [30, 60], [36, 40]])]],
  bull: () => [[LG_taper([33, 37], [5, 39], [7, 3], 15, 0)], [LG_taper([67, 37], [95, 39], [93, 3], 15, 0)], [LG_path([[25, 40], [5, 45], [23, 52]])], [LG_path([[75, 40], [95, 45], [77, 52]])],
    [LG_path([[50, 22], ['c', 64, 22, 74, 26, 76, 34], ['c', 80, 46, 76, 60, 68, 70], ['c', 66, 84, 60, 95, 50, 95], ['c', 40, 95, 34, 84, 32, 70], ['c', 24, 60, 20, 46, 24, 34], ['c', 26, 26, 36, 22, 50, 22]])]],
  kraken: () => [[LG_path([[50, 4], ['c', 72, 4, 84, 20, 82, 40], ['c', 80, 54, 70, 62, 60, 66], [40, 66], ['c', 30, 62, 20, 54, 18, 40], ['c', 16, 20, 28, 4, 50, 4]])],
    [LG_taper([26, 54], [0, 70], [12, 94], 15, 3)], [LG_taper([40, 60], [28, 84], [40, 99], 14, 3)], [LG_taper([60, 60], [72, 84], [60, 99], 14, 3)], [LG_taper([74, 54], [100, 70], [88, 94], 15, 3)], [LG_ell(14, 93, 4, 4)], [LG_ell(86, 93, 4, 4)]],
  swirl: () => [[LG_ell(50, 50, 19, 19)], [LG_ell(50, 50, 8, 8), 1], [LG_taper([33, 56], [24, 12], [86, 7], 20, 0)], [LG_taper([67, 44], [76, 88], [14, 93], 20, 0)]],
  rocket: () => { const T = p => LG_rot(p, 0.72, 50, 52, 0.9, 2, -2);
    return [[T(LG_path([[50, 2], ['c', 63, 13, 67, 30, 67, 46], [67, 72], [33, 72], [33, 46], ['c', 33, 30, 37, 13, 50, 2]]))], [T(LG_path([[34, 48], [16, 70], [16, 86], [34, 74]]))], [T(LG_path([[66, 48], [84, 70], [84, 86], [66, 74]]))], [T(LG_path([[40, 72], [60, 72], [56, 80], [44, 80]]))]]; },
  ghost: () => [[LG_path([[50, 3], ['c', 77, 3, 92, 24, 92, 50], [92, 95], [78, 83], [64, 97], [50, 85], [36, 97], [22, 83], [8, 95], [8, 50], ['c', 8, 24, 23, 3, 50, 3]])]],
  helmet: () => [[LG_path([[24, 72], ['c', 16, 46, 26, 22, 52, 18], ['c', 74, 16, 89, 30, 90, 50], [90, 64], [76, 64], [76, 72], [86, 74], [84, 90], ['c', 72, 96, 58, 96, 50, 92], [46, 80], ['c', 40, 76, 30, 75, 24, 72]])], [LG_taper([88, 24], [58, -12], [6, 36], 12, 8)]],
  anvil: () => [[LG_path([[6, 30], [70, 30], ['c', 82, 30, 93, 33, 98, 38], ['c', 88, 41, 79, 45, 75, 51], [71, 58], ['c', 67, 62, 65, 67, 67, 73], [79, 80], [79, 92], [21, 92], [21, 80], [33, 73], ['c', 35, 67, 33, 62, 29, 58], [25, 50], [6, 44]])]],
  axes: () => { const axe = s => { const h = LG_path([[-3.6, -40], [3.6, -40], [3.6, 44], [-3.6, 44]]), b = LG_path([[1, -46], ['c', 14, -54, 28, -54, 36, -44], ['c', 30, -35, 30, -22, 35, -11], ['c', 25, -7, 11, -10, 1, -18]]);
      const tr = p => p.map(([px, py]) => [-s * px, py]).map(([px, py]) => { const a = s * -0.62; return [50 + px * Math.cos(a) - py * Math.sin(a), 52 + px * Math.sin(a) + py * Math.cos(a)]; }); return [[tr(h)], [tr(b)]]; };
    return [...axe(1), ...axe(-1)]; },
  hat: () => [[LG_path([[13, 66], ['c', 5, 61, 1, 55, 5, 50], ['c', 15, 56, 28, 58, 34, 58], [36, 30], ['c', 38, 19, 45, 17, 50, 22], ['c', 55, 17, 62, 19, 64, 30], [66, 58], ['c', 72, 58, 85, 56, 95, 50], ['c', 99, 55, 95, 61, 87, 66], ['c', 74, 75, 26, 75, 13, 66]])]],
  tower: () => [[LG_path([[22, 96], [27, 34], [17, 34], [17, 12], [30, 12], [30, 21], [40, 21], [40, 12], [60, 12], [60, 21], [70, 21], [70, 12], [83, 12], [83, 34], [73, 34], [78, 96]])]],
  helm: () => { const sp = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8, c = Math.cos(a), s = Math.sin(a), w = 2.8, P = (r, o) => [50 + c * r - s * o, 50 + s * r + c * o]; sp.push([[P(8, -w), P(42, -w), P(42, w), P(8, w)]]); sp.push([LG_ell(50 + c * 44, 50 + s * 44, 5.5, 5.5, 0, Math.PI * 2, 16)]); }
    return [[LG_ell(50, 50, 33, 33)], [LG_ell(50, 50, 24, 24), 1], [LG_ell(50, 50, 11, 11)], ...sp]; },
};
const LG_CACHE = {};
const ICONS = {}; for (const k in LG_DEF) ICONS[k] = x => { for (const [p, h] of (LG_CACHE[k] = LG_CACHE[k] || LG_DEF[k]())) LG_add(x, p, h); };
// interior detail per emblem, on top of the fill. P: { f fill, s second colour, dk ink, wh white, sh shade of the fill }
const LG_fill = (x, col, ...pieces) => { x.fillStyle = col; x.beginPath(); for (const p of pieces) LG_add(x, p); x.fill(); };
const LG_line = (x, col, w, pts) => { x.strokeStyle = col; x.lineWidth = w; x.lineCap = x.lineJoin = 'round'; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); };
const LG_eye = (x, P, pts, pupil) => { LG_fill(x, P.wh, pts); if (pupil) { x.fillStyle = P.dk; x.beginPath(); x.arc(pupil[0], pupil[1], pupil[2], 0, 7); x.fill(); } LG_line(x, P.dk, 2.2, pts.concat([pts[0]])); };
const LOGO_DET = {
  bolt: (x, P) => LG_fill(x, P.s, [[60, 9], [28, 51], [35, 51], [65, 9]]),
  flame: (x, P) => { LG_fill(x, P.s, LG_path([[50, 40], ['c', 56, 52, 68, 58, 66, 74], ['c', 65, 86, 58, 92, 50, 92], ['c', 41, 92, 34, 85, 35, 75], ['c', 36, 66, 42, 62, 44, 54], ['c', 46, 60, 48, 62, 50, 62], ['c', 49, 54, 48, 46, 50, 40]])); LG_fill(x, P.wh, LG_ell(50, 80, 6, 9)); },
  star: (x, P) => { const s = LG_star(50, 54, 48, 20.5); for (let i = 0; i < 10; i += 2) LG_fill(x, P.sh, [[50, 54], s[i], s[(i + 1) % 10]]); },
  comet: (x, P) => { const s = LG_star(67, 33, 27, 11.5, 5, -Math.PI / 2 + 0.3); for (let i = 0; i < 10; i += 2) LG_fill(x, P.sh, [[67, 33], s[i], s[(i + 1) % 10]]); LG_fill(x, P.s, LG_taper([52, 50], [36, 64], [10, 86], 6, 0), LG_taper([48, 40], [32, 44], [12, 58], 3.5, 0)); },
  anchor: (x, P) => { LG_fill(x, P.s, [[47, 36], [49.5, 36], [49.5, 80], [47, 80]]); LG_line(x, P.dk, 1.6, [[24, 27], [76, 27]]); },
  wave: (x, P) => { LG_fill(x, P.s, LG_taper([12, 80], [22, 42], [60, 22], 6, 0), LG_taper([30, 86], [36, 60], [56, 46], 5, 0)); LG_fill(x, P.wh, LG_taper([62, 16], [86, 14], [94, 32], 5, 0)); },
  mountain: (x, P) => { LG_fill(x, P.sh, [[62, 10], [98, 90], [70, 90], [68, 46]], [[33, 24], [45, 42], [40, 54], [38, 90], [30, 90], [36, 50]]); LG_fill(x, P.wh, [[62, 10], [72, 30], [66, 27], [61, 34], [56, 26], [52, 30]], [[33, 24], [41, 37], [36, 35], [32, 40], [28, 33]]); },
  crown: (x, P) => { LG_fill(x, P.s, [[11, 70], [89, 70], [89, 88], [11, 88]]); for (const cx of [30, 50, 70]) { LG_fill(x, P.dk, LG_ell(cx, 79, 4, 4, 0, 7, 12)); } LG_fill(x, P.sh, [[50, 16], [71, 54], [50, 70]], [[92, 32], [89, 70], [80, 60]]); },
  wing: (x, P) => { for (const [a, b] of [[[30, 40], [84, 34]], [[34, 50], [79, 49]], [[38, 58], [71, 63]], [[40, 66], [60, 73]]]) LG_line(x, P.dk, 2, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2], b]); LG_fill(x, P.s, LG_taper([12, 36], [40, 22], [90, 26], 4, 1)); },
  horns: (x, P) => { LG_fill(x, P.wh, LG_taper([30, 52], [5, 50], [8, 4], 16, 0), LG_taper([70, 52], [95, 50], [92, 4], 16, 0)); LG_fill(x, P.s, [[18, 64], [82, 64], [84, 78], [16, 78]]); for (const cx of [26, 38, 62, 74]) LG_fill(x, P.dk, LG_ell(cx, 71, 2, 2, 0, 7, 10)); LG_fill(x, P.sh, LG_path([[50, 29], ['c', 67, 29, 80, 44, 78, 64], [56, 64]])); },
  claw: (x, P) => { for (let i = 0; i < 3; i++) LG_fill(x, P.s, LG_cres([35 + i * 20, 8], [28 + i * 20 - 14, 46], [15 + i * 20, 90], 4)); },
  sun: (x, P) => { LG_fill(x, P.s, LG_ell(50, 50, 18, 18)); LG_fill(x, P.f, LG_ell(50, 50, 11, 11)); },
  hoof: (x, P) => { for (let i = 0; i < 8; i++) { const a = Math.PI * (0.72 + i * 0.22), px = 50 + Math.cos(a) * 33, py = 47 + Math.sin(a) * 37; if (i === 3 || i === 4) continue; LG_fill(x, P.dk, LG_rot([[-1.3, -3], [1.3, -3], [1.3, 3], [-1.3, 3]].map(([u, v]) => [px + u, py + v]), a + Math.PI / 2, px, py)); } LG_fill(x, P.s, [[44, 2], [56, 2], [56, 7], [44, 7]]); },
  wolf: (x, P) => { LG_fill(x, P.sh, [[33, 6], [38, 18], [29, 23]]); LG_fill(x, P.s, [[38, 60], [62, 64], [56, 68], [63, 73], [50, 74], [55, 82], [42, 79], [35, 66]]); LG_eye(x, P, [[57, 38], [66, 33], [73, 36], [64, 40]], [66, 37, 1.6]);
    LG_line(x, P.dk, 2.6, [[52, 31], [64, 31], [74, 35]]); LG_line(x, P.dk, 2, [[64, 62], [76, 59], [90, 55]]); LG_line(x, P.dk, 1.8, [[24, 50], [34, 58], [30, 72]]); LG_fill(x, P.dk, LG_ell(95, 47, 3, 2.4, 0, 7, 12)); },
  bear: (x, P) => { LG_fill(x, P.sh, LG_ell(24, 26, 7, 7), LG_ell(76, 26, 7, 7)); LG_fill(x, P.s, LG_ell(50, 70, 20, 16)); LG_fill(x, P.dk, LG_path([[41, 58], ['q', 50, 54, 59, 58], ['q', 57, 66, 50, 67], ['q', 43, 66, 41, 58]]));
    LG_line(x, P.dk, 2.2, [[50, 66], [50, 74], [43, 78]]); LG_line(x, P.dk, 2.2, [[50, 74], [57, 78]]); LG_eye(x, P, [[30, 44], [42, 47], [40, 51], [31, 49]], [37, 48, 1.7]); LG_eye(x, P, [[70, 44], [58, 47], [60, 51], [69, 49]], [63, 48, 1.7]);
    LG_line(x, P.dk, 3.4, [[26, 38], [44, 45]]); LG_line(x, P.dk, 3.4, [[74, 38], [56, 45]]); },
  cat: (x, P) => { LG_fill(x, P.sh, [[22, 12], [35, 26], [24, 31]], [[78, 12], [65, 26], [76, 31]]); LG_fill(x, P.s, LG_ell(42, 70, 9, 7), LG_ell(58, 70, 9, 7)); LG_fill(x, P.wh, [[41, 80], [47, 80], [45, 99]], [[53, 80], [59, 80], [55, 99]]);
    LG_eye(x, P, [[27, 46], [42, 48], [40, 54], [30, 52]]); LG_eye(x, P, [[73, 46], [58, 48], [60, 54], [70, 52]]); LG_fill(x, P.dk, LG_ell(36, 50, 1.2, 3, 0, 7, 10), LG_ell(64, 50, 1.2, 3, 0, 7, 10), [[44, 58], [56, 58], [50, 65]]);
    for (const [a, b] of [[[50, 27], [50, 40]], [[42, 29], [45, 38]], [[58, 29], [55, 38]]]) LG_fill(x, P.dk, LG_taper(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, 3, 0)); LG_line(x, P.dk, 2, [[50, 65], [50, 70], [42, 75]]); LG_line(x, P.dk, 2, [[50, 70], [58, 75]]); },
  snake: (x, P) => { LG_fill(x, P.s, LG_taper([16, 92], [56, 96], [62, 72], 1, 5), LG_taper([62, 70], [66, 54], [42, 55], 5, 5)); LG_eye(x, P, [[74, 14], [82, 12], [84, 16], [76, 18]], [80, 15, 1.2]); LG_fill(x, P.wh, [[82, 30], [85, 41], [87, 30]], [[73, 32], [75, 40], [77, 32]]);
    for (const [cx, cy] of [[46, 82], [56, 64], [30, 44], [44, 26]]) LG_fill(x, P.sh, [[cx, cy - 4], [cx + 4, cy], [cx, cy + 4], [cx - 4, cy]]); LG_line(x, P.dk, 1.6, [[60, 26], [92, 22]]); },
  gator: (x, P) => { LG_fill(x, P.wh, [[90, 53], [87, 57], [83, 53], [78, 57], [74, 53], [69, 57], [65, 53], [60, 56]], [[60, 61], [65, 65], [70, 61], [75, 65], [80, 61], [85, 65]]); LG_eye(x, P, [[46, 30], [55, 29], [57, 33], [48, 34]], [52, 31.5, 1.4]);
    for (let i = 0; i < 5; i++) LG_line(x, P.dk, 1.8, [[22 + i * 8, 46 - (i > 2 ? 4 : 0)], [26 + i * 8, 44 - (i > 2 ? 4 : 0)]]); LG_fill(x, P.dk, LG_ell(92, 45, 1.8, 1.4, 0, 7, 10)); LG_fill(x, P.s, LG_taper([20, 84], [50, 76], [84, 70], 4, 1)); },
  bird: (x, P) => { LG_fill(x, P.s, [[72, 31], [86, 31], [96, 39], [99, 50], [94, 60], [89, 52], [85, 49], [72, 52], [68, 42]]); LG_eye(x, P, [[56, 37], [64, 34], [68, 37], [60, 40]], [63, 37, 1.5]); LG_fill(x, P.dk, LG_taper([48, 33], [60, 28], [76, 34], 5, 1));
    for (const [a, b] of [[[26, 60], [40, 74]], [[30, 76], [40, 86]], [[22, 82], [30, 92]]]) LG_line(x, P.dk, 1.8, [a, b]); LG_line(x, P.dk, 1.6, [[72, 52], [86, 50]]); },
  horse: (x, P) => { LG_fill(x, P.s, LG_path([[36, 22], [22, 28], [8, 34], [17, 42], [2, 52], [15, 58], [4, 72], [18, 74], [10, 90], [26, 84], [30, 60], [36, 40]])); LG_eye(x, P, [[56, 39], [64, 37], [67, 41], [58, 42]], [62, 39.5, 1.5]); LG_fill(x, P.dk, LG_taper([50, 35], [60, 31], [70, 37], 4, 1), LG_ell(89, 73, 2.6, 2, 0.4, 7, 12));
    LG_line(x, P.dk, 1.8, [[56, 70], [62, 60], [72, 52]]); LG_line(x, P.dk, 1.8, [[82, 81], [90, 80]]); LG_fill(x, P.wh, LG_taper([70, 42], [84, 56], [92, 70], 3, 1)); },
  bull: (x, P) => { LG_fill(x, P.wh, LG_taper([33, 37], [5, 39], [7, 3], 15, 0), LG_taper([67, 37], [95, 39], [93, 3], 15, 0)); LG_fill(x, P.s, LG_ell(50, 81, 14, 10)); LG_fill(x, P.dk, LG_ell(44, 81, 2.6, 3.4, 0, 7, 12), LG_ell(56, 81, 2.6, 3.4, 0, 7, 12));
    x.strokeStyle = P.wh; x.lineWidth = 2.4; x.beginPath(); x.arc(50, 89, 5.5, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); LG_eye(x, P, [[33, 46], [44, 50], [42, 53], [34, 51]], [39, 50.5, 1.6]); LG_eye(x, P, [[67, 46], [56, 50], [58, 53], [66, 51]], [61, 50.5, 1.6]);
    LG_fill(x, P.sh, [[38, 24], [44, 34], [50, 26], [56, 34], [62, 24]]); LG_line(x, P.dk, 3, [[30, 41], [45, 47]]); LG_line(x, P.dk, 3, [[70, 41], [55, 47]]); },
  kraken: (x, P) => { LG_eye(x, P, [[30, 38], [44, 42], [42, 48], [32, 46]], [38, 44, 2]); LG_eye(x, P, [[70, 38], [56, 42], [58, 48], [68, 46]], [62, 44, 2]); LG_line(x, P.dk, 3, [[28, 32], [46, 40]]); LG_line(x, P.dk, 3, [[72, 32], [54, 40]]);
    for (const [cx, cy] of [[14, 72], [16, 82], [34, 80], [38, 90], [66, 80], [62, 90], [86, 72], [84, 82]]) LG_fill(x, P.s, LG_ell(cx, cy, 2.2, 2.2, 0, 7, 10)); LG_fill(x, P.sh, LG_ell(40, 16, 5, 3), LG_ell(60, 14, 4, 2.6), LG_ell(52, 24, 3, 2)); },
  swirl: (x, P) => { LG_fill(x, P.s, LG_taper([38, 50], [32, 20], [76, 12], 5, 0), LG_taper([62, 50], [68, 80], [24, 88], 5, 0)); x.strokeStyle = P.s; x.lineWidth = 3; x.beginPath(); x.arc(50, 50, 13.5, 0, 7); x.stroke(); },
  rocket: (x, P) => { const T = p => LG_rot(p, 0.72, 50, 52, 0.9, 2, -2); LG_fill(x, P.s, T([[33, 52], [67, 52], [67, 60], [33, 60]]), T([[44, 80], [56, 80], [54, 92], [50, 100], [46, 92]])); LG_fill(x, P.wh, T(LG_ell(50, 34, 7, 7, 0, 7, 20)), T([[47, 82], [53, 82], [50, 94]]));
    LG_fill(x, P.f, T(LG_ell(50, 34, 4, 4, 0, 7, 16))); LG_fill(x, P.sh, T([[50, 2], [67, 46], [67, 72], [56, 72], [58, 40]])); },
  ghost: (x, P) => { LG_fill(x, P.dk, LG_path([[50, 22], ['c', 67, 22, 75, 35, 75, 52], ['c', 75, 68, 65, 79, 50, 81], ['c', 35, 79, 25, 68, 25, 52], ['c', 25, 35, 33, 22, 50, 22]])); LG_fill(x, P.s, [[33, 48], [46, 52], [44, 57], [35, 55]], [[67, 48], [54, 52], [56, 57], [65, 55]]);
    LG_line(x, P.sh, 2.2, [[16, 50], [20, 80]]); LG_line(x, P.sh, 2.2, [[84, 50], [80, 80]]); },
  helmet: (x, P) => { LG_fill(x, P.s, LG_taper([88, 24], [58, -12], [6, 36], 12, 8)); for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, u = 1 - t, px = u * u * 88 + 2 * u * t * 58 + t * t * 6, py = u * u * 24 + 2 * u * t * -12 + t * t * 36; LG_line(x, P.dk, 1.6, [[px, py - 3], [px - 1, py + 3]]); }
    LG_fill(x, P.dk, [[58, 44], [90, 44], [90, 52], [70, 52], [70, 70], [62, 70], [62, 52], [58, 52]]); LG_line(x, P.dk, 2, [[46, 80], [52, 64], [44, 40]]); LG_fill(x, P.sh, LG_path([[24, 72], ['c', 18, 54, 22, 38, 34, 28], [40, 70]])); },
  anvil: (x, P) => { LG_fill(x, P.sh, [[29, 58], [71, 58], [67, 73], [79, 80], [79, 92], [21, 92], [21, 80], [33, 73]]); LG_fill(x, P.s, [[8, 31], [70, 31], [70, 35], [8, 35]]); LG_fill(x, P.s, LG_taper([56, 26], [58, 14], [66, 4], 3, 0), LG_taper([46, 26], [42, 16], [32, 8], 3, 0), LG_taper([64, 27], [72, 20], [84, 16], 2.6, 0)); },
  axes: (x, P) => { for (const s of [1, -1]) { const a = s * -0.62, tr = ([px, py]) => [50 - s * px * Math.cos(a) - py * Math.sin(a), 52 - s * px * Math.sin(a) + py * Math.cos(a)]; LG_fill(x, P.wh, LG_path([[29, -51], ['c', 33, -50, 35, -47, 36, -44], ['c', 30, -35, 30, -22, 35, -11], ['c', 33, -10, 31, -11, 30, -12], ['c', 25, -24, 25, -38, 29, -51]]).map(tr));
      LG_fill(x, P.s, [[-3.6, 30], [3.6, 30], [3.6, 44], [-3.6, 44]].map(tr)); for (let k = 0; k < 3; k++) LG_line(x, P.sh, 1.2, [[-1, -30 + k * 18], [1, -20 + k * 18]].map(tr)); } },
  hat: (x, P) => { LG_fill(x, P.s, [[35, 50], [65, 50], [66, 58], [34, 58]]); LG_line(x, P.dk, 2, [[50, 24], [50, 44]]); LG_fill(x, P.sh, LG_path([[50, 22], ['c', 55, 17, 62, 19, 64, 30], [66, 50], [52, 50]])); },
  tower: (x, P) => { LG_fill(x, P.dk, LG_path([[42, 96], [42, 76], ['c', 42, 66, 58, 66, 58, 76], [58, 96]]), [[47, 44], [53, 44], [53, 56], [47, 56]]); LG_fill(x, P.sh, [[60, 34], [73, 34], [78, 96], [64, 96]]); for (let i = 0; i < 4; i++) LG_line(x, P.sh, 1.4, [[30, 42 + i * 13], [40, 42 + i * 13]]);
    LG_fill(x, P.s, [[17, 34], [83, 34], [83, 38], [17, 38]]); },
  helm: (x, P) => { x.strokeStyle = P.s; x.lineWidth = 3; x.beginPath(); x.arc(50, 50, 28.5, 0, 7); x.stroke(); LG_fill(x, P.s, LG_ell(50, 50, 6.5, 6.5, 0, 7, 20)); LG_fill(x, P.dk, LG_ell(50, 50, 2.8, 2.8, 0, 7, 12)); },
};
// which emblem a team gets: its nickname first; real-cities teams (no nickname) get their own pick; then the old icon; then the id
const ICON_MAP = { Thunder: 'bolt', Lumberjacks: 'axes', Outlaws: 'hat', Comets: 'comet', Stallions: 'horse', Grizzlies: 'bear', Admirals: 'anchor', Vipers: 'snake', Hurricanes: 'swirl', Rattlers: 'snake', Monarchs: 'crown', Sabercats: 'cat',
  Highlanders: 'mountain', Pioneers: 'hoof', Express: 'wing', Wolves: 'wolf', Mariners: 'helm', Rockets: 'rocket', Bison: 'bull', Phantoms: 'ghost', Cyclones: 'swirl', Marauders: 'horns', Condors: 'bird', Mustangs: 'horse',
  Ironmen: 'anvil', Blaze: 'flame', Krakens: 'kraken', Coyotes: 'wolf', Titans: 'helmet', Generals: 'star', Sentinels: 'tower', Gators: 'gator' };
const LOGO_REAL = { BUF: 'bull', MIA: 'sun', NE: 'star', NYJ: 'rocket', BAL: 'bird', CIN: 'cat', CLE: 'claw', PIT: 'anvil', HOU: 'comet', IND: 'hoof', JAX: 'gator', TEN: 'helmet', DEN: 'horse', KC: 'flame', LV: 'ghost', LAC: 'bolt',
  DAL: 'tower', NYG: 'mountain', PHI: 'wing', WAS: 'crown', CHI: 'bear', DET: 'wolf', GB: 'axes', MIN: 'horns', ATL: 'swirl', CAR: 'snake', NO: 'helm', TB: 'anchor', ARI: 'wave', LAR: 'bull', SF: 'hat', SEA: 'kraken' };
const LOGO_V = 3;
// v2 defaults, to tell a logo the user picked in the editor (kept as it is) from a generated one (redesigned)
const LOGO_V2 = { Thunder: 'bolt', Express: 'bolt', Rockets: 'bolt', Cyclones: 'bolt', Blaze: 'flame', Phantoms: 'flame', Comets: 'star', Generals: 'star', Sentinels: 'star', Admirals: 'anchor', Mariners: 'wave', Krakens: 'wave', Hurricanes: 'wave', Highlanders: 'mountain', Pioneers: 'mountain', Ironmen: 'mountain', Monarchs: 'crown', Titans: 'crown', Condors: 'wing', Vipers: 'claw', Rattlers: 'claw', Grizzlies: 'claw', Wolves: 'claw', Sabercats: 'claw', Coyotes: 'claw', Gators: 'claw', Bison: 'horns', Marauders: 'horns', Outlaws: 'sun', Lumberjacks: 'mountain', Stallions: 'hoof', Mustangs: 'hoof' };
function LOGO_v2custom(t, old) {
  if (!old || old.v !== 2) return false; const id = t.id | 0, rt = typeof REAL_TEAMS !== 'undefined' && REAL_TEAMS.find(d => d[0] === t.abbr && d[1] === t.city);
  const def = rt ? { sh: rt[9], icon: rt[8], st: id % 3 } : { sh: (id * 7 + String(t.name || '').length) % 5, icon: LOGO_V2[t.name] || ['bolt', 'flame', 'star', 'wave', 'mountain', 'crown', 'wing', 'horns', 'claw', 'sun', 'anchor', 'hoof'][id % 12], st: id % 3 };
  return old.sh !== def.sh || old.icon !== def.icon || old.st !== def.st;
}
function ensureLogo(t) {
  if (t.logo && t.logo.v === LOGO_V) return t.logo;
  if (LOGO_v2custom(t, t.logo)) { const o = t.logo; t.logo = { v: LOGO_V, sh: o.sh | 0, icon: o.icon && LG_DEF[o.icon] ? o.icon : null, st: o.st | 0 }; return t.logo; }
  const old = t.logo, real = !t.name || t.name === t.city, r = seededRng((((t.id | 0) + 1) * 2654435761 ^ String(t.name || '').length * 977 ^ String(t.city || '').charCodeAt(0) * 31) >>> 0), keys = Object.keys(LG_DEF);
  let icon = (!real && ICON_MAP[t.name]) || (real && LOGO_REAL[t.abbr]) || (old && LG_DEF[old.icon] && old.icon) || keys[(t.id | 0) % keys.length];
  const u = r(); let st = u < 0.4 ? 0 : u < 0.72 ? 1 : 2; if (r() < 0.12) icon = null;
  const sh = [0, 0, 0, 1, 1, 1, 4, 4, 3, 2][(r() * 10) | 0];
  t.logo = { v: LOGO_V, sh, icon, st }; return t.logo;
}
// container shapes in the 100 box; logoShape keeps its old signature (the path at size S) for uploaded pictures
function LOGO_shape(x, sh) {
  if (sh === 0) x.arc(50, 50, 47, 0, Math.PI * 2);
  else if (sh === 1) { x.moveTo(8, 7); x.quadraticCurveTo(29, 12, 50, 4); x.quadraticCurveTo(71, 12, 92, 7); x.lineTo(92, 46); x.bezierCurveTo(92, 72, 72, 88, 50, 97); x.bezierCurveTo(28, 88, 8, 72, 8, 46); x.closePath(); }
  else if (sh === 2) { x.moveTo(50, 2); x.lineTo(98, 50); x.lineTo(50, 98); x.lineTo(2, 50); x.closePath(); }
  else if (sh === 3) { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3, px = 50 + Math.cos(a) * 48, py = 50 + Math.sin(a) * 48; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); }
  else { const r = 15; x.moveTo(7 + r, 9); x.arcTo(93, 9, 93, 91, r); x.arcTo(93, 91, 7, 91, r); x.arcTo(7, 91, 7, 9, r); x.arcTo(7, 9, 93, 9, r); x.closePath(); }
}
function logoShape(x, sh, S) { x.beginPath(); x.save(); x.scale(S / 100, S / 100); LOGO_shape(x, sh); x.restore(); }
const LOGOIMG = {};
function logoImage(t) { if (!t.logoImg) return null; let im = LOGOIMG[t.id]; if (!im || im.src !== t.logoImg) { im = new Image(); im.onload = () => { if (typeof render === 'function' && typeof MATCH_OPEN === 'undefined') render(); }; im.src = t.logoImg; LOGOIMG[t.id] = im; } return im.complete && im.naturalWidth ? im : null; }
function LOGO_pal(t) {
  let c1 = t.c1 || '#335577', L1 = lum(c1); let c2 = t.c2 || '#ffffff'; if (L1 < 0.13) { c1 = ART_mix(c1, '#3a4252', 0.35); L1 = lum(c1); } if (Math.abs(lum(c2) - L1) < 0.14) c2 = L1 < 0.5 ? '#f3f0e6' : '#15171d';
  if (lum(c2) < 0.45 && L1 < 0.25) c2 = ART_mix(c2, '#ffffff', 0.35);   // near-black teams: lift the trim so the mark still reads on dark pages
  const dk = L1 < 0.18 ? '#07080c' : ART_mix(ART_sat(c1, 1.25), '#04050a', 0.8), wh = '#f6f3ea';
  return { c1, c2, dk, wh, halo: lum(c2) < 0.2 && L1 < 0.2 ? wh : c2 };
}
// an emblem as a finished mark: halo, ink outline, fill, detail
function LOGO_mark(x, name, P, f, s, halo, ink = 8) {
  const path = () => { x.beginPath(); ICONS[name](x); }; x.lineJoin = 'round'; x.lineCap = 'round';
  if (halo) { x.strokeStyle = halo; x.lineWidth = ink + 7; path(); x.stroke(); }
  x.strokeStyle = P.dk; x.lineWidth = ink; path(); x.stroke(); x.fillStyle = f; path(); x.fill();
  const d = LOGO_DET[name]; if (d) { x.save(); x.beginPath(); ICONS[name](x); x.clip(); d(x, { f, s, dk: P.dk, wh: P.wh, sh: ART_mix(f, '#000000', lum(f) < 0.2 ? 0 : 0.22) }); x.restore(); }
}
// layered athletic lettering: halo, ink, inline, fill; skewed like a jersey script
function LOGO_text(x, txt, cx, cy, size, P, f, inl, halo, maxW, skew = -0.2) {
  x.save(); x.font = `700 ${size}px ${CANVAS_FONT}`; let w = x.measureText(txt).width; const k = maxW && w > maxW ? maxW / w : 1;
  x.translate(cx, cy); x.transform(k, 0, skew, 1, 0, 0); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  if (halo) { x.strokeStyle = halo; x.lineWidth = size * 0.3; x.strokeText(txt, 0, 0); }
  x.strokeStyle = P.dk; x.lineWidth = size * 0.17; x.strokeText(txt, 0, 0); if (inl) { x.strokeStyle = inl; x.lineWidth = size * 0.06; x.strokeText(txt, 0, 0); } x.fillStyle = f; x.fillText(txt, 0, 0); x.restore();
}
function LOGO_arcText(x, txt, r, mid, size, col, inward) {   // letters around the roundel band
  x.save(); x.font = `700 ${size}px ${CANVAS_FONT}`; x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; const sp = size * 0.12, ws = [...txt].map(c => x.measureText(c).width + sp), tot = ws.reduce((a, b) => a + b, 0) - sp;
  let a = mid - (inward ? -1 : 1) * tot / r / 2; for (let i = 0; i < ws.length; i++) { const da = ws[i] / r, ac = a + (inward ? -1 : 1) * (da - sp / r) / 2; x.save(); x.translate(50 + Math.cos(ac) * r, 50 + Math.sin(ac) * r); x.rotate(ac + (inward ? -Math.PI / 2 : Math.PI / 2)); x.fillText(txt[i], 0, 0); x.restore(); a += (inward ? -1 : 1) * da; }
  x.restore();
}
function LOGO_draw(x, t, lg, P) {
  const name = String(t.name || t.city || 'X').toUpperCase(), city = String(t.city || '').toUpperCase(), L0 = (t.name && t.name !== t.city ? t.name : t.city || 'X')[0].toUpperCase(), icon = lg.icon && ICONS[lg.icon] ? lg.icon : null;
  const em = (cx, cy, s, f, sc, halo, ink) => { x.save(); x.translate(cx, cy); x.scale(s, s); x.translate(-50, -50); if (icon) LOGO_mark(x, icon, P, f, sc, halo, ink); else LOGO_text(x, L0, 50, 52, 92, P, f, sc, halo, 0, -0.16); x.restore(); };
  const st = lg.st | 0, L1 = lum(P.c1), ef = Math.abs(lum(P.c2) - L1) >= 0.28 ? P.c2 : L1 < 0.55 ? P.wh : P.dk, tc = lum(P.c2) > 0.32 ? P.c2 : P.wh;   // the emblem in a container must stand off the field
  if (st === 1) {   // standalone mark (or a varsity letter)
    if (icon) em(50, 50, 0.9, P.c1, P.c2, P.halo, 9); else LOGO_text(x, L0, 50, 54, 84, P, P.c1, P.c2, P.halo, 78, -0.16);
    return; }
  if (st === 2) {   // mark over a name banner (wordmark when there is no emblem)
    if (icon) em(50, 37, 0.68, P.c1, P.c2, P.halo, 9); else LOGO_text(x, L0, 50, 37, 70, P, P.c1, P.c2, P.halo, 0, -0.16);
    const rib = () => { x.beginPath(); x.moveTo(4, 66); x.quadraticCurveTo(50, 58, 96, 66); x.lineTo(92, 88); x.quadraticCurveTo(50, 80, 8, 88); x.closePath(); };
    x.fillStyle = ART_mix(P.dk, P.c1, 0.25); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 44, 70); x.lineTo(50 + s * 50, 72); x.lineTo(50 + s * 46, 80); x.lineTo(50 + s * 50, 92); x.lineTo(50 + s * 40, 90); x.closePath(); x.fill(); }
    x.lineJoin = 'round'; x.strokeStyle = P.halo; x.lineWidth = 6; rib(); x.stroke(); x.fillStyle = P.dk; rib(); x.fill(); x.save(); rib(); x.clip(); x.strokeStyle = P.c1; x.lineWidth = 4.4; rib(); x.stroke(); x.restore();
    LOGO_text(x, name, 50, 75.5, 20, P, P.wh, null, null, 74, -0.12);
    return; }
  // classic: the emblem inside the container, layered rims (ink, trim, ink) and a field in the primary colour
  const shape = () => { x.beginPath(); LOGO_shape(x, lg.sh); };
  x.lineJoin = 'round'; x.fillStyle = P.dk; shape(); x.fill(); x.save(); shape(); x.clip();
  x.fillStyle = P.c1; x.fill(); x.strokeStyle = P.dk; x.lineWidth = 18; shape(); x.stroke(); x.strokeStyle = P.c2; x.lineWidth = 12; shape(); x.stroke(); x.strokeStyle = P.dk; x.lineWidth = 7; shape(); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(100, 0); x.lineTo(100, 30); x.lineTo(0, 62); x.fill();
  if (lg.sh === 0) {   // roundel: a dark band carrying the city and the name
    x.fillStyle = P.dk; x.beginPath(); x.arc(50, 50, 41, 0, 7); x.fill(); x.strokeStyle = P.c2; x.lineWidth = 1.6; x.beginPath(); x.arc(50, 50, 29.5, 0, 7); x.stroke(); x.fillStyle = P.c1; x.beginPath(); x.arc(50, 50, 28.5, 0, 7); x.fill();
    LOGO_arcText(x, city.length > 13 ? city.slice(0, 13) : city, 35, -Math.PI / 2, 10, tc, false); if (name !== city) LOGO_arcText(x, name.length > 13 ? name.slice(0, 13) : name, 35, Math.PI / 2, 10, tc, true);
    for (const s of [-1, 1]) { x.fillStyle = P.c2; x.beginPath(); LG_add(x, LG_star(50 + s * 35, 50, 3.4, 1.4)); x.fill(); }
    x.restore(); em(50, 50, 0.48, ef, P.dk, P.dk, 7); return; }
  if (lg.sh === 1) {   // shield: a chief across the top with the abbreviation
    x.fillStyle = P.dk; x.fillRect(0, 0, 100, 27); x.fillStyle = P.c2; x.fillRect(0, 25, 100, 2.4); x.restore();
    LOGO_text(x, String(t.abbr || L0), 50, 17, 15, P, P.wh, null, null, 50, 0); em(50, 58, 0.5, ef, P.dk, P.dk, 7); return; }
  if (lg.sh === 4) {   // badge: a bar across the bottom with the abbreviation
    x.fillStyle = P.dk; x.fillRect(0, 70, 100, 30); x.fillStyle = P.c2; x.fillRect(0, 69, 100, 2.2); x.restore();
    LOGO_text(x, String(t.abbr || L0), 50, 80, 15, P, P.wh, null, null, 60, 0); em(50, 42, 0.56, ef, P.dk, P.dk, 7); return; }
  x.restore(); em(50, 51, lg.sh === 2 ? 0.52 : 0.6, ef, P.dk, P.dk, 7);
}
const LOGO_CACHE = new Map();
function drawLogo(x, t, S) {
  if (!t) return; const lg = ensureLogo(t); x.clearRect(0, 0, S, S);
  const im = logoImage(t);
  if (im) { x.save(); logoShape(x, lg.sh, S); x.clip(); x.fillStyle = t.c1; x.fillRect(0, 0, S, S); const r = Math.max(S / im.naturalWidth, S / im.naturalHeight) * (t.logoZoom || 1); const w = im.naturalWidth * r, h = im.naturalHeight * r; x.drawImage(im, (S - w) / 2, (S - h) / 2, w, h); x.restore();
    x.save(); logoShape(x, lg.sh, S); x.lineWidth = S * 0.05; x.strokeStyle = t.c2; x.stroke(); x.restore(); return; }
  const key = [t.id, lg.sh, lg.icon, lg.st, t.c1, t.c2, t.name, t.city, t.abbr, Math.round(S)].join('|'); let cv = LOGO_CACHE.get(key);
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = Math.max(8, Math.round(S)); const c = cv.getContext('2d'); c.scale(cv.width / 100, cv.height / 100); LOGO_draw(c, t, lg, LOGO_pal(t));
    if (LOGO_CACHE.size > 400) LOGO_CACHE.delete(LOGO_CACHE.keys().next().value); LOGO_CACHE.set(key, cv); }
  x.drawImage(cv, 0, 0, S, S);
}
// paint every art canvas inside root
function paintArt(root) {
  if (root) { try { paintStadiums(root); } catch (e) { console.error(e); } }
  if (!root || !L) return;
  const safe = f => { try { f(); } catch (e) { console.error(e); } };   // one bad picture must not stop the page
  root.querySelectorAll('canvas[data-bust]').forEach(cn => safe(() => { const p = L.P[cn.dataset.bust]; if (!p) return; const T = p.tid != null ? L.teams[p.tid] : (cn.dataset.tid ? L.teams[cn.dataset.tid] : null); const cx = cn.getContext('2d'); cx.setTransform(cn.width / 96, 0, 0, cn.width / 96, 0, 0); drawBust(cx, p, T); }));
  root.querySelectorAll('canvas[data-logo]').forEach(cn => safe(() => { const t = L.teams[cn.dataset.logo]; if (!t) return; drawLogo(cn.getContext('2d'), t, cn.width); }));
  root.querySelectorAll('canvas[data-look]').forEach(cn => safe(() => { let lk; try { lk = JSON.parse(cn.dataset.look); } catch (e) { return; } const T = cn.dataset.tid ? L.teams[cn.dataset.tid] : UT(); const cx = cn.getContext('2d'); cx.setTransform(cn.width / 96, 0, 0, cn.width / 96, 0, 0); drawBust(cx, { coach: true, lk }, T); }));
}

// ------------------------------------------------------------ stadium art (title hero, matchup card): the view from behind the end zone
// Each home team gets its own look from the seed: 0 night bowl, 1 dusk, 2 day game, 3 dome, 4 snow night (o.kind forces one).
// A tiered far stand (lower bowl, club level with suites and banners, upper deck, rim), side stands converging on the vanishing point,
// a crowd drawn seat by seat in team colours, goal posts, an end zone in the home colour, yard lines, hashes and numbers in perspective.
function drawStadium(cv, o = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), c1 = o.c1 || '#1f6b35', c2 = o.c2 || '#f2c230', seed = (o.seed || 7) | 0, rnd = seededRng(((seed + 11) * 2654435761) >>> 0);
  const kind = o.kind != null ? o.kind : [0, 1, 2, 3, 0, 4, 2, 1][(seed >>> 0) % 8], night = kind === 0 || kind === 4, dome = kind === 3, day = kind === 2, dusk = kind === 1, mix = ART_mix;
  // perspective: depth d in metres from the camera; the field fills the bottom, the far end zone meets the stands
  const dN = 40, dF = 88, top = H * (W / H < 1.2 ? 0.5 : 0.47), hzY = top - (H - top) * (dN / dF) / (1 - dN / dF), F = 0.62 * W * dN / 24.4;
  const yOf = d => hzY + (H - hzY) * dN / d, xOf = (xw, d) => W / 2 + xw * F / d, mpx = d => F / d;
  const quad = (x0, x1, d0, d1, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(xOf(x0, d0), yOf(d0)); g.lineTo(xOf(x1, d0), yOf(d0)); g.lineTo(xOf(x1, d1), yOf(d1)); g.lineTo(xOf(x0, d1), yOf(d1)); g.closePath(); g.fill(); };
  const dW = dF + 6, yW = yOf(dW), sideX = 36, skyTop = dome ? -1 : H * (W / H < 1.2 ? 0.16 : 0.15), hS = (yW - Math.max(0, skyTop)) / mpx(dW);   // stand height in metres
  // ---- sky / roof
  let gr = g.createLinearGradient(0, 0, 0, yW);
  if (day) { gr.addColorStop(0, '#3f86d6'); gr.addColorStop(1, '#b9dcf5'); } else if (dusk) { gr.addColorStop(0, '#191b44'); gr.addColorStop(0.45, '#5d3470'); gr.addColorStop(0.8, '#d0644a'); gr.addColorStop(1, '#f2a35a'); }
  else if (dome) { gr.addColorStop(0, '#20252f'); gr.addColorStop(1, '#3a4150'); } else { gr.addColorStop(0, '#03060c'); gr.addColorStop(0.7, '#0b1526'); gr.addColorStop(1, '#17243c'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (night) { g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 70; i++) { const s = rnd() < 0.15 ? 1.6 : 0.9; g.fillRect(rnd() * W, rnd() * skyTop * 1.6, s, s); } }
  if (day || dusk) { for (let i = 0; i < 6; i++) { const cx = rnd() * W, cy = skyTop * (0.3 + rnd() * 1.1), s = H * (0.03 + rnd() * 0.04); g.fillStyle = day ? 'rgba(255,255,255,.85)' : 'rgba(250,170,130,.35)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cx + (k - 2.5) * s * 0.9, cy - Math.sin(k / 5 * Math.PI) * s * 0.5, s * (dusk ? 1.6 : 0.9), s * (dusk ? 0.25 : 0.6), 0, 0, 7); g.fill(); } } }
  if (dusk) { const sg = g.createRadialGradient(W * 0.7, yW * 0.75, 0, W * 0.7, yW * 0.75, W * 0.4); sg.addColorStop(0, 'rgba(255,214,150,.75)'); sg.addColorStop(1, 'rgba(255,170,110,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, yW); }
  if (dome) { g.strokeStyle = 'rgba(160,175,200,.16)'; g.lineWidth = Math.max(1, H / 300); for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.02, yW * 0.5); g.lineTo(W / 2 + i * W * 0.12, -10); g.stroke(); }
    for (let j = 0; j < 5; j++) { const y = yW * 0.5 * Math.pow(j / 5, 1.6); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.fillStyle = 'rgba(255,246,220,.85)'; for (let i = 0; i < 26; i++) { const xx = W * (0.04 + i * 0.037), yy = yW * 0.16 + Math.sin(i * 0.9) * 3; g.fillRect(xx, yy, H / 200 + 1, H / 400 + 1); } }
  // ---- crowd batching: one fill per colour
  const B = new Map(), put = (col, x, y, w, h) => { let a = B.get(col); if (!a) B.set(col, a = []); a.push(x, y, w, h); };
  const flush = () => { for (const [col, a] of B) { g.fillStyle = col; for (let i = 0; i < a.length; i += 4) g.fillRect(a[i], a[i + 1], a[i + 2], a[i + 3]); } B.clear(); };
  const lightK = day ? 1 : dusk ? 0.8 : dome ? 0.85 : 0.7, shirts = [c1, c1, c1, mix(c1, '#ffffff', 0.25), c2, c2, '#f1efe8', '#262a33', '#3b4458', '#8c2f2f', mix(c1, '#000000', 0.35)].map(c => mix(c, '#0a0d16', 1 - lightK)), skins = ['#e7c2a0', '#c89470', '#8d5a3a', '#5c3a24', '#f0d2b8'].map(c => mix(c, '#0a0d16', 1 - lightK));
  const fan = (x, y, s) => { const sh = shirts[(rnd() * shirts.length) | 0]; if (s < 2.2) { put(sh, x, y, s * 0.85, s * 1.1); return; } put(sh, x, y + s * 0.42, s * 0.82, s * 0.7); put(skins[(rnd() * skins.length) | 0], x + s * 0.2, y, s * 0.44, s * 0.44); };
  // ---- far stand (frontal plane at depth dW, between the side stands)
  const fx0 = xOf(-sideX, dW), fx1 = xOf(sideX, dW), m = mpx(dW), yAt = hm => yW - hm * m;   // height above the field in metres -> y
  const tiers = [[1.4, hS * 0.42, 'lower'], [hS * 0.42, hS * 0.55, 'club'], [hS * 0.55, hS * 0.93, 'upper'], [hS * 0.93, hS * 1.02, 'rim']];
  g.fillStyle = mix('#1b2130', '#000000', day ? 0 : 0.3); g.fillRect(fx0, yAt(hS * 1.02), fx1 - fx0, yW - yAt(hS * 1.02));
  for (const [h0, h1, t] of tiers) { const y0 = yAt(h1), y1 = yAt(h0);
    if (t === 'lower' || t === 'upper') { const rowH = 0.9 * m, seat = 0.55 * m; g.fillStyle = mix(c1, '#14171f', 0.75); g.fillRect(fx0, y0, fx1 - fx0, y1 - y0);
      for (let y = y1 - rowH; y > y0 - rowH * 0.3; y -= rowH) { for (let xx = fx0 + rnd() * seat; xx < fx1; xx += seat) { if ((((xx - fx0) / (seat * 22)) % 1) < 0.06) continue; if (rnd() < 0.05) continue; fan(xx, y, seat); } }
      flush(); g.fillStyle = 'rgba(0,0,0,.25)'; for (let xx = fx0; xx < fx1; xx += seat * 22) g.fillRect(xx, y0, seat * 1.2, y1 - y0); }   // aisles
    if (t === 'club') { g.fillStyle = mix(c1, '#0c0f16', 0.6); g.fillRect(fx0, y0, fx1 - fx0, y1 - y0); const wy = y0 + (y1 - y0) * 0.22, wh = (y1 - y0) * 0.42;
      for (let xx = fx0 + m * 1.5; xx < fx1 - m; xx += m * 4.2) { g.fillStyle = night || dome ? mix('#ffe2a8', c2, 0.15) : mix('#9fb6cc', '#ffffff', 0.2); g.fillRect(xx, wy, m * 3.4, wh); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(xx, wy + wh * 0.6, m * 3.4, wh * 0.4); }
      g.fillStyle = c2; g.fillRect(fx0, y1 - (y1 - y0) * 0.16, fx1 - fx0, (y1 - y0) * 0.1);
      for (let i = 0, n = Math.max(4, Math.round((fx1 - fx0) / (m * 9))); i < n; i++) { const bx = fx0 + (i + 0.5) * (fx1 - fx0) / n - m * 1.1; g.fillStyle = i % 2 ? c2 : c1; g.fillRect(bx, y1 - (y1 - y0) * 0.1, m * 2.2, m * 3.2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bx + m * 1.1, y1 - (y1 - y0) * 0.1, m * 1.1, m * 3.2); } }   // hanging banners
    if (t === 'rim') { g.fillStyle = mix('#2a3140', '#000000', day ? 0 : 0.35); g.fillRect(fx0, y0, fx1 - fx0, y1 - y0); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(fx0, y0, fx1 - fx0, Math.max(1, (y1 - y0) * 0.15)); } }
  // ---- side stands: rows run along the field and converge on the vanishing point
  for (const s of [-1, 1]) {
    const dA = dW, dB = dN * 0.45, edge = d => [xOf(s * sideX, d), yOf(d)], up = (d, hm) => [xOf(s * sideX, d) + s * hm * 0.55 * mpx(d), yOf(d) - hm * mpx(d)];
    g.fillStyle = mix(c1, '#14171f', 0.78); g.beginPath(); g.moveTo(...edge(dA)); g.lineTo(...up(dA, hS * 1.02)); g.lineTo(...up(dB, hS * 1.02)); g.lineTo(...edge(dB)); g.closePath(); g.fill();
    for (let hm = 1.2; hm < hS * 0.98; hm += 0.9) { if (Math.abs(hm - hS * 0.48) < hS * 0.07) continue; for (let d = dA - rnd() * 0.5; d > dB; d -= 0.55 * (d / dA) * 1.25 + 0.2) { const [px, py] = up(d, hm), sz = 0.6 * mpx(d); if (px < -sz || px > W + sz || py < -sz) continue; if (rnd() < 0.05) continue; fan(px, py - sz, sz); } }
    flush();
    g.fillStyle = mix(c1, '#0c0f16', 0.55); g.beginPath(); g.moveTo(...up(dA, hS * 0.44)); g.lineTo(...up(dA, hS * 0.52)); g.lineTo(...up(dB, hS * 0.52)); g.lineTo(...up(dB, hS * 0.44)); g.closePath(); g.fill();   // the club level running down the side
    g.fillStyle = c2; g.beginPath(); g.moveTo(...up(dA, hS * 0.44)); g.lineTo(...up(dA, hS * 0.455)); g.lineTo(...up(dB, hS * 0.455)); g.lineTo(...up(dB, hS * 0.44)); g.closePath(); g.fill();
    g.fillStyle = mix('#2a3140', '#000000', day ? 0 : 0.35); g.beginPath(); g.moveTo(...up(dA, hS * 0.95)); g.lineTo(...up(dA, hS * 1.04)); g.lineTo(...up(dB, hS * 1.04)); g.lineTo(...up(dB, hS * 0.95)); g.closePath(); g.fill();
  }
  // the deck in shadow toward the top, lit toward the field
  gr = g.createLinearGradient(0, Math.max(0, skyTop), 0, yW); gr.addColorStop(0, `rgba(4,6,12,${day ? 0.1 : 0.45})`); gr.addColorStop(1, 'rgba(4,6,12,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, yW);
  if (night || dusk || dome) { g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 40; i++) { const xx = fx0 + rnd() * (fx1 - fx0), yy = yAt(1.5 + rnd() * hS * 0.9); g.fillRect(xx, yy, 1.2, 1.2); } }   // camera flashes
  // ---- video board over the far stand, light towers at the corners
  { const bh = Math.min((fx1 - fx0) * 0.066, Math.max(H * 0.07, yAt(hS * 1.02) - 6)), bw = bh / 0.3, bx = W / 2 - bw / 2, by = Math.max(dome ? yW * 0.12 : 2, yAt(hS * 1.02) - bh * (dome ? 0.3 : 1.05));
    g.fillStyle = '#0d1016'; g.fillRect(bx - bw * 0.03, by - bh * 0.06, bw * 1.06, bh * 1.12); const sg = g.createLinearGradient(bx, by, bx + bw, by + bh); sg.addColorStop(0, mix(c1, '#ffffff', 0.15)); sg.addColorStop(1, mix(c1, '#000000', 0.35)); g.fillStyle = sg; g.fillRect(bx, by, bw, bh);
    g.fillStyle = c2; g.fillRect(bx, by + bh * 0.78, bw, bh * 0.08); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(bx + bw * 0.08, by + bh * 0.22, bw * 0.22, bh * 0.4); g.fillRect(bx + bw * 0.7, by + bh * 0.22, bw * 0.22, bh * 0.4);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, by, bw, bh * 0.12); }
  if (!dome && !day) for (const fx of [0.06, 0.94, 0.3, 0.7]) { const x = W * fx, by = fx === 0.3 || fx === 0.7 ? yAt(hS * 1.02) : yAt(hS * 1.02) - H * 0.02, ty = Math.max(H * 0.015, by - H * 0.1), lw = W * 0.05, lh = H * 0.035;
    g.fillStyle = '#121620'; g.fillRect(x - W * 0.003, ty, W * 0.006, by - ty); g.fillRect(x - lw / 2 - 2, ty - lh - 2, lw + 4, lh + 4);
    const hz = g.createRadialGradient(x, ty - lh / 2, 0, x, ty - lh / 2, W * 0.22); hz.addColorStop(0, 'rgba(255,246,222,.5)'); hz.addColorStop(0.2, 'rgba(255,240,210,.14)'); hz.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = hz; g.fillRect(0, 0, W, H * 0.8);
    g.fillStyle = '#fffaf0'; for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) g.fillRect(x - lw / 2 + i * lw / 6 + 1, ty - lh + j * lh / 2 + 1, lw / 6 - 2, lh / 2 - 2); }
  // ---- the field: apron, mow pattern, end zone, lines, numbers
  const grass = day ? ['#3f8a35', '#4a9a3d'] : dome ? ['#2f8f44', '#38a04d'] : kind === 4 ? ['#3b6e3e', '#447a45'] : ['#2f6d2b', '#38792f'], pat = (seed >>> 3) % 3, yd = 0.9144;
  quad(-sideX, sideX, dN * 0.45, dW, mix(grass[0], '#0d1a0d', 0.35));
  for (const s of [-1, 1]) quad(s * 27, s * 28.2, dN * 0.45, dF + 1, mix(c1, '#0d1a0d', 0.2));   // team-colour sideline border
  const dG = dF - 10 * yd; let k = 0;
  for (let d = dG; d > dN * 0.45; d -= 5 * yd, k++) { const d1 = Math.max(dN * 0.45, d - 5 * yd); if (pat === 2) for (let j = 0; j < 4; j++) quad(-24.4 + j * 12.2, -24.4 + (j + 1) * 12.2, d1, d, (k + j) % 2 ? grass[0] : grass[1]); else quad(-24.4, 24.4, d1, d, k % 2 ? grass[0] : grass[1]);
    if (pat === 1) quad(-24.4, 24.4, d1, (d + d1) / 2, 'rgba(255,255,255,.035)'); }
  quad(-24.4, 24.4, dG, dF, c1);   // end zone in the home colour with diagonal stripes
  g.save(); g.beginPath(); g.moveTo(xOf(-24.4, dG), yOf(dG)); g.lineTo(xOf(24.4, dG), yOf(dG)); g.lineTo(xOf(24.4, dF), yOf(dF)); g.lineTo(xOf(-24.4, dF), yOf(dF)); g.closePath(); g.clip();
  g.strokeStyle = ART_a(c2, 0.5); g.lineWidth = Math.max(1, mpx(dF) * 0.5); for (let xw = -30; xw < 30; xw += 3) { g.beginPath(); g.moveTo(xOf(xw, dG), yOf(dG)); g.lineTo(xOf(xw + 5, dF), yOf(dF)); g.stroke(); } g.restore();
  const line = 'rgba(245,245,238,.92)', lw = 0.12;
  quad(-24.95, -24.4, dN * 0.45, dF, '#f2f2ea'); quad(24.4, 24.95, dN * 0.45, dF, '#f2f2ea'); quad(-24.4, 24.4, dF - lw, dF + lw, '#f2f2ea');
  for (let d = dG; d > dN * 0.45; d -= 5 * yd) quad(-24.4, 24.4, d - lw * (d === dG ? 2 : 1), d + lw * (d === dG ? 2 : 1), line);
  for (let d = dG; d > dN * 0.45; d -= yd) for (const hx of [-3.08, 3.08, -23.5, 23.5]) quad(hx - 0.3, hx + 0.3, d - 0.06, d + 0.06, 'rgba(245,245,238,.8)');
  // yard numbers, read from the sidelines: they run along the field, so they are drawn on their side and foreshortened
  for (let n = 1; n <= 9; n++) { const d = dG - n * 10 * yd; if (d < dN * 0.62) break; const txt = String(n <= 5 ? n * 10 : (10 - n) * 10), sx = mpx(d), sy = (H - hzY) * dN / (d * d), sz = 2.6;
    for (const s of [-1, 1]) { g.save(); g.font = `700 100px ${CANVAS_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(245,245,238,.88)';
      g.setTransform(0, s < 0 ? sy * sz / 100 : -sy * sz / 100, s < 0 ? -sx * sz / 100 : sx * sz / 100, 0, xOf(s * 12.6, d), yOf(d)); g.fillText(txt, 0, 0); g.restore(); } }
  // goal posts on the far end line
  { const d = dF + 0.4, bx = xOf(0, d), by = yOf(d), m2 = mpx(d), cb = by - 3.05 * m2, half = 2.82 * m2, topY = by - 12 * m2, pw = Math.max(1.5, 0.16 * m2), post = '#f2cf38', postD = '#b8921c';
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bx - half, by - 0.2 * m2, half * 2, 0.4 * m2);
    g.fillStyle = postD; g.fillRect(bx - pw * 0.9, cb, pw * 1.8, by - cb); g.fillStyle = post; g.fillRect(bx - pw * 0.9, cb, pw * 0.9, by - cb);
    g.fillStyle = post; g.fillRect(bx - half, cb - pw / 2, half * 2, pw); for (const s of [-1, 1]) { g.fillStyle = post; g.fillRect(bx + s * half - pw / 2, topY, pw, cb - topY); g.fillStyle = postD; g.fillRect(bx + s * half, topY, pw / 2, cb - topY); g.fillStyle = '#c8402e'; g.fillRect(bx + s * half - pw, topY - pw * 3, pw * 2, pw * 3); }
    g.fillStyle = mix(c1, '#ffffff', 0.1); g.fillRect(bx - pw * 1.6, by - 1.4 * m2, pw * 3.2, 1.4 * m2); }   // padding at the base
  // a few figures on the sidelines
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) { const d = dN * 0.9 + i * 3.4 + rnd() * 2, xw = s * (25.6 + rnd() * 1.6), m3 = mpx(d), px = xOf(xw, d), py = yOf(d), col = i % 3 === 2 ? '#e9e6dc' : s < 0 ? c1 : mix(c2, '#222833', 0.2);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px - 0.3 * m3, py - 0.1 * m3, 0.8 * m3, 0.2 * m3); g.fillStyle = col; g.fillRect(px - 0.25 * m3, py - 1.6 * m3, 0.5 * m3, 1.1 * m3); g.fillStyle = '#d8d4ca'; g.fillRect(px - 0.22 * m3, py - 0.6 * m3, 0.44 * m3, 0.6 * m3);
    g.fillStyle = s < 0 ? mix(c1, '#000000', 0.2) : '#2a2f3a'; g.beginPath(); g.arc(px, py - 1.85 * m3, 0.24 * m3, 0, 7); g.fill(); }
  // turf grain, the sun's shadow from the stands on a day game, light pools at night, snow
  for (let i = 0; i < W * H / 60; i++) { const xx = rnd() * W, yy = top + rnd() * (H - top); g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,220,.045)'; g.fillRect(xx, yy, 1, 1.5); }
  if (day) { g.fillStyle = 'rgba(10,20,40,.28)'; g.beginPath(); g.moveTo(xOf(-sideX, dW), yW); g.lineTo(xOf(-8, dW), yW); g.lineTo(xOf(-16, dN * 0.45), yOf(dN * 0.45)); g.lineTo(0, H); g.lineTo(0, yW); g.closePath(); g.fill(); }
  if (!day) { g.globalCompositeOperation = 'lighter'; for (const fx of [0.22, 0.5, 0.78]) { const lp = g.createRadialGradient(W * fx, H * 0.74, 0, W * fx, H * 0.74, W * 0.3); lp.addColorStop(0, `rgba(255,250,225,${dome ? 0.1 : 0.12})`); lp.addColorStop(1, 'rgba(255,250,225,0)'); g.fillStyle = lp; g.fillRect(0, top, W, H - top); } g.globalCompositeOperation = 'source-over'; }
  if (kind === 4) { g.fillStyle = 'rgba(235,240,250,.16)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 260; i++) { const r = (rnd() * 1.6 + 0.6) * H / 500; g.beginPath(); g.arc(rnd() * W, rnd() * H, r, 0, 7); g.fill(); }
    quad(-sideX, -25.2, dN * 0.45, dW, 'rgba(240,244,250,.55)'); quad(25.2, sideX, dN * 0.45, dW, 'rgba(240,244,250,.55)'); }
  // team colours washing in from the sides, then a vignette and a dark floor so text on top stays readable
  if (o.left) { const t = g.createLinearGradient(0, 0, W * 0.5, 0); t.addColorStop(0, mix(o.left, '#000000', 0.1)); t.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.42; g.fillStyle = t; g.fillRect(0, 0, W * 0.5, H); g.globalAlpha = 1; }
  if (o.right) { const t = g.createLinearGradient(W, 0, W * 0.5, 0); t.addColorStop(0, mix(o.right, '#000000', 0.1)); t.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.42; g.fillStyle = t; g.fillRect(W * 0.5, 0, W * 0.5, H); g.globalAlpha = 1; }
  const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  gr = g.createLinearGradient(0, H * 0.55, 0, H); gr.addColorStop(0, 'rgba(4,8,14,0)'); gr.addColorStop(1, `rgba(4,8,14,${o.floor ?? 0.55})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// hero canvases are rebuilt with every render, so finished pictures are kept by options + size
const STAD_CACHE = new Map();
function paintStadiums(root) {
  root.querySelectorAll('canvas[data-stadium]').forEach(cn => { const r = cn.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(200, Math.round(r.width * dpr)), h = Math.max(120, Math.round(r.height * dpr));
    if (cn.width === w && cn.height === h && cn._done) return; cn.width = w; cn.height = h; let o = {}; try { o = JSON.parse(cn.dataset.stadium || '{}'); } catch (e) { }
    const key = (cn.dataset.stadium || '') + '|' + w + 'x' + h; let src = STAD_CACHE.get(key);
    if (!src) { src = document.createElement('canvas'); src.width = w; src.height = h; drawStadium(src, o); if (STAD_CACHE.size > 12) STAD_CACHE.delete(STAD_CACHE.keys().next().value); STAD_CACHE.set(key, src); }
    cn.getContext('2d').drawImage(src, 0, 0); cn._done = true; });
}