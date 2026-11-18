// Match smoke test: plays real snaps (calling plays, snapping, throwing), then sims to the end, checks the league
// applied the result. Also runs a watch game for a few plays and an instant game. Screenshots in qa/shots/match.
// run: node tools/build.mjs && node qa/match_test.mjs [phone|desk]
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const shots = path.join(root, 'qa', 'shots', 'match'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const which = process.argv[2] || 'phone';
const browser = await chromium.launch({ executablePath: exe, args: process.env.SWGL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const [vw, vh] = which === 'phone' ? [390, 844] : [1280, 800];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: which === 'phone' ? 2 : 1, hasTouch: which === 'phone' });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(500);
await page.evaluate(() => { NG.slot = 1; NG.qlen = 60; createLeague(); pickTeam(L.teams[5].id); });
const G = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, ready: g.ready, q: g.q, clock: g.clock, down: g.down, yl: g.yl, poss: g.poss, user: g.user, score: g.score, side: g.userSide, phase: pl && pl.phase, sheet: !!document.querySelector('.sheet.show'), over: g.over, pat: !!g.pat, kick: !!g.kickCb, sim: g.sim }; });
let shotN = 0; const shot = async name => page.screenshot({ path: path.join(shots, `${which}_${String(shotN++).padStart(2, '0')}_${name}.png`) });
const t0 = Date.now();
await page.evaluate(() => startUserGame('play'));
for (let i = 0; i < 240; i++) { const g = await G(); if (g && g.ready) break; await page.waitForTimeout(500); }
console.log('models ready after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await shot('intro');
await page.click('#mKick');
let plays = 0, lastStage = '', stuck = 0, fpsDone = false; const seen = new Set();
while (plays < 14 && stuck < 120) {
  const g = await G(); if (!g) break; if (g.over) break;
  const key = g.stage + g.phase + g.down + g.yl; if (key === lastStage) stuck++; else stuck = 0; lastStage = key;
  if (g.stage === 'call' && g.sheet) {
    if (!seen.has('sheet' + g.side)) { seen.add('sheet' + g.side); await shot('sheet_' + (await page.evaluate(() => MATCH._G.sheet.side))); }
    const patBtn = await page.$('[data-act="xp"]'); if (patBtn) { await patBtn.click(); await page.waitForTimeout(300); continue; }
    // on 4th down punt or kick if offered
    const four = g.down === 4 && await page.$('[data-act="punt"]'); if (four) { await page.click('[data-act="punt"]'); await page.waitForTimeout(400); continue; }
    const cards = await page.$$('.sheet .pc'); if (cards.length) { await cards[plays % cards.length].click(); plays++; }
    await page.waitForTimeout(400); continue;
  }
  if (g.kick) { await shot('kickmeter'); await page.click('#mK'); await page.waitForTimeout(800); continue; }
  if (g.stage === 'pre' && g.phase === 'pre') {
    if (!seen.has('pre' + g.side)) { seen.add('pre' + g.side); await shot('presnap_' + g.side); }
    if (g.side === 'O') { const b = await page.$('[data-a="snap"]'); if (b) await b.click(); }
    await page.waitForTimeout(300); continue;
  }
  if (g.stage === 'live') {
    if (!fpsDone) { fpsDone = true; const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t) / 1000)); }; requestAnimationFrame(f); })); console.log('fps during a live play (swiftshader):', fps.toFixed(1)); }
    if (g.side === 'O' && await page.evaluate(() => MATCH._.ctl().ctx === 'qb')) { await page.waitForTimeout(900);     // throw the way a player does: drag back from mid-screen and let go
      if (await page.evaluate(() => MATCH._.ctl().ctx === 'qb')) { const cx = vw * 0.5, cy = vh * 0.42; await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 10, cy + vh * 0.16, { steps: 6 }); await page.waitForTimeout(120); await shot('qb_aim'); await page.mouse.up(); } }
    if (!seen.has('live' + plays % 3)) { seen.add('live' + plays % 3); await shot('live_' + plays); }
    await page.waitForTimeout(500); continue;
  }
  if (g.stage === 'dead' && !seen.has('dead')) { seen.add('dead'); await page.waitForTimeout(300); await shot('whistle'); }
  await page.waitForTimeout(400);
}
console.log('played', plays, 'calls; state', JSON.stringify(await G()));
// sim to the end from the pause menu
await page.click('.mbtn.pause'); await page.waitForTimeout(300); await shot('pause');
await page.click('[data-m="simg"]');
for (let i = 0; i < 400; i++) { const g = await G(); if (!g || g.stage === 'final') break; await page.waitForTimeout(500); }
await shot('final');
const fin = await G(); console.log('final', JSON.stringify(fin && fin.score));
await page.click('#mDone').catch(e => errs.push('no Continue button: ' + e.message));
await page.waitForTimeout(500);
const applied = await page.evaluate(() => { const g = L.sched[0].find(x => x.h === L.user || x.a === L.user); return { done: g.done, hs: g.hs, as: g.as, week: L.week, pbp: (L.lastGameInfo && 1) || 0 }; });
console.log('league after game', JSON.stringify(applied)); if (!applied.done) errs.push('result not applied to the league');
await shot('home_after');
// watch mode, a few plays
await page.evaluate(() => { closeModal(); startUserGame('watch'); });
for (let i = 0; i < 60; i++) { const g = await G(); if (g && g.ready && g.stage !== 'load') break; await page.waitForTimeout(500); }
await page.waitForTimeout(9000); await shot('watch');
const w = await G(); console.log('watch state', JSON.stringify(w));
page.on('dialog', d => d.accept());
await page.click('.mbtn.pause'); await page.click('[data-m="quit"]').catch(() => { });
await page.waitForTimeout(400);
// instant
const inst = await page.evaluate(() => { closeModal(); const wk = L.week; startUserGame('instant'); return { before: wk, after: L.week }; });
console.log('instant', JSON.stringify(inst));
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
