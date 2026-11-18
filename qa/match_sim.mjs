// Full-game balance: N games through MATCH in 'instant' mode (every snap is a full physics play, CPU calls both sides).
import { chromium } from 'playwright-core';
import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const N = +(process.argv[2] || 8), qlen = +(process.argv[3] || 120);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.addInitScript(() => { let s = 20261117; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }); // SEEDED_LEAGUE
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(q => { NG.slot = 3; NG.qlen = q; createLeague(); pickTeam(L.teams[0].id); }, qlen);
const all = [];
for (let i = 0; i < N; i++) {
  const t0 = Date.now();
  const r = await page.evaluate(i => new Promise(res => { const h = L.teams[(i * 2 + 1) % 32], a = L.teams[(i * 2 + 2) % 32];
    MATCH.open({ g: { h: h.id, a: a.id }, home: h, away: a, userTid: h.id, mode: 'instant', onDone: r => { const tot = { pa: 0, pc: 0, py: 0, ra: 0, ry: 0, pint: 0, fum: 0, sk: 0, ptd: 0, rtd: 0, fga: 0, fgm: 0, pnt: 0 }; for (const pid in r.st) for (const k in tot) tot[k] += r.st[pid][k] || 0; res({ runs: r.runLog || [], pbp: r.pbp, hs: r.hs, as: r.as, ovr: [teamOvr(h), teamOvr(a)], drives: r.drives.length, plays: r.pbp.filter(x => / at /.test(x)).length, tot, res: r.drives.map(d => d.result) }); } }); }), i);
  r.sec = (Date.now() - t0) / 1000; all.push(r);
  console.log(`game ${i + 1}: ${r.as}-${r.hs} (ovr ${r.ovr[1]} @ ${r.ovr[0]})  plays ${r.plays}  drives ${r.drives}  ${r.sec.toFixed(1)}s  | ${r.tot.pc}/${r.tot.pa} ${r.tot.py} pass yds, ${r.tot.ra} rushes ${r.tot.ry} yds, INT ${r.tot.pint}, sacks ${r.tot.sk}, FG ${r.tot.fgm}/${r.tot.fga}, punts ${r.tot.pnt}`);
}
const S = k => all.reduce((s, r) => s + r.tot[k], 0), n = all.length;
console.log(`\nper team-game: pts ${(all.reduce((s, r) => s + r.hs + r.as, 0) / n / 2).toFixed(1)}  plays ${(all.reduce((s, r) => s + r.plays, 0) / n / 2).toFixed(1)}  comp ${(S('pc') / S('pa') * 100).toFixed(1)}%  ypa ${(S('py') / S('pa')).toFixed(2)}  ypc ${(S('ry') / S('ra')).toFixed(2)}  INT/att ${(S('pint') / S('pa') * 100).toFixed(1)}%  sack/dropback ${(S('sk') / (S('pa') + S('sk')) * 100).toFixed(1)}%`);
const dr = {}; for (const r of all) for (const x of r.res) dr[x] = (dr[x] || 0) + 1; console.log('drive results', JSON.stringify(dr));
{ const B = {}; for (const r of all) for (const l of r.pbp) { const m = /(\d)(?:st|nd|rd|th)&(\d+) at (\S+) (\d+|50)?.*: .* (runs|scrambles) for (-?\d+) yd/.exec(l); if (!m) continue; const k = `${m[1] === '1' ? '1st' : +m[2] <= 3 ? 'short' : 'other'}`; (B[k] = B[k] || []).push(+m[6]); }
  console.log('game runs by situation:', Object.entries(B).map(([k, a]) => `${k}: n=${a.length} ypc ${(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2)} med ${a.slice().sort((x, y) => x - y)[a.length >> 1]}`).join(' | ')); }
{ const runs = all.flatMap(r => r.runs), g = (f) => { const m = {}; for (const x of runs) (m[f(x)] = m[f(x)] || []).push(x.y); return Object.entries(m).sort((a, b) => b[1].length - a[1].length).map(([k, a]) => `${k} n=${a.length} ypc ${(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1)}`).join(' | '); };
  console.log(`logged runs ${runs.length}`); console.log('by scheme:', g(x => x.sc || '?')); console.log('by form:', g(x => x.f)); console.log('by kind/type:', g(x => x.k + '/' + x.ty)); console.log('by field zone:', g(x => x.yl < 10 ? 'own<10' : x.yl > 90 ? 'goal' : x.yl > 80 ? 'red' : 'open')); console.log('top plays:', g(x => x.n).split(' | ').slice(0, 8).join(' | ')); }
const nd = all.reduce((s, r) => s + r.drives, 0), pts = all.reduce((s, r) => s + r.hs + r.as, 0); console.log(`points per drive ${(pts / nd).toFixed(2)} (NFL ~2.0), TD per drive ${((dr.TD || 0) / nd * 100).toFixed(0)}% (NFL ~22%)`);
await browser.close(); console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no errors');
