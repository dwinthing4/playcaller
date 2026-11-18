// Injected into the page by the tester scripts (read-only observer of MATCH._G; changes no game state).
(() => {
  if (window.__mon) return;
  const M = window.__mon = { log: [], plays: [], anomalies: [], last: null, lastPlay: null, cur: null, frames: 0, slow: 0, maxFrame: 0, prevT: 0 };
  const snap = g => ({ stage: g.stage, q: g.q, clock: +g.clock.toFixed(2), runoff: +(g.runoff || 0).toFixed(2), down: g.down, togo: +g.togo.toFixed(2), yl: +g.yl.toFixed(2), poss: g.poss, score: Object.assign({}, g.score), to: Object.assign({}, g.to), pat: g.pat ? (g.pat.two ? 'two' : 'pat') : null, sim: g.sim, over: g.over, kickNext: g.kickNext });
  const prevPos = new Map();
  function tick(now) {
    requestAnimationFrame(tick);
    const dtf = M.prevT ? (now - M.prevT) / 1000 : 0; M.prevT = now; M.frames++; if (dtf > 0.05) M.slow++; if (dtf > M.maxFrame && M.frames > 30) M.maxFrame = dtf;
    const g = MATCH._G; if (!g) { M.last = null; return; }
    const s = snap(g);
    if (!M.last || M.last.stage !== s.stage) M.log.push({ t: +(performance.now() / 1000).toFixed(2), ban: (document.querySelector('.ban.show') || {}).textContent || '', ...s });
    // quarter clock must never go up inside a quarter
    if (M.last && M.last.q === s.q && s.clock > M.last.clock + 0.01) M.anomalies.push({ kind: 'clockUp', from: M.last.clock, to: s.clock, q: s.q, stage: s.stage });
    if (M.last && (s.score[g.hid] < M.last.score[g.hid] || s.score[g.aid] < M.last.score[g.aid])) M.anomalies.push({ kind: 'scoreDown', s });
    M.last = s;
    const pl = g.play;
    if (pl && pl !== M.lastPlay) { M.lastPlay = pl; prevPos.clear(); M.cur = { pre: s, op: pl.op && pl.op.name, opType: pl.op && pl.op.type, dp: pl.dp && pl.dp.name, user: g.userSide, res: null, maxSpd: 0, teleports: 0, ballOff: 0, ballOffMax: 0, stillD: 0, pre_t: performance.now() }; M.plays.push(M.cur); }
    if (!pl || !M.cur) return;
    if (pl.result && !M.cur.res) { const r = pl.result; M.cur.res = { type: r.type, text: r.text, yards: +(r.yards || 0).toFixed(2), spot: +(r.spotZ / YD).toFixed(2), td: !!r.td, sack: !!r.sack, safety: !!r.safety, to: r.turnover, defTD: !!r.defTD, t: +(r.t || 0).toFixed(2), broken: r.broken, bounces: r.bounces, contacts: r.contacts, contactYd: r.contactZ != null ? +((r.contactZ - pl.losZ) / YD).toFixed(2) : null, airYds: r.airYds != null ? +r.airYds.toFixed(1) : null, kind: r.kind, catcher: r.catcher, carrierPid: r.carrier, unit: r.unit, clockStop: !!r.clockStop, pressured: r.pressured, nTk: (r.tacklers || []).length, bigHit: Math.round(r.bigHit || 0) }; M.cur.clockAtWhistle = +g.clock.toFixed(2); }
    if (pl.phase !== 'live' || g.paused) { prevPos.clear(); return; }
    const sp = g.speed || 1;
    for (const p of pl.players) {
      const q = prevPos.get(p.id); prevPos.set(p.id, { x: p.p.x, z: p.p.z, t: pl.t });
      if (!q || pl.t - q.t <= 0) continue; const d = Math.hypot(p.p.x - q.x, p.p.z - q.z), v = d / (pl.t - q.t);
      if (v > M.cur.maxSpd) M.cur.maxSpd = +v.toFixed(2);
      if (d > 1.2 || v > 15) { M.cur.teleports++; if (M.anomalies.length < 200) M.anomalies.push({ kind: 'teleport', who: p.id, pos: p.posName, d: +d.toFixed(2), v: +v.toFixed(1), liveT: +pl.liveT.toFixed(2), play: M.plays.length }); }
    }
    const c = pl.carrier;
    if (c && pl.ball && pl.ball.state === 'held' && pl.ball.p && pl.liveT > 0.4) { const d = Math.hypot(pl.ball.p.x - c.p.x, pl.ball.p.z - c.p.z); if (d > M.cur.ballOffMax) M.cur.ballOffMax = +d.toFixed(2); if (d > 1.0) M.cur.ballOff++; }
  }
  requestAnimationFrame(tick);
})();
