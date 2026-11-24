// League history book: season archive rows (L.lhist), record books per quarter length (L.recQ), career records (L.rcar),
// dynasties, and the stat scale of a quarter length (so goals, coordinators and the Hall of Fame judge 1-minute and 5-minute
// quarters on the same footing).

// ---------- scale ----------
// points per team-game the league sim produces at each quarter length (qa/sim_compare.mjs); NFL-length games score ~21.5
const HIST_PTS = [[60, 7], [120, 12.5], [180, 15.5], [240, 18], [300, 20], [900, 21.5]];
function lgPtsAt(q) { q = q || 120; for (let i = 1; i < HIST_PTS.length; i++) { const [q0, p0] = HIST_PTS[i - 1], [q1, p1] = HIST_PTS[i]; if (q <= q1) return p0 + (p1 - p0) * clamp((q - q0) / (q1 - q0), 0, 1); } return 21.5; }
// this season's points per team-game (once a few weeks are in), else what the quarter length gives
function lgPtsPerGame() { const r = (L.results || []).filter(x => x.y === L.year && !x.po); if (r.length >= 48) return r.reduce((s, x) => s + x.hs + x.as, 0) / r.length / 2; return lgPtsAt(L.qlen); }
function lgScale() { return clamp(lgPtsPerGame() / 21.5, 0.2, 1.3); }
// scrimmage plays per team-game in a season (archived on the history row; old seasons ran on the full-length quick sim)
function histPlays(y) { const h = (L.lhist || []).find(r => r.y === y); return h && h.ppg ? h.ppg : 62; }

// ---------- quarter length per season ----------
function histNoteQlen() { if (!L.qlS || L.qlS.y !== L.year) L.qlS = { y: L.year, q: [] }; if (!L.qlS.q.includes(L.qlen)) L.qlS.q.push(L.qlen); }
function histMixed() { return !!(L.qlS && L.qlS.y === L.year && L.qlS.q.length > 1); }
function qlenName(q) { return q % 60 === 0 ? `${q / 60}-min quarters` : `${q}-sec quarters`; }

// ---------- record book: one per quarter length ----------
function recBook(q) { L.recQ = L.recQ || {}; const k = String(q || L.qlen || 120); return L.recQ[k] || (L.recQ[k] = { mine: {}, lg: {} }); }

// ---------- season rollover ----------
// called from beginOffseason after the awards: finish the history row (standings, awards, leaders) and archive every player's season
function histSeason() {
  const row = L.lhist[L.lhist.length - 1]; if (!row || row.y !== L.year) return;
  const champ = (L.champs || []).find(c => c.y === L.year), P0 = L.playoff;
  let ru = null; if (P0 && P0.elim) { const mx = Math.max(-1, ...Object.values(P0.elim)); if (mx === 3) ru = +Object.keys(P0.elim).find(t => P0.elim[t] === 3); }
  const po = t => champ && champ.t === t.id ? 4 : P0 && P0.elim[t.id] !== undefined ? P0.elim[t.id] : -1;
  row.ct = champ ? champ.t : null; row.rt = ru; row.ql = L.qlen; if (histMixed()) row.mix = L.qlS.q.slice();
  row.st = sortTeams(L.teams).map(t => [t.id, t.w, t.l, t.tie, t.pf, t.pa, po(t)]);
  const aw = (L.awards || []).find(a => a.y === L.year) || {}, pl = id => { const p = L.P[id]; return p ? [p.id, p.fn + ' ' + p.ln, p.pos, L.teams[p.tid] ? L.teams[p.tid].abbr : ''] : null; };
  row.aw = { mvp: pl(aw.mvp), dpoy: pl(aw.dpoy), roy: pl(aw.roy) };
  const act = Object.values(L.P).filter(p => p.tid != null && p.st && p.st.gp); row.ld = {};
  for (const k of HIST_LEAD.map(x => x[0])) row.ld[k] = act.filter(p => p.st[k] > 0).sort((a, b) => b.st[k] - a.st[k]).slice(0, 3).map(p => [p.id, p.fn + ' ' + p.ln, L.teams[p.tid] ? L.teams[p.tid].abbr : '', Math.round(p.st[k] * 10) / 10, p.st.gp]);
  // scrimmage plays per team-game (dropbacks + carries; sacks count once, as the defense's)
  let pa = 0, ra = 0, sk = 0; for (const p of act) { pa += p.st.pa || 0; ra += p.st.ra || 0; sk += p.st.sk || 0; }
  const tg = (L.results || []).filter(r => r.y === L.year).length * 2; if (tg) row.ppg = Math.round((pa + ra + sk) / tg * 10) / 10;
}
const HIST_LEAD = [['py', 'Passing yds'], ['ptd', 'Pass TD'], ['ry', 'Rushing yds'], ['rtd', 'Rush TD'], ['recy', 'Receiving yds'], ['rec', 'Receptions'], ['rectd', 'Rec TD'], ['sk', 'Sacks'], ['int', 'INT'], ['tk', 'Tackles']];
// the season's stats onto each player's history row (with his game logs), career totals, then the career record book
function seasonArchive() {
  for (const id in L.P) { const p = L.P[id];
    if (p.st && p.st.gp) { const row = Object.assign({ y: L.year, t: p.tid }, p.st); if (p.tid === L.user && !L.ghost) row.mine = 1; if (L.qlen) row.ql = L.qlen; glArchive(p, row); p.hist.push(row); for (const k in p.st) p.car[k] = (p.car[k] || 0) + p.st[k]; }
    else p.gl = [];
    p.st = blankStats(); p._snap = {}; p._prevSnap = {}; }
  glPrune(); histCareer(); fsimPruneBoxes(true);
}
const HIST_CAR = [['py', 'Passing yards'], ['ptd', 'Passing TDs'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TDs'], ['recy', 'Receiving yards'], ['rec', 'Receptions'], ['rectd', 'Receiving TDs'], ['sk', 'Sacks'], ['int', 'Interceptions'], ['tk', 'Tackles'], ['fgm', 'Field goals']];
function histCareer() {
  L.rcar = L.rcar || {};
  for (const [k] of HIST_CAR) {
    const cur = {}; for (const e of (L.rcar[k] || [])) cur[e.pid] = e;
    for (const id in L.P) { const p = L.P[id], v = p.car && p.car[k]; if (!v || p.draft) continue; const prev = cur[p.id];
      if (!prev && (L.rcar[k] || []).length >= 10 && v <= L.rcar[k][L.rcar[k].length - 1].v) continue;
      const teams = [...new Set((p.hist || []).map(h => h.t).filter(t => t != null))].map(t => L.teams[t] ? L.teams[t].abbr : '').filter(Boolean);
      const qs = [...new Set((p.hist || []).map(h => h.ql || 0))];
      cur[p.id] = { pid: p.id, name: p.fn + ' ' + p.ln, pos: p.pos, v: Math.round(v * 10) / 10, teams: teams.join(', '), y0: (p.hist[0] || {}).y || L.year, y1: L.year, gp: p.car.gp || 0, mix: qs.length > 1 ? 1 : 0 }; }
    L.rcar[k] = Object.values(cur).sort((a, b) => b.v - a.v).slice(0, 10);
  }
}
// career totals with each season scaled to full-length games (the Hall of Fame vote): plays per game that season vs 62
function histScaledCareer(p) {
  const c = {}; if (!(p.hist || []).length) return Object.assign({}, p.car || {});
  for (const h of p.hist) { const f = clamp(62 / histPlays(h.y), 0.6, 4); for (const k in h) if (typeof h[k] === 'number' && k !== 'y' && k !== 't' && k !== 'ql') c[k] = (c[k] || 0) + (k === 'gp' ? h[k] : h[k] * f); }
  return c;
}
// ---------- dynasties: several titles in a short span ----------
function histDynasties() {
  const by = {}; for (const c of (L.champs || [])) (by[c.t] = by[c.t] || []).push(c.y);
  const out = [];
  for (const t in by) { const ys = by[t].sort((a, b) => a - b); let i = 0;
    while (i < ys.length) { let j = i; while (j + 1 < ys.length && ys[j + 1] - ys[i] <= 5) j++;
      const n = j - i + 1, run = ys.slice(i, j + 1); let b2b = 0; for (let k = 1; k < run.length; k++) if (run[k] === run[k - 1] + 1) b2b = 1;
      if (n >= 3 || (n === 2 && b2b)) { out.push({ t: +t, years: run, n, b2b, label: n >= 3 ? `${n} titles in ${run[run.length - 1] - run[0] + 1} seasons` : 'Back-to-back champions' }); i = j + 1; } else i++; } }
  return out.sort((a, b) => b.n - a.n || a.years[0] - b.years[0]);
}
