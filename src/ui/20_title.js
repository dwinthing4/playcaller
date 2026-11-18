// Title screen: career slots, new career setup, team pick, import.
let NG = { diff: 'pro', qlen: 120, coach: '', slot: null };
function renderTitle() {
  const m = slotMeta(); const slots = []; for (let n = 1; n <= NSLOTS; n++) slots.push([n, m[n]]);
  if (NG.slot) { renderNewCareer(); return; }
  app.innerHTML = `<div class="wrap title-wrap">
   <section class="hero titlehero art"><canvas class="heroart" data-stadium='{"c1":"#1f6b35","c2":"#f2c230","floor":0.75,"seed":11}'></canvas><div class="hero-inner"><p class="title">PLAY<br><span>CALLER</span></p><p class="tagline">Run the franchise. Call the plays. Feel every hit.</p></div></section>
   <div class="row" style="margin:14px 0"><button class="pri" onclick="quickExhibition()">⚡ Quick game</button><input type="file" accept=".json,application/json" id="impf" hidden onchange="importLeagueFile(this)"><button onclick="document.getElementById('impf').click()">Import league file</button></div>
   <div class="slots">${slots.map(([n, s]) => s ? `<div class="slot" style="--sc:${s.c1 || '#335'}"><span class="pos">SLOT ${n}</span><b>${esc(s.team)}</b><span>Coach ${esc(s.coach)}</span><span class="mute small">${s.year} · ${esc(s.rec)}${s.titles ? ' · ' + '🏆'.repeat(Math.min(5, s.titles)) : ''}</span>
      <div class="row"><button class="pri" onclick="continueSlot(${n})">Continue</button><button class="sm" onclick="if(confirm('Delete this career? This cannot be undone.'))deleteSlot(${n}).then(renderTitle)">Delete</button></div></div>`
    : `<div class="slot empty"><span class="pos">SLOT ${n}</span><b>Empty</b><span class="mute small">Start a new coaching career</span><div class="row"><button class="go" onclick="NG.slot=${n};renderTitle()">New career</button></div></div>`).join('')}</div></div>`;
  if (typeof paintArt === 'function') requestAnimationFrame(() => paintArt(app));
}
async function continueSlot(n) { try { await loadSlot(n); TAB = 'home'; render(); } catch (e) { toast('That save could not be loaded.'); } }
function renderNewCareer() {
  const opt = (k, arr, cur) => `<div class="seg">${arr.map(([v, n]) => `<button class="${cur === v ? 'on' : ''}" onclick="NG.${k}=${typeof v === 'string' ? `'${v}'` : v};renderNewCareer()">${n}</button>`).join('')}</div>`;
  app.innerHTML = `<div class="wrap" style="max-width:720px"><button class="sm" onclick="NG.slot=null;renderTitle()">← Back</button>
   <div class="panel" style="margin-top:12px"><h2>New career · slot ${NG.slot}</h2>
   <p class="mute small">A fresh 32-team league with invented cities, players and identities.</p>
   <h3>Difficulty</h3>${opt('diff', Object.entries(DIFFS).map(([k, d]) => [k, d.n]), NG.diff)}
   <h3 style="margin-top:12px">Quarter length</h3>${opt('qlen', [[60, '1 min'], [120, '2 min'], [180, '3 min'], [240, '4 min'], [300, '5 min']], NG.qlen)}
   <h3 style="margin-top:12px">Your name</h3><input id="cname" value="${esc(NG.coach)}" placeholder="Coach name" oninput="NG.coach=this.value" style="width:100%">
   <div class="row" style="margin-top:14px"><button class="pri big" onclick="createLeague()">Create league</button></div></div></div>`;
}
function createLeague() { CUR_SLOT = NG.slot || freeSlot() || 1; newLeague({ diff: NG.diff, qlen: NG.qlen }); render(); }
function renderPickTeam() {
  const ts = L.teams.slice().sort((a, b) => teamOvr(b) - teamOvr(a));
  app.innerHTML = `<div class="wrap"><h1>Pick your team</h1><p class="mute">Stronger teams come with higher owner expectations. Each owner has a personality.</p>
  <div class="teamgrid">${ts.map(t => `<button class="teamcard" onclick="pickTeam(${t.id})">${logoC(t, 48)}<div><b>${esc(t.city)} ${esc(t.name)}</b><div class="row small">${ovrTag(teamOvr(t))}<span class="stars">${stars(teamOvr(t))}</span></div><div class="small mute">${esc(t.offStyle)} · ${esc(t.defStyle)} · Owner: ${OWNERP[ownerPersona(t)][0]}</div></div></button>`).join('')}</div>
  <div style="margin-top:12px"><button onclick="L=null;NG.slot=null;render()">Back</button></div></div>`; paintArt(app);
}
function pickTeam(id) { chooseTeam(id, NG.coach); NG.slot = null; TAB = 'home'; saveGame(true); render(); window.scrollTo(0, 0); }
function quickExhibition() {
  newLeague({ diff: 'pro', qlen: 60 }); L.exhibition = true; L.picking = false; L.user = 0; chooseTeam(0, 'Coach'); L.exhibition = true;
  modal(`<h2>Quick game</h2><p class="mute">Pick your team, then your opponent.</p><div class="teamgrid" id="exh">${L.teams.map(t => `<button class="teamcard" onclick="exhPick(${t.id})">${logoC(t, 36)}<div><b>${esc(t.name)}</b><div>${ovrTag(teamOvr(t))}</div></div></button>`).join('')}</div>`);
  window._exh = null;
}
function exhPick(id) {
  if (window._exh == null) { window._exh = id; L.user = id; toast('Now pick the opponent'); return; }
  if (id === window._exh) return; closeModal(); const g = { h: id, a: window._exh, done: false };
  if (typeof MATCH !== 'undefined') MATCH.open({ g, home: L.teams[g.h], away: L.teams[g.a], userTid: L.user, mode: 'play', onDone: () => { L = null; render(); } });
  else { toast('The match engine is not loaded.'); L = null; render(); }
}
function importLeagueFile(inp) { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const slot = freeSlot(); if (!slot) { toast('All career slots are full.'); return; } CUR_SLOT = slot; deserialize(r.result); saveGame(true); TAB = 'home'; render(); toast(`League imported into slot ${slot}`); } catch (e) { toast('That file is not a Playcaller league.'); } }; r.readAsText(f); }
