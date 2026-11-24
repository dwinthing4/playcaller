// ============================================================
//  MAP: the league on a map of the US. Three layers:
//   League    - every team at its stadium (team colours, a halo in its division's colour), your road trips this season as
//               arcs with the miles, tap a team for distance, time zones, roof, grass or turf, altitude and this week's weather
//   Scouting  - the five scouting regions, where your scouts are, prospects pinned at their colleges, the season's games,
//               showcases and all-star games; send scouts on trips (travel budget) and move them between regions
//   Pipelines - where players come from: hometowns and colleges of your roster, the draft class, your picks
//  Data and rules: src/league/15_geo.js and the Scout travel section of src/league/60_staff.js. Outlines: 64_mapdata.js.
//  The college layer takes any player list (mapPipeData), so a college mode can show recruits the same way.
// ============================================================
const MAP_W = 1000, MAP_H = 630;
function mapAlb(p1, p2, p0, l0) {
  const r = Math.PI / 180; p1 *= r; p2 *= r; p0 *= r; const n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), r0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n;
  return (lon, lat) => { const rho = Math.sqrt(Math.max(0, C - 2 * n * Math.sin(lat * r))) / n, th = n * (lon - l0) * r; return [rho * Math.sin(th), r0 - rho * Math.cos(th)]; };
}
// Albers equal-area (the usual US map): the lower 48 fills the frame, Alaska and Hawaii sit in insets bottom left
const MAP_PRJ = { m: [mapAlb(29.5, 45.5, 37.5, -96), 1302.6, 510.2, 336.7], ak: [mapAlb(55, 65, 50, -154), 493.6, 82, 653.2], hi: [mapAlb(8, 18, 13, -157), 1300, 274.4, 737.3] };
const MAP_INSET = { ak: [16, 462, 192, 156], hi: [212, 520, 122, 98] };
function mapZone(lon, lat) { return lat > 51 && lon < -129 ? 'ak' : lon < -150 && lat < 25 ? 'hi' : 'm'; }
function mapXY(lon, lat, zone) { const P = MAP_PRJ[zone || mapZone(lon, lat)], p = P[0](lon, lat); return [P[2] + p[0] * P[1], P[3] - p[1] * P[1]]; }
function mapPath(str, zone) { return str.split('|').map(poly => 'M' + poly.trim().split(/\s+/).map(pt => { const [lo, la] = pt.split(',').map(Number), q = mapXY(lo, la, zone); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('L') + 'Z').join(''); }
let MAP_CACHE = null;
function mapShapes() {
  if (MAP_CACHE) return MAP_CACHE; const st = {}, c = {};
  for (const k in MAP_STATES) st[k] = mapPath(MAP_STATES[k], k === 'AK' ? 'ak' : k === 'HI' ? 'hi' : 'm');
  for (const k in MAP_LAND) c[k] = mapPath(MAP_LAND[k], 'm');
  // a label spot per state: the middle of its first polygon's box
  const mid = {}; for (const k in MAP_STATES) { const pts = MAP_STATES[k].split('|')[0].trim().split(/\s+/).map(p => p.split(',').map(Number)); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [lo, la] of pts) { x0 = Math.min(x0, lo); x1 = Math.max(x1, lo); y0 = Math.min(y0, la); y1 = Math.max(y1, la); } mid[k] = mapXY((x0 + x1) / 2, (y0 + y1) / 2, k === 'AK' ? 'ak' : k === 'HI' ? 'hi' : 'm'); }
  return (MAP_CACHE = { st, c, mid });
}
const MAP_DIVC = { 'A-East': '#d1495b', 'A-North': '#e3a33b', 'A-South': '#5f9e7c', 'A-West': '#1f7f99', 'N-East': '#8d6a9f', 'N-North': '#3b6ea5', 'N-South': '#c97b4a', 'N-West': '#7d8c3e' };
const MAP_REGC = { 'Northeast': '#4f7cac', 'Southeast': '#c4664a', 'Midwest': '#d39b35', 'Southwest': '#8f6bb0', 'West Coast': '#4e9a7a' };
const MAP_EVK = { game: ['College game', 'G'], show: ['Showcase', 'S'], allstar: ['All-star game', 'A'] };
function mapSt() { const m = SUB.map || (SUB.map = { layer: 'league', sel: null, div: null, pos: 'All', pipe: 'roster', vb: null }); if (!m.vb) m.vb = [0, 0, MAP_W, MAP_H]; return m; }
function mapSet(k, v) { const m = mapSt(); m[k] = v; if (k === 'layer') m.sel = null; render(); }
function mapSel(k) { const m = mapSt(); m.sel = m.sel === k ? null : k; render(); }
function mapPlaceXY(p) { return mapXY(p.lon, p.lat); }
// markers keep their size on screen whatever the zoom: each sits in <g class="mk" data-x data-y> and is scaled by the view
function mapMk(x, y, inner, key, cls) { return `<g class="mk ${cls || ''}" data-x="${x.toFixed(1)}" data-y="${y.toFixed(1)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"${key ? ` data-k="${key}"` : ''}>${inner}</g>`; }
function mapArc(a, b, cls, bend) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, k = (bend == null ? 0.18 : bend) * d, cx = mx + dy / d * k * (dx > 0 ? -1 : 1), cy = my - Math.abs(dx / d) * k - (Math.abs(dx) < 1 ? k : 0);
  return `<path class="${cls}" d="M${a[0].toFixed(1)},${a[1].toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}" vector-effect="non-scaling-stroke"/>`; }
// spread markers that would sit on top of each other (two teams in one stadium, a pair of nearby schools)
function mapSpread(list, gap) { for (let i = 0; i < list.length; i++) for (let j = 0; j < i; j++) { const a = list[i], b = list[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < gap) { const ang = d > 0.01 ? Math.atan2(a.y - b.y, a.x - b.x) : (i % 2 ? 0 : Math.PI), push = (gap - d) / 2; a.x += Math.cos(ang) * push; a.y += Math.sin(ang) * push; b.x -= Math.cos(ang) * push; b.y -= Math.sin(ang) * push; } } return list; }
function mapBase(fills) {
  const S = mapShapes(), F = fills || {};
  const st = Object.keys(S.st).map(k => `<path class="st" data-st="${k}" d="${S.st[k]}"${F[k] ? ` style="fill:${F[k]}"` : ''}/>`).join('');
  const ins = k => { const [x, y, w, h] = MAP_INSET[k]; return `<rect class="inset" x="${x}" y="${y}" width="${w}" height="${h}" vector-effect="non-scaling-stroke"/>`; };
  return `<rect class="sea" x="-2000" y="-2000" width="${MAP_W + 4000}" height="${MAP_H + 4000}"/>
    <g class="nb">${Object.values(S.c).map(d => `<path d="${d}" vector-effect="non-scaling-stroke"/>`).join('')}</g>${ins('ak')}${ins('hi')}
    <g class="shadow" transform="translate(2.2,2.8)">${Object.values(S.st).map(d => `<path d="${d}"/>`).join('')}</g>
    <g class="coast">${Object.values(S.st).map(d => `<path d="${d}" vector-effect="non-scaling-stroke"/>`).join('')}</g>
    <g class="states">${st.replace(/\/>/g, ' vector-effect="non-scaling-stroke"/>')}</g>`;
}
// ---------------------------------------------------------------- the screen
VIEWS.map = function () {
  const m = mapSt(), lay = m.layer; let svgIn = '', side = '';
  try { const out = lay === 'scout' ? mapScoutLayer(m) : lay === 'pipe' ? mapPipeLayer(m) : mapLeagueLayer(m); svgIn = out.svg; side = out.side; }
  catch (e) { console.error(e); side = `<div class="panel">The map could not be drawn: ${esc(e.message)}</div>`; }
  const seg = [['league', 'League'], ['scout', 'Scouting'], ['pipe', 'Pipelines']].map(([k, n]) => `<button class="${lay === k ? 'on' : ''}" onclick="mapSet('layer','${k}')">${n}</button>`).join('');
  AFTER.push(mapBind);
  return `<div class="mapscr mp-${lay}"><div class="mp-top"><div class="seg">${seg}</div><span class="sp"></span><span class="small mute mp-hint">Drag to move · pinch or scroll to zoom</span></div>
    <div class="mp-grid"><div class="panel mp-frame"><svg id="usmap" class="usmap" viewBox="${m.vb.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the league">${svgIn}</svg>
      <div class="mp-zoom"><button class="sm" onclick="mapZoomBy(0.7)" aria-label="Zoom in">+</button><button class="sm" onclick="mapZoomBy(1/0.7)" aria-label="Zoom out">−</button><button class="sm" onclick="mapZoomReset()" aria-label="Whole map">All</button></div></div>
    <div class="mp-side">${side}</div></div></div>`;
};
// ---------------- League layer ----------------
function mapDivKey(t) { return t.conf + '-' + t.div; }
function mapLeagueLayer(m) {
  const me = UT(), myP = geoTeam(me), myXY = mapPlaceXY(myP), sel = m.sel && m.sel.startsWith('t:') ? +m.sel.slice(2) : null;
  const trips = geoTrips(me.id), dk = m.div;
  const pts = mapSpread(L.teams.map(t => { const p = geoTeam(t), q = mapPlaceXY(p); return { t, p, x: q[0], y: q[1] }; }), 15);
  let arcs = ''; for (const tr of trips) { const q = mapPlaceXY(tr.t.venue); arcs += mapArc(myXY, q, 'arc' + (tr.g.done ? ' done' : ''), 0.2); }
  if (sel != null && sel !== me.id) { const q = mapPlaceXY(geoTeam(L.teams[sel])); arcs += mapArc(myXY, q, 'arc selarc', 0.12); }
  const mk = pts.map(({ t, x, y }) => { const on = !dk || mapDivKey(t) === dk, mine = t.id === me.id, s = t.id === sel;
    return mapMk(x, y, `<circle class="halo" r="${mine ? 15 : 12.5}" style="fill:${MAP_DIVC[mapDivKey(t)] || '#888'}"/><circle class="dot" r="${mine ? 11 : 9}" style="fill:${t.c1};stroke:${t.c2}"/><text class="ab" y="3.1" style="fill:${lum(t.c1) > 0.6 ? '#10141c' : '#ffffff'}">${esc(String(t.abbr).slice(0, 3))}</text>`, 't:' + t.id, (mine ? 'me ' : '') + (s ? 'sel ' : '') + (on ? '' : 'dim')); }).join('');
  const svg = mapBase() + `<g class="arcs">${arcs}</g><g class="marks">${mk}</g>`;
  const divs = Object.keys(MAP_DIVC).filter(k => L.teams.some(t => mapDivKey(t) === k));
  const legend = `<div class="mp-legend">${divs.map(k => { const [c, d] = k.split('-'); return `<button class="chip ${dk === k ? 'on' : ''}" onclick="mapSet('div',${dk === k ? 'null' : `'${k}'`})"><i style="background:${MAP_DIVC[k]}"></i>${esc(confName(c).slice(0, 3))} ${esc(d)}</button>`; }).join('')}</div>`;
  let side = sel != null ? mapTeamCard(L.teams[sel]) : '';
  const miles = trips.reduce((a, t) => a + t.t.miles, 0), far = trips.slice().sort((a, b) => b.t.miles - a.t.miles)[0], tz = trips.reduce((a, t) => a + Math.abs(t.t.tz), 0), body = trips.filter(t => t.t.bodyClock).length;
  side += `<div class="panel mp-card"><h3>On the road this season</h3>
    <div class="mp-stats"><div><b>${trips.length}</b><span>road games</span></div><div><b>${Math.round(miles).toLocaleString('en-US')}</b><span>miles</span></div><div><b>${tz}</b><span>time zones</span></div><div><b>${body}</b><span>body-clock games</span></div></div>
    ${far ? `<p class="small mute">Longest trip: ${esc(teamLabel(L.teams[far.opp]))}, ${geoMilesTxt(far.t.miles)}. Long trips and early kickoffs out East cost a few % of stamina at kickoff.</p>` : '<p class="small mute">No road games on the schedule.</p>'}
    <table class="mini mp-trips">${trips.map(tr => { const o = L.teams[tr.opp]; return `<tr class="click ${tr.g.done ? 'mute' : ''}" onclick="mapSel('t:${o.id}')"><td>Wk ${tr.wk + 1}</td><td>${esc(o.abbr)}</td><td>${geoMilesTxt(tr.t.miles)}</td><td>${tr.t.tz ? (tr.t.tz > 0 ? '+' : '') + tr.t.tz + 'h' : ''}</td><td>${tr.t.cost >= 0.005 ? '−' + Math.round(tr.t.cost * 100) + '%' : ''}</td></tr>`; }).join('')}</table></div>
    <div class="panel mp-card"><h3>Divisions</h3>${legend}<p class="small mute">Home: ${esc(myP.name)}, ${esc(myP.st)} · ${GEO_TZ_NAME[myP.tz] || myP.tz} time</p></div>`;
  return { svg, side };
}
function mapRoofTxt(p) { return p.roof === 'dome' ? 'Dome' : p.roof === 'retract' ? 'Retractable roof' : 'Open air'; }
function mapTeamCard(t) {
  const me = UT(), p = geoTeam(t), mine = geoTeam(me), d = geoDate(L.year, L.week), tz = geoOffset(p, d) - geoOffset(mine, d), mi = Math.round(geoMiles(mine, p));
  const g = (L.sched[L.week] || []).find(x => x.h === t.id || x.a === t.id), v = VENUE.of(t);
  let wx = ''; if (g && g.h === t.id && L.phase === 'regular') { const w = VENUE.today(t, L, null, g); wx = w.dome ? (w.roof === 'retract' ? 'Roof closed' + (w.outside ? ` (${w.outside.temp}° ${w.outside.weather === 'clear' ? 'outside' : w.outside.weather})` : '') : 'Indoors') : `${w.temp}° · ${w.weather === 'clear' ? (w.tod === 'overcast' ? 'overcast' : 'clear') : w.weather} · wind ${w.wind.mph} mph${w.roofOpen ? ' · roof open' : ''}`; }
  const myG = (L.sched[L.week] || []).find(x => (x.h === me.id || x.a === me.id) && (x.h === t.id || x.a === t.id));
  const tr = myG ? geoTravel(myG, me.id) : null;
  const feat = [mapRoofTxt(p), v.surface === 'turf' ? 'turf' : 'grass', p.alt >= 3000 ? `${p.alt.toLocaleString('en-US')} ft up` : ''].filter(Boolean).join(' · ');
  return `<div class="panel mp-card mp-team"><div class="row">${logoC(t, 44)}<div class="sp"><b>${esc(teamLabel(t))}</b><div class="small mute">${t.w}-${t.l}${t.tie ? '-' + t.tie : ''} · ${esc(confName(t.conf))} ${esc(t.div)}</div></div><button class="sm ghost" onclick="mapSel('t:${t.id}')" aria-label="Close">✕</button></div>
    <dl class="mp-dl"><dt>Stadium</dt><dd>${esc(p.name)}, ${esc(p.st)} · ${feat}</dd>
    ${t.id === me.id ? '' : `<dt>From you</dt><dd>${geoMilesTxt(mi)} · ${geoTzTxt(tz)}</dd>`}
    <dt>Time zone</dt><dd>${GEO_TZ_NAME[p.tz] || p.tz}</dd>${wx ? `<dt>This week</dt><dd>${esc(wx)}</dd>` : ''}${tr && !tr.atHome ? `<dt>Your trip</dt><dd>${esc(geoTravelTxt(tr))}</dd>` : ''}</dl>
    <div class="row"><button class="sm" onclick="teamModal(${t.id})">Roster</button></div></div>`;
}
// ---------------- Scouting layer ----------------
function mapGradeCol(p) { return scouted(p) ? ovrColor(p.scout) : `var(--rt${gradeStars(p)})`; }
function mapScoutLayer(m) {
  const S = scoutTrips(), pos = m.pos || 'All', S2 = mapShapes(); const fills = {};
  for (const st in S2.st) { const r = GEO_STATE_REGION[st]; if (r) fills[st] = `color-mix(in srgb, ${MAP_REGC[r]} 26%, var(--mp-land))`; }
  const draft = L.draft.map(id => L.P[id]).filter(p => p && (pos === 'All' || p.pos === pos));
  const pipe = geoPipeline(draft, 'col'), sel = m.sel || '';
  const cols = mapSpread(Object.values(pipe.col).map(e => { const q = mapXY(e.c.lon, e.c.lat), ps = e.ids.map(i => L.P[i]); const best = ps.slice().sort((a, b) => scoutedValue(b) - scoutedValue(a))[0]; return { e, ps, best, x: q[0], y: q[1] }; }), 9);
  const open = (S ? S.ev : []).filter(e => scoutEvOpen(e) && (e.wk === 'post' || e.wk <= L.week + 2));
  let marks = '';
  for (const c of cols) { const k = 'c:' + c.e.c.name, r = Math.min(9, 4.5 + c.ps.length * 1.1); marks += mapMk(c.x, c.y, `<circle class="pin" r="${r.toFixed(1)}" style="fill:${mapGradeCol(c.best)}"/>${c.ps.length > 1 ? `<text class="cn" y="2.8">${c.ps.length}</text>` : ''}`, k, sel === k ? 'sel' : ''); }
  for (const e of open) { const q = mapXY(e.lon, e.lat), k = 'e:' + e.id; marks += mapMk(q[0], q[1], `<rect class="ev ${e.kind}${e.sc != null ? ' booked' : ''}" x="-7" y="-7" width="14" height="14" transform="rotate(45)"/><text class="evt" y="3">${MAP_EVK[e.kind][1]}</text>`, k, sel === k ? 'sel' : ''); }
  // scouts: at their region's base (or on the road this week), labelled with initials
  const base = {}; let lines = '';
  for (const s of L.scouts) { const reg = s.region, h = scoutHub(reg), q = mapXY(h.lon, h.lat), n = base[reg] = (base[reg] || 0) + 1, x = q[0], y = q[1], off = (n - 1) * 28;
    const trip = open.find(e => e.sc === s.id && (e.wk === L.week || (e.wk === 'post' && L.phase !== 'regular'))); if (trip) { const t = mapXY(trip.lon, trip.lat); lines += mapArc([x, y], t, 'arc trip', 0.15); }
    if (s.moveTo) { const t2 = scoutHub(s.moveTo), qq = mapXY(t2.lon, t2.lat); lines += mapArc([x, y], qq, 'arc move', 0.1); }
    marks += mapMk(x, y, `<g transform="translate(${off},8)"><rect class="sct" x="-12.5" y="-10" width="25" height="20" rx="2"/><text class="sci" y="3.4">${esc((s.fn[0] || '') + (s.ln[0] || ''))}</text></g>`, 's:' + s.id, sel === 's:' + s.id ? 'sel' : ''); }
  const regLab = SCOUT_REGIONS.map(r => { const h = scoutHub(r), q = mapXY(h.lon, h.lat); return mapMk(q[0], q[1], `<text class="rl" y="-14" style="fill:${MAP_REGC[r]}">${esc(r.toUpperCase())}</text>`, null, 'lab'); }).join('');
  const svg = mapBase(fills) + `<g class="arcs">${lines}</g><g class="marks">${regLab}${marks}</g>`;
  // side panel
  let side = '';
  if (sel.startsWith('c:')) side += mapCollegeCard(sel.slice(2), cols.find(c => 'c:' + c.e.c.name === sel));
  else if (sel.startsWith('e:')) { const e = S && S.ev.find(x => x.id === +sel.slice(2)); if (e) side += mapEventCard(e); }
  else if (sel.startsWith('s:')) { const s = L.scouts.find(x => x.id === +sel.slice(2)); if (s) side += mapScoutCard(s); }
  const left = S ? S.budget - S.spent : 0;
  side += `<div class="panel mp-card"><div class="row"><h3 style="margin:0">Travel budget</h3><span class="sp"></span><b>$${left}k</b><span class="small mute">of $${S ? S.budget : 0}k</span></div>${meter(S ? left / S.budget * 100 : 0, 'var(--acc)')}
    <p class="small mute">A trip costs more the farther it is from the scout's base. Your owner and the film room set the budget.</p></div>`;
  side += `<div class="panel mp-card"><h3>Your scouts</h3>${L.scouts.map(s => mapScoutRow(s, open)).join('')}</div>`;
  const evs = open.slice().sort((a, b) => (a.wk === 'post' ? 99 : a.wk) - (b.wk === 'post' ? 99 : b.wk));
  side += `<div class="panel mp-card"><h3>Coming up</h3>${evs.length ? `<table class="mini mp-evs">${evs.map(e => `<tr class="click" onclick="mapSel('e:${e.id}')"><td>${e.wk === 'post' ? 'Jan' : 'Wk ' + (e.wk + 1)}</td><td><b>${esc(e.name)}</b><div class="small mute">${esc(e.town)}, ${e.st} · ${e.ids.length} prospects</div></td><td>${e.sc != null ? `<span class="tag">${esc((L.scouts.find(s => s.id === e.sc) || {}).ln || '')}</span>` : ''}</td></tr>`).join('')}</table>` : '<p class="small mute">Nothing on the calendar right now. College games run through the season, all-star games after it.</p>'}</div>`;
  side += `<div class="panel mp-card"><h3>Prospects</h3><div class="chips">${['All', ...POS_LIST].map(k => `<button class="chip ${pos === k ? 'on' : ''}" onclick="mapSet('pos','${k}')">${k}</button>`).join('')}</div>
    <p class="small mute">Pins are colleges, coloured by their best prospect's grade. Tap one to see who plays there.</p></div>`;
  return { svg, side };
}
function mapScoutRow(s, open) {
  const trip = (open || []).filter(e => e.sc === s.id);
  return `<div class="mp-sc"><div class="row">${lookC(s.lk, 34)}<div class="sp"><b>${esc(s.fn)} ${esc(s.ln)}</b><div class="small mute">${SCOUT_SPECS[s.spec]} · rating ${s.r}</div></div></div>
    <div class="row"><label class="small">Region <select onchange="uiRes(scoutMove(${s.id}, this.value))">${SCOUT_REGIONS.map(r => `<option ${(s.moveTo || s.region) === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>${s.moveTo ? `<span class="small mute">moving from ${esc(s.region)}</span>` : ''}</div>
    ${trip.length ? `<div class="small">${trip.map(e => `Going to <b>${esc(e.name)}</b> (${e.wk === 'post' ? 'January' : 'week ' + (e.wk + 1)})`).join('<br>')}</div>` : ''}</div>`;
}
function mapScoutCard(s) { return `<div class="panel mp-card"><div class="row"><h3 style="margin:0">Scout</h3><span class="sp"></span><button class="sm ghost" onclick="mapSel('s:${s.id}')" aria-label="Close">✕</button></div>${mapScoutRow(s, (scoutTrips() || { ev: [] }).ev.filter(scoutEvOpen))}<p class="small mute">Based in ${esc(scoutHub(s.region).town)}. He sees prospects in his region more often in his weekly reports.</p></div>`; }
function mapCollegeCard(name, c) {
  const col = geoCollege(name), ps = c ? c.ps.slice().sort((a, b) => scoutedValue(b) - scoutedValue(a)) : [];
  return `<div class="panel mp-card"><div class="row"><div class="sp"><b>${esc(name)}</b><div class="small mute">${esc(col.town)}, ${esc(col.st)} · ${esc(col.region)}</div></div><button class="sm ghost" onclick="mapSel('c:${esc(name)}')" aria-label="Close">✕</button></div>
    <table class="mini">${ps.map(p => `<tr class="click" onclick="showPlayer(${p.id})"><td>${bustC(p, 24)}</td><td>${esc(pname(p))}</td><td>${p.pos}</td><td>${scouted(p) ? ovrTag(p.scout) : starsHTML(gradeStars(p))}</td></tr>`).join('') || '<tr><td class="mute">No prospects here at this position.</td></tr>'}</table></div>`;
}
function mapEventCard(e) {
  const S = scoutTrips(), ps = e.ids.map(i => L.P[i]).filter(Boolean).sort((a, b) => scoutedValue(b) - scoutedValue(a)), op = scoutEvOpen(e);
  return `<div class="panel mp-card mp-ev"><div class="row"><span class="tag">${MAP_EVK[e.kind][0]}</span><span class="sp"></span><button class="sm ghost" onclick="mapSel('e:${e.id}')" aria-label="Close">✕</button></div>
    <h3 style="margin:6px 0 2px">${esc(e.name)}</h3><div class="small mute">${esc(e.town)}, ${e.st} · ${e.wk === 'post' ? 'January, after the season' : 'before week ' + (e.wk + 1)} · ${ps.length} prospects</div>
    ${op ? `<div class="mp-send">${L.scouts.map(s => { const on = e.sc === s.id, cost = scoutTripCost(s, e); return `<button class="sm ${on ? 'pri' : ''}" onclick="uiRes(scoutSend(${e.id}, ${s.id}))">${on ? '✓ ' : ''}${esc(s.ln)} · $${cost}k</button>`; }).join('')}</div><p class="small mute">The scout you send files a full report on everyone there (up to ${e.kind === 'game' ? 12 : 16}). Tap again to cancel.</p>` : `<p class="small mute">${e.sc != null ? 'Your scout was there.' : 'Played.'}</p>`}
    <table class="mini">${ps.slice(0, 10).map(p => `<tr class="click" onclick="showPlayer(${p.id})"><td>${esc(pname(p))}</td><td>${p.pos}</td><td class="small mute">${esc(geoCollege(p.col).name)}</td><td>${scouted(p) ? ovrTag(p.scout) : starsHTML(gradeStars(p))}</td></tr>`).join('')}</table></div>`;
}
// ---------------- Pipelines layer ----------------
const MAP_PIPES = [['roster', 'Roster hometowns'], ['rcol', 'Roster colleges'], ['class', 'Draft class'], ['picks', 'Your picks']];
function mapPipeData(k) {
  const me = UT();
  if (k === 'roster') return { list: me.roster.map(id => L.P[id]), by: 'home' };
  if (k === 'rcol') return { list: me.roster.map(id => L.P[id]), by: 'col' };
  if (k === 'class') return { list: L.draft.map(id => L.P[id]), by: 'home' };
  return { list: Object.values(L.P).filter(p => p.drafted && p.drafted.t === me.id), by: 'col' };
}
function mapPipeLayer(m) {
  const k = m.pipe || 'roster', D = mapPipeData(k), P = geoPipeline(D.list.filter(Boolean), D.by), mx = Math.max(1, ...Object.values(P.st));
  const fills = {}; for (const st in P.st) { const f = P.st[st] / mx; fills[st] = `color-mix(in srgb, var(--acc) ${Math.round(18 + 72 * Math.sqrt(f))}%, var(--mp-land))`; }
  let marks = '';
  if (D.by === 'col') { const cols = mapSpread(Object.values(P.col).map(e => { const q = mapXY(e.c.lon, e.c.lat); return { e, x: q[0], y: q[1] }; }), 9);
    for (const c of cols) marks += mapMk(c.x, c.y, `<circle class="pin pp" r="${Math.min(10, 4 + c.e.n * 1.3).toFixed(1)}"/>${c.e.n > 1 ? `<text class="cn" y="2.8">${c.e.n}</text>` : ''}`, 'c:' + c.e.c.name, m.sel === 'c:' + c.e.c.name ? 'sel' : ''); }
  const S2 = mapShapes(); for (const st in P.st) { const q = S2.mid[st]; if (q && P.st[st] >= 2 && D.by === 'home') marks += mapMk(q[0], q[1], `<text class="stn">${P.st[st]}</text>`, 'p:' + st, 'lab'); }
  const me = UT(), hq = mapPlaceXY(geoTeam(me)); marks += mapMk(hq[0], hq[1], `<circle class="dot" r="8" style="fill:${me.c1};stroke:${me.c2}"/>`, null, 'me');
  const svg = mapBase(fills) + `<g class="marks">${marks}</g>`;
  const top = Object.entries(P.st).sort((a, b) => b[1] - a[1]).slice(0, 8), topC = Object.values(P.col).sort((a, b) => b.n - a.n).slice(0, 8);
  const bar = (lab, n, tot) => `<div class="mp-bar"><span>${lab}</span><i style="width:${Math.round(n / Math.max(1, tot) * 100)}%"></i><b>${n}</b></div>`;
  let side = `<div class="panel mp-card"><h3>Where they come from</h3><div class="chips">${MAP_PIPES.map(([kk, n]) => `<button class="chip ${k === kk ? 'on' : ''}" onclick="mapSet('pipe','${kk}')">${n}</button>`).join('')}</div>
    <p class="small mute">${P.n} players · ${D.by === 'col' ? 'by college' : 'by hometown'}${k === 'picks' && !P.n ? ' · nobody drafted by you yet' : ''}</p>
    ${SCOUT_REGIONS.map(r => bar(r, P.region[r] || 0, P.n)).join('')}</div>`;
  if (m.sel && m.sel.startsWith('c:')) { const nm = m.sel.slice(2), e = P.col[nm]; if (e) side = `<div class="panel mp-card"><div class="row"><div class="sp"><b>${esc(nm)}</b><div class="small mute">${esc(e.c.town)}, ${e.c.st}</div></div><button class="sm ghost" onclick="mapSel('c:${esc(nm)}')" aria-label="Close">✕</button></div><table class="mini">${e.ids.map(i => L.P[i]).filter(Boolean).map(p => `<tr class="click" onclick="showPlayer(${p.id})"><td>${esc(pname(p))}</td><td>${p.pos}</td><td>${p.tid != null && L.teams[p.tid] ? esc(L.teams[p.tid].abbr) : ''}</td><td>${ovrTag(p.ovr)}</td></tr>`).join('')}</table></div>` + side; }
  side += `<div class="panel mp-card"><h3>Top states</h3>${top.map(([st, n]) => bar(esc(GEO_STATE_NAME[st] || st), n, top[0][1])).join('') || '<p class="small mute">Nobody yet.</p>'}</div>`;
  if (D.by === 'col') side += `<div class="panel mp-card"><h3>Top colleges</h3>${topC.map(e => bar(esc(e.c.name), e.n, topC[0].n)).join('')}</div>`;
  return { svg, side };
}
// ---------------- pan, zoom, tap ----------------
function mapScaleMarks(svg) {
  const vb = mapSt().vb, w = svg.clientWidth || 360, s = vb[2] / w * (w < 600 ? 0.82 : 0.95);
  for (const g of svg.querySelectorAll('.mk')) g.setAttribute('transform', `translate(${g.dataset.x},${g.dataset.y}) scale(${s.toFixed(3)})`);
}
function mapClampVB(vb) { const w = clamp(vb[2], 110, MAP_W * 1.1), h = w * MAP_H / MAP_W; let x = vb[0], y = vb[1]; x = clamp(x, -w * 0.4, MAP_W - w * 0.6); y = clamp(y, -h * 0.4, MAP_H - h * 0.6); return [x, y, w, h]; }
function mapApplyVB(svg) { const m = mapSt(); m.vb = mapClampVB(m.vb); svg.setAttribute('viewBox', m.vb.map(v => v.toFixed(1)).join(' ')); mapScaleMarks(svg); }
function mapZoomAt(svg, f, px, py) { const m = mapSt(), vb = m.vb, r = svg.getBoundingClientRect(), fx = r.width ? (px - r.left) / r.width : 0.5, fy = r.height ? (py - r.top) / r.height : 0.5, w = clamp(vb[2] * f, 110, MAP_W * 1.1), h = w * MAP_H / MAP_W;
  m.vb = [vb[0] + (vb[2] - w) * fx, vb[1] + (vb[3] - h) * fy, w, h]; mapApplyVB(svg); }
function mapZoomBy(f) { const svg = document.getElementById('usmap'); if (!svg) return; const r = svg.getBoundingClientRect(); mapZoomAt(svg, f, r.left + r.width / 2, r.top + r.height / 2); }
function mapZoomReset() { const svg = document.getElementById('usmap'); mapSt().vb = [0, 0, MAP_W, MAP_H]; if (svg) mapApplyVB(svg); }
function mapBind() {
  const svg = document.getElementById('usmap'); if (!svg || svg._bound) return; svg._bound = true; mapApplyVB(svg);
  const pts = new Map(); let moved = 0, downK = null, pinch = null;
  const unitPx = () => mapSt().vb[2] / (svg.clientWidth || 1);
  svg.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { svg.setPointerCapture(e.pointerId); } catch (er) { }
    if (pts.size === 1) { moved = 0; const g = e.target.closest && e.target.closest('[data-k]'); downK = g ? g.dataset.k : null; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; downK = null; } });
  svg.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size >= 2 && pinch) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 10 && pinch.d > 10) mapZoomAt(svg, pinch.d / d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = d; moved += 99; return; }
    moved += Math.abs(dx) + Math.abs(dy); if (moved < 6) return; const m = mapSt(), k = unitPx(); m.vb = [m.vb[0] - dx * k, m.vb[1] - dy * k, m.vb[2], m.vb[3]]; mapApplyVB(svg); });
  const up = e => { const had = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!had || pts.size) return; if (moved < 6 && downK) mapSel(downK); downK = null; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; downK = null; });
  svg.addEventListener('wheel', e => { e.preventDefault(); mapZoomAt(svg, e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
  if (!mapBind._rs) { mapBind._rs = true; addEventListener('resize', () => { const s = document.getElementById('usmap'); if (s) mapScaleMarks(s); }); }
}
// ---------------- the nav entry and the matchup line ----------------
// "Map" gets its own button in the bottom bar / side rail, after League
(function mapNav() { if (NAVG.some(g => g[0] === 'mapg')) return; const i = NAVG.findIndex(g => g[0] === 'leagueg'); NAVG.splice(i >= 0 ? i + 1 : NAVG.length - 1, 0, ['mapg', 'Map', [['map', 'Map']]]);
  NAV_ICON.mapg = NAV_SVG('<path d="M3 6.2 8.6 4l6.8 2.4L21 4.2v13.6l-5.6 2.2-6.8-2.4L3 19.8z"/><path d="M8.6 4v13.8M15.4 6.4v13.6"/>'); })();
// the matchup card on the hub: the trip and the forecast for this week's game
function geoMatchLine(g) {
  if (!g || typeof geoTravel !== 'function') return ''; try {
    const me = L.user, opp = g.h === me ? g.a : g.h, t = geoTravel(g, me), o = geoTravel(g, opp), H = L.teams[g.h], w = VENUE.today(H, L, null, g), p = geoVenue(g) || geoTeam(H), v = VENUE.of(H);
    const trip = t && !t.atHome ? geoTravelTxt(t) : o && !o.atHome ? `${esc(L.teams[opp].abbr)} travel ${geoMilesTxt(o.miles)}${o.cost >= 0.005 ? ` (−${Math.round(o.cost * 100)}% stamina)` : ''}` : 'Home game';
    const wx = w.dome ? (w.roof === 'retract' ? 'roof closed' : 'indoors') : `${w.temp}°${w.weather !== 'clear' ? ' · ' + w.weather : ''}${w.wind.mph >= 12 ? ` · wind ${w.wind.mph} mph` : ''}`;
    const feat = [mapRoofTxt(p).toLowerCase(), v.surface, p.alt >= 3000 ? `${p.alt.toLocaleString('en-US')} ft` : ''].filter(Boolean).join(', ');
    return `<div class="geoline small"><span><b>Travel</b> ${esc(trip)}</span><span><b>${esc(p.name)}</b> ${esc(wx)} · ${esc(feat)}</span></div>`;
  } catch (e) { console.error(e); return ''; }
}
