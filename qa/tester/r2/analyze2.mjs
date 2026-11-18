// Analyze an out_fullgame_*.json: per-play table, rule checks (down/distance/spot/clock), tackling + physics stats.
import fs from 'fs';
const f = process.argv[2]; const D = JSON.parse(fs.readFileSync(f, 'utf8'));
const P = D.mon.plays.filter(p => p.res); const rows = []; const issues = []; // kick animations register as result-less plays
for (let i = 0; i < P.length; i++) {
  const p = P[i], r = p.res; if (!r) { rows.push(`#${i} ${p.op} vs ${p.dp} : NO RESULT`); continue; }
  const pre = p.pre; let next = null; for (let j = i + 1; j < P.length; j++) { next = P[j].pre; break; }
  const plan = (D.results.find(x => x.res && x.res.t === r.t && x.res.spot === r.spot) || {}).plan || {};
  rows.push(`#${String(i).padStart(2)} Q${pre.q} ${pre.clock.toFixed(1).padStart(5)} ${pre.pat || ''}${pre.down}&${pre.togo.toFixed(1)} @${pre.yl.toFixed(1).padStart(5)} ${p.user || '-'} ${(p.op || '').padEnd(18)} vs ${(p.dp || '').padEnd(16)} -> ${r.type.padEnd(10)} ${String(r.yards.toFixed(1)).padStart(5)}y t=${r.t.toFixed(1)} air=${r.airYds ?? '-'} contact@${r.contactYd ?? '-'} brk=${r.broken} bnc=${r.bounces} cts=${r.contacts} tk=${r.nTk} maxV=${p.maxSpd} tp=${p.teleports} ballOff=${p.ballOffMax} | ${r.text} | plan=${plan.kind || ''}${plan.thrownTo ? ' to ' + plan.thrownTo : ''}${plan.open ? ' open ' + plan.open.open : ''}${plan.moveTapped ? ' move:' + plan.move + (plan.moveFiredWithoutStick === false ? ' (DID NOT FIRE)' : '') : ''}${plan.switched != null ? ` sw${plan.switched} tk${plan.tackles} swat${plan.swats}` : ''}`);
  // rule check against the next snap of the same drive
  if (next && !pre.pat && !r.td && !r.to && !r.safety && r.type !== 'fumbleLost' && next.poss === pre.poss && next.q === pre.q) {
    const expYl = r.type === 'inc' ? pre.yl : Math.min(99.5, Math.max(0.5, r.spot));
    if (Math.abs(next.yl - expYl) > 0.05 && next.down !== 1) issues.push(`#${i} spot: expected yl ${expYl.toFixed(2)}, next snap at ${next.yl}`);
    const gained = expYl - pre.yl, first = gained >= pre.togo - 1e-6;
    if (first && next.down !== 1) issues.push(`#${i} first down missed: gained ${gained.toFixed(2)} of ${pre.togo}, next down ${next.down}`);
    if (!first && next.down !== pre.down + 1 && !(next.down === pre.down + 2)) issues.push(`#${i} down: ${pre.down} -> ${next.down} (gained ${gained.toFixed(2)} of ${pre.togo})`);
    if (!first && Math.abs(next.togo - (pre.togo - gained)) > 0.05 && next.down === pre.down + 1) issues.push(`#${i} togo: expected ${(pre.togo - gained).toFixed(2)}, got ${next.togo}`);
    const used = pre.clock - next.clock; if (used < r.t - 0.05) issues.push(`#${i} clock: play took ${r.t}s but clock only went ${pre.clock} -> ${next.clock}`);
  }
}
console.log(rows.join('\n'));
console.log('\nRULE ISSUES:', issues.length ? '\n' + issues.join('\n') : 'none');
const runs = P.filter(p => p.res && p.opType === 'run' && !p.pre.pat && p.res.type !== 'inc'), passes = P.filter(p => p.res && p.opType === 'pass' && !p.pre.pat);
const avg = a => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : '-';
const caught = passes.filter(p => p.res.airYds != null && !p.res.sack);
console.log(`\nruns n=${runs.length} ypc ${avg(runs.map(p => p.res.yards))}  yds after contact ${avg(runs.filter(p => p.res.contactYd != null).map(p => p.res.yards - p.res.contactYd))}  broken/run ${avg(runs.map(p => p.res.broken))}  bounces/run ${avg(runs.map(p => p.res.bounces))}`);
console.log(`passes n=${passes.length} comp ${caught.length} sacks ${passes.filter(p => p.res.sack).length} inc ${passes.filter(p => p.res.type === 'inc').length} ints ${passes.filter(p => p.res.to === 'int').length} yds/att ${avg(passes.map(p => p.res.sack ? 0 : p.res.yards))}  YAC ${avg(caught.map(p => p.res.yards - p.res.airYds))}  broken/catch ${avg(caught.map(p => p.res.broken))}`);
console.log('max speeds', P.filter(p => p.res).map(p => p.maxSpd).sort((a, b) => b - a).slice(0, 6).join(','), ' teleport plays', P.filter(p => p.teleports).length, ' ball-off-hand plays (>1m)', P.filter(p => p.ballOff > 0).length, 'max', Math.max(...P.map(p => p.ballOffMax || 0)));
console.log('anomalies', JSON.stringify(D.mon.anomalies.slice(0, 30)));
console.log('notes', D.notes.join('\n  '));
console.log('final card:', D.finalTxt.replace(/\n+/g, ' | ').slice(0, 600));
console.log('bubble taps', JSON.stringify(D.tapStats), '| kick anims', (D.kicks || []).map(k => k.kind + ' ' + k.real + 's').join(', '));
console.log('stage log tail', D.mon.log.slice(-8).map(x => `${x.stage}@Q${x.q} ${x.clock} ${x.ban}`).join(' / '));
