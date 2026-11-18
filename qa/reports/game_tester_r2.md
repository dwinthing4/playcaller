# Game tester report, round 2: dist/playcaller_qa2.html (frozen snapshot, built 2026-11-18 00:31)

**FAIL**: 0 blockers, 5 major, 9 minor, plus 2 observations.

Of the 23 round 1 items, 20 are fixed and 3 are partly fixed (M8, minor m1, minor m11). The fix for B1 caused a new top-priority bug: on a phone you can no longer move or scramble the QB (N1).

I tested the frozen snapshot `C:\Users\dwint\football-game\dist\playcaller_qa2.html`, which is byte-identical to `dist/playcaller.html`. I ran it in real-GPU Chromium (d3d11) on a phone (390x844, touch, DPR 2), a rotated phone (844x390) and a desktop (1280x800). Input was real: `page.touchscreen.tap`, the mouse, the keyboard, and CDP touch drags. Headless checks run the core, league and engine code extracted from this same file (`qa/tester/r2/snapcode2.mjs`). Line numbers below are **dist/playcaller_qa2.html** lines.

- Scripts: `C:\Users\dwint\football-game\qa\tester\r2\`. The main one is `fix.mjs <scenario> [desk|phone] [seed]`; output files are `out_*.txt` / `log_*.txt` in the same folder.
- The round 1 harness `qa/tester/lib.mjs` now also accepts `opts.file`, or the env vars `PC_HTML` and `PC_SHOTS`. The defaults are unchanged, so the round 1 scripts still load `playcaller_qa.html`.
- Screenshots: `C:\Users\dwint\football-game\qa\shots\tester_r2\`.

---

## Fix verification (round 1 items)

| Item | Status | Evidence |
|---|---|---|
| B1 bubbles / pause under the stick layer | **FIXED** (but see N1) | All 4 bubbles hit-test as `rb on`. A real tap on X1 threw. In the full phone game, 7 of 7 bubble taps threw. Pause by real tap works pre-snap and live: `paused true`, liveT frozen 0.58 → 0.58 for 1 s, Resume continues. `probe1.mjs`, `fix.mjs pauselive`, `fullgame2.mjs` |
| B2 global `.say` | **FIXED** | Every `.say` is static with opacity 1. Nothing blocks a button on home or Game Plan (phone and desktop). A centre tap or click on PLAY opens the game on both. A real tap on INSTANT played the week (week 1 → 2). The briefing text is visible (`r2season_05_home.png`, `r2season_08_view_plan.png`). |
| M1 scramble tackled past the LOS = sack | **FIXED** | Desktop, real keys: a scramble tackled at +15 showed "+15 YDS FIRST DOWN" and the play-by-play line "I. Banks scrambles for 15 yds", gave the QB +1 rush attempt and +15 rush yards, and credited no sack. Headless, 200 user scrambles: **0** sacks with positive yards (round 1: 68 of 150). All 70 sacks were behind the LOS. |
| M2 throw-away TypeError | **FIXED** | 28 throw-aways (4 in `fix.mjs away`, 24 in `crash.mjs`): "Thrown away", 0 page errors, 0 teleports, top speed 9.5-10.2 m/s. |
| M3 watch at your own snap | **FIXED** | It snapped 0.93 s after "watch" (2 of 2). `play.userSide` became null, the AI QB threw, and the following plays ran by themselves. |
| m4 (r1) watch mid-play as QB | **FIXED** | The AI QB threw in 4 of 4 (1 incomplete, 3 completions including one of 43 yd). |
| M4 pause during the FG meter | **FIXED** | Esc during the meter: not paused, and the meter and KICK button stay. The pause button is under the overlay. KICK gave "42-yard field goal GOOD". Pausing *during the kick flight* freezes it (anim t 0.30 → 0.30 over 1 s) and Resume finishes it. |
| M5 FG / punt / kneel on an expiring clock | **FIXED** | Q2 0:03 with a 20 s runoff, FG: no meter, "CLOCK RUNS OUT", HALFTIME, score unchanged. Q3 punt: CLOCK RUNS OUT, END OF Q3, possession unchanged. Q4 kneel: CLOCK RUNS OUT, FINAL. CPU 4th down: CLOCK RUNS OUT, halftime, no punt. |
| M6 two-point try runs the clock | **FIXED** | Q2, clock 0:40 at the try. A 3.47 s two-point play left the clock at 0:40. |
| M7 run moves without the stick | **FIXED** | Real taps with no stick, over 3 seeds: jukeT 0.17-0.20, spinT 0.45-0.46, stiffT 0.39-0.41, truckT 0.65-0.66 within 50 ms. 12 of 12 fired, and the flags cleared. In the full game, 2 of 2 fired within 60 ms. |
| M8 landscape call sheet | **PARTIAL** | The action row (Flip, Punt, ▾, Sim drive, ☰) sits at y 340-382 of 390, and every button is tappable. The play list scrolls with a swipe (scrollTop 195), and a card tap calls the play. The hidden sheet is `visibility:hidden` during the play. **But the filter chips are squashed to 12 px tall** (see minor N6). |
| M9 defensive camera | **FIXED** | On defense, over 18 calls and 2,274 live frames: your defender on screen **87%** (r1: 32%), ball or landing spot 88% (71%), receivers 20% (13%). On offense: your player 99%, ball 96%, receivers 37%. `visibility.mjs` |
| M10 fallen receivers | **FIXED** | Staged with `PHYS._.startFall` on the most-open receiver mid-play, 5 of 5: his bubble turned red (`rb on r`, openness -9) within 0.25 s. Headless CPU QB: 4 of 276 throws (1.4%) went to a receiver who was down at release; he fell during the windup. |
| m1 defensive audible re-calls the offense | **PARTIAL** | The CPU's play is kept (5 of 5), but **the formation mirrors** after the audible in 2 of 5 (see minor N7). |
| m2 timeout double tap / offered when stopped | **FIXED** | Timeout is offered only with runoff > 0, on both the O and D sheets. A double tap uses exactly 1 timeout (3 → 2), but the second tap toggles Flip (see minor N8). |
| m3 double tap on the sheet | **FIXED** | A double tap starts exactly one play, spike, kneel, punt, FG meter and kick, sim drive (no ghost plays after the drive) or two-point try. |
| m5 watch speed | **FIXED** | 25 real seconds at 4×: 69.2 game-s and 14 plays, against 23.3 game-s and 3 plays at 1×. Kick flights scale too (XP 0.37 s at 4×). |
| m6 edge bubbles overlap | **FIXED** | SL3 and Z4, both pinned at x = 360, are now 48 px apart (r1: 16 px). |
| m7 time at the line on D / Switch order | **FIXED** | Snap comes 2.90-3.00 s after the pre-snap starts. Switch cycles outward from your current man (LB1 → LB2 → LB3 → LB4 → S1). |
| m8 slow motion under CPU load | **FIXED** | Game seconds per real second: 8× throttle 1.00 at 19 fps (r1: 0.69-0.80); 14× 0.87 at 18 fps (r1: 0.31-0.48). |
| m9 fumble touchback | **FIXED (code only)** | dist:4306 `if (nyl <= 0.5) nyl = 20` is now correct. Not triggered in play. |
| m10 kneel skips the two-minute warning | **FIXED** | Kneel at Q4 0:18 with a 3 s runoff: the clock stops at 0:15 and TWO-MINUTE WARNING shows. |
| m11 sim drive past halftime | **PARTIAL** | It stops at halftime and you get your Q3 sheet. But it also stops at the end of Q1 and Q3 while the same drive goes on (see minor N9). |
| m13 (obs.) Instant uses the ratings sim | unchanged | The home Instant button still runs `instantUserGame()` → `simGame`. |

---

## MAJOR

### N1. On a phone the QB cannot move or scramble: the bubble layer swallows every touch while he holds the ball (regression from the B1 fix)
- **What happens:** In the QB phase, `bubbles()` adds `on` to the `.bub` container (dist:4539 `el.bub.classList.toggle('on', k === 'qb')`). `.bub` is `position:absolute; inset:0` (dist:102), and dist:63 `#hud .on{pointer-events:auto}` makes the whole full-screen layer catch touches. It now sits at z-index 4, above the stick layer `.touch` at z-index 1 (dist:67-68). Every touch that misses a bubble lands on `.bub`, `onBubble` finds no `[data-r]` and returns, and the stick never starts. **You cannot step up, slide, escape pressure or scramble on a touch device.** The hint still says "move to scramble". Desktop keys still work.
- **Expected:** the stick works anywhere a bubble isn't (as it did in round 1, where I scrambled 3 times with the stick).
- **Repro (phone):** call any pass, SNAP, wait for the bubbles, then drag a finger on open grass on the left half of the screen.
- **Evidence:** Real CDP touch-drags during the QB phase, at (110,600) and at (117,523): **7 of 7 failed** (`qbtouch.mjs` 2, `stickseq.mjs` 5). The pointerdown target was `bub on touch`, `input [0,0]`, the stick was not shown, and the QB stayed 6.7 yd deep until sacked. Hit-tests at 7 open-field points in 4 more plays (`fix.mjs pauselive`) also all returned `bub on`. With zero input the QB never drifts forward: in 11 of 11 plays he stayed 6.7 yd deep (`noinput*.mjs`). (In the full phone game 2 "scramble" plans did end as scrambles through a path I could not isolate. Every deliberate fresh touch failed.)
- **Fix:** don't make the container interactive. Drop the `on` toggle on `.bub` (the `.rb` bubbles already carry `on`, and their pointerdown still bubbles to the `.bub` listener), or add `#hud .bub{pointer-events:none}` and `#hud .bub .rb.on{pointer-events:auto}`.

### N2. Quitting during a kick flight freezes the next game's camera on the goal posts
- **What happens:** `kickFrame()` sets `R3D.camOverride` every frame (dist:4363) and clears it only when the flight ends (dist:4364). `quit()` / `close()` / `teardown()` (dist:4100-4105) never clear it. The next game is rendered from the old kick camera: the goal posts and empty grass, no players, the ball off screen. It stays that way until some later kick animation finishes.
- **Repro:** 4th down in range → FG → KICK → while the ball is in the air press Esc (or tap II) → Quit game → start any game → kick off.
- **Evidence:** after the quit `R3D.camOverride = {pos:[0,3.4,49.6], look:[1.56,3.5,100.6], fov:46}`. In the next game at pre-snap it is the same object, with `ballOnScreen:false`. Shot: `r2_quitkick_desk_01_next_game_presnap.png`. `fix.mjs quitkick`
- **Fix:** in `teardown()`, set `R3D.camOverride = null` (and `G.kickAnim = null`).

### N3. Field textures leak: about 3 full-size field canvases per new opponent, never freed
- **What happens:** `fieldTexture()` caches one 1024x2304 canvas plus a CanvasTexture per offense/defense/home/view key (dist:3829-3846), and nothing ever disposes them. The defensive camera added a second view, so a normal game creates 3 keys (your offense, your defense, the CPU's kicks). Across a season every new opponent adds about 3 more.
- **Evidence:** `texleak.mjs` played a few snaps (offense, defense and a kick) against 6 opponents, quitting each game, then forced GC. Result: 3, 6, 9, 12, 14, 17 field canvases created, **all 17 still alive**. That is about 160 MB of canvas pixels plus the GPU copies with mipmaps (about 12.6 MB each). A full season extrapolates to roughly 50 textures, about 1 GB combined. That is likely to kill a phone tab mid-season. (Within one game it is bounded, so the round 1 "restart 4×" check against one opponent couldn't show it.)
- **Fix:** keep only the current game's textures. On `open()`, `dispose()` and delete the `cache.fieldTex` entries that don't belong to the two teams playing (or keep an LRU of about 4).

### N4. Your coordinators almost never call a run in watch/sim (and the coach picks lean the same way)
- **What happens:** In watch and sim, the user team's offense is called from `coordCall()`'s top 3 (60/25/15, dist:4212). `scorePlay()` (dist:1706-1739) gives many name-matched bonuses to passes (`quick` = Slant/Stick/Mesh/…, Blitz Heavy, Man Press, Cover 3, `P.rush > 75`, `P.cover < 68`) and very few to runs. 2nd/3rd & long add +2 for a pass and -1.5 for a run (dist:1710).
- **Evidence:** in a full watched game (4×, `fix.mjs speed`, FULL=1), **all 27** of the user team's offensive calls were passes. That was 13 on 1st down with 4 different plays, which shows the top-3 mix itself works. Over all 32 teams (`coordmix.mjs`): on 1st & 10 the OC's pick 1 is a run for 13% of teams, and a run is anywhere in the top 3 for 28%. On 2nd & 8 it is **0%**. The CPU caller (`cpuCall`) runs 41-48% in the same spots. The OC's own briefing for that game said "they are softer against the run … so we lean on the ground game" (`r2season_05_home.png`, `r2season_08_view_plan.png`).
- **Expected:** a run/pass mix near the team's style (OFF_STYLES pass share), like `cpuCall`, and consistent with what the coordinator says.
- **Fix:** make run bonuses symmetric with the pass name bonuses, or blend the top 3 with the team's run share (for example, guarantee one run in the top 3 on early downs outside two-minute and long-yardage situations).

### N5. Inside runs and draws are nearly useless; outside runs carry the run game
- **Evidence** (headless, AI vs AI, 250 runs per scheme, `runs3.mjs`; yd/carry = yards per carry, TFL = tackled for a loss):

| Scheme | Yd/carry | TFL | First contact (yd vs LOS) | Contact behind the LOS | Notes |
|---|---|---|---|---|---|
| outside | **5.87** | 7% | +3.3 | 36% | |
| power | 3.45 | 24% | +2.0 | 36% | |
| zone | 3.34 | 11% | +1.3 | 50% | |
| counter | 3.03 | 14% | +1.0 | 51% | |
| draw | **2.29** | **50%** | -0.4 | 70% | 78 of 120 first contacts by DL |
| dive | **1.54** | **47%** | -0.1 | 66% | 187 of 249 by DL; handoff only at 1.10 s and 2.9 yd deep |

- **Effect:** "draws now fool the rush" isn't true in the engine: the rushers meet the back behind the line on 70% of draws. Dives (HB Dive, FB Dive, Iso, Duo, Wham, Iso Weak) lose yards almost half the time, so between the tackles is a bad call.
- **Where to look:** `rbPreAI` / handoff timing for dives (`op.delay` and the mesh point, around dist:2622), and how DL rushers react to the back on `draw`.

---

## MINOR

- **N6. (M8 remainder) Landscape filter chips are squashed to 12 px.** At 844x390, sheet grid row 1 (`.sh-top`) stretches to the height of the coach-pick cards in column 2 (y 73-223). That squeezes `.chips` (row 3) to 12 px. The labels "COACH PICKS / ALL / RUN / PASS …" are cut in half, and the chips past the 5th are scrolled out of the column. They are tappable, but they are 12 px targets. Shot: `sheet_02_landscape_sheet.png`. Where: dist:129-133 (`@media (max-height:500px)`). Fix: `align-content:start` / give `.chips` a min-height, or let `.picks` span rows 1-2.
- **N7. (m1 remainder) A defensive audible mirrors the offense's formation half the time.** The audible keeps `G.cur.op`, but `onSheetClick` restarts it with a new random flip: `startPlay(op, p, R() < 0.5)` (dist:4618). Evidence: "Stick, flip true → false; X from x -17.8 to +17.8", and the same with Y-Cross (2 of 5). Fix: keep `G.play.op.flip` along with the op.
- **N8. A double tap on Timeout toggles Flip.** The first tap calls the timeout, which zeroes the runoff, and `renderSheet()` removes the Timeout button. Flip slides into its place and takes the second tap (`flip false → true`). Where: dist:4607. Fix: a short tap guard after any re-render (or keep the button in place, disabled).
- **N9. (m11 remainder) Sim drive stops at the end of Q1 and Q3 even though the drive continues.** `endQuarter()` clears `G.sim === 'drive'` for every quarter (dist:4182). Evidence: a sim drive started at Q1 0:06 stopped at Q2 1:00 on your O sheet, same possession, mid-drive (2 of 2). Fix: clear it only at halftime and the end of the game.
- **N10. Long pre-snap motion makes SNAP feel dead.** After you tap SNAP, Orbit Flat takes **4.74 s** before the ball is actually snapped, and Motion Y-Cross 2.37 s. Both buttons stay up and nothing shows that the tap registered (`motion2.mjs`; all 2 motion plays × 2 flips × 3 ball spots always go live, so this is not a softlock). Suggest: start the motion when the play is called and snap on the tap, or speed up 'across' motion.
- **N11. The fumble play-by-play names the recoverer as the fumbler.** "FUMBLE by J. Grant, recovered by J. Grant". `describe()` uses `res.carrier`, which `endPlay` sets to the recovering defender (dist:4325, dist:3086). The fumbler is also credited with a rush to the *recovery* spot (QB: +1 rush, +1 yd on a pocket strip; `creditYards(this.fumbler, …)`, dist:3305). Fix: store `fumbler.pid` in the result and use it in `describe()`.
- **N12. Bubbles sometimes jump, and a near-miss tap does nothing.** On screen, bubbles move at a median 60 px/s (90th percentile 142), but over 8 pass plays they jumped more than half a bubble (21 px) in a single frame 22 times, peaking at 2,812 px/s (`bubspeed.mjs`). That happens when the push-apart pass swaps crossing receivers, or when a bubble flips to an edge pin. A tap that just misses lands on the full-screen `.bub` layer and is ignored (see N1). Evidence: `qbtouch.mjs` rep 1, a tap on a moving edge bubble registered on `bub on`.
- **N13. "Nobody there" is still 7-14% of throws, now mostly with upright receivers.** Headless, throwing to the most-open receiver at 2.0 s: 25 of 375 (6.7%); 20 of those had the target upright, 1.1-5.2 m from the ball. CPU QB: 50 of 370 (**13.5%**); 37 upright, 15 of them more than 3 m away, 5 targets down at release. Most are flats, drags and go routes (`nobody2.mjs`). These read as overthrows, so the label "Nobody there" is misleading. Consider "Overthrown" / "Off target", and look at why the CPU's rate is double the user's.
- **N14. Late throws to "wide-open" flat receivers end "Caught out of bounds".** Desktop, throwing to the most-open receiver at 2.4 s on quick/flat plays: 2 of 10 throws to green bubbles (openness 9.6 and 9.9) were caught out of bounds. Headless, user@2.4: 10 of 250 attempts. Openness doesn't account for the sideline (dist:2619-2620).

### Observations
- **O1. The AI ball carrier gains less than a carrier who just runs straight.** Headless, user offense, no stick: the AI runner averaged 3.11 yd per carry (5% gained 10+). After one Juke tap the runner is user-driven, and with a neutral stick he "keeps running downfield"; he averaged 4.39 (8% gained 10+), N = 300 each (`headless2.mjs` F). This suggests `runnerAI` gives up yards (cutting into traffic). Since M7, tapping a move also switches the back from AI running to straight-line running for the rest of the play.
- **O2. Kick units are static.** FG and XP use a goal-line offense and punts a shotgun pass formation, with everyone standing still. The ball starts 7 yd (FG) or 13 yd (punt) behind the LOS, where no kicker, holder or punter stands (dist:4344-4352). See `r2_kicks_phone_00_fg_flight.png` and `04_punt_flight.png`. This is for the visual reviewer; it works mechanically.

---

## New features tested
- **3D kicks:** they work on phone and desktop. Measured: FG 1.74-1.77 s, XP 1.53-1.55 s, punt 2.98-2.99 s. The ball was on screen in 100% of flight frames, with the camera behind the kick. The result banner appears as the flight ends and never during it. Kicks scale at 4× watch speed, pause freezes them, and sim/instant skip them. CPU XPs animate too. Bugs: N2, and O2 (looks).
- **Bubble openness scale:** the colours mean something. Headless, when the user throws to a bubble of each colour: green 695 throws, **70%** completed, 7.6 yd/att; yellow 88, **43%**, 6.4; red 27, **11%**, 2.0, and 5 INTs (19%).
- **Edge bubbles spread:** 48 px apart when both are pinned.
- **Coordinator top-3 mix:** works (4-6 different plays per down in one game), but see N4.
- **Engine retune** (headless, `headless2.mjs`):
  - CPU QB: 59% completions, 9.6 yd/att, 6.0% sacks, 1.1% INT.
  - User throwing to the most-open receiver: at 1.2 s 58% and 5.9 yd/att; at 1.8 s 70% and 6.9; at 2.4 s 67% and 9.3, with 10% sacks. Less offense-favoured than round 1 (62-71%, 9.8-11.7).
  - User defender steering + TACKLE: 2.43 yd/carry against 3.88 for pure AI. His man wrapped the carrier on 127 of 272 plays where TACKLE was pressed. Broken tackles 0.11 per run.
- **Helmets, pads, stances, stadium:** no errors in any run. The look is for the visual reviewer.

## Regression pass (all run on qa2)
- **Full phone game with real taps** (`fullgame2.mjs`, 60 s quarters, seed 11). 42 plays. The in-page rule checker found **0** down/distance/spot/clock issues over 36 scored plays. 0 page errors, 0 teleports, 0 monitor anomalies. 7 of 7 bubble taps threw, and 5 kick animations ran.
  - Covered: timeouts 3 → 2 → 1, spike, kneel, FG through the meter, punt, XP, offensive audible, defensive audible, Flip, and pause from the sheet.
  - Final card 10-3 VICTORY. Continue applied the result (week 1 done, 1-0-0), then the press conference showed. **Next week opened from a real tap on the home PLAY button** and reached the call sheet.
- **Season flow** (`season2.mjs`, phone): no page errors anywhere.
  - Sim to end took 3.7 s. Final card, then Continue applied the result (1-0, standings balanced 16-16, QB stats added) and the press conference showed.
  - Watch: the speed button cycles 1×/2×/4×, pause works, and Take over leads to your O sheet. Quitting the watch game did not count it.
  - **Instant via a real tap** played the week (1-1). All 26 management views render, and the week 3 game opens.
- **A whole watched game at 4×:** played to the end, and Continue applied it (0-1).
- **Sim drive:** it stops on a change of possession and at halftime, and a double tap doesn't double it.
- **Landscape:** the action row, list scroll and card taps work, and the hidden sheet doesn't catch taps (chips: N6).
- **Desktop:** a click on home PLAY opens the game, Esc pause works, number keys throw, and mouse clicks on bubbles throw (`pausebub.mjs`: `throwTo` returned true in 6 of 6, with and without pause/resume).
- **Long idle:** I sat at the line for 4 minutes on the phone. JS heap stayed flat at 45 MB, with 49 rigs and 116 draw calls constant.

## Not bugs (checked so you don't chase them)
- **"Target crashed" in my early `fix.mjs away` runs was the harness.** A swallowed SNAP tap left my wait loop without a deadline, and the shell `timeout` (590 s) then killed Chrome. The game itself survived 24 throw-aways in 5 minutes (heap flat at 29 MB) and 4 minutes idle at the line.
- **SNAP taps right after calling a play:** they registered at every delay from 60 to 500 ms (10 of 10). The sliding sheet only eats taps within the first few tens of milliseconds of its slide, which no human can hit.

## Could not reproduce / not tested
- Once, in a `moves` run alongside another browser test, the game sat at pre-snap for about 6 minutes and 533 SNAP taps did nothing. It did not recur in 3 later runs with a diagnostic dump in place. Every motion play in the league book goes live after SNAP (`motion2.mjs`). Cause unknown; worth keeping an eye on.
- I could not isolate how 2 "scramble" plans in the full phone game produced real scrambles despite N1.
- Not tested: real devices (iOS Safari, Android Chrome); a real background tab or phone lock; more than two simultaneous touches; playoffs and the offseason; a full season of played games (N3 is extrapolated from 6); weather.
