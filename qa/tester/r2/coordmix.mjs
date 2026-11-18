// In-page (qa2): how often does the offensive coordinator put a run in his top-3 picks / as pick 1, by situation, over all 32 teams?
// (In watch/sim the user's offense is called from these top 3: 60/25/15.) Compare with the CPU caller (cpuCall) run share.
import { launch } from '../lib.mjs';
const H = await launch('desk', { tag: 'r2_coordmix', seed: 3, file: 'playcaller_qa2.html' });
const { page } = H;
await H.newLeague(60, 5);
const r = await page.evaluate(() => {
  L._used = {}; const sits = [[1, 10, 25], [1, 10, 50], [1, 10, 75], [2, 8, 40], [2, 3, 40], [2, 1, 60], [3, 8, 40], [3, 2, 40], [3, 1, 70], [4, 1, 50], [1, 5, 95], [2, 2, 97]];
  const out = {}; let tot = { n: 0, run1: 0, runTop3: 0, cpuRun: 0, cpuN: 0 };
  for (const [down, togo, yl] of sits) { const k = `${down}&${togo}@${yl}`; const o = out[k] = { n: 0, run1: 0, runTop3: 0, cpuRun: 0, cpuN: 0, scen: null };
    for (const T of L.teams) { const opp = L.teams[(T.id + 7) % L.teams.length]; const ctx = { side: 'O', tid: T.id, oppTid: opp.id, down, togo, yl, q: 1, clock: 50, qlen: 60, sd: 0, scen: scenKeyFor(down, togo, yl, 1, 50, 60, 0) };
      o.scen = ctx.scen; const c = coordCall(ctx); const ps = c.picks.map(id => L.plays.find(p => p.id === id)); o.n++; if (ps[0] && ps[0].type === 'run') o.run1++; if (ps.some(p => p && p.type === 'run')) o.runTop3++;
      for (let i = 0; i < 6; i++) { const id = cpuCall(T.id, 'O', ctx); const p = L.plays.find(x => x.id === id); o.cpuN++; if (p && p.type === 'run') o.cpuRun++; } }
    for (const x in tot) tot[x] += o[x]; }
  // what the auto-call actually picks (60/25/15 over the top 3) for the user team
  return { out, tot };
});
for (const k in r.out) { const o = r.out[k]; console.log(`${k.padEnd(9)} (${o.scen}) OC pick 1 is a run ${(o.run1 / o.n * 100).toFixed(0)}% | a run anywhere in OC top 3 ${(o.runTop3 / o.n * 100).toFixed(0)}% | CPU caller runs ${(o.cpuRun / o.cpuN * 100).toFixed(0)}%`); }
const t = r.tot; console.log(`ALL situations: OC pick 1 run ${(t.run1 / t.n * 100).toFixed(0)}%, run in top 3 ${(t.runTop3 / t.n * 100).toFixed(0)}%, CPU caller run ${(t.cpuRun / t.cpuN * 100).toFixed(0)}%`);
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
