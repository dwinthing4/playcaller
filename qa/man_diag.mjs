// Man coverage audit: at the snap and at the catch, does every receiver have a man defender, and how far away is he?
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const YD = 0.9144;
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state();
const passes = L.plays.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line');
const mans = L.plays.filter(p => p.side === 'D' && ['c0', 'c1', 'c2m'].includes(p.cov) && p.form !== 'Goal Line D');
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
const stat = { plays: 0, uncoveredAtSnap: 0, recAtSnap: 0, catches: 0, catchNoMan: 0, manFar: 0, lateRelease: 0 }, why = {};
for (let i = 0; i < 200; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], op = passes[i % passes.length], dp = mans[i % mans.length];
  let snapDone = false, caught = false;
  PHYS.runPlay({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0 }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: i * 13 + 1, fatigue: {} }, pl => {
    if (!snapDone) { snapDone = true; stat.plays++; for (const r of pl.receivers) { stat.recAtSnap++; if (!pl.D.some(x => x.job === 'man' && x.cover === r)) { stat.uncoveredAtSnap++; const k = `${dp.cov} ${dp.name} rushers=${pl.D.filter(x => x.job === 'rush').length} recs=${pl.receivers.length}`; why[k] = (why[k] || 0) + 1; } } }
    if (!caught && pl.catcher && pl.carrier === pl.catcher) { caught = true; stat.catches++; const r = pl.catcher, m = pl.D.find(x => x.cover === r);
      if (!m) { stat.catchNoMan++; if (r.routeName === 'flat' && (r.slot === 'RB' || r.slot === 'FB' || r.posName === 'TE')) stat.lateRelease++; }
      else if (Math.hypot(m.p.x - r.p.x, m.p.z - r.p.z) > 5) stat.manFar++; }
  });
}
console.log(JSON.stringify(stat));
console.log('uncovered at snap by call:', JSON.stringify(why, null, 1));
