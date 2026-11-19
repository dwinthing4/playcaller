// Visual round 3 capture: menus (title, hub, roster, player card) and the game (intro, pre-snap, player close-ups, stadium wide).
// run: node tools/build.mjs && node qa/vis3_cap.mjs [desk|phone] [tag]   (screenshots in qa/shots/vis3/<tag>_<size>)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/'), which = process.argv[2] || 'desk', tag = process.argv[3] || 'now', team = +(process.argv[4] || 7);
const out = path.join(root, 'qa', 'shots', 'vis3', tag + '_' + which); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let n = 0; const shot = async name => page.screenshot({ path: path.join(out, String(n++).padStart(2, '0') + '_' + name + '.png') });
await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(900);
await shot('title');
await page.evaluate(t => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[t].id); }, team); await page.waitForTimeout(600); await shot('home');
for (const t of ['roster', 'standings']) { await page.evaluate(t => { closeModal(); go(t); scrollTo(0, 0); }, t); await page.waitForTimeout(400); await shot('tab_' + t); }
await page.evaluate(() => { closeModal(); go('roster'); const r = document.querySelector('[onclick*="openPlayer"],[data-pid]'); if (r) r.click(); }); await page.waitForTimeout(700); await shot('player_card');
await page.evaluate(() => { closeModal(); go('home'); });
await page.evaluate(() => startUserGame('watch'));
for (let i = 0; i < 400; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(300); }
await page.waitForTimeout(500); await shot('intro');
await page.click('#mKick').catch(() => { });
for (let i = 0; i < 300; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage === 'pre' && MATCH._G.play && !MATCH._G.play.ret); if (s) break; await page.waitForTimeout(150); }
await page.waitForTimeout(1200); await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(300); await shot('presnap');
const cam = (pos, look, fov) => page.evaluate(([p, l, f]) => { const pl = MATCH._G.play; const z = pl.losZ, x = pl.ballX; R3D.camOverride = { pos: [x + p[0], p[1], z + p[2]], look: [x + l[0], l[1], z + l[2]], fov: f }; }, [pos, look, fov]);
const still = async name => { await page.evaluate(() => { MATCH._G.paused = false; }); await page.waitForTimeout(120); await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(250); await shot(name); };
await cam([6, 1.8, -2], [0, 1.0, 0.5], 36); await still('close_line');
await cam([1.6, 1.7, -3.2], [0, 1.2, 0], 30); await still('close_qb');
await cam([2.5, 1.9, 4.5], [0, 1.0, -1], 34); await still('close_dline');
await cam([-34, 22, -30], [0, 0, 18], 50); await still('stadium_wide');
await cam([0, 9, -38], [0, 2, 20], 55); await still('stadium_end');
await page.evaluate(() => { R3D.camOverride = null; MATCH._G.paused = false; }); await page.waitForTimeout(2600); await shot('live');
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out); await browser.close();
