// The field, in the real game: hard count (a lineman jumps, you see him go, the flag card says what he did), a false start
// (the lineman flinches up out of his stance), press coverage at the line (hand fight, nobody falls), and control after a
// turnover (your pass is picked: you take over a chaser; on defense your man picks it off and you run with him).
// run: node tools/build.mjs && node qa/field_look.mjs [desk|phone]     screenshots in qa/shots/field_look
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const which = process.argv[2] || 'desk', shots = path.join(root, 'qa', 'shots', 'field_look'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 });
const page = await ctx.newPage(); const errs = [], fails = [], ok = [];
const check = (c, what) => { (c ? ok : fails).push(what); console.log((c ? 'PASS ' : 'FAIL ') + what); };
page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
let n = 0; const shot = async name => page.screenshot({ path: path.join(shots, `${which}_${String(n++).padStart(2, '0')}_${name}.png`) }).catch(e => console.log('(shot failed: ' + e.message.split('\n')[0] + ')'));
const wait = ms => page.waitForTimeout(ms);
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(500);
await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 2; NG.qlen = 300; createLeague(); pickTeam(L.teams[9].id); });
await page.evaluate(() => startUserGame('play'));
for (let i = 0; i < 240; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await wait(500); }
await page.evaluate(() => { const G = MATCH._G; G.noFlags = 'live'; });     // only the flags this test makes
await page.click('#mKick').catch(() => { });
const G = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { kbar: !!(g.kpow || g.kaim), kick: !!g.kickCb, stage: g.stage, side: g.userSide, sheet: g.sheet ? g.sheet.side : null, phase: pl && pl.phase, ret: !!(pl && pl.ret), thrown: pl && pl.thrown, air: pl && pl.ball && pl.ball.state, over: g.over, ctx: MATCH._.ctl ? MATCH._.ctl().ctx : null }; });
const callPlay = async type => page.evaluate(t => { const cards = [...document.querySelectorAll('.sheet .pc[data-id]')]; const pick = cards.find(c => { const p = L.plays.find(x => x.id === c.dataset.id); return p && (!t || p.type === t) && !/Screen|Max/.test(p.name); }) || cards[0]; if (pick) pick.click(); return !!pick; }, type);
// the CPU defense calls press man for the press look
const pressOn = on => page.evaluate(on => { if (!window.__cpu0) window.__cpu0 = LG.cpuCall; LG.cpuCall = on ? (tid, side, ctx) => { if (side === 'D') { const p = L.plays.find(x => x.side === 'D' && x.cov === 'c1' && /Press/.test(x.name)) || L.plays.find(x => x.side === 'D' && x.cov === 'c1'); if (p) return p.id; } return window.__cpu0(tid, side, ctx); } : window.__cpu0; }, on);
// the pick itself, as the engine's catch point does it (the defender nearest the catch point takes the ball)
const forcePick = notMe => page.evaluate(notMe => { const pl = MATCH._G.play, B = pl.ball; if (B.state !== 'air' || !B.land) return null; const d = pl.D.filter(x => x.upright() && (!notMe || x !== pl.userD)).sort((a, b) => Math.hypot(a.p.x - B.land.x, a.p.z - B.land.z) - Math.hypot(b.p.x - B.land.x, b.p.z - B.land.z))[0];
  pl.air = false; pl.carrier = d; d.role = 'carrier'; pl.ball = { state: 'held', p: { x: d.p.x, y: 1.2, z: d.p.z }, v: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } }; pl.turnover = 'int'; pl.catchT = pl.t; pl.catchZ = d.p.z; pl.contactZ = null;
  for (const o of pl.O) o.bond = null; for (const x of pl.D) { x.bondBy = null; x.wrapped = false; x.engaged = false; } pl.turnoverCtl(d); return d.label; }, notMe);
const refTxt = () => page.evaluate(() => { const r = document.querySelector('.refc'); return r ? r.textContent : ''; });
const sk = !!process.env.ONLY_PICK, did = { hard: sk, fs: sk, press: sk, pick: false, dpick: false };     // ONLY_PICK=1: just the turnover checks
await pressOn(false);
let guard = 0;
while (guard++ < 500 && !(did.hard && did.fs && did.press && did.pick && did.dpick)) {
  const g = await G(); if (!g || g.over) break;
  if (g.kick) { await page.click('#mK').catch(() => { }); await wait(600); continue; }
  if (g.kbar) { await page.keyboard.press('Space'); await wait(600); continue; }
  if (g.stage === 'flag') { await page.keyboard.press('Space'); await wait(400); continue; }
  if (g.stage === 'call') {
    if (await page.$('[data-act="xp"]')) { await page.click('[data-act="xp"]'); await wait(300); continue; }
    if (g.sheet === 'O') { if (await page.evaluate(() => MATCH._G.down === 4) && await page.$('[data-act="punt"]')) { await page.click('[data-act="punt"]'); await wait(400); continue; }
      await pressOn(did.hard && did.fs && !did.press); await callPlay('pass'); }
    else await callPlay(null);
    await wait(450); continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre' && !g.ret && g.side === 'O') {
    await wait(500);
    if (!did.hard) {      // hard count: force a jump, watch him go
      await shot('presnap_hardcount_button'); check(!!(await page.$('.acts [data-a="hard"]')), 'Hard count button in the pre-snap bar');
      await page.evaluate(() => { const R0 = MATCH._.RULES; window.__hc0 = R0.hardCount; R0.hardCount = () => 'ENC'; });
      await page.click('.acts [data-a="hard"]'); await wait(330); await shot('hardcount_jump_1'); await wait(160); await shot('hardcount_jump_2');
      const jumped = await page.evaluate(() => { const pl = MATCH._G.play; const d = pl.D.find(p => p.preJump && p.preJump.kind === 'ENC'); return d ? { z: d.p.z - pl.losZ, kind: d.preJump.kind } : null; });
      check(!!jumped && jumped.z < 0.5, `hard count: a defensive lineman jumps into the neutral zone (${jumped ? jumped.z.toFixed(2) + ' m from the ball' : 'nobody'})`);
      await wait(700); await shot('hardcount_flag'); const t = await refTxt(); check(/neutral zone/i.test(t), `flag card says what he did: "${t}"`);
      const f = await page.evaluate(() => { const g = MATCH._G; return g.pbp.slice(-3).join(' | '); }); check(/Encroachment/.test(f), 'encroachment in the play-by-play');
      await page.evaluate(() => { MATCH._.RULES.hardCount = window.__hc0; });
      did.hard = true; await wait(2500); continue;
    }
    if (!did.fs) {        // false start: the lineman flinches up out of his stance
      await page.evaluate(() => { const g = MATCH._G, pl = g.play, ol = pl.O.find(p => p.slot === 'LG') || pl.O.find(p => p.ol); g.pre = { code: 'FS', by: g.poss, pid: ol.pid, pre: true, dead: true }; window.__fsId = ol.id; });
      await page.keyboard.press('Space'); await wait(260); await shot('falsestart_flinch');
      const mv = await page.evaluate(() => { const pl = MATCH._G.play, p = pl.players.find(q => q.id === window.__fsId); return { stance: p.stance, z: p.p.z - pl.losZ, phase: pl.phase }; });
      check(!mv.stance && mv.phase === 'pre', `false start: the lineman comes up out of his stance before any snap (phase ${mv.phase})`);
      await wait(700); const t = await refTxt(); await shot('falsestart_card'); check(/moved before the snap/.test(t), `false start card: "${t}"`);
      did.fs = true; await wait(2500); continue;
    }
    if (!did.press) {     // press man: a close look at the line
      const pair = await page.evaluate(() => { const pl = MATCH._G.play, r = pl.receivers.find(x => x.pressBy); if (!r) return null; const R3 = R3D; R3.camOverride = { pos: [r.p.x + (r.p.x > 0 ? 5 : -5), 2.2, pl.losZ - 2.5], look: [r.p.x, 1.0, pl.losZ + 1.5], fov: 36 }; window.__pr = r.id; return r.label; });
      if (!pair) { await page.keyboard.press('Space'); await wait(4000); continue; }
      await page.keyboard.press('Space');
      for (let k = 0; k < 6; k++) { await wait(140); await shot('press_' + k); }
      const st = await page.evaluate(() => { const pl = MATCH._G.play, r = pl.players.find(q => q.id === window.__pr), d = r && r.pressBy; if (!d) return { res: null }; return { res: r.hf ? r.hf.res : null, move: r.hf ? r.hf.move : null, rUp: r.upright(), dUp: d.upright(), dz: (r.p.z - pl.losZ) / 0.9144 }; });
      check(!!st.res, `press: ${pair} and his corner hand-fight at the line (${st.res}, ${st.move})`); check(st.rUp && st.dUp, 'press: nobody falls');
      await page.evaluate(() => { R3D.camOverride = null; });
      did.press = true; await pressOn(false); await wait(3500); continue;
    }
    if (!did.pick) {      // throw it, force the pick, and take over a chaser
      await page.keyboard.press('Space');
      let air = false; for (let k = 0; k < 40 && !air; k++) { await wait(120); air = await page.evaluate(() => { const pl = MATCH._G.play; if (pl.ball.state === 'held' && pl.carrier === pl.qb && pl.liveT > 1.2 && pl.canThrow()) { const r = pl.receivers.filter(x => x.upright()).sort((a, b) => b.p.z - a.p.z)[0]; if (r) pl.throwTo(r); } return pl.ball.state === 'air'; }); }
      if (!air) { await wait(3000); continue; }
      await forcePick(false);
      const s = await page.evaluate(() => { const pl = MATCH._G.play, u = pl.controlled(); return { int: pl.turnover === 'int', live: pl.phase === 'live', ctx: MATCH._.ctl().ctx, u: u ? u.unit + ' ' + u.posName : null }; });
      if (!s.int || !s.live) { console.log('(no pick this time: ' + JSON.stringify(s) + ')'); await wait(3000); continue; }
      check(s.u && s.u.startsWith('O'), `picked off: you take over a teammate (${s.u})`); check(s.ctx === 'd', `defense controls after the pick (${s.ctx})`); await shot('pick_takeover');
      // run at the returner with the keys (the camera sits behind your offense: the returner comes back toward the bottom of the screen)
      const z0 = await page.evaluate(() => MATCH._G.play.controlled().p.z); await page.keyboard.down('KeyS'); await wait(700); await shot('pick_chase'); await page.keyboard.up('KeyS');
      const z1 = await page.evaluate(() => { const pl = MATCH._G.play, u = pl.controlled(); return u ? u.p.z : null; });
      check(z1 != null && z1 < z0 - 1.5, `your man runs where you steer him (${z0.toFixed(1)} -> ${z1 == null ? '-' : z1.toFixed(1)})`);
      await page.keyboard.press('KeyE'); const sw = await page.evaluate(() => { const u = MATCH._G.play.controlled(); return u ? u.unit : null; }); check(sw === 'O', 'switch picks another chaser');
      did.pick = true; await wait(4000); continue;
    }
  }
  if (g.stage === 'pre' && g.phase === 'pre' && !g.ret && g.side === 'D' && !did.dpick && did.pick) {     // your defense picks it off: you run with the interceptor
    await page.evaluate(() => { MATCH._G.play.snap(); });
    let air = false; for (let k = 0; k < 60 && !air; k++) { await wait(100); air = await page.evaluate(() => { const pl = MATCH._G.play; return pl.ball.state === 'air' && !pl.ball.away && !!pl.ball.target; }); if (await page.evaluate(() => MATCH._G.play.phase !== 'live')) break; }
    if (!air) { await wait(2500); continue; }
    const info = await forcePick(true);
    const s = await page.evaluate(() => { const pl = MATCH._G.play; return { int: pl.turnover === 'int', live: pl.phase === 'live', me: pl.userD && pl.userD.id, by: pl.carrier && pl.carrier.id, ctx: MATCH._.ctl().ctx }; });
    if (!s.int || !s.live) { await wait(2500); continue; }
    check(s.me === s.by, `your defense picks it off (${info}): you are running with the interceptor`); check(s.ctx === 'run', `ball-carrier controls after your pick (${s.ctx})`); await shot('dpick_run');
    did.dpick = true; await wait(3000); continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre' && g.side === 'D') { await page.evaluate(() => { const pl = MATCH._G.play; if (pl && pl.phase === 'pre') pl.snap(); }); }
  await wait(300);
}
console.log(JSON.stringify(did));
await browser.close();
console.log(`${ok.length} passed, ${fails.length} failed`);
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
