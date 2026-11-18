// Diagnose helmet speckle: mesh the helmet with the game's SDF code at game res vs Lab res, color by palette slot
// (shell blue, stripe white, rubber dark, INNER LINER magenta), back faces red, render close-ups. Also body/head tri counts.
import { chromium } from 'playwright-core';
import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game';
const out = path.join(root, 'qa', 'shots', 'visual');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto('file:///' + root + '/dist/playcaller_qa.html'); await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const M = R3D._; const res = [0.0095, 0.0085, 0.0045]; const outs = res.map(r => M.meshSDF(M.makeHelmetModel({ kind: 'sleek', stripe: 'single', logo: true, res: r })));
  const c = document.createElement('canvas'); c.width = 1200; c.height = 600; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true }); r.setClearColor(0x335533);
  const cols = [[0.2, 0.55, 0.9], [1, 1, 1], [0.9, 0.9, 0.2], [0.08, 0.08, 0.08], [1, 0, 1]];
  const scenes = outs.map((o, k) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(o.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(o.normal, 3));
    const nv = o.count, cl = new Float32Array(nv * 3); for (let q = 0; q < nv; q++) { let best = 0, bw = -1; for (let s = 0; s < 5; s++) { const w = o.W8[q * 8 + s]; if (w > bw) { bw = w; best = s; } } cl.set(cols[best], q * 3); } g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setIndex(new THREE.BufferAttribute(o.index, 1));
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1)); const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(1, 2, 1); s.add(dl);
    s.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide })));
    s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.BackSide })));
    return s; });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  window.__render = (az, el) => { r.setScissorTest(true); scenes.forEach((s, i) => { r.setViewport(i * 400, 0, 400, 600); r.setScissor(i * 400, 0, 400, 600); cam.aspect = 400 / 600; cam.updateProjectionMatrix(); const d = 0.75; cam.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d + 0.02, Math.cos(az) * Math.cos(el) * d); cam.lookAt(0, 0.02, 0); r.render(s, cam); }); };
  window.__render(-2.4, 0.5);
  return outs.map((o, i) => ({ res: res[i], verts: o.count, tris: o.index.length / 3 }));
});
console.log('helmet sleek', JSON.stringify(info));
await page.screenshot({ path: path.join(out, 'diag_helmet_backtop.png') });
await page.evaluate(() => window.__render(1.2, 0.25)); await page.screenshot({ path: path.join(out, 'diag_helmet_side.png') });
const tri = await page.evaluate(() => { const M = R3D._; const t = {}; for (const [k, o] of [['body_BIG_0.017', { heightIn: 77, weightLb: 305, muscle: 0.45, pads: 'trench', res: 0.017 }], ['body_SKILL_0.017', { heightIn: 73, weightLb: 200, muscle: 0.6, pads: 'sleek', res: 0.017 }]]) { const m = M.meshSDF(M.makeBodyModel(Object.assign({ arms: { L: { item: 'full', wrist: 'tape' }, R: { item: 'full', wrist: 'tape' } } }, o))); t[k] = m.index.length / 3; } const h = M.meshSDF(M.makeHeadModel({ headScale: 1, res: 0.0075 })); t.head = h.index.length / 3; return t; });
console.log('tris', JSON.stringify(tri));
await browser.close();
