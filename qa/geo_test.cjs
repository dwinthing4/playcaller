// Geography + travel + city weather test (headless): every team has a home, travel costs are sane, weather follows the climate.
// run: node tools/build.mjs && node qa/geo_test.cjs
const path = require('path');
const vm = require('vm'), fs = require('fs');
const code = fs.readFileSync(path.join(__dirname, '..', 'dist', 'sim.cjs'), 'utf8');
const ctx = { module: { exports: {} }, console, Math, Date, JSON }; vm.createContext(ctx);
vm.runInContext(code + '\n;globalThis.__g = { L: () => L, VENUE, geoTeam, geoTravel, geoTravelEdge, geoTrips, geoCollege, geoHome, geoPipeline, geoDate, GEO_CITY, R_CITIES, scoutTrips: typeof scoutTrips === "function" ? scoutTrips : null };', ctx);
const G = ctx.__g; let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };
const LG = ctx.module.exports.LG;
for (const real of [false, true]) {
  LG.newLeague({ diff: 'pro', qlen: 120, real }); LG.chooseTeam(3, 'Geo Coach'); const L = G.L();
  console.log(`\n=== ${real ? 'real cities' : 'fictional'} league ===`);
  for (const t of L.teams) { const p = G.geoTeam(t); ok(p && isFinite(p.lat) && isFinite(p.lon) && p.tz, 'home for ' + t.city); }
  if (!real) ok(L.teams.every(t => G.GEO_CITY[t.city] && !G.GEO_CITY[t.city][13]), 'fictional cities are all whole names');
  // travel: every road game of every team
  let worst = 0, sum = 0, n = 0, body = 0;
  for (const t of L.teams) for (const tr of G.geoTrips(t.id)) { worst = Math.max(worst, tr.t.cost); sum += tr.t.cost; n++; if (tr.t.bodyClock) body++; ok(tr.t.cost >= 0 && tr.t.cost <= 0.06, 'cost range'); }
  console.log(`road games ${n}, mean stamina cost ${(sum / n * 100).toFixed(2)}%, worst ${(worst * 100).toFixed(1)}%, body-clock games ${body}`);
  // sample trips
  const byCity = c => L.teams.find(t => G.geoTeam(t).name === c || t.city === c);
  const pairs = real ? [['Seattle', 'Miami Gardens'], ['Philadelphia', 'East Rutherford'], ['Kansas City', 'Denver'], ['Inglewood', 'Foxborough']] : [['Portland', 'Hartford'], ['Columbus', 'Toledo'], ['Honolulu', 'Montreal'], ['Mobile', 'Albuquerque']];
  for (const [a, b] of pairs) { const A = byCity(a), B = byCity(b); if (!A || !B) { console.log('missing', a, b); continue; }
    for (const slot of ['early', 'late', 'snf']) { const g = { h: B.id, a: A.id, slot, wk: 3 }; const t = G.geoTravel(g, A.id);
      console.log(`${A.city} at ${B.city} (${slot}): ${t.miles} mi, tz ${t.tz}, kick ${t.kick.toFixed(1)} local, body ${t.body.toFixed(1)}, cost ${(t.cost * 100).toFixed(1)}%, drain ${t.drain.toFixed(3)}, edge ${G.geoTravelEdge(g, A.id).toFixed(2)}`); } }
  // weather by city and week: count snow / rain / dome / heat over the season for a few teams
  const wx = (T, wk) => { const lg = Object.assign({}, L, { week: wk, phase: 'regular' }); return G.VENUE.today(T, lg, null, { h: T.id, a: (T.id + 1) % 32, slot: 'early' }); };
  for (const T of L.teams.slice(0, 32)) {
    let snow = 0, rain = 0, dome = 0, hot = 0, cold = 0, temps = [];
    for (let y = 0; y < 6; y++) for (let wk = 0; wk < 17; wk++) { const lg = Object.assign({}, L, { week: wk, phase: 'regular', year: 2026 + y }); const w = G.VENUE.today(T, lg, null, { h: T.id, a: 0, slot: 'early' });
      if (w.weather === 'snow') snow++; if (w.weather === 'rain') rain++; if (w.dome) dome++; if (w.temp >= 85) hot++; if (w.temp <= 32) cold++; if (y === 0) temps.push(w.dome ? 'D' : w.temp); }
    const p = G.geoTeam(T), v = G.VENUE.of(T);
    console.log(`${(p.name + ' ' + p.st).padEnd(22)} ${v.stadium.padEnd(9)} ${v.roof.padEnd(7)} ${v.surface.padEnd(5)} alt ${String(p.alt).padStart(4)} | snow ${String(snow).padStart(2)} rain ${String(rain).padStart(2)} dome ${String(dome).padStart(3)} hot ${String(hot).padStart(2)} cold ${String(cold).padStart(2)} | ${temps.join(' ')}`);
    if (p.roof === 'dome') ok(dome === 102, 'fixed dome always closed ' + p.name);
    if (p.lat < 31 && p.roof === 'open') ok(snow === 0, 'no snow in the deep south ' + p.name);
  }
}
// colleges and hometowns
const cols = ['Bayou A&M', 'Desert State', 'Lakeshore Tech', 'Coastal University', 'State College', 'Prairie State', 'Mountain Tech', 'Harbor College'];
for (const c of cols) { const x = G.geoCollege(c); console.log(c.padEnd(20), x.town + ', ' + x.st, x.region); ok(x.lat && x.region, 'college ' + c); }
const L = G.L(); const pl = Object.values(L.P).slice(0, 2000), pipe = G.geoPipeline(pl, 'home');
console.log('hometown states (top 10):', Object.entries(pipe.st).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e.join(' ')).join(', '));
const draft = L.draft.map(id => L.P[id]); const cp = G.geoPipeline(draft, 'col');
console.log('draft class by region:', JSON.stringify(cp.region), 'colleges', Object.keys(cp.col).length);
// scouting trips: calendar, budget, a trip that files reports, a region move
{
  const T = LG._t, S = T.scoutTrips(), L = G.L();
  ok(S && S.ev.length > 20, 'scouting calendar has events (' + (S && S.ev.length) + ')');
  console.log('budget $' + S.budget + 'k; events:', S.ev.length, 'e.g.', S.ev.slice(0, 3).map(e => `wk${e.wk === 'post' ? 'post' : e.wk + 1} ${e.name} @ ${e.town}, ${e.st} (${e.ids.length} prospects)`).join(' | '));
  ok(L.draft.every(id => { const p = L.P[id]; return p.region === G.geoCollege(p.col).region; }), 'prospect region = college region');
  const s = L.scouts[0], ev = S.ev.find(e => e.wk === L.week && e.ids.length), r = T.scoutSend(ev.id, s.id); ok(r.ok, 'send scout: ' + r.msg);
  const spent = S.spent; ok(spent > 0 && spent < 20, 'trip cost ' + spent);
  const r2 = T.scoutSend(S.ev.find(e => e.wk === L.week && e !== ev).id, s.id); ok(!r2.ok, 'one trip a week: ' + r2.msg);
  const tgt = (L.scouts[1].region === 'Southwest' ? 'Midwest' : 'Southwest'); ok(T.scoutMove(L.scouts[1].id, tgt).ok, 'move');
  const before = ev.ids.map(id => (L.P[id].sc ? L.P[id].sc.lvl : 0));
  const g = LG.currentUserGame(); if (g) LG.instantUserGame(); else LG.simWeek();
  const after = ev.ids.map(id => (L.P[id].sc ? L.P[id].sc.lvl : 0));
  ok(ev.done && after.filter((v, i) => v > before[i]).length >= Math.min(12, ev.ids.length), `trip reports filed (${before.join(',')} -> ${after.join(',')})`);
  ok(L.scouts[1].region === tgt && !L.scouts[1].moveTo, 'region move took effect');
  ok(L.inbox.some(m => m.title === 'Scouting trips'), 'trip inbox message');
  // a whole season: every event settles by the offseason
  LG.simToPlayoffs(); let k = 0; while (L.phase === 'playoffs' && k++ < 10) { if (LG._t.userPlayoffGame()) LG.instantUserGame(); else LG.simPlayoffRound(); }
  const post = S.ev.find(e => e.wk === 'post'); ok(post && !T.scoutEvOpen(post), 'all-star games closed after the playoffs');
  LG.offseasonNext(); ok(S.ev.every(e => e.done), 'all events settled at the first offseason report');
}
console.log(fails ? `${fails} FAILURES` : 'geo test passed');
process.exit(fails ? 1 : 0);
