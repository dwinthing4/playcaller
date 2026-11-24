// Playcaller roster file (format "playcaller-roster", version 1): the user's own team names, colors, logos, player names, numbers,
// ratings and photos, loaded from a file on their device and kept in their save (nothing is uploaded or bundled). See docs/roster-file.md.
// This part is node-safe: parse + validate (rfParse), match teams (rfMatch), preview (rfPlan), apply (rfApply) and export (rfExport).
// Images arrive as data URLs; the UI shrinks them (~128 px) before rfApply. Photos go to the image store (imgPut, 90_save.js).
const RF_FORMAT = 'playcaller-roster', RF_VERSION = 1;
const RF_POS_ALIAS = { HB: 'RB', TB: 'RB', T: 'OT', LT: 'OT', RT: 'OT', G: 'OG', LG: 'OG', RG: 'OG', OL: 'OG', EDGE: 'DE', DL: 'DT', NT: 'DT', ILB: 'LB', OLB: 'LB', MLB: 'LB', DB: 'CB', FS: 'S', SS: 'S', PK: 'K' };
const RF_IMG = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
function rfStr(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function rfPos(v) { const p = String(v || '').toUpperCase().replace(/[^A-Z]/g, ''); return POS_LIST.includes(p) ? p : RF_POS_ALIAS[p] || null; }
function rfColor(v) { const s = String(v || '').trim(); if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase(); if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s.slice(1).split('').map(c => c + c).join('')).toLowerCase(); return null; }
function rfNum(v, lo, hi) { const n = Math.round(+v); return Number.isFinite(n) && v !== '' && v != null ? clamp(n, lo, hi) : null; }
function rfImgOk(v) { return typeof v === 'string' && v.length < 6e6 && RF_IMG.test(v) ? v : null; }
// parse text or an object into a clean file: { name, author, teams: [{ abbr, city, name, c1, c2, hel, logo, coach, oc, dc, players: [...] }] }
function rfParse(src) {
  const warn = []; let d = src;
  if (typeof src === 'string') { if (src.length > 80e6) return { ok: false, msg: 'That file is too big (over 80 MB).' }; try { d = JSON.parse(src.replace(/^﻿/, '')); } catch (e) { return { ok: false, msg: 'That file is not valid JSON. Check for a missing comma or bracket.' }; } }
  if (!d || typeof d !== 'object') return { ok: false, msg: 'That is not a roster file.' };
  if (d.teams && d.P && d.year) return { ok: false, msg: 'That is a saved league, not a roster file. Use "Import league file" on the title screen.' };
  if (d.format && d.format !== RF_FORMAT) return { ok: false, msg: `Unknown file format "${rfStr(d.format, 40)}".` };
  if (!Array.isArray(d.teams) || !d.teams.length) return { ok: false, msg: 'The file has no "teams" list.' };
  if (+d.version > RF_VERSION) warn.push(`Made for a newer roster format (version ${+d.version}); some parts may be skipped.`);
  let badImg = 0, linkImg = 0, badPos = 0, cut = 0; const teams = [];
  const img = v => { if (v == null || v === '') return null; if (typeof v === 'string' && /^(https?:)?\/\//i.test(v)) { linkImg++; return null; } const ok = rfImgOk(v); if (!ok) badImg++; return ok; };
  const nm = o => o && typeof o === 'object' ? { fn: rfStr(o.first || o.fn, 20), ln: rfStr(o.last || o.ln, 24) } : null;
  for (const t of d.teams.slice(0, 64)) {
    if (!t || typeof t !== 'object') continue; const city = rfStr(t.city, 22), abbr = rfStr(t.abbr, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!city && !abbr && !rfStr(t.name, 20)) { warn.push('Skipped a team with no city, name or abbreviation.'); continue; }
    const col = t.colors || {}, players = [];
    for (const p of Array.isArray(t.players) ? t.players : []) {
      if (!p || typeof p !== 'object') continue; const pos = rfPos(p.pos || p.position); let fn = rfStr(p.first || p.fn, 20), ln = rfStr(p.last || p.ln, 24);
      if (!fn && !ln && p.name) { const w = rfStr(p.name, 44).split(' '); fn = w[0].slice(0, 20); ln = w.slice(1).join(' ').slice(0, 24); }
      if (!pos || (!fn && !ln)) { badPos++; continue; } if (players.length >= 70) { cut++; continue; }
      const r = p.ratings && typeof p.ratings === 'object' ? p.ratings : {}, a = {}; for (const k of ATTRS) { const v = rfNum(r[k], 10, 99); if (v != null) a[k] = v; }
      players.push({ fn: fn || ln, ln: ln || fn, pos, num: rfNum(p.num ?? p.number, 0, 99), age: rfNum(p.age, 20, 45), ovr: rfNum(r.ovr ?? p.ovr, 25, 99), pot: rfNum(r.pot ?? p.pot, 25, 99), a,
        ht: rfNum(p.height ?? p.ht, 60, 84), wt: rfNum(p.weight ?? p.wt, 150, 380), photo: img(p.photo), comp: rfStr(p.comp, 80) || null });
    }
    teams.push({ abbr, city, name: rfStr(t.name, 20), c1: rfColor(col.primary || t.c1), c2: rfColor(col.secondary || t.c2), hel: rfColor(col.helmet || t.helmet), logo: img(t.logo), coach: nm(t.coach), oc: nm(t.oc), dc: nm(t.dc), players });
  }
  if (!teams.length) return { ok: false, msg: 'No usable teams in the file (each needs a city, name or abbreviation).' };
  if (badPos) warn.push(`${badPos} player${badPos === 1 ? '' : 's'} skipped (missing name or unknown position).`);
  if (cut) warn.push(`${cut} player${cut === 1 ? '' : 's'} over the 70-per-team limit skipped.`);
  if (linkImg) warn.push(`${linkImg} image link${linkImg === 1 ? '' : 's'} ignored: only images inside the file are used, nothing is downloaded.`);
  if (badImg) warn.push(`${badImg} image${badImg === 1 ? '' : 's'} could not be read (PNG, JPEG, WebP or GIF data URLs only).`);
  const file = { name: rfStr(d.name, 60) || 'Roster file', author: rfStr(d.author, 60), teams };
  return { ok: true, file, warn, stats: rfStats(file) };
}
function rfStats(f) { const ps = f.teams.flatMap(t => t.players); return { teams: f.teams.length, players: ps.length, logos: f.teams.filter(t => t.logo).length, photos: ps.filter(p => p.photo).length, ratings: ps.filter(p => p.ovr != null || Object.keys(p.a).length).length, comps: ps.filter(p => p.comp).length }; }
// match file teams to league teams: abbreviation, then city (or "city name"), then (opts.order) leftovers in file order
function rfMatch(f, opts) {
  const used = new Set(), pairs = [], low = s => String(s || '').toLowerCase(), left = [];
  f.teams.forEach((ft, fi) => {
    let t = ft.abbr ? L.teams.find(x => !used.has(x.id) && low(x.abbr) === low(ft.abbr)) : null; let how = 'abbr';
    if (!t && ft.city) { t = L.teams.find(x => !used.has(x.id) && (low(x.city) === low(ft.city) || low(teamLabel(x)) === low(ft.city + ' ' + ft.name))); how = 'city'; }
    if (t) { used.add(t.id); pairs.push({ fi, tid: t.id, how }); } else left.push(fi);
  });
  const un = []; for (const fi of left) { const t = opts && opts.order ? L.teams.find(x => !used.has(x.id)) : null; if (t) { used.add(t.id); pairs.push({ fi, tid: t.id, how: 'order' }); } else un.push(fi); }
  return { pairs: pairs.sort((a, b) => a.fi - b.fi), unmatched: un };
}
function rfDepthOrder(T, pos) { const d = (T.depth[pos] || []).filter(id => L.P[id] && L.P[id].tid === T.id); return d.concat(T.roster.filter(id => L.P[id] && L.P[id].pos === pos && !d.includes(id))); }
// preview: what applying would change, team by team
function rfPlan(f, opts) {
  const M = rfMatch(f, opts), mode = opts.mode || 'names';
  const rows = M.pairs.map(({ fi, tid, how }) => { const ft = f.teams[fi], T = L.teams[tid]; let placed = 0, extra = 0;
    if (mode === 'names') { const by = {}; for (const p of ft.players) by[p.pos] = (by[p.pos] || 0) + 1; for (const pos in by) { const n = rfDepthOrder(T, pos).length; placed += Math.min(n, by[pos]); extra += Math.max(0, by[pos] - n); } }
    else placed = Math.min(53, ft.players.length);
    return { fi, tid, how, from: { abbr: T.abbr, city: T.city, name: T.name }, to: { abbr: ft.abbr || T.abbr, city: ft.city || T.city, name: ft.name || (ft.city ? ft.city : T.name) }, colors: !!(ft.c1 || ft.c2), logo: !!ft.logo,
      players: ft.players.length, placed, extra, photos: ft.players.filter(p => p.photo).length, fill: mode === 'replace' ? rfFillCount(ft.players) : 0, user: tid === L.user }; });
  return { rows, unmatched: M.unmatched.map(fi => f.teams[fi]), mode };
}
function rfFillCount(ps) { let n = 0; for (const pos of POS_LIST) n += Math.max(0, POS_COUNTS[pos] - ps.filter(p => p.pos === pos).length); return Math.max(n, 0); }
// ratings from the file: listed attributes are used as given; "ovr" alone shapes the player's attributes to that overall
function rfRatings(p, fp, useAge) {
  if (useAge && fp.age) p.age = fp.age; if (fp.ht) p.ht = fp.ht; if (fp.wt) p.wt = fp.wt;
  const ks = Object.keys(fp.a || {}); for (const k of ks) p.a[k] = fp.a[k];
  if (fp.ovr != null) { const w = Object.keys(OVR_W[p.pos] || {}).filter(k => !ks.includes(k)); for (let i = 0; i < 8 && w.length; i++) { const d = fp.ovr - calcOvr(p); if (!d) break; for (const k of w) p.a[k] = clamp(p.a[k] + d, 10, 99); } }
  if (!ks.length && fp.ovr == null) return; p.ovr = calcOvr(p);
  p.pot = clamp(fp.pot != null ? Math.max(fp.pot, p.ovr) : Math.max(p.pot || 0, p.ovr), p.ovr, 99); p.ap = null; ensurePot(p); assignTraits(p);
}
function rfPerson(p, fp, opts) {
  p.fn = fp.fn; p.ln = fp.ln; if (fp.num != null) p.num = fp.num; if (fp.comp) p.comp = fp.comp; else delete p.comp;
  if (fp.photo) p.photo = imgPut(fp.photo); else if (opts.mode === 'replace') delete p.photo;
  if (opts.ratings) rfRatings(p, fp, true);
}
// apply a parsed file to the current league. opts: { mode: 'names' | 'replace', ratings: true/false, order: true/false }
function rfApply(f, opts) {
  opts = Object.assign({ mode: 'names', ratings: true, order: true }, opts || {}); const M = rfMatch(f, opts); let np = 0, ph = 0, filled = 0, skipped = 0;
  for (const { fi, tid } of M.pairs) {
    const ft = f.teams[fi], T = L.teams[tid];
    if (ft.city) { const bare = T.name === T.city; T.city = ft.city; if (bare && !ft.name) T.name = ft.city; }
    if (ft.name) T.name = ft.name; if (ft.abbr) T.abbr = ft.abbr;
    const recolor = ft.c1 || ft.c2 || ft.hel; if (ft.c1) T.c1 = ft.c1; if (ft.c2) T.c2 = ft.c2; if (ft.hel) T.hel = ft.hel; if (recolor) resetKits(T);
    if (ft.logo) T.logoImg = ft.logo;
    if (ft.coach && (ft.coach.fn || ft.coach.ln) && (T.id !== L.user || L.picking)) { T.coach.fn = ft.coach.fn || T.coach.fn; T.coach.ln = ft.coach.ln || T.coach.ln; }
    for (const k of ['oc', 'dc']) if (ft[k] && T[k] && (ft[k].fn || ft[k].ln)) { T[k].fn = ft[k].fn || T[k].fn; T[k].ln = ft[k].ln || T[k].ln; }
    if (opts.mode === 'replace' && ft.players.length) { const r = rfReplace(T, ft.players, opts); np += r.n; filled += r.filled; }
    else { const by = {}; for (const fp of ft.players) (by[fp.pos] = by[fp.pos] || []).push(fp);
      for (const pos in by) { const ids = rfDepthOrder(T, pos); by[pos].forEach((fp, i) => { const p = L.P[ids[i]]; if (!p) { skipped++; return; } rfPerson(p, fp, opts); np++; }); }
      fixDepth(T); }
    ph += ft.players.filter(p => p.photo).length;
  }
  // abbreviations stay unique
  const seen = new Set(); for (const t of L.teams) { let a = t.abbr, k = 1; while (seen.has(a)) a = t.abbr.slice(0, 3) + (k++); t.abbr = a; seen.add(a); }
  if (opts.mode === 'replace') { L.inOffers = []; L.gmProp = null; L.blocks = null; L.blocksKey = null; }
  if (!L.picking) news(`Roster file "${f.name}" applied: ${M.pairs.length} team${M.pairs.length === 1 ? '' : 's'}, ${np} players.`);
  return { ok: true, teams: M.pairs.length, players: np, photos: ph, filled, skipped, unmatched: M.unmatched.length,
    msg: `Applied to ${M.pairs.length} team${M.pairs.length === 1 ? '' : 's'}: ${np} player${np === 1 ? '' : 's'}${ph ? `, ${ph} photos` : ''}${filled ? `, ${filled} empty spots filled` : ''}${skipped ? `, ${skipped} not placed` : ''}.` };
}
// replace a team's roster with the file's players (the old ones retire); positions the file leaves short are filled with generated players
function rfReplace(T, list, opts) {
  const keepQ = {}; for (const pos of POS_LIST) keepQ[pos] = rfDepthOrder(T, pos).map(id => L.P[id].ovr);
  for (const id of T.roster) { const p = L.P[id]; if (!p) continue; p.tid = null; p.retired = true; p.retY = L.year; }
  T.roster = []; T.depth = {}; T.captains = []; const cnt = {}; let n = 0, filled = 0;
  for (const fp of list) { if (T.roster.length >= 53) break; const i = cnt[fp.pos] = (cnt[fp.pos] || 0) + 1;
    const q = fp.ovr != null ? fp.ovr : (keepQ[fp.pos][i - 1] != null ? keepQ[fp.pos][i - 1] : clamp((T.q || 70) - 6 - i * 3, 45, 80));
    const p = genPlayer(fp.pos, q, fp.age || ri(22, 31)); rfPerson(p, fp, Object.assign({}, opts, { ratings: opts.ratings || fp.ovr != null }));
    p.tid = T.id; setContract(p); L.P[p.id] = p; T.roster.push(p.id); n++; }
  for (const pos of POS_LIST) while ((cnt[pos] || 0) < POS_COUNTS[pos] && T.roster.length < 53) { cnt[pos] = (cnt[pos] || 0) + 1; const q = keepQ[pos][cnt[pos] - 1] ?? 55; const p = genPlayer(pos, q); p.tid = T.id; setContract(p); L.P[p.id] = p; T.roster.push(p.id); filled++; }
  const pay = sum(T.roster.map(id => L.P[id].sal)), f = pay > CAP * 0.95 ? CAP * 0.92 / pay : 1;
  for (const id of T.roster) { const p = L.P[id]; p.sal = Math.max(0.9, ctR(p.sal * f)); p.base = p.sal; p.pr = 0; p.prYrs = 0; p.guar = 0; p.ctV = 0; ctStructure(p); }
  fixDepth(T, true); const nums = new Set(); for (const id of T.roster) { const p = L.P[id]; if (p.num != null && nums.has(p.num)) p.num = 0; else if (p.num) nums.add(p.num); }
  assignNumbers(T); if (typeof ctDeadSync === 'function') ctDeadSync(T); return { n, filled };
}
// export the league in the same format, so files can be shared (logos and photos ride along as data URLs)
function rfExport(opts) {
  opts = opts || {}; const ord = T => POS_LIST.flatMap(pos => rfDepthOrder(T, pos)).map(id => L.P[id]).filter(Boolean);
  const nm = c => c ? { first: c.fn, last: c.ln } : undefined;
  return { format: RF_FORMAT, version: RF_VERSION, name: opts.name || `${L.year} league`, created: new Date().toISOString().slice(0, 10), note: 'Playcaller roster file. Players are listed in depth-chart order within each position.',
    teams: L.teams.map(T => ({ abbr: T.abbr, city: T.city, name: T.name === T.city ? '' : T.name, colors: { primary: T.c1, secondary: T.c2, helmet: T.hel || T.c1 }, logo: T.logoImg || undefined,
      coach: nm(T.coach), oc: nm(T.oc), dc: nm(T.dc),
      players: ord(T).map(p => ({ first: p.fn, last: p.ln, pos: p.pos, num: p.num, age: p.age, height: p.ht, weight: p.wt,
        ratings: opts.ratings === false ? undefined : Object.assign({ ovr: p.ovr, pot: p.pot }, p.a), photo: imgGet(p.photo) || undefined, comp: p.comp || undefined })) })) };
}
