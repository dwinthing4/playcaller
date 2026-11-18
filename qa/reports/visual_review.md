# Visual review: Playcaller (dist/playcaller_qa.html, frozen snapshot 2026-11-17 23:22)

**NEEDS WORK. Visual score 4/10.** The kits, numbers, builds and field are a real step toward the Character Lab look. But every helmet on the field is covered in black speckles, linemen stand upright before the snap with flat white slabs for pads, blockers push with locked "zombie" arms, and the portrait camera spends about a third of the phone screen on black sky and static-noise crowd. Two touch-layer bugs also stop the receiver bubbles and the pause button from working in this snapshot.

Shots: `C:\Users\dwint\football-game\qa\shots\visual\`. Folders: `phone_play`, `phone_playO` (paused 80 ms bursts, play mode), `phone_watch` (watch-mode bursts), `phone_rt` (real-time CDP screencast at about 60 fps, 1533 frames), `desk_ui`, `land_ui` (844x390 landscape). Contact sheets (`sheet_*.png`), crops (`crop_*.png`), diagnostics (`diag_*.png`) and Lab references (`lab_*.png`) sit at the top level. Capture scripts are `qa/visual_*.mjs`.

Captured: phone 390x844 @3x with touch, desktop 1280x800, landscape 844x390 @3x. Covered title, home, roster, depth, playbook, uniforms, standings, loading/intro card, offense and defense call sheets (all filters), PAT sheet, pre-snap O and D, live runs, passes, catches, tackles, a pile-up, a TD and celebration, banners, receiver bubbles, runner buttons, kick meter, FG result, pause, sim card and final box score.
Not captured: a kick or punt *return* (there is nothing to see; see M6), overtime, weather, and a real high-DPI phone GPU. Everything was rendered with ANGLE/D3D11 on this PC's GPU.

---

## Critical

**C1. Black speckles on every helmet, the most visible flaw in the game.**
- Where: `phone_watch/212_banner.png` and its crops `crop_td_fg_helmet.png` and `crop_td_players.png`. Also `crop_f03_back.png`, and every frame where a helmet is closer than about 8 m.
- Cause, confirmed with the game's own SDF code (`qa/visual_helmdiag.mjs`): `diag_helmet_backtop.png` and `diag_helmet_side.png` mesh the sleek shell at the phone res 0.0095 (left), the desktop res 0.0085 (middle) and the Lab res 0.0045 (right). The inner-liner slot is painted magenta. At game resolution, a grid of vertices on the *outer* surface gets tagged as inner liner (slot 4, `#202226`). That is the black dot pattern. At the Lab's resolution the shell is clean.
- The bad line is `src/render/10_models.js:241`: `isOut = dB > -0.0045 ? 1 : 0`. Coarse-grid vertices land more than 4.5 mm under the base surface even though they sit on the outer skin.
- Fix (free, no extra triangles): classify each vertex by the surface it is nearer to. Inside the `attribs` loop:
  `const dO = outer(x, y, z, dB), dI = -(dB + 0.011); const isOut = Math.abs(dO) <= Math.abs(dI) ? 1 : 0;`
  A normal test also works: a vertex is outer if `dot(normal, p - domeCenter) > 0`.
- Then bump `MODEL_V` (`src/render/20_scene.js:51`) to 4 so the old meshes cached in IndexedDB are rebuilt.
- Optional: the back rim is scalloped at coarse res (purple bumps at the bottom of `diag_helmet_backtop.png`). Smooth it with `smax(d, -(y - cutY(z)), 0.009)` instead of 0.006. Or spend the triangles saved by not meshing the liner on a helmet res of about 0.0065.
- Budget: helmets are 13.5k tris at 0.0095 and 61k at 0.0045. The scene is already 1.11M tris on desktop and 0.92M on phone (`R3D.stats()`), so fix the classification. Do not just raise the resolution.

**C2. Receiver bubbles and the Pause button can't be tapped during a play (this snapshot).**
- `elementFromPoint` on every bubble and on `.mbtn.pause` returns `div.touch.on` (`phone_rt/log.json`, entries `hit` and `bubbles`; `phone_playO/log.json`, entry `pause hit-test`).
- A real touchscreen tap on the RB bubble did not throw. The QB held the ball (`phone_rt/002_p0_O_after_tap.png`, 250 ms after the tap) and was sacked (`sheet_rt_p0.png`, frames 25-35). The same happened on play 2 (`phone_rt/009_p2_O_after_tap.png`).
- Cause: in the snapshot `#gui` comes after `#hud` in the DOM, and the full-screen `.touch` layer paints over all of `#hud`.
- `src/shell/20_match.css:8-12` already adds a single z-index order (`.touch` 1, `.bub` 4, `.mbtn` 8). It is dated 23:35, after the 23:22 snapshot. Rebuild and re-run `qa/visual_rt.mjs` to confirm the `hit` entries report `rb` and `mbtn`.

**C3. In landscape the play-call sheet doesn't fit, and the game view can be scrolled off.**
- `land_ui/07_sheet_O.png`: at 390 px tall the coordinator box plus three large Coach Pick cards fill the sheet. The filter chips, the play list and the whole action row (Timeout, Flip, Punt, Sim drive, menu) are below the screen edge.
- `#game` is `overflow:hidden`, so it can still be scrolled by code. Playwright scrolled the hidden play cards into view, and the whole game view stayed shifted up for the rest of the match. The scorebug was gone and the hidden sheet stayed visible during live play (`land_ui/09_presnap_O.png`, `10_live_bubbles.png`). Keyboard focus or a screen reader can do the same thing.
- Fix:
  - `#game{overflow:clip}` at `20_match.css:2`.
  - `.sheet:not(.show){visibility:hidden}`, so off-screen cards can't take focus.
  - Add `@media (max-height:500px)`: a two-column sheet (coordinator, chips and actions in a 38% left column; cards in a scrolling right column); `max-height:94%`; `.pc canvas{aspect-ratio:2/1}`; coordinator text clamped to 2 lines.

---

## Major

**M1. Pre-snap stances don't look like football.**
- `crop_line_presnap.png`, `phone_playO/007_p1_O_presnap.png`, `desk_ui/09_presnap_O.png`: the offensive line stands straight up with hands at mid-thigh, like a queue. The defensive line is barely bent. The QB and RB stand flat-footed.
- The Lab's lineup (`lab_desk_05_lineup_nopanel.png`) has a distinct stance per position. That is a big part of why it reads as football.
- Fix, in the pre phase, by role (`src/engine/10_body.js:320`, the `p.stance` branch; pelvis height comes from `crouch` at lines 237 and 267):
  - OL and DL: three-point stance. `crouch` 0.8, torso pitched about 35°, one hand target on the turf about 0.35 m ahead of the shoulder, the other hand on the knee.
  - LB: `crouch` 0.5 with hands on thighs.
  - WR: split stance, one foot back by 0.35 m.
  - QB in shotgun: hands at chest height, palms up.
  - Snap out of the stance over about 150 ms with ease-out, not instantly.

**M2. Blocking reads as zombie arms.**
- `crop_line_block.png`, `desk_ui/10_live_bubbles.png`, `sheet_o_p1_handoff_zoom.png`: engaged blockers hold both arms dead straight at shoulder height, about an arm's length plus 30 cm from the defender. Their hands land near the opponent's facemask or in the air.
- Cause: `10_body.js:327-329` aims the hands at the opponent's chest, but the bond keeps the bodies apart, so the arm IK hits full reach (the renderer even stretches 6% at `20_scene.js` updateSkin).
- Fix:
  - Lean the bonded pair into each other: spine pitch +20° and `crouch` 0.55 while `bond`/`bondBy` is set.
  - Clamp the hand target to 0.85 × arm length from the shoulder, so the elbows stay bent at about 140°.
  - Put the hands on the opponent's chest plate (`o.chest + o.fT*0.12`), inside at ±0.10, not ±0.14.
  - If possible, cut the bond rest distance by about 0.15 m in the engine.
  - The Lab's Block move (`sheet_lab_motion.png`, frames 2-3) is the target: elbows in, hands at the chest.

**M3. Lineman shoulder pads are flat white slabs.**
- `crop_line_presnap.png` (white #90, #95, #93, #97) and `desk_ui/09_presnap_O.png`: the `trench` pads (cap, arch and plate) are meshed at body res 0.017 (0.019 on phone, `20_scene.js:23`), against the Lab's 0.011/0.013. They merge into a rectangular board wider than the body, which looks like a tray on an away (white) kit.
- Fix, either option:
  - Mesh the BIG build only at body res 0.014. About 10 rigs per snap; budget about +40% tris for those rigs.
  - Or soften `PADS.trench` (`src/render/10_models.js:78`): arch x 0.215 → 0.19, `plate` 1.25 → 1.1, `capX` 0.02 → 0.035 to round the corners, and paint a 3 cm trim-color yoke stripe across the top of the pads so the shape reads on white kits.

**M4. The phone camera wastes the top third of the screen.**
- `phone_watch/157_p3_pass_f00.png`, `phone_playO/007_p1_O_presnap.png`, `phone_rt/001_p0_O_bubbles_live.png`: under the scorebug there is about 15% pure black sky, then about 15% crowd wall, before the field starts. The players, the only thing that matters, sit in the middle 40% of the screen.
- Cause: portrait live pitch is only about 16° (`20_scene.js:351`: back 8.4, up 5.0, ahead 6) with fov 64.
- Fix:
  - Live portrait: back 8.6, up 6.4, ahead 4 (about 24° pitch). The horizon moves to about 15% from the top, behind the stands.
  - Pre-snap, pocket and ball in the air (portrait): back 12, up 12, ahead 10 (about 28°).
  - Lead the target by `carrier.vel × 0.3 s` and look at `tgt.x × 1.0` instead of 0.95 (`20_scene.js:355`). Wide runs then stop drifting to the screen edge; the tackle in `sheet_p1_tackle_zoom.png` happens half off-screen.
  - Real-time motion is already smooth: screencast median frame interval 17 ms, no snaps (`sheet_rt_p1_run.png`, `sheet_rt_p4_D.png`). Keep the lerp rates.

**M5. The crowd is a wall of TV static, and the phone sky is a void.**
- `phone_watch/212_banner.png`, `phone_playO/004_sheet_O.png`: the 512² crowd texture (`20_scene.js:226-227`) of saturated 12 px shirts on a near-black base, repeated 15x, is the highest-contrast thing on screen. It pulls the eye away from the players.
- On phone you never see the light towers or the side stands (desktop does, in `desk_ui/09_presnap_O.png`), so above the crowd there is only `#050a14` black.
- Crowd fix:
  - Mute shirt colors toward `#3a4250` by 40%.
  - Lighten the base to `#0c0f14`.
  - Add a vertical gradient per stand: front rows lit by the field lights, back rows 50% darker.
  - Set `anisotropy` to 8.
  - Pull fog in to (60, 180) so the far stands soften.
- Sky fix: raise the top color to `#0d1a2e` with a warm `#4a5a6e` haze band at the rim (`20_scene.js:212`). Add a roof or upper-deck lip and a row of emissive light banks across the far end-zone stand, so portrait shots read as a stadium.

**M6. Special teams have no visuals.**
- The kickoff shows a banner over an empty field (`phone_playO/002_banner_kickoff.png`).
- The field goal shows the kick meter over the previous play's players frozen in place, and "NO GOOD" plays over those same leftover players (`phone_playO/123_kickmeter.png`, `125_kick_result.png`).
- Punts and touchbacks are banner-only. Next to the 3D scrimmage plays this looks unfinished.
- Minimum fix: a static FG/punt formation (line, holder, kicker), a 0.4 s kick swing, a ball arc to the uprights or downfield, and a camera behind the kicker.

**M7. The coordinator speech bubble is a narrow column covering the formation.**
- `phone_watch/157_p3_pass_f00.png`: about 190 px wide and 15 lines tall, in the middle of the field.
- Cause: `.say{left:50%; transform:translateX(-50%)}` (`20_match.css:39`) gives the box only 50% of the container width to shrink-fit into.
- A management-UI rule also collides with it: `.say{...align-items:flex-start;margin:8px 0}` in `src/ui/10_ui.css:53`.
- Fix:
  - `#hud .say{left:0;right:0;margin:0 auto;width:fit-content;max-width:min(560px,94vw);transform:none}`.
  - Clamp the text to 3 lines (`-webkit-line-clamp:3`).
  - Move it above the action buttons, or hide it once the snap happens.

**M8. Receiver bubbles stack on top of each other at the screen edge.**
- `phone_rt/001_p0_O_bubbles_live.png` and `009_p2_O_after_tap.png`: the edge-pinned Z5 and SL4 overlap almost completely, so the player can't tell which one to tap.
- Fix in `bubbles()` (`src/match/10_match.js`, around line 467): after clamping, sort the pinned bubbles per edge by y and push them apart to at least 48 px.
- Also consider anchoring on-screen bubbles to the side of the receiver's head, not straight above it. The TE bubble sits on the line of scrimmage players in `009_p2_O_after_tap.png`.

**M9. Call-sheet layout breaks at phone width.**
- `phone_playO/006_sheet_O_run.png`: after picking a filter, the chip row shrinks to half height and the labels are cut through the middle ("COACH PICKS ALL RUN").
- Cards go to 2 columns at about 190 px wide, so only 2 plays show.
- `phone_playO/004_sheet_O.png`: the ☰ button wraps onto its own second row.
- Fix:
  - `.coord,.picks,.chips,.sh-acts{flex:none}` and `.plist{flex:1;min-height:0}`.
  - `.plist{grid-template-columns:repeat(3,1fr)}` under 480 px.
  - Hide `.picks` when a filter other than Coach picks is active.
  - Put ▾, Sim drive and ☰ in a `flex-wrap:nowrap` group.

**M10. Hands are pointed spikes.**
- `crop_td_players.png` (#32's raised hand) and most block frames: at body res 0.017/0.019 the glove becomes a tapered cone. The Lab's gloves read as gloves.
- Fix: parent a small rounded-box glove mesh (about 0.09 × 0.05 × 0.10 m, glove palette slot) to each wrist bone. That is 2 meshes × 22 rigs, which can be instanced.

---

## Polish

- **P1. The TD celebration is thin.** Only the scorer raises a pumping arm (`sheet_w_p3_td_end.png`); everyone else freezes. Ideas:
  - Have the scorer raise or spike the ball.
  - Make the 2 nearest teammates run in and jump.
  - Push the camera in 15% over 1.2 s with ease-out.
  - Fire 120 confetti particles in the team colors.
  - Use the existing `.ban b.td` style (larger font), and set the subtitle to the scorer's name, not just the team.
  - Celebration code: `10_body.js:332`.
- **P2. Contact particles look like dead pixels.** They render as black 1-2 px squares (`sheet_w_p9_pile_zoom.png`, the dots around the pile). Particle color is 2/3 near-black `0.05` at size 0.035 (`20_scene.js:244-246`). Use dirt `#4d3d29` and turf `#3a7330`, size 0.06 with a soft round alpha sprite, and fade out over the 1.2 s life.
- **P3. Cleats of downed players read as black paddles** pointing up (`sheet_w_p9_pile_zoom.png`, frames 5-11). Make the sole a dark grey `#2a2b30` instead of `#151517` (cleat slot 7), or add a white sole edge.
- **P4. Action buttons show the field through them.** At 72% alpha the hash marks show as grey blurs inside THROW AWAY (`crop_throwaway_btn.png`). Use `.acts .a{background:rgba(10,18,28,.9)}` or add `backdrop-filter:blur(6px)`.
- **P5. The phone scorebug hides team abbreviations** at 420 px and under, so team identity rests on 28 px logos. Keep the 3-letter abbreviation at 16 px and shrink the logo to 22 px.
- **P6. The final card doesn't call out the winner.** Both scores are muted grey (`phone_playO/394_final.png`). Make the winner's score `#fff` and the loser's 45% opacity.
- **P7. The desktop control hint is hard to read.** "Space snap · WASD…" is 12 px at 55% white (`desk_ui/09_presnap_O.png`). Use 13 px at 75%.
- **P8. Light end zones wash out the wordmark.** White letters on the lime end zone are low contrast (`phone_watch/212_banner.png`). Add a 6 px dark outline to the end-zone wordmark (`20_scene.js` fieldTexture `ez()`, currently `rgba(0,0,0,.35)`).

---

## Character Lab vs in-game

| Area | Lab (`lab_desk_*.png`) | In game | Verdict |
|---|---|---|---|
| Helmet shell | Clean gloss, sharp stripe, visor, mask on the face (`lab_desk_11_helmet_closeup.png`) | Speckled (C1). The mask sits correctly and the logo is placed well. | Broken until C1 is fixed |
| Proportions and builds | 5 tuned presets | 3 builds scaled per player. Linemen are clearly bigger and skill players leaner. | Good |
| Pads | Rounded caps | Skill/back pads fine; trench pads are slabs (M3) | Needs work |
| Kit color and numbers | Crisp numbers, name bar, stripes | Same quality: front and back numbers, name bar (MOORE, #32), pant stripes, socks and cleats all recolor cleanly (`crop_td_players.png`, `crop_line_presnap.png`) | Matches |
| Skin tones | 6 swatches | 12 tones, varied across rosters | Good |
| Hands and gloves | Glove shapes | Spikes (M10) | Below the Lab |
| Stances and motion | A stance per position; bent-arm Block move | Upright pre-snap (M1), straight-arm blocks (M2) | Below the Lab |
| Lighting | Brighter key and rim lights; exposure 1.05 | Night lights; exposure 1.12 | Fine; the helmets lose their gloss mostly because of C1 |

## Motion checks
- I saw no skinning tears and no visibly stretched limbs in any burst. Bone lengths hold.
- Feet look planted. I saw no sliding or sinking into the turf, but I did not measure it numerically.
- Ball handling is right: the ball sits in the hands on the handoff (`sheet_o_p1_handoff_zoom.png`), at the carrier's chest on runs (`sheet_run_gait_zoom.png`), and on top of the pile (`sheet_w_p9_pile_zoom.png`).
- Falls carry forward momentum, and the pile settles believably. Bodies overlap inside the pile, which is acceptable at this camera distance.
- The 80 ms bursts are paused captures that step physics while the game's own loop renders. Camera jumps in those sheets come from that method. The real-time screencast (`phone_rt`) is the true motion and is smooth.

## Already good (keep it)
- Team kits and palettes: jersey, trim, pants, stripes, socks, numbers with outline, and helmet logos. Teams are always easy to tell apart (orange/teal, sky/lime, red/gold).
- Jersey number and name-bar texturing (Graduate numerals) is sharp at 3x.
- The field: yard lines, field numbers that read from each sideline, hash marks, the blue line of scrimmage, the yellow first-down line, end-zone wordmarks, and a midfield logo that faces the play camera (`sheet_logo_orient.png`).
- Soft contact shadows that ground the players.
- Smooth camera follow in real time.
- Pre-snap route, run-lane and blocking ribbons are clear and color-coded (`phone_playO/007_p1_O_presnap.png`).
- Desktop framing with the side stands and light towers (`desk_ui/09_presnap_O.png`, `10_live_bubbles.png`).
- Management screens keep Playcaller's navy, gold and Barlow Condensed style and are clear at 390 px (`sheet_mgmt_phone.png`, `sheet_desk_mgmt.png`).
- The intro card, pause menu, kick meter (`phone_playO/123_kickmeter.png`) and final box score (it fits without scrolling on phone) are clean.
- Banners (KICKOFF, TOUCHDOWN, SACK, -5 YDS, NO GOOD) are bold and readable.
- The runner move buttons (JUKE, SPIN, STIFF ARM, TRUCK) are large and easy to hit.
- No console errors in any run.
