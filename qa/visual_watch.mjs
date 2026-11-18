// Visual review capture, WATCH mode: many AI plays with adaptive 80 ms bursts (line play, contact, catch, pile-up),
// plus forced goal-line snaps for TD celebrations. run: node qa/visual_watch.mjs phone|desk [plays]
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game';
const which = process.argv[2] || 'phone', MAXP = +(process.argv[3] || 10);
const shots = path.join(root, 'qa', 'shots', 'visual', which + '_watch'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 3] : which === 'land' ? [844, 390, 3] : [1280, 800, 1];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1 });
const page = await ctx.newPage(); const errs = []; const log = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
await page.goto('file:///' + root + '/dist/playcaller_qa.html'); await page.waitForTimeout(900);
let n = 0; const shot = async (name, extra) => { const f = `${String(n++).padStart(3, '0')}_${name}.png`; await page.screenshot({ path: path.join(shots, f) }); const st = await page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, phase: pl && pl.phase, t: pl && +pl.t.toFixed(3), ball: pl && pl.ball && pl.ball.state, car: pl && pl.carrier && pl.carrier.slot, down: pl ? pl.players.filter(p => !p.upright()).length : 0, wrapped: pl ? pl.players.filter(p => p.wrapped).length : 0, res: pl && pl.result && pl.result.type, yl: g.yl }; }).catch(() => null); log.push({ f, ...st, ...(extra || {}) }); return f; };
await page.evaluate(() => { NG.slot = 2; NG.qlen = 120; createLeague(); pickTeam(L.teams[9].id); });
await page.evaluate(() => startUserGame('watch'));
for (let i = 0; i < 400; i++) { const r = await page.evaluate(() => MATCH._G && MATCH._G.ready); if (r) break; await page.waitForTimeout(500); }
await page.evaluate(() => { window.__adv = ms => new Promise(res => { let left = ms / 1000; const f = () => { const g = MATCH._G, pl = g && g.play; if (!pl) return res(); const d = Math.min(left, 1 / 60), k = Math.round(d / PHYS.DT); for (let i = 0; i < k; i++) pl.step(PHYS.DT); left -= d; if (left > 1e-6) requestAnimationFrame(f); else requestAnimationFrame(() => requestAnimationFrame(res)); }; requestAnimationFrame(f); }); });
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
    if (dense || ++sparse % 5 === 0) await shot(`${tag}_f${String(k++).padStart(2, '0')}`, { win: dense ? 'dense' : 'sparse' });
    if (deadAt >= 0 && s.t > deadAt + 1.6) break;
    await page.evaluate(ms => window.__adv(ms), 80);
  }
  await page.evaluate(() => { MATCH._G.paused = false; });
  await page.waitForTimeout(200); await shot(`${tag}_whistle`);
  return s.res;
}
let plays = 0, last = '', stuck = 0, forced = 0, banN = 0;
const t0 = Date.now();
while (plays < MAXP && stuck < 300 && Date.now() - t0 < 520000) {
  const g = await page.evaluate(() => { const g = MATCH._G; if (!g) return null; return { stage: g.stage, phase: g.play && g.play.phase, yl: g.yl, ban: !!document.querySelector('.ban.show'), pat: !!g.pat, over: g.over }; });
  if (!g || g.over) break;
  const key = g.stage + g.phase + g.yl; if (key === last) stuck++; else stuck = 0; last = key;
  if (g.ban && banN < 12) { banN++; await shot('banner'); await page.waitForTimeout(500); }
  // force goal-line snaps every 3rd play from play 4 on (TD celebrations)
  if (g.stage === 'dead' && !g.pat && plays >= 3 && plays % 3 === 0 && forced < 3) { await page.evaluate(() => { const g = MATCH._G; g.yl = 97; g.down = 1; g.togo = 3; }); forced++; }
  if (g.stage === 'pre' && g.phase === 'pre') {
    const tag = `p${plays}`; await page.waitForTimeout(300); await shot(`${tag}_presnap`);
    for (let i = 0; i < 80; i++) { const h = await page.evaluate(() => MATCH._G.stage); if (h === 'live') break; await page.waitForTimeout(40); }
    const isPass = await page.evaluate(() => !!(MATCH._G.play && MATCH._G.play.pass));
    const res = await livePlay(tag + (isPass ? '_pass' : '_run')); plays++; console.log('play', plays, isPass ? 'pass' : 'run', res);
    continue;
  }
  await page.waitForTimeout(150);
}
fs.writeFileSync(path.join(shots, 'log.json'), JSON.stringify(log, null, 1));
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
