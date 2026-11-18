# Game tester report: dist/playcaller_qa.html (frozen snapshot, built 2026-11-17 23:22)

**FAIL**: 2 blockers, 10 major, 13 minor (including 3 latent, found by reading code, and 2 observations).

Every finding below was reproduced on the frozen snapshot, `C:\Users\dwint\football-game\dist\playcaller_qa.html`. I ran it in real-GPU Chromium (d3d11, 60 fps) on a phone (390x844, touch, DPR 2), a rotated phone (844x390) and a desktop (1280x800). Headless checks used the core+league+engine code taken from that same file (`qa/tester/snapcode.mjs`). Line numbers are **dist/playcaller_qa.html** lines; the source file and function are named too.
Note: `src/` was edited after the snapshot. At 00:10 it already had z-index rules for the HUD layers and a renamed `#hud .csay` bubble, which may fix B1 and B2. The lines behind M1, M2 and M6 were still unchanged. Re-verify against the next build.

Test scripts: `C:\Users\dwint\football-game\qa\tester\` (lib.mjs harness, monitor.js in-page observer, fullgame.mjs, scen.mjs <name>, controls.mjs, season.mjs, headless.mjs, ...).
Screenshots: `C:\Users\dwint\football-game\qa\shots\tester\`.

---

## BLOCKERS

### B1. Receiver bubbles and the pause button can't be tapped during a play (phone and mouse)
- **What happens:** From pre-snap to the whistle, the full-screen virtual-stick layer `#gui .touch.on` sits above `#hud`, which holds the receiver bubbles (`.bub .rb`) and the pause button. Tapping a receiver starts the stick instead of throwing. Tapping pause does nothing. **On a phone you cannot complete a pass:** the QB holds the ball until he is sacked or you press Throw away. You also cannot pause between snap and whistle. A desktop mouse is blocked the same way; only keys 1-6 and Esc work.
- **Expected:** a tap on a receiver throws to him, and the pause button works at any time.
- **Repro (phone):** Play → Kick off → offense sheet → any pass → SNAP → wait for the green bubbles → tap one.
- **Evidence:** `elementFromPoint` at the centre of each of the 4 bubbles returned `touch on` (4/4), and the pause button returned `touch on` both pre-snap and live. After tapping the X1 bubble: `thrown:false, windup:false`, and the play ended `SACK -7 yds`. Desktop: clicking a bubble did not throw; pressing `Digit1` did. Shots: `p1_phone_03_qb.png`, `p1_phone_02_preO.png`. Script: `qa/tester/probe1.mjs`, `probe2.mjs`.
- **Where:** dist:102 `.touch{position:absolute;inset:0}` with dist:62-63 (pointer-events). `#gui` comes after `#hud` in the DOM (dist:4003, `MATCH.init`), and neither layer sets a z-index in the snapshot. `actsFor()` (dist:4397) adds `.touch.on` for preO/qb/run/d/dAir.
- **Fix:** put `.bub`/`.mbtn` above `.touch` (z-index, as src now does), or make `.touch` cover only the left part of the screen.

### B2. Home PLAY/WATCH/INSTANT/Sim to playoffs are covered by invisible boxes, and the coordinators' briefing text is invisible
- **What happens:** The in-game coordinator bubble rule `.say{position:absolute;left:50%;bottom:...;transform:translateX(-50%);opacity:0;...}` (dist:90, from src/shell/20_match.css) is global. It also hits the management screens' `<div class="say">` coordinator lines (src/ui/30_home.js:32-33 briefing card; src/ui/50_plays.js:42-48 game plan). `src/ui/10_ui.css:53` (dist:211) overrides only display, gap and margin. So every coordinator line becomes an invisible, absolutely positioned box over the page.
  - Phone home: two invisible boxes (178x392 and 178x305 at x 106-284) cover the centres of PLAY, WATCH, INSTANT and SIM TO PLAYOFFS. Tapping PLAY in the centre does nothing; only its left ~38 px works. Tapping INSTANT does nothing.
  - Desktop home: a 533x105 box covers all four buttons completely. A mouse click on PLAY, at the centre or 6 px from the left edge, does nothing. **On desktop you cannot start a game from the home screen.**
  - Game Plan screen: the same boxes block "Reset to coordinator picks", "Defense", "Attack deep", "Quick game", "2nd & short", "2nd & medium" (phone) and the emphasis/situation chips "Establish the run" through "Goal line" (desktop).
  - The coordinators' words are invisible. The home "Coordinator briefing" card shows only its title, and the Game Plan coordinator panel is an empty bar. This breaks your #1 priority (coordinators who talk).
- **Expected:** the coordinator lines are visible and nothing invisible covers the buttons.
- **Evidence:** `qa/tester/saycover.mjs` and `playtap.mjs` output (`phone PLAY ... tap centre opens game: false | tap left edge opens game: true`, `desk ... false | false`). Shots: `season_05_home.png`, `season_08_view_plan.png`.
- **Fix:** scope the match rule to `#hud .say` (src now uses `#hud .csay`).

---

## MAJOR

### M1. A scramble that crosses the line and is then tackled is scored as a SACK
- **What happens:** `whistle()` labels any tackle of the QB on a pass play before a throw as a 'sack'. It has no `!this.scramble` check (dist:3245 forward-progress branch, dist:3249 tackle branch). The banner reads "SACK 9 yds · A. Rogers", the defender is credited with a sack, the QB with 'sacked', and the yards are not counted as rushing.
- **Evidence:** In the phone game, all 3 scrambles that crossed the line were scored as sacks (+9.5, +1.7, +10.0 yd). Headless run on the snapshot engine: 68 of 150 user scrambles straight upfield were recorded as SACK with positive yards (up to +19.2). Script: `qa/tester/headless.mjs` (section C).
- **Fix:** add `&& !this.scramble` to both sack conditions. Also only call it a sack if the spot is behind the line of scrimmage.

### M2. "Throw away" throws a TypeError on every physics step, freezing the field and then making every player jump
- **What happens:** `throwAwayUser()` sets `q.windTarget = 'away'` (dist:2948). `faceMove()` then reads `p.windTarget.p.x` (dist:2500) and throws `Cannot read properties of undefined (reading 'x')` on each step of the 0.12 s windup, about 14 page errors per throw-away. The exception aborts `Play.step` and the rest of `frame()`, so nothing renders and the HUD freezes for about 0.25 s while the accumulator grows. When the windup ends, about 28 physics steps run in one frame, so all 22 players jump 1.4-1.8 m. The monitor flagged 7 and 5 'teleports' on my two throw-aways.
- **Repro:** offense → pass play → SNAP → tap "Throw away" after about 1.2 s. Console: 28 identical page errors in `log_fullgame_phone_11.txt`.
- **Fix:** guard with `p.windTarget && p.windTarget.p` (the same guard already exists in other places).

### M3. Choosing "Let the coordinators call it (watch)" at your own pre-snap freezes the game at the line
- **What happens:** `startPlay()` only schedules the auto-snap when `G.userSide !== 'O'` (dist:4179). The pause-menu 'watch' branch (dist:4539) only handles the 'call' stage. With mode set to 'watch', `ctxKey()` returns 'none', so there is no SNAP button and Space does nothing. The game waits at the line forever, until you pause and choose Take over.
- **Repro (desktop):** call an offensive play → at the line press Esc → "Let the coordinators call it (watch)" → wait.
- **Evidence:** 10 s later still `stage:'pre', phase:'pre', mode:'watch'`, clock unchanged. Shot: `sc_watchpre_desk_00_watch_pre_after10s.png`.
- **Fix:** when switching to watch at pre-snap, snap or schedule the auto-snap, and hand the play to the AI (see m4).

### M4. Pausing during the field-goal kick meter deletes the meter, and the game then waits forever
- **What happens:** `pauseMenu()` (dist:4532) overwrites the overlay that holds the meter. On Resume, `closeOverlay()` leaves no meter and no KICK button, but `G.kickCb` is still set and the stage stays 'kick'. Only a blind Space/Enter on a keyboard continues the game.
- **Repro (desktop):** 4th down in range → FG → press Esc while the needle moves → Resume.
- **Evidence:** after Resume `{meter:'GONE', kickBtn:'NO', stage:'kick', kick:true}`, unchanged 5 s later. Pressing Space gave "42-yd field goal GOOD". Shots: `sc_fgpause_desk_0*.png`.
- **Fix:** block pausing during the kick meter, or rebuild the meter on resume.

### M5. Field goals and punts are still allowed after the running clock has expired
- **What happens:** `startPlay()` enforces "CLOCK RUNS OUT". `fieldGoal()` (dist:4291) and `punt()` (dist:4279) just clamp `G.clock - G.runoff` to 0 and kick. The sheet even warns "The clock runs out before the snap unless you call timeout", yet the field goal counts. This lets you kick a last-second FG without a timeout.
- **Repro:** Q2 0:03 with the clock running (20 s runoff), in FG range → FG → KICK.
- **Evidence:** 3 points awarded with the play-by-play line "Q2 0:00 PAS 42-yd field goal GOOD", then halftime. The punt case: "Q2 0:00 PAS punts 30 yds". Shot: `sc_fgclock_desk_00_sheet_clock_out.png`.
- **Fix:** apply the same check as `startPlay()` in `fieldGoal()` and `punt()`.

### M6. The two-point try runs the game clock
- **What happens:** `processResult()` subtracts `res.t` from the clock (dist:4222) before the two-point branch (dist:4231).
- **Evidence:** Q2, clock set to 0:40 at the try; a 2.79 s two-point play left the clock at 0:37.21. An earlier run with 0.22 s left ran the clock to 0.
- **Fix:** skip the clock deduction (and the two-minute-warning check) when the play is a two-point try.

### M7. Juke/Spin/Stiff arm/Truck do nothing on a run unless you've already touched the stick that play, and the press fires later
- **What happens:** Move flags are only read in `userMove()`. For an offensive player, `userDriven()` requires `userTouched` (dist:2473), and the AI runner uses its own `_ai` flags. So a tap on Juke during an AI-driven run is ignored. The flag stays latched and fires whenever you next touch the stick.
- **Evidence:** 3 of 3 no-stick taps on RB runs did not fire, and `input.juke` was still true afterwards in 2 of them. A two-finger juke while steering does work (`jukeT 0.2`). Scripts: `fullgame.mjs` (plan `runNoStick`), `controls.mjs`.
- **Fix:** set `userTouched` (or apply the move) when a move button is pressed, and clear stale flags.

### M8. Landscape phone: the play-call action row is off-screen
- **What happens:** At 844x390 the sheet spans y 86-390, but the coach cards go to 426, the chips to 444, and the action row sits at 444-486. **Timeout, FG, Punt, Kneel, Spike, Sim drive and ☰ cannot be reached**, and the sheet does not scroll. Portrait is fine (action row at 751-834, every button tappable).
- **Where:** `.sheet` max-height 78% (dist:116), children that don't shrink, and 3:2 card canvases (dist:126).
- **Evidence:** `sheet_layout.mjs` output, shot `sheet_02_landscape_sheet.png`.
- **Fix:** let the sheet scroll or keep the action row sticky in landscape, and use smaller card art.

### M9. Portrait camera: on defense your player and the receivers are mostly off-screen
- **What happens:** Measured over 12 defensive calls (1489 live frames): your controlled defender was on screen in 32% of frames, the receivers in 13%, and the ball or landing spot in 71%. On offense the receivers were on screen in 30% of frames (their bubbles are pinned to the screen edges). The 'D' camera looks from behind your defense into the backfield, so routes run toward the camera and drop off the bottom of the screen. Roughly the top quarter of the portrait screen is black sky.
- **Effect:** steering and swatting on defense is mostly blind, and you can't read the coverage.
- **Evidence:** `qa/tester/visibility.mjs`; shots `burst_03_D0_2.png`, `burst_08_D0_7.png`, `burst_14_D1_4.png`.

### M10. Receivers lying on the ground still show a green "open" bubble, and throws to them land on empty grass ("Nobody there")
- **What happens:** `bubbles()` colours each bubble from `openness()` only (dist:4433). `catchPoint()` ignores players who are not upright (dist:2999). Receivers on drags and flats often trip over fallen linemen (`trips()`).
- **Evidence:** In the phone game, 2 of my throws to receivers rated 9.6 and 5.6 "open" ended "Nobody there". Headless, same engine: throwing to the most-open receiver at 2.4 s gave 30 "Nobody there" out of 263 (11.4%), and 18 of those 30 targets were on the ground at the catch point (mostly flat and drag routes). At 1.2 s the rate is 5.6%; the CPU QB gets 9.7%. Script: `qa/tester/nobody.mjs`.
- **Fix:** grey out the bubble (and zero the openness) when the receiver isn't upright, and have the CPU QB skip him.

---

## MINOR

- **m1. A defensive audible changes the CPU's offensive play.** `showSheet('D')` calls `callFor(off,'O')` again (dist:4454). Evidence: "offense play before Gun Inside Zone, sheet's offense now Gun Draw". You see their formation, then they switch plays. Fix: reuse `G.cur.op` when the audible comes from pre-snap.
- **m2. A double tap on Timeout uses two timeouts** (3→1). Timeout is also offered when the clock is already stopped (runoff 0) (dist:4501, `onSheetClick`).
- **m3. A double tap on a play card starts the play twice:** two Play objects and two `LG.noteCall` records (`onSheetClick`, dist:4495). The sheet stays clickable while it slides away.
- **m4. Switching to watch from the pause menu mid-play as QB:** the play keeps `userSide:'O'`, so the AI QB never throws (`qbAI` returns at dist:2554). Result: "Carter sack the QB" after 2.5 s.
- **m5. The watch-mode speed button only speeds up live physics.** Timers, banners and dead-ball pauses run on unscaled `G.time` (dist:4056). 15 real seconds at 4× advanced the game clock only from 1:00 to 0:47.7.
- **m6. Edge-pinned bubbles overlap:** SL3 and Z4 are both pinned at x=360, 16 px apart (42 px bubbles), so one is untappable even after B1 is fixed.
- **m7. On defense you get only 1.9 s at the line** before the CPU snaps (dist:4179). Pre-snap Switch cycles in roster order (LB1→CB1→CB2→CB3→…), so choosing a specific defender before the snap is impractical.
- **m8. The game runs in slow motion under CPU load.** Each frame's dt is capped at 0.05 s (`frame()`, dist:4054). With CPU throttling: 4x → 44 fps, 1.00 game-s per real-s; 8x → 17-27 fps, 0.69-0.80; 14x → 7-9 fps, 0.31-0.48. Low-end phones will play slow.
- **m9. (latent, from the code)** Defensive fumble recovery spot (dist:4243, `nyl = 100 - spot; if (nyl >= 99.5) nyl = 20`). The condition looks inverted. A recovery in the defense's own end zone (spot ≥ 100) puts the ball at their 1 instead of a touchback at the 20. A recovery at the offense's 0-0.5 yd line gives the defense the ball at its own 20 instead of the 1.
- **m10. (latent, from the code)** `kneel()` subtracts the runoff directly, so a kneel that runs the clock across the two-minute mark skips the warning (the warning is only checked in `nextSnap()` and `processResult()`).
- **m11. (latent, from the code)** "Sim drive" keeps simulating after halftime if your team receives the second-half kickoff. Only a change of possession stops it (dist:4094).
- **m12. (observation)** Special teams are banners only: no 3D kickoff, punt or FG, and no return to control. The FG meter is drawn over the previous play's frozen players.
- **m13. (observation)** The home "Instant" button runs the ratings-based `instantUserGame()`/`simGame`, not MATCH's physics 'instant' mode. Instant results and stats therefore come from a different model than played or watched games.

---

## Tested and working (actually run)
- **Boot and setup:** league creation, team pick, sculpted-model load (2.5 s), intro card, Kick off (real tap). (The intro Back button was not pressed.)
- **A full 45-snap game on the phone (60-second quarters), driven with real taps and CDP touch drags.** An in-page rule checker validated spot, down, distance and clock after every snap: **0 down/distance/spot/clock errors.** No console errors other than M2.
- **Call sheet:** coach picks, chips, full list (scrolls with a real swipe, 38 plays), Flip, Audible (offense and defense), Timeout (3→2, runoff cleared), Spike (down +1, clock stops), Kneel (3 kneels: -1 yd each, clock runs, the CPU answers with a timeout; no kneel on 4th down), Punt, FG through the meter (twice), going for it on 4th, turnover on downs, Sim drive, ☰ menu.
- **Scoring:** TD, extra point, two-point try (fail and success banners), safety (+2, free kick with a return), INT (in a sim drive).
- **Offense controls:** throws with keys 1-6 on desktop; throws through the bubble event on the phone (workaround for B1); scramble with the stick; two-finger juke while steering; Throw away (works apart from M2).
- **Defense controls:** pre-snap Switch, live Switch (nearest defender to the ball), TACKLE range check (no lunge at 14 m, lunge inside 3.4 m), SWAT (fires in the last 0.35 s of flight).
- **Clock and periods:** two-minute warning (a Q4 play crossing 0:15 stops the clock and shows the banner); end of quarter; halftime (the other team receives, timeouts reset to 3); overtime (2 timeouts each, a sudden-death FG ends it; a tie at the end of OT shows TIE GAME and records 0-0-1).
- **Game modes:** Sim to end (3-5 s); Quit (result not counted, week unchanged); Watch (plays itself, speed button cycles 1×/2×/4×, pause reachable, Take over brings up your call sheet); Instant (advances the week when called; the button itself is blocked by B2).
- **End of game:** the final card (team stats, leaders, player of the game) and Continue work. The result is applied: game marked done, scores, W-L, standings balance (16-16), QB season stats, press-conference modal. Next week's game opens and reaches the call sheet.
- **Management:** all 26 views render with no errors (home, inbox, roster, depth, develop, film, stories, uniforms, teaminfo, plan, playbook, staff, coach, facilities, trade, fa, scouting, draft, mock, contracts, standings, schedule, leaders, history, records, settings).
- **Restarts:** quit and restart 4 times. No leaked timers or player rigs, JS heap flat at 42 MB, 60 fps each time.
- **Rotation:** turning the phone mid-play resizes the canvas correctly (only the sheet layout breaks, M8).
- **Physics feel (your priorities), on the snapshot engine:**
  - Breaking tackles is not easy: 0.09 broken tackles per run (AI), 1.6 yards after contact, 3.53 yd per carry (300 runs).
  - The user defender is effective but not overpowered: steering a linebacker and pressing TACKLE cut runs from 3.53 to 2.22 yd per carry, and his man wrapped the carrier on 42% of the plays where TACKLE was pressed (113 of 271).
  - Pursuit looks sane: free defenders within 12 m of the carrier ran away from him 2.2% of the time, stood still 0.5%, and reversed direction 0.03%.
  - Blocking: down linemen unblocked only 0-8% of the time; offensive linemen engaged 56-80%. (On runs, 56% of TE/FB/WR assigned blockers are still not engaged at 1.8 s; worth a look given "real blocking for every player", but I am not calling it a bug.)
  - No teleports except during M2. The ball stays within 1.0 m of the carrier except while a sacked QB is falling (max 1.46 m).
- **Passing balance (known issue):** headless, the user throwing to the most-open receiver got 62-71% completions and 9.8-11.7 yd per attempt (CPU QB: 58%, 11.1). In the real phone game I went 6/11 for 93 yd. Offense-favored as you said, but not extreme in actual play.

## Not tested
- Real devices (iOS Safari, Android Chrome); only Chromium emulation.
- A real background tab or phone lock; only CPU throttling was tested.
- More than two simultaneous touches.
- Playoffs and the offseason flow.
- Sessions longer than about 25 minutes of play.
- Weather.
- Desktop diagonal key combos.
