// Fake punt and fake field goal from the call sheet: the kicking unit lines up, the snap, the result. Also runs 30 CPU fakes headless-ish
// (instant mode) to check they resolve. run: node tools/build.mjs && node qa/fake_look.mjs [desk|phone]   (screenshots in qa/shots/realism)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const shots = path.join(root, 'qa', 'shots', 'realism'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const which = process.argv[2] || 'desk', phone = which === 'phone';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(500);
const shot = async t => { const f = path.join(shots, `${which}_fake_${t}.png`); await page.screenshot({ path: f }); console.log('shot', path.relative(root, f)); };
const wait = ms => page.waitForTimeout(ms);
const G = () => page.evaluate(() => { const g = MATCH._G, pl = g && g.play; return g ? { ready: !!g.ready, stage: g.stage, sheet: g.sheet && g.sheet.side, phase: pl && pl.phase, yl: g.yl, down: g.down, last: g.pbp.slice(-2).join(' | ') } : null; });
const until = async (f, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const g = await G(); if (g && f(g)) return g; await wait(150); } return await G(); };
await page.evaluate(() => { NG.slot = 2; NG.qlen = 120; createLeague(); pickTeam(L.teams[5].id); startUserGame('play'); });
await until(g => g.ready, 120000); await page.evaluate(() => { MATCH._G.noFlags = true; }); await page.click('#mKick'); await wait(400);
const setup = o => page.evaluate(o => { const g = MATCH._G; g.timers = []; g.play = null; g.kickAnim = null; g.kpow = null; g.kaim = null; g.retPlay = null; document.querySelector('.kbar').classList.remove('show', 'on'); Object.assign(g, { poss: g.user, kickNext: null, pat: null, ballX: 0 }, o); MATCH._.nextSnap(); }, o);
for (const [k, o, act] of [['punt', { yl: 42, down: 4, togo: 2 }, 'fakep'], ['fg', { yl: 74, down: 4, togo: 6 }, 'fakefg']]) {
  await setup(o); await until(g => g.stage === 'call' && g.sheet === 'O');
  const has = await page.evaluate(a => { const b = document.querySelector(`[data-act=${a}]`); if (b) b.click(); return !!b; }, act); console.log(k, 'button', has);
  await until(g => g.stage === 'pre'); await wait(900); await shot(k + '_lined_up');
  await page.evaluate(() => MATCH._G.play.snap()); await wait(1200); await shot(k + '_live');
  const g = await until(g => g.stage === 'call' || g.phase === 'dead', 20000); await wait(400); await shot(k + '_result'); console.log(k, 'result:', g && g.last);
}
// CPU fakes in an instant game: force them on and make sure every one resolves
const r = await page.evaluate(() => new Promise(res => { const h = L.teams[1], a = L.teams[2]; setTimeout(() => { MATCH._G.fakeP = 1; }, 0); MATCH.open({ g: { h: h.id, a: a.id }, home: h, away: a, userTid: h.id, mode: 'instant', onDone: r => res({ hs: r.hs, as: r.as, fakes: r.pbp.filter(x => /fake/.test(x)).length, pbp: r.pbp.filter(x => /fake/.test(x)).slice(0, 4) }) }); }));
console.log('instant game', r.as, '-', r.hs, 'fakes', r.fakes, JSON.stringify(r.pbp));
console.log(which, errs.length ? 'ERRORS:\n  ' + errs.join('\n  ') : 'no console errors');
await browser.close();
