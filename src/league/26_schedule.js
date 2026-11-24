// Season schedule: 17 games per team over 18 weeks, one bye each (weeks 5-14), the pro rotation for opponents:
//   6 division games (home and away), 4 vs a division of the own conference (3-year rotation), 4 vs a division of the other
//   conference (4-year rotation), 2 vs the same-place finishers of the other two own-conference divisions, 1 vs a same-place
//   finisher of another division in the other conference.
// Every game has a time slot g.slot: 'early' | 'late' | 'tnf' | 'snf' | 'mnf' | 'thanksgiving' | 'intl'; international games are
// at a neutral site (g.neutral = 1, g.site = city). Thanksgiving is week 12. The Map helper reads g.slot / g.site / g.neutral.
// How it is built: 17 "rounds" (each a full set of 16 games, every team once); the 10 bye weeks each play a round minus 1-3 games,
// and the games those byes knock out make up one extra week (each team is in exactly one of them), so 17 rounds + 1 = 18 weeks.
const SCHED_WEEKS = 18, SCHED_BYE0 = 4, SCHED_BYE1 = 13, SCHED_TG = 11;
const SCHED_SITES = [['São Paulo', 0, 1], ['London', 3, 6], ['London', 5, 8], ['Munich', 8, 10], ['Mexico City', 9, 11]];
const SCHED_SLOT = { early: 'Sunday', late: 'Sunday late', tnf: 'Thursday night', snf: 'Sunday night', mnf: 'Monday night', thanksgiving: 'Thanksgiving', intl: 'International' };
function slotLabel(g) { if (!g || !g.slot) return ''; return g.slot === 'intl' && g.site ? g.site : SCHED_SLOT[g.slot] || ''; }
function slotTag(g) { if (!g || !g.slot) return ''; if (g.slot === 'intl') return g.site || 'International'; if (g.slot === 'thanksgiving') return 'Thanksgiving'; if (g.slot === 'tnf' || g.slot === 'snf' || g.slot === 'mnf') return 'Primetime'; return ''; }
function schedWeeks() { return (L && L.sched && L.sched.length) || SCHED_WEEKS; }
function byeWeek(tid, sched) { const S = sched || L.sched || []; for (let w = 0; w < S.length; w++) if (S[w].length && !S[w].some(g => g.h === tid || g.a === tid)) return w; return -1; }

function makeSchedule() {
  const ok = L.teams.length === 32 && ['A', 'N'].every(c => DIVS.every(d => L.teams.filter(t => t.conf === c && t.div === d).length === 4));
  if (ok) for (let k = 0; k < 30; k++) { const s = schedTry(); if (s) { L.sched = s; schedSlots(); return; } }
  schedRandom();
}
// previous season's finish inside the division (rank 0 = 1st): last history row, else team quality
function schedDivOrder(c, d) {
  const ts = L.teams.filter(t => t.conf === c && t.div === d), last = t => (t.hist || []).filter(h => h.y < L.year).slice(-1)[0];
  const sc = t => { const h = last(t); return h ? (h.w + h.t * 0.5) / Math.max(1, h.w + h.l + h.t) + (h.pf - h.pa) / 4000 : teamOvr(t) / 100; };
  return ts.sort((a, b) => sc(b) - sc(a)).map(t => t.id);
}
function schedTry() {
  const y = L.year, D = { A: DIVS.map(d => schedDivOrder('A', d)), N: DIVS.map(d => schedDivOrder('N', d)) };
  const K4 = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]], pi = y % 3, rounds = [];
  // division: 3 rounds, then the rematches (home flipped)
  const first = [];
  for (let r = 0; r < 3; r++) { const games = []; for (const c of ['A', 'N']) for (let d = 0; d < 4; d++) for (const [i, j] of K4[r]) { const a = D[c][d][i], b = D[c][d][j], hm = R() < 0.5; games.push({ h: hm ? a : b, a: hm ? b : a, dv: 1 }); } rounds.push(games); first.push(games); }
  for (let r = 0; r < 3; r++) rounds.push(first[r].map(g => ({ h: g.a, a: g.h, dv: 1 })));
  // a division of the own conference (all four), a division of the other conference (all four)
  for (let k = 0; k < 4; k++) { const games = []; for (const c of ['A', 'N']) for (const [da, db] of K4[pi]) for (let i = 0; i < 4; i++) games.push({ h: D[c][da][i], a: D[c][db][(i + k) % 4] }); rounds.push(games); }
  for (let k = 0; k < 4; k++) { const games = []; for (let d = 0; d < 4; d++) for (let i = 0; i < 4; i++) games.push({ h: D.A[d][i], a: D.N[(d + y) % 4][(i + k) % 4] }); rounds.push(games); }
  // same-place games: the two other own-conference divisions, then one other-conference division
  for (const pj of [(pi + 1) % 3, (pi + 2) % 3]) { const games = []; for (const c of ['A', 'N']) for (const [da, db] of K4[pj]) for (let i = 0; i < 4; i++) games.push({ h: D[c][da][i], a: D[c][db][i] }); rounds.push(games); }
  { const games = []; for (let d = 0; d < 4; d++) for (let i = 0; i < 4; i++) games.push({ h: D.A[d][i], a: D.N[(d + y + 2) % 4][i] }); rounds.push(games); }
  // home/away for the non-division games: 8 or 9 home games each
  const home = {}; for (const t of L.teams) home[t.id] = 3; const nd = shuffle(rounds.flat().filter(g => !g.dv));
  for (const g of nd) { const a = g.h, b = g.a; if (home[a] > home[b] || (home[a] === home[b] && R() < 0.5)) { g.h = b; g.a = a; } home[g.h]++; }
  // repair: flip a chain of games from a team with too many home games to one with too few (only the two ends change)
  for (let it = 0; it < 64; it++) {
    const ids = L.teams.map(t => t.id), src = ids.find(id => home[id] > 9) ?? (ids.some(id => home[id] < 8) ? ids.find(id => home[id] === 9) : null); if (src == null) break;
    const dstOk = id => id !== src && (home[id] < 8 || (home[src] > 9 && !ids.some(x => home[x] < 8) && home[id] === 8));
    const prev = { [src]: null }, q = [src]; let dst = null;
    while (q.length && dst == null) { const u = q.shift(); for (const g of nd) if (g.h === u && !(g.a in prev)) { prev[g.a] = g; if (dstOk(g.a)) { dst = g.a; break; } q.push(g.a); } }
    if (dst == null) break; for (let v = dst; prev[v]; ) { const g = prev[v]; const u = g.h; g.h = g.a; g.a = u; v = u; } home[src]--; home[dst]++;
  }
  // rounds into weeks: one week (after the byes) is the extra week; a division round closes the season
  // (first division meetings in the first half, the rematches in the second half)
  const E = ri(14, 16), weeks = [...Array(SCHED_WEEKS).keys()].filter(w => w !== E), nW = weeks.length, ord = new Array(nW).fill(-1);
  const dm = shuffle([0, 1, 2]), firstAt = shuffle([...Array(8).keys()]).slice(0, 3), reAt = shuffle([9, 10, 11, 12, 13, 14, 15]).slice(0, 2).concat([nW - 1]);
  dm.forEach((r, i) => { ord[firstAt[i]] = r; }); shuffle([3, 4, 5]).forEach((r, i) => { ord[reAt[i]] = r; });
  const others = shuffle([...Array(11).keys()].map(i => i + 6)); for (let k = 0; k < nW; k++) if (ord[k] < 0) ord[k] = others.pop();
  const roundAt = {}; weeks.forEach((w, k) => { roundAt[w] = ord[k]; });
  const partner = (r, tid) => { for (const g of rounds[r]) { if (g.h === tid) return g.a; if (g.a === tid) return g.h; } return null; };
  // byes: each team's bye pairs him with his opponent of that week's round (both sit), 1-3 games out per bye week
  const byeW = []; for (let w = SCHED_BYE0; w <= SCHED_BYE1; w++) byeW.push(w);
  const asg = {}, cnt = {}; for (const w of byeW) cnt[w] = 0; let steps = 0; const order = shuffle(L.teams.map(t => t.id));
  const dfs = () => {
    if (++steps > 6000) return false; const t = order.find(id => asg[id] == null); if (t == null) return byeW.every(w => cnt[w] >= 1);
    const ws = shuffle(byeW.slice()).sort((a, b) => cnt[a] - cnt[b]);
    for (const w of ws) { if (cnt[w] >= 3) continue; const u = partner(roundAt[w], t); if (u == null || asg[u] != null) continue; asg[t] = asg[u] = w; cnt[w]++; if (dfs()) return true; asg[t] = asg[u] = null; cnt[w]--; }
    return false;
  };
  if (!dfs()) return null;
  const sched = []; const extra = [];
  for (let w = 0; w < SCHED_WEEKS; w++) {
    if (w === E) { sched.push(null); continue; }
    const games = []; for (const g of rounds[roundAt[w]]) { const out = { h: g.h, a: g.a, done: false }; if (asg[g.h] === w && asg[g.a] === w) extra.push(out); else games.push(out); } sched.push(games);
  }
  sched[E] = extra;
  // checks: 17 games each, one bye in weeks 5-14, never the same opponent two weeks running
  const last = {};
  for (let w = 0; w < SCHED_WEEKS; w++) { const seen = new Set(); for (const g of sched[w]) { if (seen.has(g.h) || seen.has(g.a)) return null; seen.add(g.h); seen.add(g.a);
      const k = Math.min(g.h, g.a) + '-' + Math.max(g.h, g.a); if (last[k] != null && w - last[k] < 2) return null; last[k] = w; }
    if (seen.size !== 32 && (w < SCHED_BYE0 || w > SCHED_BYE1)) return null; }
  return sched;
}
// fallback (unusual league shapes): random pairings, 17 weeks, no byes
function schedRandom() {
  L.sched = []; const n = L.teams.length; const met = {};
  for (let w = 0; w < 17; w++) {
    let best = null;
    for (let tries = 0; tries < 60; tries++) {
      const ids = shuffle([...Array(n).keys()]); const games = []; let bad = 0; const used = new Set();
      for (const a of ids) { if (used.has(a)) continue;
        let b = ids.find(x => x !== a && !used.has(x) && !met[a + '-' + x] && L.teams[x].div === L.teams[a].div && L.teams[x].conf === L.teams[a].conf && w < 6);
        if (b === undefined) b = ids.find(x => x !== a && !used.has(x) && !met[a + '-' + x]);
        if (b === undefined) { b = ids.find(x => x !== a && !used.has(x)); bad++; }
        if (b === undefined) break;
        used.add(a); used.add(b); games.push(R() < .5 ? { h: a, a: b } : { h: b, a: a }); }
      if (games.length === Math.floor(n / 2) && (!best || bad < best.bad)) best = { games, bad };
      if (best && best.bad === 0) break;
    }
    for (const g of best.games) { met[g.h + '-' + g.a] = met[g.a + '-' + g.h] = 1; g.done = false; g.slot = 'early'; }
    L.sched.push(best.games);
  }
}
// ---------- time slots ----------
function schedTgHosts() {
  if (L.tgHosts && L.tgHosts.every(id => L.teams[id])) return L.tgHosts;
  const byCity = c => L.teams.find(t => t.city === c); const real = [byCity('Detroit'), byCity('Dallas')].filter(Boolean);
  L.tgHosts = real.length === 2 ? real.map(t => t.id) : shuffle(L.teams.map(t => t.id)).slice(0, 2); return L.tgHosts;
}
// the host gained a home game and his guest lost one: hand one of the host's other home games to a team that has room
function schedSwapHome(id, o, keep) { const all = L.sched.flat(), hc = t => all.filter(g => g.h === t && !g.neutral).length;
  const g = all.find(x => x !== keep && x.h === id && !x.neutral && L.teams[x.a] && (L.teams[x.a].div !== L.teams[id].div || L.teams[x.a].conf !== L.teams[id].conf) && hc(x.a) < 9 && L.sched.findIndex(w => w.includes(x)) !== SCHED_TG);
  if (g && hc(id) > 9) { g.h = g.a; g.a = id; } }
function schedSlots() {
  const S = L.sched, star = t => teamOvr(t) + ((t.hist || []).slice(-1)[0] ? (t.hist.slice(-1)[0].w - 8) * 0.8 : 0) + (t.id === L.user ? 2 : 0), prime = {};
  const pairStar = g => star(L.teams[g.h]) + star(L.teams[g.a]) + gauss() * 4 - ((prime[g.h] || 0) + (prime[g.a] || 0)) * 6;
  const champ = (L.champs || []).filter(c => c.y === L.year - 1).map(c => c.t)[0];
  for (const wk of S) for (const g of wk) g.slot = R() < 0.62 ? 'early' : 'late';
  // Thanksgiving: the two traditional hosts at home, plus a night game
  const tgw = S[SCHED_TG]; if (tgw) { const hosts = schedTgHosts(); let n = 0;
    for (const id of hosts) { const g = tgw.find(x => x.h === id || x.a === id); if (!g || g.slot === 'thanksgiving') continue; if (g.a === id) { const o = g.h; g.a = o; g.h = id; schedSwapHome(id, o, g); } g.slot = 'thanksgiving'; n++; }
    const rest = tgw.filter(g => g.slot !== 'thanksgiving').sort((a, b) => pairStar(b) - pairStar(a)); for (let i = 0; i < 3 - n && i < rest.length; i++) rest[i].slot = 'thanksgiving'; }
  // international games at neutral sites
  const sites = SCHED_SITES.filter((s, i) => i < 3 || R() < 0.5).slice(0, ri(2, 4)), abroad = new Set();
  for (const [site, w0, w1] of sites) { for (let k = 0; k < 8; k++) { const w = ri(w0, w1), c = (S[w] || []).filter(g => g.slot !== 'thanksgiving' && !g.neutral && !abroad.has(g.h) && !abroad.has(g.a)); if (!c.length) continue;
    const g = pick(c); g.slot = 'intl'; g.neutral = 1; g.site = site; abroad.add(g.h); abroad.add(g.a); break; } }
  // primetime: Thursday (not the last week), Sunday night, Monday night: the best matchups, spread around the league
  S.forEach((wk, w) => {
    const open = () => wk.filter(g => g.slot === 'early' || g.slot === 'late');
    const take = slot => { const c = open(); if (!c.length) return; let g = c.sort((a, b) => pairStar(b) - pairStar(a))[0];
      if (slot === 'tnf' && w === 0 && champ != null) g = c.find(x => x.h === champ || x.a === champ) || g;
      g.slot = slot; prime[g.h] = (prime[g.h] || 0) + 1; prime[g.a] = (prime[g.a] || 0) + 1; };
    if (w !== SCHED_TG && w < S.length - 1) take('tnf'); take('snf'); if (w < S.length - 1) take('mnf');
  });
}
