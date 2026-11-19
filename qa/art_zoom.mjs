// close-up of a few portraits at 4x for detail work.  node qa/art_zoom.mjs <tag> [start] [count] [coach]
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/'), tag = process.argv[2] || 'z', start = +(process.argv[3] || 0), count = +(process.argv[4] || 8), coach = process.argv[5] === 'coach';
const out = path.join(root, 'qa', 'shots', 'art'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe }); const page = await (await browser.newContext({ viewport: { width: 1560, height: 800 } })).newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(700);
const h = await page.evaluate(([start, count, coach]) => { NG.slot = 6; createLeague(); pickTeam(L.teams[7].id); document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#20242c';
  const ps = Object.values(L.P).filter(p => p.tid != null).sort((a, b) => a.id - b.id), wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;grid-template-columns:repeat(4,384px);gap:4px;padding:4px'; document.body.appendChild(wrap);
  const list = coach ? L.teams.flatMap(t => [t.oc, t.dc]).map(c => ({ coach: true, lk: c.lk })) : ps.filter((p, i) => i % 5 === 0);
  for (const p of list.slice(start, start + count)) { const cv = document.createElement('canvas'); cv.width = cv.height = 384; wrap.appendChild(cv); const x = cv.getContext('2d'); x.setTransform(4, 0, 0, 4, 0, 0); drawBust(x, p, p.tid != null ? L.teams[p.tid] : L.teams[(p.lk.sk * 3) % 32]); }
  return document.body.scrollHeight; }, [start, count, coach]);
await page.setViewportSize({ width: 1560, height: h + 8 }); await page.screenshot({ path: path.join(out, tag + '.png') });
console.log(errs.length ? errs.join('\n') : 'ok', path.join(out, tag + '.png')); await browser.close();
