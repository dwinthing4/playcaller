// Weekly flow: apply a live (MATCH) or instant result for the user's game, sim the rest, run weekly staff/scout/dev hooks.
function lineFromResult(st) { const o = {}; for (const k in st || {}) if (typeof st[k] === 'number') o[k] = st[k]; return o; }
function applyMatchResult(g, result) {
  if (!g || g.done) return { ok: false, msg: 'Game already played.' };
  const H = L.teams[g.h], A = L.teams[g.a]; const lines = {};
  for (const pid in (result.st || {})) { const p = L.P[pid]; if (!p) continue; const ln = lineFromResult(result.st[pid]); delete ln.gp; lines[pid] = ln; for (const k in ln) addStat(+pid, k, ln[k]); }
  for (const T of [H, A]) for (const id of T.roster) if (available(id)) addStat(id, 'gp', 1);
  for (const pid in (result.snaps || {})) { addStat(+pid, 'snaps', result.snaps[pid]); (lines[pid] = lines[pid] || {}).snaps = result.snaps[pid]; }
  for (const inj of (result.injuries || [])) { const p = L.P[inj.pid]; if (p) { p.inj = Math.max(p.inj || 0, inj.weeks || 1); p.injType = inj.type || 'injury'; if (p.tid === L.user) news(`${p.pos} ${p.fn} ${p.ln} (${p.injType}) is out ${p.inj} wk.`); } }
  g.hs = result.hs; g.as = result.as; g.done = true; g.live = true; g.played = true; rotRecord(g, result);
  for (const pid in lines) recordGameLine(L.P[pid], lines[pid]);
  finishGame(g, lines);
  const T = UT(); applyGameXP(T, result.snaps, result.perf); closeFilm(result.perf);
  if (result.pog && L.P[result.pog] && L.P[result.pog].tid === L.user) moodAdd(L.P[result.pog], 4, 'Player of the game');
  news(`Final: ${A.abbr} ${g.as} – ${H.abbr} ${g.hs}`);
  finishWeekAfterUserGame(g);
  return { ok: true };
}
function finishWeekAfterUserGame(g) {
  if (L.phase === 'playoffs') { resolvePlayoffGame(g); for (const x of L.playoff.games) if (!x.done) { simGame(x); resolvePlayoffGame(x); } advancePlayoffs(); }
  else { for (const x of L.sched[L.week]) if (!x.done) simGame(x); advanceWeek(); }
}
function instantUserGame() {
  const g = currentUserGame();
  if (!g) { if (L.phase === 'playoffs') simPlayoffRound(); else if (L.phase === 'regular') simWeek(); return; }
  const lines = {}; const before = {}; const T = UT(); for (const id of T.roster) before[id] = Object.assign({}, L.P[id].st);
  simGame(g); const snaps = {}; for (const id of T.roster) { const s = L.P[id].st || {}; snaps[id] = (s.snaps || 0) - ((before[id] || {}).snaps || 0); }
  applyGameXP(T, snaps, {}); news(`Final: ${L.teams[g.a].abbr} ${g.as} – ${L.teams[g.h].abbr} ${g.hs}`);
  finishWeekAfterUserGame(g);
}
function simWeek() { const wk = L.sched[L.week]; if (!wk) return; for (const g of wk) if (!g.done) simGame(g); advanceWeek(); }
function simToPlayoffs() { let guard = 0; while (L.phase === 'regular' && guard++ < 20) { const g = userGame(L.week); if (g && !g.done) instantUserGame(); else simWeek(); } }
function advanceWeek() {
  const T = UT();
  if (!L.ghost) { practiceWeek(T); devWeekReport(T); }
  for (const t of L.teams) for (const id of t.roster) { const p = L.P[id]; if (p.inj > 0) { p.inj--; if (p.inj === 0 && t.id === L.user) news(`${p.fn} ${p.ln} is healthy again.`); } }
  L.week++;
  if (L.week >= L.sched.length) { startPlayoffs(); return; }
  if (L.ghost) return;
  scoutingWeek(); gmWeek(); ownerWeek(); updateMock();
  L.inOffers = (L.inOffers || []).filter(o => o.exp >= L.week); if (R() < 0.28) genIncomingOffer();
  if (L.week === 7 || L.week === 8) aiDeadlineDeals();
  if (L.week === TRADE_DEADLINE_WEEK) inbox('league', 'Trade deadline passed', 'Trades are closed until the offseason.');
}
// offseason step helper used by the UI
function offseasonNext() {
  if (L.off === 'resign') { finishResign(); scoutingWeek(); return { ok: true, msg: 'The draft is open.' }; }
  if (L.off === 'draft') { finishDraft(); return { ok: true, msg: 'Free agency is open.' }; }
  if (L.off === 'fa') { const r = startNewSeason(); return r.ok ? { ok: true, msg: `The ${L.year} season begins.` } : r; }
  return { ok: false };
}
