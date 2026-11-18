// Loads src/core + src/engine into a sandbox (no league, no DOM) and builds test teams.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
export function loadEngine() {
  const files = ['core', 'engine'].flatMap(d => fs.readdirSync(path.join(root, 'src', d)).filter(f => f.endsWith('.js')).sort().map(f => path.join(root, 'src', d, f)));
  const code = '"use strict";\n' + files.map(f => fs.readFileSync(f, 'utf8')).join('\n') + '\n;({PHYS, FB, U, buildPlaybook});';
  const ctx = vm.createContext({ console, Math, Date, JSON });
  return vm.runInContext(code, ctx, { filename: 'engine.js' });
}
// position profiles (ported from Playcaller) for fixtures
const PROF = {
  QB: { thp: 0, tha: 0, awr: 0, spd: -14, acc: -8, agi: -8, str: -20, elu: -18, btk: -25, car: -12 },
  RB: { spd: 6, acc: 6, agi: 4, btk: 0, elu: 0, car: 0, cth: -10, str: -10, awr: -10, rbk: -30, pbk: -22, rte: -20 },
  FB: { rbk: 0, str: 0, btk: -5, car: -10, cth: -15, spd: -15, acc: -12, awr: -10, pbk: -8 },
  WR: { spd: 8, acc: 6, agi: 4, cth: 0, rte: 0, jmp: -2, awr: -8, elu: -10, btk: -20, car: -10, rbk: -30, str: -25 },
  TE: { cth: -3, rte: -8, jmp: -8, rbk: -4, str: -5, spd: -6, acc: -6, btk: -10, awr: -8, pbk: -12, car: -15 },
  OT: { pbk: 0, rbk: 0, str: 0, awr: -5, acc: -30, spd: -38, agi: -35 }, OG: { pbk: 0, rbk: 0, str: 2, awr: -5, acc: -30, spd: -40, agi: -36 }, C: { pbk: 0, rbk: 0, str: 0, awr: 0, acc: -32, spd: -42, agi: -36 },
  DE: { prs: 0, pow: -2, bsh: -2, tak: -6, spd: -4, acc: 0, str: -4, pur: -6, awr: -8, zcv: -35 }, DT: { bsh: 0, pow: 0, str: 4, tak: -6, prs: -8, spd: -25, acc: -15, pur: -12, awr: -8 },
  LB: { tak: 0, pur: 0, zcv: -4, bsh: -6, spd: -2, acc: 0, awr: -2, mcv: -15, prs: -15, pow: -15, str: -8, hnd: -20 },
  CB: { mcv: 0, zcv: 0, spd: 10, acc: 8, agi: 6, jmp: -3, hnd: -12, awr: -6, tak: -20, pur: -12, cth: -30 }, S: { zcv: 0, tak: -4, spd: 6, acc: 4, jmp: -6, hnd: -10, awr: -2, mcv: -10, pur: -2, agi: 0 },
  K: { kpw: 0, kac: 0 }, P: { kpw: 0, kac: -2 } };
const BODY = { QB: [73, 78, 215, 240], RB: [68, 72, 195, 225], FB: [71, 74, 235, 255], WR: [69, 77, 180, 220], TE: [75, 79, 240, 265], OT: [76, 80, 305, 330], OG: [75, 78, 305, 330], C: [74, 77, 295, 315], DE: [75, 79, 255, 285], DT: [73, 77, 295, 335], LB: [72, 76, 228, 250], CB: [69, 74, 180, 200], S: [70, 74, 195, 215], K: [70, 75, 185, 215], P: [72, 77, 200, 225] };
const COUNTS = { QB: 2, RB: 2, FB: 1, WR: 5, TE: 2, OT: 2, OG: 2, C: 1, DE: 3, DT: 3, LB: 4, CB: 4, S: 3, K: 1, P: 1 };
const ATTRS = ['spd', 'acc', 'agi', 'str', 'awr', 'thp', 'tha', 'cth', 'rte', 'btk', 'elu', 'car', 'rbk', 'pbk', 'tak', 'pur', 'prs', 'pow', 'bsh', 'mcv', 'zcv', 'hnd', 'jmp', 'kpw', 'kac'];
let UID = 1;
export function makeTeam(q, rnd = Math.random, tag = 'T') {
  const g = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) * 1.414; };
  const roster = {};
  for (const pos in COUNTS) {
    roster[pos] = [];
    for (let k = 0; k < COUNTS[pos]; k++) {
      const qq = q + (k === 0 ? 4 : -4), a = {};
      for (const at of ATTRS) a[at] = PROF[pos][at] !== undefined ? Math.round(Math.max(15, Math.min(99, qq + PROF[pos][at] + g() * 6))) : Math.round(22 + rnd() * 26);
      const b = BODY[pos], u = rnd();
      roster[pos].push({ id: UID++, pos, ln: `${tag}${pos}${k}`, fn: '', num: 10 + (UID % 89), a, ht: Math.round(b[0] + u * (b[1] - b[0])), wt: Math.round(b[2] + u * (b[3] - b[2])), traits: [] });
    }
  }
  return roster;
}
const FALL = { QB: ['RB'], RB: ['FB', 'WR'], FB: ['TE', 'RB'], WR: ['TE', 'RB'], TE: ['FB', 'WR', 'OT'], OT: ['OG'], OG: ['C', 'OT'], C: ['OG'], DE: ['LB', 'DT'], DT: ['DE'], LB: ['S', 'DE'], CB: ['S'], S: ['CB', 'LB'] };
function take(roster, pos, idx, used) {
  const list = roster[pos] || []; const c = list.filter(p => !used.has(p.id)); if (idx < c.length) return c[idx];
  for (const f of FALL[pos] || []) { const l = (roster[f] || []).filter(p => !used.has(p.id)); if (l.length) return l[l.length - 1]; }
  return Object.values(roster).flat().find(p => !used.has(p.id));
}
export function starters(E, roster, form, side) {
  const F = side === 'O' ? E.FB.OFF_FORMS[form] : E.FB.DEF_FORMS[form], slots = side === 'O' ? F.slots.concat(E.FB.OL_SLOTS) : F.slots, used = new Set();
  return slots.map(s => { const rp = take(roster, s[1], s[2], used); used.add(rp.id); return { slot: s[0], pos: s[1], rp, dx: s[3], dy: s[4] }; });
}
export function playOpts(E, offR, defR, op, dp, extra = {}) {
  return Object.assign({ losZ: 25 * 0.9144, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: 0, list: starters(E, offR, op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, defR, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: (Math.random() * 1e9) | 0 }, extra);
}
