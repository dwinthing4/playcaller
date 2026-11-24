// Controls + camera test with a real mouse: click the field to snap, drag back to aim and throw, drag forward to run,
// the pocket stick, the camera panel (views, height, zoom, wheel) and the defense view (no flip). Screenshots in qa/shots/controls.
// run: node tools/build.mjs && node qa/controls_test.mjs [desk|phone]
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const shots = path.join(root, 'qa', 'shots', 'controls'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const which = process.argv[2] || 'desk';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const [vw, vh] = which === 'phone' ? [390, 844] : [1280, 800];
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(120000); const errs = [], fails = [], ok = [];
const check = (c, what) => { (c ? ok : fails).push(what); console.log((c ? 'PASS ' : 'FAIL ') + what); };
page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(500);
await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 1; NG.qlen = 60; createLeague(); pickTeam(L.teams[5].id); });
const G = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { kbar: !!(g.kpow || g.kaim), stage: g.stage, ready: g.ready, side: g.userSide, sheet: g.sheet ? g.sheet.side : null, phase: pl && pl.phase, liveT: pl && pl.liveT, thrown: pl && pl.thrown, air: pl && pl.ball && pl.ball.state, scramble: pl && pl.scramble, pass: pl && pl.pass, qbz: pl && pl.qb ? pl.qb.p.z : null, qbx: pl && pl.qb ? pl.qb.p.x : null, los: pl && pl.losZ, aim: !!(pl && pl.aimAt), kick: !!g.kickCb, over: g.over, carrierQB: pl && pl.carrier === pl.qb }; });
let n = 0; const shot = async name => page.screenshot({ path: path.join(shots, `${which}_${String(n++).padStart(2, '0')}_${name}.png`) });
const wait = ms => page.waitForTimeout(ms);
await page.evaluate(() => startUserGame('play'));
for (let i = 0; i < 240; i++) { const g = await G(); if (g && g.ready) break; await wait(500); }
await page.evaluate(() => { MATCH._G.noFlags = true; });     // no penalty flags here: a false start would eat the snap this test is checking
await page.click('#mKick');
// pick a play of a given type from the call sheet
const callPlay = async type => page.evaluate(t => { const cards = [...document.querySelectorAll('.sheet .pc[data-id]')]; const pick = cards.find(c => { const p = L.plays.find(x => x.id === c.dataset.id); return p && (!t || p.type === t); }) || cards[0]; if (pick) pick.click(); return !!pick; }, type);
const camState = () => page.evaluate(() => { const b = R3D.basis(); return { fz: b.fz, fx: b.fx, cam: Object.assign({}, R3D.cam) }; });
let did = { def: false, pass1: false, run1: false, joy: false, panel: false }, guard = 0;
while (guard++ < 400 && !(did.pass1 && did.run1 && did.joy && did.def && did.panel)) {
  const g = await G(); if (!g || g.over) break;
  if (g.kick) { await page.click('#mK').catch(() => { }); await wait(700); continue; }
  if (g.kbar) { await page.keyboard.press('Space'); await wait(700); continue; }
  if (g.stage === 'call') {
    if (await page.$('[data-act="xp"]')) { await page.click('[data-act="xp"]'); await wait(300); continue; }
    if (g.sheet === 'O') { const four = await page.$('[data-act="punt"]'); if (four && (await G()).stage === 'call' && await page.evaluate(() => MATCH._G.down === 4)) { await page.click('[data-act="punt"]'); await wait(400); continue; } await callPlay('pass'); }
    else await callPlay(null);
    await wait(500); continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre') {
    if (g.side === 'D' && !did.def) {
      await wait(400); const c = await camState(); await shot('defense_presnap');
      check(c.fz > 0.3, `defense: camera stays behind the offense (looking downfield, fz=${c.fz.toFixed(2)})`); did.def = true;
    }
    if (g.side === 'O') {
      if (!did.panel) {     // camera panel: presets, sliders, wheel
        await shot('offense_presnap_default');
        await page.click('.mbtn.camb'); await wait(300); check(await page.isVisible('.campnl.show'), 'camera panel opens'); await shot('cam_panel');
        await page.click('[data-cv="side"]'); await wait(700); let c = await camState(); check(Math.abs(c.fx) > 0.8, `sideline view looks across the field (fx=${c.fx.toFixed(2)})`); await shot('cam_sideline');
        await page.click('[data-cv="sky"]'); await wait(700); await shot('cam_all22');
        const z0 = (await camState()).cam.zoom; await page.$eval('[data-cs="zoom"]', e => { e.value = 90; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(600); c = await camState(); check(Math.abs(c.cam.zoom - 0.9) < 0.01, `zoom slider sets zoom (${z0} -> ${c.cam.zoom})`); await shot('cam_zoom_in');
        await page.$eval('[data-cs="height"]', e => { e.value = 10; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(600); await shot('cam_low_height');
        await page.click('[data-cv="behind"]'); await wait(300); await page.click('.campnl [data-cx]'); await wait(300); check(!(await page.isVisible('.campnl.show')), 'camera panel closes');
        await page.mouse.move(vw / 2, vh / 2); await page.mouse.wheel(0, 400); await wait(300); c = await camState(); check(c.cam.zoom < 0.6, `mouse wheel zooms out (${c.cam.zoom.toFixed(2)})`); await page.mouse.wheel(0, -400); await wait(300);
        const saved = await page.evaluate(() => localStorage.getItem('pc_cam_v1')); check(!!saved, 'camera settings saved');
        did.panel = true;
      }
      // click the field to snap
      await wait(450); await page.mouse.click(vw * 0.45, vh * 0.45); await wait(250);
      const g2 = await G(); check(g2.phase === 'live' || g2.stage === 'live', 'click on the field snaps the ball');
      if (!g2.pass) { await wait(3000); continue; }
      await wait(850);
      if (!did.pass1) {
        // drag back to aim, release to throw
        const sx = vw * 0.55, sy = vh * 0.45; await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx - 20, sy + 150, { steps: 8 }); await wait(160);
        const ga = await G(); check(ga.aim, 'dragging back shows the aim'); await shot('aim_arc');
        const could = await page.evaluate(() => MATCH._G.play.canThrow());
        await page.mouse.up(); await wait(450); const gt = await G();
        if (could) check(gt.thrown, `releasing throws the ball (state ${gt.air})`); else console.log('(QB was wrapped at the release; throw check skipped)');
        await wait(200); await shot('ball_in_air');
        did.pass1 = could; await wait(2500); continue;
      }
      if (!did.run1) {
        // drag toward the defense: the QB tucks it and runs where you drag
        const sx = vw * 0.5, sy = vh * 0.6; await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 10, sy - 90, { steps: 8 });
        const gr = await G(), z0 = gr.qbz; check(!gr.aim, 'dragging forward does not aim a throw');
        let best = -9, g3 = gr; for (let k = 0; k < 10; k++) { await wait(220); g3 = await G(); if (g3.qbz != null) best = Math.max(best, g3.qbz - z0); if (g3.scramble) break; }
        await shot('qb_run'); await page.mouse.up();
        check(!g3.thrown && (best > 2 || g3.scramble), `dragging forward makes the QB run (moved ${best.toFixed(1)} m upfield, scramble=${g3.scramble})`);
        did.run1 = true; await wait(2500); continue;
      }
      if (!did.joy) {
        // pocket stick: hold left on the joystick
        const jb = await page.$('.joy.show'); if (jb) { const r = await jb.boundingBox(); const x0 = (await G()).qbx; await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(r.x + r.width / 2 - 40, r.y + r.height / 2, { steps: 4 }); await wait(350); const x1 = (await G()).qbx; await page.mouse.up(); check(Math.abs(x1 - x0) > 0.4, `pocket stick moves the QB (dx=${(x1 - x0).toFixed(2)} m)`); } else check(false, 'pocket stick visible');
        did.joy = true; await wait(2500); continue;
      }
    }
    await wait(300); continue;
  }
  await wait(300);
}
console.log(JSON.stringify(did));
await browser.close();
console.log(`${ok.length} passed, ${fails.length} failed`);
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
