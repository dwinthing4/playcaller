// Measurables and the combine.
// Every player has a height, weight, arm length, hand size, 40, 10-yard split, vertical, broad jump, bench (225 reps), 3-cone and shuttle.
// The athletic ratings (spd, acc, agi, str, jmp) and the drill numbers are two views of the same thing:
//  - msrOf(p) reads the drills off his current ratings and body, so when age takes his speed his 40 slows with it.
//  - msrGen(p) builds a NEW player's drills first (from his body and athletic level) and derives those five ratings from them.
//  - p.ms keeps only what the ratings can't hold: arm, hand, the eighths of an inch on his height, and how his agility and
//    explosion split between the two drills that measure each. It is filled from a hash of his id, so old saves get the same numbers every load.
// The 40 and the 10-yard split are absolute (they are what the engine's top speed and burst are). Agility, explosion and strength
// read against the position's normal numbers, because the engine's ratings for those are spread per position.
// Draft prospects get combine results (p.comb, with real-day noise, some skipped drills, pro days for the rest) that feed CPU draft stock.

// spd -> 40 time and acc -> 10-yard split (before the weight term), as knots for piecewise-linear lookups
const MS_FORTY = [[10, 5.68], [15, 5.58], [20, 5.48], [25, 5.38], [30, 5.28], [35, 5.18], [40, 5.09], [45, 5.00], [50, 4.91], [55, 4.82], [60, 4.73], [65, 4.65], [70, 4.58], [75, 4.51], [80, 4.45], [85, 4.40], [90, 4.35], [95, 4.30], [99, 4.26], [110, 4.16]];
const MS_TEN = [[10, 1.88], [30, 1.773], [50, 1.667], [70, 1.561], [85, 1.49], [99, 1.43], [110, 1.39]];
// per position: body refs (ht in, wt lb, arm, hand), the normal drill numbers and the rating they belong to.
// ag/jp/st/sp/ac = mean agility/jumping/strength/speed/acceleration rating at the position (what generated rosters average);
// the rating's sd is 14 when it is part of the position's profile and 7.5 when it is filler (see POS_PROFILE)
const MS_REF = {
  QB: { ht: 75.4, wt: 227, arm: 32.0, hand: 9.6, cone: 7.08, sh: 4.30, vert: 31.5, broad: 112, bench: 18, ag: 62.5, jp: 34.8, st: 49.9, sp: 55.8, ac: 61.9 },
  RB: { ht: 70.0, wt: 210, arm: 31.0, hand: 9.25, cone: 7.02, sh: 4.24, vert: 35.0, broad: 120, bench: 19, ag: 72.3, jp: 35.3, st: 58.8, sp: 74.3, ac: 74.1 },
  FB: { ht: 72.6, wt: 245, arm: 31.5, hand: 9.5, cone: 7.25, sh: 4.40, vert: 32.5, broad: 113, bench: 24, ag: 35.6, jp: 35.7, st: 77.0, sp: 61.6, ac: 65.5 },
  WR: { ht: 73.1, wt: 200, arm: 32.0, hand: 9.5, cone: 6.95, sh: 4.20, vert: 36.0, broad: 123, bench: 14, ag: 70.2, jp: 63.8, st: 41.4, sp: 74.1, ac: 72.1 },
  TE: { ht: 77.0, wt: 252, arm: 33.0, hand: 9.75, cone: 7.12, sh: 4.35, vert: 33.5, broad: 117, bench: 20, ag: 34.9, jp: 62.5, st: 65.5, sp: 64.2, ac: 64.9 },
  OT: { ht: 78.0, wt: 318, arm: 34.25, hand: 10.0, cone: 7.75, sh: 4.72, vert: 28.5, broad: 103, bench: 24, ag: 33.6, jp: 34.7, st: 67.9, sp: 31.1, ac: 38.4 },
  OG: { ht: 76.4, wt: 317, arm: 33.5, hand: 10.0, cone: 7.78, sh: 4.72, vert: 28.0, broad: 102, bench: 26, ag: 33.3, jp: 35.4, st: 70.3, sp: 30.4, ac: 39.1 },
  C: { ht: 75.5, wt: 305, arm: 32.75, hand: 9.9, cone: 7.62, sh: 4.62, vert: 28.5, broad: 103, bench: 26, ag: 37.0, jp: 35.2, st: 72.6, sp: 31.6, ac: 40.5 },
  DE: { ht: 77.0, wt: 270, arm: 33.75, hand: 10.0, cone: 7.18, sh: 4.40, vert: 33.5, broad: 117, bench: 24, ag: 34.3, jp: 35.0, st: 64.0, sp: 63.9, ac: 67.6 },
  DT: { ht: 75.1, wt: 316, arm: 33.0, hand: 10.1, cone: 7.62, sh: 4.65, vert: 29.5, broad: 105, bench: 29, ag: 34.9, jp: 34.8, st: 72.4, sp: 44.0, ac: 53.5 },
  LB: { ht: 74.0, wt: 239, arm: 32.5, hand: 9.75, cone: 7.08, sh: 4.27, vert: 34.5, broad: 119, bench: 22, ag: 35.3, jp: 34.8, st: 57.7, sp: 63.3, ac: 65.3 },
  CB: { ht: 71.5, wt: 190, arm: 31.5, hand: 9.1, cone: 6.94, sh: 4.16, vert: 36.5, broad: 124, bench: 14, ag: 71.5, jp: 63.0, st: 35.1, sp: 75.5, ac: 73.8 },
  S: { ht: 72.0, wt: 205, arm: 31.5, hand: 9.35, cone: 6.97, sh: 4.19, vert: 36.0, broad: 122, bench: 16, ag: 68.5, jp: 62.9, st: 34.8, sp: 73.9, ac: 72.1 },
  K: { ht: 72.6, wt: 201, arm: 31.0, hand: 9.25, cone: 7.25, sh: 4.40, vert: 30.0, broad: 108, bench: 11, ag: 35.3, jp: 35.9, st: 35.3, sp: 54.5, ac: 34.6 },
  P: { ht: 74.6, wt: 213, arm: 31.5, hand: 9.4, cone: 7.30, sh: 4.45, vert: 30.0, broad: 108, bench: 11, ag: 35.3, jp: 35.0, st: 35.1, sp: 55.4, ac: 35.3 },
};
// spread of each drill inside a position (one standard deviation) and what a pound / an inch of arm does to it
const MS_SD = { cone: 0.2, sh: 0.12, vert: 3.0, broad: 7.0, bench: 4.5 };
const MS_WT = { ten: 0.0006, cone: 0.004, sh: 0.0025, vert: -0.04, broad: -0.12, bench: 0.05 }, MS_ARM_BENCH = 1.1;
const MS_DRILLS = [['forty', '40', 's'], ['ten', '10 split', 's'], ['vert', 'Vertical', '"'], ['broad', 'Broad', ''], ['bench', 'Bench', ''], ['cone', '3-cone', 's'], ['shuttle', 'Shuttle', 's']];
const MS_LOWER_BETTER = { forty: 1, ten: 1, cone: 1, shuttle: 1 };

function msLook(t, x) { if (x <= t[0][0]) return t[0][1] + (x - t[0][0]) * (t[1][1] - t[0][1]) / (t[1][0] - t[0][0]); for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const [a, va] = t[i - 1], [b, vb] = t[i]; return va + (x - a) * (vb - va) / (b - a); } const n = t.length; return t[n - 1][1] + (x - t[n - 1][0]) * (t[n - 1][1] - t[n - 2][1]) / (t[n - 1][0] - t[n - 2][0]); }
function msInv(t, y) { for (let i = 1; i < t.length; i++) { const [a, va] = t[i - 1], [b, vb] = t[i]; if ((y <= va && y >= vb) || (y >= va && y <= vb)) return a + (y - va) * (b - a) / (vb - va); } return y > t[0][1] ? t[0][0] - (y - t[0][1]) * (t[1][0] - t[0][0]) / (t[0][1] - t[1][1]) : t[t.length - 1][0] + (t[t.length - 1][1] - y) * (t[t.length - 1][0] - t[t.length - 2][0]) / (t[t.length - 2][1] - t[t.length - 1][1]); }
const msR8 = v => Math.round(v * 8) / 8, msR2 = v => Math.round(v * 100) / 100, msHalf = v => Math.round(v * 2) / 2;
function msRef(pos) { return MS_REF[pos] || MS_REF.LB; }
function msRsd(pos, k) { return (POS_PROFILE[pos] || {})[k] !== undefined ? 14 : 7.5; }
// stable per-player normal draws (sd 1) from his id, so old saves get the same arm length every time
function msHashG(id, salt) { const r = seededRng(Math.imul((id | 0) + 1013 * salt, 2246822519) >>> 0); let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) * 1.414; }
// the parts of his measurables that ratings can't hold. Never changes a rating.
function msrEnsure(p) {
  if (p.ms && p.ms.v === 1) return p.ms; const B = msRef(p.pos), ht = p.ht || B.ht, id = p.id | 0;
  p.ms = { v: 1, arm: msR8(clamp(B.arm + (ht - B.ht) * 0.45 + msHashG(id, 1) * 0.75, B.arm - 2.6, B.arm + 2.6)), hand: msR8(clamp(B.hand + (ht - B.ht) * 0.08 + msHashG(id, 2) * 0.35, B.hand - 1.1, B.hand + 1.1)),
    h8: Math.floor(seededRng((id * 7 + 3) >>> 0)() * 8), oa: Math.round(msHashG(id, 3) * 2.5 * 10) / 10, oj: Math.round(msHashG(id, 4) * 2.5 * 10) / 10 };
  return p.ms;
}
// drills from ratings (rating view A, body) - the forward map
function msrFrom(pos, A, ht, wt, ms) {
  const B = msRef(pos), dw = (wt || B.wt) - B.wt, z = (k, ref, off) => ((A[k] ?? ref) + (off || 0) - ref) / msRsd(pos, k);
  return {
    forty: msR2(msLook(MS_FORTY, A.spd ?? 50)), ten: msR2(msLook(MS_TEN, A.acc ?? 50) + ((wt || 215) - 215) * MS_WT.ten),
    cone: msR2(B.cone - z('agi', B.ag, ms.oa) * MS_SD.cone + dw * MS_WT.cone), shuttle: msR2(B.sh - z('agi', B.ag, -ms.oa) * MS_SD.sh + dw * MS_WT.sh),
    vert: msHalf(B.vert + z('jmp', B.jp, ms.oj) * MS_SD.vert + dw * MS_WT.vert), broad: Math.round(B.broad + z('jmp', B.jp, -ms.oj) * MS_SD.broad + dw * MS_WT.broad),
    bench: Math.max(2, Math.round(B.bench + z('str', B.st) * MS_SD.bench + dw * MS_WT.bench - (ms.arm - B.arm) * MS_ARM_BENCH)),
  };
}
// ratings from drills - the inverse map (what a drill number says about the rating; missing drills are skipped)
function msrRead(pos, m, ht, wt, ms) {
  const B = msRef(pos), dw = (wt || B.wt) - B.wt, out = {}, avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  if (m.forty != null) out.spd = msInv(MS_FORTY, m.forty);
  if (m.ten != null) out.acc = msInv(MS_TEN, m.ten - ((wt || 215) - 215) * MS_WT.ten);
  const ag = [], jp = [];
  if (m.cone != null) ag.push(B.ag + (B.cone + dw * MS_WT.cone - m.cone) / MS_SD.cone * msRsd(pos, 'agi') - ms.oa);
  if (m.shuttle != null) ag.push(B.ag + (B.sh + dw * MS_WT.sh - m.shuttle) / MS_SD.sh * msRsd(pos, 'agi') + ms.oa);
  if (m.vert != null) jp.push(B.jp + (m.vert - B.vert - dw * MS_WT.vert) / MS_SD.vert * msRsd(pos, 'jmp') - ms.oj);
  if (m.broad != null) jp.push(B.jp + (m.broad - B.broad - dw * MS_WT.broad) / MS_SD.broad * msRsd(pos, 'jmp') + ms.oj);
  if (ag.length) out.agi = avg(ag); if (jp.length) out.jmp = avg(jp);
  if (m.bench != null) out.str = B.st + (m.bench - B.bench - dw * MS_WT.bench + (ms.arm - B.arm) * MS_ARM_BENCH) / MS_SD.bench * msRsd(pos, 'str');
  return out;
}
// everything about his body and athletic testing today
function msrOf(p) {
  const ms = msrEnsure(p), B = msRef(p.pos), ht = p.ht || Math.round(B.ht), wt = p.wt || Math.round(B.wt);
  return Object.assign({ ht, h8: ms.h8, wt, arm: ms.arm, hand: ms.hand }, msrFrom(p.pos, p.a || {}, ht, wt, ms));
}
// a new player: measurables first, then the athletic ratings from them. His latent athletic level comes from genPlayer's ratings;
// his body pulls the drills the way it does in real testing (a heavier back runs a slower 40, long arms cost bench reps),
// and the ratings are read back off the drill numbers. Arm and hand size also nudge the skills they help (zero on average).
function msrGen(p) {
  const ms = msrEnsure(p), B = msRef(p.pos), ht = p.ht || B.ht, wt = p.wt || B.wt, dw = wt - B.wt, da = ms.arm - B.arm, dh = ms.hand - B.hand, a = p.a;
  const m = msrFrom(p.pos, a, ht, wt, ms);
  m.forty = msR2(m.forty + dw * 0.0035);                  // within a position, the heavier man is a step slower
  const r = msrRead(p.pos, m, ht, wt, ms);
  for (const k of ['spd', 'acc', 'agi', 'jmp', 'str']) if (r[k] != null && isFinite(r[k])) a[k] = Math.round(clamp(r[k], 10, 99));
  const nudge = (k, v) => { if (a[k] != null) a[k] = Math.round(clamp(a[k] + v, 10, 99)); };
  if (['OT', 'OG', 'C'].includes(p.pos)) { nudge('pbk', da * 1.4); nudge('rbk', dw * 0.06); }
  if (p.pos === 'DE' || p.pos === 'DT') { nudge('prs', da * 1.1); nudge('bsh', da * 0.8); }
  if (p.pos === 'CB') nudge('mcv', da * 0.9);
  if (['WR', 'TE', 'RB'].includes(p.pos)) nudge('cth', dh * 2.2);
  if (p.pos === 'RB') nudge('car', dh * 2.5);
  if (p.pos === 'QB') nudge('tha', dh * 1.6);
  return p;
}
// ---------- formatting ----------
const MS_FR = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
function msrFrac(v) { const w = Math.floor(v + 1e-6), e = Math.round((v - w) * 8); return e >= 8 ? String(w + 1) : w + (e ? ' ' + MS_FR[e] : ''); }
function msrHt(ht, h8) { return Math.floor(ht / 12) + '-' + (ht % 12) + (h8 ? ' ' + MS_FR[h8] : ''); }
function msrFmt(k, v) { if (v == null) return '—'; if (k === 'arm' || k === 'hand') return msrFrac(v) + '"'; if (k === 'vert') return (v % 1 ? v.toFixed(1) : v) + '"'; if (k === 'broad') return Math.floor(v / 12) + "'" + (v % 12) + '"'; if (k === 'bench') return String(v); if (MS_LOWER_BETTER[k]) return v.toFixed(2); return String(v); }
// percentile of a drill number inside his position (from the position's normal numbers), 1..99, higher = better
function msrPct(pos, k, v, wt) {
  if (v == null) return null; const B = msRef(pos); let z;
  const sd1 = (t, c, k2) => msLook(t, c - msRsd(pos, k2)) - msLook(t, c);
  if (k === 'forty') z = (msLook(MS_FORTY, B.sp) - v) / sd1(MS_FORTY, B.sp, 'spd');
  else if (k === 'ten') z = (msLook(MS_TEN, B.ac) + ((wt || B.wt) - 215) * MS_WT.ten - v) / sd1(MS_TEN, B.ac, 'acc');
  else if (k === 'cone') z = (B.cone - v) / MS_SD.cone; else if (k === 'shuttle') z = (B.sh - v) / MS_SD.sh;
  else if (k === 'vert') z = (v - B.vert) / MS_SD.vert; else if (k === 'broad') z = (v - B.broad) / MS_SD.broad; else if (k === 'bench') z = (v - B.bench) / MS_SD.bench;
  else if (k === 'arm') z = (v - B.arm) / 0.8; else if (k === 'hand') z = (v - B.hand) / 0.35; else if (k === 'ht') z = (v - B.ht) / 1.6; else if (k === 'wt') z = (v - B.wt) / 7; else return null;
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), pr = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.round(clamp((z > 0 ? 1 - pr : pr) * 100, 1, 99));
}

// ---------- the combine ----------
// drills each position bothers with (quarterbacks rarely bench, kickers mostly just run)
const CMB_SKIP = { QB: { bench: 0.85 }, K: { bench: 0.8, cone: 0.7, shuttle: 0.7, broad: 0.5, vert: 0.4 }, P: { bench: 0.8, cone: 0.7, shuttle: 0.7, broad: 0.5, vert: 0.4 } };
const CMB_NOISE = { forty: 0.025, ten: 0.015, cone: 0.05, shuttle: 0.04, vert: 1, broad: 2.5, bench: 1 };
const CMB_WHY = { star: 'chose not to', hurt: 'injured', pos: 'did not test', inv: 'not invited' };
function cmbMeasure(p, k, bias) { const m = msrOf(p), v = m[k], n = gauss() * CMB_NOISE[k] + (bias || 0); if (k === 'vert') return msHalf(v + n); if (k === 'broad' || k === 'bench') return Math.max(1, Math.round(v + n)); return msR2(v + n); }
// right after the season: weigh-in for everyone invited, drills with real-day noise; some skip (stars protect their stock, the hurt sit),
// prospects who weren't invited or skipped a drill run it at their pro day (cmbProDays, when the draft opens)
function cmbRun() {
  if (L.combineY === L.year) return; L.combineY = L.year;
  const ranked = (L.draft || []).map(id => L.P[id]).filter(Boolean).sort((a, b) => draftValue(b) - draftValue(a)), nInv = Math.round(ranked.length * 0.82);
  ranked.forEach((p, i) => {
    const m = msrOf(p), inv = i < nInv || R() < 0.15, hurt = inv && R() < 0.05, c = { y: L.year, inv, ht: m.ht, h8: m.h8, wt: m.wt, arm: m.arm, hand: m.hand, sk: {}, pd: {} };
    for (const [k] of MS_DRILLS) {
      let why = !inv ? 'inv' : hurt ? 'hurt' : null;
      if (!why && R() < ((CMB_SKIP[p.pos] || {})[k] || 0)) why = 'pos';
      if (!why && i < 15 && (k === 'forty' || k === 'ten' || k === 'cone' || k === 'shuttle') && R() < 0.3) why = 'star';
      if (!why && R() < 0.03) why = 'hurt';
      if (why) { c[k] = null; c.sk[k] = why; } else c[k] = cmbMeasure(p, k);
    }
    if (c.forty == null && c.ten != null) { c.ten = null; c.sk.ten = c.sk.forty; }       // the split only exists when he ran the 40
    p.comb = c;
  });
  cmbStock(); cmbNews();
}
// pro days: the drills a prospect didn't run at the combine (some injured players still can't go). Pro-day tracks run a touch fast.
function cmbProDays() {
  if (L.proDayY === L.year) return; L.proDayY = L.year; let n = 0;
  for (const id of L.draft || []) { const p = L.P[id], c = p && p.comb; if (!c) continue;
    for (const k of Object.keys(c.sk)) { const why = c.sk[k]; if (why === 'pos' || (why === 'hurt' && R() < 0.5)) continue;
      c[k] = cmbMeasure(p, k, k === 'forty' ? -0.02 : k === 'ten' ? -0.01 : k === 'vert' ? 0.5 : 0); c.pd[k] = 1; delete c.sk[k]; n++; if (k === 'forty' && c.ten == null && !c.sk.ten) { c.ten = cmbMeasure(p, 'ten', -0.01); c.pd.ten = 1; } } }
  if (n) { cmbStock(); news('Pro days are done. Every prospect who skipped a drill at the combine has a number now.'); }
}
// how a prospect tested against his position (sd units, weighted by what the position cares about)
const CMB_W = { QB: { forty: .6, ten: .4, cone: .3, vert: .2 }, RB: { forty: 2, ten: 1, cone: .8, shuttle: .6, vert: .6, broad: .6, bench: .3 }, FB: { forty: .8, ten: .8, bench: 1, broad: .4 },
  WR: { forty: 2.2, ten: 1, cone: .9, shuttle: .5, vert: .8, broad: .6 }, TE: { forty: 1.5, ten: .8, cone: .7, vert: .7, broad: .5, bench: .5 },
  OT: { ten: 1, cone: .8, shuttle: .8, broad: .6, bench: .8, forty: .4 }, OG: { ten: .9, cone: .6, shuttle: .7, bench: 1, broad: .5, forty: .3 }, C: { ten: .9, cone: .6, shuttle: .7, bench: 1, broad: .5, forty: .3 },
  DE: { ten: 1.6, forty: 1.2, cone: .9, broad: .7, vert: .5, bench: .6 }, DT: { ten: 1.4, forty: .6, bench: 1, broad: .6, shuttle: .5 }, LB: { forty: 1.5, ten: 1, cone: .8, shuttle: .6, vert: .5, broad: .5 },
  CB: { forty: 2.2, ten: 1, cone: .9, shuttle: .8, vert: .8, broad: .6 }, S: { forty: 1.8, ten: .8, cone: .8, shuttle: .6, vert: .8, broad: .6 }, K: {}, P: {} };
// against the rest of this class at his position (st = per position + drill mean/sd of the class)
function cmbScore(p, st) {
  const c = p.comb; if (!c) return null; const W = CMB_W[p.pos] || {}; let s = 0, w = 0;
  for (const k in W) { if (c[k] == null) continue; const d = st && st[p.pos] && st[p.pos][k]; let z;
    if (d && d.n >= 4 && d.sd > 0) z = (c[k] - d.m) / d.sd * (MS_LOWER_BETTER[k] ? -1 : 1); else { const pc = msrPct(p.pos, k, c[k], c.wt); if (pc == null) continue; z = (pc - 50) / 34; }
    s += clamp(z, -2.5, 2.5) * W[k]; w += W[k]; }
  return w ? s / w : null;
}
function cmbClassStats() {
  const acc = {}; for (const id of L.draft || []) { const p = L.P[id], c = p && p.comb; if (!c) continue; for (const [k] of MS_DRILLS) if (c[k] != null) { const a = ((acc[p.pos] = acc[p.pos] || {})[k] = acc[p.pos][k] || []); a.push(c[k]); } }
  const st = {}; for (const pos in acc) { st[pos] = {}; for (const k in acc[pos]) { const a = acc[pos][k], m = a.reduce((s, v) => s + v, 0) / a.length; st[pos][k] = { n: a.length, m, sd: Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length) }; } }
  return st;
}
// CPU boards overreact to workouts: a great 40 lifts a guy, a slow one sinks him (draftValue reads p.combBump).
// combZ = how he tested against his position in this class, scaled so the class spreads one unit wide
function cmbStock() {
  const st = cmbClassStats(), ps = (L.draft || []).map(id => L.P[id]).filter(Boolean), raw = ps.map(p => cmbScore(p, st)), got = raw.filter(z => z != null);
  const sd = got.length > 5 ? Math.sqrt(got.reduce((s, z) => s + z * z, 0) / got.length) || 1 : 1;
  ps.forEach((p, i) => { const z = raw[i] == null ? null : clamp(raw[i] / sd, -3, 3); p.combZ = z == null ? null : Math.round(z * 100) / 100; p.combBump = z == null ? 0 : Math.round(clamp(z * 2.4, -4, 5) * 10) / 10; });
}
// the top performers, for the news, the scouts' memo and the combine screen
function cmbTop(k, n, pos) {
  const lower = MS_LOWER_BETTER[k]; return (L.draft || []).map(id => L.P[id]).filter(p => p && p.comb && p.comb[k] != null && (!pos || p.pos === pos))
    .sort((a, b) => lower ? a.comb[k] - b.comb[k] : b.comb[k] - a.comb[k]).slice(0, n || 1);
}
function cmbNews() {
  const f = cmbTop('forty', 1)[0], v = cmbTop('vert', 1)[0], b = cmbTop('bench', 1)[0];
  const bits = [f && `${f.pos} ${f.fn} ${f.ln} ran a ${f.comb.forty.toFixed(2)}`, v && `${v.pos} ${v.ln} jumped ${msrFmt('vert', v.comb.vert)}`, b && `${b.pos} ${b.ln} put up ${b.comb.bench} reps`].filter(Boolean);
  news(`The scouting combine is done. ${bits.join(', ')}.`);
  if (L.ghost || L.user == null || !L.teams[L.user]) return;
  const ps = (L.draft || []).map(id => L.P[id]).filter(p => p && p.combZ != null), up = ps.filter(p => p.combZ >= 1).sort((a, b) => b.combZ - a.combZ).slice(0, 4), dn = ps.filter(p => p.combZ <= -0.9).sort((a, b) => a.combZ - b.combZ).slice(0, 3);
  const one = p => `${p.pos} ${p.fn} ${p.ln} (${p.comb.forty != null ? p.comb.forty.toFixed(2) + ' 40' : p.comb.bench != null ? p.comb.bench + ' reps' : 'tested well'})`;
  inbox('scout', 'Combine notes', `Measurables are posted for every prospect who worked out. ${up.length ? 'Helped himself: ' + up.map(one).join('; ') + '.' : ''} ${dn.length ? 'Hurt himself: ' + dn.map(one).join('; ') + '.' : ''} Other teams will move these guys on their boards. Prospects who skipped drills run them at their pro day when the draft opens.`, { actions: [{ label: 'Combine results', act: 'go', arg: 'scouting' }] });
}
// what the drill numbers say about his athletic ratings (the public read; noisy because test days are)
function cmbRead(p) { const c = p && p.comb; if (!c) return {}; const r = msrRead(p.pos, c, c.ht || p.ht, c.wt || p.wt, msrEnsure(p)); for (const k in r) r[k] = Math.round(clamp(r[k], 10, 99)); return r; }
// table rows for the combine screen
function cmbRows(pos) { return (L.draft || []).map(id => L.P[id]).filter(p => p && p.comb && (!pos || pos === 'All' || p.pos === pos)); }
