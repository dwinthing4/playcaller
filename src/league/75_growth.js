// Growth: development tiers, potential grades, OVR history per season, the offseason growth model (age + potential + coaching + playing time),
// and draft-prospect archetypes (raw high-ceiling projects, pro-ready vets, hidden gems, boom-or-bust).
const DEV_TIERS = { slow: { n: 'Slow', c: '#9aa3ad', m: 0.65, icon: '▾' }, normal: { n: 'Normal', c: '#d8dde3', m: 1, icon: '•' }, quick: { n: 'Fast', c: '#6cc6ff', m: 1.25, icon: '▴' }, star: { n: 'Superstar', c: '#ffd23f', m: 1.5, icon: '★' } };
function devTier(p) { const k = (p && p.dev) || 'normal', t = DEV_TIERS[k] || DEV_TIERS.normal; return { k, n: t.n, c: t.c, icon: t.icon, m: t.m }; }
const POT_GRADES = [[90, 'A+'], [85, 'A'], [81, 'A-'], [78, 'B+'], [75, 'B'], [72, 'B-'], [69, 'C+'], [66, 'C'], [62, 'C-'], [0, 'D']];
function gradeOf(v) { for (const [t, g] of POT_GRADES) if (v >= t) return g; return 'D'; }
const GRADE_C = g => g[0] === 'A' ? '#3ecf8e' : g[0] === 'B' ? '#9be15d' : g[0] === 'C' ? '#ffd166' : g === '?' ? '#8a96a3' : '#ff9b6b';
// what the user knows about a player's ceiling. Prospects: only what the scouts have found (a range until they know him well)
function potGrade(p) {
  if (!p) return { g: '?', known: false };
  if (p.draft) {
    if (!(p.sc && p.sc.lvl >= 2)) return { g: '?', known: false };
    const v = p.scoutPot || p.pot, err = p.sc.lvl >= 4 ? 1 : p.sc.lvl >= 3 ? 3 : 5, lo = gradeOf(v - err), hi = gradeOf(v + err);
    return { g: gradeOf(v), v, lo, hi, range: lo !== hi, known: true };
  }
  return { g: gradeOf(p.pot || p.ovr), v: p.pot || p.ovr, known: true };
}
function potBadge(p) { const g = potGrade(p), txt = g.range ? `${g.lo}–${g.hi}` : g.g; return `<span class="potg" style="--pg:${GRADE_C(g.range ? g.hi : g.g)}" title="Potential${g.known ? ' ~' + g.v : ': not scouted yet'}">${txt}</span>`; }
function devBadge(p) { const d = devTier(p); return `<span class="devb dev-${d.k}" style="--dv:${d.c}" title="Development: ${d.n}">${d.icon} ${d.n}</span>`; }
const ARCH = { raw: ['Raw, high ceiling', 'The tools are special. Needs time, could be a star.'], polished: ['Pro-ready', 'Can play right away. Not much more to come.'], gem: ['Hidden gem', 'Off everybody\'s radar. I think he is a real find.'], boom: ['Boom or bust', 'Huge upside and real red flags.'] };
function archTag(p) { const a = p && p.arch && ARCH[p.arch]; if (!a || !(p.sc && p.sc.lvl >= 2) && p.draft) return ''; return `<span class="archt arch-${p.arch}">${a[0]}</span>`; }

// ---------- OVR history ----------
function growthRecord(p) { p.ovrHist = p.ovrHist || []; const last = p.ovrHist[p.ovrHist.length - 1]; if (last && last.y === L.year) { last.ovr = p.ovr; last.pot = p.pot; return; } p.ovrHist.push({ y: L.year, age: p.age, ovr: p.ovr, pot: p.pot }); if (p.ovrHist.length > 20) p.ovrHist.shift(); }
// tiny OVR-by-season chart (seasons played + today), as inline SVG
function ovrSpark(p, w = 220, h = 54) {
  const pts = (p.ovrHist || []).map(e => ({ y: e.y, o: e.ovr })); pts.push({ y: L.year + (L.phase === 'offseason' ? 0.5 : 0) + 0.01, o: p.ovr, now: true });
  if (pts.length < 2) return `<div class="spark empty small mute">History starts after his first season with you.</div>`;
  const lo = Math.min(...pts.map(q => q.o), p.pot || 99) - 3, hi = Math.max(...pts.map(q => q.o), p.pot || 0) + 3, X = i => 8 + i * (w - 16) / (pts.length - 1), Y = v => h - 8 - (v - lo) / Math.max(1, hi - lo) * (h - 16);
  const line = pts.map((q, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(q.o).toFixed(1)}`).join(' '), potY = Y(p.pot || p.ovr).toFixed(1);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none"><line x1="0" x2="${w}" y1="${potY}" y2="${potY}" class="spot"/><path d="${line}" class="sl"/>${pts.map((q, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(q.o).toFixed(1)}" r="${q.now ? 3.6 : 2.6}" class="${q.now ? 'sn' : 'sd'}"><title>${q.now ? 'Now' : Math.floor(q.y)}: ${q.o}</title></circle>`).join('')}</svg>`;
}

// ---------- the offseason growth model ----------
// how much a player's overall should move this offseason. Young players with room under their potential grow the most
function seasonGrowth(p, t) {
  const room = Math.max(0, (p.pot || p.ovr) - p.ovr), a = p.age; let d, why = '';
  if (a <= 22) d = room * rnd(0.28, 0.5) + rnd(0.5, 2.5);
  else if (a === 23) d = room * rnd(0.22, 0.42) + rnd(0, 2);
  else if (a <= 25) d = room * rnd(0.15, 0.32) + rnd(-0.5, 1.5);
  else if (a <= 27) d = room * rnd(0.08, 0.22) + rnd(-1, 1);
  else if (a <= 29) d = room * 0.08 + rnd(-1.5, 1);
  else if (a <= 31) d = rnd(-3.5, 0);
  else d = rnd(-6, -1.5) - (a - 32) * 0.9;
  if (p.dev === 'slow' && a >= 28) d -= 1;
  if (d > 0) {
    const coach = t ? 1 + ((t.coach && t.coach.dev || 5) - 5) * 0.06 : 1, pc = t ? 1 + 0.06 * (((t.pcs || {})[pcGroup(p.pos)] || 1) - 1) : 1, fac = t && t.fac ? 1 + 0.03 * (t.fac.train + t.fac.weight - 2) : 1;
    const last = (p.hist || []).filter(h => h.y === L.year).pop(), sn = last ? last.snaps || 0 : 0, play = !t ? 0.85 : sn > 500 ? 1.15 : sn > 150 ? 1.05 : 0.9;
    d *= devTier(p).m * coach * pc * fac * play;
  }
  if (p.redshirt) { d += 2; why = 'redshirt year'; }
  // young players can break out (or stall)
  if (a <= 26 && R() < 0.07 + (p.dev === 'star' ? 0.05 : 0)) { const b = ri(2, 6); d += rnd(3, 6); p.pot = clamp((p.pot || p.ovr) + b, p.ovr, 99); raiseCaps(p, b); why = 'breakout'; }
  else if (a <= 25 && R() < 0.05 + (p.dev === 'slow' ? 0.05 : 0)) { d *= 0.2; p.pot = Math.max(p.ovr, (p.pot || p.ovr) - ri(2, 5)); why = 'stalled'; }
  return { d, why };
}
function raiseCaps(p, n) { ensurePot(p); for (const k of Object.keys(POS_PROFILE[p.pos] || {})) p.ap[k] = clamp((p.ap[k] || p.a[k]) + n, p.a[k], 99); }
// turn an overall change into rating changes: the position's key ratings move first (inside each rating's ceiling), age takes the physical ones
function applyGrowth(p, delta) {
  ensurePot(p); const w = OVR_W[p.pos] || {}, prof = Object.keys(POS_PROFILE[p.pos] || {}), before = Object.assign({}, p.a), target = clamp(Math.round(p.ovr + delta), 25, 99);
  const pickK = (keys, wt) => { let tot = 0; for (const k of keys) tot += wt(k); let r = R() * tot; for (const k of keys) { r -= wt(k); if (r <= 0) return k; } return keys[keys.length - 1]; };
  let guard = 0;
  if (delta > 0) {
    while (calcOvr(p) < target && guard++ < 300) { const ks = Object.keys(w).filter(k => p.a[k] < (p.ap[k] || 99) && p.a[k] < 99); if (!ks.length) break; const k = pickK(ks, k => w[k]); p.a[k]++;
      if (R() < 0.35) { const sec = prof.filter(k2 => !(k2 in w) && p.a[k2] < (p.ap[k2] || 99)); if (sec.length) p.a[pick(sec)]++; } }
  } else if (delta < 0) {
    const phys = ['spd', 'acc', 'agi', 'jmp', 'str'], old = p.age >= 29;
    while (calcOvr(p) > target && guard++ < 300) { const ks = Object.keys(w).concat(old ? phys : []).filter(k => p.a[k] > 20); if (!ks.length) break; const k = pickK(ks, k => (w[k] || 0) + (old && phys.includes(k) ? 2.5 : 0)); p.a[k]--; }
  }
  if (p.age >= 29) { p.a.spd = clamp(p.a.spd - ri(0, 2), 10, 99); p.a.acc = clamp(p.a.acc - ri(0, 1), 10, 99); }
  if (p.age >= 25 && p.age <= 33 && R() < 0.6) p.a.awr = clamp(p.a.awr + ri(1, 2), 10, Math.max(p.ap.awr || 99, p.a.awr));      // veterans keep getting smarter
  p.ovr = calcOvr(p); for (const k of ATTRS) p.ap[k] = Math.max(p.ap[k] || 0, p.a[k]);
  const ch = {}; for (const k of ATTRS) { const dk = p.a[k] - (before[k] ?? p.a[k]); if (dk) ch[k] = dk; } return ch;
}
// the user's team: who jumped, who slipped, written up for the inbox
function growthMemo(rep) {
  if (L.ghost || !rep) return; const up = rep.up.slice(0, 6).map(u => { const p = L.P[u.id]; return p ? `${p.pos} ${p.ln} +${u.d} (${p.ovr}, age ${p.age}${u.why ? ', ' + u.why : ''})` : ''; }).filter(Boolean);
  const dn = rep.down.slice(0, 4).map(u => { const p = L.P[u.id]; return p ? `${p.pos} ${p.ln} ${u.d} (${p.ovr}, age ${p.age})` : ''; }).filter(Boolean);
  if (up.length || dn.length) inbox('coach', 'Offseason development', `${up.length ? 'Big jumps: ' + up.join('; ') + '.' : 'No big jumps this year.'} ${dn.length ? 'Slipping: ' + dn.join('; ') + '.' : ''} Young players with high potential grow the most, and playing time, your position coaches and facilities speed it up.`, { actions: [{ label: 'Open development', act: 'go', arg: 'develop' }] });
}

// ---------- draft archetypes ----------
function draftArchetype(i) {
  if (i < 10) return pick(['normal', 'normal', 'polished', 'raw']);
  const r = R(); if (i >= 45 && r < 0.09) return 'gem'; if (r < 0.24) return 'raw'; if (r < 0.40) return 'polished'; if (r < 0.48) return 'boom'; return 'normal';
}
function shapeProspect(p, arch) {
  const o = p.ovr; p.arch = arch;
  if (arch === 'raw') { p.pot = clamp(Math.round(o + rnd(20, 34)), o, 99); p.dev = pick(['quick', 'quick', 'star', 'normal']); p.potNoise = gauss() * 9; }
  else if (arch === 'polished') { p.pot = clamp(Math.round(o + rnd(1, 6)), o, 99); p.dev = pick(['normal', 'normal', 'slow']); p.potNoise = gauss() * 3; }
  else if (arch === 'gem') { p.pot = clamp(Math.round(o + rnd(18, 30)), o, 99); p.dev = pick(['quick', 'star', 'normal']); p.potNoise = -(p.pot - o) * rnd(0.55, 0.85); }
  else if (arch === 'boom') { const hit = R() < 0.5; p.pot = clamp(Math.round(o + (hit ? rnd(22, 32) : rnd(0, 5))), o, 99); p.dev = hit ? pick(['star', 'quick']) : pick(['slow', 'normal']); p.potNoise = (o + 16) - p.pot + gauss() * 3; }
  else { p.pot = clamp(Math.round(o + rnd(4, 18)), o, 99); p.potNoise = gauss() * 7; }
}
