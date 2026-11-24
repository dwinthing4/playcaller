// ============================================================
//  SOUND (SND): the stadium, synthesized with the Web Audio API. No sound files and nothing fetched: every noise is made here.
//  - Crowd bed: filtered noise + a murmur of voices (made once, in code) + applause. It follows the crowd meter (RULES.noise via the
//    match's condHud), swells on big plays, groans on home turnovers, hushes for the home offense and in the huddle, goes near silent
//    after a road score. A dome is louder and boomier (a longer, darker reverb).
//  - On the field: pads and helmets (engine impulses), the pile hitting the turf, catches, kicks, the officials' whistles, the flag.
//  - At the line: the QB's "set... hut" (formant-filtered pulse + noise), quiet, buried by a loud crowd; a road QB in a loud building
//    goes on a silent count. A hard count barks long (SND.on('hardcount') or PHYS.onEvent('hardcount')).
//  - Moments: the stadium horn on home scores, the end-of-quarter horn, a short broadcast sting on touchdowns (Settings toggle).
//  - Weather: rain and gusting wind from the match's VENUE conditions.
//  Hooks: the engine calls PHYS.onEvent(kind, play, info) (set below; node never sets it, so dist/sim.cjs stays silent). The match
//  calls SND.frame(G, dt) every frame, SND.crowd(n) with the crowd meter and SND.on('close'). Scores, quarters, flags, kicks in the
//  air, pause and sim speed are read off the match state G.
//  Safety: conservative gains, every envelope starts and ends at zero, voices capped and disconnected when done, a limiter and a
//  soft clip on the master, audio unlocked on the first tap, suspended when hidden, paused, idle or switched off.
// ============================================================
const SND = (() => {
const W = typeof window !== 'undefined' ? window : null;
const AC = W && (W.AudioContext || W.webkitAudioContext), OAC = W && (W.OfflineAudioContext || W.webkitOfflineAudioContext);
const MAXV = 30;                                  // one-shot voices alive at once (hits and crowd grains give way first)
const YDm = typeof YD !== 'undefined' ? YD : 0.9144;
let A = null, M = null, babJob = null;
const BUF = {};                                   // shared buffers (usable by any context, live or offline)
const dbg = { made: 0, ended: 0, dropped: 0, forced: 0, peakV: 0, peakN: 0, events: 0, meter: null };
const S = () => (typeof L !== 'undefined' && L && L.settings) || {};
const num = (v, d, lo, hi) => (v == null || v === '' || isNaN(+v) ? d : clamp(+v, lo, hi));
const isOn = () => S().sound !== false;
const vol = () => num(S().vol, 0.7, 0, 1), crowdVol = () => num(S().crowdVol, 1, 0, 1.5);
const now = () => (A ? A.ctx.currentTime : 0);
const running = () => !!A && A.ctx.state === 'running';
const hiddenDoc = () => typeof document !== 'undefined' && !!document.hidden;
const liveG = () => (typeof MATCH !== 'undefined' && MATCH._G) || null;

// ------------------------------------------------------------ buffers: noise, applause, rain, the murmur, reverbs
function normRms(b, target) {
  let s = 0, n = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) s += d[i] * d[i]; n += d.length; }
  const k = target / Math.sqrt(s / Math.max(1, n) || 1e-12); for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } return b;
}
function whiteBuf(ctx) { const b = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
// pink noise (Paul Kellet's filter), stereo, the end blended into the start so the loop has no seam
function pinkBuf(ctx, sec, sr) {
  const n = Math.round(sec * sr), F = Math.round(sr * 0.3), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c), tmp = new Float32Array(n + F); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n + F; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; tmp[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; }
    for (let i = 0; i < n; i++) d[i] = tmp[i];
    for (let i = 0; i < F; i++) { const u = i / F; d[i] = tmp[i] * Math.sin(u * Math.PI / 2) + tmp[n + i] * Math.cos(u * Math.PI / 2); }
  }
  return normRms(b, 0.25);
}
// RBJ band-pass coefficients (0 dB peak): [b0, b2, a1, a2]
function bpK(f, Q, sr) { const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * Q), a0 = 1 + al; return [al / a0, -al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0]; }
// applause: thousands of hands at a distance, a dense crackle of short resonant noise bursts (wrapped, so it loops clean)
function clapBuf(ctx, sec, sr, rate) {
  const n = Math.round(sec * sr), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c), m = Math.round(sec * rate);
    for (let k = 0; k < m; k++) {
      const t0 = Math.floor(Math.random() * n), len = Math.round(sr * (0.008 + Math.random() * 0.012)), tau = sr * (0.0012 + Math.random() * 0.0028), amp = Math.pow(Math.random(), 1.6), q = bpK(700 + Math.random() * 2200, 1.4, sr);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < len; i++) { const x = (Math.random() * 2 - 1) * Math.exp(-i / tau), y = q[0] * x + q[1] * x2 - q[2] * y1 - q[3] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; d[(t0 + i) % n] += y * amp; }
    }
  }
  return normRms(b, 0.25);
}
// rain on a stadium: a hiss plus the patter of drops (pareto-ish sizes), wrapped
function rainBuf(ctx, sec, sr) {
  const n = Math.round(sec * sr), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; lp += 0.35 * (w - lp); d[i] = (w - lp) * 0.35; }
    const m = Math.round(sec * 1100);
    for (let k = 0; k < m; k++) { const t0 = Math.floor(Math.random() * n), amp = Math.pow(Math.random(), 3) * 1.6, tau = sr * (0.00015 + Math.random() * 0.0006), len = Math.round(tau * 6); let prev = 0;
      for (let i = 0; i < len; i++) { const x = (Math.random() * 2 - 1) * Math.exp(-i / tau) * amp; d[(t0 + i) % n] += x - prev * 0.6; prev = x; } }
  }
  return normRms(b, 0.25);
}
// the murmur of the stands: a few hundred voices of chatter (a buzzy pulse through two vowel formants, syllable by syllable),
// rendered in plain JS a few voices at a time so the page never stalls; wrapped so the loop is seamless
const VOWELS = [[730, 1090], [530, 1840], [300, 2200], [570, 840], [330, 900], [660, 1720], [490, 1350], [640, 1190], [450, 1500]];
function babbleGrain(d0, d1, n, sr) {
  const male = Math.random() < 0.6, f0 = male ? 100 + Math.random() * 65 : 180 + Math.random() * 90, pan = Math.random() * 1.9 - 0.95, gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4), amp = 0.35 + Math.random() * 0.65;
  let t = Math.random() * (n / sr), f = f0, ph = Math.random(); const ns = 2 + Math.floor(Math.random() * 5);
  for (let s = 0; s < ns; s++) {
    const dur = 0.09 + Math.random() * 0.16, v = VOWELS[Math.floor(Math.random() * VOWELS.length)], q1 = bpK(v[0] * (0.9 + Math.random() * 0.2) * (male ? 1 : 1.12), 5, sr), q2 = bpK(v[1] * (0.9 + Math.random() * 0.2) * (male ? 1 : 1.12), 7, sr);
    const i0 = Math.round(t * sr), len = Math.round(dur * sr), fA = f * (0.95 + Math.random() * 0.15), fB = fA * (0.84 + Math.random() * 0.18);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;
    for (let k = 0; k < len; k++) {
      const u = k / len; ph += (fA + (fB - fA) * u) / sr; if (ph >= 1) ph -= 1;
      const x = (2 * ph - 1) + (Math.random() * 2 - 1) * 0.3;
      const y = q1[0] * x + q1[1] * x2 - q1[2] * y1 - q1[3] * y2, z = q2[0] * x + q2[1] * x2 - q2[2] * z1 - q2[3] * z2; x2 = x1; x1 = x; y2 = y1; y1 = y; z2 = z1; z1 = z;
      const e = u < 0.14 ? u / 0.14 : u > 0.7 ? (1 - u) / 0.3 : 1, o = (y + 0.75 * z) * e * amp, idx = (i0 + k) % n;
      d0[idx] += o * gl; d1[idx] += o * gr;
    }
    t += dur + 0.015 + Math.random() * 0.08; f = fB;
  }
}
function babbleStart(ctx, sync) {
  if (BUF.babble || babJob) return; const sec = 8, sr = 16000, n = sec * sr;
  babJob = { d0: new Float32Array(n), d1: new Float32Array(n), n, sr, left: 240 };
  const step = () => { const J = babJob; if (!J) return; for (let k = 0; k < 24 && J.left > 0; k++, J.left--) babbleGrain(J.d0, J.d1, J.n, J.sr);
    if (J.left > 0) { if (!sync) setTimeout(step, 16); return; }
    try { const b = ctx.createBuffer(2, J.n, J.sr); b.getChannelData(0).set(J.d0); b.getChannelData(1).set(J.d1); BUF.babble = normRms(b, 0.25); } catch (e) { console.error(e); }
    babJob = null; };
  if (sync) { while (babJob) step(); } else setTimeout(step, 30);
}
// a reverb: decaying noise that darkens as it dies, the far stands answering with a slap or two (open air), or a long boomy tail (dome)
function irBuf(ctx, dome) {
  const sr = ctx.sampleRate, rt = dome ? 3.1 : 1.45, n = Math.round((rt * 1.02 + 0.1) * sr), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c), pre = Math.round(sr * (0.011 + c * 0.005)); let lp = 0;
    for (let i = pre; i < n; i++) { const t = (i - pre) / sr, fc = dome ? 700 + 3300 * Math.exp(-t / 0.55) : 1300 + 7500 * Math.exp(-t / 0.3), a = 1 - Math.exp(-2 * Math.PI * fc / sr);
      lp += a * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.sqrt(fc / 2000) * Math.exp(-6.91 * t / rt) * (t < 0.005 ? t / 0.005 : 1); }
    if (!dome) for (const [at, g] of [[0.27 + c * 0.017, 0.5], [0.55 + c * 0.023, 0.22]]) { const i0 = Math.round(at * sr), m = Math.round(sr * 0.035); for (let k = 0; k < m && i0 + k < n; k++) d[i0 + k] += (Math.random() * 2 - 1) * g * Math.exp(-k / (sr * 0.009)) * Math.min(1, k / (sr * 0.002)); }
    let E = 0; for (let i = 0; i < n; i++) E += d[i] * d[i]; const s = 1 / Math.sqrt(E || 1); for (let i = 0; i < n; i++) d[i] *= s;
  }
  return b;
}
function prep(ctx, sync) {
  if (!BUF.white) BUF.white = whiteBuf(ctx);
  const rest = () => { if (!BUF.pink) BUF.pink = pinkBuf(ctx, 6, 22050); if (!BUF.clap) BUF.clap = clapBuf(ctx, 4, 22050, 360); babbleStart(ctx, sync); };
  if (sync) rest(); else setTimeout(rest, 40);
}
const irFor = (ctx, dome) => { const k = (dome ? 'irD' : 'irO') + ctx.sampleRate; return BUF[k] || (BUF[k] = irBuf(ctx, dome)); };
let curve0 = null;
function softCurve() { if (curve0) return curve0; const n = 4096, c = new Float32Array(n), k = 0.72; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); c[i] = Math.sign(x) * (a <= k ? a : k + (1 - k) * 0.98 * Math.tanh((a - k) / (1 - k))); } return (curve0 = c); }
const kRate = x => { try { x.frequency.automationRate = 'k-rate'; x.Q.automationRate = 'k-rate'; x.gain.automationRate = 'k-rate'; } catch (e) { } return x; };
const PW = new WeakMap();
function voiceWave(ctx) { let w = PW.get(ctx); if (w) return w; const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let h = 1; h < n; h++) im[h] = Math.pow(h, -1.2) * (h % 2 ? 1 : 0.85); w = ctx.createPeriodicWave(re, im); PW.set(ctx, w); return w; }

// ------------------------------------------------------------ the bus: sfx + crowd + weather -> master volume -> limiter -> soft clip
function makeBus(ctx, dome, raw) {
  const B = { ctx, voices: new Set(), nodes: 0, dome: !!dome, busyUntil: 0, idleSince: 0 };
  B.master = ctx.createGain(); B.master.gain.value = 0;
  B.lim = ctx.createDynamicsCompressor(); B.lim.threshold.value = -6; B.lim.knee.value = 3; B.lim.ratio.value = 20; B.lim.attack.value = 0.002; B.lim.release.value = 0.2;
  B.clip = ctx.createWaveShaper(); B.clip.curve = softCurve();
  if (raw) B.master.connect(ctx.destination); else { B.master.connect(B.lim); B.lim.connect(B.clip); B.clip.connect(ctx.destination); }
  B.sfx = ctx.createGain(); B.sfx.connect(B.master);
  B.crowd = ctx.createGain(); B.cLow = ctx.createBiquadFilter(); B.cLow.type = 'lowshelf'; B.cLow.frequency.value = 230; B.cLow.gain.value = dome ? 5 : 0;
  B.cHigh = ctx.createBiquadFilter(); B.cHigh.type = 'highshelf'; B.cHigh.frequency.value = 3200; B.cHigh.gain.value = 0;
  B.crowd.connect(B.cLow); B.cLow.connect(B.cHigh); B.cHigh.connect(B.master);
  B.wx = ctx.createGain(); B.wx.connect(B.master);
  B.send = ctx.createGain(); B.ret = ctx.createGain(); B.ret.gain.value = 1; B.ret.connect(B.master);
  B.verb = ctx.createConvolver(); B.verb.normalize = false; B.verb.buffer = irFor(ctx, dome); B.send.connect(B.verb); B.verb.connect(B.ret);
  B.cSend = ctx.createGain(); B.cSend.gain.value = 0.16; B.cSend.connect(B.send); if (dome) B.cHigh.connect(B.cSend);      // the crowd in the room: a dome booms (open air: the reverb rests between effects)
  return B;
}
function setVenue(B, dome) {
  dome = !!dome; B.cLow.gain.setTargetAtTime(dome ? 5 : 0, B.ctx.currentTime, 0.3); if (B.dome === dome) return;
  try { if (dome) B.cHigh.connect(B.cSend); else B.cHigh.disconnect(B.cSend); } catch (e) { }
  const v = B.ctx.createConvolver(); v.normalize = false; v.buffer = irFor(B.ctx, dome); B.send.connect(v); v.connect(B.ret);
  try { B.send.disconnect(B.verb); B.verb.disconnect(); } catch (e) { } B.verb = v; B.dome = dome;
}

// ------------------------------------------------------------ one-shot voices: counted, capped, every node disconnected when the last source ends
function voice(B, prio) {
  const n = B.voices.size; if (n >= MAXV || (prio < 1 && n >= MAXV * 0.6) || (prio < 0 && n >= MAXV * 0.4)) { dbg.dropped++; return null; }
  const v = { B, nodes: [], srcs: 0, end: 0, t0: B.ctx.currentTime }; B.voices.add(v); dbg.made++; dbg.peakV = Math.max(dbg.peakV, B.voices.size); return v;
}
function free(v) { if (!v.B.voices.has(v)) return; v.B.voices.delete(v); for (const x of v.nodes) { try { x.disconnect(); } catch (e) { } } v.B.nodes -= v.nodes.length; v.nodes.length = 0; dbg.ended++; }
const nd = (v, x) => { v.nodes.push(x); v.B.nodes++; dbg.peakN = Math.max(dbg.peakN, v.B.nodes); return x; };
const fin = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
const gn = (v, g) => { const x = nd(v, v.B.ctx.createGain()); x.gain.value = fin(g, 0); return x; };
const fl = (v, type, f, Q, gain) => { const x = kRate(nd(v, v.B.ctx.createBiquadFilter())); x.type = type; x.frequency.value = f; if (Q != null) x.Q.value = Q; if (gain != null) x.gain.value = gain; return x; };
const os = (v, type, f) => { const x = nd(v, v.B.ctx.createOscillator()); if (type === 'voice') x.setPeriodicWave(voiceWave(v.B.ctx)); else x.type = type; x.frequency.value = f; return x; };
const pn = (v, p) => { const c = v.B.ctx; if (!c.createStereoPanner) return gn(v, 1); const x = nd(v, c.createStereoPanner()); x.pan.value = clamp(fin(p, 0), -1, 1); return x; };
function run(v, x, t0, t1, off) { v.srcs++; v.end = Math.max(v.end, t1); x.onended = () => { if (--v.srcs <= 0) free(v); }; if (off != null) x.start(t0, off); else x.start(t0); x.stop(t1); return x; }
function noise(v, buf, t0, t1, rate) { const b = buf || BUF.white, x = nd(v, v.B.ctx.createBufferSource()); x.buffer = b; x.loop = true; if (rate) x.playbackRate.value = rate; return run(v, x, t0, t1, Math.random() * Math.max(0.01, b.duration - 0.05)); }
const chain = (...xs) => { for (let i = 0; i < xs.length - 1; i++) xs[i].connect(xs[i + 1]); return xs[xs.length - 1]; };
// the output of a voice: panned into the sfx bus, with a send to the stadium reverb
function out(v, pan, send) { const p = pn(v, pan); p.connect(v.B.sfx); if (send > 0) { const s = gn(v, send); p.connect(s); s.connect(v.B.send); } return p; }
// envelopes: from 0, up in att, an exponential fall to silence by len, exactly 0 at the end (no clicks)
function env(p, t, att, peak, len) { if (!(peak > 0)) { p.setValueAtTime(0, t); return; } const a = Math.max(0.0005, att), e = t + Math.max(a + 0.003, len); p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(Math.max(1e-6, peak * 0.001), e); p.linearRampToValueAtTime(0, e + 0.004); return e + 0.005; }
// a held tone: attack, hold, release
function ahr(p, t, att, peak, hold, rel) { const e = t + att + hold; p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att); p.setValueAtTime(peak, e); p.exponentialRampToValueAtTime(Math.max(1e-6, peak * 0.001), e + rel); p.linearRampToValueAtTime(0, e + rel + 0.004); return e + rel + 0.005; }

// ------------------------------------------------------------ the sounds (each takes a bus, a start time and options, so QA can render them offline)
const SFX = {};
// pads and helmets: a falling low thump (the bodies), a broadband crack (the pads), a ringing plastic clack (helmets). k: 0..1 impact
SFX.hit = (B, t, o = {}) => {
  const k = clamp(o.k != null ? o.k : 0.5, 0, 1), g0 = o.g != null ? o.g : 1, v = voice(B, o.prio != null ? o.prio : 0); if (!v) return;
  const g = gn(v, g0), dst = out(v, o.pan, 0.1 + 0.12 * k); g.connect(dst);
  const th = os(v, 'sine', 85 + 55 * k), tg = gn(v, 0); chain(th, tg, g); th.frequency.setValueAtTime(85 + 55 * k, t); th.frequency.exponentialRampToValueAtTime(46, t + 0.1);
  env(tg.gain, t, 0.002, 0.34 * (0.3 + 0.7 * k), 0.15 + 0.1 * k); run(v, th, t, t + 0.32);
  const bp = fl(v, 'bandpass', 600 + 650 * Math.random() + 350 * k, 0.85), ng = gn(v, 0); chain(bp, ng, g); noise(v, null, t, t + 0.16).connect(bp);
  env(ng.gain, t, 0.0008, 0.75 * (0.25 + 0.75 * k), 0.05 + 0.06 * k);
  if (o.helmet) { const b2 = fl(v, 'bandpass', 1900 + 1100 * Math.random(), 6), g2 = gn(v, 0); chain(b2, g2, g); noise(v, null, t, t + 0.09).connect(b2); env(g2.gain, t + 0.0015, 0.0006, 1.6 * k, 0.05); }
};
// the pile hitting the turf: a soft low thud
SFX.thud = (B, t, o = {}) => {
  const v = voice(B, -1); if (!v) return; const g = gn(v, o.g != null ? o.g : 1); g.connect(out(v, o.pan, 0.05));
  const th = os(v, 'sine', 70), tg = gn(v, 0); chain(th, tg, g); th.frequency.setValueAtTime(72, t); th.frequency.exponentialRampToValueAtTime(42, t + 0.14); env(tg.gain, t, 0.006, 0.22, 0.22); run(v, th, t, t + 0.3);
  const lp = fl(v, 'lowpass', 380, 0.7), ng = gn(v, 0); chain(lp, ng, g); noise(v, null, t, t + 0.2).connect(lp); env(ng.gain, t, 0.004, 0.5, 0.14);
};
// a catch: the ball into the hands and chest, a small soft thump
SFX.catch = (B, t, o = {}) => {
  const v = voice(B, 0); if (!v) return; const g = gn(v, o.g != null ? o.g : 1); g.connect(out(v, o.pan, 0.06));
  const th = os(v, 'sine', 175), tg = gn(v, 0); chain(th, tg, g); th.frequency.setValueAtTime(175, t); th.frequency.exponentialRampToValueAtTime(105, t + 0.05); env(tg.gain, t, 0.002, 0.2, 0.1); run(v, th, t, t + 0.16);
  const bp = fl(v, 'bandpass', 850, 1.1), ng = gn(v, 0); chain(bp, ng, g); noise(v, null, t, t + 0.06).connect(bp); env(ng.gain, t, 0.0008, 0.35, 0.035);
};
// a kick: the foot through the ball ("thock"), boomier for a punt, the stands answering
SFX.kick = (B, t, o = {}) => {
  const v = voice(B, 1); if (!v) return; const punt = o.kind === 'punt', g = gn(v, o.g != null ? o.g : 1); g.connect(out(v, o.pan, 0.3));
  const th = os(v, 'sine', punt ? 210 : 270), tg = gn(v, 0); chain(th, tg, g); th.frequency.setValueAtTime(punt ? 210 : 270, t); th.frequency.exponentialRampToValueAtTime(punt ? 95 : 125, t + 0.06); env(tg.gain, t, 0.001, 0.42, 0.13); run(v, th, t, t + 0.2);
  const bp = fl(v, 'bandpass', punt ? 1300 : 1750, 1.3), ng = gn(v, 0); chain(bp, ng, g); noise(v, null, t, t + 0.05).connect(bp); env(ng.gain, t, 0.0005, 0.9, 0.028);
  const bm = os(v, 'sine', 70), bg = gn(v, 0); chain(bm, bg, g); bm.frequency.setValueAtTime(76, t); bm.frequency.exponentialRampToValueAtTime(50, t + 0.2); env(bg.gain, t, 0.003, punt ? 0.24 : 0.14, 0.26); run(v, bm, t, t + 0.32);
};
// the referee's whistle: two close tones (a beat), a pea trill (FM + AM), breath noise, a chirp into the note
SFX.whistle = (B, t, o = {}) => {
  const v = voice(B, 2); if (!v) return; const f = o.f || 2900 + (Math.random() - 0.5) * 220, dur = o.dur || 0.42, lv = o.g != null ? o.g : 1, tr = o.trill != null ? o.trill : 1;
  const dst = out(v, o.pan || 0, 0.42), amp = gn(v, 0.78), eg = gn(v, 0); chain(amp, eg, dst);
  const o1 = os(v, 'sine', f), o2 = os(v, 'sine', f * 1.0068), o3 = os(v, 'sine', f * 2), m1 = gn(v, 0.5), m2 = gn(v, 0.42), m3 = gn(v, 0.06); chain(o1, m1, amp); chain(o2, m2, amp); chain(o3, m3, amp);
  for (const [x, k] of [[o1, 1], [o2, 1.0068]]) { x.frequency.setValueAtTime(f * k * 0.9, t); x.frequency.exponentialRampToValueAtTime(f * k, t + 0.035); x.frequency.setValueAtTime(f * k, t + dur); x.frequency.exponentialRampToValueAtTime(f * k * 0.96, t + dur + 0.06); }
  const lfo = os(v, 'sine', 27 + Math.random() * 10), fm = gn(v, 55 * tr), am = gn(v, 0.22 * tr); lfo.connect(fm); fm.connect(o1.frequency); fm.connect(o2.frequency); lfo.connect(am); am.connect(amp.gain);
  const bp = fl(v, 'bandpass', f, 6), ng = gn(v, 0); chain(bp, ng, dst); noise(v, null, t, t + dur + 0.1).connect(bp); ahr(ng.gain, t, 0.01, 0.12 * lv, dur, 0.05);
  const end = ahr(eg.gain, t, 0.014, 0.11 * lv, dur, 0.055);
  for (const x of [o1, o2, o3, lfo]) run(v, x, t, end + 0.01);
};
// end of the play: one official, sometimes a second a beat later
SFX.endWhistle = (B, t, o = {}) => { SFX.whistle(B, t, { dur: 0.3 + Math.random() * 0.25, g: o.g, pan: (Math.random() - 0.5) * 0.4 }); if (Math.random() < (o.two != null ? o.two : 0.4)) SFX.whistle(B, t + 0.08 + Math.random() * 0.15, { f: 2650 + Math.random() * 200, dur: 0.22 + Math.random() * 0.15, g: 0.7 * (o.g || 1), pan: (Math.random() - 0.5) * 0.8 }); };
// a flag: quick blasts from one official, a long one from another
SFX.flag = (B, t, o = {}) => { const g = o.g || 1; for (let i = 0; i < 3; i++) SFX.whistle(B, t + i * 0.19, { f: 3000, dur: 0.1, g, trill: 0.6, pan: -0.15 }); SFX.whistle(B, t + 0.34, { f: 2720, dur: 0.55, g: 0.85 * g, pan: 0.25 }); };
// the QB at the line: a shouted syllable, a pulse through three formants, with /s/ /h/ /t/ from noise. word: set | hut | hard
const WORDS = {
  set: { s: [0, 0.12], v: [0.1, 0.16, [560, 1850, 2550], [1, 0.9]], t: 0.29 },
  hut: { h: [0, 0.05], v: [0.035, 0.13, [700, 1220, 2600], [1.08, 0.86]], t: 0.185 },
  hard: { h: [0, 0.06], v: [0.045, 0.27, [740, 1250, 2650], [1.22, 0.92]], t: 0.335 } };
SFX.bark = (B, t, o = {}) => {
  const W0 = WORDS[o.word] || WORDS.hut, v = voice(B, 1); if (!v) return; const f0 = (o.f0 || 175) * (0.96 + Math.random() * 0.08), lv = (o.g != null ? o.g : 1) * (o.word === 'hard' ? 1.35 : 1), sl = o.slow || 1;
  const lp = fl(v, 'lowpass', 3600, 0.6), sum = gn(v, 0.25); chain(sum, lp, out(v, o.pan || 0, 0.32));
  const [vt, vd, F, pc] = W0.v, d = vd * sl, src = os(v, 'voice', f0 * pc[0]), vg = gn(v, 0), nz = noise(v, null, t, t + vt + d + 0.12);
  src.frequency.setValueAtTime(f0 * pc[0], t + vt); src.frequency.linearRampToValueAtTime(f0 * pc[1], t + vt + d); src.connect(vg);
  const hg = gn(v, 0); nz.connect(hg);
  F.forEach((ff, i) => { const b = fl(v, 'bandpass', ff, [5, 9, 10][i]), m = gn(v, [3.2, 2.4, 1.3][i]); vg.connect(b); hg.connect(b); chain(b, m, sum); b.frequency.setValueAtTime(ff * 1.04, t + vt); b.frequency.linearRampToValueAtTime(ff * 0.97, t + vt + d); });
  ahr(vg.gain, t + vt, 0.022, 0.32 * lv, Math.max(0.01, d - 0.05), 0.03); run(v, src, t + vt, t + vt + d + 0.06);
  if (W0.h) ahr(hg.gain, t + W0.h[0], 0.012, 0.42 * lv, W0.h[1] * 0.6, 0.02);
  if (W0.s) { const hp = fl(v, 'highpass', 3800, 0.7), b2 = fl(v, 'bandpass', 6200, 0.9), sg = gn(v, 0); chain(nz, hp, b2, sg, sum); ahr(sg.gain, t + W0.s[0], 0.03, 0.5 * lv, W0.s[1] * sl - 0.05, 0.03); }
  const tt = t + vt + (W0.t - vt) * sl, tb = fl(v, 'bandpass', 3300, 1.2), tg = gn(v, 0); chain(nz, tb, tg, sum); env(tg.gain, tt, 0.001, 0.32 * lv, 0.018);
};
// the stadium horn: a deep brassy chord with a bloom into pitch (td: two blasts; fg: one), or the period horn: one tone, shorter, nasal
SFX.horn = (B, t, o = {}) => {
  const kind = o.kind || 'td', per = kind === 'quarter' || kind === 'final', v = voice(B, 3); if (!v) return; const lv = o.g != null ? o.g : 1;
  const sh = nd(v, B.ctx.createWaveShaper()), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 1023 * 2 - 1; cv[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); } sh.curve = cv;
  const pre = gn(v, 1), lp = fl(v, 'lowpass', per ? 1500 : 1150, 0.8), pq = fl(v, 'peaking', per ? 950 : 560, 1.1, 5), eg = gn(v, 0); chain(pre, lp, pq, sh, eg, out(v, 0, per ? 0.4 : 0.55));
  const notes = per ? [185, 370.4] : [98, 123.5, 146.8], blasts = kind === 'td' ? [[0, 0.78], [0.98, 1.7]] : kind === 'fg' ? [[0, 1.5]] : kind === 'final' ? [[0, 1.9]] : [[0, 1.15]];
  const tEnd = t + blasts[blasts.length - 1][0] + blasts[blasts.length - 1][1] + 0.5;
  for (const f of notes) for (const dt of [-0.0035, 0.0035]) { const x = os(v, per ? 'square' : 'sawtooth', f), m = gn(v, (per ? 0.07 : 0.085) / (per ? 1 : 1.2)); chain(x, m, pre);
    for (const [b0] of blasts) { x.frequency.setValueAtTime(f * (1 + dt) * 0.95, t + b0); x.frequency.exponentialRampToValueAtTime(f * (1 + dt), t + b0 + 0.12); } run(v, x, t, tEnd); }
  const pk = (per ? 0.36 : 0.7) * lv; eg.gain.setValueAtTime(0, t);
  for (const [b0, d] of blasts) { const s = t + b0; eg.gain.setValueAtTime(0, s); eg.gain.linearRampToValueAtTime(pk, s + 0.07); eg.gain.linearRampToValueAtTime(pk * 0.9, s + d); eg.gain.exponentialRampToValueAtTime(pk * 0.001, s + d + 0.32); eg.gain.linearRampToValueAtTime(0, s + d + 0.33); }
};
// the broadcast sting: a low boom, a crash and a brass chord opening up
SFX.sting = (B, t, o = {}) => {
  const v = voice(B, 2); if (!v) return; const lv = o.g != null ? o.g : 1, g = gn(v, lv); g.connect(out(v, 0, 0.4));
  const bm = os(v, 'sine', 62), bg = gn(v, 0); chain(bm, bg, g); bm.frequency.setValueAtTime(64, t); bm.frequency.exponentialRampToValueAtTime(40, t + 0.7); env(bg.gain, t, 0.004, 0.3, 0.95); run(v, bm, t, t + 1.05);
  const hp = fl(v, 'highpass', 4800, 0.7), cg = gn(v, 0); chain(hp, cg, g); noise(v, null, t, t + 1.8).connect(hp); env(cg.gain, t, 0.002, 0.1, 1.7);
  const flt = fl(v, 'lowpass', 420, 1.6), sg = gn(v, 0); chain(flt, sg, g); flt.frequency.setValueAtTime(420, t); flt.frequency.exponentialRampToValueAtTime(2700, t + 0.07); flt.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
  for (const f of [116.5, 174.6, 233.1, 293.7, 349.2]) for (const dt of [-0.004, 0.004]) { const x = os(v, 'sawtooth', f * (1 + dt)), m = gn(v, 0.028); chain(x, m, flt); run(v, x, t, t + 1.5); }
  env(sg.gain, t, 0.025, 1, 1.35);
};
// the crowd answering a moment: vowel-shaped swells of noise (cheer rises and brightens, groan falls "aww", ooh, boo, a gasp);
// a cheer also carries the murmur sped up into shouting
SFX.react = (B, t, o = {}) => {
  if (!BUF.pink) return; const kind = o.kind || 'cheer', sz = clamp(fin(o.size, 0.6), 0.1, 1.2), v = voice(B, 0); if (!v) return; const lv = (o.g != null ? o.g : 1) * sz;
  const g = gn(v, lv); g.connect(B.crowd);
  const P = { cheer: { f: [650, 1350, 1100], q: 0.7, f2: 2400, a: 0.22, h: 0.5 + 0.8 * sz, r: 1.6 + 1.4 * sz, pk: 0.36 },
    groan: { f: [880, 520, 360], q: 1.5, f2: 1250, a: 0.14, h: 0.35, r: 1.3, pk: 0.62 },
    ooh: { f: [480, 640, 430], q: 2, f2: 900, a: 0.16, h: 0.25, r: 0.8, pk: 0.62 },
    boo: { f: [330, 360, 330], q: 2.6, f2: 760, a: 0.38, h: 1.2, r: 0.8, pk: 0.75 },
    gasp: { f: [900, 1250, 1000], q: 1.1, f2: 2000, a: 0.07, h: 0.12, r: 0.5, pk: 0.45 } }[kind] || {};
  const tot = P.a + P.h + P.r, eg = gn(v, 0), am = gn(v, 1), b1 = fl(v, 'bandpass', P.f[0], P.q), b2 = fl(v, 'bandpass', P.f2, P.q * 1.2), m2 = gn(v, 0.45); chain(b1, eg); chain(b2, m2, eg); chain(eg, am, g);
  const src = noise(v, BUF.pink, t, t + tot + 0.1); src.connect(b1); src.connect(b2);
  b1.frequency.setValueAtTime(P.f[0], t); b1.frequency.linearRampToValueAtTime(P.f[1], t + P.a + P.h * 0.5); b1.frequency.linearRampToValueAtTime(P.f[2], t + tot);
  ahr(eg.gain, t, P.a, P.pk, P.h, P.r);
  if (kind === 'boo') { const lfo = os(v, 'sine', 4.5 + Math.random() * 2), lg = gn(v, 0.15); chain(lfo, lg, am.gain); run(v, lfo, t, t + tot + 0.05); }     // the swell of many voices: multiplies, never adds
  if (kind === 'cheer' && BUF.babble) { const bb = noise(v, BUF.babble, t, t + tot + 0.1, 1.28 + Math.random() * 0.1), bp = fl(v, 'bandpass', 1400, 0.6), bg = gn(v, 0); chain(bb, bp, bg, g); ahr(bg.gain, t, P.a * 1.3, 0.55, P.h, P.r); }
};
// a fan's two-finger whistle somewhere in the stands: up, hold, down
SFX.fan = (B, t, o = {}) => {
  const v = voice(B, -1); if (!v) return; const f = 1900 + Math.random() * 1100, x = os(v, 'sine', f), g = gn(v, 0); chain(x, g, B.crowd); const d = 0.35 + Math.random() * 0.4;
  x.frequency.setValueAtTime(f * 0.8, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.08); x.frequency.setValueAtTime(f, t + d); x.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 0.75 : 1.08), t + d + 0.12);
  run(v, x, t, ahr(g.gain, t, 0.03, (o.g != null ? o.g : 1) * 0.022, d, 0.1));
};
// a menu click: tiny and soft
SFX.click = (B, t) => {
  const v = voice(B, -1); if (!v) return; const g = gn(v, 1); g.connect(B.sfx);
  const bp = fl(v, 'bandpass', 2600, 1.4), ng = gn(v, 0); chain(bp, ng, g); noise(v, null, t, t + 0.03).connect(bp); env(ng.gain, t, 0.0004, 0.16, 0.012);
  const x = os(v, 'sine', 1300), xg = gn(v, 0); chain(x, xg, g); env(xg.gain, t, 0.001, 0.022, 0.022); run(v, x, t, t + 0.04);
};

// ------------------------------------------------------------ the crowd bed and the weather: looping layers, levels moved smoothly
function layer(B, buf, rate, list) { const c = B.ctx, s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; list.push(s); return s; }
function mkCrowd(B) {
  const c = B.ctx, Ly = { B, srcs: [], nodes: [], gains: [], last: {}, parts: {} };
  const mk = x => { Ly.nodes.push(x); return x; }, g0 = () => { const x = mk(c.createGain()); Ly.gains.push(x); return x; }, F =(type, f, Q, gain) => { const x = kRate(mk(c.createBiquadFilter())); x.type = type; x.frequency.value = f; if (Q != null) x.Q.value = Q; if (gain != null) x.gain.value = gain; return x; };
  Ly.addParts = () => {      // whatever buffers are ready: the murmur arrives a moment after the first tap
    const t = c.currentTime + 0.02, P = Ly.parts, st = (s, max) => { mk(s); s.start(t, Math.random() * max); };
    if (BUF.pink && !P.bed) { P.bed = 1; Ly.bedLP = F('lowpass', 850, 0.6); Ly.bedPk = F('peaking', 320, 0.9, 4); Ly.bed = g0(); Ly.bed.gain.value = 0; const s = layer(B, BUF.pink, 1, Ly.srcs); chain(s, Ly.bedLP, Ly.bedPk, Ly.bed, B.crowd); st(s, 5);
      Ly.roarBP = F('bandpass', 900, 0.55); Ly.roarBP2 = F('bandpass', 2300, 0.9); Ly.roar = g0(); Ly.roar.gain.value = 0; const r2 = g0(); r2.gain.value = 0.35; const s2 = layer(B, BUF.pink, 1, Ly.srcs); s2.connect(Ly.roarBP); s2.connect(Ly.roarBP2); chain(Ly.roarBP, Ly.roar); chain(Ly.roarBP2, r2, Ly.roar); Ly.roar.connect(B.crowd); st(s2, 5); }
    if (BUF.babble && !P.bab) { P.bab = 1; Ly.babLP = F('lowpass', 3300, 0.5); Ly.bab = g0(); Ly.bab.gain.value = 0; const a = layer(B, BUF.babble, 1, Ly.srcs), b = layer(B, BUF.babble, 0.935, Ly.srcs); a.connect(Ly.babLP); b.connect(Ly.babLP); chain(Ly.babLP, Ly.bab, B.crowd); st(a, 7); st(b, 7);
      Ly.shoutBP = F('bandpass', 1350, 0.6); Ly.shout = g0(); Ly.shout.gain.value = 0; const s = layer(B, BUF.babble, 1.3, Ly.srcs); chain(s, Ly.shoutBP, Ly.shout, B.crowd); st(s, 7); }
    if (BUF.clap && !P.clap) { P.clap = 1; Ly.clapHP = F('highpass', 450, 0.6); Ly.clap = g0(); Ly.clap.gain.value = 0; const s = layer(B, BUF.clap, 1, Ly.srcs); chain(s, Ly.clapHP, Ly.clap, B.crowd); st(s, 3); }
  };
  Ly.addParts(); return Ly;
}
// energy 0..1 (how loud the building is), val -1..1 (groan .. cheer), clap 0..1
function crowdMix(e, val, clap, hush) {
  return { bed: 0.03 + 0.12 * e, bab: 0.045 * (1 - 0.5 * e) * (1 - 0.7 * (hush || 0)), roar: 0.7 * Math.pow(e, 2.2), roarF: 620 + 1000 * e + 260 * val, shout: 0.42 * Math.pow(Math.max(0, e - 0.38), 1.4) * (val >= 0 ? 1 : 0.35), clap: 0.2 * clap };
}
function setP(Ly, key, p, v, t, up, dn) { if (!p) return; const last = Ly.last[key]; if (last != null && Math.abs(last - v) < 1e-3) return; p.setTargetAtTime(v, t, last == null || v > last ? up : dn); Ly.last[key] = v; }
function crowdSet(Ly, t, X, up, dn) {
  if (!Ly.parts.bed || !Ly.parts.bab || !Ly.parts.clap) Ly.addParts();
  setP(Ly, 'bed', Ly.bed && Ly.bed.gain, X.bed, t, up, dn); setP(Ly, 'bab', Ly.bab && Ly.bab.gain, X.bab, t, up, dn); setP(Ly, 'roar', Ly.roar && Ly.roar.gain, X.roar, t, up, dn);
  setP(Ly, 'roarF', Ly.roarBP && Ly.roarBP.frequency, X.roarF, t, up, dn); setP(Ly, 'shout', Ly.shout && Ly.shout.gain, X.shout, t, up, dn); setP(Ly, 'clap', Ly.clap && Ly.clap.gain, X.clap, t, up * 0.7, dn * 1.6);
}
function mkWx(B, wx) {
  const c = B.ctx, X = { srcs: [], nodes: [], gains: [], rain: null, wind: null, ww: null, mph: 0 }, mk = x => { X.nodes.push(x); return x; };
  const t = c.currentTime + 0.02, F = (type, f, Q) => { const x = kRate(mk(c.createBiquadFilter())); x.type = type; x.frequency.value = f; x.Q.value = Q; return x; }, g0 = () => { const x = mk(c.createGain()); x.gain.value = 0; X.gains.push(x); return x; };
  if (wx && wx.weather === 'rain') { if (!BUF.rain) BUF.rain = rainBuf(c, 3, 32000); X.rain = g0(); const s = mk(layer(B, BUF.rain, 1, X.srcs)); chain(s, F('highpass', 520, 0.6), F('lowpass', 9500, 0.5), X.rain, B.wx); s.start(t, Math.random() * 2); X.rain.gain.setTargetAtTime(wx.heavy ? 0.16 : 0.11, t, 1.2); }
  const mph = wx && wx.wind ? +wx.wind.mph || 0 : 0; X.mph = mph;
  if (mph >= 6 && BUF.pink) { X.windBP = F('bandpass', 380, 0.7); X.wind = g0(); const s = mk(layer(B, BUF.pink, 0.45, X.srcs)); chain(s, X.windBP, X.wind, B.wx); s.start(t, Math.random() * 5);
    if (mph >= 14) { X.wwBP = F('bandpass', 950, 9); X.ww = g0(); const s2 = mk(layer(B, BUF.pink, 1, X.srcs)); chain(s2, X.wwBP, X.ww, B.wx); s2.start(t, Math.random() * 5); } }
  X.base = clamp((mph - 5) / 20, 0, 1) * 0.2; X.next = 0;
  return X;
}
// a gust: the wind band moves and swells, the whistle with it
function gust(X, t) { if (!X || !X.wind) return; const k = 0.45 + Math.random() * 0.85; X.wind.gain.setTargetAtTime(X.base * k, t, 0.6 + Math.random() * 0.8); X.windBP.frequency.setTargetAtTime(260 + 420 * k * Math.random() + 120, t, 0.9);
  if (X.ww) { X.ww.gain.setTargetAtTime(X.base * 0.22 * Math.max(0, k - 0.6), t, 0.5); X.wwBP.frequency.setTargetAtTime(800 + 450 * k, t, 0.7); } X.next = t + 1.2 + Math.random() * 2.8; }
function stopLayers(Ly, t) {
  if (!Ly) return; for (const x of Ly.gains || []) { try { x.gain.cancelScheduledValues(t); x.gain.setTargetAtTime(0, t, 0.15); } catch (e) { } }
  for (const s of Ly.srcs) { try { s.stop(t + 1.2); } catch (e) { } }
  const nodes = Ly.nodes, srcs = Ly.srcs; let left = srcs.length; const done = () => { if (--left > 0) return; for (const x of nodes) { try { x.disconnect(); } catch (e) { } } };
  if (!left) done(); else for (const s of srcs) s.onended = done;
}

// ------------------------------------------------------------ the live context: created on the first tap, suspended whenever nobody is listening
function ensure() {
  if (A) return A; if (!AC || !isOn()) return null;
  let ctx = null; try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return null; } }
  prep(ctx, false); A = makeBus(ctx, false); A.mGain = -1; masterTo(); return A;
}
function masterTo(force) {
  if (!A) return; const G = M && M.G, v = isOn() && !hiddenDoc() && !(G && G.paused) ? vol() : 0;
  if (!force && Math.abs(v - A.mGain) < 1e-3) return; A.mGain = v; A.master.gain.setTargetAtTime(v, A.ctx.currentTime, 0.06);
}
function resume() { if (!A || A.ctx.state === 'running' || A.ctx.state === 'closed' || !isOn() || hiddenDoc()) return; try { const p = A.ctx.resume(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
function suspend() { if (!A || A.ctx.state !== 'running') return; try { const p = A.ctx.suspend(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
function gesture() {
  if (!isOn()) return; const a = ensure(); if (!a) return; a.busyUntil = performance.now() + 1500; resume();
  if (!a.unlocked) { a.unlocked = true; try { const b = a.ctx.createBuffer(1, 1, a.ctx.sampleRate), s = a.ctx.createBufferSource(); s.buffer = b; s.connect(a.ctx.destination); s.start(0); s.onended = () => s.disconnect(); } catch (e) { } }
}
function uiClick(e) {
  if (!A || !isOn() || S().clicks === false) return; const t = e.target; if (!t || !t.closest) return;
  const b = t.closest('button, select, summary, [role=button], input[type=checkbox], input[type=radio], [onclick]'); if (!b || b.closest('.sndtest')) return;
  const G = M && M.G; if (G && (G.stage === 'live' || G.paused)) return; resume(); masterTo(); SFX.click(A, A.ctx.currentTime + 0.004);
}
// twice a second: suspend when idle, resume when a match wants sound, clean up any voice that never ended
function idle() {
  if (!A) return; const T = performance.now(), G0 = liveG();
  if (M && G0 !== M.G) stopMatch();
  masterTo();
  if (!isOn() || hiddenDoc()) { suspend(); return; }
  const inMatch = !!(M && M.G && !M.G.paused && !M.G.over), busy = inMatch || A.voices.size > 0 || T < A.busyUntil || (M && M.G && M.G.stage === 'final');
  if (busy) { A.idleSince = 0; if (inMatch) resume(); } else { if (!A.idleSince) A.idleSince = T; if (T - A.idleSince > 2500) suspend(); }
  const ct = A.ctx.currentTime; for (const v of Array.from(A.voices)) if ((v.end || v.t0 + 10) < ct - 1.5) { dbg.forced++; free(v); }
}

// ------------------------------------------------------------ the match: state read off G, the engine's events, the crowd's mood
function domeOf(wx) { return !!(wx && (wx.dome || wx.indoor || wx.roof === 'closed' || wx.stadium === 'dome' || wx.tod === 'dome')); }
function startMatch(G) {
  stopMatch(); const T = now();
  M = { G, sc: { [G.hid]: G.score[G.hid] || 0, [G.aid]: G.score[G.aid] || 0 }, q: G.q, over: !!G.over, flag: !!G.flagUp, ka: null, paused: !!G.paused,
    swell: 0, clap: 0, val: 0, act: 0, hushT: -99, meter: 0, energy: 0.3, base: 0.35, hq: [], hitsT: [], tick: 0, baseT: 0, nextFan: T + 3, prePl: null, setAt: 0, setSaid: false,
    lastHorn: -99, lastWhistle: -99, lastOoh: -99, intT: -99, hardT: -99, dome: domeOf(G.wx), snow: !!(G.wx && G.wx.weather === 'snow'), C: null, X: null };
  if (A && isOn() && running()) build();
}
function build() {
  if (!A || !M || M.C) return; const G = M.G; setVenue(A, M.dome); A.cHigh.gain.setTargetAtTime(M.snow ? -5 : 0, A.ctx.currentTime, 0.3);
  M.C = mkCrowd(A); M.X = M.dome ? null : mkWx(A, G.wx); A.crowd.gain.setTargetAtTime(crowdVol() * (M.dome ? 1.35 : 1), A.ctx.currentTime, 0.2);
}
function stopMatch() { if (!M) return; if (A) { const t = A.ctx.currentTime; stopLayers(M.C, t); stopLayers(M.X, t); } M = null; }
const fast = G => G.mode === 'watch' && (G.speed || 1) > 3;
const fxOk = G => running() && !G.sim && !G.paused && !fast(G);
// the crowd's mood: the bed answers at any speed; a one-shot rides on top when effects are on
function react(kind, size) {
  if (!M) return; const T = now();
  if (kind === 'cheer') { M.swell = Math.max(M.swell, size); M.val = 1; M.clap = Math.max(M.clap, size * 0.85); }
  else if (kind === 'groan') { M.swell = Math.min(M.swell, 0.08); M.val = -1; M.clap *= 0.3; }
  else if (kind === 'hush') { M.swell = 0; M.clap = 0; M.val = -1; M.hushT = T + 6; }
  else if (kind === 'ooh' || kind === 'gasp') M.swell = Math.max(M.swell, size * 0.55);
  else if (kind === 'boo') M.val = Math.min(M.val, -0.5);
  if (fxOk(M.G)) SFX.react(A, T + 0.02 + Math.random() * 0.05, { kind: kind === 'hush' ? 'groan' : kind, size: kind === 'hush' ? 0.9 : size });
}
// a home crowd cheers its own team's good plays; it groans at the bad ones that matter, and only murmurs at a visitor's first down
function mood(sign, size) { if (sign > 0) return react('cheer', size); if (size >= 1) return react('hush'); if (size >= 0.5) return react('groan', size); if (M) { M.val = Math.min(M.val, -0.5); M.swell *= 0.6; } }
function horn(kind) { if (!running() || !M || M.G.sim) return; const T = now(); if (T - M.lastHorn < 3.5) return; M.lastHorn = T; SFX.horn(A, T + 0.05, { kind }); }
function panOf(x, z) { try { if (typeof R3D === 'undefined' || !R3D.project || !W) return 0; const p = R3D.project(x, 1, z); if (!p || p.behind) return 0; return clamp((p.x / (W.innerWidth || 1)) * 2 - 1, -1, 1) * 0.65; } catch (e) { return 0; } }
const qbPitch = pl => { const id = pl && pl.qb && pl.qb.pid != null ? +pl.qb.pid || 0 : 0; return 150 + ((id * 37) % 45); };
function bark(word, G, extra) {
  if (!fxOk(G) || (G.speed || 1) > 1.5) return; const e = M.energy, lv = clamp(1.05 - 0.85 * e, 0.15, 1);
  SFX.bark(A, now() + 0.01, Object.assign({ word, f0: M.qbF || 170, g: lv, pan: (Math.random() - 0.5) * 0.2 }, extra || {}));
}
// a road offense in a loud building works on a silent count
const silentCount = G => G.poss === G.aid && (G.noise || 0) > 0.55;
function engineEv(kind, pl, o) {
  if (!M || !A || !pl) return; const G = M.G; if (!G || G !== liveG() || G.sim || G.paused) return;
  if (pl !== G.play && pl.t > 0.05) return;           // a headless play (instant sim) or a stand-in
  dbg.events++; o = o || {};
  if (kind === 'hit' || kind === 'tackle') { if (fxOk(G) && M.hq.length < 24 && o.at) M.hq.push({ j: +o.j || 0, x: o.at.x, z: o.at.z, block: !!o.block, tk: kind === 'tackle', sh: !!o.shoulder }); return; }
  const T = now(), fx = fxOk(G);
  if (kind === 'snap') { if (!silentCount(G) && T - M.hardT > 0.6) bark('hut', G); return; }
  if (kind === 'hardcount') { M.hardT = T; if (!silentCount(G)) bark('hard', G); return; }
  if (kind === 'kick') { if (fx) SFX.kick(A, T + 0.005, { kind: o.kind === 'punt' ? 'punt' : 'kick', pan: 0 }); M.swell = Math.max(M.swell, 0.32); return; }
  if (kind === 'catch') { const w = o.who; if (fx) SFX.catch(A, T + 0.004, { pan: w && w.p ? panOf(w.p.x, w.p.z) : 0, g: o.int ? 1.1 : 0.9 });
    if (o.int) { M.intT = T; mood(G.cur && G.cur.def === G.hid ? 1 : -1, 0.85); } return; }
  if (kind === 'fumble') { react('gasp', 0.7); return; }
  if (kind === 'end') return onEnd(G, pl, o);
}
function onEnd(G, pl, res) {
  const T = now(), fx = fxOk(G), ty = res.type, off = pl.ret ? (G.retPlay ? G.retPlay.recv : G.poss) : (G.cur ? G.cur.off : G.poss), f = off === G.hid ? 1 : -1;
  if (fx && ty !== 'td' && ty !== 'deftd') { const d = /tackle|sack|down/.test(ty) ? 0.16 + Math.random() * 0.26 : 0.05 + Math.random() * 0.15; M.lastWhistle = T + d; if (G.flagUp) SFX.flag(A, T + d); else SFX.endWhistle(A, T + d); }
  if (fx && /tackle|sack|down/.test(ty) && pl.carrier) SFX.thud(A, T + 0.01, { pan: panOf(pl.carrier.p.x, pl.carrier.p.z), g: 0.6 + 0.4 * clamp((res.bigHit || 0) / 900, 0, 1) });
  if (ty === 'td' || ty === 'deftd') { const s = ty === 'td' ? f : -f; mood(s, 1); if (fx && S().sting !== false) SFX.sting(A, T + 0.08, { g: 0.8 }); return; }
  if (res.safety) return mood(-f, 0.9);
  if (res.turnover === 'int') { if (T - M.intT > 3) mood(-f, 0.8); return; }
  if (ty === 'fumbleLost') return mood(-f, 0.85);
  if (pl.ret) { const z0 = pl.ret.landZ != null ? pl.ret.landZ : pl.losZ, ry = ((res.spotZ || 0) - z0) / YDm; if (/fair|touchback|downed/.test(ty)) return; if (ry >= 25) mood(f, 0.65); return; }
  if (res.sack) return mood(-f, 0.75);
  if (ty === 'inc') { const B0 = pl.ball, deep = B0 && B0.land && (B0.land.z - pl.losZ) / YDm > 16; return mood(-f, G.down >= 3 ? 0.55 : deep ? 0.5 : 0.25); }
  const y = res.yards || 0, first = y >= (G.togo || 10) - 1e-6;
  if (G.down === 4 && !first) mood(-f, 0.9); else if (G.down >= 3 && first) mood(f, 0.65); else if (G.down === 3) mood(-f, 0.6);
  else if (y >= 20) mood(f, 0.8); else if (y >= 10) mood(f, 0.5); else if (y <= -3) mood(-f, 0.35);
  if ((res.bigHit || 0) > 780 && T - M.lastOoh > 3) { M.lastOoh = T; react('ooh', 0.6); }
}
// hits queued by the engine this frame: the hardest few, spaced, panned to the screen, quieter away from the ball
function flushHits(G, pl) {
  const q = M.hq; if (!q.length) return; M.hq = []; if (!fxOk(G)) return;
  const T = now(); M.hitsT = M.hitsT.filter(x => x > T - 1); q.sort((a, b) => b.j - a.j);
  const B0 = pl && pl.ball && pl.ball.p ? pl.ball.p : { x: 0, z: pl ? pl.losZ : 0 }; let n = 0;
  for (const h of q) {
    if (n >= 3 || M.hitsT.length >= 22) break; const j = h.j * (h.tk ? 1.15 : 1) * (h.block ? 0.6 : 1); if (j < 110) continue;
    const k = clamp((j - 110) / 760, 0, 1), att = 1 / (1 + Math.hypot(h.x - B0.x, h.z - B0.z) / 14);
    SFX.hit(A, T + 0.004 + n * 0.012 + Math.random() * 0.006, { k, pan: panOf(h.x, h.z), g: att * (h.block ? 0.75 : 1), helmet: (h.sh && k > 0.3) || (k > 0.55 && Math.random() < 0.5), prio: h.tk ? 1 : 0 });
    M.hitsT.push(T); n++;
    if (h.tk && k > 0.8 && T - M.lastOoh > 4) { M.lastOoh = T; react('ooh', 0.55); }
  }
}
// the live play moves the crowd: a deep ball hanging in the air, a runner breaking into the open
function liveAct(G, pl) {
  if (G.stage !== 'live' || !pl || !pl.ball) return 0; const B = pl.ball, c = pl.carrier;
  if (B.state === 'air' && pl.thrown && B.land && !pl.ret) { const depth = (B.land.z - pl.losZ) / YDm; return depth < 14 ? 0 : Math.min(0.45, (B.t || 0) * 0.3) * Math.min(1, (depth - 10) / 25); }
  if (!c || !c.vel) return B.state === 'loose' ? 0.3 : 0;
  const sp = Math.hypot(c.vel.x, c.vel.z), z0 = pl.ret && pl.ret.landZ != null ? pl.ret.landZ : c.unit === 'D' && pl.catchZ != null ? pl.catchZ : pl.losZ, gain = (c.unit === 'O' ? c.p.z - z0 : z0 - c.p.z) / YDm;
  if (gain < 6 || sp < 5) return 0;
  const offT = pl.ret ? (G.retPlay ? G.retPlay.recv : G.poss) : (G.cur ? G.cur.off : G.poss), runT = c.unit === 'O' ? offT : (offT === G.hid ? G.aid : G.hid), home = runT === G.hid;
  const a = clamp((gain - 6) / 28, 0, 0.75) * clamp((sp - 4.5) / 3.5, 0, 1) * (home ? 1 : 0.55); if (a > 0.1) M.val = home ? Math.max(M.val, 0.6) : Math.min(M.val, -0.3); return a;
}
function baseOf(G) {
  const H = G.T && G.T[G.hid], fan = H && H.fanSup != null ? +H.fanSup : 60, sd = (G.score[G.hid] || 0) - (G.score[G.aid] || 0);
  let b = 0.34 + (fan - 60) / 300 + (G.playoffs ? 0.1 : 0) + (G.q >= 4 && Math.abs(sd) <= 8 ? 0.08 : 0) - (sd <= -17 ? 0.12 : 0) + (sd >= 17 ? 0.04 : 0);
  return clamp(b, 0.18, 0.6);
}
function crowdTick(G, pl, T) {
  const dt = clamp(T - (M.tick || T), 0, 0.5); M.tick = T;
  M.swell *= Math.exp(-dt / 2.2); M.clap *= Math.exp(-dt / 2.6); M.val *= Math.exp(-dt / 3.5);
  if (T - M.baseT > 1) { M.baseT = T; M.base = baseOf(G); }
  const away = G.poss === G.aid && !G.pat, st = G.stage, b = M.base, mtr = M.meter || 0;
  let lv = st === 'load' ? 0.3 : st === 'call' ? b * 0.82 : st === 'pre' ? (away ? Math.max(b, 0.25 + 0.75 * mtr) : b * 0.55) : st === 'live' ? (away ? Math.max(b * 0.9, 0.2 + 0.62 * mtr) : b * 0.8) : st === 'kick' ? b * 1.05 : b * 0.9;
  if (G.over || st === 'final') lv = b * 0.8;
  const a = liveAct(G, pl); M.act += (a - M.act) * clamp(dt * (a > M.act ? 5 : 1.5), 0, 1);
  const hush = T < M.hushT ? 1 : Math.exp(-(T - M.hushT) / 4);
  let e = clamp(lv + M.swell * (1 - 0.35 * lv) + M.act, 0, 1) * (1 - 0.88 * hush);
  if (G.sim) e = 0.12; M.energy = e;
  const X = crowdMix(e, M.val, G.sim ? 0 : M.clap, hush); if (G.sim) X.roar = X.shout = 0;
  crowdSet(M.C, T, X, 0.2, 0.9);
  setP(M.C, 'bus', A.crowd.gain, crowdVol() * (M.dome ? 1.35 : 1) * (G.sim ? 0.5 : 1), T, 0.3, 0.3);
  if (fxOk(G) && e > 0.5 && T > M.nextFan) { SFX.fan(A, T + 0.02, { g: e }); M.nextFan = T + (2 + Math.random() * 6) / e; }
  if (M.X && M.X.wind && T > M.X.next) gust(M.X, T);
}
function frame(G, dt) {
  if (!G) return; if (!M || M.G !== G) startMatch(G);
  if (!!G.paused !== M.paused) { M.paused = !!G.paused; masterTo(); if (M.paused) setTimeout(() => { if (M && M.paused) suspend(); }, 260); else resume(); }
  const audible = !!A && isOn() && running();
  if (audible && !M.C) build();
  const T = now(), pl = G.play;
  // scores: the horn for the home side, the building deflating for the visitors
  for (const tid of [G.hid, G.aid]) { const d = (G.score[tid] || 0) - (M.sc[tid] || 0); M.sc[tid] = G.score[tid] || 0; if (d <= 0 || !audible || G.sim) continue;
    if (tid === G.hid) { if (d >= 2) { horn(d >= 6 ? 'td' : 'fg'); react('cheer', d >= 6 ? 1 : 0.75); M.clap = 1; } else react('cheer', 0.45); }
    else if (d >= 3 && T > M.hushT - 2) react('hush'); }
  // the end of a quarter (the period horn) and of the game
  if (G.q !== M.q) { const up = G.q > M.q; M.q = G.q; if (up && audible) horn('quarter'); }
  if (!!G.over !== M.over) { M.over = !!G.over; if (M.over && audible && !G.sim) { horn('final'); const h = G.score[G.hid] || 0, a = G.score[G.aid] || 0; if (h > a) react('cheer', 0.9); else if (h < a) react('groan', 0.6); } }
  // a flag: the whistles (unless it is a live-ball foul at the snap), the home crowd boos one on its own team
  if (!!G.flagUp !== M.flag) { M.flag = !!G.flagUp; if (M.flag && audible) { const fs = G.fouls || [], f = fs[fs.length - 1], onHome = f && f.by === G.hid;
    if (fxOk(G) && G.stage !== 'pre' && G.stage !== 'live') SFX.flag(A, Math.max(T + 0.05, M.lastWhistle + 0.55)); react(onHome ? 'boo' : 'cheer', onHome ? 0.55 : 0.3); } }
  // a kick in the air (punts, field goals, extra points, kickoffs without a return): the thock, then how the crowd takes it
  const K = G.kickAnim;
  if (K && K !== M.ka) { M.ka = K; M.kaTeam = G.pat ? G.pat.tid : G.poss; if (fxOk(G)) SFX.kick(A, T + 0.005, { kind: K.kind === 'punt' ? 'punt' : 'kick' }); if (K.kind === 'punt') M.swell = Math.max(M.swell, 0.3); }
  else if (!K && M.ka) { const k0 = M.ka; M.ka = null;
    if ((k0.kind === 'fg' || k0.kind === 'xp') && audible && k0.start && k0.end && typeof PHYS !== 'undefined' && PHYS.FIELD) {
      const s = k0.start, e = k0.end, posts = PHYS.FIELD.goalZ + 10 * YDm, u = (posts - s.z) / ((e.z - s.z) || 1), x = s.x + (e.x - s.x) * u, good = e.z >= posts && e.y > 1 && Math.abs(x) < 2.85;
      mood(good === (M.kaTeam === G.hid) ? 1 : -1, k0.kind === 'xp' ? 0.35 : 0.7); } }
  // at the line: "set" once the offense is down, "hut" at the snap (the engine's event)
  if (G.stage === 'pre' && pl && pl.phase === 'pre' && !pl.ret) {
    if (M.prePl !== pl) { M.prePl = pl; M.setSaid = false; M.qbF = qbPitch(pl); M.setAt = G.time + (G.userSide === 'D' ? 2.05 : G.userSide === 'O' ? 0.8 : 0.5) + Math.random() * 0.15; }
    if (!M.setSaid && G.time >= M.setAt) { M.setSaid = true; if (!silentCount(G)) bark('set', G, { slow: 0.9 + Math.random() * 0.5 }); }
  }
  if (!audible) { M.hq.length = 0; return; }
  flushHits(G, pl);
  if (T - (M.tick || 0) >= 0.1) crowdTick(G, pl, T);
}
// one-line calls from the match (and anything else that wants a sound)
function on(kind, o) {
  if (kind === 'close') { stopMatch(); return; }
  if (kind === 'hardcount') { const G = M && M.G; if (G && G.play) engineEv('hardcount', G.play, o); return; }
  if (kind === 'turnover' || kind === 'flag' || kind === 'score') return;      // read off G every frame (kept so callers never break)
}
function crowd(n) { if (M) M.meter = clamp(+n || 0, 0, 1); }
// an audio problem must never stop a play: every entry point swallows (and counts) its errors
function safe(fn) { return function () { try { return fn.apply(null, arguments); } catch (e) { if (!dbg.err) console.warn('sound:', e); dbg.err = (dbg.err || 0) + 1; } }; }
if (typeof PHYS !== 'undefined') PHYS.onEvent = safe(engineEv);
if (W && typeof document !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) W.addEventListener(ev, safe(gesture), { capture: true, passive: true });
  W.addEventListener('click', safe(uiClick), true);
  document.addEventListener('visibilitychange', safe(() => { if (!A) return; masterTo(); if (hiddenDoc()) suspend(); else if (M && M.G && !M.G.paused) resume(); }));
  setInterval(safe(idle), 500);
}

// ------------------------------------------------------------ settings: the switch, the volume, the sound test
function apply() { if (!isOn()) { masterTo(); suspend(); return; } const a = ensure(); if (!a) return; masterTo(); a.busyUntil = performance.now() + 1500; if (!(M && M.G && M.G.paused)) resume(); if (M && !M.C && running()) build(); if (M && M.C) setP(M.C, 'bus', a.crowd.gain, crowdVol() * (M.dome ? 1.35 : 1), a.ctx.currentTime, 0.1, 0.1); }
const TESTS = [['crowd', 'Crowd'], ['roar', 'Roar'], ['groan', 'Groan'], ['boo', 'Boos'], ['hit', 'Pads'], ['bighit', 'Big hit'], ['catch', 'Catch'], ['kick', 'Kick'], ['punt', 'Punt'], ['whistle', 'Whistle'], ['flag', 'Flag'],
  ['cadence', 'Set… hut'], ['hard', 'Hard count'], ['horn', 'Score horn'], ['quarter', 'Quarter horn'], ['sting', 'TD sting'], ['rain', 'Rain'], ['wind', 'Wind'], ['click', 'Click']];
// a few seconds of the bed for the test buttons (when no game is on)
function tempCrowd(B, t, shape, dur) {
  const Ly = mkCrowd(B); B.crowd.gain.setTargetAtTime(crowdVol(), t, 0.05);
  for (const [at, e, val, clap] of shape) { const X = crowdMix(e, val, clap, 0); crowdSet(Ly, t + at, X, 0.25, 0.6); Ly.last = {}; }
  const X0 = crowdMix(0, 0, 0, 0); for (const k in X0) X0[k] = k === 'roarF' ? 600 : 0; crowdSet(Ly, t + dur, X0, 0.3, 0.3);
  stopLayers({ nodes: [], gains: [], srcs: Ly.srcs }, t + dur + 0.6); setTimeout(() => { for (const x of Ly.nodes) { try { x.disconnect(); } catch (e) { } } }, (dur + 3) * 1000); return Ly;
}
function tempWx(B, t, wx, dur) { const X = mkWx(B, wx); if (X.wind) { X.wind.gain.setTargetAtTime(X.base, t, 0.4); gust(X, t + 1.2); gust(X, t + 2.6); } stopLayers({ nodes: [], gains: [], srcs: X.srcs }, t + dur + 0.6); for (const g of [X.rain, X.wind, X.ww]) if (g) g.gain.setTargetAtTime(0, t + dur, 0.2); setTimeout(() => { for (const x of X.nodes) { try { x.disconnect(); } catch (e) { } } }, (dur + 3) * 1000); }
function play(name, B, t) {
  switch (name) {
    case 'crowd': return tempCrowd(B, t, [[0, 0.3, 0, 0], [1.5, 0.55, 0, 0], [2.8, 0.85, 0, 0]], 4.5);
    case 'roar': tempCrowd(B, t, [[0, 0.5, 1, 0], [0.2, 1, 1, 1]], 4.5); return SFX.react(B, t + 0.1, { kind: 'cheer', size: 1 });
    case 'groan': tempCrowd(B, t, [[0, 0.4, 0, 0], [0.6, 0.15, -1, 0]], 3.2); return SFX.react(B, t + 0.4, { kind: 'groan', size: 0.8 });
    case 'boo': tempCrowd(B, t, [[0, 0.4, -0.5, 0]], 3.2); return SFX.react(B, t + 0.3, { kind: 'boo', size: 0.8 });
    case 'hit': for (let i = 0; i < 4; i++) SFX.hit(B, t + i * 0.45, { k: 0.15 + i * 0.12, pan: (i - 1.5) * 0.3, helmet: i > 1, prio: 2 }); return;
    case 'bighit': return SFX.hit(B, t, { k: 1, helmet: true, prio: 2 });
    case 'catch': return SFX.catch(B, t, {});
    case 'kick': return SFX.kick(B, t, { kind: 'kick' });
    case 'punt': return SFX.kick(B, t, { kind: 'punt' });
    case 'whistle': return SFX.endWhistle(B, t, { two: 1 });
    case 'flag': return SFX.flag(B, t);
    case 'cadence': SFX.bark(B, t, { word: 'set', f0: 168, slow: 1.2 }); return SFX.bark(B, t + 0.95, { word: 'hut', f0: 168 });
    case 'hard': SFX.bark(B, t, { word: 'set', f0: 168 }); return SFX.bark(B, t + 0.9, { word: 'hard', f0: 168 });
    case 'horn': return SFX.horn(B, t, { kind: 'td' });
    case 'quarter': return SFX.horn(B, t, { kind: 'quarter' });
    case 'sting': return SFX.sting(B, t, {});
    case 'rain': return tempWx(B, t, { weather: 'rain', wind: { mph: 0 } }, 4);
    case 'wind': return tempWx(B, t, { weather: 'clear', wind: { mph: 22 } }, 5);
    case 'click': return SFX.click(B, t);
  }
}
function test(name) {
  if (!isOn()) { if (typeof toast === 'function') toast('Sound is off: switch it on first'); return false; }
  const a = ensure(); if (!a) { if (typeof toast === 'function') toast('This browser has no Web Audio'); return false; }
  a.busyUntil = performance.now() + 6000; resume(); masterTo(true);
  const go = () => { if (!BUF.pink) prep(a.ctx, true); play(name, a, a.ctx.currentTime + 0.06); };
  if (a.ctx.state === 'running') go(); else setTimeout(go, 80); return true;
}
// QA: render one sound (or the crowd at a level) offline and measure it; ?wav returns 16-bit PCM as base64
async function renderOff(name, o = {}) {
  if (!OAC) return null; const sr = o.sr || 48000, dur = o.dur || 3, oc = new OAC(2, Math.round(sr * dur), sr);
  prep(oc, true); const B = makeBus(oc, !!o.dome, !!o.raw); B.master.gain.value = o.vol != null ? o.vol : 1;
  if (name === 'load') {      // a busy game: the bed plus 10 hits a second, a whistle, a cheer and a bark every 1.5 s, each made just in time as in a match
    const Ly = mkCrowd(B); B.crowd.gain.value = 1; crowdSet(Ly, 0, crowdMix(0.7, 0.3, 0.5, 0), 0.05, 0.05);
    const win = w => { for (let t = w; t < w + 0.5 - 1e-6; t += 0.1) SFX.hit(B, t + 0.02, { k: Math.random(), helmet: Math.random() < 0.4, prio: 2 }); if (Math.round(w * 2) % 3 === 0) { SFX.endWhistle(B, w + 0.05, { two: 1 }); SFX.react(B, w + 0.2, { kind: 'cheer', size: 0.6 }); SFX.bark(B, w + 0.4, { word: 'hut' }); } };
    win(0); for (let w = 0.5; w < dur - 1; w += 0.5) { const w0 = w; oc.suspend(w0).then(() => { win(w0); oc.resume(); }); } }
  else if (name === 'crowdAt') { const Ly = mkCrowd(B); B.crowd.gain.value = (o.dome ? 1.35 : 1); crowdSet(Ly, 0, crowdMix(o.e != null ? o.e : 0.5, o.val || 0, o.clap || 0, 0), 0.02, 0.02); }
  else if (name === 'reactAt') { SFX.react(B, 0.05, { kind: o.kind || 'cheer', size: o.size || 1 }); }
  else play(name, B, 0.05);
  const buf = await oc.startRendering(); const ch = [buf.getChannelData(0), buf.getChannelData(1)], n = buf.length;
  let pk = 0, ss = 0, nan = 0, win = 0, wmax = 0, ws = 0; const wl = Math.round(sr * 0.05);
  for (let i = 0; i < n; i++) { const a = ch[0][i], b = ch[1][i]; if (a !== a || b !== b) { nan++; continue; } const m = Math.max(Math.abs(a), Math.abs(b)); if (m > pk) pk = m; ss += a * a + b * b; ws += a * a + b * b; if (++win === wl) { wmax = Math.max(wmax, ws / (2 * wl)); ws = 0; win = 0; } }
  let head = 0, tail = 0; for (let i = 0; i < Math.round(sr * 0.04); i++) head = Math.max(head, Math.abs(ch[0][i]), Math.abs(ch[1][i])); for (let i = n - Math.round(sr * 0.01); i < n; i++) tail = Math.max(tail, Math.abs(ch[0][i]), Math.abs(ch[1][i]));
  const db = x => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -999), r = { name, peak: db(pk), rms: db(Math.sqrt(ss / (2 * n))), rmsMax: db(Math.sqrt(wmax)), head: db(head), tail: db(tail), nan, voicesLeft: B.voices.size };
  if (o.wav) { const pcm = new DataView(new ArrayBuffer(44 + n * 4)), w = (p, s) => { for (let i = 0; i < s.length; i++) pcm.setUint8(p + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); pcm.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); pcm.setUint32(16, 16, true); pcm.setUint16(20, 1, true); pcm.setUint16(22, 2, true); pcm.setUint32(24, sr, true); pcm.setUint32(28, sr * 4, true); pcm.setUint16(32, 4, true); pcm.setUint16(34, 16, true); w(36, 'data'); pcm.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) pcm.setInt16(44 + i * 4 + c * 2, Math.round(clamp(ch[c][i], -1, 1) * 32767), true);
    const u8 = new Uint8Array(pcm.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); r.wav = btoa(s); }
  return r;
}
// QA: a peak meter on the live output (after the limiter), and the limiter's gain reduction
function meter(onOff) {
  if (!A) return null; if (onOff && !dbg.meter) { const an = A.ctx.createAnalyser(); an.fftSize = 2048; A.clip.connect(an); const buf = new Float32Array(an.fftSize); dbg.meter = { an, buf, peak: 0, red: 0, n: 0 };
    const look = () => { const m = dbg.meter; if (!m) return; m.an.getFloatTimeDomainData(m.buf); for (let i = 0; i < m.buf.length; i++) { const x = Math.abs(m.buf[i]); if (x > m.peak) m.peak = x; } m.red = Math.min(m.red, A.lim.reduction && A.lim.reduction.value != null ? A.lim.reduction.value : A.lim.reduction || 0); m.n++; m.raf = requestAnimationFrame(look); }; look(); }
  if (onOff === false && dbg.meter) { cancelAnimationFrame(dbg.meter.raf); try { A.clip.disconnect(dbg.meter.an); } catch (e) { } dbg.meter = null; }
  return dbg.meter ? { peak: dbg.meter.peak, reduction: dbg.meter.red, looks: dbg.meter.n } : null;
}
return { frame: safe(frame), crowd: safe(crowd), on: safe(on), test: safe(test), apply: safe(apply), TESTS, SFX, unlock: safe(gesture),
  get debug() { return { ctx: A ? A.ctx.state : 'none', on: isOn(), vol: vol(), master: A ? A.mGain : 0, voices: A ? A.voices.size : 0, nodes: A ? A.nodes : 0, layerNodes: M && M.C ? M.C.nodes.length + (M.X ? M.X.nodes.length : 0) : 0,
    match: !!M, energy: M ? Math.round(M.energy * 100) / 100 : 0, meter: M ? M.meter : 0, buffers: Object.keys(BUF).filter(k => BUF[k]), made: dbg.made, ended: dbg.ended, dropped: dbg.dropped, forced: dbg.forced, errors: dbg.err || 0, peakVoices: dbg.peakV, peakNodes: dbg.peakN, events: dbg.events }; },
  _render: renderOff, _meter: meter };
})();
