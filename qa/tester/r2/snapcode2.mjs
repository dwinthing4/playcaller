// core + league + engine source extracted from a frozen snapshot (default dist/playcaller_qa2.html), by module markers,
// so headless checks run exactly the engine that is played in the browser.
import fs from 'fs';
const file = process.env.PC_HTML || 'playcaller_qa2.html';
const src = fs.readFileSync('C:/Users/dwint/football-game/dist/' + file, 'utf8');
const a = src.indexOf('/* ===== core/00_util.js ===== */'), b = src.indexOf('/* ===== render/10_models.js ===== */');
if (a < 0 || b < 0) throw new Error('markers not found');
export const SNAP_CODE = '"use strict";\n' + src.slice(a, b) + '\n;({PHYS, FB, U, buildPlaybook});';
