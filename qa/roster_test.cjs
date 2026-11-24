// Headless roster-file test: export -> import round trip (names, numbers, logos, photos, ratings), names-only mode,
// matching by abbreviation/city/order, the sample file in docs/, and gentle failures on bad input.
// run: node tools/build.mjs && node qa/roster_test.cjs
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const { LG } = require(path.join(__dirname, '..', 'dist', 'sim.cjs'));
const T = LG._t; let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };
// a tiny solid PNG as a data URL (stands in for a logo or a photo)
function png(w, h, rgb) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
// ---- league A: give it custom names, logos and photos, then export
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(3, 'Coach A'); let L = LG.state();
L.teams.forEach((t, i) => { t.city = 'Testville ' + i; t.name = 'Fliers' + i; t.abbr = 'T' + String(i).padStart(2, '0'); t.logoImg = png(8, 8, [i * 7, 40, 200 - i * 5]); });
const A = L.teams[5]; A.roster.slice(0, 10).forEach((id, k) => { L.P[id].photo = T.imgPut(png(4, 4, [k * 20, 100, 50])); L.P[id].comp = 'Reminds scouts of a classic slot receiver ' + k; });
const ex = T.rfExport({ name: 'Round trip' }); const txt = JSON.stringify(ex);
ok(ex.format === 'playcaller-roster' && ex.version === 1 && ex.teams.length === 32, 'export has format, version and 32 teams');
ok(ex.teams[5].players.filter(p => p.photo).length === 10 && ex.teams[5].logo, 'export carries logos and photos');
const sig = t => ({ abbr: t.abbr, city: t.city, name: t.name, logo: t.logoImg, c1: t.c1, c2: t.c2, players: t.roster.map(id => L.P[id]).map(p => `${p.pos}|${p.fn}|${p.ln}|${p.num}|${p.ovr}`).sort().join(',') });
const before = L.teams.map(sig); const photosA = A.roster.slice(0, 10).map(id => T.imgGet(L.P[id].photo));
// ---- league B: start fresh and import with "replace rosters"
LG.newLeague({ diff: 'pro', qlen: 120 }); L = LG.state();
const P = T.rfParse(txt); ok(P.ok, 'exported file parses: ' + (P.msg || '')); ok(P.stats.teams === 32 && P.stats.photos === 10 && P.stats.logos === 32, `parse stats ${JSON.stringify(P.stats)}`);
const plan = T.rfPlan(P.file, { mode: 'replace', order: true }); ok(plan.rows.length === 32 && !plan.unmatched.length, 'plan matches every team (in file order)');
const res = T.rfApply(P.file, { mode: 'replace', ratings: true, order: true }); ok(res.ok && res.teams === 32, 'apply: ' + res.msg);
LG.chooseTeam(3, 'Coach B'); L = LG.state();
const after = L.teams.map(sig); let same = 0, sameP = 0;
for (let i = 0; i < 32; i++) { const a = before[i], b = after[i]; if (a.abbr === b.abbr && a.city === b.city && a.name === b.name && a.logo === b.logo && a.c1 === b.c1 && a.c2 === b.c2) same++; if (a.players === b.players) sameP++; }
ok(same === 32, `teams round-trip: names, colors and logos (${same}/32)`);
ok(sameP >= 30, `rosters round-trip: names, numbers, positions, overall (${sameP}/32)`);
const B5 = L.teams[5]; const photosB = B5.roster.map(id => T.imgGet(L.P[id].photo)).filter(Boolean);
ok(photosB.length === 10 && photosA.every(u => photosB.includes(u)), 'photos round-trip');
ok(B5.roster.map(id => L.P[id]).filter(p => p.comp).length === 10, 'comparisons round-trip (p.comp)');
ok(L.teams.every(t => t.roster.length === 53 && T.capRoom(t) > -2), 'imported rosters are full and under the cap');
// ---- names-only mode on a league with different abbreviations, matched by city
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Coach C'); L = LG.state();
const t0 = L.teams[0], t1 = L.teams[1]; const f2 = { format: 'playcaller-roster', version: 1, teams: [
  { city: t1.city, name: 'Comets', abbr: 'CMT', colors: { primary: '#123456', secondary: '#fedcba' }, players: [{ first: 'Ada', last: 'Quill', pos: 'QB', num: 7 }, { first: 'Bo', last: 'Strand', pos: 'HB', num: 22 }, { name: 'Cy Drummond', pos: 'LT' }] },
  { abbr: t0.abbr, name: 'Owls', players: [{ first: 'Dee', last: 'Marlow', pos: 'WR', num: 81, ratings: { ovr: 77 } }] }] };
const P2 = T.rfParse(f2); ok(P2.ok, 'hand-made file parses');
const plan2 = T.rfPlan(P2.file, { mode: 'names', order: false }); ok(plan2.rows.find(r => r.fi === 0).tid === 1 && plan2.rows.find(r => r.fi === 1).tid === 0, 'teams matched by city and by abbreviation');
const qb0 = L.P[t1.depth.QB[0]].id, rb0 = L.P[t1.depth.RB[0]].id, ot0 = L.P[t1.depth.OT[0]].id, wr0 = L.P[t0.depth.WR[0]], wrOvr = wr0.ovr, rosterN = t1.roster.length;
T.rfApply(P2.file, { mode: 'names', ratings: false, order: false });
ok(L.P[qb0].fn === 'Ada' && L.P[qb0].ln === 'Quill' && L.P[qb0].num === 7, 'names mode: starter QB renamed with number');
ok(L.P[rb0].ln === 'Strand' && L.P[ot0].fn === 'Cy' && L.P[ot0].ln === 'Drummond', 'names mode: position aliases (HB, LT) and "name" field');
ok(t1.name === 'Comets' && t1.abbr === 'CMT' && t1.c1 === '#123456' && t1.roster.length === rosterN, 'names mode: team renamed and recolored, roster kept');
ok(wr0.ln === 'Marlow' && wr0.ovr === wrOvr, 'ratings left alone when "use ratings" is off');
T.rfApply(P2.file, { mode: 'names', ratings: true, order: false }); ok(wr0.ovr === 77, 'ratings applied when asked (ovr 77, got ' + wr0.ovr + ')');
// ---- the sample file in docs/
const samp = fs.readFileSync(path.join(__dirname, '..', 'docs', 'sample-roster.json'), 'utf8'); const PS = T.rfParse(samp);
ok(PS.ok && PS.stats.teams >= 2 && PS.stats.players >= 10 && PS.stats.logos >= 1 && PS.stats.photos >= 1, 'docs/sample-roster.json parses ' + JSON.stringify(PS.stats || PS.msg));
// ---- gentle failures
const bad = [['not json', 'not valid JSON'], ['{"hello":1}', 'no "teams"'], [JSON.stringify({ teams: [{}] }), 'No usable teams'], [JSON.stringify({ format: 'other', teams: [{ city: 'X' }] }), 'Unknown file format'], [LG.serialize(), 'saved league']];
for (const [s, want] of bad) { const r = T.rfParse(s); ok(!r.ok && r.msg.includes(want), `bad input fails gently: "${r.msg}"`); }
const r3 = T.rfParse({ teams: [{ city: 'Linkton', logo: 'https://example.com/logo.png', players: [{ first: 'A', last: 'B', pos: 'XYZ' }, { first: 'C', last: 'D', pos: 'QB', photo: 'data:image/svg+xml;base64,PHN2Zz4=' }] }] });
ok(r3.ok && r3.file.teams[0].logo === null && r3.file.teams[0].players.length === 1 && r3.file.teams[0].players[0].photo === null && r3.warn.length === 3, 'links, SVG and unknown positions are skipped with warnings: ' + r3.warn.join(' | '));
const r4 = T.rfParse({ teams: [{ city: '<b>Evil</b>\u0007 Town', abbr: 'e<v>!l', players: [] }] }); ok(r4.ok && r4.file.teams[0].city === 'bEvil/b Town' && r4.file.teams[0].abbr === 'EVL', 'text is cleaned: ' + JSON.stringify(r4.ok && r4.file.teams[0]));
console.log(fails ? `${fails} FAILURES` : 'ALL PASS'); process.exit(fails ? 1 : 0);
