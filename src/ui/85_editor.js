// League editor: rename any team or player, recolor a team, upload its logo, or paste a whole roster (position, name, number per line).
// Everything stays in this save on this device.
const ED_POS_ALIAS = { HB: 'RB', TB: 'RB', T: 'OT', LT: 'OT', RT: 'OT', G: 'OG', LG: 'OG', RG: 'OG', OL: 'OG', EDGE: 'DE', DL: 'DT', NT: 'DT', ILB: 'LB', OLB: 'LB', MLB: 'LB', DB: 'CB', FS: 'S', SS: 'S', PK: 'K' };
function edNormPos(p) { p = String(p || '').toUpperCase().replace(/[^A-Z]/g, ''); return POS_LIST.includes(p) ? p : ED_POS_ALIAS[p] || null; }
function edDepthOrder(T, pos) { const d = (T.depth[pos] || []).filter(id => L.P[id] && L.P[id].tid === T.id); return d.concat(T.roster.filter(id => L.P[id] && L.P[id].pos === pos && !d.includes(id))); }
VIEWS.editor = function () {
  const tid = SUB.edTeam != null && L.teams[SUB.edTeam] ? SUB.edTeam : L.user, T = L.teams[tid];
  const order = {}; for (const pos of POS_LIST) edDepthOrder(T, pos).forEach((id, i) => { order[id] = i; });
  const ps = T.roster.map(id => L.P[id]).filter(Boolean).sort((a, b) => POS_LIST.indexOf(a.pos) - POS_LIST.indexOf(b.pos) || (order[a.id] ?? 99) - (order[b.id] ?? 99));
  return `<div class="panel"><div class="row" style="gap:10px"><h2 style="margin:0">League editor</h2><span class="sp"></span><select onchange="SUB.edTeam=+this.value;render()">${L.teams.map(t => `<option value="${t.id}" ${t.id === tid ? 'selected' : ''}>${esc(teamLabel(t))}${t.id === L.user ? ' (you)' : ''}</option>`).join('')}</select></div>
    <p class="small mute">Rename any team or player, change colors, or upload a logo image. Changes stay in this save on this device.</p>
    <div class="edteam">${logoC(T, 72)}<div class="edgrid">
      <label>City<input value="${esc(T.city)}" maxlength="22" onchange="edTeam(${tid},'city',this.value)"></label>
      <label>Nickname<input value="${esc(T.name === T.city ? '' : T.name)}" maxlength="20" placeholder="none: goes by the city" onchange="edTeam(${tid},'name',this.value)"></label>
      <label>Abbreviation<input value="${esc(T.abbr)}" maxlength="4" onchange="edTeam(${tid},'abbr',this.value)"></label>
      <label>Colors<span class="edcols"><input type="color" value="${esc(T.c1)}" title="Primary" onchange="edTeam(${tid},'c1',this.value)"><input type="color" value="${esc(T.c2)}" title="Secondary" onchange="edTeam(${tid},'c2',this.value)"><input type="color" value="${esc(T.hel || T.c1)}" title="Helmet" onchange="edTeam(${tid},'hel',this.value)"><small>primary · secondary · helmet</small></span></label>
    </div></div>
    <div class="row" style="margin-top:8px"><input type="file" accept="image/*" id="edlogo" hidden onchange="edLogo(${tid},this)"><button class="sm" onclick="document.getElementById('edlogo').click()">Upload logo image</button>${T.logoImg ? `<button class="sm" onclick="edTeam(${tid},'logoImg','')">Remove uploaded logo</button>` : ''}</div></div>
  <div class="panel" style="margin-top:10px"><h3>Roster file</h3><p class="small mute">Load a file with your own team names, logos, player names and photos for the whole league, or export this league to share it. Files stay on your device.</p>
    <div class="row"><button class="pri" onclick="rfOpen('editor')">Load roster file</button><button onclick="rfDownload()">Export roster file</button></div></div>
  <div class="panel" style="margin-top:10px"><h3>Paste a roster</h3><p class="small mute">One player per line: position, name, number (for example <code>QB, Jordan Example, 12</code>). Lines fill that position in depth-chart order (the first QB line goes to the starter). Ratings do not change.</p>
    <textarea id="edpaste" rows="6" style="width:100%" placeholder="QB, First Last, 12&#10;RB, First Last, 26&#10;WR, First Last, 11"></textarea>
    <div class="row" style="margin-top:6px"><button class="pri" onclick="edPaste(${tid})">Apply to ${esc(T.abbr)}</button></div></div>
  <div class="panel tbl" style="margin-top:10px"><table class="edtbl"><tr><th>Pos</th><th>#</th><th>First</th><th>Last</th><th>OVR</th></tr>${ps.map(p => `<tr><td>${p.pos}</td><td><input class="ednum" type="number" min="0" max="99" value="${p.num}" onchange="edPl(${p.id},'num',this.value)"></td><td><input value="${esc(p.fn)}" maxlength="20" onchange="edPl(${p.id},'fn',this.value)"></td><td><input value="${esc(p.ln)}" maxlength="24" onchange="edPl(${p.id},'ln',this.value)"></td><td>${ovrTag(p.ovr)}</td></tr>`).join('')}</table></div>`;
};
function edTeam(tid, k, v) {
  const T = L.teams[tid]; if (!T) return; v = String(v == null ? '' : v).trim();
  if (k === 'name') T.name = v || T.city;
  else if (k === 'city') { if (!v) return; const bare = T.name === T.city; T.city = v; if (bare) T.name = v; }
  else if (k === 'abbr') { if (v) T.abbr = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || T.abbr; }
  else if (k === 'logoImg') delete T.logoImg;
  else if (/^#[0-9a-f]{6}$/i.test(v)) T[k] = v;
  if (k === 'c1' || k === 'c2' || k === 'hel') resetKits(T);
  saveGame(); render();
}
function edPl(pid, k, v) { const p = L.P[pid]; if (!p) return; if (k === 'num') p.num = clamp(Math.round(+v || 0), 0, 99); else { const s = String(v).trim(); if (s) p[k] = s; } saveGame(); }
function edLogo(tid, inp) { const f = inp.files[0], T = L.teams[tid]; if (!f || !T) return; const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'), s = Math.min(1, 320 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); T.logoImg = c.toDataURL('image/png'); saveGame(); render(); }; im.src = r.result; }; r.readAsDataURL(f); }
function edPaste(tid) {
  const T = L.teams[tid], txt = (document.getElementById('edpaste') || {}).value || '', by = {}; let n = 0, bad = 0;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue; let pos, name, num; const parts = line.split(/\s*[,\t;|]\s*/).filter(Boolean);
    if (parts.length >= 2) { pos = parts[0]; name = parts[1]; num = parts[2]; }
    else { const m = line.match(/^([A-Za-z]{1,4})\s+(.+?)(?:\s+#?(\d{1,2}))?$/); if (!m) { bad++; continue; } pos = m[1]; name = m[2]; num = m[3]; }
    pos = edNormPos(pos); name = String(name || '').replace(/^#?\d{1,2}\s+/, '').trim(); if (!pos || !name) { bad++; continue; }
    (by[pos] = by[pos] || []).push({ name, num: num != null && /^\d{1,2}$/.test(String(num).replace('#', '')) ? +String(num).replace('#', '') : null });
  }
  for (const pos in by) { const ids = edDepthOrder(T, pos); by[pos].forEach((e, i) => { const p = L.P[ids[i]]; if (!p) { bad++; return; } const w = e.name.split(/\s+/); p.fn = w[0]; if (w.length > 1) p.ln = w.slice(1).join(' '); if (e.num != null) p.num = e.num; n++; }); }
  saveGame(); toast(`Renamed ${n} player${n === 1 ? '' : 's'}${bad ? ` · ${bad} line${bad === 1 ? '' : 's'} skipped` : ''}`); render();
}
