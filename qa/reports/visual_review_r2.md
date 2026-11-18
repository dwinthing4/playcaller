# Visual review round 2: Playcaller (dist/playcaller_qa2.html, frozen 2026-11-18 00:31)

**NEEDS WORK. Visual score 6/10 (up from 4).** The round-1 problems that showed most are fixed: the helmet speckles are gone, every tap works, and up close the players now look like football players (stances, blocks, rounded pads, mitts). But on the phone's pre-snap and pocket camera the players are small. The new special-teams plays are frozen placeholders. On defense the camera loses the player you control. The stadium still looks flat.

All shots are in `C:\Users\dwint\football-game\qa\shots\visual_r2\`:

| Folder | What it holds | Script (`C:\Users\dwint\football-game\qa\`) |
|---|---|---|
| `close_desk`, `close_phone` | R3D.camOverride close-ups: stances, helmets, hands, pads, an 18-frame snap burst at 33 ms, blocks at 0.9 s and 1.4 s | `visual2_close.mjs` |
| `rt_phone`, `rt_desk` | Real-time CDP screencasts in play mode (390x844 frames on phone): 3 offense plays, a punt, 5 defense plays, real touch taps | `visual2_rt.mjs` |
| `ui_phone`, `ui_land`, `ui_desk` | Management screens, game plan, call sheet per filter with layout metrics, pre-snap, live bubbles, pause, final | `visual2_ui.mjs` |
| `kick_phone`, `kick_desk` | Forced field goal (good and short), punt and extra point, each as a screencast plus timed shots | `visual2_kick.mjs` |
| `watch_phone` | 7 watch plays as paused 80 ms bursts, including a goal-line touchdown | `visual2_watch.mjs` |
| `stance_play` | Play-mode linemen stance probe | `visual2_stanceprobe.mjs` |

Contact sheets (`sheet_*.png`) and crops (`crop_*.png`) sit at the top level. Shared helpers are in `qa/visual2_lib.mjs`.

- **Captured:** phone 390x844 @3x with touch, landscape 844x390 @3x with touch, desktop 1280x800. No console errors in any run.
- **Not captured:** a kickoff or punt return (there isn't one), overtime, weather, 1920x1080, and a real phone GPU (everything ran on ANGLE/D3D11 on this PC).
- **Motion timing:** median screencast frame interval was 18 ms on phone and desktop. The p95 was 18 ms on phone and 36 ms on desktop, which is screencast overhead. The single 0.5-0.7 s gaps per play are my own screenshot calls. The real-time motion is smooth.

---

## Round-1 items: verification

| ID | Item | Status | Evidence |
|---|---|---|---|
| C1 | Helmet speckles | **FIXED** | No speckles at any distance on desktop or phone resolution: `sheet_close_desk_helm.png`, `sheet_close_phone_helm.png`, and helmets at game distance in `crop_phone_run_contact.png` and `sheet_w_td_full.png`. New, smaller artifacts on the stripe at phone resolution are listed as M6 below. |
| C2 | Taps blocked by the touch layer | **FIXED** | `rt_phone/log.json`: every `.rb` bubble and the pause button hit-test as `SELF`. Real taps threw the ball (`thrownAfterTap:true` on p1 and p3, and in landscape `ui_land/log.json`). The pause tap opened the menu (`rt_phone/029_pause.png`). |
| C3 | Landscape sheet | **PARTIAL** | Two columns now, every action button on screen, and `#game.scrollTop` stays 0 after `focus()`/`scrollIntoView` (`ui_land/log.json`). But with the default Coach picks filter the chip row is crushed to 12 px (`ui_land/013_sheet_O_coach.png`, chips `y 325 / h 12`). See M8. |
| M1 | Stances | **FIXED** (polish left) | Three-point OL/DL, two-point skill players, QB hands ready, crouched LB/DB (`sheet_close_desk_stances.png`, `close_desk/005_p0_stance_OT_34.png`). Coming out of the stance takes 0.167 s with no pop (`sheet_close_desk_snap.png`). From the game camera behind the offense, the OL still read as squatting (`sheet_stance_play.png`). See P1. |
| M2 | Zombie-arm blocks | **FIXED** (polish left) | Pairs lean in, elbows bent, hands on the chest plate (`sheet_close_desk_blocks.png` frames 1, 7; `crop_phone_run_contact.png`). Helmets sink into the opponent's shoulder pads (frames 3, 10). See P2. |
| M3 | Slab trench pads | **PARTIAL** | The slab is gone and the pads read well from behind (`sheet_close_desk_hands_pads.png` frames 4, 7). From the front the caps balloon to about 2.5x the helmet width (frames 3, 6, 8). See M7. |
| M4 | Portrait camera | **PARTIAL** | The live run camera is much better: about 22% of the height is non-field and the runner stays centered (`rt_phone/006_p2_O_runner_buttons.png`, `sheet_rt_p2_run.png`). But the 12/12/10 pre-snap and pocket camera shrinks the formation to a 22% band with players about 46 CSS px tall, and throws to the sideline lose the catch. See M1. |
| M5 | Crowd and sky | **PARTIAL** | The crowd is muted and the per-stand falloff works (`crop_desk_endstand.png`). The sky gradient is fine. But the light banks render dull grey and the roof lip is a black slab, so on phone it reads as a dashed grey line on a black bar (`crop_phone_stadium_top.png`). Up close the crowd is still a blocky mosaic (`sheet_w_td_full.png`). See M5. |
| M6 | Special teams | **PARTIAL** | FG, XP and punt now play in 3D, but nobody moves, the formations are wrong, the ball is a 2-6 px dot, the punt camera stares at the sky, and the result cuts back to the frozen unit. Kickoff is still banner-only (`ui_phone/012_banner_kickoff.png`). See M2. |
| M7 | Coordinator bubble | **FIXED** | Wide, centered, 3-4 lines with an ellipsis, over the empty turf below the play (`watch_phone/137_p3_presnap.png`). Hidden at the snap (`csayLive:"0"` on every play) and fades out at kicks (`sheet_kick_phone_fg.png` frame 0). |
| M8 | Edge bubbles stacking | **FIXED** | Worst bubble overlap was 0.00 over 40 samples on phone and desktop (`rt_*/log.json`, `ovMax`). Pinned bubbles are spread apart (`rt_phone/002_p1_O_bubbles_live.png`). |
| M9 | Phone sheet | **PARTIAL** | Chips are full height (26 px) in every state. Coach-pick cards show only under Coach picks. ▾, Sim drive and ☰ sit in a right-hand group (`sheet_ui_phone_match.png`). But the list is still **2 columns** (`cols:2`): the 3-column rule loses to a later `.plist` rule. See M9. |
| M10 | Spike hands | **FIXED** | Rounded mitt plus thumb (`sheet_close_desk_hands_pads.png` frames 0, 2; `sheet_close_phone_body.png`). They read as gloves at game distance. |
| P2 | Particles | **FIXED** | Small round dirt/turf flecks, no black squares (`crop_phone_run_contact.png`). |
| P3 | Cleat soles | **FIXED** | Dark-grey sole under a white upper (`close_desk/036_p0_hand_OT_down.png`). |
| P4 | Button opacity | **FIXED** | THROW AWAY and SNAP are solid (`rt_phone/002_p1_O_bubbles_live.png`). |
| P5 | Phone scorebug | **FIXED** | `SAN 0 · Q1 1:55 · 0 HON` with logos, all readable (`rt_phone/001_p1_O_presnap.png`). |
| P6 | Final card | **FIXED** | The loser's score is at 45% white, the winner's is `#fff` (`ui_desk/log.json`; `sheet_ui_land_b.png`). |
| P7 | Desktop hint | **PARTIAL** | 13 px at 78%, but light text on bright turf is still hard to read (`ui_desk/019_snap_350ms.png`, bottom left). See P8. |
| P8 | End-zone wordmark | **PARTIAL** | Fine on dark or saturated end zones (KRAKENS, BISON). Still faint on pastel ones at distance (EXPRESS in `crop_desk_endstand.png`, CYCLONES in `sheet_kick_phone_fg.png`). |
| P1 | TD celebration | NOT FIXED | Still only the scorer raises his arms. The banner shows the team name (`sheet_w_td_full.png`). This was polish and was not in the change list. |
| Mgmt | Coordinator text on home and Game Plan | **FIXED** | The home briefing card shows both coordinators with portraits and full text. The Game Plan "Coordinator meeting", emphasis chips, the per-situation quote and the "Your calls" cards all render on phone, desktop and landscape (`sheet_ui_phone_mgmt.png`, `sheet_ui_desk_mgmt.png`, `sheet_ui_land_b.png`). |

---

## What still hurts the look most (prioritized)

### Major

**M1. Phone pre-snap and pocket camera: players are tiny, and throws to the sideline go off screen.**
- **Small players:** in `rt_phone/001_p1_O_presnap.png`, `002_p1_O_bubbles_live.png` and `watch_phone/137_p3_presnap.png`:
  - The formation fills only y 1150-1590 of 2000, about 22% of the height.
  - Above it are 35% empty field and 23% scorebug, sky and stands. Below it is 20% empty turf.
  - Linemen are about 46 CSS px tall.
  - Cause: back 12, up 12, ahead 10 (`src/render/20_scene.js:365`) plus fov 64 **+6 in the pocket** (`20_scene.js:375`).
- **Lost catches:** in `sheet_w_p2_td.png`, rows 2-3, a goal-line throw to the corner shows an empty end zone for about 0.8 s and then swings hard to the corner.
  - Cause: `tgt.x *= 0.5` while the ball is in the air (`20_scene.js:365`).
  - In portrait the horizontal field of view is only about 32°, so a target 15-20 m wide is off screen.
- Fix:
  - Portrait pre-snap and pocket: back 10, up 8.5, ahead 7, and drop the `+6` fov in portrait (fov 60). The formation should fill about 35% of the height; the safeties at 12 yd stay in frame.
  - Ball in the air, portrait: frame the landing spot instead of halving x:
    `if (b.state==='air' && b.land) { tgt.x = lerp(b.p.x, b.land.x, 0.65); tgt.z = lerp(b.p.z, b.land.z, 0.65); }`, then `tgt.x *= portrait ? 0.9 : 0.6`.
  - Keep the 4.5 and 6 lerp rates; the real-time motion is smooth.

**M2. Special teams: there is a 3D kick now, but it looks like a freeze-frame.**
- What the frames show (`sheet_kick_phone_fg.png`, `sheet_kick_phone_fgLong_xp.png`, `sheet_rt_k4_punt.png`, `sheet_rt_k4_punt_start.png`, `sheet_kick_desk.png`):
  - No one moves at all: no snap, no holder, no kicker approach or swing, no rush, no coverage, no returner.
  - The FG and XP unit is the Goal Line I-formation (`10_match.js:319`). From behind you see three backs stacked in a column. The punt unit is a Shotgun pass set.
  - The ball is a 2-6 px brown dot against a navy sky.
  - The punt camera rises with the ball, so about 2 of the 3 seconds show sky and stands (`sheet_rt_k4_punt.png` frames 3-14). The ball then lands in an empty field.
  - When the animation ends, `camOverride` is cleared and the view jumps straight back to the frozen unit under the result banner (frames 15-16).
- Fix, in `src/match/10_match.js:317-339`:
  - **Unit:** build a real FG/XP set: 7 linemen in a three-point stance, a holder kneeling 7 yd deep (crouch 1, `yOff` down 0.35), and the kicker 2.5 yd behind and 1.5 yd to the side. For the punt, put the punter 14 yd deep and two gunners split wide.
  - **Motion:**
    - Call `pl.snap()` and keep stepping the physics, so the line comes out of its stance and engages.
    - Kicker: a 3-step approach over 0.5 s, then a 0.12 s leg swing (hip flex on the kick leg). The ball leaves at about 0.85 s.
    - On the punt, release the gunners downfield, put a returner at `end`, and play a catch.
  - **Ball:** scale `ballG` ×1.8 while a kick is in flight, and add a fading white trail of the last 12 positions (`THREE.Line`, opacity 0.6 → 0). It should never be smaller than 8 px.
  - **Camera:**
    - FG: 2.2 m high, 6 m behind the kicker, fov 40. Pan with the ball but keep the uprights in frame.
    - Punt: keep the horizon. Camera at (x, 9, z−14) looking at the landing spot, not the ball, so the coverage and returner are in shot.
  - **Exit:** fade with the existing `.fade` (0.18 s) instead of cutting back to the frozen unit. Behind the banner, either clear the rigs or show the next snap's formation.
  - **Kickoff:** reuse the punt flight (tee at the 35), so the game no longer opens on an empty-field banner.

**M3. On defense the camera loses the player you control.**
- Phone, `sheet_rt_p7_D_full.png` frame 2: the controlled defender's ring sits under the SWITCH button. In frames 3-4 the ring is not visible anywhere.
- Desktop, `rt_desk/021_p7_D_D_live.png`: your defender is cut off by the bottom edge, ring not visible. Same in `015` and `024`.
- Cause (`20_scene.js:368`):
  - The camera pulls only 40% toward the defender.
  - The portrait horizontal FOV is only about 32°.
  - A linebacker standing between the camera and the line drops below the frame.
- Fix:
  - Weight the pull 0.7 in portrait and 0.5 on desktop.
  - After placing the camera, `R3D.project(f.p.x, 1, f.p.z)`. If the point is outside the safe rectangle [0.12W..0.68W] × [0.15H..0.75H], move `camLook` toward it (about 1.5 m per frame-second). The 0.68W edge keeps him clear of the button column at bottom right.
  - On desktop also use `back *= 1.25` instead of 1.12.

**M4. Key-hint letters run into the action-button labels on touch screens.**
- `crop_rt_runner_btns.png` and `sheet_ui_land_b.png` read "JUKEJ", "SPINK", "STIFF ARML", "TRUCKI", "SWITCHE" and "TACKLESPACE".
- The keys are `<span class="key">` (`src/match/10_match.js:470-472`). `.acts .a` is a row flexbox, so `display:block` on `.key` (`20_match.css:62`) does nothing. They also show on phones that have no keyboard.
- Fix, `20_match.css:57`:
  - Add `flex-direction:column` to `.acts .a`.
  - Add `@media (hover:none),(pointer:coarse){.acts .key{display:none}}`.

**M5. The stadium top reads as a black bar with a dashed grey line.**
- `crop_phone_stadium_top.png`, `crop_desk_endstand.png`: the emissive light banks are fogged and tone-mapped to about `#8a8d92` and don't glow. The 5 m black roof lip (`#11161e`) is the darkest, most graphic shape on screen. On phone it looks like road markings across the top of every play.
- The light-tower panels read as blank white billboards (`sheet_kick_desk.png` frames 4-6).
- Fix, `20_scene.js:238-245`:
  - Banks: `new THREE.MeshBasicMaterial({color:0xfff4dc, fog:false, toneMapped:false})`, plus one additive glow sprite per bank (64 px radial gradient, 7 m wide, opacity 0.35, `depthWrite:false`).
  - Roof lip: halve its height (5 → 2.5 m) and lift the colour to `#1b2230`.
  - Tower panels: use a canvas texture with a 4×3 grid of lamp dots on `#2a2f36`, with the same glow sprite.
- Crowd (`20_scene.js:231`): up close at the end-zone corners it is still a 6-8 px block mosaic and fills about 40% of the portrait frame (`sheet_w_td_full.png`).
  - Raise the mute amount 0.45 → 0.6.
  - Darken every 4th row to `#07090c` as an aisle, to break up the grid.
  - Run `g.filter='blur(0.6px)'` once over the crowd canvas before making the texture.

**M6. Helmet stripe edges and side grooves at phone resolution.**
- `sheet_close_phone_helm.png` frames 6-8 and 12-14 (orange shells show it most; navy hides it):
  - The stripe edges zig-zag and carry small dark "stitch" marks.
  - There is a creased reflection band across the side logo.
- At game distance this shows only as a slight shimmer, but it appears in every close camera (TD, kicks).
- Cause:
  - The sleek shell's grooves (r 3.5-4 mm) and brow ridge (`src/render/10_models.js:230`) are smaller than the 9.5 mm grid, so they come out as dents.
  - The stripe edge `sstep(0.011, 0.0125, ax)` (`10_models.js:249`) blends over 1.5 mm, so each vertex is either stripe or shell.
- Fix:
  - Move `const solid = ...` (`10_models.js:241`) above line 229, and when `solid`, skip every groove and ridge with `r < 0.006`.
  - At coarse res, widen the stripe blend to one voxel: `sstep(0.0095, 0.014, ax)` and `sstep(0.014, 0.0185, ax)`.
  - Bump `MODEL_V` to 7.

**M7. Lineman shoulder pads balloon from the front.**
- `sheet_close_desk_hands_pads.png` frames 3, 6, 8 and `sheet_close_phone_body.png` frames 11, 13: the caps are near-spheres wider than the torso. Compare the Lab OL (`qa/shots/visual/lab_desk_02_locker_OL.png`), whose pads hug the shoulder.
- Fix, `10_models.js:78`: `cap` `[0.124, 0.07, 0.148]` → `[0.108, 0.056, 0.13]` and arch x 0.19 → 0.175.
- Keep the 0.86× mesh res. The back view is good, so keep `plate` at 1.1.

**M8. Landscape: the chip row is crushed under Coach picks.**
- `ui_land/013_sheet_O_coach.png`: the chips show only their top half (12 px).
- Cause: `.picks` sits in grid row 1 next to `.sh-top`, which makes row 1 140 px tall. `.chips` (overflow-x:auto) is a grid item with `min-height:auto → 0`, so it shrinks.
- Fix, `20_match.css:72-76`:
  - `.sheet .chips{min-height:34px}`
  - `.sheet .picks{grid-row:1/5;align-self:start}`

**M9. The phone play list is still 2 columns.**
- `ui_phone/log.json`: `cols:2` with 22-28 cards, so 4 cards show (`sheet_ui_phone_match.png` frames 4-6).
- `@media (max-width:480px){.plist{grid-template-columns:repeat(3,1fr)}}` (`20_match.css:70`) is overridden by `.plist{...repeat(auto-fill,minmax(118px,1fr))}` at line 95.
- Fix: move the media block below line 95, or write it as `.sheet .plist`.

### Polish

- **P1. OL stance from behind reads as a squat.**
  - The probe (`stance_play/log.json`) has OL pelvis at 0.59 m and head at 1.10 m: deep hips with an upright torso (`sheet_stance_play.png`, #56 from behind). DL look right from the side.
  - Fix, `src/engine/10_body.js`:
    - Line 269: `-0.24*st3` → `-0.16*st3` (hips about 0.68 m).
    - Line 272: `0.9*st3` → `1.25*st3` (flat back, head about 0.88 m).
    - Line 321: down-hand reach 0.32 → 0.26.
  - Also ease the stance exit rather than running it linear (1, .79, .58, .37, .17, 0 in `close_desk/log.json`): `const stK = sstep(0, 1, p.stK || 0)` at line 268.
- **P2. Blockers' helmets sink into the opponent's shoulder pads** (`sheet_close_desk_blocks.png` frames 3, 10). Push the bonded pair's heads to the outside: neck lateral offset `rT × 0.09` toward the blocker's play side.
- **P3. Kit colour seams fray up close.** Jersey hems, necklines, sleeve ends and the knee/sock line have ragged, furry edges (`close_desk/005_p0_stance_OT_34.png` knee; `sheet_close_desk_hands_pads.png` frames 4-5 hem). This comes from vertex-colour interpolation across coarse triangles. Widen those slot blends to 1.5× body res, the same idea as M6.
- **P4. A pocket bubble can cover its receiver** (the TE in `rt_phone/002_p1_O_bubbles_live.png`). Anchor the bubble at `head.y + 0.9` and add a 6 px pointer tail.
- **P5. The midfield logo overpowers the play.** It is about 25 yd wide and near-white at 0.9 alpha, so white and light-blue kits disappear on it (`sheet_rt_p7_D_full.png`, `rt_desk/021_p7_D_D_live.png`).
  - `20_scene.js:207`: alpha 0.9 → 0.55, draw it at 200 px instead of 300, and tint pure whites to `#dfe6d8`.
- **P6. The TD moment is still thin** (round-1 P1). Use the `.ban b.td` style and the scorer's name as the subtitle. Pull in the two nearest teammates and push the camera in 15% over 1.2 s.
- **P7. WR and CB stances have parallel feet** (`sheet_close_desk_stances.png` frames 8-9). Set the inside foot back 0.35 m.
- **P8. The desktop hint is hard to read on turf.** Give `.hint` a `rgba(8,14,22,.6)` pill with 4×10 px padding.
- **P9. The landscape final card needs scrolling** (736 px content in 327 px). Put the leader tiles in 2 columns beside the table when `max-height:500px`.
- **P10 (QA only).** `R3D.coarse` always reads `false`: `Object.assign(R3D, R)` copies the getter's value at load. Use `Object.defineProperty`. No visual effect.

---

## Character Lab vs in-game (round 2)

| Area | Round 1 | Now |
|---|---|---|
| Helmet shell | Speckled | Clean gloss, sharp logo, mask seated. Small stripe and groove artifacts at phone resolution (M6). |
| Pads | Slabs | Rounded, good from behind. Too puffy from the front (M7). |
| Hands | Spikes | Mitts that read as gloves |
| Stances | Upright queue | A stance per position, close to the Lab lineup. The OL back could be flatter (P1). |
| Blocks | Locked arms | Engaged, elbows bent, hands at the chest. A little helmet clipping (P2). |
| Kits and numbers | Matches the Lab | Still matches |

## Already good: keep it
- Helmet gloss, logos and facemasks at every distance. Kits, numbers, name bars and stripes recolour cleanly for every team I saw (purple, gold, navy, orange, red, green, teal).
- The live runner camera on phone: leads the carrier, keeps him centered, smooth at 18 ms frames (`sheet_rt_p2_run.png`).
- Receiver bubbles: edge-pinned, never stacked, colour-coded open/tight/covered, and tappable.
- The coordinator bubble placement and clamp, the home briefing card and the Game Plan screen.
- The phone call sheet: picks row, full-height chips, grouped right-side buttons.
- The landscape two-column sheet when a filter other than Coach picks is selected.
- The scorebug at every size, banners, the pause menu, the intro card, the final card with the dimmed loser score, and the solid action buttons.
- Desktop framing with side stands, light towers and the end-zone stand (`ui_desk/019_snap_350ms.png`). The sky gradient.
- Contact particles, contact shadows, ball handling, and the pile and fall physics.
- No console errors in any of the 11 capture runs.
