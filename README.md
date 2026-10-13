# WEB SWING

A browser-based 3D Spider-Man style swinging game. Shoot webs from rooftop to
rooftop, chain combos, and see how far you can fly over a neon night city.

**▶ Live: https://vesanieminen.github.io/web-swing/**

No build step, no assets, no dependencies to install — everything (city, hero,
textures, audio) is generated procedurally in code. Three.js is loaded from a
CDN via an import map.

## Run it

The game uses ES modules, so it must be served over HTTP (opening `index.html`
from the filesystem will not work):

```bash
cd web-swing
python3 -m http.server 8000
# open http://localhost:8000
```

Any static file server works (`npx serve`, `caddy file-server`, etc.).

Pushes to `main` are automatically published to GitHub Pages at the URL above.

## How to play

- **Hold left click** or **Space** — shoot a web and swing. Release to let go.
- **Mouse move** or **A / D** — steer left/right along the skyline.
- **Mouse up/down** or **W / S** — pump the swing (up = higher arc).
- **Mouse wheel** — trim web length.
- **R** — cut the web. **P** — pause. **M** — mute.

Land on rooftops for bonus points, grab glowing orbs for combos, and don't
touch the streets. Best score is stored locally.

## Tech notes

- Single vanilla-JS game loop in `main.js` (~1,200 lines), Three.js for rendering.
- Rope-constraint swing physics with speed clamping, pump, and air steering.
- City is generated in lanes with guaranteed threadable corridors, so there is
  always a reachable target.
- All sound is synthesized live with the Web Audio API — no audio files.
- `window.__ws` and `window.__wsDebug` expose game state and an aim/hold/release
  API for debugging and automated playtesting.
