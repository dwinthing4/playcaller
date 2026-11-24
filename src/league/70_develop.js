// Player development: XP from snaps and performance, weekly focus, practice plan, position coaches, facilities,
// weekly progression report, morale, captains, redshirts, storylines, film room.
const FACS = { train: ['Training room', 'Shorter injuries'], weight: ['Weight room', 'Bigger strength and power gains'], film: ['Film room', 'More film sessions, bigger lessons'], sc: ['Strength & conditioning', 'Less fatigue in games, fewer injuries'] };
const PCG = { qb: ['QB'], rb: ['RB', 'FB'], wr: ['WR', 'TE'], ol: ['OT', 'OG', 'C'], dl: ['DE', 'DT'], lb: ['LB'], db: ['CB', 'S'], st: ['K', 'P'] };
const PCG_N = { qb: 'Quarterbacks', rb: 'Running backs', wr: 'Receivers', ol: 'Offensive line', dl: 'Defensive line', lb: 'Linebackers', db: 'Secondary', st: 'Special teams' };
const PRACTICE = { pass: { n: 'Passing game', m: { QB: ['tha', 'thp', 'awr'], WR: ['rte', 'cth'], TE: ['rte', 'cth'] } }, run: { n: 'Run game', m: { RB: ['elu', 'btk', 'car'], FB: ['rbk'], OT: ['rbk'], OG: ['rbk'], C: ['rbk'], TE: ['rbk'] } },
  prot: { n: 'Pass protection', m: { OT: ['pbk', 'str'], OG: ['pbk', 'str'], C: ['pbk', 'awr'], RB: ['pbk'] } }, rush: { n: 'Pass rush', m: { DE: ['prs', 'pow', 'bsh'], DT: ['pow', 'bsh', 'prs'], LB: ['prs'] } },
  cover: { n: 'Coverage', m: { CB: ['mcv', 'zcv', 'hnd'], S: ['zcv', 'hnd', 'mcv'], LB: ['zcv'] } }, tackle: { n: 'Tackling', m: { LB: ['tak', 'pur'], S: ['tak', 'pur'], CB: ['tak'], DE: ['tak'], DT: ['tak'] } },
  cond: { n: 'Conditioning', m: { ALL: ['spd', 'acc'] } }, st: { n: 'Special teams', m: { K: ['kpw', 'kac'], P: ['kpw', 'kac'] } } };
function pcGroup(pos) { for (const g in PCG) if (PCG[g].includes(pos)) return g; return 'st'; }
function facOf(T) { T.fac = T.fac || { train: 1, weight: 1, film: 1, sc: 1 }; if (T.fac.sc == null) T.fac.sc = 1; return T.fac; }
function facCost(T, k) { const f = facOf(T)[k]; return f * 4 + (ownerPersona(T) === 'cheap' ? Math.ceil(f * 2) : 0); }
function upgradeFac(k) { const T = UT(), f = facOf(T); const cost = facCost(T, k); if (f[k] >= 5) return { ok: false, msg: 'Already maxed.' }; if (T.coach.pts < cost) return { ok: false, msg: `Need ${cost} coach credits.` }; T.coach.pts -= cost; f[k]++; news(`Upgraded the ${FACS[k][0].toLowerCase()} to level ${f[k]}.`); return { ok: true, msg: 'Upgraded.' }; }
function upgradePC(g) { const T = UT(); const cur = T.pcs[g] || 1, cost = cur * 3; if (cur >= 5) return { ok: false, msg: 'Best coach already hired.' }; if (T.coach.pts < cost) return { ok: false, msg: `Need ${cost} coach credits.` }; T.coach.pts -= cost; T.pcs[g] = cur + 1; news(`Hired a better ${PCG_N[g].toLowerCase()} coach (level ${cur + 1}).`); return { ok: true, msg: 'Hired.' }; }
// ---------- morale ----------
function ensureMor(p) { if (p.mor == null) { p.mor = Math.round(clamp(62 + gauss() * 9, 30, 90)); } p.morLog = p.morLog || []; return p; }
function moodAdd(p, d, why) { if (!p) return; ensureMor(p); p.mor = clamp(p.mor + d, 0, 100); if (why && Math.abs(d) >= 2) { p.morLog.unshift({ y: L.year, w: L.week, d: Math.round(d), why }); if (p.morLog.length > 6) p.morLog.pop(); } }
const moodIcon = m => m >= 75 ? '😀' : m >= 58 ? '🙂' : m >= 42 ? '😐' : m >= 28 ? '🙁' : '😠';
function teamMorale(T) { const st = starterIds(T); let s = 0, n = 0; for (const id of T.roster) { const p = ensureMor(L.P[id]); const w = st.has(id) ? 1 : 0.35; s += p.mor * w; n += w; } let m = Math.round(n ? s / n : 60);
  const cs = (T.captains || []).map(id => L.P[id]).filter(Boolean); if (cs.length) m = Math.round(m * 0.7 + (sum(cs.map(p => p.mor)) / cs.length) * 0.3); return m; }
function moraleAfterGame(T, g, lines) {
  const won = (g.h === T.id && g.hs > g.as) || (g.a === T.id && g.as > g.hs), lost = !won && g.hs !== g.as; const st = starterIds(T);
  for (const id of T.roster) { const p = ensureMor(L.P[id]); const d = k => ((lines[id] || {})[k] || 0); const starter = st.has(id);
    let delta = (won ? 1.5 : lost ? -1.2 : 0) * (starter ? 1 : 0.4);
    if (starter) {
      if (p.pos === 'WR' || p.pos === 'TE') { if (d('tgt') <= 2 && p.ovr >= 72) moodAdd(p, -3.5, 'Barely targeted'); else if (d('recy') >= 90) moodAdd(p, 3, `Big game (${d('recy')} yds)`); }
      if (p.pos === 'RB') { if (d('ra') <= 6 && p.ovr >= 72) moodAdd(p, -3, 'Not enough carries'); else if (d('ry') >= 100) moodAdd(p, 3, `Ran for ${d('ry')}`); }
      if (p.pos === 'QB') { if (d('pint') >= 2) moodAdd(p, -3, `Threw ${d('pint')} INTs`); else if (d('ptd') >= 3) moodAdd(p, 3, `${d('ptd')} TD passes`); }
      if (['DE', 'DT', 'LB'].includes(p.pos) && d('sk') >= 2) moodAdd(p, 3, 'Multi-sack game');
      if (['CB', 'S'].includes(p.pos) && d('int') >= 1) moodAdd(p, 3, 'Picked one off');
    } else { const n = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, OG: 2, C: 1, DE: 2, DT: 2, LB: 3, CB: 3, S: 2 }[p.pos] || 1; if ((T.depth[p.pos] || []).slice(0, n).some(sid => L.P[sid] && L.P[sid].ovr + 3 < p.ovr)) moodAdd(p, -3, 'Upset about sitting behind a worse player'); }
    p.mor = clamp(p.mor + delta + (62 - p.mor) * 0.04, 0, 100);
    if (p.promise) { p.promise--; if (p.promise <= 0) { const ok = p.pos === 'RB' ? d('ra') >= 12 : d('tgt') >= 5; moodAdd(p, ok ? 6 : -12, ok ? 'Promise kept' : 'Promise broken'); } }
    if (p.mor < 30) p.unhappyW = (p.unhappyW || 0) + 1; else p.unhappyW = Math.max(0, (p.unhappyW || 0) - 1);
    if (!p.tradeReq && p.unhappyW >= 3 && p.ovr >= 74) { p.tradeReq = L.year * 100 + L.week; news(`${p.pos} ${p.fn} ${p.ln} has requested a trade.`); inbox('player', `${p.ln} wants a trade`, `${p.pos} ${p.fn} ${p.ln} (${p.ovr}) is unhappy: "${(p.morLog[0] || {}).why || 'I need a change'}." Talk to him, give him a raise, or shop him.`, { actions: [{ label: 'Open player', act: 'player', arg: p.id }] }); }
    if (p.tradeReq && !p.holdout && p.unhappyW >= 6) { p.holdout = true; news(`${p.pos} ${p.fn} ${p.ln} is holding out.`); }
    if (p.holdout && p.mor >= 45) { p.holdout = false; p.tradeReq = 0; news(`${p.fn} ${p.ln} ended his holdout.`); }
    if (p.tradeReq && !p.holdout && p.mor >= 50) p.tradeReq = 0;
  }
  coachMoraleFloor(T);   // coach perk (62_coach.js)
  T.morale = teamMorale(T);
}
function pepTalk(id) { const p = L.P[id]; if (p.pepW === L.year * 100 + L.week) return { ok: false, msg: 'You already talked to him this week.' }; p.pepW = L.year * 100 + L.week; const g = clamp(4 + (UT().coach.mot - 5) * 1.2 + gauss() * 2, 0, 10) * (coachPerk('mot1') ? 1.5 : 1); moodAdd(p, g, 'Talk with the coach'); UT().morale = teamMorale(UT()); return { ok: true, msg: `${p.ln} morale +${Math.round(g)}` }; }
function promiseTouches(id) { const p = L.P[id]; if (p.promise) return { ok: false, msg: 'He is waiting on your last promise.' }; p.promise = 2; moodAdd(p, 7, 'Promised more touches'); return { ok: true, msg: 'Promise made. Deliver in the next two games.' }; }
function giveRaise(id) { const p = L.P[id], T = UT(); const add = Math.round(p.sal * 0.2 * 10) / 10; if (capRoom(T) < add) return { ok: false, msg: 'Not enough cap room.' }; p.base = Math.round((kBase(p) + add) * 10) / 10; syncSal(p); moodAdd(p, 22, 'Got a raise'); if (p.holdout && p.mor >= 45) { p.holdout = false; p.tradeReq = 0; } T.morale = teamMorale(T); return { ok: true, msg: 'Raise given.' }; }
function setCaptain(id) { const T = UT(); T.captains = T.captains || []; const i = T.captains.indexOf(id); if (i >= 0) T.captains.splice(i, 1); else { if (T.captains.length >= 2) T.captains.shift(); T.captains.push(id); moodAdd(L.P[id], 8, 'Named a team captain'); } }
function isRookie(p) { return p.rookieY === L.year; }
function toggleRedshirt(id) { const p = L.P[id]; if (!isRookie(p)) return { ok: false, msg: 'Only rookies can redshirt.' }; p.redshirt = !p.redshirt; fixDepth(UT()); return { ok: true, msg: p.redshirt ? `${p.ln} will redshirt.` : `${p.ln} is active.` }; }
// ---------- XP & weekly development ----------
function devKeys(p) { if (p.focus && p.focus.length) return p.focus; const w = OVR_W[p.pos]; return Object.keys(w).sort((a, b) => w[b] - w[a]).slice(0, 3); }
function setFocus(id, keys) { const p = L.P[id]; p.focus = (keys || []).filter(k => ATTRS.includes(k)).slice(0, 2); }
function growthMult(p, T) { const age = p.age <= 22 ? 1.85 : p.age <= 23 ? 1.6 : p.age <= 25 ? 1.3 : p.age <= 27 ? 1.0 : p.age <= 30 ? 0.55 : 0.25; const curve = devTier(p).m;
  const pc = 1 + 0.1 * (((T.pcs || {})[pcGroup(p.pos)] || 1) - 1); const coach = 0.7 + T.coach.dev * 0.06; const fac = 1 + 0.04 * (facOf(T).train + facOf(T).weight - 2); const mentor = p.mentor && L.P[p.mentor] && L.P[p.mentor].tid === T.id ? 1.15 : 1;
  return age * curve * pc * coach * fac * mentor * coachDevMul(p, T); }
function giveXP(p, T, amt, keys, rep, why) {
  ensurePot(p); p.xp = p.xp || {}; const m = growthMult(p, T); const ks = keys || devKeys(p); const ups = [];
  for (const k of ks) { if (p.a[k] >= p.ap[k]) continue; p.xp[k] = (p.xp[k] || 0) + amt * m / ks.length * rnd(0.7, 1.3); while (p.xp[k] >= 1 && p.a[k] < p.ap[k]) { p.xp[k] -= 1; p.a[k]++; ups.push(k); } }
  if (ups.length) { const o = p.ovr; p.ovr = calcOvr(p); if (rep) rep.up.push({ id: p.id, ks: ups, d: p.ovr - o, why }); }
  return ups;
}
// apply MATCH/sim result for the user's team: snaps + performance -> XP
function applyGameXP(T, snaps, perf) {
  const rep = L.devWeek && L.devWeek.y === L.year && L.devWeek.w === L.week ? L.devWeek : (L.devWeek = { y: L.year, w: L.week, up: [], down: [] });
  for (const id of T.roster) { const p = L.P[id]; if (!p || p.inj > 0) continue; const sn = (snaps && snaps[id]) || 0; const pf = (perf && perf[id]) || { good: 0, bad: 0 };
    const amt = 0.35 * Math.min(1, sn / 50) + 0.06 * clamp((pf.good || 0) - (pf.bad || 0) * 0.5, -3, 8) + (sn === 0 ? 0.05 : 0);
    if (amt > 0) giveXP(p, T, amt, null, rep, sn ? 'game snaps' : 'scout team'); }
}
function practiceWeek(T) {
  const P = L.practicePlan || (L.practicePlan = { focus: 'pass', int: 'normal' }); const F = PRACTICE[P.focus] || PRACTICE.pass; const base = { light: 0.18, normal: 0.32, hard: 0.5 }[P.int] || 0.32;
  const rep = L.devWeek && L.devWeek.y === L.year && L.devWeek.w === L.week ? L.devWeek : (L.devWeek = { y: L.year, w: L.week, up: [], down: [] });
  for (const id of T.roster) { const p = L.P[id]; if (p.holdout || p.inj > 0) continue; const ks = F.m[p.pos] || F.m.ALL; if (!ks) continue; giveXP(p, T, base * (F.m.ALL ? 0.5 : 1), ks, rep, 'practice: ' + F.n.toLowerCase()); }
  const injP = { light: 0, normal: 0.025, hard: 0.08 }[P.int] * (1.2 - facOf(T).train * 0.1);
  if (R() < injP) { const c = T.roster.map(i => L.P[i]).filter(p => (F.m[p.pos] || F.m.ALL) && !p.inj); if (c.length) { const p = pick(c); p.inj = ri(1, 2); p.injType = 'practice tweak'; news(`${p.pos} ${p.fn} ${p.ln} was hurt in practice.`); } }
}
function devWeekReport(T) {
  const rep = L.devWeek && L.devWeek.y === L.year && L.devWeek.w === L.week ? L.devWeek : (L.devWeek = { y: L.year, w: L.week, up: [], down: [] });
  for (const id of T.roster) { const p = L.P[id]; if (p.age >= 31 && R() < 0.07 + (p.age - 31) * 0.03) { const k = pick(['spd', 'acc', 'agi', 'str']); if (p.a[k] > 30) { p.a[k]--; const o = p.ovr; p.ovr = calcOvr(p); rep.down.push({ id, ks: [k], d: p.ovr - o, why: 'age' }); } } }
  if (rep.up.length || rep.down.length) {
    const byP = {}; for (const u of rep.up) { const b = byP[u.id] || (byP[u.id] = { up: [], down: [] }); b.up.push(...u.ks); } for (const u of rep.down) { const b = byP[u.id] || (byP[u.id] = { up: [], down: [] }); b.down.push(...u.ks); }
    const lines = Object.entries(byP).sort((a, b) => b[1].up.length - a[1].up.length).slice(0, 10).map(([id, b]) => { const p = L.P[id]; return `${p.pos} ${p.ln}: ${b.up.length ? '+' + b.up.length + ' (' + [...new Set(b.up)].map(k => ATTR_NAME[k]).join(', ') + ')' : ''}${b.down.length ? ' -' + b.down.length + ' (' + b.down.map(k => ATTR_NAME[k]).join(', ') + ')' : ''}`; });
    L.devHist = L.devHist || []; L.devHist.unshift({ y: L.year, w: L.week, byP }); if (L.devHist.length > 20) L.devHist.pop();
    inbox('coach', `Development report, week ${L.week + 1}`, `Position coaches: ${lines.join('; ')}.`, { actions: [{ label: 'Open development', act: 'go', arg: 'develop' }] });
  }
}
// ---------- storylines ----------
const GOALS = { QB: ['py', [220, 280, 340], 'passing yards'], RB: ['ry', [70, 100, 140], 'rushing yards'], FB: ['ry', [25, 45, 70], 'rushing yards'], WR: ['recy', [60, 95, 130], 'receiving yards'], TE: ['recy', [45, 75, 105], 'receiving yards'], DE: ['sk', [1, 2, 3], 'sacks'], DT: ['sk', [1, 2, 3], 'sacks'], LB: ['tk', [6, 9, 12], 'tackles'], CB: ['pd', [1, 2, 3], 'pass breakups'], S: ['tk', [5, 8, 11], 'tackles'], K: ['fgm', [1, 2, 3], 'field goals'] };
function stories() { L.stories = (L.stories || []).filter(s => s.y === L.year || s.state === 'new'); return L.stories; }
function addStory(s) { if (stories().some(x => x.state !== 'done' && x.type === s.type && x.pid === s.pid)) return; Object.assign(s, { id: 'st' + nid(), y: L.year, w: L.week, state: 'new' }); L.stories.push(s); inbox('player', 'Storyline: ' + s.title, s.text, { actions: [{ label: 'Meet', act: 'go', arg: 'stories' }] }); }
function storyAfterGame(T, lines) {
  for (const s of stories()) if (s.state === 'active') { const p = L.P[s.pid]; if (!p) { s.state = 'done'; continue; } const d = (lines[p.id] || {})[s.goal.k] || 0; const ok = d >= s.goal.v; s.state = 'done'; s.result = ok ? '✓ Goal reached' : '✗ Fell short';
    const lvl = s.goal.lvl; if (ok) { giveXP(p, T, [0.8, 1.4, 2.4][lvl], null, null, 'storyline'); if (lvl === 2) p.pot = clamp(p.pot + 1, p.ovr, 99); moodAdd(p, [5, 8, 12][lvl], 'Hit his goal'); news(`${p.fn} ${p.ln} hit his goal (${d} ${s.goal.lab})!`); } else moodAdd(p, -[3, 4, 6][lvl], 'Missed his goal'); }
  const roster = T.roster.map(id => L.P[id]); const st = starterIds(T);
  const cands = roster.filter(p => { const d = k => (lines[p.id] || {})[k] || 0; return (d('recy') >= 110 || d('ry') >= 120 || d('py') >= 320 || d('sk') >= 2 || d('int') >= 2 || d('tk') >= 11) && (p.ovr < 85 || p.age <= 24) && GOALS[p.pos]; });
  if (cands.length) { const p = pick(cands); addStory({ type: 'breakout', pid: p.id, title: `Breakout watch: ${p.pos} ${p.fn} ${p.ln}`, text: `${p.ln} just had a monster game. Meet with him and set a goal for next week.` }); }
  if (L.week % 4 === 2) for (const pos of ['QB', 'RB', 'WR']) { const d = (T.depth[pos] || []).map(id => L.P[id]); const n = pos === 'WR' ? 3 : 1; const a = d[n - 1], b = d[n]; if (a && b && b.ovr >= a.ovr - 3 && !stories().some(s => s.type === 'battle' && s.pos === pos && s.y === L.year)) { addStory({ type: 'battle', pos, pid: a.id, pid2: b.id, title: `${pos} competition: ${a.ln} vs ${b.ln}`, text: `${b.ln} is pushing ${a.ln} for the job. Name a starter or let them compete.` }); break; } }
  if (L.week === 3 || L.week === 9) for (const v of roster.filter(p => p.age >= 30 && p.ovr >= 78)) { const r = roster.find(p => isRookie(p) && p.pos === v.pos && !p.mentor); if (r) { addStory({ type: 'mentor', pid: r.id, pid2: v.id, title: `Mentorship: ${v.ln} & ${r.ln}`, text: `Veteran ${v.ln} could take rookie ${r.ln} under his wing. Pairing them boosts the rookie's growth all season.` }); break; } }
  const slump = roster.find(p => st.has(p.id) && ensureMor(p).mor < 35 && GOALS[p.pos]); if (slump) addStory({ type: 'slump', pid: slump.id, title: `Slump: ${slump.pos} ${slump.ln}`, text: `${slump.ln} is pressing. A goal and a talk could get him back on track.` });
}
function storyGoal(id, lvl) { const s = stories().find(x => x.id === id); if (!s) return; const p = L.P[s.pid]; const G = GOALS[p.pos]; if (!G) { s.state = 'done'; return; } s.goal = { k: G[0], v: G[1][lvl], lab: G[2], lvl }; s.state = 'active'; moodAdd(p, 2, 'Goal-setting meeting'); }
function storyBattle(id, choice) { const s = stories().find(x => x.id === id); if (!s) return; const T = UT(); const a = L.P[s.pid], b = L.P[s.pid2]; const dl = T.depth[s.pos]; if (!a || !b || a.tid !== T.id || b.tid !== T.id) { s.state = 'done'; s.result = 'No longer relevant'; return; }
  if (choice === 'a') { moodAdd(a, 6, 'Won the starting job'); moodAdd(b, -6, 'Lost the position battle'); } else if (choice === 'b') { const ia = dl.indexOf(a.id), ib = dl.indexOf(b.id); dl[ia] = b.id; dl[ib] = a.id; moodAdd(b, 8, 'Won the starting job'); moodAdd(a, -8, 'Benched'); } else { for (const p of [a, b]) { giveXP(p, T, 0.6, null, null, 'competition'); moodAdd(p, 2, 'Open competition'); } }
  s.state = 'done'; s.result = choice === 'c' ? 'Open competition' : 'Starter named'; }
function storyMentor(id, yes) { const s = stories().find(x => x.id === id); if (!s) return; const r = L.P[s.pid], v = L.P[s.pid2]; if (r && v && yes) { r.mentor = v.id; r.a.awr = clamp(r.a.awr + 2, 10, 99); r.ovr = calcOvr(r); moodAdd(v, 6, 'Mentoring a rookie'); moodAdd(r, 4, 'Learning from a vet'); } s.state = 'done'; s.result = yes ? 'Paired up' : 'Passed'; }
// ---------- film room (from MATCH perf notes) ----------
function closeFilm(perf) { const items = []; for (const id in (perf || {})) { const pf = perf[id]; const p = L.P[id]; if (!p || p.tid !== L.user) continue; for (const n of (pf.notes || [])) items.push({ pid: +id, desc: typeof n === 'string' ? n : n.txt, k: (n && n.k) || null }); }
  L.film = { y: L.year, w: L.week, items: items.slice(0, 10), used: 0 }; }
function filmCap() { return 2 + (facOf(UT()).film || 1) + (coachPerk('str1') ? 1 : 0); }
function coachUp(i) { const F = L.film; if (!F) return { ok: false }; const it = F.items[i]; if (!it || it.done) return { ok: false }; if (F.used >= filmCap()) return { ok: false, msg: `You can review ${filmCap()} plays per week.` };
  const p = L.P[it.pid]; if (!p) return { ok: false }; const ks = it.k ? [it.k] : ['awr']; const ups = giveXP(p, UT(), 0.9, ks, null, 'film'); it.done = true; F.used++; moodAdd(p, 2, 'Extra film work with the coach'); return { ok: true, msg: ups.length ? `${p.ln}: +1 ${ups.map(k => ATTR_NAME[k]).join(', ')}` : `${p.ln} learned from it (progress saved)` }; }
