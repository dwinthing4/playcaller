// Offseason: season review, re-sign, draft, free agency, progression, retirements, new season.
function beginOffseason() {
  const T = UT(), c = T.coach; const before = T.ownerSup;
  recordSeasonLines();
  const champRec = L.champs.length && L.champs[L.champs.length - 1].y === L.year ? L.champs[L.champs.length - 1] : null;
  for (const t of L.teams) {
    const po = L.playoff && L.playoff.elim[t.id] !== undefined ? ROUND_NAMES[L.playoff.elim[t.id]] : (champRec && champRec.t === t.id ? 'Champion' : '-');
    t.hist.push({ y: L.year, w: t.w, l: t.l, t: t.tie, pf: t.pf, pa: t.pa, po }); t.coach.seasons++;
  }
  // league history row
  let ru = null; if (L.playoff && L.playoff.elim) { const mx = Math.max(...Object.values(L.playoff.elim)); const k = Object.keys(L.playoff.elim).find(t => L.playoff.elim[t] === mx); if (k != null) ru = L.teams[k]; }
  awards();
  const aw = L.awards[L.awards.length - 1] || {}; const P = id => { const p = L.P[id]; return p ? `${p.pos} ${p.fn} ${p.ln} (${L.teams[p.tid] ? L.teams[p.tid].abbr : ''})` : '—'; };
  L.lhist.push({ y: L.year, champ: champRec ? champRec.name : '—', ru: ru ? teamName(ru) : '—', mvp: P(aw.mvp), dpoy: P(aw.dpoy), you: `${T.w}-${T.l}` });
  // owner goals and verdict
  const made = !!(L.playoff && (L.playoff.elim[T.id] !== undefined || L.playoff.alive[T.id]));
  const G = seasonGoals(T); const rivalBeat = L.results.some(r => r.y === L.year && !r.po && ((r.h === T.id && r.a === rivalOf(T) && r.hs > r.as) || (r.a === T.id && r.h === rivalOf(T) && r.as > r.hs)));
  let got = 0; for (const g of G.list) { const ok = g.k === 'wins' ? T.w >= g.v : g.k === 'playoffs' ? made : g.k === 'rival' ? rivalBeat : g.k === 'pf' ? T.pf >= g.v : g.k === 'pa' ? T.pa <= g.v : g.k === 'budget' ? capRoom(T) >= 0 : false; g.ok = ok; if (ok) got += g.r; }
  if (!L.ghost) {
    const ten = c.tenure || 0, exp = T.expect || expectFor(T), poR = L.playoff && L.playoff.elim[T.id] !== undefined ? L.playoff.elim[T.id] : -1, champ = champRec && champRec.t === T.id;
    let d = (T.w - exp) * 3.2 + (poR >= 0 ? 6 + poR * 3 : 0) + (champ ? 18 : 0) + got * 1.2; if (ten < 1) d = Math.max(d, -8);
    const op = ownerPersona(T); if (op === 'winnow') d -= 3; if (op === 'patient') d = d < 0 ? d * 0.6 : d;
    T.ownerSup = clamp(before + d, 0, 100);
    let fired = false; if (ten >= 1) { if (T.ownerSup < 18) fired = R() < 0.88; else if (T.ownerSup < 30) fired = R() < 0.35 * (10 - T.owner.patience) / 5; }
    L.fired = fired; T.jobNote = ten < 1 ? 'First season: the owner gave you a pass.' : fired ? '' : T.ownerSup < 30 ? 'You are on the hot seat.' : '';
    c.hist.push({ y: L.year, tid: T.id, w: T.w, l: T.l, t: T.tie, po: champ ? 'Champion' : poR >= 0 ? ROUND_NAMES[poR] : 'Missed' });
    if (fired) { news(`The owner has fired you after a ${T.w}-${T.l} season.`); addHighlight(`Fired by the ${teamName(T)}`); inbox('owner', 'You are fired', `${T.owner.fn} ${T.owner.ln}: "I have to make a change. Thank you for your work." Teams with openings may call.`); }
    else { news(`Season review: ${T.w}-${T.l}${T.tie ? '-' + T.tie : ''}. Owner support ${Math.round(T.ownerSup)}%.`); ownerSeasonReview(T, got); }
    c.tenure = ten + 1; c.pts += got; c.age = (c.age || 45) + 1; if (c.yrs != null) c.yrs--;
    coordSeasonReview(T);
  }
  for (const t of L.teams) if (t.id !== L.user) t.coach.tenure = (t.coach.tenure || 0) + 1;
  T.fanBase = clamp((T.fanBase || 55) * 0.6 + T.fanSup * 0.4, 25, 85);
  L.recap = { y: L.year, w: T.w, l: T.l, t: T.tie, result: champRec && champRec.t === T.id ? 'Champions' : made ? 'Playoffs' : 'Missed playoffs', goals: G.list.map(g => ({ lab: g.lab, ok: g.ok, r: g.r })), creditGoals: got, mvp: aw.mvp, dpoy: aw.dpoy, champ: champRec ? champRec.name : '', seen: false,
    top: T.roster.map(id => L.P[id]).filter(p => p.st && p.st.gp).sort((a, b) => perfScore(b.st) - perfScore(a.st)).slice(0, 4).map(p => p.id) };
  // archive stats
  for (const id in L.P) { const p = L.P[id]; if (p.st && p.st.gp) { p.hist.push(Object.assign({ y: L.year, t: p.tid }, p.st)); for (const k in p.st) p.car[k] = (p.car[k] || 0) + p.st[k]; } p.st = blankStats(); p._snap = {}; p._prevSnap = {}; }
  // draft order: worst first, playoff teams by round
  const elimRound = id => L.playoff.elim[id] === undefined ? (L.playoff.alive[id] ? 5 : -1) : L.playoff.elim[id];
  const order = L.teams.slice().sort((a, b) => elimRound(a.id) - elimRound(b.id) || pct(a) - pct(b) || (a.pf - a.pa) - (b.pf - b.pa)).map(t => t.id);
  L.draftOrder = []; for (let r = 1; r <= 7; r++) for (const tid of order) { const owner = L.teams.find(t => t.picks.some(p => p.y === L.year + 1 && p.r === r && p.from === tid)); L.draftOrder.push({ r, from: tid, owner: owner ? owner.id : tid }); }
  L.draftPick = 0;
  // contracts tick
  for (const t of L.teams) for (const id of t.roster) { const p = L.P[id]; p.yrs--; if (p.prYrs > 0) { p.prYrs--; if (p.prYrs <= 0) p.pr = 0; } if (p.guar > 0) p.guar = Math.round(Math.max(0, p.guar - kBase(p)) * 10) / 10; syncSal(p); }
  coachingCarousel(); if (L.ownerMeet && !L.ownerMeet.done) L.ownerMeet.done = true;
  L.phase = 'offseason'; L.off = 'resign';
  runCombine();
  inbox('gm', 'Offseason plan', gmOffseasonMemo());
}
function perfScore(s) { return (s.py || 0) / 25 + (s.ptd || 0) * 4 + (s.ry || 0) / 10 + (s.rtd || 0) * 6 + (s.recy || 0) / 10 + (s.rectd || 0) * 6 + (s.sk || 0) * 4 + (s.int || 0) * 5 + (s.tk || 0) * 0.5; }
function finishResign() {
  for (const t of L.teams) for (const id of expiring(t)) {
    const p = L.P[id]; if (t.id === L.user && !L.ghost) { if (p.resigned !== L.year) releaseToFA(t, p, false); continue; }
    if (p.age < 31 && p.ovr >= 68 && R() < 0.75) { setDeal(p, askingSalary(p), ri(1, 4), 0.2); } else releaseToFA(t, p, false);
  }
  for (const t of L.teams) ensureCap(t);
  L.off = 'draft'; news('The draft is open.');
}
// ---------- draft ----------
function genDraftClass() {
  for (const id of L.draft || []) delete L.P[id];
  L.draft = [];
  for (let i = 0; i < 270; i++) {
    const pos = pick(['QB', 'QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'TE', 'OT', 'OT', 'OG', 'OG', 'C', 'DE', 'DE', 'DE', 'DT', 'DT', 'LB', 'LB', 'LB', 'CB', 'CB', 'CB', 'S', 'S', 'K', 'P']);
    const arch = draftArchetype(i); let tier = i < 10 ? rnd(72, 80) : i < 40 ? rnd(64, 74) : i < 110 ? rnd(56, 67) : rnd(46, 60);
    if (arch === 'raw') tier -= rnd(5, 10); else if (arch === 'polished') tier += rnd(1, 3); else if (arch === 'gem') tier -= rnd(0, 3);
    const p = genPlayer(pos, tier, arch === 'polished' ? ri(22, 24) : ri(21, 23)); shapeProspect(p, arch); p.ap = null; ensurePot(p);
    p.scoutNoise = gauss() * 5; p.scout = Math.round(clamp(p.ovr + p.scoutNoise, 30, 99)); p.scoutPot = Math.round(clamp(p.pot + p.potNoise, p.scout, 99));
    p.sc = { lvl: 0, rev: [], reports: [], acc: 0 }; p.gnoise = R() < 0.18 ? (R() < .5 ? -1 : 1) : 0; p.draft = true; p.region = pick(SCOUT_REGIONS); p.tid = null;
    L.P[p.id] = p; L.draft.push(p.id);
  }
}
function draftValue(p) { return (p.ovr + (p.scoutNoise || 0) * 0.6) * 0.55 + (p.pot + (p.potNoise || 0) * 0.6) * 0.45 + (p.pos === 'QB' ? 3 : 0) - (p.pos === 'K' || p.pos === 'P' ? 12 : 0); }
function scoutedValue(p) { return (p.scout || p.ovr) * 0.55 + (p.scoutPot || p.pot) * 0.45 + (p.pos === 'QB' ? 3 : 0) - (p.pos === 'K' || p.pos === 'P' ? 12 : 0); }
function gradeStars(p) { const o = p.ovr; const s = o >= 73 ? 5 : o >= 67 ? 4 : o >= 61 ? 3 : o >= 55 ? 2 : 1; return clamp(s + (p.gnoise || 0), 1, 5); }
function scouted(p) { return p.sc && p.sc.lvl >= 1; }
function potKnown(p) { return p.sc && p.sc.lvl >= 2; }
function runCombine() {
  if (L.combineY === L.year) return; L.combineY = L.year;
  for (const id of L.draft) { const p = L.P[id]; if (!p) continue; const a = p.a, n = () => gauss() * 0.6;
    p.comb = { forty: +(4.28 + (99 - a.spd) * 0.021 + n() * 0.05).toFixed(2), vert: Math.round(26 + a.jmp * 0.16 + n() * 2), bench: Math.round(a.str * 0.33 + n() * 2), cone: +(6.55 + (99 - a.agi) * 0.017 + n() * 0.06).toFixed(2), shuttle: +(3.95 + (99 - a.acc) * 0.011 + n() * 0.04).toFixed(2) }; }
  news('The scouting combine is complete. Measurables are posted for every prospect.');
}
function aiDraftPick(t) {
  if (!t.draftStyle) t.draftStyle = pick(['need', 'bpa', 'balanced']); const w = t.draftStyle === 'need' ? 6 : t.draftStyle === 'bpa' ? 1 : 3;
  const need = pos => { const have = t.roster.filter(id => L.P[id].pos === pos).length; const st = (t.depth[pos] || [])[0]; const sv = st ? L.P[st].ovr : 40; return Math.max(0, POS_COUNTS[pos] - have) + (sv < 72 ? 1.5 : 0) + (sv < 65 ? 1.5 : 0); };
  let best = null, bv = -1e9;
  for (const id of L.draft) { const p = L.P[id]; let v = (t.id === L.user ? scoutedValue(p) : draftValue(p)) + need(p.pos) * w + rnd(-2.5, 2.5); if (t.id === L.user && t.draftPri && t.draftPri !== 'BPA' && p.pos === t.draftPri) v += 6; if (v > bv) { bv = v; best = p; } }
  return best;
}
function rookieDeal(pickIdx) { const r = Math.floor(pickIdx / 32), n = pickIdx % 32; const sal = r === 0 ? Math.max(1.4, 9.5 - n * 0.25) : r === 1 ? 1.6 : 1.0; return { sal: Math.round(sal * 10) / 10, yrs: 4 }; }
function doDraftPick(p) {
  const slot = L.draftOrder[L.draftPick]; const t = L.teams[slot.owner];
  L.draft = L.draft.filter(x => x !== p.id); p.draft = false; p.tid = t.id; const d = rookieDeal(L.draftPick); setDeal(p, d.sal, d.yrs, 0.3);
  p.drafted = { y: L.year + 1, r: slot.r, pick: L.draftPick + 1, t: t.id, ovr: p.ovr, pot: p.pot }; p.rookieY = L.year + 1;
  t.roster.push(p.id); fixDepth(t);
  t.picks = t.picks.filter(pk => !(pk.y === L.year + 1 && pk.r === slot.r && pk.from === slot.from));
  if (t.id === L.user || slot.r === 1) news(`Pick ${L.draftPick + 1}: ${t.abbr} select ${p.pos} ${p.fn} ${p.ln}.`);
  L.draftPick++;
}
function userOnClock() { const s = L.draftOrder[L.draftPick]; return !!(L.phase === 'offseason' && L.off === 'draft' && s && s.owner === L.user && !L.ghost); }
function simDraftUntilUser() { while (L.draftPick < L.draftOrder.length) { const s = L.draftOrder[L.draftPick]; if (s.owner === L.user && !L.ghost) return true; const p = aiDraftPick(L.teams[s.owner]); if (!p) break; doDraftPick(p); } return false; }
function userDraft(id) { if (!userOnClock()) return { ok: false, msg: 'You are not on the clock.' }; const p = L.P[id]; doDraftPick(p); const msg = `You drafted ${p.pos} ${p.fn} ${p.ln} (${p.ovr} OVR, ${p.pot} POT)`; simDraftUntilUser(); return { ok: true, msg }; }
function finishDraft() {
  while (L.draftPick < L.draftOrder.length) { const s = L.draftOrder[L.draftPick]; const p = aiDraftPick(L.teams[s.owner]); if (!p) break; doDraftPick(p); }
  for (const id of L.draft) { const p = L.P[id]; p.draft = false; p.ask = 0.9; p.sal = 0.9; p.base = 0.9; p.yrs = 1; p.rookieY = L.year + 1; L.fa.push(id); }
  L.draft = []; L.off = 'fa'; news('Free agency is open.'); gmFreeAgencyMemo();
}
// ---------- free agency ----------
function faInterest(p, t) { return t.fanSup * 0.2 + pct(t) * 30 + t.coach.mot * 2 + (t.fac ? (t.fac.train + t.fac.weight) : 2); }
function signFA(t, p, sal, yrs) { L.fa = L.fa.filter(x => x !== p.id); p.tid = t.id; setDeal(p, Math.round(sal * 10) / 10, yrs, yrs >= 2 ? (t.id === L.user ? 0.2 : 0.25) : 0); t.roster.push(p.id); fixDepth(t); assignNumbers(t); }
function aiFreeAgency() {
  const fa = L.fa.map(id => L.P[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  for (const p of fa) {
    const cands = L.teams.filter(t => (t.id !== L.user || L.ghost) && t.roster.length < 53 && capRoom(t) >= (p.ask || p.sal)); let best = null, bv = -1;
    for (const t of cands) { const have = t.roster.filter(id => L.P[id].pos === p.pos).length; const need = POS_COUNTS[p.pos] - have; const v = need * 10 + faInterest(p, t) + rnd(0, 10); if (need > 0 && v > bv) { bv = v; best = t; } }
    if (best) signFA(best, p, p.ask || p.sal, ri(1, 3));
  }
  for (const t of L.teams) { if (t.id === L.user && !L.ghost) continue; let g = 0;
    while (t.roster.length < 53 && g++ < 60) { const needPos = POS_LIST.find(pos => t.roster.filter(id => L.P[id].pos === pos).length < POS_COUNTS[pos]) || pick(['WR', 'LB', 'CB', 'OG', 'DT']); const p = genPlayer(needPos, rnd(46, 58), ri(22, 27)); p.sal = p.base = 0.9; p.yrs = 1; L.P[p.id] = p; p.tid = t.id; t.roster.push(p.id); }
    fixDepth(t); assignNumbers(t); }
}
function signOffer(id, sal, yrs) {
  const p = L.P[id], T = UT(); p.ask = p.ask || askingSalary(p);
  if (T.roster.length >= 53 && L.phase !== 'offseason') return { ok: false, msg: 'Your roster is full (53). Release someone first.' };
  if (capRoom(T) < sal) return { ok: false, msg: 'Not enough cap room.' };
  if (ownerPersona(T) === 'cheap' && capUsed(T) + sal > CAP * 0.92) return { ok: false, msg: `${T.owner.fn} ${T.owner.ln} won't approve spending past 92% of the cap.` };
  const lean = (T.fanSup - 50) / 400 + (T.coach.mot - 5) / 50 + (yrs >= 3 ? 0.02 : 0);
  if (sal < p.ask * (0.92 - lean) && !(sal >= p.ask * (0.85 - lean) && R() < 0.4)) return { ok: false, msg: `${p.ln} turned it down. Try closer to ${money(p.ask)}.` };
  signFA(T, p, sal, yrs); news(`Signed ${p.pos} ${p.fn} ${p.ln}: ${yrs} yr, ${money(sal)}/yr.`); gmReact('sign', p, sal); return { ok: true, msg: `Signed ${p.ln}.` };
}
// ---------- progression & retirement ----------
function progressPlayers() {
  const retire = []; const rep = { up: [], down: [] };
  for (const id in L.P) {
    const p = L.P[id]; if (p.draft || p.retired) continue; ensurePot(p);
    growthRecord(p);                                    // the season he just played goes into his OVR history
    p.age++; const t = p.tid != null ? L.teams[p.tid] : null; const o0 = p.ovr;
    const g = seasonGrowth(p, t), ch = applyGrowth(p, g.d);
    if (p.pot < p.ovr) p.pot = p.ovr;
    if (p.age >= 30) p.pot = p.ovr; else if (p.age > 27 && p.pot > p.ovr) p.pot = Math.max(p.ovr, p.pot - ri(1, 3));
    p.progLast = { y: L.year + 1, d: p.ovr - o0, ch, why: g.why };
    p.redshirt = false; assignTraits(p);
    if (t && t.id === L.user) { const d = p.ovr - o0; if (d >= 3) rep.up.push({ id: p.id, d, why: g.why }); if (d <= -3) rep.down.push({ id: p.id, d }); }
    if ((p.age >= 34 && R() < 0.45) || p.age >= 37 || (p.age >= 31 && p.ovr < 55 && R() < .5)) retire.push(p);
  }
  for (const p of retire) { if (p.tid != null) { const t = L.teams[p.tid]; t.roster = t.roster.filter(x => x !== p.id); fixDepth(t); if (t.id === L.user) news(`${p.pos} ${p.fn} ${p.ln} retired.`); } L.fa = L.fa.filter(x => x !== p.id); p.retired = true; p.tid = null; p.retY = L.year; }
  hofVote(retire);
  L.fa = L.fa.filter(id => { const p = L.P[id]; return p && !p.retired; }).sort((a, b) => L.P[b].ovr - L.P[a].ovr).slice(0, 140);
  const keep = new Set(L.fa); for (const t of L.teams) for (const id of t.roster) keep.add(id);
  for (const a of L.awards) { keep.add(a.mvp); keep.add(a.dpoy); keep.add(a.roy); } for (const id of L.hof) keep.add(+id);
  for (const id in L.P) if (!keep.has(+id) && !L.P[id].draft) delete L.P[id];
  rep.up.sort((a, b) => b.d - a.d); rep.down.sort((a, b) => a.d - b.d);
  L.offProg = { y: L.year, ...rep }; growthMemo(rep);
}
function hofVote(retired) {
  for (const p of retired) { const c = Object.assign({}, p.car || {}); const aw = L.awards.filter(a => a.mvp === p.id || a.dpoy === p.id).length;
    const s = p.pos === 'QB' ? (c.py || 0) / 220 + (c.ptd || 0) * 1.6 : ['RB', 'FB'].includes(p.pos) ? (c.ry || 0) / 75 + (c.rtd || 0) * 1.6 : ['WR', 'TE'].includes(p.pos) ? (c.recy || 0) / 75 + (c.rectd || 0) * 1.6 : ['OT', 'OG', 'C'].includes(p.pos) ? (c.gp || 0) * 0.55 + p.ovr * 0.6 : (c.sk || 0) * 3 + (c.int || 0) * 3.5 + (c.tk || 0) * 0.14;
    if (s + aw * 12 >= 120) { L.lhof.push({ y: L.year + 1, id: p.id, name: p.fn + ' ' + p.ln, pos: p.pos, sc: Math.round(s + aw * 12), teams: [...new Set((p.hist || []).map(h => h.t))].map(t => L.teams[t] ? L.teams[t].abbr : ''), lk: p.lk, num: p.num }); news(`League Hall of Fame class of ${L.year + 1}: ${p.pos} ${p.fn} ${p.ln}.`); } }
}
function startNewSeason() {
  const T = UT();
  if (!L.ghost && T.roster.length > 53) return { ok: false, msg: `Cut down to 53 players first (you have ${T.roster.length}).` };
  if (!L.ghost && capRoom(T) < 0) return { ok: false, msg: 'You are over the salary cap.' };
  for (const tid of (L.vacancies || [])) { const t = L.teams[tid]; if (tid === L.user && !L.ghost) continue; L.coachHist.push(Object.assign({}, t.coach, { team: t.abbr, gone: L.year })); t.coach = genCoach(); t.coach.tenure = 0; }
  L.vacancies = []; L.offers = [];
  progressPlayers(); aiFreeAgency();
  for (const t of L.teams) { if (t.id === L.user && !L.ghost) continue; while (t.roster.length > 53) { const w = t.roster.map(id => L.P[id]).sort((a, b) => a.ovr - b.ovr).find(p => t.roster.filter(id => L.P[id].pos === p.pos).length > POS_COUNTS[p.pos]) || L.P[t.roster[0]]; releaseToFA(t, w, false); } }
  if (!L.ghost && T.roster.length < 53) { let g = 0; while (T.roster.length < 53 && g++ < 60) { const pos = POS_LIST.find(ps => T.roster.filter(id => L.P[id].pos === ps).length < POS_COUNTS[ps]) || 'LB'; const p = genPlayer(pos, rnd(46, 56), ri(22, 25)); p.sal = p.base = 0.9; p.yrs = 1; p.tid = T.id; L.P[p.id] = p; T.roster.push(p.id); } news('Empty roster spots were filled with minimum-salary players.'); }
  L.year++; L.week = 0; L.phase = 'regular'; L.off = null; L.playoff = null; L.results = L.results.filter(r => r.y >= L.year - 1);
  for (const t of L.teams) { t.w = t.l = t.tie = t.pf = t.pa = t.dw = t.cw = 0; t.dead = 0; t.streak = 0; fixDepth(t); assignNumbers(t);
    t.picks = t.picks.filter(p => p.y > L.year); for (let r = 1; r <= 7; r++) t.picks.push({ y: L.year + 2, r, from: t.id }); t.fanSup = clamp(t.fanSup * 0.85 + 10, 0, 100); t.expect = expectFor(t); }
  ensureStaffAll(); L.scouting = null; L.plan = null; L.mock = null;
  genDraftClass(); makeSchedule();
  if (!L.ghost) { seasonGoals(T); news(`The ${L.year} season begins. The owner expects about ${T.expect} wins.`); ownerPreseason(T); }
  return { ok: true };
}
