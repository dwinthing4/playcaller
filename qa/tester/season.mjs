// Season flow on the phone: play -> sim to end -> Continue -> league updated (standings, player stats, week),
// watch mode (speed button, pause, take over), instant via the home screen, then every management view renders.
import { launch } from './lib.mjs';
import fs from 'fs';
const H = await launch('phone', { tag: 'season', seed: 5 });
const { page } = H; const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s); };
await H.newLeague(60, 5);
const tapCard = async sel => { const c = await page.$(sel); if (!c) return false; await c.scrollIntoViewIfNeeded().catch(() => { }); const r = await c.boundingBox(); if (!r) return false; await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); return true; };
const lg = () => page.evaluate(() => { const T = L.teams[L.user]; const qb = L.P[T.depth && T.depth.QB ? T.depth.QB[0] : T.roster[0]]; return { week: L.week, phase: L.phase, rec: `${T.w}-${T.l}-${T.tie || 0}`, pf: T.pf, pa: T.pa, doneUser: L.sched.flat().filter(g => (g.h === L.user || g.a === L.user) && g.done).length, doneAll: L.sched.flat().filter(g => g.done).length, qbSt: qb && qb.st ? { pa: qb.st.pa, py: qb.st.py, gp: qb.st.gp } : null }; });
log('start', await lg());
// 1) play: kick off, go to the first sheet, sim to the end from the sheet menu
await page.evaluate(() => startUserGame('play')); await H.until(g => g.ready, 60000, 300); await H.tapSel('#mKick');
await H.until(g => g.stage === 'call' && g.sheet, 30000, 150); await tapCard('[data-act="menu"]'); await H.wait(300); await H.shot('menu_from_sheet'); await tapCard('[data-m="simg"]');
const t0 = Date.now(); const f = await H.until(g => g.stage === 'final', 240000, 400); log('sim to end', (Date.now() - t0) / 1000, 's', f && f.score);
await H.shot('final_card');
const finalTxt = await page.evaluate(() => document.querySelector('#gui .ovl').innerText.replace(/\n+/g, ' | ').slice(0, 500)); log('final card', finalTxt);
log('Continue hit-test', await H.hitTest('#mDone'));
await tapCard('#mDone'); await H.wait(1200); await H.shot('after_continue');
log('after game 1', await lg(), 'modal:', await page.evaluate(() => (document.getElementById('modal').innerText || '').slice(0, 160).replace(/\n+/g, ' | ')));
// close press conference / modals by answering first option
for (let i = 0; i < 6; i++) { const has = await page.evaluate(() => !!document.querySelector('#modal button')); if (!has) break; await page.evaluate(() => { const b = document.querySelector('#modal button'); b && b.click(); }); await H.wait(400); }
await page.evaluate(() => closeModal && closeModal());
// standings sanity: total wins == total losses, games played == weeks done
log('standings', await page.evaluate(() => { let w = 0, l = 0, t = 0; for (const T of L.teams) { w += T.w; l += T.l; t += T.tie || 0; } return { w, l, t, teams: L.teams.length }; }));
// 2) watch mode next week: speed button cycles, pause reachable, take over
await page.evaluate(() => startUserGame('watch')); await H.until(g => g.ready && g.stage !== 'load', 60000, 300);
await H.wait(3000); const spd = []; for (let i = 0; i < 4; i++) { spd.push(await page.evaluate(() => document.querySelector('.mbtn.spd').textContent)); await tapCard('.mbtn.spd'); await H.wait(150); }
log('watch speed button cycle', spd.join(' -> '), 'speed hit', await H.hitTest('.mbtn.spd'), 'pause hit', await H.hitTest('.mbtn.pause'));
await page.evaluate(() => { MATCH._G.speed = 4; document.querySelector('.mbtn.spd').textContent = '4×'; });
const w0 = await H.G(); await H.wait(15000); const w1 = await H.G(); log('watch 4x for 15 s', { from: { q: w0.q, clock: w0.clock, stage: w0.stage }, to: { q: w1.q, clock: w1.clock, stage: w1.stage, score: w1.score } }); await H.shot('watch_4x');
await tapCard('.mbtn.pause'); await H.wait(300); const pz = await H.G(); log('watch pause', pz.paused); await H.shot('watch_pause'); await tapCard('[data-m="take"]'); await H.wait(300);
const tk = await H.until(g => (g.stage === 'call' && g.sheet) || g.kick, 60000, 200); log('take over -> first user decision', tk && { stage: tk.stage, side: tk.sheetSide, mode: tk.mode, spdHidden: await page.evaluate(() => document.querySelector('.mbtn.spd').hidden) });
await tapCard('[data-act="menu"]'); await H.wait(300); await tapCard('[data-m="quit"]'); await H.wait(800); log('after quit (watch game)', await lg());
// 3) instant from the home screen button
await page.evaluate(() => { TAB = 'home'; render(); }); await H.wait(400); await H.shot('home');
const ib = await page.$('button[onclick="startUserGame(\'instant\')"]'); log('instant button present', !!ib); if (ib) { await ib.scrollIntoViewIfNeeded(); const r = await ib.boundingBox(); await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); }
await H.wait(1500); log('after instant', await lg());
for (let i = 0; i < 6; i++) { const has = await page.evaluate(() => !!document.querySelector('#modal button')); if (!has) break; await page.evaluate(() => { const b = document.querySelector('#modal button'); b && b.click(); }); await H.wait(300); }
// 4) every management view renders without errors
const views = await page.evaluate(() => Object.keys(VIEWS)); const bad = [];
for (const v of views) { const e0 = H.errs.length; await page.evaluate(v => { closeModal(); go(v); }, v); await H.wait(250); const txt = await page.evaluate(() => document.getElementById('app').innerText); if (/Something went wrong/.test(txt) || H.errs.length > e0) bad.push(v + ': ' + (H.errs.slice(e0).join(' ') || txt.match(/Something went wrong[^\n]*/)[0])); }
log('views', views.length, views.join(','), 'broken:', bad.length ? bad : 'none');
for (const v of ['roster', 'depth', 'plays', 'plan']) if (views.includes(v)) { await page.evaluate(v => go(v), v); await H.wait(300); await H.shot('view_' + v); }
// 5) next game can still be played after all that
await page.evaluate(() => { closeModal(); startUserGame('play'); }); const r5 = await H.until(g => g.ready, 60000, 300); await H.tapSel('#mKick'); const s5 = await H.until(g => g.stage === 'call' && g.sheet, 30000, 200);
log('week', (await lg()).week + 1, 'game opens and reaches the call sheet:', !!s5);
log(H.errs.length ? 'ERRORS ' + H.errs.slice(0, 6).join(' || ') + ` (${H.errs.length})` : 'no page errors');
fs.writeFileSync('C:/Users/dwint/football-game/qa/tester/out_season.txt', out.join('\n'));
await H.close();
