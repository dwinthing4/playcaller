// Game logs: one line per player per game, from the fast sim and from live games alike (finishGame -> glLog).
// p.gl = this season's lines; at the rollover they move onto the season's p.hist row (row.gl) and old seasons are pruned (glPrune).
// A line is a short string "week|opp|where|score|stats": week = schedule week index (or P0..P3 for a playoff round), where = h/a (nh/na at a neutral site),
// score = his team's points-the other team's, stats = "pa22,pc14,py180,sn41" (stat key + number; snaps are "sn").
const GL_KEYS = ['pa', 'pc', 'py', 'ptd', 'pint', 'ra', 'ry', 'rtd', 'rec', 'recy', 'rectd', 'tgt', 'tk', 'sk', 'int', 'pd', 'ff', 'fum', 'fgm', 'fga', 'xpm', 'xpa', 'pnt', 'pnty'];
function glPack(s, noSnaps) {
  if (!s) return ''; let out = '';
  for (const k of GL_KEYS) { const v = s[k]; if (v) out += (out ? ',' : '') + k + (Math.round(v * 10) / 10); }
  if (!noSnaps && s.snaps) out += (out ? ',' : '') + 'sn' + Math.round(s.snaps);
  return out;
}
function glUnpack(str) { const o = {}; if (!str) return o; const re = /([a-z]+)(-?\d+(?:\.\d+)?)/g; let m; while ((m = re.exec(str))) o[m[1] === 'sn' ? 'snaps' : m[1]] = +m[2]; return o; }
function glParse(line) { const a = String(line).split('|'); const po = a[0][0] === 'P'; return { w: po ? +a[0].slice(1) : +a[0], po, opp: +a[1], ha: a[2], my: +(a[3] || '0-0').split('-')[0], th: +(a[3] || '0-0').split('-')[1], s: glUnpack(a[4] || '') }; }
// write the lines for one finished game: every player who dressed (healthy, on either roster) or recorded something
function glLog(g, lines) {
  if (!L || g.h == null || g.a == null) return; const po = L.phase === 'playoffs', wk = po ? 'P' + ((L.playoff && L.playoff.round) || 0) : String(L.week);
  for (const [T, O, home] of [[L.teams[g.h], L.teams[g.a], 1], [L.teams[g.a], L.teams[g.h], 0]]) {
    const my = home ? g.hs : g.as, th = home ? g.as : g.hs, ha = g.neutral ? (home ? 'nh' : 'na') : home ? 'h' : 'a', head = `${wk}|${O.id}|${ha}|${my}-${th}|`;
    for (const id of T.roster) { const p = L.P[id]; if (!p) continue; const ln = lines && lines[id]; if (!ln && !available(id)) continue; (p.gl = p.gl || []).push(head + glPack(ln)); }
  }
}
// season rollover: this season's lines go onto the archived row; week-by-week detail is kept for this season and the last one league-wide
// and for every season a player spent on your team
function glArchive(p, row) { if (p.gl && p.gl.length) row.gl = p.gl; p.gl = []; }
function glPrune() {
  for (const id in L.P) { const p = L.P[id]; if (!p.hist) continue; for (const h of p.hist) if (h.gl && h.y < L.year && h.t !== L.user && !h.mine) delete h.gl; }
}
// rows of one season for the player card: [{w, po, opp, ha, my, th, s}], the current season from p.gl
function glSeason(p, y) { const src = y === L.year && L.phase !== 'offseason' ? p.gl : ((p.hist || []).find(h => h.y === y) || {}).gl; return (src || []).map(glParse); }
// a game's player lines, rebuilt from the game logs (box scores do not store them): [[away lines], [home lines]] of [pid, stats]
function glBoxLines(g, wk, y) {
  const out = [[], []], tagH = wk + '|' + g.a + '|', tagA = wk + '|' + g.h + '|', seen = new Set(), cur = y == null || (y === L.year && L.phase !== 'offseason');
  const src = p => cur ? p.gl : ((p.hist || []).find(h => h.y === y) || {}).gl;
  const scan = p => { if (!p || seen.has(p.id)) return; seen.add(p.id); const gl = src(p); if (!gl) return; for (const l of gl) { const side = l.startsWith(tagH) ? 1 : l.startsWith(tagA) ? 0 : -1; if (side < 0) continue; const s = glUnpack(l.split('|')[4]); delete s.snaps; if (Object.keys(s).length) out[side].push([p.id, s]); break; } };
  for (const t of [L.teams[g.a], L.teams[g.h]]) for (const id of t.roster) scan(L.P[id]);
  for (const id in L.P) scan(L.P[id]);      // traded or released since
  return out;
}
