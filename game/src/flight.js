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
export const STRIP = { length: 620, width: 52, z: 0 };

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

/** Bandits to splash before the sky is clear enough to run for home. */
export const KILLS_TO_CLEAR = 5;

/** Where the home strip waits on the return leg, in the same world frame. */
export const HOME_Z = 9800;

const GRAVITY = 9.8;
const MAX_SPEED = 118; // m/s — a modern jet's working envelope in game scale
const STALL_SPEED = 34;

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
    kills: 0, hitsTaken: 0, hull: 100, fuel: 100,
    flak: [], // { x, alt, z, age } bursts hanging in the air near the coast defences
    firing: false, gunHeat: 0, shake: 0,
    // Modern systems: a small missile load, flare cartridges, a seeker that
    // needs a steady 1.2 s in the circle to lock, and an RWR that screams
    // when a hostile missile is inbound. slowmo is a one-shot trigger the
    // presenter consumes to give each confirmed kill its cinematic beat.
    missiles: 6, flares: 12,
    lockTarget: null, lockProgress: 0, locked: false,
    missilesLive: [], inbound: null, inboundCooldown: 7, flareT: 0, launchT: 0,
    slowmo: 0,
    score: 0, time: 0,
    touchdown: null, // { vSpeed, speed, lateral } once the wheels meet the strip
    message: 'Throttle up — W — and ease her off the strip.',
    messageTime: 6,
  };

  const enemies = [];
  let enemyTimer = 4;
  let dogfightClock = 0;
  let flakTimer = 2.2;

  function say(text, seconds = 5) {
    state.message = text;
    state.messageTime = seconds;
  }

  function spawnEnemy() {
    // Patrol machines cross ahead of the player, weaving as they come, so a
    // steady hand has to lead them through the sight — and they shoot back.
    const side = enemies.length % 2 === 0 ? -1 : 1;
    enemies.push({
      x: state.x + side * (240 + Math.random() * 130),
      alt: state.alt + 20 - Math.random() * 34,
      z: state.z + 640 + Math.random() * 180,
      vx: -side * (17 + Math.random() * 8),
      vz: state.speed * 0.42,
      hp: 3, hitFlash: 0, dead: false, smoke: 0,
      t: Math.random() * 6, fireT: 1.2 + Math.random() * 1.6, muzzle: 0,
    });
  }

  /** Enemy fire and coastal flak: the war shoots back, and the hull keeps count. */
  function takeFire(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.muzzle > 0) e.muzzle -= dt;
      e.fireT -= dt;
      const rel = e.z - state.z;
      const aligned = Math.abs(e.x - state.x) < 95 && Math.abs(e.alt - state.alt) < 62;
      if (e.fireT <= 0 && rel > 110 && rel < 680 && aligned) {
        e.fireT = 1.5 + Math.random() * 1.4;
        e.muzzle = 0.14;
        if (Math.random() < 0.55) {
          const dmg = 4 + Math.random() * 6;
          state.hull = Math.max(0, state.hull - dmg);
          state.hitsTaken += 1;
          state.shake = Math.min(1, state.shake + 0.55);
          if (state.hull <= 0) {
            state.phase = PHASE.CRASHED;
            say('Shot down in flames — the sea takes another…');
            return;
          }
          if (state.hull < 45) say('She is hit hard — smoke in the cockpit! Break off for home soon.');
          else say('Taking fire! Jink, pilot, jink!');
        }
      }
    }
    // Flak from the harbour guns, in both the fight and the run home.
    if (state.phase === PHASE.DOGFIGHT || state.phase === PHASE.RETURN) {
      flakTimer -= dt;
      if (flakTimer <= 0) {
        flakTimer = 2.4 + Math.random() * 1.4;
        const burst = {
          x: state.x + (Math.random() - 0.5) * 300,
          alt: state.alt + (Math.random() - 0.5) * 110,
          z: state.z + 180 + Math.random() * 420,
          age: 0,
        };
        state.flak.push(burst);
        const near = Math.hypot(burst.x - state.x, burst.alt - state.alt, (burst.z - state.z) * 0.4);
        if (near < 95) {
          state.hull = Math.max(0, state.hull - (3 + Math.random() * 5));
          state.shake = Math.min(1, state.shake + 0.5);
          if (state.hull <= 0) { state.phase = PHASE.CRASHED; say('Flak got her — down she goes…'); return; }
          say('Flak — close enough to hear it crack.');
        }
      }
    }
    for (let i = state.flak.length - 1; i >= 0; i -= 1) {
      state.flak[i].age += dt;
      if (state.flak[i].age > 2.6) state.flak.splice(i, 1);
    }
  }

  /** Advance the whole sortie by dt seconds. input: {pitch, roll, throttleDelta, fire, wep}. */
  function step(dt, input) {
    if (state.phase === PHASE.LANDED || state.phase === PHASE.CRASHED) return;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    if (state.ringFlash > 0) state.ringFlash -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.4);

    // Throttle and emergency power. Fuel burns faster the harder she works;
    // an empty tank means gliding, and a shot-up engine gives less than full.
    state.throttle = clamp(state.throttle + input.throttleDelta * dt, 0, 1);
    state.wep = Boolean(input.wep) && state.throttle > 0.85;
    if (!state.onGround) {
      state.fuel = Math.max(0, state.fuel - dt * (0.22 + state.throttle * 0.4 + (state.wep ? 0.85 : 0)));
      if (state.fuel === 0 && state.messageTime <= 0) say('Tank is dry — glide her home on fumes and prayer.');
    }
    const engineHealth = state.hull < 45 ? 0.72 : 1;
    const power = state.fuel > 0 ? state.throttle * (state.wep ? 1.35 : 1) * engineHealth : 0;
    if (state.hull < 30 && !state.onGround) state.shake = Math.max(state.shake, 0.16);

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
      if (state.speed > 44 && state.pitch > 0.18) {
        state.onGround = false;
        state.vSpeed = 2.6;
        if (state.phase === PHASE.TAKEOFF) {
          state.phase = PHASE.RINGS;
          say('Airborne! Hit the waypoints along the coast — burners if you need them.');
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
    if (!state.onGround && state.phase !== PHASE.TAKEOFF) takeFire(dt);
    updateSystems(dt, input);
  }

  /**
   * The modern layer: seeker lock-on, live missiles both ways, and flares.
   * Hold a bandit inside the aiming circle for ~1.2 s to lock, F to launch.
   * When the RWR warns of an inbound missile, X throws flares to break it.
   */
  function updateSystems(dt, input) {
    if (state.flareT > 0) state.flareT -= dt;
    if (state.launchT > 0) state.launchT -= dt;
    if (state.onGround || state.phase === PHASE.TAKEOFF) { state.lockProgress = 0; state.locked = false; state.lockTarget = null; return; }

    // --- seeker lock-on (dogfight only: the radar is slaved to the fight)
    let candidate = null;
    if (state.phase === PHASE.DOGFIGHT) {
      for (const e of enemies) {
        if (e.dead) continue;
        const rel = e.z - state.z;
        if (rel < 110 || rel > 980) continue;
        const offAxis = Math.abs(e.x - state.x) / rel + Math.abs(e.alt - state.alt) / rel * 1.4;
        if (offAxis < 0.16 && (!candidate || rel < candidate.rel)) candidate = { e, rel };
      }
    }
    if (candidate) {
      if (state.lockTarget !== candidate.e) { state.lockTarget = candidate.e; state.lockProgress = Math.min(state.lockProgress, 0.25); }
      state.lockProgress = Math.min(1, state.lockProgress + dt / 1.2);
    } else {
      state.lockProgress = Math.max(0, state.lockProgress - dt * 1.6);
      if (state.lockProgress <= 0) state.lockTarget = null;
    }
    state.locked = state.lockProgress >= 1 && state.lockTarget && !state.lockTarget.dead;

    // --- launch (F)
    if (input.fireMissile && state.locked && state.missiles > 0) {
      state.missiles -= 1;
      state.launchT = 0.35;
      state.missilesLive.push({
        x: state.x + 14, alt: state.alt - 5, z: state.z + 12,
        target: state.lockTarget, t: 0, trail: [],
      });
      state.lockProgress = 0.35;
      state.locked = false;
      say('Fox two! Missile away.');
    } else if (input.fireMissile && state.phase === PHASE.DOGFIGHT && state.missiles <= 0) {
      say('Winchester — no missiles left. Guns, guns, guns.');
    }

    // --- our missiles fly
    for (let i = state.missilesLive.length - 1; i >= 0; i -= 1) {
      const m = state.missilesLive[i];
      m.t += dt;
      m.trail.unshift({ x: m.x, alt: m.alt, z: m.z });
      if (m.trail.length > 34) m.trail.pop();
      const tgt = m.target;
      if (!tgt || tgt.dead || m.t > 5) { state.missilesLive.splice(i, 1); continue; }
      const dx = tgt.x - m.x, dy = tgt.alt - m.alt, dz = tgt.z - m.z;
      const dist = Math.hypot(dx, dy, dz);
      const stepLen = 165 * dt;
      if (dist < Math.max(30, stepLen)) {
        tgt.hp = 0; tgt.dead = true; tgt.boom = 1;
        state.kills += 1;
        state.score += 500;
        state.slowmo = 0.6;
        state.shake = Math.min(1, state.shake + 0.5);
        state.missilesLive.splice(i, 1);
        say(state.kills >= KILLS_TO_CLEAR ? 'Splash! That is the last of them — sky is clear.' : `Splash one! Missile kill — ${state.kills} of ${KILLS_TO_CLEAR}.`);
        continue;
      }
      m.x += (dx / dist) * stepLen;
      m.alt += (dy / dist) * stepLen;
      m.z += (dz / dist) * stepLen;
    }

    // --- hostile missiles and the flare answer (X)
    if (input.flare && state.flares > 0) {
      state.flares -= 1;
      state.flareT = 0.9;
      if (state.inbound) {
        state.inbound = null;
        state.inboundCooldown = 6 + Math.random() * 4;
        say('Flares out — their missile takes the decoys!');
      }
    }
    if (state.phase === PHASE.DOGFIGHT) {
      if (state.inbound) {
        state.inbound.t -= dt;
        if (state.inbound.t <= 0) {
          state.inbound = null;
          state.inboundCooldown = 8;
          state.hull = Math.max(0, state.hull - (14 + Math.random() * 8));
          state.shake = 1;
          if (state.hull <= 0) { state.phase = PHASE.CRASHED; say('Missile hit — she is going down…'); }
          else say('Missile hit! Airframe shuddering — check your hull.');
        }
      } else {
        state.inboundCooldown -= dt;
        const anyAlive = enemies.some((e) => !e.dead);
        if (state.inboundCooldown <= 0 && anyAlive && state.kills < KILLS_TO_CLEAR) {
          state.inbound = { t: 3.4 };
          const shooter = enemies.find((e) => !e.dead);
          if (shooter) shooter.muzzle = 0.3;
        }
      }
    } else if (state.inbound) {
      state.inbound = null;
    }
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
    if (enemyTimer <= 0 && enemies.length < 3 && state.kills < KILLS_TO_CLEAR) {
      spawnEnemy();
      enemyTimer = 4.2;
    }
    for (const e of enemies) {
      e.t += dt;
      if (e.dead) { e.alt -= 30 * dt; e.z += e.vz * dt; e.smoke += dt; continue; }
      // A weave on top of the crossing run: they do not fly parade-straight.
      e.x += (e.vx + Math.sin(e.t * 1.7) * 11) * dt;
      e.alt += Math.sin(e.t * 2.3) * 5.5 * dt;
      e.z += e.vz * dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
    }
    // Cull machines that have crossed far behind or fallen away.
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      if (enemies[i].z < state.z - 260 || enemies[i].alt < -40) enemies.splice(i, 1);
    }
    if (state.kills >= KILLS_TO_CLEAR || dogfightClock > 120) {
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
      enemy.boom = 1;
      state.kills += 1;
      state.score += 340;
      state.slowmo = 0.6;
      say(state.kills >= KILLS_TO_CLEAR
        ? 'That is the last of them — the sky is yours!'
        : `Splash one bandit! ${state.kills} of ${KILLS_TO_CLEAR} down — they are shooting back, mind your hull.`);
    }
  }

  return { state, enemies, step, hitEnemy, say };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function wrapDegrees(d) { const w = ((d + 180) % 360 + 360) % 360 - 180; return w; }
export function mph(ms) { return Math.round(ms * 2.237); }
export function knots(ms) { return Math.round(ms * 1.944); }
export function feet(m) { return Math.round(m * 3.281); }
