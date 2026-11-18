import { SNAP_CODE } from './snapcode2.mjs';
// Why do throws to the most-open receiver end "Nobody there"? Record the target at the catch point.
import fs from 'fs'; import vm from 'vm';
import { starters, makeTeam } from '../../engine_lib.mjs';
const code = SNAP_CODE;
const E = vm.runInContext(code, vm.createContext({ console, Math, Date, JSON })); const { PHYS } = E; const DT = 1 / 120, YD = 0.9144;
const book = E.buildPlaybook(), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line' && !/Screen/.test(p.name)), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const rows = []; const at = +(process.argv[3] || 2.4);
for (let i = 0; i < +(process.argv[2] || 400); i++) {
  const op = pick(passes), dp = pick(defs);
  const pl = new PHYS.Play({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: 0, list: starters(E, makeTeam(72), op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, makeTeam(72), dp.form, 'D'), bonus: 0 }, userSide: process.argv[4] === 'cpu' ? null : 'O', diff: 'pro', seed: (Math.random() * 1e9) | 0 });
  let info = null; const cp = pl.catchPoint.bind(pl);
  pl.catchPoint = function () { const B = this.ball, r = B.target; if (r) info = { d: +Math.hypot(r.p.x - B.p.x, r.p.z - B.p.z).toFixed(1), route: r.routeName, ri: r.ri, n: r.route ? r.route.length : 0, settle: r.settle, up: r.upright(), bal: r.bal, T: +B.T.toFixed(2), air: +((B.land.z - this.losZ) / YD).toFixed(1), rz: +((r.p.z - this.losZ) / YD).toFixed(1), xOut: Math.abs(r.p.x) > 24 }; return cp(); };
  let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); } if (pl.phase === 'pre') pl.goLive();
  let thrown = false, open = null, riAt = null, m = 0, upRel = null; const cpu = process.argv[4] === 'cpu';
  while (pl.phase === 'live' && m < 3600) { if (cpu && !thrown && pl.thrown && pl.ball.target) { thrown = true; upRel = pl.ball.target.upright(); open = +pl.openness(pl.qb, pl.ball.target).open.toFixed(1); riAt = 'cpu'; } if (!cpu && !thrown && pl.liveT >= at && pl.carrier === pl.qb && pl.ball.state === 'held') { let b = null, bo = -9; for (const r of pl.receivers) { const o = pl.openness(pl.qb, r).open; if (o > bo) { bo = o; b = r; } } if (b && pl.throwTo(b)) { thrown = true; open = +bo.toFixed(1); riAt = `${b.ri}/${b.route ? b.route.length : 0}`; } } pl.step(DT); m++; if (m % 4 === 0) pl.updatePoses(); }
  const r = pl.result; if (thrown && info) rows.push({ ...info, open, riAt, upRel, text: r.text, play: op.name });
}
const nob = rows.filter(r => r.text === 'Nobody there');
console.log(`throws ${rows.length}, Nobody there ${nob.length}`);
console.log('target distance from ball at catch point (Nobody there):', nob.map(r => r.d).sort((a, b) => a - b).join(' '));
const by = k => nob.reduce((o, r) => { o[r[k]] = (o[r[k]] || 0) + 1; return o; }, {});
console.log('by route', JSON.stringify(by('route')), '\nfallen target', nob.filter(r => !r.up).length, 'settle routes', nob.filter(r => r.settle).length, 'route finished at throw', nob.filter(r => r.riAt.split('/')[0] >= r.riAt.split('/')[1] - 1).length);
console.log('target upright at catch point', nob.filter(r => r.up).length, '| far (>3 m) from the ball', nob.filter(r => r.d > 3).length, '| target down at release', nob.filter(r => r.upRel === false).length);
console.log('samples', JSON.stringify(nob.slice(0, 10)));
