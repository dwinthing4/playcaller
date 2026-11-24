// Writes docs/sample-roster.json: two made-up teams with drawn logos, players and two placeholder photos.
// run: node tools/sample_roster.cjs
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const out = path.join(__dirname, '..', 'docs', 'sample-roster.json');
function pngRGBA(w, h, px) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = px(x, y), o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = c[3]; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// a round emblem: ring in c2, field in c1, a chevron in c2
const logo = (c1, c2) => { const A = hex(c1), B = hex(c2); return pngRGBA(64, 64, (x, y) => { const dx = x - 31.5, dy = y - 31.5, r = Math.hypot(dx, dy); if (r > 30) return [0, 0, 0, 0]; if (r > 26) return [...B, 255]; if (r > 24) return [20, 20, 24, 255];
  const chev = Math.abs(dx) * 0.9 + 6 > (dy + 14) && Math.abs(dx) * 0.9 - 2 < (dy + 14) && dy < 12; return chev ? [...B, 255] : [...A, 255]; }); };
// a placeholder head-and-shoulders silhouette (stands in for a photo the user would add)
const photo = (bg, fg) => { const A = hex(bg), B = hex(fg); return pngRGBA(48, 48, (x, y) => { const head = Math.hypot(x - 24, y - 18) < 9, body = y > 30 && Math.hypot((x - 24) * 0.75, y - 50) < 16; return head || body ? [...B, 255] : [...A, 255]; }); };
const P = (first, last, pos, num, age, ovr, extra) => Object.assign({ first, last, pos, num, age, ratings: ovr ? { ovr } : undefined }, extra || {});
const file = {
  format: 'playcaller-roster', version: 1, name: 'Sample: two made-up teams', author: 'Playcaller', created: '2026-11-24',
  note: 'Everyone in this file is made up. Players are listed in depth-chart order within each position. Ratings are optional.',
  teams: [
    { abbr: 'HBR', city: 'Harbor City', name: 'Gulls', colors: { primary: '#1d3478', secondary: '#f2c230', helmet: '#1d3478' }, logo: logo('#1d3478', '#f2c230'),
      coach: { first: 'Dana', last: 'Whitfield' }, oc: { first: 'Marco', last: 'Bellamy' }, dc: { first: 'Ruth', last: 'Okafor' },
      players: [
        P('Jordan', 'Example', 'QB', 12, 27, 82, { photo: photo('#2a3d7a', '#c9b68a'), comp: 'A pocket passer who wins with timing' }),
        P('Casey', 'Placeholder', 'QB', 7, 24, 66),
        P('Mason', 'Sample', 'RB', 26, 25, 78, { photo: photo('#2a3d7a', '#8a6a4a') }),
        P('Theo', 'Fictional', 'WR', 11, 26, 80, { comp: 'Quick feet, strong hands in traffic' }),
        P('Avery', 'Madeup', 'WR', 84, 23, 72),
        P('Quinn', 'Notreal', 'TE', 88, 28, 74),
        P('Rowan', 'Testcase', 'OT', 71, 29, 79),
        P('Emery', 'Draftman', 'DE', 94, 25, 81),
        P('Sasha', 'Inventa', 'LB', 52, 27, 77),
        P('Blake', 'Storybook', 'CB', 24, 24, 76),
        P('Kai', 'Lorem', 'S', 31, 26),
        P('Drew', 'Ipsum', 'K', 3, 30, 75)
      ] },
    { abbr: 'PRE', city: 'Pine Ridge', name: 'Elks', colors: { primary: '#2f5d3a', secondary: '#f2efe6', helmet: '#24472c' }, logo: logo('#2f5d3a', '#f2efe6'),
      coach: { first: 'Glen', last: 'Harrow' },
      players: [
        P('Riley', 'Imaginary', 'QB', 9, 30, 79),
        P('Morgan', 'Pretend', 'HB', 22, 23, 74),
        P('Jesse', 'Nobody', 'WR', 1, 25, 77),
        P('Parker', 'Unknown', 'LT', 77, 31, 76),
        P('Reese', 'Anon', 'EDGE', 91, 26, 80),
        P('Hayden', 'Fakename', 'MLB', 45, 28, 75),
        P('Skyler', 'Mockup', 'FS', 29, 24, 73),
        P('Logan', 'Standin', 'P', 8, 27)
      ] }
  ]
};
fs.writeFileSync(out, JSON.stringify(file, null, 1) + '\n');
console.log('wrote', out, fs.statSync(out).size, 'bytes');
