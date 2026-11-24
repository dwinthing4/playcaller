// Settings, saves, export/import.
VIEWS.settings = function () { const S = L.settings;
  return `<div class="panel setlook" style="margin-bottom:12px"><h2>Look</h2>${stylePicker()}<p class="small mute">${esc((UI_STYLES.find(x => x[0] === uiStyle()) || UI_STYLES[0])[2])}. The style is saved on this device and dresses the menus, the title screen and the in-game scoreboard.</p></div>
  <div class="grid g2"><div class="panel"><h2>Game</h2>
   <label>Difficulty <select onchange="L.diff=this.value;saveGame()">${Object.entries(DIFFS).map(([k, d]) => `<option value="${k}" ${L.diff === k ? 'selected' : ''}>${d.n}</option>`).join('')}</select></label>
   <p class="small mute">Higher difficulty makes CPU players react faster, tackle surer and cover tighter, and makes your throws less forgiving.</p>
   <label>Quarter length <select onchange="L.qlen=+this.value;saveGame()">${[[60, '1 min'], [120, '2 min'], [180, '3 min'], [240, '4 min'], [300, '5 min']].map(([k, n]) => `<option value="${k}" ${L.qlen === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
   <div class="row" style="margin-top:8px"><label class="small"><input type="checkbox" ${S.haptics !== false ? 'checked' : ''} onchange="L.settings.haptics=this.checked;saveGame()"> Vibration (phones)</label><label class="small"><input type="checkbox" ${S.tags !== false ? 'checked' : ''} onchange="L.settings.tags=this.checked;saveGame()"> Player name tags</label></div>
   <label style="margin-top:8px">Camera <select onchange="L.settings.view=this.value;saveGame()">${[['auto', 'Auto'], ['qb', 'Behind the QB'], ['side', 'Sideline']].map(([k, n]) => `<option value="${k}" ${S.view === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
   <label style="margin-top:8px">Phone mode (narrower field, bigger players, buttons on the left) <select onchange="try{localStorage.setItem('pc_phone',this.value)}catch(e){}">${[['auto', 'Auto (phones only)'], ['on', 'Always on'], ['off', 'Off']].map(([k, n]) => { let v = 'auto'; try { v = localStorage.getItem('pc_phone') || 'auto'; } catch (e) { } return `<option value="${k}" ${v === k ? 'selected' : ''}>${n}</option>`; }).join('')}</select></label>
   <label style="margin-top:8px">Home screen layout (also switchable at the top of Home) <select onchange="L.settings.hubLayout=this.value;saveGame()">${HUB_LAYOUTS.map(([k, n]) => `<option value="${k}" ${hubLayout() === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
  <div class="panel"><h2>Saves</h2><p class="small">Career slot ${CUR_SLOT}. Saves on this device after every action.</p><div class="row"><button class="pri" onclick="saveNow().then(()=>toast('Saved'))">Save now</button><button onclick="exportLeague()">Export league file</button></div>
   <p class="small mute">Export makes a file you can import on any device from the title screen.</p>
   <div class="row" style="margin-top:12px"><button onclick="saveNow().then(()=>{L=null;render()})">Back to title</button><button class="bad" onclick="if(confirm('Delete this career? This cannot be undone.')){deleteSlot(CUR_SLOT).then(()=>{L=null;render()})}">Delete career</button></div></div></div>
  ${soundPanel(S)}`; };
// Sound: the switch, two levels, menu clicks, the touchdown sting, and a button per sound (the stadium is synthesized in src/render/30_audio.js)
function soundPanel(S) {
  const pct = (v, d) => Math.round((v == null || isNaN(+v) ? d : +v) * 100), has = typeof SND !== 'undefined';
  const ck = (k, label, def) => `<label class="small"><input type="checkbox" ${S[k] !== false ? 'checked' : ''} onchange="L.settings.${k}=this.checked;saveGame();if(typeof SND!=='undefined')SND.apply()"> ${label}</label>`;
  const sl = (k, label, d, max) => `<label class="small" style="margin-top:8px;display:flex;gap:10px;align-items:center">${label}<input type="range" min="0" max="${max}" step="5" value="${pct(S[k], d)}" style="flex:1;max-width:260px" oninput="L.settings.${k}=this.value/100;if(typeof SND!=='undefined')SND.apply()" onchange="saveGame()"></label>`;
  return `<div class="panel" style="margin-top:12px"><h2>Sound</h2>
   <div class="row">${ck('sound', 'Sound', true)}${ck('clicks', 'Menu clicks', true)}${ck('sting', 'Touchdown sting', true)}</div>
   ${sl('vol', 'Volume', 0.7, 100)}${sl('crowdVol', 'Crowd', 1, 150)}
   <p class="small mute">Everything you hear is made in code as you play, no sound files: the crowd follows the noise meter and the game, pads crack on the hits, the officials whistle the play dead, the horn sounds on home scores. Sound waits for your first tap on phones.</p>
   ${has ? `<div class="small" style="margin-top:10px;font-weight:700">Sound test</div><div class="row sndtest" style="margin-top:6px">${SND.TESTS.map(([k, n]) => `<button class="sm" onclick="SND.test('${k}')">${esc(n)}</button>`).join('')}</div>` : ''}</div>`;
}
function exportLeague() { const s = serialize(); const T = UT(); const name = `playcaller-${T.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${L.year}.json`;
  try { const blob = new Blob([s], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast('League file saved'); }
  catch (e) { modal(`<h2>Export</h2><p class="small">Copy this text and keep it somewhere safe.</p><textarea style="width:100%;min-height:240px" onclick="this.select()">${esc(s)}</textarea>`); } }
