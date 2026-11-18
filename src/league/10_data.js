// League data: ratings model, positions, traits, names, player generation. Ported from Playcaller (final behavior, one definition each).
let UID = 1; const nid = () => UID++;
const CAP = 280;
const POS_PROFILE = {
  QB: { thp: 0, tha: 0, awr: 0, spd: -14, acc: -8, agi: -8, str: -20, elu: -18, btk: -25, car: -12 },
  RB: { spd: 6, acc: 6, agi: 4, btk: 0, elu: 0, car: 0, cth: -10, str: -10, awr: -10, rbk: -30, pbk: -22, rte: -20 },
  FB: { rbk: 0, str: 0, btk: -5, car: -10, cth: -15, spd: -15, acc: -12, awr: -10, pbk: -8 },
  WR: { spd: 8, acc: 6, agi: 4, cth: 0, rte: 0, jmp: -2, awr: -8, elu: -10, btk: -20, car: -10, rbk: -30, str: -25 },
  TE: { cth: -3, rte: -8, jmp: -8, rbk: -4, str: -5, spd: -6, acc: -6, btk: -10, awr: -8, pbk: -12, car: -15 },
  OT: { pbk: 0, rbk: 0, str: 0, awr: -5, acc: -30, spd: -38, agi: -35 },
  OG: { pbk: 0, rbk: 0, str: 2, awr: -5, acc: -30, spd: -40, agi: -36 },
  C: { pbk: 0, rbk: 0, str: 0, awr: 0, acc: -32, spd: -42, agi: -36 },
  DE: { prs: 0, pow: -2, bsh: -2, tak: -6, spd: -4, acc: 0, str: -4, pur: -6, awr: -8, zcv: -35 },
  DT: { bsh: 0, pow: 0, str: 4, tak: -6, prs: -8, spd: -25, acc: -15, pur: -12, awr: -8 },
  LB: { tak: 0, pur: 0, zcv: -4, bsh: -6, spd: -2, acc: 0, awr: -2, mcv: -15, prs: -15, pow: -15, str: -8, hnd: -20 },
  CB: { mcv: 0, zcv: 0, spd: 10, acc: 8, agi: 6, jmp: -3, hnd: -12, awr: -6, tak: -20, pur: -12, cth: -30 },
  S: { zcv: 0, tak: -4, spd: 6, acc: 4, jmp: -6, hnd: -10, awr: -2, mcv: -10, pur: -2, agi: 0 },
  K: { kpw: 0, kac: 0 }, P: { kpw: 0, kac: -2 },
};
const OVR_W = {
  QB: { thp: 3, tha: 4, awr: 3, spd: .6 }, RB: { spd: 3, acc: 1, agi: 2, btk: 2, elu: 2, car: 2, cth: 1 }, FB: { rbk: 3, str: 2, btk: 1, cth: 1 },
  WR: { spd: 3, cth: 3, rte: 3, agi: 1, jmp: .5 }, TE: { cth: 2, rte: 1, rbk: 2, str: 1, spd: 1 },
  OT: { pbk: 3, rbk: 2, str: 2, awr: 1 }, OG: { pbk: 2, rbk: 3, str: 2, awr: 1 }, C: { pbk: 2, rbk: 2, str: 2, awr: 2 },
  DE: { prs: 3, pow: 2, bsh: 2, tak: 1, spd: 1 }, DT: { bsh: 3, pow: 3, str: 2, tak: 1 }, LB: { tak: 3, pur: 2, zcv: 2, bsh: 1, spd: 1, awr: 1 },
  CB: { mcv: 3, zcv: 2, spd: 3, hnd: 1, agi: 1, jmp: .5 }, S: { zcv: 3, tak: 2, spd: 2, hnd: 1, awr: 1 }, K: { kpw: 3, kac: 3 }, P: { kpw: 3, kac: 2 },
};
const POS_PAY = { QB: 2.2, DE: 1.3, OT: 1.2, WR: 1.2, CB: 1.1, DT: 1, LB: .8, S: .8, OG: .8, C: .7, TE: .8, RB: .6, FB: .3, K: .3, P: .25 };
const TRAITS = {
  ballhawk: { n: 'Ballhawk', d: 'Intercepts more passes', pos: ['CB', 'S', 'LB'], req: a => a.hnd > 72 },
  shutdown: { n: 'Shutdown', d: 'Sticks tight in man coverage', pos: ['CB'], req: a => a.mcv > 84 },
  surehands_t: { n: 'Sure Tackler', d: 'Rarely missed or juked', pos: ['LB', 'S', 'CB', 'DT', 'DE'], req: a => a.tak > 80 },
  bullrush: { n: 'Bull Rusher', d: 'Drives blockers back', pos: ['DE', 'DT'], req: a => a.pow > 80 },
  speedrush: { n: 'Speed Rusher', d: 'Wins the edge fast', pos: ['DE', 'LB'], req: a => a.prs > 80 && a.spd > 74 },
  juke: { n: 'Juke Artist', d: 'Jukes work more often', pos: ['RB', 'WR'], req: a => a.elu > 84 },
  bruiser: { n: 'Bruiser', d: 'Breaks tackles', pos: ['RB', 'FB', 'TE'], req: a => a.btk > 82 },
  hands: { n: 'Sure Hands', d: 'Catches in traffic', pos: ['WR', 'TE', 'RB'], req: a => a.cth > 85 },
  deep: { n: 'Deep Threat', d: 'Separates on deep routes', pos: ['WR', 'TE'], req: a => a.spd > 92 },
  gunslinger: { n: 'Gunslinger', d: 'Huge arm, riskier throws', pos: ['QB'], req: a => a.thp > 88 },
  general: { n: 'Field General', d: 'Accurate under pressure', pos: ['QB'], req: a => a.tha > 85 && a.awr > 80 },
  wall: { n: 'Brick Wall', d: 'Pass rushers rarely shed', pos: ['OT', 'OG', 'C'], req: a => a.pbk > 85 },
  mauler: { n: 'Mauler', d: 'Dominant run blocker', pos: ['OT', 'OG', 'C', 'TE', 'FB'], req: a => a.rbk > 85 },
  clutch: { n: 'Clutch', d: 'Better in the 4th quarter', pos: ['K', 'QB', 'WR'], req: a => a.awr > 84 || a.kac > 88 },
};
const TEAM_TRAITS = {
  ballhawks: { n: 'Ballhawk secondary', d: 'Defenders intercept more' }, suretackle: { n: 'Sure-tackling defense', d: 'Fewer missed tackles and jukes' },
  passrush: { n: 'Relentless pass rush', d: 'Rushers shed blocks faster' }, runstuff: { n: 'Run-stuffing front', d: 'Linemen shed run blocks faster' },
  lockdown: { n: 'Lockdown coverage', d: 'Coverage stays tighter' }, protect: { n: 'Elite protection', d: 'Line holds pass blocks longer' },
  ground: { n: 'Ground game', d: 'Runners break more tackles' }, yac: { n: 'YAC machine', d: 'Receivers elusive after the catch' }, accurate: { n: 'Precision passing', d: 'Throws land more accurately' },
};
const OFF_STYLES = { 'Air Raid': { pass: .68, deep: .5 }, 'West Coast': { pass: .6, deep: .2 }, 'Spread': { pass: .62, deep: .35 }, 'Balanced': { pass: .55, deep: .3 }, 'Ground & Pound': { pass: .42, deep: .3 } };
const DEF_STYLES = { 'Blitz Heavy': { blitz: .45, man: .6 }, 'Cover 2': { blitz: .15, man: .2 }, 'Man Press': { blitz: .25, man: .8 }, 'Cover 3': { blitz: .2, man: .25 }, 'Balanced': { blitz: .25, man: .45 } };
const DIFFS = { rookie: { n: 'Rookie', ai: -6, user: 6, react: .2, tk: -.08, acc: .75 }, pro: { n: 'Pro', ai: 0, user: 0, react: 0, tk: 0, acc: 1 }, allpro: { n: 'All-Pro', ai: 4, user: 0, react: -.06, tk: .05, acc: 1.12 }, legend: { n: 'Legend', ai: 8, user: -2, react: -.12, tk: .1, acc: 1.25 } };
const FN = 'James John Robert Michael David Chris Marcus Jalen Justin Tyler Brandon Jordan Darius Trey Cameron Caleb Isaiah Malik Andre Terrell DeShawn Jamal Kyle Austin Derek Travis Josh Mason Ethan Noah Logan Aiden Elijah Xavier Zion Tre Jaylen Devin Cole Garrett Brock Hunter Carter Brady Luke Jack Owen Dylan Sam Ben Nick Kevin Antonio Mario Luis Carlos Tavon Keon Rashad Quincy Damon Lamar Reggie Corey Shane Wyatt Colt Bryce Drew Grant Tanner Spencer Jace Kendrick Amari Kobe Myles Rome Cedric Desmond Omar Hassan Tariq Bo Sterling Reid Jabari Quentin Levi Micah Rodney Vince'.split(' ');
const LN = 'Smith Johnson Williams Brown Jones Davis Miller Wilson Moore Taylor Anderson Thomas Jackson White Harris Martin Thompson Robinson Clark Lewis Walker Hall Allen Young King Wright Hill Scott Green Adams Baker Nelson Carter Mitchell Roberts Turner Phillips Campbell Parker Evans Edwards Collins Stewart Morris Rogers Reed Cook Morgan Bell Murphy Bailey Cooper Richardson Cox Howard Ward Brooks Watson Sanders Price Bennett Wood Barnes Ross Henderson Coleman Jenkins Perry Powell Long Patterson Hughes Flores Washington Butler Simmons Foster Bryant Alexander Russell Griffin Hayes Myers Ford Graham Sullivan Wallace West Cole Jordan Reynolds Hamilton Wells Ellis Fisher Mason Holmes Hunt Black Daniels Palmer Mills Grant Knight Ferguson Stone Hawkins Dunn Boyd Warren Fox Rose Rice Moss Payne Burke Wade Pierce Cannon Lyons Banks Holt Shaw Barrett Steele Bishop Maddox Whitfield Okafor Adeyemi Nwosu Fuimaono Kalani Mahoe Vega Ramos Castillo Delgado Ortega Halversen Reyes'.split(' ');
const rname = () => ({ fn: pick(FN), ln: pick(LN) });
const COLLEGES = 'State Tech Central Coastal Northern Southern Western Eastern Valley Mountain Lakeshore Riverside Capital Prairie Desert Bayou Pine Harbor'.split(' ');
const R_CITIES = 'Portland Austin San Antonio Omaha Memphis Louisville Columbus Sacramento Birmingham Salt Lake Albuquerque Tulsa Raleigh Boise Anchorage Honolulu Orlando Richmond Milwaukee Oklahoma Spokane Fresno Toledo Hartford Charleston Savannah Reno El Paso Tucson Wichita Mobile Montreal'.split(' ');
const R_MASCOTS = 'Thunder Lumberjacks Outlaws Comets Stallions Grizzlies Admirals Vipers Hurricanes Rattlers Monarchs Sabercats Highlanders Pioneers Express Wolves Mariners Rockets Bison Phantoms Cyclones Marauders Condors Mustangs Ironmen Blaze Krakens Coyotes Titans Generals Sentinels Gators'.split(' ');
const R_COLORS = ['#c0392b', '#2e86de', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#2c3e50', '#f39c12', '#7f8c8d', '#e84393', '#0984e3', '#6c5ce7', '#00b894', '#e17055', '#b7950b', '#b33939', '#218c74', '#40407a', '#706fd3', '#ff793f', '#34ace0', '#1e8449', '#cd6133', '#474787', '#227093', '#ff5252', '#ffb142', '#2c2c54', '#7d9c3e', '#079992', '#60a3bc', '#e55039'];
const R_TRIMS = ['#ffffff', '#f4f1e8', '#ffd23f', '#1a1a1a', '#c9ccd1', '#f26a1b', '#b8913a'];
const CONF_NAME = { A: 'Atlantic', N: 'Pacific' };
const DIVS = ['East', 'North', 'South', 'West'];
const BODY = { QB: [73, 78, 215, 240], RB: [68, 72, 195, 225], FB: [71, 74, 235, 255], WR: [69, 77, 180, 220], TE: [75, 79, 240, 265], OT: [76, 80, 305, 330], OG: [75, 78, 305, 330], C: [74, 77, 295, 315], DE: [75, 79, 255, 285], DT: [73, 77, 295, 335], LB: [72, 76, 228, 250], CB: [69, 74, 180, 200], S: [70, 74, 195, 215], K: [70, 75, 185, 215], P: [72, 77, 200, 225] };
const JERSEY = { QB: [1, 19], RB: [20, 39], FB: [40, 49], WR: [10, 19], TE: [80, 89], OT: [60, 79], OG: [60, 79], C: [50, 69], DE: [90, 99], DT: [90, 99], LB: [40, 59], CB: [20, 39], S: [20, 39], K: [1, 9], P: [1, 9] };
const FALLBACK = { QB: ['RB', 'WR'], RB: ['FB', 'WR', 'TE'], FB: ['TE', 'RB', 'OG'], WR: ['TE', 'RB', 'CB'], TE: ['FB', 'WR', 'OT'], OT: ['OG', 'C', 'DE'], OG: ['C', 'OT', 'DT'], C: ['OG', 'OT'], DE: ['LB', 'DT'], DT: ['DE', 'LB'], LB: ['S', 'DE'], CB: ['S', 'WR'], S: ['CB', 'LB'], K: ['P'], P: ['K'] };
const SKIN = ['#f9dcc4', '#f1c7a3', '#e3ad85', '#d29a6c', '#bd8152', '#a06a40', '#87532f', '#6a3f22', '#4f2d18', '#3d2213', '#f3d0b8', '#c99570', '#d6ae86', '#8e5a36', '#2f1b10'];
const HAIRC = ['#16110e', '#2d1d13', '#4e3220', '#7b5230', '#a8783f', '#d6b06a', '#e9dfc4', '#8c3218', '#5a5a5a', '#c9c9c9', '#e3cf98'];
const EYEC = ['#3b2416', '#5a3a1f', '#6b4e2a', '#3f6b8f', '#4c7a4a', '#2b1a10'];
// ---------- player look (lk) gear + detail fields, shared by the 3D models and the portraits ----------
// lv 3 fields (filled from a seeded hash of the player id when missing, so old saves keep their look and gain the new detail):
//  bt build within the position 0 lean / 1 athletic / 2 thick      ex expression 0 neutral / 1 intense / 2 confident / 3 friendly
//  eb eye black 0 none / 1 grease / 2 strip / 3 long streak (shown when ey)   ns nose strip   fr freckles   sc scar 0/1 brow/2 cheek   er earrings 0/1/2
//  hx hair out of the helmet 0 none / 1 locs / 2 braids / 3 flow / 4 curls / 5 tied locs     ht dyed tips 0 / 1 blond / 2 copper
//  fm facemask (index into LK_MASKS)   vz visor (0 none) + vt tint (index into LK_VISOR)   mg mouthguard 0 / 1 hanging / 2 in mouth + mgc colour
//  aL, aR arm sleeve 0 bare / 1 full / 2 elbow / 3 half (elbow down)   ac sleeve colour 0 black / 1 white / 2 jersey / 3 trim
//  wL, wR wrist 0 bare / 1 tape / 2 band   wc band colour (as ac, 0 white / 1 black)   gl gloves 0 kit / 1 black / 2 white / 3 jersey / 4 trim / 5 bare hands
//  ep elbow pads, kb knee brace: 0 none / 1 left / 2 right / 3 both     tat + ta arm tattoo 1 left / 2 right / 3 both
//  nr neck roll (non-linemen; linemen pads always have one) + nrc colour 0 dark / 1 jersey / 2 white / 3 trim
//  tw towel 0 / 1 left / 2 right + twc 0 white / 1 jersey / 2 trim / 3 black     hw hand warmer     sp ankles 0 plain / 1 white spats / 2 black spats / 3 ankle tape / 4 team spats
//  clc cleats 0 kit / 1 black / 2 white / 3 jersey / 4 trim
const LK_MASKS = ['2bar', 'bullet', 'opo', 'egop', 'ropo', 'cage', 'bigcage', 'robo'];
const LK_VISOR = ['clear', 'smoke', 'gold', 'black', 'blue'];
const LK_FMW = { K: [0, .7, 1, .2, 2, .1], P: [0, .7, 1, .2, 2, .1], QB: [2, .45, 0, .2, 1, .15, 3, .2], WR: [1, .35, 3, .25, 0, .2, 2, .2], CB: [1, .35, 3, .3, 2, .2, 0, .15], S: [3, .35, 2, .25, 1, .2, 4, .2],
  RB: [4, .35, 3, .25, 2, .2, 5, .2], FB: [5, .35, 4, .35, 3, .15, 6, .15], TE: [5, .35, 4, .35, 3, .15, 6, .15], LB: [5, .35, 4, .3, 3, .15, 6, .2], OT: [6, .5, 5, .25, 7, .25], OG: [6, .5, 5, .25, 7, .25], C: [6, .5, 5, .25, 7, .25],
  DE: [6, .35, 7, .2, 5, .25, 4, .2], DT: [6, .35, 7, .3, 5, .25, 4, .1] };
function LK_grp(pos) { return { OT: 'OL', OG: 'OL', C: 'OL', DE: 'DL', DT: 'DL', WR: 'SK', CB: 'SK', S: 'SK', K: 'K', P: 'K', TE: 'TE', FB: 'TE', RB: 'RB', LB: 'LB' }[pos] || 'QB'; }
function LK_pick(u, a) { let t = 0; for (let i = 1; i < a.length; i += 2) t += a[i]; u *= t; for (let i = 0; i < a.length; i += 2) { u -= a[i + 1]; if (u < 0) return a[i]; } return a[a.length - 2]; }
function LK_seed(p) { if (p && p.id != null && !p.coach) return (p.id | 0) * 7919 + 17; const l = (p && p.lk) || {}; return ((l.sk | 0) * 131 + (l.hs | 0) * 977 + (l.hc | 0) * 31 + (l.head | 0) * 7 + (l.bd | 0) * 3571 + (l.jaw | 0) * 211 + (l.nose | 0) * 89 + (l.ec | 0) * 13 + (l.eye | 0) * 5) | 0; }
// fills every missing lv-3 field; each field always consumes the same draws, so a value never depends on which fields were already there
function LK_fill(lk, seed, pos) {
  if (lk.lv === 3) return lk;
  const r = seededRng(Math.imul((seed | 0) + 0x51ed, 2654435761) >>> 0), g = LK_grp(pos), set = (k, v) => { if (lk[k] == null) lk[k] = v; };
  const line = g === 'OL' || g === 'DL', skill = g === 'SK' || g === 'RB', rate = (o, d) => (o[g] != null ? o[g] : d || 0);
  { const a = r(); set('bt', LK_pick(a, g === 'SK' || g === 'K' ? [0, .45, 1, .42, 2, .13] : line ? [0, .2, 1, .4, 2, .4] : [0, .3, 1, .45, 2, .25])); }
  { const a = r(), b = r(); set('ey', a < rate({ SK: .45, RB: .5, LB: .4, QB: .3, TE: .35, OL: .15, DL: .3, K: .08 }) ? 1 : 0); set('eb', lk.ey ? LK_pick(b, [1, .45, 2, .35, 3, .2]) : 0); }
  { const a = r(); set('ns', a < (line ? .12 : .06) ? 1 : 0); }
  { const a = r(); set('ex', LK_pick(a, [0, .4, 1, .3, 2, .15, 3, .15])); }
  { const a = r(); set('fr', [0, 1, 2, 10].includes(lk.sk) && a < .2 ? 1 : 0); }
  { const a = r(), hs = lk.hs; set('hx', hs === 4 || hs === 25 ? 1 : hs === 18 ? 2 : hs === 5 || hs === 10 || hs === 23 ? 3 : (hs === 7 || hs === 13 || hs === 20 || hs === 17) && a < .5 ? 4 : hs === 22 ? 5 : 0); }
  { const a = r(), b = r(); set('ht', lk.hx && lk.hx !== 3 && a < .2 ? (b < .7 ? 1 : 2) : 0); }
  { const a = r(); set('fm', LK_pick(a, LK_FMW[pos] || LK_FMW.QB)); }
  { const a = r(), b = r(); set('vz', a < rate({ SK: .3, RB: .26, LB: .24, QB: .16, TE: .14, OL: .1, DL: .16, K: .06 }) ? 1 : 0); set('vt', LK_pick(b, [0, .28, 1, .32, 2, .12, 3, .13, 4, .15])); }
  { const a = r(), b = r(), c = r(); set('mg', a < rate({ SK: .35, RB: .4, LB: .4, QB: .1, TE: .3, OL: .22, DL: .35, K: .04 }) ? (b < .55 ? 1 : 2) : 0); set('mgc', LK_pick(c, [0, .35, 1, .25, 2, .25, 3, .15])); }
  { const a = r(), b = r(), c = r(); let L = 0, Rr = 0;
    if (a < rate({ SK: .58, RB: .55, LB: .45, QB: .32, TE: .42, OL: .35, DL: .45, K: .1 })) [L, Rr] = [[1, 1], [1, 0], [0, 1], [2, 2], [3, 3], c < .5 ? [3, 0] : [0, 2]][LK_pick(b, [0, .5, 1, .12, 2, .12, 3, .1, 4, .08, 5, .08])];
    set('aL', L); set('aR', Rr); }
  { const a = r(); set('ac', LK_pick(a, [0, .4, 1, .3, 2, .15, 3, .15])); }
  { const a = r(), b = r(), c = r(), w = [0, .45, 1, .35, 2, .2]; set('wL', g === 'QB' && a < .55 ? 2 : LK_pick(b, w)); set('wR', LK_pick(c, w)); }
  { const a = r(); set('wc', LK_pick(a, [0, .4, 1, .35, 2, .15, 3, .1])); }
  { const a = r(); set('gl', LK_pick(a, g === 'K' ? [5, .6, 0, .25, 1, .15] : g === 'QB' ? [5, .45, 0, .35, 1, .1, 2, .1] : [0, .45, 1, .25, 2, .15, 3, .1, 4, .05])); }
  { const a = r(), b = r(); set('ep', a < rate({ OL: .4, DL: .3, LB: .15, TE: .15, RB: .08 }) ? LK_pick(b, [3, .5, 1, .25, 2, .25]) : 0); }
  { const a = r(), b = r(); set('tat', a < .26 ? 1 : 0); set('ta', lk.tat ? LK_pick(b, [1, .35, 2, .35, 3, .3]) : 0); }
  { const a = r(), b = r(); set('nr', !line && a < rate({ LB: .25, TE: .2, RB: .1, SK: .04 }) ? 1 : 0); set('nrc', LK_pick(b, [0, .5, 1, .25, 2, .15, 3, .1])); }
  { const a = r(), b = r(), c = r(); set('tw', a < rate({ QB: .45, RB: .3, SK: .32, TE: .25, LB: .22, OL: .4, DL: .25, K: .15 }, .2) ? (b < .5 ? 1 : 2) : 0); set('twc', LK_pick(c, [0, .65, 1, .15, 2, .1, 3, .1])); }
  { const a = r(); set('hw', a < rate({ QB: .3, SK: .1, RB: .1 }) ? 1 : 0); }
  { const a = r(), b = r(); set('kb', a < rate({ OL: .55, DL: .2, TE: .1, LB: .06 }) ? LK_pick(b, [3, .65, 1, .175, 2, .175]) : 0); }
  { const a = r(); set('sp', LK_pick(a, skill ? [0, .42, 1, .18, 2, .1, 3, .25, 4, .05] : line ? [0, .45, 1, .1, 2, .1, 3, .35] : g === 'K' ? [0, .9, 3, .1] : [0, .5, 1, .1, 2, .1, 3, .3])); }
  { const a = r(); set('clc', LK_pick(a, [0, .45, 1, .2, 2, .2, 3, .08, 4, .07])); }
  { const a = r(); set('sc', LK_pick(a, [0, .9, 1, .06, 2, .04])); }
  { const a = r(); set('er', LK_pick(a, [0, .78, 1, .15, 2, .07])); }
  lk.lv = 3; return lk;
}

// ---------- ratings ----------
function calcOvr(p) { const w = OVR_W[p.pos]; let s = 0, t = 0; for (const k in w) { s += p.a[k] * w[k]; t += w[k]; } return Math.round(clamp(s / t, 25, 99)); }
function fmtHt(i) { return Math.floor(i / 12) + "'" + (i % 12) + '"'; }
function ensureBody(p) { if (!p.ht) { const b = BODY[p.pos] || [72, 76, 200, 240]; const u = R(); p.ht = Math.round(b[0] + u * (b[1] - b[0])); p.wt = Math.round(b[2] + (u * 0.6 + R() * 0.4) * (b[3] - b[2])); } if (p.a.jmp == null) p.a.jmp = Math.round(clamp(rnd(45, 75), 10, 99)); return p; }
function genLook(pos) {
  const big = ['OT', 'OG', 'C', 'DT', 'DE'].includes(pos), slim = ['WR', 'CB', 'K', 'P', 'S'].includes(pos);
  const sk = ri(0, SKIN.length - 1);
  let hc = sk >= 5 && sk !== 10 ? pick([0, 0, 0, 1, 1, 2]) : pick([0, 1, 2, 2, 3, 4, 5, 7, 1]); if (R() < 0.05) hc = pick([8, 9, 6, 10, 10]);
  const lk = { sk, hs: ri(0, 25), head: ri(0, 5), eye: pick([0, 0, 1, 2]), bw: ri(0, 2), ear: R() < .3 ? 1 : 0, hc, bd: pick([0, 0, 0, 1, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 9, 10]), bl: big ? 2 : slim ? 0 : (R() < .6 ? 1 : pick([0, 2])),
    hb: R() < .12 ? 1 : 0, ec: sk < 4 && R() < .35 ? ri(3, 4) : pick([0, 1, 2, 5]), jaw: ri(0, 2), nose: ri(0, 2), mo: ri(0, 4), v: 2 };
  return LK_fill(lk, ri(1, 2147483646), pos);
}
function ensureLook(p) { if (!p.lk || p.lk.v !== 2) p.lk = genLook(p.pos || 'QB'); if (p.lk.lv !== 3) LK_fill(p.lk, LK_seed(p), p.pos); return p.lk; }
function assignTraits(p) { p.traits = []; for (const k in TRAITS) { const t = TRAITS[k]; if (t.pos.includes(p.pos) && t.req(p.a) && R() < .75 && p.traits.length < 2) p.traits.push(k); } }
// per-attribute potential ceilings
function ensurePot(p) {
  if (p.ap && p.ap.v === 1) return p.ap; const ap = { v: 1 }; const gap = Math.max(0, (p.pot || p.ovr) - p.ovr); const prof = POS_PROFILE[p.pos] || {};
  for (const k of ATTRS) { const v = p.a[k] ?? 40; ap[k] = Math.round(clamp(v + (prof[k] !== undefined ? gap * rnd(0.6, 1.5) : gap * rnd(0, 0.35)), v, 99)); }
  p.ap = ap; return ap;
}
function genPlayer(pos, q, age) {
  const prof = POS_PROFILE[pos]; const a = {};
  for (const k of ATTRS) a[k] = prof[k] !== undefined ? Math.round(clamp(q + prof[k] + gauss() * 7, 15, 99)) : Math.round(clamp(rnd(22, 48), 10, 99));
  if (pos === 'K' || pos === 'P') { a.spd = ri(45, 65); a.tak = ri(15, 30); }
  const nm = rname();
  const p = { id: nid(), fn: nm.fn, ln: nm.ln, pos, age: age || ri(22, 33), a, ovr: 0, pot: 0, sal: 1, yrs: 1, tid: null, num: 0, traits: [],
    col: pick(COLLEGES) + ' ' + pick(['University', 'State', 'A&M', 'Tech', 'College']), st: blankStats(), car: {}, hist: [], gl: [], inj: 0, lk: genLook(pos) };
  ensureBody(p); p.ovr = calcOvr(p);
  const young = Math.max(0, 27 - p.age); p.pot = clamp(Math.round(p.ovr + young * rnd(0.4, 3.2) + (R() < 0.08 ? young * 1.6 : 0)), p.ovr, 99);
  p.dev = pick(['normal', 'normal', 'normal', 'normal', 'quick', 'slow', 'star']);   // development curve trait
  assignTraits(p); ensurePot(p); p.mor = Math.round(clamp(62 + gauss() * 9, 30, 90)); p.morLog = []; return p;
}
function salaryFor(ovr, pos, age) { let s = 0.9 + Math.pow(Math.max(0, ovr - 60), 2.2) * 0.01 * POS_PAY[pos]; if (age > 31) s *= 0.8; return Math.round(s * 10) / 10; }
function setContract(p) { p.sal = salaryFor(p.ovr, p.pos, p.age); p.yrs = p.age > 31 ? ri(1, 2) : ri(1, 5); p.base = p.sal; p.pr = 0; p.prYrs = 0; p.guar = 0; }
function blankStats() { return { gp: 0, pa: 0, pc: 0, py: 0, ptd: 0, pint: 0, ra: 0, ry: 0, rtd: 0, rec: 0, recy: 0, rectd: 0, tgt: 0, tk: 0, sk: 0, int: 0, pd: 0, ff: 0, fgm: 0, fga: 0, xpm: 0, xpa: 0, pnt: 0, pnty: 0, fum: 0, snaps: 0 }; }
function stars(o) { const n = clamp(Math.round((o - 45) / 10), 1, 5); return '★'.repeat(n) + '☆'.repeat(5 - n); }
function pname(p) { return p ? `${p.fn} ${p.ln}` : '—'; }
