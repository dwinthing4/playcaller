// core + league + engine source extracted from the FROZEN snapshot dist/playcaller_qa.html (lines 294-3328),
// so headless checks run exactly the engine that was played in the browser.
import fs from 'fs';
const lines = fs.readFileSync('C:/Users/dwint/football-game/dist/playcaller_qa.html', 'utf8').split('\n');
export const SNAP_CODE = '"use strict";\n' + lines.slice(293, 3328).join('\n') + '\n;({PHYS, FB, U, buildPlaybook});';
