// UI shell: navigation, modal, toasts, shared HTML builders, inbox actions.
const app = document.getElementById('app');
let TAB = 'home'; const SUB = { roster: 'All', rosterView: 'cards', depthSide: 'O', depthForm: 'Shotgun', pbSide: 'O', tradeTeam: null, tradeGive: [], tradeGet: [], faPos: 'All', draftPos: 'All', scPos: 'All', viewTeam: null, leadCat: 'py', planSide: 'O', planScen: '1st', recScope: 'mine', devSort: 'gain' };
function qs(s, r) { return (r || document).querySelector(s); }
function toast(text) { const box = document.getElementById('toasts'); if (!box) return; const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; box.appendChild(t); setTimeout(() => t.remove(), 2800); }
function modal(html, cls) { const m = document.getElementById('modal'); m.innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box ${cls || ''}" role="dialog">${html}</div></div>`; paintArt(m); }
function closeModal() { const m = document.getElementById('modal'); if (m) m.innerHTML = ''; }
function uiRes(r) { if (r && r.msg) toast(r.msg); saveGame(); render(); return r; }
// rating colours are style tokens (--rt5 best .. --rt1 worst) so every UI style can tune them
const ovrTier = o => o >= 90 ? 5 : o >= 80 ? 4 : o >= 70 ? 3 : o >= 60 ? 2 : 1;
const ovrColor = o => `var(--rt${ovrTier(o)})`;
const ovrTag = o => `<span class="ovr r${ovrTier(o)}" style="background:${ovrColor(o)}">${o}</span>`;
// morale as five bars (no emoji faces)
const moodTag = m => { const n = m >= 75 ? 5 : m >= 58 ? 4 : m >= 42 ? 3 : m >= 28 ? 2 : 1; return `<span class="mood m${n}" title="Morale ${Math.round(m)}" aria-label="Morale ${Math.round(m)}"><i></i><i></i><i></i><i></i><i></i></span>`; };
function meter(v, col) { return `<div class="meter"><i style="width:${clamp(v, 0, 100)}%;background:${col || (v > 60 ? 'var(--good)' : v > 35 ? 'var(--amber)' : 'var(--bad)')}"></i></div>`; }
function potBar(cur, pot, known, col) { if (!known) return `<div class="pbar unk" title="Not scouted yet"><i style="width:100%"></i><span>?</span></div>`; return `<div class="pbar" title="Now ${Math.round(cur)} · Potential ${Math.round(pot)}"><b style="width:${clamp(pot, 0, 100)}%"></b><i style="width:${clamp(cur, 0, 100)}%;background:${col || ovrColor(cur)}"></i></div>`; }
const bustC = (p, sz, tid) => `<canvas class="bust" data-bust="${p.id}" ${tid != null ? `data-tid="${tid}"` : ''} width="${(sz || 48) > 72 ? 192 : 96}" height="${(sz || 48) > 72 ? 192 : 96}" style="width:${sz || 48}px;height:${sz || 48}px"></canvas>`;
const logoC = (t, sz) => `<canvas class="logo" data-logo="${t.id}" width="${Math.max(64, Math.round((sz || 40) * 2))}" height="${Math.max(64, Math.round((sz || 40) * 2))}" style="width:${sz || 40}px;height:${sz || 40}px"></canvas>`;
const lookC = (lk, sz, tid) => `<canvas class="bust" data-look='${esc(JSON.stringify(lk || genLook('QB')))}' ${tid != null ? `data-tid="${tid}"` : ''} width="${sz > 72 ? 192 : 96}" height="${sz > 72 ? 192 : 96}" style="width:${sz}px;height:${sz}px"></canvas>`;
const starsHTML = n => `<span class="stars big">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
function statLine(s, pos) { if (!s) return ''; const parts = []; if (s.pa) parts.push(`${s.pc || 0}/${s.pa}, ${s.py || 0} yds, ${s.ptd || 0} TD, ${s.pint || 0} INT`); if (s.ra) parts.push(`${s.ra} car, ${s.ry || 0} yds${s.rtd ? ', ' + s.rtd + ' TD' : ''}`); if (s.rec) parts.push(`${s.rec} rec, ${s.recy || 0} yds${s.rectd ? ', ' + s.rectd + ' TD' : ''}`); if (s.tk || s.sk || s.int) parts.push(`${s.tk || 0} tkl${s.sk ? ', ' + s.sk + ' sk' : ''}${s.int ? ', ' + s.int + ' INT' : ''}`); if (s.fga) parts.push(`${s.fgm || 0}/${s.fga} FG`); return parts.join(' · '); }
function phaseLabel() { if (L.phase === 'regular') return `Week ${Math.min(L.week + 1, 17)}`; if (L.phase === 'playoffs') return ROUND_NAMES[L.playoff.round]; return { resign: 'Re-sign players', draft: 'Draft', fa: 'Free agency' }[L.off] || 'Offseason'; }
const NAVG = [
  ['home', 'Home', [['home', 'Home'], ['inbox', 'Inbox']]],
  ['teamg', 'Team', [['roster', 'Roster'], ['depth', 'Depth chart'], ['develop', 'Development'], ['stories', 'Storylines'], ['uniforms', 'Uniforms'], ['teaminfo', 'Team info']]],
  ['plays', 'Plays', [['plan', 'Game plan'], ['playbook', 'Playbook'], ['film', 'Film room']]],
  ['staffg', 'Staff', [['staff', 'Staff room'], ['coach', 'Coach career'], ['facilities', 'Facilities']]],
  ['office', 'Office', [['trade', 'Trade'], ['fa', 'Free agents'], ['scouting', 'Scouting'], ['draft', 'Draft'], ['mock', 'Mock draft'], ['contracts', 'Contracts']]],
  ['leagueg', 'League', [['standings', 'Standings'], ['schedule', 'Schedule'], ['leaders', 'Leaders'], ['history', 'History'], ['records', 'Records'], ['editor', 'Editor']]],
  ['settings', 'More', [['settings', 'Settings']]],
];
const NAV_SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const NAV_ICON = {
  home: NAV_SVG('<path d="M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1H15v-6.2H9V21H4.5a1 1 0 0 1-1-1z"/>'),
  teamg: NAV_SVG('<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20.2c.6-3.7 3.1-5.6 6.2-5.6s5.6 1.9 6.2 5.6"/><path d="M15.4 4.9a3.2 3.2 0 0 1 0 6.3M17.6 14.9c2 .7 3.2 2.4 3.6 5.3"/>'),
  plays: NAV_SVG('<rect x="4.5" y="4" width="15" height="17.2" rx="2.2"/><path d="M9 4V2.8h6V4M8 9l3 3m0-3-3 3"/><circle cx="15.6" cy="16.6" r="1.9"/><path d="M11 13.5c1.6.4 2.6 1.1 3.2 1.8"/>'),
  staffg: NAV_SVG('<path d="M4.5 14.5V12a7.5 7.5 0 0 1 15 0v2.5"/><rect x="3" y="13" width="4" height="6.2" rx="1.6"/><rect x="17" y="13" width="4" height="6.2" rx="1.6"/><path d="M19 19.4c0 1.4-2 2.3-5 2.3"/>'),
  office: NAV_SVG('<rect x="3" y="7" width="18" height="13" rx="2.2"/><path d="M8.8 7V5.2c0-.7.5-1.2 1.2-1.2h4c.7 0 1.2.5 1.2 1.2V7M3 12.6h18M10.5 12.6v1.8h3v-1.8"/>'),
  leagueg: NAV_SVG('<path d="M7.8 3.8h8.4v5.4a4.2 4.2 0 0 1-8.4 0z"/><path d="M7.8 5.8H4.6a3.2 3.2 0 0 0 3.4 4.1M16.2 5.8h3.2a3.2 3.2 0 0 1-3.4 4.1M12 13.4v3.8M8.4 21h7.2M9.6 17.2h4.8V21H9.6z"/>'),
  settings: NAV_SVG('<path d="M4 6.5h9M17.5 6.5H20M4 12h3M11.5 12H20M4 17.5h11M19.5 17.5h.5"/><circle cx="15.2" cy="6.5" r="2.1"/><circle cx="9.2" cy="12" r="2.1"/><circle cx="17.2" cy="17.5" r="2.1"/>'),
};
// readable accent from the user's team colors (dark navy c1 -> try c2 -> lighten c1)
function navAccent(T) {
  const sat = c => { const n = parseInt(String(c).replace('#', ''), 16) || 0, r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (Math.max(r, g, b) - Math.min(r, g, b)) / 255; };
  const ok = c => lum(c) >= 0.3 && lum(c) <= 0.88 && sat(c) > 0.22;
  if (ok(T.c1)) return T.c1; if (ok(T.c2)) return T.c2;
  if (sat(T.c1) > 0.18) { let c = T.c1; for (let i = 0; i < 6 && lum(c) < 0.36; i++) c = shade(c, 0.22); return c; }
  return lum(T.c2) > 0.3 ? T.c2 : '#f2c230';
}
// the user's team colours as CSS tokens: c1, c2, an accent that reads on dark, c1 darkened until it reads on paper, ink for c1/c2
function setTeamTokens(T) {
  const ds = document.documentElement.style, ac = navAccent(T); let dk = T.c1; for (let i = 0; i < 8 && lum(dk) > 0.3; i++) dk = shade(dk, -0.16);
  ds.setProperty('--tc', T.c1); ds.setProperty('--tc2', T.c2); ds.setProperty('--tca', ac); ds.setProperty('--tcon', lum(ac) > 0.55 ? '#10141c' : '#ffffff');
  ds.setProperty('--tcd', dk); ds.setProperty('--tcink', lum(T.c1) > 0.6 ? '#10141c' : '#ffffff'); ds.setProperty('--tc2ink', lum(T.c2) > 0.6 ? '#10141c' : '#ffffff');
}
// ---------- UI styles: a device-level choice (so it dresses the title screen too), kept in localStorage ----------
const UI_STYLES = [['broadcast', 'Broadcast', 'TV graphics: bold team-colour blocks, hard edges'], ['program', 'Game Program', 'Printed game-day program: paper, ink and one spot colour'], ['varsity', 'Varsity', 'Letterman felt patches on the coach\'s chalkboard'], ['night', 'Night Game', 'Matte black under the stadium lights']];
function uiStyle() { let k = null; try { k = localStorage.getItem('pc_style'); } catch (e) { } return UI_STYLES.some(x => x[0] === k) ? k : 'broadcast'; }
function applyUiStyle() { const k = uiStyle(); document.documentElement.dataset.style = k; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = { broadcast: '#15171b', program: '#efe8d8', varsity: '#26332d', night: '#0c0d0e' }[k]; }
function setUiStyle(k) { try { localStorage.setItem('pc_style', k); } catch (e) { } applyUiStyle(); render(); }
function stylePicker() { const cur = uiStyle(); return `<div class="stylepick" role="radiogroup" aria-label="Style"><span class="pos">Style</span>${UI_STYLES.map(([k, n, d]) => `<button role="radio" aria-checked="${cur === k}" class="${cur === k ? 'on' : ''}" title="${d}" onclick="setUiStyle('${k}')"><i class="sw-${k}"></i>${n}</button>`).join('')}</div>`; }
applyUiStyle();
const VIEWS = {};
let LASTSUB = {};
function groupOf(t) { return NAVG.find(g => g[2].some(s => s[0] === t)) || NAVG[0]; }
function go(t) { TAB = t; closeModal(); render(); window.scrollTo(0, 0); }
function goGroup(gid) { const g = NAVG.find(x => x[0] === gid); go(LASTSUB[gid] || g[2][0][0]); }
function unreadCount() { return (L.inbox || []).filter(m => !m.read).length; }
function render() {
  if (!L) { renderTitle(); return; }
  if (L.picking) { renderPickTeam(); return; }
  if (L.retired) { app.innerHTML = retiredHTML(); paintArt(app); return; }
  const T = UT(); setTeamTokens(T);
  const G = groupOf(TAB); LASTSUB[G[0]] = TAB; let body = '';
  const hubCls = TAB === 'home' && !L.ghost && !L.fired ? ' hub-' + hubLayout() : '';
  try { body = (VIEWS[TAB] || VIEWS.home)(); } catch (e) { console.error(e); body = `<div class="panel">Something went wrong drawing this screen: ${esc(e.message)}</div>`; }
  const ur = unreadCount();
  app.innerHTML = `<div class="shell tab-${TAB}${hubCls}"><header class="topbar">${logoC(T, 30)}<div class="tname"><b>${esc(T.name)}</b><span>${T.name !== T.city ? esc(T.city) + " · " : ""}${L.year} · ${phaseLabel()}</span></div><span class="rec" title="Record"><small>Record</small><b>${T.w}-${T.l}${T.tie ? '-' + T.tie : ''}</b></span><span class="cred" title="Coach credits"><small>Credits</small><b>${T.coach.pts}</b></span></header>
  ${G[2].length > 1 ? `<div class="subnav">${G[2].map(([k, n]) => `<button class="${TAB === k ? 'on' : ''}" onclick="go('${k}')">${n}${k === 'inbox' && ur ? ` <i class="badge">${ur}</i>` : ''}</button>`).join('')}</div>` : ''}
  <main class="wrap">${body}</main>
  <nav class="nav"><div class="railtop" aria-hidden="true">${logoC(T, 44)}</div>${NAVG.map(([k, n]) => `<button class="${G[0] === k ? 'on' : ''}" onclick="goGroup('${k}')" aria-label="${n}"${G[0] === k ? ' aria-current="page"' : ''}><span class="ni">${NAV_ICON[k]}</span><span class="nl">${n}</span>${k === 'home' && ur ? `<i class="dot">${ur > 9 ? '9+' : ur}</i>` : ''}</button>`).join('')}</nav></div>`;
  paintArt(app); if (typeof afterRender === 'function') afterRender();
  const rib = app.querySelector('.rib'), cur = app.querySelector('.rib .cur'); if (rib && cur) rib.scrollLeft = cur.offsetLeft - rib.clientWidth / 2 + cur.clientWidth / 2;
}
let AFTER = []; function afterRender() { const a = AFTER; AFTER = []; for (const f of a) try { f(); } catch (e) { console.error(e); } }
// inbox actions
function doAct(act, arg) {
  const T = UT();
  if (act === 'go') { go(arg); return; }
  if (act === 'player') { showPlayer(+arg); return; }
  if (act === 'gmProp') { const P = L.gmProp; if (P && P.id === +arg) { SUB.tradeTeam = P.tid; SUB.tradeGive = P.give.slice(); SUB.tradeGet = P.get.slice(); go('trade'); } else toast('That idea is no longer on the table.'); return; }
  if (act === 'signFA') { const p = L.P[arg]; if (!p || p.tid != null) { toast('He already signed somewhere.'); return; } uiRes(signOffer(p.id, p.ask || askingSalary(p), 2)); return; }
  if (act === 'extend') { extendModal(+arg); return; }
  if (act === 'restructure') { uiRes(restructure(+arg)); return; }
  if (act === 'ownerMeet') { ownerMeetModal(); return; }
}
function retiredHTML() { const c = L.myCoach || UT().coach; return `<div class="wrap" style="max-width:720px"><div class="panel"><span class="pos">RETIRED HEAD COACH</span><h1>${esc(c.fn)} ${esc(c.ln)}</h1><p>Career ${c.w}-${c.l}${c.t ? '-' + c.t : ''} · Playoffs ${c.pw}-${c.pl} · Titles ${c.titles}</p>
  <ul class="news">${(c.hl || []).slice(0, 12).map(h => `<li><b>${h.y}</b> ${esc(h.s)}</li>`).join('')}</ul><div class="row"><button onclick="L=null;render()">Back to careers</button></div></div></div>`; }
