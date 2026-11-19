// 2D art close-up sheets: a big portrait grid, small portraits at list sizes, staff portraits, all team logos (made-up + real cities) and stadium art.
// run: node tools/build.mjs && node qa/art_grid.mjs <tag>   (screenshots in qa/shots/art/<tag>/)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/'), tag = process.argv[2] || 'now';
const out = path.join(root, 'qa', 'shots', 'art', tag); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(900);
const sheet = async (name, fn, arg) => { const h = await page.evaluate(fn, arg); await page.setViewportSize({ width: 1600, height: Math.min(6000, Math.max(400, h)) }); await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, name + '.png') }); };
const setup = real => page.evaluate(real => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 6; NG.real = real; createLeague(); pickTeam(L.teams[7].id);
  document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#20242c;color:#ddd;font:14px sans-serif'; }, real);
await setup(false);
// 1. big portraits: 40 players across positions, 192 canvas shown at 192
await sheet('portraits_big', () => { const ps = Object.values(L.P).filter(p => p.tid != null); const pick = []; const want = ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'];
  for (let i = 0; pick.length < 40; i++) { const pos = want[i % want.length], c = ps.filter(p => p.pos === pos && !pick.includes(p)); if (c.length) pick.push(c[(i * 7) % c.length]); }
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;grid-template-columns:repeat(8,192px);gap:6px;padding:8px'; document.body.appendChild(wrap);
  let t0 = performance.now(); for (const p of pick) { const cv = document.createElement('canvas'); cv.width = cv.height = 192; wrap.appendChild(cv); const x = cv.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); drawBust(x, p, L.teams[p.tid]); }
  const ms = (performance.now() - t0) / pick.length; const d = document.createElement('div'); d.textContent = 'avg drawBust (192 canvas): ' + ms.toFixed(2) + ' ms'; document.body.appendChild(d); window.__ms = ms; return document.body.scrollHeight + 10; });
console.log('portrait ms', await page.evaluate(() => window.__ms));
// 2. small portraits at list sizes (96 canvas at 26/36/48/64 css) + a full roster at 48, timed
await sheet('portraits_small', () => { document.body.innerHTML = ''; const T = L.teams[7], ps = T.roster.map(id => L.P[id]);
  for (const sz of [26, 36, 48, 64]) { const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:6px'; document.body.appendChild(row);
    for (const p of ps.slice(0, sz < 40 ? 40 : 24)) { const cv = document.createElement('canvas'); cv.width = cv.height = 96; cv.style.cssText = `width:${sz}px;height:${sz}px;border-radius:6px`; row.appendChild(cv); const x = cv.getContext('2d'); drawBust(x, p, T); } }
  const t0 = performance.now(); for (let k = 0; k < 3; k++) for (const p of ps) { const cv = document.createElement('canvas'); cv.width = cv.height = 96; drawBust(cv.getContext('2d'), p, T); } window.__ms2 = (performance.now() - t0) / (3 * ps.length);
  return document.body.scrollHeight + 10; });
console.log('small portrait ms', await page.evaluate(() => window.__ms2));
// 3. staff: coaches / coordinators / GM / owner / scouts (suit portraits), big and small
await sheet('staff', () => { document.body.innerHTML = ''; const looks = []; for (const t of L.teams.slice(0, 12)) { if (t.oc) looks.push([t.oc.lk, t]); if (t.dc) looks.push([t.dc.lk, t]); } (L.scouts || []).forEach(s => looks.push([s.lk, L.teams[L.user]]));
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;grid-template-columns:repeat(8,192px);gap:6px;padding:8px'; document.body.appendChild(wrap);
  for (const [lk, T] of looks.slice(0, 24)) { const cv = document.createElement('canvas'); cv.width = cv.height = 192; wrap.appendChild(cv); const x = cv.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); drawBust(x, { coach: true, lk }, T); }
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;padding:8px'; document.body.appendChild(row);
  for (const [lk, T] of looks.slice(0, 24)) { const cv = document.createElement('canvas'); cv.width = cv.height = 96; cv.style.cssText = 'width:44px;height:44px;border-radius:8px'; row.appendChild(cv); drawBust(cv.getContext('2d'), { coach: true, lk }, T); }
  return document.body.scrollHeight + 10; });
// 4. logos: every team big (on dark and light), plus small sizes
const logos = () => { document.body.innerHTML = ''; const t0 = performance.now();
  for (const bg of ['#1a1e26', '#e8e6e0']) { const wrap = document.createElement('div'); wrap.style.cssText = `display:grid;grid-template-columns:repeat(8,190px);gap:6px;padding:8px;background:${bg}`; document.body.appendChild(wrap);
    for (const t of L.teams) { const c = document.createElement('div'); c.style.cssText = 'text-align:center;color:' + (bg === '#e8e6e0' ? '#333' : '#bbb'); const cv = document.createElement('canvas'); cv.width = cv.height = 176; c.appendChild(cv); const lab = document.createElement('div'); lab.textContent = t.city + ' ' + (t.name !== t.city ? t.name : '') + ' ' + JSON.stringify(ensureLogo(t)).slice(0, 60); lab.style.fontSize = '10px'; c.appendChild(lab); wrap.appendChild(c); drawLogo(cv.getContext('2d'), t, 176); }
    if (bg !== '#e8e6e0') { const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:' + bg; document.body.appendChild(row);
      for (const sz of [22, 32, 48]) for (const t of L.teams) { const cv = document.createElement('canvas'); cv.width = cv.height = Math.max(64, sz * 2); cv.style.cssText = `width:${sz}px;height:${sz}px`; row.appendChild(cv); drawLogo(cv.getContext('2d'), t, cv.width); } } }
  window.__lms = (performance.now() - t0); return document.body.scrollHeight + 10; };
await sheet('logos', logos);
console.log('logo sheet ms', await page.evaluate(() => window.__lms));
// 5. stadium art at hero sizes with a few team colours
await sheet('stadium', () => { document.body.innerHTML = ''; const sets = [{ c1: '#1f6b35', c2: '#f2c230', floor: 0.75, seed: 11 }, { c1: L.teams[3].c1, c2: L.teams[3].c2, left: L.teams[3].c1, right: L.teams[9].c1, seed: 5 }, { c1: L.teams[12].c1, c2: L.teams[12].c2, seed: 23 }, { c1: L.teams[20].c1, c2: L.teams[20].c2, left: L.teams[20].c1, right: L.teams[2].c1, seed: 41 }];
  const t0 = performance.now(); for (const o of sets) { const cv = document.createElement('canvas'); cv.width = 1560; cv.height = 520; cv.style.cssText = 'display:block;margin:8px;width:1560px;height:520px'; document.body.appendChild(cv); drawStadium(cv, o); }
  window.__sms = (performance.now() - t0) / sets.length; const cv = document.createElement('canvas'); cv.width = 780; cv.height = 1100; cv.style.cssText = 'margin:8px;width:390px;height:550px'; document.body.appendChild(cv); drawStadium(cv, { c1: '#6a1d2b', c2: '#e0b040', seed: 3 });
  return document.body.scrollHeight + 10; });
console.log('stadium ms', await page.evaluate(() => window.__sms));
// 6. real-cities league logos
await setup(true); await sheet('logos_real', logos);
// 7. the real screens that carry portraits: the player card and the staff page, desk and phone
for (const [vw, vh, nm] of [[1280, 800, 'desk'], [390, 844, 'phone']]) {
  await page.setViewportSize({ width: vw, height: vh }); await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(700);
  await page.evaluate(() => { NG.slot = 6; NG.real = false; createLeague(); pickTeam(L.teams[7].id); }); await page.waitForTimeout(400);
  await page.evaluate(() => { const T = L.teams[L.user], p = T.roster.map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr)[0]; showPlayer(p.id); }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, 'ui_player_card_' + nm + '.png') });
  await page.evaluate(() => { closeModal(); go('staff'); scrollTo(0, 0); }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'ui_staff_' + nm + '.png') });
}
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out); await browser.close();
