// Head coach skill tree. The user's coach earns XP (wins, playoff wins, a title, owner goals, awards on his team, player growth,
// draft hits), levels up, and gets one perk point per level to spend in four branches of four tiers. coachPerk(id) is the one getter
// every system checks; it is always false for CPU teams, exhibitions and a coach between jobs. Effects are modest on purpose.
// Pending perks (the system they boost is being built elsewhere): mot4 via LG.coachEdge(tid, ctx) for the match, dev2's training
// camp part, str4 (replay challenges). Their getters work now.
const CTREE = {
  mot: ['Motivator', [['mot1', 'Pep talk', 'Pep talks lift morale 50% more.'], ['mot2', 'Fresh legs', 'Players get their stamina back 12% faster.'],
    ['mot3', 'Chemistry', 'After each game, morale is never left below 40, so nobody sulks into a holdout.'], ['mot4', 'Never quit', 'Down 8 or more in the 4th quarter, your players play 2 points better.']]],
  dev: ['Developer', [['dev1', 'Teacher', 'Players 25 and under earn weekly XP 10% faster.'], ['dev2', 'Offseason program', 'Players 25 and under grow 10% more each offseason, and 25% more at training camp.'],
    ['dev3', 'Veteran care', 'Players 29 and older lose 25% less each offseason.'], ['dev4', 'Star maker', 'Players 24 and under get an extra 4% breakout chance each offseason.']]],
  str: ['Strategist', [['str1', 'Film junkie', 'Review one more play in the film room each week.'], ['str2', 'Disguise', 'CPU defenses read your repeated plays 25% slower.'],
    ['str3', 'Clock master', 'Timeouts rest your players twice as much.'], ['str4', 'Sideline genius', 'Your audibles never cause a false start in a loud stadium, and replay challenges win 15% more often.']]],
  exe: ['Executive', [['exe1', 'Negotiator', 'Free agents and extensions accept slightly lower offers.'], ['exe2', 'Cap wizard', 'One extra June 1 cut a year, and restructures convert 90% of base salary instead of 75%.'],
    ['exe3', 'Scout network', 'Scout reports get 20% closer to the truth.'], ['exe4', 'Dealmaker', 'CPU teams value your trade offers 6% more.']]],
};
const CTREE_LVL = [1, 3, 5, 8];        // coach level needed for tiers 1-4
const CTREE_RESPEC = 10;               // coach credits to reset every point
function coachXpNeed(lvl) { return 60 + 25 * (lvl - 1); }
function coachTree(c) { if (!c && L && L.teams && L.teams[L.user]) c = L.teams[L.user].coach; if (!c) return null; if (!c.ctr) c.ctr = { xp: 0, lvl: 1, pts: 1, perks: {}, log: [] }; return c.ctr; }
function coachPerk(id) { if (!L || L.ghost || L.exhibition || L.picking || !L.teams) return false; const T = L.teams[L.user]; const c = T && T.coach; return !!(c && c.ctr && c.ctr.perks[id]); }
function coachPerkInfo(id) { for (const k in CTREE) { const i = CTREE[k][1].findIndex(x => x[0] === id); if (i >= 0) return { br: k, tier: i, id, n: CTREE[k][1][i][1], eff: CTREE[k][1][i][2], lvl: CTREE_LVL[i] }; } return null; }
function coachXP(n, why) {
  if (!L || L.ghost || L.exhibition || L.picking || !(n > 0)) return; const C = coachTree(); if (!C) return; n = Math.round(n);
  C.xp += n; C.log.unshift({ y: L.year, w: L.week, n, why }); if (C.log.length > 14) C.log.length = 14;
  let up = 0; while (C.xp >= coachXpNeed(C.lvl)) { C.xp -= coachXpNeed(C.lvl); C.lvl++; C.pts++; up++; }
  if (up) { news(`Coach level ${C.lvl}: you earned ${up > 1 ? up + ' perk points' : 'a perk point'}.`); inbox('league', `Coach level ${C.lvl}`, `You reached coach level ${C.lvl} and have ${C.pts} perk point${C.pts === 1 ? '' : 's'} to spend in the coach tree.`, { actions: [{ label: 'Open coach tree', act: 'go', arg: 'ctree' }] }); }
}
function coachCanLearn(id) {
  const C = coachTree(), P = coachPerkInfo(id); if (!C || !P) return { ok: false, msg: 'Unknown perk.' }; if (C.perks[id]) return { ok: false, msg: 'Already learned.' };
  if (P.tier > 0 && !C.perks[CTREE[P.br][1][P.tier - 1][0]]) return { ok: false, msg: `Learn ${CTREE[P.br][1][P.tier - 1][1]} first.` };
  if (C.lvl < P.lvl) return { ok: false, msg: `Needs coach level ${P.lvl}.` }; if (C.pts < 1) return { ok: false, msg: 'No perk points left. Level up to earn more.' };
  return { ok: true };
}
function coachLearn(id) { const ok = coachCanLearn(id); if (!ok.ok) return ok; const C = coachTree(), P = coachPerkInfo(id); C.perks[id] = L.year; C.pts--; news(`Coach perk learned: ${P.n}.`); return { ok: true, msg: `${P.n}: ${P.eff}` }; }
function coachRespec() {
  const C = coachTree(), T = UT(); const n = Object.keys(C.perks).length; if (!n) return { ok: false, msg: 'No perks to reset.' };
  if (T.coach.pts < CTREE_RESPEC) return { ok: false, msg: `Needs ${CTREE_RESPEC} coach credits.` };
  T.coach.pts -= CTREE_RESPEC; C.pts += n; C.perks = {}; news(`You reset your coach perks (${n} point${n === 1 ? '' : 's'} back).`); return { ok: true, msg: `${n} point${n === 1 ? '' : 's'} back to spend.` };
}
// ---------- XP sources ----------
function coachXpGame(T, g, won, tie, po, opp) {   // userAfterGame (60_staff.js)
  if (!T || T.id !== L.user) return; const up = opp && teamOvr(opp) >= teamOvr(T) + 4;
  if (won) coachXP((po ? 30 : 12) + (up ? 5 : 0), po ? `Playoff win over the ${opp ? opp.name : 'opponent'}` : `Win over the ${opp ? opp.name : 'opponent'}${up ? ' (upset)' : ''}`);
  else if (tie) coachXP(4, 'Tie');
}
function coachOffseasonXP() {   // beginOffseason: the season's title, owner goals and awards
  if (L.ghost || !L.recap || L.recap.y !== L.year) return;
  if (L.recap.result === 'Champions') coachXP(60, `Won the ${L.year} championship`);
  const g = (L.recap.goals || []).filter(x => x.ok).length; if (g) coachXP(12 * g, `Owner goals met (${g})`);
  const aw = L.awards[L.awards.length - 1]; if (aw && aw.y === L.year) for (const [k, n] of [['mvp', 'MVP'], ['dpoy', 'Defensive Player of the Year'], ['roy', 'Rookie of the Year']]) { const p = L.P[aw[k]]; if (p && p.tid === L.user) coachXP(25, `${n}: ${p.fn} ${p.ln}`); }
}
function coachNewSeasonXP() {   // startNewSeason: player growth and draft hits
  if (L.ghost) return; const rep = L.offProg; if (rep && rep.y === L.year - 1) { const d = sum((rep.up || []).map(u => u.d || 0)); if (d > 0) coachXP(Math.min(50, d * 2), `Player growth (+${d} OVR)`); }
  let n = 0; for (const id of UT().roster) { const p = L.P[id]; if (!p || !p.drafted || p.drafted.seed || p.pos === 'K' || p.pos === 'P' || p.drafted.t !== L.user || p.ctHit || p.ovr < 72 || L.year - p.drafted.y > 4) continue; p.ctHit = L.year; if (n++ < 3) coachXP(20, `Draft hit: ${p.pos} ${p.fn} ${p.ln} (${p.ovr})`); }
}
// ---------- effects (called from one-line hooks) ----------
const coachMine = p => p && p.tid === L.user;
function coachRecMul(p, kind) { if (!coachMine(p)) return 1; return (coachPerk('mot2') ? 1.12 : 1) * (kind === 'timeout' && coachPerk('str3') ? 2 : 1); }   // 25_rotation.js
function coachDevMul(p, T) { return T && T.id === L.user && p.age <= 25 && coachPerk('dev1') ? 1.1 : 1; }                                              // 70_develop.js growthMult
function coachMoraleFloor(T) { if (T.id !== L.user || !coachPerk('mot3')) return; for (const id of T.roster) { const p = L.P[id]; if (p && p.mor < 40) p.mor = 40; } }   // 70_develop.js moraleAfterGame
function coachScoutMul() { return coachPerk('exe3') ? 1.2 : 1; }                                                                                         // 60_staff.js reveal
function coachGrowthAdj(p, t, g) {   // 75_growth.js seasonGrowth: offseason growth perks
  if (!t || t.id !== L.user || L.ghost) return g; const a = p.age;
  if (g.d > 0 && a <= 25 && coachPerk('dev2')) g.d *= 1.1;
  if (g.d < 0 && a >= 29 && coachPerk('dev3')) g.d *= 0.75;
  if (a <= 24 && !g.why && coachPerk('dev4') && R() < 0.04) { const b = ri(2, 5); g.d += rnd(3, 6); p.pot = clamp((p.pot || p.ovr) + b, p.ovr, 99); raiseCaps(p, b); g.why = 'breakout'; }
  return g;
}
function coachFilm(ctx) { const fl = (ctx && ctx.film) || []; return ctx && ctx.oppTid === L.user && coachPerk('str2') ? fl.map(e => Object.assign({}, e, { w: e.w * 0.75 })) : fl; }   // 80_cpu.js cpuCall
// match edge for the match to apply (LG.coachEdge): rating points for the user's team, 0 for everyone else
function coachEdge(tid, ctx) { if (tid !== L.user || !ctx) return 0; return coachPerk('mot4') && (ctx.q || 0) >= 4 && (ctx.sd || 0) <= -8 ? 2 : 0; }
