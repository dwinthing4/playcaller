// ============================================================
//  3D SCENE: field, stadium, lights, recolorable skinned players driven by the physics poses, ball, camera.
// ============================================================
(() => {
const M = R3D._, FIELD = PHYS.FIELD, YDm = YD, ik2 = PHYS._.ik2;
let sideMat = null, renderer, scene, camera, sun, hemi, fieldMat, fieldMesh, losLine, fdLine, ballG, ringMesh, ringMat, tgtRing, coarse = false, W = 1, H = 1;
const cache = { body: {}, head: {}, helm: {}, mask: {}, fieldTex: {} };
const rigs = new Map();                   // pid -> rig
const col = hex => new THREE.Color(hex).convertSRGBToLinear();
const V = (x, y, z) => ({ x, y, z });
// ---------------- archetypes: one sculpted body per build ----------------
// Three sculpted builds per session; each player is then scaled to his own height and weight. Sleeves and tape are
// palette slots, so a player shows bare arms, sleeves or tape just by colour (no extra meshes).
const ARMS_ALL = { L: { item: 'full', wrist: 'tape' }, R: { item: 'full', wrist: 'tape' } };
const ARCH = {
  SKILL: { heightIn: 73, weightLb: 200, muscle: 0.6, pads: 'sleek', arms: ARMS_ALL },
  BACK: { heightIn: 73, weightLb: 236, muscle: 0.82, pads: 'speed', arms: ARMS_ALL },
  BIG: { heightIn: 77, weightLb: 305, muscle: 0.45, pads: 'trench', arms: ARMS_ALL },
};
const POS_ARCH = { QB: 'SKILL', RB: 'BACK', FB: 'BACK', WR: 'SKILL', TE: 'BACK', OT: 'BIG', OG: 'BIG', C: 'BIG', DE: 'BIG', DT: 'BIG', LB: 'BACK', CB: 'SKILL', S: 'SKILL', K: 'SKILL', P: 'SKILL' };
const POS_MASK = { QB: 'opo', RB: 'ropo', FB: 'ropo', WR: 'bullet', TE: 'ropo', OT: 'cage', OG: 'cage', C: 'cage', DE: 'ropo', DT: 'cage', LB: 'ropo', CB: 'bullet', S: '2bar', K: '2bar', P: '2bar' };
const SKIN = ['#f9dcc4', '#f1c7a3', '#e3ad85', '#d29a6c', '#bd8152', '#a06a40', '#87532f', '#6a3f22', '#4f2d18', '#3d2213', '#f3d0b8', '#c99570'];
function res() { return coarse ? { body: 0.019, head: 0.0085, helm: 0.0095 } : { body: 0.017, head: 0.0075, helm: 0.0085 }; }
// ---------------- palette material ----------------
function palMat(nSlots, kind, opts) {
  const nA = Math.ceil(nSlots / 4), m = kind === 'physical' ? new THREE.MeshPhysicalMaterial(opts) : new THREE.MeshStandardMaterial(opts);
  m.userData.pal = Array.from({ length: nSlots }, () => new THREE.Color(1, 1, 1)); m.userData.decal = null; m.userData.n = nSlots;
  m.onBeforeCompile = sh => {
    sh.uniforms.pal = { value: m.userData.pal }; sh.uniforms.decalMap = { value: m.userData.decal || BLANK };
    let attrs = '', sumv = ''; for (let a = 0; a < nA; a++) { attrs += `attribute vec4 w${a};\n`; for (let c = 0; c < 4; c++) { const i = a * 4 + c; if (i < nSlots) sumv += `${sumv ? '+' : ''}w${a}.${'xyzw'[c]}*pal[${i}]`; } }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${attrs}attribute vec2 duv;\nattribute float nm;\nuniform vec3 pal[${nSlots}];\nvarying vec3 vPal;\nvarying vec2 vDuv;\nvarying float vNm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvPal=${sumv};vDuv=duv;vNm=nm;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D decalMap;\nvarying vec3 vPal;\nvarying vec2 vDuv;\nvarying float vNm;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=vPal;\n{vec4 dc=texture2D(decalMap,vDuv);dc.rgb=pow(dc.rgb,vec3(2.2));diffuseColor.rgb=mix(diffuseColor.rgb,dc.rgb,dc.a*vNm);}');
    m.userData.shader = sh;
  };
  m.customProgramCacheKey = () => 'pal' + nSlots + kind + (opts.skinning ? 's' : '');
  return m;
}
let BLANK = null;
function setPal(m, hexes) { hexes.forEach((h, i) => { if (h != null && i < m.userData.n) m.userData.pal[i].copy(col(h)); }); }
function geoFrom(out, slotsKey, n, stride = n) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(out.normal, 3));
  const Wsrc = out[slotsKey], nv = out.count, nA = Math.ceil(n / 4);
  for (let a = 0; a < nA; a++) { const arr = new Float32Array(nv * 4); for (let q = 0; q < nv; q++) for (let c = 0; c < 4; c++) { const i = a * 4 + c; arr[q * 4 + c] = i < n ? Wsrc[q * stride + i] : 0; } g.setAttribute('w' + a, new THREE.BufferAttribute(arr, 4)); }
  g.setAttribute('duv', new THREE.BufferAttribute(out.uv || new Float32Array(nv * 2), 2)); g.setAttribute('nm', new THREE.BufferAttribute(out.nm || new Float32Array(nv), 1));
  if (out.skinIndex) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.skinIndex, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.skinWeight, 4)); }
  g.setIndex(new THREE.BufferAttribute(out.index, 1)); g.computeBoundingSphere(); return g;
}
// ---------------- asset builders (cached in memory, and in IndexedDB across sessions) ----------------
const MODEL_V = 7, KIND_V = { body: 8, head: 8 }, outs = {};   // body / head v8: per-region colour slots (sleeves, ankles, beards, eye black)
const meshKey = (kind, name) => `m${KIND_V[kind] || MODEL_V}|${kind}|${name}|${res()[kind]}`;
const makers = {
  body: arch => M.meshSDF(M.makeBodyModel(Object.assign({}, ARCH[arch], { res: res().body * (arch === 'BIG' ? 0.86 : 1) }))),   // linemen: bigger pads need a finer grid to stay rounded
  head: arch => { const bp = M.bodyParams(ARCH[arch]); return M.meshSDF(M.makeHeadModel({ headScale: 1 + (bp.H - 1) * 0.35, eyeBlack: false, res: res().head })); },
  helm: shell => M.meshSDF(M.makeHelmetModel({ kind: shell, stripe: 'single', logo: true, res: res().helm })),
};
function outFor(kind, name) { const k = meshKey(kind, name); return outs[k] || (outs[k] = makers[kind](name)); }
let idbP = null;
function idb() { if (idbP) return idbP; idbP = new Promise(res2 => { try { const rq = indexedDB.open('playcaller-models', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('m'); rq.onsuccess = () => res2(rq.result); rq.onerror = () => res2(null); } catch (e) { res2(null); } }); return idbP; }
async function idbGet(k) { const db = await idb(); if (!db) return null; return new Promise(r => { try { const q = db.transaction('m').objectStore('m').get(k); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); } catch (e) { r(null); } }); }
async function idbPut(k, v) { const db = await idb(); if (!db) return; try { db.transaction('m', 'readwrite').objectStore('m').put(v, k); } catch (e) { } }
function buildBody(arch) {
  if (cache.body[arch]) return cache.body[arch];
  const A = ARCH[arch], out = outFor('body', arch), bp = M.bodyParams(A), J = M.skeleton(bp), Hh = bp.H;
  const P0 = { pelvis: J.root, spine: J.spine, chest: J.chest, neck: J.neck, head: J.head, headTop: [J.head[0], J.head[1] + 0.12, J.head[2]] };
  for (const s of ['L', 'R']) { const el = J['el' + s], wr = J['wr' + s], d = [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]], dl = Math.hypot(...d);
    Object.assign(P0, { ['sh' + s]: J['sh' + s], ['el' + s]: el, ['wr' + s]: wr, ['tip' + s]: [wr[0] + d[0] / dl * 0.1, wr[1] + d[1] / dl * 0.1, wr[2] + d[2] / dl * 0.1], ['hip' + s]: J['hip' + s], ['kn' + s]: J['kn' + s], ['an' + s]: J['an' + s], ['toe' + s]: [J['an' + s][0], J['an' + s][1] - 0.04, J['an' + s][2] + 0.16 * Hh] }); }
  const P0v = {}; for (const k in P0) P0v[k] = V(...P0[k]);
  const right = V(-1, 0, 0), F0 = frames(P0v, { pelvis: right, spine: right, chest: right, neck: right, head: right, armR: right, armL: V(1, 0, 0), leg: right, fbT: V(0, 0, 1), fbA: V(0, 1, 0) });
  const geo = geoFrom(out, 'W', M.NS), L0 = {}; BMAP.forEach(([name, a, b]) => { L0[name] = Math.hypot(P0v[b].x - P0v[a].x, P0v[b].y - P0v[a].y, P0v[b].z - P0v[a].z); });
  return (cache.body[arch] = { geo, P0: P0v, F0, L0, J, heightIn: A.heightIn, girth: Math.sqrt((A.weightLb * 0.4536) / (95 * Math.pow(A.heightIn / 73, 3))), tris: out.index.length / 3 });
}
function buildHead(arch) {
  if (cache.head[arch]) return cache.head[arch];
  const bp = M.bodyParams(ARCH[arch]), out = outFor('head', arch);
  return (cache.head[arch] = { geo: geoFrom(out, 'W12', M.NSH), scale: 1 + (bp.H - 1) * 0.35 });
}
function buildHelm(shell) {
  if (cache.helm[shell]) return cache.helm[shell];
  const out = outFor('helm', shell);
  return (cache.helm[shell] = geoFrom(out, 'W8', 5, 8));
}
function buildMask(style) {
  if (cache.mask[style]) return cache.mask[style];
  const MB = M.maskBars(style), pos = [], nor = [], idx = []; let base = 0;
  for (const pts of MB.bars) { const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal'), tg = new THREE.TubeGeometry(curve, Math.max(8, pts.length * 8), MB.r, 6, false);
    const p = tg.attributes.position.array, n = tg.attributes.normal.array, ix = tg.index.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base); base += p.length / 3; tg.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); g.computeBoundingSphere();
  return (cache.mask[style] = g);
}
// visor: a curved shield behind the facemask at eye level (helmet space), one shared geometry and one shared material per tint
let visorGeo = null; const visorMats = {};
function buildVisor() { if (visorGeo) return visorGeo; const g = new THREE.SphereGeometry(0.158, 22, 6, Math.PI / 2 - 0.78, 1.56, 1.31, 0.55); g.scale(0.79, 1, 1); g.translate(0, -0.006, -0.004); return (visorGeo = g); }
function visorMat(kind) {
  if (visorMats[kind]) return visorMats[kind];
  const o = { clear: { color: '#dfe8f0', opacity: 0.2, roughness: 0.05, metalness: 0.2 }, smoke: { color: '#16191e', opacity: 0.8, roughness: 0.08, metalness: 0.35 }, gold: { color: '#e0a83c', opacity: 0.96, roughness: 0.14, metalness: 1 },
    black: { color: '#08090b', opacity: 0.97, roughness: 0.12, metalness: 0.5 }, blue: { color: '#3d74e0', opacity: 0.94, roughness: 0.12, metalness: 0.9 } }[kind] || { color: '#16191e', opacity: 0.8, roughness: 0.08, metalness: 0.35 };
  return (visorMats[kind] = new THREE.MeshStandardMaterial({ color: col(o.color), roughness: o.roughness, metalness: o.metalness, transparent: true, opacity: o.opacity, depthWrite: o.opacity > 0.9, envMapIntensity: 1.6 }));
}
// per-player add-ons (hair out of the helmet, beard, mouthguard, towel, pads, braces): one small skinned mesh, cached by build + gear combination
const gearGeo = new Map();
function buildGear(arch, L3, headScale) {
  const k = arch + '|' + L3.gearKey; if (gearGeo.has(k)) return gearGeo.get(k);
  const out = M.makeGear(ARCH[arch], headScale, L3.spec), g = out ? geoFrom(out, 'W', M.NSG) : null; gearGeo.set(k, g); return g;
}
// ---------------- bone frames (y along the bone, x from a twist reference) ----------------
const BMAP = [['root', 'pelvis', 'spine', 'pelvis'], ['spine', 'spine', 'chest', 'spine'], ['chest', 'chest', 'neck', 'chest'], ['neck', 'neck', 'head', 'neck'], ['head', 'head', 'headTop', 'head'],
  ['shL', 'shL', 'elL', 'armL'], ['elL', 'elL', 'wrL', 5], ['wrL', 'wrL', 'tipL', 6], ['shR', 'shR', 'elR', 'armR'], ['elR', 'elR', 'wrR', 8], ['wrR', 'wrR', 'tipR', 9],
  ['hipL', 'hipL', 'knL', 'leg'], ['knL', 'knL', 'anL', 11], ['anL', 'anL', 'toeL', 12], ['hipR', 'hipR', 'knR', 'leg'], ['knR', 'knR', 'anR', 14], ['anR', 'anR', 'toeR', 15]];
const NOSTRETCH = { root: 1, spine: 1, chest: 1, neck: 1, head: 1, wrL: 1, wrR: 1, anL: 1, anR: 1 };
function boneFrame(a, b, ref, fb) {
  let yx = b.x - a.x, yy = b.y - a.y, yz = b.z - a.z; const yl = Math.hypot(yx, yy, yz) || 1; yx /= yl; yy /= yl; yz /= yl;
  let r = ref, d = r.x * yx + r.y * yy + r.z * yz, xx = r.x - yx * d, xy = r.y - yy * d, xz = r.z - yz * d, xl = Math.hypot(xx, xy, xz);
  if (xl < 0.15) { r = fb; d = r.x * yx + r.y * yy + r.z * yz; xx = r.x - yx * d; xy = r.y - yy * d; xz = r.z - yz * d; xl = Math.hypot(xx, xy, xz) || 1; }
  xx /= xl; xy /= xl; xz /= xl; return { x: [xx, xy, xz], y: [yx, yy, yz], z: [xy * yz - xz * yy, xz * yx - xx * yz, xx * yy - xy * yx], len: yl };
}
function frames(P, refs) { const F = []; BMAP.forEach(([name, a, b, ref]) => { const r = typeof ref === 'number' ? V(...F[ref].x) : refs[ref], fb = typeof ref === 'number' ? refs.fbA : (name.startsWith('sh') ? refs.fbA : refs.fbT); F.push(boneFrame(P[a], P[b], r, fb)); }); return F; }
const lerp3 = (a, b, t) => a + (b - a) * t;
const add3 = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z), sub3 = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z), mul3 = (a, s) => V(a.x * s, a.y * s, a.z * s), mid3 = (a, b) => V((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
const frameDir = (d, ref, fb) => boneFrame(V(0, 0, 0), d, ref, fb), Vx = a => V(a[0], a[1], a[2]);
// Rigid forward kinematics: the sculpted body keeps its own bone lengths; the physics pose supplies orientations,
// the pelvis position, the hand targets (ball carry, wraps, blocks) and the planted feet (so cleats never skate).
function setBone(r, i, Fc, s, gx, aCur) {
  const Fr = r.base.F0[i], a0 = r.base.P0[BMAP[i][1]], S0 = gx, S1 = s, m = r.m[i];
  for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) m[row * 3 + c] = Fc.x[row] * S0 * Fr.x[c] + Fc.y[row] * S1 * Fr.y[c] + Fc.z[row] * S0 * Fr.z[c];
  m[9] = aCur.x - (m[0] * a0.x + m[1] * a0.y + m[2] * a0.z); m[10] = aCur.y - (m[3] * a0.x + m[4] * a0.y + m[5] * a0.z); m[11] = aCur.z - (m[6] * a0.x + m[7] * a0.y + m[8] * a0.z);
  r.bones[i].matrix.set(m[0], m[1], m[2], m[9], m[3], m[4], m[5], m[10], m[6], m[7], m[8], m[11], 0, 0, 0, 1); r.bones[i].matrixWorldNeedsUpdate = true;
}
const xf = (m, p) => V(m[0] * p.x + m[1] * p.y + m[2] * p.z + m[9], m[3] * p.x + m[4] * p.y + m[5] * p.z + m[10], m[6] * p.x + m[7] * p.y + m[8] * p.z + m[11]);
const BIx = {}; BMAP.forEach(([n], i) => BIx[n] = i);
function updateSkin(r, J) {
  const B = r.base, L0 = B.L0, P0 = B.P0, sz = r.sz, g0 = r.g, rS = J.rT, rH = J.rH || J.rT, fT = J.fT, up = J.tu, GB = r.gb, gb = i => (GB ? g0 * GB[i] : g0);   // per-bone girth (build type)
  let F = frameDir(J.tuL || J.tu, rH, fT); setBone(r, 0, F, sz, gb(0), J.pelvis);
  const spine = add3(J.pelvis, mul3(Vx(F.y), L0.root * sz));
  F = frameDir(up, rS, fT); setBone(r, 1, F, sz, gb(1), spine);
  const chest = add3(spine, mul3(Vx(F.y), L0.spine * sz));
  F = frameDir(up, rS, fT); setBone(r, 2, F, sz, gb(2), chest);
  const neck = add3(chest, mul3(Vx(F.y), L0.chest * sz));
  F = frameDir(sub3(J.head, J.neck), J.hr, fT); setBone(r, 3, F, sz, sz * (GB ? GB[3] : 1), neck);
  const head = add3(neck, mul3(Vx(F.y), L0.neck * sz));
  F = frameDir(J.hu, J.hr, fT); setBone(r, 4, F, sz, sz, head);
  const mC = r.m[2], mR = r.m[0];
  for (const [L, k, sg] of [['R', 0, 1], ['L', 1, -1]]) {
    const A = J.arms[k], sh = xf(mC, P0['sh' + L]); let l1 = L0['sh' + L] * sz, l2 = L0['el' + L] * sz;
    const ad = Math.hypot(A.hand.x - sh.x, A.hand.y - sh.y, A.hand.z - sh.z), st = Math.min(1.06, Math.max(1, ad / ((l1 + l2) * 0.995))); l1 *= st; l2 *= st;
    const ik = ik2(sh, A.hand, l1, l2, sub3(A.elbow, mid3(J.sh[k], A.hand)));
    const Fu = frameDir(sub3(ik.mid, sh), mul3(rS, sg), up); setBone(r, BIx['sh' + L], Fu, sz * st, gb(BIx['sh' + L]), sh);
    const Ff = frameDir(sub3(ik.end, ik.mid), Vx(Fu.x), up); setBone(r, BIx['el' + L], Ff, sz * st, gb(BIx['el' + L]), ik.mid);
    setBone(r, BIx['wr' + L], Ff, sz, sz, ik.end);
  }
  for (const [L, k] of [['R', 0], ['L', 1]]) {
    const Lg = J.legs[k], hip = xf(mR, P0['hip' + L]); let l1 = L0['hip' + L] * sz, l2 = L0['kn' + L] * sz;
    const dd = Math.hypot(Lg.ankle.x - hip.x, Lg.ankle.y - hip.y, Lg.ankle.z - hip.z), st = Math.min(1.07, Math.max(1, dd / ((l1 + l2) * 0.995))); l1 *= st; l2 *= st;
    const ik = ik2(hip, Lg.ankle, l1, l2, sub3(Lg.knee, mid3(Lg.hip, Lg.ankle)));
    const Ft = frameDir(sub3(ik.mid, hip), rH, fT); setBone(r, BIx['hip' + L], Ft, sz * st, gb(BIx['hip' + L]), hip);
    const Fs = frameDir(sub3(ik.end, ik.mid), Vx(Ft.x), fT); setBone(r, BIx['kn' + L], Fs, sz * st, gb(BIx['kn' + L]), ik.mid);
    const Fa = frameDir(sub3(Lg.toe, Lg.ankle), Vx(Fs.x), fT); setBone(r, BIx['an' + L], Fa, sz, sz, ik.end);
  }
}
// ---------------- per-player textures ----------------
const hexs = c => typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
function numberTexture(num, name, kit) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'), ppm = 1219 / 2; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
  const draw = (cx, cy, hM, sxk) => { const fs = hM * ppm / 0.72; x.save(); x.translate(cx, cy + hM * ppm / 2); x.scale(sxk, 1); x.font = `${fs}px Graduate, "Arial Black", Impact, sans-serif`; x.lineWidth = fs * 0.1; x.strokeStyle = hexs(kit.numOutline || '#000'); x.strokeText(num, 0, 0); x.fillStyle = hexs(kit.num || '#fff'); x.fillText(num, 0, 0); x.restore(); };
  const k = num.length > 1 ? 0.82 : 1; draw(128, 122, 0.2, k); draw(384, 131, 0.235, k);
  x.save(); x.translate(384, 31); const nf = 0.042 * ppm / 0.72; x.font = `700 ${nf}px "Barlow Condensed", "Arial Narrow", sans-serif`; const w = x.measureText(name).width; x.scale(Math.min(1, 165 / (w || 1)), 1); x.fillStyle = hexs(kit.num || '#fff'); x.fillText(name, 0, 0); x.restore();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const logoTex = {};
function logoTexture(team, kit) {
  const key = team.id + '|' + kit.helmet + kit.logo + kit.logo2; if (logoTex[key]) return logoTex[key];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), ppm = 256 / 0.13, D = 0.09 * ppm;
  if (typeof drawLogo === 'function') { const lc = document.createElement('canvas'); lc.width = lc.height = 256; try { drawLogo(lc.getContext('2d'), team, 256); x.drawImage(lc, 128 - D / 2, 128 - D / 2, D, D); } catch (e) { } }
  else { x.translate(128, 128); x.beginPath(); x.arc(0, 0, 0.045 * ppm, 0, 7); x.lineWidth = 0.006 * ppm; x.strokeStyle = hexs(kit.logo2); x.fillStyle = hexs(kit.logo); x.fill(); x.stroke(); x.font = `italic 800 ${0.07 * ppm}px "Barlow Condensed", Impact`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = hexs(kit.logo2); x.fillText(kit.letter || 'T', 0, 3); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return (logoTex[key] = t);
}
// ---------------- rigs ----------------
function makeRig(rp, team, kit) {
  const arch = POS_ARCH[rp.pos] || 'BACK', base = buildBody(arch), headB = buildHead(arch), helmG = buildHelm(kit.shell || 'sleek');
  const L3 = M.look3(rp, kit, arch), maskG = buildMask(L3.mask);   // the player's look: sleeves, tape, gloves, cleats, beard, eye black, mask, visor, build, gear
  const root = new THREE.Group(); root.matrixAutoUpdate = false; scene.add(root);
  const bones = M.BONES.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; root.add(b); return b; });
  const sk = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const mat = palMat(M.NS, 'standard', { roughness: 0.62, metalness: 0, skinning: true });
  setPal(mat, L3.body);
  mat.userData.decal = numberTexture(String(rp.num ?? ''), (rp.ln || '').toUpperCase().slice(0, 12), kit);
  const body = new THREE.SkinnedMesh(base.geo, mat); body.bind(sk, new THREE.Matrix4()); body.frustumCulled = false; body.castShadow = true; body.receiveShadow = true; scene.add(body);
  const gear = new THREE.Group(), hb = bones[M.BI.head]; gear.position.set(...base.J.head); hb.add(gear);
  const hm = palMat(M.NSH, 'standard', { roughness: 0.52, metalness: 0 }); setPal(hm, L3.head); const head = new THREE.Mesh(headB.geo, hm); gear.add(head);
  const shell = new THREE.Group(); shell.scale.setScalar(headB.scale); gear.add(shell);
  const helmMat = palMat(5, 'physical', { roughness: 0.28, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.06 }); setPal(helmMat, [kit.helmet, kit.hstripe, kit.hstripe2, '#141416', '#202226']); helmMat.userData.decal = logoTexture(team, kit);
  const helm = new THREE.Mesh(helmG, helmMat); helm.castShadow = true; shell.add(helm);
  const mm = new THREE.MeshStandardMaterial({ color: col(kit.mask || '#d4d8de'), roughness: 0.38, metalness: 0.45 }); const mask = new THREE.Mesh(maskG, mm); mask.castShadow = true; shell.add(mask);
  if (L3.visor) { const vz = new THREE.Mesh(buildVisor(), visorMat(L3.visor)); vz.renderOrder = 2; shell.add(vz); }
  const mats = [mat, hm, helmMat, mm]; let extra = null;
  const xg = L3.hasGear ? buildGear(arch, L3, headB.scale) : null;
  if (xg) { const xm = palMat(M.NSG, 'standard', { roughness: 0.72, metalness: 0.05, skinning: true }); setPal(xm, L3.gearPal); mats.push(xm);
    extra = new THREE.SkinnedMesh(xg, xm); extra.bind(sk, new THREE.Matrix4()); extra.frustumCulled = false; extra.castShadow = false; extra.receiveShadow = true; scene.add(extra); }
  const physSize = (rp.ht || base.heightIn) / 73, archSize = base.heightIn / 73, ratio = physSize / archSize;
  const pg = Math.sqrt(((rp.wt || 220) * 0.4536) / (95 * Math.pow(physSize, 3)));
  return { root, bones, body, gear, extra, mats, base, m: bones.map(() => new Float64Array(12)), sz: ratio, g: ratio * Math.pow(pg / base.girth, 0.9), gb: L3.girth, pid: rp.id, tid: team.id, kitKey: kitKey(kit), visible: true };
}
const kitKey = k => [k.jersey, k.trim, k.pants, k.helmet, k.num, k.shell, k.mask].join('|');
function hideRig(r, v) { r.body.visible = v; r.gear.visible = v; if (r.extra) r.extra.visible = v; r.visible = v; }
function disposeRig(r) { scene.remove(r.root); scene.remove(r.body); if (r.extra) scene.remove(r.extra); for (const m of r.mats) { if (m.userData.decal && !Object.values(logoTex).includes(m.userData.decal)) m.userData.decal.dispose(); m.dispose(); } }
// ---------------- field ----------------
// the field can be narrower (phone games): stretch the turf and move the borders to the current FIELD.halfW
const FW = { sides: [], ends: [], bands: [], half0: 26.667 * YD };
function applyWidth() { const k = FIELD.halfW / FW.half0, bw = 1.83; if (fieldMesh) fieldMesh.scale.x = k; for (const m of FW.sides) m.position.x = Math.sign(m.position.x) * (FIELD.halfW + bw / 2);
  for (const m of FW.ends) m.scale.x = (2 * FIELD.halfW + 2 * bw) / (2 * FW.half0 + 2 * bw); for (const m of FW.bands) m.position.x = Math.sign(m.position.x) * (FIELD.halfW + bw + 4.2); if (losLine) losLine.scale.x = k; if (fdLine) fdLine.scale.x = k; }
function fieldTexture(offTeam, defTeam, homeTeam, view) {
  const key = offTeam.id + '_' + defTeam.id + '_' + homeTeam.id + '_' + view + '_' + FIELD.halfW.toFixed(2); if (cache.fieldTex[key]) return cache.fieldTex[key];
  const W0 = coarse ? 1024 : 1536, Wt = Math.round(W0 * (FIELD.wk || 1)), Ht = W0 * 2.25, s = W0 / 1024, cv = document.createElement('canvas'); cv.width = Wt; cv.height = Ht; const g = cv.getContext('2d');
  const zToY = z => (z + 10 * YDm) / (120 * YDm) * Ht, xToX = x => (x + FIELD.halfW) / (2 * FIELD.halfW) * Wt, ppy = Ht / 120;
  const FONT = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';
  // turf: 5-yard mowing stripes with a soft sheen across each one
  for (let yd = 0; yd < 100; yd += 5) { const y0 = zToY(yd * YDm), a = (yd / 5) % 2, gr = g.createLinearGradient(0, y0, 0, y0 + ppy * 5); gr.addColorStop(0, a ? '#285f24' : '#357a30'); gr.addColorStop(0.5, a ? '#2b6427' : '#398034'); gr.addColorStop(1, a ? '#275c23' : '#34772f'); g.fillStyle = gr; g.fillRect(0, y0, Wt, ppy * 5 + 1); }
  // end zones: team color, an inset border, diagonal pinstripes and the name in big outlined letters (reading from the field of play)
  const ez = (y0, y1, T, rot) => { const c = T.c1 || '#1e3a8a', gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shadeC(c, -0.18)); gr.addColorStop(0.5, c); gr.addColorStop(1, shadeC(c, -0.18)); g.fillStyle = gr; g.fillRect(0, y0, Wt, y1 - y0);
    g.save(); g.beginPath(); g.rect(0, y0, Wt, y1 - y0); g.clip(); g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = -Ht; i < Wt + Ht; i += 64 * s) { g.save(); g.translate(i, y0); g.rotate(0.6); g.fillRect(0, 0, 20 * s, 900 * s); g.restore(); } g.restore();
    g.strokeStyle = T.c2 || 'rgba(255,255,255,.5)'; g.globalAlpha = 0.55; g.lineWidth = 6 * s; g.strokeRect(40 * s, y0 + 26 * s, Wt - 80 * s, y1 - y0 - 52 * s); g.globalAlpha = 1;
    const nm = (T.name || '').toUpperCase(); g.save(); g.translate(Wt / 2, (y0 + y1) / 2); g.rotate(rot); g.font = `800 ${Math.min(170 * s, 1800 * s / Math.max(5, nm.length))}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ink = lumHex(c) > 0.6 ? '#111' : '#fff', fill = T.c2 && Math.abs(lumHex(T.c2) - lumHex(c)) > 0.25 ? T.c2 : ink;
    g.lineJoin = 'round'; g.lineWidth = 18 * s; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(nm, 0, 8 * s); g.lineWidth = 9 * s; g.strokeStyle = fill === ink ? 'rgba(0,0,0,.35)' : ink; g.strokeText(nm, 0, 6 * s); g.fillStyle = fill; g.fillText(nm, 0, 6 * s); g.restore(); };
  ez(0, zToY(0), offTeam, 0); ez(zToY(100 * YDm), Ht, defTeam, Math.PI);
  // a little wear between the hashes and fine grain (the tiled detail shader does the close-up grass)
  for (let i = 0; i < 26; i++) { const yd = 8 + Math.random() * 84, y = zToY(yd * YDm), x = Wt / 2 + (Math.random() - 0.5) * 120 * s, r = (40 + Math.random() * 70) * s, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(92,96,52,.10)'); gr.addColorStop(1, 'rgba(92,96,52,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let i = 0; i < 40000 * s; i++) { const x = Math.random() * Wt, y = Math.random() * Ht; g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,220,.035)'; g.fillRect(x, y, 1.5 * s, 2.5 * s); }
  // paint: sidelines and end lines, yard lines (goal lines and the 50 wider), 1-yard ticks, hashes, try marks
  const paint = 'rgba(246,246,238,.94)'; g.fillStyle = paint;
  g.fillRect(0, 0, 7 * s, Ht); g.fillRect(Wt - 7 * s, 0, 7 * s, Ht); g.fillRect(0, 0, Wt, 7 * s); g.fillRect(0, Ht - 7 * s, Wt, 7 * s);
  for (let yd = 0; yd <= 100; yd += 5) { const w = (yd % 50 === 0 ? 7 : 4.5) * s; g.fillRect(0, zToY(yd * YDm) - w / 2, Wt, w); }
  for (let yd = 1; yd < 100; yd++) { if (yd % 5 === 0) continue; const y = zToY(yd * YDm); for (const x of [-FIELD.hashX, FIELD.hashX]) g.fillRect(xToX(x) - 8 * s, y - 1.2 * s, 16 * s, 2.4 * s); g.fillRect(5 * s, y - 1.2 * s, 15 * s, 2.4 * s); g.fillRect(Wt - 20 * s, y - 1.2 * s, 15 * s, 2.4 * s); }
  for (const yd of [3, 97]) g.fillRect(Wt / 2 - 6 * s, zToY(yd * YDm) - 1.5 * s, 12 * s, 3 * s);
  // yard numbers with the direction arrows (pointing at the nearer goal line)
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${58 * s}px ${FONT}`;
  for (let yd = 10; yd < 100; yd += 10) { const num = String(yd <= 50 ? yd : 100 - yd), y = zToY(yd * YDm);
    for (const [x, rot] of [[-FIELD.halfW + 11 * YDm, Math.PI / 2], [FIELD.halfW - 11 * YDm, -Math.PI / 2]]) { g.save(); g.translate(xToX(x), y); g.rotate(rot); g.fillStyle = paint; g.fillText(num.split('').join(' '), 0, 0);
      if (yd !== 50) { const dir = (yd < 50 ? -1 : 1) * (rot > 0 ? 1 : -1), ax = dir * 62 * s; g.beginPath(); g.moveTo(ax, -14 * s); g.lineTo(ax, -30 * s); g.lineTo(ax + dir * 14 * s, -22 * s); g.closePath(); g.fill(); }
      g.restore(); } }
  if (typeof drawLogo === 'function') { const lc = document.createElement('canvas'); lc.width = lc.height = 384; try { drawLogo(lc.getContext('2d'), homeTeam, 384); g.save(); g.globalAlpha = 0.62; g.translate(Wt / 2, zToY(50 * YDm)); if (view > 0) g.rotate(Math.PI); g.drawImage(lc, -125 * s, -125 * s, 250 * s, 250 * s); g.restore(); } catch (e) { } }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  // a field texture is a big canvas plus GPU mips: keep only the few this game flips between
  const keys = Object.keys(cache.fieldTex); if (keys.length >= 4) for (const k of keys) { if (fieldMat && fieldMat.map === cache.fieldTex[k]) continue; cache.fieldTex[k].dispose(); delete cache.fieldTex[k]; }
  return (cache.fieldTex[key] = t);
}
function shadeC(h, k) { const c = new THREE.Color(h); if (k < 0) c.multiplyScalar(1 + k); else c.lerp(new THREE.Color(1, 1, 1), k); return '#' + c.getHexString(); }
// close-up grass: blade streaks (r) and soft patchiness (g), tiled many times across the field by the field shader
function grassDetail() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), im = x.createImageData(N, N), d = im.data, blot = new Float32Array(N * N);
  for (let k = 0; k < 60; k++) { const cx = Math.random() * N, cy = Math.random() * N, r = 10 + Math.random() * 40, v = Math.random() - 0.5; for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const dd = Math.hypot(xx, yy) / r; if (dd > 1) continue; const px = (((cx + xx) % N) + N) % N | 0, py = (((cy + yy) % N) + N) % N | 0; blot[py * N + px] += v * (1 - dd * dd); } }
  for (let yy = 0; yy < N; yy++) { let run = Math.random(); for (let xx = 0; xx < N; xx++) { const i = yy * N + xx; run = run * 0.55 + Math.random() * 0.45; const blade = Math.random() < 0.08 ? 1 : run; d[i * 4] = Math.round(255 * (0.25 + 0.6 * blade)); d[i * 4 + 1] = Math.round(255 * Math.max(0, Math.min(1, 0.5 + blot[i] * 0.9))); d[i * 4 + 2] = 128; d[i * 4 + 3] = 255; } }
  x.putImageData(im, 0, 0); const c2 = document.createElement('canvas'); c2.width = c2.height = N; const x2 = c2.getContext('2d'); x2.filter = 'blur(0.6px)'; x2.drawImage(c, 0, 0); x2.filter = 'none'; x2.globalAlpha = 0.5; x2.drawImage(c, 0, 1); x2.drawImage(c, 0, -1);
  const t = new THREE.CanvasTexture(c2); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
function skyTexture() {   // night sky behind the stadium lights: deep navy overhead, warm light haze at the rim of the bowl
  const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#0d1a2e'); gr.addColorStop(0.4, '#16294a'); gr.addColorStop(0.6, '#2c4060'); gr.addColorStop(0.72, '#4a5a6e'); gr.addColorStop(1, '#1a2230');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function lumHex(h) { const c = new THREE.Color(h); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; }
function makeEnv() {
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(), g = new THREE.SphereGeometry(50, 32, 16), pos = g.attributes.position, cols = [];
  const zen = new THREE.Color(0x050a12), hor = new THREE.Color(0x1f2a3a), grd = new THREE.Color(0x0d160d);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50, c = y > 0 ? hor.clone().lerp(zen, Math.pow(y, 0.6)) : hor.clone().lerp(grd, Math.min(1, -y * 4)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff4dd }); for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 1), lamp); m.position.set(x, 26, z); m.lookAt(0, 0, 0); es.add(m); }
  const rt = pm.fromScene(es, 0.04); pm.dispose(); return rt.texture;
}
let crowdTex = null, standMats = [];
function disposeTree(o) { const seen = new Set(); o.traverse(n => { if (n.geometry && !seen.has(n.geometry)) { seen.add(n.geometry); n.geometry.dispose(); } const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : []; for (const m of ms) { if (seen.has(m)) continue; seen.add(m); if (m.map && !seen.has(m.map)) { seen.add(m.map); m.map.dispose(); } m.dispose(); } }); }
function buildStadium(home) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d'); g.fillStyle = '#0c0f14'; g.fillRect(0, 0, 512, 512);
  // muted shirts (a crowd reads as texture, it must not out-shout the players)
  const mute = h => '#' + new THREE.Color(h).lerp(new THREE.Color('#3a4250'), 0.6).getHexString();
  const shirt = [home.c1, home.c1, home.c1, home.c2 || '#e9e6dc', '#d8d4ca', '#2b3440', '#6b7a8a', '#8a2a22'].map(mute);
  for (let y = 0; y < 512; y += 32) { g.fillStyle = '#0e1116'; g.fillRect(0, y + 26, 512, 6); for (let x = 0; x < 512; x += 16) { if (Math.random() < 0.1) continue; const jx = x + (Math.random() * 3 | 0); g.fillStyle = shirt[(Math.random() * shirt.length) | 0]; g.fillRect(jx + 2, y + 12, 12, 13); g.fillStyle = ['#e9c4a2', '#c99570', '#8a5a36', '#5b3a22'][(Math.random() * 4) | 0]; g.beginPath(); g.arc(jx + 8, y + 8, 4.5, 0, 7); g.fill(); } }
  for (let y = 0; y < 512; y += 128) { g.fillStyle = '#07090c'; g.fillRect(0, y + 96, 512, 32); }        // aisles break up the grid
  { const c2 = document.createElement('canvas'); c2.width = c2.height = 512; const g2 = c2.getContext('2d'); g2.filter = 'blur(0.7px)'; g2.drawImage(cv, 0, 0); g.clearRect(0, 0, 512, 512); g.drawImage(c2, 0, 0); }
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mk = (rx, ry) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1, vertexColors: true }); standMats.push(m); return m; };
  // front rows are lit by the field lights, the back rows fall off into the dark
  const shade = (geo, axis, half, innerSign) => { const p = geo.attributes.position, cs = []; for (let i = 0; i < p.count; i++) { const t = cl01((innerSign * (axis === 0 ? p.getX(i) : p.getZ(i)) + half) / (2 * half)), v = 1 - 0.6 * t; cs.push(v, v, v); } geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); return geo; };
  const cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const grp = new THREE.Group(); grp.name = 'stadium';
  const roof = new THREE.MeshStandardMaterial({ color: col('#1b2230'), roughness: 0.9 }), bank = new THREE.MeshBasicMaterial({ color: 0xfff4dc, fog: false, toneMapped: false });
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,244,220,1)'); gr.addColorStop(0.35, 'rgba(255,236,200,.45)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const glow = (x, y, z, s) => { const sp = new THREE.Sprite(glowMat); sp.position.set(x, y, z); sp.scale.set(s, s * 0.6, 1); grp.add(sp); };
  for (const s of [-1, 1]) { const st = new THREE.Mesh(shade(new THREE.BoxGeometry(34, 0.6, 150), 0, 17, s), mk(3.4, 15)); st.rotation.z = s * 0.42; st.position.set(s * (FW.half0 + 6 + 15.5), 8.5, 50 * YDm); grp.add(st);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 150), new THREE.MeshStandardMaterial({ color: col(home.c1), roughness: 0.8 })); wall.position.set(s * (FW.half0 + 5.8), 0.8, 50 * YDm); wall.receiveShadow = true; grp.add(wall);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 150), roof); lip.position.set(s * (FW.half0 + 6 + 31.5), 16.4, 50 * YDm); grp.add(lip);
    for (let z = -6; z < 100; z += 9) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 5), bank); b.position.set(s * (FW.half0 + 6 + 30.4), 17.6, z); grp.add(b); glow(s * (FW.half0 + 6 + 30), 17.6, z, 7); } }
  for (const [z, rx] of [[FIELD.goalZ + 10 * YDm + 20, -0.42], [-10 * YDm - 20, 0.42]]) { const far = new THREE.Mesh(shade(new THREE.BoxGeometry(100, 0.6, 30), 2, 15, rx < 0 ? 1 : -1), mk(10, 3)); far.rotation.x = rx; far.position.set(0, 7.5, z); grp.add(far);
    const out = z > 0 ? 1 : -1, lip = new THREE.Mesh(new THREE.BoxGeometry(100, 2.5, 2), roof); lip.position.set(0, 15.4, z + out * 14.5); grp.add(lip);
    for (let x = -42; x <= 42; x += 7) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 0.4), bank); b.position.set(x, 16.6, z + out * 13.4); grp.add(b); glow(x, 16.6, z + out * 13, 7); } }
  const yellow = new THREE.MeshStandardMaterial({ color: col('#f2c230'), roughness: 0.4, metalness: 0.2 });
  const bar = (a, b, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), yellow), d = new THREE.Vector3().subVectors(b, a), Ln = d.length(); m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.scale.y = Ln; m.castShadow = true; grp.add(m); };
  for (const [z, dir] of [[110 * YDm, 1], [-10 * YDm, -1]]) { const Vv = (x, y, zz) => new THREE.Vector3(x, y, zz); bar(Vv(0, 0, z + dir * 1.8), Vv(0, 3.05, z + dir * 1.8), 0.13); bar(Vv(0, 3.05, z + dir * 1.8), Vv(0, 3.05, z), 0.1); bar(Vv(-2.82, 3.05, z), Vv(2.82, 3.05, z), 0.08); bar(Vv(-2.82, 3.05, z), Vv(-2.82, 9.1, z), 0.06); bar(Vv(2.82, 3.05, z), Vv(2.82, 9.1, z), 0.06); }
  const pole = new THREE.MeshStandardMaterial({ color: col('#8a929c'), roughness: 0.6, metalness: 0.5 });
  const lampTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#2a2f36'; x.fillRect(0, 0, 128, 64); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const gr = x.createRadialGradient(16 + i * 32, 11 + j * 21, 0, 16 + i * 32, 11 + j * 21, 10); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.6, '#ffe9c4'); gr.addColorStop(1, 'rgba(255,233,196,0)'); x.fillStyle = gr; x.fillRect(i * 32, j * 21, 32, 22); } const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
  for (const [x, z] of [[-48, -12], [48, -12], [-48, 104], [48, 104]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 34, 8), pole); p.position.set(x, 17, z); grp.add(p); const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 0.6), new THREE.MeshBasicMaterial({ map: lampTex, fog: false, toneMapped: false })); panel.position.set(x, 35, z); panel.lookAt(0, 0, 45); grp.add(panel); glow(x, 35, z, 16); }
  return grp;
}
// ---------------- particles ----------------
const PN = 420; let pPos, pVel, pLife, pGeo, pNext = 0;
function initParticles() { pPos = new Float32Array(PN * 3); pVel = new Float32Array(PN * 3); pLife = new Float32Array(PN); pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const c = new Float32Array(PN * 3), dirt = col('#4d3d29'), turf = col('#3a7330'); for (let i = 0; i < PN; i++) { const cc = i % 2 ? turf : dirt; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; pPos[i * 3 + 1] = -10; } pGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32; { const x = dot.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); }
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, sizeAttenuation: true, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false })); pts.frustumCulled = false; scene.add(pts); }
function spray(x, z, n, speed, dirx = 0, dirz = 0) { for (let k = 0; k < n; k++) { const i = pNext; pNext = (pNext + 1) % PN; const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7); pPos[i * 3] = x + (Math.random() - 0.5) * 0.15; pPos[i * 3 + 1] = 0.02; pPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.15; pVel[i * 3] = Math.cos(a) * s * 0.5 + dirx * s; pVel[i * 3 + 1] = 1 + Math.random() * 2.2 * speed / 2; pVel[i * 3 + 2] = Math.sin(a) * s * 0.5 + dirz * s; pLife[i] = 1.2; } }
function stepParticles(dt) { for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; pVel[i * 3 + 1] -= 9.81 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; if (pPos[i * 3 + 1] < 0.01) { pPos[i * 3 + 1] = 0.01; pVel[i * 3] *= 0.3; pVel[i * 3 + 2] *= 0.3; pVel[i * 3 + 1] = 0; } if (pLife[i] <= 0) pPos[i * 3 + 1] = -10; } pGeo.attributes.position.needsUpdate = true; }
// ---------------- pre-snap overlays (routes, run lanes, zones) ----------------
let overlay = null;
function clearOverlay() { if (overlay) { scene.remove(overlay); overlay.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); overlay = null; } }
function drawOverlay(play, side) {
  clearOverlay(); overlay = new THREE.Group(); const y = 0.03;
  const line = (pts, color, dashed) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, y, p.z))); const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.35, linewidth: 2, transparent: true, opacity: 0.95 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }); const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); overlay.add(l); };
  const ribbon = (pts, color, w) => { if (pts.length < 2) return; const pos = [], idx = []; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w, nz = dx / l * w; pos.push(pts[i].x + nx, y, pts[i].z + nz, pts[i].x - nx, y, pts[i].z - nz); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); overlay.add(m);
    const e = pts[pts.length - 1], p2 = pts[pts.length - 2], dx = e.x - p2.x, dz = e.z - p2.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, hw = w * 3.2; const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([e.x + ux * hw * 1.4, y, e.z + uz * hw * 1.4, e.x - uz * hw, y, e.z + ux * hw, e.x + uz * hw, y, e.z - ux * hw], 3)); overlay.add(new THREE.Mesh(tg, m.material)); };
  if (side === 'O') {
    for (const r of play.receivers) if (r.route && r.route.length) ribbon([{ x: r.p.x, z: r.p.z }].concat(r.route), 0xffe066, 0.09);
    if (play.op.type === 'run') { const rb = play.O.find(p => p.role === 'rb') || play.qb; ribbon([{ x: rb.p.x, z: rb.p.z }, { x: play.gapX, z: play.losZ - 0.4 }, { x: play.gapX, z: play.losZ + 4.5 }], 0xff5a5a, 0.11); }
    for (const b of play.O) if (b.ol && b.asg) { const a = b.asg, dx = -(a.d || 0), pts = a.t === 'pull' ? [{ x: b.p.x, z: b.p.z }, { x: b.p.x, z: b.p.z - 1 }, { x: play.gapX, z: play.losZ - 0.6 }, { x: play.gapX, z: play.losZ + 1.5 }] : a.t === 'pass' ? [{ x: b.p.x, z: b.p.z }, { x: b.p.x, z: b.p.z - 1.6 }] : a.t === 'climb' ? [{ x: b.p.x, z: b.p.z }, { x: b.p.x, z: b.p.z + 4.2 }] : [{ x: b.p.x, z: b.p.z }, { x: b.p.x + dx * 1.6, z: b.p.z + 1.7 }];
      ribbon(pts, a.t === 'pull' ? 0xff9b4a : a.t === 'pass' ? 0x9fd0ff : 0xffffff, 0.06); }
  } else {
    for (const d of play.D) {
      if (d.zone) { const r = d.zone.deep ? 4.5 : 3.2, ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r, 48), new THREE.MeshBasicMaterial({ color: d.zone.deep ? 0x5fb4ff : 0xffe066, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(d.zone.x, y, d.zone.z); overlay.add(ring); ribbon([{ x: d.p.x, z: d.p.z }, { x: d.zone.x, z: d.zone.z }], d.zone.deep ? 0x5fb4ff : 0xffe066, 0.04); }
      else if (d.job === 'man' && d.cover) ribbon([{ x: d.p.x, z: d.p.z }, { x: d.cover.p.x, z: d.cover.p.z + 0.4 }], 0xd08cff, 0.04);
      else if (d.job === 'rush' && !d.dl) ribbon([{ x: d.p.x, z: d.p.z }, { x: play.qb.p.x, z: play.losZ - 0.8 }], 0xff5a5a, 0.08);
    }
  }
  scene.add(overlay);
}
// ---------------- public API ----------------
const camPos = new THREE.Vector3(0, 6, 10), camLook = new THREE.Vector3(0, 1, 20), _ax = new THREE.Vector3(), _z1 = new THREE.Vector3(0, 0, 1), _q = new THREE.Quaternion(); let shake = 0, lastField = '', estT = 0;
const CAM0 = { view: 'behind', height: 0.32, zoom: 0.6, flipD: false }, clamp01 = v => Math.max(0, Math.min(1, +v || 0)), AIMN = 26, AIMR = 49; let fitK = 1, panX = 0, panZ = 0, aimNow = null, fitCam = null, fitV = null, aimDots = null, aimRing = null, aimRingMat = null, aimRange = null, kaTri = null, kaE1 = null, kaE2 = null, kaNeedle = null;
const R = {
  init(canvas) {
    coarse = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse || devicePixelRatio < 2, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.6 : 2)); renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = skyTexture(); scene.fog = new THREE.Fog(col('#22324a'), 60, 190); camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    scene.environment = makeEnv();
    hemi = new THREE.HemisphereLight(0xe8f0ff, 0x30481f, 0.32); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1dc, 1.75); sun.castShadow = true; sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.5); fill.position.set(20, 25, 60); scene.add(fill);
    const c = document.createElement('canvas'); c.width = c.height = 4; BLANK = new THREE.CanvasTexture(c);
    fieldMat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 }); fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * FW.half0, 120 * YDm), fieldMat); fieldMesh.rotation.x = -Math.PI / 2; fieldMesh.position.set(0, 0, 50 * YDm); fieldMesh.receiveShadow = true; scene.add(fieldMesh);
    { const det = grassDetail();
      const addDetail = (m, rx, ry) => { m.onBeforeCompile = sh => { sh.uniforms.tDetail = { value: det };
        sh.fragmentShader = 'uniform sampler2D tDetail;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n  vec2 dUv = vUv * vec2(' + rx.toFixed(1) + ', ' + ry.toFixed(1) + '); float gb = texture2D(tDetail, dUv).r, gp = texture2D(tDetail, dUv * 0.17).g;\n  diffuseColor.rgb *= (0.86 + 0.26 * gb) * (0.9 + 0.2 * gp);\n#endif\n'); };
        m.customProgramCacheKey = () => 'grass' + rx; };
      addDetail(fieldMat, 24, 54); fieldMat.color.setScalar(0.78);
      // the apron (same grass), the white border outside the sidelines and end lines, then the home team's sideline band
      const tx = document.createElement('canvas'); tx.width = tx.height = 8; const tg = tx.getContext('2d'); tg.fillStyle = '#2a5a26'; tg.fillRect(0, 0, 8, 8); const apT = new THREE.CanvasTexture(tx); apT.encoding = THREE.sRGBEncoding;
      const apMat = new THREE.MeshStandardMaterial({ map: apT, roughness: 1 }); addDetail(apMat, 90, 130); apMat.color.setScalar(0.72);
      const apron = new THREE.Mesh(new THREE.PlaneGeometry(220, 320), apMat); apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.01, 50 * YDm); apron.receiveShadow = true; scene.add(apron);
      const white = new THREE.MeshStandardMaterial({ color: col('#eeeee6'), roughness: 0.9 }), bw = 1.83, L0 = 120 * YDm + 2 * bw;
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, L0), white); m.rotation.x = -Math.PI / 2; m.position.set(sx * (FIELD.halfW + bw / 2), 0.004, 50 * YDm); m.receiveShadow = true; FW.sides.push(m); scene.add(m); }
      for (const z of [-10 * YDm - bw / 2, 110 * YDm + bw / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * FW.half0 + 2 * bw, bw), white); FW.ends.push(m); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.004, z); m.receiveShadow = true; scene.add(m); }
      sideMat = new THREE.MeshStandardMaterial({ color: col('#1d4f8a'), roughness: 0.85 });
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 50 * YDm), sideMat); m.rotation.x = -Math.PI / 2; m.position.set(sx * (FIELD.halfW + bw + 4.2), 0.003, 50 * YDm); m.receiveShadow = true; FW.bands.push(m); scene.add(m); } }
    losLine = new THREE.Mesh(new THREE.PlaneGeometry(2 * FW.half0, 0.13), new THREE.MeshBasicMaterial({ color: 0x5fa8ff, transparent: true, opacity: 0.85 })); losLine.rotation.x = -Math.PI / 2; losLine.position.y = 0.012; scene.add(losLine);
    fdLine = new THREE.Mesh(new THREE.PlaneGeometry(2 * FW.half0, 0.15), new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.9 })); fdLine.rotation.x = -Math.PI / 2; fdLine.position.y = 0.014; scene.add(fdLine);
    // ball
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.086 * Math.pow(Math.sin(Math.PI * t), 0.8), 0.28 * (t - 0.5))); }
    const bgeo = new THREE.LatheGeometry(pts, 20); bgeo.rotateX(Math.PI / 2); bgeo.computeVertexNormals(); ballG = new THREE.Group(); const bm = new THREE.Mesh(bgeo, new THREE.MeshStandardMaterial({ color: col('#7a3b1a'), roughness: 0.5 })); bm.castShadow = true; ballG.add(bm);
    const lm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), lace = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.085), lm); lace.position.set(0, 0.084, 0); ballG.add(lace); scene.add(ballG);
    ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }); ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40), ringMat); ringMesh.rotation.x = -Math.PI / 2; ringMesh.visible = false; scene.add(ringMesh);
    tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); tgtRing.rotation.x = -Math.PI / 2; tgtRing.visible = false; scene.add(tgtRing);
    { const dc = document.createElement('canvas'); dc.width = dc.height = 64; const x = dc.getContext('2d'); x.beginPath(); x.arc(32, 32, 22, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 7; x.strokeStyle = 'rgba(20,24,32,.7)'; x.stroke();
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AIMN * 3), 3));
      aimDots = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.42, map: new THREE.CanvasTexture(dc), transparent: true, depthTest: false, depthWrite: false, color: 0xffe066, sizeAttenuation: true })); aimDots.frustumCulled = false; aimDots.visible = false; aimDots.renderOrder = 20; scene.add(aimDots);
      aimRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, side: THREE.DoubleSide }); aimRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.12, 44), aimRingMat); aimRing.rotation.x = -Math.PI / 2; aimRing.visible = false; aimRing.renderOrder = 19; scene.add(aimRing);
      // the QB's arm: a faint arc at the farthest he can throw it
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AIMR * 3), 3));
      aimRange = new THREE.Line(rg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false })); aimRange.frustumCulled = false; aimRange.visible = false; aimRange.renderOrder = 18; scene.add(aimRange); }
    initParticles(); this.resize(); addEventListener('resize', () => this.resize());
  },
  resize() { if (!renderer) return; const c = renderer.domElement; W = c.clientWidth || innerWidth; H = c.clientHeight || innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); },
  // build every body shape this game needs before kickoff (slow part), reporting progress
  async prepare(players, kits, home, onProgress) {
    const need = new Set(), shells = new Set(), masks = new Set();
    for (const p of players) { need.add(POS_ARCH[p.pos] || 'BACK'); masks.add(M.maskStyle(p)); }
    for (const k of kits) shells.add(k.shell || 'sleek');
    const meshes = []; for (const a of need) meshes.push(['body', a], ['head', a]); for (const s of shells) meshes.push(['helm', s]);
    const todo = []; for (const [kind, name] of meshes) { const k = meshKey(kind, name); if (outs[k]) continue; const got = await idbGet(k); if (got && got.count) outs[k] = got; else todo.push([kind, name, k]); }
    const weight = kind => kind === 'head' ? 0.2 : 1, total = todo.reduce((s, t) => s + weight(t[0]), 0) || 1; let doneW = 0;
    for (const [kind, name, k] of todo) { if (onProgress) onProgress(doneW / total, true); await new Promise(r => setTimeout(r, 16)); outs[k] = makers[kind](name); idbPut(k, outs[k]); doneW += weight(kind); }
    for (const a of need) { buildBody(a); buildHead(a); } for (const s of shells) buildHelm(s); for (const m of masks) buildMask(m);
    for (const p of players) { const a = POS_ARCH[p.pos] || 'BACK', L3 = M.look3(p, {}, a); if (L3.hasGear) buildGear(a, L3, cache.head[a].scale); }   // gear meshes now, not mid-play
    if (onProgress) onProgress(1, todo.length > 0);
    const old = scene.getObjectByName('stadium'); if (old) { scene.remove(old); disposeTree(old); } standMats.length = 0; scene.add(buildStadium(home));
  },
  applyWidth() { applyWidth(); },
  _dbg() { return { fitK, sides: FW.sides.map(m => +m.position.x.toFixed(2)), bands: FW.bands.map(m => +m.position.x.toFixed(2)), fieldScale: fieldMesh && fieldMesh.scale.x, cam: camera.position.toArray().map(v => +v.toFixed(1)), fov: camera.fov }; },
  // sync the rigs to the players in a play (creates rigs for new pids, hides pids that left the field)
  setPlayers(play, teamOf, kitOf) {
    const live = new Set();
    for (const p of play.players) { const rp = p.rp; let r = rigs.get(rp.id); const T = teamOf(p.unit), kit = kitOf(p.unit);
      if (r && r.kitKey !== kitKey(kit)) { disposeRig(r); rigs.delete(rp.id); r = null; }
      if (!r) { r = makeRig(rp, T, kit); rigs.set(rp.id, r); } hideRig(r, true); p._rig = r; live.add(rp.id); }
    for (const [pid, r] of rigs) if (!live.has(pid) && r.visible) hideRig(r, false);
  },
  // end of a game: release every per-game GPU resource (rigs, number decals, field textures, helmet logos)
  clearPlayers() { for (const r of rigs.values()) disposeRig(r); rigs.clear(); for (const g of gearGeo.values()) if (g) g.dispose(); gearGeo.clear();
    for (const k in cache.fieldTex) { if (fieldMat && fieldMat.map === cache.fieldTex[k]) { fieldMat.map = null; fieldMat.needsUpdate = true; } cache.fieldTex[k].dispose(); delete cache.fieldTex[k]; } lastField = '';
    for (const k in logoTex) { logoTex[k].dispose(); delete logoTex[k]; } },
  setField(offTeam, defTeam, homeTeam, losZ, fdZ, goal, view = 1) {
    if (sideMat && homeTeam && homeTeam.c1) sideMat.color.set(homeTeam.c1);
    const key = offTeam.id + '_' + defTeam.id + '_' + view; if (key !== lastField) { fieldMat.map = fieldTexture(offTeam, defTeam, homeTeam, view); fieldMat.needsUpdate = true; lastField = key; }
    losLine.position.z = losZ; fdLine.position.z = fdZ; fdLine.visible = !goal;
  },
  overlay(play, side) { if (!play) { clearOverlay(); return; } drawOverlay(play, side); },
  // draw the play. opts: {ctl: player|null, target: player|null, camMode:'O'|'D', snapCam}
  draw(play, dt, opts = {}) {
    if (play) {
      play.updatePoses();
      for (const p of play.players) { const r = p._rig; if (r) updateSkin(r, play.poses[p.id]); }
      const b = play.ball; if (b && b.p) { ballG.visible = true; ballG.position.set(b.p.x, b.p.y, b.p.z); ballG.scale.setScalar(opts.bigBall ? 1.9 : 1); if (b.state !== 'loose' && b.axis) { _ax.set(b.axis.x, b.axis.y, b.axis.z).normalize(); ballG.quaternion.setFromUnitVectors(_z1, _ax); if (b.state === 'air') ballG.quaternion.multiply(_q.setFromAxisAngle(_z1, (b.rot && b.rot.z) || 0)); } else if (b.rot) ballG.rotation.set(b.rot.x, b.rot.y, b.rot.z); } else if (ballG) ballG.visible = false;
      const c = opts.ctl; ringMesh.visible = !!c; if (c) { ringMesh.position.set(c.p.x, 0.02, c.p.z); ringMat.color.set(c.unit === 'O' ? 0xf2c230 : 0x5fd3ff); }
      const t = opts.target; tgtRing.visible = !!t; if (t) tgtRing.position.set(t.x, 0.025, t.z);
      for (const e of play.fx) { if (e.kind === 'hit' && e.at) { spray(e.at.x, e.at.z, Math.round(Math.min(34, Math.max(6, e.j / 25))), 2.2); shake = Math.max(shake, Math.min(0.6, Math.max(0.04, e.j / 900))); } if (e.kind === 'land' && e.at) { spray(e.at.x, e.at.z, Math.round(Math.min(30, Math.max(8, e.j / 20))), 1.8); shake = Math.max(shake, Math.min(0.25, e.j / 1600)); } }
      if (opts.consumeFx !== false) play.fx.length = 0;
      for (const p of play.players) if (p.upright() && p.gripUse > 0.85 && Math.hypot(p.vel.x, p.vel.z) > 4) for (const f of p.feet) if (f.planted && Math.random() < 0.2) spray(f.x, f.z, 2, 1.4, -p.acc.x / 12, -p.acc.z / 12);
      this.follow(play, dt, opts);
    }
    else { estT += dt; const a = estT * 0.05; camPos.set(-38 * Math.cos(a), 17, 46 + 38 * Math.sin(a) * 0.6); camLook.set(0, 0, 46); camera.position.copy(camPos); camera.lookAt(camLook); camera.fov = H > W ? 62 : 48; camera.updateProjectionMatrix(); }
    stepParticles(dt);
    sun.target.position.copy(camLook); sun.position.copy(camLook).add(new THREE.Vector3(-16, 32, -10)); sun.target.updateMatrixWorld();
    renderer.render(scene, camera);
  },
  // the user's camera: view ('behind' the offense or 'side'line), height 0..1 (camera pitch), zoom 0..1 (distance), flipD (sit behind your defense when defending)
  follow(play, dt, opts) {
    const portrait = H > W, b = play.ball, c = play.carrier, J = c ? play.poses[c.id] : null, S = Object.assign({}, CAM0, R3D.cam || {}), side = S.view === 'side';
    const onD = opts.camMode === 'D', dirZ = onD && S.flipD && !side ? -1 : 1;
    const pocket = play.pass && !play.thrown && c === play.qb && play.ball.state !== 'loose' && (!J || J.pelvis.z < play.losZ + 1);
    // where the camera looks: the ball / carrier, with room ahead of him
    let lx, lz;
    if (b.state === 'air' && b.land) { lx = lerp3(b.p.x, b.land.x, 0.65); lz = lerp3(b.p.z, b.land.z, 0.65); }
    else if (b.state === 'loose' || !J) { lx = b.p.x; lz = b.p.z; }
    else { lx = J.pelvis.x; lz = J.pelvis.z; }
    const wide = pocket || b.state === 'air' || play.phase === 'pre';
    const pitch = (10 + 72 * clamp01(S.height)) * Math.PI / 180;
    // frame by anchoring a player at a fixed spot on screen, whatever the height and zoom: fy = how far down the screen (behind view), fx = how far across (sideline view)
    const fov = portrait ? 64 : 50, tv = Math.tan(fov * Math.PI / 360), th = tv * (W / H);
    const ph = !!R3D.phone, baseD = 62 * Math.pow(7 / 62, clamp01(S.zoom)) * (wide ? 1.12 : 0.88) * (portrait ? 1.12 : 1) * (ph ? 0.92 : 1) * (opts.zoom || 1);
    const f = opts.focus, lx0 = lx, lz0 = lz;
    // aim pan (camera setting): while you aim a pass, the camera slides toward where you're aiming so you see more of that side.
    // It slides and never turns, so the aim (worked out from the camera's facing) stays put under your finger.
    const A = S.pan !== false && pocket && aimNow && aimNow.L && play.qb ? aimNow : null, reach = baseD * fitK * th, cl = (v, a, b) => Math.max(a, Math.min(b, v));
    let tpx = 0, tpz = 0;
    if (A) { if (side) tpz = cl((A.L.z - play.qb.p.z) * 0.4, -reach * 0.15, reach * 0.42); else tpx = cl((A.L.x - play.qb.p.x) * 0.62, -reach * 0.5, reach * 0.5); }
    // the camera for a given zoom-out factor fk (auto-fit raises fk until everyone who matters is on screen)
    const place = (fk, wp) => {
      const dist = baseD * fk, hd = dist * Math.cos(pitch), up = dist * Math.sin(pitch); let lx = lx0, lz = lz0;
      const atY = (z, fy) => z + dirZ * (hd - up / Math.tan(Math.max(0.035, Math.min(1.55, pitch + Math.atan((fy - 0.5) * 2 * tv))))), atX = (z, fx) => z + (0.5 - fx) * 2 * dist * th;
      const anchor = (z, fy, fx) => (side ? atX(z, fx) : atY(z, fy));
      if (play.ret && play.phase === 'pre') { lx = play.ret.kickX * 0.5; lz = anchor(play.ret.kickZ, 0.3, 0.7); }
      else if (play.ret && b.state === 'air' && b.land) { lx = b.land.x * 0.7; lz = anchor(b.land.z, 0.64, 0.32); }
      else if (play.phase === 'pre') { lx = play.ballX * 0.6; const L0 = dirZ > 0 ? play.O : play.D, deep = L0.length ? (dirZ > 0 ? Math.min(...L0.map(p => p.p.z)) : Math.max(...L0.map(p => p.p.z))) : play.losZ - 4 * dirZ; lz = side ? atX(play.losZ, 0.45) : atY(deep, onD ? 0.88 : 0.84); }
      else if (pocket) { lx *= 0.55; lz = anchor(c.p.z, onD ? 0.8 : 0.76, 0.3); }
      else if (c && b.state === 'held') { lx += c.vel.x * 0.3; const fw = c.unit === 'O' ? 1 : -1; lz = anchor(c.p.z + c.vel.z * 0.25, fw * dirZ > 0 ? 0.64 : 0.4, fw > 0 ? 0.38 : 0.62); }
      // keep the player you control on screen (defense): lean the view toward him
      if (f && f.p) { const w = play.phase === 'pre' ? 0.2 : 0.35; lx = lerp3(lx, f.p.x, w); lz = lerp3(lz, f.p.z, w); }
      lx = Math.max(-FIELD.halfW - 2, Math.min(FIELD.halfW + 2, lx));
      const ox = wp ? panX : 0, oz = wp ? panZ : 0;
      return { want: side ? new THREE.Vector3(lx * 0.55 - hd + ox, 0.6 + up, lz + oz) : new THREE.Vector3(lx * 0.85 + ox, 0.6 + up, lz - hd * dirZ + oz), look: new THREE.Vector3(lx + ox, 0.6, lz + oz) };
    };
    // auto-fit: before the snap and while the QB holds it, every receiver stays on screen (even the one split out wide); on defense, the man you control does too
    const pts = []; if (S.fit !== false && !play.ret && (play.phase === 'pre' || pocket) && play.O) for (const p of play.O) if (!p.ol && p.p && !(Math.abs(panX) > 1 && play.qb && (p.p.x - play.qb.p.x) * Math.sign(panX) < -3)) pts.push(ph ? [p.p.x, 1, p.p.z, -0.04, 1.04, 0.1, 0.92] : [p.p.x, 1, p.p.z, 0.03, 0.97, 0.1, 0.92]);     // phone: a wide man may sit on the edge (his tag is pinned there), players stay big
    if (f && f.p) pts.push([f.p.x, 1, f.p.z, 0.08, 0.8, 0.14, 0.8]);
    let need = 1;
    if (pts.length) {
      fitCam = fitCam || new THREE.PerspectiveCamera(); fitV = fitV || new THREE.Vector3();
      const fits = fk => { const P = place(fk, true); fitCam.fov = fov; fitCam.aspect = W / H; fitCam.near = camera.near; fitCam.far = camera.far; fitCam.position.copy(P.want); fitCam.lookAt(P.look); fitCam.updateProjectionMatrix(); fitCam.updateMatrixWorld();
        for (const q of pts) { fitV.set(q[0], q[1], q[2]).project(fitCam); const sx = fitV.x * 0.5 + 0.5, sy = -fitV.y * 0.5 + 0.5; if (fitV.z > 1 || sx < q[3] || sx > q[4] || sy < q[5] || sy > q[6]) return false; } return true; };
      if (!fits(1)) { let lo = 1, hi = ph ? 1.6 : portrait ? 3.4 : 2.6; if (fits(hi)) { for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; } } need = hi; }
    }
    const snap = opts.snapCam || R3D.snapNext || !isFinite(camPos.x + camPos.y + camPos.z + camLook.x + camLook.z); R3D.snapNext = false;
    { const kp = snap ? 1 : 1 - Math.exp(-dt * 3); panX += (tpx - panX) * kp; panZ += (tpz - panZ) * kp; }
    fitK = snap ? need : need > fitK ? fitK + (need - fitK) * (1 - Math.exp(-dt * 3.5)) : Math.max(need, fitK - dt * 0.35);
    const { want, look } = place(fitK);
    if (!isFinite(want.x + want.y + want.z + look.x + look.z)) return;          // never let a bad frame poison the camera
    const k = snap ? 1 : 1 - Math.exp(-dt * 4.5);
    camPos.lerp(want, k); camLook.lerp(look, snap ? 1 : 1 - Math.exp(-dt * 6));
    camera.position.set(camPos.x + panX, camPos.y, camPos.z + panZ); camera.lookAt(camLook.x + panX, camLook.y, camLook.z + panZ);
    camera.fov = fov; camera.updateProjectionMatrix();
    if (R3D.camOverride) { const d = R3D.camOverride; camera.position.set(...d.pos); camera.lookAt(...d.look); camera.fov = d.fov || 40; camera.updateProjectionMatrix(); return; }   // QA close-ups
    if (shake > 0.002) { camera.position.x += (Math.random() - 0.5) * shake * 0.35; camera.position.y += (Math.random() - 0.5) * shake * 0.25; shake *= Math.exp(-dt * 7); }
  },
  // the passing aim line: a dotted arc along the real flight, and a ring where it comes down (green if a receiver can get there)
  aim(a) {
    aimNow = a || null;
    if (!aimDots) return;
    if (!a) { aimDots.visible = false; aimRing.visible = false; if (aimRange) aimRange.visible = false; return; }
    const P = aimDots.geometry.attributes.position.array, n = AIMN, ph = (performance.now() / 600) % 1;
    for (let i = 0; i < n; i++) { const t = a.T * Math.min(1, (i + ph) / n); P[i * 3] = a.hand.x + a.v.x * t; P[i * 3 + 1] = Math.max(0.05, a.hand.y + a.v.y * t - 4.905 * t * t); P[i * 3 + 2] = a.hand.z + a.v.z * t; }
    aimDots.geometry.attributes.position.needsUpdate = true; aimDots.visible = true;
    aimDots.material.color.set(a.capped ? 0xff9a3c : a.hit ? 0xffe066 : 0xffffff);
    // the landing ring is the QB's accuracy: an accurate passer's ring is tight, a scattershot arm's is wide (and it grows under pressure, on the move, at the end of his range)
    const rs = a.sigma ? Math.max(0.55, Math.min(3.4, a.sigma * 1.15)) : 1; aimRing.scale.set(rs, rs, 1);
    aimRing.position.set(a.L.x, 0.035, a.L.z); aimRing.visible = true; aimRingMat.color.set(a.capped ? 0xff9a3c : a.hit ? 0x5ef08a : 0xffffff); aimRingMat.opacity = a.hit ? 0.95 : 0.6;
    if (aimRange && a.max && a.q) { const R = aimRange.geometry.attributes.position.array, c0 = Math.atan2(a.L.x - a.q.x, a.L.z - a.q.z);
      for (let i = 0; i < AIMR; i++) { const th = c0 + (i / (AIMR - 1) - 0.5) * 1.6; R[i * 3] = a.q.x + Math.sin(th) * a.max; R[i * 3 + 1] = 0.05; R[i * 3 + 2] = a.q.z + Math.cos(th) * a.max; }
      aimRange.geometry.attributes.position.needsUpdate = true; aimRange.visible = true; aimRange.material.color.set(a.capped ? 0xff9a3c : 0xffffff); aimRange.material.opacity = a.capped ? 0.85 : 0.4; }
  },
  // field goal aim: the make-zone triangle on the grass from the ball to the two uprights (long and thin from far out) and the sweeping needle
  kickAim(a) {
    if (!a) { if (kaTri) kaTri.visible = kaE1.visible = kaE2.visible = kaNeedle.visible = false; return; }
    if (!kaTri) {
      const mk = (col, op, ro) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); g.setIndex([0, 1, 2, 2, 1, 3]); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthTest: false, depthWrite: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = ro; scene.add(m); return m; };
      kaTri = mk(0x3ecf8e, 0.3, 17); kaE1 = mk(0x7dffb5, 0.9, 18); kaE2 = mk(0x7dffb5, 0.9, 18); kaNeedle = mk(0xffffff, 0.95, 19);
    }
    const y = 0.06, quad = (m, x0, z0, x1, z1, w0, w1) => { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, P = m.geometry.attributes.position.array;
      P.set([x0 + nx * w0, y, z0 + nz * w0, x0 - nx * w0, y, z0 - nz * w0, x1 + nx * w1, y, z1 + nz * w1, x1 - nx * w1, y, z1 - nz * w1]); m.geometry.attributes.position.needsUpdate = true; m.geometry.computeBoundingSphere(); m.visible = true; };
    { const P = kaTri.geometry.attributes.position.array; P.set([a.ax, y, a.az, a.ax, y, a.az, -a.px, y, a.pz, a.px, y, a.pz]); kaTri.geometry.attributes.position.needsUpdate = true; kaTri.geometry.computeBoundingSphere(); kaTri.visible = true; }
    quad(kaE1, a.ax, a.az, -a.px, a.pz, 0.05, 0.12); quad(kaE2, a.ax, a.az, a.px, a.pz, 0.05, 0.12);
    const L = (a.pz + 10 - a.az) / Math.max(0.2, Math.cos(a.theta)); quad(kaNeedle, a.ax, a.az, a.ax + Math.sin(a.theta) * L, a.az + Math.cos(a.theta) * L, 0.04, 0.22);
    kaNeedle.material.color.set(a.inside ? 0xffe066 : 0xffffff); kaTri.material.opacity = a.inside ? 0.42 : 0.26;
  },
  // camera forward/right on the ground plane (for screen-relative stick input)
  basis() { const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, 1); f.normalize(); return { fx: f.x, fz: f.z, rx: -f.z, rz: f.x }; },
  snapCamera(play, opts) { this.follow(play, 1, Object.assign({}, opts, { snapCam: true })); },
  project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, behind: v.z > 1 }; },
  stats() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, rigs: rigs.size, bodies: Object.keys(cache.body).length }; },
  get coarse() { return coarse; },
};
Object.assign(R3D, R); Object.defineProperty(R3D, 'coarse', { get: () => coarse, configurable: true });
})();
