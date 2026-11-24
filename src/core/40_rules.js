// ============================================================
//  RULES: the penalty book, how a foul is enforced (yardage, spot fouls, half the distance, automatic first downs,
//  loss of down, safeties), how often the officials throw a flag, a simple expected-points model (accept or decline?),
//  crowd noise and what the weather does to kicks. Pure functions: the match (src/match/10_match.js) owns the game state.
//  Yard lines are the offense's: 0 = its own goal line, 100 = the goal it attacks.
// ============================================================
const RULES = (() => {
// side: who commits it (O offense, D defense, R return team, K kicking team). dead: before the snap (no play).
// af: automatic first down. lod: loss of down. spot: spot foul. add: personal foul tacked on to the end of the play.
const PEN = {
  FS: { n: 'False start', yds: 5, side: 'O', dead: true },
  DOG: { n: 'Delay of game', yds: 5, side: 'O', dead: true },
  ENC: { n: 'Encroachment', yds: 5, side: 'D', dead: true },
  NZI: { n: 'Neutral zone infraction', yds: 5, side: 'D', dead: true },
  OFS: { n: 'Offside', yds: 5, side: 'D' },
  ILF: { n: 'Illegal formation', yds: 5, side: 'O' },
  OH: { n: 'Holding', yds: 10, side: 'O' },
  IUH: { n: 'Illegal use of hands', yds: 10, side: 'O' },
  OPI: { n: 'Offensive pass interference', yds: 10, side: 'O' },
  IG: { n: 'Intentional grounding', yds: 10, side: 'O', lod: true },
  DH: { n: 'Defensive holding', yds: 5, side: 'D', af: true },
  IC: { n: 'Illegal contact', yds: 5, side: 'D', af: true },
  DPI: { n: 'Pass interference', yds: 0, side: 'D', af: true, spot: true },
  RTP: { n: 'Roughing the passer', yds: 15, side: 'D', af: true, add: true },
  FM: { n: 'Face mask', yds: 15, side: 'D', af: true, add: true },
  UR: { n: 'Unnecessary roughness', yds: 15, side: 'D', af: true, add: true },
  IBB: { n: 'Illegal block in the back', yds: 10, side: 'R' },
  RH: { n: 'Holding', yds: 10, side: 'R' },
  KOB: { n: 'Kickoff out of bounds', yds: 0, side: 'K' },
};
// how many flags: the per-snap odds run about twice the pro rate (only the common fouls are modelled, and a default game
// with 2-minute quarters has ~33 snaps a side), so a game ends with about 5 accepted penalties a team. Longer quarters: more.
const RATE = 2.8;
const clamp01 = v => Math.max(0, Math.min(1, v));
// discipline: awareness keeps a player from jumping the count, grabbing, or hitting late (50 -> 1.3x, 70 -> 1x, 90 -> 0.7x)
const disc = awr => Math.max(0.55, Math.min(1.45, 1 + (70 - (awr || 60)) * 0.015));

// ---------------- expected points (for accept / decline, from the offense's side) ----------------
function ep1(yl) { return -1.55 + 0.074 * yl + Math.max(0, yl - 90) * 0.05; }
function ep(yl, down, togo) {
  yl = Math.max(0.5, Math.min(99.5, yl)); const t = Math.max(0.5, togo);
  if (down >= 5) return -ep1(100 - yl);                                         // turnover on downs
  if (down === 4) { const go = ep1(yl) - 1.7 - 0.16 * (t - 1), pf = Math.max(0.05, Math.min(0.95, 1.1 - (117 - yl) / 60)), fg = yl >= 55 ? pf * 2.7 - (1 - pf) * ep1(100 - yl + 7) : -9, pnt = -ep1(100 - Math.min(80, yl + 40)); return Math.max(t <= 2 ? go + 0.6 : go, fg, pnt); }
  const dc = [0, 0.38, 0.95][down - 1] || 0, tf = down === 1 ? 0.05 * (t - 10) : (down === 2 ? 0.07 : 0.11) * (t - 3);
  return ep1(yl) - dc - tf;
}
const EP_TD = 6.65, EP_SAFETY = -3.4;

// ---------------- enforcement ----------------
// st: { yl, down, togo } before the snap. f: { code, spotYl (where it happened, offense yard line), endYl (end of the play, add fouls) }
// returns { yl, down, togo, first, yds (actual), half, safety, downs (loss of down on 4th), text }
function enforce(st, f) {
  const P = PEN[f.code] || { yds: 5, side: 'O' }, yl0 = st.yl, ltg = st.yl + st.togo, out = { half: false, first: false };
  if (P.side === 'O') {
    let from = yl0; if (f.code === 'IG' && f.spotYl != null && f.spotYl < yl0 - 10) from = f.spotYl;      // grounding from way back: at the spot
    if ((f.code === 'OH' || f.code === 'IG' || f.code === 'IUH') && f.spotYl != null && f.spotYl <= 0) return Object.assign(out, { safety: true, yl: 0, down: 1, togo: 10, yds: yl0, text: 'in the end zone: safety' });
    let yds = P.yds; if (yds > from / 2) { yds = from / 2; out.half = true; }
    out.yl = from - yds; out.yds = yl0 - out.yl;
    out.down = st.down + (P.lod ? 1 : 0); out.togo = ltg - out.yl;
    if (out.down > 4) { out.downs = true; out.text = 'loss of down: turnover on downs'; }
    else out.text = P.lod ? `loss of down, ${ordT(out.down)} down` : `repeat ${ordT(out.down)} down`;
  } else {
    let yl;
    if (P.spot) { const s = f.spotYl == null ? yl0 + 10 : f.spotYl; yl = s >= 100 ? 99 : Math.max(yl0 + 1, s); }
    else { const base = P.add && f.endYl != null ? f.endYl : yl0, room = 100 - base; let yds = P.yds; if (yds > room / 2) { yds = room / 2; out.half = true; } yl = Math.min(99, base + yds); }
    out.yl = yl; out.yds = yl - yl0;
    out.first = !!P.af || yl >= ltg - 1e-6; out.down = out.first ? 1 : st.down; out.togo = out.first ? Math.min(10, 100 - yl) : ltg - yl;
    out.text = out.first ? (P.af ? 'automatic first down' : 'first down') : `repeat ${ordT(out.down)} down`;
  }
  return out;
}
const ordT = n => ['1st', '2nd', '3rd', '4th'][n - 1] || n + 'th';
const yardsTxt = (o, P) => (P.spot ? 'spot foul' : o.half ? 'half the distance to the goal' : `${Math.round(Math.abs(o.yds))} yard${Math.round(Math.abs(o.yds)) === 1 ? '' : 's'}`);

// ---------------- how often a flag comes out ----------------
// The players commit the fouls in the engine (a hold that drags a rusher, a grab downfield, a shove, a late hit: see 'flag watch' in
// src/engine/20_play.js), each try at these odds (per chance to do it, times disc(awareness)). The officials then flag what they
// see plainly: an event's sev (0..1) is how clear it was. Tuned against qa/penalty_rates.mjs (full CPU games).
const TRY = {
  hold: 0.04, rhold: 0.05,       // a beaten blocker hangs on (per beaten block; pass pro x1.25)
  grab: 0.08,                    // a man DB being beaten downfield before the throw grabs him (one look a play)
  pi: 0.8, opi: 0.08,           // ball in the air: a beaten DB grabs an arm; a receiver shoves off a man who has position
  push: 0.02,                   // a receiver pushes off at the top of his break
  fm: 0.004, helm: 0.05,        // a hand in the face mask (high tackles); a shot to the passer's head
  ibb: 0.3,                     // a return blocker who meets a man from behind goes ahead and blocks him in the back
};
// the officials' eye: nothing marginal (below 0.4), almost everything plain
const seen = sev => clamp01((sev - 0.4) / 0.5) * 0.95;
// ev: an engine event (play.flagEv); ctx: { k }. Returns the chance the officials throw a flag.
function chance(ev, ctx) {
  const k = RATE * (ctx && ctx.k != null ? ctx.k : 1);
  if (ev.sev != null) return seen(ev.sev);
  switch (ev.k) {
    case 'beat': return clamp01((ev.pp ? 0.02 : 0.014) * k * disc(ev.awr) * (ev.ol ? 1 : 0.8));     // a beaten blocker who grabs as his man gets by
    case 'rbeat': return clamp01(0.018 * k * disc(ev.awr));                                        // return blocks
    case 'grab': return clamp01(0.03 * k * disc(ev.awr) * (ev.trail ? 1.6 : 0.6));
    case 'push': return clamp01(0.0035 * k * disc(ev.awr));                                         // the receiver shoves off a man in front of him                 // a defender with his hands on a receiver downfield, before the throw
    case 'pi': return clamp01(0.5 * k * disc(ev.awr) * (ev.catchable ? 1 : 0.25) * (ev.early ? 1.5 : 0.8) * (ev.behind ? 1.25 : 0.8));
    case 'opi': return clamp01(0.06 * k * disc(ev.awr) * (ev.catchable ? 1 : 0.4));
    case 'late': return clamp01((ev.dt > 0.55 ? 0.4 : ev.dt > 0.35 ? 0.18 : 0.05) * k * 0.55 * disc(ev.awr));   // a hit on the passer after the ball is gone
    case 'rel': return clamp01(0.06 * k * disc(ev.awr) * (ev.cv > 5 ? 1.5 : 1) * (ev.dist < 1.2 ? 1.6 : ev.dist < 2 ? 1 : 0.4));    // drove the passer into the ground as he let it go
    case 'helm': return clamp01(0.02 * k * disc(ev.awr));                                          // a shot to the passer's head
    case 'tk': return clamp01(0.0024 * k * disc(ev.awr) * (ev.h > 1.45 ? 3.5 : ev.h > 1.25 ? 1.6 : 0.6));     // grabbed the face mask making the tackle
    case 'ur': return clamp01((ev.side ? 0.15 : 0.03) * k * disc(ev.awr) * Math.min(2, (ev.J || 600) / 700));   // a shot on a runner going down, or out of bounds
    case 'ibb': return clamp01(0.09 * k * disc(ev.awr));                                           // a return blocker hitting a man from behind
    case 'grd': return clamp01(0.32 * disc(ev.awr));
  }
  return 0;
}
// pre-snap: the line jumps (offense: false start, worse on the road in a loud building; defense: offside / encroachment)
function preSnap(ctx, r) {
  const k = RATE * (ctx.k != null ? ctx.k : 1), noise = ctx.noise || 0;
  const fs = 0.0062 * k * disc(ctx.oAwr) * (1 + 1.6 * noise) * (ctx.audible ? 1 + 2.2 * noise : 1);
  const dj = 0.0095 * k * disc(ctx.dAwr) * (1 + (ctx.qbAwr - 70) * 0.012);         // a veteran QB's hard count draws them offside
  const ilf = 0.0012 * k, dog = ctx.cpuO ? 0.0004 * k * (1 + 2 * noise) * (ctx.late ? 1.6 : 1) : 0;
  let u = r();
  if ((u -= fs) < 0) return 'FS';
  if ((u -= dj) < 0) { const v = r(); return v < 0.55 ? 'OFS' : v < 0.85 ? 'NZI' : 'ENC'; }
  if ((u -= ilf) < 0) return 'ILF';
  if ((u -= dog) < 0) return 'DOG';
  return null;
}
// the hard count (your QB, before the snap): does a defensive lineman jump? c: { dAwr, oAwr (the two lines' awareness), uses (times
// already this game: they learn it), diff ('rookie'..'legend', the CPU's level), noise }. 'ENC' / 'NZI' = a free 5 yards, 'FS' = your
// own man flinched, null = nobody bit
function hardCount(c, r) {
  const lvl = { rookie: 1.6, pro: 1, allpro: 0.7, legend: 0.5 }[c.diff] || 1;
  const jump = clamp01(0.17 * lvl * disc(c.dAwr) * Math.pow(0.6, c.uses || 0)), flinch = clamp01(0.035 * disc(c.oAwr) * (1 + 1.5 * (c.noise || 0)));
  const u = r(); if (u < jump) return r() < 0.55 ? 'ENC' : 'NZI'; if (u < jump + flinch) return 'FS'; return null;
}

// ---------------- crowd noise: the home crowd when the visitors have the ball ----------------
// ctx: { awayBall, down, sd (home lead), q, clock, qlen, yl (offense yard line), dome, playoffs, fan (0..100) }
function noise(c) {
  if (!c.awayBall) return 0;
  let n = (c.dome ? 0.5 : 0.4) + ((c.fan != null ? c.fan : 60) - 60) / 250;
  n += c.down === 3 ? 0.22 : c.down === 4 ? 0.32 : c.down === 2 ? 0.06 : 0;
  const ad = Math.abs(c.sd || 0); n += ad <= 8 ? 0.12 : ad >= 21 ? -0.25 : 0;
  if (c.q >= 4) n += 0.1 + (c.clock < c.qlen * 0.3 && ad <= 8 ? 0.12 : 0);
  if (c.yl >= 80) n += 0.08; if (c.playoffs) n += 0.12;
  if ((c.sd || 0) <= -17) n -= 0.15;                                    // the home side is getting blown out: the stands empty
  return clamp01(n);
}

// ---------------- weather and kicks ----------------
// k: { along (m/s, + = at the kicker's back), cross (m/s, + = toward his left), temp (F), weather }. Yards a kick gains or loses.
function kickYds(k) { if (!k) return 0; const cold = clamp01((50 - (k.temp != null ? k.temp : 60)) / 40); return (k.along || 0) * 0.55 - cold * 4 - (k.weather === 'snow' ? 3 : k.weather === 'rain' ? 1 : 0); }
function windTxt(mph, ang) {      // ang: wind direction relative to the offense (0 = at its back)
  if (!mph || mph < 3) return 'calm';
  const a = ((ang % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI, c = Math.cos(a);
  return c > 0.7 ? 'at their back' : c < -0.7 ? 'in their face' : c > 0.25 ? 'quartering behind' : c < -0.25 ? 'quartering in' : 'across the field';
}
return { PEN, RATE, TRY, seen, enforce, yardsTxt, ordT, ep, ep1, EP_TD, EP_SAFETY, chance, preSnap, hardCount, noise, disc, kickYds, windTxt };
})();
