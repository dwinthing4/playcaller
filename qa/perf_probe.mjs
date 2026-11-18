// FPS + draw stats on the machine's real GPU (headless Chrome with ANGLE/D3D11), watch mode at phone size.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
const [vw, vh, dpr] = process.argv[2] === 'desk' ? [1280, 800, 1] : [390, 844, 3];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1 });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts|net::/.test(m.text())) errs.push(m.text()); });
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(400);
const gpu = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
console.log('GPU:', gpu);
await page.evaluate(() => { NG.slot = 2; NG.qlen = 120; createLeague(); pickTeam(L.teams[3].id); startUserGame('watch'); });
for (let i = 0; i < 120; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage); if (s && s !== 'load') break; await page.waitForTimeout(250); }
const samples = [];
for (let k = 0; k < 6; k++) {
  for (let i = 0; i < 80; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage); if (s === 'live') break; await page.waitForTimeout(100); }
  const r = await page.evaluate(() => new Promise(res => { let n = 0, worst = 0, prev = performance.now(); const t0 = prev; const f = () => { const now = performance.now(); worst = Math.max(worst, now - prev); prev = now; n++; if (now - t0 < 1500) requestAnimationFrame(f); else res({ fps: n / ((now - t0) / 1000), worst, st: R3D.stats() }); }; requestAnimationFrame(f); }));
  samples.push(r); console.log(`fps ${r.fps.toFixed(1)}  worst frame ${r.worst.toFixed(0)} ms  draw calls ${r.st.calls}  tris ${r.st.tris}  rigs ${r.st.rigs}`);
}
await page.screenshot({ path: path.join(root, 'qa', 'shots', 'match', 'perf_watch.png') });
await browser.close();
console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no errors');
