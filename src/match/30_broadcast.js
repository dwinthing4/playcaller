// ============================================================
//  BROADCAST: the TV package around a match. The live win-probability bar under the scorebug, drive summaries and
//  scoring cards (lower thirds), the halftime card, a two-voice booth as short captions (between plays only), stat
//  plates before a snap, and the stats viewer (win-probability graph, pass chart, run heat map, route charts,
//  receiver separation, team stats) from the pause menu, at halftime and on the final card.
//  Hooks in src/match/10_match.js (one line each): BCAST.step(G, pl) after every physics step (live and sim plays),
//  BCAST.next(G, nextSnap) at the top of nextSnap (may hold the flow for a card; it calls nextSnap itself later),
//  BCAST.frame(G) from hudFrame, BCAST.pause(el.ovl) from the pause menu, BCAST.finalHtml(G) in the final card.
//  Settings (L.settings): comm 'on' | 'big' | 'off', wpbar, bcgfx. The model is src/core/50_wp.js (wpNow).
//  Other code may call BCAST.busy() (a card is up) or BCAST.mute(seconds) (e.g. while a replay plays).
// ============================================================
const BCAST = (() => {
const YDm = typeof YD !== 'undefined' ? YD : 0.9144;
const CREWS = [['Hal Brody', 'Gus Varela'], ['Nina Castell', 'Dex Monroe'], ['Walt Seger', 'Andre Bisset']];
let B = null, el = null, mutedTo = 0;
const has = f => typeof LG !== 'undefined' && typeof LG[f] === 'function';
const P = pid => (pid != null && has('player') ? LG.player(pid) : null);
const now = () => performance.now() / 1000;
const rint = n => Math.floor(Math.random() * n);
const pickR = a => a[rint(a.length)];
const ord = n => ['1st', '2nd', '3rd', '4th'][n - 1] || n + 'th';
const clk = s => { s = Math.max(0, Math.ceil(s - 1e-6)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const qT = q => (q <= 4 ? 'Q' + q : q === 5 ? 'OT' : (q - 4) + 'OT');
const e = s => (typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]));
const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const nw = n => (n >= 0 && n <= 10 ? NUMW[n] : String(n));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function setts() { const L0 = has('state') ? LG.state() : null, S = (L0 && L0.settings) || {}; return { comm: S.comm || 'on', wp: S.wpbar !== false, gfx: S.bcgfx !== false }; }
function lum(h) { const n = parseInt(String(h || '#888888').slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; }
function mix(h, k) { const n = parseInt(String(h || '#888888').slice(1), 16), f = c => Math.round(c + (255 - c) * k); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join(''); }
const lite = h => (lum(h) < 0.2 ? mix(h, 0.38) : h);        // team colours readable on dark plates
const ink = h => (lum(h) > 0.6 ? '#10141c' : '#ffffff');

// ------------------------------------------------------------ per-game state
function bc(G) {
  if (!G) return null;
  if (G.bc) return (B = G.bc);
  const h = G.hid, a = G.aid, seed = ((G.g && (G.g.wk || 0)) * 7 + h * 3 + a) >>> 0, prime = !!(G.g && /night|mon|thu|sun_n|prime/i.test(String(G.g.slot || ''))) || G.playoffs;
  B = G.bc = { plays: [], cur: null, wph: [], key: '', nDr: 0, open: null, sc: { [h]: 0, [a]: 0 }, q: 1, top: { [h]: 0, [a]: 0 }, last: null, third: { [h]: [0, 0], [a]: [0, 0] }, fourth: { [h]: [0, 0], [a]: [0, 0] },
    said: new Set(), used: {}, named: new Set(), q2: [], capEl: null, cap: null, lt: null, ltq: [], hold: null, big: null, t: 0, tLast: now(), pbpN: 0,
    crew: prime ? CREWS[0] : CREWS[1 + seed % 2], intro: false, once: new Set(), lastPlate: -9, lastColor: -9, nPlay: 0, wpShown: null, hw: (typeof PHYS !== 'undefined' && PHYS.FIELD ? PHYS.FIELD.halfW : 24.4) / YDm,
    drives3: { [h]: [], [a]: [] }, sinceColor: 0, pending: null, toN: { [h]: 0, [a]: 0 } };
  wpNow(G); sample(G, 'Kickoff');
  if (el) { el.cap.className = 'bccap'; el.lt.className = 'bclt'; el.big.className = 'bcbig'; el.view.className = 'bcview'; el.big.innerHTML = el.view.innerHTML = ''; }
  return B;
}
const TM = (G, tid) => G.T[tid];
const opp = (G, tid) => (tid === G.hid ? G.aid : G.hid);
const gsec = (G, q, c) => (Math.min(q, 4) - 1) * G.qlen + (G.qlen - c) + (q > 4 ? (q - 4) * G.qlen : 0);
function nm(pid, full) { const p = P(pid); if (!p) return 'him'; if (full || (B && !B.named.has(pid))) { if (B) B.named.add(pid); return `${p.fn} ${p.ln}`; } return p.ln; }
const ln = pid => { const p = P(pid); return p ? p.ln : '—'; };
const short = pid => { const p = P(pid); return p ? `${p.fn ? p.fn[0] + '. ' : ''}${p.ln}` : '—'; };
const st = (G, pid) => (G.st && G.st[pid]) || {};
const tn = (G, tid) => TM(G, tid).name;
function spd(G) { return G.mode === 'watch' ? G.speed || 1 : 1; }
function quietNow(G) { return G.sim || G.over || G.stage === 'load' || spd(G) >= 10 || now() < mutedTo; }

// ------------------------------------------------------------ data from the live play (every physics step)
function step(G, pl) {
  if (!G || !pl || pl.ret || !G.cur) return;
  const b = bc(G); let r = b.cur;
  if (!r || r.pl !== pl) { if (pl.phase !== 'live') return; r = b.cur = newRec(G, pl); }
  if (r.done) return;
  if (pl.phase === 'live') { const t = pl.liveT || 0; if (t >= r.ns) { r.ns = t + 0.2; samplePaths(pl, r); } airWatch(pl, r); }
  else if (pl.phase === 'dead' && pl.result) finishRec(G, pl, r);
}
function newRec(G, pl) {
  const c = G.cur, op = c.op || {}, dp = c.dp || {};
  return { pl, n: B.plays.length, off: c.off, def: c.def, q: G.q, clock: c.clock0, down: c.down0, togo: Math.max(1, Math.round(c.togo0)), yl: Math.round(c.yl0), los: pl.losZ, ns: 0,
    play: op.name || '', ptype: op.type || '', dname: dp.name || '', blitz: !!(dp.blitz && dp.blitz.length), cov: dp.cov || '', two: !!(G.pat && G.pat.two),
    pbp0: G.pbp.length, rt: {}, cpp: {}, cp: [], tgt: null, land: null, sep: null, sepT: 99, air: false, done: false };
}
const ux = (p, b) => Math.round(-p.x / (b.hw * YDm) * 1000) / 1000;
const dy = (z, r) => Math.round((z - r.los) / YDm * 10) / 10;
function samplePaths(pl, r) {
  if (pl.liveT < 4.6 && !(pl.ball && pl.ball.state === 'dead') && !(pl.thrown && pl.ball && pl.ball.state !== 'air')) for (const q of pl.receivers || []) { if (q.unit !== 'O') continue; const a = r.rt[q.pid] || (r.rt[q.pid] = []); if (a.length < 26 ) a.push([ux(q.p, B), dy(q.p.z, r)]); }
  const c = pl.carrier; if (c && c.unit === 'O' && !pl.thrown && !(pl.pass && !pl.scramble && c === pl.qb)) { const a = r.cpp[c.pid] || (r.cpp[c.pid] = []); if (a.length < 40) a.push([ux(c.p, B), dy(c.p.z, r)]); }
}
function airWatch(pl, r) {
  const ba = pl.ball; if (!ba) return;
  if (ba.state === 'air' && pl.thrown && !r.air) { r.air = true; r.tgt = ba.target ? ba.target.pid : null; if (ba.land) r.land = [Math.round(-ba.land.x / (B.hw * YDm) * 1000) / 1000, dy(ba.land.z, r)]; r.airT = ba.T || 1; }
  if (r.air && ba.state === 'air' && r.tgt != null && r.sepT > 0.02) {
    const left = (ba.T || 0) - (ba.t || 0), t = pl.players.find(p => p.pid === r.tgt); if (!t) return;
    let m = 99; for (const d of pl.D || []) { const v = Math.hypot(d.p.x - t.p.x, d.p.z - t.p.z); if (v < m) m = v; }
    r.sep = Math.round(m / YDm * 10) / 10; r.sepT = left;
  }
}
function finishRec(G, pl, r) {
  const s = pl.result; r.done = true; B.cur = null; samplePaths(pl, r);
  const y = Math.round(s.yards || 0);
  r.res = { type: s.type, y, td: !!s.td, to: s.turnover || null, sack: !!s.sack, kind: s.kind, passer: s.passer, catcher: s.catcher, carrier: s.carrier, tk: (s.tacklers || [])[0], air: s.airYds, pr: !!s.pressured, br: s.broken || 0, text: s.text || '', safety: !!s.safety, rec: s.recPid };
  r.cp = r.cpp[s.carrier] || []; delete r.cpp;
  if (r.tgt == null && s.catcher != null && s.kind === 'pass') r.tgt = s.catcher;
  if (s.kind === 'run' && !pl.thrown) r.rt = {};       // route charts: dropbacks only
  B.plays.push(r); B.nPlay++; delete r.pl;
  if (!G.sim) B.pending = r;      // the call is made once the play has been processed (frame)
}
// once the match has judged the play: an accepted flag wipes it from the charts; third and fourth downs are counted
function settle(G, r) {
  if (!r || r.settled) return; r.settled = true;
  const L = G.pbp.slice(r.pbp0 || 0); r.flag = L.some(l => /PENALTY/.test(l) && !/declined/.test(l)) || !!G.penWait; r.flagAny = r.flag || L.some(l => /PENALTY/.test(l));
  const s = r.res, off = r.off, conv = s.td || (!s.to && s.type !== 'inc' && !s.sack && s.y >= r.togo);
  if (!r.two && !r.flag && s) { if (r.down === 3) { B.third[off][0]++; if (conv) B.third[off][1]++; } if (r.down === 4) { B.fourth[off][0]++; if (conv) B.fourth[off][1]++; } }
}

// ------------------------------------------------------------ win probability history
function sample(G, why) {
  const wp = wpNow(G), k = [G.score[G.hid], G.score[G.aid], G.q, Math.round(G.clock), G.poss, Math.round(G.yl), G.down, G.kickNext, G.pat ? 1 : 0].join('|');
  if (k === B.key && why !== 'Final') return; B.key = k;
  const last = B.wph[B.wph.length - 1];
  B.wph.push({ q: G.q, c: Math.round(Math.max(0, G.clock)), wp, d: why || '', s: `${G.score[G.aid]}-${G.score[G.hid]}`, dl: last ? Math.round((wp - last.wp) * 10) / 10 : 0 });
}

// ------------------------------------------------------------ between plays (top of nextSnap)
function next(G, cont) {
  if (!G || G.daily) return false;
  const b = bc(G), q0 = b.q, wasSc = { h: b.sc[G.hid], a: b.sc[G.aid] };
  // time of possession: the clock since the last look goes to the team that had the ball
  const t = gsec(G, G.q, G.clock); if (b.last && b.last.poss != null && t > b.last.t) b.top[b.last.poss] += t - b.last.t; b.last = { t, poss: G.poss };
  // new play-by-play lines: kicks, penalties, kneels
  const newL = G.pbp.slice(b.pbpN); b.pbpN = G.pbp.length;
  const lastLine = newL.length ? newL[newL.length - 1].replace(/^(Q\d|OT|\dOT) [\d:]+ (— )?/, '') : '';
  const r = b.plays.length && !b.plays[b.plays.length - 1].wpSeen ? b.plays[b.plays.length - 1] : null; if (r) r.wpSeen = true;
  const before = b.wph.length ? b.wph[b.wph.length - 1].wp : 50;
  sample(G, r ? descRec(G, r) : lastLine.replace(/^[A-Z]{2,4} \d\w\w&\d+ at [^:]+: /, ''));
  const wpN = b.wph[b.wph.length - 1].wp, swing = wpN - before;
  if (r) { settle(G, r); r.wp = wpN; r.dwp = swing; }
  const quiet = quietNow(G), S = setts();
  if (!quiet) for (const l of newL) lineFromPbp(G, l);
  // drives that ended
  let hold = 0;
  while (G.drives.length > b.nDr) { const d = G.drives[b.nDr++], o = b.open && b.open.tid === d.tid ? b.open : null; d.top = o ? Math.max(0, t - gsec(G, o.q, o.clock)) : null; d.bcq = o ? o.q : d.q;
    b.drives3[d.tid].push(d.result); if (!quiet && S.gfx && d.result !== 'TD' && d.result !== 'FG' && (d.plays >= 1 || /INT|Fumble|Downs/.test(d.result))) queueLT(G, driveHtml(G, d), 'drive', 5.2); }
  if (G.drive && G.drive !== b.open) b.open = G.drive;
  // scores
  for (const tid of [G.hid, G.aid]) { const dlt = G.score[tid] - b.sc[tid]; if (dlt <= 0) continue; b.sc[tid] = G.score[tid]; const lr = b.plays[b.plays.length - 1], tryPts = dlt === 1 || (dlt === 2 && lr && lr.two && lr.off === tid);
    if (!tryPts && !quiet && dlt >= 6) tdLine(G, tid, lr);
    if (!tryPts && !quiet && S.gfx) { queueLT(G, scoreHtml(G, tid, dlt, newL.join(' | ')), 'score', 5.6); hold = Math.max(hold, 2.4); } }
  if (b.lt && b.lt.kind === 'score' && (G.score[G.hid] !== wasSc.h || G.score[G.aid] !== wasSc.a)) refreshScore(G);
  // quarters
  if (G.q !== q0) { b.q = G.q;
    if (q0 === 2 && G.q === 3 && !G.sim && spd(G) < 10) { halftime(G, cont); return true; }
    if (!quiet && G.q <= 4) talk(G, 'pbp', [`That'll do it for the ${['first', 'second', 'third'][q0 - 1] || 'quarter'} quarter. ${scoreLine(G)}.`, `End of the ${['first', 'second', 'third'][q0 - 1]}: ${scoreLine(G)}.`, `${cap(['first', 'second', 'third'][q0 - 1] || 'that')} quarter in the books. ${scoreLine(G)}.`], 2, 'q' + q0);
    if (!quiet && G.q === 5) talk(G, 'pbp', ['We are headed to overtime! Next score wins it.', 'Free football! The next score ends it.'], 3, 'ot');
  }
  if (!quiet) colorBetween(G, r, swing);
  if (!quiet && !b.intro) intro(G);
  if (hold && !G.sim && cont && G.mode === 'watch' && !b.hold) { const sp = spd(G); if (sp < 4) { b.hold = { until: b.t + hold / sp, cont }; return true; } }
  return false;
}
// touchdown milestones: a rookie's first, a big season
function tdLine(G, tid, r) {
  if (!r || !r.res || !r.res.td || r.off !== tid || r.two) return; const pid = r.res.kind === 'pass' && r.res.catcher != null ? r.res.catcher : r.res.carrier, p = P(pid); if (!p) return;
  const s0 = p.st || {}, g = st(G, pid), season = (s0.rtd || 0) + (s0.rectd || 0) + (g.rtd || 0) + (g.rectd || 0), career = season + (p.car ? (p.car.rtd || 0) + (p.car.rectd || 0) : 0), vet = !!(p.hist && p.hist.length);
  if (career === 1 && !vet && (p.age || 30) <= 23) return talk(G, 'col', [`That's the first touchdown of his career! What a moment for the rookie.`, `First career touchdown for ${nm(pid)}. He'll remember that one forever.`], 3, 'td1' + pid);
  if (career === 1 && vet) return talk(G, 'col', [`Believe it or not, that's the first touchdown of his career.`], 3, 'td1' + pid);
  if (season >= 6) return talk(G, 'col', [`That's touchdown number ${season} on the season for ${nm(pid)}.`, `${cap(nw(season))} touchdowns this year for ${nm(pid)}. He's a problem.`], 2, 'tdn' + pid + season);
}
function scoreLine(G) {
  const a = G.score[G.aid], h = G.score[G.hid];
  if (a === h) return pickR([`all tied up at ${a}`, `${a} apiece`, `deadlocked at ${a}`]);
  const lead = a > h ? G.aid : G.hid, hi = Math.max(a, h), lo = Math.min(a, h);
  return pickR([`the ${tn(G, lead)} lead it ${hi} to ${lo}`, `${hi}-${lo}, ${tn(G, lead)}`, `the ${tn(G, lead)} on top ${hi} to ${lo}`]);
}
function descRec(G, r) {
  const s = r.res, T = TM(G, r.off).abbr; if (!s) return '';
  if (r.two) return `${T} two-point try ${s.td ? 'good' : 'fails'}`;
  if (s.to === 'int') return `${short(s.passer)} intercepted${s.carrier != null ? ' by ' + short(s.carrier) : ''}`;
  if (s.type === 'fumbleLost') return `${short(s.carrier)} fumble, lost`;
  if (s.sack) return `${short(s.carrier)} sacked, ${s.y}`;
  if (s.type === 'inc') return `${short(s.passer)} incomplete${r.tgt != null ? ' to ' + short(r.tgt) : ''}`;
  if (s.catcher != null && s.kind === 'pass') return `${short(s.passer)} to ${short(s.catcher)}, ${s.y} yd${s.td ? ' TD' : ''}`;
  return `${short(s.carrier)} ${s.kind === 'scramble' ? 'scramble' : 'run'}, ${s.y} yd${s.td ? ' TD' : ''}`;
}

// ------------------------------------------------------------ the booth
function talk(G, who, list, pri, onceKey) {
  const S = setts(); if (S.comm === 'off' || (S.comm === 'big' && pri < 3)) return false;
  if (onceKey) { if (B.once.has(onceKey)) return false; }
  const fresh = list.filter(x => x && !B.said.has(x)); if (!fresh.length) return false;
  const line = pickR(fresh); B.said.add(line); if (onceKey) B.once.add(onceKey);
  B.q2.push({ who: who === 'pbp' ? 0 : 1, text: line, pri, at: B.t, exp: B.t + (pri >= 3 ? 9 : 6) });
  if (B.q2.length > 4) { B.q2.sort((x, y) => y.pri - x.pri || x.at - y.at); B.q2.length = 4; B.q2.sort((x, y) => x.at - y.at); }
  return true;
}
// the call of the play, made right after the whistle (state already updated by the match)
function callPlay(G, r) {
  const s = r.res, off = r.off, def = r.def, T = tn(G, off), D = tn(G, def), y = s.y, ay = Math.abs(y);
  const first = !s.td && !s.to && s.type !== 'inc' && !s.sack && y >= r.togo, toGoal = 100 - r.yl, late = (G.q === 2 || G.q >= 4) && G.clock <= Math.max(30, G.qlen * 0.3);
  const lead = G.score[off] - G.score[def], fresh = n => nm(n), qid = s.passer != null ? s.passer : s.sack || s.kind === 'scramble' ? s.carrier : depth(TM(G, off), 'QB'), Q = qid != null ? fresh(qid) : 'the quarterback';
  const yds = n => `${n} yard${Math.abs(n) === 1 ? '' : 's'}`;
  let L = [], pri = 2, tail = '';
  if (r.flag) tail = pickR([' But there is a flag down.', ' And we have a flag on the field.', ' Wait, there is laundry on the field.']);
  if (r.two) { L = s.td && !s.to ? [`The two-point try... good! ${T} convert.`, `They go for two and get it!`, `Two-point conversion is good.`] : [`The two-point try fails.`, `No good on the two-point try.`, `Stopped short on the conversion.`]; return talk(G, 'pbp', L.map(x => x + tail), 3); }
  const big = s.td || s.to || ay >= 20 || r.down === 4 || (s.sack && r.down >= 3);
  if (s.to === 'int') { const d = fresh(s.carrier); L = [`Picked off! ${d} jumps the route.`, `${Q} throws... and it's intercepted by ${d}!`, `Intercepted! ${d} reads it all the way.`, `That's a pick. ${d} comes down with it for the ${D}.`]; pri = 3; }
  else if (s.type === 'fumbleLost') { const d = s.rec != null ? fresh(s.rec) : `the ${D}`; L = [`Fumble! And ${d} recovers for the ${D}!`, `The ball is out! ${d} has it, ${D} ball.`, `He coughs it up, and the ${D} take over.`]; pri = 3; }
  else if (s.sack) { const d = s.tk != null ? fresh(s.tk) : `the ${D} front`; L = [`${d} gets home! ${Q} goes down for a loss of ${ay}.`, `Sacked! ${d} brings him down.`, `${Q} has nowhere to go. ${d} with the sack.`, `Pressure, and ${Q} is taken down by ${d}.`]; if (r.down === 3) L = L.map(x => x + ' That will bring out the punt team.'); }
  else if (s.td) { const c = s.carrier != null ? fresh(s.carrier) : 'he';
    L = s.kind === 'pass' && s.catcher != null ? [`${Q} to ${c}... touchdown, ${T}!`, `${Q} finds ${c} in the end zone! Touchdown!`, `${c} hauls it in for six!`, `Pitch and catch, ${Q} to ${c}. Touchdown ${T}!`, `${Q} lofts it... ${c} has it! Touchdown!`]
      : [`${c} punches it in! Touchdown ${T}!`, `${c} walks in from ${ay === 1 ? 'a yard out' : `${ay} out`}. Touchdown!`, `${c} breaks free... he's gone! Touchdown!`, `${c} into the end zone! Six for the ${T}.`];
    if (ay >= 30) L = L.concat(s.kind === 'pass' ? [`${Q} lets it fly... ${c} is behind everybody! ${ay} yards, touchdown!`] : [`${c} is loose! ${ay} yards to the house!`]); pri = 3; }
  else if (s.type === 'inc') { const c = r.tgt != null ? fresh(r.tgt) : null, why = s.text || '';
    L = /away/i.test(why) ? [`${Q} throws it away.`, `Nothing there, and ${Q} sails it out of bounds.`, `${Q} lives to see another down. Thrown away.`]
      : /drop/i.test(why) && c ? [`${c} drops it! That one was right in his hands.`, `Dropped by ${c}. He'll want that one back.`, `Off the hands of ${c}.`]
      : c ? [`${Q} looking for ${c}... incomplete.`, `Incomplete, intended for ${c}.`, `${Q} to ${c}, and it falls incomplete.`, `Broken up! That one was meant for ${c}.`, `${Q} tries ${c}, no connection.`] : [`Incomplete.`, `${Q}'s pass falls incomplete.`];
    if (r.down === 3) L = L.map(x => x + pickR([' That brings up fourth down.', ' Fourth down coming up.', ''])); if (r.down === 4) { L = L.map(x => x + ' Turnover on downs.'); pri = 3; } }
  else { const c = fresh(s.carrier), oob = s.type === 'oob';
    if (s.kind === 'pass' && s.catcher != null) {
      L = ay >= 20 ? [`${Q} goes deep... caught by ${c}! A ${ay}-yard strike.`, `${Q} launches it and ${c} runs under it! ${cap(yds(ay))}.`, `${c} gets behind them, and ${Q} finds him for ${ay}.`, `Big play! ${Q} to ${c} for ${ay}.`]
        : y <= 0 ? [`${Q} dumps it to ${c}, but he's dropped right there.`, `${c} makes the catch and is swarmed for ${y < 0 ? 'a loss' : 'no gain'}.`]
        : [`${Q} finds ${c} for ${ay}.`, `Quick throw to ${c}, ${yds(ay)}.`, `${c} hauls it in, picks up ${ay}.`, `${Q} hits ${c} over the middle for ${ay}.`, `Complete to ${c}, ${yds(ay)}.`, `${Q} on the money to ${c}. ${cap(yds(ay))}.`, `${c} with the grab for ${ay}.`];
    } else if (s.kind === 'scramble') L = [`${Q} takes off... picks up ${ay}.`, `${Q} pulls it down and runs for ${ay}.`, `Nobody open, so ${Q} uses his legs. ${cap(yds(ay))}.`];
    else L = ay >= 20 ? [`${c} breaks into the open! ${ay} yards!`, `${c} finds a crease and he's gone for ${ay}.`, `Huge run by ${c}! ${cap(yds(ay))}.`]
      : y < 0 ? [`${c} is stopped behind the line.`, `${c} hit in the backfield, a loss of ${ay}.`, `Nowhere to go for ${c}. Loss of ${ay}.`]
      : y === 0 ? [`${c} is stuffed. No gain.`, `${c} runs into a wall. Nothing there.`]
      : [`${c} up the middle for ${ay}.`, `${c} carries for ${ay}.`, `${c} picks up ${ay} on the ground.`, `${c} slashes ahead for ${ay}.`, `Handoff to ${c}, ${yds(ay)}.`, `${c} grinds out ${ay}.`];
    let add = '';
    if (first && r.down === 4) { add = pickR([' They get it on fourth down!', ' Gutsy call, and it works.', ' Fourth-down conversion!']); pri = 3; }
    else if (first && r.down === 3) add = pickR([' And they convert on third down.', ' That keeps the drive alive.', ' Moves the chains on third down.']);
    else if (first) add = pickR([` And that's a first down.`, ' That moves the chains.', ` First down ${T}.`, ' Enough for the first.']);
    else if (r.down === 4) { add = pickR([' Short! Turnover on downs.', ' Stopped short on fourth down.']); pri = 3; }
    else if (r.down === 3) add = pickR([` Short of the sticks. Fourth and ${Math.max(1, r.togo - y)}.`, ' Not enough. That brings up fourth down.', '']);
    if (!first && r.yl + y >= 80 && r.yl < 80) add += pickR([` ${T} knocking on the door.`, ' Inside the 20 now.', ' Into the red zone.']);
    else if (first && r.yl + y >= 90) add += ' First and goal.';
    if (late && oob) add += pickR([' And he gets out of bounds to stop the clock.', ' Out of bounds, clock stops.', ' Smart, he gets out of bounds.']);
    else if (late && lead < 0 && !oob && !first) add += pickR([' Stays in bounds, and the clock is running.', ' The clock keeps running.']);
    L = L.map(x => x + add);
  }
  if (!L.length) return false;
  return talk(G, 'pbp', L.map(x => x + tail), big ? 3 : pri);
}
// the analyst, right after the call: what the play showed
function colorAfter(G, r) {
  const s = r.res; if (!s || r.two || r.flag) return;
  const off = r.off, Qn = ln(s.passer != null ? s.passer : s.sack ? s.carrier : depth(TM(G, off), 'QB'));
  if (s.to === 'int' && s.passer != null) return talk(G, 'col', [`He stared that one down, and the defense read it the whole way.`, `You can't throw late over the middle like that. ${Qn} will want it back.`, `Great break on the ball. That's film-room work.`, `That's a costly mistake for ${Qn}.`], 2);
  if (s.sack && r.blitz) return talk(G, 'col', [`They brought one more than the ${tn(G, off)} could block.`, `The blitz got there clean. Nobody picked it up.`], 2);
  if (s.sack) return talk(G, 'col', [`Four-man rush, and they still got home. That's winning up front.`, `${Qn} held it too long there.`, `Look at the edge. The tackle just got beat.`], 1);
  if (s.type === 'inc' && s.pr) return talk(G, 'col', [`He had to get rid of it early. The pocket collapsed on him.`, `Pressure forced that throw.`], 1);
  if (s.kind === 'pass' && s.catcher != null && r.sep != null && r.sep >= 4 && s.y >= 12) return talk(G, 'col', [`Look at the separation there: ${r.sep.toFixed(1)} yards of space at the catch. Nobody near him.`, `Wide open. ${r.sep.toFixed(1)} yards of separation on that one.`, `Coverage bust. He was ${r.sep.toFixed(1)} yards clear.`], 2);
  if (s.kind === 'pass' && s.catcher != null && r.sep != null && r.sep < 1 && s.y >= 6) return talk(G, 'col', [`Tight window! Under a yard of separation, and he still makes the catch.`, `That's a contested catch. The corner was right on him.`], 2);
  if (s.br >= 2 && s.y >= 8) return talk(G, 'col', [`He broke ${nw(s.br)} tackles on that run. That's pure will.`, `Count them: ${nw(s.br)} missed tackles.`], 2);
  if (s.kind === 'run' && s.y >= 15) return talk(G, 'col', [`The line opened a hole you could drive a truck through.`, `Great blocking on the edge, and he hit it full speed.`], 1);
  if (r.dwp != null && Math.abs(r.dwp) >= 15) { const tid = r.dwp > 0 ? G.hid : G.aid, w = Math.round(r.dwp > 0 ? r.wp : 100 - r.wp); return talk(G, 'col', [`That one swings it. The ${tn(G, tid)} are now ${w} percent to win this game.`, `Huge swing: the win probability jumps to ${w} percent for the ${tn(G, tid)}.`], 2); }
}
// between plays: context lines, a stat plate now and then
function colorBetween(G, r, swing) {
  B.sinceColor++;
  if (G.pat || G.kickNext != null || G.clock <= 0) return;
  const off = G.poss, def = opp(G, off), T = tn(G, off), b = B;
  if (b.sinceColor < 3 && !(G.down === 3 && G.togo >= 3)) return;
  const L0 = has('state') ? LG.state() : null, OT = TM(G, off), late = (G.q === 2 || G.q >= 4) && G.clock <= Math.min(G.qlen * 0.3, 120);
  const qb = depth(OT, 'QB'), rb = depth(OT, 'RB'), sq = st(G, qb), sr = st(G, rb), tries = [];
  // two-minute: timeouts and the sideline
  if (late && G.score[off] <= G.score[def] && G.score[def] - G.score[off] <= 8) tries.push(() => G.to[off] === 0 ? talk(G, 'col', [`No timeouts left for the ${T}. Anything in the middle of the field and the clock keeps running. They need to get out of bounds.`, `They're out of timeouts. He's going to need to get out of bounds.`], 2, 'twoMinNo' + G.q) : talk(G, 'col', [`The ${T} have ${nw(G.to[off])} timeout${G.to[off] > 1 ? 's' : ''} left, so they can still work the middle of the field.`, `${cap(nw(G.to[off]))} timeout${G.to[off] > 1 ? 's' : ''} in the pocket for the ${T}. Plenty of time if they're smart.`], 2, 'twoMin' + G.q));
  if (late && G.score[off] > G.score[def]) tries.push(() => talk(G, 'col', [`The ${T} would love to run some clock here. Keep it on the ground, stay in bounds.`, `Now it's about the clock. Every second they burn helps.`], 1, 'kill' + G.q));
  // third down: conversions and tendencies
  if (G.down === 3) { const [a, c] = b.third[off], runs = b.plays.filter(p => p.off === off && p.down === 3 && !p.two && !p.flag), pass = runs.filter(p => p.res && p.res.kind !== 'run').length;
    if (a >= 2) tries.push(() => talk(G, 'col', [`Third and ${Math.max(1, Math.round(G.togo))}. The ${T} are ${nw(c)} for ${nw(a)} on third down today.`, `They're ${c} of ${a} on third down. This is a big one.`], 2, 'third' + a));
    if (runs.length >= 3 && G.togo >= 5 && pass === runs.length) tries.push(() => talk(G, 'col', [`Every third down today, they've thrown it. The ${tn(G, def)} know it's coming.`, `Third and long, and they've passed on all ${nw(runs.length)} third downs. Watch for the blitz.`], 2, 'third3'));
    if (G.togo <= 2) tries.push(() => talk(G, 'col', [`Third and short. You have to like the run here.`, `Short yardage. Who wants it more up front?`], 1)); }
  // a player's day
  if (sq.pa >= 6 && b.nPlay - b.lastPlate >= 7) tries.push(() => { b.lastPlate = b.nPlay; plate(G, qb, 'QB'); return talk(G, 'col', [`${nm(qb)} is ${sq.pc || 0} of ${sq.pa} for ${sq.py || 0} yards${sq.ptd ? ` and ${nw(sq.ptd)} touchdown${sq.ptd > 1 ? 's' : ''}` : ''}.`, `${sq.pc || 0} for ${sq.pa}, ${sq.py || 0} yards so far for ${nm(qb)}.${sq.pint ? ` The ${sq.pint > 1 ? sq.pint + ' picks hurt' : 'pick hurts'}.` : ''}`], 1); });
  if (sr.ra >= 7 && b.nPlay - b.lastPlate >= 7) tries.push(() => { b.lastPlate = b.nPlay; plate(G, rb, 'RB'); return talk(G, 'col', [`${nm(rb)} has ${sr.ry || 0} yards on ${sr.ra} carries. ${((sr.ry || 0) / sr.ra).toFixed(1)} a pop.`, `They keep feeding ${nm(rb)}: ${sr.ra} carries, ${sr.ry || 0} yards.`], 1); });
  const wr = topRec(G, off); if (wr && st(G, wr).rec >= 4 && b.nPlay - b.lastPlate >= 7) tries.push(() => { b.lastPlate = b.nPlay; plate(G, wr, 'REC'); const s = st(G, wr); return talk(G, 'col', [`${nm(wr)} has been the go-to guy: ${nw(s.rec)} catches, ${s.recy || 0} yards.`, `Watch ${nm(wr)}. He's got ${s.rec} grabs for ${s.recy || 0} today.`], 1); });
  // the quarterback's legs: the defense adjusts
  if (G.qbs && typeof PHYS !== 'undefined' && PHYS.qbScout) { const k = (PHYS.qbScout.read(G.qbs, G.playN || 0) || { k: 0 }).k; if (k >= 0.4) tries.push(() => talk(G, 'col', [`The ${tn(G, def)} have seen enough of ${ln(qb)} running. The ends are staying home now, and there's a spy on him.`, `Watch the defense adjust to the scrambles: contain on the edges, a linebacker shadowing ${ln(qb)}.`], 2, 'spy')); }
  // drives: three-and-outs, scoring streaks
  const d3 = b.drives3[def]; if (d3.length >= 2 && d3.slice(-2).every(x => x === 'Punt')) tries.push(() => talk(G, 'col', [`The ${tn(G, def)} offense has punted on back-to-back drives. Their defense needs a breather.`, `Two straight punts for the ${tn(G, def)}. Momentum is shifting.`], 1, 'punts' + d3.length));
  const o3 = b.drives3[off]; if (o3.length >= 2 && o3.slice(-2).every(x => x === 'TD' || x === 'FG')) tries.push(() => talk(G, 'col', [`The ${T} have scored on ${o3.slice(-3).every(x => x === 'TD' || x === 'FG') && o3.length >= 3 ? 'three' : 'two'} straight drives. The ${tn(G, def)} have no answer.`, `Points on back-to-back drives for the ${T}. They're rolling.`], 1, 'scoreRun' + o3.length));
  // the stadium: weather, crowd, the trip
  if (G.wx && G.q <= 2) tries.push(() => weatherLine(G));
  if (G.noise > 0.55 && off !== G.hid) tries.push(() => talk(G, 'col', [`Listen to this crowd. The ${T} line is going to have trouble hearing the snap count.`, `It is loud in here. Watch the ${T} offensive line, they'll be looking at the ball.`], 1, 'crowd'));
  if (G.q === 1 && typeof geoTravel === 'function' && G.g) tries.push(() => travelLine(G));
  // the league: streaks, leaders, a revenge game
  if (G.q <= 2 && L0) tries.push(() => leagueLine(G, L0));
  if (swing && Math.abs(swing) >= 18 && r && r.res) tries.push(() => talk(G, 'col', [`Win probability says that was the biggest play of the game so far.`, `That changes everything. The numbers swing ${Math.round(Math.abs(swing))} points.`], 1, 'swing'));
  for (let i = 0; i < 2 && tries.length; i++) { const k = rint(tries.length), f = tries.splice(k, 1)[0]; if (f()) { b.sinceColor = 0; return; } }
}
function depth(T, pos) { return has('depthPick') ? LG.depthPick(T, pos, 0) : null; }
function topRec(G, tid) { const ids = new Set(TM(G, tid).roster || []); let best = null, bv = 0; for (const pid in G.st) if (ids.has(+pid) && (G.st[pid].recy || 0) > bv) { bv = G.st[pid].recy; best = +pid; } return best; }
function weatherLine(G) {
  const w = G.wx, m = w.wind ? w.wind.mph : 0;
  if (w.dome) return talk(G, 'col', [`Perfect conditions under the roof today. No excuses for the kickers.`, `Climate controlled in here. Fast track, no wind.`], 1, 'wx');
  if (w.weather === 'snow') return talk(G, 'col', [`Snow coming down now. Footing is going to be a problem for the receivers.`, `This is football weather. Ball security matters even more in the snow.`], 1, 'wx');
  if (w.weather === 'rain') return talk(G, 'col', [`It's wet out there. The ball gets slick, and so does the grass.`, `Rain is falling. Watch the snaps and the handoffs.`], 1, 'wx');
  if (m >= 14) return talk(G, 'col', [`The wind is a factor today, ${m} miles an hour. That's going to affect the kicking game.`, `${m}-mile-an-hour wind. You'd rather have it at your back in the fourth.`], 1, 'wx');
  if (w.temp <= 32) return talk(G, 'col', [`${w.temp} degrees at kickoff. Bitter cold, and the ball feels like a rock.`, `It's frigid, ${w.temp} degrees. Hands are going to sting on every catch.`], 1, 'wx');
  if (w.temp >= 88) return talk(G, 'col', [`${w.temp} degrees down on the field. Conditioning is going to matter late.`, `It's hot. Watch how both teams rotate their linemen in this heat.`], 1, 'wx');
  return false;
}
function travelLine(G) {
  let t = null; try { t = geoTravel(G.g, G.aid); } catch (x) { t = null; } if (!t || t.atHome) return false;
  const A = tn(G, G.aid);
  if (t.bodyClock && t.body < 11) return talk(G, 'col', [`The ${A} flew ${t.miles.toLocaleString('en-US')} miles for this one, and their body clocks say it's still morning.`, `Early start for the ${A} body clock. That's a real factor on a long trip.`], 1, 'trip');
  if (t.miles >= 1500) return talk(G, 'col', [`Long trip for the ${A}: ${t.miles.toLocaleString('en-US')} miles${Math.abs(t.tz) ? ` and ${nw(Math.abs(t.tz))} time zone${Math.abs(t.tz) > 1 ? 's' : ''}` : ''}.`, `The ${A} came ${t.miles.toLocaleString('en-US')} miles. Watch their legs in the second half.`], 1, 'trip');
  if (t.alt > 3000) return talk(G, 'col', [`Thin air up here. Visiting teams always feel it in the fourth quarter.`, `Altitude is real. The ${A} will be sucking wind late.`], 1, 'trip');
  return false;
}
function leagueLine(G, L0) {
  const out = [];
  for (const tid of [G.aid, G.hid]) { const T = TM(G, tid), n = streak(L0, tid); if (Math.abs(n) >= 3) out.push(() => talk(G, 'pbp', n > 0 ? [`The ${T.name} come in having won ${nw(n)} straight.`, `${cap(nw(n))} wins in a row for the ${T.name}.`] : [`The ${T.name} have dropped ${nw(-n)} in a row. They need this one.`], 1, 'streak' + tid)); }
  for (const tid of [G.aid, G.hid]) for (const pos of ['QB', 'RB', 'WR']) { const pid = depth(TM(G, tid), pos), p = P(pid); if (!p || !p.hist || !p.hist.length) continue; const yrs = p.hist.filter(h => h.t === opp(G, tid)).length;
    if (yrs) out.push(() => talk(G, 'col', [`${nm(pid)} spent ${nw(yrs)} season${yrs > 1 ? 's' : ''} with the ${tn(G, opp(G, tid))}. You know he circled this one on the calendar.`, `Revenge game for ${nm(pid)}, facing his old team.`], 1, 'rev' + pid)); }
  const lead = leaders(L0, G); for (const x of lead) out.push(() => talk(G, 'pbp', [`${nm(x.pid)} came in leading the league with ${x.v} ${x.lab}.`, `Nobody in the league has more ${x.lab} than ${nm(x.pid)}: ${x.v}.`], 1, 'lead' + x.pid));
  if (!out.length) return false; return out[rint(out.length)]();
}
function streak(L0, tid) { const R0 = (L0.results || []).filter(r => r.y === L0.year && !r.po && (r.h === tid || r.a === tid)); let n = 0; for (let i = R0.length - 1; i >= 0; i--) { const r = R0[i], w = (r.h === tid ? r.hs - r.as : r.as - r.hs); const s = w > 0 ? 1 : w < 0 ? -1 : 0; if (!s || (n && Math.sign(n) !== s)) break; n += s; } return n; }
function leaders(L0, G) {
  if (B.lead) return B.lead; B.lead = [];
  const ids = new Set((TM(G, G.hid).roster || []).concat(TM(G, G.aid).roster || [])), best = { py: [0, null], ry: [0, null], recy: [0, null], sk: [0, null] };
  for (const id in L0.P) { const p = L0.P[id], s = p.st; if (!s || !s.gp || p.tid == null) continue; for (const k in best) if ((s[k] || 0) > best[k][0]) best[k] = [s[k], p.id]; }
  const lab = { py: 'passing yards', ry: 'rushing yards', recy: 'receiving yards', sk: 'sacks' };
  for (const k in best) if (best[k][1] != null && ids.has(best[k][1]) && best[k][0] >= (k === 'sk' ? 3 : 150)) B.lead.push({ pid: best[k][1], v: Math.round(best[k][0]), lab: lab[k] });
  return B.lead;
}
function intro(G) {
  B.intro = true; const A = TM(G, G.aid), H = TM(G, G.hid), [p1, p2] = B.crew, rec = T => (T.w != null && T.w + T.l + (T.tie || 0) > 0 ? ` (${T.w}-${T.l}${T.tie ? '-' + T.tie : ''})` : '');
  talk(G, 'pbp', [`${A.name}${rec(A)} at ${H.name}${rec(H)}. I'm ${p1}, alongside ${p2}.`, `Welcome to ${H.city}! ${A.name} and ${H.name}. ${p1} here with ${p2}.`, `It's ${A.name} at ${H.name}${G.playoffs ? ', win or go home' : ''}. ${p1} and ${p2} with you.`], 3);
}
function lineFromPbp(G, l) {
  let m;
  if ((m = /([A-Z]{2,4}) (\d+)-yd field goal (GOOD|no good)/.exec(l))) { const tid = abbrTid(G, m[1]), k = tid != null ? depth(TM(G, tid), 'K') : null, d = +m[2], kn = k != null ? nm(k) : 'The kick';
    return talk(G, 'pbp', m[3] === 'GOOD' ? [`${kn} from ${d}... it's good!`, `${kn} drills it from ${d} yards.`, `The ${d}-yarder is good.`, `Right down the middle from ${d}.`].concat(d >= 50 ? [`${kn} from ${d}... it has the distance! It's good!`] : []) : [`${kn} from ${d}... no good!`, `The ${d}-yard try is no good.`, `${kn} misses from ${d}.`], d >= 48 || m[3] !== 'GOOD' ? 3 : 2); }
  if ((m = /([A-Z]{2,4}) punts (\d+) yds/.exec(l)) && +m[2] >= 50) { const tid = abbrTid(G, m[1]), p = tid != null ? depth(TM(G, tid), 'P') : null; return talk(G, 'pbp', [`${p != null ? nm(p) : 'He'} booms it, ${m[2]} yards.`, `What a punt. ${m[2]} yards.`, `${p != null ? nm(p) : 'The punter'} flips the field with a ${m[2]}-yarder.`], 1); }
  if ((m = /PENALTY ([A-Z]{2,4}): (Offside|Encroachment|Neutral zone[^,(]*)/.exec(l)) && G.hcPl && G.hcPl === G.play) { const tid = abbrTid(G, m[1]); return talk(G, 'col', [`The hard count gets them! The ${tid != null ? tn(G, tid) : 'defense'} jump, and that's a free five yards.`, `That's veteran stuff. A hard count, and they bite.`], 3); }
  if ((m = /PENALTY ([A-Z]{2,4}): ([^(,]+)/.exec(l))) { const tid = abbrTid(G, m[1]); if (tid == null) return; const n = (G.pen && G.pen[tid] ? G.pen[tid].n : 0); if (n >= 3 && !/declined/.test(l)) return talk(G, 'col', [`That's ${nw(n)} penalties on the ${tn(G, tid)} already. They're beating themselves.`, `Another flag on the ${tn(G, tid)}. That's ${nw(n)} today.`], 1, 'pen' + tid + n); }
  if (/kneels/.test(l)) return talk(G, 'pbp', [`And the quarterback takes a knee.`, `Victory formation.`, `He'll take a knee and let the clock run.`], 2);
}
function abbrTid(G, a) { return TM(G, G.hid).abbr === a ? G.hid : TM(G, G.aid).abbr === a ? G.aid : null; }

// ------------------------------------------------------------ lower thirds (drive summary, scoring card, stat plate)
function queueLT(G, html, kind, dur) { const b = B; if (kind === 'score') b.ltq = b.ltq.filter(x => x.kind !== 'drive'); b.ltq.push({ html, kind, dur, at: b.t, exp: b.t + (kind === 'plate' ? 4 : 14) }); if (b.ltq.length > 3) b.ltq.shift(); }
const RES = { TD: 'Touchdown', FG: 'Field goal', 'Missed FG': 'Missed FG', Punt: 'Punt', INT: 'Interception', Fumble: 'Fumble', Downs: 'Turnover on downs', Safety: 'Safety', 'End of half': 'End of half', 'End of game': 'End of game', 'End of regulation': 'End of regulation', kick: 'Fumbled kick', Onside: 'Onside kick' };
function logoCv(T, n) { return typeof logoC === 'function' ? logoC(T, n) : ''; }
function teamVars(T) { const c = lite(T.c1 || '#445566'); return `--bcc:${T.c1};--bcl:${c};--bci:${ink(T.c1)}`; }
function spotOf(G, tid, yl) { const y = Math.round(yl); return y === 50 ? 'Midfield' : y < 50 ? `Own ${y}` : `${TM(G, opp(G, tid)).abbr} ${100 - y}`; }
function driveHtml(G, d) {
  const T = TM(G, d.tid), res = RES[d.result] || d.result, bad = /INT|Fumble|Downs|Safety|Missed/.test(d.result);
  return `<div class="bclt-d" style="${teamVars(T)}"><div class="bclt-h">${logoCv(T, 28)}<b>${e(T.abbr)}</b><span>Drive summary</span><em class="${bad ? 'bad' : ''}">${e(res)}</em></div>
    <div class="bclt-n"><div><b>${d.plays}</b><span>Plays</span></div><div><b>${d.yds}</b><span>Yards</span></div><div><b>${d.top != null ? clk(d.top) : '—'}</b><span>Time</span></div><div><b>${e(spotOf(G, d.tid, d.start))}</b><span>Start</span></div></div></div>`;
}
function scoreHtml(G, tid, pts, line) {
  const T = TM(G, tid), d = G.drives[G.drives.length - 1], dr = d && d.tid === tid && (d.result === 'TD' || d.result === 'FG') ? d : null, r = B.plays[B.plays.length - 1];
  const what = pts >= 6 ? 'Touchdown' : pts === 3 ? 'Field goal' : pts === 2 ? 'Safety' : 'Score';
  let who = '';
  if (pts >= 6 && r && r.res && r.res.td && r.off === tid && !r.two) who = r.res.kind === 'pass' && r.res.catcher != null ? `${short(r.res.catcher)} ${Math.abs(r.res.y)}-yd pass from ${short(r.res.passer)}` : `${short(r.res.carrier)} ${Math.abs(r.res.y)}-yd ${r.res.kind === 'scramble' ? 'run' : 'run'}`;
  else if (pts === 3) { const m = /(\d+)-yd field goal/.exec(line || ''), k = depth(T, 'K'); who = `${k != null ? short(k) : 'Kick'} ${m ? m[1] + '-yd ' : ''}field goal`; }
  else who = (line || '').replace(/\(.*\)/, '').replace(/^[A-Z]{2,4} /, '').trim();
  B.scTid = tid;
  return `<div class="bclt-s" style="${teamVars(T)}"><div class="bclt-sb">${logoCv(T, 40)}<div><span>${e(T.city || '')} ${e(T.name)}</span><b>${what}</b></div></div>
    <div class="bclt-sw"><div class="bclt-who">${e(who)}</div>${dr ? `<div class="bclt-dr">${dr.plays} plays · ${dr.yds} yds${dr.top != null ? ' · ' + clk(dr.top) : ''}</div>` : ''}<div class="bclt-sc">${scoreTxt(G)}</div></div></div>`;
}
function scoreTxt(G) { const A = TM(G, G.aid), H = TM(G, G.hid); return `<i style="background:${lite(A.c1)}"></i>${e(A.abbr)} <b>${G.score[G.aid]}</b><i style="background:${lite(H.c1)}"></i>${e(H.abbr)} <b>${G.score[G.hid]}</b>`; }
function refreshScore(G) { const s = el && el.lt.querySelector('.bclt-sc'); if (s) s.innerHTML = scoreTxt(G); }
function plate(G, pid, kind) {
  const p = P(pid), s = st(G, pid); if (!p || setts().gfx === false) return; const T = TM(G, p.tid != null && G.T[p.tid] ? p.tid : G.poss);
  const cells = kind === 'QB' ? [[`${s.pc || 0}/${s.pa || 0}`, 'Comp'], [s.py || 0, 'Yds'], [s.ptd || 0, 'TD'], [s.pint || 0, 'Int']] : kind === 'RB' ? [[s.ra || 0, 'Car'], [s.ry || 0, 'Yds'], [((s.ry || 0) / Math.max(1, s.ra || 1)).toFixed(1), 'Avg'], [s.rtd || 0, 'TD']] : [[s.rec || 0, 'Rec'], [s.recy || 0, 'Yds'], [s.tgt || 0, 'Tgt'], [s.rectd || 0, 'TD']];
  queueLT(G, `<div class="bclt-p" style="${teamVars(T)}"><div class="bclt-pn"><span>#${p.num || ''} ${e(p.pos)}</span><b>${e(p.fn ? p.fn[0] + '. ' : '')}${e(p.ln)}</b></div><div class="bclt-n">${cells.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div></div>`, 'plate', 4.2);
}

// ------------------------------------------------------------ the halftime card (holds the flow; tap or wait)
function halftime(G, cont) {
  ensureEl(); const b = B, sp = spd(G), dur = G.mode === 'play' ? 12 : Math.max(2.5, 7 / sp);
  b.big = { kind: 'half', until: b.t + dur, cont };
  el.big.innerHTML = `<div class="bcc cx-sheet"><div class="bcc-hd"><span>Halftime</span><b>${scoreBig(G)}</b></div>${wpGraph(G, { h: 108 })}${teamStatsHtml(G, true)}${scoringList(G)}
    <div class="bcc-ft"><button class="on" data-bc="view">All charts</button><button class="pri on" data-bc="go">Second half</button></div></div>`;
  el.big.className = 'bcbig on show'; paint(el.big); talk(G, 'pbp', [`That's halftime. ${cap(scoreLine(G))}.`, `We go to the break with ${scoreLine(G)}.`], 3);
}
function closeBig(run) { if (!B || !B.big) return; const c = B.big.cont; B.big = null; if (el) { el.big.className = 'bcbig'; el.big.innerHTML = ''; } if (run && c) c(); }
function scoreBig(G) { const A = TM(G, G.aid), H = TM(G, G.hid); return `<i style="background:${lite(A.c1)}"></i>${e(A.abbr)} ${G.score[G.aid]} <em>—</em> ${G.score[G.hid]} ${e(H.abbr)}<i style="background:${lite(H.c1)}"></i>`; }
function scoringList(G) {
  const L = G.pbp.filter(t => /— [A-Z]{2,4} .*\(/.test(t) && !/Timeout/.test(t)).slice(-8); if (!L.length) return '';
  return `<div class="bcc-sl"><h4>Scoring</h4>${L.map(t => { const m = /^(\S+) (\S+) — ([A-Z]{2,4}) (.*) \(([^)]*)\)$/.exec(t); return m ? `<div><span>${e(m[1])} ${e(m[2])}</span><b>${e(m[3])}</b><em>${e(m[4].replace(/, TOUCHDOWN/, ' TD'))}</em><i>${e(m[5])}</i></div>` : ''; }).join('')}</div>`;
}
function teamTot(G, tid) {
  const ids = new Set(TM(G, tid).roster || []); let py = 0, ry = 0, sk = 0, pc = 0, pa = 0, ra = 0;
  for (const pid in G.st) { if (!ids.has(+pid)) continue; const s = G.st[pid]; py += s.py || 0; ry += s.ry || 0; sk += s.sk || 0; pc += s.pc || 0; pa += s.pa || 0; ra += s.ra || 0; }
  const pn = (G.pen && G.pen[tid]) || { n: 0, yds: 0 }, th = B.third[tid];
  return { ty: py + ry, py, ry, pc, pa, ra, fd: G.ts[tid].fd, to: G.ts[tid].to, sk, pen: pn.n, peny: pn.yds, th, top: B.top[tid] };
}
function teamStatsHtml(G, compact) {
  const A = TM(G, G.aid), H = TM(G, G.hid), a = teamTot(G, G.aid), h = teamTot(G, G.hid);
  const rows = [['Total yards', a.ty, h.ty], ['Passing', a.py, h.py], ['Rushing', a.ry, h.ry], ['First downs', a.fd, h.fd], ['3rd down', a.th[1], h.th[1], `${a.th[1]}/${a.th[0]}`, `${h.th[1]}/${h.th[0]}`], ['Turnovers', a.to, h.to, null, null, true], ['Possession', a.top, h.top, clk(a.top), clk(h.top)]];
  if (!compact) rows.push(['Sacks', a.sk, h.sk], ['Penalties', a.peny, h.peny, `${a.pen}-${a.peny}`, `${h.pen}-${h.peny}`, true]);
  const ca = lite(A.c1), ch = lite(H.c1);
  return `<div class="bcts"><div class="bcts-h"><span>${logoCv(A, 22)}${e(A.abbr)}</span><span>${e(H.abbr)}${logoCv(H, 22)}</span></div>${rows.map(([lab, x, y, tx, ty, low]) => { const m = Math.max(1, Math.abs(x) + Math.abs(y)), wa = Math.round(Math.abs(x) / m * 100), wh = Math.round(Math.abs(y) / m * 100), aw = low ? x < y : x > y, hw = low ? y < x : y > x;
    return `<div class="bcts-r"><b class="${aw ? 'w' : ''}">${tx != null ? tx : x}</b><div class="bcts-m"><span>${lab}</span><div><i style="width:${wa}%;background:${ca}"></i><i style="width:${wh}%;background:${ch}"></i></div></div><b class="${hw ? 'w' : ''}">${ty != null ? ty : y}</b></div>`; }).join('')}</div>`;
}

// ------------------------------------------------------------ charts (SVG)
function wpGraph(G, o) {
  o = o || {}; const H = o.h || 120, W = 320, pad = 4, A = TM(G, G.aid), Hm = TM(G, G.hid), pts = (B.wph || []).slice(); if (pts.length < 2) return `<div class="bcwpg empty">Win probability builds as the game goes.</div>`;
  const n = pts.length - 1, X = i => pad + (W - pad * 2) * i / n, Y = v => pad + (H - pad * 2) * (1 - v / 100);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.wp).toFixed(1)}`).join(''), area = `${line}L${X(n).toFixed(1)},${Y(50)}L${X(0)},${Y(50)}Z`;
  const qx = []; for (let i = 1; i < pts.length; i++) if (pts[i].q !== pts[i - 1].q) qx.push([X(i), qT(pts[i].q)]);
  const sw = pts.map((p, i) => ({ i, d: Math.abs(p.dl) })).filter(x => x.d >= 8).sort((x, y) => y.d - x.d).slice(0, o.sw || 3);
  const id = 'bw' + Math.random().toString(36).slice(2, 7), ch = lite(Hm.c1), ca = lite(A.c1);
  const hw = Math.round(pts[n].wp), lead = hw >= 50 ? [Hm, hw, ch] : [A, 100 - hw, ca];
  return `<div class="bcwpg" data-bcg="1"><div class="bcwpg-l"><em>Win probability</em><span><i style="background:${lead[2]}"></i>${e(lead[0].abbr)} ${lead[1]}%</span></div>
  <div class="bcwpg-p"><b class="bcwpg-z t"><i style="background:${ch}"></i>${e(Hm.abbr)}</b><b class="bcwpg-z b"><i style="background:${ca}"></i>${e(A.abbr)}</b><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px"><defs><clipPath id="${id}t"><rect x="0" y="0" width="${W}" height="${Y(50)}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${Y(50)}" width="${W}" height="${H}"/></clipPath></defs>
  <rect class="g-bg" x="0" y="0" width="${W}" height="${H}"/>${[25, 75].map(v => `<line class="g-grid" x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}${qx.map(([x]) => `<line class="g-q" x1="${x}" x2="${x}" y1="0" y2="${H}"/>`).join('')}
  <path d="${area}" clip-path="url(#${id}t)" style="fill:${ch}" class="g-a"/><path d="${area}" clip-path="url(#${id}b)" style="fill:${ca}" class="g-a"/><line class="g-mid" x1="0" x2="${W}" y1="${Y(50)}" y2="${Y(50)}"/>
  <path d="${line}" class="g-ln" vector-effect="non-scaling-stroke"/>
  <line class="g-x" x1="-9" x2="-9" y1="0" y2="${H}" vector-effect="non-scaling-stroke"/></svg>${sw.map((x, k) => `<span class="bcwpg-d" style="left:${(X(x.i) / W * 100).toFixed(1)}%;top:${Y(pts[x.i].wp).toFixed(1)}px">${k + 1}</span>`).join('')}</div>
  <div class="bcwpg-q">${qx.map(([x, l]) => `<span style="left:${(x / W * 100).toFixed(1)}%">${l}</span>`).join('')}</div><div class="bcwpg-tip"></div>
  ${sw.length ? `<div class="bcwpg-k">${sw.map((x, k) => { const p = pts[x.i]; return `<span><b>${k + 1}</b>${qT(p.q)} ${clk(p.c)} · ${e(p.d || 'Play')} <em>${p.dl > 0 ? '+' : '−'}${Math.round(Math.abs(p.dl))} ${e(p.dl > 0 ? Hm.abbr : A.abbr)}</em></span>`; }).join('')}</div>` : ''}</div>`;
}
// field frame: sideline to sideline (offense's right on the right), LOS at depth 0, offense going up
function field(y0, y1, inner, cls) {
  const W = 200, s = W / (2 * (B.hw || 26.65)), H = Math.round((y1 - y0) * s), Y = d => (y1 - d) * s;
  let g = ''; for (let d = Math.ceil(y0 / 5) * 5; d <= y1; d += 5) g += `<line class="${d === 0 ? 'f-los' : 'f-yl'}" x1="0" x2="${W}" y1="${Y(d).toFixed(1)}" y2="${Y(d).toFixed(1)}"/>${d && d % 10 === 0 ? `<text class="f-t" x="3" y="${(Y(d) - 2).toFixed(1)}">${d > 0 ? '+' : ''}${d}</text>` : ''}`;
  return `<svg class="bcf ${cls || ''}" viewBox="0 0 ${W} ${H}"><rect class="f-bg" x="0" y="0" width="${W}" height="${H}"/>${g}<text class="f-t" x="3" y="${(Y(0) - 2).toFixed(1)}">LOS</text>${inner({ X: u => 100 + u * 100, Y, s })}</svg>`;
}
const passes = (G, tid) => B.plays.filter(r => r.off === tid && !r.two && !r.flag && r.res && r.air && r.land);
function passChart(G, tid) {
  const L = passes(G, tid), c = { c: 0, i: 0, x: 0, t: 0 };
  const svg = field(-8, 42, ({ X, Y }) => L.map(r => { const s = r.res, k = s.to === 'int' ? 'x' : s.type === 'inc' ? 'i' : s.td ? 't' : 'c'; c[k === 't' ? 'c' : k]++; if (k === 't') c.t++;
    const x = X(Math.max(-1, Math.min(1, r.land[0]))), y = Y(Math.max(-8, Math.min(42, r.land[1]))), tip = e(`${qT(r.q)} ${ord(r.down)} & ${r.togo} · ${short(s.passer)} → ${r.tgt != null ? short(r.tgt) : 'nobody'}: ${k === 'x' ? 'intercepted' : k === 'i' ? 'incomplete' : s.y + ' yds' + (s.td ? ', TD' : '')}`);
    return k === 'x' ? `<g data-tip="${tip}" class="m-x"><path d="M${x - 4},${y - 4}L${x + 4},${y + 4}M${x + 4},${y - 4}L${x - 4},${y + 4}"/></g>` : `<circle data-tip="${tip}" class="m-${k}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2"/>`; }).join(''));
  return `<div class="bcleg"><span><i class="k-c"></i>${c.c} caught${c.t ? ` (${c.t} TD)` : ''}</span><span><i class="k-i"></i>${c.i} incomplete</span><span><i class="k-x">✕</i>${c.x} INT</span></div>${L.length ? svg : empty('No passes yet')}<p class="bcnote">Where each pass was thrown, from the line of scrimmage. Tap a mark for the play.</p>`;
}
function runMap(G, tid) {
  const L = B.plays.filter(r => r.off === tid && !r.two && !r.flag && r.res && (r.res.kind === 'run' || r.res.kind === 'scramble') && !r.res.sack && r.cp.length), cols = 9, y0 = -4, y1 = 26, rows = 10, cell = {}, dir = { L: [0, 0], M: [0, 0], R: [0, 0] };
  let mx = 1; for (const r of L) { const seen = new Set(); for (const [u, d] of r.cp) { if (d < y0 || d > y1) continue; const k = Math.min(cols - 1, Math.floor((u + 1) / 2 * cols)) + ',' + Math.min(rows - 1, Math.floor((d - y0) / (y1 - y0) * rows)); if (seen.has(k)) continue; seen.add(k); cell[k] = (cell[k] || 0) + 1; mx = Math.max(mx, cell[k]); }
    const cross = r.cp.find(p => p[1] >= 0) || r.cp[r.cp.length - 1], st0 = r.cp[0], du = cross[0] - st0[0], g = du < -0.08 ? 'L' : du > 0.08 ? 'R' : 'M'; dir[g][0]++; dir[g][1] += r.res.y; }
  const svg = field(y0, y1, ({ X, Y }) => { let o = ''; for (const k in cell) { const [c, rw] = k.split(',').map(Number), x0 = X(c / cols * 2 - 1), x1 = X((c + 1) / cols * 2 - 1), ya = Y(y0 + (rw + 1) * (y1 - y0) / rows), yb = Y(y0 + rw * (y1 - y0) / rows); o += `<rect class="m-heat" x="${x0.toFixed(1)}" y="${ya.toFixed(1)}" width="${(x1 - x0 - 1).toFixed(1)}" height="${(yb - ya - 1).toFixed(1)}" style="opacity:${(0.18 + 0.82 * cell[k] / mx).toFixed(2)}" data-tip="${cell[k]} run${cell[k] > 1 ? 's' : ''} went through here"/>`; }
    for (const r of L) o += `<polyline class="m-run" points="${r.cp.map(([u, d]) => `${X(u).toFixed(1)},${Y(Math.max(y0, Math.min(y1, d))).toFixed(1)}`).join(' ')}" data-tip="${e(`${qT(r.q)} ${short(r.res.carrier)}: ${r.res.y} yds`)}"/>`; return o; }, 'heat');
  const dv = k => `<div><b>${dir[k][0] ? (dir[k][1] / dir[k][0]).toFixed(1) : '—'}</b><span>${{ L: 'Left', M: 'Middle', R: 'Right' }[k]} · ${dir[k][0]} for ${dir[k][1]}</span></div>`;
  return `<div class="bcdir">${dv('L')}${dv('M')}${dv('R')}</div>${L.length ? svg : empty('No runs yet')}<p class="bcnote">Where the ball carriers ran (darker = more runs), yards per carry by direction.</p>`;
}
function receivers(G, tid) { const m = {}; for (const r of B.plays) if (r.off === tid && !r.two && r.res) for (const pid in r.rt) { const x = m[pid] || (m[pid] = { pid: +pid, routes: 0, tg: 0, c: 0 }); x.routes++; if (r.tgt === +pid && r.air && !r.flag) { x.tg++; if (r.res.catcher === +pid && r.res.type !== 'inc' && r.res.to !== 'int') x.c++; } } return Object.values(m).filter(x => x.routes >= 1).sort((a, b) => b.tg - a.tg || b.routes - a.routes); }
function routeChart(G, tid, pid) {
  const R0 = receivers(G, tid); if (!R0.length) return empty('No routes yet');
  pid = pid != null && R0.some(x => x.pid === pid) ? pid : R0[0].pid; const L = B.plays.filter(r => r.off === tid && !r.two && r.res && r.rt[pid] && r.rt[pid].length >= 2);
  const svg = field(-6, 34, ({ X, Y }) => L.map(r => { const tg = r.tgt === pid && r.air && !r.flag, s = r.res, k = !tg ? 'n' : s.to === 'int' ? 'x' : s.catcher === pid && s.type !== 'inc' ? (s.td ? 't' : 'c') : 'i';
    const pts = r.rt[pid].map(([u, d]) => `${X(u).toFixed(1)},${Y(Math.max(-6, Math.min(34, d))).toFixed(1)}`), last = r.rt[pid][r.rt[pid].length - 1];
    return `<polyline class="m-rt r-${k}" points="${pts.join(' ')}" data-tip="${e(`${qT(r.q)} ${ord(r.down)} & ${r.togo} · ${r.play || 'route'}${tg ? ` · target: ${k === 'x' ? 'INT' : k === 'i' ? 'incomplete' : s.y + ' yds'}` : ''}`)}"/>${tg ? `<circle class="m-${k === 't' ? 'c' : k} r-end" cx="${X(last[0]).toFixed(1)}" cy="${Y(Math.max(-6, Math.min(34, last[1]))).toFixed(1)}" r="3"/>` : ''}`; }).join(''));
  const me = R0.find(x => x.pid === pid);
  return `<div class="bcchips">${R0.slice(0, 6).map(x => `<button class="on${x.pid === pid ? ' sel' : ''}" data-bcr="${x.pid}">${e(short(x.pid))} <em>${x.tg}</em></button>`).join('')}</div>
   <div class="bcleg"><span><i class="k-c"></i>caught</span><span><i class="k-i"></i>incomplete</span><span><i class="k-x">✕</i>INT</span><span><i class="k-n"></i>not targeted</span><span class="r">${me.routes} routes · ${me.c}/${me.tg}</span></div>${svg}<p class="bcnote">Every route he ran today, from the line of scrimmage.</p>`;
}
function sepChart(G, tid) {
  const L = passes(G, tid).filter(r => r.tgt != null && r.sep != null), by = {};
  for (const r of L) { const x = by[r.tgt] || (by[r.tgt] = { pid: r.tgt, n: 0, s: 0, a: 0, list: [] }); x.n++; x.s += Math.min(r.sep, 12); x.a += r.land ? r.land[1] : 0; x.list.push(r); }
  const R0 = Object.values(by).sort((a, b) => b.n - a.n).slice(0, 7); if (!R0.length) return empty('No targets yet');
  const MAX = 8, px = v => Math.min(MAX, v) / MAX * 100;
  return `<div class="bcsep"><div class="bcsep-ax"><span></span><div><i style="left:0">0</i><i style="left:25%">2</i><i style="left:50%">4</i><i style="left:75%">6</i><i style="left:100%">8+ yds</i></div><b>Avg</b></div>${R0.map(x => `<div class="bcsep-r"><span>${e(short(x.pid))}<em>${x.n} tgt · ${(x.a / x.n).toFixed(1)} air</em></span><div class="bcsep-t"><u style="left:${px(x.s / x.n)}%"></u>${x.list.map(r => { const s = r.res, k = s.to === 'int' ? 'x' : s.type === 'inc' ? 'i' : 'c'; return `<i class="d-${k}" style="left:${px(r.sep)}%" data-tip="${e(`${qT(r.q)} ${ord(r.down)} & ${r.togo}: ${r.sep.toFixed(1)} yds of separation, ${k === 'x' ? 'INT' : k === 'i' ? 'incomplete' : s.y + ' yds'}`)}"></i>`; }).join('')}</div><b>${(x.s / x.n).toFixed(1)}</b></div>`).join('')}</div>
    <div class="bcleg"><span><i class="k-c"></i>caught</span><span><i class="k-i"></i>incomplete</span><span><i class="k-x">✕</i>INT</span><span><i class="k-avg"></i>average</span></div><p class="bcnote">Separation: yards between the receiver and the nearest defender when the ball got there.</p>`;
}
const empty = t => `<div class="bcempty">${e(t)}</div>`;

// ------------------------------------------------------------ the stats viewer (pause menu, halftime, final card)
const TABS = [['wp', 'Win %'], ['team', 'Team'], ['pass', 'Pass chart'], ['run', 'Run map'], ['route', 'Routes'], ['sep', 'Separation']];
function openView(G, tab) {
  ensureEl(); bc(G); const v = B.view || (B.view = { tab: 'wp', tid: G.user != null && G.T[G.user] ? G.user : G.hid, pid: null }); if (tab) v.tab = tab;
  const A = TM(G, G.aid), H = TM(G, G.hid), side = v.tab !== 'wp' && v.tab !== 'team';
  const body = v.tab === 'wp' ? wpGraph(G, { h: 170, sw: 4 }) : v.tab === 'team' ? teamStatsHtml(G, false) : v.tab === 'pass' ? passChart(G, v.tid) : v.tab === 'run' ? runMap(G, v.tid) : v.tab === 'route' ? routeChart(G, v.tid, v.pid) : sepChart(G, v.tid);
  el.view.innerHTML = `<div class="bcv-c cx-sheet"><div class="bcv-hd"><b>Game stats</b><span>${scoreBig(G)} · ${qT(G.q)} ${clk(G.clock)}</span><button class="on bcv-x" data-bc="x" aria-label="Close">✕</button></div>
    <div class="bcv-tabs">${TABS.map(([k, l]) => `<button class="on${v.tab === k ? ' sel' : ''}" data-bct="${k}">${l}</button>`).join('')}</div>
    ${side ? `<div class="bcv-team">${[A, H].map(T => `<button class="on${v.tid === T.id ? ' sel' : ''}" data-bcs="${T.id}" style="${teamVars(T)}">${logoCv(T, 20)}${e(T.abbr)}</button>`).join('')}</div>` : ''}
    <div class="bcv-b">${body}</div><div class="bcv-tip"></div></div>`;
  el.view.className = 'bcview on show'; paint(el.view);
}
function paint(x) { if (typeof paintArt === 'function') { try { paintArt(x); } catch (er) { } } }
function closeView() { if (el) { el.view.className = 'bcview'; el.view.innerHTML = ''; } }
function ensureEl() {
  if (el && el.wp.isConnected) return el;
  const hud = document.getElementById('hud'), gui = document.getElementById('gui'); if (!hud || !gui) return null;
  el = {}; const mk = (cls, par) => { const d = document.createElement('div'); d.className = cls; par.appendChild(d); return d; };
  el.wp = mk('bcwp', hud); el.wp.innerHTML = '<div class="bcwp-b"><i class="a"></i><i class="h"></i></div><b class="bcwp-t"></b>';
  el.cap = mk('bccap', hud); el.lt = mk('bclt', hud); el.big = mk('bcbig', gui); el.view = mk('bcview', gui);
  const click = ev => { const t = ev.target.closest('[data-bc],[data-bct],[data-bcs],[data-bcr]'); const G = typeof MATCH !== 'undefined' ? MATCH._G : null; if (!t || !G) return; ev.preventDefault(); ev.stopPropagation(); const v = B && B.view;
    if (t.dataset.bc === 'go') return closeBig(true);
    if (t.dataset.bc === 'view') { if (B && B.big) B.big.until += 600; return openView(G); }
    if (t.dataset.bc === 'x') { closeView(); if (B && B.big) B.big.until = Math.max(B.big.until, B.t + 4); return; }
    if (t.dataset.bct && v) { v.tab = t.dataset.bct; return openView(G); }
    if (t.dataset.bcs && v) { v.tid = +t.dataset.bcs; v.pid = null; return openView(G); }
    if (t.dataset.bcr && v) { v.pid = +t.dataset.bcr; return openView(G); } };
  for (const x of [el.big, el.view]) { x.addEventListener('click', click); x.addEventListener('pointermove', hover); x.addEventListener('pointerdown', hover); }
  document.addEventListener('click', ev => { const t = ev.target.closest('[data-bcopen]'); const G = typeof MATCH !== 'undefined' ? MATCH._G : null; if (t && G) { ev.preventDefault(); openView(G, t.dataset.bcopen || null); } });
  document.addEventListener('pointermove', ev => { if (ev.target.closest && ev.target.closest('.ovl .bcwpg')) hover(ev); });
  return el;
}
function hover(ev) {
  const root = ev.target.closest('.bcv-c,.bcc,.ovl .card'); if (!root) return;
  const g = ev.target.closest('.bcwpg[data-bcg]');
  if (g && B && B.wph.length > 1) { const sv = g.querySelector('svg'), r = sv.getBoundingClientRect(), u = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), i = Math.round(u * (B.wph.length - 1)), p = B.wph[i], x = 4 + (312) * i / (B.wph.length - 1);
    const ln2 = sv.querySelector('.g-x'); if (ln2) { ln2.setAttribute('x1', x); ln2.setAttribute('x2', x); }
    const tip = g.querySelector('.bcwpg-tip'), G = MATCH._G; if (tip && G) { tip.innerHTML = `<b>${qT(p.q)} ${clk(p.c)}</b> ${e(TM(G, G.hid).abbr)} ${Math.round(p.wp)}% · ${e(p.d || '')}`; tip.style.left = Math.min(70, Math.max(0, u * 100 - 15)) + '%'; tip.classList.add('show'); } return; }
  const m = ev.target.closest('[data-tip]'), tip = root.querySelector('.bcv-tip'); if (!tip) return;
  if (!m) { if (ev.type === 'pointerdown') tip.classList.remove('show'); return; }
  const rr = root.getBoundingClientRect(); tip.textContent = m.dataset.tip; tip.style.left = Math.max(8, Math.min(rr.width - 220, ev.clientX - rr.left - 100)) + 'px'; tip.style.top = (ev.clientY - rr.top + 14) + 'px'; tip.classList.add('show');
}

// ------------------------------------------------------------ every frame: WP bar, captions, lower thirds, holds
function frame(G) {
  if (!G) return; const b = bc(G); const t = now(), dt = Math.min(0.25, t - b.tLast); b.tLast = t; if (!G.paused) b.t += dt;
  if (!ensureEl()) return; const S = setts(), game = document.getElementById('game');
  // the held flow: halftime card, a score card in a watched game
  if (b.big && (b.t >= b.big.until || G.sim)) closeBig(true);
  if (b.hold && (b.t >= b.hold.until || G.sim || G.mode === 'play')) { const c = b.hold.cont; b.hold = null; c(); if (!G.bc) return; }
  // the call of the last play, once the match has processed it
  if (b.pending && G.stage !== 'live') { const r = b.pending; b.pending = null; settle(G, r); if (r.res && !quietNow(G)) { const s = setts(); if (s.comm !== 'off') { if (spd(G) < 4 || bigPlay(r)) { callPlay(G, r); if (spd(G) < 4 && Math.random() < 0.55) colorAfter(G, r); } } } }
  if (G.over && G.stage === 'final' && !b.fin) { b.fin = true; sample(G, 'Final'); }
  // the bar
  const showWp = S.wp && G.stage !== 'load' && !G.daily; el.wp.classList.toggle('on', showWp); if (game) game.classList.toggle('bcwpon', showWp);
  if (showWp) wpBar(G);
  // what may be on screen now: nothing over a live play or a kick
  const calm = !G.paused && G.stage !== 'live' && G.stage !== 'final' && G.stage !== 'load' && !G.kickAnim && !G.kaim && !G.kpow && !(G.play && G.play.ret && G.stage === 'pre') && !quietNow(G) && !b.big && !(G.mode === 'play' && G.stage === 'pre' && G.userSide);
  const capOk = calm && !(G.mode === 'play' && G.stage === 'pre' && G.userSide) && !document.querySelector('#hud .csay.show');
  // captions
  b.q2 = b.q2.filter(x => x.exp > b.t && !(G.stage === 'live' && x.pri < 3));
  if (b.cap && (b.t >= b.cap.until || !capOk)) { b.cap = null; el.cap.classList.remove('show'); }
  if (!b.cap && capOk && b.q2.length && b.t >= (b.capGap || 0)) { const x = b.q2.shift(), sp = spd(G), d = Math.max(2.4, Math.min(6, 1.3 + x.text.length * 0.05)) / Math.min(1.6, sp);
    b.cap = { until: b.t + d }; b.capGap = b.t + d + 0.35; const who = b.crew[x.who].split(' ').slice(-1)[0];
    el.cap.innerHTML = `<em class="${x.who ? 'col' : 'pbp'}">${e(who)}</em><span>${e(x.text)}</span>`; el.cap.classList.remove('show'); void el.cap.offsetWidth; el.cap.classList.add('show'); }
  // lower thirds
  b.ltq = b.ltq.filter(x => x.exp > b.t);
  if (b.lt && (b.t >= b.lt.until || !calm)) { if (!calm && b.lt.kind === 'score' && b.t < b.lt.until) { b.lt.paused = true; } else b.lt = null; el.lt.classList.remove('show'); }
  if (b.lt && b.lt.paused && calm) { b.lt.paused = false; el.lt.classList.add('show'); }
  if (!b.lt && calm && b.ltq.length && S.gfx) { const x = b.ltq.shift(), sp = spd(G); b.lt = { kind: x.kind, until: b.t + x.dur / Math.min(2.2, sp) }; el.lt.innerHTML = x.html; el.lt.className = 'bclt k-' + x.kind; if (typeof paintArt === 'function') { try { paintArt(el.lt); } catch (er) { } } void el.lt.offsetWidth; el.lt.classList.add('show'); }
  layout(G);
}
function bigPlay(r) { const s = r.res; return !!s && (s.td || s.to || Math.abs(s.y) >= 20 || r.down === 4 || r.two || (s.sack && r.down >= 3)); }
function wpBar(G) {
  const wp = wpNow(G), b = B, A = TM(G, G.aid), H = TM(G, G.hid), sb = document.querySelector('#hud .sb');
  if (!b.geo || b.t - b.geoT > 0.5) { b.geoT = b.t; b.geo = sb ? [sb.offsetWidth, sb.offsetTop + sb.offsetHeight] : [0, 0]; }
  const key = [Math.round(wp), A.c1, H.c1, b.geo[0], b.geo[1]].join('|');
  const live = G.stage === 'live';
  el.wp.classList.toggle('tagoff', live || !!b.lt);
  if (key === b.wpKey) return; b.wpKey = key;
  if (b.geo[0]) { el.wp.style.width = b.geo[0] + 'px'; el.wp.style.top = b.geo[1] + 'px'; }
  const a = el.wp.querySelector('.a'), h = el.wp.querySelector('.h'), tg = el.wp.querySelector('.bcwp-t'), aw = 100 - wp;
  a.style.width = `calc(${aw}% - 1px)`; h.style.width = `calc(${wp}% - 1px)`; a.style.background = lite(A.c1); h.style.background = lite(H.c1);
  const lead = wp >= 50 ? H : A, v = Math.round(Math.max(wp, aw));
  tg.innerHTML = `${e(lead.abbr)} <b>${v}%</b>`; tg.className = 'bcwp-t ' + (wp >= 50 ? 'r' : 'l'); el.wp.title = `Win probability: ${A.abbr} ${Math.round(aw)}%, ${H.abbr} ${Math.round(wp)}%`;
  if (b.wpShown != null && Math.abs(wp - b.wpShown) >= 8) { el.wp.classList.remove('jolt'); void el.wp.offsetWidth; el.wp.classList.add('jolt'); }
  b.wpShown = wp;
}
// the bottom stack: captions sit just above whatever owns the bottom of the screen (the play-call sheet, the sim-speed bar)
function layout(G) {
  if (!B.cap && !B.lt) { B.layKey = ''; return; }
  const vh = innerHeight, sh = document.querySelector('#gui .sheet'), spb = document.querySelector('#gui .spdbar'), kb = document.querySelector('#gui .kbar'), acts = document.querySelector('#gui .acts');
  let bot = 22;
  if (sh && sh.classList.contains('show')) { const r = sh.getBoundingClientRect(); if (r.height > 0 && r.top < vh) bot = Math.max(bot, vh - r.top + 10); }
  for (const x of [spb, kb]) if (x && x.offsetParent && getComputedStyle(x).display !== 'none') { const r = x.getBoundingClientRect(); if (r.height) bot = Math.max(bot, vh - r.top + 10); }
  const cs = document.querySelector('#hud .csay.show'); if (cs) { const r = cs.getBoundingClientRect(); if (r.height) bot = Math.max(bot, vh - r.top + 8); }
  if (acts && acts.children.length && acts.offsetParent) { const r = acts.getBoundingClientRect(); if (r.height && r.top > vh * 0.55) bot = Math.max(bot, vh - r.top + 10); }
  const ch = el.cap.classList.contains('show') ? el.cap.offsetHeight + 8 : 0, key = bot + '|' + ch;
  if (key === B.layKey) return; B.layKey = key;
  el.cap.style.bottom = bot + 'px'; el.lt.style.bottom = (bot + ch) + 'px';
}

// ------------------------------------------------------------ pause menu + final card
function pause(ovl) { const G = typeof MATCH !== 'undefined' ? MATCH._G : null; if (!G || !ovl) return; ensureEl(); const row = ovl.querySelector('.card .row'); if (!row) return; const b = document.createElement('button'); b.className = 'on'; b.dataset.bcopen = ''; b.textContent = 'Game stats and charts'; row.insertBefore(b, row.children[1] || null); }
function finalHtml(G) {
  if (!G || G.daily) return ''; const b = bc(G); if (!b.fin) { b.fin = true; sample(G, 'Final'); }
  const a = teamTot(G, G.aid), h = teamTot(G, G.hid), A = TM(G, G.aid), H = TM(G, G.hid);
  return `<div class="bcfin">${wpGraph(G, { h: 104, sw: 3 })}<div class="bcfin-x"><span>3rd down <b>${e(A.abbr)} ${a.th[1]}/${a.th[0]}</b> · <b>${e(H.abbr)} ${h.th[1]}/${h.th[0]}</b></span><span>Possession <b>${clk(a.top)}</b> · <b>${clk(h.top)}</b></span></div>
   <div class="bcfin-b">${TABS.slice(1).map(([k, l]) => `<button class="on" data-bcopen="${k}">${l}</button>`).join('')}</div></div>`;
}
function busy() { return !!(B && (B.big || B.hold)); }
function mute(sec) { mutedTo = now() + (sec || 0); if (el && sec) { el.cap.classList.remove('show'); el.lt.classList.remove('show'); if (B) { B.cap = null; B.lt = null; } } }
return { step, next, frame, pause, finalHtml, openView, closeView, busy, mute, _: () => B, _drive: driveHtml };
})();
// Settings > Broadcast (src/ui/90_settings.js calls this): the booth, the win-probability bar, drive and score graphics
function bcSettingsPanel(S) {
  const c = S.comm || 'on';
  return `<div class="panel" style="margin-top:12px"><h2>Broadcast</h2>
   <label>Commentary (captions from the booth, between plays) <select onchange="L.settings.comm=this.value;saveGame()">${[['on', 'On'], ['big', 'Big plays only'], ['off', 'Off']].map(([k, n]) => `<option value="${k}" ${c === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
   <div class="row" style="margin-top:8px"><label class="small"><input type="checkbox" ${S.wpbar !== false ? 'checked' : ''} onchange="L.settings.wpbar=this.checked;saveGame()"> Win probability on the scorebug</label><label class="small"><input type="checkbox" ${S.bcgfx !== false ? 'checked' : ''} onchange="L.settings.bcgfx=this.checked;saveGame()"> Drive and scoring graphics</label></div>
   <p class="small mute">Game stats and charts (win probability, pass chart, run map, routes, separation) are in the pause menu, at halftime and on the final screen.</p></div>`;
}
