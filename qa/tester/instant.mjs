// Instant button on the home screen (phone tap) and the fps scenario at heavy CPU throttle.
import { launch } from './lib.mjs';
const H = await launch('phone', { tag: 'inst', seed: 5 });
const { page } = H;
await H.newLeague(60, 5); await page.evaluate(() => { TAB = 'home'; render(); }); await H.wait(500);
const st = () => page.evaluate(() => ({ week: L.week, rec: `${L.teams[L.user].w}-${L.teams[L.user].l}`, done: L.sched[0].find(g => g.h === L.user || g.a === L.user).done, game: !!MATCH._G, toast: (document.getElementById('toasts') || {}).innerText }));
const sel = 'button[onclick="startUserGame(\'instant\')"]';
console.log('before', await st(), 'hit', await H.hitTest(sel));
const b = await page.$(sel); const r = await b.boundingBox(); await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); await H.wait(1500);
console.log('after tap', await st(), 'modal', await page.evaluate(() => (document.getElementById('modal').innerText || '').slice(0, 100)));
await page.evaluate(() => startUserGame('instant')); await H.wait(1500); console.log('after 2nd instant (direct call)', await st());
// heavy throttle: does game time keep up with real time?
await page.evaluate(() => { closeModal(); startUserGame('play'); }); await H.until(g => g.ready, 60000, 300); await H.tapSel('#mKick'); await H.until(g => g.stage === 'call' && g.sheet, 30000, 200);
await H.tapSel('.picks .pc'); await H.wait(500);
for (const rate of [8, 14]) { await H.cdp.send('Emulation.setCPUThrottlingRate', { rate }); const fps = await H.fps(2000); const x = await page.evaluate(() => new Promise(res => { const g = MATCH._G, t0 = performance.now(), g0 = g.time; setTimeout(() => res({ real: (performance.now() - t0) / 1000, game: g.time - g0 }), 3000); }));
  console.log(`cpu x${rate}: fps ${fps.toFixed(0)}, game seconds per real second ${(x.game / x.real).toFixed(2)}`); }
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
