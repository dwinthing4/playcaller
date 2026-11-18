// M10 staged: during a user pass play, knock the most-open receiver over (startFall) and read his bubble 0.25 s later.
import { launch } from '../lib.mjs';
const H = await launch('desk', { tag: 'r2_qbfall', seed: 3, file: 'playcaller_qa2.html' });
const { page } = H;
await H.newLeague(60, 5); await H.startGame('play'); await page.click('#mKick');
async function toO() { for (let i = 0; i < 900; i++) { const g = await H.G(); if (g.kick) await page.click('#mK').catch(() => { }); else if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'O') return; if (g.sheetSide === 'PAT') await page.click('[data-act="xp"]'); else await page.click('.sheet .pc'); } else if (g.stage === 'pre' && g.side === 'O') await page.keyboard.press('Space'); else if (g.stage === 'live' && g.acts.includes('away')) await page.keyboard.press('Digit1'); await page.waitForTimeout(200); } }
for (let rep = 0; rep < 5; rep++) {
  await toO(); await page.click('[data-f="pass"]'); await page.waitForTimeout(200);
  const id = await page.evaluate(() => { const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); return MATCH._G.sheet.pool.find(p => ids.includes(p.id) && p.type === 'pass' && !/Screen/.test(p.name)).id; });
  await page.click(`.sheet .plist [data-id="${id}"]`); await H.until(g => g.stage === 'pre', 3000, 40); await page.keyboard.press('Space');
  await H.until(g => g.acts.includes('away'), 6000, 20); const t0 = Date.now(); while ((await page.evaluate(() => MATCH._G.play.liveT)) < 1.1 && Date.now() - t0 < 5000) await page.waitForTimeout(20);
  const a = await page.evaluate(() => { const p = MATCH._G.play; let b = null, bo = -99; for (const r of p.receivers) { const o = p.openness(p.qb, r).open; if (o > bo) { bo = o; b = r; } } const n = document.querySelector(`.bub .rb[data-r="${b.id}"]`); const before = n ? n.className : null; PHYS._.startFall(b, p); window.__fallId = b.id; return { slot: b.slot, open: +bo.toFixed(2), before }; });
  await page.waitForTimeout(250);
  const b = await page.evaluate(() => { const p = MATCH._G.play, r = p.receivers.find(x => x.id === window.__fallId); const n = document.querySelector(`.bub .rb[data-r="${r.id}"]`); return { upright: r.upright(), bal: r.bal, open: +p.openness(p.qb, r).open.toFixed(2), cls: n ? n.className : null, stillQB: MATCH._G.stage === 'live' && !p.thrown }; });
  console.log(`[${rep}] knocked ${a.slot} over (bubble before "${a.before}", open ${a.open}) -> 0.25 s later`, JSON.stringify(b));
  await H.until(g => g.stage !== 'live', 20000, 100);
}
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
