// Visual review capture, PLAY mode: title + management screens, intro, sheets, pre-snap, live bursts (physics stepped
// in exact 80 ms chunks, rendered by the game's own rAF loop), receiver bubbles, banners, kick meter, pause, final.
// run: node qa/visual_play.mjs phone|desk
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game';
const which = process.argv[2] || 'phone';
const shots = path.join(root, 'qa', 'shots', 'visual', which + '_playO'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 3] : [1280, 800, 1];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1 });
const page = await ctx.newPage(); const errs = []; const log = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
await page.goto('file:///' + root + '/dist/playcaller_qa.html'); await page.waitForTimeout(900);
let n = 0; const shot = async (name, extra) => { const f = `${String(n++).padStart(3, '0')}_${name}.png`; await page.screenshot({ path: path.join(shots, f) }); const st = await page.evaluate(() => { const g = window.MATCH && MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, phase: pl && pl.phase, t: pl && +pl.t.toFixed(3), ball: pl && pl.ball && pl.ball.state, car: pl && pl.carrier && pl.carrier.slot, down: pl ? pl.players.filter(p => !p.upright()).length : 0, wrapped: pl ? pl.players.filter(p => p.wrapped).length : 0, score: g.score, yl: g.yl }; }).catch(() => null); log.push({ f, ...st, ...(extra || {}) }); return f; };
const raf2 = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate(() => { NG.slot = 3; NG.qlen = 120; createLeague(); pickTeam(L.teams[5].id); }); await page.waitForTimeout(300);
// ---------- match
const G = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, ready: g.ready, down: g.down, yl: g.yl, side: g.userSide, phase: pl && pl.phase, sheet: !!document.querySelector('.sheet.show'), sheetSide: g.sheet && g.sheet.side, over: g.over, kick: !!g.kickCb, sim: g.sim, ban: !!document.querySelector('.ban.show'), score: g.score }; });
const t0 = Date.now();
await page.evaluate(() => startUserGame('play'));
await page.waitForTimeout(1200); await shot('match_loading');
for (let i = 0; i < 400; i++) { const g = await G(); if (g && g.ready) break; await page.waitForTimeout(500); }
console.log('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.waitForTimeout(400); await shot('match_intro');
await page.click('#mKick'); await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; }); await page.waitForTimeout(450); await shot('banner_kickoff');
// advance the paused physics by ms, letting the game's rAF loop render each 1/60 s slice
await page.evaluate(() => { window.__adv = ms => new Promise(res => { let left = ms / 1000; const f = () => { const g = MATCH._G, pl = g && g.play; if (!pl) return res(); const d = Math.min(left, 1 / 60), k = Math.round(d / PHYS.DT); for (let i = 0; i < k; i++) pl.step(PHYS.DT); left -= d; if (left > 1e-6) requestAnimationFrame(f); else requestAnimationFrame(() => requestAnimationFrame(res)); }; requestAnimationFrame(f); }); });
const st = () => page.evaluate(() => { const g = MATCH._G, pl = g.play; if (!pl) return {}; return { phase: pl.phase, t: pl.t, liveT: pl.liveT, deadT: pl.deadT, ball: pl.ball.state, car: pl.carrier && pl.carrier.slot, carUp: pl.carrier ? pl.carrier.upright() : true, wrapped: pl.players.filter(p => p.wrapped).length, down: pl.players.filter(p => !p.upright()).length, thrown: !!pl.thrown, pass: !!pl.pass, qbCar: pl.carrier === pl.qb, result: pl.result && pl.result.type }; });
// adaptive burst: dense 80 ms frames in interesting windows, sparse otherwise
async function livePlay(tag, opts = {}) {
  await page.evaluate(() => { MATCH._G.paused = true; });
  let k = 0, s = await st(), thrownAt = -1, contactAt = -1, deadAt = -1, bubbled = false, sparse = 0;
  for (let i = 0; i < 160; i++) {
    s = await st();
    const early = s.liveT < 0.75;
    if (s.thrown && thrownAt < 0) thrownAt = s.t;
    if ((s.wrapped > 0 || !s.carUp) && contactAt < 0) contactAt = s.t;
    if (s.phase === 'dead' && deadAt < 0) deadAt = s.t;
    const near = (x, a, b) => x >= 0 && s.t >= x + a && s.t <= x + b;
    const dense = early || near(thrownAt, 0, 1.6) || near(contactAt, -0.1, 1.1) || near(deadAt, 0, 1.3);
    // user QB: show the bubbles, then throw to the most open one
    if (opts.pass && s.qbCar && !s.thrown && s.phase === 'live' && s.liveT > (opts.holdT || 1.5) && !bubbled) {
      bubbled = true; await raf2(); await shot(`${tag}_bubbles`);
      const which = await page.evaluate(() => { const b = [...document.querySelectorAll('.rb.on')]; const pick = b.find(x => !x.classList.contains('r') && !x.classList.contains('y')) || b.find(x => !x.classList.contains('r')) || b[0]; if (!pick) return null; const r = MATCH._G.play.receivers.find(x => x.id === pick.dataset.r); if (r) MATCH._G.play.throwTo(r); return pick.dataset.r; });
      log.push({ f: '(throw)', to: which });
    }
    if (dense || ++sparse % 5 === 0) await shot(`${tag}_f${String(k++).padStart(2, '0')}`, { win: dense ? 'dense' : 'sparse' });
    if (deadAt >= 0 && s.t > deadAt + 1.3) break;
    await page.evaluate(ms => window.__adv(ms), 80);
  }
  await page.evaluate(() => { MATCH._G.paused = false; });
  await page.waitForTimeout(250); await shot(`${tag}_whistle`);
  await page.waitForTimeout(700); await shot(`${tag}_after`);
}
const OPLAN = ['run', 'pass', 'pass', 'run', 'goal', 'pass'];
let oN = 0, dN = 0, plays = 0, stuck = 0, last = '', fgDone = false; const seen = new Set();
while (oN < 7 && plays < 12 && stuck < 160) {
  const g = await G(); if (!g || g.over) break;
  const key = JSON.stringify([g.stage, g.phase, g.down, g.yl, g.sheet]); if (key === last) stuck++; else stuck = 0; last = key;
  if (g.ban && !seen.has('ban' + plays)) { seen.add('ban' + plays); await shot('banner'); }
  if (g.kick) { await shot('kickmeter'); await page.waitForTimeout(300); await shot('kickmeter_b'); await page.click('#mK'); await page.waitForTimeout(500); await shot('kick_result'); continue; }
  if (g.stage === 'call' && g.sheet) {
    const side = g.sheetSide;
    if (side === 'PAT') { await shot('sheet_PAT'); await page.click('[data-act="xp"]'); await page.waitForTimeout(400); continue; }
    if (!seen.has('sheet' + side)) { seen.add('sheet' + side); await page.waitForTimeout(500); await shot('sheet_' + side); await page.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = 400; const l = document.querySelector('.sheet .plist'); if (l) l.scrollTop = 0; }); await page.waitForTimeout(150); await shot('sheet_' + side + '_scrolled'); await page.evaluate(() => { document.querySelector('.sheet').scrollTop = 0; }); }
    if (side === 'O') {
      let want = OPLAN[oN % OPLAN.length];
      if (oN === 3 && !fgDone) { fgDone = true; await page.evaluate(() => { MATCH._G.yl = 70; }); await page.click('[data-f="all"]'); await page.waitForTimeout(200); const fg = await page.$('[data-act="fg"]'); if (fg) { await shot('sheet_O_fg_option'); await fg.click(); await page.waitForTimeout(400); continue; } }
      if (want === 'goal') { await page.evaluate(() => { const g = MATCH._G; g.yl = 96; g.down = 1; g.togo = 4; }); want = 'run'; }
      await page.click(`[data-f="${want}"]`); await page.waitForTimeout(250);
      if (!seen.has('sheetchip' + want)) { seen.add('sheetchip' + want); await shot('sheet_O_' + want); }
      const cards = await page.$$('.sheet .plist .pc'); if (cards.length) { await cards[(oN * 3) % cards.length].click(); oN++; plays++; G.lastO = want; }
    } else {
      const cards = await page.$$('.sheet .pc'); if (cards.length) { await cards[dN % cards.length].click(); dN++; plays++; }
    }
    await page.waitForTimeout(350); continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre') {
    const tag = `p${plays}_${g.side}`;
    await page.waitForTimeout(250); await shot(`${tag}_presnap`);
    if (g.side === 'O') { const b = await page.$('[data-a="snap"]'); if (b) await b.click(); }
    for (let i = 0; i < 60; i++) { const h = await G(); if (h.stage === 'live') break; await page.waitForTimeout(50); }
    const h = await G(); if (h.stage === 'live') { const isPass = await page.evaluate(() => !!MATCH._G.play.pass); await livePlay(tag + (isPass ? '_pass' : '_run'), { pass: isPass && g.side === 'O' }); }
    continue;
  }
  await page.waitForTimeout(250);
}
console.log('plays', plays, JSON.stringify(await G()));
const blocked = await page.evaluate(() => { const b = document.querySelector('.mbtn.pause').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e ? e.className : null; }); log.push({ f: '(pause hit-test)', top: blocked }); await page.evaluate(() => document.querySelector('.mbtn.pause').click()); await page.waitForTimeout(400); await shot('pause');
await page.click('[data-m="simg"]');
for (let i = 0; i < 600; i++) { const g = await G(); if (!g || g.stage === 'final') break; if (i === 4) await shot('simcard'); await page.waitForTimeout(500); }
await page.waitForTimeout(600); await shot('final');
await page.evaluate(() => { const c = document.querySelector('.ovl .card'); if (c) c.scrollTop = 9999; }); await page.waitForTimeout(150); await shot('final_scrolled');
fs.writeFileSync(path.join(shots, 'log.json'), JSON.stringify(log, null, 1));
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
