// Play selection: playbooks, scoring plays for a situation, CPU play calling, tendencies the AI learns.
function teamBook(T, side) { if (side === 'O') { if (T.id === L.user && L.myOBook) return L.myOBook; return (T.oc && T.oc.book) || STYLE2BOOK[T.offStyle] || 'pro'; } if (T.id === L.user && L.myDBook) return L.myDBook; return (T.dc && T.dc.book) || STYLE2BOOK[T.defStyle] || 'multi'; }
function playsFor(tid, side) {
  const T = L.teams[tid]; const all = L.plays.filter(p => p.side === side && p.on !== false && (!p.custom || tid === L.user));
  if (!T) return all; const bk = teamBook(T, side); const f = all.filter(p => bookHas(p, bk)); return f.length >= 6 ? f : all;
}
function oppCached(o) { L._oc = L._oc || {}; const k = o.id + '|' + L.year + '|' + L.week; if (!L._oc[k]) { for (const x in L._oc) if (!x.endsWith('|' + L.year + '|' + L.week)) delete L._oc[x]; L._oc[k] = scoutOpp(o); } return L._oc[k]; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function scorePlay(p, key, opp, T) {
  let s = 0; const pass = p.type === 'pass';
  if (p.side === 'O') {
    const st = OFF_STYLES[T.offStyle] || { pass: .55, deep: .3 }; s += pass ? (st.pass - 0.5) * 2 : (0.5 - st.pass) * 2;
    if (['3long', '2long'].includes(key)) s += (pass ? 2 : -1.5) + (p.deep ? 0.6 : 0);
    if (['3short', '2short', '4short'].includes(key)) s += (pass ? -0.4 : 1.4) + (['dive', 'zone', 'power'].includes(p.scheme) ? 0.6 : 0);
    if (key === '1st') s += p.pa ? 0.8 : 0;
    if (key === 'goal') s += p.form === 'Goal Line' ? 3 : -1; else if (p.form === 'Goal Line') s -= 4;
    if (key === 'red') s += (/Fade|Slant|Flood|Smash|Stick/.test(p.name) ? 1.2 : 0) - (p.deep ? 1.5 : 0);
    if (key === '2min') s += pass ? 1.8 : -1.5;
    const ds = opp.defStyle;
    if (ds === 'Blitz Heavy') s += /Screen|Slant|Quick|Mesh|Stick|Bubble|Draw/.test(p.name) ? 1.3 : 0;
    if (ds === 'Cover 2') s += (/Seam|Vert|Dig|Smash|Zone|Dagger/.test(p.name) ? 1 : 0) + (pass ? 0 : 0.4);
    if (ds === 'Man Press') s += /Mesh|Slant|Cross|Drag|Bunch/.test(p.name) ? 1.2 : 0;
    if (ds === 'Cover 3') s += /Curl|Flood|Smash|Levels|Stick/.test(p.name) ? 1.1 : 0;
    const P = oppCached(opp); const quick = /Slant|Stick|Hitch|Screen|Bubble|Mesh|Drag|Quick|Spot|Hank|Shallow|Glance/.test(p.name);
    if (P.rush > 75) s += quick ? 1.2 : (p.deep ? -0.8 : 0); if (P.cover < 68) s += pass ? (p.deep ? 1.3 : 0.7) : 0; if (P.cover > 80) s += pass ? (p.deep ? -1 : -0.3) : 0.4; if (P.runD < 66) s += pass ? 0 : 1.2; if (P.runD > 80) s += pass ? 0.6 : -0.8;
    if (T.id === L.user && L.balance != null) s += (pass ? 1 : -1) * (L.balance - 0.5) * 3.2;
    if (T.id === L.user && L.splan && L.splan.y === L.year && L.splan.w === L.week) { const E = L.splan.oc; if (E === 'run') s += pass ? -0.4 : 1.4; if (E === 'deep') s += p.deep ? 1.4 : 0; if (E === 'quick') s += quick ? 1.3 : -0.2; }
  } else {
    const os = opp.offStyle; const blitz = p.blitz && p.blitz.length > 0, zone = !MAN_COVERAGES[p.cov];
    if (['3long', '2long'].includes(key)) s += (p.form === 'Dime' || p.form === 'Nickel' ? 1.6 : 0) + (['c4', 'c2', 'c2t'].includes(p.cov) ? 0.8 : 0);
    if (['3short', '2short', '4short', 'goal'].includes(key)) s += (p.form === 'Goal Line D' ? (key === 'goal' ? 2.5 : 0.6) : 0) + (p.form === '4-3' || p.form === '3-4' ? 0.8 : 0) + (blitz ? 0.6 : 0);
    if (key !== 'goal' && p.form === 'Goal Line D') s -= 3; if (key === 'goal') s += p.form === 'Goal Line D' ? 2.5 : -1.2;
    if (key === '2min') s += (['c2', 'c4', 'c2t'].includes(p.cov) ? 1.4 : 0) - (blitz ? 0.5 : 0);
    if (os === 'Air Raid' || os === 'Spread') s += (p.form === 'Nickel' || p.form === 'Dime') ? 0.9 : 0;
    if (os === 'Ground & Pound') s += (p.form === '4-3' || p.form === '3-4') ? 0.9 : 0;
    if (os === 'West Coast') s += zone ? 0.6 : 0;
    const ds = DEF_STYLES[T.defStyle] || DEF_STYLES.Balanced; s += (blitz ? ds.blitz : 0) * 2 + (zone ? (1 - ds.man) : ds.man) * 0.8;
    const P = oppCached(opp); if (P.passO > 80) s += (p.form === 'Nickel' || p.form === 'Dime') ? 0.9 : 0; if (P.runO > 80) s += (p.form === '4-3' || p.form === '3-4') ? 0.9 : 0; if (P.pblk < 70 && blitz) s += 0.8;
    if (T.id === L.user && L.splan && L.splan.y === L.year && L.splan.w === L.week) { const E = L.splan.dc; if (E === 'blitz') s += blitz ? 1.4 : -0.3; if (E === 'safe') s += ['c2', 'c4', 'c2t'].includes(p.cov) ? 1.2 : (blitz ? -0.8 : 0); if (E === 'run') s += (p.form === '4-3' || p.form === '3-4') ? 1 : 0; }
  }
  s += (hashStr(p.id + '|' + L.year + '|' + L.week + '|' + key) - 0.5) * 2.0;
  return s;
}
// ---------- CPU play calling ----------
function tend() { L.tend = L.tend || { run: 0, pass: 0, third: { run: 0, pass: 0 }, plays: {}, man: 0, zone: 0, blitz: 0 }; return L.tend; }
function noteCall(tid, playId, ctx) {
  const p = L.plays.find(x => x.id === playId); if (!p || tid !== L.user) return; const T = tend(); L._used = L._used || {}; L._used[playId] = (L._used[playId] || 0) + 1;
  if (p.side === 'O') { T[p.type === 'run' ? 'run' : 'pass']++; if (ctx && ctx.down === 3) T.third[p.type === 'run' ? 'run' : 'pass']++; T.plays[playId] = (T.plays[playId] || 0) + 1; }
  else { if (p.blitz && p.blitz.length) T.blitz++; if (MAN_COVERAGES[p.cov]) T.man++; else T.zone++; }
}
function cpuCall(tid, side, ctx) {
  const T = L.teams[tid]; ctx = ctx || {}; const pool = playsFor(tid, side); if (!pool.length) return null;
  const down = ctx.down || 1, togo = ctx.togo || 10, yl = ctx.yl || 25, q = ctx.q || 1, clock = ctx.clock ?? 900, qlen = ctx.qlen || L.qlen, sd = ctx.sd || 0; const late = q >= 4 && clock < qlen * 0.45;
  if (side === 'O') {
    const st = OFF_STYLES[T.offStyle] || OFF_STYLES.Balanced; let pass = st.pass; const ps = T.oc ? T.oc.persona : 'adaptive';
    if (down === 3 && togo >= 6) pass = 0.88; else if (down >= 3 && togo <= 2) pass = 0.35;
    if (late && sd < 0) pass = Math.max(pass, 0.8); if (late && sd > 0) pass = Math.min(pass, 0.3);
    if (ps === 'conservative') pass -= 0.06; if (ps === 'aggressive') pass += 0.05;
    let c = pool.filter(p => yl >= 97 ? (p.form === 'Goal Line' || p.form === 'I-Form') : (p.form !== 'Goal Line' || togo <= 1));
    if (!c.length) c = pool;
    const type = R() < pass ? 'pass' : 'run'; let d = c.filter(p => p.type === type); if (!d.length) d = c;
    if (type === 'pass') { const deep = R() < st.deep + (ps === 'aggressive' ? 0.15 : 0) && yl < 85; const d2 = d.filter(p => !!p.deep === deep); if (d2.length) d = d2; }
    if (ps === 'adaptive' && ctx.oppTid === L.user) { const t = tend(); const man = (t.man + 1) / (t.man + t.zone + 2); const want = man > 0.6 ? /Slant|Mesh|Cross|Drag|Shallow|Stick/ : man < 0.4 ? /Flood|Smash|Curl|Sail|Levels|Spot|Dagger/ : null; if (want && R() < 0.4) { const d3 = d.filter(p => want.test(p.name)); if (d3.length) d = d3; } }
    // weight toward plays that fit the situation
    const opp = L.teams[ctx.oppTid] || T; const sc = ctx.scen || scenKeyFor(down, togo, yl, q, clock, qlen, sd);
    const ranked = d.map(p => ({ p, s: scorePlay(p, sc, opp, T) + R() * 2.5 })).sort((a, b) => b.s - a.s);
    return ranked[0].p.id;
  }
  const st = DEF_STYLES[T.defStyle] || DEF_STYLES.Balanced; const ps = T.dc ? T.dc.persona : 'adaptive'; const f = ctx.offForm || 'Shotgun';
  let forms; if (f === 'Goal Line' || yl >= 96) forms = ['Goal Line D']; else if (f === 'Empty' || f === 'Trips' || (down >= 3 && togo >= 8)) forms = ['Nickel', 'Dime']; else if (f === 'Shotgun') forms = ['Nickel', '4-3', '3-4']; else forms = ['4-3', '3-4'];
  let c = pool.filter(p => forms.includes(p.form)); if (!c.length) c = pool.filter(p => p.form !== 'Goal Line D'); if (!c.length) c = pool;
  let blitzP = st.blitz + (ps === 'blitz' ? 0.2 : ps === 'conservative' ? -0.1 : 0); if (late && sd > 0) blitzP *= 0.5;
  const blitz = R() < blitzP; let c2 = c.filter(p => (p.blitz.length > 0) === blitz); if (c2.length) c = c2;
  const man = R() < st.man; c2 = c.filter(p => !!MAN_COVERAGES[p.cov] === man); if (c2.length) c = c2;
  if (ps === 'adaptive' && ctx.oppTid === L.user) { const t = tend(); const pr = (t.pass + 1) / (t.run + t.pass + 2); const third = down === 3 ? (t.third.pass + 1) / (t.third.run + t.third.pass + 2) : pr;
    if (third > 0.68 && R() < 0.5) { const z = c.filter(p => ['c2', 'c4', 'c2t', 'c3'].includes(p.cov)); if (z.length) c = z; } else if (pr < 0.4 && R() < 0.5) { const z = c.filter(p => p.form === '4-3' || p.form === '3-4'); if (z.length) c = z; } }
  // in-game film: whatever has been beating them from this formation, every coordinator adjusts to it (most of the time, so he is not predictable either)
  const fl = ctx.film || []; if (fl.length) {
    const w = { run: 0, deep: 0, short: 0 }; for (const e of fl) w[e.type === 'run' ? 'run' : e.deep ? 'deep' : 'short'] += e.w;
    const tot = w.run + w.deep + w.short, top = Object.keys(w).sort((a, b) => w[b] - w[a])[0], share = tot ? w[top] / tot : 0, adj = clamp(0.35 + tot / 60, 0.35, 0.85) * (share > 0.45 ? 1 : 0.6);
    if (R() < adj) {
      const fits = top === 'run' ? (p => (p.form === '4-3' || p.form === '3-4' || p.form === 'Goal Line D') && (p.blitz.length > 0 || ['c1', 'c3', 'c0'].includes(p.cov)))
        : top === 'deep' ? (p => ['c2', 'c4', 'c2t', 'c2m', 'c6'].includes(p.cov) && p.blitz.length <= 1)
        : (p => !!MAN_COVERAGES[p.cov] || p.blitz.length > 0 || p.cov === 'c3');
      const pool2 = pool.filter(p => p.form !== 'Goal Line D' || yl >= 96).filter(fits); if (pool2.length) return pick(pool2).id;
    }
  }
  return pick(c).id;
}
function fgProb(T, yl) { const k = L.P[depthPick(T, 'K', 0, new Set())]; if (!k) return { p: 0.3, d: 100 - yl + 17 }; const d = 100 - yl + 17; const rng = 40 + k.a.kpw * 0.2; if (d > rng + 3) return { p: 0.02, d }; let p = 0.99 - Math.max(0, d - 22) * 0.011 * (1 + (80 - k.a.kac) / 60); if (d > rng) p *= 0.4; return { p: clamp(p, 0.02, 0.995), d }; }
function cpuFourth(tid, ctx) {
  const T = L.teams[tid]; ctx = ctx || {}; const yl = ctx.yl || 25, togo = ctx.togo || 10, q = ctx.q || 1, clock = ctx.clock ?? 900, qlen = ctx.qlen || L.qlen, sd = ctx.sd || 0;
  const fg = fgProb(T, yl); const late = q >= 4 && clock < qlen * 0.6; const ag = T.oc && T.oc.persona === 'aggressive' ? 1 : 0;
  if (late && sd < 0 && (sd < -3 || fg.p < 0.5)) return 'go'; if (late && sd <= 0 && sd >= -3 && fg.p > 0.6) return 'fg';
  if (togo <= 1 && yl >= 45 - ag * 10) return 'go'; if (fg.p >= 0.55) return 'fg'; if (togo <= 2 && yl >= 60 - ag * 8) return 'go'; return 'punt';
}
