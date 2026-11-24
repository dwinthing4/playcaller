// ============================================================
//  VENUE + WEATHER: what a team's ground looks like and the conditions on game day, as pure functions of the home team,
//  the week and the year. No WebGL: the match (instant games too) and the renderer make the same call, so what you see
//  is what the physics plays in. ov = { stadium: 'dome', weather: 'snow', ... } overrides any key (T.venue, QA).
// ============================================================
const VENUE = (() => {
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const OPTS = {
  stadium: ['bowl', 'horseshoe', 'dome', 'college', 'retro'], surface: ['grass', 'turf'], mow: ['stripes', 'wide', 'checker', 'diamond', 'lengthwise', 'plain'],
  ez: ['solid', 'stripes', 'argyle', 'outline', 'script'], ezText: ['name', 'city', 'both'], font: ['block', 'slab', 'italic', 'tall'], border: ['white', 'color', 'line'],
  seats: ['c1', 'two', 'mixed', 'grey'], backdrop: ['city', 'hills', 'trees', 'none'], tod: ['auto', 'day', 'overcast', 'dusk', 'night'], weather: ['auto', 'clear', 'rain', 'snow'] };
const ovOf = (T, ov) => Object.assign({}, (T && T.venue) || {}, ov || {});
// the ground: stadium, surface and all the paint (picked from the team, so old saves get one too)
function of(T, ovIn) {
  const r = rngOf(hashS('venue|' + (T.city || '') + '|' + (T.name || '') + '|' + T.id)), q = Array.from({ length: 20 }, r);
  const ov = ovOf(T, ovIn), ch = (k, i, list) => (ov[k] != null && ov[k] !== 'auto' ? ov[k] : list[Math.min(list.length - 1, Math.floor(q[i] * list.length))]);
  // the city decides the roof and the surface (src/league/15_geo.js): domes and retractable roofs get the roofed ground, the paint stays the team's
  const geo = typeof geoTeam === 'function' ? geoTeam(T) : null, gr = geo ? geo.roof : null;
  const v = {}; v.stadium = ch('stadium', 0, gr === 'dome' || gr === 'retract' ? ['dome'] : gr ? ['bowl', 'bowl', 'horseshoe', 'horseshoe', 'college', 'college', 'retro', 'retro'] : ['bowl', 'bowl', 'horseshoe', 'horseshoe', 'dome', 'college', 'college', 'retro', 'retro']); const S = v.stadium;
  v.roof = ov.roof || (S === 'dome' ? (gr === 'retract' ? 'retract' : 'dome') : 'open');
  v.surface = ch('surface', 1, geo ? [geo.surf] : S === 'dome' ? ['turf'] : S === 'bowl' ? ['grass', 'grass', 'turf'] : ['grass', 'grass', 'grass', 'turf']);
  v.alt = ov.alt != null ? +ov.alt : geo ? geo.alt : 0;
  v.mow = ch('mow', 2, v.surface === 'turf' ? ['stripes', 'wide', 'plain', 'stripes'] : ['stripes', 'stripes', 'wide', 'checker', 'diamond', 'lengthwise']);
  v.grass = ov.grass != null ? ov.grass : Math.floor(q[3] * 4);
  v.ez = ch('ez', 4, S === 'college' ? ['stripes', 'argyle', 'outline', 'script', 'solid'] : ['solid', 'solid', 'stripes', 'argyle', 'outline', 'script']);
  v.ezText = ch('ezText', 5, ['name', 'name', 'city', 'both']);
  v.font = ch('font', 6, S === 'college' ? ['slab', 'slab', 'italic', 'block'] : S === 'retro' ? ['slab', 'block', 'tall'] : ['block', 'block', 'tall', 'italic', 'slab']);
  v.nums = ch('nums', 7, S === 'college' ? ['outline', 'plain'] : ['plain', 'plain', 'outline']);
  v.border = ch('border', 8, S === 'college' ? ['color', 'line', 'white'] : S === 'retro' ? ['white', 'line'] : ['white', 'white', 'color']);
  v.logo = ch('logo', 9, ['plain', 'ring', 'big', 'plain']);
  v.seats = ch('seats', 10, S === 'retro' ? ['mixed', 'c1', 'grey'] : S === 'college' ? ['grey', 'c1'] : ['c1', 'c1', 'two', 'grey']);
  v.backdrop = ch('backdrop', 11, S === 'dome' ? ['none'] : S === 'college' ? ['trees', 'hills', 'trees'] : S === 'bowl' ? ['city', 'hills'] : ['city', 'city', 'hills']);
  v.led = ov.led != null ? !!ov.led : q[12] < (S === 'retro' || S === 'college' ? 0.3 : 0.9);
  v.posts = ch('posts', 13, S === 'college' ? ['yellow', 'white', 'yellow'] : ['yellow']);
  v.wall = ch('wall', 14, ['c1', 'c1', 'dark', 'c2']);
  v.open = ch('open', 15, ['z1', 'z0']);           // horseshoe: which end is open
  v.track = ov.track != null ? !!ov.track : S === 'college' && q[16] < 0.6;
  v.wear = ov.wear != null ? +ov.wear : v.surface === 'turf' ? 0 : 0.35 + 0.65 * q[17];
  v.seed = hashS('venue-art|' + T.id + '|' + (T.name || '') + '|' + S);
  v.sig = JSON.stringify(v);
  return v;
}
const weekOf = lg => (lg ? (lg.phase === 'playoffs' ? 18 + ((lg.playoff && lg.playoff.round) | 0) : lg.week | 0) : 0);
/// game day: time of day, weather, wind and temperature, from the home city's climate and the date (src/league/15_geo.js):
// snow late in the season in cold open-air cities, heat early in the South, rain in the Northwest, nothing under a roof.
// A retractable roof closes for rain, snow, cold, heat or a gale. The time of day follows the schedule slot (g.slot) when the
// game has one. g: the game (default: the one this team hosts this week, which is also what the renderer finds).
// wind: { mph, dir } with dir the angle it blows TOWARD in the field frame (0 = toward the end the home team attacks in the 1st quarter, +PI/2 = toward the offense's left)
function atmo(T, v, lg, ovIn, gIn) {
  const wk = weekOf(lg);
  const r = rngOf(hashS('atmo|' + T.id + '|' + wk + '|' + (lg ? lg.year : 0))), x = r(), w = r(), ov = ovOf(T, ovIn);
  const geo = typeof geoTeam === 'function', g = gIn !== undefined ? gIn : geo ? geoCurGame(lg, T.id) : null;
  const place = geo ? (g && g.site && geoSite(g.site)) || geoTeam(T) : null, d = geo ? geoDate(lg ? lg.year : 2026, wk) : null;
  const kick = place && g && g.slot ? geoKick(g, place, d) : null;
  let tod;
  if (kick) { const h = kick.local, m = d.getUTCMonth(), dark = m >= 10 || m <= 1; tod = h >= 18.5 ? 'night' : h >= 15.5 ? (dark || x < 0.4 ? 'dusk' : 'day') : 'day'; if (tod === 'day' && x > 0.86) tod = 'overcast'; }
  else { tod = x < 0.34 ? 'day' : x < 0.47 ? 'overcast' : x < 0.69 ? 'dusk' : 'night'; if (wk >= 18 && tod === 'overcast') tod = 'night'; }   // playoff football: more of it under the lights
  if (ov.tod && ov.tod !== 'auto' && ov.tod !== 'dome') tod = ov.tod;
  const hour = kick ? kick.local : { day: 13.5, overcast: 13.5, dusk: 16.5, night: 20 }[tod] || 14, cl = place ? geoClimate(place, d, hour) : null;
  let weather = 'clear';
  if (cl) { if (w < cl.snow) weather = 'snow'; else if (w > 1 - cl.rain) weather = 'rain'; }
  else if (wk >= 12 && w < 0.2 && tod !== 'dusk') weather = 'snow'; else if (w > 0.92 && tod !== 'day') weather = 'rain';
  if (ov.weather && ov.weather !== 'auto') weather = ov.weather;
  if (weather !== 'clear' && tod === 'day') tod = 'overcast'; if (weather === 'snow' && tod === 'dusk') tod = 'night';
  // wind and temperature come from their own stream
  const r2 = rngOf(hashS('wx|' + T.id + '|' + wk + '|' + (lg ? lg.year : 0))), clim = rngOf(hashS('clim|' + T.id + '|' + (T.city || '')))();
  const u = r2(); let mph = u < 0.35 ? u / 0.35 * 5 : u < 0.8 ? 5 + (u - 0.35) / 0.45 * 7 : 12 + (u - 0.8) / 0.2 * 12;
  if (weather !== 'clear') mph += 3 + r2() * 6;
  mph *= (v.stadium === 'horseshoe' || v.stadium === 'college' ? 1.15 : v.stadium === 'bowl' ? 0.85 : 1) * (place ? 0.7 + 0.6 * place.wind : 1);
  if (ov.wind != null) mph = +ov.wind;
  const dir = ov.windDir != null ? +ov.windDir : r2() * Math.PI * 2, late = Math.min(1, wk / 17);
  let temp = cl ? cl.t + (r2() - 0.5) * 10 : 82 - 46 * Math.pow(late, 1.15) - (wk >= 18 ? 4 : 0) + (clim - 0.5) * 28 + (r2() - 0.5) * 10 + (tod === 'night' ? -6 : tod === 'dusk' ? -3 : tod === 'day' ? 3 : 0);
  if (weather === 'snow') temp = Math.min(temp, 20 + r2() * 12); else if (weather === 'rain') temp = Math.max(temp, 38 + r2() * 8);
  if (ov.temp != null) temp = +ov.temp;
  // under a roof: a fixed dome always, a retractable one when the day is bad
  const roof = v.roof || (v.stadium === 'dome' ? 'dome' : 'open'), bad = weather !== 'clear' || temp < 55 || temp > 86 || mph > 18;
  const closed = ov.roofOpen != null && roof === 'retract' ? !ov.roofOpen : roof === 'dome' || (roof === 'retract' && bad) || (v.stadium === 'dome' && roof === 'open');
  const out = { tod, weather, wk, late, az: r(), el: r(), tgt: r(), roof, closed, roofOpen: roof === 'retract' && !closed, alt: v.alt || 0, place: place ? place.name : T.city || '', slot: kick ? kick.slot : null };
  if (closed) { out.tod = 'dome'; out.weather = 'clear'; out.wind = { mph: 0, dir: 0 }; out.temp = 70; out.outside = { weather, temp: Math.round(temp) }; return out; }
  out.wind = { mph: Math.round(Math.max(0, mph)), dir }; out.temp = Math.round(temp);
  return out;
}
// what the match needs: one call, no renderer. dome = played under a closed roof (no wind or weather, louder crowd)
function today(home, lg, ovIn, g) { const v = of(home, ovIn), a = atmo(home, v, lg, ovIn, g); return { tod: a.tod, weather: a.weather, wind: a.wind, temp: a.temp, dome: a.closed, stadium: v.stadium, wk: a.wk, roof: a.roof, roofOpen: a.roofOpen, alt: a.alt, surface: v.surface, place: a.place, outside: a.outside || null }; }
return { hashS, rngOf, OPTS, of, atmo, today, weekOf };
})();
