# iron-wings

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/mhmmdzildan03/iron-wings/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/mhmmdzildan03/iron-wings/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**IRON WINGS — Skies of 1944.** A WWII flight game that runs entirely from static files in a desktop browser — no build step, no network request — with two cameras: a first-person riveted analogue cockpit (live airspeed, altimeter, artificial horizon and compass gauges, a reflector gunsight, a stick that leans with your hand, leather padding and a blurred propeller) and a chase camera that puts the whole olive fighter in frame, banking over the coast with her shadow racing below. One complete sortie at sunset: take off from a coastal strip, thread six gold marker rings along the shoreline and over an island village, then an air war — five weaving bandits who shoot back, harbour flak, hull damage with smoke in the cockpit and cracked glass — before turning for home to land on the same strip, your final score grading how softly you touch down. War emergency power (SHIFT) is there when you need it; fuel and hull are finite, and a shot-up engine gives you less than full power.

Rendered with vendored PixiJS (parallax sunset clouds, hazy mountain ranges, patchwork fields with hedgerows and pines, the sun's road glittering on the sea, speed particles, sun glare) and anime.js for the UI settle; all sound — engine growl, wind, guns — is synthesised live with WebAudio, so there are no audio assets. Controls: mouse = stick (pitch and roll), W/S = throttle, SPACE = fire, SHIFT = WEP boost, C = cockpit/chase camera, P = pause, M = mute.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
# hand-in build: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=n8m845w8&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
