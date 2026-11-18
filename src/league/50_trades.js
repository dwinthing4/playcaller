// Trades: values, proposals, trade block, incoming AI offers, deadline deals between CPU teams.
const TRADE_DEADLINE_WEEK = 9;
function tradeOpen() { return !(L.phase === 'regular' && L.week >= TRADE_DEADLINE_WEEK); }
function playerValue(p) {
  if (!p) return 0; const age = p.age <= 25 ? 1.2 : p.age <= 28 ? 1 : p.age === 29 ? .85 : p.age === 30 ? .7 : p.age === 31 ? .55 : .4;
  const pf = { QB: 1.6, K: .25, P: .2, RB: .8, FB: .4 }[p.pos] || 1;
  return Math.pow(Math.max(0, p.ovr - 50), 2) * age * pf + Math.max(0, p.pot - p.ovr) * (p.age < 26 ? 12 : 0) - Math.max(0, p.sal - salaryFor(p.ovr, p.pos, p.age)) * 25;
}
function pickValue(pk) { const base = [0, 900, 350, 180, 100, 60, 40, 25][pk.r]; const near = pk.y === L.year + 1 ? 1 : 0.8; const t = L.teams[pk.from]; const mult = t ? 1 + (0.5 - pct(t)) * 0.6 : 1; return base * near * mult; }
const toAsset = x => typeof x === 'number' ? { type: 'p', id: x } : { type: 'k', pk: x };
function assetValue(a) { return a.type === 'p' ? playerValue(L.P[a.id]) : pickValue(a.pk); }
function evalTrade(give, get, tid) {
  const vg = sum(give.map(assetValue)), vr = sum(get.map(assetValue));
  const rel = L.rel && tid != null ? (L.rel[tid] ?? 50) : 50;
  const need = (DIFFS[L.diff].ai > 0 ? 1.15 : L.diff === 'rookie' ? 0.95 : 1.05) * (1.12 - (rel - 50) / 220);
  return { vg, vr, ok: vg >= vr * need && vg > 0, ratio: vr ? vg / vr : 9 };
}
function execTrade(O, gA, rA) {
  const T = UT(); const gp = gA.filter(a => a.type === 'p').map(a => L.P[a.id]).filter(Boolean), rp = rA.filter(a => a.type === 'p').map(a => L.P[a.id]).filter(Boolean);
  const salIn = sum(rp.map(p => p.sal)), salOut = sum(gp.map(p => p.sal));
  if (capRoom(T) + salOut - salIn < 0) return { ok: false, msg: 'That trade puts you over the cap.' };
  if (capRoom(O) + salIn - salOut < 0) return { ok: false, msg: `${O.abbr} can't fit that salary under their cap.` };
  if (T.roster.length - gp.length + rp.length > 55 || O.roster.length - rp.length + gp.length > 55) return { ok: false, msg: 'Roster limits block this trade.' };
  for (const p of gp) { T.roster = T.roster.filter(x => x !== p.id); O.roster.push(p.id); p.tid = O.id; }
  for (const p of rp) { O.roster = O.roster.filter(x => x !== p.id); T.roster.push(p.id); p.tid = T.id; moodAdd(p, 4, 'Fresh start'); }
  const mv = (from, to, pk) => { from.picks = from.picks.filter(x => !(x.y === pk.y && x.r === pk.r && x.from === pk.from)); to.picks.push(pk); };
  for (const a of gA) if (a.type === 'k') mv(T, O, a.pk); for (const a of rA) if (a.type === 'k') mv(O, T, a.pk);
  if (L.draftOrder) for (const s of L.draftOrder) { const own = L.teams.find(t => t.picks.some(p => p.y === L.year + 1 && p.r === s.r && p.from === s.from)); if (own) s.owner = own.id; }
  fixDepth(T); fixDepth(O); assignNumbers(T); assignNumbers(O); L.myBlock = myBlock();
  const nm = arr => arr.map(a => a.type === 'p' ? (L.P[a.id] ? L.P[a.id].ln : '?') : `${a.pk.y} R${a.pk.r}`).join(', ') || 'nothing';
  news(`Trade with ${O.abbr}: sent ${nm(gA)}, got ${nm(rA)}.`);
  return { ok: true, msg: 'Trade accepted!' };
}
function proposeTrade(tid, give, get) {
  if (!tradeOpen()) return { ok: false, msg: 'The trade deadline has passed. Trades reopen after the season.' };
  const O = L.teams[tid]; const gA = give.map(toAsset), rA = get.map(toAsset); if (!gA.length && !rA.length) return { ok: false, msg: 'Add something to the deal.' };
  const ev = evalTrade(gA, rA, tid);
  if (!ev.ok) { L.rel[tid] = clamp((L.rel[tid] || 50) - 1.5, 0, 100); return { ok: false, msg: ev.ratio > 0.8 ? `${O.abbr}: "Close. Add a little more."` : `${O.abbr}: "Not interested."` }; }
  const gmNo = gmTradeCheck(gA, rA); if (gmNo && !L._gmOverride) return { ok: false, gm: gmNo, msg: gmNo };
  const r = execTrade(O, gA, rA); if (r.ok) { L.rel[tid] = clamp((L.rel[tid] || 50) + (ev.ratio > 1.25 ? 5 : 2), 0, 100); gmReact('trade', null, ev.ratio); }
  return r;
}
function myBlock() { L.myBlock = (L.myBlock || []).filter(id => L.P[id] && L.P[id].tid === L.user); return L.myBlock; }
function toggleBlock(id) { const b = myBlock(); const i = b.indexOf(id); if (i >= 0) b.splice(i, 1); else { b.push(id); news(`You put ${L.P[id].pos} ${L.P[id].fn} ${L.P[id].ln} on the trade block.`); } }
function aiBlocks() {
  const key = L.year * 100 + L.week; if (L.blocksKey === key && L.blocks) return L.blocks; L.blocks = {};
  for (const t of L.teams) { if (t.id === L.user) continue; const cand = [];
    for (const p of t.roster.map(id => L.P[id]).filter(p => p && p.pos !== 'K' && p.pos !== 'P')) { const depth = (t.depth[p.pos] || []).indexOf(p.id); let s = 0; if (p.age >= 30 && p.sal > 6) s += 2; if (depth >= POS_COUNTS[p.pos] - 1 && p.ovr >= 68) s += 1.5; if (p.yrs <= 1 && p.age >= 28) s += 1; if (p.mor != null && p.mor < 35) s += 2; if (pct(t) < 0.35 && p.age >= 28) s += 1.5; s += R() * 0.8; if (s >= 2) cand.push([s, p.id]); }
    L.blocks[t.id] = cand.sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]); }
  L.blocksKey = key; return L.blocks;
}
function onBlock(p) { if (p.tid === L.user) return myBlock().includes(p.id); const b = aiBlocks()[p.tid]; return !!(b && b.includes(p.id)); }
function genIncomingOffer() {
  if (!tradeOpen()) return; const T = UT(); const blk = myBlock(); let target = null;
  if (blk.length && R() < 0.75) target = L.P[pick(blk)]; else { const c = T.roster.map(id => L.P[id]).filter(p => p.ovr >= 70 && !['K', 'P'].includes(p.pos)); if (c.length) target = pick(c.sort((a, b) => b.ovr - a.ovr).slice(0, 15)); }
  if (!target) return; const teams = L.teams.filter(t => t.id !== L.user && capRoom(t) > target.sal - 4); if (!teams.length) return; const O = pick(teams);
  const need = playerValue(target) * rnd(0.95, 1.2); const assets = []; let v = 0;
  const third = O.roster.map(i => L.P[i].ovr).sort((a, b) => b - a)[2];
  for (const p of O.roster.map(id => L.P[id]).filter(p => p.ovr < third).sort((a, b) => playerValue(b) - playerValue(a))) { if (v >= need * 0.7 || assets.length >= 2) break; if (playerValue(p) <= need * 0.9 && playerValue(p) > 0) { assets.push(p.id); v += playerValue(p); } }
  for (const pk of O.picks.filter(pk => pk.y <= L.year + 1).sort((a, b) => a.r - b.r)) { if (v >= need) break; assets.push(pk); v += pickValue(pk); }
  if (v < need * 0.75 || !assets.length) return;
  L.inOffers = L.inOffers || []; if (L.inOffers.length >= 3) L.inOffers.shift();
  const o = { id: nid(), tid: O.id, get: [target.id], give: assets, exp: L.week + 2 }; L.inOffers.push(o);
  const desc = assets.map(a => typeof a === 'number' ? `${L.P[a].pos} ${L.P[a].ln} (${L.P[a].ovr})` : `a ${a.y} round-${a.r} pick`).join(' and ');
  inbox('gm', `${O.name} called about ${target.ln}`, `${gmName()}: "${teamName(O)} are offering ${desc} for ${target.pos} ${target.fn} ${target.ln}. ${v > playerValue(target) * 1.1 ? 'Honestly, I think we should take it.' : v < playerValue(target) * 0.9 ? 'I think we can get more.' : 'It is a fair deal. Your call.'}"`, { offer: o.id, actions: [{ label: 'Review in Trade', act: 'go', arg: 'trade' }] });
}
function acceptIncoming(oid) { const i = (L.inOffers || []).findIndex(o => o.id === oid); if (i < 0) return { ok: false, msg: 'Offer expired.' }; const o = L.inOffers[i]; const r = execTrade(L.teams[o.tid], o.get.map(toAsset), o.give.map(toAsset)); if (r.ok) L.inOffers.splice(i, 1); return r; }
function declineIncoming(oid) { L.inOffers = (L.inOffers || []).filter(o => o.id !== oid); }
function weakestPos(t) { let worst = null, wv = 1e9; for (const pos of ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'DE', 'DT', 'LB', 'CB', 'S']) { const id = (t.depth[pos] || [])[0]; const v = id ? L.P[id].ovr : 40; if (v < wv) { wv = v; worst = pos; } } return worst; }
function aiDeadlineDeals() {
  if (L.deadlineDone === L.year) return; L.deadlineDone = L.year; const ts = L.teams.filter(t => t.id !== L.user).sort((a, b) => pct(b) - pct(a)); const buyers = ts.slice(0, 8), sellers = ts.slice(-8); let n = 0;
  for (const B of buyers) { if (n >= 4) break; const need = weakestPos(B);
    for (const S of sellers) { const cur = (B.depth[need] || [])[0] ? L.P[B.depth[need][0]].ovr : 0; const vet = S.roster.map(id => L.P[id]).filter(p => p.pos === need && p.age >= 27 && p.ovr >= 74 && p.ovr > cur + 2).sort((a, b) => b.ovr - a.ovr)[0];
      if (!vet || capRoom(B) < vet.sal) continue; const pk = B.picks.filter(k => k.y === L.year + 1 && k.r >= 2 && k.r <= 4).sort((a, b) => a.r - b.r)[0]; if (!pk) continue;
      S.roster = S.roster.filter(x => x !== vet.id); B.roster.push(vet.id); vet.tid = B.id; B.picks = B.picks.filter(k => k !== pk); S.picks.push(pk); fixDepth(B); fixDepth(S);
      news(`Deadline deal: ${B.abbr} acquired ${vet.pos} ${vet.fn} ${vet.ln} from ${S.abbr} for a ${pk.y} round-${pk.r} pick.`); n++; break; } }
}
