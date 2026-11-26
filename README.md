# iron-wings

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/mhmmdzildan03/iron-wings/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/mhmmdzildan03/iron-wings/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**STEEL VIPER — Modern Air Combat.** A modern fighter-jet combat game that runs entirely from static files in a desktop browser — no build step, no network request — with two cameras: a first-person cockpit wrapped in a projected green HUD (velocity and altitude tapes, heading strip, pitch ladder, a seeker reticle) over two live MFDs (a sweeping radar scope and a systems page), and a chase camera that puts the whole twin-fin delta jet in frame, afterburner cones flickering at her tail. One complete sortie at sunset: take off from a coastal strip, thread six holographic waypoint rings along the shoreline, then an air war — five weaving bandits engaged with cannon and lock-on missiles (hold the target in the circle for ~1.2 s until LOCKED, then F to launch; watch the missile curve in on its smoke road), hostile missiles answered with flares (X) while the RWR screams, harbour flak and hull damage throughout — before turning for home to land on the same strip, your score grading how softly you touch down. Every confirmed kill earns a half-second of slow-motion cinema. All sound — jet roar, burner, lock tone, RWR, cannon, explosions — is synthesised live with WebAudio; there are no audio assets. Controls: mouse = stick, W/S = throttle, SPACE = cannon, F = missile, X = flares, SHIFT = afterburner, C = cockpit/chase camera, P = pause, M = mute.

Rendered with vendored PixiJS (parallax sunset clouds, hazy mountain ranges, patchwork fields with hedgerows and pines, the sun's road glittering on the sea, speed particles) and anime.js for the UI settle.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
# hand-in build: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=n8m845w8&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
