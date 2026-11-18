// Round-2 special teams: force FG (good + forced miss), punt and XP in a watch game; real-time screencast of each kick
// plus screenshots at fixed times. run: node qa/visual2_kick.mjs phone|desk|land
import { open, waitReady } from './visual2_lib.mjs';
import fs from 'fs'; import path from 'path';
const which = process.argv[2] || 'phone';
const { page, ctx, shot, log, done, shots, dpr, vw, vh } = await open(which, 'kick_' + which);
const cdp = await ctx.newCDPSession(page); let rec = null, fr = 0;
cdp.on('Page.screencastFrame', async ev => { if (rec) { fs.writeFileSync(path.join(shots, `${rec}_${String(fr++).padStart(3, '0')}.jpg`), Buffer.from(ev.data, 'base64')); log.push({ tag: rec, fr: fr - 1, t: ev.metadata.timestamp }); } cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {}); });
const startRec = async tag => { rec = tag; fr = 0; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: vw * Math.min(dpr, 1.5), maxHeight: vh * Math.min(dpr, 1.5), everyNthFrame: 1 }); };
const stopRec = async () => { await cdp.send('Page.stopScreencast'); rec = null; };
await page.evaluate(() => { NG.slot = 5; NG.qlen = 120; createLeague(); pickTeam(L.teams[2].id); startUserGame('watch'); });
await waitReady(page);
for (let i = 0; i < 300; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage); if (s === 'pre') break; await page.waitForTimeout(150); }
await page.waitForTimeout(600); await shot('watch_pre_ref');
// make the miss deterministic for one FG by swapping the RNG roll via quality (watch: quality null -> uses fg.p); force with yl
for (const [kind, yl] of [['fg', 72], ['punt', 32], ['fgLong', 52], ['xp', 0]]) {
  for (let i = 0; i < 200; i++) { const s = await page.evaluate(() => MATCH._G.stage); if (s === 'pre' || s === 'call') break; await page.waitForTimeout(100); }
  await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(100);
  await page.evaluate(([k, yl]) => { const G = MATCH._G; G.timers = []; G.paused = false; if (k !== 'xp') { G.yl = yl; G.down = 4; } if (k === 'fg' || k === 'fgLong') MATCH._.fieldGoal(G.poss); else if (k === 'punt') MATCH._.punt(G.poss); else MATCH._.kickXP(G.poss); }, [kind, yl]);
  await startRec(kind); const t0 = Date.now(); let k = 0; const marks = [80, 300, 600, 900, 1300, 1800, 2400, 3200, 4200];
  while (Date.now() - t0 < 6500) { const el = Date.now() - t0; if (k < marks.length && el >= marks[k]) { await shot(`${kind}_${marks[k]}ms`, { st: await page.evaluate(() => ({ stage: MATCH._G.stage, anim: !!MATCH._G.kickAnim, t: MATCH._G.kickAnim && +MATCH._G.kickAnim.t.toFixed(2), dur: MATCH._G.kickAnim && MATCH._G.kickAnim.dur, ban: document.querySelector('.ban.show') && document.querySelector('.ban').innerText })) }); k++; } await page.waitForTimeout(20); }
  await stopRec();
  log.push({ kind, after: await page.evaluate(() => ({ stage: MATCH._G.stage, poss: MATCH._G.poss, yl: Math.round(MATCH._G.yl), score: MATCH._G.score })) });
}
await done();
