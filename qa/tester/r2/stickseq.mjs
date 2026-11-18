// User QB with zero input on a given pass play: does he drift past the LOS and "scramble" on his own?
// Also: with the stick touched on the .bub layer (phone), does input reach the QB?
import { launch } from '../lib.mjs';
const which = process.argv[2] || 'desk', playName = process.argv[3] || 'Trips Slants';
const H = await launch(which, { tag: 'r2_noinput_' + which, seed: +(process.argv[4] || 11), file: 'playcaller_qa2.html' });
const { page } = H;
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
const tap = async sel => { const e = await page.$(sel); if (!e) return false; const r = await e.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
async function toO() { for (let i = 0; i < 900; i++) { const g = await H.G(); if (g.kick) await tap('#mK'); else if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'O') return; if (g.sheetSide === 'PAT') await tap('[data-act="xp"]'); else await tap('.sheet .pc'); } else if (g.stage === 'pre' && g.side === 'O') await tap('.acts [data-a="snap"]'); else if (g.stage === 'live' && g.acts.includes('away')) await page.keyboard.press('Digit1'); await H.wait(200); } }
for (let rep = 0; rep < 5; rep++) {
  await toO(); await H.wait(450); await page.evaluate(() => { const g = MATCH._G; g.yl = 30; g.down = 1; g.togo = 10; }); await tap('[data-f="pass"]'); await H.wait(250);
  const id = await page.evaluate(n => { const p = MATCH._G.sheet.pool.find(p => p.name === n); return p && p.id; }, playName); if (!id) { console.log('play not in book', playName); break; }
  const c = await page.$(`.sheet .plist [data-id="${id}"]`); await c.scrollIntoViewIfNeeded(); const b = await c.boundingBox(); await H.tapAt(b.x + b.width / 2, b.y + b.height / 2);
  await H.until(g => g.stage === 'pre', 3000, 40); await H.wait(350); await tap('.acts [data-a="snap"]');
  await H.until(g => g.acts.includes('away'), 4000, 20); while ((await page.evaluate(() => MATCH._G.play.liveT)) < 0.95) await H.wait(20);
  const hit0 = await page.evaluate(() => { const h = document.elementFromPoint(117, 523); return h ? h.className || h.tagName : null; });
  const pd0 = await page.evaluate(() => { window.__pd2 = []; if (!window.__pdh) { window.__pdh = 1; document.addEventListener('pointerdown', e => window.__pd2.push((e.target.className || e.target.tagName) + ' ' + e.pointerType), true); } return 0; });
  await H.touchDown(117, 523); await H.touchMove(117 + 0.7 * 55, 523 - 0.8 * 55);
  for (let i = 0; i < 6; i++) { await H.wait(70); await H.touchMove(117 + 0.7 * 55 + (i % 2), 523 - 0.8 * 55); }
  const mid = await page.evaluate(() => { const p = MATCH._G.play; return { in: [+p.input.x.toFixed(2), +p.input.z.toFixed(2)], stick: document.querySelector('.stick').classList.contains('show'), pds: window.__pd2, z: +((p.qb.p.z - p.losZ) / 0.9144).toFixed(2), scr: !!p.scramble }; });
  console.log(`[${rep}] finger down at 117,523 on "${hit0}" during the QB phase ->`, JSON.stringify(mid));
  const trace = []; const t0 = Date.now(); let scr = null;
  while (Date.now() - t0 < 15000) { const s = await page.evaluate(() => { const g = MATCH._G, p = g.play, q = p.qb; return { st: g.stage, t: +p.liveT.toFixed(2), z: +((q.p.z - p.losZ) / 0.9144).toFixed(2), vz: +q.vel.z.toFixed(2), in: [+p.input.x.toFixed(2), +p.input.z.toFixed(2)], scr: !!p.scramble, touched: p.userTouched, carrierQB: p.carrier === q, thrown: p.thrown, stick: document.querySelector('.stick').classList.contains('show'), keys: 0 }; });
    if (s.st !== 'live' && s.st !== 'pre') break; if (s.scr && !scr) scr = s; if (trace.length < 60) trace.push(`${s.t}:${s.z}`); await H.wait(100); }
  await H.touchUp();
  const r = await page.evaluate(() => { const r = MATCH._G.play.result; return r && { type: r.type, kind: r.kind, y: +r.yards.toFixed(1), text: r.text }; });
  console.log(`[${rep}] ${playName}, finger on the stick -> result ${JSON.stringify(r)} | scramble flagged at ${scr ? JSON.stringify(scr) : 'never'} | QB depth (yd vs LOS) over time ${trace.filter((x, i) => i % 4 === 0).join(' ')}`);
}
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
