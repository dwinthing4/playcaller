// Coach tree screen (Staff › Coach tree): level, XP bar, perk points, four branches of four perks, recent XP, reset.
// Logic in src/league/62_coach.js. The tab is added to the Staff group here so 10_shell.js stays untouched.
(function () { const g = NAVG.find(x => x[0] === 'staffg'); if (g && !g[2].some(s => s[0] === 'ctree')) g[2].splice(2, 0, ['ctree', 'Coach tree']); })();
function coachXpBar(C) { const need = coachXpNeed(C.lvl); return `<div class="ctxp"><div class="row small"><b>Level ${C.lvl}</b><span class="sp"></span><span class="mute">${C.xp} / ${need} XP to level ${C.lvl + 1}</span></div>${meter(C.xp / need * 100, 'var(--gold)')}</div>`; }
function coachTreeCard() {   // small card for Staff › Coach career
  const C = coachTree(); if (!C) return ''; const n = Object.keys(C.perks).length;
  return `<div class="panel ctcard" style="margin-top:12px"><div class="row"><h3 class="sp" style="margin:0">Coach tree</h3>${C.pts ? `<span class="tag ctpt">${C.pts} point${C.pts === 1 ? '' : 's'} to spend</span>` : ''}<button class="sm pri" onclick="go('ctree')">Open</button></div>${coachXpBar(C)}<div class="small mute">${n ? `${n} perk${n === 1 ? '' : 's'} learned: ${Object.keys(C.perks).map(id => esc(coachPerkInfo(id).n)).join(', ')}` : 'No perks yet.'}</div></div>`;
}
VIEWS.ctree = function () {
  const T = UT(), c = T.coach, C = coachTree();
  if (L.ghost) return `<div class="panel"><h2>Coach tree</h2><p class="small">Take a head coaching job to keep growing your coach tree.</p></div>`;
  const card = (id, name, eff, tier) => { const has = !!C.perks[id], can = coachCanLearn(id), need = CTREE_LVL[tier];
    const st = has ? 'on' : can.ok ? 'open' : 'locked';
    return `<div class="ctperk ${st}"><span class="ctk" aria-hidden="true">${tier + 1}</span><div class="sp"><b>${esc(name)}</b><div class="small">${esc(eff)}</div>${!has && !can.ok ? `<div class="small mute">${esc(can.msg)}</div>` : ''}</div>
      ${has ? '<span class="tag ctgot">Learned</span>' : `<button class="sm ${can.ok ? 'go' : ''}" ${can.ok ? '' : 'disabled'} onclick="uiRes(coachLearn('${id}'))" aria-label="Learn ${esc(name)}">${can.ok ? 'Learn' : 'Lv ' + need}</button>`}</div>`; };
  const nPerks = Object.keys(C.perks).length;
  return `<div class="panel cthead"><div class="row">${lookC(c.lk, 64)}<div class="sp"><span class="pos">HEAD COACH</span><h2 style="margin:0">${esc(c.fn)} ${esc(c.ln)}</h2>${coachXpBar(C)}</div>
     <div class="ctpts"><b>${C.pts}</b><span>perk point${C.pts === 1 ? '' : 's'}</span></div></div>
    <p class="small mute" style="margin-top:8px">Earn XP from wins, playoff wins, owner goals, awards on your team, player growth and draft hits. Every level gives a perk point. Tiers open at coach levels ${CTREE_LVL.join(', ')}.</p></div>
  <div class="ctree">${Object.entries(CTREE).map(([k, [n, ps]]) => `<div class="panel ctbr ctb-${k}"><h3>${esc(n)}</h3>${ps.map(([id, nm, eff], i) => card(id, nm, eff, i)).join('')}</div>`).join('')}</div>
  <div class="grid g2" style="margin-top:10px"><div class="panel"><h3>Recent XP</h3>${C.log.length ? `<ul class="news small">${C.log.slice(0, 10).map(l => `<li><b>+${l.n}</b> ${esc(l.why)} <span class="mute">${l.y}</span></li>`).join('')}</ul>` : '<p class="small mute">Win games to earn XP.</p>'}</div>
   <div class="panel"><h3>Reset perks</h3><p class="small">Get every point back to spend again. Costs ${CTREE_RESPEC} coach credits (you have ${c.pts}).</p><button class="sm bad" ${nPerks && c.pts >= CTREE_RESPEC ? '' : 'disabled'} onclick="if(confirm('Reset all coach perks for ${CTREE_RESPEC} credits?'))uiRes(coachRespec())">Reset · ${CTREE_RESPEC} cr</button></div></div>`;
};
