// Replays, flag replays, challenges, booth reviews, the highlight reel (src/match/20_replay.js).
// A bot plays the user's side (runs only, so the play ends in a tackle); each case is forced through RPLY._.force or MATCH._.foul:
// a touchdown replay, a flag replay (the offender ringed and named), a challenge that is overturned and one that stands,
// a booth review inside two minutes, the halftime reel, the final whistle with the game reel and the Highlights button.
// 'mem' watches a whole game at 4x and checks the recorder stays bounded.
// run: node tools/build.mjs && node qa/replay_test.mjs [desk|phone] [play|end|mem|all]   (play: cases 1-6; end: a TD, then the final whistle and the reel)   (screenshots in qa/shots/replay)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const which = process.argv[2] || 'desk', part = process.argv[3] || 'play';
const out = path.join(root, 'qa', 'shots', 'replay'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 });
const page = await ctx.newPage(); const errs = [], fails = [], oks = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
const check = (c, what) => { (c ? oks : fails).push(what); console.log((c ? 'PASS ' : 'FAIL ') + what); };
let lastHeap = 0; const heapLog = async () => { try { const h = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0); if (Math.abs(h - lastHeap) > 15) { lastHeap = h; console.log('  heap ' + h + ' MB'); } } catch (e) { } };
let n = 0; const shot = async name => { for (let i = 0; i < 2; i++) { try { await page.screenshot({ path: path.join(out, `${which}_${String(n).padStart(2, '0')}_${name}.png`) }); n++; return; } catch (e) { await page.waitForTimeout(400); } } console.log('(screenshot failed: ' + name + ')'); n++; };
const wait = ms => page.waitForTimeout(ms);
const S = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play, st = RPLY._.state();
  return { pn: g.playN, stage: g.stage, mode: g.mode, side: g.userSide, sheet: g.sheet ? g.sheet.side : null, poss: g.poss, user: g.user, q: g.q, clock: g.clock, yl: g.yl, down: g.down, togo: g.togo, phase: pl ? pl.phase : null, ret: !!(pl && pl.ret), td: !!(pl && pl.result && pl.result.td), heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0,
    kick: !!(g.kaim || g.kpow || g.kickCb), pen: !!g.penWait, over: g.over, to: g.to[g.user], score: [g.score[g.aid], g.score[g.hid]], rp: st.rp, seg: st.seg, bug: st.bug, win: st.win, card: st.card, ovl: document.querySelector('#gui .ovl').classList.contains('show') }; });
// one bot step: whatever the user has to do (kicks, the play call: a run, the snap, the penalty choice); the challenge window and the review card are left to the caller
async function step(opts = {}) {
  const g = await S(); if (!g) return g;
  if (g.rp) { await wait(150); return g; }
  if (g.card) { if (!opts.keepCard) await page.evaluate(() => document.querySelector('.rpcard').click()); await wait(250); return g; }
  if (g.win) { if (!opts.keepWin) await page.evaluate(() => document.querySelector('.rpcall [data-rp="playon"]').click()); await wait(250); return g; }
  if (g.kick) { await page.keyboard.press('Space'); await wait(450); return g; }
  if (g.pen) { await page.keyboard.press('Space'); await wait(350); return g; }
  if (g.stage === 'call' && g.mode === 'play') {
    if (await page.$('[data-act="xp"]')) { await page.evaluate(() => document.querySelector('[data-act="xp"]').click()); await wait(300); return g; }
    if (g.sheet === 'O') {
      if (opts.onO) await opts.onO(g);
      if (g.down === 4 && !opts.go4 && await page.$('[data-act="punt"]')) { await page.evaluate(() => document.querySelector('[data-act="punt"]').click()); await wait(400); return g; }
      if (await page.$('.sheet [data-f="run"]:not(.on2)')) { await page.evaluate(() => document.querySelector('.sheet [data-f="run"]').click()); await wait(250); }
      await page.evaluate(() => { const cards = [...document.querySelectorAll('.sheet .pc[data-id]')]; const p = cards.find(c => { const x = L.plays.find(y => y.id === c.dataset.id); return x && x.type === 'run' && !x.pa; }) || cards[0]; if (p) p.click(); }); await wait(450); return g; }
    if (g.sheet === 'D') { await page.evaluate(() => { const c = document.querySelector('.sheet .pc[data-id]'); if (c) c.click(); }); await wait(450); return g; }
    if (g.sheet === 'PAT') { await page.evaluate(() => { const b = document.querySelector('.sheet [data-act]'); if (b) b.click(); }); await wait(400); return g; }
  }
  if (g.stage === 'pre' && g.side === 'O' && g.phase === 'pre') { await page.keyboard.press('Space'); await wait(300); return g; }
  await wait(200); return g;
}
async function until(pred, sec, opts) { const t0 = Date.now(); let g = null; await heapLog(); while (Date.now() - t0 < sec * 1000) { g = await S(); if (!g) return null; if (await pred(g)) return g; await step(opts); } return null; }
// the user's next offensive play call: set it up (fn runs in the page with G), then the bot calls a run
async function nextO(setup, sec = 120) {
  const g = await until(x => x.stage === 'call' && x.sheet === 'O' && x.mode === 'play' && !x.rp && !x.win && !x.card, sec); if (!g) return false;
  await page.evaluate(setup); return true;
}
async function segShots(tag, maxSec = 30) {
  const seen = []; const t0 = Date.now(); let lastSeg = null;
  while (Date.now() - t0 < maxSec * 1000) { const g = await S(); if (!g || !g.rp) break; if (g.seg !== lastSeg) { lastSeg = g.seg; seen.push(g.seg); await wait(g.seg === 'tight' || g.seg === 'rev' || g.seg === 'flag' ? 1500 : 900); const g2 = await S(); if (g2 && g2.rp) await shot(`${tag}_${seen.length}_${g2.seg}`); } else await wait(120); }
  return seen;
}

await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await wait(700);
await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); localStorage.setItem('pc_gmode', 'full'); localStorage.setItem('pc_replay', 'auto'); localStorage.setItem('pc_pclock', 'off'); } catch (e) { } });

if (part === 'play' || part === 'all' || part === 'td' || part === 'end') {
  await page.evaluate(() => { L = null; NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[3].id); startUserGame('play'); });
  for (let i = 0; i < 300; i++) { const g = await S(); if (g && (await page.evaluate(() => MATCH._G.ready))) break; await wait(300); }
  await page.evaluate(() => { MATCH._G.noFlags = true; RPLY._.force({ kind: 'none' }); }); await wait(300);
  await page.click('#mKick').catch(() => { });

  // ---- 1. a touchdown and its replay (three angles: sideline, end zone, tight slow motion)
  let td = false;
  for (let tries = 0; tries < 6 && !td; tries++) {
    if (!await nextO(() => { const G = MATCH._G; G.yl = 99; G.down = 1; G.togo = 1; }, 240)) { console.log('  no offensive call', JSON.stringify(await S())); break; }
    const pn0 = (await S()).pn;
    const g = await until(x => x.rp || (x.pn > pn0 && x.stage === 'call'), 45);
    console.log('  try', tries, await page.evaluate(() => { const G = MATCH._G, r = G.play && G.play.result; return JSON.stringify({ op: G.cur && G.cur.op && G.cur.op.name, type: r && r.type, td: r && r.td, y: r && Math.round(r.yards || 0), text: r && r.text, yl: G.yl, rp: RPLY._.state().rp, last: RPLY._.last() && RPLY._.last().meta }); }));
    if (g && g.rp && g.td) { td = true; console.log('  heap', g.heap, 'MB'); const segs = await segShots('td'); check(segs.length >= 2, `TD replay: ${segs.length} angles (${segs.join(', ')})`); check(segs.includes('tight'), 'TD replay: a tight slow-motion angle on the scorer'); }
  }
  check(td, 'a touchdown got an automatic replay');
  check(await until(x => !x.rp && (x.sheet === 'PAT' || x.stage === 'kick' || x.ret || x.sheet === 'D'), 40) != null, 'after the TD replay the game moves on (extra point / kickoff)');

  if (part === 'td') { console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no console errors'); await browser.close(); process.exit(0); }
  if (part === 'end') { await page.evaluate(() => { const G = MATCH._G; G.q = 4; G.clock = 6; G.warned[4] = true; if (G.score[G.hid] === G.score[G.aid]) G.score[G.hid] += 3; }); }
  if (part !== 'end') {
  // ---- 2. the Replay button after a play, and a flag replay with the offender ringed
  if (await nextO(() => { const G = MATCH._G; G.yl = 35; G.down = 1; G.togo = 10; })) {
    await until(x => x.stage === 'live', 20);
    await wait(500); const flagged = await page.evaluate(() => MATCH._.foul('DH', 'D')); check(flagged, 'QA flag thrown on the live play');
    const g = await until(x => x.rp, 25);
    check(g && g.rp, 'flag: the replay starts on its own');
    if (g && g.rp) {
      await wait(1400); const info = await page.evaluate(() => ({ lt: document.querySelector('.rplt').textContent, tag: document.querySelector('.rptag.show') ? document.querySelector('.rptag b').textContent : '', bug: document.querySelector('.rpbug b').textContent }));
      await shot('flag_ringed');
      check(/FLAG/.test(info.lt) && /holding/i.test(info.lt), `flag replay lower third: ${info.lt.slice(0, 90)}`);
      check(/^#\d+/.test(info.tag), `the offender is tagged: ${info.tag}`);
      for (let i = 0; i < 60; i++) { const s = await S(); if (!s.rp) break; await wait(200); }
      await wait(400); await shot('flag_card');
    }
    // the Replay button
    const gb = await until(x => !x.rp && (x.stage === 'dead' || x.stage === 'call') && !x.pen, 20);
    const has = await page.$('.rpbtns [data-rp="replay"]'); check(!!has, 'a Replay button after the play'); if (has) await shot('replay_button');
    if (has) { await page.evaluate(() => document.querySelector('.rpbtns [data-rp="replay"]').click()); await wait(700); const s = await S(); check(s.rp, 'the Replay button plays it');
      await wait(900); await page.evaluate(() => RPLY._.pause(true)); await wait(300); await shot('replay_paused');
      const t1 = (await page.evaluate(() => RPLY._.state().t)); await wait(500); const t2 = (await page.evaluate(() => RPLY._.state().t)); check(t1 === t2, 'pause holds the replay');
      await page.evaluate(() => { const r = document.querySelector('.rpbar input'); r.value = '200'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
      const t3 = (await page.evaluate(() => RPLY._.state().t)); check(t3 !== t2, 'scrubbing moves the replay'); await shot('replay_scrub');
      await page.evaluate(() => RPLY._.pause(false)); await page.evaluate(() => document.querySelector('.rpbar [data-rp="skip"]').click()); await wait(500); check(!(await S()).rp, 'Skip ends it'); }
  }

  // ---- 3. a challenge that wins (the official spotted him short; he got it)
  const chal = async (force, tag) => {
    if (!await nextO(f => { const G = MATCH._G; G.yl = 40; G.down = 3; G.togo = 4; RPLY._.force(f); }, 120)) return null;
    await page.evaluate(f => RPLY._.force(f), force);
    const g = await until(x => x.win, 40); if (!g) return null;
    await wait(500); await shot(`${tag}_ruling`);
    const to0 = g.to, c0 = await page.evaluate(() => RPLY._.chal()), tip = await page.evaluate(() => (document.querySelector('.rpcall .rpa') || {}).textContent || '');
    await page.evaluate(() => document.querySelector('.rpcall [data-rp="chal"]').click()); await wait(700); await shot(`${tag}_redflag`); await until(x => x.rp, 10);
    const segs = await segShots(tag, 30);
    const g2 = await until(x => x.card, 15, { keepCard: true }); await wait(500); if (g2) await shot(`${tag}_decision`);
    const card = g2 ? g2.card : ''; await page.evaluate(() => { const c = document.querySelector('.rpcard'); if (c) c.click(); }); await wait(500);
    return { tip, segs, card, to0, to1: (await S()).to, c0, c1: await page.evaluate(() => RPLY._.chal()), g: await S() };
  };
  await page.evaluate(() => RPLY._.force(null));
  const won = await chal({ kind: 'spot', made: true, wrong: true }, 'chal_win');
  check(won && /OVERTURNED/.test(won.card), `challenge (wrong call): ${won ? won.card.slice(0, 80) : 'no window'}`);
  if (won) { check(won.segs.includes('rev'), 'challenge review shows the review angle'); check(won.to1 === won.to0, 'won challenge: the timeout is kept'); const u = await page.evaluate(() => MATCH._G.user); check(won.c1 && won.c1[u] && won.c1[u].won === 1, 'won challenge counted');
    check(won.g.down === 1, `overturned: first down (now ${won.g.down} & ${Math.round(won.g.togo)})`); }
  await page.evaluate(() => RPLY._.force({ kind: 'none' }));
  // ---- 4. a challenge that loses (the spot was right)
  await page.evaluate(() => { RPLY._.force(null); const cp = LG.coachPerk; LG.coachPerk = k => k === 'str4' || (cp ? cp(k) : false); });
  const lost = await chal({ kind: 'spot', made: false, wrong: false }, 'chal_lose');
  check(lost && /STANDS|CONFIRMED/.test(lost.card), `challenge (right call): ${lost ? lost.card.slice(0, 80) : 'no window'}`);
  if (lost) { check(/Replay assistant/.test(lost.tip), `Sideline genius perk: the replay assistant gives a read (${lost.tip.slice(0, 70)})`); check(lost.to1 === lost.to0 - 1, `lost challenge costs a timeout (${lost.to0} -> ${lost.to1})`); check(lost.g.down === 4, `stands: 4th down (now ${lost.g.down})`); }
  await page.evaluate(() => RPLY._.force({ kind: 'none' }));

  // ---- 5. inside two minutes: no challenge, the booth reviews it
  if (await nextO(() => { const G = MATCH._G; G.q = 2; G.clock = G.WARN - 4; G.warned[2] = true; G.yl = 45; G.down = 2; G.togo = 6; RPLY._.force(null); }, 120)) {
    await page.evaluate(() => RPLY._.force({ kind: 'spot', made: true, wrong: true }));
    const g = await until(x => x.rp || x.win, 40);
    check(g && g.rp && !g.win, 'two-minute: the booth reviews (no challenge window)');
    if (g && g.rp) { const segs = await segShots('booth', 30); const g2 = await until(x => x.card, 15, { keepCard: true }); if (g2) { await wait(400); await shot('booth_decision'); } check(g2 && /OVERTURNED/.test(g2.card), 'booth review overturns the wrong spot'); }
    await page.evaluate(() => RPLY._.force({ kind: 'none' }));
  }
  // ---- 6. halftime highlights (the first half's best plays), then the game goes on
  const nh = await page.evaluate(() => RPLY._.clips().hi.filter(h => h.q <= 2).length);
  const ht = nh >= 2 ? await until(x => x.rp && x.bug === 'HIGHLIGHTS', 90) : null;
  if (nh >= 2) check(!!ht, 'halftime: the highlight reel plays'); else console.log('  (halftime reel skipped: only ' + nh + ' first-half highlight)');
  if (ht) { await wait(1200); await shot('half_reel'); await page.evaluate(() => RPLY._.skip()); }
  check(await until(x => x.q === 3 && (x.stage === 'kick' || x.ret || x.stage === 'call' || x.stage === 'live' || x.stage === 'pre'), 60) != null, 'the second half kicks off after the reel');
  }
  if (part !== 'play') {
  // ---- 7. the final whistle: the game reel, then the final card with a Highlights button
  if (part !== 'end') await page.evaluate(() => { const G = MATCH._G; G.q = 4; G.clock = 6; G.warned[4] = true; if (G.score[G.hid] === G.score[G.aid]) G.score[G.hid] += 3; });
  const fr = await until(x => x.rp && x.bug === 'HIGHLIGHTS' && x.stage === 'final', 120);
  check(!!fr, 'final: the game reel plays on its own');
  if (fr) { await wait(1500); await shot('final_reel'); const m = await page.evaluate(() => RPLY._.clips()); console.log('  highlights:', m.hi.map(h => `${h.imp} ${h.desc}`).join(' | ')); await page.evaluate(() => RPLY._.next()); await wait(1600); await shot('final_reel_next'); await page.evaluate(() => RPLY._.skip()); await wait(600); }
  const hb = await page.$('#mHl'); check(!!hb, 'final card: a Highlights button'); await shot('final_card');
  }
  const mm = await page.evaluate(() => RPLY._.mem()); console.log('  recorder:', JSON.stringify(mm)); check(mm.clips <= 17 && mm.bytes < 24e6, `recorder bounded: ${mm.clips} clips, ${(mm.bytes / 1e6).toFixed(1)} MB`);
}

if (part === 'mem' || part === 'all') {
  await page.evaluate(() => { L = null; NG.slot = 7; NG.qlen = 60; createLeague(); pickTeam(L.teams[9].id); startUserGame('watch'); });
  for (let i = 0; i < 300; i++) { const r = await page.evaluate(() => MATCH._G && MATCH._G.ready && MATCH._G.stage !== 'load'); if (r) break; await wait(300); }
  await page.evaluate(() => { const i = document.querySelector('.spdbar input'); if (i) { i.value = '2'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  const t0 = Date.now(); let maxB = 0, maxC = 0, heap0 = null, heapMax = 0, reps = 0, lastRp = false;
  while (Date.now() - t0 < 270000) {
    const s = await page.evaluate(() => { const g = MATCH._G; return g ? { m: RPLY._.mem(), heap: performance.memory ? performance.memory.usedJSHeapSize : 0, rigs: R3D.stats().rigs, st: g.stage, q: g.q, rp: RPLY._.state().rp, bug: RPLY._.state().bug } : null; });
    if (!s) break; if (Math.round((Date.now() - t0) / 1000) % 30 < 2) console.log(`  t=${Math.round((Date.now() - t0) / 1000)}s q${s.q} ${s.st} heap ${(s.heap / 1e6).toFixed(0)} MB clips ${s.m.clips} ${(s.m.bytes / 1e6).toFixed(1)} MB rigs ${s.rigs}`); if (s.rp && !lastRp) reps++; lastRp = s.rp; maxB = Math.max(maxB, s.m.bytes); maxC = Math.max(maxC, s.m.clips); if (heap0 == null && s.q >= 1) heap0 = s.heap; heapMax = Math.max(heapMax, s.heap);
    if (s.st === 'final' && !s.rp) break; await wait(1500);
  }
  const fin = await page.evaluate(() => MATCH._G ? MATCH._G.stage : null);
  console.log(`  watched to ${fin} in ${Math.round((Date.now() - t0) / 1000)} s, ${reps} replays, max ${maxC} clips / ${(maxB / 1e6).toFixed(1)} MB, heap ${(heap0 / 1e6).toFixed(0)} -> max ${(heapMax / 1e6).toFixed(0)} MB`);
  check(maxC <= 17 && maxB < 24e6, `mem: recorder stays bounded (${maxC} clips, ${(maxB / 1e6).toFixed(1)} MB)`);
  check(reps >= 1, `mem: replays played while watching (${reps})`);
  check(fin === 'final', 'mem: the watched game reached the final whistle');
}

console.log(`\n${oks.length} passed, ${fails.length} failed${fails.length ? ':\n  ' + fails.join('\n  ') : ''}`);
console.log(errs.length ? 'ERRORS\n' + errs.slice(0, 12).join('\n') : 'no console errors');
await browser.close(); process.exit(fails.length || errs.length ? 1 : 0);
