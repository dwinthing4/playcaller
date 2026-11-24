// Sound QA (src/render/30_audio.js). Nobody can listen in CI, so it measures:
//  1. every Sound-test sound rendered offline: peak / RMS / loudest 50 ms (dBFS), silent at the start and the end (no clicks), no NaN,
//     every voice cleaned up; WAVs in qa/shots/sound/ for a human to play later. Crowd and reactions at several levels too.
//  2. live in the game: the graph builds on a real click, a watch-mode game plays with sound (2x, then fast), voices and nodes stay
//     bounded, the limiter output never clips, nothing errors; a flood of engine events stays capped.
//  3. the Sound switch: off = suspended, master at 0, no new voices; the Settings panel and its test buttons.
//  4. frame time with sound on vs. off (same session, watch mode).
// run: node tools/build.mjs && node qa/sound_test.mjs [quick]
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const quick = process.argv[2] === 'quick';
const out = path.join(root, 'qa', 'shots', 'sound'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if ((m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) || (m.type() === 'warning' && /^sound:/.test(m.text()))) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(600);
let fails = 0; const bad = m => { fails++; console.log('  FAIL ' + m); };
console.log('SND present:', await page.evaluate(() => typeof SND !== 'undefined' && typeof PHYS.onEvent === 'function'));
console.log('before any tap:', JSON.stringify(await page.evaluate(() => SND.debug.ctx)));
await page.mouse.click(640, 400); await page.waitForTimeout(300);
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => SND.debug.buffers.includes('babble'))) break; await page.waitForTimeout(100); }
console.log('after a tap:', JSON.stringify(await page.evaluate(() => { const d = SND.debug; return { ctx: d.ctx, buffers: d.buffers }; })));

// ---- 1. offline renders
console.log('\n1. offline renders (dBFS, master volume 1.0; the game default is 0.7 = -3 dB)');
const jobs = [];
for (const [k] of await page.evaluate(() => SND.TESTS)) jobs.push([k, { dur: ['crowd', 'roar', 'rain', 'wind'].includes(k) ? 6 : ['groan', 'boo'].includes(k) ? 4 : k === 'horn' ? 4.8 : 2.4 }]);
for (const e of [0.15, 0.35, 0.6, 0.85, 1]) jobs.push(['crowdAt', { e, dur: 3, tag: 'e' + e }]);
jobs.push(['crowdAt', { e: 0.85, dome: true, dur: 3, tag: 'dome' }]);
jobs.push(['crowdAt', { e: 1, val: 1, clap: 1, dur: 3, tag: 'cheering' }]);
for (const kind of ['cheer', 'groan', 'ooh', 'boo', 'gasp']) jobs.push(['reactAt', { kind, size: 1, dur: 5.5, tag: kind }]);
jobs.push(['horn', { dur: 4.8, raw: true, tag: 'raw' }]); jobs.push(['bighit', { dur: 1.5, raw: true, tag: 'raw' }]); jobs.push(['sting', { dur: 2.4, raw: true, tag: 'raw' }]);
const table = [];
for (const [name, o] of jobs) {
  const r = await page.evaluate(([n, o]) => SND._render(n, Object.assign({ wav: true }, o)), [name, o]);
  if (!r) { bad('no OfflineAudioContext'); break; }
  const tag = name + (o.tag ? '_' + o.tag : ''); fs.writeFileSync(path.join(out, tag + '.wav'), Buffer.from(r.wav, 'base64'));
  table.push(`  ${tag.padEnd(18)} peak ${String(r.peak).padStart(6)}  rms ${String(r.rms).padStart(6)}  loudest50ms ${String(r.rmsMax).padStart(6)}  head ${String(r.head).padStart(6)}  tail ${String(r.tail).padStart(6)}${r.voicesLeft ? '  voicesLeft ' + r.voicesLeft : ''}`);
  if (r.nan) bad(tag + ' has NaN samples');
  if (r.peak > -0.5 && !o.raw) bad(tag + ' peaks at ' + r.peak + ' dBFS');
  if (!/crowd|roar|rain|wind|groan|boo|crowdAt/.test(name) && r.tail > -60) bad(tag + ' does not end in silence (' + r.tail + ' dBFS)');
  if (!/crowdAt|reactAt/.test(name) && r.head > -50 && !['crowd', 'roar', 'groan', 'boo', 'rain', 'wind'].includes(name)) bad(tag + ' is not silent before it starts (' + r.head + ')');
}
console.log(table.join('\n'));
if (process.argv[2] === 'render') { console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', fails ? fails + ' FAILURES' : ''); await browser.close(); process.exit(fails || errs.length ? 1 : 0); }

// ---- 2. live: a game in watch mode with sound
console.log('\n2. live game');
await page.evaluate(() => { NG.slot = 5; NG.qlen = 60; createLeague(); pickTeam(L.teams[4].id); L.settings.sound = true; L.settings.vol = 0.7; });
await page.mouse.click(10, 10); await page.waitForTimeout(200);
await page.evaluate(() => { startUserGame('watch'); });
for (let i = 0; i < 200; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready && MATCH._G.stage !== 'load')) break; await page.waitForTimeout(250); }
await page.click('#mKick').catch(() => { });
await page.evaluate(() => SND._meter(true));
const samples = []; let maxV = 0, maxN = 0, maxL = 0;
const sample = async () => { const d = await page.evaluate(() => { const d = SND.debug, G = MATCH._G; return Object.assign(d, { stage: G && G.stage, q: G && G.q, clock: G && Math.round(G.clock), score: G ? `${G.score[G.aid]}-${G.score[G.hid]}` : '', m: SND._meter() }); }); maxV = Math.max(maxV, d.voices); maxN = Math.max(maxN, d.nodes); maxL = Math.max(maxL, d.layerNodes); samples.push(d); return d; };
const secs2x = quick ? 40 : 150;
await page.evaluate(() => { const G = MATCH._G; G.speed = 2; });
for (let s = 0; s < secs2x; s++) { await page.waitForTimeout(1000); const d = await sample(); if (s % 15 === 0) console.log(`  t=${s}s ${d.stage} Q${d.q} ${d.clock}s ${d.score}  ctx ${d.ctx} voices ${d.voices} nodes ${d.nodes} layer ${d.layerNodes} energy ${d.energy} meter ${d.meter} events ${d.events} made ${d.made} dropped ${d.dropped} peak ${d.m && d.m.peak.toFixed(3)} limiter ${d.m && d.m.reduction.toFixed(1)}dB`); if (!(await page.evaluate(() => !!MATCH._G))) break; }
// the rest of the game fast (effects thin out above 3x, the bed stays)
await page.evaluate(() => { const G = MATCH._G; if (G) G.speed = 20; });
for (let s = 0; s < 400; s++) { await page.waitForTimeout(1000); const alive = await page.evaluate(() => !!MATCH._G && MATCH._G.stage !== 'final'); const d = await sample(); if (s % 20 === 0) console.log(`  fast t=${s}s ${d.stage} Q${d.q} ${d.score} voices ${d.voices} nodes ${d.nodes} layer ${d.layerNodes} energy ${d.energy} made ${d.made}`); if (!alive) break; }
const fin = await sample(); console.log('  end of game:', fin.stage, fin.score, 'peak out', fin.m && fin.m.peak.toFixed(3), 'max limiter reduction', fin.m && fin.m.reduction.toFixed(1), 'dB');
if (fin.m && fin.m.peak > 0.99) bad('the output clipped (peak ' + fin.m.peak + ')');
await page.evaluate(() => { const b = document.getElementById('mDone'); if (b) b.click(); else if (MATCH._G) MATCH._G.o && MATCH._G.o.onDone; });
await page.waitForTimeout(3500);
const after = await sample(); console.log(`  after close: ctx ${after.ctx} voices ${after.voices} nodes ${after.nodes} layer ${after.layerNodes} match ${after.match}  (max during the game: voices ${maxV}, voice nodes ${maxN}, layer nodes ${maxL}; made ${after.made}, ended ${after.ended}, dropped ${after.dropped}, forced ${after.forced})`);
if (maxV > 30) bad('voices exceeded the cap: ' + maxV);
if (after.voices > 2) bad('voices left after the game: ' + after.voices);
if (after.match) bad('the match sound state did not close');

// a flood of engine events on a live play: capped
console.log('\n   flood test');
await page.evaluate(() => { let k = 0; while (!(currentUserGame() && !currentUserGame().done) && k++ < 5) simWeek(); startUserGame('watch'); });
for (let i = 0; i < 200; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.stage === 'live' && MATCH._G.play && !MATCH._G.play.ret)) break; await page.waitForTimeout(150); }
const fl = await page.evaluate(async () => { const G = MATCH._G, pl = G.play; let mx = 0; for (let k = 0; k < 60; k++) { for (let i = 0; i < 40; i++) { PHYS.onEvent('hit', pl, { j: 200 + Math.random() * 900, at: { x: Math.random() * 10 - 5, z: pl.losZ } }); PHYS.onEvent('catch', pl, { who: pl.qb }); PHYS.onEvent('end', pl, { type: 'tackle', yards: 3 }); } SND.frame(G, 0.016); mx = Math.max(mx, SND.debug.voices); await new Promise(r => setTimeout(r, 16)); } return { mx, d: SND.debug }; });
console.log(`  2400 hits + 2400 catches + 2400 ends in 1 s: max voices ${fl.mx}, dropped ${fl.d.dropped}`);
if (fl.mx > 30) bad('flood exceeded the voice cap');
await page.waitForTimeout(4000); const fl2 = await page.evaluate(() => SND.debug); console.log(`  4 s later: voices ${fl2.voices} nodes ${fl2.nodes}`);
if (fl2.voices > 12) bad('voices did not drain after the flood');

// ---- 4. frame time, sound on vs off (same game)
console.log('\n4. frame time (watch mode, 1x)');
await page.evaluate(() => { MATCH._G.speed = 1; });
const fps = () => page.evaluate(() => new Promise(res => { let n = 0, worst = 0, prev = performance.now(); const t0 = prev, ft = []; const f = () => { const now = performance.now(); ft.push(now - prev); worst = Math.max(worst, now - prev); prev = now; n++; if (now - t0 < 3000) requestAnimationFrame(f); else { ft.sort((a, b) => a - b); res({ fps: n / ((now - t0) / 1000), worst, p95: ft[Math.floor(ft.length * 0.95)] }); } }; requestAnimationFrame(f); }));
// the sound code's own main-thread time (QA only: wraps the two entry points the match and the engine call)
await page.evaluate(() => { const f = SND.frame, e = PHYS.onEvent; window.__sndT = { frame: 0, nf: 0, ev: 0, ne: 0 }; SND.frame = (G, dt) => { const t = performance.now(); f(G, dt); __sndT.frame += performance.now() - t; __sndT.nf++; }; PHYS.onEvent = (k, p, o) => { const t = performance.now(); e(k, p, o); __sndT.ev += performance.now() - t; __sndT.ne++; }; });
const res = { on: [], off: [] };
for (const on of [true, false, true, false, true, false]) { await page.evaluate(o => { L.settings.sound = o; SND.apply(); }, on); await page.mouse.click(5, 5); await page.waitForTimeout(600); const r = await fps(); const d = await page.evaluate(() => SND.debug.ctx); res[on ? 'on' : 'off'].push(r); console.log(`  sound ${on ? 'on ' : 'off'} (${d}): ${r.fps.toFixed(1)} fps, p95 ${r.p95.toFixed(1)} ms, worst ${r.worst.toFixed(0)} ms`); }
const med = a => a.map(r => r.fps).sort((x, y) => x - y)[Math.floor(a.length / 2)];
const st = await page.evaluate(() => __sndT);
const ld = await page.evaluate(async () => { let t0 = performance.now(); const r = await SND._render('load', { dur: 10 }); const ms = performance.now() - t0; t0 = performance.now(); await SND._render('crowdAt', { e: 0.6, dur: 10 }); return { ms, bed: performance.now() - t0, peak: r.peak }; });
console.log('  the crowd bed alone (always on): 10 s renders in ' + ld.bed.toFixed(0) + ' ms = ' + (ld.bed / 100).toFixed(1) + '% of one core');
console.log('  audio-thread cost proxy: a busy 10 s mix (crowd, reverb, 10 hits/s, whistles, cheers, barks) renders offline in ' + ld.ms.toFixed(0) + ' ms = ' + (ld.ms / 100).toFixed(1) + '% of one core (peak ' + ld.peak + ' dBFS)');
console.log(`  median fps: sound on ${med(res.on).toFixed(1)}, off ${med(res.off).toFixed(1)};  SND.frame ${(st.frame / Math.max(1, st.nf)).toFixed(3)} ms a frame (${st.nf} frames), engine events ${(st.ev / Math.max(1, st.ne) * 1000).toFixed(1)} µs each (${st.ne})`);

// ---- 3. the Sound switch
console.log('\n3. the Sound switch');
await page.evaluate(() => { L.settings.sound = false; SND.apply(); }); await page.waitForTimeout(1200);
const off = await page.evaluate(async () => { const G = MATCH._G, pl = G.play, m0 = SND.debug.made; for (let i = 0; i < 50; i++) { PHYS.onEvent('hit', pl, { j: 900, at: { x: 0, z: pl.losZ } }); PHYS.onEvent('end', pl, { type: 'tackle', yards: 3 }); } SND.frame(G, 0.016); SND.test('horn'); await new Promise(r => setTimeout(r, 300)); const d = SND.debug; return { ctx: d.ctx, master: d.master, made: d.made - m0 }; });
console.log('  sound off:', JSON.stringify(off)); if (off.ctx === 'running' || off.master > 0 || off.made > 0) bad('the Sound switch did not silence everything');
await page.evaluate(() => { L.settings.sound = true; SND.apply(); });
const onAgain = await page.evaluate(() => (async () => { for (let i = 0; i < 30; i++) { if (SND.debug.ctx === 'running') break; await new Promise(r => setTimeout(r, 100)); } return SND.debug; })()); console.log('  back on:', onAgain.ctx, 'master', onAgain.master); if (onAgain.ctx !== 'running') bad('did not resume when switched back on');
// pause suspends
await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(800); const pz = await page.evaluate(() => SND.debug); console.log('  paused:', pz.ctx, 'master', pz.master); if (pz.ctx === 'running') bad('paused match still running audio');
await page.evaluate(() => { MATCH._G.paused = false; }); const rz = await page.evaluate(() => (async () => { for (let i = 0; i < 30; i++) { if (SND.debug.ctx === 'running') break; await new Promise(r => setTimeout(r, 100)); } return SND.debug; })()); console.log('  resumed:', rz.ctx, 'master', rz.master); if (rz.ctx !== 'running') bad('did not resume after pause');
// quit the game through the pause menu, then the settings panel and its test buttons
await page.evaluate(() => { document.querySelector('.mbtn.pause').click(); }); await page.waitForTimeout(300);
await page.evaluate(() => { const b = document.querySelector('[data-m=quit]'); if (b) b.click(); }); await page.waitForTimeout(600);
console.log('  match closed:', await page.evaluate(() => !MATCH._G), 'sound match state:', await page.evaluate(() => SND.debug.match));
await page.evaluate(() => { TAB = 'settings'; render(); });
await page.waitForTimeout(400);
const panel = await page.evaluate(() => { const b = [...document.querySelectorAll('.sndtest button')]; return { buttons: b.length, range: document.querySelectorAll('input[type=range]').length }; });
console.log('  settings panel:', JSON.stringify(panel)); if (panel.buttons < 15) bad('sound test buttons missing');
await page.screenshot({ path: path.join(out, 'settings.png'), fullPage: true });
const tb = await page.evaluate(async () => { const out = {}; for (const b of [...document.querySelectorAll('.sndtest button')]) { const m0 = SND.debug.made; b.click(); await new Promise(r => setTimeout(r, 160)); out[b.textContent] = SND.debug.made - m0; } return out; });
console.log('  test buttons (voices started):', JSON.stringify(tb));
for (const k in tb) if (!tb[k] && !/Crowd|Rain|Wind/.test(k)) bad('test button made no sound: ' + k);
await page.waitForTimeout(6000); const tail = await page.evaluate(() => SND.debug); console.log(`  6 s later: ctx ${tail.ctx} voices ${tail.voices} nodes ${tail.nodes}`);
await page.waitForTimeout(5000); const idle = await page.evaluate(() => SND.debug.ctx); console.log('  idle in the menus:', idle); if (idle === 'running') bad('audio not suspended when idle');
const se = await page.evaluate(() => SND.debug.errors); console.log('  errors swallowed by the sound engine:', se); if (se) bad(se + ' sound engine errors (see the console warning)');
console.log('\n' + (errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors'));
console.log(fails ? `${fails} FAILURES` : 'sound test passed');
await browser.close(); process.exit(fails || errs.length ? 1 : 0);
