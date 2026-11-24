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
// Every player part is one mesh whose vertices carry weights over a palette of colour slots (10_models.js). The shader mixes the slot
// colours and, per slot, the surface (roughness, jersey knit, pants twill, rib knit, skin), then adds what makes a kit look made rather
// than rendered: a tiled fabric texture in rest space, crisp kit stripes drawn from the mesh's design coordinates, seams and stitching,
// baked occlusion, a soft cloth sheen instead of a plastic highlight, raised twill numbers, and dirt / grass that builds up in the game.
// variant: 'body' (players' bodies), 'helm' (shell stripes, finish, scuffs), 'head' (skin), 'gear' (hair, towels, pads).
const UK_N = { body: 34, helm: 5, head: 1, gear: 1 };
const GLSL_FN = `
float pcLine(float d, float w) { float fw = fwidth(d) + 1e-6; return clamp((w - abs(d)) / fw + 0.5, 0.0, 1.0) * clamp(2.0 * w / fw, 0.0, 1.0); }
vec3 pcBand(vec3 base, float d, vec3 w, vec4 c1, vec4 c2, vec4 c3, float m) {
  float fw = fwidth(d) * 0.75 + 1e-5;
  float i1 = (1.0 - smoothstep(w.x - fw, w.x + fw, d)) * step(1e-6, w.x), i2 = (1.0 - smoothstep(w.y - fw, w.y + fw, d)) * step(1e-6, w.y), i3 = (1.0 - smoothstep(w.z - fw, w.z + fw, d)) * step(1e-6, w.z);
  base = mix(base, c3.rgb, max(i3 - i2, 0.0) * c3.w * m); base = mix(base, c2.rgb, max(i2 - i1, 0.0) * c2.w * m); return mix(base, c1.rgb, i1 * c1.w * m); }
vec3 pcPerturb(vec3 sp, vec3 n, vec2 dH, float fd) { vec3 sx = dFdx(sp), sy = dFdy(sp), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1) * fd; vec3 g = sign(det) * (dH.x * r1 + dH.y * r2); return normalize(abs(det) * n - g); }
vec4 pcTri(vec3 p, vec3 nn) { vec3 w = abs(nn); w *= w; w *= w; w /= (w.x + w.y + w.z + 1e-5); return texture2D(fabTex, p.zy) * w.x + texture2D(fabTex, p.xz) * w.y + texture2D(fabTex, p.xy) * w.z; }
`;
// body: kit designs from uK (layout in setBodyKit), decal = numbers + name + TV numbers
const FRAG_BODY = `
float pcSkin = clamp(vPal.w, 0.0, 1.0), pcKnit = vMat.y, pcTwill = vMat.z, pcRib = vMat.w, pcFab = clamp(pcKnit + pcTwill + pcRib, 0.0, 1.0);
vec4 fx = pcTri(vRest * 4.0, vRN);
vec3 pcC = vPal.rgb, rn = normalize(vRN); float ax = abs(vRest.x), py = vRest.y, pside = vRest.x >= 0.0 ? 1.0 : -1.0, beltM = 0.0, fwy = fwidth(py) * 0.75 + 1e-5;
// crisp garment edges in rest space (the slot blend is only as sharp as the 2 cm mesh): jersey / belt / pants at the waist, pants / socks at the knee, socks / ankle
{ float z = step(ax, 0.2) * (1.0 - smoothstep(0.03, 0.045, abs(py - uK[24].w))); if (z > 0.0) { float isJ = smoothstep(uK[24].w + 0.0115 - fwy, uK[24].w + 0.0115 + fwy, py), isB = smoothstep(uK[24].w - 0.0115 - fwy, uK[24].w - 0.0115 + fwy, py) - isJ, isP = 1.0 - isJ - isB;
  pcC = mix(pcC, uK[25].rgb * isJ + uK[24].rgb * isB + uK[26].rgb * isP, z); pcKnit = mix(pcKnit, isJ, z); pcTwill = mix(pcTwill, isP, z); pcRib *= 1.0 - z; beltM = isB * z; } }
{ float z = step(py, 0.8) * (1.0 - smoothstep(0.025, 0.04, abs(py - uK[25].w))) * step(0.5, pcTwill + pcRib); if (z > 0.0) { float a = smoothstep(uK[25].w - fwy, uK[25].w + fwy, py);
  pcC = mix(pcC, mix(uK[27].rgb, uK[26].rgb, a), z); pcTwill = mix(pcTwill, a, z); pcRib = mix(pcRib, 1.0 - a, z); } }
{ float z = step(py, 0.45) * (1.0 - smoothstep(0.022, 0.035, abs(py - uK[26].w))) * uK[28].w; if (z > 0.0) { float a = smoothstep(uK[26].w - fwy, uK[26].w + fwy, py);
  pcC = mix(pcC, mix(uK[28].rgb, uK[27].rgb, a), z); pcRib = mix(pcRib, a + (1.0 - a) * uK[27].w, z); } }
{ float z = step(py, 0.3) * (1.0 - smoothstep(0.016, 0.028, abs(py - uK[29].x))) * uK[30].w; if (z > 0.0) { float a = smoothstep(uK[29].x - fwy, uK[29].x + fwy, py); pcC = mix(pcC, mix(uK[30].rgb, uK[28].rgb, a), z); pcRib = mix(pcRib, a * uK[27].w, z); } }
{ float rr = length(vec2(vRest.x, vRest.z + 0.005)), z = step(uK[32].y - 0.03, py) * (1.0 - smoothstep(uK[32].x + 0.02, uK[32].x + 0.035, rr)) * step(0.4, pcKnit + pcRib); if (z > 0.0) { float fr = fwidth(rr) * 0.75 + 1e-5;
  float a = (1.0 - smoothstep(uK[32].x - fr, uK[32].x + fr, rr)) * smoothstep(uK[32].y - fwy, uK[32].y + fwy, py); pcC = mix(pcC, mix(uK[25].rgb, uK[33].rgb, a), z); pcRib = mix(pcRib, a, z); pcKnit = mix(pcKnit, 1.0 - a, z); } }
if (uK[29].w > 0.5) { vec2 fq = vec2(vRest.x - pside * uK[29].y, vRest.z - uK[29].z); float on = step(py, 0.115) * step(0.03, py) * smoothstep(0.3, 0.55, rn.y) * (1.0 - smoothstep(0.014, 0.019, abs(fq.x))) * step(0.03, fq.y) * step(fq.y, 0.112);
  pcC = mix(pcC, uK[31].rgb, pcLine(abs(fract(fq.y / 0.0125) - 0.5) * 0.0125, 0.0024) * on); pcC = mix(pcC, pcC * 0.55, pcLine(fq.x, 0.0012) * on); }
pcC = pcBand(pcC, abs(vDz.y - uK[0].x), uK[0].yzw, uK[1], uK[2], uK[3], pcKnit);
pcC = pcBand(pcC, abs(ax - uK[4].x), vec3(uK[4].z, uK[4].w, uK[4].w), uK[5], uK[6], vec4(0.0), pcKnit * smoothstep(uK[4].y - 0.012, uK[4].y + 0.004, py));
{ float yl = mix(uK[7].y + 0.028, uK[7].x + 0.03, smoothstep(-0.05, 0.05, vRest.z)) - uK[7].z * (1.0 - smoothstep(0.0, 0.12, ax)), yd = py + 0.25 * abs(vRest.z) - yl, fw = fwidth(yd) * 0.75 + 1e-5, on = uK[7].w * pcKnit;
  pcC = mix(pcC, uK[8].rgb, smoothstep(-fw, fw, yd) * on); pcC = mix(pcC, uK[9].rgb, pcLine(yd, 0.0045) * on * uK[9].w); }
{ float sp = abs(normalize(vec2(vRest.x, (vRest.z - 0.004) * 1.42)).x) - uK[10].x, fw = fwidth(sp) * 0.75 + 1e-5, on = uK[10].w * pcKnit * step(ax, uK[10].y + 0.03) * (1.0 - smoothstep(uK[10].z - 0.01, uK[10].z + 0.01, py));
  pcC = mix(pcC, uK[11].rgb, smoothstep(-fw, fw, sp) * on); pcC = mix(pcC, uK[9].rgb, pcLine(sp, 0.011) * on * uK[9].w); }
pcC = pcBand(pcC, vDz.x, uK[12].xyz, uK[13], uK[14], uK[15], pcTwill * uK[12].w);
pcC = pcBand(pcC, abs(py - uK[16].x), uK[16].yzw, uK[17], uK[18], uK[19], pcRib * (1.0 - smoothstep(uK[21].x - 0.006, uK[21].x + 0.004, py)));
float sideOnly = 1.0 - smoothstep(uK[10].z, uK[10].z + 0.03, py);   // side seams only: over the lumpy pad tops a plane cut reads as a zigzag
float seam = step(0.06, ax) * (pcKnit * sideOnly * pcLine(vRest.z - uK[20].x, 0.0012) + pcTwill * pcLine(vRest.z - uK[20].y, 0.0011) * step(0.11, py));
float stitch = pcKnit * sideOnly * step(0.06, ax) * pcLine(abs(vRest.z - uK[20].x) - 0.0042, 0.0005) + pcTwill * pcLine(py - uK[20].z - 0.008, 0.0006) + pcKnit * (pcLine(vDz.y - 0.008, 0.0006) + pcLine(vDz.y - 0.0135, 0.0006));
vec4 tvc = vec4(0.0); float tvm = 0.0;
if (uK[21].w > 0.5) { vec2 tq; float fm;
  if (uK[21].w < 1.5) { tq = vec2(-pside * (vRest.z - uK[22].z) / (2.0 * uK[22].w), (py - uK[22].y) / uK[22].w) + 0.5; fm = smoothstep(0.3, 0.55, pside * rn.x) * step(uK[22].x, ax) * step(vDz.y, 0.3); }   // on the sleeve, never up on the pad cap
  else { tq = vec2(-(vRest.x - pside * uK[22].x) / (2.0 * uK[22].w), vRest.z / uK[22].w) + 0.5; fm = smoothstep(0.25, 0.5, rn.y) * step(uK[22].y - 0.09, py); }
  float inb = step(0.0, tq.x) * step(tq.x, 1.0) * step(0.0, tq.y) * step(tq.y, 1.0);
  tvc = texture2D(decalMap, vec2(0.25 + (tq.x - 0.5) * 0.219, 0.8828 + (tq.y - 0.5) * 0.219)); tvm = tvc.a * inb * fm * pcKnit; }
vec4 dc = texture2D(decalMap, vDuv.xy); float dcA = dc.a * vDuv.z * (1.0 - step(vDuv.x, 0.5) * step(0.77, vDuv.y));
dc = mix(dc, tvc, step(dcA, tvm)); dcA = max(dcA, tvm);
pcC = mix(pcC, pow(dc.rgb, vec3(2.2)) * (0.95 + 0.1 * fx.r), dcA);
float pcH = pcKnit * fx.r + pcTwill * fx.g + pcRib * fx.b;
pcC *= 1.0 + (fx.a - 0.5) * (0.16 * pcFab + 0.12 * pcSkin) + (pcH - 0.5 * pcFab) * 0.14;
{ float el = 1.0 - smoothstep(0.012, 0.06, length(vec3(ax, py, vRest.z) - vec3(uK[32].z, uK[32].w, -0.035))); pcC *= mix(vec3(1.0), mix(vec3(1.045, 0.985, 0.965), vec3(0.97, 1.0, 1.03), fx.a) * mix(vec3(1.0), vec3(1.06, 0.93, 0.9), el), pcSkin); }
pcC *= 1.0 - 0.26 * clamp(seam, 0.0, 1.0) - 0.16 * clamp(stitch, 0.0, 1.0);
float dAmt = clamp(vDz.z * uK[23].x * 2.2 + vDz.w * uK[23].y * 1.7 + uK[23].z * (1.0 - smoothstep(uK[21].z - 0.03, uK[21].z - 0.005, py)) * step(uK[20].w - 0.06, ax) * step(0.45, py), 0.0, 1.0);
float dn = texture2D(fabTex, vRest.xy * 2.3 + uK[23].w).a * 0.72 + fx.a * 0.28;
float dm = smoothstep(1.0 - dAmt, 1.25 - dAmt * 0.9, dn) * step(0.001, dAmt) * (1.0 - 0.5 * pcSkin), gm = smoothstep(0.45, 0.75, fx.g * 0.45 + dn * 0.55) * (1.0 - smoothstep(0.8, 1.1, py));
pcC = mix(pcC, pcC * mix(vec3(0.42, 0.3, 0.19), vec3(0.3, 0.42, 0.16), gm) + mix(vec3(0.07, 0.05, 0.03), vec3(0.03, 0.05, 0.015), gm), dm * 0.7);
diffuseColor.rgb *= pcC;
float pcR = mix(mix(clamp(vMat.x * (0.9 + 0.2 * fx.a) + dm * 0.15, 0.25, 1.0), 0.5, beltM), 0.64, dcA * 0.5);
float pcHm = 0.0015 * (pcKnit * fx.r + pcTwill * fx.g) + 0.0009 * pcRib * fx.b + 0.0009 * dcA - 0.0008 * clamp(seam, 0.0, 1.0) - 0.0003 * clamp(stitch, 0.0, 1.0) + pcSkin * (0.00025 * fx.a + 0.00006 * fx.r) + 0.0002 * dm * fx.g;
float pcAO = vDuv.w, pcAOd = 0.6, pcSheen = 0.34 * pcKnit + 0.22 * pcTwill + 0.28 * pcRib + 0.08 * pcSkin;
`;
// helmet shell: crisp stripes over the crown, team logo, paint finish (roughness / metal flake from the material) and game scuffs
const FRAG_HELM = `
float pcSkin = 0.0, shell = clamp(vPal.w, 0.0, 1.0);
vec4 fx = pcTri(vRest * 9.0, vRN);
vec3 pcC = vPal.rgb; float top = smoothstep(-0.06, -0.02, vRest.y + vRest.z * 0.2);
pcC = pcBand(pcC, abs(vRest.x), uK[0].xyz, uK[1], uK[2], uK[3], shell * top * uK[0].w);
{ vec4 dc = texture2D(decalMap, vDuv.xy); pcC = mix(pcC, pow(dc.rgb, vec3(2.2)), dc.a * vDuv.z); }
float sc = smoothstep(1.0 - uK[4].y, 1.12 - uK[4].y, texture2D(fabTex, vRest.xy * 3.1 + uK[4].z).a * 0.62 + fx.r * 0.38) * shell * smoothstep(-0.12, 0.06, vRest.z) * step(0.0005, uK[4].y);
pcC = mix(pcC, mix(vec3(0.5, 0.5, 0.47), pcC, 0.45), sc * 0.55);
pcC *= 1.0 + (fx.a - 0.5) * 0.05 * shell;
diffuseColor.rgb *= pcC;
float pcR = clamp(roughness * (0.9 + 0.2 * fx.a) + sc * 0.35 + (1.0 - shell) * 0.3, 0.05, 1.0);
float pcHm = shell * (uK[4].x * 0.00009 * (fx.r - 0.5) + 0.00003 * fx.a) - sc * 0.00015;
float pcAO = 1.0, pcAOd = 0.6, pcSheen = 0.0;
`;
const FRAG_HEAD = `
float pcSkin = clamp(vPal.w, 0.0, 1.0);
vec4 fx = pcTri(vRest * 10.0, vRN);
float fl = (1.0 - smoothstep(0.008, 0.03, length(vec2(abs(vRest.x) - 0.045, vRest.y + 0.03)))) * 0.8 + (1.0 - smoothstep(0.004, 0.02, length(vec2(vRest.x, vRest.y + 0.03)))) * step(0.09, vRest.z);
diffuseColor.rgb *= vPal.rgb * (1.0 + (fx.a - 0.5) * 0.16 * pcSkin + (fx.g - 0.5) * 0.04 * pcSkin) * mix(vec3(1.0), mix(vec3(1.04, 0.985, 0.97), vec3(0.975, 1.0, 1.025), fx.a) * mix(vec3(1.0), vec3(1.07, 0.92, 0.9), fl), pcSkin);
float pcR = mix(0.42, clamp(roughness * (0.86 + 0.28 * fx.a), 0.3, 0.9), pcSkin), pcHm = pcSkin * (0.00015 * fx.a + 0.00005 * fx.r), pcSheen = 0.1 * pcSkin;
// the face sits inside the helmet: darker under the brim, toward the jaw pads and deeper in
float pcAO = (1.0 - 0.62 * smoothstep(-0.045, 0.035, vRest.y)) * (1.0 - 0.45 * smoothstep(0.045, 0.08, abs(vRest.x))) * mix(0.5, 1.0, smoothstep(0.02, 0.085, vRest.z)), pcAOd = 0.92;
`;
const FRAG_GEAR = `
float pcSkin = 0.0;
vec4 fx = pcTri(vRest * 4.0, vRN);
diffuseColor.rgb *= vPal.rgb * (1.0 + (fx.a - 0.5) * 0.14 + (fx.r - 0.5) * 0.08);
float pcR = clamp(roughness * (0.9 + 0.2 * fx.a), 0.2, 1.0), pcHm = 0.0004 * fx.r, pcAO = 1.0, pcAOd = 0.6, pcSheen = 0.18;
`;
function palMat(nSlots, kind, opts, variant = 'gear') {
  const nA = Math.ceil(nSlots / 4), m = kind === 'physical' ? new THREE.MeshPhysicalMaterial(opts) : new THREE.MeshStandardMaterial(opts), body = variant === 'body', nK = UK_N[variant] || 1;
  m.userData.pal = Array.from({ length: nSlots }, () => new THREE.Vector4(1, 1, 1, 0)); m.userData.pmat = Array.from({ length: nSlots }, () => new THREE.Vector4(0.6, 0, 0, 0));
  m.userData.uK = Array.from({ length: nK }, () => new THREE.Vector4()); m.userData.decal = null; m.userData.n = nSlots;
  m.onBeforeCompile = sh => {
    sh.uniforms.pal = { value: m.userData.pal }; sh.uniforms.decalMap = { value: m.userData.decal || BLANK }; sh.uniforms.fabTex = { value: fabricTex() }; sh.uniforms.uK = { value: m.userData.uK };
    if (body) sh.uniforms.pmat = { value: m.userData.pmat };
    let attrs = '', sumv = '', summ = ''; for (let a = 0; a < nA; a++) { attrs += `attribute vec4 w${a};\n`; for (let c = 0; c < 4; c++) { const i = a * 4 + c; if (i < nSlots) { const w = `w${a}.${'xyzw'[c]}`; sumv += `${sumv ? '+' : ''}${w}*pal[${i}]`; summ += `${summ ? '+' : ''}${w}*pmat[${i}]`; } } }
    const vary = `varying vec4 vPal;\nvarying vec4 vDuv;\nvarying vec3 vRest;\nvarying vec3 vRN;\n${body ? 'varying vec4 vMat;\nvarying vec4 vDz;\n' : ''}`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${attrs}attribute vec4 duv;\n${body ? 'attribute vec4 dz;\nuniform vec4 pmat[' + nSlots + '];\n' : ''}uniform vec4 pal[${nSlots}];\n${vary}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvPal=${sumv};vDuv=duv;vRest=position;vRN=normal;${body ? `vMat=${summ};vDz=dz;` : ''}`);
    const frag = body ? FRAG_BODY : variant === 'helm' ? FRAG_HELM : variant === 'head' ? FRAG_HEAD : FRAG_GEAR;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D decalMap;\nuniform sampler2D fabTex;\nuniform vec4 uK[${nK}];\n${vary}${GLSL_FN}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + frag)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = pcR;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = pcPerturb(-vViewPosition, normal, vec2(dFdx(pcHm), dFdy(pcHm)), faceDirection);')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
{ float nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), rim = (1.0 - nv) * (1.0 - nv) * (1.0 - nv);
  vec3 aoT = mix(vec3(pcAO), pow(vec3(pcAO), vec3(0.72, 1.06, 1.22)), pcSkin);
  reflectedLight.indirectDiffuse *= aoT; reflectedLight.indirectSpecular *= pcAO; reflectedLight.directDiffuse *= mix(vec3(1.0), aoT, pcAOd); reflectedLight.directSpecular *= mix(1.0, pcAO, pcAOd);
  reflectedLight.directDiffuse += (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * rim * pcSheen; }`);
    m.userData.shader = sh;
  };
  m.customProgramCacheKey = () => 'pc2' + nSlots + kind + variant + (opts.skinning ? 's' : '');
  return m;
}
let BLANK = null;
// colours (sRGB hex) per slot; flags (skin weight for the body / face, shell for the helmet) go in the 4th component
function setPal(m, hexes, flags) { hexes.forEach((h, i) => { if (h != null && i < m.userData.n) { const c = col(h); m.userData.pal[i].set(c.r, c.g, c.b, flags ? flags[i] || 0 : 0); } }); }
function setMat(m, rows) { rows.forEach((r, i) => { if (r && i < m.userData.n) m.userData.pmat[i].set(r[0], r[1], r[2], r[3]); }); }
function geoFrom(out, slotsKey, n, stride = n) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(out.normal, 3));
  const Wsrc = out[slotsKey], nv = out.count, nA = Math.ceil(n / 4);
  for (let a = 0; a < nA; a++) { const arr = new Float32Array(nv * 4); for (let q = 0; q < nv; q++) for (let c = 0; c < 4; c++) { const i = a * 4 + c; arr[q * 4 + c] = i < n ? Wsrc[q * stride + i] : 0; } g.setAttribute('w' + a, new THREE.BufferAttribute(arr, 4)); }
  // duv: decal uv, decal mask, baked AO; dz (bodies): pants stripe / sleeve coordinates and dirt-prone fields
  const duv = new Float32Array(nv * 4); for (let q = 0; q < nv; q++) { duv[q * 4] = out.uv ? out.uv[q * 2] : 0; duv[q * 4 + 1] = out.uv ? out.uv[q * 2 + 1] : 0; duv[q * 4 + 2] = out.nm ? out.nm[q] : 0; duv[q * 4 + 3] = out.ao ? out.ao[q] : 1; }
  g.setAttribute('duv', new THREE.BufferAttribute(duv, 4));
  if (out.dz) g.setAttribute('dz', new THREE.BufferAttribute(out.dz, 4));
  if (out.skinIndex) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.skinIndex, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.skinWeight, 4)); }
  g.setIndex(new THREE.BufferAttribute(out.index, 1)); g.computeBoundingSphere(); return g;
}
// shared fabric detail (one per session): R jersey knit + soft folds, G pants twill + creases, B rib knit, A mottling (tone, stains, scuffs).
// Tiled in each part's rest space by the shader (25 cm per tile on bodies), so it never swims when the body moves.
let fabT = null;
function fabricTex() {
  if (fabT) return fabT;
  const N = coarse ? 256 : 512, d = new Uint8Array(N * N * 4); let sd = 1337; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const lattice = (cx, cy) => { const g = new Float32Array(cx * cy); for (let i = 0; i < g.length; i++) g[i] = rnd(); return (u, v) => { const x = u * cx, y = v * cy, i = Math.floor(x), j = Math.floor(y); let fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const i0 = ((i % cx) + cx) % cx, i1 = (i0 + 1) % cx, j0 = ((j % cy) + cy) % cy, j1 = (j0 + 1) % cy; return (g[j0 * cx + i0] * (1 - fx) + g[j0 * cx + i1] * fx) * (1 - fy) + (g[j1 * cx + i0] * (1 - fx) + g[j1 * cx + i1] * fx) * fy; }; };
  const m1 = lattice(5, 5), m2 = lattice(13, 13), m3 = lattice(37, 37), f1 = lattice(4, 14), f2 = lattice(9, 26), c1 = lattice(14, 4), w1 = lattice(64, 64), K = coarse ? 48 : 96, TP = Math.PI * 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N, i = (y * N + x) * 4, px = rnd();
    const mott = m1(u, v) * 0.5 + m2(u, v) * 0.32 + m3(u, v) * 0.18;
    const fold = f1(u, v) * 0.72 + f2(u, v) * 0.28, crease = c1(u, v) * 0.7 + f2(v, u) * 0.3;
    const knit = 0.5 + 0.035 * Math.sin(TP * K * u) * Math.sin(TP * K * v) + 0.5 * (fold - 0.5) + 0.06 * (w1(u, v) - 0.5) + 0.025 * (px - 0.5);
    const twill = 0.5 + 0.035 * Math.sin(TP * K * (u + v)) + 0.55 * (crease - 0.5) + 0.06 * (w1(v, u) - 0.5) + 0.02 * (px - 0.5);
    const rib = 0.5 + 0.3 * Math.sin(TP * (K / 2) * u) + 0.2 * (fold - 0.5) + 0.04 * (px - 0.5);
    d[i] = Math.max(0, Math.min(255, knit * 255)); d[i + 1] = Math.max(0, Math.min(255, twill * 255)); d[i + 2] = Math.max(0, Math.min(255, rib * 255)); d[i + 3] = Math.max(0, Math.min(255, (mott * 1.25 - 0.12) * 255)); }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1; t.needsUpdate = true; return (fabT = t);
}
// ---------------- asset builders (cached in memory, and in IndexedDB across sessions) ----------------
const MODEL_V = 7, KIND_V = { body: 10, head: 8 }, outs = {};   // body v10: 32 slots (glove palm / cuff, cleat accent), design coordinates + baked AO; head v8: per-region colour slots
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
  return (cache.body[arch] = { geo, P0: P0v, F0, L0, J, D: M.bodyDesign(A), heightIn: A.heightIn, girth: Math.sqrt((A.weightLb * 0.4536) / (95 * Math.pow(A.heightIn / 73, 3))), tris: out.index.length / 3 });
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
// facemask bars plus the chin strap (cup and two straps to snaps on the shell); vertex colour 1 = mask colour, dark = strap / cup
function buildMask(style) {
  if (cache.mask[style]) return cache.mask[style];
  const MB = M.maskBars(style), pos = [], nor = [], idx = [], cols = []; let base = 0;
  const addGeo = (tg, shade) => { const p = tg.attributes.position.array, n = tg.attributes.normal.array, ix = tg.index.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) cols.push(shade[0], shade[1], shade[2]); for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base); base += p.length / 3; tg.dispose(); };
  const tube = (pts, r, seg) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal'), seg, r, 6, false);
  for (const pts of MB.bars) addGeo(tube(pts, MB.r, Math.max(8, pts.length * 8)), [1, 1, 1]);
  const STRAP = [0.075, 0.075, 0.08], CUP = [0.13, 0.13, 0.135];
  { const cup = new THREE.SphereGeometry(1, 12, 8); cup.scale(0.03, 0.019, 0.021); cup.rotateX(-0.35); cup.translate(0, -0.116, 0.084); addGeo(cup, CUP); }
  for (const s of [1, -1]) { addGeo(tube([[s * 0.024, -0.114, 0.082], [s * 0.06, -0.106, 0.07], [s * 0.098, -0.092, 0.052], [s * 0.121, -0.07, 0.044]], 0.0042, 12), STRAP);
    const snap = new THREE.CylinderGeometry(0.009, 0.009, 0.005, 10); snap.rotateZ(Math.PI / 2); snap.translate(s * 0.123, -0.068, 0.044); addGeo(snap, [0.55, 0.56, 0.58]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeBoundingSphere();
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
  if (r.dirt) groundDirt(r, J);
}
// dirt and grass stains build up through the game: knees on the turf mark the legs, going down marks the jersey (and scuffs the
// helmet), a hand in the dirt (three-point stance) marks the gloves. One uniform per rig; the shader decides where it shows.
// Counted per contact (knee goes down, body hits the turf, hand goes down), so it does not depend on frame rate or sim speed.
function groundDirt(r, J) {
  const g = r.gd || (r.gd = { knee: 0, down: 0, hand: 0 }), d = r.dirt;   // flags with hysteresis, so a stance hovering at the threshold counts once
  let kMin = 9, hMin = 9; for (const lg of J.legs) if (lg.knee) kMin = Math.min(kMin, lg.knee.y); for (const a of J.arms) if (a.hand) hMin = Math.min(hMin, a.hand.y);
  const cy = J.chest ? J.chest.y : 9, py = J.pelvis ? J.pelvis.y : 9;
  const knee = kMin < 0.17 ? 1 : kMin > 0.28 ? 0 : g.knee, hand = hMin < 0.14 ? 1 : hMin > 0.3 ? 0 : g.hand, down = cy < 0.62 ? 1 : py < 0.4 ? Math.max(0.5, g.down) : cy > 0.85 ? 0 : g.down;
  if (knee && !g.knee) d.x = Math.min(1, d.x + 0.07);
  if (down > g.down) { const k = down - g.down; d.x = Math.min(1, d.x + 0.06 * k); d.y = Math.min(1, d.y + 0.13 * k); if (r.scuff) r.scuff.y = Math.min(0.4, r.scuff.y + 0.03 * k); }
  if (hand && !g.hand) d.z = Math.min(1, d.z + 0.025);
  g.knee = knee; g.down = down; g.hand = hand;
}
// ---------------- per-player textures ----------------
const hexs = c => typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
// numbers as layered tackle twill: optional shadow / outer outline, outline, fill, stitching along the edges and a faint twill weave;
// name on the back (optionally on a name bar); TV numbers in the free strip above the chest number (sampled by the shader on the
// sleeves or shoulders). Canvas layout: left half = front (chest), right half = back, 0.42 m per half.
const NUM_FONT = { block: s => `${s}px Graduate, "Arial Black", Impact, sans-serif`, pro: s => `800 ${s}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`,
  italic: s => `italic 800 ${s}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`, slab: s => `700 ${s}px Teko, "Barlow Condensed", Impact, sans-serif` };
function numberTexture(num, name, kit, KS) {
  KS = KS || M.kitStyle(kit); const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'), ppm = 1219 / 2; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
  const F = M.fabric, font = NUM_FONT[KS.nfont] || NUM_FONT.block, fill = F(hexs(kit.num || "#fff")); let out1 = F(hexs(kit.numOutline || '#000')), jer = F(kit.jersey || '#808080');
  let out2 = F(hexs(KS.trim2)), st = KS.nstyle; if (st === 'double' && Math.abs(M.hexLum(out2) - M.hexLum(jer)) < 0.16) { out2 = [kit.trim, fill, '#18181b'].map(c => F(c || '#18181b')).find(c => Math.abs(M.hexLum(c) - M.hexLum(jer)) > 0.25 && c !== out1) || out1; }
  const lumN = M.hexLum(fill);
  if (st !== 'plain' && Math.abs(M.hexLum(out1) - M.hexLum(jer)) < 0.12) out1 = [KS.trim2, kit.trim, '#18181b'].map(c => F(c || '#18181b')).find(c => Math.abs(M.hexLum(c) - M.hexLum(jer)) > 0.2 && Math.abs(M.hexLum(c) - lumN) > 0.15) || out1;   // an outline the colour of the jersey only reads as a smudge
  const stitchOn = c => M.hexLum(c) > 0.5 ? 'rgba(30,26,22,.34)' : 'rgba(255,250,240,.26)';
  // hPx: cap height in canvas px, wPx: widest the number may be. Each layer's stitching is a dashed stroke drawn just before the layer
  // over it, so only the outer fringe shows (no stitch lines through overlapping glyph contours)
  const draw = (cx, cy, hPx, wPx) => {
    x.font = font(100); const m0 = x.measureText(num), asc = m0.actualBoundingBoxAscent || 72, fs = 100 * hPx / asc; x.font = font(fs);
    const lw = fs * (st === 'double' ? 0.058 : 0.1), LO = 2.3, pad = st === 'double' ? lw * LO : st === 'plain' ? 0 : lw, wid = x.measureText(num).width + pad, sxk = Math.min(1, wPx / wid), sw = Math.max(2.2, fs * 0.022);
    const dash = (w, c) => { x.setLineDash([Math.max(1.6, fs * 0.024), Math.max(1.3, fs * 0.017)]); x.lineWidth = w; x.strokeStyle = c; x.strokeText(num, 0, 0); x.setLineDash([]); };
    x.save(); x.translate(cx, cy + hPx / 2); x.scale(sxk, 1);
    if (st === 'shadow') { x.fillStyle = out1; x.fillText(num, fs * 0.055, fs * 0.05); }
    if (st === 'double') { dash(lw * LO + sw, stitchOn(jer)); x.lineWidth = lw * LO; x.strokeStyle = out2; x.strokeText(num, 0, 0); }
    if (st !== 'plain') { dash(lw + sw, stitchOn(st === 'double' ? out2 : jer)); x.lineWidth = lw; x.strokeStyle = out1; x.strokeText(num, 0, 0); }
    dash(sw, stitchOn(st === 'plain' || st === 'shadow' ? jer : out1)); x.fillStyle = fill; x.fillText(num, 0, 0);
    x.restore(); };
  draw(128, 122, 0.2 * ppm, 0.3 * ppm); draw(384, 131, 0.235 * ppm, 0.34 * ppm);
  if (KS.tvnum !== 'none') draw(128, 30, 44, 104);
  x.save(); x.translate(384, 31); const nf = 0.042 * ppm / 0.72; x.font = `700 ${nf}px "Barlow Condensed", "Arial Narrow", sans-serif`; const w = x.measureText(name).width, ns = Math.min(1, 165 / (w || 1));
  if (KS.nbar && name) { const bw = Math.min(190, w * ns + 22); x.fillStyle = M.hexLum(out1) > 0.5 === lumN > 0.5 ? out2 : out1; x.beginPath(); if (x.roundRect) x.roundRect(-bw / 2, -nf * 0.82, bw, nf * 1.02, 4); else x.rect(-bw / 2, -nf * 0.82, bw, nf * 1.02); x.fill(); }
  x.scale(ns, 1); x.fillStyle = fill; x.fillText(name, 0, 0); x.restore();
  // twill weave over every patch (only where something is drawn)
  x.save(); x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 1; x.beginPath(); for (let i = -256; i < 512; i += 3) { x.moveTo(i, 0); x.lineTo(i + 256, 256); } x.stroke(); x.restore();
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
  const KS = L3.kit, mat = palMat(M.NS, 'standard', { roughness: 0.8, metalness: 0, skinning: true }, 'body');
  setPal(mat, L3.body, L3.bodyMat.map(m => m[4])); setMat(mat, L3.bodyMat);
  mat.userData.decal = numberTexture(String(rp.num ?? ''), (rp.ln || '').toUpperCase().slice(0, 12), kit, KS);
  const hsh = ((rp.id | 0) * 2654435761 >>> 0) / 4294967296, line = arch === 'BIG';
  const dirt = setBodyKit(mat, kit, KS, base.D, hsh, line, rp.pos, L3.body, L3.spat);
  const body = new THREE.SkinnedMesh(base.geo, mat); body.bind(sk, new THREE.Matrix4()); body.frustumCulled = false; body.castShadow = true; body.receiveShadow = true; scene.add(body);
  const gear = new THREE.Group(), hb = bones[M.BI.head]; gear.position.set(...base.J.head); hb.add(gear);
  const hm = palMat(M.NSH, 'standard', { roughness: 0.55, metalness: 0 }, 'head'); setPal(hm, L3.head, [1, 1, 0, 0, 1, 1, 1, 0.4, 0.4, 0.3, 1, 1]); const head = new THREE.Mesh(headB.geo, hm); head.receiveShadow = true; gear.add(head);
  const shell = new THREE.Group(); shell.scale.setScalar(headB.scale); gear.add(shell);
  // helmet: paint finish per kit (gloss / satin / metallic flake as physical clearcoat, matte as a plain standard material)
  const HF = { gloss: [{ roughness: 0.26, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.05 }, 0], satin: [{ roughness: 0.4, metalness: 0.06, clearcoat: 0.45, clearcoatRoughness: 0.3 }, 0],
    metal: [{ roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04 }, 1], matte: [{ roughness: 0.64, metalness: 0.0 }, 0] }[KS.hfinish] || [{ roughness: 0.26, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.05 }, 0];
  const hcol = M.fabric(kit.helmet || '#888888'), helmMat = palMat(5, KS.hfinish === 'matte' ? 'standard' : 'physical', HF[0], 'helm'); setPal(helmMat, [hcol, hcol, hcol, '#141416', '#202226'], [1, 1, 1, 0, 0]); helmMat.userData.decal = logoTexture(team, kit);
  const scuff = setHelmKit(helmMat, kit, KS, hcol, HF[1], hsh, line);
  const helm = new THREE.Mesh(helmG, helmMat); helm.castShadow = true; shell.add(helm);
  // facemask: bare titanium look for grey masks, powder coat for coloured ones
  const mc = new THREE.Color(kit.mask || '#d4d8de'), hsl = {}; mc.getHSL(hsl); const ti = hsl.s < 0.14 && hsl.l > 0.42 && hsl.l < 0.92;
  const mm = new THREE.MeshStandardMaterial({ color: col(kit.mask || '#d4d8de'), roughness: ti ? 0.32 : 0.46, metalness: ti ? 0.7 : 0.08, vertexColors: true }); const mask = new THREE.Mesh(maskG, mm); mask.castShadow = true; shell.add(mask);
  if (L3.visor) { const vz = new THREE.Mesh(buildVisor(), visorMat(L3.visor)); vz.renderOrder = 2; shell.add(vz); }
  const mats = [mat, hm, helmMat, mm]; let extra = null;
  const xg = L3.hasGear ? buildGear(arch, L3, headB.scale) : null;
  if (xg) { const xm = palMat(M.NSG, 'standard', { roughness: 0.78, metalness: 0.03, skinning: true }, 'gear'); setPal(xm, L3.gearPal.map(M.fabric)); mats.push(xm);
    extra = new THREE.SkinnedMesh(xg, xm); extra.bind(sk, new THREE.Matrix4()); extra.frustumCulled = false; extra.castShadow = false; extra.receiveShadow = true; scene.add(extra); }
  const physSize = (rp.ht || base.heightIn) / 73, archSize = base.heightIn / 73, ratio = physSize / archSize;
  const pg = Math.sqrt(((rp.wt || 220) * 0.4536) / (95 * Math.pow(physSize, 3)));
  return { root, bones, body, gear, extra, mats, base, m: bones.map(() => new Float64Array(12)), sz: ratio, g: ratio * Math.pow(pg / base.girth, 0.9), gb: L3.girth, pid: rp.id, tid: team.id, kitKey: kitKey(kit), visible: true, dirt, scuff };
}
// kit design uniforms for a body material (layout read by FRAG_BODY). Returns the rig's dirt vector (x legs, y torso, z gloves, w pattern seed).
function setBodyKit(mat, kit, KS, D, hsh, line, pos, P, spat) {
  const u = mat.userData.uK, V = (i, a, b, c, d) => u[i].set(a, b, c, d), C = (i, hex, on = 1) => { const c = col(hex); u[i].set(c.r, c.g, c.b, on); };
  const F = M.fabric, jer = F(kit.jersey || '#7a7a7a'), tr = F(kit.trim || '#ffffff'), t2 = F(KS.trim2), pants = F(kit.pants || '#e8e8e8'), lum = M.hexLum;
  let ps = F(kit.pstripe || kit.jersey || '#7a7a7a'); if (Math.abs(lum(ps) - lum(pants)) < 0.1) ps = [tr, jer, t2].find(c => Math.abs(lum(c) - lum(pants)) > 0.2) || ps;
  const sockC = F(kit.socks || kit.jersey || '#7a7a7a'), sockS = [tr, '#e2ded5', t2, jer].find(c => Math.abs(lum(c) - lum(sockC)) > 0.2) || tr;
  for (const i of [1, 2, 3, 5, 6, 8, 9, 11, 13, 14, 15, 17, 18, 19]) u[i].set(0, 0, 0, 0);
  V(0, 0, 0, 0, 0); V(4, 0, 0, 0, 0); V(7, 0, 0, 0, 0); V(10, 0.88, D.chestW, D.armpit, 0);
  // jersey: sleeve bands (around a distance above the hem), shoulder loops, yoke, side panels
  switch (KS.jstyle) {
    case 'stripes': V(0, 0.042, 0.009, 0.025, 0.025); C(2, tr); break;
    case 'triple': V(0, 0.036, 0.006, 0.013, 0.019); C(1, tr); C(3, tr); break;
    case 'loops': V(0, 0.012, 0.0045, 0.0045, 0.0045); C(1, tr); V(4, D.loopX, D.loopY, 0.016, 0.022); C(5, tr); C(6, t2); break;
    case 'yoke': V(0, 0.01, 0.004, 0.004, 0.004); C(1, t2); V(7, D.yokeF, D.yokeB, 0.035, 1); C(8, tr); C(9, t2); break;
    case 'panel': V(0, 0.016, 0.009, 0.009, 0.009); C(1, tr); V(10, line ? 0.92 : 0.89, D.chestW, D.armpit, 1); C(11, tr); C(9, t2); break;
    default: V(0, 0.009, 0.0035, 0.0035, 0.0035); C(1, t2); break;      // plain: just a thin cuff piping
  }
  // pants stripe: bands around the outer-leg line
  const PSW = { solid: [0.026, 0.026, 0.026, ps, 0, 0], double: [0.007, 0.019, 0.019, 0, ps, 0], tri: [0.011, 0.017, 0.025, ps, 0, t2], outline: [0.015, 0.022, 0.022, ps, t2, 0], thin: [0.0075, 0.0075, 0.0075, ps, 0, 0] }[KS.pstyle];
  if (PSW) { V(12, PSW[0], PSW[1], PSW[2], 1); if (PSW[3]) C(13, PSW[3]); if (PSW[4]) C(14, PSW[4]); if (PSW[5]) C(15, PSW[5]); } else V(12, 0, 0, 0, 0);
  // socks: bands around a height on the calf (two-tone = a lighter lower sock)
  const midC = D.sockT + (D.ankT - D.sockT) * 0.4, half = (D.sockT - D.ankT) * 0.42;
  if (KS.sstyle === 'stripes') { V(16, midC, 0.011, 0.025, 0.025); C(18, sockS); }
  else if (KS.sstyle === 'hoops') { V(16, midC, 0.009, 0.019, 0.028); C(17, sockS); C(19, sockS); }
  else if (KS.sstyle === 'twotone') { V(16, D.ankT, half, half + 0.008, half + 0.008); C(17, '#e2ded5'); C(18, tr); }
  else V(16, 0, 0, 0, 0);
  V(20, D.seamZ, D.pseamZ, D.hem, D.wrX);
  // garment edges: belt (centre y), jersey (knee hem y), pants (ankle-tape line y), socks (ankle is rib knit), ankle colour (on when it differs)
  C(24, P[10]); u[24].w = D.belt - 0.0135; C(25, P[0]); u[25].w = D.hem; C(26, P[2]); u[26].w = D.ankT; C(27, P[4]); u[27].w = P[11] === P[4] ? 1 : 0; C(28, P[11]); u[28].w = P[11] === P[4] ? 0 : 1;
  u[32].set(D.holeR, line ? 99 : D.collarY, D.elX, D.elY); C(33, P[1]);   // collar ring (linemen's pads have a neck roll there instead)
  // cleat collar edge (only when the collar and the sock above differ) and laces (not under spats)
  u[29].set(D.collar, D.anX, D.anZ, spat === 1 || spat === 2 || spat === 4 ? 0 : 1); C(30, P[9], P[9] === P[11] ? 0 : 1); C(31, M.hexLum(P[7]) > 0.5 ? '#2a2a2e' : '#e6e3dc');
  let tv = { none: 0, sleeve: 1, shoulder: 2 }[KS.tvnum] || 0; if (tv && (KS.jstyle === 'stripes' || KS.jstyle === 'triple')) tv = 0; else if (tv === 2 && KS.jstyle === 'loops') tv = 1;   // never over the stripes V(21, D.sockT, D.ankT, D.wrY, tv);
  if (tv === 2) V(22, D.loopX, D.capTop, 0, 0.048); else V(22, D.chestW + 0.012, D.tv[1] - 0.012, D.tv[2], 0.046);
  // starting dirt: everyone has a little; linemen live in the trenches, kickers and QBs stay cleaner
  const cleanK = pos === 'K' || pos === 'P' ? 0.25 : pos === 'QB' ? 0.55 : 1;
  V(23, (0.1 + hsh * 0.14 + (line ? 0.16 : 0)) * cleanK, (0.03 + hsh * 0.06 + (line ? 0.1 : 0)) * cleanK, line ? 0.3 + hsh * 0.2 : 0.06, hsh * 7.31);
  return u[23];
}
function setHelmKit(mat, kit, KS, hcol, flake, hsh, line) {
  const u = mat.userData.uK, C = (i, hex, on = 1) => { const c = col(hex); u[i].set(c.r, c.g, c.b, on); }, s1 = kit.hstripe || '#ffffff', s2 = kit.hstripe2 || s1;
  for (let i = 0; i < 4; i++) u[i].set(0, 0, 0, 0);
  const HS = { single: [0.0105, 0.016, 0.016, s1, s2, 0], double: [0.006, 0.0145, 0.0145, 0, s1, 0], tri: [0.0085, 0.0135, 0.019, s1, 0, s2], wide: [0.026, 0.031, 0.031, s1, s2, 0] }[KS.hstyle];
  if (HS) { u[0].set(HS[0], HS[1], HS[2], 1); if (HS[3]) C(1, HS[3]); if (HS[4]) C(2, HS[4]); if (HS[5]) C(3, HS[5]); }
  u[4].set(flake, 0.05 + (line ? 0.08 : 0) + hsh * 0.05, hsh * 5.17, 0); return u[4];
}
const kitKey = k => { const S = M.kitStyle(k); return [k.jersey, k.trim, k.pants, k.pstripe, k.socks, k.helmet, k.hstripe, k.hstripe2, k.num, k.numOutline, k.shell, k.mask, k.glove, k.cleat, S.jstyle, S.pstyle, S.hstyle, S.hfinish, S.sstyle, S.nfont, S.nstyle, S.nbar, S.tvnum, S.trim2].join('|'); };
function hideRig(r, v) { r.body.visible = v; r.gear.visible = v; if (r.extra) r.extra.visible = v; r.visible = v; }
function disposeRig(r) { scene.remove(r.root); scene.remove(r.body); if (r.extra) scene.remove(r.extra); for (const m of r.mats) { if (m.userData.decal && !Object.values(logoTex).includes(m.userData.decal)) m.userData.decal.dispose(); m.dispose(); } }
// ---------------- field ----------------
// The field can be narrower (phone games): applyWidth stretches the turf and moves the borders, team-area bands, pylons and
// benches to the current FIELD.halfW. Everything it scales is built at the full width FW.half0, and the stands always stand at
// the full-width distance, so a desktop game after a phone game never has a wall inside the field.
const FW = { sides: [], ends: [], bands: [], props: [], sprops: [], half0: 26.667 * YD };
const XS = FW.half0 + 13, ZA = -10 * YD - 10, ZB = 110 * YD + 10, CZ = 50 * YD, WHITE3 = [1, 1, 1];   // stand fronts: sides at ±XS, ends at ZA / ZB
let fieldU = null, apronU = null, flatU = null, apronMat = null, borderMat = null, bandMat2 = null, pylMat = null, skyMesh = null, skyU = null, fillL = null, envRT = null, VEN = null, wxo = null, board = null, boardT = 0;
const sunDir = new THREE.Vector3(-0.35, 0.86, -0.36).normalize();
function applyWidth() {
  const k = FIELD.halfW / FW.half0, bw = 1.83; if (fieldMesh) fieldMesh.scale.x = k;
  for (const m of FW.sides) m.position.x = Math.sign(m.position.x) * (FIELD.halfW + bw / 2);
  for (const m of FW.ends) m.scale.x = (2 * FIELD.halfW + 2 * bw) / (2 * FW.half0 + 2 * bw);
  for (const m of FW.bands) m.position.x = Math.sign(m.position.x) * (FIELD.halfW + bw + 4.2);
  for (const m of FW.props.concat(FW.sprops)) m.position.x = m.userData.sx * (FIELD.halfW + m.userData.off);
  if (losLine) losLine.scale.x = k; if (fdLine) fdLine.scale.x = k; if (fieldU) fieldU.uK.value = k;
}
// ---------------- venue: every home team plays in a ground of its own ----------------
// Picked from the team (deterministic, so old saves get one too). T.venue = { stadium: 'dome', mow: 'checker', ... } overrides
// any key (see VENUE_OPTS), and R3D.venueOverride does the same for QA. The time of day comes from the team and the week.
const hashS = VENUE.hashS, rngOf = VENUE.rngOf;       // shared with the match (src/core/30_venue.js): the venue and the weather are pure functions
const pickR = (r, a) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
const VENUE_OPTS = VENUE.OPTS;
const MOW_ID = { plain: 0, stripes: 1, wide: 2, checker: 3, diamond: 4, lengthwise: 5 };
function venueOf(T) { return VENUE.of(T, R3D.venueOverride); }
// time of day. sun: the key light (the sun, or the stadium lights at night); hemi: sky/ground fill; exp: exposure; zen/hor/hor2: sky
// colours (sRGB; hor is the horizon toward the sun, hor2 away from it); lights: how lit the lamps are; clouds: cover; sh: stand-shadow strength
const TOD = {
  day: { el: [34, 54], sun: 0xfff1de, sunI: 2.3, sky: 0xc2d8f8, gnd: 0x5a6440, hemiI: 0.55, fill: 0.1, exp: 0.86, zen: '#3c6fb4', hor: '#c9d6e0', hor2: '#a9c0d6', gndC: '#59613f', fog: '#b8c6d3', fogN: 160, fogF: 950, lights: 0, clouds: 0.55, sunS: 1, cLit: '#ffffff', cDark: '#9aa7b6', sh: 1 },
  overcast: { el: [56, 66], sun: 0xe6eaee, sunI: 0.85, sky: 0xd8dee6, gnd: 0x4f5642, hemiI: 1.05, fill: 0.12, exp: 0.95, zen: '#848d99', hor: '#c1c6cb', hor2: '#b4b9bf', gndC: '#4b5240', fog: '#adb3ba', fogN: 80, fogF: 540, lights: 0.45, clouds: 1, sunS: 0.12, cLit: '#d4d8dc', cDark: '#6d747d', sh: 0.3 },
  dusk: { el: [9, 15], sun: 0xffa961, sunI: 2.25, sky: 0x9ea6d4, gnd: 0x4b3d2d, hemiI: 0.75, fill: 0.14, exp: 1.04, zen: '#2f4277', hor: '#f3a46a', hor2: '#8e86a8', gndC: '#3f3a34', fog: '#b08a80', fogN: 140, fogF: 720, lights: 0.85, clouds: 0.5, sunS: 1.3, cLit: '#ffc596', cDark: '#5c4f6c', sh: 1 },
  night: { el: [64, 64], sun: 0xf4f6ff, sunI: 1.9, sky: 0xa3b4d8, gnd: 0x2b3a22, hemiI: 0.34, fill: 0.5, exp: 1, zen: '#05090f', hor: '#2c3340', hor2: '#1c2330', gndC: '#0f1318', fog: '#161c27', fogN: 110, fogF: 460, lights: 1, clouds: 0.3, sunS: 0, cLit: '#a7adba', cDark: '#1f2530', sh: 0 },
  dome: { el: [72, 72], sun: 0xfff4e6, sunI: 1.35, sky: 0xf2eee4, gnd: 0x3d4a33, hemiI: 0.7, fill: 0.4, exp: 0.95, zen: '#3a3d44', hor: '#4b4f57', hor2: '#4b4f57', gndC: '#2a2d31', fog: '#2f3238', fogN: 150, fogF: 560, lights: 1, clouds: 0, sunS: 0, cLit: '#ffffff', cDark: '#ffffff', sh: 0 },
};
function atmoOf(T, v) { return VENUE.atmo(T, v, typeof L !== 'undefined' ? L : null, R3D.venueOverride); }
// ---------------- stand shadows ----------------
// The stands, as four walls round the field (x-/x+/z-/z+ positions and rim heights), shade the sun for every lit surface: the grass,
// the crowd, the players, the ball. It is worked out per pixel in the light loop, so a late-afternoon shadow line lies across the
// field and a player who runs into it goes dark too. The uniforms are plain objects shared by reference with every lit material.
const VSH = { a: { x: -200, y: 200, z: -200, w: 300 }, b: { x: 0, y: 0, z: 0, w: 0 }, c: { x: 0, y: 1, z: 0, w: 0 }, d: { x: -999, y: 999, z: 999, w: 0 } };   // d: how far the side stands run (z) and the end stands reach (|x|)
function patchShaders() {
  const C = THREE.ShaderChunk; if (C.__venue) return; C.__venue = true;
  for (const k of ['standard', 'physical']) Object.assign(THREE.ShaderLib[k].uniforms, { venA: { value: VSH.a }, venB: { value: VSH.b }, venC: { value: VSH.c }, venD: { value: VSH.d } });
  C.lights_physical_pars_fragment += `
#define VENUE_SHADOW
uniform vec4 venA;
uniform vec4 venB;
uniform vec4 venC;
uniform vec4 venD;
float venueShadow( vec3 pv ) {
  if ( venC.w <= 0.0 ) return 1.0;
  vec3 q = pv - viewMatrix[ 3 ].xyz;
  vec3 p = vec3( dot( q, viewMatrix[ 0 ].xyz ), dot( q, viewMatrix[ 1 ].xyz ), dot( q, viewMatrix[ 2 ].xyz ) );
  vec3 l = venC.xyz;
  float tx = l.x > 0.001 ? ( venA.y - p.x ) / l.x : ( l.x < -0.001 ? ( venA.x - p.x ) / l.x : 1e6 );
  float tz = l.z > 0.001 ? ( venA.w - p.z ) / l.z : ( l.z < -0.001 ? ( venA.z - p.z ) / l.z : 1e6 );
  float t = min( tx, tz );
  if ( t <= 0.0 ) return 1.0;
  float h;
  if ( tx < tz ) { float za = p.z + tx * l.z; h = za < venD.x || za > venD.y ? -9.0 : ( l.x > 0.0 ? venB.y : venB.x ); }
  else { float xa = p.x + tz * l.x; h = abs( xa ) > venD.z ? -9.0 : ( l.z > 0.0 ? venB.w : venB.z ); }
  float s = 0.5 + 0.018 * t;
  return mix( 1.0, smoothstep( h - s, h + s, p.y + t * l.y ), venC.w );
}
`;
  const s = C.lights_fragment_begin, i = s.indexOf('NUM_DIR_LIGHTS > 0'), tag = 'RE_Direct( directLight, geometry, material, reflectedLight );', j = s.indexOf(tag, i);
  if (i > 0 && j > 0) C.lights_fragment_begin = s.slice(0, j) + '#if defined( VENUE_SHADOW ) && ( UNROLLED_LOOP_INDEX == 0 )\n\t\tdirectLight.color *= venueShadow( geometry.position );\n\t\t#endif\n\t\t' + s.slice(j);
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function venueShadowAt(x, y, z) {     // the same test in JS (choosing the sun)
  const A = VSH.a, B = VSH.b, l = VSH.c, tx = l.x > 0.001 ? (A.y - x) / l.x : l.x < -0.001 ? (A.x - x) / l.x : 1e6, tz = l.z > 0.001 ? (A.w - z) / l.z : l.z < -0.001 ? (A.z - z) / l.z : 1e6, t = Math.min(tx, tz);
  if (t <= 0) return 1; const D = VSH.d, za = z + tx * l.z, xa = x + tz * l.x, h = tx < tz ? (za < D.x || za > D.y ? -9 : l.x > 0 ? B.y : B.x) : (Math.abs(xa) > D.z ? -9 : l.z > 0 ? B.w : B.z), s = 0.5 + 0.018 * t; return sstep(h - s, h + s, y + t * l.y);
}
const colX = v => (v.track ? 48.3 : XS);
function venueBox(v, at) {
  const S = v.stadium;
  if (S === 'dome' && at && at.tod !== 'dome') return [-(XS + 22), XS + 22, ZA - 40, ZB + 40, 48, 48, 44, 44, ZA - 18, ZB + 18, 60];   // retractable roof open: the roof wings shade like a tall bowl
  if (S === 'bowl') return [-(XS + 14), XS + 14, ZA - 38, ZB + 38, 37, 37, 30.5, 30.5, ZA - 14, ZB + 14, 60];
  if (S === 'horseshoe') { const o1 = v.open === 'z1'; return [-(XS + 33), XS + 33, ZA - 33, ZB + 33, 26, 26, o1 ? 26 : 0, o1 ? 0 : 26, o1 ? ZA - 33 : ZA + 5, o1 ? ZB - 5 : ZB + 33, 70]; }
  if (S === 'retro') return [-(XS + 8), XS + 8, ZA - 22, ZB + 22, 30.5, 30.5, 12, 12, ZA + 4, ZB - 4, XS - 6];
  if (S === 'college') { const xb = colX(v); return [-(xb + 18), xb + 12, ZA - 80, ZB + 80, 14.5, 6.5, 0, 0, CZ - 50, CZ + 50, 0]; }
  return [-300, 300, -300, 400, 0, 0, 0, 0, -999, 999, 999];
}
// pick the sun: a direction in the preset's elevation band whose stand shadow covers about the share of the field this game wants
function pickSun(at, P) {
  if (at.tod === 'night') return new THREE.Vector3(-0.3, 0.88, -0.36).normalize();
  if (at.tod === 'dome') return new THREE.Vector3(0.16, 0.96, 0.22).normalize();
  const tgt = at.tod === 'dusk' ? 0.25 + 0.3 * at.tgt : at.tod === 'day' ? 0.04 + 0.26 * at.tgt : 0.1, els = at.tod === 'dusk' ? [0, 0.3, 0.6, 1, 1.5, 2.2] : [0, 0.5, 1];
  let best = null; const c0 = Object.assign({}, VSH.c);
  for (const ek of els) for (let k = 0; k < 24; k++) {
    const el = (P.el[0] + (P.el[1] - P.el[0]) * (ek <= 1 ? ek : 1) + (ek > 1 ? (ek - 1) * 9 : 0) + at.el * 3) * Math.PI / 180, az = (at.az + k / 24) * Math.PI * 2;
    Object.assign(VSH.c, { x: Math.cos(el) * Math.cos(az), y: Math.sin(el), z: Math.cos(el) * Math.sin(az), w: 1 });
    let sh = 0, n = 0; for (let i = 0; i <= 6; i++) for (let j = 0; j <= 12; j++) { sh += 1 - venueShadowAt(-FW.half0 + i * FW.half0 / 3, 0.3, j * 100 * YD / 12); n++; }
    const score = Math.abs(sh / n - tgt) + ek * 0.02 + k * 0.001; if (!best || score < best.score) best = { score, d: new THREE.Vector3(VSH.c.x, VSH.c.y, VSH.c.z) };
  }
  Object.assign(VSH.c, c0); return best.d;
}
// ---------------- canvas helpers ----------------
const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function shadeC(h, k) { const c = new THREE.Color(h); if (k < 0) c.multiplyScalar(1 + k); else c.lerp(new THREE.Color(1, 1, 1), k); return '#' + c.getHexString(); }
function lumHex(h) { const c = new THREE.Color(h); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; }
const hexMix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const rgba = (h, a) => { const c = new THREE.Color(h); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };
const lin3 = h => { const c = col(h); return [c.r, c.g, c.b]; };
const FONTS = { block: '800 #px "Barlow Condensed", "Arial Narrow", sans-serif', slab: '#px Graduate, Rockwell, Georgia, serif', italic: 'italic 800 #px "Barlow Condensed", "Arial Narrow", sans-serif', tall: '700 #px Teko, "Arial Narrow", sans-serif', plain: '600 #px Barlow, Arial, sans-serif' };
const fontOf = (k, px) => (FONTS[k] || FONTS.block).replace('#', Math.max(4, Math.round(px)));
function fitText(x, txt, cx, cy, maxW, mode) {   // draw centred text squeezed to maxW (mode: 'fill' | 'stroke' | 'both')
  const w = x.measureText(txt).width || 1, k = Math.min(1, maxW / w); x.save(); x.translate(cx, cy); x.scale(k, 1);
  if (mode !== 'fill') x.strokeText(txt, 0, 0); if (mode !== 'stroke') x.fillText(txt, 0, 0); x.restore();
}
const canvasTex = (c, rep, aniso = 4) => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy()); return t; };
let speckleCv = null;
function speckle() {   // paint knock-out: grass blades poking through painted lines and logos
  if (speckleCv) return speckleCv; const c = mkCv(256, 256), x = c.getContext('2d'), r = rngOf(77);
  for (let i = 0; i < 3200; i++) { x.fillStyle = `rgba(0,0,0,${(0.25 + r() * 0.75).toFixed(2)})`; const s = 0.7 + r() * 1.6; x.fillRect(r() * 256, r() * 256, s, s * (0.8 + r() * 1.4)); }
  return (speckleCv = c);
}
// ---------------- the field texture ----------------
// The canvas holds the ground colour, the wear and the paint. The mowing pattern, the blade grain and the turf infill are added by
// the field shader (procedural, so they stay crisp up close and the stripes catch the light differently as the camera turns).
const GRASS = [   // sRGB base / dry-worn / bare-dirt: muted, real-world greens
  { base: '#365025', dry: '#655e39', dirt: '#4e402d' },
  { base: '#304c24', dry: '#5b5938', dirt: '#483d2e' },
  { base: '#2d4a2a', dry: '#57583b', dirt: '#433b2f' },
  { base: '#3b5227', dry: '#6d643e', dirt: '#53442d' }];
const TURF = { base: '#24472a', dry: '#2b4f2f', dirt: '#1a1c1b' };
function fieldTexture(home, view) {
  const v = VEN.v, at = VEN.at, key = home.id + '_' + view + '_' + FIELD.halfW.toFixed(2) + '_' + VEN.sig; if (cache.fieldTex[key]) return cache.fieldTex[key];
  const W0 = coarse ? 1024 : 1536, Wt = Math.round(W0 * (FIELD.wk || 1)), Ht = W0 * 2.25, s = W0 / 1024, ppy = Ht / 120;
  const cv = mkCv(Wt, Ht), g = cv.getContext('2d'), pc = mkCv(Wt, Ht), p = pc.getContext('2d');
  const zToY = z => (z + 10 * YDm) / (120 * YDm) * Ht, xToX = x => (x + FIELD.halfW) / (2 * FIELD.halfW) * Wt, ydY = yd => zToY(yd * YDm);
  const r = rngOf(v.seed ^ 0x5eed), turf = v.surface === 'turf', G = turf ? TURF : GRASS[v.grass % GRASS.length], wear = v.wear * (0.55 + 0.75 * at.late);
  const c1 = home.c1 || '#1e3a8a', c2 = home.c2 || '#ffffff', hashW = xToX(FIELD.hashX) - xToX(-FIELD.hashX);
  // 1) ground: the base colour, broad soft variation (big hand-placed blotches, no repeated noise), dry and bare patches where the game is played
  g.fillStyle = G.base; g.fillRect(0, 0, Wt, Ht);
  const blot = (x, y, rad, colr, a) => { if (a <= 0.003) return; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgba(colr, a)); gr.addColorStop(1, rgba(colr, 0)); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); };
  const clump = (x, y, rad, colr, a) => { for (let k = 0; k < 6; k++) blot(x + (r() - 0.5) * rad * 1.3, y + (r() - 0.5) * rad, rad * (0.3 + r() * 0.5), colr, a); };
  for (let i = 0; i < (turf ? 30 : 110); i++) { const x = r() * Wt, y = r() * Ht, rad = (40 + r() * 170) * s, k = r();
    blot(x, y, rad, k < 0.4 ? G.dry : k < 0.75 ? shadeC(G.base, -0.22) : shadeC(G.base, 0.12), (turf ? 0.03 : 0.05 + 0.08 * r())); }
  if (!turf) {
    { const gr = g.createLinearGradient(0, 0, Wt, 0); gr.addColorStop(0, 'rgba(0,0,0,0.05)'); gr.addColorStop(0.5, rgba(G.dry, 0.06)); gr.addColorStop(1, 'rgba(0,0,0,0.05)'); g.fillStyle = gr; g.fillRect(0, 0, Wt, Ht); }
    for (let i = 0; i < 190 * wear; i++) { const yd = 1 + r() * 98, mid = 1 - Math.abs(yd - 50) / 70, x = Wt / 2 + (r() - 0.5) * hashW * (1.1 + r() * 0.6), rad = (16 + r() * 46) * s;   // between the hashes
      clump(x, ydY(yd), rad, r() < 0.22 * wear ? G.dirt : G.dry, (0.05 + 0.11 * r()) * (0.45 + mid) * Math.min(1, wear)); }
    for (const gl of [0, 100]) { const dir = gl ? -1 : 1;                                     // the goal mouths: line play inside the 5, the PAT and field-goal spots
      for (let i = 0; i < 40 * wear; i++) { const yd = gl + dir * (0.5 + Math.pow(r(), 1.6) * 9), x = Wt / 2 + (r() - 0.5) * hashW * 1.6; clump(x, ydY(yd), (14 + r() * 34) * s, r() < 0.45 ? G.dirt : G.dry, (0.08 + 0.12 * r()) * Math.min(1, wear)); }
      for (const yd of [gl + dir * 7, gl + dir * 22, gl + dir * 35]) for (let i = 0; i < 5; i++) blot(Wt / 2 + (r() - 0.5) * hashW * 0.8, ydY(yd + (r() - 0.5) * 1.2), (5 + r() * 9) * s, G.dirt, 0.25 * Math.min(1, wear)); }
    for (let i = 0; i < 60 * wear; i++) { const sx = r() < 0.5 ? 0 : Wt, yd = 20 + r() * 60; clump(sx + (sx ? -1 : 1) * r() * 40 * s, ydY(yd), (20 + r() * 40) * s, G.dry, 0.08 * Math.min(1, wear)); }   // the sideline traffic
  }
  if (at.weather === 'snow') snowCover(g, Wt, Ht, r, s, Wt / 2, hashW);
  // 2) paint, on its own layer: lines (hand-painted on grass: a little uneven), numbers, end zones, the midfield logo
  const ink = turf ? '#f5f5f0' : '#eeeee4'; p.fillStyle = ink; p.strokeStyle = ink;
  const hline = (y, w) => { if (turf) { p.fillRect(0, y - w / 2, Wt, w); return; } const n = 9; for (let i = 0; i < n; i++) { p.globalAlpha = 0.86 + r() * 0.14; const ww = w * (0.9 + r() * 0.2); p.fillRect(i * Wt / n, y - ww / 2 + (r() - 0.5) * 0.8 * s, Wt / n + 1, ww); } p.globalAlpha = 1; };
  const tick = (x, y, w, h) => p.fillRect(x - w / 2 + (turf ? 0 : (r() - 0.5) * 1.2 * s), y - h / 2 + (turf ? 0 : (r() - 0.5) * 0.8 * s), w, h);
  p.fillRect(0, 0, 7 * s, Ht); p.fillRect(Wt - 7 * s, 0, 7 * s, Ht); p.fillRect(0, 0, Wt, 7 * s); p.fillRect(0, Ht - 7 * s, Wt, 7 * s);
  // end zones (home ground: the home team's colours at both ends)
  const nameT = (home.name || '').toUpperCase(), cityT = (home.city || home.name || '').toUpperCase();
  const ezText = [v.ezText === 'city' ? cityT : nameT, v.ezText === 'name' ? nameT : cityT];
  const ezAcc = Math.abs(lumHex(c2) - lumHex(c1)) > 0.25 ? c2 : lumHex(c1) > 0.6 ? '#151515' : '#f4f4ef', dark = lumHex(c1) > 0.6 ? '#151515' : '#f4f4ef';
  const endZone = (y0, y1, rot, text) => {
    const h = y1 - y0, inset = 7 * s; p.save(); p.beginPath(); p.rect(inset + 4 * s, y0 + inset, Wt - 2 * inset - 8 * s, h - 2 * inset); p.clip();
    const fillA = turf ? 1 : 0.9; p.globalAlpha = fillA;
    if (v.ez === 'solid' || v.ez === 'stripes' || v.ez === 'argyle') { p.fillStyle = c1; p.fillRect(0, y0, Wt, h); }
    if (v.ez === 'stripes') { p.fillStyle = shadeC(c1, -0.3); for (let i = -Ht; i < Wt + h; i += 56 * s) { p.save(); p.translate(i, y0); p.rotate(-0.75); p.fillRect(0, -h * 2, 24 * s, h * 4); p.restore(); } }
    if (v.ez === 'argyle') { const dw = 120 * s, dh = h / 2; p.fillStyle = shadeC(c1, -0.26);
      for (let ix = -1; ix * dw < Wt + dw; ix++) for (let iy = 0; iy < 3; iy++) { if ((ix + iy) % 2) continue; const cx = ix * dw, cy = y0 + iy * dh; p.beginPath(); p.moveTo(cx, cy - dh / 2); p.lineTo(cx + dw / 2, cy); p.lineTo(cx, cy + dh / 2); p.lineTo(cx - dw / 2, cy); p.closePath(); p.fill(); }
      p.strokeStyle = ezAcc; p.globalAlpha = 0.5 * fillA; p.lineWidth = 2.5 * s; for (let ix = -6; ix * dw < Wt + 6 * dw; ix++) { p.beginPath(); p.moveTo(ix * dw, y0 - h); p.lineTo(ix * dw + 2 * h * dw / dh / 2, y0 + h * 2); p.stroke(); p.beginPath(); p.moveTo(ix * dw, y0 - h); p.lineTo(ix * dw - 2 * h * dw / dh / 2, y0 + h * 2); p.stroke(); } p.globalAlpha = fillA; }
    if (v.ez === 'outline' || v.ez === 'script') { p.strokeStyle = c1; p.lineWidth = 9 * s; p.strokeRect(inset + 26 * s, y0 + 22 * s, Wt - 2 * inset - 52 * s, h - 44 * s); }
    p.restore();
    p.save(); p.translate(Wt / 2, (y0 + y1) / 2); p.rotate(rot); p.globalAlpha = turf ? 1 : 0.93;
    const em = h * (v.font === 'tall' ? 0.98 : v.font === 'slab' ? 0.62 : 0.8), font = v.ez === 'script' ? fontOf('italic', h * 0.8) : fontOf(v.font, em), base = h * (v.font === 'tall' ? 0.3 : 0.27), maxW = Wt * 0.84;
    p.font = font; p.textAlign = 'center'; p.textBaseline = 'alphabetic'; p.lineJoin = 'round';
    if (v.ez === 'outline') { p.lineWidth = 12 * s; p.strokeStyle = c1; fitText(p, text, 0, base, maxW, 'stroke'); p.lineWidth = 4 * s; p.strokeStyle = ink; fitText(p, text, 0, base, maxW, 'stroke'); }
    else if (v.ez === 'script') { p.lineWidth = 14 * s; p.strokeStyle = ezAcc === c2 ? c2 : ink; fitText(p, text, 0, base, maxW, 'stroke'); p.fillStyle = c1; fitText(p, text, 0, base, maxW, 'fill'); p.fillRect(-maxW * 0.36, base + 14 * s, maxW * 0.72, 8 * s); }
    else { p.lineWidth = 10 * s; p.strokeStyle = ezAcc === c2 ? dark : shadeC(c1, -0.45); fitText(p, text, 0, base, maxW, 'stroke'); p.fillStyle = ezAcc; fitText(p, text, 0, base, maxW, 'fill'); }
    p.restore(); p.fillStyle = ink; p.globalAlpha = 1;
  };
  endZone(0, ydY(0), 0, ezText[1]); endZone(ydY(100), Ht, Math.PI, ezText[0]);
  // yard lines (goal lines and the 50 wider), 1-yard ticks at the sidelines and hashes, try marks
  p.fillStyle = ink;
  for (let yd = 0; yd <= 100; yd += 5) hline(ydY(yd), (yd % 50 === 0 ? 7.5 : 4.5) * s);
  for (let yd = 1; yd < 100; yd++) { if (yd % 5 === 0) continue; const y = ydY(yd); for (const x of [-FIELD.hashX, FIELD.hashX]) tick(xToX(x), y, 16 * s, 2.6 * s); tick(12 * s, y, 15 * s, 2.6 * s); tick(Wt - 12 * s, y, 15 * s, 2.6 * s); }
  for (const yd of [3, 97]) tick(Wt / 2, ydY(yd), 12 * s, 3 * s);
  // yard numbers with the direction arrows (pointing at the nearer goal line)
  const numF = v.font === 'tall' ? fontOf('tall', 84 * s) : v.font === 'slab' ? fontOf('slab', 50 * s) : fontOf('block', 62 * s);
  p.textAlign = 'center'; p.textBaseline = 'middle'; p.font = numF; p.lineJoin = 'round';
  for (let yd = 10; yd < 100; yd += 10) { const num = String(yd <= 50 ? yd : 100 - yd), y = ydY(yd);
    for (const [x, rot] of [[-FIELD.halfW + 11 * YDm, Math.PI / 2], [FIELD.halfW - 11 * YDm, -Math.PI / 2]]) { p.save(); p.translate(xToX(x), y); p.rotate(rot + (turf ? 0 : (r() - 0.5) * 0.012));
      const txt = num.split('').join(v.font === 'slab' ? '  ' : ' ');
      if (v.nums === 'outline') { p.lineWidth = 7 * s; p.strokeStyle = c1; p.strokeText(txt, 0, v.font === 'tall' ? 6 * s : 0); }
      p.fillStyle = ink; p.fillText(txt, 0, v.font === 'tall' ? 6 * s : 0);
      if (yd !== 50) { const dir = (yd < 50 ? -1 : 1) * (rot > 0 ? 1 : -1), ax = dir * 64 * s; p.beginPath(); p.moveTo(ax, -14 * s); p.lineTo(ax, -30 * s); p.lineTo(ax + dir * 14 * s, -22 * s); p.closePath(); p.fill(); }
      p.restore(); } }
  // the midfield logo
  if (typeof drawLogo === 'function') { const lc = mkCv(384, 384); try { drawLogo(lc.getContext('2d'), home, 384); const sz = (v.logo === 'big' ? 330 : 250) * s * (0.72 + 0.28 * (FIELD.wk || 1)); p.save(); p.translate(Wt / 2, ydY(50)); if (view > 0) p.rotate(Math.PI);
    if (v.logo === 'ring') { p.lineWidth = 7 * s; p.strokeStyle = ink; p.beginPath(); p.arc(0, 0, sz * 0.72, 0, 7); p.stroke(); }
    p.globalAlpha = turf ? 0.96 : 0.84; p.drawImage(lc, -sz / 2, -sz / 2, sz, sz); p.restore(); } catch (e) { } }
  // 3) grass shows through the paint: blades knock tiny holes in it, and heavy traffic wears it thin between the hashes
  if (!turf) { p.save(); p.globalCompositeOperation = 'destination-out'; p.globalAlpha = 0.38; p.fillStyle = p.createPattern(speckle(), 'repeat'); p.fillRect(0, 0, Wt, Ht); p.globalAlpha = 1;
    for (let i = 0; i < 70 * wear; i++) { const yd = 2 + r() * 96, x = Wt / 2 + (r() - 0.5) * hashW * 1.5, y = ydY(yd), rad = (12 + r() * 34) * s, gr = p.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(0,0,0,${(0.35 * Math.min(1, wear)).toFixed(2)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); p.fillStyle = gr; p.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
    p.restore(); }
  g.save(); if (!turf) g.filter = 'blur(0.55px)'; g.drawImage(pc, 0, 0); g.restore();
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  // a field texture is a big canvas plus GPU mips: keep only the few this game flips between
  const keys = Object.keys(cache.fieldTex); if (keys.length >= 4) for (const k of keys) { if (fieldMat && fieldMat.map === cache.fieldTex[k]) continue; cache.fieldTex[k].dispose(); delete cache.fieldTex[k]; }
  return (cache.fieldTex[key] = t);
}
// close-up ground detail, tiled across the field by the turf shader: r = blade grain, g = soft patchiness (two octaves of tiling value noise), b = rubber infill (artificial turf)
function grassDetail() {
  const N = coarse ? 256 : 512, c = mkCv(N, N), x = c.getContext('2d'), im = x.createImageData(N, N), d = im.data, r = rngOf(9);
  const vn = f => { const L0 = Array.from({ length: f * f }, r); return (u, w) => { const X = u * f, Y = w * f, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), at = (i, j) => L0[((j % f + f) % f) * f + ((i % f + f) % f)];
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; }; };
  const n1 = vn(4), n2 = vn(11), n3 = vn(29);
  const col0 = new Float32Array(N); for (let i = 0; i < N; i++) col0[i] = r();
  for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) { const i = yy * N + xx, u = xx / N, w = yy / N;
    col0[xx] = col0[xx] * 0.6 + r() * 0.4;                                  // grain runs a little along the field
    const blade = r() < 0.07 ? 1 : r() < 0.05 ? 0 : col0[xx] * 0.7 + r() * 0.3;
    d[i * 4] = Math.round(255 * Math.min(1, 0.15 + 0.8 * blade));
    d[i * 4 + 1] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + (n1(u, w) - 0.5) * 0.9 + (n2(u, w) - 0.5) * 0.5 + (n3(u, w) - 0.5) * 0.25)));
    d[i * 4 + 2] = r() < 0.16 ? Math.round(255 * r() * 0.5) : 255; d[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
// the ground shader (field, apron, borders): blade grain, broad patchiness, rubber infill on turf; on the field also the mowing pattern,
// whose stripes are lighter or darker by which way the grass was mowed relative to the camera (a real field changes as you move round it)
const GROUND_PARS = 'uniform sampler2D tDetail;\nuniform vec4 uMow;\nuniform float uK;\nfloat sqw( float t ) { return clamp( sin( 3.14159265 * t ) * 9.0, -1.0, 1.0 ); }\n';
function groundShader(m, U, rx, ry, kind) {
  const field = kind === 'field';
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.fragmentShader = GROUND_PARS + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
{ vec2 dUv = vUv * vec2( ${rx.toFixed(2)} * uK, ${ry.toFixed(2)} );
  float gb = texture2D( tDetail, dUv ).r, gp = texture2D( tDetail, dUv * 0.13 + 0.31 ).g, gq = texture2D( tDetail, dUv * 0.037 + 0.57 ).g, pel = texture2D( tDetail, dUv * 2.3 ).b;
  diffuseColor.rgb *= mix( 0.8 + 0.36 * gb, 0.93 + 0.13 * gb, uMow.w ) * ( 0.88 + 0.24 * gp ) * ( 0.92 + 0.16 * gq ) * mix( 1.0, 0.62 + 0.38 * pel, uMow.w );
  ${field ? `vec2 fy = vec2( ( vUv.x - 0.5 ) * 53.333 * uK, 110.0 - 120.0 * vUv.y ); float m = 0.0;
  if ( uMow.x > 0.5 ) { if ( uMow.x < 1.5 ) m = sqw( fy.y / 5.0 ); else if ( uMow.x < 2.5 ) m = sqw( fy.y / 10.0 ); else if ( uMow.x < 3.5 ) m = sqw( fy.y / 5.0 ) * sqw( fy.x / 5.3333 ); else if ( uMow.x < 4.5 ) m = sqw( ( fy.x + fy.y ) / 7.07 ) * sqw( ( fy.x - fy.y ) / 7.07 ); else m = sqw( fy.x / 4.4444 ); }
  vec2 vd = normalize( fy * 0.9144 - cameraPosition.xz + vec2( 0.001 ) );
  diffuseColor.rgb *= 1.0 + m * uMow.y * mix( 1.0, uMow.x > 4.5 ? vd.y : vd.x, uMow.z );` : kind === 'apron' ? `vec2 ap = vec2( ( vUv.x - 0.5 ) * 420.0, ( 0.5 - vUv.y ) * 520.0 ); float dd = length( max( abs( ap ) - vec2( 52.0, 82.0 ), 0.0 ) );
  diffuseColor.rgb *= mix( 1.0, 0.1 + 0.9 * exp( -dd / 26.0 ), uMow.y );` : ''}
}
#endif`); };
  m.customProgramCacheKey = () => 'ground3|' + rx + '|' + ry + '|' + kind;
}
// ---------------- sky, clouds, environment light ----------------
function makeSky() {
  skyU = { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, hor2: { value: new THREE.Color() }, gnd: { value: new THREE.Color() }, sunC: { value: new THREE.Color() }, sunD: { value: new THREE.Vector3(0, 1, 0) },
    sunS: { value: 0 }, cLit: { value: new THREE.Color() }, cDark: { value: new THREE.Color() }, cloudA: { value: 0 }, tCloud: { value: null } };
  const m = new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
    fragmentShader: `uniform vec3 zen; uniform vec3 hor; uniform vec3 hor2; uniform vec3 gnd; uniform vec3 sunC; uniform vec3 sunD; uniform vec3 cLit; uniform vec3 cDark; uniform float sunS; uniform float cloudA; uniform sampler2D tCloud; varying vec3 vDir;
void main() {
  vec3 d = normalize( vDir ); float h = d.y, sd = max( dot( d, sunD ), 0.0 );
  vec2 hz = normalize( d.xz + vec2( 0.0001 ) ), sz = normalize( sunD.xz + vec2( 0.0001 ) );
  vec3 hc = mix( hor2, hor, pow( 0.5 + 0.5 * dot( hz, sz ), 1.6 ) );
  vec3 c = mix( hc, zen, pow( clamp( h, 0.0, 1.0 ), 0.48 ) );
  c = mix( c, gnd, smoothstep( 0.0, -0.05, h ) );
  c += sunC * sunS * ( 0.16 * pow( sd, 5.0 ) + 0.45 * pow( sd, 60.0 ) + 5.0 * smoothstep( 0.99991, 0.99996, sd ) );
  if ( cloudA > 0.0 && h > -0.02 ) {
    vec4 k = texture2D( tCloud, vec2( atan( d.z, d.x ) / 6.2831853 + 0.5, asin( clamp( h, 0.0, 1.0 ) ) / 1.5707963 ) );
    vec3 cc = mix( cDark, cLit, k.r ) * ( 1.0 + 0.9 * pow( sd, 5.0 ) * sunS );
    c = mix( c, cc, k.a * cloudA * smoothstep( -0.02, 0.03, h ) );
  }
  gl_FragColor = vec4( c, 1.0 );
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), m); mesh.frustumCulled = false; mesh.renderOrder = -20; return mesh;
}
// clouds in an equirectangular strip: y = elevation (bottom = horizon), alpha = cover, red = how sunlit. Cumulus by day, a lid of stratus
// when overcast, sparse dark cloud and stars at night.
function cloudTex(at, P, seed) {
  const Wc = coarse ? 1024 : 2048, Hc = Wc / 4, c = mkCv(Wc, Hc), x = c.getContext('2d'), r = rngOf(seed), wet = at.weather !== 'clear', over = at.tod === 'overcast' || wet;
  const puff = (px, py, pr, a, lit) => { for (const ox of [0, -Wc, Wc]) { if (px + ox < -pr || px + ox > Wc + pr) continue; const gr = x.createRadialGradient(px + ox, py - pr * 0.3, 0, px + ox, py, pr); const L1 = Math.round(255 * lit), L2 = Math.round(255 * lit * 0.55);
    gr.addColorStop(0, `rgba(${L1},0,0,${a})`); gr.addColorStop(0.6, `rgba(${L2},0,0,${a * 0.55})`); gr.addColorStop(1, `rgba(${L2},0,0,0)`); x.fillStyle = gr; x.fillRect(px + ox - pr, py - pr, 2 * pr, 2 * pr); } };
  if (over) { x.fillStyle = 'rgba(140,0,0,0.9)'; x.fillRect(0, 0, Wc, Hc);              // a lid of stratus: darker rolls and paler breaks, flattened toward the horizon
    for (let i = 0; i < 520; i++) { const el = Math.pow(r(), 0.85), y = Hc * (1 - el * 0.97), w = (0.02 + r() * 0.07) * Wc * (0.35 + el), dk = r() < 0.6; x.save(); x.translate(0, y); x.scale(1, 0.22 + 0.5 * el); puff(r() * Wc, 0, w, dk ? 0.6 : 0.4, dk ? 0.05 + r() * 0.18 : 0.85 + r() * 0.15); x.restore(); } }
  else if (at.tod === 'night') { for (let i = 0; i < 700; i++) { const el = 0.12 + r() * 0.88, sx = r() * Wc, sy = Hc * (1 - el), a = 0.25 + r() * 0.75; x.fillStyle = `rgba(255,0,0,${a.toFixed(2)})`; x.fillRect(sx, sy, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
    for (let i = 0; i < 18; i++) { const el = Math.pow(r(), 2) * 0.3, cx = r() * Wc, y = Hc * (1 - el); for (let k = 0; k < 10; k++) puff(cx + (r() - 0.5) * 220, y - r() * 20, (20 + r() * 50) * (Wc / 2048), 0.5, 0.15); } }
  else { const n = Math.round(70 * P.clouds * (0.5 + r()));
    for (let i = 0; i < n; i++) { const el = Math.pow(r(), 1.7) * 0.5, base = Hc * (1 - el), cx = r() * Wc, sz = (0.05 + el * 0.4) * Hc * (0.6 + r() * 0.8), np = 7 + (r() * 12 | 0);
      x.save(); x.beginPath(); x.rect(0, 0, Wc, base); x.clip();        // flat bases
      for (let k = 0; k < np; k++) { const px = cx + (r() - 0.5) * sz * 3.2, py = base - r() * sz * 0.8, pr = sz * (0.3 + r() * 0.5); puff(px, py, pr, 0.7, 0.55 + 0.45 * (1 - (py - (base - sz)) / (sz * 1.6))); }
      x.restore(); }
    for (let i = 0; i < 30 * P.clouds; i++) { const y = Hc * (1 - (0.35 + r() * 0.5)), cx = r() * Wc; for (let k = 0; k < 6; k++) puff(cx + k * 30 * (Wc / 2048) + r() * 20, y + (r() - 0.5) * 10, (14 + r() * 26) * (Wc / 2048), 0.22, 0.95); } }   // high wisps
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; return t;
}
function makeEnv(P, at, v) {   // the reflections (helmets, wet grass): the sky as it is today, the stadium lights when they are on
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(), g = new THREE.SphereGeometry(50, 32, 16), pos = g.attributes.position, cols = [];
  const zen = col(P.zen), hor = col(P.hor), grd = col(P.gndC);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50, c = y > 0 ? hor.clone().lerp(zen, Math.pow(y, 0.6)) : hor.clone().lerp(grd, Math.min(1, -y * 4)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const mats = [new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })]; es.add(new THREE.Mesh(g, mats[0]));
  const geos = [g];
  if (P.lights > 0.3) { const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(v && !v.led ? 0xffe2b8 : 0xfff4dd).multiplyScalar(P.lights * 1.4) }), bg = new THREE.BoxGeometry(8, 3, 1); mats.push(lamp); geos.push(bg);
    for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30], [0, -40], [0, 40]]) { const m = new THREE.Mesh(bg, lamp); m.position.set(x, 26, z); m.lookAt(0, 0, 0); es.add(m); } }
  if (P.sunS > 0.3) { const sm = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.sun).multiplyScalar(6 * P.sunS) }), sg = new THREE.SphereGeometry(3, 12, 8), m = new THREE.Mesh(sg, sm); m.position.copy(sunDir).multiplyScalar(40); es.add(m); mats.push(sm); geos.push(sg); }
  const rt = pm.fromScene(es, 0.04); pm.dispose(); for (const x of geos) x.dispose(); for (const x of mats) x.dispose(); return rt;
}
// ---------------- geometry batching: the whole stadium is a handful of draw calls, one per material ----------------
function Batch() {
  const P = [], N = [], U = [], C = [], I = []; let nv = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3(), m4 = new THREE.Matrix4(), o = new THREE.Object3D();
  const B = {
    get n() { return nv; },
    add(g, m, c, uvS) {     // a geometry (disposed here) moved by matrix m, tinted c ([r,g,b] linear) and its uvs scaled by uvS
      const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; if (m) nm.getNormalMatrix(m); const cc = c || WHITE3;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (m) v.applyMatrix4(m); P.push(v.x, v.y, v.z);
        if (n) { v.fromBufferAttribute(n, i); if (m) v.applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 1, 0);
        U.push(uv ? uv.getX(i) * (uvS ? uvS[0] : 1) : 0, uv ? uv.getY(i) * (uvS ? uvS[1] : 1) : 0); C.push(cc[0], cc[1], cc[2]); }
      if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + nv); else for (let i = 0; i < p.count; i++) I.push(i + nv);
      nv += p.count; g.dispose(); return B; },
    box(w, h, d, x, y, z, c, ry = 0, uvS) { m4.makeRotationY(ry).setPosition(x, y, z); return B.add(new THREE.BoxGeometry(w, h, d), m4, c, uvS); },
    bar(a, b, rad, c, seg = 6) { const d = new THREE.Vector3().subVectors(b, a), Ln = d.length(); if (Ln < 1e-4) return B; const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      m4.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, Ln, 1)); return B.add(new THREE.CylinderGeometry(rad, rad, 1, seg, 1), m4, c); },
    facing(g, x, y, z, tx, ty, tz, c, uvS) { o.position.set(x, y, z); o.lookAt(tx, ty, tz); o.updateMatrix(); return B.add(g, o.matrix, c, uvS); },   // +z of the geometry toward the target
    raw(pos, nor, uv, cols, idx) { for (const a of pos) P.push(a); for (const a of nor) N.push(a); for (const a of uv) U.push(a); for (const a of cols) C.push(a); for (const i of idx) I.push(i + nv); nv += pos.length / 3; return B; },
    mesh(mat, name) { if (!nv) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); const ms = new THREE.Mesh(g, mat); ms.name = name || ''; ms.matrixAutoUpdate = false; return ms; },
  };
  return B;
}
// a path round (or along) the field: points {x, z, nx, nz} with the outward normal. Rounded rectangle, optionally open at one end (a horseshoe).
function rrPath(ax, z0, z1, rc, step, open) {
  const cz0 = z0 + rc, cz1 = z1 - rc, cx = ax - rc, pts = [], add = (x, z, nx, nz) => pts.push({ x, z, nx, nz });
  const line = (x0, za, x1, zb, nx, nz) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, zb - za) / 12)); for (let i = 0; i < n; i++) add(x0 + (x1 - x0) * i / n, za + (zb - za) * i / n, nx, nz); };
  const arc = (ccx, ccz, a0, a1) => { const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) * rc / step)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; add(ccx + Math.cos(a) * rc, ccz + Math.sin(a) * rc, Math.cos(a), Math.sin(a)); } };
  if (!open) { line(0, z1, -cx, z1, 0, 1); arc(-cx, cz1, Math.PI / 2, Math.PI); line(-ax, cz1, -ax, cz0, -1, 0); arc(-cx, cz0, Math.PI, 1.5 * Math.PI); line(-cx, z0, cx, z0, 0, -1); arc(cx, cz0, 1.5 * Math.PI, 2 * Math.PI); line(ax, cz0, ax, cz1, 1, 0); arc(cx, cz1, 0, Math.PI / 2); add(0, z1, 0, 1); return pts; }
  const ze = z1 - rc * 0.2; line(-ax, ze, -ax, cz0, -1, 0); arc(-cx, cz0, Math.PI, 1.5 * Math.PI); line(-cx, z0, cx, z0, 0, -1); arc(cx, cz0, 1.5 * Math.PI, 2 * Math.PI); line(ax, cz0, ax, ze, 1, 0); add(ax, ze, 1, 0);
  if (open === 'z0') { const mz = (z0 + z1) / 2; for (const p of pts) { p.z = 2 * mz - p.z; p.nz = -p.nz; } }
  return pts;
}
const straight = (x0, z0, x1, z1, nx, nz) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 12)), pts = []; for (let i = 0; i <= n; i++) pts.push({ x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n, nx, nz }); return pts; };
// sweep a stand profile along a path. prof = [[d, y, kind], ...]: d = metres out from the path, each segment goes to batchOf(kind) with
// tiles (metres) tile[kind] = [u, v] ('fit' v = once over the segment), tinted tint(kind, edge 0 bottom / 1 top, point)
function sweep(path, prof, batchOf, tile, tint) {
  const arc = [0]; for (let i = 1; i < path.length; i++) arc.push(arc[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  const ur = path.length > 1 && (path[1].x - path[0].x) * -path[0].nz + (path[1].z - path[0].z) * path[0].nx < 0 ? -1 : 1;   // lettering reads left to right from the field
  for (let j = 0; j < prof.length - 1; j++) {
    const [d0, y0, kind] = prof[j], [d1, y1] = prof[j + 1], len = Math.hypot(d1 - d0, y1 - y0), B = kind && batchOf(kind); if (!B || len < 1e-3) continue;
    const nd = -(y1 - y0) / len, ny = (d1 - d0) / len, tl = tile[kind] || [8, 8], tv = tl[1] === 'fit' ? len : tl[1], pos = [], nor = [], uv = [], cs = [], idx = [];
    let flip = false; if (path.length > 1) { const p0 = path[0], p1 = path[1], ex = p0.nx * (d1 - d0), ey = y1 - y0, ez = p0.nz * (d1 - d0), fx = p1.x + p1.nx * d0 - p0.x - p0.nx * d0, fz = p1.z + p1.nz * d0 - p0.z - p0.nz * d0;
      flip = (ey * fz) * nd * p0.nx + (ez * fx - ex * fz) * ny + (-ey * fx) * nd * p0.nz < 0; }   // winding that agrees with the normal (double-sided lighting goes by winding)
    for (let i = 0; i < path.length; i++) { const p = path[i];
      pos.push(p.x + p.nx * d0, y0, p.z + p.nz * d0, p.x + p.nx * d1, y1, p.z + p.nz * d1); nor.push(nd * p.nx, ny, nd * p.nz, nd * p.nx, ny, nd * p.nz);
      uv.push(ur * arc[i] / tl[0], 0, ur * arc[i] / tl[0], len / tv); const a = tint(kind, 0, p, i), b = tint(kind, 1, p, i); cs.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      if (i) { const k = (i - 1) * 2; if (flip) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    B.raw(pos, nor, uv, cs, idx);
  }
}
function capEnd(B, p, tx, tz, prof, c) {   // close the open end of a stand: the profile's side wall
  const d1 = Math.max(...prof.map(q => q[0])), pts = prof.map(q => [q[0], q[1]]).concat([[d1, 0], [0, 0]]), pos = [], nor = [], uv = [], cs = [], idx = [];
  for (const [d, y] of pts) { pos.push(p.x + p.nx * d, y, p.z + p.nz * d); nor.push(tx, 0, tz); uv.push(d / 8, y / 8); cs.push(c[0], c[1], c[2]); }
  const n = pts.length, piv = n - 2; for (let i = 0; i < n - 1; i++) { if (i === piv || i + 1 === piv) continue; idx.push(piv, i, i + 1); }
  { const P0 = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], a = P0(idx[0]), q = P0(idx[1]), w = P0(idx[2]), e = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], f = [w[0] - a[0], w[1] - a[1], w[2] - a[2]];
    if ((e[1] * f[2] - e[2] * f[1]) * tx + (e[0] * f[1] - e[1] * f[0]) * tz < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
  B.raw(pos, nor, uv, cs, idx);
}
// ---------------- stadium textures ----------------
// made-up sponsors only (name, background, lettering, font)
const ADS = [['VELLUM BANK', '#0f2a4a', '#e8eef5', 'slab'], ['HARROWAY TIRE', '#121212', '#f2c230', 'italic'], ['OXBOW ENERGY', '#0d4d3a', '#e9f5ee', 'block'], ['LARKSPUR MOBILE', '#4b2577', '#ffffff', 'tall'],
  ['QUILLFIELD INSURANCE', '#f1efe8', '#1d3b6e', 'plain'], ['BRAMBLE HARDWARE', '#8a1d1d', '#ffffff', 'block'], ['TIDEWATER AIR', '#e6f0fa', '#0e5aa7', 'italic'], ['COPPERLINE COLA', '#b5481f', '#fff3e0', 'slab'],
  ['NORTHGATE FREIGHT', '#1a1a1a', '#ffffff', 'tall'], ['SUNDIAL MARKETS', '#f0b000', '#2b2b2b', 'block'], ['REDFERN MOTORS', '#f4f4f4', '#b3121b', 'italic'], ['PALISADE HEALTH', '#0a6b78', '#ffffff', 'plain']];
const shuffleR = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function crowdTex(v, home, away, o, seed) {   // one tile = a section of 32 seats x 16 rows, aisle stairs at its edge
  const Wc = 1024, Hc = Wc / 2, cv = mkCv(Wc, Hc), x = cv.getContext('2d'), r = rngOf(seed), cols = 32, rows = 16, cw = Wc / cols, rh = Hc / rows;
  const fillN = Array.from({ length: 5 * 5 }, r), fill = (c, row) => { const u = c / cols * 4, w = row / rows * 4, i = Math.floor(u), j = Math.floor(w), fu = u - i, fw = w - j, at = (a, b) => fillN[(b % 5) * 5 + (a % 5)]; return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fw) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fw; };
  const c1 = home.c1 || '#1d3478', c2 = home.c2 || '#ffffff', a1 = (away && away.c1) || '#777777', mute = (h, k = 0.3) => hexMix(h, '#2b2e34', k);
  const seatOf = (row, c) => v.seats === 'c1' ? mute(c1, 0.35) : v.seats === 'two' ? (((c >> 3) + (row >> 3)) % 2 ? mute(c1, 0.35) : mute(c2, 0.45)) : v.seats === 'mixed' ? ['#9b3a2f', '#2f5d9a', '#c79a2c', '#3e7b47', '#8c8f93'][hashS(row + ':' + c) % 5] : '#585e66';
  const shirts = [[c1, 34], [c2, 11], [shadeC(c1, -0.4), 8], ['#e9e6dc', 9], ['#1c1e22', 12], ['#6c727a', 6], [a1, o.away || 6], ['#8b2b23', 3], ['#2f5b8a', 3], ['#c9a227', 2], ['#3d6b3a', 2]], tot = shirts.reduce((s, w) => s + w[1], 0);
  const shirt = () => { let k = r() * tot; for (const [h, w] of shirts) { k -= w; if (k <= 0) return mute(h, 0.24); } return '#444'; };
  const skin = ['#e9c4a2', '#d9a77f', '#c08a5e', '#8a5a36', '#5b3a22', '#f0d2b8'], hair = ['#1a1410', '#3b2a1e', '#6b4a2a', '#a07a4a', '#2a2a2a', '#c9c2b8'];
  x.fillStyle = o.tread; x.fillRect(0, 0, Wc, Hc);
  for (let row = 0; row < rows; row++) { const y = row * rh;
    x.fillStyle = shadeC(o.tread, 0.18); x.fillRect(0, y + rh * 0.84, Wc, rh * 0.16);                 // the step face, catching the light
    if (o.bleach) { x.fillStyle = '#a9adb2'; x.fillRect(0, y + rh * 0.66, Wc, rh * 0.14); x.fillStyle = '#7d8187'; x.fillRect(0, y + rh * 0.8, Wc, rh * 0.04); }
    for (let c = 0; c < cols; c++) { const sx = c * cw;
      if (c === 0) { x.fillStyle = shadeC(o.tread, 0.08); x.fillRect(sx, y, cw * 0.9, rh); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(sx, y + rh * 0.5, cw * 0.9, rh * 0.06); continue; }   // aisle stairs
      if (!o.bleach) { x.fillStyle = seatOf(row, c); x.fillRect(sx + cw * 0.1, y + rh * 0.4, cw * 0.8, rh * 0.44); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(sx + cw * 0.1, y + rh * 0.74, cw * 0.8, rh * 0.1); }
      if (r() > o.dens * (0.82 + 0.36 * fill(c, row))) continue;
      const up = r() < 0.07, lean = (r() - 0.5) * 0.5, jx = sx + cw * (0.5 + (r() - 0.5) * 0.42), ty = y + rh * ((up ? 0.12 : 0.3) + (r() - 0.5) * 0.14), sh = shirt(), bw = cw * (0.27 + r() * 0.13);
      x.fillStyle = sh; x.beginPath(); x.moveTo(jx - bw, y + rh * 0.86); x.lineTo(jx - bw + lean * 2, ty + rh * 0.12); x.quadraticCurveTo(jx + lean * 3, ty - rh * 0.03, jx + bw + lean * 2, ty + rh * 0.12); x.lineTo(jx + bw, y + rh * 0.86); x.fill();
      if (up) { const a1 = r() < 0.5; x.fillRect(jx - bw - cw * 0.08, ty - rh * (a1 ? 0.32 : 0.05), cw * 0.09, rh * (a1 ? 0.44 : 0.3)); x.fillRect(jx + bw - cw * 0.01, ty - rh * 0.32, cw * 0.09, rh * 0.44); }
      const hy = ty - rh * 0.06, hr = cw * (0.14 + r() * 0.06); x.fillStyle = skin[(r() * skin.length) | 0]; x.beginPath(); x.arc(jx, hy, hr, 0, 7); x.fill();
      const hat = r(); if (hat < 0.2) { x.fillStyle = r() < 0.7 ? mute(c1, 0.2) : mute(c2, 0.3); x.fillRect(jx - hr * 1.05, hy - hr * 1.05, hr * 2.1, hr * 0.9); } else if (hat < 0.75) { x.fillStyle = hair[(r() * hair.length) | 0]; x.fillRect(jx - hr, hy - hr, hr * 2, hr * 0.7); }
      if (r() < 0.012) { x.fillStyle = r() < 0.5 ? '#f2f0e6' : c2; x.fillRect(jx - cw * 0.5, ty - rh * 0.25, cw * 1.1, rh * 0.36); }   // signs and towels
    } }
  x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, 0, Wc, rh * 0.06);
  const c2v = mkCv(Wc, Hc), g2 = c2v.getContext('2d'); g2.filter = 'blur(0.5px)'; g2.drawImage(cv, 0, 0); return canvasTex(c2v, true, 8);
}
function ribbonTex(home, v, r, tall) {   // LED ribbon boards: team panels between sponsor panels
  const Wc = coarse ? 1024 : 2048, Hc = Wc / (tall ? 16 : 32), c = mkCv(Wc, Hc), x = c.getContext('2d'), ads = shuffleR(ADS, r), seg = Wc / 8, c1 = home.c1 || '#1d3478', c2 = home.c2 || '#ffffff';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) { const sx = i * seg; let bg, fg, txt, f;
    if (i % 3 === 0) { bg = shadeC(c1, -0.1); fg = Math.abs(lumHex(c2) - lumHex(c1)) > 0.25 ? c2 : '#ffffff'; txt = i ? (home.name || '').toUpperCase() : (home.city || '').toUpperCase(); f = v.font; }
    else { [txt, bg, fg, f] = ads[i % ads.length]; }
    x.fillStyle = bg; x.fillRect(sx, 0, seg, Hc); x.fillStyle = fg; x.font = fontOf(f, Hc * (f === 'tall' ? 0.95 : 0.66)); fitText(x, txt, sx + seg / 2, Hc * (f === 'tall' ? 0.58 : 0.54), seg * 0.86, 'fill'); }
  x.fillStyle = 'rgba(0,0,0,0.28)'; for (let i = 0; i < Wc; i += 3) x.fillRect(i, 0, 1, Hc); for (let j = 0; j < Hc; j += 3) x.fillRect(0, j, Wc, 1);   // LED pitch
  return canvasTex(c, true, 8);
}
function padTex(home, v, r) {   // the padded wall in front of the first row: team colour, the odd sponsor
  const Wc = coarse ? 512 : 1024, Hc = Wc / 16, c = mkCv(Wc, Hc), x = c.getContext('2d'), ads = shuffleR(ADS, r), base = v.wall === 'c1' ? home.c1 : v.wall === 'c2' ? shadeC(home.c2 || '#fff', -0.15) : '#24272c';
  x.fillStyle = base; x.fillRect(0, 0, Wc, Hc); x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) { const sx = i * Wc / 4; if (i % 2) { const [t, bg, fg, f] = ads[i]; x.fillStyle = bg; x.fillRect(sx + 8, Hc * 0.14, Wc / 4 - 16, Hc * 0.72); x.fillStyle = fg; x.font = fontOf(f, Hc * 0.5); fitText(x, t, sx + Wc / 8, Hc * 0.52, Wc / 4 - 40, 'fill'); }
    else { x.fillStyle = Math.abs(lumHex(base) - lumHex(home.c2 || '#fff')) > 0.25 ? (home.c2 || '#fff') : '#f0f0ea'; x.font = fontOf(v.font, Hc * 0.62); fitText(x, (home.name || '').toUpperCase(), sx + Wc / 8, Hc * 0.55, Wc / 4 - 40, 'fill'); } }
  const gr = x.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); x.fillStyle = gr; x.fillRect(0, 0, Wc, Hc);
  return canvasTex(c, true, 8);
}
function suiteTex(r, warm) {   // the suite level: glass, mullions, warm rooms, people at the windows
  const c = mkCv(512, 64), x = c.getContext('2d'); x.fillStyle = '#20262e'; x.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 16; i++) { const sx = i * 32, on = r() < 0.85; if (on) { const gr = x.createLinearGradient(0, 8, 0, 60); gr.addColorStop(0, warm ? '#c9a77a' : '#b8c0c8'); gr.addColorStop(1, warm ? '#6a5038' : '#5a636e'); x.fillStyle = gr; x.fillRect(sx + 2, 8, 28, 52); }
    for (let k = 0; k < 3; k++) if (r() < 0.6) { x.fillStyle = 'rgba(20,20,24,0.75)'; const px = sx + 5 + r() * 22; x.fillRect(px - 3, 34, 6, 26); x.beginPath(); x.arc(px, 31, 3.2, 0, 7); x.fill(); }
    x.fillStyle = '#101317'; x.fillRect(sx, 0, 2, 64); }
  x.fillStyle = '#101317'; x.fillRect(0, 0, 512, 8); const gr = x.createLinearGradient(0, 0, 512, 64); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.1)'); x.fillStyle = gr; x.fillRect(0, 0, 512, 64);
  return canvasTex(c, true);
}
function concreteTex(r) {   // weathered concrete: rain streaks from the top, blotches, form-work lines
  const N = coarse ? 128 : 256, c = mkCv(N, N), x = c.getContext('2d'); x.fillStyle = '#bebcb5'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 80; i++) { const px = r() * N, py = r() * N, rad = 6 + r() * 40, gr = x.createRadialGradient(px, py, 0, px, py, rad); const dk = r() < 0.6; gr.addColorStop(0, dk ? 'rgba(80,78,70,0.12)' : 'rgba(255,255,250,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rad, py - rad, 2 * rad, 2 * rad); }
  for (let i = 0; i < 30; i++) { const sx = r() * N, w = 1 + r() * 4, ln = N * (0.15 + r() * 0.8), gr = x.createLinearGradient(0, 0, 0, ln); gr.addColorStop(0, 'rgba(55,52,46,0.22)'); gr.addColorStop(1, 'rgba(55,52,46,0)'); x.fillStyle = gr; x.fillRect(sx, 0, w, ln); }
  x.fillStyle = 'rgba(60,60,56,0.16)'; for (let yy = N / 4; yy < N; yy += N / 4) x.fillRect(0, yy, N, 1);
  return canvasTex(c, true);
}
function lampTex(on, warm, cols = 4, rows = 3) {
  const c = mkCv(32 * cols, 22 * rows), x = c.getContext('2d'); x.fillStyle = '#262a30'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const cx = 16 + i * 32, cy = 11 + j * 22;
    if (on) { const gr = x.createRadialGradient(cx, cy, 0, cx, cy, 11); gr.addColorStop(0, '#fffdf6'); gr.addColorStop(0.55, warm ? '#ffd9a0' : '#eef3ff'); gr.addColorStop(1, 'rgba(255,233,196,0)'); x.fillStyle = gr; x.fillRect(i * 32, j * 22, 32, 22); }
    else { x.fillStyle = '#5d636b'; x.beginPath(); x.arc(cx, cy, 8.5, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.arc(cx - 3, cy - 3, 3, 0, 7); x.fill(); } }
  return canvasTex(c, true);
}
function treeTex(r) {   // two trees side by side (conifer, broadleaf) with sunlit and shaded sides; alpha cut-out
  const W2 = coarse ? 256 : 512, H2 = W2 / 2, c = mkCv(W2, H2), x = c.getContext('2d'), u = W2 / 512;
  x.fillStyle = '#3b2b1e'; x.fillRect(124 * u, 190 * u, 8 * u, 66 * u); x.fillRect(380 * u, 170 * u, 12 * u, 86 * u);
  for (let k = 0; k < 220; k++) { const t = r(), y = (20 + t * 190) * u, hw = (8 + t * 92) * u * (0.8 + r() * 0.4), px = 128 * u + (r() - 0.5) * 2 * hw, lit = px < 128 * u ? 0.25 : 0; x.fillStyle = hexMix('#1f3a22', '#4d6e3a', Math.min(1, r() * 0.6 + lit)); x.beginPath(); x.arc(px, y, (5 + r() * 9) * u, 0, 7); x.fill(); }
  for (let k = 0; k < 260; k++) { const a = r() * 7, rr = Math.sqrt(r()), px = 384 * u + Math.cos(a) * rr * 100 * u, py = 100 * u + Math.sin(a) * rr * 78 * u, lit = (px - 384 * u) < 0 && py < 110 * u ? 0.35 : 0; x.fillStyle = hexMix('#24401f', '#5b7a35', Math.min(1, r() * 0.55 + lit)); x.beginPath(); x.arc(px, py, (7 + r() * 13) * u, 0, 7); x.fill(); }
  const t = canvasTex(c, false); return t;
}
function trackTex(r, colr) {   // running track: rubber, eight lanes
  const c = mkCv(64, 256), x = c.getContext('2d'); x.fillStyle = colr; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'; x.fillRect(r() * 64, r() * 256, 1, 1); }
  x.fillStyle = 'rgba(244,244,236,0.85)'; for (let k = 0; k <= 8; k++) x.fillRect(0, Math.min(254, k * 32 - 1), 64, 2);
  return canvasTex(c, true);
}
function backdropTex(v, at, P, r) {   // what you see beyond the stands: a skyline on one side, hills or a treeline round the rest
  const Wc = coarse ? 1024 : 2048, Hc = Wc / 8, c = mkCv(Wc, Hc), x = c.getContext('2d'), tod = at.tod, wet = at.weather !== 'clear';
  const pal = { day: ['#9fb0c0', '#7d9278', '#5f7a56', '#2f3f2b', '#a6b2bd'], overcast: ['#a1a7ad', '#858d86', '#6b7568', '#3a4238', '#9aa0a6'], dusk: ['#8a7d92', '#6c5f72', '#4c4552', '#24212a', '#7a6c82'], night: ['#161b25', '#11151c', '#0c0f14', '#07090c', '#1a2030'] }[tod] || ['#9fb0c0', '#7d9278', '#5f7a56', '#2f3f2b', '#a6b2bd'];
  const [far, mid, near, tree, city] = wet ? pal.map(h => hexMix(h, '#9aa0a6', 0.35)) : pal, hY = Hc * 0.8;   // hY: the horizon line in the strip
  const ridge = (colr, amp, base, f, ph) => { x.fillStyle = colr; x.beginPath(); x.moveTo(0, Hc); for (let i = 0; i <= 256; i++) { const u = i / 256, y = base - amp * (0.55 + 0.25 * Math.sin(u * 6.283 * f + ph) + 0.15 * Math.sin(u * 6.283 * f * 2.7 + ph * 2) + 0.05 * Math.sin(u * 6.283 * f * 7.3)); x.lineTo(u * Wc, y); } x.lineTo(Wc, Hc); x.fill(); };
  if (v.backdrop === 'hills' || v.backdrop === 'trees' || v.backdrop === 'city') { ridge(far, Hc * (v.backdrop === 'hills' ? 0.42 : 0.18), hY, 3, r() * 6); ridge(mid, Hc * (v.backdrop === 'hills' ? 0.25 : 0.1), hY + 2, 5, r() * 6); }
  if (v.backdrop === 'city') { const c0 = v.stadium === 'horseshoe' ? (v.open === 'z1' ? 0.25 : 0.75) : r(), span = 0.28 + r() * 0.12;
    for (let i = 0; i < 260; i++) { const u = c0 + (r() - 0.5) * span * (r() < 0.6 ? 0.6 : 1), bw = (6 + r() * 22) * (Wc / 2048), dist = 1 - Math.abs(u - c0) / span * 1.6, bh = Hc * (0.08 + Math.pow(r(), 2.2) * 0.55 * Math.max(0.15, dist));
      for (const ox of [0, -1, 1]) { const px = ((u + ox) % 1) * Wc; if (px < -bw || px > Wc + bw) continue; x.fillStyle = hexMix(city, far, r() * 0.5); x.fillRect(px, hY - bh, bw, bh + 4);
        if (tod === 'night' || tod === 'dusk') { x.fillStyle = tod === 'night' ? 'rgba(255,214,140,0.85)' : 'rgba(255,200,140,0.35)'; for (let k = 0; k < bh * bw / 14; k++) if (r() < 0.45) x.fillRect(px + 1 + Math.floor(r() * (bw - 2) / 2) * 2, hY - bh + 2 + Math.floor(r() * (bh - 4) / 3) * 3, 1, 1); }
        if (tod === 'night' && bh > Hc * 0.35 && r() < 0.5) { x.fillStyle = '#ff3b30'; x.fillRect(px + bw / 2, hY - bh - 2, 2, 2); } } } }
  ridge(near, Hc * 0.05, hY + 6, 9, r() * 6);
  if (v.backdrop === 'trees' || v.backdrop === 'hills') { x.fillStyle = tree; for (let i = 0; i < Wc / 3; i++) { const px = r() * Wc, rad = (2 + r() * 5) * (Wc / 2048); x.beginPath(); x.arc(px, hY + 2 - r() * Hc * 0.06, rad, 0, 7); x.fill(); } }
  x.fillStyle = near; x.fillRect(0, hY + 4, Wc, Hc - hY);
  if (tod === 'night') { const gr = x.createLinearGradient(0, hY - Hc * 0.4, 0, hY); gr.addColorStop(0, 'rgba(80,70,60,0)'); gr.addColorStop(1, 'rgba(90,80,70,0.25)'); x.fillStyle = gr; x.globalCompositeOperation = 'lighter'; x.fillRect(0, 0, Wc, hY); x.globalCompositeOperation = 'source-over'; }
  const t = canvasTex(c, false); t.wrapS = THREE.RepeatWrapping; return t;
}
function bandTex(T, v, side) {   // the team area beside the field: team colour, a white border, the team's name along it
  const c = mkCv(96, 1536), x = c.getContext('2d'), c1 = T.c1 || '#1d3478', c2 = T.c2 || '#ffffff', ink = Math.abs(lumHex(c2) - lumHex(c1)) > 0.25 ? c2 : '#f2f2ea';
  x.fillStyle = shadeC(c1, -0.12); x.fillRect(0, 0, 96, 1536); x.fillStyle = '#efefe6'; x.fillRect(0, 0, 6, 1536); x.fillRect(90, 0, 6, 1536); x.fillRect(0, 0, 96, 6); x.fillRect(0, 1530, 96, 6);
  x.save(); x.translate(48, 768); x.rotate(side > 0 ? Math.PI / 2 : -Math.PI / 2); x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = fontOf(v.font, 58);
  fitText(x, (T.name || '').toUpperCase(), -380, 4, 560, 'fill'); fitText(x, (T.name || '').toUpperCase(), 380, 4, 560, 'fill'); x.restore();
  const sp = speckle(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = v.surface === 'turf' ? 0.1 : 0.35; x.fillStyle = x.createPattern(sp, 'repeat'); x.fillRect(0, 0, 96, 1536);
  return canvasTex(c, false, 8);
}
function apronTex(v, r, snow) {   // the grass (or turf) round the field, with its own uneven colour
  const turf = v.surface === 'turf', G = turf ? TURF : GRASS[v.grass % GRASS.length], c = mkCv(256, 256), x = c.getContext('2d'); x.fillStyle = shadeC(G.base, turf ? -0.08 : -0.04); x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { const px = r() * 256, py = r() * 256, rad = 8 + r() * 40, gr = x.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, rgba(r() < 0.5 ? G.dry : shadeC(G.base, -0.25), turf ? 0.05 : 0.12)); gr.addColorStop(1, rgba(G.base, 0)); x.fillStyle = gr; x.fillRect(px - rad, py - rad, 2 * rad, 2 * rad); }
  if (snow) { x.fillStyle = 'rgba(236,240,244,0.55)'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { const px = r() * 256, py = r() * 256, rad = 6 + r() * 30, gr = x.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, `rgba(240,243,246,${(0.2 + r() * 0.4).toFixed(2)})`); gr.addColorStop(1, 'rgba(240,243,246,0)'); x.fillStyle = gr; x.fillRect(px - rad, py - rad, 2 * rad, 2 * rad); } }
  return canvasTex(c, false);
}
function snowCover(g, Wt, Ht, r, s, cx, hashW) {   // snow lies on the field, thinner where the players have churned it between the hashes
  { const gr = g.createLinearGradient(0, 0, Wt, 0); gr.addColorStop(0, 'rgba(238,241,245,0.22)'); gr.addColorStop(0.5 - hashW / Wt, 'rgba(238,241,245,0.14)'); gr.addColorStop(0.5, 'rgba(238,241,245,0.04)'); gr.addColorStop(0.5 + hashW / Wt, 'rgba(238,241,245,0.14)'); gr.addColorStop(1, 'rgba(238,241,245,0.22)'); g.fillStyle = gr; g.fillRect(0, 0, Wt, Ht); }
  for (let i = 0; i < 2600; i++) { const x = r() * Wt, y = r() * Ht, mid = Math.max(0, 1 - Math.abs(x - cx) / (hashW * 1.4)), rad = (6 + r() * 24) * s, a = (0.08 + r() * 0.16) * (1 - 0.8 * mid), gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(238,241,245,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(238,241,245,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
}
// glows round the lamps: camera-facing quads in one mesh, drawn additively (one draw call for every lamp in the stadium)
function glowMesh(list, level, warm) {
  if (!list.length || level <= 0.05) return null;
  const n = list.length, pos = new Float32Array(n * 12), cor = new Float32Array(n * 8), idx = [];
  for (let i = 0; i < n; i++) { const [x, y, z, s] = list[i]; for (let k = 0; k < 4; k++) { pos.set([x, y, z], i * 12 + k * 3); cor.set([(k & 1 ? 1 : -1) * s, (k & 2 ? 1 : -1) * s * 0.62], i * 8 + k * 2); } idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('corner', new THREE.BufferAttribute(cor, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ uniforms: { tint: { value: new THREE.Color(warm ? 0xffd9a8 : 0xf2f5ff) }, level: { value: level } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'attribute vec2 corner;\nvarying vec2 vQ;\nvoid main() { vec4 mv = modelViewMatrix * vec4( position, 1.0 ); mv.xy += corner; vQ = sign( corner ); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 tint;\nuniform float level;\nvarying vec2 vQ;\nvoid main() { float d = dot( vQ, vQ ); float a = 0.55 * exp( -d * 5.0 ) + 0.45 * exp( -d * 40.0 ); gl_FragColor = vec4( tint * a * level, 1.0 ); }' });
  const ms = new THREE.Mesh(g, m); ms.frustumCulled = false; ms.renderOrder = 5; return ms;
}
// ---------------- the scoreboard (repainted live from the match: score, quarter, clock, down) ----------------
function paintBoard(force) {
  if (!board) return; const G0 = typeof MATCH !== 'undefined' && MATCH._G; if (!G0 || !G0.H || !G0.A) return;
  const H0 = G0.H, A0 = G0.A, sc = G0.score || {}, clk = Math.max(0, Math.ceil(G0.clock || 0)), sig = [sc[H0.id] | 0, sc[A0.id] | 0, G0.q, clk, G0.down, Math.round(G0.togo || 0), G0.poss].join('|');
  if (!force && sig === board.sig) return; board.sig = sig;
  const x = board.x, Wc = board.c.width, Hc = board.c.height, u = Wc / 1024, retro = board.retro, mm = Math.floor(clk / 60), ss = String(clk % 60).padStart(2, '0'), qt = G0.q > 4 ? 'OT' : 'Q' + G0.q;
  const dn = G0.down ? ['', '1ST', '2ND', '3RD', '4TH'][G0.down] + ' & ' + Math.max(1, Math.round(G0.togo || 0)) : '', ply = G0.poss;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (retro) {
    x.fillStyle = '#121416'; x.fillRect(0, 0, Wc, Hc); x.fillStyle = H0.c1 || '#1d3478'; x.fillRect(0, 0, Wc, 92 * u); x.fillStyle = '#f4f2ea'; x.font = fontOf('slab', 60 * u); fitText(x, (H0.name || '').toUpperCase(), Wc / 2, 50 * u, Wc * 0.9, 'fill');
    const amber = '#ffb43a', dim = 'rgba(255,180,58,0.12)'; x.font = fontOf('plain', 40 * u); x.fillStyle = '#e9e6dc';
    x.fillText('HOME', Wc * 0.2, 140 * u); x.fillText('GUEST', Wc * 0.8, 140 * u); x.fillText(qt === 'OT' ? 'OT' : 'QTR', Wc * 0.5, 140 * u);
    const bulbs = (txt, cx, cy, sz) => { x.font = `700 ${Math.round(sz)}px "Courier New", monospace`; x.fillStyle = dim; x.fillText('8'.repeat(txt.length), cx, cy); x.fillStyle = amber; x.fillText(txt, cx, cy); };
    bulbs(String(sc[H0.id] | 0).padStart(2, ' '), Wc * 0.2, 250 * u, 160 * u); bulbs(String(sc[A0.id] | 0).padStart(2, ' '), Wc * 0.8, 250 * u, 160 * u); bulbs(String(Math.min(4, G0.q)), Wc * 0.5, 215 * u, 90 * u);
    bulbs(mm + ':' + ss, Wc * 0.5, 330 * u, 96 * u); x.font = fontOf('plain', 34 * u); x.fillStyle = '#e9e6dc'; x.fillText(dn, Wc * 0.5, 430 * u);
    x.fillStyle = amber; if (ply === H0.id) x.fillRect(Wc * 0.2 - 30 * u, 345 * u, 60 * u, 10 * u); else if (ply === A0.id) x.fillRect(Wc * 0.8 - 30 * u, 345 * u, 60 * u, 10 * u);
  } else {
    const panel = (T, cx, s, has) => { x.fillStyle = shadeC(T.c1 || '#333', -0.15); x.fillRect(cx - 190 * u, 30 * u, 380 * u, 400 * u);
      if (typeof drawLogo === 'function') { try { const lc = mkCv(256, 256); drawLogo(lc.getContext('2d'), T, 256); x.drawImage(lc, cx - 175 * u, 45 * u, 130 * u, 130 * u); } catch (e) { } }
      const ink = Math.abs(lumHex(T.c2 || '#fff') - lumHex(T.c1 || '#333')) > 0.25 ? (T.c2 || '#fff') : '#ffffff'; x.fillStyle = ink; x.font = fontOf('block', 96 * u); fitText(x, (T.abbr || T.name || '').toUpperCase(), cx + 65 * u, 115 * u, 220 * u, 'fill');
      x.fillStyle = '#ffffff'; x.font = fontOf('tall', 230 * u); x.fillText(String(s), cx, 320 * u); if (has) { x.fillStyle = '#ffd400'; x.beginPath(); x.arc(cx + 160 * u, 395 * u, 13 * u, 0, 7); x.fill(); } };
    x.fillStyle = '#07090c'; x.fillRect(0, 0, Wc, Hc); panel(H0, Wc * 0.22, sc[H0.id] | 0, ply === H0.id); panel(A0, Wc * 0.78, sc[A0.id] | 0, ply === A0.id);
    x.fillStyle = '#111419'; x.fillRect(Wc / 2 - 70 * u, 30 * u, 140 * u, 400 * u); x.fillStyle = '#ffffff'; x.font = fontOf('tall', 84 * u); x.fillText(qt, Wc / 2, 110 * u); x.font = fontOf('tall', 70 * u); x.fillText(mm + ':' + ss, Wc / 2, 215 * u);
    x.fillStyle = '#ffd400'; x.font = fontOf('block', 40 * u); fitText(x, dn, Wc / 2, 320 * u, 130 * u, 'fill');
    x.fillStyle = '#0e1116'; x.fillRect(0, 440 * u, Wc, 72 * u); x.fillStyle = '#c9ced6'; x.font = fontOf(board.font, 44 * u); fitText(x, (board.ad || '').toUpperCase(), Wc / 2, 478 * u, Wc * 0.8, 'fill');
    x.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < Wc; i += 4) x.fillRect(i, 0, 1, Hc); for (let j = 0; j < Hc; j += 4) x.fillRect(0, j, Wc, 1);
  }
  board.tex.needsUpdate = true;
}
// ---------------- stadiums ----------------
// Five kinds of ground, each built from swept stand profiles and boxes into a few merged meshes:
//  bowl      - modern closed bowl, suites and LED ribbons, canopies over the sides lined with lights, video boards over the ends
//  horseshoe - open at one end: a skyline or hills through the gap, a scoreboard on legs, light masts on the rim
//  dome      - roofed: three tiers under a ribbed roof, a centre-hung board, rings of lights, artificial turf
//  college   - metal bleachers (often round a running track), a press box, light poles, trees, an old-style scoreboard
//  retro     - concrete grandstands with an upper deck on columns under a flat roof, open corners, lattice light towers
// Cutaway: when the camera has backed out beyond the stand fronts (low behind its own goal line, or the sideline view zoomed out), the
// stand between it and the field would fill the screen. Stadium materials drop every fragment nearer the camera than it is outside.
const CUT = { value: 0 };
function cutaway(m) {
  m.onBeforeCompile = sh => { sh.uniforms.uCut = CUT;
    sh.vertexShader = 'varying float vCutD;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvCutD = -mvPosition.z;');
    sh.fragmentShader = 'uniform float uCut;\nvarying float vCutD;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tif ( vCutD < uCut ) discard;'); };
  m.customProgramCacheKey = () => 'cutaway'; return m;
}
function updateCut() { const c = camera.position, xs = VEN && VEN.v.stadium === 'college' ? colX(VEN.v) : XS, d = Math.hypot(Math.max(0, Math.abs(c.x) - xs), Math.max(0, ZA - c.z, c.z - ZB)); CUT.value = d > 0 ? d + 8 : 0; }
function disposeTree(o) { const seen = new Set(); o.traverse(n => { if (n.geometry && !seen.has(n.geometry)) { seen.add(n.geometry); n.geometry.dispose(); } const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : []; for (const m of ms) { if (seen.has(m)) continue; seen.add(m); for (const k of ['map', 'emissiveMap']) if (m[k] && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); } m.dispose(); } }); }
function buildStadium(home, away) {
  const v = VEN.v, at = VEN.at, P = VEN.P, r = rngOf(v.seed), S = v.stadium, grp = new THREE.Group(); grp.name = 'stadium'; FW.sprops.length = 0;
  const lit = P.lights, warm = !v.led, night = at.tod === 'night' || at.tod === 'dome', c1 = home.c1 || '#1d3478', c2 = home.c2 || '#ffffff';
  const B = {}; for (const k of ['st', 'seat', 'seat2', 'rib', 'pad', 'suite', 'lamp', 'post', 'tree', 'board', 'track', 'dome', 'sign']) B[k] = Batch();
  const glows = [], T = { conc: lin3('#b7b4ac'), dark: lin3('#4a4d52'), roof: lin3('#2b2e34'), facade: lin3('#8e8b85'), steel: lin3(S === 'retro' ? '#6c7770' : '#9aa1a8'), team: lin3(c1), team2: lin3(c2), black: lin3('#1d1f23'), red: lin3('#d2361f') };
  const kindB = { pad: B.pad, conc: B.st, dark: B.st, roof: B.st, facade: B.st, steel: B.st, team: B.st, seat: B.seat, seat2: B.seat2, bleach: B.seat, bleach2: B.seat2, rib: B.rib, suite: B.suite };
  const roofed = S === 'bowl' || S === 'dome' || S === 'retro', tile = { seat: [16.6, 13.6], seat2: [16.6, 13.6], bleach: [16.6, 13.6], bleach2: [16.6, 13.6], rib: [150, 'fit'], pad: [44, 'fit'], suite: [26, 'fit'], conc: [8, 8], dark: [8, 8], roof: [12, 12], facade: [8, 8], steel: [8, 8], team: [8, 8] };
  const spill = at.tod === 'night' ? 0.68 : at.tod === 'dome' ? 0.85 : 1;   // under lights the stands only get the spill
  const tint = (kind, e) => { if (!(kind.startsWith('seat') || kind.startsWith('bleach'))) return T[kind] || WHITE3; const k = spill * (roofed && kind === 'seat2' ? 1 - 0.35 * e : 1 - 0.12 * e) * (night ? 1 - 0.25 * e : 1); return [k, k, k * 1.01]; };
  const stand = (path, prof) => sweep(path, prof, k => kindB[k], tile, tint);
  const caps = (path, prof) => { const a = path[0], b = path[1], z = path[path.length - 1], y = path[path.length - 2], ta = Math.hypot(b.x - a.x, b.z - a.z) || 1, tz = Math.hypot(z.x - y.x, z.z - y.z) || 1;
    capEnd(B.st, a, -(b.x - a.x) / ta, -(b.z - a.z) / ta, prof, T.conc); capEnd(B.st, z, (z.x - y.x) / tz, (z.z - y.z) / tz, prof, T.conc); };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), lampOn = lit > 0.3, boards = [];
  const lampBank = (x, y, z, w, h, tx, ty, tz, nx = 4, ny = 3) => { B.st.facing(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.5), x, y, z, tx, ty, tz, T.dark); const dx = tx - x, dy = ty - y, dz = tz - z, dl = Math.hypot(dx, dy, dz);
    B.lamp.facing(new THREE.PlaneGeometry(w, h), x + dx / dl * 0.3, y + dy / dl * 0.3, z + dz / dl * 0.3, tx, ty, tz, WHITE3, [nx / 4, ny / 3]); glows.push([x + dx / dl * 1.2, y + dy / dl * 1.2, z + dz / dl * 1.2, Math.max(w, h) * 1.25]); };
  const boardAt = (x, y, z, w, h, ry, legs) => { const nx = Math.sin(ry), nz = Math.cos(ry); B.st.box(w + 1.2, h + 1.2, 1.4, x - nx * 0.8, y, z - nz * 0.8, T.black, ry);
    o3.position.set(x, y, z); o3.rotation.set(0, ry, 0); o3.updateMatrix(); B.board.add(new THREE.PlaneGeometry(w, h), o3.matrix); boards.push({ w, h });
    if (legs) for (const sx of [-0.3, 0.3]) B.st.bar(V3(x + Math.cos(ry) * w * sx - nx * 0.8, 0, z - Math.sin(ry) * w * sx - nz * 0.8), V3(x + Math.cos(ry) * w * sx - nx * 0.8, y - h / 2, z - Math.sin(ry) * w * sx - nz * 0.8), 0.45, T.steel, 8); };
  const o3 = new THREE.Object3D();
  const sideRuns = path => [path.filter(p => p.nx > 0.45), path.filter(p => p.nx < -0.45)];
  // ---- the stands ----
  if (S === 'bowl' || S === 'dome') {
    const path = rrPath(XS, ZA, ZB, 24, 5, null), top = S === 'dome' ? 37 : 30.5;
    const prof = S === 'bowl' ? [[0, 0, 'pad'], [0, 1.4, 'conc'], [0.8, 1.4, 'seat'], [19.5, 9.9, 'conc'], [21, 9.9, 'rib'], [21, 11.3, 'suite'], [21, 15.5, 'dark'], [21, 16.8, 'seat2'], [38, 30.5, 'conc'], [39.5, 30.5, 'facade'], [39.5, 0, null]]
      : [[0, 0, 'pad'], [0, 1.4, 'conc'], [0.8, 1.4, 'seat'], [17, 8.6, 'conc'], [18.5, 8.6, 'rib'], [18.5, 10, 'suite'], [18.5, 14.2, 'dark'], [18.5, 15.2, 'seat'], [27, 20.5, 'conc'], [28, 20.5, 'rib'], [28, 21.9, 'dark'], [28, 23, 'seat2'], [40, 37, 'conc'], [41, 37, 'facade'], [41, 0, null]];
    stand(path, prof);
    if (S === 'bowl') {
      for (const run of sideRuns(path)) { sweep(run, [[39.5, 30.5, 'roof'], [39.5, 33, 'roof'], [14, 37.4, 'dark'], [14, 36.2, null]], k => B.st, tile, k => T[k] || T.dark);   // canopies over the sides
        for (let i = 0; i < run.length; i += 1) { const p = run[i]; if (i % 2) continue; const x = p.x + p.nx * 14.8, z = p.z + p.nz * 14.8; B.lamp.facing(new THREE.PlaneGeometry(3.2, 0.9), x, 36.0, z, x - p.nx * 6, 0, z - p.nz * 6, WHITE3, [1, 0.34]); glows.push([x - p.nx * 0.6, 35.6, z - p.nz * 0.6, 6.5]); } }
      for (const [z, ry] of [[ZB + 33, Math.PI], [ZA - 33, 0]]) { boardAt(0, 39, z, 36, 14, ry, false); for (const sx of [-14, 14]) B.st.box(1.2, 10, 1.2, sx, 27, z + (ry ? 1.4 : -1.4), T.dark); }
    } else {
      // the roof: a ribbed shell from the rim to the crown, lit from below by rings of lamps. A retractable roof that is open today
      // (at.tod is not 'dome') has its centre panels rolled back: a slot of sky over the field, the board hung from a cross truss
      const rim = path.map(p => ({ x: p.x + p.nx * 41, z: p.z + p.nz * 41 })), K = coarse ? 8 : 12, pos = [], nor = [], uv = [], cs = [], idx = [], n = rim.length, roofOpen = at.tod !== 'dome';
      const slot = (a, b, c, d) => roofOpen && [a, b, c, d].every(j => Math.abs(pos[j * 3]) < 31 && Math.abs(pos[j * 3 + 2] - CZ) < 64);
      for (let k = 0; k <= K; k++) { const f = k / K, y = 37 + 33 * Math.sin(f * Math.PI / 2), s = 1 - f * 0.985, shade = 0.95 - 0.5 * f;
        for (let i = 0; i < n; i++) { const p = rim[i]; pos.push(p.x * s, y, CZ + (p.z - CZ) * s); uv.push(i / (n - 1) * 24, f * 3); cs.push(shade, shade, shade * 0.98); nor.push(0, -1, 0);
          if (k && i) { const a = (k - 1) * n + i - 1, b = k * n + i - 1; if (!slot(a, b, a + 1, b + 1)) idx.push(a, b, a + 1, a + 1, b, b + 1); } } }
      B.dome.raw(pos, nor, uv, cs, idx);
      if (roofOpen) { B.st.box(96, 2.6, 3.4, 0, 63, CZ, T.steel); for (const sz of [-1, 1]) B.st.box(2.2, 2.2, 128, sz * 31.5, 61.5, CZ, T.steel); }   // the cross truss and the panel rails
      for (let i = 0; i < n; i += 3) { const p = rim[i], s = 0.86, x = p.x * s, z = CZ + (p.z - CZ) * s, y = 37 + 33 * Math.sin(0.14 * Math.PI / 2); B.lamp.facing(new THREE.PlaneGeometry(4, 1.6), x, y - 0.4, z, 0, 0, CZ, WHITE3, [1, 0.67]); glows.push([x * 0.99, y - 1, CZ + (z - CZ) * 0.99, 7]); }
      // centre-hung board over midfield
      B.st.box(26, 11, 16, 0, 44, CZ, T.black); for (const [x, z, ry, w] of [[0, CZ + 8.05, 0, 24], [0, CZ - 8.05, Math.PI, 24], [13.05, CZ, Math.PI / 2, 14], [-13.05, CZ, -Math.PI / 2, 14]]) { o3.position.set(x, 44, z); o3.rotation.set(0, ry, 0); o3.updateMatrix(); B.board.add(new THREE.PlaneGeometry(w, 9.5), o3.matrix); }
      for (const sx of [-8, 8]) B.st.bar(V3(sx, 49.5, CZ), V3(sx, roofOpen ? 62 : 70, CZ), 0.12, T.dark, 5);
    }
  } else if (S === 'horseshoe') {
    const path = rrPath(XS, ZA, ZB, 26, 5, v.open), prof = [[0, 0, 'pad'], [0, 1.4, 'conc'], [0.8, 1.4, 'seat'], [20, 10.5, 'conc'], [21, 10.5, 'rib'], [21, 12, 'dark'], [21, 12.8, 'seat2'], [36, 26, 'conc'], [37, 26, 'facade'], [37, 0, null]];
    stand(path, prof); caps(path, prof);
    for (const run of sideRuns(path)) for (let i = 1; i < run.length - 1; i += 3) { const p = run[i], x = p.x + p.nx * 36.5, z = p.z + p.nz * 36.5; B.st.bar(V3(x, 26, z), V3(x, 43, z), 0.35, T.steel, 6);
      lampBank(x - p.nx * 0.6, 44.5, z - p.nz * 0.6, 6, 3.4, -p.nx * 5, 0, CZ * 0.5 + p.z * 0.5); }
    const zo = v.open === 'z1' ? ZB + 24 : ZA - 24; boardAt(0, 19, zo, 30, 12, v.open === 'z1' ? Math.PI : 0, true);
    for (const sx of [-1, 1]) { const x = sx * (XS + 6), z = v.open === 'z1' ? ZB + 4 : ZA - 4; B.st.bar(V3(x, 0, z), V3(x, 40, z), 0.4, T.steel, 6); lampBank(x, 41.5, z, 7, 4, 0, 0, CZ); }
  } else if (S === 'college') {
    const xb = colX(v), hp = straight(-xb, CZ + 54, -xb, CZ - 54, -1, 0), vp = straight(xb, CZ - 38, xb, CZ + 38, 1, 0);
    const hprof = [[0, 0, 'team'], [0, 1.2, 'conc'], [0.4, 1.2, 'bleach'], [17, 9.4, 'steel'], [17.6, 9.4, 'steel'], [17.6, 0, null]], vprof = [[0, 0, 'team'], [0, 1.1, 'conc'], [0.4, 1.1, 'bleach2'], [11, 6.4, 'steel'], [11.5, 6.4, 'steel'], [11.5, 0, null]];
    stand(hp, hprof); caps(hp, hprof); stand(vp, vprof); caps(vp, vprof);
    for (const [p, h, d] of [[hp, 9.4, 17.6], [vp, 6.4, 11.5]]) for (const q of p) { const x = q.x + q.nx * d; B.st.bar(V3(x, 9.4 - (9.4 - h), q.z), V3(x, h + 1.1, q.z), 0.05, T.steel, 4); }   // back rails
    // press box over the home stand
    const px = -(xb + 11.5); B.st.box(7, 5.2, 46, px - 0.5, 12.0, CZ, T.team); B.st.box(8.4, 0.5, 48, px - 0.2, 14.8, CZ, T.dark); B.st.box(7, 0.6, 46, px - 0.5, 9.6, CZ, T.conc);
    o3.position.set(px + 3.05, 12.1, CZ); o3.rotation.set(0, Math.PI / 2, 0); o3.updateMatrix(); B.suite.add(new THREE.PlaneGeometry(44, 3.2), o3.matrix, WHITE3, [44 / 26, 1]);
    B.st.box(0.3, 1.7, 34, px + 3.8, 15.9, CZ, T.dark); o3.position.set(px + 3.98, 15.9, CZ); o3.updateMatrix(); B.sign.add(new THREE.PlaneGeometry(32, 1.4), o3.matrix);
    for (const z of [CZ - 21, CZ - 7, CZ + 7, CZ + 21]) B.st.bar(V3(px + 2.9, 4, z), V3(px + 2.9, 9.4, z), 0.12, T.steel, 5);
    for (const sx of [-1, 1]) for (const z of [CZ - 46, CZ, CZ + 46]) { const x = sx * (sx < 0 ? xb + 22 : xb + 16); if (sx < 0 && z === CZ) continue; B.st.bar(V3(x, 0, z), V3(x, 31, z), 0.38, T.steel, 6); lampBank(x - sx * 0.4, 32.5, z, 6.5, 4, 0, 0, z * 0.6 + CZ * 0.4); }
    const zb = (r() < 0.5 ? ZB + 26 : ZA - 26); boardAt(0, 9.5, zb, 18, 8, zb > CZ ? Math.PI : 0, true);
    if (v.track) { const tp = []; const cz0 = CZ - 42.2, cz1 = CZ + 42.2, R0 = 36.5;
      for (let i = 0; i <= 40; i++) { const a = Math.PI * i / 40; tp.push({ x: Math.cos(a) * R0, z: cz1 + Math.sin(a) * R0, nx: Math.cos(a), nz: Math.sin(a) }); }
      for (let i = 0; i <= 40; i++) { const a = Math.PI + Math.PI * i / 40; tp.push({ x: Math.cos(a) * R0, z: cz0 + Math.sin(a) * R0, nx: Math.cos(a), nz: Math.sin(a) }); }
      tp.push(Object.assign({}, tp[0])); sweep(tp, [[0, 0.015, 'track'], [9.76, 0.015, null]], () => B.track, { track: [24, 'fit'] }, () => WHITE3); }
    for (let i = 0; i < (coarse ? 46 : 80); i++) { const a = r() * Math.PI * 2, rad = 95 + r() * 80, x = Math.cos(a) * rad * 0.8, z = CZ + Math.sin(a) * rad, hgt = 12 + r() * 12, kind = r() < 0.45 ? 0 : 1; tree(B.tree, x, z, hgt, kind, r); }
  } else if (S === 'retro') {
    const sideProf = [[0, 0, 'pad'], [0, 1.6, 'conc'], [0.8, 1.6, 'seat'], [16, 8.6, 'conc'], [16, 11, 'dark'], [12, 11, 'dark'], [12, 13.2, 'seat2'], [31, 26.2, 'conc'], [32, 26.2, 'facade'], [32, 0, null]];
    const endProf = [[0, 0, 'pad'], [0, 1.4, 'conc'], [0.8, 1.4, 'seat'], [21, 12, 'conc'], [22, 12, 'facade'], [22, 0, null]];
    for (const sx of [-1, 1]) { const p = straight(sx * XS, ZA + 4, sx * XS, ZB - 4, sx, 0); stand(p, sideProf); caps(p, sideProf);
      sweep(p, [[33, 30.4, 'roof'], [8, 30.9, 'roof']], () => B.st, tile, () => T.roof); sweep(p, [[8, 30.9, 'dark'], [8, 29.6, null]], () => B.st, tile, () => T.dark);
      for (let z = ZA + 8; z < ZB - 4; z += 14) { const x = sx * (XS + 12.7); B.st.bar(V3(x, 13.4, z), V3(x, 30.4, z), 0.28, T.steel, 6); }
      for (let z = ZA + 10; z < ZB - 4; z += 9) { const x = sx * (XS + 8.6); B.lamp.facing(new THREE.PlaneGeometry(1.8, 0.7), x, 29.9, z, x - sx * 5, 0, z, WHITE3, [0.5, 0.34]); glows.push([x - sx * 0.5, 29.5, z, 4.5]); } }
    for (const [z, sz] of [[ZA, -1], [ZB, 1]]) { const p = straight(-(XS - 6), z, XS - 6, z, 0, sz); stand(p, endProf); caps(p, endProf); }
    const bz = r() < 0.5 ? ZB + 18 : ZA - 18; boardAt(0, 18.5, bz, 24, 10, bz > CZ ? Math.PI : 0, false); B.st.box(1, 6, 1, -8, 12.8, bz + (bz > CZ ? 1 : -1), T.steel); B.st.box(1, 6, 1, 8, 12.8, bz + (bz > CZ ? 1 : -1), T.steel);
    for (const sx of [-1, 1]) for (const z of [ZA - 16, ZB + 16]) lattice(B.st, sx * (XS + 30), z, 50, T.steel, (x, y, zz) => lampBank(x, y, zz, 11, 7.5, 0, 0, CZ, 6, 4));
  }
  // ---- goal posts (padded at the base, wind ribbons on top) ----
  const upH = S === 'college' || v.posts === 'white' ? 9.1 : 12.2;
  for (const [z, dir] of [[110 * YD, 1], [-10 * YD, -1]]) { const zb = z + dir * 1.8;
    B.post.bar(V3(0, 0, zb), V3(0, 3.05, zb), 0.13, WHITE3, 10); B.post.bar(V3(0, 3.05, zb), V3(0, 3.05, z), 0.1, WHITE3, 8); B.post.bar(V3(-2.82, 3.05, z), V3(2.82, 3.05, z), 0.08, WHITE3, 10);
    for (const sx of [-2.82, 2.82]) { B.post.bar(V3(sx, 3.05, z), V3(sx, upH, z), 0.06, WHITE3, 8); B.st.box(0.04, 0.9, 0.02, sx, upH + 0.4, z, T.red); }
    B.st.box(0.62, 2.0, 0.62, 0, 1.0, zb, v.wall === 'c1' ? T.team : T.dark); }
  // ---- benches on both sidelines (they follow the sideline in phone games) ----
  for (const [sx, Tm] of [[-1, home], [1, away || home]]) { const bb = Batch(), tc = lin3(shadeC(Tm.c1 || '#333', -0.2)), o = sx;   // o: away from the field
    for (const z of [CZ - 13, CZ, CZ + 13]) { bb.box(0.5, 0.45, 10, 0, 0.23, z, tc); bb.box(0.12, 0.5, 10, o * 0.25, 0.7, z, tc); }
    bb.box(0.7, 0.9, 1.2, o * 0.8, 0.45, CZ - 21, lin3('#d8d6cf')); bb.box(0.7, 0.9, 1.2, o * 0.8, 0.45, CZ + 21, lin3('#d8d6cf')); bb.box(1.0, 0.8, 2.2, o * 0.9, 0.4, CZ + 6.5, lin3('#2a2d32'));
    const m = bb.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 'bench'); m.matrixAutoUpdate = true; m.userData = { sx, off: 1.83 + 8.6 }; m.castShadow = true; FW.sprops.push(m); grp.add(m); }
  // ---- people on the sidelines: players, coaches and staff in each team's kit ----
  { const G0 = typeof MATCH !== 'undefined' && MATCH._G, kits = (G0 && G0.kits) || {}; for (const [sx, Tm] of [[-1, home], [1, away || home]]) { const m = sidelineCrowd(Tm, kits[Tm.id], sx, r); FW.sprops.push(m); grp.add(m); } }
  // ---- materials, meshes ----
  const concT = concreteTex(r), seatOpt = { tread: S === 'college' ? '#5d6166' : '#34373c', dens: S === 'college' ? 0.72 : S === 'retro' ? 0.86 : 0.94, bleach: S === 'college', away: S === 'college' ? 3 : 7 };
  const seatT = crowdTex(v, home, away, seatOpt, v.seed + 11), seatT2 = crowdTex(v, home, away, Object.assign({}, seatOpt, { dens: seatOpt.dens - 0.05 }), v.seed + 12);
  const add = (b, m, name, sh) => { if (name !== 'trees' && name !== 'posts') cutaway(m); const ms = b.mesh(m, name); if (ms) { ms.receiveShadow = !!sh; grp.add(ms); } return ms; };
  add(B.st, new THREE.MeshStandardMaterial({ map: concT, vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }), 'structure');
  add(B.seat, new THREE.MeshStandardMaterial({ map: seatT, vertexColors: true, roughness: 1, side: THREE.DoubleSide }), 'crowd');
  add(B.seat2, new THREE.MeshStandardMaterial({ map: seatT2, vertexColors: true, roughness: 1, side: THREE.DoubleSide }), 'crowd2');
  add(B.rib, new THREE.MeshBasicMaterial({ map: ribbonTex(home, v, r), side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1, 1, 1).multiplyScalar(night ? 0.78 : 0.95) }), 'ribbon');
  add(B.pad, new THREE.MeshStandardMaterial({ map: padTex(home, v, r), roughness: 0.75, side: THREE.DoubleSide }), 'pads', true);
  if (B.suite.n) { const st = suiteTex(r, warm || night); add(B.suite, new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0.04 + 0.8 * lit, roughness: 0.25, metalness: 0.35, side: THREE.DoubleSide }), 'suites'); }
  add(B.lamp, new THREE.MeshBasicMaterial({ map: lampTex(lampOn, warm), toneMapped: !lampOn, side: THREE.DoubleSide, color: new THREE.Color(1, 1, 1).multiplyScalar(lampOn ? 1.2 : 0.8) }), 'lamps');
  add(B.post, new THREE.MeshStandardMaterial({ color: col(v.posts === 'white' ? '#e6e6df' : '#e8b62a'), roughness: 0.42, metalness: 0.2 }), 'posts').castShadow = true;
  if (B.tree.n) add(B.tree, new THREE.MeshBasicMaterial({ map: treeTex(r), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }), 'trees');
  if (B.track.n) add(B.track, new THREE.MeshStandardMaterial({ map: trackTex(r, r() < 0.75 ? '#94473a' : '#3c5d88'), roughness: 0.9 }), 'track', true);
  if (B.dome.n) { const dc = mkCv(256, 128), dx = dc.getContext('2d'); dx.fillStyle = '#d3d0c8'; dx.fillRect(0, 0, 256, 128); dx.fillStyle = '#8c8a84'; dx.fillRect(0, 0, 6, 128); dx.fillStyle = 'rgba(0,0,0,0.08)'; dx.fillRect(128, 0, 2, 128); dx.fillRect(0, 64, 256, 2);
    add(B.dome, new THREE.MeshBasicMaterial({ map: canvasTex(dc, true), vertexColors: true, side: THREE.DoubleSide }), 'roof'); }
  if (B.sign.n) { const sc = mkCv(1024, 48), sx = sc.getContext('2d'); sx.fillStyle = shadeC(c1, -0.25); sx.fillRect(0, 0, 1024, 48); sx.fillStyle = Math.abs(lumHex(c2) - lumHex(c1)) > 0.25 ? c2 : '#fff'; sx.font = fontOf(v.font, 38); sx.textAlign = 'center'; sx.textBaseline = 'middle'; fitText(sx, ((home.city || '') + ' ' + (home.name || '')).toUpperCase(), 512, 26, 980, 'fill'); add(B.sign, new THREE.MeshBasicMaterial({ map: canvasTex(sc, false) }), 'sign'); }
  if (B.board.n) { const bw = coarse ? 512 : 1024, bc = mkCv(bw, bw / 2), bt = canvasTex(bc, false); bt.anisotropy = 4;
    board = { c: bc, x: bc.getContext('2d'), tex: bt, sig: '', retro: S === 'retro' || S === 'college', font: v.font, ad: pickR(r, ADS)[0] };
    add(B.board, new THREE.MeshBasicMaterial({ map: bt, toneMapped: false, color: new THREE.Color(1, 1, 1).multiplyScalar(night ? 0.72 : 0.92) }), 'board'); paintBoard(true); } else board = null;
  const gm = glowMesh(glows, lampOn ? lit * (night ? 1 : 0.55) : 0, warm); if (gm) grp.add(gm);
  // ---- beyond the stands ----
  if (v.backdrop !== 'none' && S !== 'dome') { const bt = backdropTex(v, at, P, r), ring = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, 120, 64, 1, true), new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    ring.position.set(0, 120 / 2 - 120 * 0.2 * 1.0 + 4, CZ); ring.renderOrder = -10; ring.name = 'backdrop'; grp.add(ring); }
  return grp;
}
function figureAtlas(T, kit, r) {   // eight cut-outs: players (helmet on, helmet in hand), coaches (polo, cap, headset), staff
  const c = mkCv(512, 128), x = c.getContext('2d'), k = kit || {}, jer = k.jersey || T.c1 || '#1d3478', trim = k.trim || T.c2 || '#ffffff', pants = k.pants || '#e8e8e8', helm = k.helmet || T.c1 || '#1d3478', num = k.num || '#ffffff';
  const skins = ['#e9c4a2', '#c08a5e', '#8a5a36', '#5b3a22', '#d9a77f'], c1 = T.c1 || '#1d3478';
  for (let i = 0; i < 8; i++) { const ox = i * 64 + 32, sk = skins[(r() * skins.length) | 0], kind = i < 5 ? 'player' : i < 7 ? 'coach' : 'staff';
    if (kind === 'player') { x.fillStyle = pants; x.fillRect(ox - 10, 72, 9, 26); x.fillRect(ox + 1, 72, 9, 26); x.fillStyle = k.socks || jer; x.fillRect(ox - 10, 98, 9, 20); x.fillRect(ox + 1, 98, 9, 20); x.fillStyle = k.cleat || '#151517'; x.fillRect(ox - 11, 118, 11, 8); x.fillRect(ox + 1, 118, 11, 8); }
    else { x.fillStyle = kind === 'coach' ? (r() < 0.5 ? '#c8b48a' : '#24262a') : '#2a2d33'; x.fillRect(ox - 9, 70, 8, 52); x.fillRect(ox + 1, 70, 8, 52); x.fillStyle = '#18191b'; x.fillRect(ox - 10, 120, 10, 6); x.fillRect(ox + 1, 120, 10, 6); }
    const top = kind === 'player' ? jer : kind === 'coach' ? (r() < 0.6 ? c1 : '#e8e6e0') : (r() < 0.5 ? '#3a3f47' : '#1f2226'), sw = kind === 'player' ? 19 : 14;
    x.fillStyle = top; x.beginPath(); x.moveTo(ox - sw, 34); x.lineTo(ox + sw, 34); x.lineTo(ox + 12, 74); x.lineTo(ox - 12, 74); x.closePath(); x.fill(); x.fillRect(ox - sw - 1, 34, 7, 30); x.fillRect(ox + sw - 6, 34, 7, 30);
    x.fillStyle = sk; x.fillRect(ox - sw - 1, 62, 7, 8); x.fillRect(ox + sw - 6, 62, 7, 8);
    if (kind === 'player') { x.fillStyle = trim; x.fillRect(ox - sw, 34, sw * 2, 3); x.fillStyle = num; x.fillRect(ox - 6, 44, 12, 14); }
    if (kind === 'player' && i < 3) { x.fillStyle = helm; x.beginPath(); x.arc(ox, 22, 12, 0, 7); x.fill(); x.fillStyle = k.mask || '#c9ccd2'; x.fillRect(ox - 7, 26, 14, 3); }
    else { x.fillStyle = sk; x.beginPath(); x.arc(ox, 23, 9, 0, 7); x.fill(); x.fillRect(ox - 4, 30, 8, 5);
      if (kind === 'coach') { x.fillStyle = c1; x.fillRect(ox - 10, 12, 20, 7); x.fillRect(ox - 2, 15, 14, 3); x.fillStyle = '#111'; x.fillRect(ox - 11, 20, 3, 10); }
      else { x.fillStyle = ['#1a1410', '#3b2a1e', '#6b4a2a'][(r() * 3) | 0]; x.fillRect(ox - 9, 13, 18, 7); }
      if (kind === 'player') { x.fillStyle = helm; x.beginPath(); x.arc(ox + sw + 3, 66, 9, 0, 7); x.fill(); } } }
  return canvasTex(c, false);
}
function sidelineCrowd(T, kit, sx, r) {   // camera-facing cut-outs standing in the team area (local x = metres out from the sideline)
  const n = coarse ? 16 : 26, pos = [], cor = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) { const kind = i < n * 0.15 ? (r() < 0.7 ? 5 : 6) : i < n * 0.22 ? 7 : (r() * 5) | 0, coach = kind >= 5, off = coach ? 5.2 + r() * 1.6 : 7.4 + r() * 2.6, z = CZ + (r() - 0.5) * (coach ? 30 : 44), h = 1.78 + r() * 0.2, w = h * 0.5;
    for (let k = 0; k < 4; k++) { pos.push(sx * off, 0, z); cor.push((k & 1 ? 0.5 : -0.5) * w, k & 2 ? h : 0); uv.push((kind + (k & 1 ? 1 : 0)) / 8, k & 2 ? 1 : 0); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('corner', new THREE.Float32BufferAttribute(cor, 2)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.MeshStandardMaterial({ map: figureAtlas(T, kit, r), alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec2 corner;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 camL = cameraPosition - ( modelMatrix * vec4( position, 1.0 ) ).xyz;\nvec2 dh = normalize( camL.xz + vec2( 0.0001 ) );\nvec3 objectNormal = normalize( vec3( dh.x, 0.35, dh.y ) );')
    .replace('#include <begin_vertex>', 'vec3 transformed = position + vec3( dh.y, 0.0, -dh.x ) * corner.x + vec3( 0.0, corner.y, 0.0 );'); };
  m.customProgramCacheKey = () => 'sideline-figs';
  const ms = new THREE.Mesh(g, m); ms.frustumCulled = false; ms.userData = { sx, off: 0 }; ms.name = 'sideline'; return ms;
}
function tree(B, x, z, h, kind, r) {   // a billboard tree: two crossed quads
  const tod = VEN.at.tod, sh = { day: [0.92, 0.95, 0.9], overcast: [0.66, 0.7, 0.68], dusk: [0.82, 0.64, 0.52], night: [0.07, 0.08, 0.09], dome: [0.5, 0.5, 0.5] }[tod] || WHITE3, w = h * (kind ? 0.95 : 0.55);
  for (const a of [0, Math.PI / 2]) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + kind * 0.5);
    const m = new THREE.Matrix4().makeRotationY(a + r() * 0.5).setPosition(x, h / 2, z); B.add(g, m, sh.map(c => c * (0.85 + r() * 0.2))); }
}
function lattice(B, x, z, h, c, head) {   // a steel lattice light tower: four tapering legs, zig-zag bracing, a lamp bank on top facing the field
  const V3 = (a, b, d) => new THREE.Vector3(a, b, d), w0 = 3.2, w1 = 1.1, leg = (i, y) => { const w = w0 + (w1 - w0) * y / h, sx = i & 1 ? 1 : -1, sz = i & 2 ? 1 : -1; return V3(x + sx * w, y, z + sz * w); };
  for (let i = 0; i < 4; i++) B.bar(leg(i, 0), leg(i, h), 0.18, c, 5);
  for (let y = 0; y < h - 4; y += 4.5) for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) B.bar(leg(a, y), leg(b, y + 4.5), 0.07, c, 4);
  const dx = -x, dz = CZ - z, dl = Math.hypot(dx, dz); head(x + dx / dl * 2.4, h + 3.5, z + dz / dl * 2.4);
}
// ---------------- weather: rain streaks or snow round the camera ----------------
function setWeather(kind) {
  if (wxo) { scene.remove(wxo.obj); wxo.obj.geometry.dispose(); wxo.obj.material.dispose(); wxo = null; }
  if (kind !== 'rain' && kind !== 'snow') return;
  const rain = kind === 'rain', n = rain ? (coarse ? 700 : 1500) : (coarse ? 1300 : 2600), pos = new Float32Array(n * (rain ? 6 : 3)), seed = new Float32Array(n * 3), g = new THREE.BufferGeometry();
  for (let i = 0; i < n; i++) { seed[i * 3] = (Math.random() - 0.5) * 70; seed[i * 3 + 1] = Math.random() * 34; seed[i * 3 + 2] = (Math.random() - 0.5) * 70; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const obj = rain ? new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb9c3cf, transparent: true, opacity: 0.32, depthWrite: false }))
    : new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true }));
  obj.frustumCulled = false; scene.add(obj); wxo = { obj, pos, seed, n, rain, t: 0 };
}
// ---------------- penalty flags: a yellow flag tossed onto the spot of the foul (play coordinates) ----------------
const flagsOn = []; let flagGeo = null, flagMat = null;
function stepFlags(dt) { for (const F of flagsOn) { F.t += dt; const u = Math.min(1, F.t / 0.62), x = F.fx + (F.x - F.fx) * u, z = F.fz + (F.z - F.fz) * u, y = 0.035 + (1 - u) * 1.85 + 2.3 * u * (1 - u);
  F.mesh.position.set(x, y, z); if (u < 1) F.mesh.rotation.set(F.t * 7 + F.spin, F.t * 4.2, F.t * 5.3); else F.mesh.rotation.set(-Math.PI / 2 + 0.06, 0.04, F.spin); } }
function stepWeather(dt) {
  if (!wxo) return; const w = wxo, P0 = w.pos, S0 = w.seed, cx = camLook.x, cz = camLook.z, fall = w.rain ? 15 : 1.3; w.t += dt;
  const WV = R3D.windV, wvx = WV ? WV.x * (w.rain ? 0.6 : 0.8) : 0, wvz = WV ? WV.z * (w.rain ? 0.6 : 0.8) : 0;     // the match sets the wind for this play (m/s, play frame): rain and snow drift with it
  for (let i = 0; i < w.n; i++) { let y = S0[i * 3 + 1] - fall * dt; if (y < 0) y += 34; S0[i * 3 + 1] = y;
    let x = S0[i * 3] + ((w.rain ? -1.2 : Math.sin(w.t * 0.9 + i) * 0.5) + wvx) * dt, z = S0[i * 3 + 2] + ((w.rain ? 0.5 : Math.cos(w.t * 0.7 + i * 1.3) * 0.4) + wvz) * dt; S0[i * 3] = x; S0[i * 3 + 2] = z;
    const wx = cx + ((((x - cx) % 70) + 105) % 70) - 35, wz = cz + ((((z - cz) % 70) + 105) % 70) - 35;
    if (w.rain) { P0.set([wx, y, wz, wx + 0.06, y + 0.55, wz - 0.025], i * 6); } else P0.set([wx, y, wz], i * 3); }
  w.obj.geometry.attributes.position.needsUpdate = true;
}
// ---------------- applying a venue: light, sky, ground ----------------
function useVenue(home) {   // the look of this home team's ground today (cheap; the stands themselves are built in prepare)
  const v = venueOf(home), at = atmoOf(home, v), sig = v.sig + '|' + at.tod + '|' + at.weather + '|' + at.wk;
  if (VEN && VEN.sig === sig && VEN.tid === home.id) return VEN;
  const prevAway = VEN ? VEN.away : null; VEN = { tid: home.id, v, at, sig, P: TOD[at.tod] || TOD.night, away: prevAway, box: venueBox(v, at) };
  const bx = VEN.box; Object.assign(VSH.a, { x: bx[0], y: bx[1], z: bx[2], w: bx[3] }); Object.assign(VSH.d, { x: bx[8], y: bx[9], z: bx[10] }); Object.assign(VSH.b, { x: bx[4], y: bx[5], z: bx[6], w: bx[7] });
  sunDir.copy(pickSun(at, VEN.P)); applyAtmo(); applyGround(home); lastField = '';
  return VEN;
}
function applyAtmo() {
  const { P, v, at } = VEN, wet = at.weather !== 'clear', sunny = at.tod === 'day' || at.tod === 'dusk';
  sun.color.set(at.tod === 'night' && !v.led ? 0xffe5c2 : P.sun); sun.intensity = P.sunI * (wet && sunny ? 0.45 : 1) * (at.tod === 'night' && !v.led ? 0.9 : 1);
  hemi.color.set(P.sky); hemi.groundColor.set(P.gnd); hemi.intensity = P.hemiI * (wet && sunny ? 1.6 : wet ? 1.15 : 1);
  fillL.intensity = P.fill; fillL.position.set(-sunDir.x * 40, 30, -sunDir.z * 40 + 40);
  renderer.toneMappingExposure = P.exp * (wet && sunny ? 1.08 : 1);
  scene.fog.color.copy(col(wet ? hexMix(P.fog, '#9aa0a6', at.tod === 'night' ? 0.15 : 0.45) : P.fog)); scene.fog.near = P.fogN * (wet ? 0.55 : 1); scene.fog.far = P.fogF * (wet ? 0.45 : 1);
  Object.assign(VSH.c, { x: sunDir.x, y: sunDir.y, z: sunDir.z, w: P.sh * (wet ? 0.35 : 1) });
  const grey = (h, k) => (wet ? hexMix(h, at.tod === 'night' ? '#1c2129' : '#8f969d', k) : h);
  skyU.zen.value.copy(col(grey(P.zen, 0.6))); skyU.hor.value.copy(col(grey(P.hor, 0.5))); skyU.hor2.value.copy(col(grey(P.hor2, 0.5))); skyU.gnd.value.copy(col(P.gndC)); skyU.sunC.value.set(P.sun);
  skyU.sunD.value.copy(sunDir); skyU.sunS.value = P.sunS * (wet ? 0.15 : 1); skyU.cLit.value.copy(col(grey(P.cLit, 0.4))); skyU.cDark.value.copy(col(grey(P.cDark, 0.4))); skyU.cloudA.value = wet ? 1 : P.clouds > 0 ? 1 : 0;
  if (skyU.tCloud.value) skyU.tCloud.value.dispose(); skyU.tCloud.value = cloudTex(at, P, v.seed + at.wk * 7);
  skyMesh.visible = at.tod !== 'dome'; scene.background = col(P.hor);
  if (envRT) envRT.dispose(); envRT = makeEnv(P, at, v); scene.environment = envRT.texture;
  setWeather(at.weather);
}
function applyGround(home) {
  const { v, at } = VEN, turf = v.surface === 'turf';
  fieldU.uMow.value.set(MOW_ID[v.mow] || 0, turf ? 0.075 : v.mow === 'diamond' || v.mow === 'checker' ? 0.1 : 0.12, turf ? 0 : 0.4, turf ? 1 : 0);
  apronU.uMow.value.set(0, { night: 0.85, dusk: 0.25 }[at.tod] || 0, 0, turf ? 1 : 0); flatU.uMow.value.set(0, 0, 0, turf ? 1 : 0);
  fieldMat.roughness = at.weather === 'rain' ? 0.56 : turf ? 0.8 : 0.95; fieldMat.envMapIntensity = at.weather === 'rain' ? 1.15 : turf ? 0.35 : 0.5;
  if (apronMat.map) apronMat.map.dispose(); apronMat.map = apronTex(v, rngOf(v.seed + 3), at.weather === 'snow'); apronMat.needsUpdate = true; apronMat.roughness = fieldMat.roughness;
  const bc = v.border === 'color' ? shadeC(home.c1 || '#1d3478', -0.1) : '#e9e9e0'; borderMat.color.copy(col(bc)); for (const m of FW.sides.concat(FW.ends)) m.visible = v.border !== 'line';
  if (sideMat) { if (sideMat.map) sideMat.map.dispose(); sideMat.map = bandTex(home, v, -1); sideMat.color.setScalar(0.9); sideMat.needsUpdate = true; }
  const pc = pGeo && pGeo.attributes.color; if (pc) { const a = col(turf ? '#1b1b1c' : '#4d3d29'), b = col(turf ? '#3d6a3c' : '#4a6a32'); for (let i = 0; i < PN; i++) { const c = i % 3 ? a : b; pc.setXYZ(i, c.r, c.g, c.b); } pc.needsUpdate = true; }
}
function setAwayBand(away) { if (!VEN || !away || VEN.away === away.id) return; VEN.away = away.id; if (bandMat2.map) bandMat2.map.dispose(); bandMat2.map = bandTex(away, VEN.v, 1); bandMat2.color.setScalar(0.9); bandMat2.needsUpdate = true; }
function buildVenue(home) {
  useVenue(home); const G0 = typeof MATCH !== 'undefined' && MATCH._G, away = G0 && G0.A && G0.A.id !== home.id ? G0.A : null;
  const old = scene.getObjectByName('stadium'); if (old) { scene.remove(old); disposeTree(old); } board = null;
  const st = buildStadium(home, away); st.userData.sig = VEN.v.sig; scene.add(st); if (away) setAwayBand(away); applyWidth();
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
    { const m = play.umo; if (m && !m.set && m.path) ribbon([{ x: m.p.p.x, z: m.p.p.z }].concat(m.path.slice(m.i)), 0xffffff, 0.07); }      // motion called at the line: where he is going
    if (play.op.type === 'run') { const rb = play.O.find(p => p.role === 'rb') || play.qb; ribbon([{ x: rb.p.x, z: rb.p.z }, { x: play.gapX, z: play.losZ - 0.4 }, { x: play.gapX, z: play.losZ + 4.5 }], 0xff5a5a, 0.11); }
    for (const b of play.O) if (b.ol && b.asg) { const a = b.asg, dx = -(a.d || 0), pts = a.t === 'pull' ? [{ x: b.p.x, z: b.p.z }, { x: b.p.x, z: b.p.z - 1 }, { x: play.gapX, z: play.losZ - 0.6 }, { x: play.gapX, z: play.losZ + 1.5 }] : a.t === 'pass' ? [{ x: b.p.x, z: b.p.z }, { x: b.p.x, z: b.p.z - 1.6 }] : a.t === 'climb' ? [{ x: b.p.x, z: b.p.z }, { x: b.p.x, z: b.p.z + 4.2 }] : [{ x: b.p.x, z: b.p.z }, { x: b.p.x + dx * 1.6, z: b.p.z + 1.7 }];
      ribbon(pts, a.t === 'pull' ? 0xff9b4a : a.t === 'pass' ? 0x9fd0ff : 0xffffff, 0.06); }
  } else {
    for (const d of play.D) {
      if (d.zone) { const r = d.zone.deep ? 4.5 : 3.2, ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r, 48), new THREE.MeshBasicMaterial({ color: d.zone.deep ? 0x5fb4ff : 0xffe066, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(d.zone.x, y, d.zone.z); overlay.add(ring); ribbon([{ x: d.p.x, z: d.p.z }, { x: d.zone.x, z: d.zone.z }], d.zone.deep ? 0x5fb4ff : 0xffe066, 0.04); }
      else if (d.job === 'man' && d.cover) ribbon([{ x: d.p.x, z: d.p.z }, { x: d.cover.p.x, z: d.cover.p.z + 0.4 }], d.bracket ? 0x5fb4ff : 0xd08cff, d.bracket ? 0.07 : 0.04);
      else if (d.gapAim != null) ribbon([{ x: d.p.x, z: d.p.z }, { x: d.gapAim, z: play.losZ + 0.3 }, { x: play.qb.p.x, z: play.losZ - 1.6 }], 0xff5a5a, 0.1);     // a gap blitz, through his gap
      else if (d.job === 'rush' && !d.dl) ribbon([{ x: d.p.x, z: d.p.z }, { x: play.qb.p.x, z: play.losZ - 0.8 }], 0xff5a5a, 0.08);
      else if (d.qbSpy) ribbon([{ x: d.p.x, z: d.p.z }, { x: play.qb.p.x, z: play.qb.p.z + 1.2 }], 0xff9b4a, 0.07);      // the spy, eyes on the QB
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
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.6 : 2)); renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    patchShaders();                                  // stand shadows in every lit material (before anything compiles)
    scene = new THREE.Scene(); scene.background = col('#1a2230'); scene.fog = new THREE.Fog(col('#161c27'), 110, 460); camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    hemi = new THREE.HemisphereLight(0xa3b4d8, 0x2b3a22, 0.34); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xf4f6ff, 2.0); sun.castShadow = true; sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 170 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
    fillL = new THREE.DirectionalLight(0xcfe0ff, 0.5); fillL.position.set(20, 25, 60); scene.add(fillL);
    const c = document.createElement('canvas'); c.width = c.height = 4; BLANK = new THREE.CanvasTexture(c);
    skyMesh = makeSky(); scene.add(skyMesh);
    // the field, the apron round it, the border outside the sidelines and end lines, the two team areas, the pylons (all at full width; applyWidth fits them)
    { const det = grassDetail(), bw = 1.83, L0 = 120 * YDm + 2 * bw, wc = mkCv(4, 4), wg = wc.getContext('2d'); wg.fillStyle = '#ffffff'; wg.fillRect(0, 0, 4, 4); const whiteT = new THREE.CanvasTexture(wc);
      fieldU = { tDetail: { value: det }, uMow: { value: new THREE.Vector4(1, 0.08, 0.4, 0) }, uK: { value: FIELD.halfW / FW.half0 } };
      apronU = { tDetail: { value: det }, uMow: { value: new THREE.Vector4(0, 0, 0, 0) }, uK: { value: 1 } }; flatU = { tDetail: { value: det }, uMow: { value: new THREE.Vector4(0, 0, 0, 0) }, uK: { value: 1 } };
      fieldMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.6 }); groundShader(fieldMat, fieldU, 24, 54, 'field');
      fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * FW.half0, 120 * YDm), fieldMat); fieldMesh.rotation.x = -Math.PI / 2; fieldMesh.position.set(0, 0, 50 * YDm); fieldMesh.receiveShadow = true; scene.add(fieldMesh);
      apronMat = new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.5 }); groundShader(apronMat, apronU, 210, 260, 'apron');
      const apron = new THREE.Mesh(new THREE.PlaneGeometry(420, 520), apronMat); apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.01, 50 * YDm); apron.receiveShadow = true; scene.add(apron);
      borderMat = new THREE.MeshStandardMaterial({ map: whiteT, color: col('#e9e9e0'), roughness: 0.9 }); groundShader(borderMat, flatU, 1, 56, 'flat');
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, L0), borderMat); m.rotation.x = -Math.PI / 2; m.position.set(sx * (FIELD.halfW + bw / 2), 0.004, 50 * YDm); m.receiveShadow = true; FW.sides.push(m); scene.add(m); }
      for (const z of [-10 * YDm - bw / 2, 110 * YDm + bw / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * FW.half0 + 2 * bw, bw), borderMat); FW.ends.push(m); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.004, z); m.receiveShadow = true; scene.add(m); }
      sideMat = new THREE.MeshStandardMaterial({ map: whiteT, color: col('#1d4f8a'), roughness: 0.85 }); bandMat2 = new THREE.MeshStandardMaterial({ map: whiteT, color: col('#5a5f66'), roughness: 0.85 });
      groundShader(sideMat, flatU, 1.2, 23, 'flat'); groundShader(bandMat2, flatU, 1.2, 23, 'flat');
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 50 * YDm), sx < 0 ? sideMat : bandMat2); m.rotation.x = -Math.PI / 2; m.position.set(sx * (FIELD.halfW + bw + 4.2), 0.003, 50 * YDm); m.receiveShadow = true; FW.bands.push(m); scene.add(m); }
      pylMat = new THREE.MeshStandardMaterial({ color: col('#ff6a1c'), roughness: 0.6 });
      for (const sx of [-1, 1]) { const pb = Batch(); for (const z of [-10 * YDm, 0, 100 * YDm, 110 * YDm]) pb.box(0.1, 0.46, 0.1, sx * 0.05, 0.23, z); const m = pb.mesh(pylMat, 'pylons'); m.matrixAutoUpdate = true; m.castShadow = true; m.userData = { sx, off: 0 }; FW.props.push(m); scene.add(m); }
      applyWidth(); }
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
    buildVenue(home);
  },
  applyWidth() { applyWidth(); },
  // venues: what a team's ground looks like (T.venue overrides any key of VENUE_OPTS), and what is on screen now
  venueOf(T) { return venueOf(T); }, VENUE_OPTS,
  venueInfo() { return VEN ? Object.assign({}, VEN.v, { tod: VEN.at.tod, weather: VEN.at.weather, week: VEN.at.wk, roofOpen: !!VEN.at.roofOpen, temp: VEN.at.temp, sun: sunDir.toArray().map(v => +v.toFixed(2)) }) : null; },
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
  // the home team's ground: its field (end zones in the home colours, the logo turned to face the camera), the visitors' sideline, today's light
  setField(offTeam, defTeam, homeTeam, losZ, fdZ, goal, view = 1) {
    const home = homeTeam || offTeam; useVenue(home); setAwayBand(offTeam && offTeam.id !== home.id ? offTeam : defTeam && defTeam.id !== home.id ? defTeam : null);
    { const st = scene.getObjectByName('stadium'); if (st) st.visible = st.userData.sig === VEN.v.sig; }       // a new ground's stands are built in prepare; hide the last one's meanwhile
    const key = home.id + '_' + view + '_' + VEN.sig + '_' + FIELD.halfW.toFixed(2); if (key !== lastField) { fieldMat.map = fieldTexture(home, view); fieldMat.needsUpdate = true; lastField = key; }
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
    stepParticles(dt); stepWeather(dt); if (flagsOn.length) stepFlags(dt);
    sun.target.position.copy(camLook); sun.position.copy(camLook).addScaledVector(sunDir, 80); sun.target.updateMatrixWorld();   // the shadow box follows the play
    if (board && (boardT += dt) > 0.5) { boardT = 0; paintBoard(false); }
    if (skyMesh) skyMesh.position.copy(camera.position); updateCut();
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
  // penalty flag at {x, z} (thrown in from an official a few yards off); null picks them all up
  flag(f) {
    if (!scene) return;
    if (!f) { for (const F of flagsOn) scene.remove(F.mesh); flagsOn.length = 0; return; }
    if (!flagGeo) { flagGeo = new THREE.PlaneGeometry(0.8, 0.8, 4, 4); const P = flagGeo.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.05); flagGeo.computeVertexNormals();
      flagMat = new THREE.MeshStandardMaterial({ color: col('#ffd21a'), emissive: col("#5a4700"), roughness: 0.9, side: THREE.DoubleSide }); }
    const mesh = new THREE.Mesh(flagGeo, flagMat); mesh.castShadow = true; mesh.renderOrder = 2; scene.add(mesh);
    const sx = f.x > 0 ? -1 : 1; flagsOn.push({ mesh, x: f.x, z: f.z, fx: f.x + sx * (3 + Math.random() * 2), fz: f.z - 3 - Math.random() * 3, t: 0, spin: Math.random() * 6.28 }); stepFlags(0);
  },
  // the passing aim line: a dotted arc along the real flight, and a ring where it comes down (green if a receiver can get there)
  aim(a) {
    aimNow = a || null;
    if (!aimDots) return;
    if (!a) { aimDots.visible = false; aimRing.visible = false; if (aimRange) aimRange.visible = false; return; }
    const P = aimDots.geometry.attributes.position.array, n = AIMN, ph = (performance.now() / 600) % 1;
    for (let i = 0; i < n; i++) { const t = a.T * Math.min(1, (i + ph) / n); const wk = a.wa ? 0.5 * t * t : 0; P[i * 3] = a.hand.x + a.v.x * t + (wk && a.wa.x * wk); P[i * 3 + 1] = Math.max(0.05, a.hand.y + a.v.y * t - 4.905 * t * t); P[i * 3 + 2] = a.hand.z + a.v.z * t + (wk && a.wa.z * wk); }     // wa: the wind bends the arc
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
