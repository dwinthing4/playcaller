# Playcaller (combined game): plan and contracts

The user's three prototypes (in `C:\Users\dwint\Downloads`) are merged into one single-file mobile HTML game:

| Source | What we keep |
|---|---|
| `Playcaller — Head Coach Football.html` (2D, 727 KB) | All coach-level management: league, roster, depth chart, playbook + editor, game plan, free agency, draft, scouting, trades, staff, owner/GM, progression, saves. Play calling in games. |
| `Gridiron Physics Lab.html` (three.js) | The physics model: force-limited locomotion, inverted-pendulum balance, gait, capsule bodies, impulse at contact height, wraps/grip, blocking bonds. Extended to all 22 players. |
| `Gridiron character lab.html` (three.js) | The player look: SDF-sculpted skinned bodies, helmets, facemasks, numbers. |

## What the user asked for (do not lose any of this)
- Total coach control: offense and defense plays, roster, depth, free agency, draft, scouting, trading.
- In games: pick the play from a play-call sheet like Playcaller's.
- Offensive and defensive coordinators who TALK: they brief you weekly with suggestions for each situation (1st & 10, 2nd & short, 3rd & long, red zone, goal line, two-minute...) and pitch calls in the game.
- Scouts who scout every week on their own and file reports.
- GM and owner much more involved (GM proposes trades/signings and pushes back; owner meetings, budget, demands, goals, job security).
- More progression and player development.
- Physical, real-physics tackles; breaking tackles must not be easy; defense must not be outclassed; real blocking for every player; no glitchy pursuit.
- Mobile first (portrait and landscape), single HTML file.
- Original teams and names only (no real league teams/logos). The Retro Bowl genre is fine; no copying of any specific game.
- "Real cities" league option (src/league/12_real.js): the 32 real markets, conferences, divisions and team colors. NFL nicknames, logos and real player names are NOT built in (trademarks / player rights, and the game is public on GitHub Pages); teams go by their city with an original emblem, and League > Editor (src/ui/85_editor.js) lets the user rename teams and players, upload a logo, or paste a roster in their own save.

## Layout and build
```
src/core/     shared helpers + football data + playbook      (00_util, 10_football, 20_playbook)
src/league/   league + management LOGIC, no DOM              (helper agent)
src/engine/   physics + play simulation, no DOM/THREE        (main agent)  -> global PHYS
src/render/   three.js renderer, character meshes            (main agent)  -> global R3D
src/match/    in-game flow, HUD, input, play-call sheet       (main agent)  -> global MATCH
src/ui/       management screens (DOM) + their CSS           (helper agent)
src/shell/    index.html template + base CSS                 (main agent)
src/main.js   boot                                           (helper agent; must call MATCH.init() once)
```
`node tools/build.mjs` concatenates everything (folder order above, files sorted by name) into ONE script and writes
`dist/playcaller.html` (three.js and CSS inlined). It also writes `dist/sim.cjs` = core + league + engine for node tests.
The build compiles the bundle, so duplicate top-level `const`/`let` names fail the build.

### Naming rules (everything shares one global scope)
- `src/core/00_util.js` defines `R, rnd, ri, clamp, lerp, pick, gauss, shuffle, sum, esc, money, YD, seededRng, U`. Do not redeclare.
- Football data globals: `POS_COUNTS, POS_LIST, OFF_POS, DEF_POS, ATTRS, ATTR_NAME, OFF_FORMS, OL_SLOTS, OL_ORDER, DEF_FORMS, ROUTES, ROUTE_NAMES, SETTLE_ROUTES, DEEP_ROUTES, SCHEMES, BLOCK_TYPES, GAPS, resolveBlocks, COV_ZONES, MAN_COVERAGES, covName, SCENS, scenKeyFor, FIELD_W_YD, MID_YD, FB, OBOOKS, DBOOKS, STYLE2BOOK, buildPlaybook, bookHas`.
- Reserved for the main agent: `PHYS, R3D, MATCH` and anything inside their IIFEs.
- League + UI code may use top-level names freely (it is ported from Playcaller), but must not clash with the above.
- No monkey-patching: never `const _x = f; f = function(){...}`. One definition per function. This is the main reason the old file got fragile.

## Data contracts

### Player (league owns, engine reads)
```js
{ id, fn, ln, pos, num, age, ht /*inches*/, wt /*lb*/, a:{spd,acc,agi,str,awr,thp,tha,cth,rte,btk,elu,car,rbk,pbk,tak,pur,prs,pow,bsh,mcv,zcv,hnd,jmp,kpw,kac} /*10-99*/,
  ovr, pot, traits:[], lk:{sk /*0-11 skin tone*/, ...Playcaller look fields}, inj /*weeks*/, tid, mor /*morale*/ }
```
The engine derives physics (mass, size, top speed, acceleration, cut grip, strength, tackle grip, hands, arm) from these.

Measurables (src/league/72_combine.js): `msrOf(p)` gives height (+ eighths), weight, arm, hand, 40, 10 split, vertical, broad, bench, 3-cone and shuttle,
read off his CURRENT ratings and body, so aging moves them together. `p.ms` = `{v:1, arm, hand, h8, oa, oj}` (filled from a hash of the id on load; never changes a rating).
New players get drills first and spd/acc/agi/str/jmp read back from them (`msrGen`, called in genPlayer). Prospects: `p.comb` (combine/pro-day numbers, `sk` skipped drills, `pd` pro day),
`p.combZ`/`p.combBump` (CPU draft stock). Role archetypes `rarchOf(p)`, comps `plkFor(p)` (pool `L.cpool`), draft-guide reports `dgrReport/dgrLatest` (`p.sc.dgs` = who filed the last one),
training camp `L.camp` and private workouts `L.scouting.wo` (76_camp.js; mini-games in src/ui/47_camp.js).

### Team
`{ id, abbr, city, name, c1, c2, depth:{POS:[pid...]}, roster:[pid...], offStyle, defStyle, oc, dc, ... }` (Playcaller shape).

### Kit (league provides)  `LG.kitFor(team, isHome) -> kit`
```js
{ jersey, trim, pants, pstripe, socks, helmet, hstripe, hstripe2, mask, num, numOutline, glove, cleat, logo, logo2, letter, shell /*'sleek'|'speed'|'classic'|'pro'*/ }
```
All colors as `'#rrggbb'`.

### Plays
`buildPlaybook()` (src/core/20_playbook.js) returns the default book. League keeps `L.plays` (default + custom from the play editor).
Offense `{id,name,side:'O',form,type,routes,carrier,dir,scheme,gap,rside,delay,pa,deep,motion,paths,blocks,books,on}`.
Defense `{id,name,side:'D',form,cov,blitz,books,on}`. Units in yards.

### League API used by the match engine (league implements, all synchronous)
```js
LG.state()                                   // current league object L
LG.team(tid), LG.player(pid)
LG.starters(team, formKey, side /*'O'|'D'*/) // [{slot,pos,pid,dx,dy}] incl. OL_SLOTS for offense; skips injured; fills from FALLBACK positions
LG.depthPick(team, pos, idx, usedSet)        // pid
LG.kitFor(team, isHome)
LG.playsFor(tid, side)                       // plays available to that team (book + custom + on)
LG.cpuCall(tid, side, ctx)                   // CPU play call -> play id. ctx below
LG.cpuFourth(tid, ctx)                       // 'go' | 'fg' | 'punt'
LG.coordCall(ctx)                            // user's coordinator pitch -> { picks:[playId,..3], say:'line of dialogue', who:{fn,ln,role:'OC'|'DC',lk} }
LG.noteCall(tid, playId, ctx)                // record a call (tendencies the AI learns from)
ctx = { side, tid, oppTid, down, togo, yl /*own yard line 1-99*/, q, clock, qlen, sd /*score diff for tid*/, scen /*scenKeyFor*/, gameT }
```
If a function is missing the match falls back to simple defaults (so exhibition and tests still run).

### Match API (main agent implements)
```js
MATCH.init()                                 // once at boot
MATCH.open({ g, home, away, userTid, mode:'play'|'watch'|'instant', onDone(result) })
result = { hs, as, st:{pid:{gp,pa,pc,py,ptd,pint,ra,ry,rtd,rec,recy,rectd,tgt,tk,sk,int,pd,ff,fum,fgm,fga,xpm,xpa,pnt,pnty}},
           snaps:{pid:n}, perf:{pid:{good,bad,notes:[]}}, injuries:[{pid,weeks,type}], pbp:[...], drives:[...], pog:pid, quit:false }
```
The league applies `result` exactly like Playcaller's `finishUserGame` (stats, standings, week advance, morale, film notes, XP).
Games not played live (CPU vs CPU, Instant, Sim week) run through the league's play-by-play `simGame` (src/league/22_fastsim.js) on the same clock as a live match at `L.qlen`; `qa/sim_compare.mjs` prints it next to full engine games. Every game writes a game-log line per player (24_gamelog.js) and a box score on its `L.results` row; the schedule (26_schedule.js) is 17 games over 18 weeks with byes and time slots (`g.slot`, `g.neutral`, `g.site`); the history book and record books per quarter length live in 95_history.js.

### UI helpers the match HUD reuses (league/UI agent provides as globals)
`drawBust(ctx2d, person, team)` (portrait from `lk`), `drawLogo(ctx2d, team, size)`, `toast(text)`.

## Coordinates (engine)
Meters. x = sideline to sideline (0 = middle, +x = offense's LEFT when facing downfield), z = downfield for the offense, y up.
Playbook dy (+ = right) maps to x = -dy * YD. Engine always runs plays toward +z; the renderer flips for the other direction.

## Geography, travel, city weather, map (src/league/15_geo.js, src/ui/64_mapdata.js + 65_map.js/.css)
- `geoTeam(T)` = where a team plays (fictional city table GEO_CITY, real stadiums GEO_REAL by team id, cached as `T.gk`), with roof
  ('open'|'dome'|'retract'), surface, altitude and a climate (Sep/Jan highs, rain, snow, wind). `geoSite(name)` for neutral sites (g.site).
- VENUE (src/core/30_venue.js) takes the stadium kind, roof, surface and altitude from the city; `atmo` draws weather from the climate
  and the date (geoDate), uses `g.slot` for the time of day, closes retractable roofs on bad days. `VENUE.today()` adds roof, roofOpen, alt, surface.
- Travel: `geoTravel(g, tid)` (miles, time zones, body clock from the slot, stamina cost ≤ 6%, altitude drain); the rotation
  (rotTravelInit in 25_rotation.js) starts the road team below full stamina and caps recovery (half back at halftime).
  `geoTravelEdge(g, tid)` / `LG.travelEdge` = an edge for the fast sim in power-edge points (home field = +1.5).
- Kicks carry ~2.5 yd farther a mile up (RULES.kickYds k.alt). Wet grass is a touch slicker than wet turf (20_play env.mu).
- Scouting: prospects' region = their college's region (geoCollege). Scout travel section of 60_staff.js: `scoutTrips()` (season calendar
  of college games, showcases, all-star games + travel budget in L.strav), `scoutSend`, `scoutRecall`, `scoutMove` (next week).
- Map screen: own nav group 'mapg' (registered from 65_map.js), layers League / Scouting / Pipelines. `geoPipeline(players, 'home'|'col')`
  and `geoHome(p)` work on any player list, for a future college mode's recruits.

## Broadcast package (src/core/50_wp.js, src/match/30_broadcast.js, src/shell/30_bcast.css)
- Win probability: `WP.of(state)` / `wpNow(G)` (home win %, ties count half) from score, share of the game left, ball, field position, down and distance (RULES.ep),
  timeouts, a pending kickoff or try, the pregame edge (`LG.wpPower`: teamPower off+def, home minus away; the hub uses the same), the leader kneeling it out,
  sudden-death overtime. Constants in `WP.K` per quarter length, fitted on fast-sim games: `node qa/wp_calib.cjs [games] [--fit]` prints the calibration table
  (fastGame takes `opt.onSnap(S, hid, aid)` for this).
- BCAST (one-line hooks in 10_match.js): `step(G, pl)` after each physics step collects routes (5 Hz), the target, landing spot and separation at arrival, run paths;
  `next(G, nextSnap)` at the top of nextSnap samples WP (`G.bc.wph`), time of possession, 3rd downs, closes drives into lower thirds, scores into scoring cards,
  halftime into a held card (returns true to hold; it calls nextSnap itself); `frame(G)` shows the WP bar, booth captions (queued, never over a live play)
  and lower thirds; `pause(el.ovl)` adds Game stats to the pause menu; `finalHtml(G)` adds the WP graph and chart buttons to the final card.
  `BCAST.busy()` / `BCAST.mute(sec)` for other overlays (replays). Settings: L.settings.comm (on/big/off), wpbar, bcgfx.
