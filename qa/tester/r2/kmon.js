// Read-only observer (round 2): kick animations (kind, duration, ball on screen, camera override) and the banner timeline.
(() => {
  if (window.__km) return;
  const K = window.__km = { kicks: [], bans: [], stages: [], cur: null, lastBan: '', lastStage: '' };
  function f() {
    requestAnimationFrame(f);
    const g = MATCH._G; const now = performance.now() / 1000;
    if (!g) { if (K.cur && !K.cur.t1) { K.cur.t1 = now; K.cur.endedBy = 'game closed'; K.cur.camOvAfter = !!R3D.camOverride; } return; }
    if (g.stage !== K.lastStage) { K.lastStage = g.stage; K.stages.push({ t: +now.toFixed(2), stage: g.stage, q: g.q, clock: +g.clock.toFixed(2) }); if (K.stages.length > 400) K.stages.shift(); }
    const ka = g.kickAnim;
    if (ka && (!K.cur || K.cur._ka !== ka)) { K.cur = { kind: ka.kind, dur: +ka.dur.toFixed(2), t0: +now.toFixed(2), q: g.q, clock: +g.clock.toFixed(2), frames: 0, ballOn: 0, ballMaxY: 0, camOv: 0, start: ka.start, end: ka.end, banDuring: [] }; Object.defineProperty(K.cur, '_ka', { value: ka, enumerable: false }); K.kicks.push(K.cur); }
    if (K.cur && ka && K.cur._ka === ka) {
      K.cur.frames++; if (R3D.camOverride) K.cur.camOv++;
      const b = g.play && g.play.ball; if (b && b.p) { K.cur.ballMaxY = Math.max(K.cur.ballMaxY, +b.p.y.toFixed(2)); const s = R3D.project(b.p.x, b.p.y, b.p.z); if (!s.behind && s.x >= 0 && s.x <= innerWidth && s.y >= 0 && s.y <= innerHeight) K.cur.ballOn++; }
      K.cur.paused = (K.cur.paused || 0) + (g.paused ? 1 : 0);
    }
    if (K.cur && !K.cur.t1 && (!ka || K.cur._ka !== ka)) { K.cur.t1 = +now.toFixed(2); K.cur.real = +(now - K.cur.t0).toFixed(2); K.cur.camOvAfter = !!R3D.camOverride; }
    const bn = document.querySelector('.ban.show'); const bt = bn ? bn.textContent : '';
    if (bt !== K.lastBan) { K.lastBan = bt; if (bt) { K.bans.push({ t: +now.toFixed(2), text: bt, kickAnim: !!ka, stage: g.stage }); if (K.bans.length > 400) K.bans.shift(); if (ka && K.cur) K.cur.banDuring.push(bt); } }
  }
  requestAnimationFrame(f);
})();
