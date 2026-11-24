// Penalties over full games: N CPU games through MATCH in 'instant' mode (every snap a full physics play). Reports accepted
// penalties per team per game by type, declined / offsetting, scoring per drive, and the weather the games were played in.
// usage: node qa/penalty_rates.mjs [games] [qlen]
import { chromium } from 'playwright-core';
import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const N = +(process.argv[2] || 8), qlen = +(process.argv[3] || 120);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.addInitScript(() => { let s = 20261117; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });     // seeded, like match_sim
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(q => { NG.slot = 3; NG.qlen = q; createLeague(); pickTeam(L.teams[0].id); }, qlen);
const all = [];
for (let i = 0; i < N; i++) {
  const r = await page.evaluate(i => new Promise(res => { const h = L.teams[(i * 2 + 1) % 32], a = L.teams[(i * 2 + 2) % 32]; L.week = (i * 3) % 17;
    MATCH.open({ g: { h: h.id, a: a.id }, home: h, away: a, userTid: h.id, mode: 'instant', onDone: r => res({ hs: r.hs, as: r.as, pen: r.pen, wx: r.wx, drives: r.drives.length, dr: r.drives, pbp: r.pbp.filter(x => /PENALTY|Offsetting|runoff/.test(x)), plays: r.pbp.filter(x => / at /.test(x)).length, full: r.pbp }) }); }), i);
  all.push(r); if (process.env.DUMP && i === 0) for (const l of r.full) console.log(l);
  const pn = Object.values(r.pen || {}); console.log(`game ${i + 1}: ${r.as}-${r.hs}  plays ${r.plays}  drives ${r.drives}  penalties ${pn.map(x => `${x.n}-${x.yds}`).join(' / ')}  wx ${r.wx.weather} ${r.wx.temp}F wind ${r.wx.wind.mph}${r.wx.dome ? ' (dome)' : ''}`);
}
const n = all.length, acc = {}, dec = {}; let off = 0, runoff = 0;
for (const r of all) for (const l of r.pbp) { const m = /PENALTY \S+: ([^(,]+?)(?: \(|,)/.exec(l); if (/Offsetting/.test(l)) off++; if (/runoff/.test(l)) runoff++; if (!m) continue; const k = m[1].trim(); if (/accepted/.test(l)) acc[k] = (acc[k] || 0) + 1; else if (/declined/.test(l)) dec[k] = (dec[k] || 0) + 1; }
const totAcc = Object.values(acc).reduce((s, v) => s + v, 0), totDec = Object.values(dec).reduce((s, v) => s + v, 0), yds = all.reduce((s, r) => s + Object.values(r.pen).reduce((a, x) => a + x.yds, 0), 0);
console.log(`\naccepted per team-game ${(totAcc / n / 2).toFixed(2)} (${(yds / n / 2).toFixed(1)} yds)   declined ${(totDec / n / 2).toFixed(2)}   offsetting ${(off / n).toFixed(2)}/game   10-sec runoffs ${runoff}`);
for (const k of Object.keys(acc).sort((a, b) => acc[b] - acc[a])) console.log(`  ${k.padEnd(30)} ${(acc[k] / n / 2).toFixed(2)} per team-game${dec[k] ? `  (+${(dec[k] / n / 2).toFixed(2)} declined)` : ''}`);
const nd = all.reduce((s, r) => s + r.drives, 0), pts = all.reduce((s, r) => s + r.hs + r.as, 0);
console.log(`points per team-game ${(pts / n / 2).toFixed(1)}, points per drive ${(pts / nd).toFixed(2)} (target ~1.7-2.2), plays per team-game ${(all.reduce((s, r) => s + r.plays, 0) / n / 2).toFixed(1)}`);
await browser.close(); console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no errors');
