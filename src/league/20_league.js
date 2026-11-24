// League core: creation, teams, depth charts, schedule, fast sim, standings, playoffs, awards.
let L = null;   // the league in play
function UT() { return L.teams[L.user]; }
function teamName(t) { return teamLabel(t); }
function news(s) { L.news.unshift({ y: L.year, w: L.week, s }); if (L.news.length > 120) L.news.pop(); }
// inbox: messages from staff, scouts, owner, league. actions are {label, act, arg} run by the UI through LG.act()
function inbox(from, title, body, opt = {}) {
  L.inbox = L.inbox || [];
  const m = Object.assign({ id: nid(), y: L.year, w: L.week, from, title, body, read: false, actions: [] }, opt);
  L.inbox.unshift(m); if (L.inbox.length > 80) L.inbox.length = 80; return m;
}
function genCoach() { const nm = rname(); const lk = genLook('QB'); lk.hb = 0; lk.ey = 0; lk.vz = 0;
  return { fn: nm.fn, ln: nm.ln, age: ri(38, 64), off: ri(3, 8), def: ri(3, 8), dev: ri(3, 8), mot: ri(3, 8), mgmt: ri(3, 8), w: 0, l: 0, t: 0, pw: 0, pl: 0, titles: 0, seasons: 0, pts: 0, xp: 0, lk, tenure: ri(0, 6), hist: [], hl: [], sal: Math.round(rnd(4, 9) * 10) / 10, yrs: ri(2, 5) }; }
function contrastTrim(c1) { const opts = R_TRIMS.filter(t => Math.abs(lum(t) - lum(c1)) > 0.35); return pick(opts.length ? opts : ['#ffffff']); }
function lum(hex) { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function shade(hex, f) { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
function genTeam(i, def) {
  const t = { id: i, abbr: def.abbr, city: def.city, name: def.name, conf: def.conf, div: def.div, c1: def.c1, c2: def.c2,
    roster: [], depth: {}, offStyle: pick(Object.keys(OFF_STYLES)), defStyle: pick(Object.keys(DEF_STYLES)),
    traits: shuffle(Object.keys(TEAM_TRAITS)).slice(0, ri(1, 2)), coach: genCoach(),
    owner: { fn: pick(FN), ln: pick(LN), patience: ri(3, 9) }, ownerSup: 60, fanSup: ri(45, 75), fanBase: 55,
    w: 0, l: 0, tie: 0, pf: 0, pa: 0, dw: 0, cw: 0, dead: 0, picks: [], q: def.q ?? ri(64, 82), hist: [], streak: 0, fac: { train: 1, weight: 1, film: 1, sc: 1 }, pcs: {} };
  for (const pos of POS_LIST) for (let k = 0; k < POS_COUNTS[pos]; k++) {
    const dp = k === 0 ? 6 : k === 1 ? -1 : k === 2 ? -7 : -11;
    const q = clamp(t.q + dp + gauss() * 7.5 + (R() < 0.08 ? rnd(4, 10) : 0), 38, 97);
    const p = genPlayer(pos, q); setContract(p); p.tid = t.id; L.P[p.id] = p; t.roster.push(p.id);
  }
  const pay = sum(t.roster.map(id => L.P[id].sal)); const f = CAP * rnd(.84, .96) / pay;
  for (const id of t.roster) { const p = L.P[id]; p.sal = Math.max(0.9, Math.round(p.sal * f * 10) / 10); p.base = p.sal; }
  fixDepth(t, true); assignNumbers(t);
  return t;
}
function assignNumbers(t) { const used = new Set(); for (const id of t.roster) { const p = L.P[id]; if (p.num && !used.has(p.num)) { used.add(p.num); continue; } const r = JERSEY[p.pos]; let n, tries = 0; do { n = ri(r[0], r[1]); tries++; } while (used.has(n) && tries < 40); if (used.has(n)) { n = 1; while (used.has(n)) n++; } p.num = n; used.add(n); } }
// ---------- depth chart ----------
function fixDepth(t, sortAll) {
  for (const pos of POS_LIST) {
    let cur = (t.depth[pos] || []).filter(id => t.roster.includes(id) && L.P[id] && L.P[id].pos === pos);
    const rest = t.roster.filter(id => L.P[id].pos === pos && !cur.includes(id));
    cur = cur.concat(rest.sort((a, b) => L.P[b].ovr - L.P[a].ovr)); if (sortAll) cur.sort((a, b) => L.P[b].ovr - L.P[a].ovr);
    t.depth[pos] = cur;
  }
}
function available(id) { const p = L.P[id]; return p && !(p.inj > 0) && !p.holdout && !p.redshirt; }
function depthPick(t, pos, idx, used) {
  // the idx-th healthy player on the depth chart (players already on the field are skipped, but they still count for the order: WR2 is the 2nd WR, not the 3rd)
  used = used || new Set(); const c = (t.depth[pos] || []).filter(id => available(id));
  for (let i = idx; i < c.length; i++) if (!used.has(c[i])) return c[i];
  for (let i = Math.min(idx, c.length) - 1; i >= 0; i--) if (!used.has(c[i])) return c[i];
  for (const fp of FALLBACK[pos] || []) { const fl = (t.depth[fp] || []).filter(id => !used.has(id) && available(id)); if (fl.length) return fl[fl.length - 1]; }
  const any = t.roster.filter(id => !used.has(id) && available(id)); return any[0] ?? t.roster.find(id => !used.has(id));
}
// the base lineup for a formation: depth chart + player roles (where each receiver lines up). Per-snap rotation: teamLineup in 25_rotation.js
function starters(t, formKey, side) { return teamLineup(t, formKey, side, null, null); }
function starterIds(T) { const out = new Set(); const take = (pos, n) => (T.depth[pos] || []).slice(0, n).forEach(id => out.add(id)); take('QB', 1); take('RB', 1); take('WR', 3); take('TE', 1); take('OT', 2); take('OG', 2); take('C', 1); take('DE', 2); take('DT', 2); take('LB', 3); take('CB', 3); take('S', 2); take('K', 1); take('P', 1); return out; }
function teamPower(t) {
  const top = (pos, n) => { const ids = (t.depth[pos] || []).filter(id => available(id)).slice(0, n); const v = ids.map(id => L.P[id].ovr); while (v.length < n) v.push(45); return v; };
  const qb = top('QB', 1)[0]; const off = (qb * 3 + sum(top('WR', 3)) + sum(top('TE', 1)) + sum(top('RB', 1)) + sum(top('OT', 2)) + sum(top('OG', 2)) + sum(top('C', 1))) / 14;
  const def = (sum(top('DE', 2)) + sum(top('DT', 2)) + sum(top('LB', 3)) * 0.9 + sum(top('CB', 3)) + sum(top('S', 2))) / 11.7;
  const c = t.coach; const oc = t.oc ? (t.oc.r - 5) * 0.4 : 0, dc = t.dc ? (t.dc.r - 5) * 0.4 : 0;
  const mor = t.morale != null ? (t.morale - 60) / 15 : 0;
  return { off: off + (c.off - 5) * 0.6 + oc + mor, def: def + (c.def - 5) * 0.6 + dc + mor, ovr: Math.round(off * 0.55 + def * 0.45) };
}
function teamOvr(t) { return teamPower(t).ovr; }
function expectFor(t) { const ranked = L.teams.slice().sort((a, b) => teamOvr(b) - teamOvr(a)); return Math.round(clamp(13 - ranked.indexOf(t) * 0.3, 4, 13)); }

// ---------- league creation ----------
function newLeague(opts) {
  UID = 1;
  L = { v: 3, diff: opts.diff || 'pro', qlen: opts.qlen || 120, year: 2026, week: 0, phase: 'regular', off: null, user: opts.team ?? 0,
    P: {}, teams: [], fa: [], draft: [], sched: [], results: [], news: [], inbox: [], playoff: null, plays: buildPlaybook(), champs: [], awards: [],
    draftOrder: [], draftPick: 0, rel: {}, coachHist: [], offers: [], settings: { sound: true, haptics: true, theme: 'stadium', tags: true, view: 'auto' },
    rec: { mine: {}, lg: {} }, recQ: {}, hof: [], lhist: [], lhof: [], ach: {}, unis: {}, uid: 0, picking: true };
  const cities = shuffle(R_CITIES.slice()), masc = shuffle(R_MASCOTS.slice()), cols = shuffle(R_COLORS.slice());
  const usedAbbr = new Set(); L.real = !!opts.real;
  if (L.real) REAL_TEAMS.forEach((d, i) => { const t = genTeam(i, { conf: d[2], div: d[3], abbr: d[0], city: d[1], name: d[1], c1: d[4], c2: d[5], q: d[7] }); t.hel = d[6]; t.logo = { v: 2, sh: d[9], icon: d[8], st: i % 3 }; L.teams.push(t); });
  for (let i = 0; i < (L.real ? 0 : 32); i++) {
    const conf = i < 16 ? 'A' : 'N', div = DIVS[Math.floor((i % 16) / 4)];
    let ab = cities[i].replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(); if (usedAbbr.has(ab)) ab = (cities[i][0] + masc[i].slice(0, 2)).toUpperCase(); usedAbbr.add(ab);
    L.teams.push(genTeam(i, { conf, div, abbr: ab, city: cities[i], name: masc[i], c1: cols[i], c2: contrastTrim(cols[i]), q: ri(62, 84) }));
  }
  for (const t of L.teams) { for (let y = 0; y < 2; y++) for (let r = 1; r <= 7; r++) t.picks.push({ y: L.year + 1 + y, r, from: t.id }); L.rel[t.id] = ri(42, 60); }
  for (let i = 0; i < 70; i++) { const p = genPlayer(pick(POS_LIST.filter(x => x !== 'K' && x !== 'P')), rnd(48, 70), ri(24, 33)); setContract(p); p.sal = Math.max(0.9, Math.round(p.sal * .8 * 10) / 10); p.ask = p.sal; L.P[p.id] = p; L.fa.push(p.id); }
  ensureStaffAll(); genDraftClass(); makeSchedule();
  L.uid = UID; return L;
}
function chooseTeam(id, coachName) {
  L.user = id; L.picking = false; const T = UT();
  if (coachName && coachName.trim()) { const parts = coachName.trim().split(/\s+/); T.coach.fn = parts[0]; T.coach.ln = parts.slice(1).join(' '); }
  Object.assign(T.coach, { off: 5, def: 5, dev: 5, mot: 5, mgmt: 5, pts: 3, w: 0, l: 0, t: 0, pw: 0, pl: 0, titles: 0, seasons: 0, tenure: 0, age: ri(34, 44), hist: [], hl: [], sal: 4.5, yrs: 4 });
  T.expect = expectFor(T); T.ownerSup = 60;
  L.news = []; L.inbox = [];
  news(`You're the new head coach of the ${teamName(T)}. The owner expects about ${T.expect} wins.`);
  ensureStaffAll(); ensureUserStaff(); seasonGoals(T);
  ownerIntro(); gmIntro(); scoutsIntro();
  L.myOBook = STYLE2BOOK[T.offStyle] || 'pro'; L.myDBook = STYLE2BOOK[T.defStyle] || 'multi';
  addHighlight(`Hired as head coach of the ${teamName(T)}`);
}
function makeSchedule() {
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
      if (games.length === n / 2 && (!best || bad < best.bad)) best = { games, bad };
      if (best && best.bad === 0) break;
    }
    for (const g of best.games) { met[g.h + '-' + g.a] = met[g.a + '-' + g.h] = 1; g.done = false; }
    L.sched.push(best.games);
  }
}
function userGame(week) { const wk = L.sched[week]; if (!wk) return null; return wk.find(g => g.h === L.user || g.a === L.user) || null; }
function currentUserGame() { return L.phase === 'playoffs' ? userPlayoffGame() : L.phase === 'regular' ? userGame(L.week) : null; }

// ---------- game results: stats, standings ----------
function addStat(pid, k, v) { const p = L.P[pid]; if (!p) return; if (!p.st || !('gp' in p.st)) p.st = blankStats(); p.st[k] = (p.st[k] || 0) + v; }
function poisson(l) { let k = 0, p = 1; const e = Math.exp(-l); do { k++; p *= R(); } while (p > e); return k - 1; }
// every game not played live runs through the play-by-play sim (22_fastsim.js) on the league's quarter length
function simGame(g) {
  const H = L.teams[g.h], A = L.teams[g.a], r = fastGame(g);
  g.hs = r.hs; g.as = r.as; g.done = true; g.bx = r.box;
  const lines = {};
  for (const pid in r.st) { if (!L.P[pid]) continue; lines[pid] = r.st[pid]; for (const k in r.st[pid]) addStat(+pid, k, r.st[pid][k]); }
  for (const T of [H, A]) for (const id of T.roster) if (available(id)) addStat(id, 'gp', 1);
  for (const T of [H, A]) if (T.id === L.user && !L.ghost) { const p = {}; for (const id of T.roster) if (r.snaps[id]) p[id] = r.snaps[id]; const me = T === H ? r.t.h : r.t.a, th = T === H ? r.t.a : r.t.h; T.rotLast = { y: L.year, w: L.week, O: me.plays, D: th.plays, p, live: 0 }; }
  for (const pid in lines) recordGameLine(L.P[pid], lines[pid]);
  finishGame(g, lines);
  return r;
}
function finishGame(g, lines) {
  const H = L.teams[g.h], A = L.teams[g.a];
  H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
  const po = L.phase === 'playoffs';
  if (g.hs > g.as) win(H, A, po); else if (g.as > g.hs) win(A, H, po); else if (!po) { H.tie++; A.tie++; H.coach.t++; A.coach.t++; H.streak = A.streak = 0; }
  // the result row keeps the box score (g.bx is handed over, so a save holds it once); playoff rows know their round
  L.results.push(Object.assign({ y: L.year, w: L.week, po, h: g.h, a: g.a, hs: g.hs, as: g.as }, po && L.playoff ? { rd: L.playoff.round } : {}, g.bx && g.bx.q > 4 ? { ot: 1 } : {}, g.bx ? { bx: g.bx } : {})); delete g.bx;
  glLog(g, lines); histNoteQlen();      // a game-log line for every player who dressed (24_gamelog.js); the quarter length this season
  for (const T of [H, A]) if (T.id === L.user && !L.ghost) userAfterGame(T, g, lines || {});
  // injuries for teams not played live
  if (!g.live) for (const T of [H, A]) if (R() < 0.35) { const id = pick(T.roster); const p = L.P[id]; if (p && !p.inj) { const t = pick(INJ_TYPES); p.inj = Math.max(1, ri(t[1], t[2]) - ((T.fac && T.fac.train || 1) >= 4 ? 1 : 0)); p.injType = t[0]; if (T.id === L.user) { news(`${p.pos} ${p.fn} ${p.ln} injured (${p.injType}, ${p.inj} wk).`); } } }
}
const INJ_TYPES = [['ankle sprain', 1, 3], ['hamstring strain', 1, 4], ['knee sprain', 2, 6], ['shoulder sprain', 1, 4], ['concussion', 1, 3], ['high ankle sprain', 3, 7], ['broken hand', 3, 6]];
function win(W, Lo, po) {
  if (!po) { W.w++; Lo.l++; } W.coach[po ? 'pw' : 'w']++; Lo.coach[po ? 'pl' : 'l']++;
  W.streak = W.streak > 0 ? W.streak + 1 : 1; Lo.streak = Lo.streak < 0 ? Lo.streak - 1 : -1;
  if (!po && W.conf === Lo.conf && W.div === Lo.div) W.dw++; if (!po && W.conf === Lo.conf) W.cw++;
  for (const t of [W, Lo]) for (const co of [t.oc, t.dc]) if (co) { if (t === W) co.w = (co.w || 0) + 1; else co.l = (co.l || 0) + 1; }
}

// ---------- standings & playoffs ----------
function pct(t) { const g = t.w + t.l + t.tie; return g ? (t.w + t.tie * 0.5) / g : 0; }
function sortTeams(arr) { return arr.slice().sort((a, b) => pct(b) - pct(a) || b.dw - a.dw || b.cw - a.cw || (b.pf - b.pa) - (a.pf - a.pa)); }
function divRank(T) { return sortTeams(L.teams.filter(t => t.conf === T.conf && t.div === T.div)).indexOf(T) + 1; }
function seeds(conf) {
  const ts = L.teams.filter(t => t.conf === conf);
  const winners = sortTeams(DIVS.map(d => sortTeams(ts.filter(t => t.div === d))[0]));
  const wc = sortTeams(ts.filter(t => !winners.includes(t))).slice(0, 3);
  return winners.concat(wc).map(t => t.id);
}
const ROUND_NAMES = ['Wild Card', 'Divisional', 'Conference Final', 'Championship'];
function startPlayoffs() {
  L.phase = 'playoffs'; L.playoff = { round: 0, A: seeds('A'), N: seeds('N'), alive: {}, games: [], elim: {} };
  for (const c of ['A', 'N']) for (const id of L.playoff[c]) L.playoff.alive[id] = 1;
  const us = UT(); if (L.playoff.alive[us.id]) news(`Playoffs! You are the #${L.playoff[us.conf].indexOf(us.id) + 1} seed.`); else news('Your season is over. You missed the playoffs.');
  makePlayoffRound();
}
function makePlayoffRound() {
  const P = L.playoff; P.games = [];
  if (P.round < 3) for (const c of ['A', 'N']) { const alive = P[c].filter(id => P.alive[id]); const list = P.round === 0 ? alive.slice(1) : alive; const n = list.length; for (let i = 0; i < n / 2; i++) P.games.push({ h: list[i], a: list[n - 1 - i], done: false }); }
  else { const a = P.A.find(id => P.alive[id]), n = P.N.find(id => P.alive[id]); P.games.push(R() < .5 ? { h: a, a: n, done: false, neutral: 1 } : { h: n, a: a, done: false, neutral: 1 }); }
}
function userPlayoffGame() { if (L.phase !== 'playoffs' || !L.playoff) return null; return L.playoff.games.find(g => !g.done && (g.h === L.user || g.a === L.user)) || null; }
function resolvePlayoffGame(g) { if (g.hs === g.as) { if (R() < .5) g.hs += 3; else g.as += 3; } const loser = g.hs > g.as ? g.a : g.h; L.playoff.alive[loser] = 0; L.playoff.elim[loser] = L.playoff.round; }
function simPlayoffRound() { for (const g of L.playoff.games) if (!g.done) { simGame(g); resolvePlayoffGame(g); } advancePlayoffs(); }
function advancePlayoffs() {
  const P = L.playoff; if (P.games.some(g => !g.done)) return;
  if (P.round === 3) {
    const g = P.games[0]; const champ = g.hs > g.as ? g.h : g.a; const T = L.teams[champ];
    L.champs.push({ y: L.year, t: champ, name: teamName(T) }); T.coach.titles++; news(`${teamName(T)} win the ${L.year} championship!`);
    if (champ === L.user) { T.fanSup = 100; T.coach.pts += 10; addHighlight(`Won the ${L.year} championship 🏆`); }
    beginOffseason(); return;
  }
  P.round++; makePlayoffRound();
}
function awards() {
  const cur = p => p.st && p.st.gp ? p.st : null; const pl = Object.values(L.P).filter(p => p.tid != null && cur(p));
  const mv = p => { const s = cur(p); return p.pos === 'QB' ? (s.py / 25 + s.ptd * 4 - s.pint * 2) * (1 + pct(L.teams[p.tid])) : (s.ry + s.recy) / 12 + (s.rtd + s.rectd) * 5; };
  const mvp = pl.slice().sort((a, b) => mv(b) - mv(a))[0];
  const dpoy = pl.slice().sort((a, b) => { const v = s => s.sk * 4 + s.int * 5 + s.tk * 0.3; return v(cur(b)) - v(cur(a)); })[0];
  const roy = pl.filter(p => p.rookieY === L.year).sort((a, b) => { const v = s => s.py / 25 + s.ptd * 4 + (s.ry + s.recy) / 10 + (s.rtd + s.rectd) * 5 + s.sk * 4 + s.int * 5 + s.tk * 0.3; return v(cur(b)) - v(cur(a)); })[0];
  L.awards.push({ y: L.year, mvp: mvp && mvp.id, dpoy: dpoy && dpoy.id, roy: roy && roy.id });
  if (mvp) news(`MVP: ${mvp.pos} ${mvp.fn} ${mvp.ln} (${L.teams[mvp.tid].abbr}).`);
  if (dpoy) news(`Defensive Player of the Year: ${dpoy.pos} ${dpoy.fn} ${dpoy.ln} (${L.teams[dpoy.tid].abbr}).`);
}
// ---------- records ----------
const REC_KEYS = [['passYdsG', 'Passing yards, game', 'game', 'py'], ['passTdG', 'Passing TDs, game', 'game', 'ptd'], ['rushYdsG', 'Rushing yards, game', 'game', 'ry'], ['recYdsG', 'Receiving yards, game', 'game', 'recy'], ['recG', 'Receptions, game', 'game', 'rec'], ['sackG', 'Sacks, game', 'game', 'sk'], ['intG', 'Interceptions, game', 'game', 'int'], ['tklG', 'Tackles, game', 'game', 'tk'],
  ['passYdsS', 'Passing yards, season', 'season', 'py'], ['passTdS', 'Passing TDs, season', 'season', 'ptd'], ['rushYdsS', 'Rushing yards, season', 'season', 'ry'], ['rushTdS', 'Rushing TDs, season', 'season', 'rtd'], ['recYdsS', 'Receiving yards, season', 'season', 'recy'], ['recTdS', 'Receiving TDs, season', 'season', 'rectd'], ['sackS', 'Sacks, season', 'season', 'sk'], ['intS', 'Interceptions, season', 'season', 'int'], ['tklS', 'Tackles, season', 'season', 'tk']];
// one record book per quarter length (recBook, 95_history.js): a 1-minute-quarter game is not measured against 5-minute ones
function setRec(key, v, p, mix) { if (!v || !p) return; const T = L.teams[p.tid]; const mine = p.tid === L.user && !L.ghost; const ent = { v, pid: p.id, name: p.fn + ' ' + p.ln, pos: p.pos, team: T ? T.abbr : '', y: L.year, w: L.phase === 'playoffs' ? -1 : L.week };
  if (mix) ent.mix = 1; const B = recBook(); if (!B.lg[key] || v > B.lg[key].v) B.lg[key] = ent; if (mine && (!B.mine[key] || v > B.mine[key].v)) B.mine[key] = Object.assign({}, ent); }
function recordGameLine(p, s) { if (!p || !s) return; for (const [key, , kind, stat] of REC_KEYS) if (kind === 'game') setRec(key, s[stat] || 0, p); }
function recordSeasonLines() { for (const id in L.P) { const p = L.P[id]; const s = p.st; if (!s || !s.gp || p.tid == null) continue; for (const [key, , kind, stat] of REC_KEYS) if (kind === 'season') setRec(key, s[stat] || 0, p, histMixed()); } }
function addHighlight(s) { const c = UT().coach; c.hl = c.hl || []; c.hl.unshift({ y: L.year, s }); if (c.hl.length > 40) c.hl.pop(); }
