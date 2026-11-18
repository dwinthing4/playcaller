// Stay at the line (user offense, not snapped) and watch memory / GPU objects until the tab dies or N seconds pass.
import { launch } from '../lib.mjs';
import fs from 'fs';
const which = process.argv[2] || 'phone', secs = +(process.argv[3] || 240), where = process.argv[4] || 'pre';
const H = await launch(which, { tag: 'r2_idle', seed: 3, file: 'playcaller_qa2.html' });
const { page } = H; const out = []; const t00 = Date.now(); const log = (...a) => { const s = ((Date.now() - t00) / 1000).toFixed(1) + 's ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); fs.writeFileSync(`C:/Users/dwint/football-game/qa/tester/r2/out_idle_${where}_${which}.txt`, out.join('\n')); };
let crashed = false; page.on('crash', () => { crashed = true; log('PAGE CRASH'); });
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
for (let i = 0; i < 400; i++) { const g = await H.G(); if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'O') break; if (g.sheetSide === 'PAT') await H.tapSel('[data-act="xp"]'); else await H.tapSel('.sheet .pc'); } if (g.kick) await H.tapSel('#mK'); if (g.stage === 'pre' && g.side === 'O') await H.tapSel('.acts [data-a="snap"]'); if (g.stage === 'live' && g.acts.includes('away')) await page.keyboard.press('Digit1'); await H.wait(300); }
if (where === 'pre') { await H.tapSel('.sheet .pc'); await H.until(g => g.stage === 'pre', 4000); }
log('waiting at', where, JSON.stringify(await H.G()));
const t0 = Date.now(); let last = 0;
while (!crashed && Date.now() - t0 < secs * 1000) {
  try { const s = await page.evaluate(() => { const st = R3D.stats ? R3D.stats() : {}; const p = MATCH._G.play; return { heap: Math.round(performance.memory.usedJSHeapSize / 1e6), total: Math.round(performance.memory.totalJSHeapSize / 1e6), stage: MATCH._G.stage, phase: p && p.phase, t: p ? +p.t.toFixed(1) : null, fx: p ? p.fx.length : null, ev: p ? p.events.length : null, calls: st.calls, tris: st.tris, rigs: st.rigs, bubKids: document.querySelector('.bub').children.length, nodes: document.getElementsByTagName('*').length }; });
    if (Date.now() - last > 10000) { log(JSON.stringify(s)); last = Date.now(); } } catch (e) { log('evaluate failed', e.message.split('\n')[0]); break; }
  await H.wait(500);
}
log('end: crashed', crashed, 'errs', H.errs.slice(0, 3));
await H.close().catch(() => { });
