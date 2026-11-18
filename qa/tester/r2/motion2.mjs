// In-page (qa2): every offensive play in the league playbook that has pre-snap motion, built like MATCH.buildOpts with real starters:
// seconds from snap() until the ball is actually snapped (phase live), both flips, three ball spots.
import { launch } from '../lib.mjs';
const H = await launch('desk', { tag: 'r2_motion2', seed: 3, file: 'playcaller_qa2.html' });
const { page } = H;
await H.newLeague(60, 5);
const r = await page.evaluate(() => {
  const T = L.teams[L.user], O2 = L.teams[(L.user + 1) % L.teams.length], P = id => L.P[id];
  const list = (Tm, form, side) => LG.starters(Tm, form, side).map(s => ({ slot: s.slot, pos: s.pos, rp: P(s.pid != null ? s.pid : s.id), dx: s.dx, dy: s.dy })).filter(e => e.rp);
  const defs = (L.plays || []).filter(p => p.side === 'D'); const offs = LG.playsFor(L.user, 'O'); const out = []; let stuck = 0;
  for (const op of offs) for (const flip of [false, true]) for (const ballX of [-2.82, 0, 2.82]) {
    const dp = defs[out.length % defs.length];
    const pl = new PHYS.Play({ losZ: 30 * 0.9144, ballX, down: 1, togo: 10, op: Object.assign({}, op, { flip }), dp, off: { tid: T.id, list: list(T, op.form, 'O'), bonus: 0 }, def: { tid: O2.id, list: list(O2, dp.form, 'D'), bonus: 0 }, userSide: 'O', diff: 'pro', seed: (Math.random() * 1e9) >>> 0, weather: 'clear', fatigue: {} });
    if (!pl.motion) break;
    let n = 0; pl.snap(); while (pl.phase === 'pre' && n < 120 * 20) { pl.step(PHYS.DT); n++; if (n % 4 === 0) pl.updatePoses(); }
    if (pl.phase === 'pre') stuck++; out.push({ play: op.name, type: pl.motion.type, flip, ballX, secs: +(n * PHYS.DT).toFixed(2), live: pl.phase === 'live' });
  }
  const by = {}; for (const o of out) { const k = `${o.play} (${o.type})`; (by[k] = by[k] || []).push(o.live ? o.secs : 'STUCK'); }
  return { plays: offs.length, motionPlays: Object.keys(by).length, stuck, by };
});
console.log(`offense playbook ${r.plays} plays, ${r.motionPlays} with motion, never snapped within 20 s: ${r.stuck}`);
for (const k in r.by) console.log(' ', k.padEnd(34), 'seconds from SNAP to the ball being snapped:', r.by[k].join(' '));
console.log(H.errs.length ? 'ERRORS ' + H.errs.join(' || ') : 'no page errors');
await H.close();
