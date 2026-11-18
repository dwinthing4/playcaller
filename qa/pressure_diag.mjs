// Where does QB pressure come from? First defender within 2 m of the pocket QB: blocked-then-shed, never blocked, blitzer, time.
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const N = +(process.argv[2] || 300), YD = 0.9144;
{ let s = +(process.env.SEED || 20261117) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } // SEEDED_LEAGUE: same league every run
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id);
const passes = L.plays.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line');
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
// test-only instrumentation: count why pass-rush blocks end
const why = {}; const P0 = PHYS.Play.prototype, shed0 = P0.shed, bond0 = P0.blockBond;
let traces = 0; const hist = new Map();
P0.blockBond = function (b, d, dt) { this._bd = { dist: Math.hypot(d.p.x - b.p.x, d.p.z - b.p.z), bu: b.upright(), du: d.upright(), t: d.bondT, need: d.shedNeed };
  if (this.pass && !this.thrown) { const h = hist.get(d) || []; h.push(`t=${this.liveT.toFixed(2)} dist=${this._bd.dist.toFixed(2)} b=(${b.p.x.toFixed(1)},${b.p.z.toFixed(1)}) v=(${b.vel.x.toFixed(1)},${b.vel.z.toFixed(1)}) d=(${d.p.x.toFixed(1)},${d.p.z.toFixed(1)}) v=(${d.vel.x.toFixed(1)},${d.vel.z.toFixed(1)}) qb=(${this.qb.p.x.toFixed(1)},${this.qb.p.z.toFixed(1)}) ${d.slot}/${d.rushMove} vs ${b.slot} ${b.passT === d ? 'assigned' : 'other'}`); if (h.length > 14) h.shift(); hist.set(d, h);
    if (this._bd.dist > 2 && traces < 3 && this.liveT < 2.6 && d.bondT > 0.4) { traces++; console.log('--- slip trace'); console.log(h.filter((_, i) => i % 2 === 0).join('\n')); } }
  return bond0.call(this, b, d, dt); };
P0.shed = function (b, d, w) { if (this.pass && !this.thrown && this.carrier === this.qb && this.phase === 'live') { const bd = this._bd || {}; const k = w ? (w.startsWith('reach') ? 'reach-off' : 'timed shed') : !bd.bu ? 'blocker fell' : !bd.du ? 'rusher fell' : bd.dist > 2 ? (bd.t > 0.4 ? 'slipped after 0.4s' : 'slipped early') : 'other'; why[k] = (why[k] || 0) + 1; } return shed0.call(this, b, d, w); };
process.on('exit', () => console.log('block endings during dropbacks:', JSON.stringify(why)));
const src = {}, times = [], rushers = []; let pressured = 0, total = 0, sacks = 0;
for (let i = 0; i < N; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], yl = 25 + (i * 13) % 45;
  const op = passes[i % passes.length], dp = byId(LG.cpuCall(d.id, 'D', { side: 'D', tid: d.id, oppTid: o.id, down: 1, togo: 10, yl, q: 1, clock: 100, qlen: 120, sd: 0, offForm: op.form }));
  const everBonded = new Set(); let first = null, nR = 0, nB = 0;
  const res = PHYS.runPlay({ losZ: yl * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0 }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: i * 91 + 3, fatigue: {} }, pl => {
    if (!nR) { nR = pl.D.filter(x => x.job === 'rush').length; nB = pl.O.filter(x => x.asg && x.asg.t === 'pass').length; }
    for (const x of pl.D) if (x.bondBy) everBonded.add(x);
    if (first || pl.thrown || pl.carrier !== pl.qb || pl.liveT < 0.3) return;
    const q = pl.qb; for (const x of pl.D) { if (x.bondBy || !x.upright()) continue; if (Math.hypot(x.p.x - q.p.x, x.p.z - q.p.z) < 2.0) { first = { who: x, t: pl.liveT, how: everBonded.has(x) ? 'shed' : 'unblocked', job: x.job, dl: x.dl, slot: x.slot }; break; } }
  });
  total++; rushers.push([nR, nB]); if (res.sack) sacks++;
  if (first) { pressured++; const k = `${first.how} ${first.dl ? 'DL' : first.job === 'rush' ? 'blitzer' : first.job}`; src[k] = (src[k] || 0) + 1; times.push(first.t); }
}
console.log(`${total} dropbacks: pressured ${(pressured / total * 100).toFixed(0)}%  sacks ${(sacks / total * 100).toFixed(1)}%  avg rushers ${(rushers.reduce((s, r) => s + r[0], 0) / total).toFixed(1)} vs pass blockers ${(rushers.reduce((s, r) => s + r[1], 0) / total).toFixed(1)}`);
console.log('first pressure by:', JSON.stringify(src));
times.sort((a, b) => a - b); console.log('time of first pressure: p25', times[times.length >> 2]?.toFixed(2), 'median', times[times.length >> 1]?.toFixed(2), 'p75', times[(times.length * 3) >> 2]?.toFixed(2));
