// Phone, QB phase: (1) can the virtual stick be used at all while the bubbles are up? (2) do real taps on bubbles throw,
// and if not, why (throwTo preconditions, pointerdown target)?
import { launch } from '../lib.mjs';
import fs from 'fs';
const H = await launch('phone', { tag: 'r2_qbtouch', seed: +(process.argv[2] || 9), file: 'playcaller_qa3.html' });
const { page } = H; const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); };
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
const tap = async sel => { const e = await page.$(sel); if (!e) return false; const r = await e.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
await page.evaluate(() => { window.__pd = []; document.addEventListener('pointerdown', e => { window.__pd.push({ t: +(performance.now() / 1000).toFixed(2), tgt: (e.target.className || e.target.tagName) + (e.target.dataset && e.target.dataset.r ? '[' + e.target.dataset.r + ']' : ''), x: Math.round(e.clientX), y: Math.round(e.clientY), type: e.pointerType }); }, true); });
async function toO() { for (let i = 0; i < 800; i++) { const g = await H.G(); if (g.kick) { await tap('#mK'); await H.wait(500); continue; }
  if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'O') return; if (g.sheetSide === 'PAT') { await tap('[data-act="xp"]'); await H.wait(400); continue; } (await tap('.sheet .picks .pc')) || (await tap('.sheet .plist .pc')); await H.wait(500); continue; }
  if (g.stage === 'pre' && g.side === 'O') await tap('.acts [data-a="snap"]');
  if (g.stage === 'live' && g.acts.includes('away')) await page.evaluate(() => { const p = MATCH._G.play; p.throwTo(p.receivers[0]); });
  await H.wait(200); } }
const pre = () => page.evaluate(() => { const p = MATCH._G.play, q = p.qb; return { liveT: +p.liveT.toFixed(2), thrown: p.thrown, carrierIsQB: p.carrier === q, scramble: !!p.scramble, upright: q.upright(), windup: +(q.windup || 0).toFixed(2), ball: p.ball.state, pastLos: q.p.z > p.losZ + 0.3, defWrapped: p.D.some(d => d.wrapped), qbZ: +(q.p.z - p.losZ).toFixed(2), qbX: +q.p.x.toFixed(2) }; });
for (let rep = 0; rep < 6; rep++) {
  await toO(); await H.until(g => g.stage === 'call', 2000);
  await page.evaluate(() => { document.querySelector('[data-f="pass"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await H.wait(250);
  const id = await page.evaluate(() => { const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); const p = MATCH._G.sheet.pool.find(p => ids.includes(p.id) && p.type === 'pass' && !/Screen|PA |Play Action/.test(p.name)); return p.id; });
  const c = await page.$(`.sheet .plist [data-id="${id}"]`); await c.scrollIntoViewIfNeeded(); const cb = await c.boundingBox(); await H.tapAt(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await H.until(g => g.stage === 'pre', 3000, 40); await H.wait(250); await tap('.acts [data-a="snap"]'); await H.until(g => g.acts.includes('away'), 3000, 20);
  if (rep % 2 === 0) {
    // (1) stick: a real touch drag on the left half of the screen, straight up then left, while the QB has the ball
    await H.wait(500); const hit = await page.evaluate(() => { const h = document.elementFromPoint(110, 600); return h ? h.className || h.tagName : null; });
    const a = await pre(); await H.touchDown(110, 600); for (let i = 1; i <= 8; i++) { await H.touchMove(110 - i * 6, 600 - i * 6); await H.wait(35); } await H.wait(500);
    const b = await page.evaluate(() => { const p = MATCH._G.play; return { input: [+p.input.x.toFixed(2), +p.input.z.toFixed(2)], stickShown: document.querySelector('.stick').classList.contains('show'), touched: p.userTouched }; }); const c2 = await pre(); await H.touchUp();
    log(`[${rep}] stick drag while QB holds: element under finger "${hit}" | before`, { x: a.qbX, z: a.qbZ }, 'after', { x: c2.qbX, z: c2.qbZ }, b);
  } else {
    // (2) bubbles: tap the first bubble at 1.0 s, then another at 1.6 s if nothing happened
    for (const at of [1.0, 1.6, 2.2]) {
      while ((await page.evaluate(() => MATCH._G.play.liveT)) < at && (await H.G()).acts.includes('away')) await H.wait(25);
      if (!(await H.G()).acts.includes('away')) break;
      const n0 = await page.evaluate(() => window.__pd.length);
      const tgt = await page.evaluate(() => { const nodes = [...document.querySelectorAll('.bub .rb')]; const n = nodes[0]; const r = n.getBoundingClientRect(); return { id: n.dataset.r, cls: n.className, x: r.left + r.width / 2, y: r.top + r.height / 2, hit: (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || {}).className }; });
      const a = await pre(); await H.tapAt(tgt.x, tgt.y); await H.wait(60); const b = await pre();
      const pd = await page.evaluate(n => window.__pd.slice(n), n0);
      log(`[${rep}] tap bubble ${tgt.id} (${tgt.cls}, hit "${tgt.hit}") at liveT ${a.liveT}: before`, a, '| after', { thrown: b.thrown, windup: b.windup, ball: b.ball }, '| pointerdowns', pd);
      if (b.thrown || b.windup) break;
    }
  }
  await H.until(g => g.stage !== 'live' && g.stage !== 'pre', 20000, 60);
  log(`[${rep}] result`, await page.evaluate(() => { const r = MATCH._G.play.result; return { type: r.type, text: r.text, y: +r.yards.toFixed(1) }; }));
}
log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
fs.writeFileSync('C:/Users/dwint/football-game/qa/tester/r2/out_qbtouch.txt', out.join('\n'));
await H.close();
