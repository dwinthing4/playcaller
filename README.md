# Playcaller

A head-coach football game for phones and desktop. You run the whole team: roster, depth chart, playbook, game plan, free agency, the draft, scouting, trades and staff. In games you call every play, then play it out on a physics-driven 3D field.

**Play it:** open the GitHub Pages link in the repo's About box (or see Settings → Pages).

## What's in it
- Management: league seasons, draft with scouting, potential grades and archetypes (raw, pro-ready, hidden gem, boom or bust), free agency, trades, owner and GM, coordinators who brief you and pitch calls, player development by age, potential and coaching.
- On the field: every rating changes how a player plays. Throw power sets a QB's range, accuracy sets how tight his throws land, speed, hands, jumping, tackling and pursuit all show up. Real-physics tackles and blocking for all 22 players.
- Controls: tap to snap, drag back to aim a pass (the arc shows range and accuracy), drag forward to run, pocket joystick bottom-left. Adjustable camera (behind the QB, sideline, all-22, height and zoom).
- Sim a drive or the rest of the game and watch it at 1x–20x, or finish instantly.

All teams, names and logos are original.

## Build
The game is a single HTML file built from `src/`:

```
node tools/build.mjs
```

This writes `dist/playcaller.html`. Open it in a browser to play. GitHub Actions runs the same build on every push to `main` and publishes it to GitHub Pages (`.github/workflows/pages.yml`).

Layout and data contracts are in [docs/PLAN.md](docs/PLAN.md).
