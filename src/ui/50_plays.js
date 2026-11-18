// Plays: game plan (coordinator meeting), playbook, play editor, play diagrams.
function drawPlayArt(cn, p, sel, live) {
  const c = cn.getContext('2d'), W = cn.width, H = cn.height; c.clearRect(0, 0, W, H);
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#2c8239' : '#329443'; c.fillRect(0, i * H / 8, W, H / 8 + 1); }
  const sc = W / 54, losY = Math.round(H * (p.side === 'O' ? 0.66 : 0.4)); const X = y => Math.round(y * sc), Y = dx => Math.round(losY - dx * sc);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, losY, W, 2); const ds = Math.max(4, Math.round(sc * 2.2)); const lw = Math.max(2, W / 100);
  const dot = (dx, y, col) => { c.fillStyle = '#000'; c.fillRect(X(y) - ds / 2 - 1, Y(dx) - ds / 2 - 1, ds + 2, ds + 2); c.fillStyle = col; c.fillRect(X(y) - ds / 2, Y(dx) - ds / 2, ds, ds); };
  if (p.side === 'O') {
    const F = OFF_FORMS[p.form] || OFF_FORMS.Shotgun; const side = p.rside === 'L' ? -1 : 1; const bl = resolveBlocks(p, side); const gy = MID_YD + side * (GAPS[p.gap || (p.dir === 'outside' ? 'D' : 'B')] || 3.3);
    for (const s of OL_SLOTS) { const a = bl[s[0]] || { t: 'pass', d: 0 }; const x0 = s[3], y0 = MID_YD + s[4]; let ex = x0 + 2.2, ey = y0;
      if (a.t === 'zone') { ex = x0 + 1.8; ey = y0 + a.d * 1.8; } else if (a.t === 'reach') { ex = x0 + 1; ey = y0 + a.d * 2.4; } else if (a.t === 'down') { ex = x0 + 1.8; ey = y0 + a.d * 2.2; } else if (a.t === 'climb') ex = x0 + 4.5; else if (a.t === 'pass') ex = x0 - 2; else if (a.t === 'draw') ex = x0 - 1.2;
      const cp = p.paths && p.paths[s[0]]; c.strokeStyle = a.t === 'pull' ? '#ff9b4a' : a.t === 'pass' ? '#9fd0ff' : '#ffffff'; c.lineWidth = lw; c.beginPath(); c.moveTo(X(y0), Y(x0));
      if (cp && cp.length) { for (const [f, l] of cp) c.lineTo(X(y0 + l), Y(x0 + f)); } else if (a.t === 'pull') { c.lineTo(X(gy - side * 1.5), Y(x0 - 1.6)); c.lineTo(X(gy), Y(x0 + 2.5)); } else c.lineTo(X(ey), Y(ex)); c.stroke(); dot(x0, y0, '#c9d2dc'); }
    for (const s of F.slots) { const x0 = s[3], y0 = MID_YD + s[4]; const r = (p.routes || {})[s[0]]; const cp = p.paths && p.paths[s[0]];
      if (cp && cp.length) { c.strokeStyle = p.type === 'run' && p.carrier === s[0] ? '#ff5a5a' : '#ffe066'; c.lineWidth = lw; c.beginPath(); c.moveTo(X(y0), Y(x0)); for (const [f, l] of cp) c.lineTo(X(y0 + l), Y(x0 + f)); c.stroke(); }
      else if (r && ROUTES[r] && r !== 'block' && !(p.type === 'run' && p.carrier === s[0])) { const inward = y0 < MID_YD ? 1 : -1; c.strokeStyle = '#ffe066'; c.lineWidth = lw; c.beginPath(); c.moveTo(X(y0), Y(x0)); for (const [f, i] of ROUTES[r]) c.lineTo(X(clamp(y0 + i * inward, 0.5, 53)), Y(x0 + f)); c.stroke(); }
      else if (p.type === 'run' && p.carrier === s[0]) { c.strokeStyle = '#ff5a5a'; c.lineWidth = lw * 1.2; c.beginPath(); c.moveTo(X(y0), Y(x0)); c.lineTo(X(gy), Y(0)); c.lineTo(X(gy), Y(6)); c.stroke(); }
      if (p.motion && p.motion.slot === s[0]) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(y0), Y(x0 - 0.6)); c.lineTo(X(MID_YD + (MID_YD - y0) * 0.6), Y(x0 - 0.6)); c.stroke(); c.setLineDash([]); }
      dot(x0, y0, s[0] === 'QB' ? '#ffb627' : '#ffffff'); }
    if (sel) { const sp = F.slots.concat(OL_SLOTS).find(z => z[0] === sel); if (sp) { c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.beginPath(); c.arc(X(MID_YD + sp[4]), Y(sp[3]), ds * 1.3, 0, 7); c.stroke(); } }
    if (live && live.length > 1) { c.strokeStyle = '#ffd23f'; c.lineWidth = lw * 1.4; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(X(live[0][1]), Y(live[0][0])); for (const q of live) c.lineTo(X(q[1]), Y(q[0])); c.stroke(); c.setLineDash([]); }
  } else {
    const F = DEF_FORMS[p.form] || DEF_FORMS['4-3']; const Z = COV_ZONES[p.cov] || (p.cov === 'c2m' ? COV_ZONES.c2.slice(0, 2) : null);
    if (Z) for (const z of Z) { c.strokeStyle = z[0] >= 13 ? 'rgba(120,200,255,.9)' : 'rgba(255,224,102,.85)'; c.lineWidth = 2; c.beginPath(); c.ellipse(X(z[1]), Y(-z[0] * 0.8), sc * 4.5, sc * 2.6, 0, 0, 7); c.stroke(); }
    else { c.font = `600 ${Math.round(W / 12)}px ${CANVAS_FONT}`; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillStyle = '#fff'; c.fillText(p.cov === 'c0' ? 'MAN, NO HELP' : 'MAN + DEEP SAFETY', 4, H - 2); }
    for (const s of F.slots) { const blz = (p.blitz || []).includes(s[0]) || s[1] === 'DE' || s[1] === 'DT'; if (blz && s[1] !== 'DE' && s[1] !== 'DT') { c.strokeStyle = '#ff5a5a'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(MID_YD + s[4]), Y(-s[3] * 0.8)); c.lineTo(X(MID_YD + s[4] * 0.3), Y(2)); c.stroke(); } dot(-s[3] * 0.8, MID_YD + s[4], blz ? '#ff6b6b' : '#8ecbff'); }
  }
}
function paintPlays(root) { (root || app).querySelectorAll('canvas[data-play]').forEach(cn => { const p = L.plays.find(x => x.id === cn.dataset.play) || (EDP && EDP.id === cn.dataset.play ? EDP : null); if (p) drawPlayArt(cn, p); }); }
function playSub(p) { return p.side === 'O' ? `${(OFF_FORMS[p.form] || OFF_FORMS.Shotgun).lab.split(' ')[0]} · ${p.type === 'run' ? (SCHEMES[p.scheme] || 'Run') : 'Pass'}${p.pa ? ' · PA' : ''}` : `${(DEF_FORMS[p.form] || DEF_FORMS['4-3']).lab.split(' ')[0]} · ${covName(p.cov)}${p.blitz.length ? ' · Blitz' : ''}`; }
// ---------- game plan / coordinator meeting ----------
const OC_EMPH = { run: ['Establish the run', 'Lean on the ground game'], deep: ['Attack deep', 'More vertical shots'], quick: ['Quick game', 'Get the ball out fast'] };
const DC_EMPH = { blitz: ['Bring pressure', 'Blitz more often'], safe: ['Keep it in front', 'Two-deep zones, no big plays'], run: ['Stop the run', 'Load the box on early downs'] };
function weekPlan() { if (!L.splan || L.splan.y !== L.year || L.splan.w !== L.week) L.splan = { y: L.year, w: L.week, oc: null, dc: null }; return L.splan; }
VIEWS.plan = function () {
  const P = ensurePlan(); if (!P) return `<div class="panel"><h2>Game plan</h2><p class="mute">No game this week.</p></div>`;
  const T = UT(), opp = L.teams[P.opp]; const side = SUB.planSide, scen = SUB.planScen; const co = side === 'O' ? T.oc : T.dc; const sel = P[side][scen] || [];
  const list = playsFor(L.user, side); const W = weekPlan(); const E = side === 'O' ? OC_EMPH : DC_EMPH; const ek = side === 'O' ? 'oc' : 'dc';
  AFTER.push(() => paintPlays(app));
  return `<div class="panel brief"><div class="row"><h2 style="margin:0">Coordinator meeting</h2><span class="sp"></span>${P.locked ? '<span class="tag t">Plan locked</span>' : ''}</div>
   <p class="small mute">Week ${L.week + 1} vs ${esc(teamName(opp))}. Your coordinators recommend up to 3 plays for every situation. Swap any of them, then lock the plan. These are the calls they pitch to you in the game.</p>
   <div class="say">${lookC(T.oc.lk, 52)}<p><b>${esc(T.oc.fn)} ${esc(T.oc.ln)} (OC, ${OCP[T.oc.persona][0]}):</b> ${esc(P.intro.O)}</p></div>
   <div class="say">${lookC(T.dc.lk, 52)}<p><b>${esc(T.dc.fn)} ${esc(T.dc.ln)} (DC, ${DCP[T.dc.persona][0]}):</b> ${esc(P.intro.D)}</p></div>
   <div class="row"><button class="${P.locked ? '' : 'pri'}" onclick="planLock(${!P.locked});saveGame();render()">${P.locked ? 'Unlock plan' : 'Lock in plan'}</button><button class="sm" onclick="planReset();saveGame();render()">Reset to coordinator picks</button></div></div>
  <div class="row" style="margin:10px 0"><div class="seg">${[['O', 'Offense'], ['D', 'Defense']].map(([k, n]) => `<button class="${side === k ? 'on' : ''}" onclick="SUB.planSide='${k}';render()">${n}</button>`).join('')}</div>
   <span class="small mute">This week's emphasis:</span>${Object.entries(E).map(([k, [n, d]]) => `<button class="sm ${W[ek] === k ? 'pri' : ''}" title="${d}" onclick="weekPlan().${ek}=weekPlan().${ek}==='${k}'?null:'${k}';L.plan=null;saveGame();render()">${n}</button>`).join('')}</div>
  <div class="chips">${SCENS.map(([k, n]) => `<button class="chip ${scen === k ? 'on' : ''}" onclick="SUB.planScen='${k}';render()">${n}</button>`).join('')}</div>
  <div class="panel tight"><div class="say">${lookC(co.lk, 40)}<p><b>${esc(co.ln)} on ${esc(SCENS.find(s => s[0] === scen)[1])}:</b> ${esc(P.say[side][scen] || '')}</p></div></div>
  <h3 style="margin-top:10px">Your calls (${sel.length}/3)</h3><div class="strip">${sel.map(id => { const p = L.plays.find(x => x.id === id); return p ? `<button class="pcard pick" onclick="planSwap('${side}','${scen}','${id}');saveGame();render()"><i class="pk">IN PLAN · tap to remove</i><canvas width="160" height="100" data-play="${p.id}"></canvas><b>${esc(p.name)}</b><small>${esc(playSub(p))}</small></button>` : ''; }).join('') || '<p class="mute small">No plays picked.</p>'}</div>
  <h3>Add a play</h3><div class="strip">${list.filter(p => !sel.includes(p.id)).map(p => `<button class="pcard" onclick="planSwap('${side}','${scen}','${p.id}');saveGame();render()"><canvas width="160" height="100" data-play="${p.id}"></canvas><b>${esc(p.name)}</b><small>${esc(playSub(p))}</small></button>`).join('')}</div>`;
};
// ---------- playbook ----------
VIEWS.playbook = function () {
  const side = SUB.pbSide; const T = UT(); const bk = teamBook(T, side); const pl = L.plays.filter(p => p.side === side); const active = playsFor(L.user, side);
  AFTER.push(() => paintPlays(app));
  return `<div class="row"><h2 style="margin:0">Playbook</h2><span class="sp"></span><button class="pri" onclick="editPlay(null,'${side}')">New ${side === 'O' ? 'offensive' : 'defensive'} play</button></div>
  <div class="row" style="margin:8px 0"><div class="seg">${[['O', 'Offense'], ['D', 'Defense']].map(([k, n]) => `<button class="${side === k ? 'on' : ''}" onclick="SUB.pbSide='${k}';render()">${n}</button>`).join('')}</div>
   <label class="small">${side === 'O' ? 'Offensive' : 'Defensive'} book <select onchange="L['my'+'${side}'+'Book']=this.value;L.plan=null;saveGame();render()">${Object.entries(side === 'O' ? OBOOKS : DBOOKS).map(([k, n]) => `<option value="${k}" ${bk === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><span class="small mute">${active.length} plays active</span></div>
  <div class="pbgrid">${pl.map(p => { const inBook = bookHas(p, bk); return `<div class="panel tight ${inBook ? '' : 'dim'}"><canvas data-play="${p.id}" width="160" height="100" style="width:100%;border-radius:6px"></canvas><b>${esc(p.name)}</b><div class="small mute">${esc(playSub(p))}${p.custom ? ' · custom' : ''}${inBook ? '' : ' · not in this book'}</div>
   <div class="row" style="margin-top:4px"><label class="small"><input type="checkbox" ${p.on !== false ? 'checked' : ''} onchange="togglePlay('${p.id}',this.checked)"> In playbook</label><span class="sp"></span><button class="sm" onclick="editPlay('${p.id}')">${p.custom ? 'Edit' : 'Copy'}</button>${p.custom ? `<button class="sm bad" onclick="if(confirm('Delete this play?')){L.plays=L.plays.filter(x=>x.id!=='${p.id}');saveGame();render()}">✕</button>` : ''}</div></div>`; }).join('')}</div>`;
};
function togglePlay(id, on) { const p = L.plays.find(x => x.id === id); p.on = on; L.plan = null; saveGame(); }
let EDP = null, EDSEL = null;
function editPlay(id, side) {
  if (id) { const src = L.plays.find(p => p.id === id); EDP = JSON.parse(JSON.stringify(src)); if (!src.custom) { EDP.id = null; EDP.name = src.name + ' (custom)'; } }
  else EDP = side === 'O' ? { id: null, side: 'O', name: 'New play', form: 'Shotgun', type: 'pass', routes: { X: 'go', Z: 'slant', SL: 'curl', TE: 'drag', RB: 'block' }, on: true } : { id: null, side: 'D', name: 'New defense', form: '4-3', cov: 'c3', blitz: [], on: true };
  EDP.custom = true; EDP.books = ['all']; EDSEL = null; drawEditor();
}
const edOpt = (cur, opts) => opts.map(([v, n]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${n}</option>`).join('');
function drawEditor() {
  const p = EDP; p.paths = p.paths || {}; let body = '';
  if (p.side === 'O') { const F = OFF_FORMS[p.form];
    const blk = k => { const b = p.blocks && p.blocks[k]; return b ? b.t + ':' + b.d : 'auto'; };
    const blkOpts = [['auto', 'Scheme default'], ['pass:0', 'Pass set'], ['drive:0', 'Drive'], ['zone:-1', 'Zone left'], ['zone:1', 'Zone right'], ['reach:-1', 'Reach left'], ['reach:1', 'Reach right'], ['down:-1', 'Down left'], ['down:1', 'Down right'], ['pull:-1', 'Pull left'], ['pull:1', 'Pull right'], ['climb:0', 'Climb to LB']];
    body = `<label>Formation <select onchange="EDP.form=this.value;EDP.routes={};EDP.paths={};drawEditor()">${Object.keys(OFF_FORMS).map(f => `<option value="${f}" ${f === p.form ? 'selected' : ''}>${OFF_FORMS[f].lab}</option>`).join('')}</select></label>
    <label>Type <select onchange="EDP.type=this.value;if(EDP.type==='run'&&!EDP.carrier){EDP.carrier='RB';EDP.dir='inside';EDP.scheme='zone';EDP.gap='B';}drawEditor()"><option value="pass" ${p.type === 'pass' ? 'selected' : ''}>Pass</option><option value="run" ${p.type === 'run' ? 'selected' : ''}>Run</option></select></label>
    ${p.type === 'run' ? `<div class="grid g2" style="gap:6px"><label>Ball carrier <select onchange="EDP.carrier=this.value;drawEditor()">${F.slots.filter(s => ['RB', 'FB', 'QB'].includes(s[0])).map(s => `<option ${p.carrier === s[0] ? 'selected' : ''}>${s[0]}</option>`).join('')}</select></label>
     <label>Line scheme <select onchange="EDP.scheme=this.value;drawEditor()">${edOpt(p.scheme || 'zone', Object.entries(SCHEMES))}</select></label>
     <label>Target gap <select onchange="EDP.gap=this.value;drawEditor()">${edOpt(p.gap || 'B', [['A', 'A gap'], ['B', 'B gap'], ['C', 'C gap'], ['D', 'Edge']])}</select></label>
     <label>Side <select onchange="EDP.rside=this.value;drawEditor()">${edOpt(p.rside || 'auto', [['auto', 'Either'], ['L', 'Left'], ['R', 'Right']])}</select></label></div>`
      : `<div class="row"><label class="small"><input type="checkbox" ${p.pa ? 'checked' : ''} onchange="EDP.pa=this.checked?1:0"> Play action</label><label class="small"><input type="checkbox" ${p.deep ? 'checked' : ''} onchange="EDP.deep=this.checked?1:0"> Deep shot</label></div>`}
    <h3 style="margin-top:6px">Offensive line</h3><div class="grid g2" style="gap:6px">${OL_ORDER.map(k => `<label>${k} <select onchange="setBlock('${k}',this.value)">${edOpt(blk(k), blkOpts)}</select></label>`).join('')}</div>
    <h3 style="margin-top:6px">Skill players</h3><div class="grid g2" style="gap:6px">${F.slots.filter(s => s[0] !== 'QB' && !(p.type === 'run' && p.carrier === s[0])).map(s => `<label>${s[0]} <select onchange="EDP.routes['${s[0]}']=this.value;delete EDP.paths['${s[0]}'];drawEditor()">${ROUTE_NAMES.concat(p.paths[s[0]] ? ['custom'] : []).map(r => `<option ${(p.routes[s[0]] || 'block') === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>`).join('')}</div>
    <h3 style="margin-top:6px">Pre-snap motion</h3><label>Player <select onchange="if(this.value)EDP.motion={slot:this.value,type:'across',then:'route'};else delete EDP.motion;drawEditor()"><option value="">No motion</option>${F.slots.filter(s => s[0] !== 'QB').map(s => `<option ${p.motion && p.motion.slot === s[0] ? 'selected' : ''}>${s[0]}</option>`).join('')}</select></label>
    ${p.motion ? `<label>Motion <select onchange="EDP.motion.type=this.value">${edOpt(p.motion.type, [['across', 'Across'], ['jet', 'Jet'], ['short', 'Short shift']])}</select></label>` : ''}`;
  } else { const F = DEF_FORMS[p.form];
    body = `<label>Formation <select onchange="EDP.form=this.value;EDP.blitz=[];drawEditor()">${Object.keys(DEF_FORMS).map(f => `<option value="${f}" ${f === p.form ? 'selected' : ''}>${DEF_FORMS[f].lab}</option>`).join('')}</select></label>
    <label>Coverage <select onchange="EDP.cov=this.value;drawEditor()">${['c0', 'c1', 'c2', 'c3', 'c4', 'c2m', 'c2t'].map(c => `<option value="${c}" ${p.cov === c ? 'selected' : ''}>${covName(c)}</option>`).join('')}</select></label>
    <h3 style="margin-top:8px">Blitzers</h3><div class="row">${F.slots.filter(s => !['DE', 'DT'].includes(s[1])).map(s => `<label class="small"><input type="checkbox" ${p.blitz.includes(s[0]) ? 'checked' : ''} onchange="EDP.blitz=this.checked?[...EDP.blitz,'${s[0]}']:EDP.blitz.filter(x=>x!=='${s[0]}');drawEditor()"> ${s[0]}</label>`).join('')}</div>`; }
  modal(`<div class="row"><h2 style="margin:0">Play editor</h2><span class="sp"></span><button class="sm ghost" onclick="closeModal()">✕</button></div><div class="grid g2"><div class="grid" style="gap:8px;align-content:start"><label>Name <input value="${esc(p.name)}" oninput="EDP.name=this.value"></label>${body}</div>
  <div>${p.side === 'O' ? `<p class="small" style="margin:0 0 6px"><b>Draw it:</b> press a player and drag to draw his route or run path. Drag a lineman backward and sideways to pull him.</p>` : ''}<canvas id="edcv" width="720" height="470" style="width:100%;border-radius:10px;touch-action:none"></canvas>
  ${p.side === 'O' ? `<div class="row" style="margin-top:6px"><span class="small mute">${EDSEL ? 'Selected: ' + EDSEL : 'Tap a player to select'}</span><span class="sp"></span><button class="sm" onclick="EDP.paths={};EDP.blocks=null;for(const k in EDP.routes)if(EDP.routes[k]==='custom')EDP.routes[k]='block';drawEditor()">Clear drawings</button></div>` : ''}</div></div>
  <div class="row" style="margin-top:12px"><button class="pri" onclick="savePlay()">Save play</button><button onclick="closeModal()">Cancel</button></div>`, 'wide');
  const cn = document.getElementById('edcv'); drawPlayArt(cn, p, EDSEL); if (p.side === 'O') wireEditor(cn);
}
function setBlock(k, v) { EDP.blocks = EDP.blocks || {}; if (v === 'auto') { delete EDP.blocks[k]; delete EDP.paths[k]; } else { const [t, d] = v.split(':'); EDP.blocks[k] = { t, d: +d }; if (t !== 'pull') delete EDP.paths[k]; } drawEditor(); }
function rdp(pts, eps) { if (pts.length < 3) return pts; let dmax = 0, idx = 0; const a = pts[0], b = pts[pts.length - 1]; for (let i = 1; i < pts.length - 1; i++) { const p = pts[i]; const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(b[1] - a[1], b[0] - a[0]) || 1); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax > eps) { const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps); return l.slice(0, -1).concat(r); } return [a, b]; }
function wireEditor(cn) {
  const p = EDP; const W = cn.width, H = cn.height; const sc = W / 54, losY = Math.round(H * 0.66);
  const toF = ev => { const r = cn.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width, py = (ev.clientY - r.top) * H / r.height; return [(losY - py) / sc, px / sc]; };
  const spots = () => { const F = OFF_FORMS[p.form]; return F.slots.concat(OL_SLOTS).map(s => ({ slot: s[0], dx: s[3], y: MID_YD + s[4] })); };
  let cur = null, pts = null;
  cn.onpointerdown = ev => { const [dx, y] = toF(ev); let best = null, bd = 2.6; for (const s of spots()) { const d = Math.hypot(s.dx - dx, s.y - y); if (d < bd) { bd = d; best = s; } } if (!best) return; cn.setPointerCapture(ev.pointerId); cur = best; EDSEL = best.slot; pts = [[best.dx, best.y]]; };
  cn.onpointermove = ev => { if (!cur) return; const [dx, y] = toF(ev); const l = pts[pts.length - 1]; if (Math.hypot(dx - l[0], y - l[1]) > 0.7) { pts.push([dx, y]); drawPlayArt(cn, p, EDSEL, pts); } };
  cn.onpointerup = () => { if (!cur) return; const s = cur; cur = null; if (pts.length < 3) { drawEditor(); return; }
    let sp = rdp(pts, 0.55).slice(1); if (sp.length > 7) sp = sp.filter((_, i) => i % Math.ceil(sp.length / 7) === 0 || i === sp.length - 1);
    const rel = sp.map(([dx, y]) => [Math.round((dx - s.dx) * 10) / 10, Math.round((y - s.y) * 10) / 10]); const last = rel[rel.length - 1];
    if (OL_ORDER.includes(s.slot)) { EDP.blocks = EDP.blocks || {}; const f = last[0], l = last[1]; let t = 'drive', d = 0;
      if (rel.some(q => q[0] < -0.6) && Math.abs(l) > 1.8) { t = 'pull'; d = Math.sign(l); } else if (f > 3.5 && Math.abs(l) < 2.5) t = 'climb'; else if (f < -0.5 && Math.abs(l) < 1.8) t = 'pass'; else if (Math.abs(l) >= 1) { t = Math.abs(l) > Math.max(1, f) * 1.6 ? 'reach' : 'zone'; d = Math.sign(l); }
      EDP.blocks[s.slot] = { t, d }; if (t === 'pull') EDP.paths[s.slot] = rel; else delete EDP.paths[s.slot]; }
    else if (s.slot !== 'QB') { EDP.paths[s.slot] = rel; if (!(p.type === 'run' && p.carrier === s.slot)) EDP.routes[s.slot] = 'custom'; else { const cross = rel.find(q => q[0] >= -0.5) || last; EDP.rside = cross[1] + s.y - MID_YD < 0 ? 'L' : 'R'; } }
    drawEditor(); };
}
function savePlay() { const p = EDP; if (!p.name.trim()) p.name = 'Custom play'; if (p.side === 'O') { const F = OFF_FORMS[p.form]; for (const s of F.slots) if (s[0] !== 'QB' && !p.routes[s[0]]) p.routes[s[0]] = 'block'; }
  if (!p.id) { p.id = 'c' + Date.now().toString(36); L.plays.push(p); } else { const i = L.plays.findIndex(x => x.id === p.id); L.plays[i] = p; }
  EDSEL = null; L.plan = null; closeModal(); saveGame(); render(); toast('Play saved'); }
