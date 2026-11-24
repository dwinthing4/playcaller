// Map screen capture: the League, Scouting and Pipelines layers at phone and desktop size in each UI style, plus a tap on a
// team, a college and an event, and the hub matchup card with the travel line.
// run: node tools/build.mjs && node qa/map_cap.mjs [styles=broadcast,night] [real]   screenshots: qa/shots/map/
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/');
const styles = (process.argv[2] || 'broadcast,night').split(','), real = process.argv[3] === 'real';
const out = path.join(root, 'qa', 'shots', 'map'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
for (const [vw, vh, tag] of [[390, 844, 'phone'], [1280, 800, 'desk']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: tag === 'phone' ? 2 : 1, hasTouch: tag === 'phone' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(400);
  await page.evaluate(real => { NG.slot = 3; if (typeof NG.real !== 'undefined' || real) NG.real = real; createLeague(); pickTeam(L.teams[real ? 31 : 5].id); startUserGame('instant'); startUserGame('instant'); closeModal(); }, real);
  for (const st of styles) {
    await page.evaluate(s => { setUiStyle(s); }, st);
    const shot = async name => { await page.waitForTimeout(150); const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov > 2) problems.push(`${tag} ${st} ${name}: horizontal overflow ${ov}px`); await page.screenshot({ path: path.join(out, `${tag}_${st}_${name}.png`), fullPage: name !== 'hub' }); };
    await page.evaluate(() => { go('home'); }); await shot('hub');
    await page.evaluate(() => { SUB.map = null; go('map'); }); await shot('league');
    await page.evaluate(() => { const t = L.teams.find(x => x.id !== L.user && geoTeam(x).alt > 3000) || L.teams[(L.user + 7) % 32]; mapSel('t:' + t.id); }); await shot('league_team');
    await page.evaluate(() => { mapZoomBy(0.45); }); await shot('league_zoom');
    await page.evaluate(() => { mapZoomReset(); mapSet('layer', 'scout'); }); await shot('scout');
    await page.evaluate(() => { const S = scoutTrips(); const e = S.ev.find(x => scoutEvOpen(x)); if (e) { scoutSend(e.id, L.scouts[0].id); mapSel('e:' + e.id); } }); await shot('scout_event');
    await page.evaluate(() => { const p = L.P[L.draft[0]]; mapSel('c:' + geoCollege(p.col).name); }); await shot('scout_college');
    await page.evaluate(() => { mapSet('layer', 'pipe'); }); await shot('pipe');
    await page.evaluate(() => { mapSet('pipe', 'rcol'); }); await shot('pipe_col');
  }
  // tap test: a real pointer tap on a team marker selects it
  await page.evaluate(() => { setUiStyle('broadcast'); SUB.map = null; go('map'); });
  const box = await page.evaluate(() => { const g = document.querySelector('#usmap .mk[data-k^="t:"]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, k: g.dataset.k }; });
  if (tag === 'phone') await page.touchscreen.tap(box.x, box.y); else await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(200); const sel = await page.evaluate(() => SUB.map && SUB.map.sel);
  if (sel !== box.k) problems.push(`${tag}: tapping a team marker did not select it (${sel} vs ${box.k})`);
  // drag pans
  const vb0 = await page.evaluate(() => SUB.map.vb.slice()); await page.evaluate(() => mapZoomBy(0.5));
  const r = await page.evaluate(() => { const b = document.getElementById('usmap').getBoundingClientRect(); return { x: b.left + b.width * 0.3, y: b.top + b.height * 0.5 }; });
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.move(r.x + 80, r.y + 10, { steps: 6 }); await page.mouse.up();
  const vb1 = await page.evaluate(() => SUB.map.vb.slice()); if (Math.abs(vb1[0] - vb0[0]) < 5) problems.push(`${tag}: drag did not pan (${vb0} -> ${vb1})`);
  if (errs.length) problems.push(...errs.map(e => tag + ' ' + e));
  await ctx.close();
}
await browser.close();
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'map capture ok', out);
