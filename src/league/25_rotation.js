// Player roles, snap shares, stamina and rotations.
// Team settings live in T.rot. Every field is optional, so old saves load with the defaults:
//   roles  {WR:{X,Z,SL,SL2,RZ}, RB:{LEAD,PD,GL}, TE:{Y,IN}}: a player id, or missing = Auto (picked from the ratings)
//   preset {pos: preset key | 'custom'}   share {pid: 0..100} (custom shares)   lock {pid: 1} (plays through fatigue)
//   twoMin: starters play the two-minute drill (default on)   keyDowns: starters on 3rd/4th down and in the red zone (default off)
// A match keeps one rotation state (rotInit): stamina per player, snaps per unit, the share bookkeeping and who is resting.
// Share = how often a player is on the field when the formation has a spot for him (the 3rd WR in 3-WR sets, the nickel corner in nickel).
// Each snap the players furthest behind their share go in (with a little stickiness so subs come in short series);
// tired players (stamina under 72%) take a breather and come back at 86%, unless they are locked in.
const ROT_GROUPS = ['RB', 'WR', 'TE', 'DE', 'DT', 'LB', 'CB', 'S'];
const ROT_DL = { light: ['Light', [88, 85, 30, 12]], rotate: ['Rotation', [76, 72, 42, 26]], heavy: ['Heavy', [66, 64, 52, 40]] };
const ROT_PRESETS = {
  RB: { bell: ['Bell-cow', [80, 20, 0, 0]], split: ['Split', [60, 40, 0, 0]], committee: ['Committee', [45, 35, 20, 0]] },
  WR: { starters: ['Starters', [95, 92, 85, 20, 6, 0]], rotate: ['Rotation', [90, 86, 74, 35, 14, 0]], heavy: ['Heavy rotation', [82, 80, 72, 48, 28, 10]] },
  TE: { one: ['TE1 every down', [92, 35, 5]], two: ['Two-TE', [82, 62, 12]] },
  DE: ROT_DL, DT: ROT_DL,
  LB: { starters: ['Starters', [100, 100, 100, 100, 12, 4, 0]], rotate: ['Rotation', [94, 90, 82, 70, 30, 14, 0]] },
  CB: { starters: ['Starters', [100, 100, 100, 100, 10, 0]], rotate: ['Rotation', [94, 92, 84, 60, 28, 8]] },
  S: { starters: ['Starters', [100, 100, 10, 0]], rotate: ['Rotation', [94, 90, 28, 8]] },
};
const ROT_DEF = { RB: 'bell', WR: 'starters', TE: 'one', DE: 'rotate', DT: 'rotate', LB: 'starters', CB: 'starters', S: 'starters' };
// how many players of a group a formation asks for, on average (the quick sim uses it to turn shares into snaps)
const ROT_MIX = { RB: [[1, 1]], WR: [[2, .25], [3, .6], [4, .15]], TE: [[1, .6], [2, .3], [0, .1]], DE: [[2, 1]], DT: [[2, .9], [1, .1]], LB: [[3, .4], [2, .45], [1, .1], [4, .05]], CB: [[2, .35], [3, .5], [4, .15]], S: [[2, 1]] };
const ROT_GROUP_N = { RB: 1, WR: 3, TE: 1.3, DE: 2, DT: 2, LB: 2.5, CB: 2.7, S: 2 };
const ROT_ROLES = {
  WR: [['X', 'Deep threat', 'X · outside, gets the deep routes'], ['Z', 'Possession', 'Z · outside, sure hands underneath'], ['SL', 'Slot', 'Inside · quick and option routes'], ['SL2', 'Slot 2', 'The 2nd slot in 4-WR sets'], ['RZ', 'Red-zone target', 'Inside the 20: goes outside, gets the fades']],
  RB: [['LEAD', 'Lead back', 'Early downs'], ['PD', 'Passing-down back', '3rd & long, two-minute drill'], ['GL', 'Short-yardage back', 'Inside the 3, 3rd/4th & 1']],
  TE: [['Y', 'Receiving TE', 'TE1 · gets the routes'], ['IN', 'Blocking TE', 'Inline: 2-TE sets, short yardage']],
};
const ROT_TAG = { X: 'DEEP', Z: 'POSS', SL: 'SLOT', SL2: 'SLOT2', RZ: 'RZ', LEAD: 'LEAD', PD: '3RD', GL: 'GL', Y: 'REC', IN: 'BLK' };
const ROT_EXCL = { WR: ['X', 'Z', 'SL', 'SL2'], TE: ['Y', 'IN'] };       // alignment roles: one player each
const ROT_SUB = 0.72, ROT_BACK = 0.86, ROT_HARD = 0.5, ROT_STICK = 0.45;
// stamina: drain per snap = (position strain + effort) x (1.5 - endurance/100); recovery per snap on the field / on the sideline x (0.5 + endurance/100)
const ROT_BASE = { QB: .006, RB: .016, FB: .022, WR: .012, TE: .02, OT: .02, OG: .02, C: .02, DE: .036, DT: .04, LB: .022, CB: .012, S: .012, K: .004, P: .004 };
const ROT_K = 0.003, ROT_ON = 0.016, ROT_OFF = 0.05, ROT_REST = { timeout: 0.05, warning: 0.05, quarter: 0.08, half: 0.8 };
const END_BASE = { QB: 86, RB: 64, FB: 70, WR: 70, TE: 68, OT: 80, OG: 80, C: 82, DE: 62, DT: 58, LB: 70, CB: 72, S: 72, K: 95, P: 95 };

// ---------- ratings ----------
// endurance (0..99): position, age and a fixed per-player part (no stored rating, so every old save has it)
function playerEndurance(p) {
  if (!p) return 70; const h = ((((p.id | 0) + 7) * 2654435761) >>> 0) / 4294967296, age = p.age || 26;
  return Math.round(clamp((END_BASE[p.pos] || 70) + (h - 0.5) * 24 - Math.max(0, age - 28) * 1.8 + Math.max(0, 25 - age) * 0.8 - (p.pos === 'DT' && (p.wt || 300) > 325 ? 4 : 0), 35, 99));
}
// a player's role archetype (73_scoutx.js) nudges the Auto pick toward the job it describes
function roleFit(k, p) { return roleFitBase(k, p) + (p && typeof rarchRoleBonus === 'function' ? rarchRoleBonus(k, p) : 0); }
function roleFitBase(k, p) {
  if (!p) return 0; const a = p.a || {}, tr = p.traits || [], v = x => a[x] ?? 50;
  switch (k) {
    case 'X': return (v('spd') * 2.2 + v('acc') * .5 + v('jmp') * .4 + v('cth') * .5 + v('rte') * .4) / 4 + (tr.includes('deep') ? 5 : 0);
    case 'Z': return (v('cth') * 1.5 + v('rte') * 1.4 + v('spd') * .7 + v('str') * .4) / 4 + (tr.includes('hands') ? 3 : 0);
    case 'SL': case 'SL2': return (v('rte') * 1.3 + v('agi') * 1.1 + v('acc') * .8 + v('cth') * 1 + v('elu') * .5) / 4.7;
    case 'RZ': return (v('jmp') * 1.4 + v('cth') * 1.1 + v('str') * .5) / 3 + ((p.ht || 73) - 73) * 1.5 + (tr.includes('hands') ? 3 : 0);
    case 'PD': return (v('cth') * 1.3 + v('pbk') * 1 + v('rte') * .7 + v('elu') * .6 + v('agi') * .4) / 4;
    case 'GL': return (v('btk') * 1.3 + v('str') * 1.1 + v('car') * .8) / 3.2 + ((p.wt || 215) - 215) * .12 + (tr.includes('bruiser') ? 3 : 0);
    case 'Y': return (v('cth') * 1.3 + v('rte') * 1.1 + v('spd') * 1) / 3.4;
    case 'IN': return (v('rbk') * 1.4 + v('pbk') * .7 + v('str') * 1) / 3.1;
  }
  return p.ovr || 50;
}
function rotHash(n) { return (((n | 0) * 2654435761) >>> 0) / 4294967296; }
// best one-to-one assignment of keys to ids (both tiny) by fit(key, id)
function rotAssign(keys, ids, fit) {
  let best = {}, bv = -Infinity; const cur = {}, usedI = new Set();
  const go = (i, v) => {
    if (i === keys.length) { if (v > bv) { bv = v; best = Object.assign({}, cur); } return; }
    if (keys.length - i > ids.length - usedI.size) go(i + 1, v);
    for (const id of ids) { if (usedI.has(id)) continue; usedI.add(id); cur[keys[i]] = id; go(i + 1, v + fit(keys[i], id)); usedI.delete(id); delete cur[keys[i]]; }
  };
  go(0, 0); return best;
}

// ---------- team settings ----------
function rotCfgW(T) { const r = T.rot && typeof T.rot === 'object' ? T.rot : (T.rot = { v: 1 }); for (const k of ['roles', 'preset', 'share', 'lock']) if (!r[k] || typeof r[k] !== 'object') r[k] = {}; return r; }
function rotOpt(T, k) { const r = T.rot || {}; return k === 'twoMin' ? r.twoMin !== false : !!r[k]; }
function rotLocked(T, id) { return !!(T.rot && T.rot.lock && T.rot.lock[id]); }
function rotPresetOf(T, pos) {
  const P0 = ROT_PRESETS[pos]; if (!P0) return null; const r = T.rot && T.rot.preset && T.rot.preset[pos];
  if (r && (r === 'custom' || P0[r])) return r;
  if (typeof L !== 'undefined' && L && T.id === L.user) return ROT_DEF[pos];
  // CPU staffs differ: some ride a bell-cow, some split the carries, some roll their linemen hard
  const h = rotHash(T.id * 31 + pos.charCodeAt(0) * 7 + (pos.charCodeAt(1) || 0) * 3), st = T.offStyle;
  if (pos === 'RB') return st === 'Ground & Pound' ? (h < .45 ? 'split' : h < .75 ? 'committee' : 'bell') : (h < .55 ? 'bell' : h < .9 ? 'split' : 'committee');
  if (pos === 'WR') return st === 'Air Raid' || st === 'Spread' ? (h < .55 ? 'rotate' : h < .75 ? 'heavy' : 'starters') : (h < .5 ? 'starters' : 'rotate');
  if (pos === 'TE') return (st === 'Ground & Pound' || st === 'Balanced') && h < .5 ? 'two' : 'one';
  if (pos === 'DE' || pos === 'DT') return h < .6 ? 'rotate' : h < .85 ? 'light' : 'heavy';
  return h < .88 ? 'starters' : 'rotate';
}
// effective role owners among the healthy players (avail, in depth order): explicit picks first, Auto fills the rest from the ratings
function rotRoles(T, pos, avail) {
  const out = {}; if (!ROT_ROLES[pos]) return out;
  const ex = (T.rot && T.rot.roles && T.rot.roles[pos]) || {}, ok = id => id != null && avail.includes(+id), P = id => L.P[id];
  if (pos === 'WR') {
    const taken = new Set(); for (const k of ROT_EXCL.WR) if (ok(ex[k]) && !taken.has(+ex[k])) { out[k] = +ex[k]; taken.add(+ex[k]); }
    const open = ['X', 'Z', 'SL'].filter(k => out[k] == null), pool = avail.filter(id => !taken.has(id)).slice(0, open.length);
    Object.assign(out, rotAssign(open, pool, (k, id) => roleFit(k, P(id))));
    for (const k of ['X', 'Z', 'SL']) if (out[k] != null) taken.add(out[k]);
    if (out.SL2 == null) { const n = avail.find(id => !taken.has(id)); if (n != null) out.SL2 = n; }
    if (ok(ex.RZ)) out.RZ = +ex.RZ; else { let b = null, bv = -1e9; for (const k of ['X', 'Z', 'SL']) { const id = out[k]; if (id == null) continue; const v = roleFit('RZ', P(id)); if (v > bv) { bv = v; b = id; } } if (b != null) out.RZ = b; }
  } else if (pos === 'RB') {
    out.LEAD = ok(ex.LEAD) ? +ex.LEAD : avail[0]; const top = avail.slice(0, 3);
    for (const k of ['PD', 'GL']) {
      if (ok(ex[k])) { out[k] = +ex[k]; (out._x = out._x || {})[k] = 1; continue; } if (out.LEAD == null) continue;
      let b = out.LEAD, bv = roleFit(k, P(out.LEAD)) + 4;          // a specialist only when he is clearly better at it
      for (const id of top) { const v = roleFit(k, P(id)); if (v > bv) { bv = v; b = id; } } out[k] = b;
    }
  } else if (pos === 'TE') {
    const y = ok(ex.Y) ? +ex.Y : null, i = ok(ex.IN) && +ex.IN !== y ? +ex.IN : null;
    out.Y = y != null ? y : avail.find(id => id !== i); out.IN = i != null ? i : avail.find(id => id !== out.Y);
    if (out.Y == null) delete out.Y; if (out.IN == null) delete out.IN;
  }
  return out;
}
// rank order of a group: the role starters first (WR: the X, Z and slot in depth-chart order), then the depth chart
function rotOrder(T, pos, avail, rl) {
  if (pos === 'WR') { const top = new Set([rl.X, rl.Z, rl.SL].filter(x => x != null)); const a = avail.filter(id => top.has(id)); if (rl.SL2 != null && !top.has(rl.SL2)) a.push(rl.SL2); return a.concat(avail.filter(id => !a.includes(id))); }
  if (pos === 'RB' && rl.LEAD != null) return [rl.LEAD].concat(avail.filter(id => id !== rl.LEAD));
  if (pos === 'TE') { const a = [rl.Y, rl.IN].filter((x, i, arr) => x != null && arr.indexOf(x) === i); return a.concat(avail.filter(id => !a.includes(id))); }
  return avail;
}
function rotShareList(T, pos, order) {
  const P0 = ROT_PRESETS[pos], pr = rotPresetOf(T, pos), cs = pr === 'custom' ? (T.rot && T.rot.share) || {} : null;
  const base = (P0[pr] || P0[ROT_DEF[pos]])[1], defb = P0[ROT_DEF[pos]][1];
  return order.map((id, i) => cs && cs[id] != null ? clamp(+cs[id] || 0, 0, 100) / 100 : ((cs ? defb : base)[i] || 0) / 100);
}
// per-snap targets: the highest shares first (ties: rank order) until the formation's n spots are used; spare spots go to the top of the list
function rotFill(sh, n) {
  const idx = sh.map((s, i) => i).sort((a, b) => sh[b] - sh[a] || a - b), t = sh.map(() => 0); let cap = n;
  for (const i of idx) { if (cap <= 1e-9) break; const v = Math.min(sh[i], cap); t[i] = v; cap -= v; }
  for (const i of idx) { if (cap <= 1e-9) break; const add = Math.min(1 - t[i], cap); t[i] += add; cap -= add; }
  return t;
}
function rotSit(ctx) {
  if (!ctx) return {}; const d = ctx.down || 1, tg = ctx.togo || 10, yl = ctx.yl || 25;
  return { pass: ctx.scen === '2min' || (d >= 3 && tg >= 5) || (d === 2 && tg >= 10), short: yl >= 97 || (d >= 3 && tg <= 1.5) || ctx.form === 'Goal Line', red: yl >= 80, two: ctx.scen === '2min', key: d >= 3 || yl >= 80 };
}
// resting: under 72% stamina he sits until he is back to 86% (a locked player never rests; in starters mode only a gassed one sits)
function rotResting(rs, id, e, lock, stMode) {
  if (lock) { delete rs.rest[id]; return false; }
  if (rs.rest[id]) { if (e >= ROT_BACK) { delete rs.rest[id]; rs.back[id] = 1; } }
  else if (e < ROT_SUB) rs.rest[id] = 1;
  return !!rs.rest[id] && !(stMode && e >= ROT_HARD);
}

// ---------- the lineup for one snap ----------
// who plays this snap for one position group: n spots, ctx = snap situation (null: the base lineup, no rotation), rs = match rotation state
function rotPick(T, pos, n, ctx, rs, used, side) {
  const avail = (T.depth[pos] || []).filter(id => available(id) && !used.has(id)), rl = rotRoles(T, pos, avail), order = rotOrder(T, pos, avail, rl);
  if (!n || !order.length) return { on: [], rl, order };
  const sh = rotShareList(T, pos, order), sit = rotSit(ctx), stMode = !!ctx && ((rotOpt(T, 'twoMin') && sit.two) || (rotOpt(T, 'keyDowns') && sit.key));
  let t;
  if (stMode) { const idx = sh.map((s, i) => i).sort((a, b) => sh[b] - sh[a] || a - b); t = order.map(() => 0); idx.slice(0, n).forEach(i => { t[i] = 1; }); }
  else t = rotFill(sh, n);
  const boost = new Set(), force = (id, v) => {
    const i = order.indexOf(id); if (i < 0) return; t[i] = Math.max(t[i], v); boost.add(id);
    const ex = t.reduce((a, b) => a + b, 0) - n, others = t.reduce((a, b, j) => a + (j === i ? 0 : b), 0);
    if (ex > 1e-9 && others > 0) for (let j = 0; j < t.length; j++) if (j !== i) t[j] = Math.max(0, t[j] - ex * t[j] / others);
  };
  if (ctx) {
    // a specialist back takes his downs (an Auto pick that is just the lead back leaves the share split alone)
    const spec = k => rl[k] != null && (rl[k] !== rl.LEAD || (rl._x && rl._x[k]));
    if (pos === 'RB') { if (sit.short && spec('GL')) force(rl.GL, 1); else if (sit.pass && spec('PD')) force(rl.PD, 1); }
    if (pos === 'WR' && sit.red && rl.RZ != null) force(rl.RZ, 0.95);
    if (pos === 'TE' && sit.short && rl.IN != null && ctx.play && ctx.play.type === 'run') force(rl.IN, 1);
  }
  const key = T.id + side, B = rs ? rs.u[key] : null, last = rs ? rs.last[key] : null, rest = {};
  const score = order.map((id, i) => {
    let s = t[i] - i * 0.002;
    if (B) s += clamp((B.acc[id] || 0) - (B.on[id] || 0), -1.2, 1.2);
    if (last && last.includes(id)) s += ROT_STICK;
    if (boost.has(id)) s += 3;
    if (rs) { const e = rs.E[id] ?? 1, lock = rotLocked(T, id); rest[id] = rotResting(rs, id, e, lock, stMode); if (rest[id]) s -= 20; else if (!lock && !stMode) s -= Math.max(0, ROT_BACK - e) * 2.5; }
    return s;
  });
  const on = order.map((id, i) => i).sort((a, b) => score[b] - score[a] || a - b).slice(0, n).sort((a, b) => a - b).map(i => order[i]);
  if (rs) {
    const pd = rs.pend[key]; order.forEach((id, i) => { if (!rest[id]) pd.t[id] = t[i]; });
    // the sideline notices: who took a breather, who is back from one
    if (last) { const ins = on.filter(id => !last.includes(id)), name = id => { const p = L.P[id]; return p ? p.ln : '?'; };
      for (const id of last) if (order.includes(id) && !on.includes(id) && rs.rest[id]) { const inn = ins.shift(); pd.notes.push(inn != null ? `${name(id)} takes a breather — ${name(inn)} in` : `${name(id)} takes a breather`); }
      for (const id of on) if (rs.back[id]) { delete rs.back[id]; if (!last.includes(id)) pd.notes.push(`${name(id)} is back in`); } }
  }
  return { on, rl, order };
}
function rotRouteDepth(op, slot) {
  const cp = op.paths && op.paths[slot]; if (cp && cp.length) return Math.max(0, ...cp.map(q => q[0] || 0));
  const r = op.routes && op.routes[slot]; if (!r || r === 'block') return -1; const w = ROUTES[r]; if (!w || !w.length) return 0;
  return Math.max(0, ...w.map(q => q[0])) + (DEEP_ROUTES[r] ? 4 : 0);
}
// where the players of one group line up: role owners in their spots, the rest by fit; on a pass play the deep threat gets the deepest outside route
function rotSlots(pos, slots, on, rl, ctx) {
  const names = slots.map(s => s[0]), res = {}, left = new Set(on), P = id => L.P[id];
  if (pos === 'WR' || pos === 'TE') {
    const roleOf = pos === 'WR' ? { X: 'X', Z: 'Z', SL: 'SL', SL2: 'SL2' } : { TE: 'Y', TE2: 'IN' };
    for (const nm of names) { const id = rl[roleOf[nm]]; if (id != null && left.has(id)) { res[nm] = id; left.delete(id); } }
    const open = names.filter(nm => res[nm] == null);
    Object.assign(res, rotAssign(open, [...left], (nm, id) => pos === 'WR' ? roleFit(nm, P(id)) : roleFit(nm === 'TE2' ? 'IN' : 'Y', P(id))));
    const op = ctx && ctx.play, swap = (a, b) => { const x = res[a]; res[a] = res[b]; res[b] = x; }, at = id => names.find(nm => res[nm] === id);
    if (pos === 'WR' && ctx) {
      const red = (ctx.yl || 0) >= 80;
      // inside the 20 the red-zone target goes outside (trading spots with the outside man who fits the slot better)
      if (red && rl.RZ != null) { const a = at(rl.RZ); if (a && a !== 'X' && a !== 'Z') { const o = ['X', 'Z'].filter(nm => res[nm] != null).sort((u, v) => roleFit('SL', P(res[v])) - roleFit('SL', P(res[u])))[0]; if (o) swap(a, o); } }
      if (op && op.type === 'pass') {
        const dep = nm => rotRouteDepth(op, nm);
        const pair = (a, b, deepId) => { if (res[a] == null || res[b] == null || deepId == null) return; const mine = res[a] === deepId ? a : res[b] === deepId ? b : null; if (!mine) return; const other = mine === a ? b : a; if (dep(other) >= 15 && dep(other) > dep(mine) + 4) swap(a, b); };
        const outs = [res.X, res.Z];
        pair('X', 'Z', red && outs.includes(rl.RZ) ? rl.RZ : outs.includes(rl.X) ? rl.X : (res.X != null && res.Z != null ? (roleFit('X', P(res.X)) >= roleFit('X', P(res.Z)) ? res.X : res.Z) : null));
        // the slot pair: the faster man runs the seam / wheel, the Slot receiver keeps the short and option routes
        if (res.SL != null && res.SL2 != null) pair('SL', 'SL2', rl.SL === res.SL ? res.SL2 : rl.SL === res.SL2 ? res.SL : (roleFit('X', P(res.SL)) >= roleFit('X', P(res.SL2)) ? res.SL : res.SL2));
      }
    }
    if (pos === 'TE' && op && op.type === 'pass' && res.TE != null && res.TE2 != null && rl.Y != null && at(rl.Y)) {
      const mine = at(rl.Y), other = mine === 'TE' ? 'TE2' : 'TE'; if (rotRouteDepth(op, other) > rotRouteDepth(op, mine) + 2) swap('TE', 'TE2');
    }
    return names.map(nm => res[nm] ?? null);
  }
  // everyone else: the better-ranked player takes the lower depth index (DE1 before DE2, the nickel corner is CB3)
  const ix = slots.map((s, i) => i).sort((a, b) => slots[a][2] - slots[b][2] || a - b), out = names.map(() => null);
  ix.forEach((i, k) => { out[i] = on[k] ?? null; }); return out;
}
// the idx-th healthy player at a position (players already used are skipped but still count for the order), no fallbacks
function rotOwnPick(t, pos, idx, used) { const c = (t.depth[pos] || []).filter(id => available(id)); for (let i = idx; i < c.length; i++) if (!used.has(c[i])) return c[i]; for (let i = Math.min(idx, c.length) - 1; i >= 0; i--) if (!used.has(c[i])) return c[i]; return null; }
// the 11 for a formation. ctx/rs null = the base lineup (depth chart screen, starters()); with a match rotation state it rotates and records the snap as pending
function teamLineup(t, formKey, side, ctx, rs) {
  const F = side === 'O' ? OFF_FORMS[formKey] || OFF_FORMS.Shotgun : DEF_FORMS[formKey] || DEF_FORMS['4-3'];
  const slots = side === 'O' ? F.slots.concat(OL_SLOTS) : F.slots, used = new Set(), pid = slots.map(() => null), key = t.id + side;
  if (rs) rs.pend[key] = { t: {}, on: [], notes: [] };
  const c2 = ctx ? Object.assign({ form: formKey }, ctx) : null;
  // 1. every-down spots (QB, FB, the line) straight off the depth chart
  slots.forEach((s, i) => { if (ROT_GROUPS.includes(s[1])) return; const id = rotOwnPick(t, s[1], s[2], used); if (id != null) { pid[i] = id; used.add(id); } });
  // 2. the rotating groups: who plays this snap, then where each one lines up
  const groups = []; for (const s of slots) if (ROT_GROUPS.includes(s[1]) && !groups.includes(s[1])) groups.push(s[1]);
  for (const pos of groups) {
    const idx = slots.map((s, i) => s[1] === pos ? i : -1).filter(i => i >= 0), g = rotPick(t, pos, idx.length, c2, rs, used, side);
    const asg = rotSlots(pos, idx.map(i => slots[i]), g.on, g.rl, c2);
    idx.forEach((i, j) => { const id = asg[j]; if (id != null && !used.has(id)) { pid[i] = id; used.add(id); } });
  }
  // 3. anything still empty: the depth chart fallbacks (a TE at WR, a safety at corner...)
  slots.forEach((s, i) => { if (pid[i] != null) return; const id = depthPick(t, s[1], s[2], used); if (id != null) { pid[i] = id; used.add(id); } });
  const out = slots.map((s, i) => ({ slot: s[0], pos: s[1], pid: pid[i], id: pid[i], dx: s[3], dy: s[4] }));
  if (rs) { const pd = rs.pend[key]; pd.on = out.map(e => e.pid).filter(x => x != null); out.notes = pd.notes; }
  return out;
}

// ---------- match rotation state ----------
function rotInit(H, A) { return { E: {}, work: {}, u: {}, last: {}, pend: {}, rest: {}, back: {}, n: {}, ids: (H.roster || []).concat(A.roster || []) }; }
function rotRecMul(p) { return 0.5 + playerEndurance(p) / 100; }
function rotDrain(p, work) { return ((ROT_BASE[p.pos] || .015) + work * ROT_K) * (1.5 - playerEndurance(p) / 100); }
// effort during a live play: distance run, weighted toward sprinting, plus time spent locked in a block
function rotStep(rs, pl, dt) {
  if (!rs || !pl || pl.phase !== 'live' || !pl.players) return; const W = rs.work;
  for (const p of pl.players) { if (p.pid == null || !p.vel) continue; const v = Math.hypot(p.vel.x, p.vel.z); let w = 0;
    if (v > 0.4) { const r = Math.max(0, v / 7.5 - 0.45); w = v * (0.1 + 1.6 * r * r) * dt; } if (p.engaged) w += 1.5 * dt; if (w) W[p.pid] = (W[p.pid] || 0) + w; }
}
// after the whistle: drain the players who were on the field (hits count: the ball carrier and the tacklers), the sideline recovers; commit the rotation
// op (optional) = the offensive play: a receiver's route counts in full even when the ball comes out early (a deep route is a sprint whatever happens)
function rotSnap(rs, lists, res, st, op) {
  if (!rs) return; const on = new Set(), tk = new Set((res && res.tacklers) || []), pass = op && op.type === 'pass';
  (lists || []).forEach((lst, li) => { for (const e of lst) {
    const p = e && e.rp, id = p && p.id; if (id == null || on.has(id)) continue; on.add(id);
    let w = rs.work[id] || 0; if (res && res.carrier === id && !res.td) w += 12; if (tk.has(id)) w += 5;
    if (pass && li === 0 && e.slot) { const dp = rotRouteDepth(op, e.slot); w += dp >= 15 ? 14 : dp >= 8 ? 6 : dp >= 0 ? 2 : 0; }
    rs.E[id] = clamp((rs.E[id] ?? 1) - rotDrain(p, w) * (st ? 0.8 : 1) + ROT_ON * rotRecMul(p), 0.05, 1);
  } });
  for (const id of rs.ids) { if (on.has(id)) continue; const p = L.P[id]; if (p && (rs.E[id] ?? 1) < 1) rs.E[id] = Math.min(1, rs.E[id] + ROT_OFF * rotRecMul(p)); }
  if (!st) for (const k in rs.pend) {
    const pd = rs.pend[k], B = rs.u[k] || (rs.u[k] = { acc: {}, on: {} });
    for (const id in pd.t) B.acc[id] = (B.acc[id] || 0) + pd.t[id];
    for (const id of pd.on) B.on[id] = (B.on[id] || 0) + 1;
    rs.last[k] = pd.on; rs.n[k] = (rs.n[k] || 0) + 1;
  }
  rs.pend = {}; rs.work = {};
}
// breaks in the game: timeouts, the two-minute warning, quarter breaks, halftime
function rotRest(rs, kind) { if (!rs) return; const a = ROT_REST[kind] || 0; for (const id of rs.ids) { const e = rs.E[id]; if (e == null || e >= 1) continue; const p = L.P[id]; if (p) rs.E[id] = Math.min(1, e + a * rotRecMul(p)); } }
// stamina 0..1 right now (during a live play: minus what this play has cost him so far)
function rotEnergy(rs, pid, pl) { if (!rs || pid == null) return 1; let e = rs.E[pid] ?? 1; const w = rs.work[pid]; if (w && pl && pl.phase === 'live') { const p = L.P[pid]; if (p) e -= rotDrain(p, w); } return clamp(e, 0, 1); }
function rotReport(rs) {
  if (!rs) return null; const out = {};
  for (const k in rs.n) { const tid = parseInt(k, 10), side = k.slice(String(tid).length), o = out[tid] || (out[tid] = { O: 0, D: 0, p: {} }); o[side] = rs.n[k]; const B = rs.u[k]; if (B) for (const id in B.on) o.p[id] = (o.p[id] || 0) + B.on[id]; }
  return out;
}
// the user's last game, for the depth chart ("last game 64%")
function rotRecord(g, result) {
  if (!result || !result.rot || !L || L.user == null) return; const T = UT(), r = result.rot[T.id]; if (!r || !(g.h === T.id || g.a === T.id)) return;
  T.rotLast = { y: L.year, w: L.week, O: r.O || 0, D: r.D || 0, p: r.p || {}, live: 1 };
}

// ---------- quick sim (games not played live): shares decide snaps, carries and targets ----------
function rotSimShares(T, pos) {
  const avail = (T.depth[pos] || []).filter(id => available(id)), rl = rotRoles(T, pos, avail), order = rotOrder(T, pos, avail, rl), sh = rotShareList(T, pos, order), e = order.map(() => 0);
  for (const [n, w] of ROT_MIX[pos] || [[1, 1]]) { const t = rotFill(sh, n); t.forEach((v, i) => { e[i] += v * w; }); }
  return { order, rl, e };
}
function rotSimLines(T) {
  const oS = ri(56, 70), dS = ri(56, 70), snaps = {}, G0 = {};
  for (const pos of ROT_GROUPS) { const g = rotSimShares(T, pos); G0[pos] = g; const tot = DEF_POS.includes(pos) ? dS : oS; g.order.forEach((id, i) => { const n = Math.round(tot * g.e[i]); if (n > 0) snaps[id] = n; }); }
  const qb = (T.depth.QB || []).filter(available)[0]; if (qb != null) snaps[qb] = oS;
  for (const [pos, n] of [['OT', 2], ['OG', 2], ['C', 1]]) (T.depth[pos] || []).filter(available).slice(0, n).forEach(id => { snaps[id] = oS; });
  const fb = (T.depth.FB || []).filter(available)[0]; if (fb != null) snaps[fb] = Math.round(oS * 0.15);
  for (const pos of ['K', 'P']) { const id = (T.depth[pos] || []).filter(available)[0]; if (id != null) snaps[id] = ri(48, 66); }
  // targets: 69% to the receivers (the top of the order sees the most), 20% to the tight ends, 11% to the backs (the passing-down back more)
  const W = G0.WR, TE = G0.TE, RB = G0.RB, rcv = [], RM = [1, .78, .5, .45, .4, .4];
  const part = (g, tot, mul) => { const w = g.order.map((id, i) => g.e[i] * mul(id, i)), s = w.reduce((a, b) => a + b, 0); if (s > 0) g.order.forEach((id, i) => { if (w[i] > 0) rcv.push([id, tot * w[i] / s]); }); };
  part(W, .69, (id, i) => RM[Math.min(i, RM.length - 1)]); part(TE, .2, (id, i) => [1, .4, .3][Math.min(i, 2)]); part(RB, .11, id => id === RB.rl.PD && id !== RB.rl.LEAD ? 1.6 : 1);
  rcv.sort((a, b) => b[1] - a[1]);
  const rs = RB.e.reduce((a, b) => a + b, 0), rush = rs > 0 ? RB.order.map((id, i) => [id, .9 * RB.e[i] / rs]).filter(x => x[1] > 0) : [];
  if (typeof L !== 'undefined' && L && T.id === L.user && !L.ghost) T.rotLast = { y: L.year, w: L.week, O: oS, D: dS, p: snaps, live: 0 };
  return { snaps, rcv, rush, gl: RB.rl.GL ?? RB.order[0] };
}
// defense: tackles and sacks follow the snaps too
function rotSimDef(D) { const out = {}; for (const pos of DEF_POS) out[pos] = rotSimShares(D, pos); return out; }

// ---------- settings (UI) ----------
function rotInfo(T, pos) {
  const ids = (T.depth[pos] || []).filter(id => L.P[id]), avail = ids.filter(id => available(id)), rl = rotRoles(T, pos, avail), order = rotOrder(T, pos, avail, rl);
  const sh = ROT_PRESETS[pos] ? rotShareList(T, pos, order) : order.map(() => 1), share = {}, tags = {}, end = {}, last = {};
  order.forEach((id, i) => { share[id] = Math.round(sh[i] * 100); });
  for (const k in rl) if (rl[k] != null && ROT_TAG[k]) (tags[rl[k]] = tags[rl[k]] || []).push(ROT_TAG[k]);
  const ex = (T.rot && T.rot.roles && T.rot.roles[pos]) || {}, RL = T.rotLast, tot = RL ? (DEF_POS.includes(pos) ? RL.D : RL.O) : 0;
  for (const id of ids) { end[id] = playerEndurance(L.P[id]); if (RL && tot) last[id] = Math.round(100 * (RL.p[id] || 0) / tot); }
  const roles = (ROT_ROLES[pos] || []).map(([k, n, d]) => ({ k, n, d, id: rl[k] ?? null, auto: !(ex[k] != null && avail.includes(+ex[k])), fit: id => Math.round(clamp(roleFit(k, L.P[id]), 1, 99)) }));
  return { ids, order, share, tags, end, last, roles, preset: rotPresetOf(T, pos), lastTot: tot, lastLive: RL ? RL.live : 0 };
}
function rotSetPreset(T, pos, v) {
  const r = rotCfgW(T); if (!ROT_PRESETS[pos] || (v !== 'custom' && !ROT_PRESETS[pos][v])) return;
  if (v === 'custom') {      // keep what the screen shows; an injured player keeps the share his depth spot would give him
    const cur = rotInfo(T, pos).share, all = (T.depth[pos] || []).filter(id => L.P[id]), ord = rotOrder(T, pos, all, rotRoles(T, pos, all)), sh = rotShareList(T, pos, ord), healthy = {};
    ord.forEach((id, i) => { healthy[id] = Math.round(sh[i] * 100); });
    for (const id of T.roster) if (L.P[id] && L.P[id].pos === pos) r.share[id] = cur[id] ?? healthy[id] ?? 0;
  }
  else for (const id of T.roster) if (L.P[id] && L.P[id].pos === pos) delete r.share[id];
  r.preset[pos] = v;
}
function rotSetShare(T, pos, id, v) { if (rotPresetOf(T, pos) !== 'custom') rotSetPreset(T, pos, 'custom'); rotCfgW(T).share[id] = clamp(Math.round(+v || 0), 0, 100); }
function rotSetRole(T, pos, k, v) {
  const r = rotCfgW(T), R0 = r.roles[pos] || (r.roles[pos] = {});
  if (v === '' || v == null) { delete R0[k]; return; }
  const id = +v; if (!L.P[id] || L.P[id].pos !== pos) return;
  const ex = ROT_EXCL[pos] || []; if (ex.includes(k)) for (const o of ex) if (o !== k && +R0[o] === id) delete R0[o];
  R0[k] = id;
}
function rotToggleLock(T, id) { const r = rotCfgW(T); if (r.lock[id]) delete r.lock[id]; else r.lock[id] = 1; }
function rotSetOpt(T, k, v) { rotCfgW(T)[k] = !!v; }
function rotReset(T, side) { const r = rotCfgW(T); for (const pos of ROT_GROUPS) { if ((DEF_POS.includes(pos) ? 'D' : 'O') !== side) continue; delete r.roles[pos]; delete r.preset[pos]; for (const id of T.roster) if (L.P[id] && L.P[id].pos === pos) { delete r.share[id]; delete r.lock[id]; } } }
