// The broadcast graphics in each UI style (broadcast, program, varsity, night): a caption + drive summary over the field, and the stats viewer.
// run: node tools/build.mjs && node qa/bcast_styles.mjs [desk|phone]   (screenshots in qa/shots/bcast/styles_<size>)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const which = process.argv[2] || 'phone', out = path.join(root, 'qa', 'shots', 'bcast', 'styles_' + which); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
const wait = ms => page.waitForTimeout(ms);
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await wait(700);
await page.evaluate(() => { NG.slot = 6; NG.qlen = 60; createLeague(); pickTeam(L.teams[9].id); startUserGame('watch'); });
for (let i = 0; i < 300; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await wait(300); }
await page.click('#mKick').catch(() => { });
for (let i = 0; i < 120; i++) { if (await page.evaluate(() => { const G = MATCH._G; return G && G.bc && G.bc.plays.length >= 3 && G.stage === 'dead'; })) break; await wait(250); }
await page.evaluate(() => { MATCH._G.paused = true; });
for (const st of ['broadcast', 'program', 'varsity', 'night']) {
  await page.evaluate(st => { document.documentElement.dataset.style = st; const G = MATCH._G, B = BCAST._(); G.paused = false; G.speed = 0.0001;
    B.cap = null; B.lt = null; B.q2 = [{ who: 0, text: 'Bell finds Murphy over the middle for 14. And that is a first down.', pri: 2, at: B.t, exp: B.t + 60 }];
    B.ltq = [{ html: BCAST._drive(G, { tid: G.hid, start: 25, plays: 8, yds: 61, q: 1, result: 'Punt', top: 151 }), kind: 'drive', dur: 60, at: B.t, exp: B.t + 60 }]; }, st);
  await wait(900); await page.screenshot({ path: path.join(out, st + '_field.png') });
  await page.evaluate(() => BCAST.openView(MATCH._G, 'team')); await wait(400); await page.screenshot({ path: path.join(out, st + '_team.png') });
  await page.evaluate(() => BCAST.openView(MATCH._G, 'wp')); await wait(300); await page.screenshot({ path: path.join(out, st + '_wp.png') });
  await page.evaluate(() => BCAST.closeView());
}
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out); await browser.close();
