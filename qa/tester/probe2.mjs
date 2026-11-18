// Desktop probe: mouse on bubbles/pause during live, keyboard throw, Esc pause mid-play, stick via keys.
import { launch } from './lib.mjs';
const H = await launch('desk', { tag: 'p2_desk', seed: 7 });
const { page } = H;
await H.newLeague(60, 5);
await H.startGame('play'); await H.tapSel('#mKick');
async function toOffenseSheet() {
  for (let i = 0; i < 500; i++) { const g = await H.G(); if (!g || g.over) return g;
    if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'O') return g; if (g.sheetSide === 'PAT') { await page.click('[data-act="xp"]'); await H.wait(300); continue; } await page.click('.sheet .pc'); await H.wait(300); continue; }
    if (g.kick) { await page.click('#mK'); }
    if (g.stage === 'pre' && g.side === 'O') { await page.keyboard.press('Space'); }
    await H.wait(250); }
}
async function callPass() { await page.click('[data-f="pass"]'); await H.wait(200); const id = await page.evaluate(() => MATCH._G.sheet.pool.find(p => p.type === 'pass' && !/Screen|PA|Play/.test(p.name)).id); await page.click(`.sheet .plist [data-id="${id}"]`); await H.until(g => g.stage === 'pre', 4000); return id; }
let g = await toOffenseSheet(); console.log('sheet', JSON.stringify(g));
// 1) mouse click a bubble
await callPass(); await H.wait(300); await page.keyboard.press('Space');
await H.until(g => g.acts.includes('away'), 4000, 50); await H.wait(800);
const bub = await page.$('.rb.on'); const bb = await bub.boundingBox();
const hit = await H.hitTest('.rb.on'); console.log('desk bubble hit', JSON.stringify(hit));
await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await H.wait(200);
console.log('after mouse click bubble: thrown/windup', JSON.stringify(await page.evaluate(() => ({ th: MATCH._G.play.thrown, w: !!MATCH._G.play.qb.windup }))));
// pause button with the mouse mid-play
const ph = await H.hitTest('.mbtn.pause'); console.log('desk pause hit live', JSON.stringify(ph));
await page.mouse.click(ph.x, ph.y); await H.wait(200); console.log('paused after mouse click?', (await H.G()).paused);
// keyboard throw
await page.keyboard.press('Digit1'); await H.wait(300);
console.log('after Digit1', JSON.stringify(await page.evaluate(() => ({ th: MATCH._G.play.thrown, w: !!MATCH._G.play.qb.windup, ball: MATCH._G.play.ball.state }))));
await H.shot('desk_throw');
await H.until(g => g.stage !== 'live', 15000, 100); g = await H.G(); console.log('result', g.ban, JSON.stringify({ down: g.down, togo: g.togo, yl: g.yl }));
// 2) Esc pause mid-play then resume, check physics paused
g = await toOffenseSheet(); await callPass(); await page.keyboard.press('Space'); await H.until(g => g.stage === 'live', 3000, 50); await H.wait(600);
await page.keyboard.press('Escape'); await H.wait(100);
const t1 = await page.evaluate(() => MATCH._G.play.liveT); await H.wait(1000); const t2 = await page.evaluate(() => MATCH._G.play.liveT);
console.log('Esc pause: liveT frozen?', t1.toFixed(2), t2.toFixed(2), JSON.stringify((await H.G()).paused));
await H.shot('desk_pause'); await page.keyboard.press('Escape'); await H.wait(300); console.log('resumed', !(await H.G()).paused);
// keys held during pause leak? hold W while paused
await page.keyboard.press('Digit2'); await H.until(g => g.stage !== 'live', 15000, 100);
console.log(H.errs.length ? 'ERRORS\n' + H.errs.join('\n') : 'no errors');
await H.close();
