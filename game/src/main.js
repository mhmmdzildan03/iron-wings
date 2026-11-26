// IRON WINGS — boot, input and the one game loop.
//
// The mouse is the stick: push it forward and she noses down, pull back and
// she climbs, lean it sideways and the world banks. W and S work the
// throttle, SPACE fires the Brownings, SHIFT opens the emergency boost,
// P pauses and M mutes. The simulation steps at a fixed 60 Hz whatever the
// display does; the renderer paints the state it is given.
//
// ?shot=title|coast|dogfight|landing (with &seed=N) stages one real moment
// of the sortie for a screenshot and sets window.__shotReady when painted.

import { createFlight, PHASE } from './flight.js';
import { createRenderer, SCREEN, CAMERA, project } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const container = document.getElementById('stage');
const status = document.getElementById('status');
const renderer = createRenderer(container);
const audio = createAudio();

if (shotName) {
  const flight = createFlight();
  const staged = stageShot(shotName, flight, renderer);
  let painted = 0;
  const paint = () => {
    renderer.draw(flight.state, flight.enemies, staged.screen, 0.016, 2.4, staged.camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  runGame();
}

function runGame() {
  let flight = createFlight(); prevKills = 0; prevMissiles = 6; slowmoTimer = 0;
  let screen = SCREEN.TITLE;
  let camera = CAMERA.COCKPIT;
  let slowmoTimer = 0;
  let prevKills = 0;
  let prevMissiles = 6;
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, consumed by readInput
  const mouse = { nx: 0.5, ny: 0.5, down: false };
  let hitClock = 0;

  window.addEventListener('mousemove', (ev) => {
    mouse.nx = ev.clientX / window.innerWidth;
    mouse.ny = ev.clientY / window.innerHeight;
  });
  window.addEventListener('mousedown', () => { mouse.down = true; begin(); });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space') ev.preventDefault();
    keys.add(ev.code);
    if (ev.code === 'Enter') begin();
    if (ev.code === 'KeyP' && screen === SCREEN.PLAY) screen = SCREEN.PAUSED;
    else if (ev.code === 'KeyP' && screen === SCREEN.PAUSED) screen = SCREEN.PLAY;
    if (ev.code === 'KeyM') {
      const muted = audio.toggleMute();
      status.textContent = muted ? 'Sound off.' : 'Sound on.';
    }
    if (ev.code === 'KeyC' && screen !== SCREEN.TITLE) {
      camera = camera === CAMERA.COCKPIT ? CAMERA.CHASE : CAMERA.COCKPIT;
      status.textContent = camera === CAMERA.CHASE ? 'Chase camera: the whole aircraft in frame.' : 'Cockpit camera.';
    }
  });
  window.addEventListener('keyup', (ev) => keys.delete(ev.code));

  function begin() {
    audio.start();
    if (screen === SCREEN.TITLE) {
      screen = SCREEN.PLAY;
      status.textContent = 'Take off. Throttle up with W, steer with the mouse.';
      // A small cinematic settle as the sortie begins (anime.js, vendored).
      if (window.anime) {
        const view = renderer.app.view;
        window.anime({ targets: view, scale: [1.045, 1], duration: 900, easing: 'easeOutQuad' });
      }
    } else if (screen === SCREEN.OVER) {
      flight = createFlight(); prevKills = 0; prevMissiles = 6; slowmoTimer = 0;
      screen = SCREEN.PLAY;
      status.textContent = 'A fresh sortie. Good luck, pilot.';
    }
  }

  function readInput() {
    return {
      pitch: clampInput((0.5 - mouse.ny) * 1.9),
      roll: clampInput((mouse.nx - 0.5) * 2.1),
      throttleDelta: (keys.has('KeyW') ? 0.55 : 0) - (keys.has('KeyS') ? 0.7 : 0),
      fire: keys.has('Space') || mouse.down,
      wep: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      fireMissile: pressed.has('KeyF'),
      flare: pressed.has('KeyX'),
    };
  }

  function clampInput(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (screen === SCREEN.PLAY) {
      accumulator += slowmoTimer > 0 ? dt * 0.35 : dt;
      const input = readInput();
      pressed.clear();
      // Cinematic beat: a confirmed kill slows the world for ~0.6 s.
      if (flight.state.slowmo > 0 && slowmoTimer <= 0) {
        slowmoTimer = flight.state.slowmo;
        flight.state.slowmo = 0;
      }
      if (slowmoTimer > 0) slowmoTimer -= dt;
      while (accumulator >= STEP) {
        flight.step(STEP, input);
        accumulator -= STEP;
        // Guns: a bandit held inside the reflector ring takes hits over time.
        if (flight.state.firing) {
          hitClock += STEP;
          for (const e of flight.enemies) {
            if (e.dead) continue;
            const p = project(flight.state, e.x, e.alt, e.z);
            if (p && p.rel < 950 && Math.hypot(p.x - 640, p.y - 296) < 74 && hitClock > 0.13) {
              hitClock = 0;
              flight.hitEnemy(e);
              renderer.burstAt(p.x, p.y, 0xffd977, 3, 90);
            }
          }
        } else hitClock = 0.1;
        if (flight.state.phase === PHASE.LANDED || flight.state.phase === PHASE.CRASHED) {
          screen = SCREEN.OVER;
          status.textContent = flight.state.phase === PHASE.LANDED
            ? `Landed. Final score ${flight.state.score}.`
            : `Crashed. Score ${flight.state.score}.`;
        }
      }
    }
    if (flight.state.kills > prevKills) { prevKills = flight.state.kills; audio.explosion(); }
    if (flight.state.missiles < prevMissiles) { prevMissiles = flight.state.missiles; audio.launch(); }
    renderer.draw(flight.state, flight.enemies, screen, dt, now / 1000, camera);
    audio.update(flight.state.throttle, flight.state.speed * 2.237, flight.state.firing && screen === SCREEN.PLAY, {
      wep: flight.state.wep, lockProgress: screen === SCREEN.PLAY ? flight.state.lockProgress : 0,
      locked: flight.state.locked, inbound: Boolean(flight.state.inbound),
    });
  }
  requestAnimationFrame(frame);
}
