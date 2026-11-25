# Shadow Fight v2

A visceral, responsive 2D silhouette martial arts fighting game — a complete
re-engineering of the single-file Shadow Fight prototype into a modular
Vite + vanilla JavaScript project. Pitch-black fighters with warm-white rim
light, glowing pill eyes and a red moon. No build-time assets, no downloads:
all art is procedural canvas, all sound is synthesized Web Audio.

## Play it

```bash
npm install
npm run dev
```

Open http://localhost:5173. For a production build: `npm run build`
(output in `dist/`). GitHub Pages deploys automatically from `main` via
`.github/workflows/deploy.yml`.

## Modes

- **Arcade Ladder** — a 4-stage gauntlet (Loop → Mentor → Sprinter → Eclipse
  the boss) across all three arenas, with an S/A/B/C rank at the end.
- **Versus CPU** — pick both fighters, the stage and the difficulty.
- **Local 2-Player** — two fighters, one keyboard.
- **Training Dojo** — infinite timer, regenerating HP, dummy behaviour
  (Stand / Crouch / Block / Attack), hitbox + hurtbox overlay (`H`),
  live input history.

## Fighters

| Fighter | Style | Weapon | Special |
| --- | --- | --- | --- |
| LOOP | Balanced | Ronin blade | Shadow Slash — lunging 3-hit flurry |
| MENTOR | Heavy | Iron bo staff | Seismic Slam — armored ground slam |
| SPRINTER | Rushdown | Twin sai | Teleport Flurry — vanish behind the foe, 5 cuts |
| ECLIPSE | Shadow Boss | Dual phantom blades | Phantom Eclipse — 4 sweeping cuts |

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | A / D | Arrow keys |
| Jump | W | Arrow Up |
| Crouch / block | S (hold Away to block) | Arrow Down |
| Light | J (J→J→J chains) | N |
| Heavy | K | M |
| Special (full meter) | L | , |
| Throw | U | . |
| Dodge roll | Space or I | / |
| Pause / move list | P or Esc | — |
| Hitbox overlay (training) | H | — |

Moves: Down+J low kick · Down+K sweep (knockdown) · Up+K anti-air launch ·
Forward+K lunge · Air+J knee · Air+K dive · Throw beats block · tap Back
just before impact to **Parry** · blocking fills the Guard gauge (full =
Guard Break). Double-tap A/D to dash. Touch controls appear on phones.

## Combat systems

60 Hz fixed-timestep logic, 7-frame input buffer, light→heavy→special
cancels with combo damage scaling, hitstop, pushback, corner wall-splats,
wake-up invulnerability, guard meter, perfect parry, throws with techs,
dodge-roll i-frames, and an FSM AI with human reaction buffers
(Easy ~22f, Normal ~13f, Hard ~7f) and per-fighter personalities.

## Project structure

```text
shadow-fight-v2/
├── index.html
├── vite.config.js
├── package.json
├── .github/workflows/deploy.yml
└── src/
    ├── main.js            # game state machine, modes, rounds, camera
    ├── styles/main.css    # HUD, menus, touch controls
    ├── config/config.js   # tuning values, stages, difficulties, ladder
    ├── engine/
    │   ├── input.js       # buffered controllers (keyboard / touch / AI)
    │   └── loop.js        # fixed-timestep loop
    ├── animation/rig.js   # articulated silhouette rig, poses, cloth
    ├── fighters/fighters.js # roster, move tables, specials
    ├── combat/combat.js   # fighter state machine, hits, guard, parry
    ├── ai/ai.js           # FSM AI + training dummy
    ├── stages/stages.js   # parallax arenas (street / lake / courtyard)
    ├── audio/audio.js     # procedural Web Audio (whoosh, impact, taiko)
    ├── vfx/vfx.js         # particles, slash arcs, shockwaves
    └── ui/ui.js           # menus, HUD, touch controls, move list
```

## License

MIT — see `LICENSE` in the original Shadow Fight repository.
