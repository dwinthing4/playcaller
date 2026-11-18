// Football data shared by the league layer and the on-field engine.
// Formations, routes and coverages are in YARDS. The engine converts to meters.
const POS_COUNTS = { QB: 3, RB: 4, FB: 1, WR: 6, TE: 3, OT: 4, OG: 3, C: 2, DE: 4, DT: 4, LB: 7, CB: 6, S: 4, K: 1, P: 1 };
const POS_LIST = Object.keys(POS_COUNTS);
const OFF_POS = ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'C'];
const DEF_POS = ['DE', 'DT', 'LB', 'CB', 'S'];
const ATTRS = ['spd', 'acc', 'agi', 'str', 'awr', 'thp', 'tha', 'cth', 'rte', 'btk', 'elu', 'car', 'rbk', 'pbk', 'tak', 'pur', 'prs', 'pow', 'bsh', 'mcv', 'zcv', 'hnd', 'jmp', 'kpw', 'kac'];
const ATTR_NAME = { spd: 'Speed', acc: 'Acceleration', agi: 'Agility', str: 'Strength', awr: 'Awareness', thp: 'Throw power', tha: 'Throw accuracy', cth: 'Catching', rte: 'Route running', btk: 'Break tackle', elu: 'Elusiveness', car: 'Carrying', rbk: 'Run block', pbk: 'Pass block', tak: 'Tackling', pur: 'Pursuit', prs: 'Pass rush', pow: 'Power moves', bsh: 'Block shedding', mcv: 'Man coverage', zcv: 'Zone coverage', hnd: 'Ball hands', jmp: 'Jumping', kpw: 'Kick power', kac: 'Kick accuracy' };

// offense slots: [slot, pos, depthIdx, dx (yards from LOS, negative = backfield), dy (yards from the ball, + = offense's right)]
const OFF_FORMS = {
  'Shotgun': { lab: 'Shotgun 11', slots: [['X', 'WR', 0, -1, -19.5], ['Z', 'WR', 1, -1, 19.5], ['SL', 'WR', 2, -1.5, 13], ['TE', 'TE', 0, -1, -6], ['RB', 'RB', 0, -5, -2.2], ['QB', 'QB', 0, -5, 0]] },
  'Singleback': { lab: 'Singleback 12', slots: [['X', 'WR', 0, -1, -19.5], ['Z', 'WR', 1, -1, 19.5], ['TE', 'TE', 0, -1, -6], ['TE2', 'TE', 1, -1, 6], ['RB', 'RB', 0, -6.5, 0], ['QB', 'QB', 0, -1.5, 0]] },
  'I-Form': { lab: 'I-Form 21', slots: [['X', 'WR', 0, -1, -19.5], ['Z', 'WR', 1, -1, 19.5], ['TE', 'TE', 0, -1, 6], ['FB', 'FB', 0, -4.5, 0], ['RB', 'RB', 0, -7, 0], ['QB', 'QB', 0, -1.5, 0]] },
  'Trips': { lab: 'Trips 10', slots: [['X', 'WR', 0, -1, -19.5], ['Z', 'WR', 1, -1, 19.5], ['SL', 'WR', 2, -1.5, 16], ['SL2', 'WR', 3, -1.5, 10], ['RB', 'RB', 0, -5, -2.2], ['QB', 'QB', 0, -5, 0]] },
  'Empty': { lab: 'Empty 01', slots: [['X', 'WR', 0, -1, -19.5], ['Z', 'WR', 1, -1, 19.5], ['SL', 'WR', 2, -1.5, 14], ['SL2', 'WR', 3, -1.5, -14], ['TE', 'TE', 0, -1, 6], ['QB', 'QB', 0, -5, 0]] },
  'Pistol': { lab: 'Pistol 11', slots: [['X', 'WR', 0, -1, -19.5], ['Z', 'WR', 1, -1, 19.5], ['SL', 'WR', 2, -1.5, 12], ['TE', 'TE', 0, -1, -6], ['RB', 'RB', 0, -7, 0], ['QB', 'QB', 0, -3.5, 0]] },
  'Bunch': { lab: 'Bunch 11', slots: [['X', 'WR', 0, -1, -19.5], ['Z', 'WR', 1, -1.2, 12], ['SL', 'WR', 2, -2.2, 10.5], ['TE', 'TE', 0, -1, 8.6], ['RB', 'RB', 0, -5, -2.2], ['QB', 'QB', 0, -5, 0]] },
  'Goal Line': { lab: 'Goal Line 22', slots: [['TE', 'TE', 0, -1, -6], ['TE2', 'TE', 1, -1, 6], ['X', 'WR', 0, -1, -14], ['FB', 'FB', 0, -4.5, 0], ['RB', 'RB', 0, -7, 0], ['QB', 'QB', 0, -1.5, 0]] },
};
const OL_SLOTS = [['LT', 'OT', 0, -1, -4.4], ['LG', 'OG', 0, -1, -2.2], ['C', 'C', 0, -0.9, 0], ['RG', 'OG', 1, -1, 2.2], ['RT', 'OT', 1, -1, 4.4]];
const OL_ORDER = ['LT', 'LG', 'C', 'RG', 'RT'];
// defense slots: [slot, pos, depthIdx, dx (yards downfield from LOS), dy (yards from the ball, + = offense's right)]
const DEF_FORMS = {
  '4-3': { lab: '4-3', slots: [['DE1', 'DE', 0, 1, -5.5], ['DT1', 'DT', 0, 1, -1.6], ['DT2', 'DT', 1, 1, 1.6], ['DE2', 'DE', 1, 1, 5.5], ['LB1', 'LB', 0, 5, 0], ['LB2', 'LB', 1, 5, -5], ['LB3', 'LB', 2, 5, 5], ['CB1', 'CB', 0, 6, -22], ['CB2', 'CB', 1, 6, 22], ['S1', 'S', 0, 13, -8], ['S2', 'S', 1, 13, 8]] },
  '3-4': { lab: '3-4', slots: [['DE1', 'DE', 0, 1, -4], ['DT1', 'DT', 0, 1, 0], ['DE2', 'DE', 1, 1, 4], ['LB1', 'LB', 0, 5, -2.5], ['LB2', 'LB', 1, 5, 2.5], ['LB3', 'LB', 2, 3, -8], ['LB4', 'LB', 3, 3, 8], ['CB1', 'CB', 0, 6, -22], ['CB2', 'CB', 1, 6, 22], ['S1', 'S', 0, 13, -8], ['S2', 'S', 1, 13, 8]] },
  'Nickel': { lab: 'Nickel 4-2-5', slots: [['DE1', 'DE', 0, 1, -5.5], ['DT1', 'DT', 0, 1, -1.6], ['DT2', 'DT', 1, 1, 1.6], ['DE2', 'DE', 1, 1, 5.5], ['LB1', 'LB', 0, 5, -2.5], ['LB2', 'LB', 1, 5, 2.5], ['CB1', 'CB', 0, 6, -22], ['CB2', 'CB', 1, 6, 22], ['CB3', 'CB', 2, 5, 13], ['S1', 'S', 0, 13, -8], ['S2', 'S', 1, 13, 8]] },
  'Dime': { lab: 'Dime 4-1-6', slots: [['DE1', 'DE', 0, 1, -5.5], ['DT1', 'DT', 0, 1, -1.6], ['DT2', 'DT', 1, 1, 1.6], ['DE2', 'DE', 1, 1, 5.5], ['LB1', 'LB', 0, 5, 0], ['CB1', 'CB', 0, 6, -22], ['CB2', 'CB', 1, 6, 22], ['CB3', 'CB', 2, 5, 13], ['CB4', 'CB', 3, 5, -13], ['S1', 'S', 0, 14, -8], ['S2', 'S', 1, 14, 8]] },
  'Goal Line D': { lab: 'Goal Line 5-3', slots: [['DE1', 'DE', 0, 1, -5.5], ['DT1', 'DT', 0, 1, -2.5], ['DT2', 'DT', 1, 1, 0], ['DT3', 'DT', 2, 1, 2.5], ['DE2', 'DE', 1, 1, 5.5], ['LB1', 'LB', 0, 3.5, 0], ['LB2', 'LB', 1, 3.5, -4.5], ['LB3', 'LB', 2, 3.5, 4.5], ['CB1', 'CB', 0, 4, -14], ['CB2', 'CB', 1, 4, 14], ['S1', 'S', 0, 7, 0]] },
};
// route waypoints: [downfield, toward the middle of the field] in yards, relative to the receiver's start
const ROUTES = {
  go: [[28, 0]], slant: [[2, 0], [12, 9]], out: [[8, 0], [8, -9]], in: [[10, 0], [10, 13]], post: [[10, 0], [24, 9]], corner: [[10, 0], [21, -9]],
  curl: [[11, 0], [9, 1]], hitch: [[5, 0], [4, 0]], stick: [[6, 0], [6, 1.5]], comeback: [[14, 0], [11, -3]], seam: [[24, 1]], flat: [[1, -2], [3, -11]],
  drag: [[3, 2], [4, 20]], wheel: [[1, -6], [24, -9]], screen: [[-2, -3], [-1.5, -6]], angle: [[2, -3], [6, 4]], fade: [[3, -1], [26, -3]], block: [],
};
const ROUTE_NAMES = Object.keys(ROUTES);
const SETTLE_ROUTES = { hitch: 1, curl: 1, comeback: 1, stick: 1, screen: 1 };
const DEEP_ROUTES = { go: 1, seam: 1, post: 1, fade: 1, corner: 1, wheel: 1 };
const SCHEMES = { zone: 'Inside zone', outside: 'Outside zone', power: 'Power', counter: 'Counter', dive: 'Drive / iso', draw: 'Draw' };
const BLOCK_TYPES = { pass: 'Pass set', drive: 'Drive', zone: 'Zone step', reach: 'Reach', down: 'Down block', pull: 'Pull', climb: 'Climb to LB' };
const GAPS = { A: 1.1, B: 3.3, C: 5.6, D: 8.2 };      // yards from the ball
// OL assignment for a play. side = playside sign (+1 = offense's right). returns {slot:{t,d}}, d = lateral direction (+1 = right)
function resolveBlocks(play, side) {
  const out = {}; const sc = play.scheme || (play.type === 'run' ? (play.dir === 'outside' ? 'outside' : 'zone') : 'pass'); const ps = side;
  for (let i = 0; i < 5; i++) {
    const sl = OL_ORDER[i], pos = i - 2, playSide = pos * ps > 0, back = pos * ps < 0; let t = 'pass', d = 0;
    if (play.type !== 'run') t = 'pass';
    else if (sc === 'zone') { t = 'zone'; d = ps; }
    else if (sc === 'outside') { t = 'reach'; d = ps; }
    else if (sc === 'dive') { t = 'drive'; d = 0; if (Math.abs(pos) === 1 && back) t = 'climb'; }
    else if (sc === 'draw') { t = 'draw'; d = 0; }
    else if (sc === 'power') { if (playSide || pos === 0) { t = 'down'; d = -ps; } else if (Math.abs(pos) === 1) { t = 'pull'; d = ps; } else { t = 'drive'; d = 0; } }
    else if (sc === 'counter') { if (playSide || pos === 0) { t = 'down'; d = -ps; } else { t = 'pull'; d = ps; } }
    out[sl] = { t, d };
  }
  if (play.blocks) for (const k in play.blocks) { const b = play.blocks[k]; if (!b) continue; out[k] = { t: b.t, d: b.d === 'P' ? side : b.d === 'B' ? -side : (b.d || 0) }; }
  return out;
}
// zone coverage landmarks: [depth yards, absolute field y (0..53.3, 26.65 = middle), preferred position]
const FIELD_W_YD = 53.33, MID_YD = 26.65;
const COV_ZONES = {
  c2: [[16, 13, 'S'], [16, 40, 'S'], [5, 6, 'CB'], [5, 47, 'CB'], [8, 20, 'LB'], [8, 33, 'LB'], [9, MID_YD, 'LB']],
  c3: [[16, 9, 'CB'], [17, MID_YD, 'S'], [16, 44, 'CB'], [5, 7, 'S'], [5, 46, 'LB'], [8, 19, 'LB'], [8, 34, 'LB'], [7, MID_YD, 'LB']],
  c4: [[14, 7, 'CB'], [15, 20, 'S'], [15, 33, 'S'], [14, 46, 'CB'], [6, 13, 'LB'], [6, 40, 'LB'], [7, MID_YD, 'LB']],
  c2t: [[16, 13, 'S'], [16, 40, 'S'], [5, 6, 'CB'], [5, 47, 'CB'], [13, MID_YD, 'LB'], [8, 18, 'LB'], [8, 35, 'LB']],
};
const MAN_COVERAGES = { c0: 1, c1: 1, c2m: 1 };
function covName(c) { return { c0: 'Cover 0', c1: 'Cover 1', c2: 'Cover 2', c3: 'Cover 3', c4: 'Cover 4', c2m: '2-Man', c2t: 'Tampa 2' }[c] || c; }
// situation buckets used by game plans and coordinator suggestions
const SCENS = [['1st', '1st & 10'], ['2short', '2nd & short'], ['2med', '2nd & medium'], ['2long', '2nd & long'], ['3short', '3rd & short'], ['3med', '3rd & medium'], ['3long', '3rd & long'], ['4short', '4th & short'], ['red', 'Red zone'], ['goal', 'Goal line'], ['2min', 'Two-minute drill']];
function scenKeyFor(down, togo, yl, q, clock, qlen, scoreDiff) {
  if (yl >= 95 || (yl >= 90 && togo <= 2)) return 'goal';
  if ((q === 2 || q >= 4) && clock <= Math.max(30, qlen * 0.3) && scoreDiff <= 0) return '2min';
  if (yl >= 80) return 'red';
  if (down === 4) return togo <= 2 ? '4short' : '3long';
  if (down === 1) return '1st';
  if (down === 2) return togo <= 3 ? '2short' : togo >= 7 ? '2long' : '2med';
  return togo <= 3 ? '3short' : togo >= 7 ? '3long' : '3med';
}
const FB = { POS_COUNTS, POS_LIST, OFF_POS, DEF_POS, ATTRS, ATTR_NAME, OFF_FORMS, OL_SLOTS, OL_ORDER, DEF_FORMS, ROUTES, ROUTE_NAMES, SETTLE_ROUTES, DEEP_ROUTES, SCHEMES, BLOCK_TYPES, GAPS, resolveBlocks, COV_ZONES, MAN_COVERAGES, covName, SCENS, scenKeyFor, FIELD_W_YD, MID_YD };
