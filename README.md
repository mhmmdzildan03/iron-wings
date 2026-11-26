# iron-wings

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/mhmmdzildan03/iron-wings/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/mhmmdzildan03/iron-wings/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**IRON WINGS — Skies of 1944.** A first-person WWII cockpit flight game that runs entirely from static files in a desktop browser — no build step, no network request. You sit in a riveted analogue cockpit (live airspeed, altimeter, artificial horizon and compass gauges, a reflector gunsight, a stick that leans with your hand, leather padding and a blurred propeller) and fly one complete sortie at sunset: take off from a coastal strip, thread six gold marker rings along the shoreline and over an island village, fight a dogfight through the gunsight with tracer fire, cockpit shake and muzzle light on the panel, then turn for home and land on the same strip — your final score grades how softly you touch down. War emergency power (SHIFT) is there when you need it, and it will cook your guns' temper if you lean on the button too long.

Rendered with vendored PixiJS (parallax sunset clouds, layered sea and patchwork coast, speed particles, sun glare) and anime.js for the UI settle; all sound — engine growl, wind, guns — is synthesised live with WebAudio, so there are no audio assets. Controls: mouse = stick (pitch and roll), W/S = throttle, SPACE = fire, SHIFT = WEP boost, P = pause, M = mute.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
# hand-in build: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=n8m845w8&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
