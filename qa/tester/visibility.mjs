// Phone: during live plays, how often are the user's player, the ball (or its landing spot) and each receiver on screen?
import { launch } from './lib.mjs';
const H = await launch(process.argv[2] || 'phone', { tag: 'vis', seed: 41 });
const { page } = H;
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
const tapCard = async sel => { const c = await page.$(sel); if (!c) return false; const r = await c.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
await page.evaluate(() => { window.__vis = { D: { n: 0, me: 0, ball: 0, rec: 0, recN: 0 }, O: { n: 0, me: 0, ball: 0, rec: 0, recN: 0 } };
  const f = () => { requestAnimationFrame(f); const g = MATCH._G; if (!g || g.stage !== 'live' || !g.play || !g.userSide) return; const p = g.play, V = window.__vis[g.userSide], W = innerWidth, Hh = innerHeight;
    const on = (x, z, y = 1) => { const s = R3D.project(x, y, z); return !s.behind && s.x >= 0 && s.x <= W && s.y >= 90 && s.y <= Hh; };
    V.n++; const me = p.controlled(); if (me && on(me.p.x, me.p.z)) V.me++; else if (!me) V.me++;
    const b = p.ball.state === 'air' && p.ball.land ? p.ball.land : p.ball.p; if (b && on(b.x, b.z, 0.5)) V.ball++;
    for (const r of p.receivers) { V.recN++; if (on(r.p.x, r.p.z)) V.rec++; } }; requestAnimationFrame(f); });
let nD = 0, nO = 0;
for (let i = 0; i < 900 && (nD < 8 || nO < 6); i++) {
  const g = await H.G(); if (!g || g.stage === 'final') break;
  if (g.kick) { await tapCard('#mK'); await H.wait(600); continue; }
  if (g.stage === 'call' && g.sheet) { if (g.sheetSide === 'PAT') { await tapCard('[data-act="xp"]'); await H.wait(400); continue; }
    if (g.sheetSide === 'D') nD++; else { nO++; await tapCard('[data-f="pass"]'); await H.wait(200); await tapCard('.sheet .plist .pc'); await H.wait(300); continue; }
    await tapCard('.picks .pc'); await H.wait(300); continue; }
  if (g.stage === 'pre' && g.side === 'O') await tapCard('.acts [data-a="snap"]');
  if (g.stage === 'live' && g.acts.includes('away')) { const lt = await page.evaluate(() => MATCH._G.play.liveT); if (lt > 2.0) await page.evaluate(() => { const p = MATCH._G.play; let b = null, bo = -9; for (const r of p.receivers) { const o = p.openness(p.qb, r).open; if (o > bo) { bo = o; b = r; } } b && p.throwTo(b); }); }
  await H.wait(150);
}
const v = await page.evaluate(() => window.__vis); const pc = (a, b) => (a / Math.max(1, b) * 100).toFixed(0) + '%';
console.log(`on DEFENSE (${nD} calls, ${v.D.n} frames): your defender on screen ${pc(v.D.me, v.D.n)}, ball/landing spot ${pc(v.D.ball, v.D.n)}, receivers ${pc(v.D.rec, v.D.recN)}`);
console.log(`on OFFENSE (${nO} calls, ${v.O.n} frames): your player on screen ${pc(v.O.me, v.O.n)}, ball/landing spot ${pc(v.O.ball, v.O.n)}, receivers ${pc(v.O.rec, v.O.recN)}`);
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
