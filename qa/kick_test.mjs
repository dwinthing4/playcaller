// Special-teams visuals: force a field goal and a punt in a watch game and capture frames mid-flight.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = path.join(root, 'qa', 'shots', 'kick'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'), args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage(); page.setDefaultTimeout(120000); const errs = [];
page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(() => { NG.slot = 5; NG.qlen = 120; createLeague(); pickTeam(L.teams[2].id); startUserGame('watch'); });
for (let i = 0; i < 200; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage); if (s === 'pre' || s === 'live') break; await page.waitForTimeout(150); }
for (const [kind, yl] of [['fg', 72], ['punt', 30]]) {
  await page.evaluate(([k, yl]) => { const G = MATCH._G; G.timers = []; G.yl = yl; G.down = 4; if (k === 'fg') MATCH._.fieldGoal(G.poss); else MATCH._.punt(G.poss); }, [kind, yl]);
  for (const t of [150, 600, 1100, 1700]) { await page.waitForTimeout(t === 150 ? 150 : 500); await page.screenshot({ path: path.join(out, `${kind}_${t}.png`) }); }
  await page.waitForTimeout(2500);
  console.log(kind, JSON.stringify(await page.evaluate(() => ({ stage: MATCH._G.stage, anim: !!MATCH._G.kickAnim, poss: MATCH._G.poss, yl: Math.round(MATCH._G.yl), score: MATCH._G.score }))));
}
await browser.close(); console.log(errs.length ? errs.join('\n') : 'no errors');
