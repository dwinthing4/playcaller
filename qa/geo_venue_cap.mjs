// City venues in the 3D game: a fixed dome, a snowy late-season game in a cold open-air city, a retractable roof open on a nice
// day, all picked by the city's climate (src/league/15_geo.js), not forced. Real-cities league.
// run: node tools/build.mjs && node qa/geo_venue_cap.mjs [desk|phone]   screenshots: qa/shots/geovenue/
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/');
const which = process.argv[2] || 'desk', out = path.join(root, 'qa', 'shots', 'geovenue'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const cases = [['dome', 'DET', null], ['snow', 'GB', 'snow'], ['retract_open', 'ARI', 'open'], ['altitude', 'DEN', null]];
const errs = [];
const only = process.argv[3] ? process.argv[3].split(',') : null;
for (const [tag, abbr, want] of cases) {
  if (only && !only.includes(tag)) continue;
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(tag + ' pageerror: ' + e.message)); page.on('dialog', d => d.accept());
  await page.goto('file:///' + root + '/dist/playcaller.html', { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForTimeout(1500);
  const info = await page.evaluate(([abbr, want]) => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { }
    NG.slot = 6; NG.qlen = 120; NG.real = true; createLeague(); const T = L.teams.find(t => t.abbr === abbr); pickTeam(T.id);
    // find a week and year where the city's own climate gives what we want (the user hosts that week)
    let hit = null;
    for (let y = 2026; y < 2040 && !hit; y++) for (let wk = (want === 'snow' ? 12 : 4); wk < 17 && !hit; wk++) {
      L.year = y; L.week = wk; const g = L.sched[wk].find(x => x.h === T.id || x.a === T.id); if (g.a === T.id) { const h = g.h; g.h = g.a; g.a = h; }
      const w = VENUE.today(T, L, null, g); if (want === 'snow' ? w.weather === 'snow' : want === 'open' ? w.roofOpen : true) hit = { y, wk, w };
    }
    return { team: teamLabel(T), hit };
  }, [abbr, want]);
  await page.evaluate(() => startUserGame('watch'));
  for (let i = 0; i < 400; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(300); }
  await page.click('#mKick').catch(() => { });
  for (let i = 0; i < 300; i++) { const s = await page.evaluate(() => MATCH._G && MATCH._G.stage === 'pre' && MATCH._G.play && !MATCH._G.play.ret); if (s) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(1200); await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${which}_${tag}_presnap.png`), timeout: 90000 });
  await page.evaluate(() => { const pl = MATCH._G.play; R3D.camOverride = { pos: [pl.ballX - 34, 22, pl.losZ - 30], look: [pl.ballX, 0, pl.losZ + 18], fov: 55 }; MATCH._G.paused = false; });
  await page.waitForTimeout(200); await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${which}_${tag}_wide.png`), timeout: 90000 });
  await page.evaluate(() => { const pl = MATCH._G.play; R3D.camOverride = { pos: [pl.ballX + 6, 14, pl.losZ - 6], look: [pl.ballX, 64, pl.losZ + 30], fov: 70 }; MATCH._G.paused = false; });
  await page.waitForTimeout(200); await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${which}_${tag}_roof.png`), timeout: 90000 });
  const v = await page.evaluate(() => ({ venue: R3D.venueInfo(), wx: MATCH._G.wx }));
  console.log(tag, JSON.stringify(info), JSON.stringify({ stadium: v.venue.stadium, roof: v.venue.roof, roofOpen: v.venue.roofOpen, surface: v.venue.surface, alt: v.venue.alt, tod: v.venue.tod, weather: v.venue.weather, wxTemp: v.wx.temp, dome: v.wx.dome }));
  await ctx.close();
}
await browser.close(); console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out);
