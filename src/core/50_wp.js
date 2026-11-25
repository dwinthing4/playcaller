// ============================================================
//  WIN PROBABILITY: the home team's chance to win from the game state. Inputs: the score, the time left (as a share of the
//  game, so 1-minute and 15-minute quarters read alike), who has the ball, where, the down and distance (through the
//  expected-points model RULES.ep), timeouts, a pending kickoff or try, the pregame edge (team strength + home field, the
//  hub's pregame number), the leader running out the clock, sudden-death overtime. Node-safe (no DOM).
//  Calibrated on fast-sim games (same clock rules): node qa/wp_calib.cjs prints the table (and --fit refits WP.K).
//  WP.of(state) -> 0..1 (a tie counts half). wpNow(G) -> home win % (0-100) for a live match (G = MATCH._G).
// ============================================================
const WP = (() => {
  // sg: sd of the final margin over a whole game at each quarter length (seconds); sp: sd of what the current possession adds;
  // dp: plays a drive burns; ek: points of final margin per point of pregame power difference (teamPower off+def) and eh: home field
  // in points, both by quarter length; to: points per timeout in hand (second half); so: overtime spread
  const K = {"sg":[[60,7.8],[120,10.83],[180,12.28],[300,13.77],[900,18.49]],"sk":0.95,"sp":3.2,"dp":0.5,"ek":[[60,0.447],[120,0.775],[180,0.998],[300,1.292],[900,2.151]],"eh":[[60,0.37],[120,0.39],[180,0.45],[300,0.65],[900,1.27]],"to":0.2,"so":4};      // qa/wp_calib.cjs 1500 --fit, 6500 games
  const erf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
  const phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  // a table by quarter length, read between its rows on a log scale (and past the ends on a square root)
  function tab(T, qlen) {
    if (qlen <= T[0][0]) return T[0][1] * Math.sqrt(qlen / T[0][0]);
    for (let i = 1; i < T.length; i++) if (qlen <= T[i][0]) { const u = Math.log(qlen / T[i - 1][0]) / Math.log(T[i][0] / T[i - 1][0]); return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * u; }
    const l = T[T.length - 1]; return l[1] * Math.sqrt(qlen / l[0]);
  }
  const sigG = qlen => tab(K.sg, qlen) * (K.sk || 1);
  // the pregame edge in points of final margin for a whole game: grows with the number of possessions (the variance)
  function edgePts(m, home, qlen) { return (tab(K.ek, qlen) * (m || 0) + (home ? tab(K.eh, qlen) : 0)); }
  const epOf = (yl, down, togo) => (typeof RULES !== 'undefined' && RULES.ep ? RULES.ep(yl, down, togo) : -1.55 + 0.074 * yl - [0, 0.38, 0.95, 1.6][Math.min(4, down) - 1]);
  // s = { hs, as, q, clock, qlen, poss:'h'|'a', yl, down, togo, toH, toA, kick:'h'|'a'|null (kicks off next), pat:'h'|'a'|null, edge (home pts, whole game), po (no ties) }
  function of(s) {
    const qlen = s.qlen || 120, RUN = cl(qlen * 0.035, 3, 22), play = RUN + 5.5, Tg = 4 * qlen, sd = (s.hs || 0) - (s.as || 0);
    const ot = s.q >= 5, T = ot ? Math.max(0, s.clock) : Math.max(0, (4 - s.q) * qlen + s.clock);
    // the ball: home-side value of the possession (a pending try, a pending kickoff or the snap)
    let v = 0, holder = null;
    if (s.pat) { v = (s.pat === 'h' ? 1 : -1) * (0.95 - 0.45); }
    else if (s.kick) { v = (s.kick === 'h' ? -1 : 1) * 0.45; holder = s.kick === 'h' ? 'a' : 'h'; }
    else if (s.poss) { holder = s.poss; v = (s.poss === 'h' ? 1 : -1) * epOf(s.yl, s.down, s.togo); }
    if (!ot && s.q <= 2) { const half = (2 - s.q) * qlen + s.clock; v *= cl(half / (2.5 * play), 0, 1); }       // the half ends: the drive does not carry over
    if (ot) {      // sudden death: the next score wins; the regular season can end tied
      const e = (s.edge || 0) * 0.08, pf = phi((v + e) / K.so), pTie = s.po ? 0 : Math.exp(-T / (3.2 * K.dp * play));
      return cl(pTie * 0.5 + (1 - pTie) * pf, 0.003, 0.997);
    }
    const left = T / Tg, mu0 = sd + (s.edge || 0) * left + (s.q >= 3 ? K.to * ((s.toH || 0) - (s.toA || 0)) * Math.min(1, 2 * (1 - left)) : 0);
    // the drive in progress burns time; the rest of the game is a random walk with the game's variance per second
    const D = Math.min(T, K.dp * play), pc = cl(T / play, 0.2, 1), sg = sigG(qlen);
    const sig = Math.sqrt(K.sp * K.sp * pc + sg * sg / Tg * Math.max(0, T - D) + 0.25), mu = mu0 + v * pc;
    let p = phi(mu / sig);
    // the leader has the ball and can kneel it out (the other side's timeouts stop the clock)
    if (holder && !s.pat && !s.kick && s.q >= 4) {
      const lead = holder === 'h' ? sd : -sd, oppTO = holder === 'h' ? s.toA || 0 : s.toH || 0;
      if (lead > 0) { const burn = Math.max(0, (4 - (s.down || 1)) * (RUN + 2) + 2 - oppTO * RUN), x = (T - burn) / (2 * play);
        if (x < 1) { const pk = holder === 'h' ? 0.997 : 0.003; p = x <= 0 ? pk : pk + (p - pk) * x; } }
    }
    return cl(p, 0.002, 0.998);
  }
  // a live match: G from MATCH (score/q/clock/poss/yl/down/togo/to/pat/kickNext keyed by team id)
  function stateOf(G) {
    const h = G.hid, a = G.aid, side = t => (t == null ? null : t === h ? 'h' : 'a');
    const clock = Math.max(0, G.clock - (G.runoff || 0));
    return { hs: G.score[h], as: G.score[a], q: G.q, clock, qlen: G.qlen, poss: side(G.poss), yl: G.yl, down: Math.min(4, G.down || 1), togo: G.togo, toH: G.to[h], toA: G.to[a],
      kick: G.pat ? null : side(G.kickNext), pat: G.pat && !G.pat.done ? side(G.pat.tid) : null, edge: G.wpE || 0, po: !!G.playoffs };
  }
  return { K, of, stateOf, sigG, edgePts, phi };
})();
// home win % now (0-100, rounded to 0.1). The pregame edge is worked out once per game (LG.wpEdge: team power, home field).
function wpNow(G) {
  if (!G || !G.score) return 50;
  if (G.wpE == null) { let m = 0, home = !(G.g && G.g.neutral); try { if (typeof LG !== 'undefined' && LG.wpPower) m = LG.wpPower(G.hid, G.aid); } catch (e) { m = 0; } G.wpE = WP.edgePts(m, home, G.qlen || 120); }
  if (G.over || G.stage === 'final') { const d = G.score[G.hid] - G.score[G.aid]; return d > 0 ? 100 : d < 0 ? 0 : 50; }
  return Math.round(WP.of(WP.stateOf(G)) * 1000) / 10;
}
