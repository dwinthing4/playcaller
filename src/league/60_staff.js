// Staff: coordinators who talk, the GM, the owner, scouts, and the coaching career.
const OC_FOCUS = [['QB guru', ['tha', 'thp', 'awr']], ['Receiver whisperer', ['rte', 'cth']], ['Line coach', ['pbk', 'rbk']], ['Run-game wizard', ['elu', 'btk', 'rbk']]];
const DC_FOCUS = [['Pass-rush specialist', ['prs', 'pow', 'bsh']], ['Secondary coach', ['mcv', 'zcv', 'hnd']], ['Fundamentals', ['tak', 'pur']], ['Run stopper', ['bsh', 'tak', 'str']]];
const OCP = { aggressive: ['Aggressive', 'Takes deep shots, goes for it'], conservative: ['Ball-control', 'Runs the ball, avoids risk'], adaptive: ['Adaptive', 'Attacks how the defense plays'] };
const DCP = { blitz: ['Blitz-happy', 'Sends extra rushers'], conservative: ['Bend-don’t-break', 'Two-deep zones, rarely blitzes'], adaptive: ['Adaptive', 'Studies your tendencies and counters them'] };
const VOICES = ['calm', 'fiery', 'cerebral', 'folksy'];
function genCoord(kind, q) {
  const n = rname(); const F = pick(kind === 'oc' ? OC_FOCUS : DC_FOCUS); const r = clamp(Math.round(q != null ? q : rnd(3, 9)), 1, 10); const lk = genLook('QB'); lk.hb = 0; lk.ey = 0; lk.vz = 0;
  const style = kind === 'oc' ? pick(Object.keys(OFF_STYLES)) : pick(Object.keys(DEF_STYLES));
  return { kind, fn: n.fn, ln: n.ln, lk, age: ri(32, 63), r, style, fname: F[0], focus: F[1], w: 0, l: 0, cost: Math.max(0, (r - 4) * 3 + ri(0, 2)),
    persona: pick(kind === 'dc' ? Object.keys(DCP) : Object.keys(OCP)), voice: pick(VOICES), book: STYLE2BOOK[style] || (kind === 'oc' ? 'pro' : 'multi') };
}
const GM_STYLES = { analytics: 'Analytics', oldschool: 'Old school', aggressive: 'Aggressive', cautious: 'Cautious' };
const OWNERP = { patient: ['Patient', 'Gives coaches time to build'], winnow: ['Win-now', 'High expectations every year'], cheap: ['Frugal', 'Watches payroll closely'], meddler: ['Meddler', 'Pushes his favorite players on you'], handsoff: ['Hands-off', 'Lets you run the team'] };
function ensureStaffAll() {
  for (const t of L.teams) {
    if (!t.oc) t.oc = genCoord('oc', rnd(3, 8)); if (!t.dc) t.dc = genCoord('dc', rnd(3, 8));
    if (!t.gm) { const n = rname(); t.gm = { fn: n.fn, ln: n.ln, lk: genLook('QB'), rel: ri(50, 64), age: ri(35, 64), style: pick(Object.keys(GM_STYLES)) }; t.gm.lk.hb = 0; t.gm.lk.ey = 0; t.gm.lk.vz = 0; }
    if (!t.owner.lk) { t.owner.lk = genLook('QB'); t.owner.lk.hb = 0; t.owner.lk.ey = 0; t.owner.lk.vz = 0; t.owner.age = ri(50, 80); if (t.owner.age > 55) t.owner.lk.hc = pick([8, 9]); }
    if (!t.owner.persona) { t.owner.persona = pick(Object.keys(OWNERP)); if (t.owner.persona === 'patient') t.owner.patience = Math.min(10, t.owner.patience + 2); if (t.owner.persona === 'winnow') t.owner.patience = Math.max(2, t.owner.patience - 2); }
    if (t.rival == null) { const d = L.teams.filter(x => x.id !== t.id && x.conf === t.conf && x.div === t.div); t.rival = d.length ? d[(t.id * 3) % d.length].id : -1; }
    if (!t.fac) t.fac = { train: 1, weight: 1, film: 1, sc: 1 }; if (!t.pcs) t.pcs = {};
  }
  ensureCoordMarket();
}
function ensureCoordMarket() { if (!L.cmarket || L.cmarket.y !== L.year) L.cmarket = { y: L.year, oc: Array.from({ length: 5 }, () => genCoord('oc')).sort((a, b) => b.r - a.r), dc: Array.from({ length: 5 }, () => genCoord('dc')).sort((a, b) => b.r - a.r) }; }
function rivalOf(T) { return T.rival; }
function isRival(a, b) { return a && b && (a.rival === b.id || b.rival === a.id); }
function ownerPersona(T) { return (T.owner && T.owner.persona) || 'handsoff'; }
function gmName() { const g = UT().gm; return g ? `GM ${g.fn} ${g.ln}` : 'Your GM'; }
function staffRel(k) { const T = UT(); T.srel = T.srel || { oc: 60, dc: 60, gm: 60, owner: 60 }; return T.srel[k] ?? 60; }
function relAdd(k, d) { const T = UT(); staffRel(k); T.srel[k] = clamp((T.srel[k] ?? 60) + d, 0, 100); if (k === 'gm' && T.gm) T.gm.rel = T.srel.gm; }
function moneyTxt(v) { return money(v); }

// ================= opponent analysis (what coordinators talk about) =================
function scoutOpp(o) {
  const avg = (pos, ks, n) => { const ids = (o.depth[pos] || []).filter(available).slice(0, n); let s = 0, c = 0; for (const id of ids) { const p = L.P[id]; for (const k of ks) { s += p.a[k]; c++; } } return c ? s / c : 60; };
  const top = (pos, k) => (o.depth[pos] || []).filter(available).map(id => L.P[id]).sort((a, b) => (b.a[k] || b.ovr) - (a.a[k] || a.ovr))[0];
  const ds = DEF_STYLES[o.defStyle] || DEF_STYLES.Balanced, os = OFF_STYLES[o.offStyle] || OFF_STYLES.Balanced; const dp = o.dc ? o.dc.persona : 'adaptive', op = o.oc ? o.oc.persona : 'adaptive';
  const blitz = clamp(ds.blitz + (dp === 'blitz' ? 0.14 : dp === 'conservative' ? -0.08 : 0), 0.05, 0.7), man = ds.man, pass = clamp(os.pass + (op === 'aggressive' ? 0.05 : op === 'conservative' ? -0.06 : 0), 0.3, 0.75);
  const defS = ['DE', 'DT', 'LB', 'CB', 'S'].flatMap(pos => (o.depth[pos] || []).filter(available).slice(0, pos === 'LB' || pos === 'CB' ? 3 : 2).map(id => L.P[id]));
  const offS = ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].flatMap(pos => (o.depth[pos] || []).filter(available).slice(0, pos === 'WR' ? 3 : pos === 'OT' || pos === 'OG' ? 2 : 1).map(id => L.P[id]));
  const weakD = defS.slice().sort((a, b) => a.ovr - b.ovr)[0], starD = defS.slice().sort((a, b) => b.ovr - a.ovr)[0], weakO = offS.slice().sort((a, b) => a.ovr - b.ovr)[0], starO = offS.slice().sort((a, b) => b.ovr - a.ovr)[0];
  return { o, rush: (avg('DE', ['prs', 'pow'], 2) + avg('DT', ['pow', 'bsh'], 2)) / 2, cover: (avg('CB', ['mcv', 'zcv', 'spd'], 3) + avg('S', ['zcv', 'spd'], 2)) / 2, runD: (avg('DT', ['bsh'], 2) + avg('LB', ['tak', 'pur'], 3)) / 2,
    passO: (avg('QB', ['tha', 'thp'], 1) + avg('WR', ['rte', 'spd'], 3)) / 2, runO: (avg('RB', ['elu', 'btk', 'spd'], 1) + avg('OG', ['rbk'], 2)) / 2, pblk: (avg('OT', ['pbk'], 2) + avg('OG', ['pbk'], 2)) / 2,
    blitz, man, pass, rusher: top('DE', 'prs') || top('DT', 'pow'), cb: top('CB', 'mcv'), wr: top('WR', 'ovr'), rb: top('RB', 'ovr'), qb: top('QB', 'ovr'), te: top('TE', 'ovr'), lb: top('LB', 'tak'), weakD, starD, weakO, starO };
}
const pctTxt = v => Math.round(v * 100) + '%';
const nmTxt = p => p ? `#${p.num} ${p.ln}` : 'their guy';
// candidate reasons for a play in a situation. returns [{w, s}] (weight, sentence)
function playReasons(play, scen, S, side, T) {
  const o = S.o, n = play.name, R0 = [], add = (w, s) => R0.push({ w, s });
  if (side === 'O') {
    const pass = play.type === 'pass', quick = /Slant|Stick|Hitch|Screen|Bubble|Mesh|Drag|Quick|Spot|Hank|Shallow|Glance|Flat/.test(n);
    if (pass && quick && S.blitz > 0.28) add(2 + S.blitz * 3, `${o.name} bring extra rushers on ${pctTxt(S.blitz)} of downs${S.rusher ? ` and ${nmTxt(S.rusher)} is a problem off the edge` : ''}. ${n} gets the ball out before anyone gets home.`);
    if (pass && quick && S.rush > 74) add(1.6, `Their front four can get home (${Math.round(S.rush)} pass rush). ${n} is a fast throw so we don't sit back there.`);
    if (pass && play.deep && S.cover < 70) add(2.5 + (70 - S.cover) / 6, `Their secondary is the soft spot${S.cb ? `; ${nmTxt(S.cb)} is their best corner and he's a ${S.cb.ovr}` : ''}. ${n} takes a shot over the top.`);
    if (pass && play.deep && S.cover >= 78) add(-1.5, `${n} is a deep shot, but their safeties are good.`);
    if (!pass && S.runD < 68) add(2.2 + (68 - S.runD) / 6, `Their run defense grades out at ${Math.round(S.runD)}${S.weakD && ['DT', 'LB', 'DE'].includes(S.weakD.pos) ? ` and ${nmTxt(S.weakD)} at ${S.weakD.pos} is the weak link` : ''}. ${n} goes right at it.`);
    if (play.pa && S.runD >= 74) add(2, `They sell out to stop the run. ${n} uses that against them: fake it, then throw behind the linebackers.`);
    if (pass && S.man > 0.55 && /Mesh|Cross|Drag|Slant|Bunch|Shallow|Levels/.test(n)) add(2 + S.man * 2, `They play man ${pctTxt(S.man)} of the time. ${n} makes their corners fight through traffic.`);
    if (pass && S.man < 0.35 && /Smash|Seam|Flood|Curl|Sail|Levels|Dagger|Stick|Spot/.test(n)) add(1.8, `${o.name} sit in zone, mostly ${o.defStyle}. ${n} attacks the holes in it.`);
    if (pass && /Screen|Draw|Bubble/.test(n) && S.blitz > 0.35) add(1.7, `They blitz enough that a screen will catch them. ${n} lets the rush run past.`);
    if (scen === '3long' || scen === '2long') { if (pass && !quick) add(1.6, `We need chunk yards. ${n} puts a route past the sticks.`); if (!pass) add(-1, `${n} on a long down is a surprise call.`); }
    if (scen === '3short' || scen === '4short' || scen === '2short') { if (!pass && ['dive', 'zone', 'power'].includes(play.scheme)) add(2, `Short yardage. ${n} hits it downhill behind our best blockers.`); if (pass && quick) add(1, `${n} is a safe way to move the chains if they stack the box.`); }
    if (scen === '1st' && play.pa) add(1.3, `First down is play-action down. ${n} catches them leaning.`);
    if (scen === 'red' && /Fade|Slant|Flood|Smash|Stick|Corner/.test(n)) add(2, `The field shrinks in the red zone. ${n} gives us a quick answer to the back line.`);
    if (scen === 'goal') { if (play.form === 'Goal Line') add(2.6, `Goal line. ${n} puts our biggest bodies on the field.`); else add(-2, `${n} isn't built for the goal line.`); }
    if (scen === '2min') { if (pass && /Out|Sail|Flood|Smash|Corner|Stick|Hitch|Curl/.test(n + Object.values(play.routes || {}).join(' '))) add(2, `Clock's moving. ${n} works the sideline so we can get out of bounds.`); if (!pass) add(-1.5, `A run keeps the clock moving. Careful.`); }
    if (S.starD && pass && S.starD.pos === 'CB') add(0.4, `Throw away from ${nmTxt(S.starD)}; he's their best player.`);
    if (scen === '1st') add(pass ? 0.9 : 1.0, pass ? `Early-down throw. ${n} catches them in their base defense.` : `First down. ${n} keeps us on schedule and sets up play action later.`);
    if (scen === '2med') add(0.9, pass ? `${n} gets us to third and short at worst.` : `Second and medium is a coin flip for them. ${n} keeps them guessing.`);
    if (scen === '3med') add(pass ? 1.2 : 0.8, pass ? `Third and medium. ${n} has a route right at the sticks.` : `They expect a throw here. ${n} catches them in a light box.`);
    add(0.5, `${n} fits what we do in our ${OBOOKS[L.myOBook] || 'playbook'}.`);
  } else {
    const blitz = play.blitz && play.blitz.length > 0, man = !!MAN_COVERAGES[play.cov], deep2 = ['c2', 'c4', 'c2t', 'c2m'].includes(play.cov);
    if (S.pass > 0.6 && (play.form === 'Nickel' || play.form === 'Dime')) add(2 + (S.pass - 0.6) * 6, `${o.name} throw on ${pctTxt(S.pass)} of downs${S.qb ? ` and ${nmTxt(S.qb)} can spin it (${S.qb.a.thp} arm)` : ''}. ${n} gets an extra DB on the field.`);
    if (S.wr && S.wr.ovr >= 80 && deep2) add(2.2, `${nmTxt(S.wr)} is their best weapon at ${S.wr.ovr}. ${n} keeps a safety over the top of him.`);
    if (S.pblk < 70 && blitz) add(2.2 + (70 - S.pblk) / 6, `Their line struggles in protection (${Math.round(S.pblk)}). ${n} sends extra heat.`);
    if (S.pblk >= 76 && blitz) add(-1, `${n} blitzes into a line that picks it up well.`);
    if (S.pass < 0.5 && (play.form === '4-3' || play.form === '3-4')) add(2, `${S.rb ? nmTxt(S.rb) + ' carries' : 'The run game carries'} their offense. ${n} keeps our big bodies in the box.`);
    if (S.qb && S.qb.a.awr < 70 && man && blitz) add(1.6, `${nmTxt(S.qb)} gets rattled under pressure. ${n} tests him early.`);
    if (S.qb && S.qb.a.awr >= 82 && !man) add(1.2, `${nmTxt(S.qb)} reads man coverage well, so ${n} disguises it as zone.`);
    if (scen === '3long' || scen === '2long') { if (deep2 || play.form === 'Dime') add(1.8, `They need chunk yards. ${n} sits on the sticks and keeps it in front.`); }
    if (scen === '3short' || scen === '4short' || scen === '2short') { if (play.form === '4-3' || play.form === '3-4' || play.form === 'Goal Line D') add(1.6, `Short yardage. ${n} fills every gap.`); if (blitz) add(0.8, `${n} shoots a gap before they can get going.`); }
    if (scen === 'goal') { if (play.form === 'Goal Line D') add(2.6, `Goal line. ${n} stacks the line and dares them to throw.`); else add(-2, `${n} is light for the goal line.`); }
    if (scen === 'red' && man) add(1.2, `Tight space in the red zone. ${n} plays man and challenges every throw.`);
    if (scen === '2min') { if (deep2) add(2, `Two-minute drill. ${n} keeps it in front and makes them use the clock.`); if (blitz) add(-0.5, `Blitzing in the two-minute drill is a gamble.`); }
    if (scen === '1st') add(0.9, `On first down they ${S.pass > 0.55 ? 'like to throw' : 'lean on the run'}. ${n} is built for that.`);
    if (scen === '2med' || scen === '3med') add(1.0, `${n} gives us an answer to both the run and the short throw.`);
    add(0.5, `${n} is a staple of our ${DBOOKS[L.myDBook] || 'defense'}.`);
  }
  return R0.sort((a, b) => b.w - a.w);
}
const VOICE_TAG = { calm: ['', 'Here’s my thinking: ', 'Simple read. '], fiery: ['Listen. ', 'Let’s go after them. ', 'I want to punch them in the mouth. '], cerebral: ['The film says this: ', 'From the tape: ', 'Numbers-wise, '], folksy: ['Coach, ', 'Way I see it, ', 'Old saying: '] };
function voiced(co, s) { const v = VOICE_TAG[co && co.voice] || VOICE_TAG.calm; return pick(v) + s; }
// weekly game plan: every situation gets up to 3 plays per side with a spoken reason
function nextOpp() { const g = currentUserGame(); if (!g) return null; return L.teams[g.h === L.user ? g.a : g.h]; }
function ensurePlan(force) {
  const opp = nextOpp(); if (!opp) return null;
  if (!force && L.plan && L.plan.year === L.year && L.plan.week === L.week && L.plan.phase === L.phase && L.plan.opp === opp.id) return L.plan;
  const T = UT(), S = scoutOpp(opp); const plan = { year: L.year, week: L.week, phase: L.phase, opp: opp.id, O: {}, D: {}, say: { O: {}, D: {} }, locked: false, intro: {} };
  for (const side of ['O', 'D']) for (const [k] of SCENS) {
    const ranked = playsFor(L.user, side).map(p => ({ p, s: scorePlay(p, k, opp, T) })).sort((a, b) => b.s - a.s).slice(0, 3);
    plan[side][k] = ranked.map(x => x.p.id);
    const top = ranked[0] && ranked[0].p; const r = top ? playReasons(top, k, S, side, T)[0] : null;
    plan.say[side][k] = r ? voiced(side === 'O' ? T.oc : T.dc, r.s) : 'Nothing special here. Run our stuff.';
  }
  plan.intro.O = ocIntro(S, T); plan.intro.D = dcIntro(S, T);
  L.plan = plan; return plan;
}
function ocIntro(S, T) { const o = S.o; const lines = [];
  lines.push(`${teamLabel(o)} run a ${o.defStyle} defense and blitz about ${pctTxt(S.blitz)} of the time.`);
  if (S.starD) lines.push(`Their best defender is ${S.starD.pos} ${S.starD.fn} ${S.starD.ln} (${S.starD.ovr}). We plan around him.`);
  if (S.weakD) lines.push(`The weak spot is ${S.weakD.pos} ${S.weakD.ln} (${S.weakD.ovr}); I want to test him early.`);
  lines.push(S.runD < S.cover ? 'They are softer against the run than the pass, so we lean on the ground game.' : 'Their front is stout; we win this one through the air.');
  return voiced(T.oc, lines.join(' ')); }
function dcIntro(S, T) { const o = S.o; const lines = [];
  lines.push(`${o.name} run a ${o.offStyle} offense and throw on ${pctTxt(S.pass)} of downs.`);
  if (S.starO) lines.push(`${S.starO.pos} ${S.starO.fn} ${S.starO.ln} (${S.starO.ovr}) is the guy we can't let beat us.`);
  if (S.weakO) lines.push(`Their weak link is ${S.weakO.pos} ${S.weakO.ln} (${S.weakO.ovr}). That's where the pressure goes.`);
  return voiced(T.dc, lines.join(' ')); }
function planSwap(side, scen, id) { const P = ensurePlan(); if (!P) return; const a = P[side][scen] = P[side][scen] || []; const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else { if (a.length >= 3) a.shift(); a.push(id); } P.custom = true; }
function planLock(v) { const P = ensurePlan(); if (P) P.locked = v !== false; relAdd('oc', 1); relAdd('dc', 1); }
function planReset() { ensurePlan(true); }
// in-game pitch. ctx per PLAN.md
function coordCall(ctx) {
  const T = L.teams[ctx.tid != null ? ctx.tid : L.user] || UT(); const side = ctx.side === 'D' ? 'D' : 'O'; const co = side === 'O' ? T.oc : T.dc;
  const opp = L.teams[ctx.oppTid] || nextOpp() || T; const scen = ctx.scen || scenKeyFor(ctx.down, ctx.togo, ctx.yl, ctx.q, ctx.clock, ctx.qlen || L.qlen, ctx.sd || 0);
  const avail = playsFor(T.id, side); const ids = new Set(avail.map(p => p.id));
  let picks = [];
  if (T.id === L.user && L.plan && L.plan.opp === opp.id && L.plan[side][scen]) picks = L.plan[side][scen].filter(id => ids.has(id));
  const ranked = avail.map(p => ({ p, s: scorePlay(p, scen, opp, T) + (picks.includes(p.id) ? 1.2 : 0) - (((L._used || {})[p.id] || 0) * 0.5) })).sort((a, b) => b.s - a.s);
  for (const r of ranked) { if (picks.length >= 3) break; if (!picks.includes(r.p.id)) picks.push(r.p.id); }
  picks = picks.slice(0, 3);
  // a balanced menu: on early and short-yardage downs the coordinator always offers his best run as one of the three
  if (side === 'O' && ['1st', '2short', '2med', '3short', '4short', 'goal', 'red'].includes(scen)) { const byId = id => avail.find(p => p.id === id);
    if (!picks.some(id => (byId(id) || {}).type === 'run')) { const run = ranked.find(r => r.p.type === 'run'); if (run) picks[Math.min(2, picks.length)] = run.p.id; } }
  const S = scoutOpp(opp); const best = L.plays.find(p => p.id === picks[0]);
  const reasons = best ? playReasons(best, scen, S, side, T) : [];
  const key = side + scen; L._say = L._say || {}; const k = (L._say[key] = (L._say[key] || 0) + 1);
  const useAlt = reasons.length > 1 && reasons[1].w >= 1.2 && reasons[1].w >= reasons[0].w - 1 && k % 2 === 0;
  const reason = reasons.length ? reasons[useAlt ? 1 : 0].s : '';
  let sit = situationLine(ctx, side, scen); if (/^(Goal line|Short yardage|The field shrinks|Clock|Two-minute|Tight space)/.test(reason)) sit = sit.replace(/(Red zone\.|They’re in the red zone\.|Goal line\.)/g, '').trim();
  const alt = picks[1] ? L.plays.find(p => p.id === picks[1]) : null;
  const callLine = pick(best ? [`I like ${best.name}.`, `Give me ${best.name}.`, `${best.name}. Trust it.`, `Let’s run ${best.name}.`] : ['Your call, coach.']);
  const altLine = alt && R() < 0.5 ? ` If you want something else, ${alt.name} works too.` : '';
  const say = voiced(co, `${sit} ${reason ? reason + ' ' : ''}${callLine}${altLine}`.replace(/\s+/g, ' ').trim());
  return { picks, say, who: co ? { fn: co.fn, ln: co.ln, role: side === 'O' ? 'OC' : 'DC', lk: co.lk } : { fn: 'Coach', ln: '', role: side === 'O' ? 'OC' : 'DC', lk: genLook('QB') }, scen };
}
function situationLine(ctx, side, scen) {
  const dn = ['', '1st', '2nd', '3rd', '4th'][ctx.down] || ''; const tg = (ctx.yl || 0) + (ctx.togo || 0) >= 100 ? 'goal' : ctx.togo; const sd = ctx.sd || 0;
  const bits = [];
  if (scen === '2min') bits.push(side === 'O' ? `${Math.max(0, Math.round(ctx.clock))} seconds, we need to move.` : 'They have to hurry. Make them earn it.');
  else if (ctx.down >= 3) bits.push(`${dn} and ${tg}.`);
  if (ctx.q >= 4 && sd > 7) bits.push(side === 'O' ? 'We’re up. No mistakes.' : 'We have a cushion. Nothing deep.');
  else if (ctx.q >= 4 && sd < -7) bits.push(side === 'O' ? 'We need points.' : 'We need a stop right now.');
  if (scen === 'red') bits.push(side === 'O' ? 'Red zone.' : 'They’re in the red zone.');
  if (scen === 'goal') bits.push('Goal line.');
  return bits.join(' ');
}

// ================= GM =================
function gmIntro() { const T = UT(), g = T.gm; inbox('gm', 'Welcome aboard', `${gmName()} (${GM_STYLES[g.style]}): "Glad to have you. We have ${money(capRoom(T))} in cap room and our biggest need is ${weakestPos(T)}. I'll bring you trade and free-agent ideas, and I'll tell you when I think a move is a mistake."`); }
function gmWeek() {
  const T = UT(); if (!T.gm || L.ghost) return; const r = R(); const need = weakestPos(T);
  if (r < 0.22 && tradeOpen()) {   // trade proposal
    const blocks = aiBlocks(); const targets = Object.entries(blocks).flatMap(([tid, ids]) => ids.map(id => L.P[id]).filter(p => p && p.pos === need)).sort((a, b) => b.ovr - a.ovr);
    const cur = (T.depth[need] || [])[0] ? L.P[T.depth[need][0]].ovr : 50; const tgt = targets.find(p => p.ovr > cur + 3);
    if (tgt) { const O = L.teams[tgt.tid]; const want = playerValue(tgt) * 1.12; const assets = []; let v = 0;
      for (const pk of T.picks.filter(k => k.y <= L.year + 1).sort((a, b) => b.r - a.r)) { if (v >= want) break; assets.push(pk); v += pickValue(pk); }
      if (v >= want * 0.9) { L.gmProp = { tid: O.id, get: [tgt.id], give: assets, id: nid() };
        inbox('gm', `Trade idea: ${tgt.pos} ${tgt.ln}`, `${gmName()}: "${teamName(O)} have ${tgt.pos} ${tgt.fn} ${tgt.ln} (${tgt.ovr}, age ${tgt.age}, ${money(tgt.sal)}) on the block. He'd start for us over a ${cur}. I think ${assets.map(a => `our ${a.y} round-${a.r}`).join(' and ')} gets it done."`, { actions: [{ label: 'Open in trade builder', act: 'gmProp', arg: L.gmProp.id }] }); }
    }
  } else if (r < 0.38) {   // free-agent target
    const fa = L.fa.map(id => L.P[id]).filter(p => p && p.pos === need && !p.retired).sort((a, b) => b.ovr - a.ovr)[0];
    if (fa) { fa.ask = fa.ask || askingSalary(fa); if (fa.ask <= capRoom(T)) inbox('gm', `Free agent: ${fa.pos} ${fa.ln}`, `${gmName()}: "${fa.fn} ${fa.ln} is still out there (${fa.ovr}, age ${fa.age}). He'd fill our ${need} hole and wants about ${money(fa.ask)}. ${fa.age >= 31 ? 'Short deal only.' : 'I like a two-year deal.'}"`, { actions: [{ label: `Sign 2 yr at ${money(fa.ask)}`, act: 'signFA', arg: fa.id }] }); }
  } else if (r < 0.52) {   // contract advice
    const ext = T.roster.map(id => L.P[id]).filter(p => p.yrs <= 1 && p.ovr >= 76 && p.age <= 29).sort((a, b) => b.ovr - a.ovr)[0];
    const over = T.roster.map(id => L.P[id]).filter(p => p.sal > salaryFor(p.ovr, p.pos, p.age) * 1.5 && p.sal > 5 && p.age >= 30).sort((a, b) => b.sal - a.sal)[0];
    if (ext) inbox('gm', `Extend ${ext.ln}?`, `${gmName()}: "${ext.pos} ${ext.fn} ${ext.ln} is in the last year of his deal. If he keeps playing like a ${ext.ovr} his price goes up. I'd open talks around ${money(extAsk(ext))} a year now."`, { actions: [{ label: 'Open contract talks', act: 'extend', arg: ext.id }] });
    else if (over) inbox('gm', `${over.ln}'s contract`, `${gmName()}: "${over.fn} ${over.ln} costs ${money(over.sal)} and he's ${over.age}. A restructure would free cap now; cutting him leaves ${money(deadIfCut(over))} dead."`, { actions: [{ label: 'Restructure', act: 'restructure', arg: over.id }] });
  }
}
function gmTradeCheck(gA, rA) {
  const T = UT(); const vg = sum(gA.map(assetValue)), vr = sum(rA.map(assetValue));
  if (vr > 0 && vg / vr > 1.7) return `${gmName()}: "We're giving up way too much here. I'd walk away."`;
  const qbOut = gA.some(a => a.type === 'p' && L.P[a.id].pos === 'QB' && (T.depth.QB || [])[0] === a.id); if (qbOut && !rA.some(a => a.type === 'p' && L.P[a.id].pos === 'QB')) return `${gmName()}: "That's our starting quarterback with no replacement coming back. Are you sure?"`;
  return null;
}
function gmReact(kind, p, val) {
  if (kind === 'trade') relAdd('gm', val > 1.6 ? -6 : val > 1.2 ? 1 : 3);
  if (kind === 'sign' && p && val > salaryFor(p.ovr, p.pos, p.age) * 1.35) { relAdd('gm', -3); inbox('gm', 'About that signing', `${gmName()}: "We paid ${p.ln} well above market. I'd like a say before the next one."`); }
  if (kind === 'release' && p && val > 6) { relAdd('gm', -2); }
  if (kind === 'extend') relAdd('gm', 2);
}
function gmOffseasonMemo() { const T = UT(); const ex = expiring(T).map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 4); const slot = (L.draftOrder || []).findIndex(s => s.owner === L.user);
  return `${gmName()}: "Here's where we stand. Cap room next year: ${money(capRoom(T))}. ${ex.length ? 'Key expiring deals: ' + ex.map(p => `${p.pos} ${p.ln} (${p.ovr})`).join(', ') + '.' : 'No major expiring deals.'} ${slot >= 0 ? `We pick #${slot + 1} in the draft.` : ''} Biggest needs: ${[weakestPos(T)].join(', ')}."`; }
function gmFreeAgencyMemo() { const T = UT(); const need = weakestPos(T); const top = L.fa.map(id => L.P[id]).filter(p => p && !p.retired).sort((a, b) => b.ovr - a.ovr); const fit = top.filter(p => p.pos === need).slice(0, 2).concat(top.slice(0, 2)).slice(0, 3);
  inbox('gm', 'Free agency targets', `${gmName()}: "My board: ${fit.map(p => `${p.pos} ${p.fn} ${p.ln} (${p.ovr}, asks ${money(p.ask || askingSalary(p))})`).join('; ')}. We have ${money(capRoom(T))} to work with."`, { actions: [{ label: 'Open free agency', act: 'go', arg: 'fa' }] }); }

// ================= Owner =================
function seasonGoals(T) {
  if (!T.goals || T.goals.y !== L.year) { const op = ownerPersona(T); const exp = T.expect || expectFor(T);
    const list = [{ k: 'wins', v: exp, lab: `Win ${exp}+ games`, r: 3 }, { k: 'playoffs', lab: 'Make the playoffs', r: 4 }, { k: 'rival', lab: `Beat the ${L.teams[T.rival] ? L.teams[T.rival].name : 'rival'}`, r: 3 }];
    if (op === 'cheap') list.push({ k: 'budget', lab: 'Finish the season under the cap', r: 3 });
    if (op === 'winnow') list.push({ k: 'pf', v: 400, lab: 'Score 400+ points', r: 3 });
    if (op === 'patient') list.push({ k: 'pa', v: 380, lab: 'Allow fewer than 380 points', r: 2 });
    T.goals = { y: L.year, list }; }
  return T.goals;
}
function ownerIntro() { const T = UT(), o = T.owner, op = ownerPersona(T); const G = seasonGoals(T);
  inbox('owner', `Meeting with ${o.fn} ${o.ln}`, `Owner ${o.fn} ${o.ln} (${OWNERP[op][0]}): "${{ patient: 'Build this the right way. I can wait for a winner.', winnow: 'I didn’t hire you to rebuild. I want to win now.', cheap: 'Spend wisely. Every dollar counts with me.', meddler: 'I’ll be around. I have opinions about this roster.', handsoff: 'Your team. Just win.' }[op]} This season I want: ${G.list.map(g => g.lab.toLowerCase()).join(', ')}."`); }
function ownerPreseason(T) { ownerMeeting('preseason'); }
function ownerSeasonReview(T, got) { const o = T.owner; const ok = T.goals ? T.goals.list.filter(g => g.ok).length : 0;
  inbox('owner', 'Season review', `${o.fn} ${o.ln}: "${ok >= 3 ? 'That’s what I wanted to see.' : ok >= 2 ? 'Some good, some bad.' : 'That was not good enough.'} You hit ${ok} of my ${T.goals ? T.goals.list.length : 0} goals." Support is now ${Math.round(T.ownerSup)}%. ${got ? `(+${got} coach credits)` : ''}`); }
// owner meetings: dialogue with choices that change support, credits, expectations or create demands
function ownerMeeting(topic) {
  const T = UT(), o = T.owner, op = ownerPersona(T); if (L.ownerMeet && !L.ownerMeet.done) return;
  let text, choices;
  if (topic === 'preseason') { text = `"${L.year} is here. What should I expect from this team?"`; choices = [
    { label: 'We’re making the playoffs.', fx: { sup: 4, expect: 1, demand: { kind: 'playoffs', txt: 'Make the playoffs (you promised)', pen: 10, rew: 4 } } },
    { label: 'We’ll compete every week.', fx: { sup: 1 } },
    { label: 'This is a building year.', fx: { sup: op === 'patient' ? 3 : op === 'winnow' ? -8 : -3, expect: -1 } }]; }
  else if (topic === 'losing') { text = `"${-T.streak} straight losses. What is going on with my team?"`; choices = [
    { label: 'That’s on me. I’ll fix it.', fx: { sup: 3 } },
    { label: 'Injuries and bad breaks.', fx: { sup: op === 'meddler' ? -4 : -1 } },
    { label: 'Give me two weeks. We’ll win one of them.', fx: { sup: 2, demand: { kind: 'win', n: 1, by: L.week + 2, txt: 'Win one of the next two games', pen: 9, rew: 3 } } }]; }
  else if (topic === 'winning') { text = `"${T.streak} in a row! I love it. Anything you need?"`; choices = [
    { label: 'Upgrade the training facility.', fx: { credits: 4, sup: -1 } },
    { label: 'More money for free agents next year.', fx: { sup: 0, budget: 0.04 } },
    { label: 'Just keep believing in us.', fx: { sup: 3 } }]; }
  else if (topic === 'payroll') { text = `"Payroll is at ${money(capUsed(T))}. That’s too rich for me. Bring it down."`; choices = [
    { label: `I’ll cut ${money(5)} in the next three weeks.`, fx: { sup: 2, demand: { kind: 'payroll', v: capUsed(T) - 5, by: L.week + 3, txt: `Cut payroll to ${money(capUsed(T) - 5)}`, pen: 8, rew: 3 } } },
    { label: 'We need this talent to win.', fx: { sup: -4 } }]; }
  else if (topic === 'meddle') { const fa = L.fa.map(id => L.P[id]).filter(p => p && p.pos === weakestPos(T) && !p.retired).sort((a, b) => b.ovr - a.ovr)[0]; if (!fa) return;
    text = `"I watched film this week. Sign ${fa.pos} ${fa.fn} ${fa.ln}. He’s exactly what we need."`; choices = [
    { label: 'Good idea, I’ll sign him.', fx: { sup: 5, sign: fa.id } },
    { label: 'Let me evaluate him first.', fx: { sup: -2 } },
    { label: 'No. That’s my call.', fx: { sup: -6 } }]; }
  else { text = `"Halfway there. ${T.w}-${T.l}. Talk to me."`; choices = [
    { label: 'We’re on track.', fx: { sup: T.w >= T.l ? 2 : -2 } },
    { label: 'I need patience with the young guys.', fx: { sup: op === 'patient' ? 3 : -1 } },
    { label: 'We’ll finish strong.', fx: { sup: 1, demand: { kind: 'win', n: 2, by: L.week + 3, txt: 'Win two of the next three', pen: 7, rew: 3 } } }]; }
  L.ownerMeet = { id: nid(), topic, text, choices, done: false, y: L.year, w: L.week };
  inbox('owner', 'The owner wants a meeting', `${o.fn} ${o.ln}: ${text}`, { actions: [{ label: 'Meet', act: 'ownerMeet', arg: L.ownerMeet.id }] });
}
function ownerChoose(i) {
  const M = L.ownerMeet, T = UT(); if (!M || M.done) return { ok: false }; const c = M.choices[i]; if (!c) return { ok: false }; M.done = true; M.choice = i; const fx = c.fx || {};
  if (fx.sup) T.ownerSup = clamp(T.ownerSup + fx.sup, 0, 100); if (fx.expect) T.expect = clamp((T.expect || 9) + fx.expect, 3, 15);
  if (fx.credits) T.coach.pts += fx.credits; if (fx.budget) T.budgetBonus = (T.budgetBonus || 0) + fx.budget;
  if (fx.sign) { const p = L.P[fx.sign]; if (p && p.tid == null) { const r = signOffer(p.id, Math.max(p.ask || askingSalary(p), 0.9), 1); if (!r.ok) T.ownerSup = clamp(T.ownerSup - 3, 0, 100); } }
  if (fx.demand) { L.demands = L.demands || []; L.demands.push(Object.assign({ id: nid(), y: L.year, w: L.week, w0: T.w, done: false }, fx.demand)); }
  relAdd('owner', (fx.sup || 0) / 2);
  return { ok: true, msg: `Owner support ${fx.sup > 0 ? '+' : ''}${fx.sup || 0}.` };
}
function ownerWeek() {
  const T = UT(); if (L.ghost || L.phase !== 'regular') return; const op = ownerPersona(T);
  for (const d of (L.demands || [])) { if (d.done || d.y !== L.year) continue;
    let ok = null; if (d.kind === 'win' && L.week >= d.by) ok = T.w - d.w0 >= d.n; if (d.kind === 'win' && T.w - d.w0 >= d.n) ok = true;
    if (d.kind === 'payroll') { if (capUsed(T) <= d.v) ok = true; else if (L.week >= d.by) ok = false; }
    if (ok !== null) { d.done = true; d.ok = ok; T.ownerSup = clamp(T.ownerSup + (ok ? d.rew : -d.pen), 0, 100); inbox('owner', ok ? 'Promise kept' : 'Promise broken', `${T.owner.fn} ${T.owner.ln}: "${ok ? 'You did what you said. I respect that.' : 'You told me "' + d.txt.toLowerCase() + '" and it didn’t happen."'}" (support ${ok ? '+' + d.rew : '-' + d.pen})`); } }
  if (L.ownerMeet && !L.ownerMeet.done) { if (L.ownerMeet.y !== L.year || L.week - L.ownerMeet.w > 2) { L.ownerMeet.done = true; L.ownerMeet.missed = true; T.ownerSup = clamp(T.ownerSup - 2, 0, 100); inbox('owner', 'Missed meeting', `${T.owner.fn} ${T.owner.ln}: "I asked for a meeting and you never came by." (support -2)`); } else return; }
  if (T.streak <= -3 && !(L._om && L._om.losing === L.year * 100 + L.week)) { L._om = { losing: L.year * 100 + L.week }; ownerMeeting('losing'); return; }
  if (T.streak >= 4 && (L._omW || 0) !== L.year) { L._omW = L.year; ownerMeeting('winning'); return; }
  if (op === 'cheap' && capUsed(T) > CAP * 0.97 && (L._omP || 0) !== L.year) { L._omP = L.year; ownerMeeting('payroll'); return; }
  if (op === 'meddler' && L.week >= 3 && R() < 0.12) { ownerMeeting('meddle'); return; }
  if (L.week === 8) ownerMeeting('midseason');
}
function jobSecurity() { const T = UT(); const s = T.ownerSup; const ten = T.coach.tenure || 0; if (ten < 1) return ['Safe', 'First season: the owner will be patient while you build.'];
  return s >= 60 ? ['Secure', 'The owner trusts you.'] : s >= 40 ? ['Stable', 'Keep winning to stay in good standing.'] : s >= 28 ? ['Warm seat', 'Another disappointing year could cost you the job.'] : ['Hot seat', 'You could be fired after this season.']; }
function userAfterGame(T, g, lines) {
  const won = (g.h === T.id && g.hs > g.as) || (g.a === T.id && g.as > g.hs), tie = g.hs === g.as; const po = L.phase === 'playoffs'; const opp = L.teams[g.h === T.id ? g.a : g.h];
  const g2 = T.w + T.l + T.tie; const base = T.fanBase != null ? T.fanBase : 55;
  const fanT = g2 ? clamp(base + (pct(T) - (T.expect || 9) / 17) * 55 * (0.3 + 0.7 * Math.min(1, g2 / 17)) + clamp(T.streak, -5, 5) * 1.1, 5, 99) : base;
  T.fanSup = po ? clamp(T.fanSup + (won ? 5 : -3), 0, 100) : clamp(T.fanSup + (fanT - T.fanSup) * 0.35, 0, 100);
  const rel = (teamOvr(opp) - teamOvr(T)) / 6, pat = (10 - T.owner.patience) / 5;
  if (won) T.ownerSup = clamp(T.ownerSup + 1 + Math.max(0, rel) * 0.6 + (po ? 3 : 0), 0, 100); else if (!tie) T.ownerSup = clamp(T.ownerSup - (1.4 - clamp(rel, -0.8, 0.8) * 0.6) * pat * ((T.coach.tenure || 0) >= 1 ? 1 : 0.5), 0, 100);
  const credits = won ? Math.round(0.6 + 1.3 * T.fanSup / 100 + (po ? 1 : 0)) + (isRival(T, opp) ? 1 : 0) : (T.fanSup > 75 ? 1 : 0); T.coach.pts += credits; T.lastCredits = credits;
  const m = Math.abs(g.hs - g.as); if (won && m >= 28) addHighlight(`Blew out the ${opp.name} by ${m}`); if (won && teamOvr(opp) >= teamOvr(T) + 6) addHighlight(`Upset the ${opp.name}`);
  relAdd('gm', won ? 0.6 : -0.4); relAdd('oc', won ? 0.5 : -0.3); relAdd('dc', won ? 0.5 : -0.3);
  moraleAfterGame(T, g, lines); storyAfterGame(T, lines);
  L.lastGameInfo = { opp: opp.id, won, my: g.h === T.id ? g.hs : g.as, th: g.h === T.id ? g.as : g.hs, rival: isRival(T, opp) };
  if (L.phase === 'regular' && T.w >= 6 && T.l === 0 && L.midOffer !== L.year && desirability() >= 72 && R() < 0.5) { const c = L.teams.filter(t => t.id !== T.id && t.w < t.l); if (c.length) { L.midOffer = L.year; makeOffer(pick(c), 'mid'); } }
}
function coordSeasonReview(T) {
  for (const k of ['oc', 'dc']) { const co = T[k]; if (!co) continue;
    const g = Math.max(1, T.w + T.l + T.tie); const ok = k === 'oc' ? T.pf / g >= 22 : T.pa / g <= 22;
    if (co.hot) { if (!ok) { news(`You fired ${k.toUpperCase()} ${co.fn} ${co.ln} after a season on the hot seat.`); T[k] = genCoord(k, 2); T[k].fn = 'Interim'; T[k].ln = k.toUpperCase(); T[k].cost = 0; } else { co.hot = false; relAdd(k, 8); news(`${co.fn} ${co.ln} saved his job.`); } }
    else if (ok && R() < 0.35) { co.r = Math.min(10, co.r + 1); news(`${k.toUpperCase()} ${co.fn} ${co.ln} grew as a coach (rating ${co.r}).`); }
  }
}
// ---------- coaching career ----------
function coachScore(c) { const g = c.w + c.l + c.t; const p = g ? (c.w + c.t * 0.5) / g : 0.5; return c.w - c.l * 0.55 + c.pw * 3 + c.titles * 16 + p * 20 * Math.min(1, g / 34) + c.seasons * 0.4; }
function coachRank(c) { const all = L.teams.map(t => t.coach); all.sort((a, b) => coachScore(b) - coachScore(a)); return all.indexOf(c) + 1; }
function desirability() { const T = UT(), c = (L.ghost && L.myCoach) ? L.myCoach : T.coach; const g = c.w + c.l + c.t; const p = g ? (c.w + c.t * 0.5) / g : 0.5;
  const recent = (c.hist || []).slice(-2); const rp = recent.length ? sum(recent.map(h => (h.w + 0.5 * h.t) / Math.max(1, h.w + h.l + h.t))) / recent.length : p;
  return Math.round(clamp(rp * 38 + (L.ghost ? rp : (T.w + T.l + T.tie ? pct(T) : rp)) * 22 + c.titles * 9 + c.pw * 1.5 + (L.ghost ? 8 : (33 - coachRank(c)) * 0.6), 0, 100)); }
function teamInterest(t) { const d = desirability(); const need = (1 - pct(t)) * 30 + (t.coach.seasons < 1 ? 0 : 10) + (t.ownerSup < 40 ? 12 : 0); return Math.round(clamp(d * 0.75 + need - 15 + ((L.rel[t.id] ?? 50) - 50) * 0.3, 0, 100)); }
function aiFireProb(t, k) { const ten = k.tenure || 0; const exp = t.expect || expectFor(t); const gap = t.w - exp; if (ten < 1) return gap <= -7 ? 0.15 : 0; let p = gap <= -6 ? 0.75 : gap <= -4 ? 0.45 : gap <= -2 ? 0.18 : gap < 0 ? 0.05 : 0; if (ten >= 3 && gap < 0) p += 0.08; return p; }
function makeOffer(t, kind) { if (L.offers.some(o => o.tid === t.id)) return; const sal = Math.round((5 + desirability() * 0.08 + rnd(0, 2)) * 10) / 10; L.offers.push({ tid: t.id, kind, sal, yrs: ri(3, 6), y: L.year }); news(`${teamName(t)} ${kind === 'mid' ? 'want to trade for you' : 'want to interview you'} (${money(sal)}/yr).`); inbox('league', `${t.name} want you`, `${teamName(t)} ${kind === 'mid' ? 'want to bring you in right now' : 'have a head coaching opening'}: ${money(sal)}/yr.`, { actions: [{ label: 'See offers', act: 'go', arg: 'coach' }] }); }
function coachingCarousel() {
  L.vacancies = [];
  for (const t of L.teams) { if (t.id === L.user && !L.ghost) continue; const k = t.coach; k.age = (k.age || 50) + 1; if (R() < aiFireProb(t, k) || k.age > 71) { L.vacancies.push(t.id); news(`${teamName(t)} fired head coach ${k.fn} ${k.ln}.`); } }
  // coaching tree: good coordinators get hired as head coaches
  L.tree = L.tree || [];
  for (const tid of L.vacancies.slice()) { if (R() > 0.55) continue; const t = L.teams[tid];
    const pool = L.teams.filter(x => x.id !== tid).flatMap(x => ['oc', 'dc'].map(k => ({ k, o: x, c: x[k] }))).filter(z => z.c && z.c.r >= 7 && z.c.fn !== 'Interim').sort((a, b) => b.c.r - a.c.r); const z = pool[0]; if (!z) continue;
    const nc = genCoach(); Object.assign(nc, { fn: z.c.fn, ln: z.c.ln, lk: z.c.lk, age: z.c.age, off: clamp(z.k === 'oc' ? z.c.r : 5, 1, 10), def: clamp(z.k === 'dc' ? z.c.r : 5, 1, 10), tenure: 0, w: 0, l: 0, t: 0 });
    L.coachHist.push(Object.assign({}, t.coach, { team: t.abbr, gone: L.year })); t.coach = nc; L.vacancies = L.vacancies.filter(x => x !== tid); z.o[z.k] = genCoord(z.k, rnd(3, 6));
    if (z.o.id === L.user) { L.tree.push({ name: nc.fn + ' ' + nc.ln, tid, y: L.year, k: z.k }); news(`Your ${z.k.toUpperCase()} ${nc.fn} ${nc.ln} was hired as head coach of the ${teamName(t)}.`); inbox('league', 'Coaching tree', `Your ${z.k.toUpperCase()} ${nc.fn} ${nc.ln} is the new head coach of the ${teamName(t)}. Hire a replacement in the Staff room.`); }
  }
  for (const tid of L.vacancies) { const t = L.teams[tid]; if (teamInterest(t) > 45 + R() * 25) makeOffer(t, 'job'); }
  if (L.fired && !L.offers.length) { const worst = (L.vacancies.length ? L.vacancies.map(i => L.teams[i]) : L.teams.filter(t => t.id !== L.user).sort((a, b) => teamOvr(a) - teamOvr(b)).slice(0, 3)); for (const t of worst.slice(0, 3)) makeOffer(t, 'job'); }
}
function switchTeam(tid, sal, yrs) {
  const T = L.teams[tid]; const me = L.ghost ? L.myCoach : UT().coach; const old = UT();
  L.coachHist.push(Object.assign({}, T.coach, { team: T.abbr, gone: L.year }));
  if (!L.ghost) { me.hist.push({ y: L.year, tid: old.id, w: old.w, l: old.l, t: old.tie, note: 'Left for ' + T.abbr }); old.coach = genCoach(); }
  T.coach = me; L.myCoach = null; L.ghost = false; if (sal) { me.sal = sal; me.yrs = yrs; } me.tenure = 0;
  L.user = tid; T.ownerSup = 62; T.fanSup = clamp(T.fanSup + 8, 0, 100); L.fired = false; L.offers = []; T.expect = expectFor(T); L.plan = null; L.scouts = L.scouts || [];
  addHighlight(`Became head coach of the ${teamName(T)}`); news(`You are the new head coach of the ${teamName(T)}!`); seasonGoals(T); ownerIntro();
}
function acceptOffer(i) { const o = L.offers[i]; if (!o) return { ok: false }; switchTeam(o.tid, o.sal, o.yrs); return { ok: true, msg: `Welcome to ${teamName(UT())}.` }; }
function sitOutSeason() {
  const T = UT(); L.myCoach = T.coach; T.coach = genCoach(); L.ghost = true; L.fired = false; L.offers = []; L.myCoach.age++;
  if (L.phase === 'offseason') { if (L.off === 'resign') finishResign(); if (L.off === 'draft') { simDraftUntilUser(); finishDraft(); } }
  startNewSeason(); let g = 0; while (L.phase === 'regular' && g++ < 30) simWeek(); g = 0; while (L.phase === 'playoffs' && g++ < 10) simPlayoffRound();
  L.myCoach.hist.push({ y: L.year, tid: -1, w: 0, l: 0, t: 0, note: 'Out of coaching' });
  for (const tid of (L.vacancies || [])) { const t = L.teams[tid]; if (teamInterest(t) > 34 + R() * 25) makeOffer(t, 'job'); }
  news(L.offers.length ? `Teams are calling: ${L.offers.length} offer(s).` : 'No teams called this year.');
}
function retireCoach() { L.retired = true; }
// coordinators: hire/fire/poach
function hireCoord(kind, i) { const T = UT(), c = T.coach; ensureCoordMarket(); const co = L.cmarket[kind][i]; if (!co) return { ok: false }; if (c.pts < co.cost) return { ok: false, msg: `Need ${co.cost} coach credits.` };
  c.pts -= co.cost; const old = T[kind]; T[kind] = co; L.cmarket[kind].splice(i, 1); if (old && old.fn !== 'Interim') L.cmarket[kind].push(Object.assign(old, { cost: Math.max(0, (old.r - 4) * 3) }));
  T.srel = T.srel || {}; T.srel[kind] = 60; L.plan = null; news(`Hired ${kind.toUpperCase()} ${co.fn} ${co.ln}.`); return { ok: true, msg: `Hired ${co.fn} ${co.ln}. Switch your ${kind === 'oc' ? 'offense' : 'defense'} to ${co.style} in Team info if you want his scheme.` }; }
function fireCoord(kind) { const T = UT(); const old = T[kind]; T[kind] = genCoord(kind, 2); T[kind].fn = 'Interim'; T[kind].ln = kind.toUpperCase(); T[kind].cost = 0; L.plan = null; news(`Fired ${kind.toUpperCase()} ${old.fn} ${old.ln}.`); return { ok: true, msg: 'Fired.' }; }
function poachList() { return L.teams.filter(t => t.id !== L.user).flatMap(t => ['oc', 'dc'].map(k => ({ t, k, c: t[k] }))).filter(z => z.c && z.c.r >= 6 && z.c.fn !== 'Interim').sort((a, b) => b.c.r - a.c.r).slice(0, 8); }
function poachCost(c) { return Math.round((c.cost || ((c.r - 4) * 3)) * 1.6 + 3); }
function poach(tid, k) { const t = L.teams[tid], T = UT(); const c = t[k]; const cost = poachCost(c); if (T.coach.pts < cost) return { ok: false, msg: `Need ${cost} coach credits.` }; T.coach.pts -= cost; T[k] = c; t[k] = genCoord(k, rnd(3, 6)); L.rel[tid] = (L.rel[tid] || 50) - 10; L.plan = null; news(`You poached ${k.toUpperCase()} ${c.fn} ${c.ln} from the ${teamName(t)}.`); return { ok: true, msg: `${c.fn} ${c.ln} is your new ${k.toUpperCase()}.` }; }
function toggleHot(k) { const T = UT(); const co = T[k]; co.hot = !co.hot; relAdd(k, co.hot ? -15 : 6); news(co.hot ? `${co.fn} ${co.ln} (${k.toUpperCase()}) is on the hot seat.` : `${co.fn} ${co.ln} is off the hot seat.`); }

// ================= Scouts =================
const SCOUT_REGIONS = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West Coast'];
const SCOUT_SPECS = { all: 'Generalist', qb: 'Quarterbacks', skill: 'Skill positions', ol: 'Offensive line', front: 'Defensive front', db: 'Secondary' };
const SPEC_POS = { qb: ['QB'], skill: ['RB', 'FB', 'WR', 'TE'], ol: ['OT', 'OG', 'C'], front: ['DE', 'DT', 'LB'], db: ['CB', 'S'], all: POS_LIST };
function genScout(q) { const n = rname(); const lk = genLook('QB'); lk.hb = 0; lk.ey = 0; lk.vz = 0; const r = clamp(Math.round(q != null ? q : rnd(3, 9)), 1, 10);
  return { id: nid(), fn: n.fn, ln: n.ln, lk, age: ri(28, 66), r, spec: pick(Object.keys(SCOUT_SPECS)), region: pick(SCOUT_REGIONS), cost: Math.max(0, (r - 4) * 2 + ri(0, 1)), reports: 0 }; }
function ensureUserStaff() { if (!L.scouts || !L.scouts.length) L.scouts = [genScout(rnd(4, 7)), genScout(rnd(3, 6)), genScout(rnd(3, 6))]; if (!L.scoutPri) L.scoutPri = { pos: [], ids: [] }; ensureScoutMarket(); }
function ensureScoutMarket() { if (!L.smarket || L.smarket.y !== L.year) L.smarket = { y: L.year, list: Array.from({ length: 5 }, () => genScout()).sort((a, b) => b.r - a.r) }; }
function hireScout(i) { ensureScoutMarket(); const s = L.smarket.list[i]; const T = UT(); if (!s) return { ok: false }; if (L.scouts.length >= 4) return { ok: false, msg: 'You can carry 4 scouts. Fire one first.' }; if (T.coach.pts < s.cost) return { ok: false, msg: `Need ${s.cost} coach credits.` }; T.coach.pts -= s.cost; L.scouts.push(s); L.smarket.list.splice(i, 1); return { ok: true, msg: `Hired scout ${s.fn} ${s.ln}.` }; }
function fireScout(id) { L.scouts = L.scouts.filter(s => s.id !== id); return { ok: true, msg: 'Scout released.' }; }
function scoutsIntro() { inbox('scout', 'Scouting department', `Your ${L.scouts.length} scouts will file reports every week on their own. Set priorities in Scouting (positions or specific prospects) and they'll focus there. ${L.scouts.map(s => `${s.fn} ${s.ln} covers ${s.region} (${SCOUT_SPECS[s.spec]}, rating ${s.r}).`).join(' ')}`); }
function profAttrs(p) { return Object.keys(POS_PROFILE[p.pos] || {}); }
function revealCap(p) { return Math.max(2, Math.floor(profAttrs(p).length * 0.8)); }
function reveal(p, n, acc) {
  const sc = p.sc || (p.sc = { lvl: 0, rev: [], reports: [], acc: 0 }); const keys = Object.keys(OVR_W[p.pos] || {}).concat(profAttrs(p)); let got = [];
  for (const k of keys) { if (got.length >= n || sc.rev.length >= revealCap(p)) break; if (!sc.rev.includes(k)) { sc.rev.push(k); got.push(k); } }
  sc.lvl++; sc.acc = clamp((sc.acc || 0) + (acc || 0.25), 0, 0.92); const f = 1 - sc.acc;
  p.scout = Math.round(clamp(p.ovr + (p.scoutNoise || 0) * f, 30, 99)); p.scoutPot = Math.round(clamp(p.pot + (p.potNoise || 0) * f, p.scout, 99)); return got;
}
function projRound(p) { const rank = L.draft.map(id => L.P[id]).filter(Boolean).sort((a, b) => scoutedValue(b) - scoutedValue(a)).indexOf(p); return rank < 0 ? 7 : Math.min(7, Math.floor(rank / 32) + 1); }
function scoutReportText(s, p, got) {
  const prof = profAttrs(p).filter(k => p.sc.rev.includes(k)).map(k => [k, p.a[k]]).sort((a, b) => b[1] - a[1]);
  const strengths = prof.slice(0, 2).map(([k, v]) => `${ATTR_NAME[k].toLowerCase()} (${v})`), concern = prof.slice(-1).map(([k, v]) => `${ATTR_NAME[k].toLowerCase()} (${v})`);
  const pr = projRound(p); const potL = Math.max(p.scout, p.scoutPot - 4), potH = Math.min(99, p.scoutPot + 4);
  const comb = p.comb ? ` Ran a ${p.comb.forty}.` : '';
  return `${p.pos} ${p.fn} ${p.ln}, ${p.col}. ${strengths.length ? 'Wins with ' + strengths.join(' and ') + '.' : ''} ${concern.length && prof.length > 2 ? 'Concern: ' + concern[0] + '.' : ''}${comb} I have him around ${p.scout} now with a ceiling of ${potL}-${potH}. Projects as a round-${pr} pick.${p.arch && ARCH[p.arch] && p.sc.lvl >= 2 ? ' ' + ARCH[p.arch][1] : ''}`.replace(/\s+/g, ' ');
}
function scoutingWeek() {
  if (L.ghost || !L.scouts || !L.draft.length) return; const pri = L.scoutPri || { pos: [], ids: [] }; const lines = []; const seen = new Set();
  for (const s of L.scouts) {
    const n = 2 + Math.floor(s.r / 4); const specPos = SPEC_POS[s.spec] || POS_LIST;
    const pool = L.draft.map(id => L.P[id]).filter(p => p && !seen.has(p.id) && (p.sc ? p.sc.lvl : 0) < 5);
    const score = p => (pri.ids.includes(p.id) ? 100 : 0) + (pri.pos.includes(p.pos) ? 40 : 0) + (specPos.includes(p.pos) ? 15 : 0) + (p.region === s.region ? 10 : 0) + gradeStars(p) * 3 - ((p.sc ? p.sc.lvl : 0) * 6) + R() * 4;
    const picks = pool.sort((a, b) => score(b) - score(a)).slice(0, n);
    for (const p of picks) { seen.add(p.id); const acc = 0.12 + s.r * 0.035 + (specPos.includes(p.pos) && s.spec !== 'all' ? 0.08 : 0); const got = reveal(p, 2 + (s.r >= 7 ? 1 : 0), acc);
      const txt = scoutReportText(s, p, got); p.sc.reports.unshift({ y: L.year, w: L.week, by: s.fn + ' ' + s.ln, txt }); lines.push(`<b>${esc(s.ln)}</b>: ${esc(txt)}`); s.reports++; }
  }
  if (lines.length) inbox('scout', `Scouting reports, ${L.phase === 'offseason' ? 'offseason' : 'week ' + (L.week + 1)}`, lines.join('<br><br>'), { html: true, actions: [{ label: 'Open scouting', act: 'go', arg: 'scouting' }] });
}
function scoutState() { if (!L.scouting || L.scouting.y !== L.year) L.scouting = { y: L.year, meet: [], pro: [] }; return L.scouting; }
function meetProspect(id) { const S = scoutState(); const p = L.P[id]; if (!(L.phase === 'offseason' && (L.off === 'resign' || L.off === 'draft'))) return { ok: false, msg: 'Meetings open right before the draft.' };
  if (S.meet.includes(id)) return { ok: false, msg: 'Already met.' }; if (S.meet.length >= 4) return { ok: false, msg: 'You have used all 4 pre-draft meetings.' }; S.meet.push(id); const got = reveal(p, 3, 0.25); p.sc.met = true; p.mor = clamp(p.mor + 5, 0, 100); return { ok: true, msg: `Met with ${p.fn} ${p.ln}: ${got.length} more ratings revealed` }; }
function proDay(id) { const S = scoutState(); if (S.pro.includes(id)) return { ok: false, msg: 'Already visited.' }; if (S.pro.length >= 3) return { ok: false, msg: 'No pro-day visits left.' }; S.pro.push(id); const p = L.P[id]; reveal(p, 2, 0.2); if (p.comb) p.comb.forty = +(4.28 + (99 - p.a.spd) * 0.021).toFixed(2); return { ok: true, msg: `Pro day: ${p.ln} worked out for you` }; }
function setScoutPri(kind, v) { const P = L.scoutPri; const a = P[kind]; const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else { a.push(v); if (kind === 'ids' && a.length > 6) a.shift(); if (kind === 'pos' && a.length > 3) a.shift(); } }
function projOrder() { return L.teams.slice().sort((a, b) => pct(a) - pct(b) || teamOvr(a) - teamOvr(b)); }
function updateMock() {
  if (L.phase !== 'regular' || L.week < 4) return; const noise = Math.max(1.5, 10 - L.week * 0.45); const prev = L.mock ? Object.fromEntries(L.mock.map((m, i) => [m.pid, i])) : {};
  const ranked = L.draft.map(id => L.P[id]).filter(Boolean).map(p => ({ p, v: draftValue({ ovr: p.ovr + gauss() * noise, pot: p.pot + gauss() * noise, pos: p.pos }) })).sort((a, b) => b.v - a.v).slice(0, 32);
  const ord = projOrder(); L.mock = ranked.map((r, i) => ({ pid: r.p.id, tid: ord[i % ord.length].id, prev: prev[r.p.id] }));
}
