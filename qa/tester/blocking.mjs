import { SNAP_CODE } from './snapcode.mjs';
// Blocking coverage: at 0.8 s and 1.8 s after the snap, how many offensive linemen / blocking TEs-FBs are in a block,
// and how many down linemen are unblocked? Run vs pass.
import fs from 'fs'; import vm from 'vm';
import { starters, makeTeam } from '../engine_lib.mjs';
const code = SNAP_CODE;
const E = vm.runInContext(code, vm.createContext({ console, Math, Date, JSON })); const { PHYS } = E; const DT = 1 / 120, YD = 0.9144;
const book = E.buildPlaybook(), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D'); const pick = a => a[Math.floor(Math.random() * a.length)];
for (const type of ['run', 'pass']) { const offs = book.filter(p => p.side === 'O' && p.type === type && p.form !== 'Goal Line' && !/Screen|Kneel/.test(p.name));
  const acc = { 0.8: { ol: 0, olN: 0, dlFree: 0, dlN: 0, idleBlk: 0, blkN: 0 }, 1.8: { ol: 0, olN: 0, dlFree: 0, dlN: 0, idleBlk: 0, blkN: 0 } };
  for (let i = 0; i < 200; i++) { const op = pick(offs), dp = pick(defs);
    const pl = new PHYS.Play({ losZ: 30 * YD, ballX: 0, down: 1, togo: 10, op, dp, off: { tid: 0, list: starters(E, makeTeam(72), op.form, 'O'), bonus: 0 }, def: { tid: 1, list: starters(E, makeTeam(72), dp.form, 'D'), bonus: 0 }, userSide: null, diff: 'pro', seed: (Math.random() * 1e9) | 0 });
    let n = 0; while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); } if (pl.phase === 'pre') pl.goLive();
    const marks = [0.8, 1.8]; let m = 0;
    while (pl.phase === 'live' && m < 3600 && marks.length) { pl.step(DT); m++; if (m % 4 === 0) pl.updatePoses();
      if (pl.liveT >= marks[0]) { const k = marks.shift(), A = acc[k];
        for (const o of pl.O) { if (!o.ol) continue; A.olN++; if (o.bond) A.ol++; }
        for (const o of pl.O) { if (o.ol || o === pl.qb || o === pl.carrier || o.role === 'route' || o.role === 'rb') continue; A.blkN++; if (!o.bond) A.idleBlk++; }
        for (const d of pl.D) { if (!d.dl) continue; A.dlN++; if (!d.bondBy && d.upright()) A.dlFree++; } } } }
  for (const k of ['0.8', '1.8']) { const A = acc[k]; console.log(`${type} @${k}s: OL in a block ${(A.ol / A.olN * 100).toFixed(0)}%, other assigned blockers (TE/FB/WR/pass-pro) not in a block ${(A.idleBlk / Math.max(1, A.blkN) * 100).toFixed(0)}% of ${A.blkN}, down linemen unblocked ${(A.dlFree / A.dlN * 100).toFixed(0)}%`); } }
