// Character Lab: helmet close-up, back view (name bar), turntable frames, phone framing.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game';
const shots = path.join(root, 'qa', 'shots', 'visual');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const which = process.argv[2] || 'desk';
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 3] : [1280, 800, 1];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1 });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message));
const three = fs.readFileSync(path.join(root, 'vendor', 'three.min.js'), 'utf8');
await page.route('**/*', r => {
  const u = r.request().url();
  if (u.includes('three.min.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: three });
  if (u.includes('GLTFExporter') || u.includes('claudeusercontent')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  return r.continue().catch(() => {});
});
await page.goto('file:///C:/Users/dwint/Downloads/Gridiron%20character%20lab.html');
const shot = async n => { await page.screenshot({ path: path.join(shots, `lab_${which}_${n}.png`) }); console.log('shot', n); };
const ready = async (min = 4) => { for (let i = 0; i < 120; i++) { const h = await page.evaluate(() => { const s = document.querySelector('#status'); return !s || s.hidden; }); if (h && i >= min) break; await page.waitForTimeout(400); } };
await ready(6); await page.waitForTimeout(1200);
if (which === 'phone') { await shot('10_phone_locker'); }
// hide panel
const panelOpen = await page.evaluate(() => { const p = document.querySelector('#panel'); return p && getComputedStyle(p).display !== 'none' && !p.hidden; });
// helmet close-up via the visible button
await page.evaluate(() => { const b = [...document.querySelectorAll('#face')].find(x => x.offsetParent); if (b) b.click(); else { document.querySelector('[data-sec="helmet"]').click(); setTimeout(() => [...document.querySelectorAll('#face')].find(x => x.offsetParent)?.click(), 50); } });
await page.waitForTimeout(1800); await shot('11_helmet_closeup');
await page.evaluate(() => [...document.querySelectorAll('#full')].find(x => x.offsetParent)?.click());
await page.waitForTimeout(800);
// rotate by drag to see the back
const cx = vw * 0.4, cy = vh * 0.5;
await page.mouse.move(cx, cy); await page.mouse.down();
for (let i = 1; i <= 20; i++) { await page.mouse.move(cx + i * (which === 'phone' ? 12 : 30), cy); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(900); await shot('12_rotated');
await page.mouse.move(cx, cy); await page.mouse.down();
for (let i = 1; i <= 20; i++) { await page.mouse.move(cx + i * (which === 'phone' ? 12 : 30), cy); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(900); await shot('13_rotated_more');
// sprint motion burst
await page.evaluate(() => { document.querySelector('[data-sec="motion"]').click(); });
await page.waitForTimeout(300);
await page.evaluate(() => { const b = [...document.querySelectorAll('#move button')].find(x => x.textContent.trim() === 'Sprint'); b && b.click(); });
await page.evaluate(() => [...document.querySelectorAll('#full')].find(x => x.offsetParent)?.click());
await page.waitForTimeout(800);
for (let i = 0; i < 4; i++) { await page.waitForTimeout(120); await shot('14_sprint_' + i); }
await page.evaluate(() => { const b = [...document.querySelectorAll('#move button')].find(x => x.textContent.trim() === 'Block'); b && b.click(); });
await page.waitForTimeout(500);
for (let i = 0; i < 4; i++) { await page.waitForTimeout(200); await shot('15_block_' + i); }
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
