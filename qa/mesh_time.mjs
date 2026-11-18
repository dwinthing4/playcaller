// Times the Character Lab sculpting (SDF -> surface nets) for every body archetype, head and helmet.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const files = ['core', 'engine'].flatMap(d => fs.readdirSync(path.join(root, 'src', d)).filter(f => f.endsWith('.js')).sort().map(f => path.join(root, 'src', d, f))).concat([path.join(root, 'src/render/10_models.js')]);
const code = '"use strict";\n' + files.map(f => fs.readFileSync(f, 'utf8')).join('\n') + '\n;({PHYS, R3D});';
const E = vm.runInContext(code, vm.createContext({ console, Math, Date, JSON }), { filename: 'm.js' });
const M = E.R3D._;
const res = +(process.argv[2] || 0.016);
const ARCH = { QB: [75, 225, 0.55, 'sleek'], WR: [73, 198, 0.6, 'sleek'], RB: [70, 218, 0.85, 'speed'], TE: [77, 255, 0.7, 'speed'], OL: [77, 315, 0.35, 'trench'], DL: [76, 290, 0.55, 'trench'], LB: [74, 245, 0.8, 'speed'], DB: [71, 196, 0.62, 'sleek'], K: [72, 200, 0.4, 'sleek'] };
let tot = 0;
for (const [k, a] of Object.entries(ARCH)) {
  const t0 = performance.now(); const m = M.makeBodyModel({ heightIn: a[0], weightLb: a[1], muscle: a[2], pads: a[3], arms: { L: { item: 'tape', wrist: 'tape' }, R: { item: 'pad', wrist: 'band' } }, res }); const out = M.meshSDF(m); const dt = performance.now() - t0; tot += dt;
  console.log(k.padEnd(3), `${dt.toFixed(0)} ms`, `verts ${out.count}`, `tris ${out.index.length / 3}`);
}
for (const s of ['sleek', 'speed', 'classic', 'pro']) { const t0 = performance.now(); const out = M.meshSDF(M.makeHelmetModel({ kind: s, stripe: 'single', logo: true, res: res * 0.42 })); const dt = performance.now() - t0; tot += dt; console.log('helm', s, `${dt.toFixed(0)} ms`, `tris ${out.index.length / 3}`); }
{ const t0 = performance.now(); const out = M.meshSDF(M.makeHeadModel({ headScale: 1, res: res * 0.42 })); const dt = performance.now() - t0; tot += dt; console.log('head', `${dt.toFixed(0)} ms`, `tris ${out.index.length / 3}`); }
console.log('total', tot.toFixed(0), 'ms');
