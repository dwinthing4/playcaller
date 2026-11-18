// Round 2 fix verification + new-feature scenarios on dist/playcaller_qa3.html.
// usage: node qa/tester/r2/fix.mjs <scenario> [desk|phone] [seed]
// Real input throughout (page.touchscreen.tap / mouse / keyboard / CDP touch drags). State is staged by editing MATCH._G
// at a call sheet or dead ball (test setup only), then the real UI is driven.
import { launch } from '../lib.mjs';
import fs from 'fs';
const name = process.argv[2], which = process.argv[3] || 'desk', seed = +(process.argv[4] || 3);
const H = await launch(which, { tag: 'r2_' + name + '_' + which, seed, file: 'playcaller_qa3.html' });
const { page } = H; const phone = H.phone; const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); };
const MON = fs.readFileSync('C:/Users/dwint/football-game/qa/tester/monitor.js', 'utf8'), KMON = fs.readFileSync('C:/Users/dwint/football-game/qa/tester/r2/kmon.js', 'utf8');
const inject = async () => { await page.evaluate(MON); await page.evaluate(KMON); };
await H.newLeague(60, 5);
const NO_AUTO = ['speed'];
// ---------------------------------------------------------------- helpers
const tap = async sel => { const e = await page.$(sel); if (!e) return false; await e.scrollIntoViewIfNeeded().catch(() => { }); const r = await e.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
const box = async sel => { const e = await page.$(sel); if (!e) return null; await e.scrollIntoViewIfNeeded().catch(() => { }); const r = await e.boundingBox(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; };
const dbl = async (sel, gap = 60) => { const b = await box(sel); if (!b) return false; await H.tapAt(b.x, b.y); await H.wait(gap); await H.tapAt(b.x, b.y); return true; };
const tapAct = a => tap(`.acts [data-a="${a}"]`);
const snapStats = { taps: 0, eaten: 0 };
async function snap() { for (let k = 0; k < 4; k++) { await tapAct('snap'); snapStats.taps++; const ok = await H.until(g => g.stage !== 'pre' || g.phase !== 'pre', 700, 30); if (ok) return true; snapStats.eaten++; }
  const d = await page.evaluate(() => { const g = MATCH._G, p = g.play; const b = document.querySelector('.acts [data-a="snap"]'); const r = b && b.getBoundingClientRect(); const h = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return { stage: g.stage, mode: g.mode, userSide: g.userSide, paused: g.paused, playUser: p && p.userSide, phase: p && p.phase, motion: p && p.motion ? { go: p.motion.go, done: p.motion.done, type: p.motion.type, dx: +(p.motion.tx - p.motion.p.p.x).toFixed(2) } : null, op: p && p.op && p.op.name, acts: document.querySelector('.acts').innerHTML.slice(0, 120), snapHit: h ? h.className || h.tagName : null, ovl: document.querySelector('#gui .ovl').className, sheet: document.querySelector('.sheet').className, timers: g.timers.length, kickAnim: !!g.kickAnim }; });
  log('SNAP FAILED x4', d); if (!snapStats.shot) { snapStats.shot = 1; await H.shot('snap_failed'); } return false; }
const liveT = () => page.evaluate(() => MATCH._G.play ? +MATCH._G.play.liveT.toFixed(2) : null);
const set = obj => page.evaluate(o => { const g = MATCH._G; for (const k in o) { if (k === 'userScore') g.score[g.user] = o[k]; else if (k === 'oppScore') g.score[g.user === g.hid ? g.aid : g.hid] = o[k]; else g[k] = o[k]; } }, obj);
const rerender = () => tap('[data-f="coach"]');
const acts = () => page.evaluate(() => [...document.querySelectorAll('.sheet [data-act]')].map(b => b.dataset.act));
const pbpTail = n => page.evaluate(n => MATCH._G.pbp.slice(-n), n);
const km = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__km)));
const nPlays = () => page.evaluate(() => window.__mon.plays.length);
async function pickType(type, extra) {
  await tap(`[data-f="${type}"]`); await H.wait(220);
  const id = await page.evaluate(([t, x]) => { const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); const f = x ? new Function('p', 'return ' + x) : () => true; const pool = MATCH._G.sheet.pool.filter(p => ids.includes(p.id) && (t === 'all' || p.type === t || t === 'blitz') && !/Screen|Kneel/.test(p.name) && !p.qbRun && f(p)); return (pool[0] || {}).id || ids[0]; }, [type, extra || null]);
  await tap(`.sheet .plist [data-id="${id}"]`); return H.until(g => g.stage === 'pre', 4000, 50);
}
// throw to the most open receiver with a real tap on his bubble (phone) or his number key (desk)
async function throwOpen(mode = 'open') {
  const t = await page.evaluate(m => { const pl = MATCH._G.play; const rs = pl.receivers.slice().sort((a, b) => b.p.x - a.p.x); let bi = 0, bo = -99; rs.forEach((r, i) => { const o = pl.openness(pl.qb, r).open; if (o > bo) { bo = o; bi = i; } }); if (m === 'first') bi = 0; return { i: bi, id: rs[bi].id, open: +bo.toFixed(2), slot: rs[bi].slot }; }, mode);
  if (phone || process.env.MOUSE) { const b = await box(`.bub .rb[data-r="${t.id}"]`); if (b) await H.tapAt(b.x, b.y); } else await page.keyboard.press('Digit' + (t.i + 1));
  return t;
}
async function toSheet(side, maxMs = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const g = await H.G(); if (!g || g.stage === 'final') return g;
    if (g.kick) { await tap('#mK'); await H.wait(500); continue; }
    if (g.stage === 'call' && g.sheet) {
      if (g.sheetSide === side || side === 'any') return g;
      if (g.sheetSide === 'PAT') { await tap('[data-act="xp"]'); await H.wait(400); continue; }
      if (!(await tap('.sheet .picks .pc'))) await tap('.sheet .plist .pc'); await H.until(x => x.stage !== 'call', 3000, 80); continue;
    }
    if (g.stage === 'pre' && g.side === 'O') { await snap(); await H.wait(150); continue; }
    if (g.stage === 'live' && g.acts.includes('away')) { const lt = await liveT(); if (lt > 1.8) { await throwOpen(); await H.wait(300); } }
    await H.wait(200);
  }
  return null;
}
const untilE = async (fn, ms = 5000, step = 30) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await H.wait(step); } return false; };
const waitDead = (ms = 20000) => H.until(g => g.stage !== 'live' && g.stage !== 'pre', ms, 50);
const result = () => page.evaluate(() => { const r = MATCH._G.play && MATCH._G.play.result; return r ? { type: r.type, text: r.text, yards: +(r.yards || 0).toFixed(2), sack: !!r.sack, kind: r.kind, td: !!r.td, t: +(r.t || 0).toFixed(2) } : null; });
if (!NO_AUTO.includes(name)) { await H.startGame('play'); await inject(); await tap('#mKick'); }
const S = {};
// ================================================================ B1: pause + bubbles + stick during plays (phone, real taps)
S.pauselive = async () => {
  for (let rep = 0; rep < 2; rep++) {
    await toSheet('O'); await pickType('pass'); await H.wait(300);
    await tap('.mbtn.pause'); await H.wait(300); const a = await H.G(); log(`[${rep}] pre-snap: pause tapped -> paused`, a.paused);
    await tap('[data-m="resume"]'); await H.wait(300); log(`[${rep}] resume tapped -> paused`, (await H.G()).paused, 'stage', (await H.G()).stage);
    await snap(); await H.until(g => g.stage === 'live', 3000, 30); await H.wait(450);
    const t1 = await liveT(); await tap('.mbtn.pause'); await H.wait(120); const p1 = await H.G(); const t2 = await liveT(); await H.wait(1000); const t3 = await liveT();
    log(`[${rep}] live: pause tapped at liveT ${t1} -> paused ${p1.paused}, liveT ${t2} then ${t3} 1 s later`); if (rep === 0) await H.shot('live_paused');
    await tap('[data-m="resume"]'); await H.wait(300); const t4 = await liveT(); log(`[${rep}] resumed -> paused ${(await H.G()).paused} liveT ${t4}`);
    // stick: find an empty spot (hit = .touch) and drag sideways for 0.5 s
    const g = await H.G();
    if (g.acts.includes('away')) {
      const spot = await page.evaluate(() => { const seen = []; for (const [x, y] of [[90, 560], [120, 620], [80, 480], [150, 520], [100, 680], [195, 300], [60, 300]]) { const h = document.elementFromPoint(x, y); seen.push(h ? h.className || h.tagName : null); if (h && h.classList.contains('touch')) return [x, y]; } return { none: seen }; });
      const q0 = await page.evaluate(() => { const q = MATCH._G.play.qb; return { x: +q.p.x.toFixed(2), z: +q.p.z.toFixed(2) }; });
      const okSpot = Array.isArray(spot); if (okSpot) { await H.touchDown(spot[0], spot[1]); for (let i = 1; i <= 6; i++) { await H.touchMove(spot[0] - i * 9, spot[1]); await H.wait(40); } await H.wait(300); }
      const q1 = await page.evaluate(() => { const p = MATCH._G.play, q = p.qb; return { x: +q.p.x.toFixed(2), z: +q.p.z.toFixed(2), inX: +p.input.x.toFixed(2), inZ: +p.input.z.toFixed(2), stick: document.querySelector('.stick').classList.contains('show') }; });
      if (okSpot) await H.touchUp(); log(`[${rep}] stick drag at`, spot, 'QB', q0, '->', q1);
      const g2 = await H.G();
      if (g2.acts.includes('away')) { const t = await throwOpen(); await H.wait(250); log(`[${rep}] real tap on bubble`, t, '->', await page.evaluate(() => ({ thrown: MATCH._G.play.thrown, windup: !!MATCH._G.play.qb.windup, ball: MATCH._G.play.ball.state }))); }
    }
    await waitDead(); log(`[${rep}] result`, await result());
  }
};
// ================================================================ M1: scramble past the LOS, then tackled
S.scram = async () => {
  for (let rep = 0; rep < +(process.env.REPS || 6); rep++) {
    const g = await toSheet('O'); if (!g || g.stage === 'final') break;
    await set({ yl: 30, down: 1, togo: 10 }); await rerender(); await pickType('pass');
    const before = await page.evaluate(() => { const g = MATCH._G, q = g.play.qb; const s = g.st[q.pid] || {}; let sk = 0; for (const k in g.st) sk += g.st[k].sk || 0; return { qb: q.pid, ra: s.ra || 0, ry: s.ry || 0, sk }; });
    if (phone) await snap(); else await page.keyboard.press('Space');
    await H.until(g => g.acts.includes('away'), 3000, 30); { const t9 = Date.now(); while ((await liveT()) < 0.9 && Date.now() - t9 < 6000) await H.wait(30); }
    if (phone) { await H.touchDown(110, 600); await H.touchMove(110 + (rep % 2 ? 18 : -18), 545); } else { await page.keyboard.down('KeyW'); if (rep % 2) await page.keyboard.down('KeyD'); }
    let sawScr = false; const t0 = Date.now(); while (Date.now() - t0 < 15000) { const s = await page.evaluate(() => ({ st: MATCH._G.stage, scr: !!MATCH._G.play.scramble })); if (s.scr) sawScr = true; if (s.st !== 'live') break; await H.wait(40); if (!phone && rep % 2 && Date.now() - t0 > 500) await page.keyboard.up('KeyD'); }
    if (phone) await H.touchUp(); else { await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD'); }
    const r = await result(); await H.wait(350); const ban = (await H.G()).ban;
    const after = await page.evaluate(q => { const g = MATCH._G; const s = g.st[q] || {}; let sk = 0; for (const k in g.st) sk += g.st[k].sk || 0; return { ra: s.ra || 0, ry: s.ry || 0, sk }; }, before.qb);
    log(`[${rep}] scramble=${sawScr} result`, r, '| banner', ban, '| QB rush att', before.ra, '->', after.ra, 'rush yds', before.ry, '->', after.ry, '| team sacks credited', before.sk, '->', after.sk, '|', (await pbpTail(1))[0]);
  }
};
// ================================================================ M2: throw away
S.away = async () => {
  const step = async t => { const g = await H.G().catch(e => ({ err: e.message })); console.log('STEP', ((Date.now()) / 1000 % 1000).toFixed(1), t, JSON.stringify({ stage: g.stage, phase: g.phase, side: g.sheetSide, sheet: g.sheet, down: g.down, kick: g.kick, ban: g.ban, heap: await page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1e6)).catch(() => '?') })); };
  if (process.env.STEPS) { const orig = H.tapAt; H.tapAt = async (x, y) => { await step(`tap ${Math.round(x)},${Math.round(y)} on ${await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? (h.className || h.tagName) + ' ' + (h.dataset && (h.dataset.id || h.dataset.act || h.dataset.f || h.dataset.a) || '') : null; }, [x, y]).catch(() => '?')}`); return orig(x, y); }; }
  for (let rep = 0; rep < 3; rep++) {
    await toSheet('O'); await step('at O sheet'); await pickType('pass'); await step('picked'); const e0 = H.errs.length;
    await snap(); await H.until(g => g.acts.includes('away'), 3000, 30); { const t9 = Date.now(); while ((await liveT()) < 1.2 && Date.now() - t9 < 6000) await H.wait(30); }
    const ok = await tapAct('away'); await waitDead();
    const mon = await page.evaluate(() => { const c = window.__mon.plays[window.__mon.plays.length - 1]; return { teleports: c.teleports, maxSpd: c.maxSpd }; });
    log(`[${rep}] Throw away tapped ${ok} -> result`, await result(), 'page errors during play', H.errs.length - e0, 'monitor', mon);
  }
};
// ================================================================ M3 + m4: watch at your own snap / mid-play as QB
S.watchpre = async () => {
  for (let rep = 0; rep < 2; rep++) {
    await toSheet('O'); await pickType('pass'); await H.wait(300);
    if (phone) { await tap('.mbtn.pause'); } else await page.keyboard.press('Escape'); await H.wait(200); await tap('[data-m="watch"]');
    const t0 = Date.now(); const lv = await H.until(g => g.stage === 'live', 8000, 30); const snapAfter = (Date.now() - t0) / 1000;
    const usr = await page.evaluate(() => ({ playUser: MATCH._G.play.userSide, gUser: MATCH._G.userSide, mode: MATCH._G.mode, acts: document.querySelector('.acts').innerHTML.length, touchOn: document.querySelector('.touch').classList.contains('on') }));
    await waitDead(); const r = await result(); const thrown = await page.evaluate(() => MATCH._G.play.thrown);
    log(`[${rep}] watch at own pre-snap: snapped after ${snapAfter.toFixed(2)} s (live ${!!lv})`, usr, 'result', r, 'thrown', thrown);
    // next play runs itself?
    const n0 = await nPlays(); await H.wait(9000); log(`[${rep}]   plays started in the next 9 s (watch mode):`, (await nPlays()) - n0);
    if (phone) await tap('.mbtn.pause'); else await page.keyboard.press('Escape'); await H.wait(250); await tap('[data-m="take"]'); await H.wait(300); log(`[${rep}]   took over, mode`, (await H.G()).mode);
  }
};
S.watchlive = async () => {
  for (let rep = 0; rep < 4; rep++) {
    await toSheet('O'); await pickType('pass'); if (phone) await snap(); else await page.keyboard.press('Space');
    await H.until(g => g.stage === 'live', 3000, 30); await H.wait(450);
    if (phone) await tap('.mbtn.pause'); else await page.keyboard.press('Escape'); await H.wait(200); await tap('[data-m="watch"]');
    const t0 = Date.now(); await waitDead(30000); const r = await result();
    const th = await page.evaluate(() => ({ thrown: MATCH._G.play.thrown, userSide: MATCH._G.play.userSide, scr: !!MATCH._G.play.scramble }));
    log(`[${rep}] watch chosen mid-play (QB): play ended after ${((Date.now() - t0) / 1000).toFixed(1)} s`, r, th);
    if (phone) await tap('.mbtn.pause'); else await page.keyboard.press('Escape'); await H.wait(250); await tap('[data-m="take"]'); await H.wait(300);
  }
};
// ================================================================ M4: pause during the FG meter; pause / quit during the kick animation
S.fgmeter = async () => {
  await toSheet('O'); await set({ yl: 75, down: 4, togo: 6 }); await rerender(); await tap('[data-act="fg"]'); await H.until(g => g.kick, 3000); await H.wait(300);
  if (!phone) { await page.keyboard.press('Escape'); await H.wait(250); log('Esc during meter -> paused', (await H.G()).paused, 'meter', !!(await page.$('.meterK')), 'kick btn', !!(await page.$('#mK'))); }
  log('pause button hit-test during meter', await H.hitTest('.mbtn.pause'));
  await tap('.mbtn.pause'); await H.wait(250); log('pause tapped during meter -> paused', (await H.G()).paused, 'meter', !!(await page.$('.meterK')), 'kick btn', !!(await page.$('#mK')));
  await H.shot('meter_after_pause_attempts');
  await tap('#mK'); await untilE(() => !!MATCH._G.kickAnim, 3000, 20);
  await H.wait(250); if (phone) await tap('.mbtn.pause'); else await page.keyboard.press('Escape'); await H.wait(100);
  const a = await page.evaluate(() => ({ paused: MATCH._G.paused, t: MATCH._G.kickAnim && +MATCH._G.kickAnim.t.toFixed(2) })); await H.wait(1000); const b = await page.evaluate(() => ({ paused: MATCH._G.paused, t: MATCH._G.kickAnim && +MATCH._G.kickAnim.t.toFixed(2) }));
  log('pause during the kick flight', a, '1 s later', b); await H.shot('kick_paused');
  await tap('[data-m="resume"]'); await untilE(() => !MATCH._G.kickAnim, 6000, 50); await H.wait(600);
  log('after resume: kicks', (await km()).kicks.map(x => ({ kind: x.kind, dur: x.dur, real: x.real, paused: x.paused, camOvAfter: x.camOvAfter })), 'banner', (await H.G()).ban, await pbpTail(1));
};
S.quitkick = async () => {
  await toSheet('O'); await set({ yl: 70, down: 4, togo: 6 }); await rerender(); await tap('[data-act="fg"]'); await H.until(g => g.kick, 3000); await H.wait(200);
  await tap('#mK'); await untilE(() => !!MATCH._G.kickAnim, 3000, 20); await H.wait(350);
  if (phone) await tap('.mbtn.pause'); else await page.keyboard.press('Escape'); await H.wait(200); await tap('[data-m="quit"]'); await H.wait(800);
  log('quit during the kick flight: game open', await page.evaluate(() => !!MATCH._G), 'R3D.camOverride', await page.evaluate(() => R3D.camOverride));
  await page.evaluate(() => startUserGame('play')); await H.until(g => g.ready, 60000, 300); await tap('#mKick');
  const s = await H.until(g => g.stage === 'call' && g.sheet, 60000, 150); await H.wait(300); await H.shot('next_game_first_sheet');
  if (!phone) {}
  const s2 = await toSheet('any'); await tap('.sheet .picks .pc') || await tap('.sheet .plist .pc'); await H.until(g => g.stage === 'pre', 4000, 50); await H.wait(400); await H.shot('next_game_presnap');
  const cam = await page.evaluate(() => { const p = MATCH._G.play; const s = R3D.project(p.ballX, 0, p.losZ); return { camOverride: R3D.camOverride, ballOnScreen: s.x >= 0 && s.x <= innerWidth && s.y >= 0 && s.y <= innerHeight && !s.behind, ballScreen: [Math.round(s.x), Math.round(s.y)] }; });
  log('next game, pre-snap camera', cam);
};
// ================================================================ M5: FG / punt / kneel when the running clock expires
S.clockout = async () => {
  await toSheet('O'); await set({ q: 2, clock: 3, runoff: 20, yl: 75, down: 3, togo: 4 }); await rerender();
  log('Q2 0:03 runoff 20, sheet note:', await page.evaluate(() => (document.querySelector('.sheet .small[style*="ff9b8a"]') || {}).textContent), 'acts', await acts());
  let b = await H.G(); await tap('[data-act="fg"]'); await H.wait(300); const meter = (await H.G()).kick;
  await H.wait(2500); let a = await H.G(); log('FG tapped -> meter shown', meter, '| banners', (await km()).bans.slice(-3).map(x => x.text), '| score', b.score, '->', a.score, '| q', a.q, 'clock', a.clock, '|', await pbpTail(2));
  await toSheet('O', 90000); await set({ q: 3, clock: 3, runoff: 20, yl: 40, down: 4, togo: 4 }); await rerender(); b = await H.G();
  await tap('[data-act="punt"]'); await H.wait(2500); a = await H.G(); log('Q3 punt with expired clock -> banners', (await km()).bans.slice(-2).map(x => x.text), '| poss', b.poss, '->', a.poss, 'q', a.q, 'clock', a.clock, '| kicks', (await km()).kicks.length, '|', await pbpTail(2));
  await toSheet('O', 90000); await set({ q: 4, clock: 3, runoff: 20, yl: 50, down: 1, togo: 10, userScore: 21, oppScore: 14 }); await rerender(); log('Q4 lead, acts', await acts());
  await tap('[data-act="kneel"]'); const f = await H.until(g => g.stage === 'final', 12000, 100); log('kneel with expired clock -> final', !!f, f && f.score, (await km()).bans.slice(-3).map(x => x.text), await pbpTail(2));
};
S.cpupunt = async () => {
  for (let i = 0; i < 4; i++) {
    await toSheet('D'); await set({ q: 2, down: 3, togo: 40, yl: 30, clock: 40 }); await rerender(); await tap('.sheet .picks .pc') || await tap('.sheet .plist .pc');
    await H.until(g => g.stage === 'dead', 20000, 40); const g = await H.G(); if (g.down !== 4 || g.poss === g.user) { log('no CPU 4th down this time', { down: g.down, poss: g.poss }); continue; }
    await set({ clock: 2, runoff: 25 }); const b = await H.G(); await H.wait(4500); const a = await H.G();
    log('CPU 4th down with an expiring clock:', { before: { q: b.q, clock: b.clock, runoff: b.runoff, poss: b.poss }, after: { q: a.q, clock: a.clock, poss: a.poss, stage: a.stage } }, 'banners', (await km()).bans.slice(-3).map(x => x.text), 'kick anims', (await km()).kicks.length, await pbpTail(2)); return;
  }
};
// ================================================================ M6: two-point try and the clock
S.two = async () => {
  for (let tries = 0; tries < 6; tries++) {
    const g = await toSheet('O'); if (!g || g.stage === 'final') break;
    await set({ yl: 99, down: 1, togo: 1 }); await rerender(); await pickType('pass'); if (phone) await snap(); else await page.keyboard.press('Space');
    await H.until(g => g.acts.includes('away'), 3000, 40); await H.wait(900); await throwOpen();
    const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100); if (!p) continue;
    await set({ clock: 40, q: 2 }); await tap('[data-act="two"]'); await H.until(g => g.stage === 'call' && g.sheet, 4000); const before = await H.G();
    await pickType('pass'); if (phone) await snap(); else await page.keyboard.press('Space'); await H.until(g => g.acts.includes('away'), 3000, 50); await H.wait(1800); await throwOpen();
    await waitDead(); const r = await result(); await H.wait(300); const after = await H.G();
    log('two-point try (Q2, clock 0:40 at the try)', { playSeconds: r && r.t, clockBefore: before.clock, clockAfter: after.clock, ban: after.ban, score: after.score }); return;
  }
};
// ================================================================ M7: run moves without the stick (real taps)
S.moves = async () => {
  for (const mv of ['juke', 'spin', 'stiff', 'truck']) {
    await toSheet('O'); await set({ yl: 30, down: 1, togo: 10 }); await rerender(); await pickType('run', "!/QB|Option|Read|Sneak/.test(p.name)");
    await snap(); const c = await H.until(g => g.acts.includes('juke') || g.stage !== 'live' && g.stage !== 'pre', 6000, 20); if (!c || !c.acts.includes('juke')) { log(mv, 'no run control', c && c.stage); await waitDead(); continue; }
    await H.wait(250);
    const v0 = await page.evaluate(() => { const c = MATCH._G.play.carrier; return { vx: +c.vel.x.toFixed(2), vz: +c.vel.z.toFixed(2) }; });
    await tapAct(mv); await H.wait(50);
    const m = await page.evaluate(() => { const p = MATCH._G.play, c = p.carrier; return c ? { juke: +c.jukeT.toFixed(2), spin: +c.spinT.toFixed(2), stiff: +c.stiffT.toFixed(2), truck: +c.truckT.toFixed(2), touched: p.userTouched, flags: ['juke', 'spin', 'stiff', 'truck'].filter(k => p.input[k]).join(',') } : null; });
    // how does he run afterwards with no stick?
    const path = []; for (let i = 0; i < 8; i++) { await H.wait(150); const s = await page.evaluate(() => { const g = MATCH._G, c = g.play.carrier; return g.stage === 'live' && c ? [+c.vel.x.toFixed(1), +c.vel.z.toFixed(1)] : null; }); if (!s) break; path.push(s); }
    await waitDead(); log(`${mv}: tapped (no stick) -> 50 ms later`, m, '| vel before', v0, 'vel after (x,z) every 150 ms', JSON.stringify(path), '| result', await result());
  }
};
// ================================================================ m1: defensive audible keeps the CPU's offensive call (and its formation side)
S.audD = async () => {
  for (let rep = 0; rep < 5; rep++) {
    await toSheet('D'); await tap('.sheet .picks .pc') || await tap('.sheet .plist .pc'); await H.until(g => g.stage === 'pre', 3000, 40); await H.wait(200);
    const o0 = await page.evaluate(() => { const p = MATCH._G.play; return { op: p.op.name, flip: !!p.op.flip, xs: p.receivers.map(r => r.slot + ':' + r.p.x.toFixed(1)).join(' ') }; });
    await tapAct('audible'); await H.until(g => g.stage === 'call' && g.sheet, 3000, 40); const cpuO = await page.evaluate(() => MATCH._G.sheet.cpuO && MATCH._G.sheet.cpuO.name);
    await tap('.sheet .picks .pc:last-child') || await tap('.sheet .plist .pc'); await H.until(g => g.stage === 'pre', 3000, 40); await H.wait(150);
    const o1 = await page.evaluate(() => { const p = MATCH._G.play; return { op: p.op.name, flip: !!p.op.flip, xs: p.receivers.map(r => r.slot + ':' + r.p.x.toFixed(1)).join(' ') }; });
    log(`[${rep}] defensive audible: offense before`, o0, '| sheet cpuO', cpuO, '| after', o1, '| same play', o0.op === o1.op, '| same side', o0.flip === o1.flip);
    await waitDead();
  }
};
// ================================================================ m2: timeout only while the clock runs
S.timeout = async () => {
  let g = await toSheet('O'); log('O sheet, runoff', g.runoff, 'acts', await acts());
  await set({ runoff: 10, q: 2, clock: 40 }); await rerender(); log('O sheet with runoff 10, acts', await acts());
  g = await toSheet('D'); log('D sheet, runoff', g.runoff, 'acts', await acts());
  await set({ runoff: 10 }); await rerender(); log('D sheet with runoff 10, acts', await acts());
};
// ================================================================ m3 / guard: double taps on every sheet action
S.dbl = async () => {
  const G0 = () => H.G();
  // timeout
  await toSheet('O'); await set({ runoff: 10, q: 2, clock: 40, yl: 30, down: 1, togo: 10 }); await rerender();
  let b = await G0(); const n0 = await nPlays(); const fl0 = await page.evaluate(() => MATCH._G.flip);
  await dbl('[data-act="to"]'); await H.wait(600); let a = await G0();
  log('double-tap Timeout: TOs', b.to[b.user], '->', a.to[a.user], '| flip', fl0, '->', await page.evaluate(() => MATCH._G.flip), '| plays started', (await nPlays()) - n0, '| stage', a.stage);
  // play card
  if (a.stage === 'call') { const n1 = await nPlays(); await tap('[data-f="run"]'); await H.wait(200); await dbl('.sheet .plist .pc'); await H.wait(700); log('double-tap play card: plays started', (await nPlays()) - n1, 'noteCall total', await page.evaluate(() => (L.tend && Object.values(L.tend.plays || {}).reduce((s, x) => s + (typeof x === 'number' ? x : 0), 0)) || 'n/a')); }
  // spike
  await toSheet('O'); await set({ runoff: 10, q: 2, clock: 40, down: 1, togo: 10, yl: 30 }); await rerender(); b = await G0();
  await dbl('[data-act="spike"]'); await H.wait(2500); a = await G0(); log('double-tap Spike: down', b.down, '->', a.down, '| spikes in pbp', (await pbpTail(4)).filter(x => /spikes/.test(x)).length, '| clock', b.clock, '->', a.clock);
  // kneel
  await toSheet('O'); await set({ q: 4, clock: 50, runoff: 0, down: 1, togo: 10, yl: 50, userScore: 21, oppScore: 0 }); await rerender(); b = await G0();
  if ((await acts()).includes('kneel')) { await dbl('[data-act="kneel"]'); await H.wait(2500); a = await G0(); log('double-tap Kneel: down', b.down, '->', a.down, '| kneels in pbp', (await pbpTail(4)).filter(x => /kneels/.test(x)).length, '| clock', b.clock, '->', a.clock); }
  // punt
  await toSheet('O'); await set({ q: 4, clock: 50, runoff: 0, down: 4, togo: 8, yl: 30 }); await rerender(); b = await G0();
  await dbl('[data-act="punt"]'); await H.wait(7000); a = await G0(); log('double-tap Punt: punts in pbp', (await pbpTail(6)).filter(x => /punts/.test(x)).length, '| kick anims', (await km()).kicks.length, '| poss', b.poss, '->', a.poss);
  // FG
  await toSheet('O'); await set({ q: 4, clock: 50, runoff: 0, down: 4, togo: 8, yl: 75 }); await rerender();
  await dbl('[data-act="fg"]'); await H.until(g => g.kick, 3000); await H.wait(300); await tap('#mK'); await H.wait(7000); log('double-tap FG: field goals in pbp', (await pbpTail(6)).filter(x => /field goal/.test(x)).length);
  // sim drive
  await toSheet('O'); await set({ q: 1, clock: 55, runoff: 0, down: 1, togo: 10, yl: 25 }); await rerender(); b = await G0(); const pb0 = await page.evaluate(() => MATCH._G.pbp.length);
  await dbl('[data-act="simd"]'); const s = await H.until(g => (g.stage === 'call' && g.sheet && !g.sim) || g.stage === 'final', 90000, 100); const pb1 = await page.evaluate(() => MATCH._G.pbp.length); const g1 = await G0();
  await H.wait(6000); const pb2 = await page.evaluate(() => MATCH._G.pbp.length); const g2 = await G0();
  log('double-tap Sim drive: plays logged in the drive', pb1 - pb0, '| after the drive: stage', g1.stage, 'sheet', g1.sheetSide, 'sim', g1.sim, '| 6 s later: new pbp lines', pb2 - pb1, 'stage', g2.stage, 'sheet', g2.sheetSide, 'q', g1.q + '->' + g2.q, 'clock', g1.clock + '->' + g2.clock, 'timers', g2.timers);
  log('   pbp of the drive', await page.evaluate(([a, b]) => MATCH._G.pbp.slice(a, b), [pb0, pb2]));
  // PAT: XP and two
  for (const kind of ['xp', 'two']) {
    for (let i = 0; i < 5; i++) { const g = await toSheet('O'); if (!g || g.stage === 'final') return; await set({ yl: 99, down: 1, togo: 1 }); await rerender(); await pickType('pass'); if (phone) await snap(); else await page.keyboard.press('Space');
      await H.until(g => g.acts.includes('away'), 3000, 40); await H.wait(900); await throwOpen(); const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100); if (!p) continue;
      const s0 = (await G0()).score, n2 = await nPlays(), f0 = await page.evaluate(() => MATCH._G.flip);
      await dbl(`[data-act="${kind}"]`); await H.wait(kind === 'xp' ? 4500 : 900); const g3 = await G0();
      log(`double-tap ${kind}:`, 'score', s0, '->', g3.score, '| stage', g3.stage, 'sheet', g3.sheetSide, '| plays started', (await nPlays()) - n2, '| flip', f0, '->', await page.evaluate(() => MATCH._G.flip), '| filter', await page.evaluate(() => MATCH._G.sheet && MATCH._G.sheet.filter));
      if (kind === 'two' && g3.stage === 'call') { await tap('.sheet .picks .pc') || await tap('.sheet .plist .pc'); }
      break; }
  }
};
// ================================================================ m5: watch speed for the whole game
S.speed = async () => {
  await page.evaluate(() => startUserGame('watch')); await H.until(g => g.ready, 60000, 300); await inject();
  await H.until(g => g.stage === 'call' || g.stage === 'pre' || g.stage === 'live' || g.stage === 'dead', 30000, 200);
  const gs = g => (g.q - 1) * 60 + (60 - g.clock);
  for (const sp of [1, 4]) {
    while ((await page.evaluate(() => MATCH._G.speed)) !== sp) { await tap('.mbtn.spd'); await H.wait(120); }
    const a = await H.G(), n0 = await nPlays(), t0 = Date.now(); await H.wait(25000); const b = await H.G(), n1 = await nPlays();
    log(`watch ${sp}x for ${((Date.now() - t0) / 1000).toFixed(0)} s real: game clock advanced ${(gs(b) - gs(a)).toFixed(1)} s, plays started ${n1 - n0}, Q${a.q} ${a.clock} -> Q${b.q} ${b.clock}`);
  }
  log('kick anims while watching', (await km()).kicks.map(k => ({ kind: k.kind, dur: k.dur, real: k.real })));
  if (process.env.FULL) { const f = await H.until(g => g.stage === 'final', 900000, 1000); log('watched to the end at 4x:', !!f, f && f.score);
    const calls = await page.evaluate(() => { const g = MATCH._G, u = g.user, by = {}; for (const p of window.__mon.plays) { if (!p.res || p.pre.pat) continue; const side = p.pre.poss === u ? 'userO' : 'userD'; const k = side + ' ' + (p.pre.down || '?'); const nm = side === 'userO' ? p.op : p.dp; (by[k] = by[k] || {})[nm] = (by[k][nm] || 0) + 1; } return by; });
    for (const k of Object.keys(calls).sort()) { const v = calls[k], n = Object.values(v).reduce((a, b) => a + b, 0); log(`  coordinator calls ${k}: ${n} calls, ${Object.keys(v).length} different plays, most used ${Math.max(...Object.values(v))}x`, JSON.stringify(v)); }
    await tap('#mDone'); await H.wait(1200); log('after Continue (watched game)', await page.evaluate(() => { const T = L.teams[L.user]; const g = L.sched.flat().find(x => (x.h === L.user || x.a === L.user) && x.done); return { week: L.week, rec: `${T.w}-${T.l}-${T.tie || 0}`, done: !!g, hs: g && g.hs, as: g && g.as }; })); }
};
// ================================================================ m7: time at the line on defense + pre-snap Switch order
S.predef = async () => {
  for (let rep = 0; rep < 2; rep++) {
    await toSheet('D'); await tap('.sheet .picks .pc') || await tap('.sheet .plist .pc'); const t0 = Date.now(); await H.until(g => g.stage === 'pre', 3000, 20); const tp = Date.now();
    const order = [];
    if (rep === 1) for (let i = 0; i < 6; i++) { order.push(await page.evaluate(() => { const p = MATCH._G.play, d = p.userD; return `${d.slot}@${Math.hypot(d.p.x - p.ballX, d.p.z - p.losZ).toFixed(1)}m`; })); await tapAct('switch'); await H.wait(90); }
    await H.until(g => g.stage === 'live', 8000, 20); const tl = Date.now();
    log(`[${rep}] defense: card tapped -> pre ${((tp - t0) / 1000).toFixed(2)} s, pre -> snap ${((tl - tp) / 1000).toFixed(2)} s`, rep === 1 ? 'pre-snap Switch order (slot@distance from ball): ' + order.join(' -> ') : '');
    await waitDead();
  }
};
// ================================================================ m10: kneel across the two-minute warning (WARN = 15 s with 60 s quarters)
S.kneelwarn = async () => {
  await toSheet('O'); await set({ q: 4, clock: 18, runoff: 3, down: 1, togo: 10, yl: 50, userScore: 21, oppScore: 14 }); await rerender();
  await tap('[data-act="kneel"]'); await H.wait(3500); const a = await H.G();
  log('kneel at Q4 0:18 with 3 s runoff: clock now', a.clock, 'runoff', a.runoff, 'warned', await page.evaluate(() => MATCH._G.warned), 'banners', (await km()).bans.slice(-3).map(x => x.text));
};
// ================================================================ m11: sim drive at the end of the half
S.simhalf = async () => {
  await toSheet('O'); await page.evaluate(() => { const g = MATCH._G; g.recvFirst = g.user === g.hid ? g.aid : g.hid; });   // so the user receives the 2nd-half kickoff
  await set({ q: 2, clock: 6, runoff: 0, yl: 25, down: 1, togo: 10 }); await rerender();
  await tap('[data-act="simd"]'); const s = await H.until(g => (g.stage === 'call' && g.sheet && !g.sim) || g.stage === 'final', 90000, 100);
  log('sim drive late in Q2 -> first decision', s && { q: s.q, clock: s.clock, side: s.sheetSide, sim: s.sim, poss: s.poss, user: s.user }, (await pbpTail(5)));
};
// ================================================================ m8: frame dt clamp under CPU load
S.fps = async () => {
  await toSheet('O'); await pickType('run');
  for (const rate of [1, 4, 8, 14]) { await H.cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const fps = await H.fps(1500); const r = await page.evaluate(() => new Promise(res => { const g = MATCH._G, t0 = performance.now(), g0 = g.time; setTimeout(() => res({ real: (performance.now() - t0) / 1000, game: g.time - g0 }), 3000); }));
    log(`cpu x${rate}: fps ${fps.toFixed(0)}, game seconds per real second ${(r.game / r.real).toFixed(2)}`); }
  await H.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
};
// ================================================================ NEW: 3D kicks (FG, XP, punt, CPU kicks)
S.kicks = async () => {
  const kickShot = async tag => { await untilE(() => !!MATCH._G.kickAnim, 4000, 20); await H.wait(350); await H.shot(tag + '_flight'); await untilE(() => !MATCH._G.kickAnim, 8000, 40); await H.wait(150); await H.shot(tag + '_result'); };
  // user FG
  await toSheet('O'); await set({ yl: 72, down: 4, togo: 6 }); await rerender(); await tap('[data-act="fg"]'); await H.until(g => g.kick, 3000);
  for (let i = 0; i < 300; i++) { const l = await page.evaluate(() => parseFloat(document.querySelector('.meterK i').style.left)); if (Math.abs(l - 50) < 7) break; await H.wait(8); }
  await tap('#mK'); await kickShot('fg'); await H.wait(800);
  // user XP after a staged TD
  for (let i = 0; i < 5; i++) { await toSheet('O'); await set({ yl: 99, down: 1, togo: 1 }); await rerender(); await pickType('run', "!/QB|Option|Read/.test(p.name)"); await snap();
    const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100); if (!p) continue; await tap('[data-act="xp"]'); await kickShot('xp'); break; }
  await H.wait(800);
  // user punt
  await toSheet('O'); await set({ yl: 35, down: 4, togo: 9 }); await rerender(); await tap('[data-act="punt"]'); await kickShot('punt'); await H.wait(800);
  // CPU kicks: give the CPU 3rd & 30 so it faces 4th down
  for (let i = 0; i < 4 && (await km()).kicks.length < 4; i++) { await toSheet('D'); await set({ down: 3, togo: 30, yl: i % 2 ? 40 : 68, q: 1, clock: 50 }); await rerender(); await tap('.sheet .picks .pc') || await tap('.sheet .plist .pc'); await H.until(g => g.stage === 'dead', 20000, 40); await H.wait(3500); }
  await H.wait(2500);
  const K = await km();
  for (const k of K.kicks) log('kick', { kind: k.kind, dur: k.dur, real: k.real, frames: k.frames, ballOnScreen: +(k.ballOn / Math.max(1, k.frames)).toFixed(2), ballMaxY: k.ballMaxY, camOverrideFrames: k.camOv, camOvAfter: k.camOvAfter, start: k.start, end: k.end, banDuring: k.banDuring });
  // banner order: the result banner must come after the flight
  log('banners around kicks', K.bans.filter(b => /GOOD|PUNT|FIELD|EXTRA|TOUCHBACK|RETURN/.test(b.text)).map(b => `${b.t} ${b.text} (kickAnim ${b.kickAnim})`));
  log('kicks start/end times', K.kicks.map(k => `${k.kind} ${k.t0}-${k.t1}`));
};
// ================================================================ M10: fallen receivers -> red bubble
S.fallen = async () => {
  await page.evaluate(() => { const F = window.__fall = { frames: 0, downFrames: 0, viol: 0, samples: [] }; const since = {};
    const f = () => { requestAnimationFrame(f); const g = MATCH._G; if (!g || g.stage !== 'live' || !g.play || g.userSide !== 'O') return; const p = g.play; if (!document.querySelector('.bub.on')) return; F.frames++;
      for (const r of p.receivers) { const n = document.querySelector(`.bub .rb[data-r="${r.id}"]`); if (!n) continue; if (!r.upright()) { since[r.id] = since[r.id] || performance.now(); F.downFrames++; if (performance.now() - since[r.id] > 200 && !n.classList.contains('r')) { F.viol++; if (F.samples.length < 6) F.samples.push({ slot: r.slot, bal: r.bal, cls: n.className, open: +p.openness(p.qb, r).open.toFixed(2) }); } } else since[r.id] = 0; } }; requestAnimationFrame(f); });
  const res = []; for (let rep = 0; rep < 10; rep++) { const g = await toSheet('O'); if (!g || g.stage === 'final') break; await set({ yl: 30, down: 1, togo: 10 }); await rerender(); await pickType('pass', "/Drag|Flat|Mesh|Slant|Quick|Cross/.test(p.name)");
    if (phone) await snap(); else await page.keyboard.press('Space'); await H.until(g => g.acts.includes('away'), 3000, 30);
    { const t9 = Date.now(); while ((await liveT()) < 2.4 && (await H.G()).acts.includes('away') && Date.now() - t9 < 8000) await H.wait(40); }
    let t = null; if ((await H.G()).acts.includes('away')) { const col = await page.evaluate(() => [...document.querySelectorAll('.bub .rb')].map(n => n.textContent.replace(/\d+$/, '') + ':' + (n.classList.contains('r') ? 'red' : n.classList.contains('y') ? 'yellow' : 'green')).join(' ')); t = await throwOpen(); t.colours = col; }
    await waitDead(); const r = await result(); res.push({ t, r }); }
  log('fallen-receiver check', await page.evaluate(() => window.__fall));
  for (const x of res) log('  throw', x.t, '->', x.r && x.r.type, x.r && x.r.text, x.r && x.r.yards);
};
// ================================================================ NEW: does the sliding-away sheet swallow an early SNAP tap?
S.snapeat = async () => {
  const res = {};
  for (const d of [60, 150, 250, 350, 500, 60, 150, 250, 350, 500]) {
    const g = await toSheet('O'); if (!g || g.stage === 'final') break;
    await tap('[data-f="run"]'); await H.wait(200); const card = await box('.sheet .plist .pc'); await H.tapAt(card.x, card.y); const t0 = Date.now();
    await H.until(g => g.stage === 'pre', 2000, 10); const wait = d - (Date.now() - t0); if (wait > 0) await H.wait(wait);
    const sb = await box('.acts [data-a="snap"]'); const hit = sb ? await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? h.className || h.tagName : null; }, [sb.x, sb.y]) : 'no snap button';
    if (sb) await H.tapAt(sb.x, sb.y); const ok = await H.until(g => g.stage !== 'pre', 600, 20);
    (res[d] = res[d] || []).push(ok ? 'snapped' : 'EATEN(' + hit + ')'); if (!ok) await snap(); await waitDead();
  }
  log('SNAP tapped N ms after calling the play:', res);
};
S.dbl2 = async () => {
  const G0 = () => H.G(); let b, a;
  // FG
  await toSheet('O'); await set({ q: 1, clock: 50, runoff: 0, down: 4, togo: 8, yl: 75 }); await rerender();
  await dbl('[data-act="fg"]'); const m = await H.until(g => g.kick, 3000); await H.wait(300); const ov = await page.evaluate(() => document.querySelectorAll('.meterK').length); await tap('#mK'); await H.wait(7000);
  log('double-tap FG: meter shown', !!m, 'meters', ov, '| field goals in pbp', (await pbpTail(6)).filter(x => /field goal/.test(x)).length, '| kick anims', (await km()).kicks.length);
  // sim drive
  await toSheet('O'); await set({ q: 1, clock: 55, runoff: 0, down: 1, togo: 10, yl: 25 }); await rerender(); b = await G0(); const pb0 = await page.evaluate(() => MATCH._G.pbp.length);
  await dbl('[data-act="simd"]'); const s = await H.until(g => (g.stage === 'call' && g.sheet && !g.sim) || g.stage === 'final', 90000, 100); const pb1 = await page.evaluate(() => MATCH._G.pbp.length); const g1 = await G0();
  await H.wait(6000); const pb2 = await page.evaluate(() => MATCH._G.pbp.length); const g2 = await G0();
  log('double-tap Sim drive: pbp lines during the drive', pb1 - pb0, '| after: stage', g1.stage, 'sheet', g1.sheetSide, 'sim', g1.sim, 'poss', b.poss + '->' + g1.poss, '| 6 s later: new pbp lines', pb2 - pb1, 'stage', g2.stage, 'q', g1.q + '->' + g2.q, 'clock', g1.clock + '->' + g2.clock, 'timers', g2.timers);
  log('   pbp of the drive', await page.evaluate(([a, b]) => MATCH._G.pbp.slice(a, b), [pb0, pb2]));
  // PAT: XP and two
  for (const kind of ['xp', 'two']) {
    for (let i = 0; i < 5; i++) { const g = await toSheet('O'); if (!g || g.stage === 'final') return; await set({ yl: 99, down: 1, togo: 1, q: 2, clock: 55 }); await rerender(); await pickType('run', "!/QB|Option|Read/.test(p.name)"); if (phone) await snap(); else await page.keyboard.press('Space');
      const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100); if (!p) continue;
      const s0 = (await G0()).score, n2 = await nPlays(), f0 = await page.evaluate(() => MATCH._G.flip);
      await dbl(`[data-act="${kind}"]`); await H.wait(kind === 'xp' ? 4500 : 900); const g3 = await G0();
      log(`double-tap ${kind}:`, 'score', s0, '->', g3.score, '| stage', g3.stage, 'sheet', g3.sheetSide, '| plays started', (await nPlays()) - n2, '| flip', f0, '->', await page.evaluate(() => MATCH._G.flip), '| filter', await page.evaluate(() => MATCH._G.sheet && MATCH._G.sheet.filter));
      break; }
  }
};
S.simq1 = async () => {
  await toSheet('O'); await set({ q: 1, clock: 6, runoff: 0, yl: 25, down: 1, togo: 10 }); await rerender(); const b = await H.G();
  await tap('[data-act="simd"]'); const s = await H.until(g => (g.stage === 'call' && g.sheet && !g.sim) || g.stage === 'final', 90000, 100);
  log('sim drive started at Q1 0:06 -> first decision', s && { q: s.q, clock: s.clock, side: s.sheetSide, sim: s.sim, possBefore: b.poss, poss: s.poss, down: s.down, yl: s.yl }, await pbpTail(3));
};
try { await S[name](); } catch (e) { log('SCRIPT ERROR', e.message.split('\n')[0]); await H.shot('script_error').catch(() => { }); }
log('snap taps', JSON.stringify(snapStats));
log(H.errs.length ? `ERRORS (${H.errs.length}) ` + [...new Set(H.errs)].slice(0, 6).join(' || ') : 'no page errors');
log('anomalies', await page.evaluate(() => window.__mon ? window.__mon.anomalies.slice(0, 10) : []).catch(() => 'n/a'));
fs.writeFileSync(`C:/Users/dwint/football-game/qa/tester/r2/out3_${name}_${which}.txt`, out.join('\n'));
await H.close();
