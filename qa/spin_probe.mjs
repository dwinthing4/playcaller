// What is under the run-move buttons during a user-controlled run, and does a real tap register?
import { chromium } from 'playwright-core';
import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const browser = await chromium.launch({ executablePath: path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'), args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(() => { NG.slot = 7; NG.qlen = 120; createLeague(); pickTeam(L.teams[4].id); startUserGame('play'); });
for (let i = 0; i < 200; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(150); }
await page.click('#mKick');
for (let tries = 0; tries < 12; tries++) {
  for (let i = 0; i < 400; i++) { if (await page.evaluate(() => MATCH._G.stage === 'call' && MATCH._G.sheet && MATCH._G.sheet.side === 'O')) break; if (await page.evaluate(() => MATCH._G.stage === 'call' && MATCH._G.sheet && MATCH._G.sheet.side !== 'O')) { await page.click('.sheet .pc'); } await page.waitForTimeout(150); }
  await page.click('.sheet [data-f="run"]'); await page.waitForTimeout(200); await page.click('.sheet .plist .pc'); await page.waitForTimeout(500);
  await page.click('[data-a="snap"]').catch(() => { });
  let ok = false; for (let i = 0; i < 120; i++) { if (await page.evaluate(() => !!document.querySelector('.acts [data-a="spin"]'))) { ok = true; break; } await page.waitForTimeout(25); }
  if (!ok) { await page.waitForTimeout(3000); continue; }
  const info = await page.evaluate(() => { const b = document.querySelector('.acts [data-a="spin"]').getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, el = document.elementFromPoint(x, y); return { x, y, under: el && (el.className || el.tagName), touched: MATCH._G.play.userTouched }; });
  console.log('under spin button:', JSON.stringify(info));
  await page.touchscreen.tap(info.x, info.y); await page.waitForTimeout(30);
  console.log('after tap:', JSON.stringify(await page.evaluate(() => { const c = MATCH._G.play.carrier; return { touched: MATCH._G.play.userTouched, spinT: c && c.spinT, inpSpin: MATCH._G.play.input.spin }; })));
  break;
}
await browser.close();
