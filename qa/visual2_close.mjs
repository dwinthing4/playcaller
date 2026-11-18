// Round-2 close-ups via R3D.camOverride: stances (line, LB, DB, WR, QB, RB), helmets, gloves, pads, the snap ease-out
// burst and engaged blocks. run: node qa/visual2_close.mjs desk|phone [plays]
import { open, installAdv, waitReady } from './visual2_lib.mjs';
const which = process.argv[2] || 'desk', NP = +(process.argv[3] || 2);
const { page, shot, log, done } = await open(which, 'close_' + which);
await page.evaluate(() => { NG.slot = 4; NG.qlen = 120; createLeague(); pickTeam(L.teams[2].id); startUserGame('watch'); });
await waitReady(page); await installAdv(page);
await page.evaluate(() => {
  const P = () => MATCH._G.play;
  window.__who = () => P().players.map(p => ({ id: p.id, pos: p.rp && p.rp.pos, unit: p.unit, ol: !!p.ol, dl: !!p.dl, slot: p.slot, role: p.role, x: +p.p.x.toFixed(2), z: +p.p.z.toFixed(2), bond: !!(p.bond || p.bondBy), stK: p.stK, crouch: p.crouch }));
  window.__jt = (J, joint) => joint === 'hand0' ? J.arms[0].hand : joint === 'hand1' ? J.arms[1].hand : J[joint];
  // frame a joint of a player from an offset in his own frame (f = forward, r = right, u = up)
  window.__frame = (pid, joint, f, r, u, fov, lookUp = 0) => { const J = P().poses[pid]; if (!J) return false; const j = __jt(J, joint), F = J.f3, Rx = -F.z, Rz = F.x;
    R3D.camOverride = { pos: [j.x + F.x * f + Rx * r, j.y + u, j.z + F.z * f + Rz * r], look: [j.x, j.y + lookUp, j.z], fov }; return true; };
  // frame relative to the ball spot
  window.__spot = (p, l, fov) => { const pl = P(), z = pl.losZ, x = pl.ballX; R3D.camOverride = { pos: [x + p[0], p[1], z + p[2]], look: [x + l[0], l[1], z + l[2]], fov }; };
});
const rafs = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const spot = async (name, p, l, fov) => { await page.evaluate(([p, l, f]) => __spot(p, l, f), [p, l, fov]); await rafs(); return shot(name); };
const frame = async (name, pid, joint, f, r, u, fov, lu) => { const ok = await page.evaluate(a => __frame(...a), [pid, joint, f, r, u, fov, lu || 0]); if (!ok) return; await rafs(); return shot(name); };
for (let play = 0; play < NP; play++) {
  for (let i = 0; i < 400; i++) { const s = await page.evaluate(() => MATCH._G.stage === 'pre' && MATCH._G.play && MATCH._G.play.phase === 'pre'); if (s) break; await page.waitForTimeout(100); }
  await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(300);
  const who = await page.evaluate(() => __who()); const kits = await page.evaluate(() => { const g = MATCH._G; return { poss: g.poss, kits: g.kits }; });
  log.push({ play, who, kits: JSON.stringify(kits).slice(0, 600) });
  const T = `p${play}`;
  await spot(`${T}_pre_line_side`, [7, 2.2, -1], [0, 0.8, 0.5], 42);
  await spot(`${T}_pre_line_side_low`, [6.5, 0.8, 0], [0, 0.55, 0], 40);
  await spot(`${T}_pre_line_behind`, [0, 1.7, -7], [0, 0.9, 1], 38);
  await spot(`${T}_pre_dline_front`, [2.5, 1.9, 4.5], [0, 1.0, -1], 38);
  await spot(`${T}_pre_overview_tv`, [16, 5, 0], [0, 0.6, 1], 44);
  const pick = (f) => who.find(f);
  const C = pick(p => p.ol && Math.abs(p.x - who.find(q => q.slot === 'QB' || q.pos === 'QB').x) < 0.6) || pick(p => p.ol);
  const ot = pick(p => p.ol && p.pos === 'OT') || pick(p => p.ol);
  const dl = pick(p => p.unit !== 'O' && (p.pos === 'DT' || p.pos === 'DE')); const lb = pick(p => p.pos === 'LB'); const cb = pick(p => p.pos === 'CB'); const sf = pick(p => p.pos === 'S');
  const wr = pick(p => p.pos === 'WR'); const qb = pick(p => p.pos === 'QB' && p.unit === 'O'); const rb = pick(p => p.pos === 'RB'); const te = pick(p => p.pos === 'TE');
  for (const [nm, p] of [['OT', ot], ['DL', dl], ['LB', lb], ['CB', cb], ['S', sf], ['WR', wr], ['QB', qb], ['RB', rb], ['TE', te]]) {
    if (!p) continue;
    await frame(`${T}_stance_${nm}_34`, p.id, 'pelvis', 2.4, 1.7, 0.3, 40, -0.1);
    await frame(`${T}_stance_${nm}_side`, p.id, 'pelvis', 0.2, 3.0, 0.1, 38, -0.1);
  }
  for (const [nm, p] of [['QB', qb], ['OT', ot], ['DL', dl], ['WR', wr], ['LB', lb]]) {
    if (!p) continue;
    await frame(`${T}_helm_${nm}_front34`, p.id, 'head', 0.85, 0.5, 0.15, 30);
    await frame(`${T}_helm_${nm}_side`, p.id, 'head', 0.05, 1.0, 0.05, 30);
    await frame(`${T}_helm_${nm}_backtop`, p.id, 'head', -0.75, 0.35, 0.6, 30);
  }
  if (ot) { await frame(`${T}_hand_OT_down`, ot.id, 'hand0', 0.55, 0.45, 0.25, 30); await frame(`${T}_hand_OT_knee`, ot.id, 'hand1', 0.55, -0.45, 0.2, 30); await frame(`${T}_pads_OT_front`, ot.id, 'chest', 1.4, 0.3, 0.9, 36); await frame(`${T}_pads_OT_back`, ot.id, 'chest', -1.4, 0.3, 1.0, 36); }
  if (dl) { await frame(`${T}_pads_DL_front`, dl.id, 'chest', 1.4, -0.3, 0.9, 36); await frame(`${T}_pads_DL_back`, dl.id, 'chest', -1.4, 0.3, 1.0, 36); }
  if (qb) await frame(`${T}_hand_QB_ready`, qb.id, 'hand0', 0.6, 0.5, 0.15, 30);
  if (C) await frame(`${T}_pads_C_top`, C.id, 'chest', -0.6, 0.0, 1.6, 40);
  // the snap: stance ease-out burst (33 ms steps), side view of the line
  await page.evaluate(() => { R3D.camOverride = null; MATCH._G.play.snap(); });
  await page.evaluate(() => __spot([7, 2.2, -1], [0, 0.8, 0.5], 42));
  for (let k = 0; k < 18; k++) { await rafs(); const st = await page.evaluate(() => { const pl = MATCH._G.play; return { t: +pl.liveT.toFixed(3), stK: pl.O.filter(p => p.ol).map(p => +(p.stK || 0).toFixed(2)).join(',') }; }); await shot(`${T}_snap_side_${String(k).padStart(2, '0')}`, st); await page.evaluate(() => __adv(33)); }
  // blocks
  for (const at of [0.9, 1.4]) {
    const now = await page.evaluate(() => MATCH._G.play.liveT); if (at > now) await page.evaluate(ms => __adv(ms), (at - now) * 1000);
    const tag = `${T}_live${String(at).replace('.', '')}`;
    if (await page.evaluate(() => MATCH._G.play.phase) !== 'live') break;
    await spot(`${tag}_blocks_side`, [7, 2.2, -1], [0, 0.9, 0], 40);
    await spot(`${tag}_blocks_front`, [1.5, 1.8, 3.5], [0, 1.0, -0.5], 34);
    await spot(`${tag}_blocks_top`, [0.5, 6.5, -2.5], [0, 0.5, 0.5], 40);
    const pairs = await page.evaluate(() => MATCH._G.play.players.filter(p => p.bond && p.upright()).map(p => ({ a: p.id, b: p.bond.id, pos: p.rp && p.rp.pos })));
    log.push({ tag, pairs });
    for (const [i, pr] of pairs.slice(0, 3).entries()) {
      await frame(`${tag}_pair${i}_side`, pr.a, 'chest', 0.4, 2.2, 0.0, 34);
      await frame(`${tag}_pair${i}_hands`, pr.a, 'hand0', 0.2, 0.9, 0.35, 30);
    }
  }
  await page.evaluate(() => { R3D.camOverride = null; MATCH._G.paused = false; });
  for (let i = 0; i < 300; i++) { const s = await page.evaluate(() => MATCH._G.stage); if (s !== 'live' && s !== 'pre') break; await page.waitForTimeout(100); }
}
log.push({ stats: await page.evaluate(() => R3D.stats()), coarse: await page.evaluate(() => R3D.coarse) });
await done();
