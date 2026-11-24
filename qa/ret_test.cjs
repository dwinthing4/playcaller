// Kick / punt return balance, headless: 32 kickoffs and 32 punts, CPU returner vs CPU coverage. Prints result types and average spot (returning team yard line).
// run: node tools/build.mjs && node qa/ret_test.cjs
const { PHYS, LG } = require(require('path').join(__dirname, '..', 'dist', 'sim.cjs'));
let L, team, kt; const YD = 0.9144; function league() { LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(5, 'T'); L = LG.state(); team = L.teams[3]; kt = L.teams[8]; }
const PREF = { LB: 3, S: 3, CB: 2.6, TE: 2.4, FB: 2.8, RB: 2.2, WR: 2.2 }; const pick = (T, n, excl, cover) => { const st = id => Object.values(T.depth || {}).some(a => a && a[0] === id); const v = p => PREF[p.pos] - (st(p.id) ? 1.2 : 0) + ((cover ? p.a.tak + p.a.pur : p.a.rbk + p.a.str) + p.a.spd) / 120; return T.roster.map(id => L.P[id]).filter(p => PREF[p.pos] && !excl.has(p.id)).sort((a, b) => v(b) - v(a)).slice(0, n); };
function run(kind, seed) {
  const used = new Set(); const rr = team.roster.map(id => L.P[id]).filter(p => ['WR', 'RB', 'CB', 'S'].includes(p.pos)).sort((a, b) => (b.a.spd * 0.45 + b.a.elu * 0.35 + b.a.cth * 0.2) - (a.a.spd * 0.45 + a.a.elu * 0.35 + a.a.cth * 0.2))[0]; used.add(rr.id);
  const blk = pick(team, 10, used, false), kk = kt.roster.map(id => L.P[id]).find(p => p.pos === (kind === 'punt' ? 'P' : 'K')), cov = pick(kt, 10, new Set(), true);
  const off = [{ slot: 'KR', pos: rr.pos, rp: rr, dx: -8, dy: 0 }].concat(blk.map((p, i) => ({ slot: 'B' + (i + 1), pos: p.pos, rp: p, dx: -3, dy: (i - 4.5) * 3 })));
  const def = cov.map((p, i) => ({ slot: 'C' + (i + 1), pos: p.pos, rp: p, dx: 3, dy: (i - 4.5) * 3 })).concat([{ slot: 'K', pos: kk.pos, rp: kk, dx: 8, dy: 0 }]);
  const landYd = kind === 'punt' ? 30 : 2, losR = 70;
  const opts = { losZ: kind === 'punt' ? losR * YD : landYd * YD, ballX: 0, down: 1, togo: 10, op: { id: 'ret', name: 'Kick return', side: 'O', form: 'Kick', type: 'run', carrier: 'KR', scheme: 'zone', gap: 'B', rside: 'R', routes: {} },
    dp: { id: 'cov', name: 'Coverage', side: 'D', form: 'Kick', cov: 'c3', blitz: [] }, off: { tid: team.id, list: off, bonus: 0 }, def: { tid: kt.id, list: def, bonus: 0 },
    userSide: null, diff: 'pro', seed, weather: 'clear', fatigue: {}, ret: { kind, kickX: 0, kickZ: kind === 'punt' ? (losR + 14) * YD : 65 * YD, landX: 0, landZ: landYd * YD, hang: kind === 'punt' ? 4.2 : 4.0, retSlot: 'KR', losZ: kind === 'punt' ? losR * YD : null } };
  const pl = new PHYS.Play(opts); let n = 0, bonds = [], gap = null; while (pl.phase === "live" && n < 120 * 30) { pl.step(1 / 120); n++; if (n % 4 === 0) pl.updatePoses(); if (n % 60 === 0) bonds.push(pl.D.filter(d => d.bondBy).length); if (gap === null && pl.carrier) { const r = pl.carrier; gap = Math.min(...pl.D.map(d => Math.hypot(d.p.x - r.p.x, d.p.z - r.p.z))).toFixed(1); } } if (false) console.log(kind, "bonds per 0.5s", bonds.join(","), "nearest cover at catch", gap);
  return { type: pl.result && pl.result.type, spot: pl.result ? pl.result.spotZ / YD : null, t: n / 120, fair: !!pl.fairCatch };
}
for (const kind of ['kickoff', 'punt']) { const out = []; for (let i = 0; i < 32; i++) { if (i % 8 === 0) league(); try { out.push(run(kind, 1000 + i * 77)); } catch (e) { console.log('ERR', e.stack.split('\n').slice(0, 4).join(' | ')); break; } }
  const sp = out.filter(o => o.spot != null).map(o => o.spot); console.log(kind, 'types', JSON.stringify(out.reduce((m, o) => (m[o.type] = (m[o.type] || 0) + 1, m), {})), 'avg spot', (sp.reduce((a, b) => a + b, 0) / sp.length).toFixed(1), 'spots', sp.map(x => Math.round(x)).join(','), 'avg t', (out.reduce((a, o) => a + o.t, 0) / out.length).toFixed(1)); }
