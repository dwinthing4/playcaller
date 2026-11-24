// Full-game balance in one report: N CPU-vs-CPU games through MATCH in 'instant' mode (every snap a full physics play), with the
// per-play numbers the league sim is calibrated to: points / drive, plays / drive, yards / play, run-pass mix, comp %, YPA, YPC,
// sack %, INT %, fumbles, and accepted penalties per team-game by type. Same seeded league as qa/match_sim.mjs.
// usage: node qa/field_sim.mjs [games=12] [qlen=120]      env NOROT=1: no stamina / rotation (starters every snap)
import { chromium } from 'playwright-core';
import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const N = +(process.argv[2] || 12), qlen = +(process.argv[3] || 120), file = process.env.HTML ? path.resolve(process.env.HTML) : path.join(root, 'dist', 'playcaller.html');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.addInitScript(() => { let s = 20261117; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
await page.goto('file:///' + file.replace(/\\/g, '/'), { timeout: 180000 }); await page.waitForTimeout(300);
await page.evaluate(([q, norot]) => { NG.slot = 3; NG.qlen = q; createLeague(); pickTeam(L.teams[0].id); if (norot) { LG.rotInit = null; LG.lineup = null; } }, [qlen, !!process.env.NOROT]);
const all = [];
for (let i = 0; i < N; i++) {
  const r = await page.evaluate(i => new Promise(res => { const h = L.teams[(i * 2 + 1) % 32], a = L.teams[(i * 2 + 2) % 32];
    MATCH.open({ g: { h: h.id, a: a.id }, home: h, away: a, userTid: h.id, mode: 'instant', onDone: r => { const tot = { pa: 0, pc: 0, py: 0, ra: 0, ry: 0, pint: 0, fum: 0, sk: 0, ptd: 0, rtd: 0, fga: 0, fgm: 0, pnt: 0, sacked: 0 }; for (const pid in r.st) for (const k in tot) tot[k] += r.st[pid][k] || 0;
      const pen = r.pbp.filter(x => /PENALTY/.test(x)), lost = r.drives.filter(d => d.result === 'Fumble').length;
      res({ runs: r.runLog || [], hs: r.hs, as: r.as, drives: r.drives.length, dplays: r.drives.reduce((s, d) => s + (d.plays || 0), 0), dyds: r.drives.reduce((s, d) => s + (d.yds || 0), 0), plays: r.pbp.filter(x => / at /.test(x)).length, tot, res: r.drives.map(d => d.result), pen, lost, sackY: r.pbp.filter(x => /sacked/.test(x)).map(x => +((/for (-?\d+)/.exec(x) || [0, 0])[1])) }); } }); }), i);
  all.push(r); console.log(`game ${i + 1}: ${r.as}-${r.hs}  plays ${r.plays}  drives ${r.drives}  | ${r.tot.pc}/${r.tot.pa} ${r.tot.py} pass, ${r.tot.ra}-${r.tot.ry} rush, INT ${r.tot.pint}, sacks ${r.tot.sk}, FG ${r.tot.fgm}/${r.tot.fga}, punts ${r.tot.pnt}, flags ${r.pen.filter(x => /accepted/.test(x)).length}`);
}
const n = all.length, S = k => all.reduce((s, r) => s + r.tot[k], 0), sum = f => all.reduce((s, r) => s + f(r), 0);
const nd = sum(r => r.drives), pts = sum(r => r.hs + r.as), dr = {}; for (const r of all) for (const x of r.res) dr[x] = (dr[x] || 0) + 1;
const pa = S('pa'), sk = S('sk'), ra = S('ra'), drop = pa + sk, plays = pa + sk + ra, yds = S('py') + S('ry');
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2), pc = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : '-');
console.log(`\npoints per drive ${f2(pts / nd)} (target 1.8-2.1)   points per team-game ${f1(pts / n / 2)}   TD per drive ${pc(dr.TD || 0, nd)}`);
console.log(`plays per drive ${f1(sum(r => r.dplays) / nd)}   yards per drive ${f1(sum(r => r.dyds) / nd)}   yards per play ${f2(yds / plays)}   scrimmage plays per team-game ${f1(plays / n / 2)}`);
console.log(`run/pass: ${pc(ra, plays)} runs / ${pc(drop, plays)} dropbacks   comp ${pc(S('pc'), pa)}   YPA ${f2(S('py') / pa)}   YPC ${f2(S('ry') / ra)}   sack ${pc(sk, drop)}   INT ${pc(S('pint'), pa)}   fumbles lost per team-game ${f2(sum(r => r.lost) / n / 2)}`);
const acc = {}; for (const r of all) for (const l of r.pen) { const m = /PENALTY \S+: ([^(,]+?)(?: \(|,)/.exec(l); if (m && /accepted/.test(l)) acc[m[1].trim()] = (acc[m[1].trim()] || 0) + 1; }
const ta = Object.values(acc).reduce((s, v) => s + v, 0); console.log(`accepted penalties per team-game ${f2(ta / n / 2)}: ` + Object.keys(acc).sort((a, b) => acc[b] - acc[a]).map(k => `${k} ${f2(acc[k] / n / 2)}`).join(', '));
console.log('drive results', JSON.stringify(dr));
{ const runs = all.flatMap(r => r.runs), g = f => { const m = {}; for (const x of runs) (m[f(x)] = m[f(x)] || []).push(x.y); return Object.entries(m).sort((a, b) => b[1].length - a[1].length).map(([k, a]) => `${k} n=${a.length} ypc ${(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1)}`).join(' | '); };
  console.log('runs by scheme:', g(x => x.sc || '?')); console.log('top run plays:', g(x => x.n).split(' | ').slice(0, 8).join(' | ')); }
await browser.close(); console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no errors');
