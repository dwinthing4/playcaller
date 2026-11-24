// Contracts and the salary cap. Cap hit = base salary + prorated signing bonus (a bonus is spread over at most 5 years).
// Dead money: cutting a player books his remaining bonus proration plus any guaranteed base this cap year. A June 1 cut (2 a year)
// books only this year's proration now and pushes the rest to next year. Trading a player moves his remaining proration onto the
// old team's cap; the new team pays his base. Dead money lives in a per-team ledger t.deadL = [{y, amt, nm, why}]; t.dead is the
// current cap year's total (capUsed reads it). In the offseason the cap year is next season (contracts tick at the end of the season).
// Rookie scale: 4-year deals priced by draft slot; first-rounders carry a 5th-year option, decided the offseason after year 3.
// Compensatory picks (rounds 3-7) go to teams that lost more and better free agents than they signed (L.compLog, see ctCompAward).
const CT_J1_MAX = 2;
function ctR(v) { return Math.round(v * 10) / 10; }
function capYear() { return L.phase === 'offseason' ? L.year + 1 : L.year; }
function kBase(p) { return p.base != null ? p.base : p.sal; }
function syncSal(p) { p.sal = Math.round((kBase(p) + (p.pr || 0)) * 10) / 10; }
function deadIfCut(p) { return Math.round(((p.pr || 0) * (p.prYrs || 0) + (p.guar || 0)) * 10) / 10; }
// dead money from a cut: { now: this cap year, next: next cap year (June 1 only) }
function ctSplit(p, j1) { const pr = p.pr || 0, n = p.prYrs || 0, g = p.guar || 0; return j1 && n > 1 ? { now: ctR(pr + g), next: ctR(pr * (n - 1)) } : { now: ctR(pr * n + g), next: 0 }; }
function ctJ1Max(t) { return CT_J1_MAX + (t && t.id === L.user && coachPerk('exe2') ? 1 : 0); }
function ctJ1Left(t) { const u = t.j1 && t.j1.y === capYear() ? t.j1.n : 0; return Math.max(0, ctJ1Max(t) - u); }
function ctDeadAdd(t, amt, y, p, why) { amt = ctR(amt); if (!(amt > 0)) return; t.deadL = t.deadL || []; t.deadL.push({ y, amt, nm: p ? `${p.pos} ${p.fn} ${p.ln}` : '', why: why || 'Cut' }); ctDeadSync(t); }
function ctDeadFor(t, y) { return ctR(sum((t.deadL || []).filter(d => d.y === y).map(d => d.amt))); }
function ctDeadSync(t) { const y = capYear(); t.deadL = (t.deadL || []).filter(d => d.y >= y - 1); t.dead = ctDeadFor(t, y); }
function setDeal(p, avg, yrs, bonusPct) {
  // proration left from his current deal (an extension) keeps counting: it is spread over the new deal's proration years
  const py = Math.min(5, yrs), carry = (p.pr || 0) * Math.max(0, p.prYrs || 0), bonus = avg * yrs * (bonusPct || 0), per = py > 1 ? bonus / py : 0;
  p.base = Math.max(0.9, ctR(avg - per)); p.pr = py > 1 ? ctR(per + carry / py) : ctR(carry); p.prYrs = p.pr > 0 ? Math.max(1, py) : 0;
  p.guar = ctR(Math.min(p.base, avg * 0.5)); p.yrs = yrs; syncSal(p); p.restr = null; p.rk = null;
}
function capUsed(t) { return Math.round((sum(t.roster.map(id => L.P[id].sal)) + (t.dead || 0)) * 10) / 10; }
function capRoom(t) { return Math.round((CAP - capUsed(t)) * 10) / 10; }
function askingSalary(p) { return Math.max(0.9, Math.round(salaryFor(p.ovr, p.pos, p.age) * rnd(.95, 1.15) * 10) / 10); }
function expiring(t) { return t.roster.filter(id => L.P[id].yrs <= 0); }
function releaseToFA(t, p, dead, j1) {
  if (dead) { j1 = !!j1 && ctJ1Left(t) > 0 && (p.prYrs || 0) > 1; const s = ctSplit(p, j1), y = capYear();
    ctDeadAdd(t, s.now, y, p, j1 ? 'June 1 cut' : 'Cut'); ctDeadAdd(t, s.next, y + 1, p, 'June 1 cut (rest)');
    if (j1) t.j1 = { y, n: (t.j1 && t.j1.y === y ? t.j1.n : 0) + 1 };
    if (t.id === L.user && s.now + s.next > 0) news(`Releasing ${p.fn} ${p.ln} leaves ${money(s.now)} in dead money${s.next ? ` this year and ${money(s.next)} next year` : ''}.`); }
  t.roster = t.roster.filter(x => x !== p.id); p.tid = null; p.yrs = 0; p.pr = 0; p.prYrs = 0; p.guar = 0; p.base = null; p.rk = null; p.ask = askingSalary(p);
  if (!L.fa.includes(p.id)) L.fa.push(p.id);
  if (L.myBlock) L.myBlock = L.myBlock.filter(x => x !== p.id);
  if (t.captains) t.captains = t.captains.filter(x => x !== p.id);
  fixDepth(t);
}
function releasePlayer(id, j1) {
  const p = L.P[id], T = UT(); if (!p || p.tid !== T.id) return { ok: false, msg: 'Not on your roster.' };
  const use = !!j1 && ctJ1Left(T) > 0 && (p.prYrs || 0) > 1, s = ctSplit(p, use); releaseToFA(T, p, true, use); news(`Released ${p.pos} ${p.fn} ${p.ln}${use ? ' (June 1 cut)' : ''}.`); gmReact('release', p, s.now + s.next);
  return { ok: true, msg: `Released. ${money(s.now)} dead money${s.next ? ` now, ${money(s.next)} next year` : ''}.` };
}
// CPU cap management: restructure big base salaries first (a few a year), then cut the players whose release saves the most cap
// for the least talent (June 1 when that saves more). Stops when the team is under the cap. fill: top the roster back up to 53.
function ensureCap(t) { if (t.id === L.user && !L.ghost) return; ctCpuCapFix(t, false); }
function ctCpuCapFix(t, fill) {
  if (t.id === L.user && !L.ghost) return; let guard = 0, rs = 0;
  while (capRoom(t) < 0 && guard++ < 40) {
    const ps = t.roster.map(id => L.P[id]).filter(Boolean);
    const big = rs < 3 ? ps.filter(p => p.yrs >= 2 && p.restr !== L.year && kBase(p) > 5).sort((a, b) => kBase(b) - kBase(a))[0] : null;
    if (big && ctRestructure(big, true).ok) { rs++; continue; }
    const st = starterIds(t); let best = null, bv = 1e9, bj = false;
    for (const p of ps) {
      let sv = p.sal - ctSplit(p, false).now, j = false; if (ctJ1Left(t) > 0 && (p.prYrs || 0) > 1) { const s2 = p.sal - ctSplit(p, true).now; if (s2 > sv + 0.5) { sv = s2; j = true; } }
      if (sv < 1) continue; const v = Math.max(1, p.ovr - 40) * (st.has(p.id) ? 2.5 : 1) * (p.pos === 'QB' && st.has(p.id) ? 2 : 1) / sv; if (v < bv) { bv = v; best = p; bj = j; }
    }
    if (!best) break; releaseToFA(t, best, true, bj);
  }
  if (fill) ctFillRoster(t);
}
function ctFillRoster(t) {
  let g = 0; while (t.roster.length < 53 && g++ < 60) { const pos = POS_LIST.find(ps => t.roster.filter(id => L.P[id].pos === ps).length < POS_COUNTS[ps]) || pick(['WR', 'LB', 'CB', 'OG', 'DT']);
    const p = genPlayer(pos, rnd(46, 56), ri(22, 26)); p.sal = p.base = 0.9; p.pr = 0; p.prYrs = 0; p.guar = 0; p.yrs = 1; p.tid = t.id; L.P[p.id] = p; t.roster.push(p.id); }
  fixDepth(t); assignNumbers(t);
}
function ctRestructure(p, quiet) {
  if (p.yrs < 2) return { ok: false, msg: 'Needs at least 2 years left.' }; if (p.restr === L.year) return { ok: false, msg: 'Already restructured this year.' };
  const base = kBase(p), f = p.tid === L.user && coachPerk('exe2') ? 0.9 : 0.75, conv = Math.max(0, base - 1.0) * f; if (conv < 1) return { ok: false, msg: 'Not enough base salary to convert.' };
  const yrsR = Math.min(5, p.yrs), left = (p.pr || 0) * Math.max(0, p.prYrs || 0), before = p.sal;
  // the converted money becomes bonus spread over the years left; bonus already on the books is re-spread over the same span
  p.base = ctR(base - conv); p.prYrs = Math.max(p.prYrs || 0, yrsR); p.pr = ctR((left + conv) / p.prYrs); p.guar = ctR((p.guar || 0) + conv); p.restr = L.year; syncSal(p);
  if (!quiet) news(`Restructured ${p.fn} ${p.ln}: cap hit ${money(before)} -> ${money(p.sal)}.`); return { ok: true, msg: `Saved ${money(before - p.sal)} of cap this year` };
}
function restructure(id) { return ctRestructure(L.P[id], false); }
function tagValue(pos) { const s = Object.values(L.P).filter(p => p.pos === pos && p.tid != null).map(p => p.sal).sort((a, b) => b - a).slice(0, 5); return Math.round((sum(s) / Math.max(1, s.length)) * 10) / 10; }
function franchiseTag(id) {
  const p = L.P[id], T = UT(); if ((T.tagY || 0) === L.year) return { ok: false, msg: 'You already used your franchise tag this year.' };
  const v = tagValue(p.pos); if (capRoom(T) < v - p.sal) return { ok: false, msg: 'Not enough cap room for the tag.' };
  p.base = v; p.pr = 0; p.prYrs = 0; p.guar = v; p.yrs = 1; syncSal(p); T.tagY = L.year; p.tagged = L.year; moodAdd(p, -6, 'Franchise tagged');
  news(`Franchise tag on ${p.pos} ${p.fn} ${p.ln}: ${money(v)} for one year.`); return { ok: true, msg: 'Tagged for one year.' };
}
function extAsk(p) { return Math.round(salaryFor(p.ovr, p.pos, p.age) * (1 + (60 - ensureMor(p).mor) / 250) * 10) / 10; }
function extYearsAsk(p) { return p.age <= 27 ? 4 : p.age <= 30 ? 3 : 2; }
function offerExtension(id, sal, yrs, bonusPct) {
  const p = L.P[id], T = UT(); if (p.extLock && p.extLock > L.year * 100 + L.week) return { ok: false, msg: 'He is not ready to talk again yet.' };
  const ask = extAsk(p), yrsAsk = extYearsAsk(p); if (capRoom(T) < sal - p.sal) return { ok: false, msg: 'Not enough cap room.' };
  const pAcc = clamp(0.45 + (sal / ask - 1) * 3.2 - Math.abs(yrs - yrsAsk) * 0.08 + (ensureMor(p).mor - 60) / 120 + (bonusPct || 0) * 0.3 + (coachPerk('exe1') ? 0.08 : 0), 0.03, 0.97);
  if (R() < pAcc) { setDeal(p, sal, yrs, bonusPct); moodAdd(p, 8, 'Signed an extension'); p.holdout = false; p.tradeReq = 0; news(`${p.fn} ${p.ln} signed a ${yrs}-year extension at ${money(sal)}/yr.`); gmReact('extend', p, sal); return { ok: true, msg: 'Deal done!' }; }
  moodAdd(p, -3, 'Extension talks stalled'); p.extLock = L.year * 100 + L.week + 3;
  return { ok: false, msg: sal < ask * 0.92 ? 'His agent called it a lowball.' : 'They want to think it over. Try again in a few weeks.' };
}
function resignPlayer(id, yrs, sal) {
  const T = UT(), p = L.P[id]; p.ask = p.ask || askingSalary(p); sal = sal || p.ask;
  if (capRoom(T) + p.sal < sal) return { ok: false, msg: 'Not enough cap room.' };
  setDeal(p, sal, yrs, yrs >= 3 ? 0.2 : 0); p.resigned = L.year; news(`Re-signed ${p.pos} ${p.fn} ${p.ln}: ${yrs} yr, ${money(sal)}/yr.`); return { ok: true, msg: 'Re-signed.' };
}
// base salary in cap year capYear()+i (the option year pays the option price)
function ctYearBase(p, i) { return p.rk && p.rk.opt === 'yes' && !p.rk.on && capYear() + i >= p.rk.y + 4 ? p.rk.price : kBase(p); }
// ---------- trades: the old team keeps the bonus ----------
function ctTradeDead(p) { return p ? ctR((p.pr || 0) * Math.max(0, p.prYrs || 0)) : 0; }
function ctTradeMove(from, p) { const d = ctTradeDead(p); if (d > 0) ctDeadAdd(from, d, capYear(), p, 'Traded'); p.pr = 0; p.prYrs = 0; syncSal(p); }
// ---------- rookie scale ----------
function ctRookieApy(pickIdx) { return ctR(0.9 + 10.2 * Math.exp(-pickIdx / 18)); }
function ctRookieDeal(p, pickIdx, round) {
  const apy = ctRookieApy(pickIdx), bp = round === 1 ? 0.55 : round === 2 ? 0.35 : round === 3 ? 0.2 : 0.1;
  setDeal(p, apy, 4, bp); p.guar = ctR(p.base * (round === 1 ? 4 : round === 2 ? 2 : round === 3 ? 1 : 0));
  p.rk = { y: L.year + 1, r: round, pick: pickIdx + 1, opt: null };
}
// ---------- 5th-year option (first-rounders) ----------
function ctOptPrice(p) {
  const s = Object.values(L.P).filter(q => q.pos === p.pos && q.tid != null && q.id !== p.id).map(q => q.sal).sort((a, b) => b - a);
  const avg = (a, b) => { const x = s.slice(a, b); return x.length ? sum(x) / x.length : 2; };
  const v = p.ovr >= 85 ? avg(0, 5) : p.rk && p.rk.pick <= 10 ? avg(0, 10) : avg(2, 25);
  return ctR(Math.max(v, p.sal * 1.2, 2));
}
function ctOptOpen(p) { return !!(p && p.rk && p.rk.r === 1 && p.rk.opt == null && p.tid != null && L.phase === 'offseason' && L.year === p.rk.y + 2 && p.yrs === 1); }
function ctOptWorth(p) { const mk = salaryFor(Math.min(99, p.ovr + Math.max(0, (p.pot || p.ovr) - p.ovr) * 0.3), p.pos, p.age + 2), pr = ctOptPrice(p); return p.ovr >= 80 || (p.ovr >= 66 && mk >= pr * 0.8) || (p.pos === 'QB' && p.ovr >= 70); }
function ctOptDecide(p, yes, quiet) {
  if (!p || !p.rk || p.rk.opt != null) return { ok: false, msg: 'No option to decide.' };
  if (!yes) { p.rk.opt = 'no'; if (!quiet && p.tid === L.user) news(`Declined the fifth-year option on ${p.pos} ${p.fn} ${p.ln}. He is a free agent after next season.`); return { ok: true, msg: 'Option declined.' }; }
  const price = ctOptPrice(p); p.rk.opt = 'yes'; p.rk.price = price; p.yrs += 1; p.guar = ctR((p.guar || 0) + price);
  if (!quiet && p.tid === L.user) news(`Picked up the fifth-year option on ${p.pos} ${p.fn} ${p.ln}: ${money(price)} in ${p.rk.y + 4}, fully guaranteed.`);
  return { ok: true, msg: `Option picked up: ${money(price)} in ${p.rk.y + 4}.` };
}
function ctOptList(t) { return t.roster.map(id => L.P[id]).filter(ctOptOpen); }
function optionDecide(id, yes) { const p = L.P[id]; if (!ctOptOpen(p) || p.tid !== L.user) return { ok: false, msg: 'That option is not open.' }; return ctOptDecide(p, yes); }
function ctOptionsOffseason() {
  for (const t of L.teams) { const ls = ctOptList(t); if (!ls.length) continue;
    if (t.id !== L.user || L.ghost) { for (const p of ls) ctOptDecide(p, ctOptWorth(p), true); continue; }
    inbox('gm', 'Fifth-year options', `${gmName()}: "Decide on the fifth-year option for ${ls.map(p => `${p.pos} ${p.fn} ${p.ln} (${p.ovr}, option ${money(ctOptPrice(p))} in ${p.rk.y + 4})`).join(', ')}. ${ls.map(p => `I'd ${ctOptWorth(p) ? 'pick up' : 'decline'} ${p.ln}'s.`).join(' ')} If you don't decide by opening day, I'll make the call."`, { actions: [{ label: 'Decide in Contracts', act: 'go', arg: 'contracts' }] });
  }
}
function ctOptionsDeadline() {   // opening day: undecided options (the user's) go to the GM
  for (const t of L.teams) for (const id of t.roster) { const p = L.P[id]; if (!p || !p.rk || p.rk.r !== 1 || p.rk.opt != null || L.year !== p.rk.y + 3) continue;
    const yes = ctOptWorth(p); ctOptDecide(p, yes, true); if (t.id === L.user) news(`Your GM ${yes ? 'picked up' : 'declined'} the fifth-year option on ${p.pos} ${p.fn} ${p.ln}.`); }
}
// ---------- compensatory picks ----------
// finishResign marks expiring players who leave as p.cfa; signFA logs each one that signs elsewhere in L.compLog.
// The next offseason, before the draft, teams that lost more qualifying free agents than they signed get picks at the end of rounds 3-7.
function ctCfaSigned(t, p, sal) {
  if (p.cfa && p.cfa.y === L.year && p.cfa.from !== t.id && sal >= 2) { L.compLog = L.compLog || []; L.compLog.push({ y: L.year, from: p.cfa.from, to: t.id, pid: p.id, nm: `${p.pos} ${p.fn} ${p.ln}`, sal: ctR(sal), ovr: p.ovr }); }
  delete p.cfa;
}
function ctCompRound(sal) { return sal >= 16 ? 3 : sal >= 9 ? 4 : sal >= 5 ? 5 : sal >= 3 ? 6 : 7; }
function ctCompAward() {
  const y = L.year - 1, log = (L.compLog || []).filter(e => e.y === y); L.compLog = (L.compLog || []).filter(e => e.y >= L.year - 1);
  if (!L.draftOrder || !L.draftOrder.length) return; const awards = [];
  for (const t of L.teams) {
    const lost = log.filter(e => e.from === t.id).sort((a, b) => b.sal - a.sal), gained = log.filter(e => e.to === t.id).sort((a, b) => b.sal - a.sal);
    if (lost.length <= gained.length) continue; const left = lost.slice();
    for (const g of gained) { let bi = 0, bd = 1e9; left.forEach((e, i) => { const d = Math.abs(e.sal - g.sal); if (d < bd) { bd = d; bi = i; } }); left.splice(bi, 1); }
    for (const e of left.slice(0, 4)) awards.push({ tid: t.id, r: ctCompRound(e.sal), sal: e.sal, nm: e.nm });
  }
  awards.sort((a, b) => a.r - b.r || b.sal - a.sal); const keep = awards.slice(0, 32);
  for (const r of [3, 4, 5, 6, 7]) { let at = -1; L.draftOrder.forEach((s, i) => { if (s.r === r) at = i; }); if (at < 0) continue;
    keep.filter(a => a.r === r).forEach((a, k) => L.draftOrder.splice(at + 1 + k, 0, { r, from: a.tid, owner: a.tid, comp: 1, why: a.nm })); }
  L.compAwards = { y: L.year + 1, list: keep };
  if (keep.length) news(`${keep.length} compensatory picks were awarded for free agents lost last year.`);
  const mine = keep.filter(a => a.tid === L.user); if (mine.length && !L.ghost) inbox('gm', 'Compensatory picks', `${gmName()}: "The league gave us ${mine.length} compensatory pick${mine.length > 1 ? 's' : ''} for the free agents we lost: ${mine.map(a => `round ${a.r} (for ${a.nm})`).join(', ')}."`, { actions: [{ label: 'Open draft', act: 'go', arg: 'draft' }] });
}
// ---------- season hooks (one-line calls from 40_offseason.js) ----------
function foOffseason() {   // beginOffseason, after the contract tick: the cap year is now next season
  for (const t of L.teams) for (const id of t.roster) { const p = L.P[id]; if (p && p.rk && p.rk.opt === 'yes' && !p.rk.on && L.year + 1 >= p.rk.y + 4) { p.base = p.rk.price; p.rk.on = 1; syncSal(p); } }
  for (const t of L.teams) ctDeadSync(t);
  ctCompAward(); ctOptionsOffseason(); coachOffseasonXP();
}
function foNewSeason() {   // end of startNewSeason
  for (const t of L.teams) ctDeadSync(t);
  ctOptionsDeadline();
  for (const t of L.teams) if (t.id !== L.user || L.ghost) { if (capRoom(t) < 0) ctCpuCapFix(t, true); }
  coachNewSeasonXP();
}
// structure for contracts that were made without one (new leagues, old saves): part of a big deal is prorated bonus, part is guaranteed
function ctStructure(p) {
  if (p.ctV) return; p.ctV = 1; if (p.tid == null || p.draft || (p.pr || 0) > 0 || (p.guar || 0) > 0 || !(p.sal > 0)) return;
  const s = p.sal, bp = s >= 10 ? 0.3 : s >= 4 ? 0.22 : s >= 1.5 ? 0.12 : 0, n = Math.min(5, Math.max(1, p.yrs || 1));
  p.pr = n > 1 ? ctR(s * bp) : 0; p.prYrs = p.pr > 0 ? n : 0; p.base = Math.max(0.9, ctR(s - p.pr)); p.guar = ctR(s >= 10 ? p.base : s >= 4 ? p.base * 0.5 : 0); syncSal(p);
}
function ctInitLeague(old) {
  for (const t of L.teams) {
    t.deadL = t.deadL || [];
    // a new league starts with the first-rounders of the last three drafts on their rookie deals (the oldest are up for the 5th-year option this offseason)
    if (!old) t.roster.map(id => L.P[id]).filter(p => p.age <= 24 && p.ovr >= 64 && p.pos !== 'K' && p.pos !== 'P').sort((a, b) => b.ovr - a.ovr).slice(0, 3).forEach((p, k) => {
      const y = L.year - k, pk = ri(0, 31), sal = p.sal; ctRookieDeal(p, pk, 1); p.rk.y = y; p.yrs = y + 4 - L.year; p.prYrs = Math.min(p.prYrs, p.yrs); p.guar = ctR(p.base * p.yrs); p.ctV = 1;
      p.drafted = { y, r: 1, pick: pk + 1, t: t.id, ovr: p.ovr, pot: p.pot, seed: 1 }; p.rookieY = y; if (p.sal > sal + 3) { p.base = Math.max(0.9, ctR(sal - p.pr)); p.guar = ctR(p.base * p.yrs); syncSal(p); }
    });
    for (const id of t.roster) ctStructure(L.P[id]);
  }
  L.ctV = 1; L.compLog = L.compLog || [];
}
