// Real finger swipe on the full play list (All chip) on the phone: does it scroll, are deep plays reachable?
import { launch } from './lib.mjs';
const H = await launch('phone', { tag: 'plist', seed: 7 }); const { page } = H;
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
await H.until(g => g.stage === 'call' && g.sheet, 60000, 150); await H.wait(500);
const chip = await (await page.$('[data-f="all"]')).boundingBox(); await H.tapAt(chip.x + chip.width / 2, chip.y + chip.height / 2); await H.wait(500);
const st = () => page.evaluate(() => { const p = document.querySelector('.sheet .plist'), r = p.getBoundingClientRect(), a = document.querySelector('.sheet .sh-acts').getBoundingClientRect(); return { scrollTop: p.scrollTop, scrollH: p.scrollHeight, clientH: p.clientHeight, cards: p.children.length, plist: [Math.round(r.top), Math.round(r.bottom)], acts: [Math.round(a.top), Math.round(a.bottom)], vh: innerHeight }; });
const s0 = await st(); console.log('All list', s0); await H.shot('all_list');
const x = 195, y0 = s0.plist[0] + Math.min(100, (s0.plist[1] - s0.plist[0]) - 10), y1 = s0.plist[0] + 5;
await H.touchDown(x, y0); for (let i = 1; i <= 10; i++) { await H.touchMove(x, y0 + (y1 - y0) * i / 10); await H.wait(16); } await H.touchUp(); await H.wait(600);
console.log('after one swipe', await st()); await H.shot('all_list_swiped');
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors'); await H.close();
