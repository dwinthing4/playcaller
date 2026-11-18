// Full user game on the phone, played like a person: real taps on the sheet/action buttons, CDP touch drags for the
// stick, every offense/defense mechanic in rotation, 4th downs, FG meter, punts, PAT/two, timeouts, kneel, spike.
// Receiver bubbles cannot be tapped (covered by .touch), so throws are sent as a pointerdown dispatched on the bubble.
// Records every play through monitor.js and validates down/distance/clock/score after each whistle.
import { launch } from './lib.mjs';
import fs from 'fs';
const which = process.argv[2] || 'phone', qlen = +(process.argv[3] || 60), seed = +(process.argv[4] || 11), team = +(process.argv[5] || 5);
const H = await launch(which, { tag: `fg_${which}_${seed}`, seed });
const { page } = H; const phone = H.phone;
await H.newLeague(qlen, team);
await H.startGame('play');
await page.evaluate(fs.readFileSync('C:/Users/dwint/football-game/qa/tester/monitor.js', 'utf8'));
await H.shot('intro'); await H.tapSel('#mKick');
const notes = []; const note = s => { notes.push(s); console.log('  >', s); };
let nO = 0, nD = 0, nPAT = 0, n4 = 0, did = { to: 0, kneel: 0, spike: 0, flip: 0, audO: 0, audD: 0, pauseSheet: 0, fgMeter: 0, punt: 0, go4: 0, two: 0, xp: 0, simDrive: 0 };
const tapCard = async sel => { const c = await page.$(sel); if (!c) return false; await c.scrollIntoViewIfNeeded().catch(() => { }); const r = await c.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
const tapAct = async a => tapCard(`.acts [data-a="${a}"]`);
const pickFrom = async (chip, pred) => { await tapCard(`[data-f="${chip}"]`); await H.wait(250); const id = await page.evaluate(src => { const f = new Function('p', 'return ' + src); const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); const pool = MATCH._G.sheet.pool.filter(p => ids.includes(p.id) && f(p)); return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : ids[0]; }, pred.toString().replace(/^p\s*=>\s*/, '')); return tapCard(`.sheet .plist [data-id="${id}"]`); };
const live = async () => { const g = await H.G(); return g && g.stage === 'live'; };
// stick drags (screen-space) via CDP touch; desktop uses keys
let stickOn = false; const W = phone ? 390 : 1280, Hh = phone ? 844 : 800, ox = W * 0.3, oy = Hh * 0.62;
async function stick(dx, dy) { if (!phone) { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await page.keyboard.up(k); if (dy < -0.3) await page.keyboard.down('KeyW'); if (dy > 0.3) await page.keyboard.down('KeyS'); if (dx < -0.3) await page.keyboard.down('KeyA'); if (dx > 0.3) await page.keyboard.down('KeyD'); return; }
  if (!stickOn) { await H.touchDown(ox, oy); stickOn = true; } await H.touchMove(ox + dx * 55, oy + dy * 55); }
async function stickRelease() { if (!phone) { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await page.keyboard.up(k); return; } if (stickOn) { await H.touchUp(); stickOn = false; } }
// screen direction from the controlled player to a target (carrier or ball landing)
const aim = () => page.evaluate(() => { const g = MATCH._G, pl = g.play; if (!pl) return null; const me = pl.controlled ? pl.controlled() : null; if (!me) return null; const tgt = pl.ball.state === 'air' && pl.ball.land ? pl.ball.land : pl.carrier ? pl.carrier.p : null; if (!tgt) return null;
  const a = R3D.project(me.p.x, 0, me.p.z), b = R3D.project(tgt.x, 0, tgt.z), dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1; return { dx: dx / m, dy: dy / m, dist: Math.hypot(me.p.x - tgt.x, me.p.z - tgt.z), air: pl.ball.state === 'air', carrierUnit: pl.carrier && pl.carrier.unit, me: me.slot, engaged: !!(me.bondBy || me.engaged) }; });
const throwTo = idx => page.evaluate(i => { const b = [...document.querySelectorAll('.bub .rb')]; const n = b[Math.min(i, b.length - 1)]; if (!n) return null; n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })); return n.textContent; }, idx);
const openest = () => page.evaluate(() => { const pl = MATCH._G.play; const rs = pl.receivers.slice().sort((a, b) => b.p.x - a.p.x); let bi = 0, bo = -1; rs.forEach((r, i) => { const o = pl.openness(pl.qb, r).open; if (o > bo) { bo = o; bi = i; } }); return { i: bi, open: +bo.toFixed(2), n: rs.length }; });
const results = [];
async function offenseLive(plan) {
  const t0 = Date.now(); let thrown = false, moved = false, juked = false;
  while (Date.now() - t0 < 30000) {
    const g = await H.G(); if (!g || g.stage !== 'live') break;
    const k = g.acts;
    if (k.includes('away')) { // QB with the ball
      const lt = await page.evaluate(() => MATCH._G.play.liveT);
      if (plan.kind === 'throw' && !thrown && lt > plan.at) { const o = await openest(); const idx = plan.idx === 'open' ? o.i : plan.idx % o.n; const s = await throwTo(idx); thrown = true; plan.thrownTo = s; plan.open = o; }
      if (plan.kind === 'away' && !thrown && lt > 1.2) { await tapAct('away'); thrown = true; plan.thrownTo = 'away'; }
      if (plan.kind === 'scramble' && lt > 0.9) { await stick(plan.dir || 0.6, -0.8); moved = true; }
      if (plan.kind === 'sack') { /* hold the ball */ }
    } else if (k.includes('juke')) { // ball carrier
      if (plan.kind === 'runStick' || plan.kind === 'scramble' || (plan.kind === 'throw' && plan.yacStick)) { await stick(Math.sin(Date.now() / 700) * 0.35, -1); moved = true; if (!juked && plan.move) { await H.wait(400); await tapAct(plan.move); juked = true; plan.moveTapped = true; } }
      if (plan.kind === 'runNoStick' && !juked) { await H.wait(300); await tapAct(plan.move || 'juke'); juked = true; plan.moveTapped = true; plan.moveFiredWithoutStick = await page.evaluate(() => { const c = MATCH._G.play.carrier; return !!(c && (c.jukeT > 0 || c.spinT > 0 || c.stiffT > 0 || c.truckT > 0)); }); await H.wait(60); plan.moveFiredLater = await page.evaluate(() => { const c = MATCH._G.play.carrier; return !!(c && (c.jukeT > 0 || c.spinT > 0 || c.stiffT > 0 || c.truckT > 0)); }); plan.inputFlagStuck = await page.evaluate(() => { const i = MATCH._G.play.input; return !!(i.juke || i.spin || i.stiff || i.truck); }); }
    }
    await H.wait(70);
  }
  await stickRelease();
}
async function defenseLive(plan) {
  const t0 = Date.now(); let switched = 0, tackles = 0, swats = 0;
  while (Date.now() - t0 < 30000) {
    const g = await H.G(); if (!g || g.stage !== 'live') break;
    if (plan.kind === 'ai') { await H.wait(150); continue; }
    const a = await aim(); if (!a) { await H.wait(80); continue; }
    if (a.carrierUnit === 'D') { await stickRelease(); await H.wait(100); continue; }
    if (plan.kind === 'chase' || plan.kind === 'swat') {
      if (!switched && (a.dist > 8 || a.engaged)) { await tapAct('switch'); switched++; await H.wait(80); continue; }
      await stick(a.dx, a.dy);
      if (plan.kind === 'swat' && a.air && !swats) { await tapAct('swat'); swats++; }
      if (!a.air && a.dist < 2.6 && tackles < 3) { await tapAct('tackle'); tackles++; await H.wait(200); }
    }
    if (plan.kind === 'switchOnly' && switched < 4) { await tapAct('switch'); switched++; }
    await H.wait(60);
  }
  await stickRelease(); plan.switched = switched; plan.tackles = tackles; plan.swats = swats;
}
// ---------------- main loop
let guard = 0, lastKey = '', same = 0, plan = null;
const t0 = Date.now();
while (guard++ < 5000 && Date.now() - t0 < 25 * 60 * 1000) {
  const g = await H.G(); if (!g) { note('MATCH._G gone'); break; }
  if (g.stage === 'final') break;
  const key = [g.stage, g.phase, g.q, g.clock, g.down, g.yl, g.sheet, g.kick, g.ban].join('|'); if (key === lastKey) same++; else { same = 0; lastKey = key; }
  if (same > 200) { note('STUCK? ' + JSON.stringify(g)); await H.shot('stuck'); break; }
  if (g.kick) { // FG kick meter
    await H.wait(200 + Math.random() * 900); await H.shot('kickmeter'); const ok = await tapCard('#mK'); did.fgMeter++; note(`FG meter tapped (${ok}) from yl ${g.yl}`); await H.wait(900); continue;
  }
  if (g.stage === 'call' && g.sheet) {
    await H.wait(350);
    if (g.sheetSide === 'PAT') { nPAT++; const two = nPAT % 2 === 0; await H.shot(two ? 'pat_two' : 'pat_xp'); await tapCard(two ? '[data-act="two"]' : '[data-act="xp"]'); did[two ? 'two' : 'xp']++; note(`PAT: ${two ? 'go for two' : 'kick'} score ${JSON.stringify(g.score)}`); await H.wait(600); continue; }
    const acts = await page.evaluate(() => [...document.querySelectorAll('.sheet [data-act]')].map(b => b.dataset.act));
    // one-off checks from the sheet
    if (!did.pauseSheet && g.sheetSide === 'O') { did.pauseSheet++; const ok = await tapCard('.mbtn.pause'); await H.wait(300); const pg = await H.G(); note(`pause from sheet tapped=${ok} paused=${pg.paused}`); await H.shot('pause_menu'); await tapCard('[data-m="resume"]'); await H.wait(300); note('resumed: ' + !(await H.G()).paused); continue; }
    if (acts.includes('to') && g.runoff > 0 && (g.q === 2 || g.q === 4) && did.to < 2) { did.to++; const before = g.to[g.user]; await tapCard('[data-act="to"]'); await H.wait(400); const a = await H.G(); note(`timeout: ${before}->${a.to[a.user]} runoff ${g.runoff}->${a.runoff}`); continue; }
    if (acts.includes('spike') && !did.spike && g.sheetSide === 'O') { did.spike++; const b = await H.G(); await tapCard('[data-act="spike"]'); await H.until(x => x.stage === 'call' && x.sheet, 6000); const a = await H.G(); note(`spike: down ${b.down}->${a.down} clock ${b.clock}-${b.runoff} -> ${a.clock}`); continue; }
    if (acts.includes('kneel') && !did.kneel && g.sheetSide === 'O') { did.kneel++; const b = await H.G(); await tapCard('[data-act="kneel"]'); await H.until(x => (x.stage === 'call' && x.sheet) || x.stage === 'final' || x.poss !== b.poss, 8000); const a = await H.G(); note(`kneel: down ${b.down}->${a.down} yl ${b.yl}->${a.yl} clock ${b.clock}->${a.clock} runoff ${a.runoff}`); continue; }
    if (g.sheetSide === 'O') {
      if (g.down === 4) { n4++; const canFg = acts.includes('fg'), canPunt = acts.includes('punt');
        const choice = canFg && g.yl >= 60 ? 'fg' : canPunt && g.yl < 55 && n4 % 3 !== 0 ? 'punt' : 'go';
        note(`4th & ${g.togo} at yl ${g.yl}: ${choice} (acts ${acts.join(',')})`);
        if (choice !== 'go') { did[choice === 'fg' ? 'fgMeter' : 'punt'] += 0; await tapCard(`[data-act="${choice}"]`); if (choice === 'punt') did.punt++; await H.wait(600); continue; } did.go4++; }
      nO++; const r = nO % 9;
      if (r === 6 && !did.flip) { did.flip++; await tapCard('[data-act="flip"]'); await H.wait(250); note('flip on: ' + (await page.evaluate(() => MATCH._G.flip))); }
      plan = r === 1 || r === 4 ? { kind: 'throw', idx: nO, at: 1.6 } : r === 2 ? { kind: 'runStick', move: ['juke', 'spin', 'stiff', 'truck'][nO % 4] } : r === 3 ? { kind: 'scramble', dir: nO % 2 ? 0.7 : -0.7 } : r === 5 ? { kind: 'runNoStick', move: 'juke' } : r === 7 ? { kind: 'away' } : r === 8 ? { kind: 'throw', idx: 'open', at: 2.0, yacStick: true, move: 'stiff' } : { kind: 'throw', idx: 'open', at: 1.9 };
      if (g.pat === 'two' || (g.pat && g.pat.two)) plan = { kind: 'throw', idx: 'open', at: 1.5 };
      const wantRun = plan.kind === 'runStick' || plan.kind === 'runNoStick';
      if (r === 0) { await tapCard('.picks .pc'); plan.fromCoach = true; }
      else await pickFrom(wantRun ? 'run' : 'pass', wantRun ? (p => p.type === 'run' && !p.qbRun) : (p => p.type === 'pass' && !/Screen/.test(p.name)));
      plan.side = 'O';
    } else {
      nD++; const r = nD % 4;
      plan = { side: 'D', kind: r === 0 ? 'chase' : r === 1 ? 'swat' : r === 2 ? 'ai' : 'switchOnly' };
      if (r === 2) await pickFrom('blitz', p => true); else await tapCard('.picks .pc');
    }
    await H.until(x => x.stage !== 'call', 4000, 80);
    continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre' && plan) {
    if (plan.side === 'O') {
      if (nO % 9 === 4 && !did.audO) { did.audO++; await tapAct('audible'); await H.until(x => x.stage === 'call' && x.sheet, 3000); note('offense audible -> sheet ' + (await H.G()).sheetSide); await tapCard('.picks .pc'); await H.until(x => x.stage === 'pre', 3000); }
      await H.wait(250); await tapAct('snap'); await H.until(x => x.stage !== 'pre', 3000, 50);
      if (await live()) await offenseLive(plan);
    } else {
      if (plan.kind === 'switchOnly') { const s0 = await page.evaluate(() => MATCH._G.play.userD && MATCH._G.play.userD.slot); await tapAct('switch'); await H.wait(150); const s1 = await page.evaluate(() => MATCH._G.play.userD && MATCH._G.play.userD.slot); plan.preSwitch = `${s0}->${s1}`; }
      if (nD % 7 === 3 && !did.audD) { did.audD++; const op0 = await page.evaluate(() => MATCH._G.play.op.name); await tapAct('audible'); await H.until(x => x.stage === 'call' && x.sheet, 3000); const op1 = await page.evaluate(() => MATCH._G.sheet.cpuO && MATCH._G.sheet.cpuO.name); note(`defense audible: offense play before ${op0}, sheet's offense now ${op1}`); await tapCard('.picks .pc'); }
      await H.until(x => x.stage !== 'pre', 6000, 50);
      if (await live()) await defenseLive(plan);
    }
    const res = await page.evaluate(() => { const M = window.__mon, c = M.plays[M.plays.length - 1]; return c && c.res; });
    results.push({ plan: { ...plan }, res }); plan = null;
    continue;
  }
  if (g.stage === 'live' && g.side) { if (g.side === 'O') await offenseLive(plan || { kind: 'none' }); else await defenseLive(plan || { kind: 'ai' }); continue; }
  await H.wait(150);
}
await H.shot('final');
const fin = await H.G(); note('final ' + JSON.stringify(fin));
const mon = await page.evaluate(() => ({ plays: window.__mon.plays, log: window.__mon.log, anomalies: window.__mon.anomalies, slow: window.__mon.slow, frames: window.__mon.frames, maxFrame: window.__mon.maxFrame }));
const finalTxt = await page.evaluate(() => (document.querySelector('#gui .ovl .card') || {}).innerText || '');
// apply to the league
const ok = await tapCard('#mDone'); await H.wait(800);
const lg = await page.evaluate(() => { const T = L.teams[L.user]; const g = L.sched.flat().find(x => (x.h === L.user || x.a === L.user) && x.done); return { week: L.week, done: !!g, hs: g && g.hs, as: g && g.as, rec: `${T.w}-${T.l}-${T.tie || 0}`, modal: !!document.querySelector('#modal .card, #modal .modal, #modal > *'), app: document.querySelector('#app') ? document.querySelector('#app').innerText.slice(0, 200) : '' }; });
note('after Continue: ' + JSON.stringify(lg));
await H.shot('home_after');
fs.writeFileSync(`C:/Users/dwint/football-game/qa/tester/out_fullgame_${which}_${seed}.json`, JSON.stringify({ notes, did, results, mon, final: fin, finalTxt, lg, errs: H.errs }, null, 1));
console.log('did', JSON.stringify(did)); console.log('plays', mon.plays.length, 'anomalies', mon.anomalies.length, 'slow frames', mon.slow, '/', mon.frames, 'max frame', mon.maxFrame.toFixed(3));
console.log(H.errs.length ? 'ERRORS\n' + H.errs.join('\n') : 'no errors');
await H.close();
