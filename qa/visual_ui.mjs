// Visual review: management screens + match intro + call sheets + landscape phone. run: node qa/visual_ui.mjs desk|phone|land
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game';
const which = process.argv[2] || 'desk';
const shots = path.join(root, 'qa', 'shots', 'visual', which + '_ui'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 3] : which === 'land' ? [844, 390, 3] : [1280, 800, 1];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1 });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('dialog', d => d.accept());
await page.goto('file:///' + root + '/dist/playcaller_qa.html'); await page.waitForTimeout(900);
let n = 0; const shot = async name => { await page.screenshot({ path: path.join(shots, `${String(n++).padStart(2, '0')}_${name}.png`) }); };
await shot('title');
await page.evaluate(() => { NG.slot = 5; NG.qlen = 120; createLeague(); pickTeam(L.teams[7].id); }); await page.waitForTimeout(400); await shot('home');
for (const t of ['roster', 'playbook', 'uniforms', 'standings']) { await page.evaluate(t => { closeModal(); go(t); scrollTo(0, 0); }, t); await page.waitForTimeout(300); await shot('tab_' + t); }
await page.evaluate(() => { closeModal(); go('home'); startUserGame('play'); });
for (let i = 0; i < 400; i++) { const r = await page.evaluate(() => MATCH._G && MATCH._G.ready); if (r) break; await page.waitForTimeout(400); }
await page.waitForTimeout(500); await shot('intro');
await page.click('#mKick'); await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; });
for (let i = 0; i < 80; i++) { const s = await page.evaluate(() => !!document.querySelector('.sheet.show')); if (s) break; await page.waitForTimeout(200); }
await page.waitForTimeout(500); await shot('sheet_O');
await page.click('[data-f="pass"]'); await page.waitForTimeout(250); await shot('sheet_O_pass');
const cards = await page.$$('.sheet .plist .pc'); await cards[1].click();
await page.waitForTimeout(700); await shot('presnap_O');
await page.click('[data-a="snap"]').catch(() => page.evaluate(() => document.querySelector('[data-a="snap"]').click()));
for (let i = 0; i < 60; i++) { const s = await page.evaluate(() => MATCH._G.stage === 'live' && MATCH._G.play.liveT > 1.3); if (s) break; await page.waitForTimeout(60); }
await shot('live_bubbles');
await page.evaluate(() => { const b = document.querySelector('.rb.on'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
for (let i = 0; i < 8; i++) { await page.waitForTimeout(220); await shot('live_' + i); }
for (let i = 0; i < 120; i++) { const s = await page.evaluate(() => MATCH._G.stage); if (s !== 'live') break; await page.waitForTimeout(100); }
await page.waitForTimeout(250); await shot('whistle');
await page.evaluate(() => document.querySelector('.mbtn.pause').click()); await page.waitForTimeout(400); await shot('pause');
await page.click('[data-m="simg"]');
for (let i = 0; i < 600; i++) { const g = await page.evaluate(() => MATCH._G && MATCH._G.stage); if (!g || g === 'final') break; await page.waitForTimeout(500); }
await page.waitForTimeout(700); await shot('final');
const st = await page.evaluate(() => R3D.stats()); console.log('R3D', JSON.stringify(st));
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
