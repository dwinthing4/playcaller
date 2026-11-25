// quick look: the play-call sheet and a watch-mode snap (layout reference for the broadcast graphics)
// run: node qa/peek_sheet.mjs [desk|phone]
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const which = process.argv[2] || 'desk', out = path.join(root, 'qa', 'shots', 'bcast'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 }); const page = await ctx.newPage();
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(700);
await page.evaluate(() => { NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[5].id); startUserGame('play'); });
for (let i = 0; i < 300; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(300); }
await page.click('#mKick').catch(() => { });
for (let i = 0; i < 200; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.stage === 'call' && MATCH._G.sheet)) break; await page.keyboard.press('Space'); await page.waitForTimeout(300); }
await page.waitForTimeout(800); await page.screenshot({ path: path.join(out, `peek_${which}_sheet.png`) });
await browser.close();
