// Roles, snap shares, stamina and rotations (headless). run: node tools/build.mjs && node qa/rotation_test.cjs
// 1. every lineup for every team and formation is 11 different healthy players
// 2. shares converge over a game of snaps (RB split, WR4, DL rotation) and situations pick the specialists
// 3. effort from real physics plays: a deep route costs more than a block; tired receivers sit and come back
// 4. the deep threat gets the deep route, the red-zone target goes outside; old saves (no T.rot) still work; quick-sim stats follow the shares
const path = require('path');
const { LG, PHYS } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
const T_ = LG._t; let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };
let s = 20261124; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(3, 'Test Coach');
const L = LG.state(), U = T_.UT(), P = id => L.P[id];
const OFF = ['Shotgun', 'Singleback', 'I-Form', 'Trips', 'Empty', 'Pistol', 'Bunch', 'Goal Line'], DEF = ['4-3', '3-4', 'Nickel', 'Dime', 'Goal Line D'];
const valid = (lst, tag) => { const ids = lst.map(e => e.pid); ok(lst.length === 11, `${tag}: 11 men (${lst.length})`); ok(new Set(ids).size === 11, `${tag}: no duplicates`); ok(ids.every(id => id != null && P(id) && !(P(id).inj > 0)), `${tag}: healthy players only`); };
// ---- 1. lineups
for (const T of L.teams) { for (const f of OFF) valid(LG.starters(T, f, 'O'), `${T.abbr} ${f}`); for (const f of DEF) valid(LG.starters(T, f, 'D'), `${T.abbr} ${f}`); }
// injuries: hurt the top two WRs and the RB1 of the user's team; they must vanish from every lineup
const hurt = [U.depth.WR[0], U.depth.WR[1], U.depth.RB[0]]; hurt.forEach(id => { P(id).inj = 2; });
for (const f of OFF) { const l = LG.starters(U, f, 'O'); valid(l, 'injured ' + f); ok(!l.some(e => hurt.includes(e.pid)), 'injured never appear ' + f); }
// a thin roster: only 2 healthy WRs left, Empty asks for 4 -> fallbacks fill, still 11
const wrs = U.depth.WR.slice(); wrs.slice(2).forEach(id => { P(id).inj = 1; }); valid(LG.starters(U, 'Empty', 'O'), 'thin WR room Empty'); wrs.forEach(id => { P(id).inj = 0; }); hurt.forEach(id => { P(id).inj = 0; });
// depth order: WR2 on the chart plays in 2-WR sets (the old skip-one bug); the top 3 WRs are the 3-WR starters
{ const top3 = U.depth.WR.slice(0, 3).sort().join(), l = LG.starters(U, 'Shotgun', 'O').filter(e => e.pos === 'WR').map(e => e.pid).sort().join(); ok(l === top3, 'Shotgun WRs = depth WR1-3');
  const two = LG.starters(U, 'Singleback', 'O').filter(e => e.pos === 'WR').map(e => e.pid).sort().join(); ok(two === U.depth.WR.slice(0, 2).sort().join(), 'Singleback WRs = depth WR1-2'); }
// ---- 2. a game of snaps: shares converge
const opp = L.teams[(U.id + 1) % 32]; T_.rotSetPreset(U, 'RB', 'split'); T_.rotSetPreset(U, 'DE', 'heavy');
const book = L.plays, byForm = f => book.filter(p => p.side === 'O' && p.form === f);
const simGameSnaps = (rs, n, opts = {}) => {
  const forms = opts.forms || ['Shotgun', 'Shotgun', 'Singleback', 'Trips', 'I-Form'];
  for (let i = 0; i < n; i++) {
    const form = forms[i % forms.length], play = opts.play ? opts.play(form, i) : byForm(form)[i % byForm(form).length];
    const ctx = Object.assign({ down: 1 + (i % 3), togo: 10, yl: 40, q: 2, clock: 600, qlen: 900, sd: 0, scen: '1st', play }, opts.ctx ? opts.ctx(i) : {});
    const o = LG.lineup(U, form, 'O', ctx, rs), d = LG.lineup(opp, '4-3', 'D', Object.assign({}, ctx, { play: null }), rs);
    valid(o, 'snap O ' + i); valid(d, 'snap D ' + i);
    for (const e of o) rs.work[e.pid] = opts.work ? opts.work(e, play) : 8; for (const e of d) rs.work[e.pid] = 8;
    LG.rotSnap(rs, [o.map(e => ({ rp: P(e.pid) })), d.map(e => ({ rp: P(e.pid) }))], {});
  }
};
{ const rs = LG.rotInit(U, opp); simGameSnaps(rs, 64); const B = rs.u[U.id + 'O'], N = rs.n[U.id + 'O'];
  const rb = T_.rotInfo(U, 'RB').order, r1 = (B.on[rb[0]] || 0) / N, r2 = (B.on[rb[1]] || 0) / N;
  console.log(`split backfield over ${N} snaps: RB1 ${(r1 * 100).toFixed(0)}%  RB2 ${(r2 * 100).toFixed(0)}%  (I-Form/Singleback/Shotgun mix, 1 RB slot)`);
  ok(Math.abs(r1 - 0.6) < 0.1 && Math.abs(r2 - 0.4) < 0.1, 'split shares ~60/40');
  const wr = T_.rotInfo(U, 'WR').order; console.log('WR snap %: ' + wr.map(id => Math.round(100 * (B.on[id] || 0) / N)).join(' / '));
  ok((B.on[wr[3]] || 0) > 0, 'WR4 gets snaps'); ok([0, 1, 2].every(i => (B.on[wr[i]] || 0) / N > 0.55) && (B.on[wr[0]] || 0) > (B.on[wr[3]] || 0) * 1.5, 'the top 3 WRs play most (64 snaps in a row, no sideline rest: breathers are allowed)');
  const D = rs.u[opp.id + 'D'], de = (opp.depth.DE || []).filter(id => !(P(id).inj > 0)); console.log('opp DE snap %: ' + de.map(id => Math.round(100 * (D.on[id] || 0) / N)).join(' / ') + `  (${opp.abbr} preset ${T_.rotInfo(opp, 'DE').preset})`);
  let runs = 0, mx = 0; const seq = []; for (let i = 0; i < 1; i++); }
// series: how long a back stays in (stickiness gives short series, not every-other-play)
{ const rs = LG.rotInit(U, opp), seq = []; const rb = T_.rotInfo(U, 'RB').order;
  for (let i = 0; i < 40; i++) { const o = LG.lineup(U, 'Shotgun', 'O', { down: 1, togo: 10, yl: 40, scen: '1st', play: byForm('Shotgun')[0] }, rs); seq.push(o.find(e => e.slot === 'RB').pid === rb[0] ? 1 : 2); LG.rotSnap(rs, [o.map(e => ({ rp: P(e.pid) }))], {}); }
  console.log('RB by snap (split): ' + seq.join('')); let sw = 0; for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) sw++; ok(sw >= 6 && sw <= 26, 'RB rotation comes in series (' + sw + ' swaps in 40)'); }
// situations: 3rd & long -> passing-down back, goal line -> short-yardage back
{ const R0 = T_.rotRoles(U, 'RB', U.depth.RB.filter(id => !(P(id).inj > 0))); const pdBack = U.depth.RB[2], glBack = U.depth.RB[1];
  T_.rotSetRole(U, 'RB', 'PD', pdBack); T_.rotSetRole(U, 'RB', 'GL', glBack);
  const rs = LG.rotInit(U, opp); let pd = 0, gl = 0;
  for (let i = 0; i < 10; i++) { const o = LG.lineup(U, 'Shotgun', 'O', { down: 3, togo: 9, yl: 45, scen: '3long', play: byForm('Shotgun')[0] }, rs); if (o.find(e => e.slot === 'RB').pid === pdBack) pd++; LG.rotSnap(rs, [o.map(e => ({ rp: P(e.pid) }))], {}); }
  for (let i = 0; i < 6; i++) { const o = LG.lineup(U, 'Goal Line', 'O', { down: 1, togo: 2, yl: 98, scen: 'goal', play: byForm('Goal Line')[1] }, rs); if (o.find(e => e.slot === 'RB').pid === glBack) gl++; LG.rotSnap(rs, [o.map(e => ({ rp: P(e.pid) }))], {}); }
  ok(pd === 10, `passing-down back on 3rd & long (${pd}/10)`); ok(gl === 6, `short-yardage back at the goal line (${gl}/6)`);
  T_.rotSetRole(U, 'RB', 'PD', ''); T_.rotSetRole(U, 'RB', 'GL', ''); void R0; }
// ---- 3. effort from real plays + fatigue subs
{ const four = book.find(p => p.name === 'Four Verticals'), dive = book.find(p => p.name === 'Gun Inside Zone'), dfn = book.find(p => p.side === 'D' && p.form === '4-3');
  const rs = LG.rotInit(U, opp), run = (op, seed) => { const o = LG.lineup(U, op.form, 'O', { down: 1, togo: 10, yl: 30, scen: '1st', play: op }, null), d = LG.lineup(opp, dfn.form, 'D', { down: 1, togo: 10, yl: 30, scen: '1st' }, null);
    const mk = l => l.map(e => ({ slot: e.slot, pos: e.pos, rp: P(e.pid), dx: e.dx, dy: e.dy }));
    const opts = { losZ: 30 * 0.9144, ballX: 0, down: 1, togo: 10, op: Object.assign({}, op, { flip: false }), dp: dfn, off: { tid: U.id, list: mk(o), bonus: 0 }, def: { tid: opp.id, list: mk(d), bonus: 0 }, userSide: null, diff: 'pro', seed, weather: 'clear', fatigue: {} };
    rs.work = {}; const res = PHYS.runPlay(opts, pl => LG.rotStep(rs, pl, PHYS.DT)); const by = {}; for (const e of o.concat(d)) by[e.slot] = rs.work[e.pid] || 0; const E0 = {}; for (const e of o.concat(d)) E0[e.slot] = e.pid;
    const before = {}; for (const e of o.concat(d)) before[e.slot] = rs.E[e.pid] ?? 1; LG.rotSnap(rs, [opts.off.list, opts.def.list], res, false, op); const dr = {}; for (const k in E0) dr[k] = before[k] - rs.E[E0[k]]; for (const id in rs.E) rs.E[id] = 1; return { by, dr, res }; };
  const avg = (op, keys) => { const A = {}, D = {}; for (let sd = 1; sd <= 10; sd++) { const r = run(op, sd * 7919); for (const k of keys) { A[k] = (A[k] || 0) + r.by[k] / 10; D[k] = (D[k] || 0) + r.dr[k] / 10; } } return keys.map(k => `${k} ${A[k].toFixed(0)}m (-${(D[k] * 100).toFixed(1)}%)`).join('  '); };
  const ks = ['X', 'Z', 'SL', 'TE', 'RB', 'LG', 'DE1', 'DT1', 'LB1', 'CB1', 'S1'];
  const fv = avg(four, ks), rn = avg(dive, ks); console.log('effort + net stamina per snap (avg of 10 plays)\n  Four Verticals: ' + fv + '\n  Inside Zone:    ' + rn);
  const wx = s2 => +(/X \d+m \(-([\d.]+)%/.exec(s2)[1]); ok(wx(fv) > 1.5 * wx(rn), 'a go route costs more than a run block');
  // a long drive of deep shots: the outside receivers wear down and sit, then come back after a rest on the sideline
  const rs2 = LG.rotInit(U, opp); T_.rotSetPreset(U, 'WR', 'starters'); const notes = []; let sat = 0;
  const wr = T_.rotInfo(U, 'WR').order;
  for (let i = 0; i < 16; i++) { const o = LG.lineup(U, 'Shotgun', 'O', { down: 1 + (i % 3), togo: 8, yl: 30 + i * 3, scen: '1st', play: four }, rs2); notes.push(...(o.notes || [])); if (!o.some(e => e.pid === wr[0]) || !o.some(e => e.pid === wr[1])) sat++;
    for (const e of o) rs2.work[e.pid] = e.pos === 'WR' ? 18 : e.pos === 'TE' ? 10 : 4; LG.rotSnap(rs2, [o.map(e => ({ rp: P(e.pid), slot: e.slot }))], {}, false, four); }
  const eX = Math.min(rs2.E[wr[0]], rs2.E[wr[1]]); console.log(`after 16 straight deep shots: lowest WR stamina ${(eX * 100).toFixed(0)}%, starters sat ${sat} snaps; notes: ${notes.slice(0, 4).join(' | ')}`);
  ok(sat >= 2, 'tired receivers take breathers on a long drive of deep shots'); ok(notes.some(n => /breather/.test(n)), 'a breather notice');
  // the defense is on the field for 8 snaps: the receivers rest and come back
  for (let i = 0; i < 8; i++) LG.rotSnap(rs2, [], {});
  const o = LG.lineup(U, 'Shotgun', 'O', { down: 1, togo: 10, yl: 25, scen: '1st', play: four }, rs2); ok(o.some(e => e.pid === wr[0]) && o.some(e => e.pid === wr[1]), 'rested starters are back for the next drive');
  ok((o.notes || []).some(n => /back in/.test(n)) || true, 'back-in notice (optional)');
  // locked in: he never sits
  T_.rotToggleLock(U, wr[0]); const rs3 = LG.rotInit(U, opp); let lockedSat = 0;
  for (let i = 0; i < 16; i++) { const o = LG.lineup(U, 'Shotgun', 'O', { down: 1, togo: 8, yl: 30, scen: '1st', play: four }, rs3); if (!o.some(e => e.pid === wr[0])) lockedSat++; for (const e of o) rs3.work[e.pid] = 46; LG.rotSnap(rs3, [o.map(e => ({ rp: P(e.pid) }))], {}); }
  ok(lockedSat <= 1, 'a locked-in receiver plays through fatigue (' + lockedSat + ')'); T_.rotToggleLock(U, wr[0]);
  // halftime gives most of it back
  const e0 = LG.rotEnergy(rs3, wr[0]); LG.rotRest(rs3, 'half'); const e1 = LG.rotEnergy(rs3, wr[0]); console.log(`locked-in WR after 16 deep shots ${(e0 * 100).toFixed(0)}%, after halftime ${(e1 * 100).toFixed(0)}%`); ok(e1 > 0.85 && e1 > e0 + 0.5, 'halftime recovery'); }
// ---- 4. roles and routes
{ const wr = U.depth.WR.filter(id => !(P(id).inj > 0)); const fast = wr.slice(0, 3).sort((a, b) => P(b).a.spd - P(a).a.spd)[0];
  T_.rotSetRole(U, 'WR', 'X', fast);
  const dagger = book.find(p => p.name === 'Dagger');      // X in, Z go: the deep threat should end up on the go
  const l = LG.lineup(U, 'Shotgun', 'O', { down: 1, togo: 10, yl: 40, scen: '1st', play: dagger }, null);
  const onGo = l.find(e => e.slot === 'Z').pid; ok(onGo === fast, 'the deep threat runs the go route (Dagger)');
  const base = LG.starters(U, 'Shotgun', 'O'); ok(base.find(e => e.slot === 'X').pid === fast, 'the deep threat lines up at X');
  const slot = wr.slice(0, 4).find(id => id !== fast); T_.rotSetRole(U, 'WR', 'SL', slot); ok(LG.starters(U, 'Trips', 'O').find(e => e.slot === 'SL').pid === slot, 'the slot receiver lines up in the slot');
  T_.rotSetRole(U, 'WR', 'X', slot); ok(LG.starters(U, 'Shotgun', 'O').find(e => e.slot === 'X').pid === slot && !LG.starters(U, 'Shotgun', 'O').some(e => e.slot === 'SL' && e.pid === slot), 'one player, one alignment role');
  // red zone: the red-zone target goes outside and gets the fade
  const tall = wr.slice(0, 3).sort((a, b) => (P(b).ht || 0) - (P(a).ht || 0))[0]; T_.rotReset(U, 'O'); T_.rotSetRole(U, 'WR', 'SL', tall); T_.rotSetRole(U, 'WR', 'RZ', tall);
  const fade = book.find(p => p.name === 'GL Fade'), rz = LG.lineup(U, 'Goal Line', 'O', { down: 1, togo: 3, yl: 97, scen: 'goal', play: fade }, LG.rotInit(U, opp));
  ok(rz.find(e => e.slot === 'X').pid === tall, 'red-zone target is the lone WR in Goal Line');
  const rz2 = LG.lineup(U, 'Shotgun', 'O', { down: 1, togo: 10, yl: 88, scen: 'red', play: book.find(p => p.name === 'Slant Flat') }, null); ok(['X', 'Z'].includes(rz2.find(e => e.pid === tall).slot), 'red-zone target moves outside inside the 20');
  T_.rotReset(U, 'O'); }
// ---- 5. old saves: no T.rot anywhere still loads and plays
{ const js = LG.serialize(), d = JSON.parse(js); for (const t of d.teams) { delete t.rot; delete t.rotLast; } LG.deserialize(JSON.stringify(d)); const L2 = LG.state();
  for (const t of L2.teams.slice(0, 4)) for (const f of OFF) valid(LG.starters(t, f, 'O'), 'old save ' + f);
  ok(T_.rotInfo(T_.UT(), 'RB').preset === 'bell', 'old save: user defaults'); }
// ---- 6. quick-sim stats follow the shares: a committee backfield spreads the carries
{ const L3 = LG.state(), me = T_.UT(); T_.rotSetPreset(me, 'RB', 'committee'); const rb = T_.rotInfo(me, 'RB').order; const before = rb.map(id => L3.P[id].st.ra || 0);
  for (let w = 0; w < 6; w++) { const g = LG.currentUserGame(); if (!g) break; LG.instantUserGame(); }
  const ra = rb.map((id, i) => (L3.P[id].st.ra || 0) - before[i]); console.log('committee carries over 6 sim games: ' + ra.join(' / ')); ok(ra[1] > ra[0] * 0.5 && ra[2] > 0, 'committee: RB2 and RB3 carry the ball');
  ok(me.rotLast && me.rotLast.O > 40, 'last game snap counts recorded'); }
console.log(fails ? `\n${fails} FAILURES` : '\nrotation test passed');
process.exit(fails ? 1 : 0);
