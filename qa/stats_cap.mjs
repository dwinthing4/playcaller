// League sim screens: home (next game slot / bye), schedule + scores, a box score, the player card's seasons and game log,
// leaders, history book, records. Sims a few weeks (and optionally a whole season) first.
// run: node tools/build.mjs && node qa/stats_cap.mjs [desk|phone] [weeks=6] [seasons=0]    (screenshots in qa/shots/stats/<size>)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/'), which = process.argv[2] || 'desk', weeks = +(process.argv[3] || 6), seasons = +(process.argv[4] || 0);
const out = path.join(root, 'qa', 'shots', 'stats', which); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 860, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let n = 0; const shot = async (name, full) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, String(n++).padStart(2, '0') + '_' + name + '.png'), fullPage: !!full }); };
await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(700);
await page.evaluate(() => { NG.slot = 7; NG.qlen = 60; createLeague(); pickTeam(L.teams[4].id); });
await page.evaluate(s => { for (let k = 0; k < s; k++) { simToPlayoffs(); let g = 0; while (L.phase === 'playoffs' && g++ < 10) { if (userPlayoffGame()) instantUserGame(); else simPlayoffRound(); } let r = 0; while (L.phase === 'offseason' && r++ < 6) { const x = offseasonNext(); if (!x.ok) { const U = UT(); while (U.roster.length > 53) releasePlayer(U.roster.map(id => L.P[id]).sort((a, b) => a.ovr - b.ovr)[0].id); while (capRoom(U) < 0) releasePlayer(U.roster.map(id => L.P[id]).sort((a, b) => b.sal / b.ovr - a.sal / a.ovr)[0].id); if (L.off === 'draft') simDraftUntilUser(); } } } }, seasons);
const t0 = Date.now(); await page.evaluate(w => { for (let i = 0; i < w; i++) instantUserGame(); render(); }, weeks); console.log(`${weeks} weeks simmed in ${Date.now() - t0} ms (browser)`);
await page.evaluate(() => { closeModal(); go('home'); }); await shot('home');
await page.evaluate(() => { go('schedule'); }); await shot('schedule', true);
await page.evaluate(() => { const r = L.results.filter(x => x.y === L.year && !x.po && x.h !== L.user && x.a !== L.user).slice(-1)[0]; boxModal(r.y, r.w, r.h, r.a); }); await shot('box_cpu');
await page.evaluate(() => { const box = document.querySelector('.modal .box'); if (box) box.scrollTop = 99999; const d = document.querySelector('.modal details'); if (d) d.open = true; }); await shot('box_cpu_bottom');
await page.evaluate(() => { closeModal(); const r = L.results.filter(x => x.y === L.year && (x.h === L.user || x.a === L.user)).slice(-1)[0]; boxModal(r.y, r.w, r.h, r.a, r.po ? r.rd : null); }); await shot('box_user');
// the user's QB card, his season opened
await page.evaluate(() => { closeModal(); const qb = UT().depth.QB[0]; showPlayer(qb); }); await page.waitForTimeout(300);
await page.evaluate(() => { const box = document.querySelector('.modal .box'); const t = document.querySelector('.plst'); if (box && t) box.scrollTop = t.offsetTop - 80; }); await shot('card_qb');
await page.evaluate(() => { const r = document.querySelector('.plsr'); if (r) r.click(); const box = document.querySelector('.modal .box'); const t = document.querySelector('.plst'); if (box && t) box.scrollTop = t.offsetTop - 80; }); await shot('card_qb_log');
await page.evaluate(() => { const r = document.querySelector('.plgl .plgt tr.click'); if (r) r.click(); }); await shot('card_log_box');
await page.evaluate(() => { closeModal(); const wr = UT().depth.WR[0]; showPlayer(wr); const r = document.querySelector('.plsr'); if (r) r.click(); const box = document.querySelector('.modal .box'); const t = document.querySelector('.plst'); if (box && t) box.scrollTop = t.offsetTop - 80; }); await shot('card_wr_log');
await page.evaluate(() => { closeModal(); go('leaders'); }); await shot('leaders');
await page.evaluate(() => { SUB.leadPer = 1; render(); }); await shot('leaders_pg');
await page.evaluate(() => { SUB.histTab = 'seasons'; go('history'); }); await shot('history');
if (seasons) { await page.evaluate(() => { histSeasonModal(L.lhist[L.lhist.length - 1].y); }); await shot('history_season'); await page.evaluate(() => { const box = document.querySelector('.modal .box'); if (box) box.scrollTop = 99999; }); await shot('history_season_bottom'); }
await page.evaluate(() => { closeModal(); SUB.histTab = 'dyn'; render(); }); await shot('history_dyn');
await page.evaluate(() => { SUB.histTab = 'rec'; SUB.recScope = 'lg'; render(); }); await shot('history_records', true);
// a bye week on the home screen
await page.evaluate(() => { const b = byeWeek(L.user); let g = 0; while (L.phase === 'regular' && L.week < b && g++ < 20) instantUserGame(); go('home'); }); await shot('home_bye');
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out); await browser.close();
