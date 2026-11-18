// Close-up shots of the line of scrimmage: pre-snap stances, blocks just after the snap, helmets. Uses R3D.camOverride.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = path.join(root, 'qa', 'shots', 'closeup'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'), args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(() => { NG.slot = 4; NG.qlen = 120; createLeague(); pickTeam(L.teams[2].id); startUserGame('watch'); });
for (let i = 0; i < 200; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage); if (s === 'pre') break; await page.waitForTimeout(150); }
const cam = (pos, look, fov) => page.evaluate(([p, l, f]) => { const pl = MATCH._G.play; const z = pl.losZ, x = pl.ballX; R3D.camOverride = { pos: [x + p[0], p[1], z + p[2]], look: [x + l[0], l[1], z + l[2]], fov: f }; }, [pos, look, fov]);
await page.evaluate(() => { MATCH._G.paused = false; });
await cam([7, 2.2, -1], [0, 0.8, 0.5], 42); await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, '01_line_side.png') });
await cam([0, 1.7, -7], [0, 0.9, 1], 38); await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, '02_line_behind.png') });
await cam([2.5, 1.9, 4.5], [0, 1.0, -1], 38); await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, '03_dline_front.png') });
// after the snap: blocks
for (let i = 0; i < 100; i++) { const ph = await page.evaluate(() => MATCH._G.play && MATCH._G.play.phase); if (ph === 'live') break; await page.waitForTimeout(40); }
await page.waitForTimeout(700); await page.evaluate(() => { MATCH._G.paused = true; });
await cam([7, 2.2, -1], [0, 0.9, 0], 40); await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, '04_blocks_side.png') });
await cam([1.5, 1.8, 3.5], [0, 1.0, -0.5], 34); await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, '05_blocks_front.png') });
// helmet close-up on the QB
await page.evaluate(() => { const pl = MATCH._G.play, J = pl.poses[pl.qb.id]; R3D.camOverride = { pos: [J.head.x + 0.9, J.head.y + 0.25, J.head.z + 1.4], look: [J.head.x, J.head.y, J.head.z], fov: 30 }; });
await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, '06_helmet.png') });
await browser.close(); console.log(errs.length ? errs.join('\n') : 'ok');
