// Run many CPU-vs-CPU plays headless and report realism + glitch metrics.
// usage: node qa/engine_stats.mjs [runs] [passes] [offQ] [defQ]
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const N = +process.argv[2] || 200, NP = +process.argv[3] || 200, OQ = +process.argv[4] || 72, DQ = +process.argv[5] || 72;
const book = E.buildPlaybook(), runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line'), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const pick = a => a[Math.floor(Math.random() * a.length)];
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
function glitchHook(stat) {
  return pl => {
    for (const p of pl.players) {
      if (!isFinite(p.p.x) || !isFinite(p.p.z) || !isFinite(p.vel.x)) stat.nan++;
      const sp = Math.hypot(p.vel.x, p.vel.z); if (sp > p.vmax * 1.12 && !(p.lungeT > 0) && p.upright()) stat.overspeed++;
      const lp = p._lp; if (lp) { const j = Math.hypot(p.p.x - lp.x, p.p.z - lp.z); if (j > 0.2) stat.teleport++; stat.maxJump = Math.max(stat.maxJump, j); } p._lp = { x: p.p.x, z: p.p.z };
    }
  };
}
function run(kind, n) {
  const out = { yds: [], broke: 0, bounce: 0, air: [], ttt: [], press: 0, multi: 0, single: 0, fum: 0, td: 0, sacks: 0, comp: 0, att: 0, int: 0, inc: 0, time: [], defDown: 0, types: {}, glitch: { nan: 0, overspeed: 0, teleport: 0, maxJump: 0 }, errors: 0, yac: [] };
  for (let i = 0; i < n; i++) {
    const offR = makeTeam(OQ, Math.random, 'O'), defR = makeTeam(DQ, Math.random, 'D');
    const op = pick(kind === 'run' ? runs : passes), dp = pick(defs);
    let res; try { res = E.PHYS.runPlay(playOpts(E, offR, defR, op, dp), glitchHook(out.glitch)); } catch (e) { out.errors++; if (out.errors < 4) console.error(e.stack); continue; }
    out.types[res.type] = (out.types[res.type] || 0) + 1;
    out.contacts = (out.contacts || 0) + (res.contacts || 0); out.sumJ = (out.sumJ || 0) + (res.sumJ || 0); if (res.type === 'fumbleKept') out.fumKept = (out.fumKept || 0) + 1;
    out.time.push(res.t); out.broke += res.broken || 0; out.bounce += res.bounces || 0; if (res.airYds != null) out.air.push(res.airYds); if (res.throwT != null) out.ttt.push(res.throwT); if (res.pressured) out.press++;
    if (res.type === 'sack') out.sacks++;
    if (kind === 'pass' && res.type !== 'sack') { out.att++; if (res.catcher != null && res.turnover !== 'int') out.comp++; if (res.turnover === 'int') out.int++; if (res.type === 'inc') out.inc++; }
    if (res.turnover === 'fumble') out.fum++;
    if (res.td) out.td++;
    if (res.tacklers) { if (res.tacklers.length > 1) out.multi++; else if (res.tacklers.length === 1) out.single++; }
    if (res.turnover !== 'int') out.yds.push(res.yards || 0);
    if (res.contactZ != null && res.type !== 'inc') out.yac.push((res.spotZ - res.contactZ) / 0.9144);
  }
  return out;
}
const R = run('run', N), P = run('pass', NP);
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
console.log(`RUNS (${N}) off ${OQ} vs def ${DQ}`);
console.log(`  YPC ${avg(R.yds).toFixed(2)}  median ${med(R.yds).toFixed(1)}  <=0: ${pct(R.yds.filter(y => y <= 0).length, R.yds.length)}  10+: ${pct(R.yds.filter(y => y >= 10).length, R.yds.length)}  20+: ${pct(R.yds.filter(y => y >= 20).length, R.yds.length)}  TD ${R.td}`);
console.log(`  grip breaks/carry ${(R.broke / N).toFixed(2)}  bounce-offs/carry ${(R.bounce / N).toFixed(2)}  gang tackles ${pct(R.multi, R.multi + R.single)}  fumbles ${pct(R.fum, N)}  yards after contact ${avg(R.yac).toFixed(2)}  play time ${avg(R.time).toFixed(1)}s`);
console.log(`  contacts/carry ${(R.contacts / N).toFixed(2)}  avg impulse ${(R.sumJ / Math.max(1, R.contacts)).toFixed(0)} N·s  fumbles kept by offense ${R.fumKept || 0}`);
console.log(`  end types ${JSON.stringify(R.types)}  errors ${R.errors}`);
console.log(`PASSES (${NP})`);
console.log(`  comp ${pct(P.comp, P.att)}  Y/play ${avg(P.yds).toFixed(2)}  sack ${pct(P.sacks, NP)}  INT ${pct(P.int, P.att)}  TD ${P.td}  broken/play ${(P.broke / NP).toFixed(2)}  time ${avg(P.time).toFixed(1)}s`);
console.log(`  air yds/catch ${avg(P.air).toFixed(1)}  YAC/catch ${avg(P.yac).toFixed(1)}  time to throw ${avg(P.ttt).toFixed(2)}s  pressured ${pct(P.press, NP)}  bounce/play ${(P.bounce / NP).toFixed(2)}`);
console.log(`  end types ${JSON.stringify(P.types)}  errors ${P.errors}`);
console.log(`GLITCH  runs ${JSON.stringify(R.glitch)}  passes ${JSON.stringify(P.glitch)}`);
