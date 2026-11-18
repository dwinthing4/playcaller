// Trace the renderer crash seen after a phone throw-away: log every step + JS heap until the tab dies.
import { launch } from '../lib.mjs';
import fs from 'fs';
const seed = +(process.argv[2] || 5), which = process.argv[3] || 'phone', mode = process.argv[4] || 'away';
const H = await launch(which, { tag: 'r2_crash_' + mode, seed, file: 'playcaller_qa3.html' });
const { page } = H; const out = []; const t00 = Date.now(); const log = (...a) => { const s = ((Date.now() - t00) / 1000).toFixed(1) + 's ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); fs.writeFileSync(`C:/Users/dwint/football-game/qa/tester/r2/out_mycrash_${mode}_${which}_${seed}.txt`, out.join('\n')); };
let crashed = false; page.on('crash', () => { crashed = true; log('PAGE CRASH event'); });
await H.newLeague(60, 5); await H.startGame('play'); await page.evaluate(fs.readFileSync('C:/Users/dwint/football-game/qa/tester/monitor.js', 'utf8')); await H.tapSel('#mKick');
const tap = async sel => { const e = await page.$(sel); if (!e) return false; await e.scrollIntoViewIfNeeded().catch(() => { }); const r = await e.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
const st = () => page.evaluate(() => { const g = MATCH._G, p = g && g.play; return { stage: g.stage, phase: p && p.phase, q: g.q, clock: +g.clock.toFixed(1), down: g.down, yl: +g.yl.toFixed(1), side: g.sheet && g.sheet.side, sheet: !!document.querySelector('.sheet.show'), kick: !!g.kickCb, kAnim: !!g.kickAnim, heap: Math.round(performance.memory.usedJSHeapSize / 1e6), ball: p && p.ball ? p.ball.state + (p.ball.p ? `@${p.ball.p.x.toFixed(1)},${p.ball.p.y.toFixed(1)},${p.ball.p.z.toFixed(1)}` : '') : null, liveT: p ? +p.liveT.toFixed(2) : null, timers: g.timers.length, ban: (document.querySelector('.ban.show') || {}).textContent || '' }; });
let last = '';
for (let i = 0; i < 2000 && !crashed; i++) {
  let s; try { s = await st(); } catch (e) { log('evaluate failed:', e.message.split('\n')[0]); break; }
  const key = JSON.stringify({ ...s, heap: 0, clock: 0, liveT: 0 }); if (key !== last || i % 25 === 0) { log(JSON.stringify(s)); last = key; }
  try {
    if (s.kick) { await tap('#mK'); }
    else if (s.stage === 'call' && s.sheet) {
      if (s.side === 'PAT') await tap('[data-act="xp"]');
      else if (s.side === 'O') { await tap('[data-f="pass"]'); await new Promise(r => setTimeout(r, 200)); const id = await page.evaluate(() => { const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); const p = MATCH._G.sheet.pool.find(p => ids.includes(p.id) && p.type === 'pass' && !/Screen/.test(p.name)); return p ? p.id : ids[0]; }); log('calling pass', id); await tap(`.sheet .plist [data-id="${id}"]`); }
      else await tap('.sheet .pc');
    }
    else if (s.stage === 'pre' && (await H.G()).side === 'O') { await tap('.acts [data-a="snap"]'); }
    else if (s.stage === 'live' && (await H.G()).acts.includes('away') && s.liveT > 1.2) { log('tapping Throw away at liveT', s.liveT); await tap('.acts [data-a="away"]'); }
  } catch (e) { log('action failed:', e.message.split('\n')[0]); if (/crash/i.test(e.message)) break; }
  await new Promise(r => setTimeout(r, 120));
  if (Date.now() - t00 > 300000) break;
}
log('crashed', crashed, 'errs', H.errs);
await H.close().catch(() => { });
