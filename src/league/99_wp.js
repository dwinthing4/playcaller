// Win probability inputs from the league (the model is src/core/50_wp.js): the pregame power difference the hub's
// pregame number uses (teamPower off + def, home minus away), and QA access to the fast sim (qa/wp_calib.cjs).
function wpPowerDiff(hid, aid) { const h = L.teams[hid], a = L.teams[aid]; if (!h || !a) return 0; const ph = teamPower(h), pa = teamPower(a); return (ph.off + ph.def) - (pa.off + pa.def); }
Object.assign(LG, { wpPower: wpPowerDiff, wp: s => WP.of(s), WPM: WP });
LG._t.fastGame = fastGame;
