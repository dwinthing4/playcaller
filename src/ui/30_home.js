// Home hub, inbox, owner meetings, offseason steps, playing a game.
const FROM = { gm: ['GM', '💼'], owner: ['Owner', '🏛'], scout: ['Scouts', '🔭'], coach: ['Coaches', '📈'], player: ['Locker room', '🏈'], league: ['League', '📣'], oc: ['OC', '📋'], dc: ['DC', '🛡'] };
function startUserGame(mode) {
  const g = currentUserGame(); if (!g) return; const T = UT();
  if (T.roster.filter(available).length < 45) { toast('You need at least 45 healthy players.'); return; }
  ensurePlan();
  if (typeof MATCH !== 'undefined' && mode !== 'instant') {
    MATCH.open({ g, home: L.teams[g.h], away: L.teams[g.a], userTid: L.user, mode, onDone: result => { if (result && !result.quit && !g.done) applyMatchResult(g, result); saveGame(true); TAB = 'home'; render(); if (L.lastGameInfo && result && !result.quit) setTimeout(pressConf, 300); } });
  } else { instantUserGame(); saveGame(); render(); }
}
function weekRibbon() {
  const T = UT(); const items = [];
  L.sched.forEach((wk, i) => { const g = wk.find(x => x.h === T.id || x.a === T.id); if (g) items.push({ lab: 'WK ' + (i + 1), g, cur: L.phase === 'regular' && i === L.week }); });
  for (const r of L.results.filter(r => r.po && r.y === L.year && (r.h === T.id || r.a === T.id))) items.push({ lab: 'PLAYOFF', g: { h: r.h, a: r.a, hs: r.hs, as: r.as, done: true } });
  const pg = userPlayoffGame(); if (pg) items.push({ lab: ROUND_NAMES[L.playoff.round].toUpperCase(), g: pg, cur: true });
  return `<div class="rib">${items.map(it => { const g = it.g; const home = g.h === T.id; const opp = L.teams[home ? g.a : g.h]; let cls = '', resx = '';
    if (g.done) { const my = home ? g.hs : g.as, th = home ? g.as : g.hs; cls = my > th ? 'w' : my < th ? 'l' : 't'; resx = `<b>${my > th ? 'W' : my < th ? 'L' : 'T'} ${my}-${th}</b>`; } else resx = `<span class="mute">${home ? 'HOME' : 'AWAY'}</span>`;
    return `<div class="ri ${cls} ${it.cur ? 'cur' : ''}"><span class="rl">${it.lab}</span>${logoC(opp, 34)}<span class="ro">${home ? 'vs' : '@'} ${opp.abbr}</span>${resx}</div>`; }).join('')}</div>`;
}
function starRow(v) { const n = Math.round(clamp((v - 55) / 6.5, 0.5, 5) * 2) / 2; return `<span class="srating" title="${n} of 5"><span class="s0">★★★★★</span><span class="s1" style="width:${n / 5 * 100}%">★★★★★</span></span>`; }
function matchHero(g) {
  const away = L.teams[g.a], home = L.teams[g.h];
  const side = t => { const pw = teamPower(t); return `<div class="mside">${logoC(t, 84)}<b>${esc(t.name)}</b><span class="small">${t.w}-${t.l}${t.tie ? '-' + t.tie : ''} · ${ovrTag(teamOvr(t))}</span><div class="srow"><span>OFF</span>${starRow(pw.off)}</div><div class="srow"><span>DEF</span>${starRow(pw.def)}</div></div>`; };
  const opp = g.h === L.user ? away : home; const riv = isRival(UT(), opp);
  const art = JSON.stringify({ c1: home.c1, c2: home.c2, left: away.c1, right: home.c1, seed: home.id * 7 + 3, floor: 0.6 });
  return `<section class="hero mhero art"><canvas class="heroart" data-stadium='${art}'></canvas><div class="small heroLab">${L.phase === 'playoffs' ? ROUND_NAMES[L.playoff.round] : 'Week ' + (L.week + 1) + ' of 17'}${riv ? ' · 🔥 Rivalry' : ''}</div>
   <div class="match2">${side(away)}<div class="vs">@</div>${side(home)}</div>
   <div class="row playrow"><button class="pri big" onclick="startUserGame('play')">Play</button><button onclick="startUserGame('watch')">Watch</button><button onclick="startUserGame('instant')">Instant</button>${L.phase === 'regular' ? '<button class="sm ghost" onclick="if(confirm(\'Sim the rest of the regular season?\')){simToPlayoffs();saveGame();render();}">Sim to playoffs</button>' : ''}</div></section>`;
}
function briefingCard() {
  const P = ensurePlan(); if (!P) return ''; const T = UT();
  return `<div class="panel brief"><div class="row"><h3 style="margin:0">Coordinator briefing</h3><span class="sp"></span><button class="sm ${P.locked ? '' : 'pri'}" onclick="go('plan')">${P.locked ? '✓ Plan locked' : 'Open game plan'}</button></div>
   <div class="say">${lookC(T.oc.lk, 44)}<p><b>${esc(T.oc.fn)} ${esc(T.oc.ln)}, OC:</b> ${esc(P.intro.O)}</p></div>
   <div class="say">${lookC(T.dc.lk, 44)}<p><b>${esc(T.dc.fn)} ${esc(T.dc.ln)}, DC:</b> ${esc(P.intro.D)}</p></div></div>`;
}
function inboxItem(m, short) {
  const f = FROM[m.from] || ['League', '📣'];
  return `<div class="msg ${m.read ? '' : 'unread'}" onclick="markRead(${m.id})"><div class="mi">${f[1]}</div><div class="sp"><div class="row"><b>${esc(m.title)}</b><span class="sp"></span><span class="mute small">${f[0]} · ${m.y === L.year ? 'wk ' + (m.w + 1) : m.y}</span></div>
   <div class="mb ${short ? 'clip' : ''}">${m.html ? m.body : esc(m.body)}</div>${(m.actions || []).length ? `<div class="row" style="margin-top:6px">${m.actions.map(a => `<button class="sm" onclick="event.stopPropagation();markRead(${m.id},true);doAct('${a.act}',${esc(JSON.stringify(a.arg))})">${esc(a.label)}</button>`).join('')}</div>` : ''}</div></div>`;
}
function markRead(id, quiet) { const m = (L.inbox || []).find(x => x.id === id); if (m && !m.read) { m.read = true; if (!quiet) render(); } }
VIEWS.inbox = function () {
  const list = L.inbox || []; return `<div class="row" style="margin-bottom:10px"><h2 style="margin:0">Inbox</h2><span class="sp"></span><button class="sm" onclick="(L.inbox||[]).forEach(m=>m.read=true);render()">Mark all read</button></div>
  <div class="inbox">${list.map(m => inboxItem(m, false)).join('') || '<p class="mute">Nothing yet.</p>'}</div>`;
};
VIEWS.home = function () {
  if (L.ghost || L.fired) return careerLimbo();
  if (L.recap && !L.recap.seen && L.phase === 'offseason') AFTER.push(showRecap);
  if (L.ownerMeet && !L.ownerMeet.done && L._omShown !== L.ownerMeet.id && L.ownerMeet.y === L.year) { L._omShown = L.ownerMeet.id; AFTER.push(ownerMeetModal); }
  const c = hubCtx(), lay = hubLayout();
  const offers = (L.offers || []).length ? `<div class="panel hb-offers"><h3>Job offers</h3>${L.offers.map((o, i) => { const t = L.teams[o.tid]; return `<div class="row">${logoC(t, 34)}<div class="sp"><b>${esc(teamName(t))}</b><div class="small mute">${o.kind === 'mid' ? 'Want you now' : 'Head coach opening'} · ${money(o.sal)}/yr × ${o.yrs}</div></div><button class="go sm" onclick="if(confirm('Take the ${esc(t.name)} job?'))uiRes(acceptOffer(${i}))">Accept</button><button class="sm" onclick="L.offers.splice(${i},1);render()">Decline</button></div>`; }).join('')}</div>` : '';
  const body = lay === 'cast' ? hubCast(c) : lay === 'locker' ? hubLocker(c) : hubDash(c);
  return `${hubBar(lay)}${offers}${body}`;
};
// ---------- hub: switchable home layouts (Dashboard / Broadcast / Locker room) built from one card library ----------
const HUB_LAYOUTS = [['dash', 'Dashboard'], ['cast', 'Broadcast'], ['locker', 'Locker room']];
const HUB_SVG = {
  dash: NAV_SVG('<rect x="3" y="3" width="8" height="10" rx="1.6"/><rect x="13" y="3" width="8" height="6" rx="1.6"/><rect x="13" y="11" width="8" height="10" rx="1.6"/><rect x="3" y="15" width="8" height="6" rx="1.6"/>'),
  cast: NAV_SVG('<rect x="2.5" y="5" width="19" height="13" rx="2"/><path d="M8 21h8M8.5 2.5 12 5l3.5-2.5M6 14.5h7"/>'),
  locker: NAV_SVG('<rect x="3.5" y="2.5" width="17" height="19" rx="1.6"/><path d="M12 2.5v19M6.5 6h3M6.5 8h3M14.5 6h3M14.5 8h3M9.5 12.5v2.5M14.5 12.5v2.5"/>'),
};
const HUB_QI = {
  depth: NAV_SVG('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4.5 4.5H6V9M4.2 9h3.4M4.2 13.6c.3-.7.9-1 1.6-1 .9 0 1.6.6 1.6 1.4 0 1.3-3.3 2-3.3 3.9h3.4"/>'),
  develop: NAV_SVG('<path d="M3.5 20.5h17"/><path d="m5 16 4.5-4.5 3.5 3L20 7.5"/><path d="M15 7.5h5v5"/>'),
  inbox: NAV_SVG('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.8 6.6 8.2 6.2 8.2-6.2"/>'),
  trade: NAV_SVG('<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>'),
  fa: NAV_SVG('<path d="M6 3.5h8l4 4V20a.9.9 0 0 1-.9.9H6a.9.9 0 0 1-.9-.9V4.4c0-.5.4-.9.9-.9z"/><path d="M14 3.5v4h4M8.5 13h7M8.5 16.5h4.5"/>'),
  scouting: NAV_SVG('<circle cx="6.8" cy="15.5" r="3.6"/><circle cx="17.2" cy="15.5" r="3.6"/><path d="M10.4 15h3.2M4.8 12.2l1.9-6.7h2.6l.9 6.2M19.2 12.2l-1.9-6.7h-2.6l-.9 6.2"/>'),
  standings: NAV_SVG('<path d="M3.5 20.5h17M6.5 20.5v-6M12 20.5V5.5M17.5 20.5v-9.5"/>'),
  schedule: NAV_SVG('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2"/>'),
  sim: NAV_SVG('<path d="M4 6.5v11l7-5.5zM12.5 6.5v11l7-5.5z"/>'),
};
const HUB_DEV = { star: ['Superstar', '#f2c230'], quick: ['Quick', '#5fd38a'], normal: ['Normal', '#9fb0bd'], slow: ['Slow', '#f29c6b'] };
const HUB_LCATS = [['py', 'Passing yds'], ['ry', 'Rushing yds'], ['recy', 'Receiving yds'], ['sk', 'Sacks'], ['int', 'Interceptions'], ['tk', 'Tackles']];
function hubLayout() { const k = L && L.settings && L.settings.hubLayout; return HUB_LAYOUTS.some(x => x[0] === k) ? k : 'dash'; }
function setHubLayout(k) { if (!L.settings) L.settings = {}; L.settings.hubLayout = k; saveGame(); render(); window.scrollTo(0, 0); }
const hubRec = t => `${t.w}-${t.l}${t.tie ? '-' + t.tie : ''}`;
const hubOrd = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
function hubStreak(t) { const s = t.streak || 0; return s > 0 ? 'W' + s : s < 0 ? 'L' + -s : '—'; }
function hubLite(c) { let x = c || '#8899aa'; for (let i = 0; i < 5 && lum(x) < 0.3; i++) x = shade(x, 0.25); return x; }
const hubInk = c => lum(c || '#000') > 0.62 ? '#10141c' : '#ffffff';
const hubHead = (t, right) => `<div class="hb-h"><h3>${t}</h3><span class="sp"></span>${right || ''}</div>`;
const hubMore = (lab, tab) => `<button class="sm ghost hb-more" onclick="go('${tab}')">${lab} ›</button>`;
function hubCtx() {
  const T = UT(), g = currentUserGame(), opp = g ? L.teams[g.h === T.id ? g.a : g.h] : null;
  const sc = t => { const n = t.w + t.l + t.tie; return (n ? pct(t) : 0.5) * 55 + teamOvr(t) * 0.6 + (n ? (t.pf - t.pa) / n : 0) * 0.8; };
  const mine = sc(T);
  return { T, g, opp, home: g ? g.h === T.id : false, ros: T.roster.map(id => L.P[id]).filter(Boolean), pr: 1 + L.teams.filter(t => t !== T && sc(t) > mine).length, cr: sortTeams(L.teams.filter(t => t.conf === T.conf)).indexOf(T) + 1 };
}
function hubBar(lay) { const c = UT().coach;
  return `<div class="hb-bar"><div class="hb-hi"><span class="pos">${L.year} · ${esc(phaseLabel())}</span><b>Coach ${esc(c.ln)}</b></div>
   <div class="hb-sw" role="tablist" aria-label="Home layout">${HUB_LAYOUTS.map(([k, n]) => `<button role="tab" aria-selected="${lay === k}" class="${lay === k ? 'on' : ''}" title="${n}" onclick="setHubLayout('${k}')">${HUB_SVG[k]}<span>${n}</span></button>`).join('')}</div></div>`; }
function hubPlayBtns() { return `<div class="row playrow"><button class="pri big" onclick="startUserGame('play')">Play</button><button onclick="startUserGame('watch')">Watch</button><button onclick="startUserGame('instant')">Instant</button>${L.phase === 'regular' ? `<button class="sm ghost" onclick="if(confirm('Sim the rest of the regular season?')){simToPlayoffs();saveGame();render();}">Sim to playoffs</button>` : ''}</div>`; }
function hubNoGame() {
  if (L.phase === 'playoffs') return `<div class="panel hb-bye"><span class="pos">Playoffs</span><h2>${ROUND_NAMES[L.playoff.round]}</h2><p>${L.playoff.alive[L.user] ? 'You have a bye this round.' : 'Your season is over. You missed out this year.'}</p><button class="pri" onclick="simPlayoffRound();saveGame();render()">Sim round</button></div>`;
  return `<div class="hb-off">${offseasonPanel()}</div>`;
}
function hubKeyStat(p) { const s = p.st || {}; if (!s.gp) return `Age ${p.age} · ${(HUB_DEV[p.dev] || HUB_DEV.normal)[0]} dev`;
  switch (p.pos) {
    case 'QB': return `${s.py || 0} yds · ${s.ptd || 0} TD · ${s.pint || 0} INT`;
    case 'RB': case 'FB': return `${s.ry || 0} rush yds · ${(s.rtd || 0) + (s.rectd || 0)} TD`;
    case 'WR': case 'TE': return `${s.rec || 0} rec · ${s.recy || 0} yds · ${s.rectd || 0} TD`;
    case 'DE': case 'DT': return `${s.sk || 0} sacks · ${s.tk || 0} tkl`;
    case 'LB': case 'S': return `${s.tk || 0} tkl${s.int ? ' · ' + s.int + ' INT' : s.sk ? ' · ' + s.sk + ' sk' : ''}`;
    case 'CB': return `${s.int || 0} INT · ${s.pd || 0} PD · ${s.tk || 0} tkl`;
    case 'K': return `${s.fgm || 0}/${s.fga || 0} FG · ${s.xpm || 0} XP`;
    case 'P': return `${s.pnt || 0} punts${s.pnt ? ' · ' + (s.pnty / s.pnt).toFixed(1) + ' avg' : ''}`;
    default: return `${s.gp} games started`;
  } }
function hubTier(p) { if (typeof devTier === 'function') { try { const d = devTier(p); if (d && d.n) return { n: d.n, c: d.c || '#9fb0bd' }; } catch (e) { } } const d = HUB_DEV[p.dev] || HUB_DEV.normal; return { n: d[0], c: d[1] }; }
function hubGrade(p) { if (typeof potGrade !== 'function') return null; try { const g = potGrade(p); return g && g.g ? g : null; } catch (e) { return null; } }
function hubSpark(v) { const w = 58, h = 26, mn = Math.min(...v) - 1, mx = Math.max(...v) + 1; const pts = v.map((y, i) => `${(i / (v.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 2 - (y - mn) / (mx - mn) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="hb-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="OVR by season"><polyline points="${pts}"/><circle cx="${w - 2}" cy="${(h - 2 - (v[v.length - 1] - mn) / (mx - mn) * (h - 4)).toFixed(1)}" r="2.6"/></svg>`; }
// young players on the rise: weekly progression reports + offseason jumps + OVR history + room to grow
function hubRisers(T, n) {
  const ups = {}; for (const h of L.devHist || []) if (h && h.y === L.year && h.byP) for (const id in h.byP) ups[id] = (ups[id] || 0) + ((h.byP[id].up || []).length);
  const off = {}, op = L.offProg; if (op && (op.y === L.year - 1 || L.phase === 'offseason')) for (const u of op.up || []) off[u.id] = u.d;
  const out = [];
  for (const id of T.roster) { const p = L.P[id]; if (!p || p.age > 25) continue;
    const oh = (p.ovrHist || []).filter(e => e && typeof e.ovr === 'number'); const base = oh.filter(e => e.y < L.year).pop();
    const d = base ? p.ovr - base.ovr : 0, u = ups[id] || 0, o = off[id] || 0, room = Math.max(0, (p.pot || p.ovr) - p.ovr);
    if (!u && o <= 0 && d <= 0 && room < 4) continue;
    const s = u + o * 1.6 + Math.max(0, d) * 1.3 + room * 0.22 + ({ star: 3, quick: 1.5, slow: -1 }[p.dev] || 0) + (25 - p.age) * 0.35;
    const trend = o > 0 ? `+${o} OVR offseason` : d > 0 ? `+${d} since ${base.y}` : u > 0 ? `+${u} skill pts` : '';
    const sp = oh.map(e => e.ovr); if (sp.length && (oh[oh.length - 1].y < L.year || oh[oh.length - 1].ovr !== p.ovr)) sp.push(p.ovr);
    out.push({ p, s, trend, spark: sp.length >= 2 ? sp.slice(-8) : null }); }
  return out.sort((a, b) => b.s - a.s).slice(0, n);
}
function hubLeadData(n) { const pl = Object.values(L.P).filter(p => p.tid != null && L.teams[p.tid] && p.st && p.st.gp);
  return HUB_LCATS.slice(0, n).map(([k, lab]) => ({ k, lab, top: pl.filter(p => (p.st[k] || 0) > 0).sort((a, b) => (b.st[k] || 0) - (a.st[k] || 0)).slice(0, 3) })); }
function hubNewsTag(s) { return /^Final/i.test(s) ? ['Final', 'f'] : /healthy|returns|back from/i.test(s) ? ['Health', 'g'] : /injur|hurt|torn|out for/i.test(s) ? ['Injury', 'i'] : /sign|trade|deal|releas|waive|cut |contract|extension|draft/i.test(s) ? ['Moves', 'm'] : /record|MVP|award|Hall|champion|playoff|seed|clinch/i.test(s) ? ['Headline', 'h'] : ['League', 'l']; }
// ---------- cards ----------
function hubSnap(c) { const T = c.T, n = T.w + T.l + T.tie, mor = teamMorale(T), used = capUsed(T), [js] = jobSecurity();
  const rc = v => v > 60 ? 'var(--good)' : v > 35 ? 'var(--amber)' : 'var(--bad)';
  const ring = (v, lab) => `<div class="hb-ring" style="--v:${Math.round(clamp(v, 0, 100))};--rc:${rc(v)}"><b>${Math.round(v)}</b><span>${lab}</span></div>`;
  const jcls = /hot/i.test(js) ? 'hot' : /warm/i.test(js) ? 'warn' : '';
  return `<section class="hb-card hb-snap">${hubHead('Team snapshot', `<span class="hb-js ${jcls}" title="Job security">${esc(js)}</span>`)}
   <div class="hb-snaptop"><div class="hb-rec"><b>${hubRec(T)}</b><span>${hubStreak(T)} · ${hubOrd(divRank(T))} in ${esc(T.div)}</span></div><div class="hb-ovrb"><span>OVR</span><b>${teamOvr(T)}</b></div></div>
   <div class="hb-kpis"><div><b>#${c.pr}</b><span>Power</span></div><div><b>#${c.cr}</b><span>${esc(confName(T.conf) || 'Conf')}</span></div><div><b>${n ? (T.pf / n).toFixed(1) : '—'}</b><span>Pts / g</span></div><div><b>${n ? (T.pa / n).toFixed(1) : '—'}</b><span>Allowed</span></div></div>
   <div class="hb-rings">${ring(mor, 'Morale')}${ring(T.ownerSup, 'Owner')}${ring(T.fanSup, 'Fans')}</div>
   <div class="hb-cap"><div class="row small"><b>Salary cap</b><span class="sp"></span><span class="mute">${money(used)} of ${money(CAP)}</span></div><div class="hb-capbar"><i style="width:${clamp(used / CAP * 100, 0, 100)}%${used > CAP * 0.97 ? ';background:var(--bad)' : ''}"></i></div><div class="small"><b>${money(capRoom(T))}</b> <span class="mute">room</span></div></div></section>`; }
function hubStars(c) { const ps = c.ros.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  return `<section class="hb-card hb-stars">${hubHead('Star players', hubMore('Roster', 'roster'))}<div class="hb-strip">${ps.map(p => `<button class="hb-sc" onclick="showPlayer(${p.id})">${bustC(p, 88)}<span class="hb-sco" style="background:${ovrColor(p.ovr)}">${p.ovr}</span>${p.inj ? `<span class="hb-inj">INJ ${p.inj}w</span>` : ''}<span class="hb-scp">${p.pos} · #${p.num}</span><b>${esc(p.ln)}</b><span class="hb-scs">${esc(hubKeyStat(p))}</span></button>`).join('')}</div></section>`; }
function hubStandings(c) { const T = c.T, dv = sortTeams(L.teams.filter(t => t.conf === T.conf && t.div === T.div)), ld = dv[0];
  return `<section class="hb-card hb-stand">${hubHead(`${esc(T.div)} division`, hubMore('Standings', 'standings'))}
   <table class="hb-tbl"><tr><th>#</th><th>Team</th><th>W-L</th><th>PCT</th><th>GB</th><th>DIFF</th><th>STRK</th></tr>${dv.map((t, i) => { const gb = ((ld.w - t.w) + (t.l - ld.l)) / 2, df = t.pf - t.pa;
    return `<tr class="${t.id === T.id ? 'me' : ''} click" onclick="teamModal(${t.id})"><td class="hb-rk">${i + 1}</td><td><div class="hb-tn">${logoC(t, 22)}<span>${esc(t.abbr)}</span><span class="hb-full">${esc(t.name)}</span></div></td><td>${hubRec(t)}</td><td>${(t.w + t.l + t.tie ? pct(t) : 0).toFixed(3).replace(/^0/, '')}</td><td>${gb > 0 ? (gb % 1 ? gb.toFixed(1) : gb) : '—'}</td><td class="${df > 0 ? 'hb-pl' : df < 0 ? 'hb-mn' : ''}">${df > 0 ? '+' : ''}${df}</td><td>${hubStreak(t)}</td></tr>`; }).join('')}</table></section>`; }
function hubLeaders(n) { const D = hubLeadData(n || 4);
  if (!D.some(d => d.top.length)) return `<section class="hb-card hb-lead">${hubHead('League leaders')}<p class="mute small">Leaders show up after the first week of games.</p></section>`;
  return `<section class="hb-card hb-lead">${hubHead('League leaders', hubMore('All leaders', 'leaders'))}<div class="hb-lgrid">${D.map(d => { const p = d.top[0]; if (!p) return `<div class="hb-lt"><div class="hb-ltk">${d.lab}</div><p class="mute small">No leader yet.</p></div>`; const t = L.teams[p.tid];
    return `<div class="hb-lt ${p.tid === L.user ? 'mine' : ''}" style="--c:${hubLite(t.c1)}"><div class="hb-ltk">${d.lab}</div><button class="hb-ltp" onclick="showPlayer(${p.id})">${bustC(p, 50)}<div class="hb-ltn"><b>${esc(p.fn[0])}. ${esc(p.ln)}</b><span>${p.pos} · ${esc(t.abbr)}</span></div><em>${p.st[d.k]}</em></button>${d.top.slice(1).map((q, i) => `<div class="hb-lr click ${q.tid === L.user ? 'mine' : ''}" onclick="showPlayer(${q.id})"><span>${i + 2}</span><span class="sp">${esc(q.ln)} <i>${esc(L.teams[q.tid].abbr)}</i></span><b>${q.st[d.k]}</b></div>`).join('')}</div>`; }).join('')}</div></section>`; }
function hubNews(n, title) { const N = (L.news || []).slice(0, n || 8);
  return `<section class="hb-card hb-news">${hubHead(title || 'League wire')}<ul class="hb-feed">${N.map(x => { const [tg, k] = hubNewsTag(x.s); return `<li><span class="hb-ntag n-${k}">${tg}</span><span class="sp">${esc(x.s)}</span><span class="hb-nw">${x.y !== L.year ? x.y : x.w < 17 ? 'WK ' + (x.w + 1) : 'POST'}</span></li>`; }).join('') || '<li class="mute">Quiet around the league.</li>'}</ul></section>`; }
function hubMsgRow(m) { const f = FROM[m.from] || ['League', '📣'], a = (m.actions || [])[0];
  return `<div class="hb-mrow ${m.read ? '' : 'unread'}" onclick="markRead(${m.id},true);go('inbox')"><span class="mi">${f[1]}</span><span class="hb-mt">${esc(m.title)}</span><span class="hb-mf">${f[0]}</span>${a ? `<button class="sm" onclick="event.stopPropagation();markRead(${m.id},true);doAct('${a.act}',${esc(JSON.stringify(a.arg))})">${esc(a.label)}</button>` : ''}</div>`; }
function hubInbox(c, n, compact) { const all = L.inbox || [], un = all.filter(m => !m.read), list = compact ? (un.length ? un : all).slice(0, n) : un.slice(0, n);
  return `<section class="hb-card hb-inbox">${hubHead(`Inbox${un.length ? ` <i class="badge">${un.length}</i>` : ''}`, `<button class="sm" onclick="go('inbox')">All (${all.length})</button>`)}${list.map(m => compact ? hubMsgRow(m) : inboxItem(m, true)).join('') || '<p class="mute small">You are all caught up.</p>'}</section>`; }
function hubDevRow(r, small) { const p = r.p, tr = hubTier(p), gr = hubGrade(p), known = gr ? gr.known !== false : true;
  return `<div class="hb-dr" onclick="showPlayer(${p.id})">${bustC(p, small ? 36 : 46)}<div class="sp"><div class="hb-drn"><b>${esc(p.fn[0])}. ${esc(p.ln)}</b><span class="mute">${p.pos} · ${p.age}</span><span class="hb-chip" style="--cc:${tr.c}">${esc(tr.n)}</span>${gr ? `<span class="hb-grade g-${known ? String(gr.g)[0] : 'U'}" title="Potential grade">${known ? esc(gr.g) : '?'}</span>` : ''}</div>${potBar(p.ovr, p.pot, known)}<div class="hb-drm"><span>OVR <b>${p.ovr}</b>${known ? ` · POT <b>${p.pot}</b>` : ''}</span>${r.trend ? `<span class="hb-upt">▲ ${esc(r.trend)}</span>` : ''}</div></div>${r.spark ? hubSpark(r.spark) : ''}</div>`; }
function hubDev(c, n, small) { const R2 = hubRisers(c.T, n || 5);
  return `<section class="hb-card hb-dev">${hubHead('Development watch', hubMore('Develop', 'develop'))}${R2.length ? R2.map(r => hubDevRow(r, small)).join('') : '<p class="mute small">No young risers yet. Game snaps, practice and good coaching grow players.</p>'}</section>`; }
function hubGoals(c) { const T = c.T, G = seasonGoals(T), [js, why] = jobSecurity(), dm = (L.demands || []).filter(d => !d.done && d.y === L.year), o = T.owner || {};
  return `<section class="hb-card hb-goals">${hubHead(`Owner goals ${L.year}`, `<span class="hb-js ${/hot/i.test(js) ? 'hot' : /warm/i.test(js) ? 'warn' : ''}">${esc(js)}</span>`)}<div class="hb-own">${o.lk ? lookC(o.lk, 40) : ''}<div class="small"><b>${esc(o.fn || '')} ${esc(o.ln || 'Owner')}</b><div class="mute">${esc(why)}</div></div></div>
   ${G.list.map(x => `<div class="hb-goal ${x.ok ? 'ok' : ''}"><i>${x.ok ? '✓' : ''}</i><span class="sp">${esc(x.lab)}</span><b>+${x.r}</b></div>`).join('')}${dm.map(d => `<div class="hb-goal warn"><i>!</i><span class="sp">${esc(d.txt)}</span></div>`).join('')}
   ${L.ownerMeet && !L.ownerMeet.done && L.ownerMeet.y === L.year ? `<button class="sm pri" style="margin-top:8px" onclick="ownerMeetModal()">The owner wants a meeting</button>` : ''}</section>`; }
// ---------- layout 1: Dashboard (card grid) ----------
function hubDash(c) {
  return `<div class="hb-dash">${L.phase !== 'offseason' ? `<div class="hb-x hb-o-sched">${weekRibbon()}</div>` : ''}<div class="hb-x hb-o-hero">${c.g ? matchHero(c.g) : hubNoGame()}</div>
   ${hubSnap(c)}${c.g ? briefingCard() : ''}${hubStandings(c)}${hubStars(c)}${hubInbox(c, 4)}${hubDev(c, 5)}${hubLeaders(4)}${hubNews(8)}${hubGoals(c)}</div>`;
}
// ---------- layout 2: Broadcast (TV pregame show) ----------
function castScores() { const R2 = L.results || [], out = [];
  if (R2.length) { const last = R2[R2.length - 1]; for (const r of R2.filter(x => x.y === last.y && x.w === last.w && !!x.po === !!last.po).slice(-16)) { const a = L.teams[r.a], h = L.teams[r.h]; if (!a || !h) continue;
    out.push(`<span class="hb-sk"><i style="background:${hubLite(a.c1)}"></i><span class="${r.as > r.hs ? 'w' : ''}">${esc(a.abbr)} ${r.as}</span><i style="background:${hubLite(h.c1)}"></i><span class="${r.hs > r.as ? 'w' : ''}">${esc(h.abbr)} ${r.hs}</span><em>Final</em></span>`); } }
  if (L.phase === 'regular' && L.sched[L.week]) for (const g of L.sched[L.week]) if (!g.done) out.push(`<span class="hb-sk up"><span>${esc(L.teams[g.a].abbr)} @ ${esc(L.teams[g.h].abbr)}</span><em>Wk ${L.week + 1}</em></span>`);
  return out; }
function castCrawl(items, label, cls) { if (!items.length) return ''; const inner = items.join('<i class="hb-sep"></i>') + '<i class="hb-sep"></i>';
  return `<div class="hb-crawl ${cls || ''}"><span class="hb-cl">${label}</span><div class="hb-cv"><div class="hb-ctrack" style="animation-duration:${Math.max(24, items.length * 5)}s"><span>${inner}</span><span aria-hidden="true">${inner}</span></div></div></div>`; }
function castHeader(c) { const T = c.T, g = c.g;
  if (!g) { const art = JSON.stringify({ c1: T.c1, c2: T.c2, left: T.c1, right: T.c2, seed: T.id * 5 + 1, floor: 0.85 });
    return `<section class="hb-cast-hd solo"><canvas class="heroart" data-stadium='${art}'></canvas><div class="hb-bug"><span class="hb-live">${L.phase === 'playoffs' ? 'Playoffs' : 'Offseason'}</span><span class="hb-net">PCN</span></div>
     <div class="hb-solo" style="--c:${T.c1};--c2:${hubLite(T.c2)};--ct:${hubInk(T.c1)}">${logoC(T, 96)}<div class="hb-ctn"><span>${esc(T.city)}</span><b>${esc(T.name)}</b><i>${hubRec(T)} · ${L.year} · OVR ${teamOvr(T)}</i></div></div></section>`; }
  const away = L.teams[g.a], home = L.teams[g.h], pa = teamPower(away), ph = teamPower(home);
  const m = ((ph.off + ph.def) - (pa.off + pa.def)) * 0.45 + (g.neutral ? 0 : 2.2), wp = Math.round(100 / (1 + Math.exp(-m / 6.5)));
  const art = JSON.stringify({ c1: home.c1, c2: home.c2, left: away.c1, right: home.c1, seed: home.id * 11 + 5, floor: 0.85 });
  const side = t => `<div class="hb-ct${t.id === T.id ? ' me' : ''}" style="--c:${t.c1};--c2:${hubLite(t.c2)};--ct:${hubInk(t.c1)}">${logoC(t, 96)}<div class="hb-ctn"><span>${esc(t.city)}</span><b>${esc(t.name)}</b><i>${hubRec(t)} · OVR ${teamOvr(t)}</i></div></div>`;
  return `<section class="hb-cast-hd"><canvas class="heroart" data-stadium='${art}'></canvas>
   <div class="hb-bug"><span class="hb-live">● Live</span><span class="hb-ckick">${L.phase === 'playoffs' ? esc(ROUND_NAMES[L.playoff.round]) : 'Week ' + (L.week + 1)} · ${g.neutral ? 'Neutral site' : esc(home.city)}${isRival(T, c.opp) ? ' · Rivalry' : ''}</span><span class="hb-net">PCN</span></div>
   <div class="hb-cvs">${side(away)}<div class="hb-cat">@</div>${side(home)}</div>
   <div class="hb-wp"><span>${esc(away.abbr)} ${100 - wp}%</span><div class="hb-wpb"><i style="width:${100 - wp}%;background:${hubLite(away.c1)}"></i><i style="width:${wp}%;background:${hubLite(home.c1)}"></i></div><span>${wp}% ${esc(home.abbr)}</span></div>
   <div class="hb-wpl">Win probability</div>${hubPlayBtns()}</section>`; }
function castTape(c) { const a = c.T, b = c.opp; if (!b) return ''; const pa = teamPower(a), pb = teamPower(b), ga = a.w + a.l + a.tie, gb = b.w + b.l + b.tie;
  const rows = [['Overall', teamOvr(a), teamOvr(b), 1], ['Offense', Math.round(pa.off), Math.round(pb.off), 1], ['Defense', Math.round(pa.def), Math.round(pb.def), 1]];
  if (ga && gb) rows.push(['Points / g', +(a.pf / ga).toFixed(1), +(b.pf / gb).toFixed(1), 1], ['Allowed / g', +(a.pa / ga).toFixed(1), +(b.pa / gb).toFixed(1), -1]);
  const ca = hubLite(a.c1), cb = hubLite(b.c1);
  return `<section class="hb-card hb-tape">${hubHead('Tale of the tape')}<div class="hb-tape-hd"><div>${logoC(a, 26)}${esc(a.abbr)}</div><div>${esc(b.abbr)}${logoC(b, 26)}</div></div>
   ${rows.map(([lab, va, vb, dir]) => { const mx = Math.max(va, vb, 1), wa = dir > 0 ? va >= vb : va <= vb, wb = dir > 0 ? vb >= va : vb <= va;
    return `<div class="hb-tr"><b class="${wa ? 'win' : ''}">${va}</b><div class="hb-tb l"><i style="width:${va / mx * 100}%;background:${ca}"></i></div><span>${lab}</span><div class="hb-tb"><i style="width:${vb / mx * 100}%;background:${cb}"></i></div><b class="${wb ? 'win' : ''}">${vb}</b></div>`; }).join('')}
   <div class="hb-tape-ft small mute">${hubStreak(a)} streak · ${esc(a.abbr)} ${hubRec(a)} — ${esc(b.abbr)} ${hubRec(b)} · ${hubStreak(b)} streak</div></section>`; }
function castL3(p, t, tag, sub) { if (!p || !t) return '';
  return `<button class="hb-l3" style="--c:${t.c1};--c2:${hubLite(t.c2)};--ct:${hubInk(t.c1)}" onclick="showPlayer(${p.id})"><span class="hb-l3tag">${tag}</span>${bustC(p, 64)}<div class="hb-l3b"><div class="hb-l3n"><b>${esc(pname(p))}</b><span>#${p.num} ${p.pos} · ${esc(t.abbr)}</span></div><div class="hb-l3s"><span>${esc(sub || hubKeyStat(p))}</span><em>OVR ${p.ovr}</em></div></div></button>`; }
function castWatch(c) { const best = (t, n) => t.roster.map(id => L.P[id]).filter(p => p && !['K', 'P', 'OT', 'OG', 'C'].includes(p.pos)).sort((a, b) => b.ovr - a.ovr).slice(0, n || 1);
  const r = hubRisers(c.T, 1)[0]; let l3 = [];
  if (c.opp) l3 = [castL3(best(c.T)[0], c.T, 'Your star'), castL3(best(c.opp)[0], c.opp, 'Their star')];
  else l3 = best(c.T, 2).map((p, i) => castL3(p, c.T, i ? 'Playmaker' : 'Franchise star'));
  if (r) { const gr = hubGrade(r.p); l3.push(castL3(r.p, c.T, 'Rising', `${hubTier(r.p).n} dev · POT ${gr && gr.known === false ? '?' : r.p.pot}${r.trend ? ' · ' + r.trend : ''}`)); }
  return `<section class="hb-card hb-watch">${hubHead(c.g ? 'Players to watch' : 'Faces of the franchise')}${l3.join('')}</section>`; }
function castStand(c) { const T = c.T, dv = sortTeams(L.teams.filter(t => t.conf === T.conf && t.div === T.div));
  return `<section class="hb-card hb-race">${hubHead(`${esc(T.div)} race`, hubMore('Standings', 'standings'))}${dv.map((t, i) => `<div class="hb-cs click ${t.id === T.id ? 'me' : ''}" style="--c:${hubLite(t.c1)}" onclick="teamModal(${t.id})"><span class="hb-csr">${i + 1}</span>${logoC(t, 28)}<b class="sp">${esc(t.name)}</b><span>${hubRec(t)}</span><em>${hubStreak(t)}</em></div>`).join('')}</section>`; }
function castUpcoming(c) { const T = c.T; if (L.phase !== 'regular') return ''; const out = [];
  for (let i = L.week + 1; i < L.sched.length && out.length < 4; i++) { const g = L.sched[i].find(x => x.h === T.id || x.a === T.id); if (!g) continue; const o = L.teams[g.h === T.id ? g.a : g.h];
    out.push(`<div class="hb-up1" style="--c:${hubLite(o.c1)}"><span>WK ${i + 1}</span>${logoC(o, 30)}<b>${g.h === T.id ? 'vs' : '@'} ${esc(o.abbr)}</b><i>${hubRec(o)}</i></div>`); }
  return out.length ? `<section class="hb-card hb-upn">${hubHead('Coming up', hubMore('Schedule', 'schedule'))}<div class="hb-uprow">${out.join('')}</div></section>` : ''; }
function hubCast(c) {
  const news = (L.news || []).slice(0, 12).map(x => `<span>${esc(x.s)}</span>`);
  return `<div class="hb-cast">${castCrawl(castScores(), 'Scores', 'top')}${castHeader(c)}${c.g ? '' : hubNoGame()}
   <div class="hb-cgrid">${c.g ? castTape(c) : hubSnap(c)}${castWatch(c)}${castStand(c)}${c.g ? briefingCard() : ''}${castUpcoming(c)}${hubLeaders(3)}${hubDev(c, 4)}${hubInbox(c, 3)}</div>
   ${castCrawl(news, 'Breaking', 'bottom')}</div>`;
}
// ---------- layout 3: Locker room (dense lists + quick actions) ----------
function lockerHeader(c) { const T = c.T, g = c.g, o = c.opp;
  return `<section class="hb-lk-hd" style="--c:${T.c1};--c2:${hubLite(T.c2)}"><div class="hb-lkdoors"></div><div class="hb-lk-in">${logoC(T, 56)}<div class="sp"><span class="pos">${T.name !== T.city ? esc(T.city) + " · " : ""}${L.year}</span><b>${esc(T.name)}</b>
    <div class="hb-lkk"><span>${hubRec(T)}</span><span>${hubStreak(T)}</span><span>OVR ${teamOvr(T)}</span><span>#${c.pr} power</span><span>${moodIcon(teamMorale(T))} ${teamMorale(T)}</span></div></div></div>
   ${g ? `<div class="hb-lk-next">${logoC(o, 36)}<div class="sp"><span class="pos">${L.phase === 'playoffs' ? esc(ROUND_NAMES[L.playoff.round]) : 'Week ' + (L.week + 1)} · ${c.home ? 'Home' : 'Away'}${isRival(T, o) ? ' · Rivalry' : ''}</span><b>${c.home ? 'vs' : '@'} ${esc(teamName(o))}</b><span class="small mute"> ${hubRec(o)} · OVR ${teamOvr(o)}</span></div>
    <div class="hb-lk-btns"><button class="pri" onclick="startUserGame('play')">Play</button><button onclick="startUserGame('watch')">Watch</button><button onclick="startUserGame('instant')">Instant</button></div></div>` : ''}</section>`; }
function lockerQuick(c) { const T = c.T, P = c.g ? ensurePlan() : null, inj = c.ros.filter(p => p.inj > 0).length, ur = unreadCount(), pp = L.practicePlan || {};
  const A = [['plan', 'Game plan', NAV_ICON.plays, P ? (P.locked ? 'Locked ✓' : 'Not locked') : 'Offseason', P && !P.locked], ['depth', 'Depth chart', HUB_QI.depth, inj ? inj + ' injured' : 'All healthy', inj > 0], ['roster', 'Roster', NAV_ICON.teamg, T.roster.length + ' / 53', T.roster.length < 45],
    ['develop', 'Practice', HUB_QI.develop, (PRACTICE[pp.focus] || { n: 'Set focus' }).n], ['inbox', 'Inbox', HUB_QI.inbox, ur ? ur + ' unread' : 'All read', ur > 0], ['trade', 'Trade', HUB_QI.trade, L.gmProp ? 'GM has an idea' : 'Make a call', !!L.gmProp],
    ['fa', 'Free agents', HUB_QI.fa, money(capRoom(T)) + ' room'], ['scouting', 'Scouting', HUB_QI.scouting, 'Draft board'], ['staff', 'Staff', NAV_ICON.staffg, 'Coaches'], ['standings', 'Standings', HUB_QI.standings, hubOrd(divRank(T)) + ' ' + T.div], ['schedule', 'Schedule', HUB_QI.schedule, L.phase === 'regular' ? 'Week ' + (L.week + 1) : phaseLabel()]];
  return `<div class="hb-qa">${A.map(([k, n, ic, sub, warn]) => `<button class="hb-q ${warn ? 'alert' : ''}" onclick="go('${k}')">${ic}<b>${n}</b><small>${esc(String(sub))}</small></button>`).join('')}${L.phase === 'regular' ? `<button class="hb-q" onclick="if(confirm('Sim the rest of the regular season?')){simToPlayoffs();saveGame();render();}">${HUB_QI.sim}<b>Sim season</b><small>To playoffs</small></button>` : ''}</div>`; }
function lockerReport(c) { const T = c.T, n = T.w + T.l + T.tie, [js] = jobSecurity();
  const kv = [['Record', hubRec(T)], ['Streak', hubStreak(T)], ['Division', hubOrd(divRank(T)) + ' ' + esc(T.div)], ['Conference', '#' + c.cr], ['Power rank', '#' + c.pr], ['Team OVR', teamOvr(T)], ['Points / g', n ? (T.pf / n).toFixed(1) : '—'], ['Allowed / g', n ? (T.pa / n).toFixed(1) : '—'],
    ['Morale', `${moodIcon(teamMorale(T))} ${teamMorale(T)}`], ['Owner', Math.round(T.ownerSup) + '%'], ['Fans', Math.round(T.fanSup) + '%'], ['Cap room', money(capRoom(T))], ['Job security', esc(js)], ['Credits', '🪙 ' + T.coach.pts]];
  return `<section class="hb-card hb-rep">${hubHead('Team report')}<div class="hb-dl">${kv.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div></section>`; }
function lockerInj(c) { const ps = c.ros.filter(p => p.inj > 0 || p.holdout).sort((a, b) => b.ovr - a.ovr);
  return `<section class="hb-card hb-injr">${hubHead(`Injury report${ps.length ? ` <i class="badge">${ps.length}</i>` : ''}`, hubMore('Depth', 'depth'))}${ps.length ? ps.slice(0, 8).map(p => `<div class="hb-pr" onclick="showPlayer(${p.id})"><span class="hb-pp">${p.pos}</span><span class="sp">${esc(pname(p))}</span><span class="${p.holdout ? 'hb-warn' : 'hb-bad'}">${p.holdout ? 'Holdout' : esc(p.injType || 'Injured') + ' · ' + p.inj + ' wk'}</span>${ovrTag(p.ovr)}</div>`).join('') : '<p class="mute small">Everyone is healthy.</p>'}</section>`; }
function lockerStars(c) { const ps = c.ros.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  return `<section class="hb-card hb-slist">${hubHead('Top players', hubMore('Roster', 'roster'))}${ps.map(p => `<div class="hb-pr" onclick="showPlayer(${p.id})">${bustC(p, 32)}<span class="hb-pp">${p.pos}</span><div class="sp"><div><b>${esc(pname(p))}</b> <span class="mute">#${p.num}</span></div><div class="small mute">${esc(hubKeyStat(p))}</div></div>${ovrTag(p.ovr)}</div>`).join('')}</section>`; }
function lockerLeaders() { const D = hubLeadData(6);
  return `<section class="hb-card hb-llist">${hubHead('League leaders', hubMore('All', 'leaders'))}${D.some(d => d.top.length) ? D.map(d => { const p = d.top[0]; if (!p) return ''; return `<div class="hb-pr ${p.tid === L.user ? 'mine' : ''}" onclick="showPlayer(${p.id})"><span class="hb-lk">${d.lab}</span><span class="sp">${esc(p.fn[0])}. ${esc(p.ln)} <span class="mute">${esc(L.teams[p.tid].abbr)}</span></span><b>${p.st[d.k]}</b></div>`; }).join('') : '<p class="mute small">No games played yet.</p>'}</section>`; }
function lockerSched(c) { const T = c.T; if (L.phase === 'offseason') return ''; const rows = [];
  L.sched.forEach((wk, i) => { const g = wk.find(x => x.h === T.id || x.a === T.id); if (!g) return; if (g.done ? i < L.week - 3 : i > L.week + 3) return; const o = L.teams[g.h === T.id ? g.a : g.h], my = g.h === T.id ? g.hs : g.as, th = g.h === T.id ? g.as : g.hs;
    rows.push(`<div class="hb-pr ${i === L.week && L.phase === 'regular' ? 'mine' : ''}"><span class="hb-pp">WK ${i + 1}</span>${logoC(o, 22)}<span class="sp">${g.h === T.id ? 'vs' : '@'} ${esc(o.name)}${isRival(T, o) ? ' 🔥' : ''}</span>${g.done ? `<b class="${my > th ? 'hb-pl' : my < th ? 'hb-mn' : ''}">${my > th ? 'W' : my < th ? 'L' : 'T'} ${my}-${th}</b>` : `<span class="mute small">${hubRec(o)}</span>`}</div>`); });
  return `<section class="hb-card hb-sch">${hubHead('Schedule', hubMore('Full', 'schedule'))}${rows.join('')}</section>`; }
function hubLocker(c) {
  return `<div class="hb-locker">${lockerHeader(c)}${c.g ? '' : hubNoGame()}${lockerQuick(c)}
   <div class="hb-cols">${lockerReport(c)}${hubInbox(c, 6, true)}${c.g ? briefingCard() : ''}${lockerSched(c)}${lockerInj(c)}${lockerStars(c)}${hubDev(c, 5, true)}${hubStandings(c)}${lockerLeaders()}${hubNews(10)}${hubGoals(c)}</div></div>`;
}
function careerLimbo() { const offs = L.offers || []; const c = L.ghost ? L.myCoach : UT().coach;
  return `<div class="panel"><h2>${L.ghost ? 'Out of coaching' : 'You were fired'}</h2><p>${L.ghost ? `You sat out the ${L.year} season.` : `The owner of the ${esc(teamName(UT()))} let you go.`} ${offs.length ? 'These teams want to talk:' : 'No team has called yet.'}</p>
   ${offs.map((o, i) => { const t = L.teams[o.tid]; return `<div class="row">${logoC(t, 44)}<div class="sp"><b>${esc(teamName(t))}</b><div class="small mute">${t.w}-${t.l} · ${money(o.sal)}/yr × ${o.yrs}</div></div><button class="go sm" onclick="uiRes(acceptOffer(${i}))">Accept</button></div>`; }).join('')}
   <div class="row" style="margin-top:12px"><button onclick="if(confirm('Sit out a full season and wait for an opening?')){sitOutSeason();saveGame();render();}">Sit out a season</button><button class="bad" onclick="if(confirm('Retire your coach?')){retireCoach();saveGame();render();}">Retire</button></div>
   <p class="small mute">Desirability ${desirability()} · Age ${c.age}.</p></div>`; }
function offseasonPanel() {
  const T = UT();
  if (L.off === 'resign') { const ex = expiring(T).map(id => L.P[id]).sort((a, b) => b.ovr - a.ovr);
    return `<div class="panel"><h2>Re-sign your players</h2><p class="mute small">These contracts expired. Anyone you don't re-sign becomes a free agent. Cap room: <b>${money(capRoom(T))}</b>. Your GM's notes are in the inbox.</p>
    <div class="tbl"><table><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>Asking</th><th></th></tr>${ex.map(p => { p.ask = p.ask || askingSalary(p); return `<tr><td class="click" onclick="showPlayer(${p.id})">${esc(pname(p))}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrTag(p.ovr)}</td><td>${money(p.ask)}/yr</td><td>${p.resigned === L.year ? '<span class="tag t">Re-signed</span>' : `<button class="sm go" onclick="uiRes(resignPlayer(${p.id},3))">3 yrs</button> <button class="sm" onclick="uiRes(resignPlayer(${p.id},1))">1 yr</button> <button class="sm" onclick="uiRes(franchiseTag(${p.id}))">Tag</button>`}</td></tr>`; }).join('') || '<tr><td colspan=6>No expiring contracts.</td></tr>'}</table></div>
    <div class="row" style="margin-top:10px"><button class="pri" onclick="uiRes(offseasonNext());go('draft')">Go to the draft</button></div></div>`; }
  if (L.off === 'draft') return `<div class="panel"><h2>Draft day</h2><p>${userOnClock() ? 'You are on the clock.' : 'The draft is underway.'}</p><button class="pri" onclick="go('draft')">Open the draft room</button></div>`;
  return `<div class="panel"><h2>Free agency</h2><p>Sign free agents, then start the next season. Roster ${T.roster.length}/53 · Cap room ${money(capRoom(T))}</p>${L.offProg ? '' : ''}
   <div class="row"><button onclick="go('fa')">Browse free agents</button><button class="pri" onclick="const r=offseasonNext();uiRes(r);if(r.ok){L._omShown=0;}">Start ${L.year + 1} season</button></div></div>`;
}
function showRecap() { const R2 = L.recap; if (!R2) return; R2.seen = true; const ps = (R2.top || []).map(id => L.P[id]).filter(Boolean); const m = L.P[R2.mvp];
  modal(`<span class="pos">SEASON RECAP</span><h1>${R2.y}: ${R2.w}-${R2.l}${R2.t ? '-' + R2.t : ''}</h1><h3>${esc(R2.result)}${R2.champ ? ` · Champion: ${esc(R2.champ)}` : ''}</h3>
   <div class="grid g2"><div class="panel tight"><b>Owner goals</b>${R2.goals.map(g => `<div class="small">${g.ok ? '✅' : '❌'} ${esc(g.lab)}</div>`).join('')}<div class="small mute">+${R2.creditGoals} coach credits</div></div>
   <div class="panel tight"><b>League MVP</b><div class="small">${m ? esc(pname(m)) + ' (' + (L.teams[m.tid] ? L.teams[m.tid].abbr : '') + ')' : '—'}</div></div></div>
   <h3 style="margin-top:10px">Your standouts</h3><div class="perfs">${ps.map(p => { const h = (p.hist || [])[p.hist.length - 1]; return `<div class="perf">${bustC(p, 40)}<div><b>${esc(pname(p))}</b> <span class="mute small">${p.pos}</span><div class="small">${statLine(h, p.pos)}</div></div></div>`; }).join('')}</div>
   <div class="row" style="margin-top:12px"><button class="pri" onclick="closeModal();saveGame();render()">On to the offseason</button></div>`); }
function ownerMeetModal() { const M = L.ownerMeet; if (!M || M.done) { toast('No meeting scheduled.'); return; } const T = UT(), o = T.owner;
  modal(`<div class="row">${lookC(o.lk, 72)}<div><span class="pos">OWNER'S OFFICE</span><h2 style="margin:0">${esc(o.fn)} ${esc(o.ln)}</h2><span class="tag">${OWNERP[ownerPersona(T)][0]}</span></div></div>
   <p class="quote">${esc(M.text)}</p><div class="grid">${M.choices.map((c, i) => `<button class="choice" onclick="const r=ownerChoose(${i});closeModal();uiRes(r)">"${esc(c.label)}"</button>`).join('')}</div>`); }
// postgame press conference: answers change fan support, owner support and morale
const PRESS_Q = { win: ['That was a statement win. How do you keep it going?', 'Your defense set the tone early. How big was that?', 'Is this the best your team has looked all year?'], loss: ['Tough loss. What went wrong?', 'The offense stalled. Why?', 'Fans were frustrated today. Your reaction?'], rival: ['Rivalry week is done. What does this one mean?'] };
function pressConf() { const I = L.lastGameInfo; if (!I || L.ghost) return; const qs2 = I.rival ? PRESS_Q.rival : I.won ? PRESS_Q.win : PRESS_Q.loss; const q = qs2[(L.week + L.year) % qs2.length];
  const ans = I.won ? ['Credit to the players. We stay focused.', 'We expect to win every week.', 'Nobody wants to see us right now.'] : ['That one is on me. I have to coach better.', 'We will fix it. This team is better than that.', 'Some guys need to look in the mirror.'];
  modal(`<span class="pos">POSTGAME PRESS CONFERENCE</span><h2>"${esc(q)}"</h2><div class="grid">${ans.map((a, i) => `<button class="choice" onclick="pressAnswer(${i})">"${esc(a)}"</button>`).join('')}</div><button class="sm" style="margin-top:8px" onclick="closeModal()">No comment</button>`); L.lastGameInfo = null; }
function pressAnswer(i) { const T = UT(); if (i === 0) { T.ownerSup = clamp(T.ownerSup + 1.5, 0, 100); for (const id of T.roster) moodAdd(L.P[id], 1.5); toast('The locker room liked that.'); } if (i === 1) { T.fanSup = clamp(T.fanSup + 2.5, 0, 100); for (const id of T.roster) moodAdd(L.P[id], 1); toast('Fans are fired up.'); } if (i === 2) { T.fanSup = clamp(T.fanSup + 2, 0, 100); for (const id of T.roster) moodAdd(L.P[id], -2); toast('Headline material. Some players did not like it.'); } T.morale = teamMorale(T); closeModal(); saveGame(); render(); }
