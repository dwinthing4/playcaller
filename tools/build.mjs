// Build: concatenate src/** into one self-contained HTML file (dist/playcaller.html).
// Order: core -> league -> engine -> render -> match -> ui -> main.js. Files inside a folder are sorted by name.
// Also writes dist/sim.cjs (core + league + engine only) so node tests can run the physics and league headless.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const src = p => path.join(root, 'src', p);
// --skip=engine,render,match lets one part be built while another is mid-edit
const SKIP = (process.argv.find(a => a.startsWith('--skip=')) || '').slice(7).split(',').filter(Boolean);
const DIRS = ['core', 'league', 'engine', 'render', 'match', 'ui'].filter(d => !SKIP.includes(d));
const list = d => fs.existsSync(src(d)) ? fs.readdirSync(src(d)).filter(f => f.endsWith('.js')).sort().map(f => path.join(d, f)) : [];
const files = DIRS.flatMap(list).concat(fs.existsSync(src('main.js')) ? ['main.js'] : []);
const read = f => `\n/* ===== ${f.replace(/\\/g, '/')} ===== */\n` + fs.readFileSync(src(f), 'utf8');
const app = '"use strict";\n' + files.map(read).join('\n');
// compile check: catches syntax errors and duplicate top-level declarations across files
try { new vm.Script(app, { filename: 'app.js' }); }
catch (e) {
  const m = /app\.js:(\d+)/.exec(e.stack || ''); let where = '';
  if (m) { const ln = +m[1], lines = app.split('\n'); let f = '?'; for (let i = ln - 1; i >= 0; i--) { const h = /^\/\* ===== (.+) ===== \*\/$/.exec(lines[i]); if (h) { f = h[1] + ' (line ' + (ln - i - 1) + ')'; break; } } where = ' in ' + f; }
  console.error('BUILD FAILED' + where + ': ' + e.message); process.exit(1);
}
const css = ['shell', 'ui'].flatMap(d => fs.existsSync(src(d)) ? fs.readdirSync(src(d)).filter(f => f.endsWith('.css')).sort().map(f => fs.readFileSync(src(path.join(d, f)), 'utf8')) : []).join('\n');
const three = fs.readFileSync(path.join(root, 'vendor', 'three.min.js'), 'utf8');
let html = fs.readFileSync(src('shell/index.html'), 'utf8');
html = html.replace('/*@@CSS@@*/', () => css).replace('/*@@THREE@@*/', () => three).replace('/*@@APP@@*/', () => app);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'playcaller.html'), html);
// headless bundle for tests (no DOM, no three.js)
const simFiles = ['core', 'league', 'engine'].flatMap(list);
const sim = '"use strict";\n' + simFiles.map(read).join('\n') + '\nmodule.exports = { PHYS: typeof PHYS !== "undefined" ? PHYS : null, LG: typeof LG !== "undefined" ? LG : null, FB: typeof FB !== "undefined" ? FB : null, U: typeof U !== "undefined" ? U : null };\n';
fs.writeFileSync(path.join(root, 'dist', 'sim.cjs'), sim);
console.log(`built dist/playcaller.html  ${(html.length / 1024).toFixed(0)} KB  (${files.length} source files)`);
