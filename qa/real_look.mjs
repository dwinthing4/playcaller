// Quick look: a "Real cities" career, the team picker, standings, the League editor (rename + pasted roster).
// run: node tools/build.mjs && node qa/real_look.mjs   (screenshots in qa/shots/real)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = 'C:/Users/dwint/football-game', shots = path.join(root, 'qa', 'shots', 'real'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe });
for (const [name, vw, vh] of [['desk', 1280, 800], ['phone', 390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(500);
  await page.evaluate(() => { NG.slot = 1; renderNewCareer(); }); await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll('.lgpick button')][1].click()); await page.waitForTimeout(300); await page.screenshot({ path: path.join(shots, name + '_0_newcareer.png'), fullPage: false });
  await page.evaluate(() => createLeague()); await page.waitForTimeout(600); await page.screenshot({ path: path.join(shots, name + '_1_pick.png') });
  const kc = await page.evaluate(() => { const t = L.teams.find(x => x.abbr === 'KC'); return { real: L.real, n: L.teams.length, kc: t && [t.city, t.name, t.conf, t.div, t.c1, t.hel] }; }); console.log(name, 'league', JSON.stringify(kc));
  await page.evaluate(() => pickTeam(L.teams.find(x => x.abbr === 'GB').id)); await page.waitForTimeout(600); await page.screenshot({ path: path.join(shots, name + '_2_home.png') });
  await page.evaluate(() => go('standings')); await page.waitForTimeout(400); await page.screenshot({ path: path.join(shots, name + '_3_standings.png') });
  await page.evaluate(() => go('editor')); await page.waitForTimeout(400);
  await page.fill('#edpaste', 'QB, Test Passer, 12\nRB Run Ner 33\nWR, Alpha Wide, 9\nWR, Beta Wide, 87\nXYZ, Nobody, 1');
  await page.evaluate(() => edPaste(L.user)); await page.waitForTimeout(300);
  const q = await page.evaluate(() => { const T = UT(), qb = L.P[T.depth.QB[0]], rb = L.P[T.depth.RB[0]], w = T.depth.WR.slice(0, 2).map(id => L.P[id]); return [qb.fn + ' ' + qb.ln + ' #' + qb.num, rb.fn + ' ' + rb.ln + ' #' + rb.num, w.map(p => p.fn + ' ' + p.ln + ' #' + p.num).join(' / ')]; }); console.log(name, 'pasted', JSON.stringify(q));
  await page.evaluate(() => edTeam(L.user, 'name', 'Testers')); await page.waitForTimeout(300); await page.screenshot({ path: path.join(shots, name + '_4_editor.png') });
  console.log(name, 'label after rename:', await page.evaluate(() => teamLabel(UT())), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no console errors');
}
await browser.close();
