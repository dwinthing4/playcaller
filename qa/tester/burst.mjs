// Screenshot bursts of live plays on the phone: user on defense (CPU run or pass, no input) and a user run play.
import { launch } from './lib.mjs';
const H = await launch('phone', { tag: 'burst', seed: 31 });
const { page } = H;
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
const tapCard = async sel => { const c = await page.$(sel); if (!c) return false; const r = await c.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
let dDone = 0, oDone = 0;
for (let i = 0; i < 400 && (dDone < 2 || oDone < 1); i++) {
  const g = await H.G(); if (!g || g.stage === 'final') break;
  if (g.kick) { await tapCard('#mK'); await H.wait(600); continue; }
  if (g.stage === 'call' && g.sheet) {
    if (g.sheetSide === 'PAT') { await tapCard('[data-act="xp"]'); await H.wait(400); continue; }
    if (g.sheetSide === 'O' && oDone < 1) { await tapCard('[data-f="run"]'); await H.wait(250); await tapCard('.sheet .plist .pc'); await H.until(g => g.stage === 'pre', 3000, 50); await tapCard('.acts [data-a="snap"]');
      await H.until(g => g.stage === 'live', 3000, 30); for (let k = 0; k < 10; k++) { await H.shot(`O_run_${k}`); await H.wait(250); const s = await H.G(); if (s.stage !== 'live') break; } oDone++; continue; }
    if (g.sheetSide === 'D' && dDone < 2) { await tapCard('.picks .pc'); await H.until(g => g.stage === 'live', 5000, 30); await H.wait(300);
      for (let k = 0; k < 12; k++) { await H.shot(`D${dDone}_${k}`); await H.wait(280); const s = await H.G(); if (s.stage !== 'live') break; } dDone++; continue; }
    await tapCard('.picks .pc'); await H.wait(300); continue;
  }
  if (g.stage === 'pre' && g.side === 'O') await tapCard('.acts [data-a="snap"]');
  if (g.stage === 'live' && g.acts.includes('away')) { await H.wait(1200); await page.evaluate(() => { const b = document.querySelector('.bub .rb'); b && b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }); }
  await H.wait(200);
}
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
