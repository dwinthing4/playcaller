// Round-2 UI capture: management screens (home briefing, game plan), intro, call sheet per filter with layout metrics,
// pre-snap, coordinator bubble, live bubbles with hit-tests and real taps, pause via real tap, final. run: node qa/visual2_ui.mjs phone|desk|land
import { open, waitReady, raf2 } from './visual2_lib.mjs';
const which = process.argv[2] || 'desk';
const { page, shot, log, done, vw, vh, dpr } = await open(which, 'ui_' + which);
const touch = dpr > 1;
const tapEl = async sel => { const r = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel); if (!r) return false; if (touch) await page.touchscreen.tap(r.x, r.y); else await page.mouse.click(r.x, r.y); return true; };
const hit = sel => page.evaluate(s => [...document.querySelectorAll(s)].map(e => { const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { el: (e.dataset.r || e.dataset.a || e.dataset.act || e.className).toString().slice(0, 30), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), top: t ? (t === e || e.contains(t) ? 'SELF' : (t.className || t.tagName).toString().slice(0, 40)) : null }; }), sel);
const sheetMetrics = () => page.evaluate(([vw, vh]) => { const s = document.querySelector('.sheet.show'); if (!s) return null; const r = s.getBoundingClientRect(); const q = (sel) => [...s.querySelectorAll(sel)].map(e => { const b = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 18), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), off: b.bottom > vh + 0.5 || b.right > vw + 0.5 || b.x < -0.5 }; });
  const pl = s.querySelector('.plist'), cs = pl ? getComputedStyle(pl).gridTemplateColumns.split(' ').length : 0; return { sheet: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], scrollH: s.scrollHeight, clientH: s.clientHeight, chips: q('.chips button'), acts: q('.sh-acts button'), picks: q('.picks .pc').length, cards: q('.plist .pc').length, cols: cs, coord: q('.coord p'), gameScroll: document.getElementById('game').scrollTop, plistScroll: pl ? [pl.scrollHeight, pl.clientHeight] : null }; }, [vw, vh]);
// ---------- management
await shot('title');
await page.evaluate(() => { NG.slot = 5; NG.qlen = 120; createLeague(); pickTeam(L.teams[7].id); }); await page.waitForTimeout(500); await shot('home');
await page.screenshot({ path: (await import('path')).default.join(OUT_DIR(), 'home_full.png'), fullPage: true }).catch(() => {});
const brief = await page.evaluate(() => { const b = document.querySelector('.brief'); if (!b) return null; b.scrollIntoView({ block: 'center' }); return [...b.querySelectorAll('.say p')].map(p => ({ text: p.textContent.slice(0, 200), h: Math.round(p.getBoundingClientRect().height), w: Math.round(p.getBoundingClientRect().width) })); });
log.push({ brief }); await page.waitForTimeout(200); await shot('home_briefing');
await page.evaluate(() => { closeModal(); go('plan'); }); await page.waitForTimeout(500); await shot('plan');
const planInfo = await page.evaluate(() => ({ len: document.querySelector('#app') ? document.querySelector('#app').innerText.length : 0, say: [...document.querySelectorAll('.say p, .coord p')].map(p => p.textContent.slice(0, 120)), h: document.documentElement.scrollHeight }));
log.push({ planInfo });
for (const y of [700, 1400, 2100]) { if (planInfo.h > y + 200) { await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(200); await shot('plan_s' + y); } }
for (const t of ['roster', 'depth', 'playbook', 'uniforms', 'standings']) { await page.evaluate(t => { closeModal(); go(t); scrollTo(0, 0); }, t); await page.waitForTimeout(350); await shot('tab_' + t); }
await page.evaluate(() => { closeModal(); go('home'); });
// ---------- match
await page.evaluate(() => startUserGame('play'));
await page.waitForTimeout(900); await shot('match_loading');
await waitReady(page); await page.waitForTimeout(500); await shot('intro');
await page.click('#mKick'); await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; });
await page.waitForTimeout(500); await shot('banner_kickoff');
for (let i = 0; i < 100; i++) { const s = await page.evaluate(() => !!document.querySelector('.sheet.show')); if (s) break; await page.waitForTimeout(200); }
await page.waitForTimeout(500); await shot('sheet_O_coach'); log.push({ f: 'sheet_O_coach', m: await sheetMetrics() });
for (const f of ['run', 'pass', 'all']) { await page.click(`[data-f="${f}"]`); await page.waitForTimeout(300); await shot('sheet_O_' + f); log.push({ f: 'sheet_O_' + f, m: await sheetMetrics() }); }
// focus / scroll abuse: the game view must not shift
await page.evaluate(() => { const c = [...document.querySelectorAll('.sheet .pc')].pop(); if (c) { c.focus(); c.scrollIntoView({ block: 'end' }); } });
await page.waitForTimeout(200); await shot('sheet_O_all_scrolled'); log.push({ f: 'after scrollIntoView', gameScroll: await page.evaluate(() => document.getElementById('game').scrollTop) });
await page.click('[data-f="pass"]'); await page.waitForTimeout(250);
const cards = await page.$$('.sheet .plist .pc'); if (touch) await cards[1].tap(); else await cards[1].click();
await page.waitForTimeout(900); await shot('presnap_O');
log.push({ f: 'presnap', csay: await page.evaluate(() => { const c = document.querySelector('#hud .csay'); const b = c.getBoundingClientRect(); return { show: c.classList.contains('show'), op: getComputedStyle(c).opacity, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), text: c.innerText.slice(0, 200) }; }), snapHit: await hit('[data-a="snap"]'), pauseHit: await hit('.mbtn.pause'), gameScroll: await page.evaluate(() => document.getElementById('game').scrollTop) });
await tapEl('[data-a="snap"]');
await page.waitForTimeout(350); log.push({ f: 'after snap tap', stage: await page.evaluate(() => MATCH._G.stage), csay: await page.evaluate(() => getComputedStyle(document.querySelector('#hud .csay')).opacity) });
await shot('snap_350ms');
for (let i = 0; i < 80; i++) { const s = await page.evaluate(() => MATCH._G.stage === 'live' && MATCH._G.play.liveT > 1.3); if (s) break; await page.waitForTimeout(50); }
await shot('live_bubbles'); const bub = await hit('.rb.on'); log.push({ f: 'live_bubbles', bub, pause: await hit('.mbtn.pause') });
const pick = bub.find(b => /\brb\b/.test(b.el) || true); const tgt = bub.find(b => !/ r\b| y\b/.test(b.el)) || bub[0];
if (tgt) { const x = tgt.x + tgt.w / 2, y = tgt.y + tgt.h / 2; if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
await page.waitForTimeout(120); log.push({ f: 'after bubble tap', thrown: await page.evaluate(() => !!MATCH._G.play.thrown) });
for (let i = 0; i < 6; i++) { await page.waitForTimeout(200); await shot('live_' + i); }
for (let i = 0; i < 120; i++) { const s = await page.evaluate(() => MATCH._G.stage); if (s !== 'live') break; await page.waitForTimeout(100); }
await page.waitForTimeout(300); await shot('whistle');
const ph = await hit('.mbtn.pause'); log.push({ f: 'pause hit', ph }); await tapEl('.mbtn.pause'); await page.waitForTimeout(450); await shot('pause');
log.push({ f: 'pause open', open: await page.evaluate(() => !!document.querySelector('.ovl.show')) });
if (!(await page.evaluate(() => !!document.querySelector('[data-m="simg"]')))) await page.evaluate(() => document.querySelector('.mbtn.pause').click());
await page.click('[data-m="simg"]');
for (let i = 0; i < 600; i++) { const g = await page.evaluate(() => MATCH._G && MATCH._G.stage); if (i === 3) await shot('simcard'); if (!g || g === 'final') break; await page.waitForTimeout(500); }
await page.waitForTimeout(800); await shot('final');
log.push({ final: await page.evaluate(() => { const c = document.querySelector('.ovl .card'); return c ? { sh: c.scrollHeight, ch: c.clientHeight, big: [...c.querySelectorAll('.big')].map(b => ({ t: b.textContent, op: getComputedStyle(b).opacity, col: getComputedStyle(b).color })) } : null; }) });
log.push({ stats: await page.evaluate(() => R3D.stats()) });
await done();
function OUT_DIR() { return 'C:/Users/dwint/football-game/qa/shots/visual_r2/ui_' + which; }
