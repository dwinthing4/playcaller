// League screens: standings, schedule/results, leaders, history, records.
function divTable(conf, div) { const ts = sortTeams(L.teams.filter(t => t.conf === conf && t.div === div)); return `<table class="mini">${ts.map(t => `<tr class="${t.id === L.user ? 'me' : ''} click" onclick="teamModal(${t.id})"><td><div class="row" style="gap:6px;flex-wrap:nowrap">${logoC(t, 20)}${esc(teamLabel(t))}</div></td><td>${t.w}-${t.l}${t.tie ? '-' + t.tie : ''}</td><td class="mute">${t.pf}-${t.pa}</td></tr>`).join('')}</table>`; }
VIEWS.standings = function () {
  const pr = L.teams.map(t => { const g = t.w + t.l + t.tie; return { t, s: (g ? pct(t) : 0.5) * 55 + teamOvr(t) * 0.6 + (g ? (t.pf - t.pa) / g : 0) * 0.8 }; }).sort((a, b) => b.s - a.s);
  return `<div class="panel"><h3>Power rankings</h3><table class="mini">${pr.slice(0, 10).map((x, i) => `<tr class="${x.t.id === L.user ? 'me' : ''}"><td>${i + 1}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">${logoC(x.t, 20)}${esc(x.t.name)}</div></td><td>${x.t.w}-${x.t.l}</td><td>${ovrTag(teamOvr(x.t))}</td></tr>`).join('')}</table></div>
  ${L.phase === 'playoffs' ? `<div class="panel" style="margin-top:10px"><h3>${ROUND_NAMES[L.playoff.round]}</h3>${L.playoff.games.map(g => `<div class="row small">${logoC(L.teams[g.a], 20)}<span>${L.teams[g.a].abbr} ${g.done ? g.as : ''}</span><span class="mute">at</span>${logoC(L.teams[g.h], 20)}<span>${L.teams[g.h].abbr} ${g.done ? g.hs : ''}</span></div>`).join('')}</div>` : ''}
  ${['A', 'N'].map(cf => `<div class="panel" style="margin-top:10px"><h2>${confName(cf)} Conference</h2><div class="grid g2">${DIVS.map(dv => `<div><h3>${dv}</h3>${divTable(cf, dv)}</div>`).join('')}</div></div>`).join('')}`;
};
function teamModal(tid) { const t = L.teams[tid]; modal(`<div class="row">${logoC(t, 56)}<div class="sp"><h2 style="margin:0">${esc(teamName(t))}</h2><div class="small mute">${t.w}-${t.l} · ${esc(t.offStyle)} / ${esc(t.defStyle)} · coach ${esc(t.coach.fn)} ${esc(t.coach.ln)} · cap room ${money(capRoom(t))}</div></div>${ovrTag(teamOvr(t))}<button class="sm ghost" onclick="closeModal()">✕</button></div>
  <div class="rgrid" style="margin-top:10px">${t.roster.map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 24).map(rosterCard).join('')}</div>`, 'wide'); }
// ---------- schedule + scores ----------
function slotChip(g) { const t = slotTag(g); return t ? `<span class="slt ${g.slot}">${esc(t)}</span>` : ''; }
function resTxt(g, tid) { const my = g.h === tid ? g.hs : g.as, th = g.h === tid ? g.as : g.hs; return `<b class="${my > th ? 'plw' : my < th ? 'pll' : ''}">${my > th ? 'W' : my < th ? 'L' : 'T'} ${my}-${th}</b>`; }
VIEWS.schedule = function () {
  const T = UT(), nW = L.sched.length, rows = [];
  L.sched.forEach((wk, i) => { const g = wk.find(x => x.h === T.id || x.a === T.id), cur = i === L.week && L.phase === 'regular';
    if (!g) { rows.push(`<tr class="${cur ? 'me' : ''} bye"><td>${i + 1}</td><td colspan=3 class="mute">Bye week</td></tr>`); return; }
    const opp = L.teams[g.h === T.id ? g.a : g.h], r = g.done ? boxFor(L.year, i, g.h, g.a) : null;
    rows.push(`<tr class="${cur ? 'me' : ''}${r ? ' click' : ''}" ${r ? `onclick="boxModal(${L.year},${i},${g.h},${g.a})"` : ''}><td>${i + 1}</td><td class="small">${esc(slotLabel(g))}${slotChip(g)}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">${logoC(opp, 20)}${g.h === T.id || g.neutral ? 'vs' : 'at'} <span class="schc">${esc(opp.city !== opp.name ? opp.city + ' ' : '')}</span>${esc(opp.name)}${isRival(T, opp) ? '<span class="rvl">Rival</span>' : ''}</div></td><td>${g.done ? resTxt(g, T.id) : ''}</td></tr>`); });
  for (const r of L.results.filter(x => x.y === L.year && x.po && (x.h === T.id || x.a === T.id))) { const opp = L.teams[r.h === T.id ? r.a : r.h];
    rows.push(`<tr class="click" onclick="boxModal(${r.y},${r.w},${r.h},${r.a},${r.rd})"><td>PO</td><td class="small">${esc(ROUND_NAMES[r.rd] || 'Playoffs')}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">${logoC(opp, 20)}${r.h === T.id ? 'vs' : 'at'} ${esc(teamName(opp))}</div></td><td>${resTxt(r, T.id)}</td></tr>`); }
  const by = byeWeek(T.id);
  return `<div class="panel"><div class="row"><h2 style="margin:0">Your schedule</h2><span class="sp"></span><span class="small mute">${nW} weeks${by >= 0 ? ' · bye in week ' + (by + 1) : ''} · ${esc(qlenName(L.qlen))}</span></div>
    <div class="tbl"><table class="mini sch"><tr><th>Wk</th><th>When</th><th>Opponent</th><th>Result</th></tr>${rows.join('')}</table></div></div>
   <div class="panel" style="margin-top:10px">${scoresBody()}</div>`;
};
// every game of one week (or the playoffs): scores, time slots, byes; tap a final for its box score
function scoresBody() {
  const nW = L.sched.length, po = L.results.some(r => r.y === L.year && r.po), lastDone = Math.max(0, Math.min(nW - 1, L.phase === 'regular' ? L.week - (L.sched[L.week] && L.sched[L.week].some(g => g.done) ? 0 : 1) : nW - 1));
  let w = SUB.scoreWk; if (w == null || (w === 'po' && !po) || (w !== 'po' && (w < 0 || w >= nW))) w = L.phase === 'playoffs' && po ? 'po' : lastDone;
  const chips = L.sched.map((_, i) => `<button class="chip ${w === i ? 'on' : ''}" onclick="SUB.scoreWk=${i};render()">${i + 1}</button>`).join('') + (po ? `<button class="chip ${w === 'po' ? 'on' : ''}" onclick="SUB.scoreWk='po';render()">Playoffs</button>` : '');
  const card = (g, r, lab) => { const A = L.teams[g.a], H = L.teams[g.h], done = r || g.done, as = r ? r.as : g.as, hs = r ? r.hs : g.hs, rd = r && r.po ? r.rd : null;
    return `<div class="scg ${done ? 'click' : ''} ${g.h === L.user || g.a === L.user ? 'me' : ''}" ${done ? `onclick="boxModal(${L.year},${r ? r.w : w},${g.h},${g.a},${rd})"` : ''}><div class="scl">${lab ? esc(lab) : ''}</div>
      ${[[A, as, hs], [H, hs, as]].map(([t, s, o]) => `<div class="sct ${done && s > o ? 'w' : ''}">${logoC(t, 22)}<span class="sp">${esc(t.abbr)} <span class="mute small">${t.w}-${t.l}${t.tie ? '-' + t.tie : ''}</span></span><b>${done ? s : ''}</b></div>`).join('')}
      <div class="scf small mute">${done ? 'Final' + (r && r.ot ? ' / OT' : '') : 'Upcoming'}</div></div>`; };
  let list = '', note = '';
  if (w === 'po') list = L.results.filter(r => r.y === L.year && r.po).map(r => card(r, r, ROUND_NAMES[r.rd] || 'Playoffs')).join('');
  else { const wk = L.sched[w] || []; const order = ['tnf', 'thanksgiving', 'intl', 'early', 'late', 'snf', 'mnf']; list = wk.slice().sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot)).map(g => card(g, g.done ? boxFor(L.year, w, g.h, g.a) : null, slotLabel(g))).join('');
    const playing = new Set(wk.flatMap(g => [g.h, g.a])), bye = L.teams.filter(t => !playing.has(t.id)); if (bye.length) note = `<p class="small mute">Bye: ${bye.map(t => esc(t.abbr)).join(', ')}</p>`; }
  return `<h3>Scores</h3><div class="chips">${chips}</div><div class="scgrid">${list || '<p class="mute small">No games.</p>'}</div>${note}`;
}
// ---------- leaders: totals or per game, all games on the league's clock ----------
VIEWS.leaders = function () { const cats = [['py', 'Passing yds'], ['ptd', 'Pass TD'], ['ry', 'Rushing yds'], ['rtd', 'Rush TD'], ['recy', 'Receiving yds'], ['rec', 'Receptions'], ['rectd', 'Rec TD'], ['sk', 'Sacks'], ['int', 'INT'], ['tk', 'Tackles']];
  const pl = Object.values(L.P).filter(p => p.tid != null && p.st && p.st.gp); const k = cats.some(c => c[0] === SUB.leadCat) ? SUB.leadCat : 'py', per = SUB.leadPer === 1;
  const tg = Math.max(0, ...L.teams.map(t => t.w + t.l + t.tie)), minG = Math.max(1, Math.ceil(tg / 2));
  const v = p => per ? (p.st[k] || 0) / Math.max(1, p.st.gp) : (p.st[k] || 0), list = pl.filter(p => (p.st[k] || 0) > 0 && (!per || p.st.gp >= minG)).sort((a, b) => v(b) - v(a)).slice(0, 25);
  const f = x => (Math.round(x * 10) / 10).toString(), f1 = x => x.toFixed(1);
  return `<div class="chips">${cats.map(([c, n]) => `<button class="chip ${k === c ? 'on' : ''}" onclick="SUB.leadCat='${c}';render()">${n}</button>`).join('')}</div>
  <div class="row" style="margin-bottom:8px"><div class="seg"><button class="${per ? '' : 'on'}" onclick="SUB.leadPer=0;render()">Totals</button><button class="${per ? 'on' : ''}" onclick="SUB.leadPer=1;render()">Per game</button></div><span class="sp"></span><span class="small mute">Every game: ${esc(qlenName(L.qlen))}${histMixed() ? ' (changed this season)' : ''}${per ? ` · ${minG}+ games` : ''}</span></div>
  <div class="panel"><div class="tbl"><table class="mini"><tr><th>#</th><th>Player</th><th>Pos</th><th>Team</th><th>GP</th><th>${per ? 'Per g' : 'Total'}</th><th>${per ? 'Total' : 'Per g'}</th></tr>${list.map((p, i) => `<tr class="click ${p.tid === L.user ? 'me' : ''}" onclick="showPlayer(${p.id})"><td>${i + 1}</td><td>${esc(pname(p))}</td><td>${p.pos}</td><td>${L.teams[p.tid].abbr}</td><td>${p.st.gp}</td><td><b>${per ? f1(v(p)) : f(v(p))}</b></td><td class="mute">${per ? f(p.st[k] || 0) : f1((p.st[k] || 0) / Math.max(1, p.st.gp))}</td></tr>`).join('') || '<tr><td class="mute" colspan=7>No games played yet.</td></tr>'}</table></div></div>`; };
// ---------- history book ----------
VIEWS.history = function () {
  const tab = ['seasons', 'dyn', 'rec', 'hof'].includes(SUB.histTab) ? SUB.histTab : 'seasons';
  const tabs = [['seasons', 'Seasons'], ['dyn', 'Dynasties'], ['rec', 'Records'], ['hof', 'Hall of Fame']].map(([k, n]) => `<button class="chip ${tab === k ? 'on' : ''}" onclick="SUB.histTab='${k}';render()">${n}</button>`).join('');
  let body = '';
  if (tab === 'seasons') { const H = (L.lhist || []).slice().reverse(), tm = (id, name) => { const t = id != null ? L.teams[id] : null; return t ? `<div class="row" style="gap:6px;flex-wrap:nowrap">${logoC(t, 20)}<b>${esc(t.name)}</b></div>` : `<b>${esc(name || '—')}</b>`; };
    body = `<div class="panel"><div class="tbl"><table class="mini"><tr><th>Year</th><th>Champion</th><th>Runner-up</th><th>MVP</th><th>You</th></tr>${H.map(h => `<tr class="click" onclick="histSeasonModal(${h.y})"><td>${h.y}</td><td>${tm(h.ct, h.champ)}</td><td class="small">${h.rt != null && L.teams[h.rt] ? esc(L.teams[h.rt].name) : esc(h.ru || '—')}</td><td class="small">${esc(h.aw && h.aw.mvp ? h.aw.mvp[1] + ' · ' + h.aw.mvp[2] : h.mvp || '—')}</td><td>${esc(h.you || '')}</td></tr>`).join('') || '<tr><td class="mute" colspan=5>History starts after your first season.</td></tr>'}</table></div>${H.length ? '<p class="small mute">Tap a season for its standings, awards and leaders.</p>' : ''}</div>`; }
  else if (tab === 'dyn') { const D = histDynasties(), cnt = {}; for (const c of (L.champs || [])) cnt[c.t] = (cnt[c.t] || 0) + 1; const most = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
    body = `<div class="grid g2"><div class="panel"><h3>Dynasties</h3>${D.map(d => { const t = L.teams[d.t]; return `<div class="row dyn">${logoC(t, 34)}<div class="sp"><b>${esc(teamName(t))}</b><div class="small mute">${esc(d.label)} · ${d.years.join(', ')}</div></div><span class="tag">${d.n}</span></div>`; }).join('') || '<p class="small mute">No dynasty yet: three titles in a short span (or back-to-back) makes one.</p>'}</div>
      <div class="panel"><h3>Most titles</h3><table class="mini">${most.map(([t, n]) => `<tr class="click" onclick="teamModal(${t})"><td><div class="row" style="gap:6px;flex-wrap:nowrap">${logoC(L.teams[t], 20)}${esc(teamName(L.teams[t]))}</div></td><td><b>${n}</b></td><td class="small mute">${(L.champs || []).filter(c => c.t === +t).map(c => c.y).join(', ')}</td></tr>`).join('') || '<tr><td class="mute">No champions yet.</td></tr>'}</table></div></div>`; }
  else if (tab === 'rec') body = recordsBody();
  else { const F = (L.lhof || []).slice().reverse(); body = `<div class="panel"><h2>League Hall of Fame</h2>${F.map(f => `<div class="row small" style="margin:4px 0"><span class="sp"><b>${esc(f.name)}</b> ${f.pos} · ${f.teams.filter(Boolean).join(', ')} · class of ${f.y}</span><span class="tag">${f.sc}</span></div>`).join('') || '<p class="small mute">Retired greats are voted in each offseason. Short-quarter seasons count in full: the vote scales each season to full-length games.</p>'}</div>`; }
  return `<div class="chips">${tabs}</div>${body}`;
};
function histSeasonModal(y) {
  const h = (L.lhist || []).find(x => x.y === y); if (!h) return; const T = id => L.teams[id];
  const aw = (lab, a, old) => `<div class="hsaw"><span class="small mute">${lab}</span><b>${a ? `<span class="click" onclick="${L.P[a[0]] ? `showPlayer(${a[0]})` : ''}">${esc(a[1])}</span> <span class="mute small">${a[2]} ${esc(a[3])}</span>` : esc(old || '—')}</b></div>`;
  const stand = h.st ? ['A', 'N'].map(cf => `<div><h3>${esc(confName(cf))}</h3>${DIVS.map(dv => { const rows = h.st.filter(r => T(r[0]) && T(r[0]).conf === cf && T(r[0]).div === dv);
      return `<table class="mini hsst"><tr><th>${dv}</th><th>W-L</th><th>PF-PA</th><th></th></tr>${rows.map(r => `<tr class="${r[0] === L.user ? 'me' : ''}"><td><div class="row" style="gap:5px;flex-wrap:nowrap">${logoC(T(r[0]), 18)}${esc(T(r[0]).abbr)}</div></td><td>${r[1]}-${r[2]}${r[3] ? '-' + r[3] : ''}</td><td class="mute">${r[4]}-${r[5]}</td><td class="small">${r[6] === 4 ? '<b>Champion</b>' : r[6] >= 0 ? esc(ROUND_NAMES[r[6]]) : ''}</td></tr>`).join('')}</table>`; }).join('')}</div>`).join('') : '<p class="small mute">Standings were not archived for this season.</p>';
  const ld = h.ld ? HIST_LEAD.map(([k, lab]) => { const x = (h.ld[k] || [])[0]; return x ? `<tr><td class="mute">${lab}</td><td>${L.P[x[0]] ? `<span class="click" onclick="showPlayer(${x[0]})">${esc(x[1])}</span>` : esc(x[1])} <span class="small mute">${esc(x[2])}</span></td><td><b>${x[3]}</b></td><td class="small mute">${(x[3] / Math.max(1, x[4])).toFixed(1)}/g</td></tr>` : ''; }).join('') : '';
  modal(`<div class="row"><h2 style="margin:0">${y} season</h2><span class="sp"></span><button class="sm ghost" onclick="closeModal()">✕</button></div>
   <div class="small mute">${h.ql ? esc(qlenName(h.ql)) : 'Older season (quick sim)'}${h.mix ? ' · quarter length changed during the season' : ''}${h.ppg ? ` · ${h.ppg} plays per team-game` : ''}</div>
   <div class="hshd">${h.ct != null && T(h.ct) ? `${logoC(T(h.ct), 56)}<div><span class="small mute">Champion</span><b>${esc(teamName(T(h.ct)))}</b>${h.rt != null && T(h.rt) ? `<span class="small mute">beat ${esc(teamName(T(h.rt)))}</span>` : ''}</div>` : `<div><span class="small mute">Champion</span><b>${esc(h.champ)}</b></div>`}</div>
   <div class="hsaws">${aw('MVP', h.aw && h.aw.mvp, h.mvp)}${aw('Defensive Player', h.aw && h.aw.dpoy, h.dpoy)}${aw('Rookie of the Year', h.aw && h.aw.roy)}</div>
   ${ld ? `<h3>Leaders</h3><table class="mini">${ld}</table>` : ''}
   <h3>Final standings</h3><div class="grid g2">${stand}</div>`, 'wide');
}
// ---------- record book: one per quarter length, plus career records ----------
function recordsBody() {
  const qs = Object.keys(L.recQ || {}).filter(k => Object.keys(L.recQ[k].lg).length).map(Number).sort((a, b) => a - b); if (!qs.includes(L.qlen)) qs.push(L.qlen); qs.sort((a, b) => a - b);
  let q = SUB.recQ; if (q !== 'old' && !qs.includes(q)) q = L.qlen; if (q === 'old' && !L.recOld) q = L.qlen;
  const set = q === 'old' ? (SUB.recScope === 'mine' ? L.recOld.mine : L.recOld.lg) : (SUB.recScope === 'mine' ? recBook(q).mine : recBook(q).lg);
  const grp = (t, n) => `<div class="panel"><h3>${n}</h3><div class="tbl"><table class="mini">${REC_KEYS.filter(k => k[2] === t).map(([k, lab]) => { const e = set[k]; return `<tr ${e && L.P[e.pid] ? `class="click" onclick="showPlayer(${e.pid})"` : ''}><td>${lab}</td><td>${e ? `<b>${e.v}</b>${e.mix ? '*' : ''}` : '—'}</td><td class="small">${e ? esc(e.name) + ' <span class="mute">' + e.pos + ' ' + e.team + ' ' + e.y + '</span>' : ''}</td></tr>`; }).join('')}</table></div></div>`;
  const car = `<div class="panel"><h3>Career records</h3><p class="small mute" style="margin:0 0 6px">All quarter lengths together</p><div class="tbl"><table class="mini">${HIST_CAR.map(([k, lab]) => { const e = ((L.rcar || {})[k] || [])[0]; return `<tr ${e && L.P[e.pid] ? `class="click" onclick="showPlayer(${e.pid})"` : ''}><td>${lab}</td><td>${e ? `<b>${e.v}</b>${e.mix ? '*' : ''}` : '—'}</td><td class="small">${e ? esc(e.name) + ` <span class="mute">${e.pos} ${esc(e.teams)} ${e.y0 === e.y1 ? e.y0 : e.y0 + '-' + e.y1}</span>` : ''}</td></tr>`; }).join('')}</table></div></div>`;
  return `<div class="row" style="margin-bottom:8px;gap:8px"><div class="seg"><button class="${SUB.recScope === 'mine' ? 'on' : ''}" onclick="SUB.recScope='mine';render()">Your program</button><button class="${SUB.recScope === 'lg' ? 'on' : ''}" onclick="SUB.recScope='lg';render()">Whole league</button></div>
    <div class="seg">${qs.map(x => `<button class="${q === x ? 'on' : ''}" onclick="SUB.recQ=${x};render()">${x / 60} min</button>`).join('')}${L.recOld ? `<button class="${q === 'old' ? 'on' : ''}" onclick="SUB.recQ='old';render()">Old sim</button>` : ''}</div></div>
   <p class="small mute" style="margin:0 0 8px">${q === 'old' ? 'Records from before the league sim ran on your quarter length: CPU games were full length then.' : `Records with ${esc(qlenName(q))}. Each quarter length keeps its own book.`}${Object.values(set).some(e => e && e.mix) ? ' * the quarter length changed during that season.' : ''}</p>
   <div class="grid g2">${grp('game', 'Single game')}${grp('season', 'Single season')}</div>${SUB.recScope === 'mine' ? '' : car}`;
}
VIEWS.records = function () { return recordsBody(); };
