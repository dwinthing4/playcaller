// Fast league sim vs the physics engine, side by side, at the same quarter length.
//   node qa/sim_compare.mjs engine <qlen> [games]   full engine games (MATCH 'instant' mode in Chromium, every snap a physics play) -> qa/reports/sim_engine_q<qlen>.json
//   node qa/sim_compare.mjs [qlen ...]              the fast sim (dist/sim.cjs, 300 games per length) next to the saved engine numbers (default 60 120 300)
// Build first: node tools/build.mjs
import fs from 'fs'; import path from 'path'; import os from 'os'; import { createRequire } from 'module';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const repDir = path.join(root, 'qa', 'reports'); fs.mkdirSync(repDir, { recursive: true });
const KEYS = ['pts', 'drives', 'plays', 'pa', 'pc', 'py', 'ptd', 'pint', 'sk', 'ra', 'ry', 'rtd', 'fumL', 'pnt', 'fga', 'fgm', 'xpa', 'tds', 'to', 'pen'];
const blank = () => Object.fromEntries(KEYS.map(k => [k, 0]));
function summary(rows) {      // rows: one per team-game
  const n = rows.length || 1, S = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const o = {}; for (const k of KEYS) o[k] = S(k) / n;
  const pa = S('pa'), ra = S('ra'), sk = S('sk'), dr = S('drives');
  Object.assign(o, { games: rows.length, ppd: S('pts') / Math.max(1, dr), tdPerDrive: S('tds') / Math.max(1, dr), comp: S('pc') / Math.max(1, pa), ypa: S('py') / Math.max(1, pa), ypc: S('ry') / Math.max(1, ra),
    sackRate: sk / Math.max(1, pa + sk), intRate: S('pint') / Math.max(1, pa), passShare: (pa + sk) / Math.max(1, pa + sk + ra), fgPct: S('fgm') / Math.max(1, S('fga')) });
  return o;
}
// ---------------------------------------------------------------- engine
async function runEngine(qlen, N) {
  const { chromium } = await import('playwright-core');
  const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(q => { let s = 20261124 + q; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, qlen);
  await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
  await page.evaluate(q => { NG.slot = 3; NG.qlen = q; createLeague(); pickTeam(L.teams[0].id);
    // QA hook: the live time of every scrimmage snap by result (what the fast sim's clock model is fitted to)
    window.__pl = []; const ep = PHYS.Play.prototype.endPlay; PHYS.Play.prototype.endPlay = function (type, text, who, spotZ, extra) { const was = this.phase; ep.call(this, type, text, who, spotZ, extra); if (was !== 'dead' && this.result && !this.ret) window.__pl.push({ t: +this.liveT.toFixed(2), ty: type, k: this.kind, sk: !!this.result.sack, y: Math.round(this.result.yards || 0), tid: this.o.off && this.o.off.tid }); }; }, qlen);
  const rows = [], clock = {};
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const r = await page.evaluate(i => new Promise(res => { const h = L.teams[(i * 2 + 1) % 32], a = L.teams[(i * 5 + 2) % 32 === (i * 2 + 1) % 32 ? (i * 5 + 3) % 32 : (i * 5 + 2) % 32]; window.__pl = [];
      MATCH.open({ g: { h: h.id, a: a.id }, home: h, away: a, userTid: -1, mode: 'instant', onDone: r => {
        const tm = {}; for (const T of [h, a]) tm[T.id] = { abbr: T.abbr, pts: T.id === h.id ? r.hs : r.as, st: {}, drives: r.drives.filter(d => d.tid === T.id).map(d => d.result), pen: (r.pen && r.pen[T.id] || { n: 0 }).n, plays: 0, tos: 0 };
        for (const pid in r.st) { const p = L.P[pid]; if (!p || !tm[p.tid]) continue; const s = tm[p.tid].st; for (const k in r.st[pid]) s[k] = (s[k] || 0) + r.st[pid][k]; }
        for (const l of r.pbp) { const m = / (\S+) \d(?:st|nd|rd|th)&\d+ at /.exec(l); if (m) for (const id in tm) if (tm[id].abbr === m[1]) tm[id].plays++; if (/Timeout/.test(l)) for (const id in tm) if (l.endsWith(tm[id].abbr)) tm[id].tos++; }
        res({ tm, plays: window.__pl, ot: r.pbp.some(l => /^OT/.test(l)) }); } }); }), i);
    for (const id in r.tm) { const x = r.tm[id], s = x.st, o = blank();
      Object.assign(o, { pts: x.pts, drives: x.drives.length, plays: x.plays, pa: s.pa || 0, pc: s.pc || 0, py: s.py || 0, ptd: s.ptd || 0, pint: s.pint || 0, ra: s.ra || 0, ry: s.ry || 0, rtd: s.rtd || 0, pnt: s.pnt || 0, fga: s.fga || 0, fgm: s.fgm || 0, xpa: s.xpa || 0,
        sk: r.plays.filter(p => p.sk && p.tid === +id).length, fumL: x.drives.filter(d => d === 'Fumble').length, tds: x.drives.filter(d => d === 'TD').length, to: x.tos, pen: x.pen });
      rows.push(o); }
    for (const p of r.plays) { const c = p.sk ? 'sack' : p.ty === 'inc' ? 'inc' : p.k === 'pass' || p.k === 'catch' ? 'pass_' + p.ty : p.k === 'scramble' ? 'scramble' : 'run_' + p.ty; (clock[c] = clock[c] || []).push(p.t); }
    console.log(`engine q${qlen} game ${i + 1}/${N}: ${(Date.now() - t0) / 1000}s  ${Object.values(r.tm).map(x => `${x.abbr} ${x.pts} (${x.plays} plays, ${x.drives.length} drives)`).join(' - ')}${r.ot ? ' OT' : ''}`);
  }
  await browser.close(); if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
  const ct = {}; for (const k in clock) { const a = clock[k]; ct[k] = { n: a.length, mean: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) }; }
  const out = { qlen, at: new Date().toISOString(), sum: summary(rows), clock: ct };
  fs.writeFileSync(path.join(repDir, `sim_engine_q${qlen}.json`), JSON.stringify(out, null, 1)); return out;
}
// ---------------------------------------------------------------- fast sim
function runFast(qlen, N) {
  const require = createRequire(import.meta.url); const mod = path.join(root, 'dist', 'sim.cjs'); delete require.cache[mod];
  const { LG } = require(mod); LG.newLeague({ diff: 'pro', qlen }); LG.chooseTeam(0, 'Test'); const L = LG.state(); L.ghost = true;
  const rows = [], t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const h = (i * 7 + 1) % 32, a = (i * 11 + 4) % 32 === h ? (h + 9) % 32 : (i * 11 + 4) % 32;
    const box = LG._t.fastGame({ h, a }, { noApply: true });
    for (const side of ['h', 'a']) { const T = box.t[side], o = blank(); for (const k of KEYS) o[k] = T[k] || 0; o.to = T.tos || 0; rows.push(o); }
  }
  const ms = (Date.now() - t0) / N;
  return { qlen, sum: summary(rows), msPerGame: ms };
}
const f1 = x => (x == null ? '—' : x.toFixed(1)), f2 = x => (x == null ? '—' : x.toFixed(2)), pc = x => (x == null ? '—' : (x * 100).toFixed(1) + '%');
const LINES = [['Points', 'pts', f1], ['Drives', 'drives', f1], ['Scrimmage plays', 'plays', f1], ['Points / drive', 'ppd', f2], ['TD / drive', 'tdPerDrive', pc], ['Pass att', 'pa', f1], ['Completion', 'comp', pc], ['Pass yds', 'py', f1], ['Yds / att', 'ypa', f2],
  ['Pass TD', 'ptd', f2], ['INT rate', 'intRate', pc], ['Sacks', 'sk', f2], ['Sack rate', 'sackRate', pc], ['Rushes', 'ra', f1], ['Rush yds', 'ry', f1], ['Yds / carry', 'ypc', f2], ['Rush TD', 'rtd', f2], ['Pass share', 'passShare', pc],
  ['Fumbles lost', 'fumL', f2], ['Punts', 'pnt', f2], ['FG att', 'fga', f2], ['FG %', 'fgPct', pc], ['Timeouts used', 'to', f2], ['Penalties', 'pen', f2]];
const args = process.argv.slice(2);
if (args[0] === 'engine') { const r = await runEngine(+(args[1] || 60), +(args[2] || 6)); console.log(JSON.stringify(r.sum, null, 1)); console.log('play clock', JSON.stringify(r.clock)); }
else {
  const qs = args.length ? args.map(Number) : [60, 120, 300];
  for (const q of qs) {
    const fp = path.join(repDir, `sim_engine_q${q}.json`); const E = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null;
    const F = runFast(q, 300);
    console.log(`\n=== quarter length ${q}s ===  per team per game   fast sim: ${F.sum.games / 2} games, ${F.msPerGame.toFixed(2)} ms/game${E ? `   engine: ${E.sum.games / 2} games (${E.at.slice(0, 10)})` : '   (no engine numbers yet: node qa/sim_compare.mjs engine ' + q + ' 8)'}`);
    console.log('                      fast     engine');
    for (const [lab, k, f] of LINES) console.log(`${lab.padEnd(18)} ${f(F.sum[k]).padStart(8)} ${(E ? f(E.sum[k]) : '').padStart(9)}`);
  }
}
