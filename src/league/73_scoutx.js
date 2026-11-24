// Role archetypes ("possession receiver", "nose tackle"), "plays like" comparisons from this league's own history,
// and draft-guide scouting reports (summary, strengths, weaknesses, projection, grade) written through the scouting fog.

// ---------- what the user's staff can see ----------
// ratings as the user knows them: real for players in the league, through the fog for prospects (revealed ratings exact,
// athletic ones read off his combine numbers, the rest blurred by how well the scouts know him)
function sxView(p) {
  if (!p || !p.draft) return p ? p.a : {};
  const sc = p.sc || {}, rev = sc.rev || [], f = 1 - (sc.acc || 0), cr = cmbRead(p), out = {};
  for (const k of ATTRS) { const v = p.a[k] ?? 40; out[k] = rev.includes(k) ? v : cr[k] != null ? cr[k] : Math.round(clamp(v + msHashG(p.id, 50 + ATTRS.indexOf(k)) * 9 * f, 10, 99)); }
  return out;
}
function sxKnown(p) { return !!p && (!p.draft || (p.sc && p.sc.lvl >= 1) || !!p.comb); }
// a rating against his position (sd units): profile ratings center near 66 + the profile offset, filler ratings near 35
function sxMean(pos, k) { const pr = (POS_PROFILE[pos] || {})[k]; if (k === 'spd' && (pos === 'K' || pos === 'P')) return 55; return pr !== undefined ? 66 + pr : 35; }
function sxZ(pos, A) { const z = {}; for (const k of ATTRS) z[k] = ((A[k] ?? 40) - sxMean(pos, k)) / msRsd(pos, k); return z; }
const SX_POSN = { QB: 'quarterback', RB: 'running back', FB: 'fullback', WR: 'receiver', TE: 'tight end', OT: 'tackle', OG: 'guard', C: 'center', DE: 'edge defender', DT: 'interior lineman', LB: 'linebacker', CB: 'corner', S: 'safety', K: 'kicker', P: 'punter' };

// ---------- role archetypes ----------
// [key, label, role noun for projections, weights]. Weights are on his ratings against the position (sd units) and his body
// (ht/wt/arm against the position). Ratings that track overall quality are centered on his own average first, so the label says
// what kind of player he is, not how good: a great receiver is not automatically a "slot" because agility, routes and burst add up.
// Each score is divided by the size of its weights so no archetype wins just by having more terms. 'all' (RB) = no clear lean.
const RARCH = {
  QB: [['pocket', 'Pocket passer', 'pocket passer', { tha: 1, awr: .5, spd: -.5 }], ['scramble', 'Scrambler', 'dual-threat quarterback', { spd: 1.2, elu: .4, acc: .3 }],
    ['gun', 'Gunslinger', 'gunslinger', { thp: 1.2, tha: -.5 }], ['manager', 'Game manager', 'game manager', { awr: 1, tha: .3, thp: -.7 }]],
  RB: [['power', 'Power back', 'early-down back', { btk: 1, str: .5, wt: .5, spd: -.3 }], ['speed', 'Speed back', 'change-of-pace back', { spd: 1.2, acc: .4, btk: -.3 }],
    ['recv', 'Receiving back', 'third-down back', { cth: 1.1, rte: .5 }], ['all', 'All-purpose back', 'three-down back', null]],
  FB: [['lead', 'Lead blocker', 'lead fullback', { rbk: 1, str: .5 }], ['move', 'Move fullback', 'move fullback', { cth: 1, spd: .5, car: .3 }]],
  WR: [['deep', 'Deep threat', 'vertical threat', { spd: 1.3, acc: .3 }], ['poss', 'Possession receiver', 'possession receiver', { cth: 1, rte: .7, spd: -.4 }],
    ['slot', 'Slot receiver', 'slot receiver', { agi: 1, rte: .4, acc: .3, ht: -.5 }], ['rz', 'Red-zone target', 'red-zone target', { jmp: .8, cth: .3, ht: .6, wt: .2 }],
    ['yac', 'YAC receiver', 'catch-and-run receiver', { elu: 1, btk: .5 }]],
  TE: [['recv', 'Receiving tight end', 'move tight end', { cth: 1, rte: .6, spd: .5, rbk: -.6 }], ['block', 'Blocking tight end', 'inline tight end', { rbk: 1, str: .4, cth: -.4 }],
    ['rz', 'Red-zone target', 'red-zone tight end', { jmp: .8, cth: .3, ht: .8 }]],
  OL: [['pass', 'Pass protector', 'pass protector', { pbk: 1, rbk: -.6, arm: .4 }], ['road', 'Road grader', 'road grader', { rbk: 1, str: .4, pbk: -.6, wt: .3 }],
    ['zone', 'Zone blocker', 'zone-scheme lineman', { agi: 1, acc: .5, wt: -.4 }]],
  DE: [['speed', 'Speed rusher', 'edge rusher', { prs: 1, spd: .8, pow: -.3 }], ['power', 'Power rusher', 'power end', { pow: 1, str: .5, spd: -.3 }],
    ['run', 'Run stopper', 'base end', { bsh: 1, tak: .4, prs: -.6 }]],
  DT: [['rush', 'Interior rusher', 'three-technique', { prs: 1, acc: .5, bsh: -.3 }], ['power', 'Power rusher', 'interior rusher', { pow: 1, str: .4, prs: -.3 }],
    ['nose', 'Nose tackle', 'nose tackle', { bsh: .8, wt: 1, prs: -.3 }], ['run', 'Run stopper', 'two-down run stuffer', { bsh: 1, tak: .5, prs: -.5 }]],
  LB: [['rush', 'Pass rusher', 'blitzing linebacker', { prs: 1, zcv: -.4 }], ['cover', 'Coverage linebacker', 'coverage linebacker', { zcv: 1, mcv: .5, bsh: -.4 }],
    ['thump', 'Run stopper', 'two-down thumper', { tak: .8, bsh: .8, zcv: -.4 }], ['range', 'Sideline to sideline', 'run-and-chase linebacker', { pur: 1, spd: .8, bsh: -.3 }]],
  CB: [['press', 'Press corner', 'press corner', { mcv: 1, zcv: -.4, arm: .5, ht: .4 }], ['zone', 'Zone corner', 'zone corner', { zcv: 1, mcv: -.4 }],
    ['slot', 'Slot corner', 'nickel corner', { agi: .8, acc: .4, ht: -.6 }], ['hawk', 'Ballhawk', 'ballhawk corner', { hnd: 1, jmp: .3 }]],
  S: [['box', 'Box safety', 'box safety', { tak: 1, zcv: -.4, wt: .4 }], ['free', 'Center fielder', 'free safety', { zcv: 1, spd: .6, tak: -.3 }],
    ['hawk', 'Ballhawk', 'ballhawk safety', { hnd: 1, zcv: .3 }], ['cover', 'Coverage safety', 'matchup safety', { mcv: 1, agi: .4, tak: -.3 }]],
  K: [['leg', 'Big leg', 'kicker', { kpw: 1, kac: -.5 }], ['acc', 'Accurate kicker', 'kicker', { kac: 1, kpw: -.5 }]],
  P: [['leg', 'Big leg', 'punter', { kpw: 1, kac: -.5 }], ['acc', 'Directional punter', 'punter', { kac: 1, kpw: -.5 }]],
};
const RARCH_OF = pos => RARCH[pos] || RARCH[{ OT: 'OL', OG: 'OL', C: 'OL' }[pos]] || null;
// his role archetype from a ratings view (prospects: what the staff sees). { k, n (label), role (noun for projections) }
function rarchOf(p, view) {
  const defs = p && RARCH_OF(p.pos); if (!defs) return null; const A = view || sxView(p), z = sxZ(p.pos, A), B = msRef(p.pos), ms = msrEnsure(p), prof = POS_PROFILE[p.pos] || {};
  const pk = Object.keys(prof), mz = pk.length ? pk.reduce((s, k) => s + z[k], 0) / pk.length : 0, c = {}; for (const k of ATTRS) c[k] = prof[k] !== undefined ? (z[k] - mz) * 2 : z[k];      // x2: what is left after centering spreads half as wide
  const bd = BODY[p.pos] || [72, 76, 200, 240]; c.ht = ((p.ht || B.ht) - B.ht) / Math.max(1, (bd[1] - bd[0]) / 3.46); c.wt = ((p.wt || B.wt) - B.wt) / Math.max(3, (bd[3] - bd[2]) * 0.21); c.arm = (ms.arm - B.arm) / 0.85;
  let best = null, all = null;
  for (const [k, n, role, w] of defs) { if (!w) { all = { k, n, role }; continue; } let s = 0, q = 0; for (const x in w) { s += w[x] * (c[x] || 0); q += w[x] * w[x]; } s /= Math.sqrt(q); if (!best || s > best.s) best = { k, n, role, s }; }
  if (all && best.s < 0.3) best = Object.assign(all, { s: best.s });
  if (best.k === 'run' && p.pos === 'DT' && (p.wt || 0) >= 325) Object.assign(best, { k: 'nose', n: 'Nose tackle', role: 'nose tackle' });
  return best;
}
function rarchTag(p) { if (!sxKnown(p)) return ''; const r = rarchOf(p); if (!r || (p.traits || []).some(t => TRAITS[t] && TRAITS[t].n.toLowerCase() === r.n.toLowerCase())) return ''; return `<span class="rarch" title="Role">${r.n}</span>`; }
// the rotation's role picker leans toward a player's archetype (25_rotation.js roleFit)
const RARCH_ROT = { X: 'deep', Z: 'poss', SL: 'slot', SL2: 'slot', RZ: 'rz', PD: 'recv', GL: 'power', Y: 'recv', IN: 'block' };
// the rotation asks this thousands of times a game, so remember the answer until his ratings or body change
const RARCH_C = new WeakMap();
function rarchFast(p) { const a = p.a; let h = ((p.ht | 0) * 977 + (p.wt | 0)) | 0; for (const k of ATTRS) h = (Math.imul(h, 31) + (a[k] | 0)) | 0; const c = RARCH_C.get(p); if (c && c.h === h) return c.r; const r = rarchOf(p, a); RARCH_C.set(p, { h, r }); return r; }
function rarchRoleBonus(k, p) { const want = RARCH_ROT[k]; if (!want || !p || !p.a || p.draft || !p.pos) return 0; const r = rarchFast(p); return r && r.k === want ? 2.5 : 0; }

// ---------- "plays like" ----------
// L.cpool: every notable player at his best season (All-Pros, MVPs, defensive players of the year, 88+ seasons). Hall of Famers are
// tagged from L.lhof. In a new league there is no history yet, so current veterans stand in. A roster file's p.comp wins over all of it.
const PLK_ATH = ['spd', 'acc', 'agi', 'str', 'jmp'];
const PLK_NEAR = { OT: ['OG'], OG: ['OT', 'C'], C: ['OG'], DE: ['LB', 'DT'], DT: ['DE'], LB: ['DE', 'S'], CB: ['S'], S: ['CB', 'LB'], WR: ['TE'], TE: ['WR'], RB: ['FB'], FB: ['RB', 'TE'] };
const PLK_AP = { QB: 1, RB: 1, FB: 0, WR: 2, TE: 1, OT: 2, OG: 2, C: 1, DE: 2, DT: 2, LB: 2, CB: 2, S: 2, K: 1, P: 1 };
function plkKeys(pos) { return [...new Set(Object.keys(OVR_W[pos] || {}).concat(PLK_ATH))]; }
function plkSnap(p, tag) {
  L.cpool = L.cpool || []; let e = L.cpool.find(x => x.id === p.id); const a = {}; for (const k of plkKeys(p.pos)) a[k] = p.a[k];
  const m = msrOf(p), r = rarchOf(p, p.a), snap = { id: p.id, fn: p.fn, ln: p.ln, pos: p.pos, y: L.year, age: p.age, ovr: p.ovr, ht: p.ht, wt: p.wt, arm: m.arm, forty: m.forty, a, ra: r ? r.k : null, tm: L.teams[p.tid] ? L.teams[p.tid].abbr : '' };
  if (!e) { e = Object.assign(snap, { tags: [] }); L.cpool.push(e); } else if (p.ovr >= e.ovr) Object.assign(e, snap);
  if (tag && !e.tags.includes(tag)) e.tags.push(tag); return e;
}
// end of the season (beginOffseason, right after the awards): this year's notable players join the pool
function plkUpdate() {
  const aw = L.awards[L.awards.length - 1] || {}, y = L.year, act = Object.values(L.P).filter(p => p.tid != null && !p.draft && !p.retired);
  if (aw.mvp && L.P[aw.mvp]) plkSnap(L.P[aw.mvp], 'MVP ' + y); if (aw.dpoy && L.P[aw.dpoy]) plkSnap(L.P[aw.dpoy], 'DPOY ' + y);
  for (const pos in PLK_AP) if (PLK_AP[pos]) act.filter(p => p.pos === pos && p.st && (p.st.gp || 0) >= 6).sort((a, b) => b.ovr - a.ovr).slice(0, PLK_AP[pos]).forEach(p => plkSnap(p, 'All-Pro ' + y));
  for (const p of act) if (p.ovr >= 88) plkSnap(p, null);
  if (L.cpool.length > 400) { L.cpool.sort((a, b) => plkRank(b) - plkRank(a)); L.cpool.length = 400; }
}
function plkHof(e) { return (L.lhof || []).some(h => h.id === e.id); }
function plkRank(e) { return e.ovr + (e.tags || []).length * 4 + (plkHof(e) ? 30 : 0); }
function plkTag(e) {
  if (e.live) return `${e.tm ? e.tm + ' ' : ''}veteran, ${e.ovr} OVR`; if (plkHof(e)) return 'Hall of Fame';
  const t = e.tags || [], mvp = t.filter(x => /^MVP/.test(x)), dp = t.filter(x => /^DPOY/.test(x)), ap = t.filter(x => /^All-Pro/.test(x)).length;
  if (mvp.length) return mvp.length > 1 ? `${mvp.length}-time MVP` : mvp[0]; if (dp.length) return dp.length > 1 ? `${dp.length}-time DPOY` : 'Defensive Player of the Year ' + dp[0].slice(5);
  if (ap) return ap > 1 ? `${ap}-time All-Pro` : t.find(x => /^All-Pro/.test(x)); return `${e.ovr} OVR in ${e.y}`;
}
// the most similar notable player: same position (or a close one), same kind of player (archetype + the shape of his ratings),
// same body (height, weight, arms, 40) and a career level near what the staff thinks his ceiling is
function plkFor(p) {
  if (!p) return null; if (p.comp) return { txt: String(p.comp), file: true };
  if (!(p.draft || p.age <= 25) || (p.draft && !sxKnown(p))) return null;
  const A = sxView(p), m = msrOf(p), ceil = p.draft ? (potKnown(p) ? p.scoutPot : (p.scout || p.ovr) + 6) : Math.max(p.ovr, p.pot || p.ovr), ra = (rarchOf(p, A) || {}).k;
  const ok = e => e.id !== p.id && (e.pos === p.pos || (PLK_NEAR[p.pos] || []).includes(e.pos));
  let pool = (L.cpool || []).filter(ok);
  if (pool.filter(e => e.pos === p.pos).length < 6) pool = pool.concat(Object.values(L.P).filter(q => q.tid != null && !q.draft && !q.retired && q.age >= 26 && q.ovr >= 78 && ok(q) && !pool.some(e => e.id === q.id))
    .map(q => { const qm = msrOf(q), a = {}; for (const k of plkKeys(q.pos)) a[k] = q.a[k]; return { id: q.id, fn: q.fn, ln: q.ln, pos: q.pos, ovr: q.ovr, ht: q.ht, wt: q.wt, arm: qm.arm, forty: qm.forty, a, ra: (rarchOf(q, q.a) || {}).k, tm: L.teams[q.tid] ? L.teams[q.tid].abbr : '', live: true }; }));
  const keys = plkKeys(p.pos); let best = null;
  for (const e of pool) {
    const ks = keys.filter(k => e.a[k] != null); if (ks.length < 3) continue; const mp = ks.reduce((s, k) => s + A[k], 0) / ks.length, me = ks.reduce((s, k) => s + e.a[k], 0) / ks.length;
    const d1 = Math.sqrt(ks.reduce((s, k) => s + ((A[k] - mp) - (e.a[k] - me)) ** 2, 0) / ks.length) / 9;
    const d2 = Math.sqrt(((p.ht - e.ht) / 2) ** 2 + ((p.wt - e.wt) / 9) ** 2 + ((m.arm - e.arm) / 0.9) ** 2 + ((m.forty - e.forty) / 0.08) ** 2) / 2;
    const d3 = Math.abs(ceil - e.ovr) / 7, d = d1 + d2 * 0.8 + d3 + (ra && e.ra !== ra ? 0.7 : 0) + (e.pos !== p.pos ? 0.6 : 0) - (e.live ? 0 : 0.1);
    if (!best || d < best.d) best = { e, d, d1, d2 };
  }
  if (!best) return null; const e = best.e, lab = ((RARCH_OF(p.pos) || []).find(x => x[0] === e.ra) || [])[1];
  const why = best.d2 < 0.45 ? `same size and speed (${fmtHt(e.ht)}, ${e.wt}, ${e.forty.toFixed(2)})` : lab && e.ra === ra ? `same ${lab.toLowerCase()} game` : best.d1 < 0.5 ? 'the same strengths' : 'similar build and game';
  return { txt: `${e.pos} ${e.fn} ${e.ln}`, tag: plkTag(e), why, e };
}
function plkLine(p) { const c = plkFor(p); if (!c) return ''; return c.file ? `Comp: ${c.txt}` : `Plays like ${c.txt} (${c.tag}): ${c.why}`; }
