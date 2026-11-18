// Clean check of the play-call sheet layout on a phone (no programmatic scrolling): can a finger reach every
// action button, does a swipe scroll the play list / sheet?  portrait 390x844 and landscape 844x390.
import { launch } from './lib.mjs';
const H = await launch('phone', { tag: 'sheet', seed: 7 });
const { page } = H; const log = (...a) => console.log(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
const lay = () => page.evaluate(() => { const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }; const s = document.querySelector('.sheet');
  const scrolls = ['#game', '#gui', '.sheet', '.plist'].map(q => { const e = document.querySelector(q); return q + ':' + (e ? e.scrollTop : '-'); }).join(' ');
  return { vh: innerHeight, sheet: r(s), top: r(s.querySelector('.sh-top')), coord: r(s.querySelector('.coord')), picks: r(s.querySelector('.picks')), chips: r(s.querySelector('.chips')), plist: r(s.querySelector('.plist')), acts: r(s.querySelector('.sh-acts')), scrolls,
    btns: [...s.querySelectorAll('.sh-acts [data-act]')].map(b => { const q = b.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, h = document.elementFromPoint(x, y); return `${b.dataset.act}:${Math.round(y)}:${h === b || b.contains(h) ? 'tappable' : 'NOT(' + (h ? h.className || h.tagName : 'offscreen') + ')'}`; }) }; });
let g = await H.until(g => g.stage === 'call' && g.sheet, 60000, 150); await H.wait(600);
log('portrait', g.sheetSide, await lay()); await H.shot('portrait_sheet');
// real swipe up on the play list area and on the coordinator box
const sw = async (x, y0, y1) => { await H.touchDown(x, y0); for (let i = 1; i <= 8; i++) { await H.touchMove(x, y0 + (y1 - y0) * i / 8); await H.wait(16); } await H.touchUp(); await H.wait(400); };
const L0 = await lay(); if (L0.plist) await sw(195, Math.min(L0.vh - 10, L0.plist[0] + 60), 200); log('after swipe on plist', await lay());
await sw(195, L0.coord[0] + 20, 120); log('after swipe on coordinator box', await lay()); await H.shot('portrait_after_swipes');
await page.setViewportSize({ width: 844, height: 390 }); await H.wait(800); log('landscape', await lay()); await H.shot('landscape_sheet');
// the ▾ minimise button: does the sheet get out of the way and come back?
const mn = await page.$('[data-act="min"]'); const mb = mn && await mn.boundingBox(); log('min button box', mb);
await page.setViewportSize({ width: 390, height: 844 }); await H.wait(500);
const pb = await page.$('[data-act="min"]'); const pbb = await pb.boundingBox(); if (pbb && pbb.y + pbb.height / 2 < 844) { await H.tapAt(pbb.x + pbb.width / 2, pbb.y + pbb.height / 2); await H.wait(400); log('after ▾', await lay()); await H.shot('portrait_min'); }
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
