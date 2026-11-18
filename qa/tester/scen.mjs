// Targeted rule/flow scenarios. State is staged by editing MATCH._G at a dead ball / call sheet (test setup only),
// then the real UI is driven. usage: node qa/tester/scen.mjs <name> [desk|phone]
import { launch } from './lib.mjs';
import fs from 'fs';
const name = process.argv[2], which = process.argv[3] || 'desk';
const H = await launch(which, { tag: 'sc_' + name + '_' + which, seed: +(process.argv[4] || 3) });
const { page } = H; const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); };
await H.newLeague(60, 5); await H.startGame('play');
await page.evaluate(fs.readFileSync('C:/Users/dwint/football-game/qa/tester/monitor.js', 'utf8'));
await page.click('#mKick');
const click = async sel => { const e = await page.$(sel); if (!e) return false; await e.scrollIntoViewIfNeeded().catch(() => { }); await e.click({ timeout: 3000 }).catch(err => log('click fail', sel, err.message.split('\n')[0])); return true; };
async function toSheet(side, maxMs = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { const g = await H.G(); if (!g || g.stage === 'final') return g;
    if (g.kick) { await click('#mK'); await H.wait(500); continue; }
    if (g.stage === 'call' && g.sheet) { if (g.sheetSide === side || side === 'any') return g; if (g.sheetSide === 'PAT') { await click('[data-act="xp"]'); await H.wait(400); continue; } await click('.sheet .picks .pc'); await H.wait(400); continue; }
    if (g.stage === 'pre' && g.side === 'O') await page.keyboard.press('Space');
    if (g.stage === 'live' && g.acts.includes('away')) { const lt = await page.evaluate(() => MATCH._G.play.liveT); if (lt > 1.8) await page.keyboard.press('Digit2'); }
    await H.wait(200); }
  return null;
}
const set = obj => page.evaluate(o => { const g = MATCH._G; for (const k in o) { if (k === 'scoreH') g.score[g.hid] = o[k]; else if (k === 'scoreA') g.score[g.aid] = o[k]; else g[k] = o[k]; } }, obj);
const rerender = () => click('[data-f="coach"]');
const acts = () => page.evaluate(() => [...document.querySelectorAll('.sheet [data-act]')].map(b => b.dataset.act + (b.textContent ? ':' + b.textContent.trim() : '')));
const pick = async type => { await click(`[data-f="${type}"]`); await H.wait(200); const id = await page.evaluate(t => { const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); const pool = MATCH._G.sheet.pool.filter(p => ids.includes(p.id) && (t === 'any' || p.type === t) && !/Screen|Kneel/.test(p.name)); return (pool[0] || {}).id || ids[0]; }, type); await click(`.sheet .plist [data-id="${id}"]`); await H.until(g => g.stage === 'pre', 4000, 50); };
const pbpTail = n => page.evaluate(n => MATCH._G.pbp.slice(-n), n);
const S = {};
// ---- pause during the field-goal kick meter
S.fgpause = async () => {
  await toSheet('O'); await set({ yl: 75, down: 4, togo: 6 }); await rerender(); log('acts', await acts());
  await click('[data-act="fg"]'); await H.until(g => g.kick, 3000); await H.shot('meter');
  log('pause hit during meter (phone layer check)', await H.hitTest('.mbtn.pause'));
  await page.keyboard.press('Escape'); await H.wait(300); log('after Esc', await H.G()); await H.shot('meter_paused');
  await click('[data-m="resume"]'); await H.wait(400);
  const g = await H.G(); log('after resume', { stage: g.stage, kick: g.kick, ovl: g.ovl, meter: await page.$('.meterK') ? 'visible' : 'GONE', kickBtn: await page.$('#mK') ? 'yes' : 'NO' }); await H.shot('meter_after_resume');
  await H.wait(5000); const g2 = await H.G(); log('5s later', { stage: g2.stage, kick: g2.kick, score: g2.score });
  await page.keyboard.press('Space'); await H.wait(3500); log('after Space', await H.G(), await pbpTail(2));
};
// ---- switch to "watch" while your offense is at the line
S.watchpre = async () => {
  await toSheet('O'); await pick('pass'); await H.wait(400);
  await page.keyboard.press('Escape'); await H.wait(200); await click('[data-m="watch"]'); await H.wait(300);
  const g0 = await H.G(); log('watch chosen at pre-snap', { stage: g0.stage, phase: g0.phase, mode: g0.mode, side: g0.side });
  await H.wait(10000); const g1 = await H.G(); log('10 s later', { stage: g1.stage, phase: g1.phase, mode: g1.mode, acts: g1.acts, clock: g1.clock }); await H.shot('watch_pre_after10s');
  // and mid-play as QB
  await page.keyboard.press('Escape'); await H.wait(200); await click('[data-m="take"]').catch(() => { }); await H.wait(300);
  log('took over', await H.G());
};
S.watchlive = async () => {
  await toSheet('O'); await pick('pass'); await page.keyboard.press('Space'); await H.until(g => g.stage === 'live', 3000, 50); await H.wait(500);
  await page.keyboard.press('Escape'); await H.wait(200); await click('[data-m="watch"]');
  const t0 = Date.now(); const g1 = await H.until(g => g.stage !== 'live', 30000, 100); const r = await page.evaluate(() => MATCH._G.play.result);
  log('after watch mid-pass-play', { secs: (Date.now() - t0) / 1000, type: r && r.type, text: r && r.text, t: r && r.t, thrown: await page.evaluate(() => MATCH._G.play.thrown) });
  await H.wait(6000); log('then', await H.G());
};
// ---- two-point try runs the game clock?
S.two = async () => {
  for (let tries = 0; tries < 6; tries++) {
    const g = await toSheet('O'); if (!g || g.stage === 'final') break;
    await set({ yl: 99, down: 1, togo: 1 }); await rerender(); await pick('run'); await page.keyboard.press('Space');
    const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100);
    if (!p) { log('no TD this try', await H.G()); continue; }
    log('PAT sheet', { clock: p.clock, q: p.q, score: p.score }); await H.shot('pat');
    await click('[data-act="two"]'); await H.until(g => g.stage === 'call' && g.sheet, 4000); const before = await H.G(); log('two-point sheet clock', before.clock, 'runoff', before.runoff, 'acts', await acts());
    await pick('pass'); await page.keyboard.press('Space'); await H.until(g => g.acts.includes('away'), 3000, 50); await H.wait(1500); await page.keyboard.press('Digit1');
    await H.until(g => g.stage === 'dead', 20000, 50); const r = await page.evaluate(() => MATCH._G.play.result.t);
    await H.wait(300); const after = await H.G(); log('after two-point try', { playT: r, clockBefore: before.clock, clockAfter: after.clock, score: after.score, ban: after.ban });
    return;
  }
};
// ---- kick a FG / punt when the running clock has already expired
S.fgclock = async () => {
  await toSheet('O'); await set({ q: 2, clock: 3, runoff: 20, yl: 75, down: 3, togo: 4 }); await rerender(); await H.shot('sheet_clock_out');
  log('sheet note', await page.evaluate(() => (document.querySelector('.sheet .small[style*="ff9b8a"]') || {}).textContent), 'acts', await acts());
  const before = await H.G(); await click('[data-act="fg"]'); await H.until(g => g.kick, 3000); await click('#mK');
  await H.wait(4500); const after = await H.G(); log('FG with expired clock', { before: { q: before.q, clock: before.clock, runoff: before.runoff, score: before.score }, after: { q: after.q, clock: after.clock, score: after.score, ban: after.ban } }, await pbpTail(3));
};
S.puntclock = async () => {
  await toSheet('O'); await set({ q: 2, clock: 3, runoff: 20, yl: 40, down: 4, togo: 4 }); await rerender();
  const before = await H.G(); await click('[data-act="punt"]'); await H.wait(3000); const after = await H.G(); log('punt with expired clock', { before: { q: before.q, clock: before.clock, runoff: before.runoff }, after: { q: after.q, clock: after.clock, poss: after.poss, yl: after.yl, ban: after.ban } }, await pbpTail(3));
};
// ---- double taps on sheet actions
S.dbl = async () => {
  const dbl = async sel => { const e = await page.$(sel); const b = await e.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await page.mouse.click(x, y); await H.wait(60); await page.mouse.click(x, y); };
  await toSheet('O'); await set({ yl: 30, down: 4, togo: 8 }); await rerender(); const b = await H.G();
  await dbl('[data-act="punt"]'); await H.wait(4500); const a = await H.G(); const pb = await pbpTail(4);
  log('double-tap punt', { possBefore: b.poss, possAfter: a.poss, ylAfter: a.yl, punts: pb.filter(x => /punts/.test(x)).length }, pb);
  await toSheet('O'); await set({ yl: 50, down: 2, togo: 8, q: 4, clock: 50, scoreH: 21, scoreA: 0, scoreHx: 0 }); await rerender(); log('acts (lead late)', await acts());
  const k0 = await H.G(); if ((await acts()).some(x => x.startsWith('kneel'))) { await dbl('[data-act="kneel"]'); await H.wait(2500); const k1 = await H.G(); log('double-tap kneel', { downBefore: k0.down, downAfter: k1.down, kneels: (await pbpTail(4)).filter(x => /kneels/.test(x)).length }); }
  const t0 = await H.G(); await dbl('[data-act="to"]'); await H.wait(300); const t1 = await H.G(); log('double-tap timeout', t0.to[t0.user], '->', t1.to[t1.user]);
  // play card double tap
  await click('[data-f="run"]'); await H.wait(200); const n0 = await page.evaluate(() => window.__mon.plays.length); await dbl('.sheet .plist .pc'); await H.wait(600); const n1 = await page.evaluate(() => window.__mon.plays.length); log('double-tap play card: plays started', n1 - n0);
  // PAT double tap
  await page.keyboard.press('Space');
  for (let i = 0; i < 4; i++) { const g = await toSheet('O'); if (!g) break; await set({ yl: 99, down: 1, togo: 1 }); await rerender(); await pick('run'); await page.keyboard.press('Space'); const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100); if (!p) continue;
    const s0 = (await H.G()).score; await dbl('[data-act="xp"]'); await H.wait(1500); const s1 = (await H.G()).score; log('double-tap XP', s0, '->', s1); break; }
};
// ---- overtime: tie at the end of Q4
S.ot = async () => {
  await toSheet('any'); await set({ q: 4, clock: 2, runoff: 25, scoreH: 17, scoreA: 17 }); await rerender(); await click('.sheet .picks .pc');
  const o = await H.until(g => g.q === 5, 15000, 100); log('OT reached', o && { q: o.q, clock: o.clock, to: o.to, ban: o.ban, kickNext: o.kickNext }); await H.shot('ot');
  // let OT run to a tie: set the clock near zero again
  const g = await toSheet('any'); await set({ clock: 2, runoff: 25 }); await rerender(); await click('.sheet .picks .pc');
  const f = await H.until(g => g.stage === 'final', 20000, 200); log('end of OT', f && { stage: f.stage, q: f.q, score: f.score }); await H.shot('ot_final');
  log('final card', await page.evaluate(() => document.querySelector('#gui .ovl').innerText.slice(0, 200)));
  await click('#mDone'); await H.wait(800);
  log('league', await page.evaluate(() => { const T = L.teams[L.user], g = L.sched[0].find(x => x.h === L.user || x.a === L.user); return { done: g.done, hs: g.hs, as: g.as, rec: `${T.w}-${T.l}-${T.tie || 0}`, week: L.week }; }));
};
S.otsd = async () => {
  await toSheet('any'); await set({ q: 4, clock: 2, runoff: 25, scoreH: 10, scoreA: 10 }); await rerender(); await click('.sheet .picks .pc');
  await H.until(g => g.q === 5, 15000, 100);
  const g = await toSheet('O'); log('OT offense', g && { q: g.q, score: g.score }); await set({ yl: 75, down: 2, togo: 5 }); await rerender(); log('acts', await acts()); await click('[data-act="fg"]'); await H.until(g => g.kick, 3000);
  // stop dead centre: poll needle
  for (let i = 0; i < 200; i++) { const l = await page.evaluate(() => parseFloat(document.querySelector('.meterK i').style.left)); if (Math.abs(l - 50) < 6) break; await H.wait(10); }
  await click('#mK'); const f = await H.until(g => g.stage === 'final' || g.stage === 'call', 15000, 150); log('after OT FG', f && { stage: f.stage, q: f.q, score: f.score, over: f.over }, await pbpTail(3)); await H.shot('otsd_final');
};
// ---- halftime: who receives, timeouts reset
S.half = async () => {
  const g0 = await toSheet('any'); const first = await page.evaluate(() => MATCH._G.recvFirst);
  await set({ q: 2, clock: 2, runoff: 25 }); await page.evaluate(() => { const g = MATCH._G; g.to[g.hid] = 1; g.to[g.aid] = 0; }); await rerender(); await click('.sheet .picks .pc');
  const h = await H.until(g => g.q === 3 && (g.stage === 'call' || g.stage === 'pre'), 20000, 150); const lg = await page.evaluate(() => MATCH._G.pbp.slice(-3));
  log('2nd half', { recvFirst: first, possAfterKick: h && h.poss, to: h && h.to, q: h && h.q, clock: h && h.clock, correct: h && h.poss !== first });
};
// ---- two-minute warning (WARN = 15 s at 60 s quarters)
S.warn = async () => {
  await toSheet('O'); await set({ q: 2, clock: 22, runoff: 10 }); await rerender();
  await pick('run'); const a = await H.G(); log('after runoff into the warning', { clock: a.clock, stage: a.stage, ban: a.ban, warned: await page.evaluate(() => MATCH._G.warned) });
  await H.until(g => g.stage === 'call' || g.stage === 'pre', 6000); const b = await H.G(); log('then', { clock: b.clock, stage: b.stage, ban: b.ban });
  if (b.stage === 'pre') { await page.keyboard.press('Space'); }
  await toSheet('any'); await set({ q: 4, clock: 18, runoff: 0 }); await rerender(); await click('.sheet .picks .pc'); if ((await H.G()).side === 'O') await page.keyboard.press('Space');
  const r = await H.until(g => g.stage === 'dead', 20000, 50); await H.wait(1700); const c = await H.G(); log('Q4 play across the warning', { clockAfter: c.clock, runoff: c.runoff, ban: c.ban, warned: await page.evaluate(() => MATCH._G.warned) });
};
// ---- sim drive / sim to end / quit
S.simdrive = async () => {
  await toSheet('O'); const g0 = await H.G(); await click('[data-act="simd"]'); await H.shot('simdrive');
  const g1 = await H.until(g => g.stage === 'call' && g.sheet, 60000, 200); log('sim drive', { before: { poss: g0.poss, yl: g0.yl, score: g0.score, q: g0.q, clock: g0.clock }, after: g1 && { poss: g1.poss, side: g1.sheetSide, score: g1.score, q: g1.q, clock: g1.clock, sim: g1.sim, ovl: g1.ovl } }, await pbpTail(4));
};
S.simend = async () => {
  await toSheet('any'); await page.keyboard.press('Escape'); await click('[data-m="simg"]');
  const t0 = Date.now(); const f = await H.until(g => g.stage === 'final', 180000, 300); log('sim to end', { secs: (Date.now() - t0) / 1000, final: f && f.score, q: f && f.q }); await H.shot('simend_final');
  await click('#mDone'); await H.wait(800);
  log('league', await page.evaluate(() => { const T = L.teams[L.user], g = L.sched[0].find(x => x.h === L.user || x.a === L.user); return { done: g.done, hs: g.hs, as: g.as, rec: `${T.w}-${T.l}-${T.tie || 0}`, week: L.week, modal: (document.querySelector('#modal') || {}).innerText.slice(0, 120) }; }));
};
S.quit = async () => {
  await toSheet('any'); await page.keyboard.press('Escape'); await click('[data-m="quit"]'); await H.wait(800);
  log('after quit', await page.evaluate(() => { const g = L.sched[0].find(x => x.h === L.user || x.a === L.user); return { gameOpen: !!MATCH._G, hidden: document.getElementById('game').hidden, done: g.done, week: L.week }; }));
};

S.half2 = async () => {
  await toSheet('any'); const first = await page.evaluate(() => MATCH._G.recvFirst);
  await set({ q: 2, clock: 2, runoff: 25 }); await rerender(); await click('.sheet .picks .pc');
  const h = await H.until(g => g.q === 3 && g.sheet, 30000, 150);
  log('2nd half', { recvFirst: first, possAtFirstSheet: h && h.poss, to: h && h.to, q: h && h.q, clock: h && h.clock, receiverIsOtherTeam: h && h.poss !== first }, await pbpTail(3));
};
S.xpdbl = async () => {
  for (let i = 0; i < 6; i++) { const g = await toSheet('O'); if (!g) break; await set({ yl: 99, down: 1, togo: 1 }); await rerender(); await pick('pass'); await page.keyboard.press('Space');
    await H.until(g => g.acts.includes('away'), 3000, 40); await H.wait(900); await page.keyboard.press('Digit1');
    const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100); if (!p) continue;
    const s0 = (await H.G()).score; const e = await page.$('[data-act="xp"]'); const b = await e.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.click(x, y); await H.wait(50); await page.mouse.click(x, y); await H.wait(1800); const s1 = (await H.G()).score; log("double-tap XP", s0, "->", s1, await pbpTail(3)); return; }
};
S.kneel = async () => {
  await toSheet('O'); await page.evaluate(() => { const g = MATCH._G; g.score[g.user] = 21; g.score[g.user === g.hid ? g.aid : g.hid] = 14; g.q = 4; g.clock = 40; g.runoff = 0; g.down = 1; g.togo = 10; g.yl = 50; }); await rerender();
  log('acts leading late', await acts());
  for (let k = 0; k < 5; k++) { const b = await H.G(); if (!(await acts()).some(a => a.startsWith('kneel'))) { log('no kneel button at', { down: b.down, clock: b.clock }); break; }
    await click('[data-act="kneel"]'); const a = await H.until(g => (g.stage === 'call' && g.sheet) || g.stage === 'final' || g.poss !== b.poss, 9000, 100); await H.wait(200); const c = await H.G();
    log(`kneel ${k + 1}`, { down: `${b.down}->${c.down}`, yl: `${b.yl}->${c.yl}`, clock: `${b.clock}->${c.clock}`, runoff: c.runoff, stage: c.stage, poss: c.poss }); if (c.stage === 'final' || c.poss !== b.poss) break; }
  log(await pbpTail(4));
};
S.safety = async () => {
  for (let i = 0; i < 5; i++) { const g = await toSheet('O'); if (!g) break; await set({ yl: 1, down: 1, togo: 10 }); await rerender(); await pick('pass'); await page.keyboard.press('Space');
    const r = await H.until(g => g.stage === 'dead', 20000, 50); const res = await page.evaluate(() => { const r = MATCH._G.play.result; return { type: r.type, safety: !!r.safety, spot: +(r.spotZ / 0.9144).toFixed(2) }; });
    await H.wait(2600); const a = await H.G(); log('own-1 pass, held the ball:', res, '->', { score: a.score, poss: a.poss, ban: a.ban, kickNext: a.kickNext, stage: a.stage }); if (res.safety) { const k = await H.until(g => g.stage === 'call' && g.sheet, 20000, 150); log('after free kick', k && { poss: k.poss, yl: k.yl, side: k.sheetSide }); return; } }
};
S.fps = async () => {
  await toSheet('O'); await pick('run');
  for (const rate of [1, 4, 8]) { await H.cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const fps = await H.fps(1500); const r = await page.evaluate(() => new Promise(res => { const g = MATCH._G, t0 = performance.now(), g0 = g.time; setTimeout(() => res({ real: (performance.now() - t0) / 1000, game: g.time - g0 }), 3000); }));
    log(`cpu x${rate}: fps ${fps.toFixed(0)}, game seconds per real second ${(r.game / r.real).toFixed(2)}`); }
  await H.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
};

S.two2 = async () => {
  for (let tries = 0; tries < 6; tries++) { const g = await toSheet('O'); if (!g || g.stage === 'final') break;
    await set({ yl: 99, down: 1, togo: 1 }); await rerender(); await pick('pass'); await page.keyboard.press('Space'); await H.until(g => g.acts.includes('away'), 3000, 40); await H.wait(900); await page.keyboard.press('Digit1');
    const p = await H.until(g => g.stage === 'call' && g.sheet && g.sheetSide === 'PAT', 15000, 100); if (!p) continue;
    await set({ clock: 40, q: 2 }); await click('[data-act="two"]'); await H.until(g => g.stage === 'call' && g.sheet, 4000); const before = await H.G();
    await pick('pass'); await page.keyboard.press('Space'); await H.until(g => g.acts.includes('away'), 3000, 50); await H.wait(1800); await page.keyboard.press('Digit2');
    await H.until(g => g.stage === 'dead', 20000, 50); const t = await page.evaluate(() => MATCH._G.play.result.t); await H.wait(300); const after = await H.G();
    log('two-point try (Q2, clock set to 40 at the PAT)', { playSeconds: +t.toFixed(2), clockBefore: before.clock, clockAfter: after.clock, ban: after.ban }); return; }
};
try { await S[name](); } catch (e) { log('SCRIPT ERROR', e.message.split('\n')[0]); await H.shot('script_error'); }
log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
log('anomalies', await page.evaluate(() => window.__mon ? window.__mon.anomalies.slice(0, 10) : []));
fs.writeFileSync(`C:/Users/dwint/football-game/qa/tester/out_scen_${name}_${which}.txt`, out.join('\n'));
await H.close();
