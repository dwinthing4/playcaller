// 2D art for menus: portraits (busts) and team logos. Ported from Playcaller (v3 portraits, v3 logos).
// ---------------- portraits: shared pieces (player busts and staff portraits draw the same head) ----------------
// lk fields: sk hs hc head jaw ear eye ec bw nose mo bd bl bt hb tat ta er fr sc ex ey eb ns aL aR ac ht hx (documented in league/10_data.js)
function BUST_hairFill(x, hc, y0, y1) { const g = x.createLinearGradient(38, y0, 58, y1); g.addColorStop(0, shade(hc, 0.22)); g.addColorStop(0.55, hc); g.addColorStop(1, shade(hc, -0.32)); return g; }
function BUST_star(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const q = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); }
function BUST_neck(x, lk, sk, big, gear) {
  const nw = 9 + big * 3.5 + (lk.bt === 2 ? 1.2 : lk.bt === 0 ? -0.8 : 0), skD = shade(sk, -0.24), skDD = shade(sk, -0.42);
  const g = x.createLinearGradient(48 - nw, 0, 48 + nw, 0); g.addColorStop(0, skDD); g.addColorStop(0.35, skD); g.addColorStop(0.7, sk); g.addColorStop(1, skD);
  x.fillStyle = g; x.beginPath(); x.moveTo(48 - nw, 50); x.lineTo(48 - nw - 1.5, 68); x.quadraticCurveTo(48, 74, 48 + nw + 1.5, 68); x.lineTo(48 + nw, 50); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.13)'; x.lineWidth = 1; x.beginPath(); x.moveTo(48 - nw + 2.2, 60); x.quadraticCurveTo(46.2, 65.5, 44.6, 70); x.moveTo(48 + nw - 2.2, 60); x.quadraticCurveTo(49.8, 65.5, 51.4, 70); x.stroke();
  if (gear && lk.tat) { const tx = 48 + nw - 3.4; x.save(); x.globalAlpha = 0.5; x.strokeStyle = x.fillStyle = '#18202c'; x.lineWidth = 0.9; x.lineCap = 'round';   // a small neck tattoo (player's left)
    x.beginPath(); x.moveTo(tx - 1.6, 62); x.quadraticCurveTo(tx + 1.4, 63.4, tx - 0.5, 65.2); x.quadraticCurveTo(tx - 2.1, 67, tx + 0.8, 68); x.stroke(); BUST_star(x, tx + 0.2, 59.6, 1.5); x.restore(); }
  x.fillStyle = 'rgba(0,0,0,.24)'; x.beginPath(); x.ellipse(48, 57.5, nw + 1, 4.8, 0, 0, 7); x.fill();
}
function BUST_backHair(x, lk, hc) {   // hair that falls behind the head and neck
  const hs = lk.hs, dk = shade(hc, -0.2), dd = shade(hc, -0.4);
  if (hs === 4 || hs === 25) { const L = hs === 25 ? 84 : 70, tip = lk.ht === 1 ? '#e3cf98' : lk.ht === 2 ? '#c0602e' : null; x.fillStyle = dk; x.beginPath(); x.moveTo(28.5, 30); x.quadraticCurveTo(22, 58, 27.5, L); x.lineTo(68.5, L); x.quadraticCurveTo(74, 58, 67.5, 30); x.closePath(); x.fill();
    if (tip) { x.save(); x.clip(); const n = parseInt(tip.slice(1), 16), rgb = `${n >> 16},${(n >> 8) & 255},${n & 255}`, tg = x.createLinearGradient(0, L - 17, 0, L); tg.addColorStop(0, `rgba(${rgb},0)`); tg.addColorStop(1, `rgba(${rgb},1)`); x.fillStyle = tg; x.fillRect(18, L - 17, 60, 17); x.restore(); }   // dyed tips
    x.strokeStyle = dd; x.lineWidth = 0.9; for (let i = 0; i < 9; i++) { const xx = 27 + i * 5.3; x.beginPath(); x.moveTo(xx, 40); x.lineTo(xx + (i < 4.5 ? -1.5 : 1.5), L - 2); x.stroke(); } }
  else if (hs === 5 || hs === 10) { x.fillStyle = dk; x.beginPath(); x.moveTo(28.5, 30); x.quadraticCurveTo(23, 58, 30, 70); x.lineTo(66, 70); x.quadraticCurveTo(73, 58, 67.5, 30); x.closePath(); x.fill(); }
  else if (hs === 23) { x.fillStyle = dk; x.beginPath(); x.moveTo(28.5, 30); x.quadraticCurveTo(24, 50, 28.5, 61); x.lineTo(67.5, 61); x.quadraticCurveTo(72, 50, 67.5, 30); x.closePath(); x.fill(); }
  else if (hs === 18) { x.lineCap = 'round'; for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const bx = 48 + sx * (12.5 + i * 2.7); x.strokeStyle = dk; x.lineWidth = 2.3; x.beginPath(); x.moveTo(bx, 46); x.lineTo(bx + sx * 1.3, 72 - i * 3); x.stroke();
    x.setLineDash([1.1, 1.2]); x.strokeStyle = shade(hc, 0.18); x.lineWidth = 0.8; x.stroke(); x.setLineDash([]); } }
  if (lk.hx === 4) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { x.fillStyle = i % 2 ? hc : dk; x.beginPath(); x.arc(48 + sx * (11.5 + i * 2.4), 50.5 + i * 2.2, 2.6, 0, 7); x.fill(); }
}
function BUST_hair(x, lk, hc, c2, hw, ht0) {   // hair on top of the head; fitted to the head width / height
  x.save(); x.translate(48, 0); x.scale(hw / 18.5, 1); x.translate(-48, (ht0 - 16.5) * 0.6);
  const hs = lk.hs, F = BUST_hairFill(x, hc, 10, 30), dk = shade(hc, -0.25), lt = shade(hc, 0.28), tip = lk.ht === 1 ? '#e3cf98' : lk.ht === 2 ? '#c0602e' : null;
  const fill = (f, a) => { x.fillStyle = F; x.globalAlpha = a == null ? 1 : a; x.beginPath(); f(); x.fill(); x.globalAlpha = 1; };
  const cap = () => { x.moveTo(29.5, 36); x.bezierCurveTo(28, 18, 40, 13, 50, 14); x.bezierCurveTo(62, 14, 68, 22, 66.5, 36); x.bezierCurveTo(62, 25, 55, 22, 48, 23); x.bezierCurveTo(40, 23, 33, 26, 29.5, 36); };
  const buzz = () => { x.moveTo(30, 34); x.bezierCurveTo(30, 20, 40, 16, 48, 16); x.bezierCurveTo(56, 16, 66, 20, 66, 34); x.bezierCurveTo(60, 24, 36, 24, 30, 34); };
  const shortCap = () => { x.moveTo(30, 36); x.bezierCurveTo(29, 19, 40, 14, 48, 14); x.bezierCurveTo(57, 14, 67, 19, 66, 36); x.bezierCurveTo(60, 24, 36, 24, 30, 36); };
  const sheen = (cx, cy, rx, ry, a) => { x.fillStyle = `rgba(255,255,255,${a || 0.13})`; x.beginPath(); x.ellipse(cx, cy, rx, ry, -0.35, 0, 7); x.fill(); };
  const ball = (cx, cy, r, i) => { x.fillStyle = i % 2 ? hc : shade(hc, 0.14); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.arc(cx + r * 0.25, cy + r * 0.3, r * 0.6, 0, 7); x.fill(); };
  switch (hs) {
    case 0: sheen(42, 22, 9, 3.2, 0.22); break;
    case 1: fill(cap); sheen(43, 18, 7, 2.2); break;
    case 9: fill(cap); x.strokeStyle = dk; x.lineWidth = 0.9; x.beginPath(); x.moveTo(40.5, 15.2); x.quadraticCurveTo(39.4, 19, 38.4, 23.6); x.stroke(); sheen(50, 16.5, 8, 2.1); break;    // side part
    case 14: fill(cap); x.fillStyle = F; x.beginPath(); x.ellipse(48, 10, 7, 5.5, 0, 0, 7); x.fill(); sheen(46, 8.6, 3.5, 1.5, 0.18); break;                         // bun
    case 15: fill(cap); x.strokeStyle = lt; x.globalAlpha = 0.45; x.lineWidth = 0.8; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(35 + i * 5.2, 23.5); x.quadraticCurveTo(38 + i * 4.6, 16.5, 44 + i * 3.4, 13.9); x.stroke(); } x.globalAlpha = 1; break;   // slicked back
    case 2: fill(() => { x.moveTo(30, 38); x.bezierCurveTo(29, 20, 40, 15, 48, 15); x.bezierCurveTo(58, 15, 67, 20, 66, 38); x.bezierCurveTo(62, 24, 34, 24, 30, 38); }, 0.5); fill(() => { x.moveTo(36, 25); x.bezierCurveTo(38, 13.5, 58, 13, 61, 25); x.bezierCurveTo(54, 21, 42, 21, 36, 25); }); break;
    case 3: fill(() => { x.ellipse(48, 22, 24.5, 15.5, 0, Math.PI * 0.95, Math.PI * 2.05); x.lineTo(70, 40); x.quadraticCurveTo(66, 26, 48, 25); x.quadraticCurveTo(30, 26, 26, 40); });
      sheen(42, 12, 9, 3); break;
    case 4: case 25: fill(() => { x.moveTo(28, 40); x.bezierCurveTo(26, 16, 40, 12, 48, 12); x.bezierCurveTo(58, 12, 70, 16, 68, 40); x.bezierCurveTo(62, 24, 34, 24, 28, 40); }); x.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const xx = 29 + i * 5.5, ey = (i % 2 ? 50 : 46) + (hs === 25 ? 9 : 0), ex = xx + (i < 4 ? -3 : 3); x.strokeStyle = i % 2 ? dk : shade(hc, -0.08); x.lineWidth = hs === 25 ? 4.6 : 4; x.beginPath(); x.moveTo(xx, 22); x.quadraticCurveTo(xx + (i < 4 ? -4 : 4), 34, ex, ey); x.stroke(); } break;
    case 5: fill(() => { x.moveTo(28, 44); x.bezierCurveTo(25, 16, 40, 12, 48, 12); x.bezierCurveTo(58, 12, 71, 16, 68, 44); x.bezierCurveTo(64, 26, 52, 23, 44, 24); x.bezierCurveTo(36, 25, 31, 32, 28, 44); }); sheen(52, 15.5, 9, 2.4); break;
    case 6: fill(buzz, 0.28); fill(() => { x.moveTo(41.5, 24); x.quadraticCurveTo(44, 3, 48, 5); x.quadraticCurveTo(52, 3, 54.5, 24); x.closePath(); }); break;          // mohawk
    case 7: for (let i = 0; i < 10; i++) ball(31 + i * 3.8, 20 + Math.abs(4.5 - i) * 1.2, 4.6, i); break;                                                     // curls
    case 13: for (let i = 0; i < 12; i++) ball(30.4 + i * 3.2, 21.5 + Math.abs(5.5 - i) * 1.05, 3.3, i); for (let i = 0; i < 9; i++) ball(34.5 + i * 3.4, 16.8 + Math.abs(4 - i) * 0.9, 3.1, i + 1); break;   // coils
    case 8: fill(shortCap); sheen(44, 18, 6, 2); break;
    case 16: fill(buzz, 0.35); fill(() => { x.moveTo(33, 30); x.bezierCurveTo(33, 14, 42, 12, 48, 12); x.bezierCurveTo(55, 12, 63, 14, 63, 30); x.bezierCurveTo(58, 22, 38, 22, 33, 30); }); sheen(45, 15, 5, 1.8); break;   // high fade
    case 10: fill(() => { x.moveTo(28, 42); x.bezierCurveTo(26, 18, 40, 13, 48, 13); x.bezierCurveTo(58, 13, 70, 18, 68, 42); x.bezierCurveTo(63, 27, 33, 27, 28, 42); }); x.fillStyle = c2; x.fillRect(29, 26, 38, 4.5); break;
    case 11: fill(buzz, 0.55); break;
    case 12: fill(buzz, 0.6); x.strokeStyle = dk; x.lineWidth = 0.9; x.beginPath(); x.moveTo(30.6, 33); x.lineTo(32, 26.2); x.quadraticCurveTo(48, 19.8, 64, 26.2); x.lineTo(65.4, 33); x.stroke(); break;   // line-up
    case 17: fill(buzz, 0.4); for (let i = 0; i < 7; i++) ball(48 + (i % 2 ? 2 : -2), 8 + i * 2.6, 4.2, i); break;
    case 18: fill(buzz, 0.55); x.lineCap = 'round'; for (let i = 0; i < 6; i++) { const xx = 33.5 + i * 5.8, p0 = [xx + (xx - 48) * 0.08, 25], p1 = [xx, 18.5], p2 = [48 + (xx - 48) * 0.55, 15.5];   // cornrows
      x.strokeStyle = dk; x.lineWidth = 2.2; x.beginPath(); x.moveTo(...p0); x.quadraticCurveTo(...p1, ...p2); x.stroke(); x.setLineDash([1.1, 1.2]); x.strokeStyle = lt; x.lineWidth = 0.8; x.stroke(); x.setLineDash([]); } break;
    case 19: fill(buzz, 0.5); fill(() => { x.moveTo(31.4, 30); x.bezierCurveTo(30.8, 21, 32.4, 12.5, 35, 9.2); x.quadraticCurveTo(48, 5.6, 61, 9.2); x.bezierCurveTo(63.6, 12.5, 65.2, 21, 64.6, 30); x.bezierCurveTo(60, 23, 36, 23, 31.4, 30); });   // high-top fade
      x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.ellipse(48, 9, 12, 1.6, 0, 0, Math.PI); x.fill(); sheen(42, 10.4, 6, 1.5, 0.15); break;
    case 20: fill(buzz, 0.5); for (let r = 0; r < 2; r++) for (let i = 0; i < 12 - r * 3; i++) { const xx = 31.5 + r * 4.2 + i * 3, yy = 20.5 - r * 4.2 + Math.abs(5.5 - r * 1.5 - i) * 0.85;   // twists
      x.fillStyle = (i + r) % 2 ? hc : shade(hc, 0.16); x.beginPath(); x.ellipse(xx, yy - 2.8, 1.65, 4.1, (xx - 48) * 0.03, 0, 7); x.fill(); if (tip) { x.fillStyle = tip; x.beginPath(); x.ellipse(xx + (xx - 48) * 0.06, yy - 6, 1.2, 1.4, 0, 0, 7); x.fill(); } } break;
    case 21: fill(buzz, 0.3); for (let i = 0; i < 9; i++) ball(48 + (i % 2 ? 2.4 : -2.4), 5.5 + i * 2.4, 4.6, i); break;                                     // frohawk
    case 22: fill(cap); x.fillStyle = dk; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(33 + i * 6, 24); x.quadraticCurveTo(36 + i * 4.5, 15, 46 + i * 0.8, 11); x.lineWidth = 2; x.strokeStyle = dk; x.stroke(); }   // locs in a top knot
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; ball(48 + Math.cos(a) * 3.6, 7.5 + Math.sin(a) * 2.6, 3.1, k); } if (tip) { x.fillStyle = tip; x.globalAlpha = 0.85; x.beginPath(); x.arc(48, 6.5, 3, 0, 7); x.fill(); x.globalAlpha = 1; } x.fillStyle = c2; x.fillRect(44.5, 11.2, 7, 1.5); break;
    case 23: fill(() => { x.moveTo(27.5, 45); x.bezierCurveTo(25, 15, 40, 11, 48, 11); x.bezierCurveTo(58, 11, 71, 15, 68.5, 45); x.lineTo(65.5, 33); x.lineTo(61, 28); x.lineTo(58, 30.5); x.lineTo(54.5, 27); x.lineTo(51, 30.8); x.lineTo(47, 27.2);   // shaggy, bangs
      x.lineTo(43, 30.6); x.lineTo(39.5, 27.4); x.lineTo(36, 31); x.lineTo(33, 28.5); x.lineTo(30.5, 34); x.closePath(); }); x.strokeStyle = dk; x.lineWidth = 0.7; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(34 + i * 5.5, 14.5); x.quadraticCurveTo(35 + i * 5.2, 22, 34.5 + i * 5.4, 28.5); x.stroke(); } break;
    case 24: fill(buzz, 0.62); x.save(); x.beginPath(); buzz(); x.clip(); x.strokeStyle = lt; x.globalAlpha = 0.35; x.lineWidth = 0.7; for (let r = 3; r < 20; r += 2.4) { x.beginPath(); x.arc(48, 26, r, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); } x.restore(); break;   // 360 waves
  }
  x.restore();
}
function BUST_beard(x, lk, hc, sk) {
  const bd = lk.bd | 0, lip = shade(sk, -0.28), full = () => { x.beginPath(); x.moveTo(30, 40); x.bezierCurveTo(30, 60, 42, 64.5, 48, 64.5); x.bezierCurveTo(54, 64.5, 66, 60, 66, 40); x.bezierCurveTo(63, 52, 58, 57, 53, 55.5); x.quadraticCurveTo(48, 54, 43, 55.5); x.bezierCurveTo(38, 57, 33, 52, 30, 40); };
  const tex = (n, y0, y1, a) => { x.strokeStyle = `rgba(0,0,0,${a})`; x.lineWidth = 0.6; for (let i = 0; i < n; i++) { const xx = 33 + (i * 7.9) % 30, yy = y0 + (i * 3.7) % (y1 - y0); x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (xx < 48 ? -0.5 : 0.5), yy + 2); x.stroke(); } };
  x.fillStyle = hc;
  if (bd === 1) { x.globalAlpha = 0.22; x.beginPath(); x.moveTo(31, 44); x.bezierCurveTo(32, 56, 44, 61, 48, 61); x.bezierCurveTo(52, 61, 64, 56, 65, 44); x.bezierCurveTo(60, 54, 36, 54, 31, 44); x.fill(); x.globalAlpha = 1; }
  if (bd === 2) { x.beginPath(); x.moveTo(43, 56); x.quadraticCurveTo(48, 63.5, 53, 56); x.lineTo(52, 58.5); x.quadraticCurveTo(48, 60, 44, 58.5); x.closePath(); x.fill(); x.fillRect(43.5, 50.8, 9, 1.9); }
  if (bd === 3) { full(); x.fill(); x.fillRect(42.5, 50.6, 11, 2.2); tex(18, 52, 62, 0.16); x.fillStyle = lip; x.fillRect(44.5, 53.6, 7, 1.3); }
  if (bd === 4) { x.beginPath(); x.moveTo(42, 52.5); x.quadraticCurveTo(48, 49.3, 54, 52.5); x.lineTo(53, 53.6); x.quadraticCurveTo(48, 51.4, 43, 53.6); x.closePath(); x.fill(); }
  if (bd === 5) { x.globalAlpha = 0.88; x.beginPath(); x.moveTo(30, 42); x.bezierCurveTo(31, 56, 38, 60, 42, 61); x.lineTo(42, 58); x.bezierCurveTo(37, 55, 33, 50, 30, 42); x.moveTo(66, 42); x.bezierCurveTo(65, 56, 58, 60, 54, 61); x.lineTo(54, 58); x.bezierCurveTo(59, 55, 63, 50, 66, 42); x.fill(); x.globalAlpha = 1; }
  if (bd === 6) { x.strokeStyle = hc; x.lineWidth = 2; x.beginPath(); x.moveTo(30.5, 42); x.bezierCurveTo(32, 54, 42, 61, 48, 61.5); x.bezierCurveTo(54, 61, 64, 54, 65.5, 42); x.stroke(); }
  if (bd === 7) { x.beginPath(); x.ellipse(48, 57.6, 1.8, 2.2, 0, 0, 7); x.fill(); }
  if (bd === 8) { x.fillStyle = BUST_hairFill(x, hc, 46, 82); x.beginPath(); x.moveTo(30, 40); x.bezierCurveTo(28.5, 60, 37, 75, 48, 81); x.bezierCurveTo(59, 75, 67.5, 60, 66, 40); x.bezierCurveTo(63, 52, 58, 57, 53, 55.5); x.quadraticCurveTo(48, 54, 43, 55.5); x.bezierCurveTo(38, 57, 33, 52, 30, 40); x.fill();   // long beard
    x.fillStyle = hc; x.fillRect(42.3, 50.5, 11.4, 2.4); tex(26, 56, 78, 0.18); x.fillStyle = lip; x.fillRect(44.5, 53.6, 7, 1.3); }
  if (bd === 9) { x.globalAlpha = 0.4; full(); x.fill(); x.globalAlpha = 0.5; x.fillRect(42.8, 50.7, 10.4, 2); x.globalAlpha = 1; tex(22, 46, 62, 0.12); }       // heavy stubble
  if (bd === 10) { x.beginPath(); x.moveTo(42, 53.2); x.quadraticCurveTo(48, 49.2, 54, 53.2); x.lineTo(54.6, 60.5); x.lineTo(52.6, 60.5); x.lineTo(52.4, 53.6); x.quadraticCurveTo(48, 51.6, 43.6, 53.6); x.lineTo(43.4, 60.5); x.lineTo(41.4, 60.5); x.closePath(); x.fill(); }   // horseshoe
}
// the whole head: back hair, ears, face with lighting, hair, brows, eyes, eye black, nose (+ strip), mouth, beard, marks. o: { sk, hc, big, c2, gear }
function BUST_head(x, lk, o) {
  const sk = o.sk, hc = o.hc, big = o.big, skD = shade(sk, -0.24), skL = shade(sk, 0.16), ol = 'rgba(25,14,8,.55)', ex = lk.ex | 0;
  BUST_backHair(x, lk, hc);
  const HS = [[18.5, 16.5, 61.5, 0], [19.6, 17.5, 59.5, 1], [19, 16.5, 61, 3], [17.2, 14.5, 63.5, 0], [20.6, 17, 61, 2], [19, 16, 62, -3]][lk.head || 0] || [18.5, 16.5, 61.5, 0];
  const es = lk.ear ? 1.18 : 1, earX = s => 48 + s * (17.5 + (HS[0] - 18.5));
  for (const s of [-1, 1]) { const ex0 = earX(s), eg = x.createRadialGradient(ex0, 42, 1, ex0, 42, 6 * es); eg.addColorStop(0, skD); eg.addColorStop(1, shade(sk, -0.1)); x.fillStyle = eg; x.beginPath(); x.ellipse(ex0, 42.5, 4.2 * es, 6.4 * es, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 0.8; x.beginPath(); x.arc(ex0 + s * 0.4, 42, 2.4 * es, s > 0 ? -1.2 : 1.9, s > 0 ? 1.2 : 4.3); x.stroke(); }
  const hw = HS[0], ht0 = HS[1], chin = HS[2], jw = [12, 14, 15.5][lk.jaw || 0] + big + HS[3];
  const head = () => { x.beginPath(); x.moveTo(48, ht0); x.bezierCurveTo(48 + hw - 3, ht0, 48 + hw + 1, 28, 48 + hw + 0.5, 40); x.bezierCurveTo(48 + hw, 50.5, 48 + jw, chin - 1, 48, chin); x.bezierCurveTo(48 - jw, chin - 1, 48 - hw, 50.5, 48 - hw - 0.5, 40); x.bezierCurveTo(48 - hw - 1, 28, 48 - hw + 3, ht0, 48, ht0); x.closePath(); };
  // key light from the upper left, fill from the right, soft shadows in the eye sockets, under the cheekbones and along the jaw
  const hg = x.createRadialGradient(41, 31, 3, 48, 42, 29); hg.addColorStop(0, skL); hg.addColorStop(0.55, sk); hg.addColorStop(1, skD); x.fillStyle = hg; head(); x.fill();
  x.save(); head(); x.clip();
  const sh = x.createLinearGradient(29, 0, 67, 0); sh.addColorStop(0, 'rgba(0,0,0,.2)'); sh.addColorStop(0.25, 'rgba(0,0,0,0)'); sh.addColorStop(0.72, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.24)'); x.fillStyle = sh; x.fillRect(28, 12, 42, 52);
  x.fillStyle = 'rgba(0,0,0,.1)'; x.beginPath(); x.ellipse(48, chin + 5, jw + 7, 8, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(0,0,0,.09)'; x.beginPath(); x.ellipse(40, 37.6, 6.2, 3.6, 0, 0, 7); x.ellipse(56, 37.6, 6.2, 3.6, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(0,0,0,.07)'; x.beginPath(); x.ellipse(36.5, 50, 3.4, 5.5, 0.3, 0, 7); x.ellipse(59.5, 50, 3.4, 5.5, -0.3, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.ellipse(38, 45, 4.5, 2.6, -0.3, 0, 7); x.fill();
  x.fillStyle = ex === 3 ? 'rgba(255,120,110,.16)' : 'rgba(255,120,110,.10)'; x.beginPath(); x.ellipse(37, 47, 5, 3.5, 0, 0, 7); x.ellipse(59, 47, 5, 3.5, 0, 0, 7); x.fill();
  x.restore(); x.strokeStyle = ol; x.lineWidth = 1.3; head(); x.stroke();
  BUST_hair(x, lk, hc, o.c2, hw, ht0);
  if (lk.hb && lk.hs !== 10 && o.gear) { x.fillStyle = o.c2; x.fillRect(29.5, 27, 37, 4.6); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(29.5, 27, 37, 1.2); }
  // brows: intense = angled down to the middle, confident = one raised, friendly = lifted and arched
  const bc = lk.hs === 0 ? shade(sk, -0.45) : shade(hc, -0.1), bL = ex === 1 ? [-0.6, 1.5] : ex === 2 ? [0, 0] : ex === 3 ? [-0.8, -0.6] : [0, 0], bR = ex === 1 ? [1.5, -0.6] : ex === 2 ? [-1.8, -1.3] : ex === 3 ? [-0.6, -0.8] : [0, 0], arch = ex === 3 ? 1 : ex === 2 ? 0.6 : 0;
  x.strokeStyle = bc; x.lineCap = 'round'; x.lineWidth = [2.8, 2.2, 3.7][lk.bw || 0]; x.beginPath(); x.moveTo(35.5, 35.2 + bL[0]); x.quadraticCurveTo(40, 32.3 - arch + (bL[0] + bL[1]) / 2, 44.5, 34.4 + bL[1]); x.moveTo(51.5, 34.4 + bR[0]); x.quadraticCurveTo(56, 32.3 - arch * (ex === 2 ? 2 : 1) + (bR[0] + bR[1]) / 2, 60.5, 35.2 + bR[1]); x.stroke();
  if (ex === 1) { x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(47, 34.6); x.lineTo(47.4, 37); x.moveTo(49, 34.6); x.lineTo(48.6, 37); x.stroke(); }
  if (lk.sc === 1) { x.strokeStyle = shade(sk, 0.06); x.lineWidth = 1.1; x.beginPath(); x.moveTo(40.6, 31.6); x.lineTo(41.9, 36.4); x.stroke(); x.strokeStyle = 'rgba(210,130,120,.5)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(40.6, 31.6); x.lineTo(42.2, 37.2); x.stroke(); }
  for (const e0 of [40, 56]) { const erx = [4, 3.8, 4.4][lk.eye || 0], ery = [2.4, 1.75, 2.75][lk.eye || 0] * (ex === 1 ? 0.82 : ex === 3 ? 0.8 : 1), ey0 = ex === 3 ? 39.9 : 39.6;
    x.fillStyle = '#f7f4ef'; x.beginPath(); x.ellipse(e0, ey0, erx, ery, 0, 0, 7); x.fill();
    x.save(); x.beginPath(); x.ellipse(e0, ey0, erx, ery, 0, 0, 7); x.clip(); x.fillStyle = EYEC[lk.ec] || '#3b2416'; x.beginPath(); x.arc(e0 + 0.3, 39.7, 2.05, 0, 7); x.fill(); x.fillStyle = '#090909'; x.beginPath(); x.arc(e0 + 0.3, 39.7, 0.95, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(e0 - erx, ey0 - ery, erx * 2, ery * 0.7); x.restore();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(e0 + 1, 38.9, 0.6, 0, 7); x.fill();
    x.strokeStyle = shade(sk, -0.55); x.lineWidth = ex === 1 ? 1.6 : 1.3; x.beginPath(); x.ellipse(e0, ey0, erx + 0.1, ery + 0.1, 0, Math.PI * 1.03, Math.PI * 1.97); x.stroke();
    if (ex === 3) { x.strokeStyle = shade(sk, -0.3); x.lineWidth = 0.8; x.beginPath(); x.ellipse(e0, ey0 + 0.4, erx - 0.4, ery + 0.3, 0, Math.PI * 0.15, Math.PI * 0.85); x.stroke(); } }
  // eye black: 1 grease smudge, 2 strip, 3 strip with streaks down the cheeks
  if (o.gear && lk.ey && lk.eb) { x.fillStyle = '#121214';
    for (const e0 of [40, 56]) { if (lk.eb === 1) { x.globalAlpha = 0.88; x.beginPath(); x.ellipse(e0, 44.6, 4.4, 1.7, 0, 0, 7); x.fill(); x.globalAlpha = 1; }
      else { x.fillRect(e0 - 4.2, 43.3, 8.4, 2.3); if (lk.eb === 3) { x.strokeStyle = '#121214'; x.lineWidth = 0.95; x.lineCap = 'round'; x.beginPath(); x.moveTo(e0 - 2.2, 45.4); x.lineTo(e0 - 2.5, 50.6); x.moveTo(e0 + 1.8, 45.4); x.lineTo(e0 + 1.7, 48.6); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(e0 - 4.2, 43.3, 8.4, 0.6); x.fillStyle = '#121214'; } } }
  if (lk.fr) { x.fillStyle = 'rgba(120,60,30,.32)'; for (let i = 0; i < 16; i++) { const s = i % 2 ? 1 : -1, k = i >> 1; x.beginPath(); x.arc(48 + s * (6.5 + (k * 2.3) % 7.5), 44 + (k * 1.7) % 4.6, 0.55, 0, 7); x.fill(); } }
  const nw2 = [3, 4, 5.2][lk.nose || 0]; x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.moveTo(48.6, 40); x.quadraticCurveTo(50.6, 45, 49 + nw2 * 0.5, 48.4); x.lineTo(48.4, 48.4); x.closePath(); x.fill();
  x.strokeStyle = shade(sk, -0.32); x.lineWidth = 1.2; x.beginPath(); x.moveTo(46.6, 39.5); x.quadraticCurveTo(45.8, 45, 47 - nw2 * 0.3, 48.2); x.stroke();
  x.fillStyle = shade(sk, -0.4); x.beginPath(); x.ellipse(48 - nw2 * 0.62, 48.6, 1.3, 0.85, 0.3, 0, 7); x.ellipse(48 + nw2 * 0.62, 48.6, 1.3, 0.85, -0.3, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.ellipse(47.4, 46.4, 1.2, 0.8, 0, 0, 7); x.fill();
  if (o.gear && lk.ns) { x.fillStyle = '#ece6d8'; x.beginPath(); x.moveTo(42.6, 43.2); x.quadraticCurveTo(48, 41.9, 53.4, 43.2); x.lineTo(53.4, 45.4); x.quadraticCurveTo(48, 44.3, 42.6, 45.4); x.closePath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 0.5; x.stroke(); }
  // mouth: 0 neutral, 1 slight smile, 2 firm, 3 smirk, 4 grin
  const lip = shade(sk, -0.28), lipD = shade(sk, -0.48), mo = lk.mo | 0; x.fillStyle = lip; x.strokeStyle = lipD; x.lineWidth = 1.1; x.beginPath();
  if (mo === 4) { x.moveTo(42.4, 52.6); x.quadraticCurveTo(48, 51.4, 53.6, 52.6); x.quadraticCurveTo(48, 58.8, 42.4, 52.6); x.fillStyle = '#3a1713'; x.fill(); x.save(); x.clip(); x.fillStyle = '#f2eee6'; x.fillRect(42, 51.5, 12, 2.7); x.restore(); x.stroke(); }
  else if (mo === 3) { x.moveTo(43, 54); x.quadraticCurveTo(48, 52.6, 53.3, 52.3); x.quadraticCurveTo(48.6, 56.2, 43, 54); x.fill(); x.beginPath(); x.moveTo(43, 54); x.quadraticCurveTo(48.4, 54.8, 53.4, 52.3); x.stroke(); }
  else if (mo === 2) { x.moveTo(43.4, 53.6); x.quadraticCurveTo(48, 52.9, 52.6, 53.6); x.quadraticCurveTo(48, 55.2, 43.4, 53.6); x.fill(); x.beginPath(); x.moveTo(43.2, 53.7); x.lineTo(52.8, 53.7); x.stroke(); }
  else { if (mo === 1) { x.moveTo(42.5, 53); x.quadraticCurveTo(48, 51.6, 53.5, 53); x.quadraticCurveTo(48, 57.5, 42.5, 53); } else { x.moveTo(43, 53.4); x.quadraticCurveTo(45.5, 52.2, 48, 53); x.quadraticCurveTo(50.5, 52.2, 53, 53.4); x.quadraticCurveTo(48, 56.2, 43, 53.4); } x.fill();
    x.beginPath(); x.moveTo(43, 53.5); x.quadraticCurveTo(48, mo === 1 ? 55.2 : 54.3, 53, 53.5); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(48, 55.6, 2.6, 0.7, 0, 0, 7); x.fill();
  BUST_beard(x, lk, hc, sk);
  if (lk.sc === 2) { x.strokeStyle = 'rgba(215,140,130,.55)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(57.2, 45.2); x.lineTo(60.4, 49.8); x.stroke(); }
  if (o.gear && lk.er) for (const s of lk.er === 2 ? [-1, 1] : [1]) { const ex0 = earX(s) + s * 0.6; x.fillStyle = '#f4f2ea'; x.beginPath(); x.arc(ex0, 47.6 * (lk.ear ? 1.01 : 1), 1.05, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(ex0 - 0.3, 47.3, 0.35, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(64, 26); x.bezierCurveTo(67.5, 34, 67, 44, 63, 52); x.stroke();
}
// jersey + shoulder pads, with the upper arms showing under the sleeves (bare, tattooed or in a compression sleeve, matching the 3D player)
function BUST_torso(x, p, lk, c1, c2, sk, big) {
  const sw = 34 + big * 6, ol = 'rgba(25,14,8,.55)', bt = lk.bt == null ? 1 : lk.bt, aw = 11 + bt * 1.5 + big * 1.2, sleeve = ['#17181b', '#eeece6', c1, c2][lk.ac | 0] || '#17181b', ink = shade(sk, -0.5);
  for (const s of [-1, 1]) {   // s > 0: viewer's right = the player's left arm
    const item = s > 0 ? (lk.aL | 0) : (lk.aR | 0), col = item === 1 ? sleeve : sk, xo = 48 + s * (sw + 0.5);
    const g = x.createLinearGradient(xo - aw * 0.8, 0, xo + aw * 0.8, 0); g.addColorStop(0, shade(col, s > 0 ? -0.06 : -0.38)); g.addColorStop(0.5, shade(col, 0.06)); g.addColorStop(1, shade(col, s > 0 ? -0.4 : -0.08));
    x.fillStyle = g; x.strokeStyle = ol; x.lineWidth = 1.2; x.beginPath(); x.moveTo(xo - s * aw * 0.55, 74); x.quadraticCurveTo(xo + s * aw * 0.9, 80, xo + s * aw * 0.62, 100); x.lineTo(xo - s * aw * 0.55, 100); x.closePath(); x.fill(); x.stroke();
    if (lk.tat && (lk.ta & (s > 0 ? 1 : 2)) && item !== 1) { x.save(); x.clip(); x.strokeStyle = x.fillStyle = ink; x.globalAlpha = 0.5; x.lineWidth = 1.1;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(xo - aw * 0.7, 88.5 + i * 3.4); x.quadraticCurveTo(xo + s * 1.5, 85.6 + i * 3.4, xo + aw * 0.8, 89.5 + i * 3.4); x.stroke(); } BUST_star(x, xo + s * 1.2, 95.5, 2); x.restore(); }
  }
  const jg = x.createLinearGradient(20, 64, 76, 98); jg.addColorStop(0, shade(c1, 0.25)); jg.addColorStop(0.5, c1); jg.addColorStop(1, shade(c1, -0.42));
  const jp = () => { x.beginPath(); x.moveTo(48 - sw + 4, 99); x.lineTo(48 - sw + 3.5, 83.8); x.quadraticCurveTo(48 - sw - 3, 83.6, 48 - sw - 8.5, 80.4); x.quadraticCurveTo(48 - sw - 9.5, 70, 48 - sw + 4, 66.5); x.quadraticCurveTo(48, 61, 48 + sw - 4, 66.5);
    x.quadraticCurveTo(48 + sw + 9.5, 70, 48 + sw + 8.5, 80.4); x.quadraticCurveTo(48 + sw + 3, 83.6, 48 + sw - 3.5, 83.8); x.lineTo(48 + sw - 4, 99); x.closePath(); };
  x.fillStyle = jg; x.strokeStyle = ol; x.lineWidth = 1.4; jp(); x.fill(); x.stroke();
  x.save(); jp(); x.clip();
  for (const sx of [-1, 1]) { const pg = x.createRadialGradient(48 + sx * (sw - 10) - sx * 3, 68, 1, 48 + sx * (sw - 10), 72, 13); pg.addColorStop(0, shade(c1, 0.42)); pg.addColorStop(1, shade(c1, 0.02)); x.fillStyle = pg; x.beginPath(); x.ellipse(48 + sx * (sw - 10), 73, 12.5, 6, sx * 0.38, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(0,0,0,.16)'; x.lineWidth = 1; for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(48 + sx * (sw - 3), 88); x.quadraticCurveTo(48 + sx * (sw - 6), 93, 48 + sx * (sw - 4.5), 99); x.stroke(); }
  x.restore();
  x.strokeStyle = c2; x.lineWidth = 2.4; for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(48 + sx * (sw + 8.2), 78.6); x.quadraticCurveTo(48 + sx * (sw + 2), 81.6, 48 + sx * (sw - 3.6), 81.5); x.stroke(); }
  x.fillStyle = c2; x.beginPath(); x.moveTo(36, 65); x.lineTo(48, 82); x.lineTo(60, 65); x.lineTo(55.5, 65); x.lineTo(48, 76); x.lineTo(40.5, 65); x.closePath(); x.fill();
  if (p.num != null && !p.nonum) { x.font = `700 24px ${CANVAS_FONT}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(String(p.num), 49.5, 99.5); x.lineWidth = 3.2; x.strokeStyle = shade(c1, -0.55); x.strokeText(String(p.num), 48, 98); x.fillStyle = c2; x.fillText(String(p.num), 48, 98); }
}
function drawBustSuit(x, p, T) {   // coach / staff in a suit
  const lk = ensureLook(p); const W = 96; x.save(); x.clearRect(0, 0, W, W);
  const c1 = T ? T.c1 : '#4a5878', c2 = T ? (lum(T.c2) < 0.12 && lum(T.c1) < 0.2 ? '#d9d9d9' : T.c2) : '#cfd6e6';
  const bg = x.createRadialGradient(48, 36, 6, 48, 48, 70); bg.addColorStop(0, shade(c1, 0.25)); bg.addColorStop(1, shade(c1, -0.6)); x.fillStyle = bg; x.fillRect(0, 0, W, W);
  const sk = SKIN[lk.sk] || SKIN[0], hc = HAIRC[lk.hc] || HAIRC[0], ol = 'rgba(20,14,10,.55)';
  const sw = 36, sg = x.createLinearGradient(14, 66, 80, 98); sg.addColorStop(0, '#2a3044'); sg.addColorStop(0.5, '#1e2333'); sg.addColorStop(1, '#141824');
  x.fillStyle = sg; x.strokeStyle = ol; x.lineWidth = 1.5; x.beginPath(); x.moveTo(48 - sw - 8, 98); x.quadraticCurveTo(48 - sw - 6, 70, 48 - sw + 6, 68); x.quadraticCurveTo(48, 63, 48 + sw - 6, 68); x.quadraticCurveTo(48 + sw + 6, 70, 48 + sw + 8, 98); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#f4f4f4'; x.beginPath(); x.moveTo(40, 66); x.lineTo(48, 92); x.lineTo(56, 66); x.closePath(); x.fill(); x.fillStyle = c1; x.beginPath(); x.moveTo(46.5, 70); x.lineTo(49.5, 70); x.lineTo(51, 90); x.lineTo(48, 95); x.lineTo(45, 90); x.closePath(); x.fill();
  x.fillStyle = '#151925'; x.beginPath(); x.moveTo(40, 66); x.lineTo(46, 86); x.lineTo(36, 96); x.closePath(); x.moveTo(56, 66); x.lineTo(50, 86); x.lineTo(60, 96); x.closePath(); x.fill(); if (T) { x.fillStyle = c2; x.beginPath(); x.arc(66, 82, 3, 0, 7); x.fill(); }
  BUST_neck(x, lk, sk, 0, false);
  BUST_head(x, lk, { sk, hc, big: 0, c2, gear: false });
  x.restore();
}
function drawBust(x, p, T) {
  const lk = ensureLook(p); const W = 96; if (p.coach && !p.headonly) { drawBustSuit(x, p, T); return; }
  x.save(); x.clearRect(0, 0, W, W);
  const K = T ? (T.kit || T) : null; const c1 = K ? (K.c1 || K.jersey) : '#4a5878', c2 = K ? (lum(K.c2 || K.trim) < 0.12 && lum(c1) < 0.2 ? '#d9d9d9' : (K.c2 || K.trim)) : '#cfd6e6';
  if (!p.nobg) { const bg = x.createRadialGradient(40, 30, 4, 48, 52, 78); bg.addColorStop(0, shade(c1, 0.32)); bg.addColorStop(0.55, shade(c1, -0.25)); bg.addColorStop(1, shade(c1, -0.72)); x.fillStyle = bg; x.fillRect(0, 0, W, W);
    x.globalAlpha = 0.08; x.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(i * 24 - 10, 0); x.lineTo(i * 24 + 4, 0); x.lineTo(i * 24 - 26, 96); x.lineTo(i * 24 - 40, 96); x.fill(); } x.globalAlpha = 1; }
  const sk = SKIN[lk.sk] || SKIN[0], hc = HAIRC[lk.hc] || HAIRC[0], big = lk.bl === 2 ? 1 : lk.bl === 0 ? -1 : 0, gear = !p.coach;
  if (!p.headonly) BUST_torso(x, p, lk, c1, c2, sk, big);
  BUST_neck(x, lk, sk, big, gear);
  BUST_head(x, lk, { sk, hc, big, c2, gear });
  x.restore();
}
const CANVAS_FONT = '"Teko","Barlow Condensed","Arial Narrow",Impact,sans-serif';
// ---------------- logos ----------------
const ICONS = {
  bolt: x => { x.moveTo(58, 6); x.lineTo(24, 56); x.lineTo(46, 56); x.lineTo(38, 94); x.lineTo(76, 40); x.lineTo(54, 40); x.closePath(); },
  flame: x => { x.moveTo(50, 6); x.bezierCurveTo(70, 30, 84, 44, 78, 66); x.bezierCurveTo(74, 84, 60, 94, 50, 94); x.bezierCurveTo(34, 94, 20, 82, 22, 64); x.bezierCurveTo(24, 50, 36, 44, 38, 30); x.bezierCurveTo(46, 40, 46, 48, 50, 52); x.bezierCurveTo(54, 40, 52, 22, 50, 6); x.closePath(); },
  star: x => { for (let i = 0; i < 10; i++) { const r = i % 2 ? 19 : 44, a = -Math.PI / 2 + i * Math.PI / 5; const px = 50 + Math.cos(a) * r, py = 52 + Math.sin(a) * r; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); },
  wave: x => { x.moveTo(8, 70); x.bezierCurveTo(20, 30, 60, 14, 80, 30); x.bezierCurveTo(64, 30, 54, 40, 58, 52); x.bezierCurveTo(66, 44, 80, 46, 92, 56); x.bezierCurveTo(80, 62, 72, 78, 92, 88); x.lineTo(8, 88); x.closePath(); },
  mountain: x => { x.moveTo(4, 86); x.lineTo(36, 26); x.lineTo(50, 48); x.lineTo(64, 20); x.lineTo(96, 86); x.closePath(); },
  crown: x => { x.moveTo(10, 80); x.lineTo(14, 30); x.lineTo(32, 52); x.lineTo(50, 20); x.lineTo(68, 52); x.lineTo(86, 30); x.lineTo(90, 80); x.closePath(); },
  wing: x => { x.moveTo(10, 30); x.bezierCurveTo(40, 22, 70, 26, 92, 40); x.lineTo(78, 48); x.lineTo(90, 54); x.lineTo(72, 62); x.lineTo(82, 70); x.lineTo(58, 76); x.bezierCurveTo(40, 76, 24, 60, 10, 30); x.closePath(); },
  horns: x => { x.moveTo(8, 20); x.bezierCurveTo(10, 50, 30, 56, 40, 56); x.lineTo(40, 80); x.bezierCurveTo(44, 92, 56, 92, 60, 80); x.lineTo(60, 56); x.bezierCurveTo(70, 56, 90, 50, 92, 20); x.bezierCurveTo(84, 40, 70, 42, 58, 40); x.lineTo(42, 40); x.bezierCurveTo(30, 42, 16, 40, 8, 20); x.closePath(); },
  claw: x => { for (let i = 0; i < 3; i++) { const o = i * 22; x.moveTo(22 + o, 10); x.bezierCurveTo(34 + o, 30, 34 + o, 60, 20 + o, 92); x.lineTo(30 + o, 92); x.bezierCurveTo(46 + o, 60, 44 + o, 28, 22 + o, 10); x.closePath(); } },
  sun: x => { x.arc(50, 50, 22, 0, Math.PI * 2); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.moveTo(50 + Math.cos(a - 0.12) * 28, 50 + Math.sin(a - 0.12) * 28); x.lineTo(50 + Math.cos(a) * 46, 50 + Math.sin(a) * 46); x.lineTo(50 + Math.cos(a + 0.12) * 28, 50 + Math.sin(a + 0.12) * 28); x.closePath(); } },
  anchor: x => { x.rect(45, 18, 10, 58); x.rect(28, 30, 44, 8); x.arc(50, 14, 9, 0, Math.PI * 2); x.moveTo(14, 56); x.bezierCurveTo(16, 84, 40, 92, 50, 92); x.bezierCurveTo(60, 92, 84, 84, 86, 56); x.lineTo(76, 60); x.bezierCurveTo(74, 76, 62, 82, 50, 82); x.bezierCurveTo(38, 82, 26, 76, 24, 60); x.closePath(); },
  hoof: x => { x.moveTo(50, 10); x.bezierCurveTo(84, 10, 92, 50, 86, 80); x.lineTo(62, 80); x.lineTo(62, 56); x.bezierCurveTo(62, 46, 38, 46, 38, 56); x.lineTo(38, 80); x.lineTo(14, 80); x.bezierCurveTo(8, 50, 16, 10, 50, 10); x.closePath(); },
};
const ICON_MAP = { Thunder: 'bolt', Express: 'bolt', Rockets: 'bolt', Cyclones: 'bolt', Blaze: 'flame', Phantoms: 'flame', Comets: 'star', Generals: 'star', Sentinels: 'star', Admirals: 'anchor', Mariners: 'wave', Krakens: 'wave', Hurricanes: 'wave', Highlanders: 'mountain', Pioneers: 'mountain', Ironmen: 'mountain', Monarchs: 'crown', Titans: 'crown', Condors: 'wing', Vipers: 'claw', Rattlers: 'claw', Grizzlies: 'claw', Wolves: 'claw', Sabercats: 'claw', Coyotes: 'claw', Gators: 'claw', Bison: 'horns', Marauders: 'horns', Outlaws: 'sun', Lumberjacks: 'mountain', Stallions: 'hoof', Mustangs: 'hoof' };
function ensureLogo(t) { if (!t.logo || t.logo.v !== 2) t.logo = { v: 2, sh: (t.id * 7 + t.name.length) % 5, icon: ICON_MAP[t.name] || Object.keys(ICONS)[t.id % Object.keys(ICONS).length], st: t.id % 3 }; return t.logo; }
function logoShape(x, sh, S) {
  const s = S / 100; x.beginPath();
  if (sh === 0) x.arc(50 * s, 50 * s, 46 * s, 0, 7);
  else if (sh === 1) { x.moveTo(10 * s, 10 * s); x.lineTo(90 * s, 10 * s); x.lineTo(90 * s, 48 * s); x.bezierCurveTo(90 * s, 74 * s, 68 * s, 88 * s, 50 * s, 96 * s); x.bezierCurveTo(32 * s, 88 * s, 10 * s, 74 * s, 10 * s, 48 * s); x.closePath(); }
  else if (sh === 2) { x.moveTo(50 * s, 3 * s); x.lineTo(97 * s, 50 * s); x.lineTo(50 * s, 97 * s); x.lineTo(3 * s, 50 * s); x.closePath(); }
  else if (sh === 3) { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = 50 + Math.cos(a) * 48, py = 50 + Math.sin(a) * 48; i ? x.lineTo(px * s, py * s) : x.moveTo(px * s, py * s); } x.closePath(); }
  else { const r = 16 * s; x.moveTo(8 * s + r, 12 * s); x.arcTo(92 * s, 12 * s, 92 * s, 88 * s, r); x.arcTo(92 * s, 88 * s, 8 * s, 88 * s, r); x.arcTo(8 * s, 88 * s, 8 * s, 12 * s, r); x.arcTo(8 * s, 12 * s, 92 * s, 12 * s, r); x.closePath(); }
}
const LOGOIMG = {};
function logoImage(t) { if (!t.logoImg) return null; let im = LOGOIMG[t.id]; if (!im || im.src !== t.logoImg) { im = new Image(); im.onload = () => { if (typeof render === 'function' && typeof MATCH_OPEN === 'undefined') render(); }; im.src = t.logoImg; LOGOIMG[t.id] = im; } return im.complete && im.naturalWidth ? im : null; }
function drawLogo(x, t, S) {
  if (!t) return; const lg = ensureLogo(t); x.clearRect(0, 0, S, S);
  const im = logoImage(t);
  if (im) { x.save(); logoShape(x, lg.sh, S); x.clip(); x.fillStyle = t.c1; x.fillRect(0, 0, S, S); const r = Math.max(S / im.naturalWidth, S / im.naturalHeight) * (t.logoZoom || 1); const w = im.naturalWidth * r, h = im.naturalHeight * r; x.drawImage(im, (S - w) / 2, (S - h) / 2, w, h); x.restore();
    x.save(); logoShape(x, lg.sh, S); x.lineWidth = S * 0.05; x.strokeStyle = t.c2; x.stroke(); x.restore(); return; }
  x.save(); const c1 = t.c1, c2 = lum(t.c2) > 0.16 ? t.c2 : '#ffffff'; const dark = shade(c1, -0.45);
  x.save(); x.translate(S * 0.02, S * 0.04); logoShape(x, lg.sh, S); x.fillStyle = 'rgba(0,0,0,.35)'; x.fill(); x.restore();
  logoShape(x, lg.sh, S); const g = x.createLinearGradient(0, 0, S * 0.3, S); g.addColorStop(0, shade(c1, 0.28)); g.addColorStop(0.55, c1); g.addColorStop(1, dark); x.fillStyle = g; x.fill();
  x.lineWidth = S * 0.07; x.strokeStyle = c2; x.stroke(); x.lineWidth = S * 0.025; x.strokeStyle = dark; x.stroke();
  x.save(); logoShape(x, lg.sh, S); x.clip();
  if (lg.st === 1) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(S * 0.35, 0, S * 0.1, S); x.fillRect(S * 0.55, 0, S * 0.1, S); }
  if (lg.st === 2) { x.fillStyle = 'rgba(255,255,255,.1)'; x.beginPath(); x.moveTo(0, S * 0.62); x.lineTo(S, S * 0.38); x.lineTo(S, S * 0.5); x.lineTo(0, S * 0.74); x.fill(); }
  const ig = x.createRadialGradient(S * 0.5, S * 0.45, S * 0.2, S * 0.5, S * 0.5, S * 0.62); ig.addColorStop(0, 'rgba(255,255,255,0)'); ig.addColorStop(1, 'rgba(0,0,0,.32)'); x.fillStyle = ig; x.fillRect(0, 0, S, S);
  const gl = x.createLinearGradient(0, 0, 0, S * 0.5); gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gl; x.beginPath(); x.ellipse(S * 0.5, S * 0.08, S * 0.62, S * 0.36, 0, 0, Math.PI); x.fill();
  x.restore();
  const fg = lum(c1) > 0.65 ? shade(c1, -0.7) : c2;
  if (lg.icon && ICONS[lg.icon]) { x.save(); x.translate(S * 0.2, S * 0.14); x.scale(S * 0.006, S * 0.006); x.beginPath(); ICONS[lg.icon](x); x.lineJoin = 'round'; x.lineWidth = 12; x.strokeStyle = dark; x.stroke(); x.fillStyle = fg; x.fill(); x.restore();
    x.font = `700 ${Math.round(S * 0.2)}px ${CANVAS_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = S * 0.05; x.strokeStyle = dark; x.strokeText(t.abbr, S / 2, S * 0.82); x.fillStyle = '#fff'; x.fillText(t.abbr, S / 2, S * 0.82); }
  else { const L1 = (t.name || 'X')[0]; x.font = `700 ${Math.round(S * 0.66)}px ${CANVAS_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = S * 0.09; x.strokeStyle = dark; x.strokeText(L1, S / 2, S * 0.56); x.fillStyle = fg; x.fillText(L1, S / 2, S * 0.56); }
  x.save(); x.translate(S * 0.06, S * 0.06); x.scale(0.88, 0.88); logoShape(x, lg.sh, S); x.lineWidth = S * 0.018; x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke(); x.restore();
  x.restore();
}
// paint every art canvas inside root
function paintArt(root) {
  if (root) { try { paintStadiums(root); } catch (e) { console.error(e); } }
  if (!root || !L) return;
  root.querySelectorAll('canvas[data-bust]').forEach(cn => { const p = L.P[cn.dataset.bust]; if (!p) return; const T = p.tid != null ? L.teams[p.tid] : (cn.dataset.tid ? L.teams[cn.dataset.tid] : null); const cx = cn.getContext('2d'); cx.setTransform(cn.width / 96, 0, 0, cn.width / 96, 0, 0); drawBust(cx, p, T); });
  root.querySelectorAll('canvas[data-logo]').forEach(cn => { const t = L.teams[cn.dataset.logo]; if (!t) return; drawLogo(cn.getContext('2d'), t, cn.width); });
  root.querySelectorAll('canvas[data-look]').forEach(cn => { let lk; try { lk = JSON.parse(cn.dataset.look); } catch (e) { return; } const T = cn.dataset.tid ? L.teams[cn.dataset.tid] : UT(); const cx = cn.getContext('2d'); cx.setTransform(cn.width / 96, 0, 0, cn.width / 96, 0, 0); drawBust(cx, { coach: true, lk }, T); });
}

// ------------------------------------------------------------ stadium art: a night game seen from the stands (title hero, matchup card)
// sky, light towers, the crowd bowl with a ribbon board, a lit field in perspective (mow stripes, yard lines, hashes), light pools, team tint.
function drawStadium(cv, o = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), c1 = o.c1 || '#1f6b35', c2 = o.c2 || '#f2c230';
  let seed = o.seed || 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(String(h).replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16)), A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  const top = H * 0.44;                                            // where the far end of the field meets the stands
  let gr = g.createLinearGradient(0, 0, 0, top); gr.addColorStop(0, '#04070d'); gr.addColorStop(0.55, '#0b1424'); gr.addColorStop(1, '#16233a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // the bowl: rows of fans, darker toward the top rows
  const crowd = ['#d9d4c8', '#2a3240', '#5b6878', mix(c1, '#30384a', 0.35), mix(c1, '#30384a', 0.5), mix(c2, '#30384a', 0.55), '#8a3a2e', '#e9e2d0'];
  const rows = Math.max(8, Math.round(top / 7));
  for (let r = 0; r < rows; r++) { const y = top - 10 - r * (top - 14) / rows, s = Math.max(1.4, 3.2 - r * 0.12), lit = 1 - r / rows * 0.75;
    g.globalAlpha = 0.35 + 0.55 * lit; for (let x = rnd() * 6; x < W; x += s * 2.2 + rnd() * 2) { if (rnd() < 0.08) continue; g.fillStyle = crowd[(rnd() * crowd.length) | 0]; g.fillRect(x, y + rnd() * 2, s, s * 1.3); } }
  g.globalAlpha = 1;
  // ribbon board along the front of the bowl, in the home colors
  gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, mix(c1, '#000000', 0.2)); gr.addColorStop(0.5, c1); gr.addColorStop(1, mix(c1, '#000000', 0.2)); g.fillStyle = gr; g.fillRect(0, top - 9, W, 6);
  g.fillStyle = mix(c2, '#ffffff', 0.2); for (let x = 0; x < W; x += 46) g.fillRect(x + 8, top - 7.5, 24, 2.5);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, top - 3, W, 3);
  // light towers: lamp banks and their haze
  for (const fx of [0.08, 0.34, 0.66, 0.92]) { const x = W * fx, y = Math.max(10, top * 0.2);
    const hz = g.createRadialGradient(x, y, 0, x, y, W * 0.2); hz.addColorStop(0, 'rgba(255,244,214,.55)'); hz.addColorStop(0.25, 'rgba(255,236,200,.16)'); hz.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = hz; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fffaf0'; for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) g.fillRect(x + i * 6 - 2, y + j * 5 - 2, 4, 3); }
  // the field, in perspective: depth u = 0 (bottom of the picture) .. 1 (far end)
  const dN = 40, dF = dN * 2.2, hzY = top - (H - top) * (dN / dF) / (1 - dN / dF), F = 0.62 * W * dN / 24.4;
  const yOf = d => hzY + (H - hzY) * dN / d, xOf = (xw, d) => W / 2 + xw * F / d;
  const quad = (x0, x1, d0, d1, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(xOf(x0, d0), yOf(d0)); g.lineTo(xOf(x1, d0), yOf(d0)); g.lineTo(xOf(x1, d1), yOf(d1)); g.lineTo(xOf(x0, d1), yOf(d1)); g.closePath(); g.fill(); };
  quad(-80, 80, dN * 0.6, dF, '#1f4a1d');                                                   // apron
  const yd = 4.572; let k = 0; for (let d = dF; d > dN * 0.6; d -= yd, k++) quad(-24.4, 24.4, Math.max(dN * 0.6, d - yd), d, k % 2 ? '#2f6b2a' : '#36782f');
  quad(-24.9, -24.4, dN * 0.6, dF, '#f2f2ea'); quad(24.4, 24.9, dN * 0.6, dF, '#f2f2ea');   // sidelines
  for (let d = dF; d > dN * 0.6; d -= yd) quad(-24.4, 24.4, d - 0.11, d + 0.11, 'rgba(245,245,238,.92)');
  for (let d = dF; d > dN * 0.6; d -= 0.9144) for (const hx of [-2.82, 2.82, -23.5, 23.5]) quad(hx - 0.35, hx + 0.35, d - 0.05, d + 0.05, 'rgba(245,245,238,.8)');
  // grass grain
  for (let i = 0; i < W * H / 40; i++) { const x = rnd() * W, y = top + rnd() * (H - top); g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,220,.05)'; g.fillRect(x, y, 1, 1.6); }
  // pools of light on the turf, then the team colors washing in from each side
  g.globalCompositeOperation = 'lighter';
  for (const fx of [0.2, 0.5, 0.8]) { const lp = g.createRadialGradient(W * fx, H * 0.78, 0, W * fx, H * 0.78, W * 0.32); lp.addColorStop(0, 'rgba(255,250,225,.13)'); lp.addColorStop(1, 'rgba(255,250,225,0)'); g.fillStyle = lp; g.fillRect(0, top, W, H - top); }
  g.globalCompositeOperation = 'source-over';
  if (o.left) { const t = g.createLinearGradient(0, 0, W * 0.5, 0); t.addColorStop(0, mix(o.left, '#000000', 0.1)); t.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.5; g.fillStyle = t; g.fillRect(0, 0, W * 0.5, H); g.globalAlpha = 1; }
  if (o.right) { const t = g.createLinearGradient(W, 0, W * 0.5, 0); t.addColorStop(0, mix(o.right, '#000000', 0.1)); t.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.5; g.fillStyle = t; g.fillRect(W * 0.5, 0, W * 0.5, H); g.globalAlpha = 1; }
  // vignette + a dark floor so text on top stays readable
  const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  gr = g.createLinearGradient(0, H * 0.55, 0, H); gr.addColorStop(0, 'rgba(4,8,14,0)'); gr.addColorStop(1, `rgba(4,8,14,${o.floor ?? 0.55})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function paintStadiums(root) {
  root.querySelectorAll('canvas[data-stadium]').forEach(cn => { const r = cn.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(200, Math.round(r.width * dpr)), h = Math.max(120, Math.round(r.height * dpr));
    if (cn.width === w && cn.height === h && cn._done) return; cn.width = w; cn.height = h; let o = {}; try { o = JSON.parse(cn.dataset.stadium || '{}'); } catch (e) { } drawStadium(cn, o); cn._done = true; });
}
