// Probe: reach a user offensive pass play on the phone, hit-test every control the player must tap.
import { launch } from './lib.mjs';
const which = process.argv[2] || 'phone';
const H = await launch(which, { tag: 'p1_' + which, seed: 7 });
const { page } = H;
await H.newLeague(60, 5);
const t0 = Date.now(); await H.startGame('play'); console.log('ready in', (Date.now() - t0) / 1000, 's');
await H.shot('intro');
console.log('mKick hit', JSON.stringify(await H.hitTest('#mKick')));
await H.tapSel('#mKick');
// play defense snaps until we have the ball on offense
let g, guard = 0;
while (guard++ < 400) {
  g = await H.G(); if (!g || g.over) break;
  if (g.stage === 'call' && g.sheet) {
    if (g.sheetSide === 'O') break;
    if (g.sheetSide === 'PAT') { await H.tapSel('[data-act="xp"]'); await H.wait(400); continue; }
    const c = await page.$$('.sheet .pc'); if (c.length) { const r = await c[0].boundingBox(); await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); }
    await H.wait(400); continue;
  }
  await H.wait(300);
}
console.log('at offense sheet', JSON.stringify(g));
await H.shot('sheetO');
console.log('pause hit (sheet)', JSON.stringify(await H.hitTest('.mbtn.pause')));
// pick a pass play from the full list
const passId = await page.evaluate(() => { const s = MATCH._G.sheet; const p = s.pool.find(p => p.type === 'pass' && !/Screen/.test(p.name)); return p && p.id; });
await page.evaluate(() => { document.querySelector('[data-f="pass"]').click(); });
await H.wait(300);
const card = await page.$(`.sheet .plist [data-id="${passId}"]`);
console.log('pass card', passId, JSON.stringify(await H.hitTest(`.sheet .plist [data-id="${passId}"]`)));
await card.scrollIntoViewIfNeeded(); const rb = await card.boundingBox(); await H.tapAt(rb.x + rb.width / 2, rb.y + rb.height / 2);
await H.until(g => g.stage === 'pre', 5000);
await H.wait(500); await H.shot('preO');
console.log('pre state', JSON.stringify(await H.G()));
console.log('snap hit', JSON.stringify(await H.hitTest('[data-a="snap"]')));
console.log('audible hit', JSON.stringify(await H.hitTest('[data-a="audible"]')));
console.log('pause hit (pre)', JSON.stringify(await H.hitTest('.mbtn.pause')));
console.log('pre bubble hit', JSON.stringify(await H.hitTest('.rb')));
await H.tapSel('[data-a="snap"]');
const live = await H.until(g => g.stage === 'live', 5000, 50);
console.log('after snap tap', JSON.stringify(live));
await H.until(g => g.acts.includes('away'), 3000, 50);
await H.wait(700);
await H.shot('qb');
const bubs = await page.evaluate(() => [...document.querySelectorAll('.rb')].map(e => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y); return { slot: e.textContent, cls: e.className, x: Math.round(x), y: Math.round(y), hit: h && h.className, ok: h === e || e.contains(h) }; }));
console.log('qb bubbles', JSON.stringify(bubs));
console.log('throw away hit', JSON.stringify(await H.hitTest('[data-a="away"]')));
console.log('pause hit (live)', JSON.stringify(await H.hitTest('.mbtn.pause')));
// tap the first green bubble for real
const before = await page.evaluate(() => ({ thrown: MATCH._G.play.thrown, wind: !!MATCH._G.play.qb.windup }));
const b0 = bubs.find(b => /on/.test(b.cls)) || bubs[0];
if (b0) await H.tapAt(b0.x, b0.y);
await H.wait(250);
const after = await page.evaluate(() => ({ thrown: MATCH._G.play.thrown, wind: !!MATCH._G.play.qb.windup, ball: MATCH._G.play.ball.state, stick: document.querySelector('.stick').className }));
console.log('tap bubble', JSON.stringify(b0), 'before', JSON.stringify(before), 'after', JSON.stringify(after));
await H.shot('after_tap');
const fps = await H.fps(); console.log('fps live', fps.toFixed(1));
await H.until(g => g.stage !== 'live', 20000, 100);
console.log('end', JSON.stringify(await H.G()));
console.log(H.errs.length ? 'ERRORS\n' + H.errs.join('\n') : 'no errors');
await H.close();
