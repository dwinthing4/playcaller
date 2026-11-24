// Realism features on screen: the weather chip + wind arrow, the crowd meter (you on the road, 3rd down), a flag thrown in a live
// play (the 3D flag + FLAG in the scorebug), take-the-penalty-or-the-play, the referee's call, a false start, an onside kick.
// run: node tools/build.mjs && node qa/realism_look.mjs [desk|phone]   (screenshots in qa/shots/realism)
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
let n = 0; const shot = async t => { const f = path.join(shots, `${which}_${String(n++).padStart(2, '0')}_${t}.png`); await page.screenshot({ path: f }); console.log('shot', path.relative(root, f)); };
const wait = ms => page.waitForTimeout(ms);
const G = () => page.evaluate(() => { const g = MATCH._G, pl = g && g.play; return g ? { ready: !!g.ready, stage: g.stage, side: g.userSide, sheet: g.sheet && g.sheet.side, phase: pl && pl.phase, fouls: (g.fouls || []).length, wait: !!g.penWait, ret: !!(pl && pl.ret), kpow: !!g.kpow, poss: g.poss, user: g.user, down: g.down, togo: g.togo, yl: g.yl, ref: document.querySelector('.refc.show') ? document.querySelector('.refc').textContent : '' } : null; });
const until = async (f, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const g = await G(); if (g && f(g)) return g; await wait(150); } return await G(); };
// you on the road, in the rain, with a wind
await page.evaluate(() => { NG.slot = 2; NG.qlen = 120; createLeague(); pickTeam(L.teams[5].id); L.week = 13; R3D.venueOverride = { weather: 'rain', tod: 'night', wind: 17, windDir: 0.9 }; });
await page.evaluate(() => { const me = L.teams[L.user], home = L.teams.find(t => t.id !== me.id); MATCH.open({ g: { h: home.id, a: me.id, wk: 13 }, home, away: me, userTid: me.id, mode: 'play', onDone: () => { } }); });
await until(g => g.stage === 'load' && g.ready, 120000);
await page.click('#mKick'); await wait(400);
// skip the kickoff: our ball, 3rd & 7 near midfield in a close game, late: the crowd is up
const setup = (o) => page.evaluate(o => { const g = MATCH._G; g.timers = []; g.play = null; g.kickAnim = null; g.kpow = null; g.kaim = null; g.retPlay = null; document.querySelector('.kbar').classList.remove('show', 'on'); Object.assign(g, { poss: g.user, kickNext: null, pat: null, ballX: 0 }, o); MATCH._.nextSnap(); }, o);
await setup({ yl: 46, down: 3, togo: 7, q: 4, clock: 70 });
await until(g => g.stage === 'call' && g.sheet === 'O');
await page.evaluate(() => { const c = [...document.querySelectorAll('.sheet .pc[data-id]')].find(c => { const p = L.plays.find(x => x.id === c.dataset.id); return p && p.type === 'pass'; }); c && c.click(); });
await until(g => g.stage === 'pre'); await wait(900); await shot('pre_snap_weather_crowd');
// a hot route: tap a receiver's tag (twice: go, then slant ...)
const hr = await page.evaluate(() => { const b = document.querySelector('.rb.hr'); if (!b) return null; const before = b.querySelector('u').textContent; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return before; });
await wait(350); const hr2 = await page.evaluate(() => { const b = document.querySelector('.rb.hr'); return b ? b.querySelector('u').textContent : null; }); console.log('hot route', hr, '->', hr2); await shot('hot_route');
// snap; a defender grabs a receiver: the flag comes out mid-play
await page.evaluate(() => { const g = MATCH._G; g.pre = null; }); await page.keyboard.press('Space').catch(() => { });
if (phone) await page.evaluate(() => { const g = MATCH._G; if (g.stage === 'pre') g.play.snap(); });
await until(g => g.phase === 'live'); await wait(700);
await page.evaluate(() => { MATCH._G.penAsk = true; MATCH._.foul('OFS', 'D'); }); await wait(320); await shot('flag_thrown');
await wait(500); await shot('flag_down');
// let the AI finish the play (throw it for us)
await page.evaluate(() => { const g = MATCH._G, pl = g.play; if (pl && pl.receivers && pl.receivers[0] && pl.canThrow && pl.canThrow()) pl.throwTo(pl.receivers[0]); });
let g = await until(g => g.wait || (g.ref && g.stage !== 'live') || g.stage === 'call', 20000);
await wait(500); await shot(g.wait ? 'accept_decline' : 'ref_call');
if (g.wait) { await page.evaluate(() => { const b = document.querySelector('[data-pc].pri') || document.querySelector('[data-pc]'); b && b.click(); }); await wait(600); await shot('ref_call_after_choice'); }
// a false start: the tackle jumps, the whistle, the call
await until(g => g.stage === 'call' && g.sheet === 'O', 20000);
await page.evaluate(() => { const c = [...document.querySelectorAll('.sheet .pc[data-id]')].find(c => { const p = L.plays.find(x => x.id === c.dataset.id); return p && p.type === 'run'; }); c && c.click(); });
await until(g => g.stage === 'pre'); await wait(500);
await page.evaluate(() => { const g = MATCH._G, lt = g.play.O.find(p => p.slot === 'LT') || g.play.O[0]; g.pre = { code: 'FS', by: g.poss, pid: lt.pid, pre: true, dead: true }; });
await page.evaluate(() => { const g = MATCH._G; if (g.stage === 'pre') { const b = document.querySelector('[data-a=snap]'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } });
await wait(700); await shot('false_start_flag'); await wait(900); await shot('false_start_call');
// an onside kick (ours), lined up and in the air
await wait(2500);
await page.evaluate(() => { const g = MATCH._G; g.timers = []; g.play = null; g.retPlay = null; g.kickNext = null; g.pat = null; g.fouls = []; MATCH._.doKickoff(g.user); });
await until(g => g.kpow, 8000); await page.evaluate(() => MATCH._G.kpick && MATCH._G.kpick('onside')); await wait(700); await shot('onside_lined_up');
await page.evaluate(() => { const g = MATCH._G; if (g.kpow) g.kpow(); }); await wait(650); await shot('onside_in_air'); await wait(1100); await shot('onside_scrum');
await until(g => g.phase === 'dead' || g.stage === 'call', 9000); await wait(600); await shot('onside_result');
console.log(which, errs.length ? 'ERRORS:\n  ' + errs.join('\n  ') : 'no console errors');
await browser.close();
