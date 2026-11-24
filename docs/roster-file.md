# Playcaller roster file (version 1)

A roster file brings your own team names, colors, logos, player names, numbers, ratings and photos into Playcaller.
You load it from your own device (title screen › Roster file, or League › Editor › Load roster file). It is kept in your
save on that device only; nothing is uploaded, and nothing in it is bundled with the game. League › Editor › Export roster
file writes the current league in the same format so you can share it. `sample-roster.json` (made-up names) shows the shape.

```json
{
  "format": "playcaller-roster",
  "version": 1,
  "name": "My league",
  "author": "optional",
  "teams": [
    {
      "abbr": "HBR", "city": "Harbor City", "name": "Gulls",
      "colors": { "primary": "#1d3478", "secondary": "#f2c230", "helmet": "#1d3478" },
      "logo": "data:image/png;base64,...",
      "coach": { "first": "Dana", "last": "Whitfield" }, "oc": { "first": "", "last": "" }, "dc": { "first": "", "last": "" },
      "players": [
        { "first": "Jordan", "last": "Example", "pos": "QB", "num": 12, "age": 27, "height": 76, "weight": 225,
          "ratings": { "ovr": 82, "pot": 85, "spd": 70 },
          "photo": "data:image/jpeg;base64,...",
          "comp": "A pocket passer who wins with timing" }
      ]
    }
  ]
}
```

- **Teams** need a `city`, `name` or `abbr` (up to 4 letters/digits). `name` may be empty: the team then goes by its city.
- **Players** need a position and a name (`first`/`last`, or one `name`). List them in depth-chart order within each
  position: the first QB is the starter. Positions: QB RB FB WR TE OT OG C DE DT LB CB S K P (also HB, LT, RT, LG, RG, OL,
  EDGE, DL, NT, ILB, OLB, MLB, DB, FS, SS, PK). Up to 70 per team; a team keeps 53.
- **Everything else is optional.** `ratings` may hold `ovr`, `pot` and any of spd acc agi str awr thp tha cth rte btk elu car
  rbk pbk tak pur prs pow bsh mcv zcv hnd jmp kpw kac (10–99). With only `ovr`, the player's ratings are shaped to that overall.
  `comp` is a short "plays like" comparison shown on the player card.
- **Images** must be inside the file as PNG, JPEG, WebP or GIF data URLs (links are ignored, so nothing is downloaded).
  They are shrunk on import: logos to fit 128 px, photos to a 128 px square cropped toward the top (faces).

**Applying to a league:** teams are matched by abbreviation, then by city (optionally the leftovers in file order).
*Rename players* keeps the players and their contracts and changes names, numbers and photos position by position
(ratings and ages too if you tick "Use ratings"). *Replace rosters* gives each matched team the file's players; the
current players retire, empty spots are filled with new players, and contracts are set fresh. Starting a new career from a
file puts its teams in place of the generated ones in file order.
