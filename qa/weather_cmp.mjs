// Weather in the engine: the same plays in clear, rain, snow and a strong wind. Effects should be noticeable but modest.
// usage: node qa/weather_cmp.mjs [pairs]
import { loadEngine, makeTeam, playOpts } from './engine_lib.mjs';
const E = loadEngine();
const book = E.buildPlaybook(), runs = book.filter(p => p.side === 'O' && p.type === 'run' && p.form !== 'Goal Line'), passes = book.filter(p => p.side === 'O' && p.type === 'pass' && p.form !== 'Goal Line'), defs = book.filter(p => p.side === 'D' && p.form !== 'Goal Line D');
const N = +process.argv[2] || 300;
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
for (const [name, wx] of [['clear', null], ['rain', { weather: 'rain', temp: 45 }], ['snow', { weather: 'snow', temp: 25 }], ['wind20', { weather: 'clear', wind: { x: 6.3, z: -6.3 }, temp: 50 }]]) {
  seed = 777; let ry = 0, rn = 0, pa = 0, pc = 0, py = 0, fum = 0, drop = 0, slips = 0, intc = 0, deepA = 0, deepC = 0;
  for (let i = 0; i < N; i++) {
    const offR = makeTeam(72, rnd, 'O'), defR = makeTeam(72, rnd, 'D');
    for (const kind of ['run', 'pass']) {
      const op = pick(kind === 'run' ? runs : passes), dp = pick(defs);
      const o = playOpts(E, offR, defR, op, dp, { seed: (rnd() * 1e9) | 0 }); if (wx) { o.wx = wx; o.weather = wx.weather; }
      const res = E.PHYS.runPlay(o, pl => { for (const p of pl.players) if (p.slipped) slips++; });
      if (kind === 'run') { rn++; ry += res.yards || 0; }
      else if (res.type !== 'sack') { pa++; const caught = res.catcher != null && res.turnover !== 'int'; if (caught) { pc++; py += res.yards || 0; } if (/drops|fingertips/.test(res.text || '')) drop++; if (res.turnover === 'int') intc++; if (op.deep) { deepA++; if (caught) deepC++; } }
      if (res.fumbler != null) fum++;
    }
  }
  console.log(`${name.padEnd(7)} ypc ${(ry / rn).toFixed(2)}  comp ${(pc / pa * 100).toFixed(1)}%  deep comp ${(deepC / Math.max(1, deepA) * 100).toFixed(1)}%  ypa ${(py / pa).toFixed(2)}  drops ${(drop / pa * 100).toFixed(1)}%  int ${(intc / pa * 100).toFixed(1)}%  fumbles/play ${(fum / (2 * N) * 100).toFixed(2)}%  slips/play ${(slips / (2 * N)).toFixed(2)}`);
}
