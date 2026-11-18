// Re-run one instant game and dump the match state if it does not finish.
import { chromium } from 'playwright-core';
import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
page.on('pageerror', e => console.log('ERR', e.message)); page.on('console', m => console.log('console', m.text().slice(0, 300)));
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(() => { NG.slot = 3; NG.qlen = 120; createLeague(); pickTeam(L.teams[0].id); });
for (let i = 0; i < +(process.argv[2] || 20); i++) {
  await page.evaluate(i => { window._done = false; const h = L.teams[(i * 3 + 1) % 32], a = L.teams[(i * 3 + 2) % 32]; MATCH.open({ g: { h: h.id, a: a.id }, home: h, away: a, userTid: h.id, mode: 'instant', onDone: r => { window._done = r; } }); }, i);
  let ok = false; for (let k = 0; k < 60; k++) { const d = await Promise.race([page.evaluate(() => !!window._done), new Promise(r => setTimeout(() => r('timeout'), 5000))]); if (d === 'timeout') { console.log('page unresponsive (infinite loop?)'); break; } if (d) { ok = true; break; } await page.waitForTimeout(250); }
  if (ok) { console.log('game', i, 'ok', await page.evaluate(() => `${window._done.as}-${window._done.hs}`)); continue; }
  const st = await Promise.race([page.evaluate(() => { const G = MATCH._G; return { stage: G.stage, q: G.q, clock: G.clock, down: G.down, yl: G.yl, togo: G.togo, poss: G.poss, pat: G.pat, kickNext: G.kickNext, timers: G.timers.length, sim: G.sim, over: G.over, runoff: G.runoff, last: G.pbp.slice(-6) }; }), new Promise(r => setTimeout(() => r('no response'), 5000))]);
  console.log('STUCK game', i, JSON.stringify(st, null, 1)); break;
}
await browser.close();
