// Training camp and private workouts: short drills the user plays (src/ui/47_camp.js).
// Camp: before the season (from free agency until the first game) the user runs drills with his own players. The score turns into
// XP on the drill's skills through the normal growth system (giveXP: age, development curve, coaches and facilities all count),
// one drill per player and TCAMP_MAX per camp; 85+ also lifts the ceiling on those skills by a point. "Auto camp" lets the staff run it.
// Workouts: before the draft the user can bring in PWO_MAX prospects; a good workout reveals more ratings and cuts the scouting fog.
const TCAMP_MAX = 8, PWO_MAX = 3;
const TCAMP_DRILL = { QB: 'qb', WR: 'wr', TE: 'wr', RB: 'rb', FB: 'line', OT: 'line', OG: 'line', C: 'line', DE: 'line', DT: 'line', LB: 'db', CB: 'db', S: 'db', K: 'kick', P: 'kick' };
const TCAMP_KEYS = { QB: ['tha', 'awr'], WR: ['rte', 'cth'], TE: ['rte', 'cth'], RB: ['elu', 'agi'], FB: ['rbk', 'pbk'], OT: ['pbk', 'rbk'], OG: ['pbk', 'rbk'], C: ['pbk', 'rbk'],
  DE: ['prs', 'bsh'], DT: ['bsh', 'prs'], LB: ['pur', 'zcv'], CB: ['mcv', 'zcv'], S: ['zcv', 'mcv'], K: ['kac', 'kpw'], P: ['kac', 'kpw'] };
const TCAMP_NAMES = { qb: 'Moving targets', wr: 'Route and catch', rb: 'Cone weave', line: 'Get-off and punch', db: 'Mirror drill', kick: 'Kicking' };
function tcampSeason() { return L.phase === 'offseason' ? L.year + 1 : L.year; }
function tcampOpen() {
  if (!L || L.ghost || L.picking || L.user == null) return false; if (L.phase === 'offseason') return L.off === 'fa';
  if (L.phase !== 'regular' || L.week !== 0) return false; const g = userGame(0); return !g || !g.done;
}
function tcampState() { if (!L.camp || L.camp.y !== tcampSeason()) L.camp = { y: tcampSeason(), done: {} }; return L.camp; }
function tcampLeft() { return Math.max(0, TCAMP_MAX - Object.keys(tcampState().done).length); }
function tcampDrill(p) { return TCAMP_DRILL[p.pos] || 'db'; }
function tcampKeys(p) { return TCAMP_KEYS[p.pos] || devKeys(p); }
function tcampXp(score) { return 0.3 + 1.3 * clamp(score, 0, 100) / 100; }
function tcampApply(pid, score, auto) {
  const T = UT(), p = L.P[pid], C = tcampState();
  if (!p || p.tid !== T.id) return { ok: false, msg: 'He is not on your roster.' }; if (!tcampOpen()) return { ok: false, msg: 'Training camp is closed.' };
  if (C.done[pid]) return { ok: false, msg: `${p.ln} already went through camp.` }; if (tcampLeft() <= 0) return { ok: false, msg: 'Camp is full.' };
  score = Math.round(clamp(score, 0, 100)); const keys = tcampKeys(p), ups = giveXP(p, T, tcampXp(score), keys, null, 'training camp');
  let cap = false; if (score >= 85) { ensurePot(p); for (const k of keys) if ((p.ap[k] || 0) < 99) { p.ap[k] = (p.ap[k] || p.a[k]) + 1; cap = true; } }
  if (score >= 70) moodAdd(p, 3, 'Strong training camp'); else if (score < 30) moodAdd(p, -2, 'Rough training camp');
  C.done[pid] = { s: score, auto: !!auto, ups, cap };
  const prog = keys.map(k => `${ATTR_NAME[k]} ${Math.round(((p.xp || {})[k] || 0) * 100)}%`).join(', ');
  return { ok: true, score, ups, cap, msg: `${p.ln}: ${ups.length ? '+' + ups.length + ' ' + [...new Set(ups)].map(k => ATTR_NAME[k]).join(', ') : 'progress toward ' + prog}${cap ? ', higher ceiling' : ''}.` };
}
// the staff runs the rest of camp: the players who grow fastest first, average scores (a good head of development helps)
function tcampAuto() {
  const T = UT(), C = tcampState(); if (!tcampOpen()) return { ok: false, msg: 'Training camp is closed.' };
  const ps = T.roster.map(id => L.P[id]).filter(p => p && !C.done[p.id] && !(p.inj > 0) && !p.holdout).sort((a, b) => growthMult(b, T) * (b.pot - b.ovr + 4) - growthMult(a, T) * (a.pot - a.ovr + 4));
  let n = 0; for (const p of ps) { if (tcampLeft() <= 0) break; tcampApply(p.id, clamp(46 + ((T.coach.dev || 5) - 5) * 3 + gauss() * 10, 15, 82), true); n++; }
  return { ok: true, msg: n ? `The staff ran ${n} players through camp.` : 'Camp is already full.' };
}
function tcampAnnounce() { if (L.ghost) return; inbox('coach', 'Training camp is open', `Camp runs until the first game. Put up to ${TCAMP_MAX} players through a drill: the better they score, the more they develop. Young players gain the most. You can also let the staff run it.`, { actions: [{ label: 'Open camp', act: 'go', arg: 'develop' }] }); }
// ---------- private workouts (draft prospects) ----------
function pwoState() { const S = scoutState(); if (!S.wo) S.wo = []; return S; }
function pwoOpen() { return !!L && !L.ghost && L.phase === 'offseason' && (L.off === 'resign' || L.off === 'draft'); }
function pwoLeft() { return Math.max(0, PWO_MAX - pwoState().wo.length); }
function pwoApply(pid, score) {
  const p = L.P[pid], S = pwoState(); if (!p || !p.draft) return { ok: false, msg: 'He is not in the draft.' };
  if (!pwoOpen()) return { ok: false, msg: 'Private workouts open after the season, before the draft.' }; if (S.wo.includes(pid)) return { ok: false, msg: 'You already worked him out.' };
  if (pwoLeft() <= 0) return { ok: false, msg: `You have used all ${PWO_MAX} private workouts.` };
  score = Math.round(clamp(score, 0, 100)); const got = reveal(p, 1 + Math.floor(score / 34), 0.06 + score / 100 * 0.2); p.sc.wo = score; S.wo.push(pid);
  return { ok: true, score, got, msg: `Workout with ${p.ln}: ${got.length ? got.length + ' more ratings revealed' : 'a sharper read'}${score >= 60 ? ', and your scouts trust their grade more' : ''}.` };
}
