// Quick look at the aim pan camera setting: aim a pass to one side and check the camera slides that way (phone and desktop).
// run: node tools/build.mjs && node qa/aimpan_look.mjs   (screenshots in qa/shots/aimpan)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game', shots = path.join(root, 'qa', 'shots', 'aimpan'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, vw, vh, mob] of [['phone', 390, 844, true], ['desk', 1280, 800, false]]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(500);
  await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 1; NG.qlen = 60; createLeague(); pickTeam(L.teams[5].id); startUserGame('play'); });
  for (let i = 0; i < 240; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(500); }
  await page.click('#mKick').catch(() => { });
  const st = () => page.evaluate(() => { const g = MATCH._G; return { stage: g.stage, sheet: g.sheet && g.sheet.side, kbar: !!(g.kpow || g.kaim), ctx: MATCH._.ctl().ctx }; });
  let done = 0;
  for (let i = 0; i < 500 && done < 2; i++) {
    const g = await st();
    if (g.kbar) { await page.evaluate(() => MATCH._G.kpow ? MATCH._G.kpow() : null); await page.waitForTimeout(400); continue; }
    if (g.stage === 'call' && g.sheet === 'O') { await page.evaluate(() => { const c = [...document.querySelectorAll('.sheet .pc[data-id]')].find(c => { const p = L.plays.find(x => x.id === c.dataset.id); return p && p.type === 'pass'; }); (c || document.querySelector('.sheet .pc[data-id]')).click(); }); await page.waitForTimeout(1200); continue; }
    if (g.stage === 'call') { await page.evaluate(() => { const b = document.querySelector('.sheet .pc[data-id]') || document.querySelector('[data-act="xp"]') || document.querySelector('[data-act="punt"]'); b && b.click(); }); await page.waitForTimeout(500); continue; }
    if (g.stage === 'pre' && g.ctx === 'preO') {
      if (done === 0) { await page.waitForTimeout(900); await page.screenshot({ path: path.join(shots, name + '_presnap.png') }); }
      await page.evaluate(() => MATCH._G.play.snap()); await page.waitForTimeout(700);
      if ((await st()).ctx !== 'qb') { await page.waitForTimeout(3000); continue; }
      const side = done === 0 ? 1 : -1, cx = vw / 2, cy = vh * 0.62;           // drag back and to the right = aim left (and the reverse)
      const cam0 = await page.evaluate(() => R3D._dbg().cam);
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let s = 1; s <= 10; s++) { await page.mouse.move(cx + side * 13 * s, cy + 9 * s); await page.waitForTimeout(30); }
      await page.waitForTimeout(1100);
      const cam1 = await page.evaluate(() => ({ cam: R3D._dbg().cam, aim: MATCH._G.play.aimAt && [+MATCH._G.play.aimAt.x.toFixed(1), +MATCH._G.play.aimAt.z.toFixed(1)], qb: [+MATCH._G.play.qb.p.x.toFixed(1), +MATCH._G.play.qb.p.z.toFixed(1)] }));
      await page.screenshot({ path: path.join(shots, name + '_aim_' + (side > 0 ? 'left' : 'right') + '.png') });
      console.log(name, side > 0 ? 'aim left ' : 'aim right', 'cam x before', cam0[0], 'after', cam1.cam[0], 'qb', cam1.qb, 'aim', cam1.aim);
      await page.mouse.up(); done++; await page.waitForTimeout(3500); continue;
    }
    await page.waitForTimeout(400);
  }
  console.log(name, errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors'); await ctx.close();
}
await browser.close();
