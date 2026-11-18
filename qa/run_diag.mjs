// Run anatomy on league plays: where the first contact happens (yards from LOS), who makes it (position, blocked earlier or
// never blocked), when, and how many blockers actually engaged a defender.
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const N = +(process.argv[2] || 300), YD = 0.9144;
{ let s = +(process.env.SEED || 20261117) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } // SEEDED_LEAGUE: same league every run
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id);
const runs = L.plays.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line');
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
const why = {}; const P0 = PHYS.Play.prototype, shed0 = P0.shed, bond0 = P0.blockBond;
P0.blockBond = function (b, d, dt) { this._bd = { dist: Math.hypot(d.p.x - b.p.x, d.p.z - b.p.z), bu: b.upright(), du: d.upright(), t: d.bondT }; return bond0.call(this, b, d, dt); };
P0.shed = function (b, d, w) { if (!this.pass && this.phase === 'live' && d.dl) { const bd = this._bd || {}; const k = w ? (w.startsWith('reach') ? 'reach-off' : 'timed shed') : !bd.bu ? 'blocker fell' : !bd.du ? 'rusher fell' : bd.dist > 2 ? (bd.t > 0.3 ? `slipped after ${bd.t > 1 ? '1s' : '0.3s'}` : 'slipped early') : 'other'; why[k] = (why[k] || 0) + 1; } return shed0.call(this, b, d, w); };
process.on('exit', () => console.log('DL run-block endings:', JSON.stringify(why)));
const rows = [];
for (let i = 0; i < N; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], op = runs[i % runs.length];
  const dp = byId(LG.cpuCall(d.id, 'D', { side: 'D', tid: d.id, oppTid: o.id, down: 1, togo: 10, yl: 35, q: 1, clock: 100, qlen: 120, sd: 0, offForm: op.form }));
  const bonded = new Set(); let first = null, handT = null, maxBonds = 0;
  const res = PHYS.runPlay({ losZ: 35 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0 }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: i * 17 + 9, fatigue: {} }, pl => {
    let nb = 0; for (const x of pl.D) if (x.bondBy) { bonded.add(x); nb++; } maxBonds = Math.max(maxBonds, nb);
    if (pl.handed && handT === null) handT = pl.liveT;
    const c = pl.carrier; if (!c || first || !pl.handed) return;
    const t = pl.D.find(x => x.wrapped || (x.engaged && Math.hypot(x.p.x - c.p.x, x.p.z - c.p.z) < 1.3));
    if (t) first = { yd: (c.p.z - pl.losZ) / YD, t: pl.liveT, pos: t.posName, wasBlocked: bonded.has(t), fromBlock: !!t.bondBy, carrierSpd: Math.hypot(c.vel.x, c.vel.z) };
  });
  rows.push({ y: res.yards || 0, first, handT, maxBonds, scheme: op.scheme, name: op.name, form: op.form });
}
const avg = (a, f) => (a.reduce((s, r) => s + f(r), 0) / Math.max(1, a.length)).toFixed(2), pct = (a, b) => (b ? (a / b * 100).toFixed(0) + '%' : '-');
const withC = rows.filter(r => r.first);
console.log(`${rows.length} runs: ypc ${avg(rows, r => r.y)} med ${rows.map(r => r.y).sort((a, b) => a - b)[rows.length >> 1].toFixed(1)}  handoff at ${avg(rows.filter(r => r.handT != null), r => r.handT)}s  max simultaneous blocks ${avg(rows, r => r.maxBonds)}`);
console.log(`first contact: ${avg(withC, r => r.first.yd)} yd from LOS at ${avg(withC, r => r.first.t)}s, runner speed ${avg(withC, r => r.first.carrierSpd)} m/s; behind LOS ${pct(withC.filter(r => r.first.yd < 0).length, withC.length)}`);
console.log(`yards after first contact ${avg(withC, r => r.y - r.first.yd)}`);
{ const F = {}; for (const r of rows) (F[r.form] = F[r.form] || []).push(r); for (const [k, a] of Object.entries(F)) { const c = a.filter(r => r.first); console.log(`  ${k.padEnd(11)} n=${String(a.length).padStart(3)} ypc ${avg(a, r => r.y)} handoff ${avg(a.filter(r => r.handT != null), r => r.handT)}s first contact ${avg(c, r => r.first.yd)}yd at ${avg(c, r => r.first.t)}s behind LOS ${pct(c.filter(r => r.first.yd < 0).length, c.length)}`); } }
const by = {}; for (const r of withC) { const k = `${r.first.pos} ${r.first.fromBlock ? 'reaching off a block' : r.first.wasBlocked ? 'shed earlier' : 'never blocked'}`; by[k] = by[k] || []; by[k].push(r); }
for (const [k, a] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${k.padEnd(30)} ${String(a.length).padStart(3)}  contact at ${avg(a, r => r.first.yd)} yd, gain ${avg(a, r => r.y)}`);
