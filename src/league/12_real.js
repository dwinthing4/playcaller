// "Real cities" league: the 32 real markets in their real conferences and divisions, with each team's real color scheme.
// Team nicknames, logos and player names belong to the league and the players, so they are not built in: teams go by their city,
// get an original emblem in their colors, and every name can be changed in League > Editor (including a pasted roster).
// [abbr, city, conf, div, primary, secondary, helmet, strength, emblem icon, emblem shape]
const REAL_TEAMS = [
  ['BUF', 'Buffalo', 'A', 'East', '#00338D', '#C60C30', '#FFFFFF', 81, 'horns', 0], ['MIA', 'Miami', 'A', 'East', '#008E97', '#FC4C02', '#FFFFFF', 71, 'sun', 2],
  ['NE', 'New England', 'A', 'East', '#002244', '#C60C30', '#B0B7BC', 64, 'star', 1], ['NYJ', 'New Jersey', 'A', 'East', '#125740', '#FFFFFF', '#125740', 68, 'wing', 3],
  ['BAL', 'Baltimore', 'A', 'North', '#241773', '#9E7C0C', '#101820', 81, 'wing', 4], ['CIN', 'Cincinnati', 'A', 'North', '#FB4F14', '#101820', '#FB4F14', 74, 'claw', 0],
  ['CLE', 'Cleveland', 'A', 'North', '#311D00', '#FF3C00', '#FF3C00', 64, 'claw', 2], ['PIT', 'Pittsburgh', 'A', 'North', '#101820', '#FFB612', '#101820', 75, 'star', 1],
  ['HOU', 'Houston', 'A', 'South', '#03202F', '#A71930', '#03202F', 74, 'horns', 3], ['IND', 'Indianapolis', 'A', 'South', '#002C5F', '#FFFFFF', '#FFFFFF', 70, 'hoof', 0],
  ['JAX', 'Jacksonville', 'A', 'South', '#006778', '#D7A22A', '#101820', 66, 'claw', 4], ['TEN', 'Tennessee', 'A', 'South', '#0C2340', '#4B92DB', '#0C2340', 63, 'flame', 2],
  ['DEN', 'Denver', 'A', 'West', '#FB4F14', '#002244', '#002244', 75, 'hoof', 1], ['KC', 'Kansas City', 'A', 'West', '#E31837', '#FFB81C', '#E31837', 82, 'flame', 0],
  ['LV', 'Las Vegas', 'A', 'West', '#101820', '#A5ACAF', '#A5ACAF', 65, 'crown', 3], ['LAC', 'Hollywood', 'A', 'West', '#0080C6', '#FFC20E', '#FFFFFF', 76, 'bolt', 4],
  ['DAL', 'Dallas', 'N', 'East', '#003594', '#869397', '#869397', 70, 'star', 1], ['NYG', 'New York', 'N', 'East', '#0B2265', '#A71930', '#0B2265', 63, 'mountain', 0],
  ['PHI', 'Philadelphia', 'N', 'East', '#004C54', '#A5ACAF', '#004C54', 82, 'wing', 2], ['WAS', 'Washington', 'N', 'East', '#5A1414', '#FFB612', '#5A1414', 76, 'crown', 3],
  ['CHI', 'Chicago', 'N', 'North', '#0B162A', '#C83803', '#0B162A', 69, 'claw', 4], ['DET', 'Detroit', 'N', 'North', '#0076B6', '#B0B7BC', '#B0B7BC', 82, 'claw', 1],
  ['GB', 'Green Bay', 'N', 'North', '#203731', '#FFB612', '#FFB612', 77, 'sun', 0], ['MIN', 'Minnesota', 'N', 'North', '#4F2683', '#FFC62F', '#4F2683', 78, 'horns', 2],
  ['ATL', 'Atlanta', 'N', 'South', '#A71930', '#101820', '#101820', 70, 'wing', 3], ['CAR', 'Carolina', 'N', 'South', '#0085CA', '#101820', '#A5ACAF', 64, 'claw', 0],
  ['NO', 'New Orleans', 'N', 'South', '#101820', '#D3BC8D', '#D3BC8D', 66, 'crown', 4], ['TB', 'Tampa Bay', 'N', 'South', '#D50A0A', '#34302B', '#34302B', 75, 'anchor', 1],
  ['ARI', 'Arizona', 'N', 'West', '#97233F', '#FFFFFF', '#FFFFFF', 71, 'wing', 2], ['LAR', 'Los Angeles', 'N', 'West', '#003594', '#FFA300', '#003594', 75, 'horns', 0],
  ['SF', 'San Francisco', 'N', 'West', '#AA0000', '#B3995D', '#B3995D', 74, 'mountain', 3], ['SEA', 'Seattle', 'N', 'West', '#002244', '#69BE28', '#002244', 73, 'wing', 4],
];
const CONF_REAL = { A: 'American', N: 'National' };
function confName(c) { return ((typeof L !== 'undefined' && L && L.real) ? CONF_REAL : CONF_NAME)[c] || c; }
// a team's display name: "City Nickname", or just the city when it has no nickname of its own
function teamLabel(t) { return t ? (t.name && t.name !== t.city ? t.city + ' ' + t.name : t.city) : ''; }
