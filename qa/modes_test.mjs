// Game modes + calls at the line: the pregame choice (full / offense only / defense only), audibles, motion, defensive calls,
// the play clock, no huddle, the daily drive. A bot plays the user's side; the other side's drives must run as sim drives.
// run: node tools/build.mjs && node qa/modes_test.mjs [desk|phone] [title|off|def|daily|clock|all]   (screenshots in qa/shots/modes)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const which = process.argv[2] || 'desk', part = process.argv[3] || 'all';
const out = path.join(root, 'qa', 'shots', 'modes'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 });
const page = await ctx.newPage(); const errs = [], fails = [], oks = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
const check = (c, what) => { (c ? oks : fails).push(what); console.log((c ? 'PASS ' : 'FAIL ') + what); };
let n = 0; const shot = async name => { try { await page.screenshot({ path: path.join(out, `${which}_${String(n++).padStart(2, '0')}_${name}.png`) }); } catch (e) { console.log('(screenshot failed: ' + name + ')'); } };
const wait = ms => page.waitForTimeout(ms);
const tap = async sel => { const b = await page.$(sel); if (!b) return false; try { await b.click({ timeout: 1500 }); return true; } catch (e) { await page.evaluate(s => { const x = document.querySelector(s); if (x) x.click(); }, sel); return true; } };
const S = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { stage: g.stage, ready: g.ready, mode: g.mode, side: g.userSide, sheet: g.sheet ? g.sheet.side : null, hq: !!(g.sheet && g.sheet.hq), auto: g.auto ? (g.auto.side ? 'side' : g.auto.kind) : null, poss: g.poss, user: g.user, over: g.over, phase: pl && pl.phase, ret: !!(pl && pl.ret), pass: !!(pl && pl.pass), thrown: !!(pl && pl.thrown), q: g.q, clock: Math.round(g.clock), kick: !!(g.kpow || g.kaim || g.kickCb), pen: !!g.penWait, ln: g.ln, pc: g.pc ? Math.ceil(g.pc.len - (g.time - g.pc.t0)) : null, score: [g.score[g.hid], g.score[g.aid]], down: g.down, sideMode: g.sideMode, final: !!document.querySelector('#mDone') }; });
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await wait(700);
await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); localStorage.removeItem('pc_gmode'); localStorage.setItem('pc_replay', 'off'); } catch (e) { } });      // (replays are tested in qa/replay_test.mjs)

// ---------- the title: the daily drive card; the daily league is the same every time for a date
if (part === 'title' || part === 'all') {
  await page.evaluate(() => { L = null; render(); }); await wait(300); await shot('title');
  check(await page.$('.daily') != null, 'title: daily drive card is there');
  const det = await page.evaluate(() => { const S = dailyScen('2026-11-24'), sig = () => L.teams.map(t => t.city + ' ' + t.name + ':' + t.roster.slice(0, 8).map(id => L.P[id].ovr + L.P[id].ln).join(',')).join('|');
    withSeed(S.seed, () => newLeague({ diff: 'pro', qlen: 900 })); const a = sig(); withSeed(S.seed, () => newLeague({ diff: 'pro', qlen: 900 })); const b = sig(); const S2 = dailyScen('2026-11-25'); withSeed(S2.seed, () => newLeague({ diff: 'pro', qlen: 900 })); const c = sig(); L = null; render();
    return { same: a === b, diff: a !== c, txt: S.txt, txt2: S2.txt, rnd: [Math.random(), Math.random()].every(x => x >= 0 && x < 1) }; });
  check(det.same, 'daily: same date gives the same league (teams, players)'); check(det.diff, 'daily: another date gives another league');
  console.log('  daily 11-24:', det.txt, '| 11-25:', det.txt2);
}

// a career game against the CPU, up to the pregame screen
async function career(slot) {
  await page.evaluate(s => { L = null; NG.slot = s; NG.qlen = 60; createLeague(); pickTeam(L.teams[5].id); startUserGame('play'); }, slot);
  for (let i = 0; i < 300; i++) { const g = await S(); if (g && g.ready) break; await wait(300); }
  await page.evaluate(() => { MATCH._G.noFlags = true; if (typeof RPLY !== 'undefined') RPLY._.force({ kind: 'none' }); }); await wait(300);
}
// the bot: plays whatever the user has to play; returns a log of what it saw
async function bot(maxSec, opts = {}) {
  const t0 = Date.now(), seen = { autoD: 0, autoO: 0, sheetD: 0, sheetO: 0, hq: 0, snaps: 0, maxStuck: 0 }; let last = '', lastT = Date.now();
  while (Date.now() - t0 < maxSec * 1000) {
    const g = await S(); if (!g) break; if (g.final || g.stage === 'final') { seen.final = true; break; }
    const key = [g.stage, g.q, g.clock, g.poss, g.down, g.phase].join('|'); if (key !== last) { last = key; lastT = Date.now(); } else seen.maxStuck = Math.max(seen.maxStuck, (Date.now() - lastT) / 1000);
    if (seen.maxStuck > 45) { seen.stuck = key; break; }
    if (g.auto === 'side') { if (g.poss === g.user) seen.autoO++; else seen.autoD++; }
    if (opts.fast && g.auto) await page.evaluate(() => { const i = document.querySelector('.spdbar input'); if (i && i.value !== '4') { i.value = '4'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    if (await page.$('.bcbig.show [data-bc="go"]')) { await page.evaluate(() => document.querySelector('.bcbig.show [data-bc="go"]').click()); await wait(300); continue; }      // halftime card: on to the second half
    if (g.kick) { await page.keyboard.press('Space'); await wait(500); continue; }
    if (g.pen) { await page.keyboard.press('Space'); await wait(400); continue; }
    if (g.stage === 'call' && g.mode === 'play') {
      if (await page.$('[data-act="xp"]')) { await tap('[data-act="xp"]'); await wait(300); continue; }
      if (g.hq) { seen.hq++; await page.evaluate(() => { const b = document.querySelector('.sheet [data-hq="same"]') || document.querySelector('.sheet [data-hq^="a"]'); if (b) b.click(); }); await wait(500); continue; }
      if (g.sheet === 'O') { seen.sheetO++; const four = g.down === 4 && await page.$('[data-act="punt"]'); if (four) { await tap('[data-act="punt"]'); await wait(400); continue; }
        if (opts.hurry && !(await page.evaluate(() => MATCH._G.hurry))) { await tap('[data-hq="hurry"]'); await wait(400); continue; }
        await page.evaluate(t => { const cards = [...document.querySelectorAll('.sheet .pc[data-id]')]; const p = cards.find(c => { const x = L.plays.find(y => y.id === c.dataset.id); return x && x.type === t; }) || cards[0]; if (p) p.click(); }, Math.random() < 0.6 ? 'run' : 'pass'); await wait(500); continue; }
      if (g.sheet === 'D') { seen.sheetD++; await page.evaluate(() => { const c = document.querySelector('.sheet .pc[data-id]'); if (c) c.click(); }); await wait(500); continue; }
    }
    if (g.stage === 'pre' && g.phase === 'pre' && g.side === 'O' && g.mode === 'play') { if (opts.onPreO) await opts.onPreO(g); await wait(250); await page.evaluate(() => { const pl = MATCH._G.play; if (MATCH._G.stage === 'pre' && pl.phase === 'pre') document.querySelector('.acts [data-a="snap"]') && document.querySelector('.acts [data-a="snap"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }); seen.snaps++; await wait(300); continue; }
    if (g.stage === 'pre' && g.phase === 'pre' && g.side === 'D' && g.mode === 'play' && opts.onPreD) { await opts.onPreD(g); }
    if (g.stage === 'live' && g.side === 'O' && g.pass && !g.thrown && g.mode === 'play') { await wait(1100); await page.evaluate(() => { const pl = MATCH._G.play; if (pl && pl.canThrow && pl.canThrow() && !pl.thrown && pl.receivers.length) pl.throwTo(pl.receivers[Math.floor(Math.random() * pl.receivers.length)]); }); await wait(300); continue; }
    await wait(250);
  }
  seen.sec = Math.round((Date.now() - t0) / 1000); return seen;
}

// ---------- offense only: the pregame screen, audible, motion, the play clock, no huddle; their drives run on their own to the final whistle
if (part === 'off' || part === 'all') {
  await career(1); await shot('pregame');
  const btns = await page.evaluate(() => ({ full: !!document.querySelector('#mKick'), off: !!document.querySelector('#mOff'), def: !!document.querySelector('#mDef'), big: document.querySelector('#mKick') && document.querySelector('#mKick').getBoundingClientRect().height }));
  check(btns.full && btns.off && btns.def, 'pregame: Play full game, Offense only, Defense only');
  await tap('#mOff'); await wait(400);
  check((await S()).sideMode === 'O' && await page.evaluate(() => localStorage.getItem('pc_gmode')) === 'O', 'offense only chosen and remembered');
  let did = { aud: false, mot: false, clock: false };
  const onPreO = async g => {
    if (!did.aud) { did.aud = true; await page.evaluate(() => document.querySelector('.acts [data-a="audible"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(400);
      const n2 = await page.evaluate(() => document.querySelectorAll('.lpan.show [data-ln^="a"]').length); check(n2 >= 3, `audible panel shows ${n2} quick calls`); await shot('audible_panel');
      const before = await page.evaluate(() => MATCH._G.play.o.op.name); await page.evaluate(() => document.querySelector('.lpan [data-ln="a1"]').click()); await wait(500);
      const after = await page.evaluate(() => ({ name: MATCH._G.play.o.op.name, rside: MATCH._G.play.o.op.rside, stage: MATCH._G.stage, phase: MATCH._G.play.phase, cur: MATCH._G.cur.op.name })); check(after.stage === 'pre' && after.phase === 'pre' && after.rside === 'R', `audible changes the play at the line (${before} -> ${after.name}, ${after.rside})`); await shot('after_audible'); return; }
    if (!did.mot) { const ok = await page.evaluate(() => MATCH._G.play.O.some(p => p.posName === 'WR')); if (!ok) return; did.mot = true;
      await page.evaluate(() => document.querySelector('.acts [data-a="motion"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(400); await shot('motion_panel');
      const x0 = await page.evaluate(() => { const b = document.querySelector('.lpan [data-ln$=":across"]'); const slot = b.dataset.ln.split(':')[1]; const p = MATCH._G.play.O.find(q => q.slot === slot); const x = p.p.x; b.click(); return { x, slot }; });
      await wait(900); await shot('motion_moving');
      const m = await page.evaluate(s => { const pl = MATCH._G.play, p = pl.O.find(q => q.slot === s); return { x: p.p.x, man: pl.umo && pl.umo.man ? pl.umo.man.p.x : null, set: pl.umo && pl.umo.set, cov: pl.dp.cov }; }, x0.slot);
      check(Math.abs(m.x - x0.x) > 3, `motion across: he moved ${Math.abs(m.x - x0.x).toFixed(1)} m before the snap (${m.cov}${m.man != null ? ', a man defender trails' : ', zone'})`);
      await wait(1500); await shot('motion_set'); return; }
    if (!did.clock && g.pc != null) { did.clock = true; check(g.pc > 0 && g.pc <= 40, `play clock runs at the line (${g.pc})`); await shot('play_clock'); }
  };
  const seen = await bot(260, { onPreO, fast: true, hurry: true });
  console.log('  offense only:', JSON.stringify(seen));
  check(seen.final, `offense-only game reaches the final whistle (${seen.sec}s)`);
  check(seen.autoD > 0 && seen.sheetD === 0, `their drives ran on their own (auto samples ${seen.autoD}, defense sheets shown ${seen.sheetD})`);
  check(seen.hq > 0, `no-huddle bar used (${seen.hq})`);
  await shot('final');
  if (await page.$('#mDone')) await tap('#mDone'); await wait(600);
}

// ---------- defense only: the calls panel (spy, double, gap blitz); your offense's drives run on their own
if (part === 'def' || part === 'all') {
  await career(2); await tap('#mDef'); await wait(300);
  let did = 0;
  const onPreD = async g => {
    if (did >= 3) return; did++;
    await page.evaluate(() => document.querySelector('.acts [data-a="dcall"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(400);
    const k = did === 1 ? 'spy' : did === 2 ? 'dbl' : 'gap:B:L';
    await page.evaluate(k => document.querySelector(`.lpan [data-ln="${k}"]`).click(), k); await wait(500);
    const r = await page.evaluate(k => { const pl = MATCH._G.play; return { spy: !!pl.D.find(d => d.qbSpy), dbl: !!pl.D.find(d => d.bracket), gap: !!pl.D.find(d => d.gapAim != null), stage: MATCH._G.stage, phase: pl.phase }; }, k);
    check(r.stage === 'pre' && r.phase === 'pre' && (k === 'spy' ? r.spy : k === 'dbl' ? r.dbl : r.gap), `defensive call ${k} lands in the engine (${JSON.stringify(r)})`);
    await shot('dcall_' + k.replace(/:/g, '')); await page.evaluate(() => { const x = document.querySelector('.lpan [data-ln="x"]'); if (x) x.click(); });
    const t1 = Date.now(); for (let i = 0; i < 40; i++) { const s = await S(); if (s.stage !== 'pre') break; await wait(150); } check(Date.now() - t1 < 6000, `the offense snaps after the call (${Date.now() - t1} ms)`);
  };
  const seen = await bot(250, { onPreD, fast: true });
  console.log('  defense only:', JSON.stringify(seen));
  check(seen.autoO > 0 && seen.sheetO === 0, `your offense ran on its own (auto samples ${seen.autoO}, offense sheets ${seen.sheetO})`);
  check(seen.final, `defense-only game reaches the final whistle (${seen.sec}s)`);
  if (await page.$('#mDone')) await tap('#mDone'); await wait(600);
}

// ---------- the play clock runs out: delay of game; the no-huddle bar; the pause menu's mode switch
if (part === 'clock' || part === 'all') {
  await career(3); await tap('#mKick');
  let g; for (let i = 0; i < 200; i++) { g = await S(); if (g.stage === 'call' && g.sheet === 'O') break; if (g.kick) await page.keyboard.press('Space'); if (g.stage === 'call' && g.sheet === 'D') await page.evaluate(() => document.querySelector('.sheet .pc[data-id]').click()); await wait(300); }
  check(g.pc != null && g.pc <= 40, `play clock runs on the call sheet (${g.pc})`);
  await page.evaluate(() => { const G = MATCH._G; G.pc.t0 = G.time - G.pc.len + 4; }); await wait(600); await shot('clock_low');
  const d0 = await page.evaluate(() => ({ yl: MATCH._G.yl, n: MATCH._G.pbp.length }));
  for (let i = 0; i < 30; i++) { if ((await page.evaluate(() => MATCH._G.pbp.some(t => /Delay of game/.test(t))))) break; await wait(300); }
  const dog = await page.evaluate(() => ({ dog: MATCH._G.pbp.some(t => /Delay of game/.test(t)), yl: MATCH._G.yl }));
  check(dog.dog && dog.yl < d0.yl, `play clock at zero: delay of game (ball ${d0.yl} -> ${dog.yl})`);
  for (let i = 0; i < 40; i++) { g = await S(); if (g.stage === 'call' && g.sheet === 'O') break; await wait(300); }
  await tap('[data-hq="hurry"]'); await wait(500); g = await S(); check(g.hq, 'No huddle turns on the quick bar'); await shot('hurry_bar');
  const r0 = await page.evaluate(() => MATCH._G.runoff);
  await page.evaluate(() => MATCH._G.paused = false); await page.keyboard.press('Escape'); await wait(400); await shot('pause_modes');
  check(await page.$('.gmp [data-gm="O"]') != null, 'pause menu offers the mode switch');
  await tap('.gmp [data-gm="D"]'); await wait(800); g = await S();
  check(g.sideMode === 'D' && g.auto === 'side', `switching to defense only mid-drive hands your offense to the coordinator (${g.auto})`);
  console.log('  runoff on the no-huddle bar:', r0.toFixed(1));
}

// ---------- the daily drive: from the title, played to the end of the drive, scored, copy text
if (part === 'daily' || part === 'all') {
  await page.evaluate(() => { L = null; render(); dailyPlay(); });
  for (let i = 0; i < 300; i++) { const g = await S(); if (g && g.ready) break; await wait(300); }
  await page.evaluate(() => { MATCH._G.noFlags = true; if (typeof RPLY !== 'undefined') RPLY._.force({ kind: 'none' }); }); await wait(300); await shot('daily_intro');
  check(await page.$('.dlyi') != null, 'daily: the intro shows the situation');
  await tap('#mKick');
  const seen = await bot(150, { hurry: false });
  console.log('  daily:', JSON.stringify(seen));
  await wait(500); await shot('daily_result');
  const r = await page.evaluate(() => MATCH._G && MATCH._G.result && MATCH._G.result.daily);
  check(!!r && typeof r.score === 'number' && /Daily Drive/.test(r.copy), `daily: scored (${r ? r.how + ', ' + r.score : 'none'})`);
  if (r) console.log('  copy text:\n' + r.copy.split('\n').map(x => '    ' + x).join('\n'));
  if (await page.$('#mDone')) await tap('#mDone'); await wait(500);
  const best = await page.evaluate(() => dailyBest(dailyDate())); check(!!best, 'daily: best saved on this device'); await shot('title_after_daily');
}

console.log(`${oks.length} passed, ${fails.length} failed`); console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
await browser.close();
