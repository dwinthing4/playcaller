// ============================================================
//  GEOGRAPHY: where every team plays (fictional and real-cities leagues), what its ground is like (roof, grass or turf,
//  altitude), the climate that sets game-day weather (src/core/30_venue.js reads it), travel distance and time zones
//  (road-trip stamina in src/league/25_rotation.js, geoTravelEdge for the fast sim), and where players come from:
//  fictional colleges get a home town inside the right scouting region, every player gets a hometown.
//  Pure data + functions, no DOM (it is in dist/sim.cjs). The map screen is src/ui/65_map.js.
//  Built to be reused by a college mode: geoCollege / geoHome / geoPipeline work on any player list (recruits too).
// ============================================================

// city: [lat, lon, state, tz, roof, surface, altitude ft, Sep high °F, Jan high °F, rain early, rain late, snowiness 0..1, windiness 0..1]
//   roof: 'open' | 'dome' (fixed) | 'retract' (closed for bad weather)   rain: chance a game day is wet (Sep / Dec-Jan)
const GEO_CITY = {
  // the fictional league (R_CITIES in 10_data.js)
  'Portland': [45.52, -122.68, 'OR', 'P', 'open', 'turf', 50, 76, 47, .12, .45, .1, .3],
  'Austin': [30.27, -97.74, 'TX', 'C', 'open', 'grass', 490, 91, 62, .15, .15, 0, .3],
  'San Antonio': [29.42, -98.49, 'TX', 'C', 'dome', 'turf', 650, 90, 63, .15, .12, 0, .3],
  'Omaha': [41.26, -95.94, 'NE', 'C', 'open', 'grass', 1090, 79, 33, .15, .12, .6, .6],
  'Memphis': [35.15, -90.05, 'TN', 'C', 'open', 'grass', 340, 86, 51, .15, .22, .08, .35],
  'Louisville': [38.25, -85.76, 'KY', 'E', 'open', 'turf', 470, 82, 43, .18, .25, .25, .35],
  'Columbus': [39.96, -83.0, 'OH', 'E', 'open', 'grass', 780, 78, 36, .17, .25, .45, .4],
  'Sacramento': [38.58, -121.49, 'CA', 'P', 'open', 'grass', 30, 89, 54, .02, .28, 0, .3],
  'Birmingham': [33.52, -86.81, 'AL', 'C', 'open', 'grass', 600, 87, 54, .15, .25, .05, .25],
  'Salt Lake': [40.76, -111.89, 'UT', 'M', 'open', 'turf', 4230, 80, 38, .08, .15, .7, .35],
  'Albuquerque': [35.08, -106.65, 'NM', 'M', 'open', 'grass', 5310, 82, 48, .1, .08, .25, .5],
  'Tulsa': [36.15, -95.99, 'OK', 'C', 'open', 'turf', 720, 85, 48, .17, .15, .2, .55],
  'Raleigh': [35.78, -78.64, 'NC', 'E', 'open', 'grass', 315, 83, 51, .2, .2, .12, .3],
  'Boise': [43.62, -116.2, 'ID', 'M', 'open', 'turf', 2730, 81, 38, .05, .2, .5, .35],
  'Anchorage': [61.22, -149.9, 'AK', 'AK', 'dome', 'turf', 100, 55, 23, .3, .3, .9, .4],
  'Honolulu': [21.31, -157.86, 'HI', 'HI', 'open', 'turf', 20, 88, 80, .15, .25, 0, .45],
  'Orlando': [28.54, -81.38, 'FL', 'E', 'open', 'grass', 90, 90, 72, .35, .12, 0, .3],
  'Richmond': [37.54, -77.44, 'VA', 'E', 'open', 'grass', 160, 82, 48, .2, .2, .2, .3],
  'Milwaukee': [43.04, -87.91, 'WI', 'C', 'retract', 'grass', 620, 74, 29, .17, .2, .8, .6],
  'Oklahoma': [35.47, -97.52, 'OK', 'C', 'retract', 'turf', 1200, 85, 50, .17, .12, .2, .65],
  'Spokane': [47.66, -117.43, 'WA', 'P', 'open', 'turf', 1900, 76, 35, .08, .25, .7, .35],
  'Fresno': [36.74, -119.79, 'CA', 'P', 'open', 'grass', 300, 92, 55, .01, .2, 0, .25],
  'Toledo': [41.65, -83.54, 'OH', 'E', 'open', 'turf', 600, 77, 33, .18, .25, .65, .55],
  'Hartford': [41.76, -72.67, 'CT', 'E', 'open', 'turf', 60, 77, 35, .2, .25, .6, .4],
  'Charleston': [32.78, -79.93, 'SC', 'E', 'open', 'grass', 20, 85, 60, .25, .15, .02, .35],
  'Savannah': [32.08, -81.09, 'GA', 'E', 'open', 'grass', 20, 87, 61, .25, .15, .01, .3],
  'Reno': [39.53, -119.81, 'NV', 'P', 'open', 'turf', 4500, 83, 46, .03, .12, .4, .5],
  'El Paso': [31.76, -106.49, 'TX', 'M', 'open', 'turf', 3740, 89, 58, .1, .06, .05, .5],
  'Tucson': [32.22, -110.97, 'AZ', 'AZ', 'retract', 'grass', 2400, 98, 66, .1, .06, 0, .3],
  'Wichita': [37.69, -97.34, 'KS', 'C', 'open', 'turf', 1300, 83, 41, .15, .12, .35, .8],
  'Mobile': [30.69, -88.04, 'AL', 'C', 'open', 'grass', 10, 88, 61, .3, .25, .01, .35],
  'Montreal': [45.5, -73.57, 'QC', 'E', 'dome', 'turf', 100, 70, 21, .25, .25, 1, .45],
  // older saves split three two-word cities into single words ("San", "Antonio" ...): each half gets a nearby home
  'San': [29.42, -98.49, 'TX', 'C', 'dome', 'turf', 650, 90, 63, .15, .12, 0, .3, 'San Antonio'],
  'Antonio': [29.7, -98.12, 'TX', 'C', 'open', 'grass', 650, 90, 63, .15, .12, 0, .3, 'New Braunfels'],
  'Salt': [40.76, -111.89, 'UT', 'M', 'open', 'turf', 4230, 80, 38, .08, .15, .7, .35, 'Salt Lake City'],
  'Lake': [41.22, -111.97, 'UT', 'M', 'open', 'grass', 4300, 79, 37, .08, .15, .7, .35, 'Ogden'],
  'El': [31.76, -106.49, 'TX', 'M', 'open', 'turf', 3740, 89, 58, .1, .06, .05, .5, 'El Paso'],
  'Paso': [32.32, -106.76, 'NM', 'M', 'open', 'grass', 3900, 88, 57, .1, .06, .05, .45, 'Las Cruces'],
};
// the real-cities league: each market's actual stadium (same order as REAL_TEAMS in 12_real.js, so team id = index)
const GEO_REAL = {
  BUF: [42.77, -78.79, 'NY', 'E', 'open', 'grass', 600, 72, 31, .2, .3, 1, .7, 'Orchard Park'],
  MIA: [25.96, -80.24, 'FL', 'E', 'open', 'grass', 10, 89, 76, .3, .12, 0, .35, 'Miami Gardens'],
  NE: [42.09, -71.26, 'MA', 'E', 'open', 'turf', 290, 75, 35, .2, .25, .75, .55, 'Foxborough'],
  NYJ: [40.81, -74.07, 'NJ', 'E', 'open', 'turf', 10, 77, 39, .2, .25, .5, .6, 'East Rutherford'],
  BAL: [39.28, -76.62, 'MD', 'E', 'open', 'grass', 30, 80, 43, .2, .22, .35, .4, 'Baltimore'],
  CIN: [39.1, -84.52, 'OH', 'E', 'open', 'turf', 490, 81, 40, .17, .25, .4, .35, 'Cincinnati'],
  CLE: [41.51, -81.7, 'OH', 'E', 'open', 'grass', 580, 75, 34, .18, .3, .8, .7, 'Cleveland'],
  PIT: [40.45, -80.02, 'PA', 'E', 'open', 'grass', 730, 76, 36, .2, .3, .6, .4, 'Pittsburgh'],
  HOU: [29.68, -95.41, 'TX', 'C', 'retract', 'turf', 50, 90, 64, .2, .15, 0, .35, 'Houston'],
  IND: [39.76, -86.16, 'IN', 'E', 'retract', 'turf', 715, 80, 36, .17, .25, .55, .45, 'Indianapolis'],
  JAX: [30.32, -81.64, 'FL', 'E', 'open', 'grass', 15, 87, 65, .3, .15, 0, .4, 'Jacksonville'],
  TEN: [36.17, -86.77, 'TN', 'C', 'open', 'turf', 400, 84, 48, .17, .22, .15, .3, 'Nashville'],
  DEN: [39.74, -105.02, 'CO', 'M', 'open', 'grass', 5280, 80, 45, .1, .1, .75, .45, 'Denver'],
  KC: [39.05, -94.48, 'MO', 'C', 'open', 'grass', 800, 81, 39, .17, .15, .45, .6, 'Kansas City'],
  LV: [36.09, -115.18, 'NV', 'P', 'dome', 'grass', 2030, 95, 58, .02, .05, 0, .3, 'Las Vegas'],
  LAC: [33.95, -118.34, 'CA', 'P', 'dome', 'turf', 100, 83, 68, .02, .15, 0, .25, 'Inglewood'],
  DAL: [32.75, -97.09, 'TX', 'C', 'retract', 'turf', 600, 91, 57, .15, .15, .05, .45, 'Arlington'],
  NYG: [40.81, -74.07, 'NJ', 'E', 'open', 'turf', 10, 77, 39, .2, .25, .5, .6, 'East Rutherford'],
  PHI: [39.9, -75.17, 'PA', 'E', 'open', 'grass', 30, 79, 41, .2, .25, .4, .45, 'Philadelphia'],
  WAS: [38.91, -76.86, 'MD', 'E', 'open', 'grass', 100, 82, 44, .2, .22, .3, .35, 'Landover'],
  CHI: [41.86, -87.62, 'IL', 'C', 'open', 'grass', 600, 76, 32, .17, .25, .75, .95, 'Chicago'],
  DET: [42.34, -83.05, 'MI', 'E', 'dome', 'turf', 600, 75, 32, .17, .25, .7, .5, 'Detroit'],
  GB: [44.5, -88.06, 'WI', 'C', 'open', 'grass', 640, 71, 24, .17, .22, .9, .6, 'Green Bay'],
  MIN: [44.97, -93.26, 'MN', 'C', 'dome', 'turf', 830, 73, 23, .15, .2, .95, .5, 'Minneapolis'],
  ATL: [33.76, -84.4, 'GA', 'E', 'retract', 'turf', 1000, 84, 53, .17, .25, .08, .3, 'Atlanta'],
  CAR: [35.23, -80.85, 'NC', 'E', 'open', 'turf', 750, 84, 51, .17, .2, .1, .3, 'Charlotte'],
  NO: [29.95, -90.08, 'LA', 'C', 'dome', 'turf', 5, 88, 63, .3, .25, 0, .35, 'New Orleans'],
  TB: [27.98, -82.5, 'FL', 'E', 'open', 'grass', 30, 90, 71, .35, .12, 0, .35, 'Tampa'],
  ARI: [33.53, -112.26, 'AZ', 'AZ', 'retract', 'grass', 1100, 100, 67, .05, .07, 0, .3, 'Glendale'],
  LAR: [33.95, -118.34, 'CA', 'P', 'dome', 'turf', 100, 83, 68, .02, .15, 0, .25, 'Inglewood'],
  SF: [37.4, -121.97, 'CA', 'P', 'open', 'grass', 30, 82, 59, .02, .25, 0, .4, 'Santa Clara'],
  SEA: [47.6, -122.33, 'WA', 'P', 'open', 'turf', 20, 71, 48, .15, .5, .12, .35, 'Seattle'],
};
// neutral sites for international games (g.site = one of these names, any case)
const GEO_SITE = {
  'London': [51.51, -0.13, 'UK', 'GMT', 'retract', 'grass', 100, 68, 46, .3, .4, .05, .4],
  'Dublin': [53.34, -6.26, 'IE', 'GMT', 'open', 'grass', 30, 63, 46, .35, .45, .05, .55],
  'Munich': [48.22, 11.62, 'DE', 'CET', 'open', 'grass', 1700, 67, 37, .3, .3, .4, .3],
  'Frankfurt': [50.07, 8.65, 'DE', 'CET', 'retract', 'grass', 330, 70, 40, .25, .3, .2, .3],
  'Berlin': [52.51, 13.24, 'DE', 'CET', 'open', 'grass', 160, 68, 37, .25, .3, .3, .35],
  'Madrid': [40.45, -3.69, 'ES', 'CET', 'retract', 'grass', 2130, 80, 50, .1, .2, .02, .3],
  'Paris': [48.92, 2.36, 'FR', 'CET', 'open', 'grass', 120, 70, 44, .25, .3, .1, .35],
  'Mexico City': [19.3, -99.15, 'MX', 'MX', 'open', 'grass', 7350, 73, 70, .45, .05, 0, .25],
  'Sao Paulo': [-23.55, -46.63, 'BR', 'BRT', 'open', 'grass', 2600, 77, 82, .25, .4, 0, .25],
  'Toronto': [43.64, -79.39, 'ON', 'E', 'retract', 'turf', 250, 71, 30, .2, .25, .7, .45],
  'Melbourne': [-37.82, 144.98, 'AU', 'AEST', 'open', 'grass', 100, 63, 79, .2, .15, 0, .45],
};
// time zones: [standard UTC offset, daylight time rule]
const GEO_TZ = { E: [-5, 'us'], C: [-6, 'us'], M: [-7, 'us'], P: [-8, 'us'], AZ: [-7, 0], AK: [-9, 'us'], HI: [-10, 0], GMT: [0, 'eu'], CET: [1, 'eu'], MX: [-6, 0], BRT: [-3, 0], AEST: [10, 'au'] };
const GEO_TZ_NAME = { E: 'Eastern', C: 'Central', M: 'Mountain', P: 'Pacific', AZ: 'Arizona', AK: 'Alaska', HI: 'Hawaii', GMT: 'UK', CET: 'Central Europe', MX: 'Mexico', BRT: 'Brazil', AEST: 'Australia' };

// ---------- states, scouting regions, college towns ----------
// SCOUT_REGIONS (60_staff.js): Northeast, Southeast, Midwest, Southwest, West Coast
const GEO_REGION_STATES = {
  'Northeast': 'ME NH VT MA RI CT NY NJ PA DE MD VA WV',
  'Southeast': 'NC SC GA FL AL MS TN KY LA AR',
  'Midwest': 'OH MI IN IL WI MN IA MO ND SD NE KS',
  'Southwest': 'TX OK NM AZ CO UT NV',
  'West Coast': 'CA OR WA ID MT WY AK HI',
};
const GEO_STATE_REGION = {}; for (const r in GEO_REGION_STATES) for (const s of GEO_REGION_STATES[r].split(' ')) GEO_STATE_REGION[s] = r;
GEO_STATE_REGION.QC = 'Northeast'; GEO_STATE_REGION.ON = 'Midwest';
// where a region's scout is based (the map pin and the start of his trips)
const GEO_REGION_HUB = { 'Northeast': [40.3, -76.6, 'Harrisburg, PA'], 'Southeast': [33.6, -85.6, 'Anniston, AL'], 'Midwest': [41.6, -90.6, 'Davenport, IA'], 'Southwest': [32.9, -100.9, 'Snyder, TX'], 'West Coast': [41.2, -118.6, 'Winnemucca, NV'] };
// towns per state (college towns and big cities): hometowns and college homes are picked from these. [name, lat, lon]
const GEO_TOWNS = {
  AL: [['Tuscaloosa', 33.21, -87.57], ['Auburn', 32.61, -85.48], ['Mobile', 30.69, -88.04], ['Huntsville', 34.73, -86.59], ['Montgomery', 32.37, -86.3]],
  AK: [['Anchorage', 61.22, -149.9], ['Fairbanks', 64.84, -147.72]],
  AZ: [['Tempe', 33.43, -111.94], ['Tucson', 32.22, -110.97], ['Flagstaff', 35.2, -111.65], ['Phoenix', 33.45, -112.07]],
  AR: [['Fayetteville', 36.06, -94.16], ['Little Rock', 34.75, -92.29], ['Jonesboro', 35.84, -90.7]],
  CA: [['Berkeley', 37.87, -122.27], ['Los Angeles', 34.05, -118.25], ['San Diego', 32.72, -117.16], ['Fresno', 36.74, -119.79], ['Palo Alto', 37.44, -122.14], ['Sacramento', 38.58, -121.49], ['Long Beach', 33.77, -118.19], ['San Jose', 37.34, -121.89], ['Bakersfield', 35.37, -119.02]],
  CO: [['Boulder', 40.01, -105.27], ['Fort Collins', 40.59, -105.08], ['Colorado Springs', 38.83, -104.82], ['Denver', 39.74, -104.99]],
  CT: [['Storrs', 41.81, -72.25], ['New Haven', 41.31, -72.92]],
  DE: [['Newark', 39.68, -75.75], ['Dover', 39.16, -75.52]],
  FL: [['Gainesville', 29.65, -82.32], ['Tallahassee', 30.44, -84.28], ['Miami', 25.76, -80.19], ['Orlando', 28.54, -81.38], ['Tampa', 27.95, -82.46], ['Jacksonville', 30.33, -81.66], ['Fort Lauderdale', 26.12, -80.14], ['Pensacola', 30.42, -87.22]],
  GA: [['Athens', 33.95, -83.38], ['Atlanta', 33.75, -84.39], ['Statesboro', 32.45, -81.78], ['Valdosta', 30.83, -83.28], ['Macon', 32.84, -83.63], ['Columbus', 32.46, -84.99]],
  HI: [['Honolulu', 21.31, -157.86], ['Hilo', 19.72, -155.08]],
  ID: [['Boise', 43.62, -116.2], ['Moscow', 46.73, -117.0], ['Pocatello', 42.87, -112.45]],
  IL: [['Champaign', 40.12, -88.24], ['Evanston', 42.05, -87.69], ['Chicago', 41.88, -87.63], ['Carbondale', 37.73, -89.22], ['Peoria', 40.69, -89.59]],
  IN: [['Bloomington', 39.17, -86.53], ['West Lafayette', 40.43, -86.91], ['South Bend', 41.68, -86.25], ['Indianapolis', 39.77, -86.16]],
  IA: [['Iowa City', 41.66, -91.53], ['Ames', 42.03, -93.62], ['Cedar Falls', 42.53, -92.45], ['Des Moines', 41.59, -93.62]],
  KS: [['Lawrence', 38.97, -95.24], ['Manhattan', 39.18, -96.57], ['Wichita', 37.69, -97.34]],
  KY: [['Lexington', 38.04, -84.5], ['Louisville', 38.25, -85.76], ['Bowling Green', 36.99, -86.44]],
  LA: [['Baton Rouge', 30.45, -91.15], ['New Orleans', 29.95, -90.07], ['Shreveport', 32.53, -93.75], ['Lafayette', 30.22, -92.02], ['Monroe', 32.51, -92.12]],
  ME: [['Orono', 44.88, -68.67], ['Portland', 43.66, -70.26]],
  MD: [['College Park', 38.99, -76.94], ['Baltimore', 39.29, -76.61], ['Annapolis', 38.98, -76.49]],
  MA: [['Boston', 42.36, -71.06], ['Amherst', 42.37, -72.52], ['Worcester', 42.26, -71.8]],
  MI: [['Ann Arbor', 42.28, -83.74], ['East Lansing', 42.74, -84.48], ['Detroit', 42.33, -83.05], ['Kalamazoo', 42.29, -85.59], ['Mount Pleasant', 43.6, -84.77], ['Grand Rapids', 42.96, -85.67]],
  MN: [['Minneapolis', 44.98, -93.27], ['Duluth', 46.79, -92.1], ['St. Cloud', 45.56, -94.16]],
  MS: [['Oxford', 34.37, -89.52], ['Starkville', 33.45, -88.82], ['Hattiesburg', 31.33, -89.29], ['Jackson', 32.3, -90.18]],
  MO: [['Columbia', 38.95, -92.33], ['St. Louis', 38.63, -90.2], ['Springfield', 37.21, -93.29], ['Kansas City', 39.1, -94.58]],
  MT: [['Missoula', 46.87, -114.0], ['Bozeman', 45.68, -111.04], ['Billings', 45.78, -108.5]],
  NE: [['Lincoln', 40.81, -96.7], ['Omaha', 41.26, -95.94], ['Kearney', 40.7, -99.08]],
  NV: [['Las Vegas', 36.17, -115.14], ['Reno', 39.53, -119.81]],
  NH: [['Durham', 43.13, -70.93], ['Hanover', 43.7, -72.29], ['Manchester', 42.99, -71.46]],
  NJ: [['Piscataway', 40.55, -74.46], ['Princeton', 40.35, -74.66], ['Newark', 40.74, -74.17], ['Camden', 39.93, -75.12]],
  NM: [['Albuquerque', 35.08, -106.65], ['Las Cruces', 32.32, -106.76], ['Roswell', 33.39, -104.52]],
  NY: [['Syracuse', 43.05, -76.15], ['Buffalo', 42.89, -78.88], ['Albany', 42.65, -73.75], ['New York', 40.71, -74.0], ['West Point', 41.39, -73.96], ['Rochester', 43.16, -77.61]],
  NC: [['Chapel Hill', 35.91, -79.05], ['Raleigh', 35.78, -78.64], ['Durham', 36.0, -78.9], ['Charlotte', 35.23, -80.84], ['Boone', 36.22, -81.67], ['Greenville', 35.61, -77.37], ['Winston-Salem', 36.1, -80.24]],
  ND: [['Fargo', 46.88, -96.79], ['Grand Forks', 47.93, -97.03], ['Bismarck', 46.81, -100.78]],
  OH: [['Columbus', 39.96, -83.0], ['Cincinnati', 39.1, -84.51], ['Athens', 39.33, -82.1], ['Toledo', 41.65, -83.54], ['Akron', 41.08, -81.52], ['Cleveland', 41.5, -81.69], ['Oxford', 39.51, -84.75], ['Youngstown', 41.1, -80.65]],
  OK: [['Norman', 35.22, -97.44], ['Stillwater', 36.12, -97.06], ['Tulsa', 36.15, -95.99], ['Oklahoma City', 35.47, -97.52]],
  OR: [['Eugene', 44.05, -123.09], ['Corvallis', 44.56, -123.26], ['Portland', 45.52, -122.68]],
  PA: [['State College', 40.79, -77.86], ['Pittsburgh', 40.44, -80.0], ['Philadelphia', 39.95, -75.17], ['Bethlehem', 40.63, -75.37], ['Erie', 42.13, -80.09], ['Harrisburg', 40.27, -76.88]],
  RI: [['Kingston', 41.48, -71.52], ['Providence', 41.82, -71.41]],
  SC: [['Columbia', 34.0, -81.03], ['Clemson', 34.68, -82.84], ['Charleston', 32.78, -79.93], ['Greenville', 34.85, -82.4], ['Rock Hill', 34.92, -81.03]],
  SD: [['Vermillion', 42.78, -96.93], ['Brookings', 44.31, -96.8], ['Sioux Falls', 43.55, -96.73], ['Rapid City', 44.08, -103.23]],
  TN: [['Knoxville', 35.96, -83.92], ['Nashville', 36.16, -86.78], ['Memphis', 35.15, -90.05], ['Murfreesboro', 35.85, -86.39], ['Chattanooga', 35.05, -85.31]],
  TX: [['Austin', 30.27, -97.74], ['College Station', 30.63, -96.33], ['Houston', 29.76, -95.37], ['Dallas', 32.78, -96.8], ['Fort Worth', 32.76, -97.33], ['Lubbock', 33.58, -101.86], ['Waco', 31.55, -97.15], ['San Antonio', 29.42, -98.49], ['El Paso', 31.76, -106.49], ['Denton', 33.21, -97.13], ['Beaumont', 30.08, -94.13], ['Tyler', 32.35, -95.3], ['Odessa', 31.85, -102.37], ['Corpus Christi', 27.8, -97.4], ['Amarillo', 35.22, -101.83]],
  UT: [['Salt Lake City', 40.76, -111.89], ['Provo', 40.23, -111.66], ['Logan', 41.74, -111.83], ['Cedar City', 37.68, -113.06]],
  VT: [['Burlington', 44.48, -73.21], ['Rutland', 43.61, -72.97]],
  VA: [['Charlottesville', 38.03, -78.48], ['Blacksburg', 37.23, -80.41], ['Richmond', 37.54, -77.44], ['Norfolk', 36.85, -76.29], ['Harrisonburg', 38.45, -78.87], ['Lexington', 37.78, -79.44]],
  WA: [['Seattle', 47.61, -122.33], ['Pullman', 46.73, -117.18], ['Spokane', 47.66, -117.43], ['Tacoma', 47.25, -122.44], ['Bellingham', 48.75, -122.48]],
  WV: [['Morgantown', 39.63, -79.96], ['Huntington', 38.42, -82.45], ['Charleston', 38.35, -81.63]],
  WI: [['Madison', 43.07, -89.4], ['Milwaukee', 43.04, -87.91], ['Green Bay', 44.51, -88.01], ['La Crosse', 43.8, -91.24]],
  WY: [['Laramie', 41.31, -105.59], ['Casper', 42.87, -106.31], ['Cheyenne', 41.14, -104.82]],
};
const GEO_STATE_NAME = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', QC: 'Quebec', ON: 'Ontario' };
// how much high-school football each state turns out (hometowns are drawn by this)
const GEO_TALENT = { TX: 13, FL: 11, CA: 10, GA: 8, OH: 5.5, PA: 4, LA: 4.5, AL: 4.5, NC: 4, VA: 3, SC: 3, MS: 3.5, TN: 3, NJ: 3, MI: 3, IL: 3, MD: 2.5, AZ: 2, MO: 2, OK: 2, IN: 1.5, KY: 1.5, WA: 1.5, NY: 2, CO: 1, UT: 1.2, AR: 1.5, KS: 1, MN: 1, WI: 1, IA: 1, NE: 0.7, OR: 0.8, NV: 0.7, CT: 0.6, MA: 0.8, HI: 0.8 };
// fictional college names (COLLEGES in 10_data.js): the first word says where a school can be
const GEO_COL_STATES = {
  Coastal: 'CA OR WA FL GA SC NC VA MD NJ NY MA ME TX AL MS LA CT RI DE', Northern: 'MN WI MI ND SD MT WA ID NY VT ME NH IA IL OH PA',
  Southern: 'TX LA MS AL GA FL TN AR OK SC NC KY NM AZ', Western: 'CA OR WA NV ID MT WY UT CO AZ NM KY MI PA', Eastern: 'NY PA NJ MD VA NC KY TN MI WA CT MA',
  Mountain: 'CO UT WY MT ID NM NV WV NC TN', Lakeshore: 'MI WI IL OH IN MN NY PA', Prairie: 'KS NE IA ND SD OK TX MN IL MO', Desert: 'AZ NM NV TX CA UT',
  Bayou: 'LA MS TX AL', Pine: 'GA AL NC SC ME OR WA MS AR FL', Harbor: 'MA RI CT NY NJ MD WA CA OR ME VA FL' };

// ---------- helpers ----------
function geoHash(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function geoU(s) { return geoHash(s) / 4294967296; }
function geoWPick(u, list, w) { let t = 0; for (const k of list) t += w(k); u *= t; for (const k of list) { u -= w(k); if (u < 0) return k; } return list[list.length - 1]; }
function geoPlace(key, a, kind) { return { key, kind, name: a[13] || key, st: a[2], lat: a[0], lon: a[1], tz: a[3], roof: a[4], surf: a[5], alt: a[6], sep: a[7], jan: a[8], wetE: a[9], wetL: a[10], snow: a[11], wind: a[12] }; }
// a place with no entry (a renamed city, a custom site): the climate is estimated from the latitude
function geoGuess(key, lat, lon, st) {
  const north = Math.max(0, lat - 25), tz = lon < -114 ? 'P' : lon < -101.5 ? 'M' : lon < -86.5 ? 'C' : 'E';
  return geoPlace(key, [lat, lon, st || '', tz, 'open', 'grass', 500, Math.round(95 - north * 0.95), Math.round(77 - north * 2.2), .15, .2, clamp((lat - 35) / 10, 0, 1), .4], 'guess');
}
function geoFindTown(name) { const n = String(name || '').trim().toLowerCase(); if (!n) return null; for (const st in GEO_TOWNS) for (const t of GEO_TOWNS[st]) if (t[0].toLowerCase() === n) return { st, t }; return null; }
// where a team plays. Cached on the team (T.gk) the first time, so renaming the city later does not move the stadium.
function geoTeam(T) {
  if (!T) return geoPlace('Omaha', GEO_CITY.Omaha, 'city');
  if (T.gk) { const k = T.gk; if (k.startsWith('R:') && GEO_REAL[k.slice(2)]) return geoPlace(k.slice(2), GEO_REAL[k.slice(2)], 'real'); if (k.startsWith('C:') && GEO_CITY[k.slice(2)]) return geoPlace(k.slice(2), GEO_CITY[k.slice(2)], 'city'); }
  let key = null; const LL = typeof L !== 'undefined' ? L : null;
  if (LL && LL.real && typeof REAL_TEAMS !== 'undefined' && REAL_TEAMS[T.id] && GEO_REAL[REAL_TEAMS[T.id][0]]) key = 'R:' + REAL_TEAMS[T.id][0];
  else if (GEO_CITY[T.city]) key = 'C:' + T.city;
  else if (GEO_REAL[T.abbr] && typeof REAL_TEAMS !== 'undefined' && REAL_TEAMS.some(d => d[0] === T.abbr && d[1] === T.city)) key = 'R:' + T.abbr;
  if (key) { if (LL && LL.teams && LL.teams[T.id] === T) T.gk = key; return geoTeam(Object.assign({}, T, { gk: key })); }
  const town = geoFindTown(T.city); if (town) return geoGuess(T.city, town.t[1], town.t[2], town.st);
  const keys = Object.keys(GEO_CITY).filter(k => !GEO_CITY[k][13]), k2 = keys[geoHash('team|' + T.id + '|' + T.city) % keys.length];
  return geoPlace(k2, GEO_CITY[k2], 'city');
}
// a neutral site: an international city, a league city, or any listed town
function geoSite(name) {
  if (!name) return null; const n = String(name).trim(), lo = n.toLowerCase();
  for (const k in GEO_SITE) if (k.toLowerCase() === lo) return geoPlace(k, GEO_SITE[k], 'site');
  for (const k in GEO_CITY) if (k.toLowerCase() === lo) return geoPlace(k, GEO_CITY[k], 'city');
  for (const k in GEO_REAL) if ((GEO_REAL[k][13] || '').toLowerCase() === lo) return geoPlace(k, GEO_REAL[k], 'real');
  const t = geoFindTown(n); return t ? geoGuess(t.t[0], t.t[1], t.t[2], t.st) : null;
}
// the ground a game is played on (home team's, or the neutral site)
function geoVenue(g) { const LL = typeof L !== 'undefined' ? L : null; if (!g || !LL) return null; const s = g.site ? geoSite(g.site) : null; return s || geoTeam(LL.teams[g.h]); }
function geoMiles(a, b) {
  if (!a || !b) return 0; const R = Math.PI / 180, dLat = (b.lat - a.lat) * R, dLon = (b.lon - a.lon) * R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLon / 2) ** 2; return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------- the calendar ----------
// the Sunday of a league week (0 = week 1, the Sunday after Labor Day); playoff weeks run on from the regular season
function geoDate(year, wk) {
  const y = year || 2026, d = new Date(Date.UTC(y, 8, 1)); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 6 + 7 * Math.max(0, wk | 0)); return d;
}
function geoDst(rule, d) {
  if (!rule) return false; const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (rule === 'us') { const n = new Date(Date.UTC(y, 10, 1)); while (n.getUTCDay() !== 0) n.setUTCDate(n.getUTCDate() + 1); return m >= 2 && m <= 10 && d < n; }   // until the 1st Sunday of November
  if (rule === 'eu') { const o = new Date(Date.UTC(y, 9, 31)); while (o.getUTCDay() !== 0) o.setUTCDate(o.getUTCDate() - 1); return m >= 3 && d < o; }        // until the last Sunday of October
  if (rule === 'au') return m >= 9 || m <= 2;
  return false;
}
function geoOffset(place, d) { const z = GEO_TZ[place && place.tz] || GEO_TZ.E; return z[0] + (geoDst(z[1], d) ? 1 : 0); }
// kickoff in Eastern time by schedule slot ('early','late','tnf','snf','mnf','thanksgiving','intl'); default 'early'
const GEO_SLOT_ET = { early: 13, late: 16.42, tnf: 20.25, snf: 20.33, mnf: 20.25, thanksgiving: 16.5, intl: 9.5, sat: 16.5, xmas: 16.5 };
function geoSlot(g) { return (g && g.slot && GEO_SLOT_ET[g.slot] != null) ? g.slot : 'early'; }
// local kickoff hour at the venue (an "early" game out West is moved to the late window, as the schedule-makers do)
function geoKick(g, venue, d) {
  let slot = geoSlot(g), et = GEO_SLOT_ET[slot]; const E = geoOffset({ tz: 'E' }, d), off = geoOffset(venue, d);
  if (slot === 'early' && et + off - E < 11.5) { slot = 'late'; et = GEO_SLOT_ET.late; }
  return { slot, et, local: et + off - E };
}
// the game a team is playing this week (the one being played, for the venue and the rotation)
function geoCurGame(lg, tid, opp) {
  if (!lg) return null; const hit = g => g && (g.h === tid || (!!g.neutral && g.a === tid)) && (opp == null || g.a === opp || g.h === opp);
  if (lg.phase === 'playoffs' && lg.playoff) return (lg.playoff.games || []).find(hit) || null;
  if (lg.phase === 'regular' && lg.sched && lg.sched[lg.week]) return lg.sched[lg.week].find(hit) || null;
  return null;
}
function geoWeekOf(lg) { return lg ? (lg.phase === 'playoffs' ? 18 + ((lg.playoff && lg.playoff.round) | 0) : lg.week | 0) : 0; }

// ---------- climate ----------
// expected high on a date: an annual cosine through the September and January normals (coldest about Jan 20)
function geoNormal(place, d) {
  const doy = (d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5, south = place.lat < 0;
  const amp = (place.sep - place.jan) / 1.556, mean = place.jan + amp;
  return mean + amp * Math.cos(2 * Math.PI * (doy - (south ? 18 : 201)) / 365);
}
// game-day climate: expected temperature (°F, at kickoff) and the odds of rain and snow
function geoClimate(place, d, hourLocal) {
  const hi = geoNormal(place, d), late = clamp((d.getUTCMonth() >= 8 ? d.getUTCMonth() - 8 : d.getUTCMonth() + 4) / 4, 0, 1);
  const h = hourLocal == null ? 14 : hourLocal, t = hi - (h >= 19 ? 9 : h >= 17 ? 5 : h < 12 ? 4 : 0);
  const wet = lerp(place.wetE, place.wetL, late), cold = clamp((44 - t) / 14, 0, 1);      // snow needs a cold day, not just a cold month
  const snow = place.snow * cold * 0.5, rain = wet * 0.55 * (1 - cold * 0.8);
  return { hi, t, rain, snow, wind: place.wind, late };
}

// ---------- travel ----------
// what the trip costs a team: miles, time zones, the body clock (a West Coast team kicking off at 10 a.m. on its own clock),
// thin air for visitors. cost = starting stamina lost (0.03 = 3%), drain = how much faster visitors tire at altitude.
function geoTravel(g, tid) {
  const LL = typeof L !== 'undefined' ? L : null; if (!g || !LL || !LL.teams[tid]) return null;
  const T = LL.teams[tid], home = geoTeam(T), venue = geoVenue(g) || home, d = geoDate(LL.year, g.wk != null ? g.wk : geoWeekOf(LL));
  const atHome = !g.neutral && g.h === tid, miles = atHome ? 0 : Math.round(geoMiles(home, venue));
  const tz = atHome ? 0 : geoOffset(venue, d) - geoOffset(home, d), k = geoKick(g, venue, d), body = k.local - tz;
  let cost = 0; const out = { miles, tz, slot: k.slot, kick: k.local, body, home, venue, atHome, bodyClock: false, alt: 0, drain: 1 };
  if (!atHome) {
    cost = Math.max(0, miles - 300) / 1000 * 0.0055 + Math.abs(tz) * 0.0055;
    if (body < 11) { out.bodyClock = true; cost += 0.012; }           // the body thinks it is morning
    else if (body >= 23) { out.bodyClock = true; cost += 0.008; }      // or past midnight
    const sc = T.fac && T.fac.sc ? T.fac.sc : 1; cost *= 1 - 0.05 * (sc - 1);   // strength & conditioning staff manage the trip
    cost = Math.min(0.06, cost);
    if (venue.alt > 3000 && home.alt < 3000) { out.alt = venue.alt; out.drain = 1 + 0.065 * Math.min(1.5, (venue.alt - 3000) / 2280); }
  }
  out.cost = Math.round(cost * 1000) / 1000; return out;
}
// an edge for the fast ratings sim (simGame), in the same units as its power edge (home field = +1.5): the trip and thin air
function geoTravelEdge(g, tid) { const t = geoTravel(g, tid); if (!t || t.atHome) return 0; return -(t.cost * 20) - (t.drain - 1) * 6; }
function geoTzTxt(h) { return !h ? 'same time zone' : `${Math.abs(h)} time zone${Math.abs(h) === 1 ? '' : 's'} ${h > 0 ? 'east' : 'west'}`; }
function geoMilesTxt(m) { return Math.round(m).toLocaleString('en-US') + ' mi'; }
// one short line for the matchup card
function geoTravelTxt(t) {
  if (!t) return ''; if (t.atHome) return 'Home game';
  const bits = [geoMilesTxt(t.miles)]; if (t.tz) bits.push(geoTzTxt(t.tz));
  if (t.bodyClock) bits.push(t.body < 11 ? `${Math.round(t.body)} a.m. on their body clock` : 'late night on their body clock');
  if (t.drain > 1) bits.push('thin air');
  return bits.join(' · ') + (t.cost >= 0.005 ? ` · −${Math.round(t.cost * 100)}% stamina` : '');
}
// every team's road trips in the regular season (venue, miles); for the map arcs and totals
function geoTrips(tid) {
  const LL = typeof L !== 'undefined' ? L : null; if (!LL) return []; const out = [];
  (LL.sched || []).forEach((wk, i) => { for (const g of wk) { if (g.a !== tid && !(g.neutral && g.h === tid)) continue; const t = geoTravel(Object.assign({ wk: i }, g), tid); if (t && !t.atHome) out.push({ wk: i, g, t, opp: g.h === tid ? g.a : g.h }); } });
  return out;
}

// ---------- where players come from ----------
// a college's home: a state its name fits (Bayou A&M in the Gulf states), weighted by how much football is played there
function geoCollege(name) {
  const nm = String(name || 'State University'), w1 = nm.split(' ')[0], allow = (GEO_COL_STATES[w1] || Object.keys(GEO_TOWNS).join(' ')).split(' ').filter(s => GEO_TOWNS[s]);
  const st = geoWPick(geoU('col|' + nm), allow, s => (GEO_TALENT[s] || 0.35) + 0.6), towns = GEO_TOWNS[st], t = towns[geoHash('colt|' + nm) % towns.length];
  return { name: nm, st, town: t[0], lat: t[1], lon: t[2], region: GEO_STATE_REGION[st] || 'Midwest' };
}
// a player's hometown (stored p.home = 'Town|ST' wins; otherwise picked from his id: most play college near home)
function geoHome(p) {
  if (!p) return null;
  if (p.home) { const [tn, st] = String(p.home).split('|'); const t = (GEO_TOWNS[st] || []).find(x => x[0] === tn); if (t) return { town: t[0], st, lat: t[1], lon: t[2], region: GEO_STATE_REGION[st] }; }
  const seed = 'home|' + (p.id != null ? p.id : (p.fn || '') + (p.ln || '')), col = p.col ? geoCollege(p.col) : null, near = col && geoU(seed + '|near') < 0.58;
  const pool = near ? GEO_REGION_STATES[col.region].split(' ').filter(s => GEO_TOWNS[s]) : Object.keys(GEO_TOWNS);
  const st = geoWPick(geoU(seed), pool, s => GEO_TALENT[s] || 0.3), towns = GEO_TOWNS[st], t = towns[geoHash(seed + '|t') % towns.length];
  return { town: t[0], st, lat: t[1], lon: t[2], region: GEO_STATE_REGION[st] };
}
// a prospect's scouting region is his college's region (so a scout based there sees him; older classes are fixed up here)
function geoSyncProspects() {
  const LL = typeof L !== 'undefined' ? L : null; if (!LL || !LL.draft) return;
  for (const id of LL.draft) { const p = LL.P[id]; if (p && p.col && !p.geoR) { p.region = geoCollege(p.col).region; p.geoR = 1; } }
}
// counts by state and by college for any list of players (roster, draft class, a college's recruits): by 'home' or 'col'
function geoPipeline(players, by) {
  const st = {}, col = {}, region = {}; let n = 0;
  for (const p of players || []) { if (!p) continue; n++;
    if (by === 'col') { const c = geoCollege(p.col); st[c.st] = (st[c.st] || 0) + 1; region[c.region] = (region[c.region] || 0) + 1; const e = col[c.name] || (col[c.name] = { c, n: 0, ids: [] }); e.n++; e.ids.push(p.id); }
    else { const h = geoHome(p); if (!h) continue; st[h.st] = (st[h.st] || 0) + 1; region[h.region] = (region[h.region] || 0) + 1; } }
  return { n, st, col, region };
}
