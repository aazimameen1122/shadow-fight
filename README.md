# Shadow Fight

A dark-silhouette browser fighting game. Matte-black fighters with white
rim-light and pill eyes battle across three arenas in best-of-3 rounds.

**Play it:** enable GitHub Pages for this repo (Settings → Pages → Deploy
from branch `main`, folder `/ (root)`), then open
`https://aazimameen1122.github.io/shadow-fight/` — or just open
`index.html` in any modern browser. No build step, no dependencies.

## Fighters

| Fighter | Style |
| --- | --- |
| Loop | Balanced all-rounder |
| Mentor | Heavy hitter — lilac cardigan, sunhat |
| Sprinter | Fast, light — red sash |

## Arenas

Rooftop Street · Moonlit Lake · Old Courtyard

## How to play

- Best of 3 rounds, 60-second timer per round.
- Punch, kick, block, jump and build your Special meter for a special move.
- Combos, hit effects and K.O. slow-motion included. The CPU fights at
  three difficulty levels.

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A / D or ← / → | On-screen buttons |
| Jump | W or ↑ | Jump button |
| Crouch / Block | S or ↓ | Block button |
| Punch | J | Punch button |
| Kick | K | Kick button |
| Special | L | Special button |

## Tech

- Plain HTML, CSS and JavaScript — no frameworks, no build tools.
- Canvas-rendered silhouette fighters, WebAudio synthesized sound effects.
- Works on desktop and mobile (touch controls included).

## Project structure

```text
shadow-fight/
├── index.html        # Game page (HUD, menus, touch controls)
├── css/
│   └── style.css     # All styling
├── js/
│   └── game.js       # Game logic, AI, rendering, sound
├── README.md
└── LICENSE
```

## License

MIT — see [LICENSE](LICENSE).
