// Title screen: career slots, new career setup, team pick, import.
let NG = { diff: 'pro', qlen: 120, coach: '', slot: null, real: false };
function renderTitle() {
  const m = slotMeta(); const slots = []; for (let n = 1; n <= NSLOTS; n++) slots.push([n, m[n]]);
  if (NG.slot) { renderNewCareer(); return; }
  const ds = document.documentElement.style; for (const k of ['--tc', '--tc2', '--tca', '--tcon', '--tcd', '--tcink', '--tc2ink']) ds.removeProperty(k);
  app.innerHTML = `<div class="wrap title-wrap">
   <section class="hero titlehero art"><canvas class="heroart" data-stadium='{"c1":"#1f6b35","c2":"#f2c230","floor":0.75,"seed":11}'></canvas><div class="hero-inner"><p class="tkick"><span class="tk-broadcast">Live · Football night</span><span class="tk-program">Official game program · Vol. 26</span><span class="tk-varsity">Varsity football · Est. 1926</span><span class="tk-night">Under the lights</span></p><p class="title"><span class="t1">Play</span><br><span class="t2">Caller</span></p><p class="tagline">Run the franchise. Call the plays. Feel every hit.</p></div></section>
   <div class="tbar"><button class="pri" onclick="quickExhibition()">Quick game</button><input type="file" accept=".json,application/json" id="impf" hidden onchange="importLeagueFile(this)"><button onclick="document.getElementById('impf').click()">Import league file</button><span class="sp"></span>${stylePicker()}</div>
   ${dailyCard()}
   <h3 class="slots-h">Careers</h3>
   <div class="slots">${slots.map(([n, s]) => s ? `<div class="slot" style="--sc:${s.c1 || '#335'}"><span class="pos">SLOT ${n}</span><b>${esc(s.team)}</b><span>Coach ${esc(s.coach)}</span><span class="mute small">${s.year} · ${esc(s.rec)}${s.titles ? ` · ${s.titles} title${s.titles > 1 ? 's' : ''}` : ''}</span>
      <div class="row"><button class="pri" onclick="continueSlot(${n})">Continue</button><button class="sm" onclick="if(confirm('Delete this career? This cannot be undone.'))deleteSlot(${n}).then(renderTitle)">Delete</button></div></div>`
    : `<div class="slot empty"><span class="pos">SLOT ${n}</span><b>Empty</b><span class="mute small">Start a new coaching career</span><div class="row"><button class="go" onclick="NG.slot=${n};renderTitle()">New career</button></div></div>`).join('')}</div></div>`;
  if (typeof paintArt === 'function') requestAnimationFrame(() => paintArt(app));
}
async function continueSlot(n) { try { await loadSlot(n); TAB = 'home'; render(); } catch (e) { toast('That save could not be loaded.'); } }
function renderNewCareer() {
  const opt = (k, arr, cur) => `<div class="seg">${arr.map(([v, n]) => `<button class="${cur === v ? 'on' : ''}" onclick="NG.${k}=${typeof v === 'string' ? `'${v}'` : v};renderNewCareer()">${n}</button>`).join('')}</div>`;
  app.innerHTML = `<div class="wrap" style="max-width:720px"><button class="sm" onclick="NG.slot=null;renderTitle()">‹ Back</button>
   <div class="panel" style="margin-top:12px"><h2>New career · slot ${NG.slot}</h2>
   <h3>League</h3><div class="lgpick"><button class="${NG.real ? "" : "on"}" onclick="NG.real=false;renderNewCareer()"><b>Made-up league</b><span>32 invented teams: new cities, names, logos and players.</span></button><button class="${NG.real ? "on" : ""}" onclick="NG.real=true;renderNewCareer()"><b>Real cities</b><span>The 32 real markets in their real conferences and divisions, in their real team colors, with strength based on recent seasons. Team nicknames, logos and players are not built in (they belong to the league and the players): teams go by their city with an original emblem, and you can rename any team or player, or paste in a roster, in League › Editor.</span></button></div>
   <h3 style="margin-top:12px">Difficulty</h3>${opt('diff', Object.entries(DIFFS).map(([k, d]) => [k, d.n]), NG.diff)}
   <h3 style="margin-top:12px">Quarter length</h3>${opt('qlen', [[60, '1 min'], [120, '2 min'], [180, '3 min'], [240, '4 min'], [300, '5 min']], NG.qlen)}
   <h3 style="margin-top:12px">Your name</h3><input id="cname" value="${esc(NG.coach)}" placeholder="Coach name" oninput="NG.coach=this.value" style="width:100%">
   <div class="row" style="margin-top:14px"><button class="pri big" onclick="createLeague()">Create league</button></div></div></div>`;
}
function createLeague() { CUR_SLOT = NG.slot || freeSlot() || 1; newLeague({ diff: NG.diff, qlen: NG.qlen, real: NG.real }); render(); }
function renderPickTeam() {
  const ts = L.teams.slice().sort((a, b) => teamOvr(b) - teamOvr(a));
  app.innerHTML = `<div class="wrap"><h1>Pick your team</h1><p class="mute">Stronger teams come with higher owner expectations. Each owner has a personality.</p>
  <div class="teamgrid">${ts.map(t => `<button class="teamcard" onclick="pickTeam(${t.id})">${logoC(t, 48)}<div><b>${esc(teamLabel(t))}</b><div class="row small">${ovrTag(teamOvr(t))}<span class="stars">${stars(teamOvr(t))}</span></div><div class="small mute">${esc(t.offStyle)} · ${esc(t.defStyle)} · Owner: ${OWNERP[ownerPersona(t)][0]}</div></div></button>`).join('')}</div>
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
  if (id === window._exh) return; closeModal(); const g = { h: id, a: window._exh, done: false }; setTeamTokens(L.teams[window._exh]);
  if (typeof MATCH !== 'undefined') MATCH.open({ g, home: L.teams[g.h], away: L.teams[g.a], userTid: L.user, mode: 'play', onDone: () => { L = null; render(); } });
  else { toast('The match engine is not loaded.'); L = null; render(); }
}
function importLeagueFile(inp) { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const slot = freeSlot(); if (!slot) { toast('All career slots are full.'); return; } CUR_SLOT = slot; deserialize(r.result); saveGame(true); TAB = 'home'; render(); toast(`League imported into slot ${slot}`); } catch (e) { toast('That file is not a Playcaller league.'); } }; r.readAsText(f); }

// ---------- the daily drive: one late-game situation a day, the same for everyone (seeded by the date only), played in the real match ----------
// Two fixed teams too: the whole league is generated from the date's seed (withSeed, src/core/00_util.js). Your best is kept on this device,
// and "Copy result" gives a short line of text to send to friends. No server.
const DAILY_KEY = 'pc_daily_v1';
function dailyDate(d) { d = d || new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dailySeed(date) { let h = 2166136261; for (const c of 'playcaller-daily|' + date) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function dailyScen(date) {
  const r = seededRng(dailySeed(date)), pk = a => a[Math.floor(r() * a.length)];
  const down = pk([3, 4, 4, 5, 6, 7, 7, 8, 2, 0]), clock = 35 + Math.floor(r() * 24) * 5, yl = 15 + Math.floor(r() * 26), to = pk([0, 1, 1, 2, 2, 3]), foe = pk(['top', 'top', 'rush', 'cover', 'run']);
  const us = pk([10, 13, 14, 17, 20, 21, 24]), home = r() < 0.5, clk = `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')}`;
  const foeTxt = { top: 'a top defense', rush: 'a fierce pass rush', cover: 'a ball-hawking secondary', run: 'a stout run defense' }[foe];
  const txt = `${down ? `Down ${down}` : 'Tied'}, ${clk} left, ball on your ${yl}, ${to} timeout${to === 1 ? '' : 's'}, vs ${foeTxt}`;
  const det = `Ball on your ${yl} · ${to} timeout${to === 1 ? '' : 's'} · vs ${foeTxt}`;
  return { date, down, clock, yl, to, foe, us, them: us + down, home, txt, det, short: `${down ? 'Down ' + down : 'Tied'} · ${clk} left`, seed: dailySeed(date) };
}
function dailyStore() { try { const s = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
function dailyBest(date) { const b = dailyStore()[date]; return b && typeof b.score === 'number' ? b : null; }
function dailySave(date, res) {
  const s = dailyStore(), b = s[date]; if (b && b.score >= res.score) return false;
  s[date] = { score: res.score, res: `${res.how}, ${res.verdict.toLowerCase()}`, copy: res.copy };
  for (const k of Object.keys(s).sort().slice(0, -30)) delete s[k];       // keep a month
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(s)); } catch (e) { } return true;
}
function dailyCard() {
  const S = dailyScen(dailyDate()), b = dailyBest(S.date);
  return `<section class="daily cx-card"><div class="dl"><span class="pos">Daily drive · ${esc(S.date)}</span><b>${esc(S.short)}</b><span class="dt">${esc(S.det)}</span>${b ? `<span class="db">Your best today: <em>${b.score}</em> · ${esc(b.res)}</span>` : '<span class="dm">The same situation for everyone today: compare scores with friends.</span>'}</div>
    <div class="row"><button class="pri" onclick="dailyPlay()">Play</button>${b ? '<button onclick="dailyCopy()">Copy result</button>' : ''}</div></section>`;
}
function dailyPlay() {
  if (typeof MATCH === 'undefined') { toast('The match engine is not loaded.'); return; }
  const S = dailyScen(dailyDate());
  // the same league for everyone today: your team from the middle of the pack, theirs picked for the defense the situation names
  withSeed(S.seed, () => newLeague({ diff: 'pro', qlen: 900 }));
  const ts = L.teams.slice(), byOvr = ts.slice().sort((a, b) => teamOvr(a) - teamOvr(b) || a.id - b.id), mine = byOvr[12 + (S.seed % 8)];
  const key = { top: t => teamPower(t).def, rush: t => scoutOpp(t).rush, cover: t => scoutOpp(t).cover, run: t => scoutOpp(t).runD }[S.foe] || (t => teamPower(t).def);
  const them = ts.filter(t => t !== mine).sort((a, b) => key(b) - key(a) || a.id - b.id)[0];
  withSeed(S.seed + 1, () => chooseTeam(mine.id, 'Coach')); L.exhibition = true; L.picking = false;
  const g = S.home ? { h: mine.id, a: them.id, done: false } : { h: them.id, a: mine.id, done: false }; setTeamTokens(mine);
  const daily = Object.assign({}, S, { teams: `${teamLabel(mine)} vs ${teamLabel(them)}` });
  withSeed(S.seed + 2, () => MATCH.open({ g, home: L.teams[g.h], away: L.teams[g.a], userTid: mine.id, mode: 'play', daily, onDone: r => dailyDone(S, r) }));
}
function dailyDone(S, r) { L = null; const d = r && r.daily, best = d ? dailySave(S.date, d) : false; render(); if (d) toast(best ? `Daily drive: ${d.score}, your best today` : `Daily drive: ${d.score}`); }
function dailyCopy() { const b = dailyBest(dailyDate()); if (b && b.copy) dailyCopyText(b.copy); }
// copy to the clipboard (falls back to a box to copy from by hand); btn: a button to say "Copied" on
function dailyCopyText(text, btn) {
  const ok = () => { if (btn) { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy result'; }, 1600); } else toast('Copied: paste it to your friends'); };
  const hand = () => { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); let done = false; try { done = document.execCommand('copy'); } catch (e) { } ta.remove();
    if (done) ok(); else if (!btn) modal(`<h2>Copy result</h2><textarea style="width:100%;min-height:110px" readonly onclick="this.select()">${esc(text)}</textarea>`); else { btn.textContent = 'Copy failed'; } };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, hand); return; } } catch (e) { }
  hand();
}
