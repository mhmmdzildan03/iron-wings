// IRON WINGS — staged scenes for the maker's screenshots (?shot=…&seed=1).
// Each scene sets the real flight state to a genuine moment of the sortie and
// lets the normal renderer paint it, so a screenshot is always the game
// itself, never a mock-up. The set mixes the two cameras the game offers:
// the title and the dogfight from inside the analogue cockpit, the ring
// course and the landing from the chase camera with the whole fighter in
// frame over the coast.

import { PHASE, HOME_Z } from './flight.js';
import { SCREEN, CAMERA, project } from './render.js';

export function stageShot(name, flight, renderer) {
  const s = flight.state;
  // A shared scenic cruise the title screen flies over, the first ring a
  // distant hoop on the coast road ahead.
  s.throttle = 0.8; s.speed = 56; s.alt = 165; s.z = 320; s.x = -30;
  s.pitch = 0.04; s.roll = -0.12; s.heading = 4; s.onGround = false;
  s.phase = PHASE.RINGS; s.ringIndex = 0;
  s.fuel = 78;

  if (name === 'coast') {
    // Chase camera: the whole fighter banking toward the gold ring, the
    // coastline, village and mountains spread out below her.
    s.z = 1240; s.x = -38; s.alt = 128; s.roll = 0.22; s.pitch = -0.02;
    s.message = 'Ring 1 of 6 — steady, steady…';
    s.messageTime = 9;
    return { screen: SCREEN.PLAY, camera: CAMERA.CHASE };
  }
  if (name === 'dogfight') {
    // Cockpit camera in the middle of the air war: one bandit in the sight
    // firing back, a second crossing high, flak over the harbour, and the
    // first scars of damage on our own hull.
    s.phase = PHASE.DOGFIGHT;
    s.z = 4300; s.alt = 185; s.speed = 61; s.x = 10; s.roll = 0.16; s.pitch = 0.02;
    s.firing = true; s.shake = 0.55; s.score = 2210; s.ringsHit = 6; s.kills = 2;
    s.hull = 82; s.fuel = 61;
    flight.enemies.push({
      x: s.x + 2, alt: s.alt + 8, z: s.z + 175,
      vx: -14, vz: 22, hp: 2, hitFlash: 0, dead: false, smoke: 0,
      t: 1.3, fireT: 2, muzzle: 0.14,
    });
    flight.enemies.push({
      x: s.x - 190, alt: s.alt + 42, z: s.z + 520,
      vx: 18, vz: 20, hp: 3, hitFlash: 0, dead: false, smoke: 0,
      t: 0.4, fireT: 3, muzzle: 0,
    });
    s.flak.push(
      { x: s.x + 120, alt: s.alt - 30, z: s.z + 300, age: 0.12 },
      { x: s.x - 210, alt: s.alt + 26, z: s.z + 460, age: 1.1 },
      { x: s.x + 260, alt: s.alt + 60, z: s.z + 640, age: 0.5 },
    );
    const p = project(s, s.x + 2, s.alt + 8, s.z + 175);
    if (p) renderer.primeExplosion(p.x + 30, p.y - 6);
    s.message = 'Bandit in the sight — FIRE! Mind the flak!';
    s.messageTime = 9;
    return { screen: SCREEN.PLAY, camera: CAMERA.COCKPIT };
  }
  if (name === 'landing') {
    // Chase camera on short final: the fighter flaring over the threshold,
    // gear of sky behind her, the strip reaching up to meet her wheels.
    s.phase = PHASE.RETURN;
    s.z = HOME_Z - 170; s.alt = 16; s.speed = 30; s.vSpeed = -1.2;
    s.x = 3; s.throttle = 0.32; s.pitch = 0.15; s.roll = 0.02; s.heading = 0;
    s.score = 2890; s.ringsHit = 6; s.kills = 5; s.fuel = 34; s.hull = 76;
    s.message = 'Short final — hold the glide, flare at the fence.';
    s.messageTime = 9;
    return { screen: SCREEN.PLAY, camera: CAMERA.CHASE };
  }
  return { screen: SCREEN.TITLE, camera: CAMERA.COCKPIT };
}
