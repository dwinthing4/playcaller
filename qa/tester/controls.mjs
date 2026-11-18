// Phone controls: run moves with/without the stick, stale move flags, two-finger input, TACKLE range, Switch,
// early SWAT, rotate mid-play, and repeated quit/restart (leaks: rigs, heap, timers, fps).
import { launch } from './lib.mjs';
import fs from 'fs';
const H = await launch('phone', { tag: 'ctl', seed: 21 });
const { page } = H; const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); };
await H.newLeague(60, 5); await H.startGame('play'); await H.tapSel('#mKick');
const tapCard = async sel => { const c = await page.$(sel); if (!c) return false; await c.scrollIntoViewIfNeeded().catch(() => { }); const r = await c.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
const tapAct = a => tapCard(`.acts [data-a="${a}"]`);
const carrierMove = () => page.evaluate(() => { const c = MATCH._G.play && MATCH._G.play.carrier; return c ? { juke: +c.jukeT.toFixed(2), spin: +c.spinT.toFixed(2), stiff: +c.stiffT.toFixed(2), truck: +c.truckT.toFixed(2), touched: !!MATCH._G.play.userTouched, flags: ['juke', 'spin', 'stiff', 'truck'].filter(k => MATCH._G.play.input[k]).join(',') } : null; });
async function toSheet(side) { for (let i = 0; i < 600; i++) { const g = await H.G(); if (!g) return null; if (g.kick) { await tapCard('#mK'); await H.wait(600); continue; }
  if (g.stage === 'call' && g.sheet) { if (g.sheetSide === side) return g; if (g.sheetSide === 'PAT') { await tapCard('[data-act="xp"]'); await H.wait(400); continue; } await tapCard('.picks .pc'); await H.wait(400); continue; }
  if (g.stage === 'pre' && g.side === 'O') await tapAct('snap');
  if (g.stage === 'live' && g.acts.includes('away')) { const lt = await page.evaluate(() => MATCH._G.play.liveT); if (lt > 1.6) await page.evaluate(() => { const b = document.querySelector('.bub .rb'); b && b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }); }
  await H.wait(200); } }
const pickRun = async () => { await tapCard('[data-f="run"]'); await H.wait(250); const id = await page.evaluate(() => { const ids = [...document.querySelectorAll('.sheet .plist .pc')].map(b => b.dataset.id); const p = MATCH._G.sheet.pool.find(p => ids.includes(p.id) && p.type === 'run' && !p.qbRun && !/QB|Option|Read/.test(p.name)); return p ? p.id : ids[0]; }); await tapCard(`.sheet .plist [data-id="${id}"]`); await H.until(g => g.stage === 'pre', 4000, 60); };
const ox = 120, oy = 560;
// 1) moves with the stick held (one finger on the stick, a second finger taps the button)
await toSheet('O'); await pickRun(); await tapAct('snap'); await H.until(g => g.acts.includes('juke'), 6000, 30);
await H.touchDown(ox, oy, 1); await H.touchMove(ox, oy - 50, 1); await H.wait(250);
const jb = await (await page.$('.acts [data-a="juke"]')).boundingBox();
await H.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ox, y: oy - 50, id: 1 }, { x: jb.x + jb.width / 2, y: jb.y + jb.height / 2, id: 2 }] });
await H.wait(40); const m1 = await carrierMove();
await H.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: ox, y: oy - 50, id: 1 }] });
await H.wait(200); const stickStill = await page.evaluate(() => document.querySelector('.stick').classList.contains('show'));
log('1) two-finger juke while steering:', m1, 'stick still held after lifting the 2nd finger:', stickStill);
await H.touchUp(); await H.until(g => g.stage !== 'live', 20000, 100);
// 2) a move tapped with no stick, then the stick touched 1 s later: stale move fires late?
await toSheet('O'); await pickRun(); await tapAct('snap'); await H.until(g => g.acts.includes('juke'), 6000, 30); await H.wait(200);
await tapAct('spin'); await H.wait(60); const m2a = await carrierMove(); await H.wait(900); const m2b = await carrierMove();
await H.touchDown(ox, oy, 1); await H.touchMove(ox + 10, oy - 50, 1); await H.wait(50); const m2c = await carrierMove();
log('2) Spin with no stick: right after', m2a, '0.9 s later', m2b, 'then on first stick touch', m2c);
await H.touchUp(); await H.until(g => g.stage !== 'live', 20000, 100);
// 3) defense: switch at pre-snap cycles defenders, TACKLE out of range, steering + TACKLE in range
let g = await toSheet('D'); await tapCard('.picks .pc'); await H.until(g => g.stage === 'pre', 3000, 50);
const sw = []; for (let i = 0; i < 4; i++) { sw.push(await page.evaluate(() => MATCH._G.play.userD.slot)); await tapAct('switch'); await H.wait(120); }
log('3) pre-snap Switch order:', sw.join(' -> '));
await H.until(g => g.stage === 'live', 5000, 30); await H.wait(300);
const far = await page.evaluate(() => { const p = MATCH._G.play, me = p.userD, c = p.carrier; return c ? +Math.hypot(me.p.x - c.p.x, me.p.z - c.p.z).toFixed(1) : null; });
await tapAct('tackle'); await H.wait(50); const farL = await page.evaluate(() => MATCH._G.play.userD.lungeT);
log('   TACKLE at distance', far, 'm -> lunge', farL > 0);
// steer at the carrier with a real touch drag, tap TACKLE inside 2.6 m
let tk = [], held = false; const t0 = Date.now();
while (Date.now() - t0 < 15000) { const s = await page.evaluate(() => { const g = MATCH._G, p = g.play; if (!p || g.stage !== 'live') return null; const me = p.userD, c = p.carrier; if (!me || !c || c.unit !== 'O') return { none: true }; const a = R3D.project(me.p.x, 0, me.p.z), b = R3D.project(c.p.x + c.vel.x * 0.2, 0, c.p.z + c.vel.z * 0.2); const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1; return { dx: dx / m, dy: dy / m, d: Math.hypot(me.p.x - c.p.x, me.p.z - c.p.z), lunge: me.lungeT, wrapped: !!me.wrapped, engaged: !!me.bondBy, slot: me.slot }; });
  if (!s) break; if (s.none) { await H.wait(80); continue; }
  if (!held) { await H.touchDown(ox, oy, 1); held = true; } await H.touchMove(ox + s.dx * 55, oy + s.dy * 55, 1);
  if (s.engaged && tk.length === 0) { await tapAct('switch'); }
  if (s.d < 2.6 && !s.lunge && tk.length < 4) { await tapAct('tackle'); await H.wait(40); const r = await page.evaluate(() => ({ lunge: +MATCH._G.play.userD.lungeT.toFixed(2) })); tk.push({ d: +s.d.toFixed(2), ...r }); }
  if (s.wrapped) tk.push('WRAPPED'); await H.wait(60); }
if (held) await H.touchUp();
const res = await page.evaluate(() => { const r = MATCH._G.play.result; return r && { type: r.type, yards: +r.yards.toFixed(1), text: r.text }; });
log('   steer + TACKLE taps:', JSON.stringify(tk.slice(0, 8)), 'result', res);
await H.shot('def_after');
// 4) early SWAT: press SWAT right after the throw, far from the ball
for (let k = 0; k < 6; k++) { g = await toSheet('D'); if (!g) break; await tapCard('.picks .pc'); await H.until(g => g.stage === 'live', 6000, 30);
  const air = await H.until(g => g.acts.includes('swat') || g.stage !== 'live', 9000, 30); if (!air || !air.acts.includes('swat')) { await H.until(g => g.stage !== 'live', 20000, 100); continue; }
  await tapAct('swat'); const sw0 = await page.evaluate(() => { const p = MATCH._G.play; return { flag: p.input.swat, T: +(p.ball.T - p.ball.t).toFixed(2), dist: +Math.hypot(p.userD.p.x - p.ball.land.x, p.userD.p.z - p.ball.land.z).toFixed(1) }; });
  await H.until(g => g.stage !== 'live' || !g.acts.includes('swat'), 5000, 20); const sw1 = await page.evaluate(() => ({ swatT: MATCH._G.play.userD.swatT, flag: MATCH._G.play.input.swat }));
  log('4) SWAT pressed with', sw0.T, 's of flight left,', sw0.dist, 'm from the landing spot -> flag held:', sw0.flag, ' at the catch: swatT', sw1.swatT, 'flag', sw1.flag); break; }
await H.until(g => g.stage !== 'live', 20000, 100);
// 5) rotate to landscape mid-play and back
g = await toSheet('O'); await pickRun(); await tapAct('snap'); await H.until(g => g.stage === 'live', 4000, 30);
await page.setViewportSize({ width: 844, height: 390 }); await H.wait(500); await H.shot('landscape_live');
const cv = await page.evaluate(() => { const c = document.getElementById('gl'); return { cw: c.width, ch: c.height, css: [c.clientWidth, c.clientHeight] }; }); log('5) landscape canvas', cv, 'acts hit', await H.hitTest('.acts .a'));
await H.until(g => g.stage === 'call' && g.sheet, 20000, 100); await H.shot('landscape_sheet');
const shH = await page.evaluate(() => { const s = document.querySelector('.sheet').getBoundingClientRect(), a = document.querySelector('.sheet .sh-acts'); const ar = a && a.getBoundingClientRect(); return { sheetTop: s.top, sheetH: s.height, actsBottom: ar && ar.bottom, vh: innerHeight, picks: document.querySelectorAll('.sheet .picks .pc').length }; }); log('   landscape sheet', shH);
await page.setViewportSize({ width: 390, height: 844 }); await H.wait(500); await H.shot('portrait_back');
const shP = await page.evaluate(() => { const a = document.querySelector('.sheet .sh-acts'); const ar = a && a.getBoundingClientRect(); return { actsTop: ar && ar.top, actsBottom: ar && ar.bottom, vh: innerHeight, btns: [...document.querySelectorAll('.sheet .sh-acts [data-act]')].map(b => { const r = b.getBoundingClientRect(); return b.dataset.act + '@' + Math.round(r.top) + '-' + Math.round(r.bottom); }) }; }); log('   portrait sheet action row', shP);
// 6) quit + restart x4: leaks
for (let k = 0; k < 4; k++) {
  await H.until(g => g.stage === 'call' && g.sheet, 30000, 150); await tapCard('[data-act="menu"]'); await H.wait(250); await tapCard('[data-m="quit"]'); await H.wait(600);
  const st = await page.evaluate(() => ({ open: !!MATCH._G, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, rigs: R3D.stats ? R3D.stats().rigs : null, keyListeners: 0 }));
  await page.evaluate(() => startUserGame('play')); await H.until(g => g.ready, 60000, 300); await H.tapSel('#mKick');
  const g2 = await H.until(g => g.stage === 'call' && g.sheet, 30000, 150); const fps = await H.fps(1500); const st2 = await page.evaluate(() => ({ timers: MATCH._G.timers.length, rigs: R3D.stats().rigs, calls: R3D.stats().calls, heap: Math.round(performance.memory.usedJSHeapSize / 1e6) }));
  log(`6) restart ${k + 1}: after quit`, st, 'new game', st2, 'fps', fps.toFixed(0));
}
log(H.errs.length ? 'ERRORS ' + H.errs.slice(0, 5).join(' || ') + ` (${H.errs.length})` : 'no page errors');
fs.writeFileSync('C:/Users/dwint/football-game/qa/tester/out_controls.txt', out.join('\n'));
await H.close();
