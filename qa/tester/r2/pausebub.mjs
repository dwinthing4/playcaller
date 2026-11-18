// After pausing and resuming mid-play, do bubble taps still throw? Log the pointerdown target and throwTo's return value.
import { launch } from '../lib.mjs';
const which = process.argv[2] || 'desk';
const H = await launch(which, { tag: 'r2_pausebub_' + which, seed: +(process.argv[3] || 3), file: 'playcaller_qa2.html' });
const { page } = H;
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
const tap = async sel => { const e = await page.$(sel); if (!e) return false; const r = await e.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
await page.evaluate(() => { window.__pd = []; document.addEventListener('pointerdown', e => window.__pd.push((e.target.className || e.target.tagName) + (e.target.dataset && e.target.dataset.r ? '[' + e.target.dataset.r + ']' : '')), true); });
async function toO() { for (let i = 0; i < 900; i++) { const g = await H.G(); if (g.kick) await tap('#mK'); else if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'O') return; if (g.sheetSide === 'PAT') await tap('[data-act="xp"]'); else await tap('.sheet .pc'); } else if (g.stage === 'pre' && g.side === 'O') await tap('.acts [data-a="snap"]'); else if (g.stage === 'live' && g.acts.includes('away')) await page.keyboard.press('Digit1'); await H.wait(200); } }
for (let rep = 0; rep < 6; rep++) {
  const withPause = rep % 2 === 0;
  await toO(); await H.wait(450); await tap('[data-f="pass"]'); await H.wait(250);
  const id = await page.evaluate(() => { const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); const p = MATCH._G.sheet.pool.find(p => ids.includes(p.id) && p.type === 'pass' && !/Screen/.test(p.name)); return p ? p.id : ids[0]; });
  await tap(`.sheet .plist [data-id="${id}"]`); await H.until(g => g.stage === 'pre', 3000, 40); await H.wait(350); await tap('.acts [data-a="snap"]');
  await H.until(g => g.acts.includes('away'), 6000, 20); await H.wait(300);
  if (withPause) { await tap('.mbtn.pause'); await H.wait(300); await tap('[data-m="resume"]'); await H.wait(250); }
  await page.evaluate(() => { const p = MATCH._G.play; const o = p.throwTo.bind(p); window.__tt = []; p.throwTo = r => { const v = o(r); window.__tt.push({ r: r.slot, ret: v, windup: p.qb.windup, scr: !!p.scramble, wrapped: p.D.some(d => d.wrapped), qz: +(p.qb.p.z - p.losZ).toFixed(2), up: p.qb.upright(), thrown: p.thrown, carrierQB: p.carrier === p.qb, ball: p.ball.state, phase: p.phase }); return v; }; });
  const t = await page.evaluate(() => { const n = document.querySelector('.bub .rb'); if (!n) return { none: true, stage: MATCH._G.stage, paused: MATCH._G.paused, ovl: document.querySelector('#gui .ovl').className, bub: document.querySelector('.bub').className, kids: document.querySelector('.bub').children.length, acts: [...document.querySelectorAll('.acts [data-a]')].map(b => b.dataset.a).join(','), liveT: MATCH._G.play.liveT, thrown: MATCH._G.play.thrown, carrierQB: MATCH._G.play.carrier === MATCH._G.play.qb, scr: !!MATCH._G.play.scramble }; const r = n.getBoundingClientRect(); return { slot: n.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2, bubOn: document.querySelector('.bub').className, acts: [...document.querySelectorAll('.acts [data-a]')].map(b => b.dataset.a).join(',') }; });
  if (t.none) { console.log(`[${rep}] ${withPause ? 'AFTER pause/resume' : 'no pause'}: NO BUBBLES`, JSON.stringify(t)); await H.until(g => g.stage !== 'live', 20000, 100); continue; }
  const n0 = await page.evaluate(() => window.__pd.length); await H.tapAt(t.x, t.y); await H.wait(80);
  const after = await page.evaluate(n => ({ pd: window.__pd.slice(n), tt: window.__tt, thrown: MATCH._G.play.thrown, windup: MATCH._G.play.qb.windup }), n0);
  console.log(`[${rep}] ${withPause ? 'AFTER pause/resume' : 'no pause        '} tap bubble ${t.slot} (${t.bubOn}, acts ${t.acts}) -> pointerdown ${JSON.stringify(after.pd)} throwTo calls ${JSON.stringify(after.tt)} thrown ${after.thrown} windup ${after.windup}`);
  await H.until(g => g.stage !== 'live', 20000, 100);
}
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
