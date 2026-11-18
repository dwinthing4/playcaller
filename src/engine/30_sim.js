// Headless play runner (used by tests, "sim drive", and CPU-vs-CPU when the user watches at high speed)
(() => {
const { DT } = PHYS._;
// run one play to the whistle without rendering. opts = Play options. hook(play) is called every step (tests).
function runPlay(opts, hook) {
  const pl = new PHYS.Play(opts); let n = 0;
  while (pl.phase === 'pre' && n < 1500) { if (n === 30) pl.snap(); pl.step(DT); n++; if (n % 4 === 0) pl.updatePoses(); }
  if (pl.phase === 'pre') pl.goLive();
  let m = 0;
  while (pl.phase === 'live' && m < 120 * 40) { pl.step(DT); m++; if (m % 4 === 0) pl.updatePoses(); if (hook) hook(pl); }
  if (pl.phase === 'live') pl.endPlay('tackle', 'Whistle', pl.carrier, pl.carrier ? pl.carrier.p.z : pl.losZ);
  return pl.result;
}
PHYS.runPlay = runPlay;
})();
