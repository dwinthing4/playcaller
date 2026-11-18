// Open-field tackling diagnostics on league-realistic plays: every lunge/dive (contact or miss), every wrap
// (finished or broken), and defenders who got close in front of the runner but never tried.
// run: node tools/build.mjs && node qa/tackle_diag.mjs [plays]
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { PHYS, LG } = require(path.join(root, 'dist', 'sim.cjs'));
const N = +(process.argv[2] || 300), YD = 0.9144;
{ let s = +(process.env.SEED || 20261117) >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } // SEEDED_LEAGUE: same league every run
LG.newLeague({ diff: 'pro', qlen: 120 }); LG.chooseTeam(0, 'Test');
const L = LG.state(), byId = id => L.plays.find(p => p.id === id);
const list = (T, form, side) => LG.starters(T, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: LG.player(s.pid), dx: s.dx, dy: s.dy }));
const lunges = [], wraps = [], passes = []; let big = 0, plays = 0;
const agg = { contact: 0, miss: 0, wrapDone: 0, wrapBroke: 0 };
for (let i = 0; i < N; i++) {
  const o = L.teams[(i * 7) % 32], d = L.teams[(i * 7 + 3) % 32], yl = 25 + (i * 13) % 45;
  const ctx = { side: 'O', tid: o.id, oppTid: d.id, down: 1, togo: 10, yl, q: 1, clock: 100, qlen: 120, sd: 0 };
  const op = byId(LG.cpuCall(o.id, 'O', ctx)), dp = byId(LG.cpuCall(d.id, 'D', Object.assign({}, ctx, { side: 'D', tid: d.id, oppTid: o.id, offForm: op.form })));
  const st = new Map(), local = { lunges: [], wraps: [], near: new Map() }; let carrierZ0 = null;
  const res = PHYS.runPlay({ losZ: yl * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: o.id, list: list(o, op.form, 'O'), bonus: 0 }, def: { tid: d.id, list: list(d, dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: i * 31 + 7, fatigue: {} }, pl => {
    const c = pl.carrier; if (!c || c.unit !== 'O' || pl.ball.state !== 'held') return;
    const isRunPhase = !(c === pl.qb && pl.pass && !pl.thrown);
    if (!isRunPhase) return;
    if (carrierZ0 === null) carrierZ0 = c.p.z;
    for (const df of pl.D) {
      const s = st.get(df) || { lunge: 0, wrap: false, lg: null }; st.set(df, s);
      const dist = Math.hypot(df.p.x - c.p.x, df.p.z - c.p.z);
      if (df.lungeT > 0 && s.lunge <= 0) { const n = { x: (c.p.x - df.p.x) / dist, z: (c.p.z - df.p.z) / dist }, closing = (df.vel.x - c.vel.x) * n.x + (df.vel.z - c.vel.z) * n.z, ahead = (df.p.z - c.p.z);
        s.lg = { dist, closing, ahead, dive: !!df.diving, cs: Math.hypot(c.vel.x, c.vel.z), juke: c.jukeT > 0 || c.spinT > 0, ok: false }; local.lunges.push(s.lg); }
      if (s.lg && (df.wrapped || df.engaged)) s.lg.ok = true;
      if (df.lungeT <= 0 && s.lunge > 0) s.lg = null;
      s.lunge = df.lungeT;
      if (df.wrapped && !s.wrap) local.wraps.push(s.w = { t: pl.t, broke: false, wq: df.wq || 0 });
      if (!df.wrapped && s.wrap && pl.phase === 'live') s.w.broke = true;
      s.wrap = df.wrapped;
      if (df.upright() && dist < 2.6 && (df.p.z - c.p.z) > -0.5) { const m = local.near.get(df) || { min: 9, tried: false }; m.min = Math.min(m.min, dist); if (df.lungeT > 0 || df.wrapped || df.engaged) m.tried = true; local.near.set(df, m); }
    }
  });
  plays++;
  const gain = res.yards || 0, after = res.airYds != null ? gain - res.airYds : gain;
  for (const l of local.lunges) agg[l.ok ? 'contact' : 'miss']++;
  for (const w of local.wraps) agg[w.broke ? 'wrapBroke' : 'wrapDone']++;
  lunges.push(...local.lunges.map(l => Object.assign(l, { big: after >= 15 })));
  if (after >= 15 && res.turnover !== 'int') { big++; const nv = [...local.near.values()]; console.log(`#${i} ${op.type} ${op.name} vs ${dp.name}: +${gain.toFixed(0)} (after catch/handoff ${after.toFixed(0)})  lunges ${local.lunges.length} (miss ${local.lunges.filter(l => !l.ok).length})  wraps ${local.wraps.length} broke ${local.wraps.filter(w => w.broke).length}  close-in-front ${nv.length} never-tried ${nv.filter(m => !m.tried).length}`); }
}
const pct = (a, b) => (b ? (a / b * 100).toFixed(0) + '%' : '-');
console.log(`\n${plays} plays, ${big} gains of 15+ after the catch/handoff`);
console.log(`lunges ${agg.contact + agg.miss}: contact ${pct(agg.contact, agg.contact + agg.miss)}; wraps ${agg.wrapDone + agg.wrapBroke}: broken ${pct(agg.wrapBroke, agg.wrapDone + agg.wrapBroke)}`);
const miss = lunges.filter(l => !l.ok), ok = lunges.filter(l => l.ok), avg = (a, k) => (a.reduce((s, x) => s + x[k], 0) / Math.max(1, a.length)).toFixed(2);
console.log(`misses: dist ${avg(miss, 'dist')} closing ${avg(miss, 'closing')} runnerSpd ${avg(miss, 'cs')} dive ${pct(miss.filter(l => l.dive).length, miss.length)} juke ${pct(miss.filter(l => l.juke).length, miss.length)}`);
console.log(`hits:   dist ${avg(ok, 'dist')} closing ${avg(ok, 'closing')} runnerSpd ${avg(ok, 'cs')} dive ${pct(ok.filter(l => l.dive).length, ok.length)} juke ${pct(ok.filter(l => l.juke).length, ok.length)}`);
const fast = lunges.filter(l => l.cs > 6.5); console.log(`vs runner >6.5 m/s: ${fast.length} lunges, contact ${pct(fast.filter(l => l.ok).length, fast.length)}`);
