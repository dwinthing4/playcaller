// Landscape phone (844x390): call sheet layout and that every action button is inside the screen.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = path.join(root, 'qa', 'shots', 'land'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'), args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true })).newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(() => { NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[4].id); startUserGame('play'); });
for (let i = 0; i < 200; i++) { const r = await page.evaluate(() => MATCH._G && MATCH._G.ready); if (r) break; await page.waitForTimeout(150); }
await page.click('#mKick');
for (let i = 0; i < 300; i++) { const s = await page.evaluate(() => MATCH._G.stage === 'call' && !!document.querySelector('.sheet.show')); if (s) break; await page.waitForTimeout(150); }
await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'sheet.png') });
const r = await page.evaluate(() => [...document.querySelectorAll('.sheet .sh-acts button, .sheet .chips button')].map(b => { const q = b.getBoundingClientRect(); return { t: b.textContent.trim(), bottom: Math.round(q.bottom), right: Math.round(q.right) }; }));
const off = r.filter(x => x.bottom > 390 || x.right > 844); console.log('buttons', r.length, 'off-screen', JSON.stringify(off));
await page.click('.sheet .pc'); await page.waitForTimeout(600); await page.screenshot({ path: path.join(out, 'presnap.png') });
const scroll = await page.evaluate(() => document.getElementById('game').scrollTop); console.log('game scrollTop', scroll);
await browser.close(); console.log(errs.length ? errs.join('\n') : 'no errors');
