// Round-2 real-time capture (no pausing): CDP screencast while plays run at normal speed in PLAY mode. Real touch taps on
// the snap button, receiver bubbles and pause. Forces a punt and a user field goal to film the kick visuals live, and
// plays two defensive snaps (camera behind the defense). run: node qa/visual2_rt.mjs phone|desk|land
import { open, waitReady } from './visual2_lib.mjs';
import fs from 'fs'; import path from 'path';
const which = process.argv[2] || 'phone';
const { page, ctx, shot, log, done, shots, dpr, vw, vh } = await open(which, 'rt_' + which);
const touch = dpr > 1;
const cdp = await ctx.newCDPSession(page); let rec = null, fr = 0;
cdp.on('Page.screencastFrame', async ev => { if (rec) { fs.writeFileSync(path.join(shots, `${rec.tag}_${String(fr++).padStart(3, '0')}.jpg`), Buffer.from(ev.data, 'base64')); log.push({ tag: rec.tag, fr: fr - 1, t: ev.metadata.timestamp }); } cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {}); });
const startRec = async tag => { rec = { tag }; fr = 0; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 72, maxWidth: vw * Math.min(dpr, 1.5), maxHeight: vh * Math.min(dpr, 1.5), everyNthFrame: 1 }); };
const stopRec = async () => { await cdp.send('Page.stopScreencast'); rec = null; };
const tapXY = async (x, y) => { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
const tapEl = async sel => { const r = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel); if (!r) return false; await tapXY(r.x, r.y); return true; };
const G = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, ready: g.ready, side: g.userSide, poss: g.poss, user: g.user, phase: pl && pl.phase, liveT: pl && pl.liveT, sheet: !!document.querySelector('.sheet.show'), sheetSide: g.sheet && g.sheet.side, kick: !!g.kickCb, kickAnim: !!g.kickAnim, over: g.over, ban: !!document.querySelector('.ban.show'), thrown: pl && !!pl.thrown, qbCar: pl && pl.carrier === pl.qb, pass: pl && !!pl.pass, yl: g.yl }; });
const bubs = () => page.evaluate(() => [...document.querySelectorAll('.rb.on')].map(b => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { id: b.dataset.r, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: b.className, top: t ? (b.contains(t) ? 'SELF' : String(t.className).slice(0, 30)) : null }; }));
const overlap = bb => { let worst = 0; for (let i = 0; i < bb.length; i++) for (let j = i + 1; j < bb.length; j++) { const a = bb[i], b = bb[j]; const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ox > 0 && oy > 0) worst = Math.max(worst, ox * oy / Math.min(a.w * a.h, b.w * b.h)); } return +worst.toFixed(2); };
await page.evaluate(() => { NG.slot = 4; NG.qlen = 120; createLeague(); pickTeam(L.teams[12].id); startUserGame('play'); });
await waitReady(page); await shot('intro');
await page.click('#mKick'); await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; });
const OPLAN = ['pass', 'run', 'pass', 'punt', 'fg', 'pass', 'run'];
let oi = 0, di = 0, stuck = 0, last = '', total = 0;
const t00 = Date.now();
while (total < 9 && stuck < 250 && Date.now() - t00 < 420000) {
  const g = await G(); if (!g || g.over) break;
  const key = g.stage + g.phase + g.sheet + g.kick; if (key === last) stuck++; else stuck = 0; last = key;
  if (g.kick) { await shot('kickmeter'); await page.waitForTimeout(350); await tapEl('#mK'); await page.waitForTimeout(100); continue; }
  if (g.stage === 'call' && g.sheet) {
    if (g.sheetSide === 'PAT') { await shot('sheet_PAT'); await tapEl('[data-act="xp"]'); await startRec('xp'); const t0 = Date.now(); while (Date.now() - t0 < 6000) { const h = await G(); if (h.sheet || (h.stage === 'pre')) break; await page.waitForTimeout(80); } await stopRec(); continue; }
    if (g.sheetSide === 'O') {
      const want = OPLAN[oi % OPLAN.length];
      if (want === 'punt' || want === 'fg') {
        if (want === 'fg') await page.evaluate(() => { const g = MATCH._G; g.yl = 68; g.down = 4; g.togo = 6; });
        else await page.evaluate(() => { const g = MATCH._G; g.yl = 35; g.down = 4; g.togo = 8; });
        await page.click('[data-f="all"]'); await page.waitForTimeout(150);
        // re-render the sheet so the FG/punt button reflects the forced spot
        await page.evaluate(() => { const b = document.querySelector('[data-f="coach"]'); if (b) b.click(); }); await page.waitForTimeout(250); await shot('sheet_' + want);
        const ok = await tapEl(`[data-act="${want}"]`); log.push({ want, ok });
        if (!ok) await page.evaluate(w => w === 'fg' ? MATCH._.fieldGoal(MATCH._G.poss) : MATCH._.punt(MATCH._G.poss), want);
        oi++; total++;
        await startRec('k' + total + '_' + want); const t0 = Date.now(); let metered = false;
        while (Date.now() - t0 < 12000) { const h = await G(); if (h.kick && !metered) { metered = true; await stopRec(); await shot(want + '_meter'); await page.waitForTimeout(400); await tapEl('#mK'); await startRec('k' + total + '_' + want + '_fly'); continue; } if (h.sheet || h.stage === 'pre' || h.stage === 'live') break; await page.waitForTimeout(60); }
        await stopRec(); await shot(`k${total}_${want}_end`); continue;
      }
      await page.click(`[data-f="${want}"]`); await page.waitForTimeout(200);
      const cards = await page.$$('.sheet .plist .pc'); if (touch) await cards[(oi * 2) % cards.length].tap(); else await cards[(oi * 2) % cards.length].click(); oi++;
    } else { const cards = await page.$$('.sheet .pc'); if (touch) await cards[di % cards.length].tap(); else await cards[di % cards.length].click(); di++; }
    await page.waitForTimeout(300); continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre') {
    total++; const tag = `p${total}_${g.side}`; await page.waitForTimeout(500); await shot(tag + '_presnap');
    log.push({ tag, csayPre: await page.evaluate(() => { const c = document.querySelector('#hud .csay'); const b = c.getBoundingClientRect(); return { show: c.classList.contains('show'), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; }) });
    await startRec(tag);
    if (g.side === 'O') await tapEl('[data-a="snap"]');
    let bubShot = false, t0 = Date.now(), deadAt = 0, ovMax = 0, ovN = 0, minGap = 999, lastB = 0, csayLive = null;
    while (Date.now() - t0 < 16000) {
      const h = await G(); if (!h) break;
      if (h.stage === 'live' && csayLive == null) csayLive = await page.evaluate(() => getComputedStyle(document.querySelector('#hud .csay')).opacity);
      if (h.stage === 'live' && h.side === 'O' && h.pass && !h.thrown && Date.now() - lastB > 120) { lastB = Date.now(); const bb = await bubs(); const ov = overlap(bb); ovMax = Math.max(ovMax, ov); ovN++; }
      if (h.stage === 'live' && h.pass && h.qbCar && !h.thrown && h.side === 'O' && h.liveT > 1.3 && !bubShot) {
        bubShot = true; await shot(tag + '_bubbles_live'); const bb = await bubs(); log.push({ tag, bubbles: bb, overlap: overlap(bb) });
        const pk = bb.find(b => !/\br\b|\by\b/.test(b.cls)) || bb.find(b => !/\br\b/.test(b.cls)) || bb[0];
        if (pk) { await tapXY(pk.x + pk.w / 2, pk.y + pk.h / 2); log.push({ tag, tapped: pk.id }); }
        await page.waitForTimeout(200); log.push({ tag, thrownAfterTap: (await G()).thrown }); await shot(tag + '_after_tap');
      }
      if (h.stage === 'live' && h.side === 'O' && !h.pass && h.liveT > 1.0 && !bubShot) { bubShot = true; await shot(tag + '_runner_buttons'); }
      if (h.stage === 'live' && h.side === 'D' && h.liveT > 1.2 && !bubShot) { bubShot = true; await shot(tag + '_D_live'); }
      if (h.stage !== 'live' && h.stage !== 'pre' && !deadAt) deadAt = Date.now();
      if (deadAt && Date.now() - deadAt > 2400) break;
      await page.waitForTimeout(50);
    }
    await stopRec(); log.push({ tag, ovMax, ovN, csayLive }); await shot(tag + '_end');
    continue;
  }
  await page.waitForTimeout(120);
}
log.push({ pauseHit: await page.evaluate(() => { const b = document.querySelector('.mbtn.pause').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e ? String(e.className) : null; }) });
await tapEl('.mbtn.pause'); await page.waitForTimeout(400); await shot('pause');
log.push({ pauseOpen: await page.evaluate(() => !!document.querySelector('.ovl.show [data-m="simg"]')) });
await done();
