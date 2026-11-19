// Venue look capture: one home game in a chosen (or the team's own) ground, shot from the game camera and a few stadium angles.
// run: node tools/build.mjs && node qa/venue_cap.mjs [desk|phone] [tag] [teamIndex] ['{"stadium":"dome","tod":"dusk"}']
//   the JSON is R3D.venueOverride (any key of R3D.VENUE_OPTS, plus tod / weather); screenshots go to qa/shots/venue/<tag>_<size>
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/');
const which = process.argv[2] || 'desk', tag = process.argv[3] || 'now', team = +(process.argv[4] || 7), ov = process.argv[5] ? JSON.parse(process.argv[5]) : null;
const out = path.join(root, 'qa', 'shots', 'venue', tag + '_' + which); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let n = 0; const shot = async name => page.screenshot({ path: path.join(out, String(n++).padStart(2, '0') + '_' + name + '.png') });
await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(700);
const info = await page.evaluate(([t, ov]) => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[t].id);
  // make the user's next game a home game so the ground is his own
  const g = LG.currentUserGame && LG.currentUserGame(); if (g && g.h !== L.user) { const h = g.h; g.h = g.a; g.a = h; }
  R3D.venueOverride = ov; const T = L.teams[L.user]; return { team: T.city + ' ' + T.name, abbr: T.abbr }; }, [team, ov]);
await page.evaluate(() => startUserGame('watch'));
for (let i = 0; i < 400; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(300); }
const v = await page.evaluate(() => R3D.venueInfo && R3D.venueInfo());
await page.click('#mKick').catch(() => { });
for (let i = 0; i < 300; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage === 'pre' && MATCH._G.play && !MATCH._G.play.ret); if (s) break; await page.waitForTimeout(150); }
await page.waitForTimeout(1200); await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(300); await shot('presnap');
const cam = (pos, look, fov, abs) => page.evaluate(([p, l, f, abs]) => { const pl = MATCH._G.play; const z = abs ? 0 : pl.losZ, x = abs ? 0 : pl.ballX; R3D.camOverride = { pos: [x + p[0], p[1], z + p[2]], look: [x + l[0], l[1], z + l[2]], fov: f }; }, [pos, look, fov, abs]);
const still = async name => { await page.evaluate(() => { MATCH._G.paused = false; }); await page.waitForTimeout(120); await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(300); await shot(name); };
await cam([-34, 22, -30], [0, 0, 18], 50); await still('stadium_wide');
await cam([0, 9, -38], [0, 2, 20], 55); await still('stadium_end');
await cam([30, 14, 46], [-20, 8, 46], 60, true); await still('sideline_far');
await cam([2, 1.7, -7], [0, 1.0, 2], 40); await still('ground_close');
await page.evaluate(() => { R3D.camOverride = null; MATCH._G.paused = false; }); await page.waitForTimeout(2600); await shot('live');
// the game's own camera at its extremes (it can back out beyond the stands: they must cut away, not fill the screen)
await page.evaluate(() => { Object.assign(R3D.cam, { view: 'side', zoom: 0.02, height: 0.12 }); R3D.snapNext = true; }); await page.waitForTimeout(1500); await shot('cam_side_far');
await page.evaluate(() => { Object.assign(R3D.cam, { view: 'behind', zoom: 0, height: 0 }); R3D.snapNext = true; }); await page.waitForTimeout(1500); await shot('cam_behind_low_far');
const st = await page.evaluate(() => R3D.stats());
console.log(JSON.stringify({ info, venue: v, stats: st }));
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out); await browser.close();
