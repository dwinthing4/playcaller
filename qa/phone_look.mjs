// Quick look at phone mode: narrower field, buttons on the left, no fixed stick. Compares a phone game to a desktop game.
// run: node tools/build.mjs && node qa/phone_look.mjs   (screenshots in qa/shots/phone)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game', shots = path.join(root, 'qa', 'shots', 'phone'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, vw, vh, mob] of [['phone', 390, 844, true], ['desk', 1280, 800, false]]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(500);
  await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 1; NG.qlen = 60; createLeague(); pickTeam(L.teams[5].id); startUserGame('play'); });
  for (let i = 0; i < 240; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(500); }
  console.log(name, 'phone mode', await page.evaluate(() => MATCH._G.phone), 'field half width m', await page.evaluate(() => PHYS.FIELD.halfW.toFixed(1)));
  await page.click('#mKick').catch(() => { });
  const st = () => page.evaluate(() => { const g = MATCH._G; return { stage: g.stage, sheet: g.sheet && g.sheet.side, kbar: !!(g.kpow || g.kaim), ret: !!(g.play && g.play.ret), ctx: MATCH._.ctl().ctx }; });
  let shotPre = false, shotRun = false;
  for (let i = 0; i < 200 && !(shotPre && shotRun); i++) {
    const g = await st();
    if (g.kbar) { await page.evaluate(() => MATCH._G.kpow ? MATCH._G.kpow() : null); await page.waitForTimeout(400); continue; }
    if (g.stage === 'call' && g.sheet === 'O') { await page.evaluate(t => { const c = [...document.querySelectorAll('.sheet .pc[data-id]')].find(c => { const p = L.plays.find(x => x.id === c.dataset.id); return p && p.type === t; }); (c || document.querySelector('.sheet .pc[data-id]')).click(); }, shotPre ? 'run' : 'pass'); await page.waitForTimeout(1200); continue; }
    if (g.stage === 'call') { await page.evaluate(() => { const b = document.querySelector('.sheet .pc[data-id]') || document.querySelector('[data-act="xp"]') || document.querySelector('[data-act="punt"]'); b && b.click(); }); await page.waitForTimeout(500); continue; }
    if (g.stage === 'pre' && g.ctx === 'preO' && !shotPre) { await page.waitForTimeout(900); await page.screenshot({ path: path.join(shots, name + '_presnap.png') }); shotPre = true; await page.evaluate(() => MATCH._G.play.snap()); await page.waitForTimeout(3500); continue; }
    if (g.stage === 'pre' && g.ctx === 'preO' && shotPre) { await page.evaluate(() => MATCH._G.play.snap()); await page.waitForTimeout(900); const c2 = await st(); if (c2.ctx === 'run' || c2.ctx === 'qb') { await page.screenshot({ path: path.join(shots, name + '_live_' + c2.ctx + '.png') }); shotRun = c2.ctx === 'run'; } await page.waitForTimeout(3000); continue; }
    await page.waitForTimeout(400);
  }
  console.log(name, errs.length ? 'ERRORS ' + errs.join(' | ') : 'no console errors'); await ctx.close();
}
await browser.close();
