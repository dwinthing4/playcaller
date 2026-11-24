// Roster file screens (format: src/league/95_roster.js, docs/roster-file.md): load a file or paste it, shrink its images,
// preview what changes, then apply it to this league or start a new career from it. Export writes the same format.
// Player photos are drawn where the illustrated bust would be (BUST_photo, hooked from drawBust in 00_art.js).
let RF = null;   // { src: 'title' | 'editor', file, warn, stats, mode, ratings, order }
function rfOpen(src) { RF = { src, mode: 'names', ratings: true, order: true }; rfModalLoad(); }
function rfModalLoad(err) {
  modal(`<div class="row"><h2 class="sp" style="margin:0">Roster file</h2><button class="sm ghost" onclick="closeModal()" aria-label="Close">✕</button></div>
   <p class="small">Load a Playcaller roster file with your own team names, colors, logos, player names, numbers and photos. It stays on this device: nothing is uploaded.</p>
   ${err ? `<p class="rferr" role="alert">${esc(err)}</p>` : ''}
   <input type="file" id="rffile" accept=".json,application/json,text/plain" hidden onchange="rfPickFile(this)">
   <div class="row"><button class="pri" onclick="document.getElementById('rffile').click()">Choose file</button><button onclick="closeModal()">Cancel</button></div>
   <details class="rfpaste"><summary class="small">Paste the file text instead</summary><textarea id="rfpaste" rows="5" placeholder='{"format":"playcaller-roster","version":1,"teams":[...]}'></textarea><button class="sm" onclick="rfRead((document.getElementById('rfpaste')||{}).value||'')">Read pasted text</button></details>
   <p class="small mute">To see the format, export a roster file from League › Editor, or read docs/roster-file.md.</p>`);
}
function rfPickFile(inp) { const f = inp.files && inp.files[0]; if (!f) return; if (f.size > 80e6) { rfModalLoad('That file is too big (over 80 MB).'); return; } const r = new FileReader(); r.onload = () => rfRead(String(r.result || '')); r.onerror = () => rfModalLoad('That file could not be read.'); r.readAsText(f); }
async function rfRead(text) {
  if (!String(text).trim()) { rfModalLoad('Nothing to read: choose a file or paste its text.'); return; }
  const r = rfParse(text); if (!r.ok) { rfModalLoad(r.msg); return; }
  Object.assign(RF, { file: r.file, warn: r.warn, stats: r.stats, mode: RF.src === 'title' || !L || L.picking ? (r.stats.players ? 'replace' : 'names') : 'names', ratings: r.stats.ratings > 0 });
  const bad = await rfShrinkAll(r.file); if (bad) RF.warn.push(`${bad} image${bad === 1 ? '' : 's'} could not be opened and were skipped.`);
  RF.stats = rfStats(r.file); rfModalPreview();
}
// shrink images: logos fit in 128 px (PNG keeps transparency), photos become 128 px squares cropped toward the face (JPEG)
function rfShrink(url, photo) {
  return new Promise(res => { const im = new Image(); im.onload = () => { try {
    const w = im.naturalWidth, h = im.naturalHeight; if (!w || !h) return res(null); const c = document.createElement('canvas'), x = c.getContext('2d');
    if (photo) { const s = Math.min(w, h), sx = (w - s) / 2, sy = h > w ? (h - s) * 0.12 : 0, o = Math.min(128, s); c.width = c.height = o; x.fillStyle = '#20242c'; x.fillRect(0, 0, o, o); x.drawImage(im, sx, sy, s, s, 0, 0, o, o); res(c.toDataURL('image/jpeg', 0.86)); }
    else { const k = Math.min(1, 128 / Math.max(w, h)); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); x.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }
  } catch (e) { res(null); } }; im.onerror = () => res(null); im.src = url; });
}
async function rfShrinkAll(f) {
  const jobs = []; for (const t of f.teams) { if (t.logo) jobs.push([t, 'logo', false]); for (const p of t.players) if (p.photo) jobs.push([p, 'photo', true]); }
  let bad = 0; for (let i = 0; i < jobs.length; i++) { const [o, k, ph] = jobs[i]; if (i % 12 === 0) rfProgress(i, jobs.length); const s = await rfShrink(o[k], ph); if (s) o[k] = s; else { o[k] = null; bad++; } }
  return bad;
}
function rfProgress(i, n) { modal(`<h2>Roster file</h2><p>Preparing images… ${i} of ${n}</p>${meter(n ? i / n * 100 : 0, 'var(--gold)')}`); }
function rfModalPreview() {
  const S = RF.stats, f = RF.file, inLeague = RF.src === 'editor' && L && !L.picking;
  const opt = (k, lab, dis) => `<label class="rfopt"><input type="checkbox" ${RF[k] ? 'checked' : ''} ${dis ? 'disabled' : ''} onchange="RF.${k}=this.checked;rfModalPreview()"> ${lab}</label>`;
  const head = `<div class="row"><h2 class="sp" style="margin:0">${esc(f.name)}</h2><button class="sm ghost" onclick="closeModal()" aria-label="Close">✕</button></div>
   <p class="small">${S.teams} team${S.teams === 1 ? '' : 's'} · ${S.players} players · ${S.logos} logo${S.logos === 1 ? '' : 's'} · ${S.photos} photo${S.photos === 1 ? '' : 's'}${S.ratings ? ` · ${S.ratings} with ratings` : ''}${f.author ? ` · by ${esc(f.author)}` : ''}</p>
   ${RF.warn.length ? `<ul class="rfwarn small">${RF.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
  const sw = t => t.logo ? `<img class="rflogo" src="${esc(t.logo)}" alt="">` : `<i class="rfsw" style="background:${t.c1 || '#555'};border-color:${t.c2 || '#ccc'}"></i>`;
  if (!inLeague) {
    modal(`${head}<p class="small">Start a new career with these teams. They replace the league's teams in file order${S.players ? ', with their players' : ''}. A league has 32 teams: ${f.teams.length < 32 ? `the other ${32 - f.teams.length} keep made-up names.` : f.teams.length > 32 ? `the last ${f.teams.length - 32} in the file are left out.` : 'all 32 come from the file.'}</p>
     <div class="rflist">${f.teams.slice(0, 32).map(t => `<div class="rfrow">${sw(t)}<b class="sp">${esc([t.city, t.name].filter(Boolean).join(' ') || t.abbr)}</b><span class="small mute">${t.abbr ? esc(t.abbr) + ' · ' : ''}${t.players.length} players</span></div>`).join('')}</div>
     ${S.ratings ? opt('ratings', 'Use ratings and ages from the file') : ''}
     <div class="row" style="margin-top:10px"><button class="pri" onclick="rfStartCareer()">Start new career</button><button onclick="rfModalLoad()">Pick another file</button></div>`);
    return; }
  const P = rfPlan(f, { mode: RF.mode, order: RF.order });
  modal(`${head}
   <div class="seg" role="radiogroup" aria-label="How to apply"><button class="${RF.mode === 'names' ? 'on' : ''}" onclick="RF.mode='names';rfModalPreview()">Rename players</button><button class="${RF.mode === 'replace' ? 'on' : ''}" onclick="RF.mode='replace';rfModalPreview()" ${S.players ? '' : 'disabled'}>Replace rosters</button></div>
   <p class="small mute" style="margin:6px 0">${RF.mode === 'names' ? 'Players keep their contracts. Names, numbers and photos come from the file, position by position in depth-chart order (the first QB in the file goes to your starter).' : 'Each matched team gets the players in the file; the current players retire. Empty roster spots are filled with new players. Contracts are set fresh.'}</p>
   ${S.ratings ? opt('ratings', 'Use ratings and ages from the file') : ''}${opt('order', 'Match leftover teams in file order')}
   <div class="rflist">${P.rows.map(r => { const t = f.teams[r.fi]; return `<div class="rfrow">${sw(t)}<div class="sp"><b>${esc(r.from.abbr)} ${esc(teamLabel(r.from))}</b>${r.from.abbr !== r.to.abbr || teamLabel(r.from) !== teamLabel(r.to) ? ` → <b>${esc(r.to.abbr)} ${esc(teamLabel(r.to))}</b>` : ''}${r.user ? ' <span class="tag">You</span>' : ''}
     <div class="small mute">${r.how === 'order' ? 'by order · ' : r.how === 'city' ? 'by city · ' : ''}${RF.mode === 'names' ? `${r.placed} renamed${r.extra ? `, ${r.extra} more than the roster has` : ''}` : `${Math.min(53, r.players)} players${r.fill ? `, ${r.fill} spots filled` : ''}`}${r.photos ? ` · ${r.photos} photos` : ''}${r.logo ? ' · logo' : ''}</div></div></div>`; }).join('') || '<p class="small">No team in the file matches a team in this league.</p>'}</div>
   ${P.unmatched.length ? `<p class="small rferr">${P.unmatched.length} team${P.unmatched.length === 1 ? '' : 's'} in the file did not match (${P.unmatched.slice(0, 4).map(t => esc(t.abbr || t.city)).join(', ')}${P.unmatched.length > 4 ? '…' : ''}). Turn on “Match leftover teams in file order” to use them anyway.</p>` : ''}
   <div class="row" style="margin-top:10px"><button class="pri" onclick="rfDoApply()" ${P.rows.length ? '' : 'disabled'}>Apply to this league</button><button onclick="closeModal()">Cancel</button></div>`);
}
function rfDoApply() { if (!RF || !RF.file) return; const r = rfApply(RF.file, { mode: RF.mode, ratings: RF.ratings, order: RF.order }); closeModal(); RF = null; saveGame(true); render(); toast(r.msg); rfStoreCheck(); }
function rfStartCareer() { const slot = NG.slot || freeSlot(); if (!slot) { toast('All career slots are full. Delete one first.'); return; } NG.slot = slot; NG.rf = { file: RF.file, mode: RF.stats.players ? 'replace' : 'names', ratings: RF.ratings }; RF = null; closeModal(); renderTitle(); }
function rfStoreCheck() { setTimeout(() => { if (IMG_WARN) toast('Photos are too big to keep on this device; they will show until you close the game.'); }, 1500); }
function rfDownload() {
  const T = UT(), obj = rfExport({ name: `${teamLabel(T)} league, ${L.year}` }), s = JSON.stringify(obj);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' })); a.download = `playcaller-roster-${L.year}.json`; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast(`Roster file saved (${Math.max(1, Math.round(s.length / 1024))} KB)`);
}
// ---------- photos on busts ----------
const PHOTO_IM = new Map(); let PHOTO_WAIT = new Set(), PHOTO_T = 0;
function BUST_photo(x, p, T) {
  const url = imgGet(p.photo); if (!url) return false; let im = PHOTO_IM.get(p.photo);
  if (!im) { im = new Image(); im.onload = () => { clearTimeout(PHOTO_T); PHOTO_T = setTimeout(BUST_repaint, 40); }; im.src = url; PHOTO_IM.set(p.photo, im); if (PHOTO_IM.size > 600) PHOTO_IM.delete(PHOTO_IM.keys().next().value); }
  if (!im.complete || !im.naturalWidth) { PHOTO_WAIT.add(p.id); return false; }
  const K = T ? (T.kit || T) : null, c1 = K ? (K.c1 || K.jersey) : '#4a5878', c2 = K ? (K.c2 || K.trim || '#cfd6e6') : '#cfd6e6';
  x.save(); if (p.nobg) { x.beginPath(); x.arc(48, 46, 44, 0, 7); x.clip(); } else BUST_bg(x, c1, c2);
  const w = im.naturalWidth, h = im.naturalHeight, s = Math.min(w, h); x.drawImage(im, (w - s) / 2, h > w ? (h - s) * 0.12 : 0, s, s, 0, 0, 96, 96);
  if (!p.nobg) { const vg = x.createLinearGradient(0, 62, 0, 96); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = vg; x.fillRect(0, 0, 96, 96); x.fillStyle = c1; x.fillRect(0, 92, 96, 4); }
  x.restore(); return true;
}
function BUST_repaint() { const ids = PHOTO_WAIT; PHOTO_WAIT = new Set(); if (!L) return;
  for (const id of ids) document.querySelectorAll(`canvas[data-bust="${id}"]`).forEach(cn => { try { const p = L.P[id]; if (!p) return; const t = p.tid != null ? L.teams[p.tid] : (cn.dataset.tid ? L.teams[cn.dataset.tid] : null); const cx = cn.getContext('2d'); cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cn.width, cn.height); cx.setTransform(cn.width / 96, 0, 0, cn.width / 96, 0, 0); drawBust(cx, p, t); } catch (e) { } }); }
