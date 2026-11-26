// IRON WINGS — staged scenes for the maker's screenshots (?shot=…&seed=1).
// Each scene sets the real flight state to a genuine moment of the sortie and
// lets the normal renderer paint it, so a screenshot is always the game
// itself, never a mock-up: title, the ring course over the coast, a dogfight
// with the sight on a bandit, and the flare a breath before touchdown.

import { PHASE, HOME_Z } from './flight.js';
import { SCREEN, project } from './render.js';

export function stageShot(name, flight, renderer) {
  const s = flight.state;
  // A shared scenic cruise the title screen flies over, the first ring a
  // distant hoop on the coast road ahead.
  s.throttle = 0.8; s.speed = 56; s.alt = 165; s.z = 320; s.x = -30;
  s.pitch = 0.04; s.roll = -0.12; s.heading = 4; s.onGround = false;
  s.phase = PHASE.RINGS; s.ringIndex = 0;

  if (name === 'coast') {
    s.z = 1240; s.x = -38; s.alt = 128; s.roll = 0.1; s.pitch = -0.02;
    s.message = 'Ring 1 of 6 — steady, steady…';
    s.messageTime = 9;
    return SCREEN.PLAY;
  }
  if (name === 'dogfight') {
    s.phase = PHASE.DOGFIGHT;
    s.z = 4300; s.alt = 185; s.speed = 61; s.x = 10; s.roll = 0.16; s.pitch = 0.02;
    s.firing = true; s.shake = 0.55; s.score = 2210; s.ringsHit = 6; s.kills = 2;
    // The bandit sits square in the reflector sight, close enough that its
    // wingspan fills the ring — the moment every pilot remembers.
    flight.enemies.push({
      x: s.x + 2, alt: s.alt + 8, z: s.z + 175,
      vx: -14, vz: 22, hp: 2, hitFlash: 0, dead: false, smoke: 0,
    });
    const p = project(s, s.x + 2, s.alt + 8, s.z + 175);
    if (p) renderer.primeExplosion(p.x + 30, p.y - 6);
    s.message = 'Bandit in the sight — FIRE!';
    s.messageTime = 9;
    return SCREEN.PLAY;
  }
  if (name === 'landing') {
    s.phase = PHASE.RETURN;
    // A breath before touchdown: threshold just ahead and below the sight,
    // nose high in the flare, the strip filling the lower glass.
    s.z = HOME_Z - 130; s.alt = 15; s.speed = 29; s.vSpeed = -1.3;
    s.x = 3; s.throttle = 0.32; s.pitch = 0.16; s.roll = 0.02; s.heading = 0;
    s.score = 2890; s.ringsHit = 6; s.kills = 3;
    s.message = 'Flare… hold her off… gently now.';
    s.messageTime = 9;
    return SCREEN.PLAY;
  }
  return SCREEN.TITLE;
}
