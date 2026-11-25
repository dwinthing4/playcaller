// Broadcast package capture: watches a whole game and screenshots each graphic the first time it shows (win-probability bar,
// booth caption, drive summary, scoring card, stat plate, halftime card, final card with the graph), then the stats viewer tabs
// (win %, team, pass chart, run map, routes, separation), the pause-menu button, and a caption + lower third over the play-call sheet.
// run: node tools/build.mjs && node qa/bcast_cap.mjs [desk|phone] [speed=2]   (screenshots in qa/shots/bcast/<size>)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const which = process.argv[2] || 'desk', speed = +(process.argv[3] || 2);
const out = path.join(root, 'qa', 'shots', 'bcast', which); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 });
const page = await ctx.newPage(); const errs = [], fails = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
const check = (c, what) => { if (!c) fails.push(what); console.log((c ? 'PASS ' : 'FAIL ') + what); };
let n = 0; const shot = async name => { for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: path.join(out, `${String(n).padStart(2, '0')}_${name}.png`) }); n++; return; } catch (e) { await page.waitForTimeout(400); } } console.log('(screenshot failed: ' + name + ')'); };
const wait = ms => page.waitForTimeout(ms);
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await wait(700);
await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 6; NG.qlen = 60; createLeague(); pickTeam(L.teams[5].id); L.settings.comm = 'on'; startUserGame('watch'); });
for (let i = 0; i < 300; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await wait(300); }
await page.click('#mKick').catch(() => { });
await page.evaluate(s => { const G = MATCH._G; G.speed = s; const i = document.querySelector('.spdbar input'); if (i) { i.value = String([1, 2, 4, 10, 20].indexOf(s)); i.dispatchEvent(new Event('input', { bubbles: true })); } }, speed);
// watch: shoot each graphic once
const seen = {}, want = ['wp', 'cap', 'drive', 'score', 'plate', 'half'], t0 = Date.now(); let capN = 0;
while (Date.now() - t0 < 270000) {
  const s = await page.evaluate(() => { const G = MATCH._G; if (!G) return null; const q = c => document.querySelector(c);
    return { stage: G.stage, q: G.q, over: G.over, wp: !!q('.bcwp.on') && G.stage !== 'live' && G.stage !== 'kick', cap: !!q('.bccap.show'), drive: !!q('.bclt.show.k-drive'), score: !!q('.bclt.show.k-score'), plate: !!q('.bclt.show.k-plate'), half: !!q('.bcbig.show'), fin: !!document.getElementById('mDone') }; });
  if (!s) break; if (s.fin) break;
  if (s.cap && capN < 4) { capN++; await wait(400); await shot('caption' + capN); }
  for (const k of want) if (s[k] && !seen[k]) { seen[k] = 1; await wait(650); await shot(k); }
  await wait(220);
}
for (const k of want) check(seen[k], `showed: ${k}`);
check(capN >= 2, `booth captions shown (${capN})`);
for (let i = 0; i < 60; i++) { if (await page.$('#mDone')) break; await wait(500); }
const d = await page.evaluate(() => { const B = BCAST._(), G = MATCH._G; const rt = B.plays.filter(r => Object.keys(r.rt).length).length, sep = B.plays.filter(r => r.sep != null).length, runs = B.plays.filter(r => r.cp && r.cp.length > 2).length;
  return { plays: B.plays.length, wph: B.wph.length, last: B.wph[B.wph.length - 1], rt, sep, runs, said: B.said.size, top: B.top, third: B.third, score: [G.score[G.aid], G.score[G.hid]], lines: [...B.said].slice(0, 40) }; });
console.log(`plays ${d.plays}, wp samples ${d.wph}, last wp ${d.last && d.last.wp}, with routes ${d.rt}, with separation ${d.sep}, runs with a path ${d.runs}, lines said ${d.said}, score ${d.score.join('-')}`);
console.log('  ' + d.lines.join('\n  '));
check(d.plays >= 15 && d.wph >= 20, 'plays and win-probability history recorded');
check(d.last && (d.last.wp === 100 || d.last.wp === 0 || d.last.wp === 50), 'final win probability is 100/0/50');
check(d.rt >= 5 && d.sep >= 2 && d.runs >= 2, 'route, separation and run data collected');
await shot('final');
await page.evaluate(() => { const c = document.querySelector('.ovl .card'); const g = c && c.querySelector('.bcfin'); if (g) g.scrollIntoView(); }); await wait(300); await shot('final_graph');
check(await page.$('.ovl .bcfin .bcwpg svg') != null, 'final card has the win-probability graph');
// the viewer, every tab
for (const [k, lab] of [['team', 'team'], ['pass', 'pass'], ['run', 'run'], ['route', 'route'], ['sep', 'sep']]) {
  await page.evaluate(k => { const b = document.querySelector(`.ovl [data-bcopen="${k}"]`); if (b) b.click(); }, k); await wait(350);
  const ok = await page.evaluate(() => !!document.querySelector('.bcview.show .bcv-b') && document.querySelector('.bcview.show .bcv-b').children.length > 0); check(ok, 'viewer tab: ' + lab);
  if (k === 'pass') { const has = await page.$('.bcview .bcf circle, .bcview .bcf .m-x'); check(!!has, 'pass chart has marks'); }
  if (k === 'pass' || k === 'route') { const m = await page.$('.bcview .bcf [data-tip]'); if (m) { const bb = await m.boundingBox(); if (bb) await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await wait(150); } }
  await shot('view_' + lab);
  await page.evaluate(() => { const x = document.querySelector('.bcview [data-bc="x"]'); if (x) x.click(); }); await wait(200);
}
await page.evaluate(() => { const b = document.querySelector('.ovl [data-bcopen="team"]'); if (b) b.click(); }); await wait(300);
await page.evaluate(() => { const b = document.querySelector('.bcview [data-bct="wp"]'); if (b) b.click(); }); await wait(300);
{ const g = await page.$('.bcview .bcwpg svg'); if (g) { const bb = await g.boundingBox(); await page.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height / 2); await wait(200); } }
await shot('view_wp');
await page.evaluate(() => { const x = document.querySelector('.bcview [data-bc="x"]'); if (x) x.click(); document.getElementById('mDone').click(); }); await wait(800);
// play mode: the pause menu button, and a caption + drive summary over the play-call sheet
await page.evaluate(() => { startUserGame('play'); });
for (let i = 0; i < 300; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await wait(300); }
await page.click('#mKick').catch(() => { });
for (let i = 0; i < 200; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.stage === 'call' && MATCH._G.sheet)) break; await page.keyboard.press('Space'); await wait(300); }
await wait(600);
await page.evaluate(() => { const B = BCAST._(), G = MATCH._G; B.q2.push({ who: 1, text: 'Third and seven. They have thrown it on every third down today, and the defense knows it.', pri: 2, at: B.t, exp: B.t + 9 });
  const d = { tid: G.poss === G.hid ? G.aid : G.hid, start: 22, plays: 7, yds: 41, q: 1, result: 'Punt', top: 133 }; B.ltq.push({ html: BCAST._drive(G, d), kind: 'drive', dur: 8, at: B.t, exp: B.t + 10 }); });
await wait(900); await shot('sheet_caption');
check(await page.evaluate(() => { const c = document.querySelector('.bccap.show'), s = document.querySelector('#gui .sheet.show'); if (!c || !s) return false; return c.getBoundingClientRect().bottom <= s.getBoundingClientRect().top + 1; }), 'caption sits above the play-call sheet');
await page.evaluate(() => document.querySelector('#hud .pause').click()); await wait(400); await shot('pause_menu');
check(!!(await page.$('.ovl [data-bcopen]')), 'pause menu has Game stats');
await page.evaluate(() => document.querySelector('.ovl [data-bcopen]').click()); await wait(400); await shot('pause_stats');
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors'); check(!errs.length, 'no console errors');
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS', out); await browser.close(); process.exitCode = fails.length ? 1 : 0;
