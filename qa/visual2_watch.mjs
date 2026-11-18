// Round-2 WATCH mode at the real game camera: adaptive 80 ms paused bursts (line play, contact, catch, pile-up), plus
// forced goal-line snaps for TD celebrations. run: node qa/visual2_watch.mjs phone|desk|land [plays]
import { open, installAdv, waitReady } from './visual2_lib.mjs';
const which = process.argv[2] || 'phone', MAXP = +(process.argv[3] || 8);
const { page, shot, log, done } = await open(which, 'watch_' + which);
const S = (name) => shot(name, null).then(async f => { const st = await page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, phase: pl && pl.phase, t: pl && +pl.t.toFixed(3), ball: pl && pl.ball && pl.ball.state, down: pl ? pl.players.filter(p => !p.upright()).length : 0, res: pl && pl.result && pl.result.type, yl: g.yl }; }).catch(() => null); log.push({ f, ...st }); return f; });
await page.evaluate(() => { NG.slot = 2; NG.qlen = 120; createLeague(); pickTeam(L.teams[9].id); startUserGame('watch'); });
await waitReady(page); await installAdv(page);
const st = () => page.evaluate(() => { const g = MATCH._G, pl = g.play; if (!pl) return {}; return { phase: pl.phase, t: pl.t, liveT: pl.liveT, ball: pl.ball.state, carUp: pl.carrier ? pl.carrier.upright() : true, wrapped: pl.players.filter(p => p.wrapped).length, thrown: !!pl.thrown, res: pl.result && pl.result.type }; });
async function livePlay(tag) {
  await page.evaluate(() => { MATCH._G.paused = true; });
  let k = 0, s, thrownAt = -1, contactAt = -1, deadAt = -1, sparse = 0;
  for (let i = 0; i < 170; i++) {
    s = await st();
    if (s.thrown && thrownAt < 0) thrownAt = s.t;
    if ((s.wrapped > 0 || !s.carUp) && contactAt < 0) contactAt = s.t;
    if (s.phase === 'dead' && deadAt < 0) deadAt = s.t;
    const near = (x, a, b) => x >= 0 && s.t >= x + a && s.t <= x + b;
    const dense = s.liveT < 0.75 || near(thrownAt, 0, 1.6) || near(contactAt, -0.1, 1.1) || near(deadAt, 0, 1.6);
    if (dense || ++sparse % 5 === 0) await S(`${tag}_f${String(k++).padStart(2, '0')}`);
    if (deadAt >= 0 && s.t > deadAt + 1.6) break;
    await page.evaluate(ms => window.__adv(ms), 80);
  }
  await page.evaluate(() => { MATCH._G.paused = false; });
  await page.waitForTimeout(200); await S(`${tag}_whistle`);
  return s.res;
}
let plays = 0, last = '', stuck = 0, forced = 0, banN = 0; const t0 = Date.now();
while (plays < MAXP && stuck < 300 && Date.now() - t0 < 520000) {
  const g = await page.evaluate(() => { const g = MATCH._G; if (!g) return null; return { stage: g.stage, phase: g.play && g.play.phase, yl: g.yl, ban: !!document.querySelector('.ban.show'), pat: !!g.pat, over: g.over }; });
  if (!g || g.over) break;
  const key = g.stage + g.phase + g.yl; if (key === last) stuck++; else stuck = 0; last = key;
  if (g.ban && banN < 12) { banN++; await S('banner'); await page.waitForTimeout(500); }
  if (g.stage === 'dead' && !g.pat && plays >= 2 && plays % 3 === 2 && forced < 2) { await page.evaluate(() => { const g = MATCH._G; g.yl = 97; g.down = 1; g.togo = 3; }); forced++; }
  if (g.stage === 'pre' && g.phase === 'pre') {
    const tag = `p${plays}`; await page.waitForTimeout(300); await S(`${tag}_presnap`);
    for (let i = 0; i < 80; i++) { const h = await page.evaluate(() => MATCH._G.stage); if (h === 'live') break; await page.waitForTimeout(40); }
    const isPass = await page.evaluate(() => !!(MATCH._G.play && MATCH._G.play.pass));
    const res = await livePlay(tag + (isPass ? '_pass' : '_run')); plays++; console.log('play', plays, isPass ? 'pass' : 'run', res);
    continue;
  }
  await page.waitForTimeout(150);
}
log.push({ stats: await page.evaluate(() => R3D.stats()) });
await done();
