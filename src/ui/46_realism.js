// Player realism screens: measurables on the player card, the combine results table, draft-guide reports, role labels, comps.
// League side: 72_combine.js (measurables + combine), 73_scoutx.js (archetypes + comps), 74_report.js (reports), 76_camp.js.

// ---------- small pieces ----------
function rlArchMini(p) { if (!sxKnown(p)) return ''; const r = rarchOf(p); return r ? `<div class="rl-ra">${esc(r.n)}</div>` : ''; }
// an unrevealed athletic rating a prospect tested for: the combine's read on it ("~88")
function rlGuess(p, k) { if (!p.draft) return '?'; const v = cmbRead(p)[k]; return v != null ? `<span class="rl-guess" title="From his combine numbers">~${v}</span>` : '?'; }
const RL_MS = [['ht', 'Height'], ['wt', 'Weight'], ['arm', 'Arm'], ['hand', 'Hand'], ['forty', '40'], ['ten', '10 split'], ['vert', 'Vertical'], ['broad', 'Broad'], ['bench', 'Bench'], ['cone', '3-cone'], ['shuttle', 'Shuttle']];
function rlMsVal(k, m) { if (k === 'ht') return msrHt(m.ht, m.h8); if (k === 'wt') return m.wt + ''; return msrFmt(k, m[k]); }
// a measurables grid; pct bar = percentile at his position (league norms)
function rlMsGrid(p, m, note) {
  return `<div class="rl-ms">${RL_MS.map(([k, n]) => { const v = m[k], why = note && note(k), pc = v != null && k !== 'ht' ? msrPct(p.pos, k, v, m.wt) : k === 'ht' ? msrPct(p.pos, 'ht', m.ht) : null;
    return `<div class="${v == null ? 'dnp' : ''}"${why && why.t ? ` title="${esc(why.t)}"` : ''}><span>${n}</span><b>${v == null ? (why && why.s) || '—' : rlMsVal(k, m)}${why && why.pd ? '<sup>PD</sup>' : ''}</b>${pc != null && v != null ? `<i style="--w:${pc}%" title="${pc}th percentile at ${p.pos}"></i>` : ''}</div>`; }).join('')}</div>`;
}
// ---------- player card ----------
// prospects: combine card + the latest draft-guide report + older reports
function rlProspectBlock(p) {
  const c = p.comb, out = [];
  if (c) out.push(`<div class="rl-sec"><div class="rl-h"><b>${c.y} combine</b><span class="small mute">${c.inv ? '' : 'Not invited · '}PD = pro day</span>${p.combBump ? `<span class="rl-stock ${p.combBump > 0 ? 'up' : 'dn'}" title="How the workout moved him on other teams' boards">${p.combBump > 0 ? '▲' : '▼'} stock</span>` : ''}</div>
    ${rlMsGrid(p, c, k => c.sk && c.sk[k] ? { s: c.sk[k] === 'hurt' ? 'Hurt' : 'DNP', t: CMB_WHY[c.sk[k]] } : c.pd && c.pd[k] ? { pd: 1, t: 'Pro day' } : null)}</div>`);
  else out.push(`<p class="small mute rl-sec">Combine numbers come out right after the playoffs. Listed at ${fmtHt(p.ht)}, ${p.wt}.</p>`);
  const r = dgrLatest(p); if (r) out.push(rlReport(r, p));
  const old = (p.sc && p.sc.reports || []).slice(r ? 1 : 0, 6);
  if (old.length) out.push(`<details class="rl-old"><summary class="small mute">${r ? 'Earlier reports' : 'Scouting reports'} (${old.length})</summary>${old.map(x => `<div class="small rep"><b>${esc(x.by)}</b> <span class="mute">${x.y} wk ${x.w + 1}</span><br>${esc(x.txt)}</div>`).join('')}</details>`);
  if (!r && !old.length) out.push('<p class="small mute">No reports yet. Make him a priority and your scouts will get to him.</p>');
  return out.join('');
}
function rlReport(r, p) {
  return `<div class="rl-rep"><div class="rl-rh"><div><span class="pos">Scouting report</span><b>${esc(r.by)}</b><span class="small mute"> · ${r.y} ${r.w >= 17 ? 'offseason' : 'wk ' + (r.w + 1)}</span></div>
    <div class="rl-grade" title="Grade on a 4.5 to 7.9 scale"><b>${r.grade.toFixed(1)}</b><span>${esc(r.band)}</span></div></div>
    <p class="rl-sum">${esc(r.sum)}</p>
    <div class="rl-cols"><div><h4>Strengths</h4><ul>${r.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h4>Weaknesses</h4><ul class="neg">${r.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <div class="rl-proj"><span><em>Projection</em> ${esc(r.proj)}${r.rd ? ` · round ${r.rd}` : ''}</span>${r.comp ? `<span><em>${r.comp.startsWith('Comp:') ? 'Comp' : 'Plays like'}</em> ${esc(r.comp.replace(/^(Comp: |Plays like )/, ''))}</span>` : ''}</div></div>`;
}
// everyone else: today's measurables (and his combine line), his role, a comp for young players, his old draft report
function rlCardPanel(p, prospect) {
  if (prospect) return '';
  const m = msrOf(p), c = p.comb, cmp = plkFor(p), r = p.sc && p.sc.dgs ? dgrLatest(p) : null;
  const moved = c && c.forty != null && Math.abs(c.forty - m.forty) >= 0.03 ? `<span class="small mute">Ran ${c.forty.toFixed(2)} at the ${c.y} combine; ${m.forty > c.forty ? 'a step slower now' : 'faster now'}.</span>` : '';
  return `<details class="rl-sec rl-card"><summary><b>Measurables</b>${moved ? '' : '<span class="small mute"> · today</span>'}</summary>${rlMsGrid(p, m)}${moved}</details>
    ${cmp ? `<div class="rl-comp small"><em>${cmp.file ? 'Comp' : 'Plays like'}</em> ${esc(cmp.txt)}${cmp.file ? '' : ` <span class="mute">· ${esc(cmp.tag)} · ${esc(cmp.why)}</span>`}</div>` : ''}
    ${r ? `<details class="rl-old"><summary class="small mute">Pre-draft scouting report</summary>${rlReport(r, p)}</details>` : ''}`;
}
// the prospect card's extra buttons: a private workout (mini-game) before the draft
function rlWorkoutBtn(p) {
  if (!p.draft || !pwoOpen()) return ''; const S = pwoState(), done = S.wo.includes(p.id);
  return `<button class="sm ${done ? '' : 'go'}" onclick="mgmOpen(${p.id},'wo')" ${done || pwoLeft() <= 0 ? 'disabled' : ''} title="Run him through a drill yourself: a good workout reveals more">${done ? 'Worked out ✓' : `Private workout (${pwoLeft()} left)`}</button>`;
}
// ---------- combine results (Scouting and Draft screens) ----------
function rlBoardToggle(key) { const v = SUB[key] || 'board'; return `<div class="seg rl-tog">${[['board', 'Board'], ['comb', 'Combine']].map(([k, n]) => `<button class="${v === k ? 'on' : ''}" onclick="SUB.${key}='${k}';render()">${n}</button>`).join('')}</div>`; }
const RL_CMB_COLS = [['name', 'Prospect'], ['pos', 'Pos'], ['ht', 'Ht'], ['wt', 'Wt'], ['arm', 'Arm'], ['hand', 'Hand'], ['forty', '40'], ['ten', '10'], ['vert', 'Vert'], ['broad', 'Broad'], ['bench', 'Bench'], ['cone', '3C'], ['shuttle', 'Sh'], ['stock', 'Stock']];
function rlCmbSort(k) { if (SUB.cmbSort === k) SUB.cmbDir = -(SUB.cmbDir || 1); else { SUB.cmbSort = k; SUB.cmbDir = MS_LOWER_BETTER[k] || k === 'name' || k === 'pos' ? 1 : -1; } render(); }
function rlCombineView(view, posKey, toggleKey) {
  const pos = SUB[posKey] || 'All', rows = cmbRows(pos), k = SUB.cmbSort || 'forty', dir = SUB.cmbDir || 1, st = cmbClassStats();
  const val = (p, key) => key === 'name' ? p.ln : key === 'pos' ? POS_LIST.indexOf(p.pos) : key === 'stock' ? (p.combBump || 0) : key === 'ht' ? p.comb.ht + (p.comb.h8 || 0) / 8 : p.comb[key];
  rows.sort((a, b) => { const va = val(a, k), vb = val(b, k); if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return (va < vb ? -1 : va > vb ? 1 : 0) * dir; });
  const top = MS_DRILLS.map(([d, n]) => { const t = cmbTop(d, 1, pos === 'All' ? null : pos)[0]; return t ? `<button class="rl-tp" onclick="showPlayer(${t.id})"><span>${n}</span><b>${msrFmt(d, t.comb[d])}</b><i>${t.pos} ${esc(t.ln)}</i></button>` : ''; }).join('');
  const hot = (p, d) => { const s = st[p.pos] && st[p.pos][d], v = p.comb[d]; if (!s || s.n < 4 || v == null || !s.sd) return ''; const z = (v - s.m) / s.sd * (MS_LOWER_BETTER[d] ? -1 : 1); return z >= 1.28 ? ' hot' : z <= -1.28 ? ' cold' : ''; };
  const cell = (p, d) => { const c = p.comb, v = c[d]; if (v == null) return `<td class="dnp" title="${esc(CMB_WHY[(c.sk || {})[d]] || '')}">${(c.sk || {})[d] === 'hurt' ? 'inj' : '—'}</td>`; return `<td class="n${hot(p, d)}">${msrFmt(d, v)}${c.pd && c.pd[d] ? '<sup>*</sup>' : ''}</td>`; };
  const any = (L.draft || []).some(id => L.P[id] && L.P[id].comb);
  return `<div class="row"><h2 style="margin:0">${view === 'draft' ? 'Draft class' : 'Scouting'}</h2><span class="sp"></span>${rlBoardToggle(toggleKey)}</div>
  ${!any ? `<div class="panel" style="margin-top:10px"><h3>Combine</h3><p class="small mute">${L.draft && L.draft.length ? 'The scouting combine is held right after the playoffs. Every invited prospect is weighed, measured and timed; the rest run at their pro days when the draft opens.' : 'No draft class right now.'}</p></div>` : `
  <div class="rl-tops">${top}</div>
  <div class="chips" style="margin-top:8px">${['All', ...POS_LIST].map(x => `<button class="chip ${pos === x ? 'on' : ''}" onclick="SUB.${posKey}='${x}';render()">${x}</button>`).join('')}</div>
  <div class="panel tbl rl-cmb"><table><tr>${RL_CMB_COLS.map(([c, n]) => `<th><button class="rl-th ${k === c ? 'on' : ''}" onclick="rlCmbSort('${c}')">${n}${k === c ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr>
   ${rows.slice(0, 200).map(p => { const c = p.comb; return `<tr class="click" onclick="showPlayer(${p.id})"><td class="nm">${esc(p.fn[0])}. ${esc(p.ln)}${c.inv ? '' : ' <span class="rk">PD</span>'}</td><td>${p.pos}</td><td class="n">${msrHt(c.ht, c.h8)}</td><td class="n">${c.wt}</td><td class="n">${msrFrac(c.arm)}</td><td class="n">${msrFrac(c.hand)}</td>${['forty', 'ten', 'vert', 'broad', 'bench', 'cone', 'shuttle'].map(d => cell(p, d)).join('')}<td class="n ${p.combBump > 0.4 ? 'up' : p.combBump < -0.4 ? 'dn' : ''}">${p.combBump > 0.4 ? '▲' : p.combBump < -0.4 ? '▼' : '·'}</td></tr>`; }).join('')}</table></div>
  <p class="small mute">Tap a column to sort. Bold green = top 10% at his position in this class, red = bottom 10%. * = pro day. — = did not run it (hover for why). Stock = how his workout moved him on the other teams' boards.</p>`}`;
}
