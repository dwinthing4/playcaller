// Real-time capture (no pausing): CDP screencast frames while plays run at normal speed, so camera motion, receiver
// bubbles, action buttons and banners are exactly what a player sees. Taps bubbles with the touchscreen.
// run: node qa/visual_rt.mjs phone|desk
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game';
const which = process.argv[2] || 'phone';
const shots = path.join(root, 'qa', 'shots', 'visual', which + '_rt'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 3] : [1280, 800, 1];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1 });
const page = await ctx.newPage(); const errs = []; const log = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
await page.goto('file:///' + root + '/dist/playcaller_qa.html'); await page.waitForTimeout(900);
let n = 0; const shot = async name => { const f = `${String(n++).padStart(3, '0')}_${name}.png`; await page.screenshot({ path: path.join(shots, f) }); return f; };
const cdp = await ctx.newCDPSession(page); let rec = null, fr = 0;
cdp.on('Page.screencastFrame', async ev => { if (rec) { const t = ev.metadata.timestamp; const st = rec.last; fs.writeFileSync(path.join(shots, `${rec.tag}_${String(fr++).padStart(3, '0')}.jpg`), Buffer.from(ev.data, 'base64')); log.push({ tag: rec.tag, fr: fr - 1, t, st }); } cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {}); });
const startRec = async tag => { rec = { tag, last: null }; fr = 0; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: which === 'phone' ? 585 : 1280, maxHeight: which === 'phone' ? 1266 : 800, everyNthFrame: 1 }); };
const stopRec = async () => { await cdp.send('Page.stopScreencast'); rec = null; };
const G = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, ready: g.ready, side: g.userSide, phase: pl && pl.phase, liveT: pl && pl.liveT, sheet: !!document.querySelector('.sheet.show'), sheetSide: g.sheet && g.sheet.side, kick: !!g.kickCb, over: g.over, ban: !!document.querySelector('.ban.show'), thrown: pl && !!pl.thrown, qbCar: pl && pl.carrier === pl.qb, pass: pl && !!pl.pass }; });
await page.evaluate(() => { NG.slot = 4; NG.qlen = 120; createLeague(); pickTeam(L.teams[12].id); startUserGame('play'); });
for (let i = 0; i < 400; i++) { const g = await G(); if (g && g.ready) break; await page.waitForTimeout(400); }
await page.click('#mKick'); await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; });
const PLAN = ['pass', 'run', 'pass', 'D', 'pass'];
let k = 0, stuck = 0, last = '';
while (k < PLAN.length && stuck < 200) {
  const g = await G(); if (!g || g.over) break;
  const key = g.stage + g.phase + g.sheet; if (key === last) stuck++; else stuck = 0; last = key;
  if (g.kick) { await page.click('#mK'); await page.waitForTimeout(400); continue; }
  if (g.stage === 'call' && g.sheet) {
    if (g.sheetSide === 'PAT') { await page.click('[data-act="xp"]'); await page.waitForTimeout(300); continue; }
    if (g.sheetSide === 'O') {
      const want = PLAN[k] === 'D' ? 'run' : PLAN[k];
      await page.click(`[data-f="${want}"]`); await page.waitForTimeout(200);
      const cards = await page.$$('.sheet .plist .pc'); await cards[(k * 2) % cards.length].tap();
    } else { const cards = await page.$$('.sheet .pc'); await cards[k % cards.length].tap(); }
    await page.waitForTimeout(300); continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre') {
    const tag = `p${k}_${g.side}`; await page.waitForTimeout(400); await shot(tag + '_presnap');
    if (g.side === 'O') { const hit = await page.evaluate(() => { const b = document.querySelector('[data-a="snap"]'); if (!b) return null; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const p = document.querySelector('.mbtn.pause').getBoundingClientRect(); const e2 = document.elementFromPoint(p.x + p.width / 2, p.y + p.height / 2); return { snapTop: e && (e.dataset.a || e.className), pauseTop: e2 && e2.className }; }); log.push({ tag, hit }); }
    await startRec(tag);
    if (g.side === 'O') { const b = await page.$('[data-a="snap"]'); if (b) await b.tap(); }
    let bubShot = false, t0 = Date.now(), deadAt = 0;
    while (Date.now() - t0 < 16000) {
      const h = await G(); if (!h) break;
      if (h.stage === 'live' && h.pass && h.qbCar && !h.thrown && h.side === 'O' && h.liveT > 1.3 && !bubShot) {
        bubShot = true; await shot(tag + '_bubbles_live');
        const bb = await page.evaluate(() => [...document.querySelectorAll('.rb.on')].map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.r, x: r.x + r.width / 2, y: r.y + r.height / 2, cls: b.className, top: (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) || {}).className }; }));
        log.push({ tag, bubbles: bb });
        const pick = bb.find(b => !/\br\b|\by\b/.test(b.cls)) || bb.find(b => !/\br\b/.test(b.cls)) || bb[0];
        if (pick) { if (which === 'phone') await page.touchscreen.tap(pick.x, pick.y); else await page.mouse.click(pick.x, pick.y); log.push({ tag, tapped: pick.id }); }
        await page.waitForTimeout(250); await shot(tag + '_after_tap');
      }
      if (h.stage === 'live' && h.side === 'O' && !h.pass && h.liveT > 1.0 && !bubShot) { bubShot = true; await shot(tag + '_runner_buttons'); }
      if (h.stage !== 'live' && h.stage !== 'pre' && !deadAt) deadAt = Date.now();
      if (deadAt && Date.now() - deadAt > 2200) break;
      await page.waitForTimeout(60);
    }
    await stopRec(); await shot(tag + '_end'); k++;
    continue;
  }
  await page.waitForTimeout(150);
}
// pause menu (JS click: the touch layer may cover the button), then sim to the end and the box score
await page.evaluate(() => document.querySelector('.mbtn.pause').click()); await page.waitForTimeout(400); await shot('pause');
await page.click('[data-m="simg"]');
for (let i = 0; i < 600; i++) { const g = await G(); if (!g || g.stage === 'final') break; if (i === 3) await shot('simcard'); await page.waitForTimeout(500); }
await page.waitForTimeout(700); await shot('final');
const sc = await page.evaluate(() => { const c = document.querySelector('.ovl .card'); if (!c) return null; const r = { sh: c.scrollHeight, ch: c.clientHeight }; c.scrollTop = 9999; return r; }); log.push({ finalCard: sc });
await page.waitForTimeout(150); await shot('final_scrolled');
fs.writeFileSync(path.join(shots, 'log.json'), JSON.stringify(log, null, 1));
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
