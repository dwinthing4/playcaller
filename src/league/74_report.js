// Draft-guide scouting reports: a short summary, three strengths, two or three weaknesses, a projection and a grade.
// Written from what THIS scout believes (his own error: weaker scouts miss by more, specialists see their positions better,
// and everyone gets closer as the staff learns the player), with the public combine numbers worked in. Phrases are picked by a
// seeded draw per scout, prospect and report, so a scout's next report on the same player says it a different way.
// Tokens in phrases: {forty} {ten} {vert} {broad} {bench} {cone} {arm} {hand} {wt} {ht}; a phrase whose token is unknown is skipped.

const DGR_GROUP = { QB: 'QB', RB: 'RB', FB: 'RB', WR: 'WR', TE: 'WR', OT: 'OL', OG: 'OL', C: 'OL', DE: 'DL', DT: 'DL', LB: 'LB', CB: 'DB', S: 'DB', K: 'K', P: 'K' };
const DGR_KEYS = { QB: ['tha', 'thp', 'awr', 'spd'], RB: ['spd', 'acc', 'agi', 'elu', 'btk', 'car', 'cth', 'pbk'], FB: ['rbk', 'str', 'btk', 'cth', 'car', 'pbk'],
  WR: ['spd', 'acc', 'agi', 'rte', 'cth', 'jmp', 'elu', 'str'], TE: ['cth', 'rte', 'spd', 'jmp', 'rbk', 'str', 'btk'], OT: ['pbk', 'rbk', 'str', 'awr', 'agi', 'acc'], OG: ['pbk', 'rbk', 'str', 'awr', 'agi', 'acc'], C: ['pbk', 'rbk', 'str', 'awr', 'agi', 'acc'],
  DE: ['prs', 'pow', 'bsh', 'tak', 'spd', 'acc', 'str', 'pur'], DT: ['bsh', 'pow', 'prs', 'str', 'tak', 'acc', 'pur'], LB: ['tak', 'pur', 'zcv', 'bsh', 'spd', 'mcv', 'prs', 'awr'],
  CB: ['mcv', 'zcv', 'hnd', 'spd', 'agi', 'jmp', 'tak', 'acc'], S: ['zcv', 'tak', 'hnd', 'spd', 'mcv', 'pur', 'agi', 'awr'], K: ['kpw', 'kac'], P: ['kpw', 'kac'] };
// s = strength phrases, w = weakness phrases, by position group and rating (G = generic fallback)
const DGR = {
  QB: {
    tha: { s: ['Puts the ball on the right shoulder; receivers rarely have to break stride.', 'Throws with touch and can drop it in the bucket down the sideline.', 'Accurate to all three levels when his feet are set.', 'Ball placement on timing throws is the best part of his tape.', 'Hits receivers in stride, which adds yards after the catch.'],
      w: ['Ball placement comes and goes; too many throws land behind the receiver.', 'Accuracy falls off when he has to throw on the move.', 'Sails throws over the middle when he is late on the read.', 'Misses easy throws he should make in his sleep.'] },
    thp: { s: ['Live arm. Drives the deep out from the far hash.', 'Can make every throw, and the ball jumps off his hand.', 'Arm strength lets him fit throws into tight windows.', 'Throws a frozen rope on intermediate routes.'],
      w: ['Arm is just adequate; deep balls hang and let corners recover.', 'Has to be on time because he cannot make up for a late read with velocity.', 'Lacks the zip to challenge tight windows outside the numbers.'] },
    awr: { s: ['Sees the field well and works through his progressions.', 'Gets the offense into the right play at the line.', 'Rarely puts the ball in harm\'s way.', 'Poised in the pocket; does not panic when the picture changes.'],
      w: ['Locks onto his first read, and safeties sit on it.', 'Slow to process when the coverage rotates late.', 'Holds the ball too long and takes sacks he does not need to.', 'Forces throws into coverage when he is behind.'] },
    spd: { s: ['A real threat with his legs; extends plays and picks up first downs.', 'Escapes the rush and keeps his eyes downfield.', 'Ran a {forty} and will make defenses account for him on the ground.'],
      w: ['A statue in the pocket. Needs a clean platform to throw.', 'Limited escapability; will not buy time on his own.', 'Ran {forty}; nobody is calling designed runs for him.'] },
  },
  RB: {
    spd: { s: ['Home-run speed. One cut and he is gone.', 'Hits the second level in a hurry and outruns pursuit angles.', 'Ran {forty} and plays every bit of it.'],
      w: ['Lacks a second gear and gets caught from behind.', 'More of a grinder than a breakaway threat.', 'Ran {forty}; long runs will be rare.'] },
    acc: { s: ['Explosive out of his stance; gets to the hole before it closes.', 'Quick to top speed, which makes him dangerous on draws and tosses.', 'Burst through the line is real ({ten} split).'],
      w: ['Takes a while to get going and needs runway.', 'Slow to the hole; the crease closes on him.'] },
    agi: { s: ['Sudden feet. Cuts without losing speed.', 'Changes direction in a phone booth ({cone} three-cone).', 'Loose hips let him bounce runs outside.'],
      w: ['Stiff hips; rounds off his cuts.', 'Has to gather himself before he can redirect.'] },
    elu: { s: ['Makes the first man miss in the hole.', 'Slippery runner with vision; finds the cutback lane.', 'Creates yards on his own when the blocking breaks down.'],
      w: ['Runs into contact instead of around it.', 'Does not create much when the hole is not there.', 'Vision is average; misses the cutback.'] },
    btk: { s: ['Runs through arm tackles and falls forward.', 'Powerful lower half that drags defenders for extra yards.', 'Contact balance is the best part of his game.'],
      w: ['Goes down on first contact too often.', 'Not built to run between the tackles twenty times a game.', 'Arm tackles bring him down.'] },
    car: { s: ['Ball security is excellent; protects it in traffic.', 'Two hands on the ball in a crowd, every time.'], w: ['Carries it loose, and fumbling has been an issue.', 'Ball security needs work.'] },
    cth: { s: ['Natural hands out of the backfield; a real weapon on third down.', 'Runs routes like a receiver and catches everything.', 'Comfortable catching the ball away from his body.'],
      w: ['Limited as a receiver; body-catches and drops easy ones.', 'Not much of a factor in the passing game.'] },
    pbk: { s: ['Willing and effective in blitz pickup.', 'Squares up blitzers and anchors.'], w: ['A liability in pass protection right now.', 'Whiffs on blitz pickups; quarterbacks will not trust him on third down.'] },
    rbk: { s: ['Thumper as a lead blocker who clears out linebackers in the hole.', 'Arrives with bad intentions on iso blocks.'], w: ['Does not sustain blocks; more pop than drive.', 'Gets stood up by bigger linebackers.'] },
    str: { s: ['Strong, compact build ({bench} reps).', 'Plays bigger than his size.'], w: ['Needs to get stronger to handle contact.'] },
  },
  WR: {
    spd: { s: ['Vertical threat who forces safeties to bail at the snap.', 'Blazing {forty}; runs past press corners.', 'Eats cushion in a hurry and stacks corners downfield.', 'Takes the top off a defense.'],
      w: ['Lacks deep speed and will not run away from anybody.', 'Ran {forty}; separation will have to come from route running.', 'Cannot separate vertically.'] },
    acc: { s: ['Explosive off the line; wins early in the route.', 'Gets to top speed in two steps.'], w: ['Slow off the line against press.', 'Long strider who needs time to build speed.'] },
    agi: { s: ['Quick feet and loose hips; sinks into his breaks.', 'Snaps off routes without wasted motion ({cone} three-cone).', 'Can stop on a dime and come back to the ball.'],
      w: ['Stiff in and out of breaks; rounds off routes.', 'Tall, upright runner who struggles to sink his hips.'] },
    rte: { s: ['Polished route runner who sets corners up.', 'Varies his tempo and wins at the top of the route.', 'Understands leverage and finds the soft spot in zone.', 'Runs the full route tree.'],
      w: ['Route tree is limited to a go and a slant.', 'Telegraphs his breaks.', 'Needs to be more precise with his depth.', 'Raw route runner who wins on athleticism alone.'] },
    cth: { s: ['Strong, natural hands; plucks it away from his body.', 'Reliable in traffic and takes hits without dropping it.', 'Catches everything thrown his way.', 'Soft hands on contested throws.'],
      w: ['Concentration drops on routine throws.', 'Body-catcher who lets the ball into his pads.', 'Drops showed up in big moments.'] },
    jmp: { s: ['Wins above the rim on 50-50 balls.', 'Big catch radius with a {vert} vertical.', 'Tracks and high-points the deep ball.'],
      w: ['Does not play to his size on contested catches.', 'Gets out-muscled at the catch point.'] },
    elu: { s: ['Dangerous after the catch; makes the first man miss.', 'Turns short throws into chunk plays.', 'Slippery with the ball in his hands.'], w: ['Not much after the catch; goes down where he is hit.', 'Few yards after the catch.'] },
    btk: { s: ['Runs through tackles after the catch.', 'Hard to bring down in the open field.'], w: ['Goes down on first contact after the catch.'] },
    str: { s: ['Strong hands to beat press and fight through contact.', 'Physical and wins hand fights at the line.'], w: ['Gets rerouted by physical corners.', 'Needs to add strength to beat press.'] },
    rbk: { s: ['Can line up inline and move defensive ends in the run game.', 'Effective blocker who stays attached.', 'Committed blocker on the edge.'], w: ['A liability as an inline blocker.', 'Gets stood up at the point of attack.', 'Effort as a blocker is inconsistent.'] },
  },
  OL: {
    pbk: { s: ['Smooth, patient pass protector who mirrors speed rushers.', 'Anchors well against the bull rush.', 'Sets with good depth and keeps his hands inside.', 'Rarely gets beat clean.'],
      w: ['Oversets and gets beat inside.', 'Struggles to anchor against power.', 'Slow kick slide; speed rushers win the corner.', 'Hands get wide and he gets flagged.'] },
    rbk: { s: ['Generates movement at the point of attack.', 'Finishes blocks and plays to the whistle.', 'Mauler in the run game who drives defenders off the ball.'],
      w: ['More of a positional blocker; does not move people.', 'Lunges and falls off blocks in the run game.', 'Lets defenders get into his chest in the run game.'] },
    str: { s: ['Heavy hands that jolt defenders on contact.', 'Strong upper body; put up {bench} reps.', 'Plays with power from the ground up.'], w: ['Needs time in a pro weight room.', 'Gets pushed back when he does not win with technique.'] },
    awr: { s: ['Smart; passes off stunts and picks up blitzers.', 'Technician with sound fundamentals.', 'Communicates well and rarely busts an assignment.'], w: ['Late to recognize stunts and twists.', 'Penalties have been a problem.', 'Gets confused by exotic pressure.'] },
    agi: { s: ['Light feet; gets to the second level easily.', 'Moves well for {wt} pounds and fits a zone scheme.', 'Can pull and lead on the perimeter.'], w: ['Heavy-footed; struggles in space.', 'Limited range on pulls and screens.'] },
    acc: { s: ['Quick out of his stance; first to contact.', 'Explosive get-off for a big man ({ten} split).'], w: ['Slow out of his stance.', 'Late off the snap; gets beaten to his spot.'] },
  },
  DL: {
    prs: { s: ['Bend and burst off the edge; flattens to the quarterback.', 'Has a plan as a rusher and counters well.', 'Quick hands; wins with a rip and a swim.', 'A consistent pressure producer.'],
      w: ['One-move rusher who stalls when the first move fails.', 'Does not convert speed to power.', 'Pass-rush production does not match the tools.'] },
    pow: { s: ['His bull rush collapses the pocket.', 'Plays with heavy hands and violent club moves.', 'Walks blockers back into the quarterback.'], w: ['Lacks the power to collapse the pocket.', 'Gets stalled when he tries to go through blockers.'] },
    bsh: { s: ['Sheds blocks quickly to make plays against the run.', 'Holds the point of attack and two-gaps.', 'Stout against double teams.'], w: ['Gets washed out by down blocks.', 'Slow to disengage once a blocker latches on.', 'Struggles to hold up against the run.'] },
    tak: { s: ['Wraps up and finishes in the backfield.', 'Reliable tackler who rarely misses.'], w: ['Arrives out of control and misses tackles.', 'Too many missed tackles in the backfield.'] },
    spd: { s: ['Rare closing speed; ran {forty} at {wt} pounds.', 'Chases plays down from the back side.', 'Closes on the quarterback in a hurry.'], w: ['Lacks closing speed; quarterbacks escape him.', 'Ran {forty}; will not chase much down.'] },
    acc: { s: ['First step is explosive; gets into the backfield.', 'Wins with get-off ({ten} split).', 'Fires off the ball and lives in the backfield.'], w: ['Average get-off.', 'Late off the snap.'] },
    str: { s: ['Strong at the point of attack ({bench} reps).', 'Plays with a strong base.'], w: ['Gets moved off the ball by double teams.', 'Needs to get stronger at the point of attack.'] },
    pur: { s: ['Relentless motor; plays to the whistle.', 'Effort never stops.'], w: ['Motor runs hot and cold.', 'Takes plays off when the ball goes away from him.'] },
  },
  LB: {
    tak: { s: ['Thumper who stops runners in their tracks.', 'A sure, form tackler.', 'Takes good angles and finishes.'], w: ['Misses too many tackles in space.', 'Grabs instead of wrapping up.'] },
    pur: { s: ['Sideline-to-sideline range.', 'Instinctive; flows to the ball fast.', 'Never stops running.'], w: ['Takes poor angles in pursuit.', 'Slow to diagnose and gets caught in traffic.'] },
    zcv: { s: ['Comfortable in zone; reads the quarterback\'s eyes.', 'Gets depth on his drops and breaks on the ball.', 'Can carry the seam in zone.'], w: ['Lost in coverage; struggles to find his landmarks.', 'A liability in pass coverage.', 'Late to get to his drop.'] },
    mcv: { s: ['Can carry tight ends and backs in man coverage.', 'Matches up with backs out of the backfield.'], w: ['Cannot match up with backs and tight ends in man.', 'Gets left behind by backs on wheel routes.'] },
    bsh: { s: ['Takes on and sheds lead blockers.', 'Physical at the point of attack.'], w: ['Gets swallowed by climbing linemen.', 'Struggles to get off blocks.'] },
    spd: { s: ['Plays fast; ran {forty}.', 'Closing speed jumps off the tape.'], w: ['Lacks the speed to run with backs to the flat.', 'Ran {forty}; a step slow to the edge.'] },
    prs: { s: ['Effective blitzer with a knack for timing it.', 'Can rush off the edge on passing downs.'], w: ['Not much of a pass rusher.'] },
    awr: { s: ['Quarterback of the defense; gets everybody lined up.', 'Diagnoses plays before the snap.'], w: ['Bites on play action and misdirection.', 'Slow to read his keys.'] },
  },
  DB: {
    mcv: { s: ['Sticky in man coverage; mirrors receivers through the route.', 'Press corner who disrupts timing at the line.', 'Plays in the receiver\'s hip pocket.'],
      w: ['Gives up too much separation in man.', 'Grabby downfield; flags will be an issue.', 'Struggles to turn and run with speed.'] },
    zcv: { s: ['Reads the quarterback and drives on throws in front of him.', 'Smart zone defender with good eyes.', 'Range from the deep middle.'], w: ['Eyes get caught in the backfield.', 'Late to rotate in zone; gives up seams.', 'Inconsistent eyes in zone.'] },
    hnd: { s: ['Ballhawk with natural hands.', 'Turns pass breakups into interceptions.', 'Finds the ball in the air.'], w: ['Drops interceptions he should have.', 'Does not locate the ball downfield.'] },
    spd: { s: ['Recovery speed to make up for a false step.', 'Ran {forty}; can carry vertical routes.', 'Rare speed for the position.'], w: ['Long speed is a concern; gets stacked on vertical routes.', 'Will need help over the top.', 'Ran {forty}; teams will test him deep.'] },
    agi: { s: ['Fluid hips; flips and runs easily.', 'Quick feet in his backpedal and a sharp plant-and-drive.', 'Changes direction easily ({cone} three-cone).'], w: ['Stiff hips; struggles to transition.', 'Upright backpedal and slow to break.'] },
    jmp: { s: ['Competes at the catch point with a {vert} vertical.', 'High-points the ball.'], w: ['Gets outmatched by bigger receivers on jump balls.'] },
    tak: { s: ['Physical and willing in run support.', 'Strong tackler who comes downhill fast.'], w: ['Inconsistent tackler who dives at ankles.', 'Shies away from contact in run support.'] },
    acc: { s: ['Quick to close on the ball.'], w: ['Slow to break on throws in front of him.'] },
    pur: { s: ['Takes good angles to the ball.'], w: ['Takes bad angles in run support.'] },
    awr: { s: ['Smart; quick to read route combinations.', 'Rarely out of position.'], w: ['Bites on double moves.', 'Eyes wander and he gets beat deep.'] },
  },
  K: {
    kpw: { s: ['Big leg with range past 55 yards.', 'Booming leg; touchbacks are routine.', 'Leg strength stands out.'], w: ['Leg strength is average.', 'Distance from long range is a question.'] },
    kac: { s: ['Accurate and consistent; his mechanics repeat.', 'Rarely misses from inside 45.', 'Places the ball where he wants it.'], w: ['Inconsistent accuracy.', 'Too many misses from makeable range.'] },
  },
};
const DGR_NOUN = { spd: ['top-end speed', 'real speed', 'long speed'], acc: ['burst', 'a quick first step', 'explosive quickness'], agi: ['quick feet', 'loose hips', 'change of direction'], str: ['functional strength', 'a strong base', 'power'],
  awr: ['instincts', 'football IQ', 'a feel for the game'], thp: ['a live arm', 'arm strength', 'velocity'], tha: ['accuracy', 'ball placement', 'touch'], cth: ['reliable hands', 'strong hands', 'a big catch radius'],
  rte: ['route savvy', 'precise routes', 'polish as a route runner'], btk: ['contact balance', 'power after contact'], elu: ['elusiveness', 'wiggle in the open field', 'vision'], car: ['ball security'],
  rbk: ['run blocking', 'movement at the point of attack'], pbk: ['pass protection', 'a sturdy anchor', 'patient hands'], tak: ['sure tackling', 'physical tackling'], pur: ['range', 'a relentless motor'],
  prs: ['pass-rush skill', 'bend off the edge', 'rush moves'], pow: ['power', 'heavy hands', 'a violent bull rush'], bsh: ['block shedding', 'stoutness at the point'], mcv: ['man-cover skills', 'sticky coverage', 'mirror skills'],
  zcv: ['zone instincts', 'range in coverage', 'eyes in zone'], hnd: ['ball skills', 'hands', 'a nose for the ball'], jmp: ['leaping ability', 'explosiveness'], kpw: ['a big leg', 'leg strength'], kac: ['accuracy', 'consistency'] };
const DGR_WORRY = { spd: 'long speed', acc: 'burst', agi: 'change of direction', str: 'strength', awr: 'processing', thp: 'arm strength', tha: 'accuracy', cth: 'hands', rte: 'route running', btk: 'power', elu: 'elusiveness', car: 'ball security',
  rbk: 'run blocking', pbk: 'pass protection', tak: 'tackling', pur: 'range', prs: 'pass-rush plan', pow: 'power', bsh: 'block shedding', mcv: 'man coverage', zcv: 'eyes in zone', hnd: 'ball skills', jmp: 'leaping', kpw: 'leg strength', kac: 'accuracy' };
// when even his worst trait is good, or his best one is not
const DGR_NIT = { QB: ['Footwork gets sloppy when he is comfortable.', 'Will try to force the big play now and then.', 'Needs to protect himself better when he runs.'],
  G: ['Needs to play with more consistent pad level.', 'Has to stay healthy; missed time in college.', 'Effort on the back side comes and goes.', 'Technique still gets sloppy late in games.', 'Will need to learn a pro playbook.'] };
const DGR_PLUS = ['Plays hard; coaches love his motor.', 'Smart, coachable player.', 'Special teams value right away.', 'Tough; played through injuries.', 'Team captain and a strong locker-room presence.'];

// what this scout believes about a prospect. The stopwatch is public, so athletic ratings with a combine number come from it.
function dgrSeen(s, p) {
  const sc = p.sc || {}, spec = s.spec && s.spec !== 'all' && (SPEC_POS[s.spec] || []).includes(p.pos), err = (11 - (s.r || 5)) * 0.85 * (spec ? 0.7 : 1) * (1 - 0.6 * (sc.acc || 0)), cr = cmbRead(p), A = {};
  for (const k of ATTRS) A[k] = cr[k] != null ? cr[k] : Math.round(clamp((p.a[k] ?? 40) + msHashG(((p.id | 0) * 31 + (s.id | 0)) | 0, 100 + ATTRS.indexOf(k)) * err, 10, 99));
  return A;
}
function dgrTokens(p) {
  const c = p.comb || {}, t = { wt: p.wt, ht: msrHt(p.ht, (msrEnsure(p)).h8) };
  if (c.forty != null) t.forty = c.forty.toFixed(2); if (c.ten != null) t.ten = c.ten.toFixed(2); if (c.vert != null) t.vert = msrFmt('vert', c.vert); if (c.broad != null) t.broad = msrFmt('broad', c.broad);
  if (c.bench != null) t.bench = c.bench; if (c.cone != null) t.cone = c.cone.toFixed(2); if (c.arm != null) t.arm = msrFrac(c.arm) + '"'; if (c.hand != null) t.hand = msrFrac(c.hand) + '"';
  return t;
}
function dgrFill(s, t) { return s.replace(/\{(\w+)\}/g, (m, k) => t[k] != null ? t[k] : m); }
function dgrUsable(s, t) { return !/\{(\w+)\}/.test(s.replace(/\{(\w+)\}/g, (m, k) => t[k] != null ? 'x' : m)); }
// measurables that are worth a line of their own
function dgrBody(p, t) {
  const c = p.comb || {}, pro = [], con = [], pos = p.pos, ht = p.ht, wt = p.wt, arm = c.arm, hand = c.hand, pct = k => c[k] != null ? msrPct(pos, k, c[k], c.wt) : null;
  if (pos === 'OT' && arm != null) { if (arm >= 34.75) pro.push('Long arms ({arm}) keep rushers off his chest.'); if (arm <= 33) con.push('Arms ({arm}) are short for a tackle; some teams will move him inside.'); }
  if ((pos === 'OG' || pos === 'C') && wt >= 325) pro.push('Wide, heavy body ({wt}) that is hard to move.'); if ((pos === 'OG' || pos === 'C') && wt <= 298) con.push('Needs to add weight to hold up inside ({wt}).');
  if (pos === 'DE' && arm != null && arm >= 34.5) pro.push('Length ({arm} arms) to keep tackles off his frame.'); if (pos === 'DE' && wt <= 252) con.push('Light ({wt}) for an every-down end; may be a situational rusher.');
  if (pos === 'DT' && wt >= 328) pro.push('Massive at {wt}; eats double teams.'); if (pos === 'DT' && wt <= 298) con.push('Undersized for the interior at {wt}.');
  if (pos === 'CB' && ht >= 73 && (arm == null || arm >= 32)) pro.push('Rare length for a corner ({ht}).'); if (pos === 'CB' && ht <= 70) con.push('Short ({ht}); bigger receivers will post him up.');
  if (pos === 'WR' && ht >= 75) pro.push('Big target ({ht}, {wt}) with a wide catch radius.'); if (pos === 'WR' && ht <= 70) con.push('Undersized ({ht}); may be limited to the slot.');
  if (pos === 'QB' && hand != null) { if (hand >= 10) pro.push('Big hands ({hand}); controls the ball in bad weather.'); if (hand <= 9.125) con.push('Small hands ({hand}); ball security in the cold is a question.'); }
  if (pos === 'QB' && ht <= 73) con.push('Shorter than you would like at {ht}; has to find throwing lanes.');
  if (pos === 'RB' && wt >= 222) pro.push('Big back at {wt}, built to carry the load.'); if (pos === 'RB' && wt <= 198) con.push('Small frame ({wt}); durability as a lead back is a concern.');
  if (pos === 'TE' && ht >= 78) pro.push('Huge target at {ht}.'); if (pos === 'LB' && wt <= 228) con.push('Light ({wt}); guards can swallow him.');
  if (p.combZ != null && p.combZ >= 1.2 && t.forty) pro.push('Elite tester: {forty} in the 40' + (t.vert ? ', {vert} vertical.' : '.')); else if (p.combZ != null && p.combZ <= -1) con.push('Testing numbers were below average for the position.');
  if (!['OT', 'OG', 'C', 'DT', 'K', 'P', 'QB'].includes(pos) && pct('vert') >= 92) pro.push('Explosive athlete who jumped {vert} at the combine.');
  if (['OT', 'OG', 'C', 'DE', 'DT'].includes(pos) && pct('bench') >= 92) pro.push('Strong: {bench} reps on the bench.'); if (['OT', 'OG', 'C', 'DE', 'DT'].includes(pos) && pct('bench') != null && pct('bench') <= 8) con.push('Only {bench} reps on the bench; needs time in the weight room.');
  if (['WR', 'CB', 'S', 'RB'].includes(pos) && pct('forty') != null && pct('forty') <= 8) con.push('Ran {forty}; long speed is a real question.');
  return { pro: pro.filter(x => dgrUsable(x, t)), con: con.filter(x => dgrUsable(x, t)) };
}
// the scout's grade: what he thinks the player is now and could become, on a 4.5 (camp body) to 7.9 (rare) scale
function dgrGrade(p, A) {
  const w = OVR_W[p.pos] || {}; let s = 0, n = 0; for (const k in w) { s += A[k] * w[k]; n += w[k]; } const so = n ? s / n : p.ovr;
  const sp = (potKnown(p) ? p.scoutPot : (p.scout || p.ovr) + 6) + (so - (p.scout || so)) * 0.5, v = so * 0.55 + sp * 0.45 + (p.pos === 'QB' ? 2 : 0) - (p.pos === 'K' || p.pos === 'P' ? 6 : 0);
  return Math.round(clamp(5.9 + (v - 60) * 0.065, 4.5, 7.9) * 10) / 10;
}
const DGR_BAND = [[7.2, 'Blue-chip'], [6.7, 'Starter'], [6.3, 'Future starter'], [6.0, 'Role player'], [5.7, 'Depth'], [0, 'Long shot']];
function dgrBand(g) { for (const [t, n] of DGR_BAND) if (g >= t) return n; return 'Long shot'; }
function dgrProj(g, ra, p, pk) {
  const role = ra ? ra.role : SX_POSN[p.pos], posn = SX_POSN[p.pos];
  if (p.pos === 'K' || p.pos === 'P') return g >= 6.4 ? pk([`Starting ${posn} from day one`, `Should win the ${posn} job as a rookie`]) : g >= 5.8 ? pk([`Will compete for a ${posn} job in camp`, 'Camp leg with a real chance']) : pk(['Camp leg', 'Long shot to make a roster']);
  if (g >= 7.2) return pk([`Day 1 starter with Pro Bowl upside`, `Instant starter and a future Pro Bowl ${role}`, ['QB', 'OT', 'DE'].includes(p.pos) ? `Franchise ${posn}` : `Day 1 starter; a top-five ${posn} in a few years`]);
  if (g >= 6.7) return pk(['Day 1 starter', `Starting ${role} from day one`, 'Plug-and-play starter']);
  if (g >= 6.3) return pk(['Starter by year two', `Should start early as a ${role}`, 'Contributes as a rookie, starts soon after']);
  if (g >= 6.0) return pk([`Rotational ${role} with starter upside`, `Sub-package ${role} early on`, 'Developmental starter']);
  if (g >= 5.7) return pk([`Backup ${posn} and special teamer`, `Depth ${role}`, 'Rotational piece']);
  return pk(['Camp body; practice-squad candidate', 'Long shot to make a roster', 'Priority free agent type']);
}
function dgrSummary(p, ra, top, low, g, t, pk, rng) {
  const posn = SX_POSN[p.pos], rl = ra ? ra.role : posn, an = /^[aeiou]/.test(rl) ? 'An' : 'A', best = top ? pk(DGR_NOUN[top] || ['his tools']) : 'his tools', worry = low ? DGR_WORRY[low] || 'consistency' : 'consistency';
  const col = p.col || 'his school', ht = t.ht.replace(/ (\d)\/(\d)/, ''), lines1 = [
    `${an} ${rl} from ${col} who wins with ${best}.`, `${ht}, ${p.wt}-pound ${rl} whose ${best} jumps off the tape.`, `Productive ${posn} at ${col}. His ${best} is the calling card; ${worry} is the worry.`,
    `${an} ${rl} with ${best}. Needs work on his ${worry}.`, `Built like a pro at ${ht}, ${p.wt}, with ${best} and a ${rl}'s skill set.`, `${an} ${rl} who does one thing at a high level: ${best}.`,
    `Teams will fall for his ${best}. The question is his ${worry}.`];
  const sc = p.sc || {}, known = sc.lvl >= 2, lines2 = [];
  if (known && p.arch === 'raw') lines2.push('The tools are rare, but he is a year or two away.', 'Teams will draft the traits and hope the polish comes.');
  if (known && p.arch === 'polished') lines2.push('What you see is what you get, and what you see can play now.', 'Polished enough to play right away.');
  if (known && p.arch === 'boom') lines2.push('High ceiling, low floor.', 'Could be a steal or a bust; there is little in between.');
  if (known && p.arch === 'gem') lines2.push('Flew under the radar; I think he is better than his stock.', 'Nobody is talking about him yet. They will.');
  if (p.age >= 24) lines2.push('Older prospect, so the ceiling is close to what he is now.'); if (p.age <= 21) lines2.push('One of the youngest players in the class, with room to grow.');
  if (p.combZ != null && p.combZ >= 1.2) lines2.push('Tested like a freak at the combine.'); if (p.combZ != null && p.combZ <= -1) lines2.push('A rough combine will push him down some boards.');
  const band = g >= 6.8 ? ['Should hear his name early.', 'A first-round talent if the medicals check out.', 'Belongs in the first round.', 'Teams picking early will be all over him.', 'Hard to find a reason he slips.']
    : g >= 6.2 ? ['A solid prospect with a clear role.', 'Day-two value with a chance to start.', 'A safe pick who should stick around for a while.', 'Not flashy, but he plays winning football.']
    : g >= 5.8 ? ['A mid-round type who has to win a job in camp.', 'Worth a pick on the third day.', 'A developmental prospect with one pro skill.'] : ['Will have to earn a spot on special teams.', 'A late-round flier.', 'An undrafted free agent type unless he tests well.'];
  return pk(lines1) + ' ' + pk(lines2.length && rng() < 0.7 ? lines2 : band);
}
// the full report. s = a scout (or a stored copy of one: {id, r, spec, fn, ln})
function dgrReport(s, p, n, y) {
  const rng = seededRng(((p.id | 0) * 7919 + (s.id | 0) * 131 + (n != null ? n : ((p.sc || {}).reports || []).length) * 17 + ((y != null ? y : L.year) | 0)) >>> 0), pk = a => a[Math.floor(rng() * a.length)];
  const A = dgrSeen(s, p), G = DGR_GROUP[p.pos] || 'LB', bank = DGR[G] || {}, t = dgrTokens(p), keys = (DGR_KEYS[p.pos] || []).filter(k => bank[k]), z = sxZ(p.pos, A);
  const order = keys.map(k => [k, z[k]]).sort((a, b) => b[1] - a[1]), body = dgrBody(p, t), used = new Set(), phrase = (k, kind) => { const opts = bank[k][kind].filter(x => dgrUsable(x, t) && !used.has(x)); if (!opts.length) return null; const x = pk(opts); used.add(x); return dgrFill(x, t); };
  const pros = [], cons = [], proK = new Set();
  if (body.pro.length) pros.push(dgrFill(pk(body.pro), t));
  for (const [k, v] of order) { if (pros.length >= 3) break; if (v < -0.2 && pros.length >= 1) break; const x = phrase(k, 's'); if (x) { pros.push(x); proK.add(k); } }
  while (pros.length < 3) { const x = pk(DGR_PLUS.filter(y => !pros.includes(y))); if (!x) break; pros.push(x); }
  if (body.con.length) cons.push(dgrFill(pk(body.con), t));
  const ncon = order.length && order[order.length - 1][1] < -0.6 && order.length > 3 ? 3 : 2;
  for (const [k, v] of order.slice().reverse()) { if (cons.length >= ncon) break; if (proK.has(k)) continue; if (v > 0.5) { const nit = DGR_NIT[G] || DGR_NIT.G; const y = pk(nit.concat(DGR_NIT.G).filter(q => !cons.includes(q))); if (y) cons.push(y); continue; } const x = phrase(k, 'w'); if (x) cons.push(x); }
  while (cons.length < 2) { const y = pk(DGR_NIT.G.filter(q => !cons.includes(q))); if (!y) break; cons.push(y); }
  const ra = rarchOf(p, A), g = dgrGrade(p, A), comp = plkFor(p), top = order.length ? order[0][0] : null, low = order.length ? order[order.length - 1][0] : null;
  return { by: `${s.fn || ''} ${s.ln || ''}`.trim(), sid: s.id, sum: dgrSummary(p, ra, top, low, g, t, pk, rng), pros, cons, proj: dgrProj(g, ra, p, pk), grade: g, band: dgrBand(g), rd: typeof projRound === 'function' && L.draft.includes(p.id) ? projRound(p) : null, ra: ra ? ra.n : null,
    comp: comp ? (comp.file ? `Comp: ${comp.txt}` : `Plays like ${comp.txt} (${comp.tag})`) : null };
}
// the short version that goes in the inbox and the report history
function dgrShort(r) { return `${r.sum} Best: ${r.pros[0]} Worry: ${r.cons[0]} Projection: ${r.proj}${r.rd ? ' (round ' + r.rd + ')' : ''}. Grade ${r.grade.toFixed(1)}.`; }
// a scout files a report: keep what is needed to write the full one again (the scout may be gone by the time you read it)
function dgrFile(s, p) {
  const n = ((p.sc || {}).reports || []).length, r = dgrReport(s, p, n);
  p.sc.dgs = { id: s.id, r: s.r, spec: s.spec, fn: s.fn, ln: s.ln, n, y: L.year, w: L.week };
  return dgrShort(r);
}
// the latest full report on a prospect (rewritten from the stored scout so it reads the same every time)
function dgrLatest(p) { const d = p && p.sc && p.sc.dgs; if (!d) return null; return Object.assign(dgrReport(d, p, d.n, d.y), { y: d.y, w: d.w }); }
