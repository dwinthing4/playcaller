// Uniform kits and the LG namespace (the contract the match engine and UI use).
const SHELLS3D = ['sleek', 'speed', 'classic', 'pro'];
function teamPants(c1, c2) { return lum(c2) > 0.55 ? c2 : '#e8e8e8'; }
function defaultKits(T) {
  const tr = lum(T.c2) > 0.16 ? T.c2 : '#ffffff'; const dark = shade(T.c1, -0.55); const numH = Math.abs(lum(tr) - lum(T.c1)) > 0.3 ? tr : (lum(T.c1) > 0.5 ? '#111111' : '#ffffff');
  const shell = SHELLS3D[T.id % 4];
  return [
    { name: 'Home', jersey: T.c1, trim: tr, pants: teamPants(T.c1, tr), pstripe: T.c1, socks: T.c1, helmet: T.c1, hstripe: tr, hstripe2: dark, mask: lum(T.c1) > 0.6 ? '#1b1b1e' : '#d4d8de', num: numH, numOutline: shade(T.c1, -0.5), glove: tr, cleat: '#151517', logo: T.c1, logo2: tr, letter: T.name[0], shell },
    { name: 'Away', jersey: '#f2f0ea', trim: T.c1, pants: teamPants(T.c1, tr), pstripe: T.c1, socks: T.c1, helmet: T.c1, hstripe: tr, hstripe2: dark, mask: lum(T.c1) > 0.6 ? '#1b1b1e' : '#d4d8de', num: T.c1, numOutline: tr, glove: '#f2f0ea', cleat: '#f2f0ea', logo: T.c1, logo2: tr, letter: T.name[0], shell },
    { name: 'Alternate', jersey: dark, trim: T.c1, pants: dark, pstripe: T.c1, socks: dark, helmet: dark, hstripe: T.c1, hstripe2: tr, mask: T.c1, num: T.c1, numOutline: tr, glove: '#151517', cleat: '#151517', logo: dark, logo2: T.c1, letter: T.name[0], shell },
  ];
}
function uniOf(T) { L.unis = L.unis || {}; if (!L.unis[T.id]) L.unis[T.id] = { kits: defaultKits(T), home: 0, away: 1, wk: {} }; return L.unis[T.id]; }
function kitFor(T, isHome, week) {
  if (!T) return defaultKits({ id: 0, c1: '#1d3478', c2: '#ffffff', name: 'Team' })[0];
  const U = uniOf(T); const wk = week != null ? week : (L.phase === 'regular' ? L.week : -1); const w = U.wk && U.wk[wk];
  const k = U.kits[w != null ? w : (isHome ? U.home : U.away)] || U.kits[0];
  return Object.assign({}, defaultKits(T)[0], k);
}
function resetKits(T) { if (L.unis) delete L.unis[T.id]; }
const LG = {
  state: () => L, team: tid => L.teams[tid], player: pid => L.P[pid], user: () => L.user,
  starters: (team, formKey, side) => starters(team, formKey, side),
  depthPick: (team, pos, idx, used) => depthPick(team, pos, idx, used || new Set()),
  kitFor: (team, isHome) => kitFor(team, isHome),
  playsFor: (tid, side) => playsFor(tid, side),
  cpuCall: (tid, side, ctx) => cpuCall(tid, side, ctx),
  cpuFourth: (tid, ctx) => cpuFourth(tid, ctx),
  coordCall: ctx => coordCall(ctx),
  noteCall: (tid, playId, ctx) => noteCall(tid, playId, ctx),
  applyResult: (g, result) => applyMatchResult(g, result),
  fgProb: (tid, yl) => fgProb(L.teams[tid], yl),
  diff: () => DIFFS[L.diff] || DIFFS.pro, qlen: () => L.qlen,
  // league lifecycle (used by UI and tests)
  newLeague, chooseTeam, simWeek, instantUserGame, simToPlayoffs, simPlayoffRound, offseasonNext, currentUserGame, ensurePlan, serialize, deserialize,
};
// internals exposed for node tests (dist/sim.cjs only exports LG)
LG._t = { UT, teamName, capRoom, capUsed, expiring, resignPlayer, userOnClock, userDraft, simDraftUntilUser, signOffer, askingSalary, releasePlayer, proposeTrade, playerValue, pickValue, evalTrade, toAsset, myBlock, toggleBlock, genIncomingOffer, acceptIncoming,
  scoutingWeek, scoutState, meetProspect, proDay, hireScout, setScoutPri, ownerMeeting, ownerChoose, gmWeek, coordCall, cpuCall, cpuFourth, planSwap, planLock, scoutOpp, teamOvr, pct, restructure, franchiseTag, offerExtension, extAsk,
  applyMatchResult, userPlayoffGame, userGame, setFocus, upgradeFac, upgradePC, hireCoord, poach, jobSecurity, stories, storyGoal, sitOutSeason, acceptOffer, starterIds };
