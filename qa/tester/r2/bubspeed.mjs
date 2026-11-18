// Phone: how fast do the receiver bubbles move on screen while the QB holds the ball (px/s), and do they jump?
import { launch } from '../lib.mjs';
const H = await launch('phone', { tag: 'r2_bubspeed', seed: +(process.argv[2] || 5), file: 'playcaller_qa2.html' });
const { page } = H;
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
await page.evaluate(() => { const S = window.__bs = { samples: [], jumps: 0, frames: 0 }; let prev = null, pt = 0;
  const f = t => { requestAnimationFrame(f); const g = MATCH._G; if (!g || g.stage !== 'live' || !document.querySelector('.bub.on')) { prev = null; return; } const cur = {}; for (const n of document.querySelectorAll('.bub .rb')) { const r = n.getBoundingClientRect(); cur[n.dataset.r] = [r.left + r.width / 2, r.top + r.height / 2]; }
    if (prev && t > pt) { const dt = (t - pt) / 1000; for (const k in cur) if (prev[k]) { const d = Math.hypot(cur[k][0] - prev[k][0], cur[k][1] - prev[k][1]); S.samples.push(d / dt); if (d > 21) S.jumps++; } S.frames++; }
    prev = cur; pt = t; }; requestAnimationFrame(f); });
let plays = 0;
for (let i = 0; i < 2000 && plays < 8; i++) { const g = await H.G(); if (g.stage === 'final') break;
  if (g.kick) await H.tapSel('#mK');
  else if (g.stage === 'call' && g.sheet) {
    if (g.sheetSide === 'O') { await H.tapSel('[data-f="pass"]'); await H.wait(200); const c = await page.$$('.sheet .plist .pc'); const el = c.length ? c[plays % Math.min(3, c.length)] : null; const b = el ? await el.boundingBox() : null; if (b && b.y + b.height < 844) await H.tapAt(b.x + b.width / 2, b.y + b.height / 2); else await H.tapSel('.sheet .pc'); plays++; }
    else if (g.sheetSide === 'PAT') await H.tapSel('[data-act="xp"]'); else await H.tapSel('.sheet .pc'); }
  else if (g.stage === 'pre' && g.side === 'O') await H.tapSel('.acts [data-a="snap"]');
  else if (g.stage === 'live' && g.acts.includes('away') && (await page.evaluate(() => MATCH._G.play.liveT)) > 2.6) await page.keyboard.press('Digit1');
  await H.wait(150); }
const r = await page.evaluate(() => { const s = window.__bs.samples.slice().sort((a, b) => a - b), q = p => Math.round(s[Math.floor(p * (s.length - 1))] || 0); return { frames: window.__bs.frames, samples: s.length, median: q(0.5), p90: q(0.9), p99: q(0.99), max: Math.round(s[s.length - 1] || 0), jumpsOver21px: window.__bs.jumps }; });
console.log('bubble screen speed while the QB holds the ball (px/s):', JSON.stringify(r), `over ${plays} pass plays`);
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
