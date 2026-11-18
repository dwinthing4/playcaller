// Phone landscape (844x390), real taps: chips, full play list scroll + card tap, action row, D sheet, hidden sheet during the play.
import { launch } from '../lib.mjs';
import fs from 'fs';
const H = await launch('phone', { tag: 'r2_land', seed: 7, file: 'playcaller_qa2.html' });
const { page } = H; const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); };
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
await page.setViewportSize({ width: 844, height: 390 }); await H.wait(500);
const hits = sel => page.evaluate(s => [...document.querySelectorAll(s)].map(b => { const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y); return `${(b.dataset.f || b.dataset.act || b.dataset.id || b.textContent).slice(0, 14)} box ${Math.round(r.top)}-${Math.round(r.bottom)} visible ${(() => { let p = b.parentElement; const pr = p.getBoundingClientRect(); return Math.max(0, Math.round(Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top))); })()}px ${h === b || b.contains(h) ? 'tappable' : 'NOT(' + (h ? h.className || h.tagName : '-') + ')'}`; }), sel);
const g = await H.until(g => g.stage === 'call' && g.sheet, 60000, 150); await H.wait(500);
log('sheet', g.sheetSide, 'chips', await hits('.sheet .chips [data-f]'));
// tap the "All" chip where a finger would (its visible centre)
const all = await page.evaluate(() => { const b = document.querySelector('.sheet [data-f="all"]'), r = b.getBoundingClientRect(), pr = b.parentElement.getBoundingClientRect(); const top = Math.max(r.top, pr.top), bot = Math.min(r.bottom, pr.bottom); return { x: r.left + r.width / 2, y: (top + bot) / 2 }; });
await H.tapAt(all.x, all.y); await H.wait(400);
const st = await page.evaluate(() => ({ filter: MATCH._G.sheet.filter, plist: (() => { const p = document.querySelector('.sheet .plist'); if (!p) return null; const r = p.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), scrollH: p.scrollHeight, clientH: p.clientHeight, cards: p.children.length }; })() }));
log('tapped All at', all, '->', st); await H.shot('land_all');
if (st.plist) {
  const sw = async (x, y0, y1) => { await H.touchDown(x, y0); for (let i = 1; i <= 8; i++) { await H.touchMove(x, y0 + (y1 - y0) * i / 8); await H.wait(16); } await H.touchUp(); await H.wait(400); };
  await sw(640, 330, 120); const s1 = await page.evaluate(() => document.querySelector('.sheet .plist').scrollTop); log('swipe up on the play list -> scrollTop', s1);
  const card = await page.evaluate(() => { const cs = [...document.querySelectorAll('.sheet .plist .pc')]; for (const c of cs) { const r = c.getBoundingClientRect(); if (r.top > 80 && r.bottom < 385) { const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { id: c.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2, ok: h === c || c.contains(h) }; } } return null; });
  log('first fully visible card after the swipe', card); if (card) { await H.tapAt(card.x, card.y); const p = await H.until(g => g.stage === 'pre', 3000, 50); log('tapped it -> play called', !!p, p && (await page.evaluate(() => MATCH._G.play.op.id)) === card.id); }
}
// hidden sheet must not catch taps during the play
await H.wait(400); log('during pre-snap: sheet visibility', await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')).visibility), 'snap', await H.hitTest('.acts [data-a="snap"]'), 'pause', await H.hitTest('.mbtn.pause'));
await H.tapSel('.acts [data-a="snap"]'); await H.until(g => g.acts.includes('away') || g.stage === 'dead', 4000, 30); await H.wait(600);
log('live landscape: bubbles', await hits('.bub .rb'), 'away', await H.hitTest('[data-a="away"]')); await H.shot('land_live');
await H.until(g => g.stage === 'call' && g.sheet, 30000, 150);
// D sheet in landscape
for (let i = 0; i < 300; i++) { const g2 = await H.G(); if (g2.stage === 'call' && g2.sheet && g2.sheetSide === 'D') break; if (g2.kick) { await H.tapSel('#mK'); } else if (g2.stage === 'call' && g2.sheet) { if (g2.sheetSide === 'PAT') await H.tapSel('[data-act="xp"]'); else await H.tapSel('.sheet .pc'); } else if (g2.stage === 'pre' && g2.side === 'O') await H.tapSel('.acts [data-a="snap"]'); else if (g2.stage === 'live' && g2.acts.includes('away')) await page.keyboard.press('Digit1'); await H.wait(300); }
await H.wait(500); log('D sheet landscape: chips', await hits('.sheet .chips [data-f]'), 'acts', await hits('.sheet .sh-acts [data-act]')); await H.shot('land_D');
log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
fs.writeFileSync('C:/Users/dwint/football-game/qa/tester/r2/out_landscape2.txt', out.join('\n'));
await H.close();
