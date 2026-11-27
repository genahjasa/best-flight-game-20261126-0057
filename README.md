[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/genahjasa/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/genahjasa/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sky Courier — Island Run** is a bush-plane courier game for the desktop browser: a chase view over a seeded island archipelago, a lit instrument panel, and three missions that turn throttle, turn discipline and fuel into decisions. Thread the sky rings, mind the tanks, and set her down gently on the grass.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 and click a mission card to fly. No build step, no network request: `game/` is plain static files.

## How to fly

| Input | Does |
| --- | --- |
| ↑ / ↓ (or W / S) | Pitch nose up / down |
| ← / → (or A / D) | Bank left / right — a banked wing turns the nose |
| SHIFT / CTRL (or E / Q) | Throttle up / down (mouse wheel works too) |
| Mouse drag | Bank with the pointer |
| F | Flaps out / in (slower, more lift) |
| G | Landing gear up / down |
| P | Pause |
| R | Restart the mission |
| M | Mute |

Land soft to score: slow, level, gear down, sink under 4.5 m/s. A hard landing bends the aeroplane; touching down off a strip ends the sortie.

## Missions

- **Ring Run** — thread all 8 sky rings in order before the fuel runs dry.
- **Island Hop** — lift off from North Field, fly the rings, and deliver the mailbag onto South Strip (+400).
- **Storm Courier** — six rings in a rising crosswind, against a 4-minute clock, with a time bonus for finishing early.

Rings are worth 100 points each (25 for a near miss), a smooth landing 250, a rough one 80. Fuel burns with the throttle; empty tanks still glide, so pick a field.

## Screenshots

The four images in `screenshots/` are real renders of the game in desktop Chrome, posed by the autopilot in `game/src/shots.js` — the game really flew to each frame, nothing was staged by hand:

1. `1-start.jpg` — the title screen over North Field, with the three mission cards.
2. `2-play.jpg` — mid-flight in Ring Run: ring 3 ahead, two rings banked, instruments lit.
3. `3-approach.jpg` — final approach to South Strip in Island Hop: gear down, flaps out, rings 3/3.
4. `4-complete.jpg` — the debrief after a clean Ring Run: 8/8 rings, score 800.

Reproduce any of them with `node serve.ts` and the matching URL from `shots.json`, e.g. `http://localhost:8080/?shot=play&seed=7`.

## What's inside

- `game/index.html` — the page: one canvas, one module script, no external files.
- `game/src/config.js` — every tuning number: the world, the plane, the missions.
- `game/src/random.js` — the seeded generator and value noise the islands grow from.
- `game/src/world.js` — island terrain, the two grass strips, the ring course, and the camera projection.
- `game/src/flight.js` — the flight model: lift, stall, turns, fuel, gear, flaps, landings.
- `game/src/missions.js` — mission rules, ring passes, scoring, and the debrief.
- `game/src/audio.js` — procedural WebAudio: engine hum, wind, ring chimes, touchdown thuds.
- `game/src/render.js` — sky, projected terrain, runways, rings, the aircraft, the instruments, the menus.
- `game/src/shots.js` — the autopilot that poses the screenshots by really flying the game.
- `game/src/main.js` — the loop and the screens; wires input, flight, missions, sound and picture.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `serve.ts` — a tiny static server for local play.
- `screenshots/` — four real renders of the game, posed by the autopilot (`shots.json` lists the shot URLs).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/game/`, `out/screenshots/` and `out/dossier.json`, byte for byte what the gate rebuilds.

---

<sub>Entered on [make.fun](https://make.fun/?ref=maqpwds7&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
