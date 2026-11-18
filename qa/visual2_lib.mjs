// Round-2 visual review helpers: launch against the frozen dist/playcaller_qa2.html, numbered screenshots, paused-physics stepping.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
export const root = 'C:/Users/dwint/football-game';
export const HTML = 'file:///' + root + '/dist/playcaller_qa2.html';
export const OUT = path.join(root, 'qa', 'shots', 'visual_r2');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
export const SIZES = { phone: [390, 844, 3], land: [844, 390, 3], desk: [1280, 800, 1], lap: [1280, 720, 1], hd: [1920, 1080, 1] };
export async function open(which, sub) {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const [vw, vh, dpr] = SIZES[which];
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: false });
  const page = await ctx.newPage(); const errs = [], log = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  const shots = path.join(OUT, sub); fs.mkdirSync(shots, { recursive: true });
  await page.goto(HTML); await page.waitForTimeout(900);
  let n = 0;
  const shot = async (name, extra) => { const f = `${String(n++).padStart(3, '0')}_${name}.png`; await page.screenshot({ path: path.join(shots, f) }); if (extra) log.push({ f, ...extra }); return f; };
  const done = async () => { fs.writeFileSync(path.join(shots, 'log.json'), JSON.stringify(log, null, 1)); await browser.close(); console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors'); };
  return { browser, ctx, page, shots, shot, errs, log, done, vw, vh, dpr };
}
// advance paused physics by ms; the game's own rAF loop renders each 1/60 s slice
export async function installAdv(page) {
  await page.evaluate(() => { window.__adv = ms => new Promise(res => { let left = ms / 1000; const f = () => { const g = MATCH._G, pl = g && g.play; if (!pl) return res(); const d = Math.min(left, 1 / 60), k = Math.max(1, Math.round(d / PHYS.DT)); for (let i = 0; i < k; i++) pl.step(PHYS.DT); left -= d; if (left > 1e-6) requestAnimationFrame(f); else requestAnimationFrame(() => requestAnimationFrame(res)); }; requestAnimationFrame(f); }); });
}
export const raf2 = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
export async function waitReady(page) { for (let i = 0; i < 500; i++) { const r = await page.evaluate(() => MATCH._G && MATCH._G.ready); if (r) return true; await page.waitForTimeout(300); } return false; }
