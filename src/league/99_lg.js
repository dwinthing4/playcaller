// Uniform kits and the LG namespace (the contract the match engine and UI use).
const SHELLS3D = ['sleek', 'speed', 'classic', 'pro'];
// uniform design options (3D kit look). Every kit field has a default: kitFor() fills missing ones from the team's default home kit,
// and the renderer falls back to the first entry, so old saves keep working and pick up their team's style.
//  jstyle jersey: sleeve stripes / three thin stripes / shoulder loops / yoke / side panels / plain      pstyle pants stripe
//  hstyle helmet stripe   hfinish helmet paint   sstyle socks   nfont / nstyle number font and outline   tvnum TV numbers   nbar name bar   trim2 third colour
const KIT_STYLES = { jstyle: ['stripes', 'triple', 'loops', 'yoke', 'panel', 'plain'], pstyle: ['solid', 'double', 'tri', 'outline', 'thin', 'none'], hstyle: ['single', 'double', 'tri', 'wide', 'none'],
  hfinish: ['gloss', 'matte', 'metal', 'satin'], sstyle: ['solid', 'stripes', 'hoops', 'twotone'], nfont: ['block', 'pro', 'italic', 'slab'], nstyle: ['outline', 'double', 'plain', 'shadow'], tvnum: ['none', 'sleeve'] };
const KIT_STYLE_NAMES = { jstyle: ['Sleeve stripes', 'Triple stripes', 'Shoulder loops', 'Yoke', 'Side panels', 'Plain'], pstyle: ['Solid', 'Double', 'Triple', 'Outlined', 'Thin', 'None'], hstyle: ['Single', 'Double', 'Triple', 'Wide', 'None'],
  hfinish: ['Gloss', 'Matte', 'Metallic', 'Satin'], sstyle: ['Solid', 'Stripes', 'Hoops', 'Two-tone'], nfont: ['Block', 'Pro', 'Italic', 'Slab'], nstyle: ['Outline', 'Double', 'Plain', 'Shadow'], tvnum: ['None', 'Sleeves'] };
function teamStyle(T) {   // a team's design identity, spread so neighbours in the league look different (weighted toward the classic looks)
  const h = (k, a) => a[(((T.id + 3) * k) >>> 0) % a.length];
  return { jstyle: h(7, ['stripes', 'panel', 'loops', 'triple', 'plain', 'yoke', 'stripes', 'panel']), pstyle: h(5, ['solid', 'double', 'tri', 'outline', 'solid', 'thin', 'double', 'none']),
    hstyle: h(3, ['single', 'double', 'none', 'tri', 'wide', 'single', 'double']), hfinish: h(11, ['gloss', 'matte', 'gloss', 'metal', 'satin', 'matte', 'gloss']), sstyle: h(13, ['solid', 'stripes', 'solid', 'hoops', 'twotone', 'stripes']),
    nfont: h(17, ['block', 'pro', 'italic', 'block', 'slab', 'pro']), nstyle: h(19, ['outline', 'double', 'outline', 'shadow', 'plain']), tvnum: h(23, ['sleeve', 'none', 'sleeve']), nbar: T.id % 5 === 2 ? 1 : 0 };
}
function teamPants(c1, c2) { return lum(c2) > 0.55 ? c2 : '#e8e8e8'; }
function defaultKits(T) {
  const tr = lum(T.c2) > 0.16 ? T.c2 : '#ffffff'; const dark = shade(T.c1, -0.55); const numH = Math.abs(lum(tr) - lum(T.c1)) > 0.3 ? tr : (lum(T.c1) > 0.5 ? '#111111' : '#ffffff');
  const shell = SHELLS3D[T.id % 4], S = teamStyle(T), t2 = lum(tr) > 0.7 ? shade(T.c1, -0.5) : '#f2f0ea';
  return [
    Object.assign({ name: 'Home', jersey: T.c1, trim: tr, pants: teamPants(T.c1, tr), pstripe: T.c1, socks: T.c1, helmet: T.hel || T.c1, hstripe: tr, hstripe2: dark, mask: lum(T.c1) > 0.6 ? '#1b1b1e' : '#d4d8de', num: numH, numOutline: shade(T.c1, -0.5), glove: tr, cleat: '#151517', logo: T.c1, logo2: tr, letter: T.name[0], shell, trim2: t2 }, S),
    Object.assign({ name: 'Away', jersey: '#f2f0ea', trim: T.c1, pants: teamPants(T.c1, tr), pstripe: T.c1, socks: T.c1, helmet: T.hel || T.c1, hstripe: tr, hstripe2: dark, mask: lum(T.c1) > 0.6 ? '#1b1b1e' : '#d4d8de', num: T.c1, numOutline: tr, glove: '#f2f0ea', cleat: '#f2f0ea', logo: T.c1, logo2: tr, letter: T.name[0], shell, trim2: lum(tr) > 0.7 ? dark : tr }, S),
    Object.assign({ name: 'Alternate', jersey: dark, trim: T.c1, pants: dark, pstripe: T.c1, socks: dark, helmet: dark, hstripe: T.c1, hstripe2: tr, mask: T.c1, num: T.c1, numOutline: tr, glove: '#151517', cleat: '#151517', logo: dark, logo2: T.c1, letter: T.name[0], shell, trim2: tr }, S, { hfinish: S.hfinish === 'gloss' ? 'matte' : S.hfinish }),
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
  // per-snap lineups with roles, snap shares and fatigue (25_rotation.js): rs = rotInit(home, away) once per game
  lineup: (team, formKey, side, ctx, rs) => teamLineup(team, formKey, side, ctx, rs), rotInit, rotStep, rotSnap, rotRest, rotEnergy, rotReport,
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
Object.assign(LG._t, { teamLineup, rotInfo, rotRoles, rotSetPreset, rotSetShare, rotSetRole, rotToggleLock, rotSetOpt, rotReset, playerEndurance, rotSimLines });
// geography, travel and scout trips (src/league/15_geo.js, the Scout travel section of 60_staff.js); travelEdge(g, tid) is a fast-sim edge in power points
LG.travelEdge = (g, tid) => geoTravelEdge(g, tid); LG.travel = (g, tid) => geoTravel(g, tid);
Object.assign(LG._t, { geoTeam, geoTravel, geoTravelEdge, geoTrips, geoCollege, geoHome, geoPipeline, scoutTrips, scoutSend, scoutRecall, scoutMove, scoutEvOpen });
