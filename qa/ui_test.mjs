// UI smoke test: every management screen at phone and desktop size, no console errors, no horizontal scroll.
// run: node tools/build.mjs && node qa/ui_test.mjs
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const shots = path.join(root, 'qa', 'shots', 'ui'); fs.mkdirSync(shots, { recursive: true });
const exe = [path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe')].find(f => fs.existsSync(f));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const url = 'file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/');
const TABS = ['home', 'inbox', 'roster', 'depth', 'develop', 'stories', 'uniforms', 'teaminfo', 'plan', 'playbook', 'film', 'staff', 'coach', 'facilities', 'trade', 'fa', 'scouting', 'draft', 'mock', 'contracts', 'standings', 'schedule', 'leaders', 'history', 'records', 'map', 'settings'];
let problems = [];
for (const [vw, vh, tag] of [[390, 844, 'phone'], [1280, 800, 'desk']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: tag === 'phone' ? 2 : 1, hasTouch: tag === 'phone' });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, `${tag}_00_title.png`) });
  await page.evaluate(() => { NG.slot = 1; renderTitle(); }); await page.screenshot({ path: path.join(shots, `${tag}_01_newcareer.png`) });
  await page.evaluate(() => createLeague()); await page.waitForTimeout(100); await page.screenshot({ path: path.join(shots, `${tag}_02_pick.png`) });
  await page.evaluate(() => pickTeam(L.teams.slice().sort((a, b) => teamOvr(a) - teamOvr(b))[16].id)); await page.waitForTimeout(150);
  // play two instant weeks so stats, reports and inbox have content
  await page.evaluate(() => { startUserGame('instant'); startUserGame('instant'); closeModal(); });
  const check = async (name) => { await page.waitForTimeout(120); const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov > 2) problems.push(`${tag} ${name}: horizontal overflow ${ov}px`); await page.screenshot({ path: path.join(shots, `${tag}_${name}.png`), fullPage: false }); };
  for (const t of TABS) { await page.evaluate(t => { closeModal(); go(t); }, t); await check('tab_' + t); }
  const modals = { player: () => showPlayer(UT().depth.QB[0]), prospect: () => showPlayer(L.draft[0]), oc: () => coordModal('oc'), gm: () => gmModal(), owner: () => ownerModal(), editor: () => editPlay(L.plays[0].id), extend: () => extendModal(UT().roster[3]), team: () => teamModal(3), ownerMeet: () => { ownerMeeting('midseason'); ownerMeetModal(); } };
  for (const [n, f] of Object.entries(modals)) { await page.evaluate(`closeModal();(${f.toString()})()`); await check('modal_' + n); }
  // offseason screens
  await page.evaluate(() => { closeModal(); simToPlayoffs(); let g = 0; while (L.phase === 'playoffs' && g++ < 10) { if (userPlayoffGame()) instantUserGame(); else simPlayoffRound(); } go('home'); });
  await check('off_resign'); await page.evaluate(() => { closeModal(); offseasonNext(); go('draft'); }); await check('off_draft');
  await page.evaluate(() => { offseasonNext(); go('fa'); }); await check('off_fa'); await page.evaluate(() => { go('home'); }); await check('off_home');
  const r = await page.evaluate(() => { const r = offseasonNext(); go('home'); return r; }); if (!r.ok) problems.push(`${tag}: new season did not start: ${r.msg}`); await check('season2_home');
  // save/load through IndexedDB
  const saved = await page.evaluate(async () => { await saveNow(); const y = L.year; L = null; await loadSlot(1); return L && L.year === y; }); if (!saved) problems.push(`${tag}: IndexedDB save/load failed`);
  problems.push(...errs.map(e => `${tag} ${e}`)); await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'UI: no console errors, no horizontal overflow'); console.log('screenshots in qa/shots/ui');
process.exit(problems.length ? 1 : 0);
