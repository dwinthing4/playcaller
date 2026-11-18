// Contracts and the salary cap. Cap hit = base salary + prorated signing bonus. Cutting a player leaves his
// remaining bonus proration plus any guarantee as dead money.
function kBase(p) { return p.base != null ? p.base : p.sal; }
function syncSal(p) { p.sal = Math.round((kBase(p) + (p.pr || 0)) * 10) / 10; }
function deadIfCut(p) { return Math.round(((p.pr || 0) * (p.prYrs || 0) + (p.guar || 0)) * 10) / 10; }
function setDeal(p, avg, yrs, bonusPct) {
  const bonus = avg * yrs * (bonusPct || 0); p.pr = yrs > 1 ? Math.round(bonus / yrs * 10) / 10 : 0; p.prYrs = yrs > 1 ? yrs : 0;
  p.base = Math.max(0.9, Math.round((avg - p.pr) * 10) / 10); p.guar = Math.round(Math.min(p.base, avg * 0.5) * 10) / 10; p.yrs = yrs; syncSal(p); p.restr = null;
}
function capUsed(t) { return Math.round((sum(t.roster.map(id => L.P[id].sal)) + (t.dead || 0)) * 10) / 10; }
function capRoom(t) { return Math.round((CAP - capUsed(t)) * 10) / 10; }
function askingSalary(p) { return Math.max(0.9, Math.round(salaryFor(p.ovr, p.pos, p.age) * rnd(.95, 1.15) * 10) / 10); }
function expiring(t) { return t.roster.filter(id => L.P[id].yrs <= 0); }
function releaseToFA(t, p, dead) {
  if (dead) { const dm = deadIfCut(p) || Math.round(p.sal * 0.5 * 10) / 10; t.dead = Math.round(((t.dead || 0) + dm) * 10) / 10; if (t.id === L.user && dm > 0) news(`Releasing ${p.fn} ${p.ln} leaves ${money(dm)} in dead money.`); }
  t.roster = t.roster.filter(x => x !== p.id); p.tid = null; p.yrs = 0; p.pr = 0; p.prYrs = 0; p.guar = 0; p.base = null; p.ask = askingSalary(p);
  if (!L.fa.includes(p.id)) L.fa.push(p.id);
  if (L.myBlock) L.myBlock = L.myBlock.filter(x => x !== p.id);
  if (t.captains) t.captains = t.captains.filter(x => x !== p.id);
  fixDepth(t);
}
function releasePlayer(id) { const p = L.P[id], T = UT(); if (!p || p.tid !== T.id) return { ok: false, msg: 'Not on your roster.' }; const dm = deadIfCut(p) || Math.round(p.sal * 0.5 * 10) / 10; releaseToFA(T, p, true); news(`Released ${p.pos} ${p.fn} ${p.ln}.`); gmReact('release', p, dm); return { ok: true, msg: `Released. ${money(dm)} dead money.` }; }
function ensureCap(t) {
  if (t.id === L.user && !L.ghost) return; let guard = 0;
  while (capRoom(t) < 0 && guard++ < 20) { const worst = t.roster.map(id => L.P[id]).filter(p => p.sal > 3).sort((a, b) => (a.ovr / a.sal) - (b.ovr / b.sal))[0]; if (!worst) break; releaseToFA(t, worst, true); }
}
function restructure(id) {
  const p = L.P[id]; if (p.yrs < 2) return { ok: false, msg: 'Needs at least 2 years left.' }; if (p.restr === L.year) return { ok: false, msg: 'Already restructured this year.' };
  const base = kBase(p); const conv = Math.max(0, base - 1.0) * 0.75; if (conv < 1) return { ok: false, msg: 'Not enough base salary to convert.' };
  const yrsR = Math.min(5, p.yrs), add = conv / yrsR, before = p.sal;
  p.base = Math.round((base - conv) * 10) / 10; p.pr = Math.round(((p.pr || 0) + add) * 10) / 10; p.prYrs = Math.max(p.prYrs || 0, yrsR); p.guar = Math.round(((p.guar || 0) + conv) * 10) / 10; p.restr = L.year; syncSal(p);
  news(`Restructured ${p.fn} ${p.ln}: cap hit ${money(before)} -> ${money(p.sal)}.`); return { ok: true, msg: `Saved ${money(before - p.sal)} of cap this year` };
}
function tagValue(pos) { const s = Object.values(L.P).filter(p => p.pos === pos && p.tid != null).map(p => p.sal).sort((a, b) => b - a).slice(0, 5); return Math.round((sum(s) / Math.max(1, s.length)) * 10) / 10; }
function franchiseTag(id) {
  const p = L.P[id], T = UT(); if ((T.tagY || 0) === L.year) return { ok: false, msg: 'You already used your franchise tag this year.' };
  const v = tagValue(p.pos); if (capRoom(T) < v - p.sal) return { ok: false, msg: 'Not enough cap room for the tag.' };
  p.base = v; p.pr = 0; p.prYrs = 0; p.guar = v; p.yrs = 1; syncSal(p); T.tagY = L.year; p.tagged = L.year; moodAdd(p, -6, 'Franchise tagged');
  news(`Franchise tag on ${p.pos} ${p.fn} ${p.ln}: ${money(v)} for one year.`); return { ok: true, msg: 'Tagged for one year.' };
}
function extAsk(p) { return Math.round(salaryFor(p.ovr, p.pos, p.age) * (1 + (60 - ensureMor(p).mor) / 250) * 10) / 10; }
function extYearsAsk(p) { return p.age <= 27 ? 4 : p.age <= 30 ? 3 : 2; }
function offerExtension(id, sal, yrs, bonusPct) {
  const p = L.P[id], T = UT(); if (p.extLock && p.extLock > L.year * 100 + L.week) return { ok: false, msg: 'He is not ready to talk again yet.' };
  const ask = extAsk(p), yrsAsk = extYearsAsk(p); if (capRoom(T) < sal - p.sal) return { ok: false, msg: 'Not enough cap room.' };
  const pAcc = clamp(0.45 + (sal / ask - 1) * 3.2 - Math.abs(yrs - yrsAsk) * 0.08 + (ensureMor(p).mor - 60) / 120 + (bonusPct || 0) * 0.3, 0.03, 0.97);
  if (R() < pAcc) { setDeal(p, sal, yrs + (p.yrs > 0 && L.phase !== 'offseason' ? 0 : 0), bonusPct); moodAdd(p, 8, 'Signed an extension'); p.holdout = false; p.tradeReq = 0; news(`${p.fn} ${p.ln} signed a ${yrs}-year extension at ${money(sal)}/yr.`); gmReact('extend', p, sal); return { ok: true, msg: 'Deal done!' }; }
  moodAdd(p, -3, 'Extension talks stalled'); p.extLock = L.year * 100 + L.week + 3;
  return { ok: false, msg: sal < ask * 0.92 ? 'His agent called it a lowball.' : 'They want to think it over. Try again in a few weeks.' };
}
function resignPlayer(id, yrs, sal) {
  const T = UT(), p = L.P[id]; p.ask = p.ask || askingSalary(p); sal = sal || p.ask;
  if (capRoom(T) + p.sal < sal) return { ok: false, msg: 'Not enough cap room.' };
  setDeal(p, sal, yrs, yrs >= 3 ? 0.2 : 0); p.resigned = L.year; news(`Re-signed ${p.pos} ${p.fn} ${p.ln}: ${yrs} yr, ${money(sal)}/yr.`); return { ok: true, msg: 'Re-signed.' };
}
