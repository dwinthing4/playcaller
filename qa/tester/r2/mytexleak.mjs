// Field textures (1024x2304 canvas each) are cached per offense/defense/home/view and never released.
// Play a few snaps against several opponents (quit each game), count the field canvases created and check they survive GC.
import { launch } from '../lib.mjs';
const H = await launch('desk', { tag: 'r2_texleak', seed: 3, file: 'playcaller_qa3.html' });
const { page } = H;
await page.evaluate(() => { window.__fc = []; const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (...a) { if (this.width === 1024 && this.height === 2304 && !this.__seen) { this.__seen = 1; window.__fc.push(new WeakRef(this)); } return gc.apply(this, a); }; });
await H.newLeague(60, 5);
const cdp = H.cdp; const rows = [];
for (let wk = 0; wk < 6; wk++) {
  await page.evaluate(w => { L.week = w; }, wk);
  const opp = await page.evaluate(() => { const g = currentUserGame(); return g ? L.teams[g.h === L.user ? g.a : g.h].abbr : null; });
  await page.evaluate(() => startUserGame('play')); await H.until(g => g.ready, 90000, 300); await page.click('#mKick');
  let sawO = false, sawD = false, kicks = 0; const t0 = Date.now();
  while (Date.now() - t0 < 120000 && !(sawO && sawD && kicks > 0)) { const g = await H.G(); if (!g) break;
    if (await page.evaluate(() => !!MATCH._G.kickAnim)) kicks++;
    if (g.kick) await page.click('#mK').catch(() => { });
    else if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'O') { sawO = true; if (g.down < 4) await page.evaluate(() => { const g = MATCH._G; g.down = 4; g.togo = 20; }); await page.click('[data-f="coach"]').catch(() => { }); await page.waitForTimeout(150); const a = await page.$('[data-act="punt"]') || await page.$('[data-act="fg"]'); if (a) await a.click(); else await page.click('.sheet .pc'); } else if (g.sheetSide === 'D') { sawD = true; await page.click('.sheet .pc'); } else await page.click('[data-act="xp"]').catch(() => { }); }
    else if (g.stage === 'pre' && g.side === 'O') await page.keyboard.press('Space');
    else if (g.stage === 'live' && g.acts.includes('away')) await page.keyboard.press('Digit1');
    await page.waitForTimeout(200); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.click('[data-m="quit"]').catch(() => { }); await page.waitForTimeout(600);
  await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(300);
  const n = await page.evaluate(() => ({ created: window.__fc.length, alive: window.__fc.filter(w => w.deref()).length }));
  rows.push({ week: wk + 1, opp, sawO, sawD, kicks: kicks > 0, ...n }); console.log(JSON.stringify(rows[rows.length - 1]));
}
const last = rows[rows.length - 1]; console.log(`after ${rows.length} games: ${last.alive} field canvases of 1024x2304 still alive after GC = ~${(last.alive * 1024 * 2304 * 4 / 1e6).toFixed(0)} MB of canvas pixels (+ the same again or more as GPU textures with mipmaps)`);
console.log(H.errs.length ? 'ERRORS ' + H.errs.slice(0, 3).join(' || ') : 'no page errors');
await H.close();
