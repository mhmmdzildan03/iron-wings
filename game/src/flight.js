// IRON WINGS — flight model and mission state.
//
// One aeroplane, one coastline, three acts: take off and thread the marker
// rings, fight the patrol that comes to meet you, then turn for home and put
// her down gently on the same strip you left. Everything here is numbers:
// the renderer only reads this state, it never changes it.
//
// Units are metres and metres per second inside; the cockpit gauges convert
// to the mph and feet a 1944 pilot would expect.

export const PHASE = {
  TAKEOFF: 'takeoff',
  RINGS: 'rings',
  DOGFIGHT: 'dogfight',
  RETURN: 'return',
  LANDED: 'landed',
  CRASHED: 'crashed',
};

/** The strip sits at distance 0; the sortie flies out along +z and comes back along it. */
export const STRIP = { length: 620, width: 34, z: 0 };

/** Marker rings on the outbound leg: lateral offset, height, distance along the coast. */
export const RING_COURSE = [
  { x: -60, alt: 120, z: 1500 },
  { x: 90, alt: 170, z: 2600 },
  { x: -140, alt: 210, z: 3800 },
  { x: 40, alt: 150, z: 5000 },
  { x: 160, alt: 240, z: 6300 },
  { x: -40, alt: 190, z: 7600 },
];
export const RING_RADIUS = 62;

/** Where the home strip waits on the return leg, in the same world frame. */
export const HOME_Z = 9800;

const GRAVITY = 9.8;
const MAX_SPEED = 92; // m/s, about 205 mph flat out with WEP
const STALL_SPEED = 26;

export function createFlight() {
  const state = {
    phase: PHASE.TAKEOFF,
    // Position: x is lateral from the coast road, alt is height, z is distance flown out.
    x: 0, alt: 0, z: 0,
    speed: 0, vSpeed: 0,
    pitch: 0, roll: 0, heading: 0, // heading in degrees, 0 = outbound along the coast
    throttle: 0, wep: false,
    onGround: true, gearDown: true,
    ringsHit: 0, ringIndex: 0, ringFlash: 0,
    kills: 0, hitsTaken: 0, hull: 100,
    firing: false, gunHeat: 0, shake: 0,
    score: 0, time: 0,
    touchdown: null, // { vSpeed, speed, lateral } once the wheels meet the strip
    message: 'Throttle up — W — and ease her off the strip.',
    messageTime: 6,
  };

  const enemies = [];
  let enemyTimer = 4;
  let dogfightClock = 0;

  function say(text, seconds = 5) {
    state.message = text;
    state.messageTime = seconds;
  }

  function spawnEnemy() {
    // Patrol machines cross ahead of the player, drifting across the nose so a
    // steady hand can track them through the sight.
    const side = enemies.length % 2 === 0 ? -1 : 1;
    enemies.push({
      x: state.x + side * (260 + Math.random() * 120),
      alt: state.alt + 18 - Math.random() * 30,
      z: state.z + 620 + Math.random() * 160,
      vx: -side * (16 + Math.random() * 7),
      vz: state.speed * 0.42,
      hp: 3, hitFlash: 0, dead: false, smoke: 0,
    });
  }

  /** Advance the whole sortie by dt seconds. input: {pitch, roll, throttleDelta, fire, wep}. */
  function step(dt, input) {
    if (state.phase === PHASE.LANDED || state.phase === PHASE.CRASHED) return;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    if (state.ringFlash > 0) state.ringFlash -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.4);

    // Throttle and emergency power.
    state.throttle = clamp(state.throttle + input.throttleDelta * dt, 0, 1);
    state.wep = Boolean(input.wep) && state.throttle > 0.85;
    const power = state.throttle * (state.wep ? 1.35 : 1);

    // Attitude follows the stick (the mouse) with a little weight to it.
    const targetPitch = input.pitch; // -1 nose down .. 1 nose up
    const targetRoll = input.roll; // -1 left .. 1 right
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3.2);
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * 3.8);
    state.heading = wrapDegrees(state.heading + state.roll * 26 * dt * (state.onGround ? 0 : 1));

    // Airspeed: engine pulls, drag and the climb bleed it away.
    const climbDrag = state.pitch * 14;
    const accel = power * 16 - state.speed * 0.055 - climbDrag * (state.onGround ? 0 : 1);
    state.speed = clamp(state.speed + accel * dt, 0, MAX_SPEED * (state.wep ? 1.12 : 1));

    // Heading bends the track sideways; the coast road runs along z.
    const headRad = (state.heading * Math.PI) / 180;
    state.x += Math.sin(headRad) * state.speed * dt;
    state.z += Math.cos(headRad) * state.speed * dt;

    // Vertical: pitch lifts her once there is airflow, gravity argues back.
    if (state.onGround) {
      state.vSpeed = 0;
      state.alt = 0;
      if (state.speed > 34 && state.pitch > 0.18) {
        state.onGround = false;
        state.vSpeed = 2.2;
        if (state.phase === PHASE.TAKEOFF) {
          state.phase = PHASE.RINGS;
          say('Airborne! Follow the gold rings along the coast.');
        }
      }
    } else {
      const lift = state.speed > STALL_SPEED ? state.pitch * state.speed * 0.24 : state.pitch * 3 - 4.5;
      state.vSpeed += (lift - state.vSpeed) * Math.min(1, dt * 1.6);
      state.alt += state.vSpeed * dt;
      if (state.alt <= 0) touchGround();
    }

    state.firing = Boolean(input.fire) && !state.onGround && state.gunHeat < 1;
    if (state.firing) {
      state.gunHeat = Math.min(1, state.gunHeat + dt * 0.55);
      state.shake = Math.min(1, state.shake + dt * 7);
    } else {
      state.gunHeat = Math.max(0, state.gunHeat - dt * 0.3);
    }

    updateRings();
    updateDogfight(dt);
    updateReturn();
  }

  function touchGround() {
    state.alt = 0;
    const onStrip = Math.abs(state.x) < STRIP.width && nearHomeStrip();
    if (state.phase === PHASE.RETURN && onStrip && state.vSpeed > -9) {
      state.phase = PHASE.LANDED;
      state.touchdown = { vSpeed: state.vSpeed, speed: state.speed, lateral: state.x };
      const softness = clamp(1 - Math.abs(state.vSpeed) / 9, 0, 1);
      const bonus = Math.round(400 * softness) + (state.speed < 34 ? 150 : 40);
      state.score += bonus;
      say('Down and safe. Splendid landing, pilot.');
    } else if (state.vSpeed < -11 || !onStrip) {
      state.phase = PHASE.CRASHED;
      state.hull = 0;
      say('She went in hard. The coast guard will fish you out…');
    } else {
      state.onGround = true;
      state.vSpeed = 0;
    }
  }

  function nearHomeStrip() {
    return state.z > HOME_Z - STRIP.length && state.z < HOME_Z + 120;
  }

  function updateRings() {
    if (state.phase !== PHASE.RINGS) return;
    const ring = RING_COURSE[state.ringIndex];
    if (!ring) return;
    if (state.z >= ring.z) {
      const dx = state.x - ring.x;
      const dy = state.alt - ring.alt;
      if (Math.hypot(dx, dy) < RING_RADIUS) {
        state.ringsHit += 1;
        state.score += 250;
        state.ringFlash = 1;
        say(`Ring ${state.ringsHit} of ${RING_COURSE.length} — clean through!`);
      } else {
        say('Missed her — the next ring is already waiting.');
      }
      state.ringIndex += 1;
      if (state.ringIndex >= RING_COURSE.length) {
        state.phase = PHASE.DOGFIGHT;
        dogfightClock = 0;
        say('Bandits ahead! Gunsight on, thumb on the button — SPACE.');
      }
    }
  }

  function updateDogfight(dt) {
    if (state.phase !== PHASE.DOGFIGHT) return;
    dogfightClock += dt;
    enemyTimer -= dt;
    if (enemyTimer <= 0 && enemies.length < 3 && state.kills < 3) {
      spawnEnemy();
      enemyTimer = 5.5;
    }
    for (const e of enemies) {
      if (e.dead) { e.alt -= 26 * dt; e.z += e.vz * dt; e.smoke += dt; continue; }
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
    }
    // Cull machines that have crossed far behind or fallen away.
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      if (enemies[i].z < state.z - 260 || enemies[i].alt < -40) enemies.splice(i, 1);
    }
    if (state.kills >= 3 || dogfightClock > 75) {
      state.phase = PHASE.RETURN;
      enemies.length = 0;
      say('Sky is clear. Turn for home — the strip is behind you, follow the coast back.');
    }
  }

  function updateReturn() {
    if (state.phase !== PHASE.RETURN) return;
    // The home strip sits at HOME_Z in world terms; the renderer draws it as
    // the player closes the last stretch, and touchGround judges the arrival.
    if (state.z > HOME_Z + 900) {
      say('Too far past the strip — circle back and line her up.');
      state.z = HOME_Z + 400; // a gentle marshal: keep the approach in reach
    }
  }

  /** Register one gun hit on the enemy nearest the sight line. Called by main when a tracer connects. */
  function hitEnemy(enemy) {
    if (!enemy || enemy.dead) return;
    enemy.hp -= 1;
    enemy.hitFlash = 0.12;
    state.score += 60;
    if (enemy.hp <= 0) {
      enemy.dead = true;
      state.kills += 1;
      state.score += 340;
      say(state.kills >= 3 ? 'That is the third — the sky is yours!' : `Splash one bandit! ${state.kills} down.`);
    }
  }

  return { state, enemies, step, hitEnemy, say };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function wrapDegrees(d) { const w = ((d + 180) % 360 + 360) % 360 - 180; return w; }
export function mph(ms) { return Math.round(ms * 2.237); }
export function feet(m) { return Math.round(m * 3.281); }
