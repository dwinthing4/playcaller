// Visual review: reference captures of the Character Lab (players look target).
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game';
const shots = path.join(root, 'qa', 'shots', 'visual'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const which = process.argv[2] || 'desk';
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 3] : [1280, 800, 1];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1 });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
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
await ready(6);
await page.waitForTimeout(1500);
await shot('01_locker_WR');
const clickTxt = async (sel, txt) => { const els = await page.$$(sel); for (const e of els) { if ((await e.textContent()).trim() === txt) { await e.click(); return true; } } return false; };
for (const p of ['QB', 'RB', 'LB', 'OL']) { await clickTxt('#presets button', p); await page.waitForTimeout(400); await ready(2); await page.waitForTimeout(800); await shot('02_locker_' + p); }
await page.click('#face').catch(() => {}); await page.waitForTimeout(1500); await shot('03_helmet_closeup');
await page.click('#full').catch(() => {}); await page.waitForTimeout(800);
await page.click('[data-view="lineup"]'); await ready(4);
await page.waitForTimeout(1500); await shot('04_lineup');
await page.click('#panelToggle').catch(() => {}); await page.waitForTimeout(600); await shot('05_lineup_nopanel');
await clickTxt('#lineupMove button', 'Signature moves');
await page.waitForTimeout(300);
for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); await shot('06_lineup_moves_' + i); }
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
