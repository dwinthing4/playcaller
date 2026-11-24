// Onside and squib kicks, headless: how often the kicking team gets an onside kick back (expected by the hands team, and as a
// surprise), and where squib returns end up. The match's instant-game odds (onsideOdds) should match these.
// run: node tools/build.mjs && node qa/onside_test.cjs [n]
const { PHYS, LG } = require(require('path').join(__dirname, '..', 'dist', 'sim.cjs'));
const N = +(process.argv[2] || 40);
let L, team, kt; const YD = 0.9144; function league() { LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(5, 'T'); L = LG.state(); team = L.teams[3]; kt = L.teams[8]; }
const PREF = { LB: 3, S: 3, CB: 2.6, TE: 2.4, FB: 2.8, RB: 2.2, WR: 2.2 }; const pick = (T, n, excl, cover) => { const st = id => Object.values(T.depth || {}).some(a => a && a[0] === id); const v = p => PREF[p.pos] - (st(p.id) ? 1.2 : 0) + ((cover ? p.a.tak + p.a.pur : p.a.rbk + p.a.str) + p.a.spd) / 120; return T.roster.map(id => L.P[id]).filter(p => PREF[p.pos] && !excl.has(p.id)).sort((a, b) => v(b) - v(a)).slice(0, n); };
function run(kind, expect, seed) {
  const used = new Set(); const rr = team.roster.map(id => L.P[id]).filter(p => ['WR', 'RB', 'CB', 'S'].includes(p.pos)).sort((a, b) => (b.a.spd * 0.45 + b.a.elu * 0.35) - (a.a.spd * 0.45 + a.a.elu * 0.35))[0]; used.add(rr.id);
  const blk = pick(team, 10, used, false), kk = kt.roster.map(id => L.P[id]).find(p => p.pos === 'K'), cov = pick(kt, 10, new Set(), true);
  const off = [{ slot: 'KR', pos: rr.pos, rp: rr, dx: -8, dy: 0 }].concat(blk.map((p, i) => ({ slot: 'B' + (i + 1), pos: p.pos, rp: p, dx: -3, dy: (i - 4.5) * 3 })));
  const def = cov.map((p, i) => ({ slot: 'C' + (i + 1), pos: p.pos, rp: p, dx: 3, dy: (i - 4.5) * 3 })).concat([{ slot: 'K', pos: kk.pos, rp: kk, dx: 8, dy: 0 }]);
  const kickZ = 65 * YD, opts = { losZ: 2 * YD, ballX: 0, down: 1, togo: 10, op: { id: 'ret', name: 'Kick return', side: 'O', form: 'Kick', type: 'run', carrier: 'KR', scheme: 'zone', gap: 'B', rside: 'R', routes: {} },
    dp: { id: 'cov', name: 'Coverage', side: 'D', form: 'Kick', cov: 'c3', blitz: [] }, off: { tid: team.id, list: off, bonus: 0 }, def: { tid: kt.id, list: def, bonus: 0 },
    userSide: null, diff: 'pro', seed, weather: 'clear', fatigue: {}, ret: { kind: 'kickoff', kickX: 0, kickZ, landX: 0, landZ: 2 * YD, hang: 4, retSlot: 'KR', losZ: null, wait: true } };
  const pl = new PHYS.Play(opts), r = PHYS._ && PHYS._.rng ? null : null;
  const sp = PHYS.KICKS[kind](seed % 2 ? 1 : -1, 0.75, kickZ / YD); pl.kickSpecial(kind, sp.x, sp.landYd * YD, sp.hang, expect);
  let n = 0; while (pl.phase === 'live' && n < 120 * 30) { pl.step(1 / 120); n++; if (n % 4 === 0) pl.updatePoses(); }
  const res = pl.result || {}; return { type: res.type, spot: res.spotZ != null ? res.spotZ / YD : null, t: n / 120 };
}
for (const [kind, expect] of [['onside', true], ['onside', false], ['squib', false]]) {
  const out = []; for (let i = 0; i < N; i++) { if (i % 10 === 0) league(); try { out.push(run(kind, expect, 3000 + i * 131)); } catch (e) { console.log('ERR', e.stack.split('\n').slice(0, 4).join(' | ')); break; } }
  const types = out.reduce((m, o) => (m[o.type] = (m[o.type] || 0) + 1, m), {}), kept = out.filter(o => o.type === 'fumbleLost').length, sp = out.filter(o => o.spot != null && o.type !== 'fumbleLost').map(o => o.spot);
  console.log(`${kind}${kind === 'onside' ? (expect ? ' (expected)' : ' (surprise)') : ''}: kicking team recovers ${(kept / out.length * 100).toFixed(0)}%  types ${JSON.stringify(types)}  return team's avg spot ${(sp.reduce((a, b) => a + b, 0) / Math.max(1, sp.length)).toFixed(1)}  avg time ${(out.reduce((a, o) => a + o.t, 0) / out.length).toFixed(1)}s`);
}
