// Rotations in full games: N CPU-vs-CPU games through MATCH in 'instant' mode (every snap is a full physics play).
// Checks every snap's lineup (11 men, no duplicates, no injured players) and reports snap shares, carries and breathers.
// run: node tools/build.mjs && node qa/rotation_match.mjs [games=4] [qlen=300]
import { chromium } from 'playwright-core';
import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const N = +(process.argv[2] || 4), qlen = +(process.argv[3] || 300);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.addInitScript(() => { let s = 20261124; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/')); await page.waitForTimeout(300);
await page.evaluate(q => { NG.slot = 3; NG.qlen = q; createLeague(); pickTeam(L.teams[0].id); }, qlen);
// wrap the lineup builder: validate every snap and keep the breather notes
await page.evaluate(() => { const f = LG.lineup; window.__rq = { bad: [], notes: [], snaps: 0 };
  LG.lineup = (T, form, side, ctx, rs) => { const l = f(T, form, side, ctx, rs); if (rs) { window.__rq.snaps++; const ids = l.map(e => e.pid); const bad = l.length !== 11 ? 'count ' + l.length : new Set(ids).size !== 11 ? 'duplicate' : ids.some(id => id == null || !L.P[id] || L.P[id].inj > 0) ? 'injured/missing' : null;
    if (bad) window.__rq.bad.push(`${T.abbr} ${form} ${side}: ${bad}`); for (const n of l.notes || []) window.__rq.notes.push(T.abbr + ': ' + n);
    const M = window.__rq.minE || (window.__rq.minE = {}); for (const e of l) { const p = L.P[e.pid], v = rs.E[e.pid]; if (p && v != null) { const m = M[p.pos] || (M[p.pos] = { min: 1, sum: 0, n: 0, lo: 0 }); m.min = Math.min(m.min, v); m.sum += v; m.n++; if (v < 0.7) m.lo++; if (v < ROT_SUB && !LG._t.rotLocked?.(T, e.pid) && window.__rq.low.length < 12) window.__rq.low.push(`${T.abbr} ${form} ${e.slot} ${p.ln} ${(v * 100).toFixed(0)}% rest=${!!rs.rest[e.pid]} ${ctx && ctx.scen} grp=${(T.depth[p.pos] || []).filter(id => available(id)).length}`); } } } return l; }; window.__rq.low = []; });
const all = [];
for (let i = 0; i < N; i++) {
  const r = await page.evaluate(i => new Promise(res => { const h = L.teams[(i * 2 + 1) % 32], a = L.teams[(i * 2 + 2) % 32]; window.__rq.notes = [];
    MATCH.open({ g: { h: h.id, a: a.id }, home: h, away: a, userTid: h.id, mode: 'instant', onDone: r => {
      const out = { teams: [] };
      for (const T of [h, a]) { const R = (r.rot || {})[T.id] || { O: 0, D: 0, p: {} }, grp = pos => (T.depth[pos] || []).map(id => L.P[id]).filter(Boolean).map(p => ({ ln: p.ln, inj: p.inj > 0, pct: Math.round(100 * (R.p[p.id] || 0) / Math.max(1, pos === 'DE' || pos === 'DT' || pos === 'LB' || pos === 'CB' || pos === 'S' ? R.D : R.O)), ra: (r.st[p.id] || {}).ra || 0, tgt: (r.st[p.id] || {}).tgt || 0, rec: (r.st[p.id] || {}).rec || 0 }));
        const pre = pos => LG._t.rotInfo(T, pos).preset;
        out.teams.push({ abbr: T.abbr, O: R.O, D: R.D, rb: grp('RB'), wr: grp('WR'), te: grp('TE'), de: grp('DE'), dt: grp('DT'), lb: grp('LB'), cb: grp('CB'), pre: { RB: pre('RB'), WR: pre('WR'), DE: pre('DE') } }); }
      out.score = `${a.abbr} ${r.as} @ ${h.abbr} ${r.hs}`; out.notes = window.__rq.notes.slice(); res(out); } }); }), i);
  all.push(r); console.log(`\ngame ${i + 1}: ${r.score}`);
  for (const t of r.teams) {
    const f = (g, k) => g.filter(x => x.pct > 0 || x[k]).map(x => `${x.ln}${x.inj ? '(inj)' : ''} ${x.pct}%${k && x[k] ? ' ' + x[k] + (k === 'ra' ? 'car' : 'tgt') : ''}`).join(', ');
    console.log(`  ${t.abbr} (${t.O} off / ${t.D} def snaps; RB ${t.pre.RB}, WR ${t.pre.WR}, DL ${t.pre.DE})\n    RB: ${f(t.rb, 'ra')}\n    WR: ${f(t.wr, 'tgt')}\n    TE: ${f(t.te, 'tgt')}\n    DE: ${f(t.de)} | DT: ${f(t.dt)}\n    LB: ${f(t.lb)} | CB: ${f(t.cb)}`);
  }
  const br = r.notes.filter(n => /breather/.test(n)); console.log(`  breathers ${br.length}, back-in ${r.notes.filter(n => /back in/.test(n)).length}: ${br.slice(0, 6).join(' | ')}`);
}
const q = await page.evaluate(() => window.__rq);
console.log('\nstamina of players on the field at the snap (avg / lowest / snaps under 70%): ' + Object.entries(q.minE || {}).map(([k, m]) => `${k} ${(m.sum / m.n * 100).toFixed(0)}/${(m.min * 100).toFixed(0)}/${m.lo}`).join('  '));
if (q.low.length) console.log('on the field under the breather line: ' + q.low.join(' | '));
console.log(`\n${q.snaps} lineups checked, ${q.bad.length} bad${q.bad.length ? ': ' + q.bad.slice(0, 8).join(' | ') : ''}`);
await browser.close(); console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no errors');
process.exit(q.bad.length || errs.length ? 1 : 0);
