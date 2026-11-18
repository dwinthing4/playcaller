// Round-2 probe: in PLAY mode (user on offense), are the linemen in their stance pre-snap? Logs stK/pelvis height and
// takes a side close-up of the line at the user's pre-snap. run: node qa/visual2_stanceprobe.mjs
import { open, waitReady } from './visual2_lib.mjs';
const { page, shot, log, done } = await open('phone', 'stance_play');
await page.evaluate(() => { NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[7].id); startUserGame('play'); });
await waitReady(page); await page.click('#mKick'); await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; });
for (let i = 0; i < 100; i++) { const s = await page.evaluate(() => !!document.querySelector('.sheet.show')); if (s) break; await page.waitForTimeout(200); }
await page.waitForTimeout(400); await page.click('[data-f="run"]'); await page.waitForTimeout(200);
await (await page.$$('.sheet .plist .pc'))[0].tap(); await page.waitForTimeout(1200);
const probe = () => page.evaluate(() => { const pl = MATCH._G.play; return { stage: MATCH._G.stage, phase: pl.phase, line: pl.players.filter(p => p.ol || p.dl).map(p => ({ u: p.unit, pos: p.rp.pos, stance: !!p.stance, s3: !!p.stance3, stK: +(p.stK || 0).toFixed(2), pelvisY: +pl.poses[p.id].pelvis.y.toFixed(2), headY: +pl.poses[p.id].head.y.toFixed(2) })) }; });
log.push({ t: 'presnap+1.2s', ...(await probe()) });
await shot('presnap_game_cam');
await page.evaluate(() => { const pl = MATCH._G.play; R3D.camOverride = { pos: [pl.ballX + 7, 2.2, pl.losZ - 1], look: [pl.ballX, 0.8, pl.losZ + 0.5], fov: 42 }; });
await page.waitForTimeout(300); await shot('presnap_line_side');
await page.evaluate(() => { const pl = MATCH._G.play; R3D.camOverride = { pos: [pl.ballX + 2, 1.6, pl.losZ - 6], look: [pl.ballX, 0.7, pl.losZ], fov: 40 }; });
await page.waitForTimeout(300); await shot('presnap_line_behind');
await page.evaluate(() => { R3D.camOverride = null; });
await done();
