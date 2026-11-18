// Quick look at special teams: the opening kickoff return, a user field goal (triangle + needle), a punt return, and the rotated sideline view on a phone.
// run: node tools/build.mjs && node qa/st_look.mjs   (screenshots in qa/shots/st)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game', shots = path.join(root, 'qa', 'shots', 'st'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function session(name, vw, vh, touch, fn) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(500);
  await page.evaluate(() => { NG.slot = 1; NG.qlen = 60; createLeague(); pickTeam(L.teams[5].id); });
  await page.evaluate(() => startUserGame('play'));
  for (let i = 0; i < 240; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(500); }
  let n = 0; const shot = async t => page.screenshot({ path: path.join(shots, `${name}_${String(n++).padStart(2, '0')}_${t}.png`) });
  const G = () => page.evaluate(() => { const g = MATCH._G, pl = g && g.play; return g ? { stage: g.stage, ret: !!(pl && pl.ret), air: !!(pl && pl.air), phase: pl && pl.phase, type: pl && pl.result && pl.result.type, spot: pl && pl.result ? Math.round(pl.result.spotZ / 0.9144) : null, side: g.userSide, ctx: MATCH._.ctl().ctx, kaim: !!g.kaim, rot: document.getElementById('game').classList.contains('rot') } : null; });
  await fn(page, shot, G);
  console.log(name, errs.length ? 'ERRORS:\n  ' + errs.join('\n  ') : 'no console errors'); await ctx.close();
}
await session('desk', 1280, 800, false, async (page, shot, G) => {
  await page.click('#mKick').catch(() => { });
  // opening kickoff: if it is ours, both teams line up and the power bar waits for KICK
  await page.waitForTimeout(1800); { const g0 = await G(); console.log('before kick:', JSON.stringify(g0)); await shot('kick_lined_up'); if (await page.evaluate(() => !!MATCH._G.kpow)) { await page.waitForTimeout(500); await page.keyboard.press('Space'); } }
  for (let i = 0; i < 40; i++) { const g = await G(); if (g && g.ret) break; await page.waitForTimeout(250); }
  let g = await G(); console.log('kickoff return play:', JSON.stringify(g));
  await page.waitForTimeout(1500); await shot('kick_in_air');
  await page.waitForTimeout(2600); await shot('after_catch');
  for (let i = 0; i < 60; i++) { g = await G(); if (!g.ret || g.phase === 'dead') break; await page.waitForTimeout(250); }
  console.log('kickoff result:', JSON.stringify(g)); await page.waitForTimeout(600); await shot('return_result');
  // a user field goal from the 25 (42 yards)
  await page.waitForTimeout(1800);
  await page.evaluate(() => { const g = MATCH._G; g.poss = g.user; g.yl = 75; g.down = 4; g.togo = 5; g.timers = []; MATCH._.fieldGoal(g.user); });
  await page.waitForTimeout(700); g = await G(); console.log('fg aim:', JSON.stringify(g)); await shot('fg_aim'); await page.waitForTimeout(450); await shot('fg_aim2');
  await page.keyboard.press('Space'); await page.waitForTimeout(900); await shot('fg_flight'); await page.waitForTimeout(1800); await shot('fg_result');
  // a CPU punt to us: return play
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const g = MATCH._G; const cpu = g.user === g.hid ? g.aid : g.hid; g.poss = cpu; g.yl = 30; g.timers = []; MATCH._.punt(cpu); });
  for (let i = 0; i < 20; i++) { g = await G(); if (g && g.ret) break; await page.waitForTimeout(200); }
  console.log('punt return play:', JSON.stringify(g)); await page.waitForTimeout(2000); await shot('punt_air');
  for (let i = 0; i < 60; i++) { g = await G(); if (!g.ret || g.phase === 'dead') break; await page.waitForTimeout(250); }
  console.log('punt result:', JSON.stringify(g)); await shot('punt_result');
});
await session('phone', 390, 844, true, async (page, shot, G) => {
  await page.click('#mKick').catch(() => { }); await page.waitForTimeout(9000);
  for (let i = 0; i < 80; i++) { const g = await G(); if (g && g.stage === 'call') break; await page.waitForTimeout(400); } await shot('portrait_sheet');
  await page.evaluate(() => { const g = MATCH._G; const b = document.querySelector('.mbtn.camb'); b && b.click(); });
  await page.waitForTimeout(300); await page.evaluate(() => { const b = document.querySelector('[data-cv="side"]'); b && b.click(); }); await page.waitForTimeout(800);
  const g = await G(); console.log('phone side view rotated:', g && g.rot); await shot('side_rot');
});
await browser.close();
