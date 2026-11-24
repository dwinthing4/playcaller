// Shared helpers. Everything in src/ is concatenated into one script, so these names are global.
// Do not redeclare them elsewhere (engine/render/match code lives inside IIFEs and may shadow them).
let R_SRC = Math.random;                 // what R draws from: Math.random, or a seeded generator inside withSeed() (the daily drive builds the same league for everyone)
const R = () => R_SRC();
const rnd = (a, b) => a + R() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[Math.floor(R() * a.length)];
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) * 1.414; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sum = a => a.reduce((s, v) => s + v, 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = m => '$' + (Math.round(m * 10) / 10).toFixed(1) + 'M';
const YD = 0.9144;                       // meters per yard (engine works in meters)
// seeded generator (mulberry32) for reproducible plays and tests
function seededRng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// run fn with R (and everything built on it: rnd, ri, pick, gauss, shuffle) drawing from a seeded generator, then put Math.random back
function withSeed(seed, fn) { const prev = R_SRC; R_SRC = seededRng(seed); try { return fn(); } finally { R_SRC = prev; } }
// small namespace for helpers other modules may want to reach explicitly
const U = { R, rnd, ri, clamp, lerp, pick, gauss, shuffle, sum, esc, money, YD, seededRng };
