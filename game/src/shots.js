// STEEL VIPER — staged scenes for the maker's screenshots (?shot=…&seed=1).
// Each scene sets the real flight state to a genuine moment of the sortie
// and lets the normal renderer paint it, so a screenshot is always the game
// itself, never a mock-up. Title and dogfight from the cockpit (flyby on the
// title, a locked seeker and a live missile in the fight); the waypoint run
// and the flare-lit final from the chase camera, the whole jet in frame.

import { PHASE, HOME_Z } from './flight.js';
import { SCREEN, CAMERA, project } from './render.js';

export function stageShot(name, flight, renderer) {
  const s = flight.state;
  // A shared scenic cruise the title screen flies over, the first waypoint
  // ring a distant hoop on the coast road ahead.
  s.throttle = 0.85; s.speed = 74; s.alt = 165; s.z = 320; s.x = -30;
  s.pitch = 0.04; s.roll = -0.12; s.heading = 4; s.onGround = false;
  s.phase = PHASE.RINGS; s.ringIndex = 0;
  s.fuel = 78;

  if (name === 'coast') {
    // Chase camera, burners lit: the whole jet banking toward the waypoint
    // ring, coastline, village and mountains spread out below her.
    s.z = 880; s.x = -38; s.alt = 128; s.roll = 0.22; s.pitch = -0.02;
    s.throttle = 1; s.wep = true;
    s.message = 'Waypoint 1 — burners lit, coast road below.';
    s.messageTime = 9;
    return { screen: SCREEN.PLAY, camera: CAMERA.CHASE };
  }
  if (name === 'dogfight') {
    // Cockpit at the kill moment: seeker LOCKED on the bandit in the circle,
    // a missile already off the rail and curving in with its smoke road,
    // a second bandit crossing high and flak over the harbour.
    s.phase = PHASE.DOGFIGHT;
    s.z = 4300; s.alt = 185; s.speed = 82; s.x = 10; s.roll = 0.16; s.pitch = 0.02;
    s.firing = true; s.shake = 0.4; s.score = 2210; s.ringsHit = 6; s.kills = 2;
    s.hull = 82; s.fuel = 61; s.missiles = 4; s.flares = 9;
    const bandit = {
      x: s.x + 2, alt: s.alt + 8, z: s.z + 175,
      vx: -14, vz: 22, hp: 2, hitFlash: 0, dead: false, smoke: 0,
      t: 1.3, fireT: 2, muzzle: 0, boom: 0,
    };
    flight.enemies.push(bandit);
    flight.enemies.push({
      x: s.x - 190, alt: s.alt + 42, z: s.z + 520,
      vx: 18, vz: 20, hp: 3, hitFlash: 0, dead: false, smoke: 0,
      t: 0.4, fireT: 3, muzzle: 0, boom: 0,
    });
    s.lockTarget = bandit; s.lockProgress = 1; s.locked = true;
    // The missile, mid-flight: ahead and below the nose, bending up toward
    // the bandit, its smoke trail curving behind it.
    const m = { x: s.x + 26, alt: s.alt - 26, z: s.z + 96, target: bandit, t: 0.7, trail: [] };
    for (let i = 0; i < 16; i += 1) {
      const f = i / 16;
      m.trail.push({ x: s.x + 26 - f * 30, alt: s.alt - 26 - f * f * 26, z: s.z + 96 - f * 74 });
    }
    s.missilesLive.push(m);
    s.flak.push(
      { x: s.x + 120, alt: s.alt - 30, z: s.z + 300, age: 0.12 },
      { x: s.x - 210, alt: s.alt + 26, z: s.z + 460, age: 1.1 },
    );
    const p = project(s, s.x + 2, s.alt + 8, s.z + 175);
    if (p) renderer.primeExplosion(p.x + 30, p.y - 6);
    s.message = 'LOCKED — FOX TWO!';
    s.messageTime = 9;
    return { screen: SCREEN.PLAY, camera: CAMERA.COCKPIT };
  }
  if (name === 'landing') {
    // Chase camera on short final, flares fanning out behind the jet as she
    // crosses the fence — decoys up, strip reaching to meet her wheels.
    s.phase = PHASE.RETURN;
    s.z = HOME_Z - 170; s.alt = 16; s.speed = 38; s.vSpeed = -1.4;
    s.x = 3; s.throttle = 0.32; s.pitch = 0.15; s.roll = 0.02; s.heading = 0;
    s.score = 2890; s.ringsHit = 6; s.kills = 5; s.fuel = 34; s.hull = 76;
    s.flares = 8; s.flareT = 0.72;
    s.message = 'Flares out — short final, hold the glide.';
    s.messageTime = 9;
    return { screen: SCREEN.PLAY, camera: CAMERA.CHASE };
  }
  return { screen: SCREEN.TITLE, camera: CAMERA.COCKPIT };
}
