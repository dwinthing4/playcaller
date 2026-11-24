// Stats screens: the player card's season table (tap a season for his week-by-week log), box scores, schedule slots.
// ---------- player card: seasons + game logs ----------
const ST_ROUND = ['WC', 'DIV', 'CONF', 'FINAL'];
// the key columns for a position: [label, value(s), align]; s = a stat line (season, career or one game)
function stCols(pos) {
  const pct = (a, b) => (b ? (a / b * 100).toFixed(1) : '-'), avg = (a, b) => (b ? (a / b).toFixed(1) : '-');
  if (pos === 'QB') return [['Cmp', s => s.pc || 0], ['Att', s => s.pa || 0], ['Pct', s => pct(s.pc || 0, s.pa)], ['Yds', s => s.py || 0], ['Y/A', s => avg(s.py || 0, s.pa)], ['TD', s => s.ptd || 0], ['INT', s => s.pint || 0], ['Rush', s => s.ry || 0]];
  if (pos === 'RB' || pos === 'FB') return [['Car', s => s.ra || 0], ['Yds', s => s.ry || 0], ['Y/C', s => avg(s.ry || 0, s.ra)], ['TD', s => s.rtd || 0], ['Rec', s => s.rec || 0], ['RecYds', s => s.recy || 0], ['Fum', s => s.fum || 0]];
  if (pos === 'WR' || pos === 'TE') return [['Tgt', s => s.tgt || 0], ['Rec', s => s.rec || 0], ['Yds', s => s.recy || 0], ['Y/R', s => avg(s.recy || 0, s.rec)], ['TD', s => s.rectd || 0]];
  if (pos === 'K') return [['FG', s => `${s.fgm || 0}/${s.fga || 0}`], ['Pct', s => pct(s.fgm || 0, s.fga)], ['XP', s => `${s.xpm || 0}/${s.xpa || 0}`]];
  if (pos === 'P') return [['Punts', s => s.pnt || 0], ['Yds', s => s.pnty || 0], ['Avg', s => avg(s.pnty || 0, s.pnt)]];
  if (pos === 'OT' || pos === 'OG' || pos === 'C') return [['Snaps', s => s.snaps || 0]];
  if (pos === 'CB' || pos === 'S') return [['Tkl', s => s.tk || 0], ['INT', s => s.int || 0], ['PD', s => s.pd || 0], ['Sacks', s => s.sk || 0], ['FF', s => s.ff || 0]];
  return [['Tkl', s => s.tk || 0], ['Sacks', s => s.sk || 0], ['FF', s => s.ff || 0], ['INT', s => s.int || 0], ['PD', s => s.pd || 0]];
}
function stSeasons(p) { const st = p.st || {}; return [...(p.hist || []), ...(st.gp && L.phase !== 'offseason' ? [Object.assign({ y: L.year, t: p.tid, cur: 1, ql: L.qlen }, st)] : [])]; }
function stSum(rows) { const o = {}; for (const r of rows) for (const k in r) if (typeof r[k] === 'number' && k !== 'y' && k !== 't' && k !== 'ql' && k !== 'mine') o[k] = (o[k] || 0) + r[k]; return o; }
// the Stats section of the player card (40_team.js showPlayer): one row per season + career; tap a season for his game log
function plStatsBlock(p) {
  const rows = stSeasons(p), cols = stCols(p.pos), qs = [...new Set(rows.map(r => r.ql || 0))], showQ = qs.length > 1;
  const n = 3 + cols.length + (showQ ? 1 : 0);
  const cell = (c, s) => `<td>${c[1](s)}</td>`;
  const body = rows.map(r => `<tr class="click plsr" data-y="${r.y}" onclick="plSeason(this,${p.id},${r.y},${n})"><td><span class="plchev">▸</span>${r.y}${r.cur ? '*' : ''}</td><td>${r.t != null && L.teams[r.t] ? esc(L.teams[r.t].abbr) : '-'}</td><td>${r.gp || 0}</td>${cols.map(c => cell(c, r)).join('')}${showQ ? `<td class="mute">${r.ql ? r.ql / 60 + 'm' : 'old'}</td>` : ''}</tr>`).join('');
  const car = rows.length > 1 ? (() => { const s = stSum(rows); return `<tr class="plcar"><td>Career</td><td></td><td>${s.gp || 0}</td>${cols.map(c => cell(c, s)).join('')}${showQ ? '<td></td>' : ''}</tr>`; })() : '';
  return `<h3 style="margin-top:10px">Stats <span class="small mute" style="font-weight:400">${rows.length ? 'Tap a season for game by game' : ''}</span></h3>
   <div class="tbl"><table class="mini plst"><tr><th>Year</th><th>Team</th><th>GP</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}${showQ ? '<th title="Quarter length">Qtr</th>' : ''}</tr>${body || `<tr><td colspan=${n} class="mute">No games yet</td></tr>`}${car}</table></div>
   ${showQ ? '<p class="small mute">Seasons were played with different quarter lengths (Qtr), so the totals are on different scales.</p>' : ''}`;
}
// open / close one season's week-by-week log under its row
function plSeason(tr, pid, y, n) {
  const nx = tr.nextElementSibling; if (nx && nx.classList.contains('plgl')) { nx.remove(); tr.classList.remove('open'); return; }
  const p = L.P[pid]; if (!p) return; const games = glSeason(p, y), cols = stCols(p.pos);
  const row = document.createElement('tr'); row.className = 'plgl'; tr.classList.add('open');
  if (!games.length) row.innerHTML = `<td colspan=${n} class="small mute">No week-by-week log for ${y}. Game logs are kept for this season and last season (every season for your own players).</td>`;
  else row.innerHTML = `<td colspan=${n}><div class="tbl"><table class="mini plgt"><tr><th>Wk</th><th>Opp</th><th>Result</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}${['OT', 'OG', 'C'].includes(p.pos) ? '' : '<th>Snaps</th>'}</tr>
    ${games.map(gm => { const o = L.teams[gm.opp], res = gm.my > gm.th ? 'W' : gm.my < gm.th ? 'L' : 'T', wk = gm.po ? ST_ROUND[gm.w] || 'PO' : gm.w + 1;
      return `<tr class="click" onclick="boxOpp(${y},${gm.po ? -1 : gm.w},${gm.opp},${gm.po ? gm.w : 'null'})"><td>${wk}</td><td>${gm.ha === 'a' || gm.ha === 'na' ? '@' : 'vs'} ${o ? esc(o.abbr) : '?'}${gm.ha[0] === 'n' ? '*' : ''}</td><td class="${res === 'W' ? 'plw' : res === 'L' ? 'pll' : ''}">${res} ${gm.my}-${gm.th}</td>${cols.map(c => `<td>${c[1](gm.s)}</td>`).join('')}${['OT', 'OG', 'C'].includes(p.pos) ? '' : `<td class="mute">${gm.s.snaps || 0}</td>`}</tr>`; }).join('')}</table></div>${games.some(g => g.ha[0] === 'n') ? '<div class="small mute">* neutral site</div>' : ''}</td>`;
  tr.after(row);
}
// ---------- box scores ----------
const ST_TS = [['First downs', 'fd'], ['Total yards', 'ty'], ['Passing', 'py'], ['Rushing', 'ry'], ['Comp / att', s => `${s.pc}/${s.pa}`], ['Carries', 'ra'], ['Sacks allowed', 'sk'], ['3rd down', 'td3'], ['Turnovers', 'to'], ['Penalties', s => `${s.pen}-${s.peny}`], ['Time of poss.', s => s.top ? `${Math.floor(s.top / 60)}:${String(Math.round(s.top % 60)).padStart(2, '0')}` : '-']];
// from a game log line: the game that week (or playoff round) against that opponent
function boxOpp(y, w, opp, rd) { const r = (L.results || []).find(x => x.y === y && (x.h === opp || x.a === opp) && (rd != null ? x.po && x.rd === rd : !x.po && x.w === w)); if (!r) { toast('No box score for that game.'); return; } boxModal(y, r.w, r.h, r.a, r.po ? r.rd : null); }
function boxModal(y, w, h, a, rd) {
  const r = boxFor(y, w, h, a, rd), H = L.teams[h], A = L.teams[a]; if (!H || !A) return;
  if (!r) { toast('No box score for that game.'); return; }
  const b = r.bx, wk = r.po ? 'P' + r.rd : String(r.w), lines = glBoxLines(r, wk, r.y);
  const title = r.po ? ROUND_NAMES[r.rd] || 'Playoffs' : `Week ${r.w + 1}`, g0 = (L.sched[r.w] || []).find(x => x.h === h && x.a === a), where = g0 ? slotLabel(g0) : '';
  const ls = b && b.ls, nq = ls ? ls[0].length : 0;
  const lineScore = ls ? `<table class="mini bxls"><tr><th></th>${ls[0].map((_, i) => `<th>${i < 4 ? i + 1 : 'OT'}</th>`).join('')}<th>T</th></tr>${[[A, ls[0], r.as], [H, ls[1], r.hs]].map(([t, q, tot]) => `<tr><td><b>${esc(t.abbr)}</b></td>${q.map(v => `<td>${v}</td>`).join('')}<td><b>${tot}</b></td></tr>`).join('')}</table>` : '';
  const ts = b && b.ts ? `<table class="mini bxts"><tr><th>${esc(A.abbr)}</th><th></th><th>${esc(H.abbr)}</th></tr>${ST_TS.map(([lab, k]) => { const f = typeof k === 'function' ? k : s => s[k]; if (b.live && (k === 'fd' || k === 'td3' || lab === 'Time of poss.')) return ''; return `<tr><td>${f(b.ts[0])}</td><td class="mute">${lab}</td><td>${f(b.ts[1])}</td></tr>`; }).join('')}</table>` : '';
  const P = id => L.P[id], nm = id => { const p = P(id); return p ? `<span class="click" onclick="showPlayer(${id})">${esc(p.fn[0])}. ${esc(p.ln)}</span>` : '—'; };
  const grp = (side, lab, test, fmt, sort) => { const ls2 = lines[side].filter(([, s]) => test(s)).sort((x, y2) => sort(y2[1]) - sort(x[1])); if (!ls2.length) return ''; return `<tr class="bxg"><td colspan=2>${lab}</td></tr>${ls2.slice(0, 6).map(([id, s]) => `<tr><td>${nm(id)}</td><td>${fmt(s)}</td></tr>`).join('')}`; };
  const teamLines = side => `<table class="mini bxpl">${grp(side, 'Passing', s => s.pa, s => `${s.pc || 0}/${s.pa} · ${s.py || 0} yds${s.ptd ? ' · ' + s.ptd + ' TD' : ''}${s.pint ? ' · ' + s.pint + ' INT' : ''}`, s => s.pa)}
    ${grp(side, 'Rushing', s => s.ra, s => `${s.ra} car · ${s.ry || 0} yds${s.rtd ? ' · ' + s.rtd + ' TD' : ''}`, s => s.ry || 0)}
    ${grp(side, 'Receiving', s => s.rec || s.tgt, s => `${s.rec || 0} rec (${s.tgt || 0} tgt) · ${s.recy || 0} yds${s.rectd ? ' · ' + s.rectd + ' TD' : ''}`, s => s.recy || 0)}
    ${grp(side, 'Defense', s => s.tk || s.sk || s.int, s => `${s.tk || 0} tkl${s.sk ? ' · ' + s.sk + ' sk' : ''}${s.int ? ' · ' + s.int + ' INT' : ''}${s.ff ? ' · FF' : ''}`, s => (s.tk || 0) + (s.sk || 0) * 3 + (s.int || 0) * 4)}
    ${grp(side, 'Kicking', s => s.fga || s.xpa || s.pnt, s => [s.fga || s.xpa ? `FG ${s.fgm || 0}/${s.fga || 0} · XP ${s.xpm || 0}/${s.xpa || 0}` : '', s.pnt ? `${s.pnt} punts · ${(s.pnty / s.pnt).toFixed(1)} avg` : ''].filter(Boolean).join(' · '), s => (s.fga || 0) + (s.pnt || 0))}</table>`;
  const dr = b && b.dr ? b.dr : [], scoring = dr.filter(d => /TD|FG|Safety|touchdown/i.test(d[5]) && d[6]);
  const drives = dr.length ? `<details ${b.pruned ? '' : ''}><summary class="small">${b.pruned ? 'Scoring summary' : 'Drive chart'} (${b.pruned ? scoring.length : dr.length})</summary><table class="mini bxdr"><tr><th>Q</th><th>Team</th><th>Plays</th><th>Yds</th><th>Result</th></tr>${dr.map(d => `<tr><td>${d[0] <= 4 ? d[0] : 'OT'}${d[1] ? ' ' + Math.floor(d[1] / 60) + ':' + String(d[1] % 60).padStart(2, '0') : ''}</td><td>${esc((d[2] ? H : A).abbr)}</td><td>${d[3]}</td><td>${d[4]}</td><td>${esc(d[5])}${d[6] ? `<div class="small mute">${esc(d[6])}</div>` : ''}</td></tr>`).join('')}</table></details>` : '';
  modal(`<div class="row" style="flex-wrap:nowrap"><div class="sp"><div class="small mute">${esc(title)}${where ? ' · ' + esc(where) : ''} · ${r.y}${r.ot ? ' · OT' : ''}${b && b.live ? ' · played live' : ''}</div></div><button class="sm ghost" onclick="closeModal()">✕</button></div>
   <div class="bxhd">${[[A, r.as], [H, r.hs]].map(([t, s], i) => `<div class="bxt ${i ? 'h' : ''}">${logoC(t, 44)}<div><b>${esc(t.name)}</b><span class="small mute">${esc(t.abbr)}</span></div><span class="bxsc ${s > (i ? r.as : r.hs) ? 'w' : ''}">${s}</span></div>`).join('<span class="bxat">@</span>')}</div>
   ${lineScore}${ts}
   ${lines[0].length || lines[1].length ? `<div class="grid g2 bxcols"><div><h3>${esc(A.abbr)}</h3>${teamLines(0)}</div><div><h3>${esc(H.abbr)}</h3>${teamLines(1)}</div></div>` : ''}
   ${drives}`, 'wide');
}
