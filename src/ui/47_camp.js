// Training camp and private-workout mini-games. League side: 76_camp.js (what a score is worth).
// Each drill is a small canvas game (logical 360 x 480, drawn at 2x) built from the player's own ratings: a fast back runs faster,
// an accurate passer's throws land tighter, long-armed linemen get a wider punch window. 20-30 seconds, one finger or a mouse
// (arrow keys and space work too).

// ---------- the camp panel (Development screen) ----------
function tcampPanel() {
  if (L.ghost) return '';
  if (!tcampOpen()) return L.phase === 'offseason' && L.off !== 'fa' ? `<div class="panel mg-camp"><h3>Training camp</h3><p class="small mute">Camp opens with free agency, after the draft, and runs until your first game.</p></div>` : '';
  const T = UT(), C = tcampState(), left = tcampLeft(), val = p => growthMult(p, T) * (p.pot - p.ovr + 4);
  const ps = T.roster.map(id => L.P[id]).filter(Boolean).sort((a, b) => (C.done[b.id] ? 1 : 0) - (C.done[a.id] ? 1 : 0) || val(b) - val(a)), nd = Object.keys(C.done).length;
  const list = SUB.campAll ? ps : ps.slice(0, nd + 8);
  const row = p => { const d = C.done[p.id], ks = tcampKeys(p).map(k => ATTR_NAME[k]).join(' + ');
    return `<div class="mg-row">${bustC(p, 34)}<div class="sp"><b class="click" onclick="showPlayer(${p.id})">${esc(pname(p))}</b><div class="small mute">${p.pos} · age ${p.age} · ${TCAMP_NAMES[tcampDrill(p)]} · ${ks}</div></div>
      ${d ? `<span class="mg-sc ${d.s >= 70 ? 'hi' : d.s < 35 ? 'lo' : ''}" title="${d.ups.length ? '+' + d.ups.length + ' ' + esc([...new Set(d.ups)].map(k => ATTR_NAME[k]).join(', ')) : 'Progress saved'}">${d.s}${d.auto ? '<i>staff</i>' : ''}</span>` : p.inj > 0 ? '<span class="small mute">Injured</span>' : `<button class="sm pri" onclick="mgmOpen(${p.id},'camp')" ${left ? '' : 'disabled'}>Run drill</button>`}</div>`; };
  return `<div class="panel mg-camp"><div class="row"><h3 style="margin:0">Training camp</h3><span class="sp"></span><b class="mg-left">${left} of ${TCAMP_MAX} drills left</b></div>
    <p class="small mute">Run a player through a short drill. The better he scores, the more he develops; young players with room to grow gain the most. One drill per player.</p>
    ${list.map(row).join('')}
    <div class="row" style="margin-top:8px"><button class="sm" onclick="SUB.campAll=!SUB.campAll;render()">${SUB.campAll ? 'Show fewer' : 'Show everyone'}</button><span class="sp"></span>${left ? `<button class="sm" onclick="if(confirm('Let the staff run the rest of camp? They will get average results.')){uiRes(tcampAuto())}">Auto camp</button>` : ''}</div></div>`;
}

// ---------- drill descriptions ----------
const MGM_INFO = {
  qb: { how: 'Tap where you want the ball to land. Receivers keep moving, so lead them. Deeper completions score more.', keys: 'Tap or click', dur: 25 },
  wr: { how: 'Tap when he reaches the cone to cut. Then tap again when the shrinking ring meets his hands to make the catch.', keys: 'Tap, click or space', dur: 25 },
  rb: { how: 'Tap the left or right side to cut a lane. Miss the cones and dummies; cutting late jukes them.', keys: 'Tap a side or use the arrow keys', dur: 25 },
  line: { how: 'Wait for HUT, then tap fast. Jump early and it is a flag. Then tap when the marker is in the green to land the punch.', keys: 'Tap, click or space', dur: 24 },
  db: { how: 'Hold and slide your finger to stay in front of the receiver. Stay inside the green band as long as you can.', keys: 'Drag, move the mouse, or arrow keys', dur: 25 },
  kick: { how: 'Tap to stop the power meter high, then tap to stop the aim marker in the middle. Five kicks.', keys: 'Tap, click or space', dur: 0 },
};
const MGM = { g: null, raf: 0, pid: null, mode: null, st: 'ready', cd: 0, last: 0, on: null };

// ---------- shared drawing ----------
function mgmChalk(g, x1, y1, x2, y2, w, rnd) { g.beginPath(); g.moveTo(x1, y1); const n = 6; for (let i = 1; i <= n; i++) { const t = i / n; g.lineTo(x1 + (x2 - x1) * t + (i < n ? (rnd[i % rnd.length] - .5) * w : 0), y1 + (y2 - y1) * t + (i < n ? (rnd[(i * 3) % rnd.length] - .5) * w : 0)); } g.stroke(); }
function mgmTurf(g, G) {
  g.fillStyle = '#2e6a3a'; g.fillRect(0, 0, 360, 480);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.045)'; g.fillRect(0, i * 60, 360, 60); }
  g.strokeStyle = 'rgba(246,244,236,.5)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let y = 30, i = 0; y < 480; y += 60, i++) mgmChalk(g, -4, y + (G.wob[i] - .5) * 2, 364, y + (G.wob[i + 3] - .5) * 2, 3, G.wob);
  g.lineWidth = 1.5; for (let y = 6; y < 480; y += 12) { g.beginPath(); g.moveTo(128, y); g.lineTo(136, y); g.moveTo(224, y); g.lineTo(232, y); g.stroke(); }
}
// a player from above: shoulder pads in the jersey colour, helmet on top
function mgmMan(g, x, y, c1, c2, ang, s) {
  s = s || 1; g.save(); g.translate(x, y); g.rotate(ang || 0);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(3, 4, 14 * s, 9 * s, 0, 0, 6.283); g.fill();
  g.fillStyle = c1; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, 0, 13 * s, 8 * s, 0, 0, 6.283); g.fill(); g.stroke();
  g.fillStyle = c2; g.fillRect(-12 * s, -1.5 * s, 24 * s, 3 * s);
  g.fillStyle = c2; g.beginPath(); g.arc(0, -1 * s, 6.2 * s, 0, 6.283); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(30,30,30,.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-4 * s, -6 * s); g.lineTo(4 * s, -6 * s); g.stroke();
  g.restore();
}
function mgmBall(g, x, y, ang, s) { s = s || 1; g.save(); g.translate(x, y); g.rotate(ang || 0); g.fillStyle = '#7a4320'; g.strokeStyle = '#3d200c'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, 6 * s, 3.8 * s, 0, 0, 6.283); g.fill(); g.stroke(); g.strokeStyle = '#f1ede2'; g.beginPath(); g.moveTo(-2 * s, 0); g.lineTo(2 * s, 0); g.stroke(); g.restore(); }
function mgmText(g, s, x, y, size, col, align) { g.save(); g.font = `700 ${size}px ${CANVAS_FONT}`; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(12,18,14,.75)'; g.strokeText(s, x, y); g.fillStyle = col || '#fbf8ef'; g.fillText(s, x, y); g.restore(); }
function mgmFx(G, s, x, y, col) { G.fx.push({ s, x, y, c: col || '#fff3b0', t: 0 }); }
function mgmDrawFx(g, G) { for (const f of G.fx) mgmText(g, f.s, f.x, f.y - f.t * 26, 20, f.c); }
function mgmStepFx(G, dt) { G.fx = G.fx.filter(f => (f.t += dt) < 0.9); }
const MGM_BAD = '#ffc9b8', MGM_SCOUT = ['#d9d4c6', '#8b8f96'];

// ---------- the drills ----------
const MGM_GAMES = {
  // QB: moving targets at three depths
  qb(p, rnd, K) {
    const A = p.a, bv = 260 + A.thp * 2.4, scat = (100 - A.tha) * 0.25;
    const R = [[330, 70, 1], [235, 95, 2], [140, 120, 3]].map(([y, v, pts]) => ({ y, v, pts, x: 60 + rnd() * 240, d: rnd() < .5 ? -1 : 1, sp: v, nx: 1 + rnd() * 2 }));
    const G = { dur: 25, pts: 0, att: 0, comp: 0, ball: null, cd: 0, fx: [] };
    G.step = dt => {
      for (const r of R) { r.nx -= dt; if (r.nx <= 0) { r.nx = 1.2 + rnd() * 1.8; r.sp = r.v * (0.7 + rnd() * 0.7); if (rnd() < .3) r.d *= -1; } r.x += r.d * r.sp * dt; if (r.x < 34) { r.x = 34; r.d = 1; } if (r.x > 326) { r.x = 326; r.d = -1; } }
      G.cd -= dt; const b = G.ball; if (b) { b.t += dt; if (b.t >= b.T) { const hit = R.find(r => Math.hypot(r.x - b.tx, r.y - b.ty) <= 19); G.att++; if (hit) { G.comp++; G.pts += hit.pts; mgmFx(G, '+' + hit.pts, b.tx, b.ty - 16); } else mgmFx(G, 'Incomplete', b.tx, b.ty - 16, MGM_BAD); G.ball = null; G.cd = 0.55; } }
      mgmStepFx(G, dt);
    };
    G.down = (x, y) => { if (G.ball || G.cd > 0 || y > 408) return; const a = rnd() * 6.283, r = rnd() * scat, tx = x + Math.cos(a) * r, ty = y + Math.sin(a) * r; G.ball = { tx, ty, mx: x, my: y, t: 0, T: Math.hypot(tx - 180, ty - 440) / bv }; };
    G.draw = g => {
      mgmTurf(g, G); g.setLineDash([5, 7]); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; for (const r of R) { g.beginPath(); g.moveTo(30, r.y); g.lineTo(330, r.y); g.stroke(); } g.setLineDash([]);
      for (const r of R) { mgmMan(g, r.x, r.y, K.c1, K.c2, r.d * 1.2); mgmText(g, ['', 'SHORT', 'MID', 'DEEP'][r.pts], 334, r.y - 16, 12, 'rgba(255,255,255,.55)', 'right'); }
      mgmMan(g, 180, 440, K.c1, K.c2, 0, 1.08);
      const b = G.ball; if (b) { const f = b.t / b.T, x = 180 + (b.tx - 180) * f, y = 440 + (b.ty - 440) * f, h = Math.sin(Math.PI * f) * Math.hypot(b.tx - 180, b.ty - 440) * 0.12;
        g.strokeStyle = 'rgba(255,240,170,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(b.mx, b.my, 10, 0, 6.283); g.stroke();
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y, 5, 3, 0, 0, 6.283); g.fill(); mgmBall(g, x, y - h, Math.atan2(b.ty - 440, b.tx - 180), 1 + h / 90); }
      mgmDrawFx(g, G);
    };
    G.hud = () => `${G.pts} pts · ${G.comp}/${G.att}`;
    G.result = () => ({ score: clamp(Math.round(G.pts / 32 * 100), 0, 100), line: `${G.comp} of ${G.att} for ${G.pts} points` });
    return G;
  },
  // WR / TE: hit the cone to cut, then time the catch
  wr(p, rnd, K) {
    const A = p.a, vr = 150 + A.spd * 1.1, wb = 10 + A.rte * 0.14, wc = 6 + A.cth * 0.09;
    const G = { dur: 25, pts: 0, reps: 0, catches: 0, cuts: 0, fx: [] }; let S;
    const rep = () => { S = { ph: 'run', x: 180, y: 432, cone: 205 + rnd() * 75, side: rnd() < .5 ? -1 : 1, good: false, vx: 0, vy: -vr, ring: 0, wait: 0, bx: 0, by: 0, f: 0 }; G.reps++; };
    const cut = good => { S.ph = 'break'; S.good = good; if (good) { S.vx = S.side * vr * 0.92; S.vy = 0; } else { S.vx = S.side * vr * 0.55; S.vy = -vr * 0.45; } S.ring = 70; S.bx = S.x + S.vx * 0.622; S.by = S.y + S.vy * 0.622; };
    const done = () => { S.ph = 'wait'; S.wait = 0.55; };
    rep();
    G.step = dt => {
      if (S.ph === 'run') { S.y += S.vy * dt; if (S.y < S.cone - wb - 8) { mgmFx(G, 'Late cut', S.x, S.y - 18, MGM_BAD); cut(false); } }
      else if (S.ph === 'break') { S.x += S.vx * dt; S.y += S.vy * dt; S.ring -= 90 * dt; if (S.ring <= 0) { mgmFx(G, 'Drop', S.x, S.y - 18, MGM_BAD); done(); } }
      else { S.wait -= dt; if (S.wait <= 0) rep(); }
      mgmStepFx(G, dt);
    };
    G.down = () => {
      if (S.ph === 'run') { const e = Math.abs(S.y - S.cone); if (e <= wb) { G.pts += 1; G.cuts++; mgmFx(G, 'Sharp cut', S.x, S.y - 18); cut(true); } else { mgmFx(G, S.y > S.cone ? 'Too early' : 'Late cut', S.x, S.y - 18, MGM_BAD); cut(false); } }
      else if (S.ph === 'break') { const err = Math.abs(S.ring - 14), w = wc + (S.good ? 3 : 0); if (err <= w) { G.pts += 2; G.catches++; if (err <= w / 3) { G.pts += 1; mgmFx(G, 'Strong hands', S.x, S.y - 18); } else mgmFx(G, 'Caught', S.x, S.y - 18); } else mgmFx(G, 'Drop', S.x, S.y - 18, MGM_BAD); done(); }
    };
    G.draw = g => {
      mgmTurf(g, G); const cy = S.cone; g.fillStyle = '#f28a1c'; g.strokeStyle = '#8a4108'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(172, cy + 7); g.lineTo(188, cy + 7); g.lineTo(180, cy - 9); g.closePath(); g.fill(); g.stroke();
      mgmMan(g, 180, 466, K.c1, K.c2, 0, 1); mgmMan(g, S.x, S.y, K.c1, K.c2, S.ph === 'break' ? Math.atan2(S.vx, -S.vy) : 0);
      if (S.ph === 'break') { const f = clamp((70 - S.ring) / 56, 0, 1), x = 180 + (S.bx - 180) * f, y = 466 + (S.by - 466) * f, h = Math.sin(Math.PI * f) * 40;
        mgmBall(g, x, y - h, Math.atan2(S.by - 466, S.bx - 180));
        g.strokeStyle = 'rgba(255,236,140,.95)'; g.lineWidth = 2.5; g.beginPath(); g.arc(S.x, S.y, 14, 0, 6.283); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(S.x, S.y, Math.max(1, S.ring), 0, 6.283); g.stroke(); }
      mgmDrawFx(g, G);
    };
    G.hud = () => `${G.pts} pts · ${G.catches} catches`;
    G.result = () => ({ score: clamp(Math.round(G.pts / 44 * 100), 0, 100), line: `${G.catches} catches and ${G.cuts} clean cuts in ${G.reps} reps` });
    return G;
  },
  // RB: three-lane weave through cones and dummies
  rb(p, rnd, K) {
    const A = p.a, v0 = 150 + A.spd * 1.2, dc = clamp(0.3 - A.agi * 0.0016, 0.13, 0.3), LX = [110, 180, 250];
    const G = { dur: 25, lane: 1, x: 180, from: 180, to: 180, ct: 1, rows: [], dist: 0, next: 170, clean: 0, hit: 0, juke: 0, slow: 0, lastCut: -9, fx: [] };
    const cutTo = d => { const nl = clamp(G.lane + d, 0, 2); if (nl === G.lane) return; G.lane = nl; G.from = G.x; G.to = LX[nl]; G.ct = 0; G.lastCut = G.t; };
    G.step = dt => {
      const v = v0 * (1 + G.t / G.dur * 0.25) * (G.slow > 0 ? 0.55 : 1); G.slow -= dt; G.dist += v * dt;
      if (G.dist >= G.next) { const n = rnd() < 0.45 ? 2 : 1, bl = [0, 1, 2].sort(() => rnd() - .5).slice(0, n); G.rows.push({ y: -24, bl, kind: rnd() < .5 ? 'cone' : 'pad', done: false }); G.next = G.dist + 150 + rnd() * 90 - G.t * 1.6; }
      for (const r of G.rows) { r.y += v * dt; if (!r.done && r.y >= 380) { r.done = true; const hit = r.bl.some(l => Math.abs(G.x - LX[l]) < 30); if (hit) { G.hit++; G.slow = 0.5; mgmFx(G, 'Wrapped up', G.x, 350, MGM_BAD); } else { G.clean++; if (G.t - G.lastCut < 0.3) { G.juke++; mgmFx(G, 'Juke!', G.x, 350); } } } }
      G.rows = G.rows.filter(r => r.y < 520); G.ct = Math.min(1, G.ct + dt / dc); const s = G.ct * G.ct * (3 - 2 * G.ct); G.x = G.from + (G.to - G.from) * s;
      mgmStepFx(G, dt);
    };
    G.down = x => cutTo(x < 180 ? -1 : 1); G.key = k => { if (k === 'ArrowLeft') cutTo(-1); if (k === 'ArrowRight') cutTo(1); };
    G.draw = g => {
      g.fillStyle = '#2e6a3a'; g.fillRect(0, 0, 360, 480); const off = G.dist % 60;
      for (let i = -1; i < 9; i++) { g.fillStyle = (i + Math.floor(G.dist / 60)) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.045)'; g.fillRect(0, i * 60 + off, 360, 60); }
      g.strokeStyle = 'rgba(246,244,236,.45)'; g.lineWidth = 2; for (let i = -1; i < 9; i++) { const y = i * 60 + off; g.beginPath(); g.moveTo(0, y); g.lineTo(360, y); g.stroke(); }
      g.setLineDash([4, 8]); g.strokeStyle = 'rgba(255,255,255,.25)'; for (const x of [145, 215]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 480); g.stroke(); } g.setLineDash([]);
      for (const r of G.rows) for (const l of r.bl) { const x = LX[l];
        if (r.kind === 'cone') { g.fillStyle = '#f28a1c'; g.strokeStyle = '#8a4108'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 11, r.y + 9); g.lineTo(x + 11, r.y + 9); g.lineTo(x, r.y - 12); g.closePath(); g.fill(); g.stroke(); }
        else { g.fillStyle = '#2b5c9e'; g.strokeStyle = '#132c4d'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, r.y, 12, 10, 0, 0, 6.283); g.fill(); g.stroke(); g.fillStyle = '#e9e4d6'; g.fillRect(x - 12, r.y - 2, 24, 4); } }
      mgmMan(g, G.x, 380, K.c1, K.c2, (G.to - G.from) * (1 - G.ct) * 0.006); mgmBall(g, G.x + 9, 380, 1.2, 0.8);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 400, 180, 80); g.fillRect(180, 400, 180, 80); mgmText(g, '‹ CUT', 60, 452, 15, 'rgba(255,255,255,.4)'); mgmText(g, 'CUT ›', 300, 452, 15, 'rgba(255,255,255,.4)');
      mgmDrawFx(g, G);
    };
    G.hud = () => `${G.clean} clean · ${G.hit} hit`;
    G.result = () => { const n = G.clean + G.hit; return { score: n ? clamp(Math.round(G.clean / n * 90 + Math.min(10, G.juke * 2)), 0, 100) : 0, line: `${G.clean} of ${n} clean${G.juke ? `, ${G.juke} jukes` : ''}` }; };
    return G;
  },
  // OL / DL / FB: get off on the snap, then land the punch
  line(p, rnd, K) {
    const A = p.a, dl = p.pos === 'DE' || p.pos === 'DT', rat = dl ? A.prs : p.pos === 'FB' ? A.rbk : A.pbk, zw = (12 + rat * 0.12) / 100, accB = ((A.acc || 50) - 50) * 0.0008;
    const G = { dur: 24, pts: 0, reps: 0, wins: 0, flags: 0, rts: [], fx: [] }; let S;
    const rep = () => { S = { ph: 'set', t: 0, hut: 0.7 + rnd() * 1.3, fake: rnd() < 0.55 ? 0.25 + rnd() * 0.4 : -1, call: pick(['BLUE 42', 'GREEN 18', 'RED 80', 'OMAHA']), m: 0, md: 1, sp: 1.3 + rnd() * 0.5, zc: 0.25 + rnd() * 0.5, res: 0, out: 0 }; G.reps++; };
    const toPunch = () => { S.ph = 'punch'; S.m = 0; S.md = 1; };
    rep();
    G.step = dt => {
      S.t += dt;
      if (S.ph === 'set' && S.t >= S.hut) { S.ph = 'hut'; S.ht = S.t; }
      else if (S.ph === 'hut' && S.t - S.ht > 1.0) { mgmFx(G, 'Late off the ball', 180, 150, MGM_BAD); toPunch(); }
      else if (S.ph === 'punch') { S.m += S.md * S.sp * dt; if (S.m >= 1) { S.m = 1; S.md = -1; } if (S.m <= 0 && S.md < 0) { mgmFx(G, 'Too slow', 180, 150, MGM_BAD); S.ph = 'res'; S.res = 0.8; S.out = -1; } }
      else if (S.ph === 'res') { S.res -= dt; if (S.res <= 0) rep(); }
      mgmStepFx(G, dt);
    };
    G.down = () => {
      if (S.ph === 'set') { G.flags++; mgmFx(G, 'Flag: false start', 180, 150, MGM_BAD); S.ph = 'res'; S.res = 1.0; S.out = -1; return; }
      if (S.ph === 'hut') { const rt = S.t - S.ht - accB; G.rts.push(S.t - S.ht); const pts = rt < 0.22 ? 3 : rt < 0.32 ? 2 : rt < 0.45 ? 1 : 0; G.pts += pts; mgmFx(G, pts >= 3 ? 'Great get-off' : pts === 2 ? 'Good get-off' : pts ? 'Slow get-off' : 'Late', 180, 150, pts ? null : MGM_BAD); toPunch(); return; }
      if (S.ph === 'punch') { const e = Math.abs(S.m - S.zc); if (e <= zw / 2) { const c = e <= zw / 6; G.pts += c ? 3 : 2; G.wins++; S.out = 1; mgmFx(G, dl ? (c ? 'Beat him clean' : 'Won the rep') : (c ? 'Stoned him' : 'Won the rep'), 180, 190); } else { S.out = -1; mgmFx(G, 'Lost the rep', 180, 190, MGM_BAD); } S.ph = 'res'; S.res = 0.9; }
    };
    G.draw = g => {
      g.fillStyle = '#1f3a2a'; g.fillRect(0, 0, 360, 480); g.fillStyle = '#2e6a3a'; g.fillRect(0, 170, 360, 230); g.strokeStyle = 'rgba(246,244,236,.5)'; g.lineWidth = 2; mgmChalk(g, 0, 300, 360, 300, 2, G.wob);
      const push = S.ph === 'res' ? (0.9 - S.res) * 60 * S.out : 0, ready = S.ph === 'set' || S.ph === 'hut';
      const man = (x, face, c1, c2) => { g.save(); g.translate(x, 268); g.scale(face, 1); const low = ready ? 10 : 0;
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 34, 30, 6, 0, 0, 6.283); g.fill();
        g.fillStyle = c1; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-22, 30); g.lineTo(-16, -6 + low); g.quadraticCurveTo(-4, -20 + low, 16, -10 + low); g.lineTo(20, 4 + low); g.lineTo(6, 30); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = c2; g.beginPath(); g.arc(24, -14 + low, 10, 0, 6.283); g.fill(); g.stroke(); g.strokeStyle = 'rgba(30,30,30,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(31, -18 + low); g.lineTo(31, -8 + low); g.stroke();
        g.strokeStyle = c1; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(12, -4 + low); g.lineTo(ready ? 22 : 40, ready ? 26 : -4 + low); g.stroke(); g.restore(); };
      man(130 - push, 1, K.c1, K.c2); man(230 - push, -1, MGM_SCOUT[0], MGM_SCOUT[1]);
      const snapped = S.ph !== 'set'; mgmBall(g, snapped ? 150 - Math.min(1, (S.t - (S.ht || S.t)) * 3) * 120 : 178, snapped ? 296 - Math.min(1, (S.t - (S.ht || S.t)) * 3) * 30 : 296, 0, 1.1);
      const call = S.ph === 'set' ? (S.fake > 0 && S.t > S.fake && S.t < S.fake + 0.45 ? S.call + '!' : 'SET...') : S.ph === 'hut' ? 'HUT!' : '';
      if (call) { g.fillStyle = 'rgba(250,247,238,.95)'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(110, 60, 140, 46, 8) : g.rect(110, 60, 140, 46); g.fill(); g.stroke(); g.fillStyle = '#1b1b1b'; g.font = `700 26px ${CANVAS_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(call, 180, 85); }
      // punch meter
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(40, 420, 280, 22); g.fillStyle = '#4fc36b'; g.fillRect(40 + (S.zc - zw / 2) * 280, 420, zw * 280, 22); g.fillStyle = '#8fe8a3'; g.fillRect(40 + (S.zc - zw / 6) * 280, 420, zw / 3 * 280, 22);
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.strokeRect(40, 420, 280, 22);
      if (S.ph === 'punch' || S.ph === 'res') { const x = 40 + S.m * 280; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, 418); g.lineTo(x - 7, 406); g.lineTo(x + 7, 406); g.closePath(); g.fill(); g.fillRect(x - 1.5, 418, 3, 26); }
      mgmText(g, 'PUNCH', 40, 458, 13, 'rgba(255,255,255,.5)', 'left');
      mgmDrawFx(g, G);
    };
    G.hud = () => `${G.pts} pts · ${G.wins}/${Math.max(0, G.reps - (S.ph === 'res' ? 0 : 1))} reps`;
    G.result = () => { const avg = G.rts.length ? G.rts.reduce((s, v) => s + v, 0) / G.rts.length : 0; return { score: clamp(Math.round(G.pts / 38 * 100), 0, 100), line: `won ${G.wins} reps${G.rts.length ? `, ${avg.toFixed(2)}s average get-off` : ''}${G.flags ? `, ${G.flags} false start${G.flags > 1 ? 's' : ''}` : ''}` }; };
    return G;
  },
  // CB / S / LB: mirror the receiver (linebackers read the back)
  db(p, rnd, K) {
    const A = p.a, vD = 120 + A.spd * 1.1, aD = 500 + A.agi * 9, lb = p.pos === 'LB', vR = lb ? 175 : 205;
    const G = { dur: 25, rx: 180, rv: 0, rtx: 180, rn: 0.6, dx: 180, dv: 0, tx: 180, acc: 0, kl: 0, kr: 0, fx: [], inb: 0 };
    G.step = dt => {
      G.rn -= dt; if (G.rn <= 0) { G.rtx = 50 + rnd() * 260; G.rn = 0.35 + rnd() * 0.8; if (rnd() < 0.25) { G.rv = -G.rv * 0.6; mgmFx(G, 'Juke', G.rx, 116, '#ffe08a'); } }
      const want = clamp((G.rtx - G.rx) * 4, -vR, vR); G.rv += clamp(want - G.rv, -1100 * dt, 1100 * dt); G.rx = clamp(G.rx + G.rv * dt, 30, 330);
      if (G.kl || G.kr) G.tx = G.dx + (G.kr - G.kl) * 400;
      const dw = clamp((G.tx - G.dx) * 5, -vD, vD); G.dv += clamp(dw - G.dv, -aD * dt, aD * dt); G.dx = clamp(G.dx + G.dv * dt, 24, 336);
      const d = Math.abs(G.dx - G.rx); G.inb = d < 20 ? 1 : d < 45 ? 0.5 : 0; G.acc += G.inb * dt; mgmStepFx(G, dt);
    };
    G.down = x => { G.tx = x; }; G.move = (x, y, held) => { if (held || MGM.mouse) G.tx = x; };
    G.key = (k, dn) => { if (k === 'ArrowLeft') G.kl = dn ? 1 : 0; if (k === 'ArrowRight') G.kr = dn ? 1 : 0; };
    G.draw = g => {
      mgmTurf(g, G); g.fillStyle = G.inb >= 1 ? 'rgba(120,240,150,.28)' : G.inb ? 'rgba(255,220,120,.2)' : 'rgba(255,120,100,.14)'; g.fillRect(G.rx - 20, 0, 40, 480);
      g.setLineDash([4, 6]); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(G.rx, 150); g.lineTo(G.rx, 300); g.stroke(); g.setLineDash([]);
      mgmMan(g, G.rx, 150, MGM_SCOUT[0], MGM_SCOUT[1], Math.PI + clamp(G.rv / 400, -0.6, 0.6)); if (lb) mgmBall(g, G.rx + 10, 150, 1.2, 0.8);
      mgmMan(g, G.dx, 300, K.c1, K.c2, clamp(G.dv / 500, -0.5, 0.5));
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(30, 440, 300, 10); g.fillStyle = '#7fe39a'; g.fillRect(30, 440, 300 * clamp(G.acc / Math.max(0.5, G.t || 0.5), 0, 1), 10);
      mgmText(g, 'IN PHASE', 30, 428, 13, 'rgba(255,255,255,.55)', 'left');
      mgmDrawFx(g, G);
    };
    G.hud = () => `${Math.round(G.acc / Math.max(0.01, G.t) * 100)}% in phase`;
    G.result = () => ({ score: clamp(Math.round(G.acc / G.dur * 100), 0, 100), line: `in phase ${Math.round(G.acc / G.dur * 100)}% of the drill` });
    return G;
  },
  // K / P: power, then aim. Five kicks
  kick(p, rnd, K) {
    const A = p.a, punt = p.pos === 'P', maxR = 45 + A.kpw * 0.2, aimSp = 0.9 + (100 - A.kac) * 0.012, aimW = 0.22 + A.kac * 0.0018, D = [33, 40, 45, 50, 55];
    const G = { dur: 0, n: 0, ph: 'power', m: 0, md: 1, pw: 0, aim: 0, pts: 0, makes: 0, anim: 0, last: null, punts: [], fx: [] };
    const next = () => { G.n++; if (G.n >= 5) { G.over = true; return; } G.ph = 'power'; G.m = 0; G.md = 1; };
    G.step = dt => {
      if (G.ph === 'power') { G.m += G.md * 1.15 * dt; if (G.m >= 1) { G.m = 1; G.md = -1; } if (G.m <= 0) { G.m = 0; G.md = 1; } }
      else if (G.ph === 'aim') { G.m += G.md * aimSp * dt; if (G.m >= 1) { G.m = 1; G.md = -1; } if (G.m <= -1) { G.m = -1; G.md = 1; } }
      else if (G.ph === 'fly') { G.anim += dt; if (G.anim >= 1.1) { G.ph = 'res'; G.anim = 0; mgmFx(G, G.last.txt, 180, 200, G.last.good ? null : MGM_BAD); } }
      else if (G.ph === 'res') { G.anim += dt; if (G.anim >= 0.7) next(); }
      mgmStepFx(G, dt);
    };
    G.down = () => {
      if (G.ph === 'power') { G.pw = G.m; G.ph = 'aim'; G.m = -1; G.md = 1; return; }
      if (G.ph !== 'aim') return; G.aim = G.m; G.ph = 'fly'; G.anim = 0; const ae = Math.abs(G.aim);
      if (!punt) { const dist = D[G.n], carry = G.pw * maxR, good = carry >= dist && ae <= aimW; if (good) { G.makes++; G.pts += 16 + 4 * (1 - ae / aimW); }
        G.last = { good, txt: good ? `Good from ${dist}` : carry < dist ? 'Short' : G.aim < 0 ? 'Wide left' : 'Wide right', dist, carry }; }
      else { const dist = Math.round(30 + A.kpw * 0.22 * G.pw + G.pw * 6), hang = 3.3 + G.pw * 1.5 - ae * 0.9, v = clamp((dist - 36) * 1.1 + (hang - 3.8) * 8, 0, 20); G.pts += v; G.punts.push(dist);
        G.last = { good: v >= 10, txt: `${dist} yd, ${hang.toFixed(1)}s hang`, dist }; }
    };
    G.draw = g => {
      g.fillStyle = '#1c3324'; g.fillRect(0, 0, 360, 480); g.fillStyle = '#2e6a3a'; g.beginPath(); g.moveTo(130, 90); g.lineTo(230, 90); g.lineTo(380, 480); g.lineTo(-20, 480); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(246,244,236,.45)'; g.lineWidth = 1.6; for (let i = 0; i < 7; i++) { const t = i / 7, y = 90 + Math.pow(t, 1.6) * 390, hw = 50 + (y - 90) / 390 * 150; g.beginPath(); g.moveTo(180 - hw, y); g.lineTo(180 + hw, y); g.stroke(); }
      const dist = punt ? 0 : D[Math.min(G.n, 4)], sc = punt ? 0.8 : clamp(1.25 - dist / 70, 0.45, 1), uy = 92;
      if (!punt) { g.strokeStyle = '#f2c230'; g.lineWidth = 4 * sc; g.lineCap = 'round'; g.beginPath(); g.moveTo(180, uy + 40 * sc); g.lineTo(180, uy + 14 * sc); g.moveTo(180 - 34 * sc, uy + 14 * sc); g.lineTo(180 + 34 * sc, uy + 14 * sc); g.moveTo(180 - 34 * sc, uy + 14 * sc); g.lineTo(180 - 34 * sc, uy - 50 * sc); g.moveTo(180 + 34 * sc, uy + 14 * sc); g.lineTo(180 + 34 * sc, uy - 50 * sc); g.stroke();
        mgmText(g, `${dist} YD`, 180, 40, 22); }
      else mgmText(g, `PUNT ${G.n + 1}`, 180, 40, 22);
      mgmMan(g, 180, 430, K.c1, K.c2, 0, 1.1);
      if (G.ph === 'fly' || G.ph === 'res') { const f = G.ph === 'fly' ? G.anim / 1.1 : 1, L2 = G.last, tx = 180 + G.aim * (punt ? 90 : 70), ty = punt ? 110 : (L2.good || L2.carry >= L2.dist ? uy - 10 : 140 + (1 - L2.carry / L2.dist) * 160);
        mgmBall(g, 180 + (tx - 180) * f, 418 + (ty - 418) * f - Math.sin(Math.PI * f) * 120 * (0.4 + G.pw * 0.6), f * 9, 1.3 - f * 0.7); }
      else mgmBall(g, 180, 412, 0, 1.2);
      // meters
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(326, 190, 20, 220); const ph = G.ph === 'power' ? G.m : G.pw;
      const need = punt ? 0.75 : clamp(dist / maxR, 0, 1); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(326, 410 - need * 220, 20, 2);
      g.fillStyle = ph >= need ? '#7fe39a' : '#f2c230'; g.fillRect(326, 410 - ph * 220, 20, ph * 220); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.strokeRect(326, 190, 20, 220); mgmText(g, 'PWR', 336, 424, 12, 'rgba(255,255,255,.55)');
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(60, 456, 240, 14); g.fillStyle = '#4fc36b'; g.fillRect(180 - aimW * 120, 456, aimW * 240, 14);
      if (G.ph !== 'power') { const x = 180 + (G.ph === 'aim' ? G.m : G.aim) * 120; g.fillStyle = '#fff'; g.fillRect(x - 2, 452, 4, 22); }
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.strokeRect(60, 456, 240, 14);
      mgmDrawFx(g, G);
    };
    G.hud = () => punt ? `Punt ${Math.min(5, G.n + 1)} of 5 · ${Math.round(G.pts)} pts` : `Kick ${Math.min(5, G.n + 1)} of 5 · ${G.makes} good`;
    G.result = () => ({ score: clamp(Math.round(G.pts), 0, 100), line: punt ? `averaged ${Math.round(G.punts.reduce((s, v) => s + v, 0) / Math.max(1, G.punts.length))} yards` : `${G.makes} of 5 field goals` });
    return G;
  },
};

// ---------- the runner ----------
function mgmColors(p, mode) { if (mode === 'wo' || p.tid == null) return { c1: '#5d6672', c2: '#e8e5dc' }; const t = L.teams[p.tid]; return { c1: t ? t.c1 : '#1d4f91', c2: lum(t ? t.c2 : '#fff') > 0.35 ? t.c2 : '#e8e5dc' }; }
function mgmOpen(pid, mode) {
  const p = L.P[pid]; if (!p) return;
  if (mode === 'camp' && (!tcampOpen() || tcampLeft() <= 0)) { toast(tcampOpen() ? 'Camp is full.' : 'Training camp is closed.'); return; }
  if (mode === 'wo' && (!pwoOpen() || pwoLeft() <= 0)) { toast('No private workouts left.'); return; }
  mgmStop(); const kind = tcampDrill(p), I = MGM_INFO[kind];
  modal(`<div class="mg"><div class="mg-hd">${bustC(p, 44)}<div class="sp"><span class="pos">${mode === 'wo' ? 'Private workout' : 'Training camp'}</span><b>${esc(pname(p))}</b><div class="small mute">${p.pos} · ${TCAMP_NAMES[kind]}${kind === 'db' && p.pos === 'LB' ? ' (read the back)' : ''}</div></div><button class="sm ghost" onclick="mgmClose()" aria-label="Close">✕</button></div>
    <p class="small mg-how">${I.how}</p>
    <div class="mg-bar"><span id="mgT">${I.dur ? I.dur + 's' : '5 kicks'}</span><b id="mgS">Ready</b></div>
    <div class="mg-wrap"><canvas id="mgCv" width="720" height="960" aria-label="Drill"></canvas><div class="mg-ov" id="mgOv"><button class="pri" onclick="mgmStart()">Start drill</button><span class="small">${I.keys}</span></div></div></div>`, 'mgbox');
  const rnd = seededRng(((pid * 2654435761) ^ Date.now()) >>> 0), G = MGM_GAMES[kind](p, rnd, mgmColors(p, mode));
  G.t = 0; G.wob = Array.from({ length: 12 }, () => rnd()); Object.assign(MGM, { g: G, pid, mode, kind, st: 'ready', cd: 0, last: 0, mouse: false, held: false });
  const cv = document.getElementById('mgCv'), pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 360, (e.clientY - r.top) / r.height * 480]; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); MGM.mouse = e.pointerType === 'mouse'; MGM.held = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { } if (MGM.st === 'play' && G.down) G.down(...pt(e)); });
  cv.addEventListener('pointermove', e => { if (MGM.st === 'play' && G.move) { MGM.mouse = e.pointerType === 'mouse'; G.move(...pt(e), MGM.held); } });
  const up = () => { MGM.held = false; if (G.up) G.up(); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  MGM.on = e => { if (!document.getElementById('mgCv')) return; const k = e.key, dn = e.type === 'keydown'; if (k === ' ' || k === 'Enter') { if (dn) { e.preventDefault(); if (MGM.st === 'ready') mgmStart(); else if (MGM.st === 'play' && G.down && !e.repeat) G.down(180, 240); } return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); if (MGM.st === 'play' && G.key && !(dn && e.repeat)) G.key(k, dn); } };
  window.addEventListener('keydown', MGM.on); window.addEventListener('keyup', MGM.on);
  mgmFrame(true);
}
function mgmStart() { if (MGM.st !== 'ready') return; const ov = document.getElementById('mgOv'); if (ov) ov.hidden = true; MGM.st = 'count'; MGM.cd = 1.6; MGM.last = performance.now(); MGM.raf = requestAnimationFrame(mgmLoop); }
function mgmLoop(now) {
  const cv = document.getElementById('mgCv'); if (!cv || !MGM.g) { mgmStop(); return; }
  let dt = Math.min(0.25, (now - MGM.last) / 1000); MGM.last = now; const G = MGM.g;
  if (MGM.st === 'count') { MGM.cd -= dt; if (MGM.cd <= 0) MGM.st = 'play'; }
  else if (MGM.st === 'play') { while (dt > 1e-4) { const h = Math.min(1 / 60, dt); dt -= h; G.t += h; G.step(h); if ((G.dur && G.t >= G.dur) || G.over) { mgmFrame(); mgmFinish(); return; } } }      // small fixed steps: same game on a slow phone
  mgmFrame(); MGM.raf = requestAnimationFrame(mgmLoop);
}
function mgmFrame(idle) {
  const cv = document.getElementById('mgCv'); if (!cv || !MGM.g) return; const g = cv.getContext('2d'), G = MGM.g; g.setTransform(2, 0, 0, 2, 0, 0); G.draw(g);
  if (MGM.st === 'count') { g.fillStyle = 'rgba(10,14,12,.35)'; g.fillRect(0, 0, 360, 480); mgmText(g, String(Math.ceil(MGM.cd / 0.55)), 180, 230, 84); }
  if (idle) { g.fillStyle = 'rgba(10,14,12,.45)'; g.fillRect(0, 0, 360, 480); }
  const t = document.getElementById('mgT'), s = document.getElementById('mgS');
  if (t && G.dur) t.textContent = Math.max(0, Math.ceil(G.dur - G.t)) + 's'; if (s && MGM.st !== 'ready') s.textContent = G.hud();
}
function mgmFinish() {
  MGM.st = 'done'; const G = MGM.g, res = G.result(), p = L.P[MGM.pid], r = MGM.mode === 'wo' ? pwoApply(MGM.pid, res.score) : tcampApply(MGM.pid, res.score);
  const lab = res.score >= 85 ? 'Outstanding' : res.score >= 65 ? 'Good day' : res.score >= 40 ? 'Average' : 'Rough day'; saveGame();
  const ov = document.getElementById('mgOv'); if (!ov) return; ov.hidden = false; ov.classList.add('res');
  ov.innerHTML = `<div class="mg-res"><span class="pos">${lab}</span><b>${res.score}</b><div class="small">${esc(res.line)}</div><p class="small">${esc(r.msg || '')}</p><button class="pri" onclick="mgmClose(true)">Done</button></div>`;
}
function mgmStop() { if (MGM.raf) cancelAnimationFrame(MGM.raf); MGM.raf = 0; if (MGM.on) { window.removeEventListener('keydown', MGM.on); window.removeEventListener('keyup', MGM.on); MGM.on = null; } }
function mgmClose(done) { const pid = MGM.pid, mode = MGM.mode, st = MGM.st; mgmStop(); MGM.g = null; closeModal(); if (done || st === 'done') { if (mode === 'wo') { render(); showPlayer(pid); } else render(); } }
