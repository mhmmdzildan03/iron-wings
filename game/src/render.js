// IRON WINGS — renderer. PixiJS draws everything; there are no image assets.
// The world is painted as a layered 2.5D scene (sunset sky, parallax cloud,
// sea and patchwork coast scrolling below, true projected rings, bandits and
// the home strip), and over it sits a fully analogue 1944 cockpit: riveted
// metal, leather padding, four live round gauges, a reflector gunsight and a
// stick that leans with your hand. No digital HUD — the only lettering is
// stencilled placards and a chalked mission note, as a real panel would have.

import { PHASE, RING_COURSE, RING_RADIUS, HOME_Z, STRIP, KILLS_TO_CLEAR, clamp, mph, feet } from './flight.js';

export const CAMERA = { COCKPIT: 'cockpit', CHASE: 'chase' };

export const SCREEN = { TITLE: 'title', PLAY: 'play', PAUSED: 'paused', OVER: 'over' };
export const W = 1280;
export const H = 720;
const CX = W / 2;
const FOCAL = 560;

const SKY_BANDS = ['#27355e', '#35507c', '#4a6d99', '#6d8fb4', '#93aec6', '#c2b49b', '#eec27f', '#f9a95f'];
const SEA_DEEP = 0x2c5d7c;
const SEA_LIGHT = 0x4d86a3;
const LAND = [0x77894a, 0x8a9a52, 0xa8a05e, 0x6d8148, 0x97a05a, 0xb5a468];

/** Project a world point (lateral x, height alt, distance z) into screen space for this frame. */
export function project(state, x, alt, z) {
  const rel = z - state.z;
  if (rel < 12) return null;
  const scale = FOCAL / rel;
  const horizon = horizonY(state);
  return {
    x: CX + (x - state.x) * scale - state.roll * rel * 0.06,
    y: horizon + (state.alt - alt) * scale + state.pitch * 40 * scale * 0.2,
    scale,
    rel,
  };
}

export function horizonY(state) {
  return 318 - state.pitch * 130 + clamp(state.alt * 0.012, 0, 26);
}

export function createRenderer(container) {
  const app = new PIXI.Application({ width: W, height: H, antialias: true, backgroundColor: 0x1a1410 });
  app.view.style.width = '100%';
  app.view.style.height = '100%';
  container.appendChild(app.view);

  const world = new PIXI.Graphics();
  const fx = new PIXI.Graphics();
  const cockpit = new PIXI.Graphics();
  app.stage.addChild(world, fx, cockpit);

  const stencil = { fontFamily: 'Georgia, "Times New Roman", serif', fill: 0xf3e5c3 };
  const mkText = (size, opts = {}) => {
    const t = new PIXI.Text('', { ...stencil, fontSize: size, ...opts });
    app.stage.addChild(t);
    return t;
  };
  const noteText = mkText(21, { fill: 0xffe9b0, stroke: 0x2a1c08, strokeThickness: 3 });
  noteText.anchor.set(0.5, 0); noteText.position.set(CX, 14);
  const plateText = mkText(19, { fill: 0xffe9b0, stroke: 0x1c1206, strokeThickness: 3 });
  plateText.position.set(18, 42);
  const plate2Text = mkText(17, { fill: 0xd8c491, stroke: 0x1c1206, strokeThickness: 3 });
  plate2Text.position.set(18, 66);
  // Objective marker lettering, pinned over the ring / strip / bandit ahead.
  const markerText = mkText(19, { fill: 0xffc93c, stroke: 0x2a1c08, strokeThickness: 4, fontWeight: 'bold' });
  markerText.anchor.set(0.5, 1);
  const valSpeed = mkText(17, { fill: 0xffe9b0 }); valSpeed.anchor.set(0.5, 0);
  const valAlt = mkText(17, { fill: 0xffe9b0 }); valAlt.anchor.set(0.5, 0);
  const valHdg = mkText(17, { fill: 0xffe9b0 }); valHdg.anchor.set(0.5, 0);
  const titleText = mkText(92, { fill: 0xf7d774, stroke: 0x3a2405, strokeThickness: 6, fontWeight: 'bold', letterSpacing: 6 });
  titleText.anchor.set(0.5); titleText.position.set(CX, 208);
  const subText = mkText(30, { fill: 0xfff3cf, letterSpacing: 10 });
  subText.anchor.set(0.5); subText.position.set(CX, 272);
  const promptText = mkText(24, { fill: 0xffffff, stroke: 0x1c1206, strokeThickness: 4 });
  promptText.anchor.set(0.5); promptText.position.set(CX, 330);
  const controlsText = mkText(20, { fill: 0xf0e2bc, align: 'center', lineHeight: 30 });
  controlsText.anchor.set(0.5, 0); controlsText.position.set(CX, 372);
  const endTitle = mkText(54, { fill: 0xf7d774, stroke: 0x3a2405, strokeThickness: 5, fontWeight: 'bold' });
  endTitle.anchor.set(0.5); endTitle.position.set(CX, 190);
  const endLines = mkText(24, { fill: 0xfff3cf, align: 'center', lineHeight: 36 });
  endLines.anchor.set(0.5, 0); endLines.position.set(CX, 250);
  const pauseText = mkText(44, { fill: 0xfff3cf, stroke: 0x1c1206, strokeThickness: 5, fontWeight: 'bold' });
  pauseText.anchor.set(0.5); pauseText.position.set(CX, 240);

  // Deterministic cloud bank: fixed seeds so screenshots are reproducible.
  const clouds = [];
  for (let i = 0; i < 18; i += 1) {
    clouds.push({ u: (i * 0.173 + 0.06) % 1, v: (i * 0.37) % 0.62, s: 0.55 + (i % 5) * 0.22, d: 0.35 + (i % 4) * 0.2 });
  }
  const particles = [];
  const tracers = [];
  let flash = 0;

  function spawnTracers(state) {
    for (let i = 0; i < 3; i += 1) {
      tracers.push({
        x: CX + (Math.random() - 0.5) * 26, y: 300 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 30, life: 0.16,
        fromX: CX + (i % 2 === 0 ? -150 : 150), fromY: 520,
      });
    }
    flash = 1;
  }

  function burst(x, y, colour, n, spread) {
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x, y, vx: (Math.random() - 0.5) * spread, vy: (Math.random() - 0.5) * spread - 20,
        life: 0.7 + Math.random() * 0.7, max: 1.4, colour, size: 3 + Math.random() * 7,
      });
    }
  }

  // ---------------------------------------------------------------- world
  function drawWorld(g, state, enemies, now) {
    const hy = horizonY(state);
    const rollShift = state.roll * 110;
    // Sunset sky in horizontal bands down to the horizon line.
    for (let i = 0; i < SKY_BANDS.length; i += 1) {
      const y0 = (hy / SKY_BANDS.length) * i;
      g.beginFill(PIXI.utils.string2hex(SKY_BANDS[i]), 1);
      g.drawRect(0, y0, W, hy / SKY_BANDS.length + 2);
      g.endFill();
    }
    // Sun, low over the sea, with two halos. Diving toward it washes the glass.
    const sunX = CX + 265 - state.heading * 3.2;
    const sunY = hy - 96 + state.pitch * 46;
    g.beginFill(0xffdf9e, 0.16); g.drawCircle(sunX, sunY, 120); g.endFill();
    g.beginFill(0xffca66, 0.3); g.drawCircle(sunX, sunY, 74); g.endFill();
    g.beginFill(0xffe9ad, 1); g.drawCircle(sunX, sunY, 44); g.endFill();

    // Clouds: fat ellipse clusters, nearer ones lower and faster (parallax).
    for (const c of clouds) {
      const drift = (state.z * 0.004 * c.d + now * 0.004 * c.d) % 1.25;
      const x = (c.u - drift + 1.25) % 1.25 * (W + 260) - 130 - state.roll * 30 * c.d;
      const y = 36 + c.v * (hy - 90) + Math.sin(now * 0.3 + c.u * 9) * 3;
      const s = c.s * (0.8 + c.d * 0.5);
      g.beginFill(0xffffff, 0.16 + c.d * 0.1);
      g.drawEllipse(x, y + 8 * s, 92 * s, 24 * s);
      g.endFill();
      g.beginFill(0xfff6e6, 0.5 + c.d * 0.3);
      g.drawEllipse(x - 30 * s, y, 58 * s, 21 * s);
      g.drawEllipse(x + 8 * s, y - 10 * s, 66 * s, 26 * s);
      g.drawEllipse(x + 44 * s, y + 2 * s, 50 * s, 18 * s);
      g.endFill();
      g.beginFill(0xe8a56b, 0.35);
      g.drawEllipse(x + 4 * s, y + 10 * s, 70 * s, 12 * s);
      g.endFill();
    }

    // Far mountain ranges on the horizon: two hazy layers, snow on the high
    // one, drifting only a touch with heading — distance you can feel.
    const mShift = -state.heading * 1.4 + rollShift * 0.1;
    g.beginFill(0x8d7d8f, 0.55);
    g.drawPolygon([-40 + mShift, hy, 120 + mShift, hy - 88, 260 + mShift, hy - 30, 420 + mShift, hy - 104, 580 + mShift, hy - 26, 760 + mShift, hy - 76, 940 + mShift, hy - 20, 1120 + mShift, hy - 92, 1300 + mShift, hy]);
    g.endFill();
    g.beginFill(0xf4ece2, 0.8);
    g.drawPolygon([392 + mShift, hy - 92, 420 + mShift, hy - 104, 448 + mShift, hy - 90, 428 + mShift, hy - 84, 420 + mShift, hy - 94, 410 + mShift, hy - 84]);
    g.drawPolygon([1092 + mShift, hy - 80, 1120 + mShift, hy - 92, 1148 + mShift, hy - 78, 1128 + mShift, hy - 72, 1120 + mShift, hy - 84, 1110 + mShift, hy - 72]);
    g.endFill();
    g.beginFill(0x6d5a63, 0.75);
    g.drawPolygon([-40 + mShift * 1.6, hy, 200 + mShift * 1.6, hy - 44, 360 + mShift * 1.6, hy - 12, 560 + mShift * 1.6, hy - 52, 760 + mShift * 1.6, hy - 10, 980 + mShift * 1.6, hy - 40, 1180 + mShift * 1.6, hy - 8, 1320 + mShift * 1.6, hy]);
    g.endFill();
    // Horizon haze: a warm breath of mist where sky meets earth and sea.
    for (let i = 0; i < 3; i += 1) {
      g.beginFill(0xffd9a0, 0.1);
      g.drawRect(0, hy - 12 - i * 9, W, 10);
      g.endFill();
    }

    drawGround(g, state, hy, rollShift);
    drawRunway(g, state);
    drawRings(g, state, now);
    for (const e of enemies) drawEnemy(g, state, e, now);
    drawFlak(g, state);
    // Speed streaks rushing past the canopy sides, out in the world where
    // they belong — drawn before the cockpit so the frame stays clean.
    if (!state.onGround && state.speed > 40) {
      g.lineStyle(2, 0xffffff, 0.3);
      for (let i = 0; i < 6; i += 1) {
        const yy = 90 + ((i * 97 + now * 620) % 330);
        const len = 26 + state.speed * 0.45;
        const xx = i % 2 === 0 ? 120 + (i * 31) % 130 : W - 250 + (i * 31) % 130;
        g.moveTo(xx, yy); g.lineTo(xx + (i % 2 === 0 ? -len : len) * 0.3, yy + len * 0.35);
      }
      g.lineStyle(0);
    }
  }

  function drawGround(g, state, hy, rollShift) {
    const groundH = H - hy;
    // Sea on the left of the coastline, patchwork fields on the right.
    const coastTop = 430 - state.heading * 2.4 + rollShift * 0.2;
    const coastBot = 700 - state.x * 0.35 + rollShift * 0.4;
    g.beginFill(SEA_DEEP, 1);
    g.drawPolygon([0, hy, coastTop, hy, coastBot, H, 0, H]);
    g.endFill();
    g.beginFill(0x9aa356, 1);
    g.drawPolygon([coastTop, hy, W, hy, W, H, coastBot, H]);
    g.endFill();
    // Field patchwork scrolling toward the viewer as distance passes.
    const rows = 7;
    for (let r = 0; r < rows; r += 1) {
      const t0 = ((r + (state.z % 260) / 260) / rows);
      const y0 = hy + t0 * t0 * groundH;
      const y1 = hy + Math.pow((r + 1 + (state.z % 260) / 260) / rows, 2) * groundH;
      if (y0 > H) continue;
      for (let c = 0; c < 4; c += 1) {
        const fx0 = coastBot + (c / 4) * (W - coastBot + 200) + ((r % 2) * 60 - state.x * 0.22 * t0);
        g.beginFill(LAND[(r * 4 + c) % LAND.length], 0.9);
        g.drawRect(fx0, y0, (W - coastBot + 200) / 4 - 6, Math.max(2, y1 - y0 - 3));
        g.endFill();
      }
      // Sea glitter on the water side.
      g.lineStyle(2, 0xbfe3ef, 0.5);
      const gx = ((r * 173 + Math.floor(state.z / 3)) % 380);
      g.moveTo(gx, y0 + 4); g.lineTo(gx + 34 + r * 6, y0 + 4);
      g.lineStyle(0);
      // The sun's road on the water: a bright shimmering lane under the sun,
      // broken into dashes that crawl as the coast slides past.
      const sunLane = 880 - state.heading * 3.2;
      if (sunLane > 40 && gx < sunLane) {
        g.lineStyle(3, 0xffd98c, 0.55);
        const sx0 = sunLane - 60 + ((r * 67 + Math.floor(state.z / 5)) % 90);
        g.moveTo(sx0, y0 + 3); g.lineTo(sx0 + 26 + r * 9, y0 + 3);
        g.lineStyle(0);
      }
      // Hedgerows between the fields and pine clusters standing on them:
      // dark green bones for the patchwork, so the land reads as country.
      g.lineStyle(3, 0x44542c, 0.8);
      g.moveTo(coastBot, y0); g.lineTo(Math.min(W, coastBot + (W - coastBot + 200)), y0);
      g.lineStyle(0);
      for (let tr = 0; tr < 3; tr += 1) {
        const tx = coastBot + 60 + ((r * 211 + tr * 149 + Math.floor(state.z / 2)) % Math.max(80, W - coastBot - 90));
        const ts = 5 + t0 * 13;
        g.beginFill(0x39512e, 0.95);
        g.drawPolygon([tx - ts * 0.55, y0 + ts * 0.4, tx + ts * 0.55, y0 + ts * 0.4, tx, y0 - ts]);
        g.endFill();
      }
    }
    // Beach line where sea meets sand meets grass.
    g.lineStyle(7, 0xe6cf9a, 0.95);
    g.moveTo(coastTop, hy); g.lineTo(coastBot, H);
    g.lineStyle(3, 0xffffff, 0.5);
    g.moveTo(coastTop - 9, hy); g.lineTo(coastBot - 9, H);
    g.lineStyle(0);
    // A coast road and a village cluster on the land side, for recognisable terrain.
    g.lineStyle(5, 0x6b6250, 0.8);
    g.moveTo(coastTop + 60, hy); g.lineTo(coastBot + 130, H);
    g.lineStyle(0);
    const villageY = hy + groundH * 0.42;
    for (let i = 0; i < 6; i += 1) {
      const vx = coastBot + 120 + i * 36;
      g.beginFill(0xe8ddc4, 1); g.drawRect(vx, villageY + (i % 3) * 9, 20, 13); g.endFill();
      g.beginFill(0x9c4a32, 1); g.drawPolygon([vx - 2, villageY + (i % 3) * 9, vx + 22, villageY + (i % 3) * 9, vx + 10, villageY - 8 + (i % 3) * 9]); g.endFill();
    }
  }

  /** Flak bursts: a hot orange heart for a blink, then a dirty grey puff that hangs and thins. */
  function drawFlak(g, state) {
    for (const f of state.flak) {
      const p = project(state, f.x, f.alt, f.z);
      if (!p) continue;
      const r = (7 + f.age * 15) * clamp(p.scale, 0.4, 2.2);
      if (f.age < 0.22) {
        g.beginFill(0xffa63e, 0.95); g.drawCircle(p.x, p.y, r * 0.55); g.endFill();
        g.beginFill(0xffe9a8, 0.95); g.drawCircle(p.x, p.y, r * 0.28); g.endFill();
      }
      const fade = clamp(1 - f.age / 2.6, 0, 1) * 0.55;
      g.beginFill(0x3d3a38, fade);
      g.drawCircle(p.x, p.y, r);
      g.drawCircle(p.x - r * 0.6, p.y + r * 0.25, r * 0.7);
      g.drawCircle(p.x + r * 0.62, p.y + r * 0.2, r * 0.66);
      g.drawCircle(p.x + r * 0.1, p.y - r * 0.5, r * 0.6);
      g.endFill();
    }
  }

  function drawRunwayShape(g, state, relZ, lateral) {
    const near = project(state, lateral, 0, state.z + Math.max(relZ, 30));
    const far = project(state, lateral, 0, state.z + relZ + STRIP.length);
    if (!near || !far) return;
    const wN = STRIP.width * near.scale * 0.5;
    const wF = Math.max(2, STRIP.width * far.scale * 0.5);
    g.beginFill(0x55534e, 1);
    g.drawPolygon([near.x - wN, near.y, near.x + wN, near.y, far.x + wF, far.y, far.x - wF, far.y]);
    g.endFill();
    g.lineStyle(2, 0xf5efdc, 0.9);
    for (let i = 0; i < 5; i += 1) {
      const t = i / 5;
      const px = near.x + (far.x - near.x) * t;
      const py = near.y + (far.y - near.y) * t;
      const len = 26 * near.scale * (1 - t * 0.8);
      g.moveTo(px, py); g.lineTo(px, py - len);
    }
    g.lineStyle(0);
    // Threshold bars and edge lights.
    g.beginFill(0xf5efdc, 0.95);
    g.drawRect(near.x - wN * 0.8, near.y - 4, wN * 1.6, 4);
    g.endFill();
    for (const s of [-1, 1]) {
      g.beginFill(0xffd977, 1);
      g.drawCircle(near.x + s * wN, near.y - 2, Math.max(2, 4 * near.scale * 0.2));
      g.drawCircle(far.x + s * wF, far.y, 2);
      g.endFill();
    }
  }

  function drawRunway(g, state) {
    if (state.phase === PHASE.TAKEOFF) {
      // The strip stretches ahead of the nose; you are sitting on its near end.
      drawRunwayShape(g, state, 60 - state.z, 0);
    } else if (state.phase === PHASE.RETURN || state.phase === PHASE.LANDED) {
      const rel = HOME_Z - state.z;
      if (rel > -100 && rel < 4200) drawRunwayShape(g, state, rel, 0);
    }
  }

  function drawRings(g, state, now) {
    for (let i = state.ringIndex; i < Math.min(state.ringIndex + 2, RING_COURSE.length); i += 1) {
      const ring = RING_COURSE[i];
      const p = project(state, ring.x, ring.alt, ring.z);
      if (!p) continue;
      const r = RING_RADIUS * p.scale;
      if (r < 6 || r > 900) continue;
      const isNext = i === state.ringIndex;
      const pulse = isNext ? 0.75 + Math.sin(now * 4) * 0.25 : 0.4;
      g.lineStyle(Math.max(3, 9 * p.scale * 0.14), isNext ? 0xffc93c : 0xd9a441, pulse);
      g.drawCircle(p.x, p.y, r);
      g.lineStyle(Math.max(1, 3 * p.scale * 0.14), 0xfff0b3, pulse * 0.9);
      g.drawCircle(p.x, p.y, r * 0.92);
      g.lineStyle(0);
      if (state.ringFlash > 0 && isNext) {
        g.beginFill(0xffe98a, state.ringFlash * 0.25);
        g.drawCircle(p.x, p.y, r);
        g.endFill();
      }
    }
  }

  function drawEnemy(g, state, e, now) {
    const p = project(state, e.x, e.alt, e.z);
    if (!p) return;
    const s = clamp(p.scale * 0.16, 0.12, 2.6);
    const x = p.x, y = p.y;
    // A wreck spins as it falls: rotate every point of the silhouette around
    // its centre by an angle that grows with its smoke trail.
    const spin = e.dead ? e.smoke * 2.6 : Math.sin(now * 2 + e.z) * 0.06;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const R = (px, py) => [x + px * cs - py * sn, y + px * sn + py * cs];
    const poly = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push(...R(pts[i], pts[i + 1])); return out; };
    g.lineStyle(0);
    // Wing, fuselage, tail — a dark patrol silhouette against the sunset.
    g.beginFill(e.hitFlash > 0 ? 0xff6b4a : 0x3d4438, 1);
    g.drawPolygon(poly([-74 * s, 6 * s, 74 * s, 6 * s, 30 * s, -4 * s, -30 * s, -4 * s]));
    g.drawEllipse(x, y - 2 * s, 46 * s, 11 * s);
    g.drawPolygon(poly([-8 * s, -8 * s, 10 * s, -26 * s, 20 * s, -8 * s]));
    g.endFill();
    g.beginFill(0x22281f, 1);
    g.drawEllipse(x + 6 * s, y - 10 * s, 15 * s, 6 * s); // canopy
    g.endFill();
    // Propeller blur and a blunt nose.
    g.lineStyle(3 * s, 0x14161a, 0.55);
    g.moveTo(x - 46 * s, y - 16 * s); g.lineTo(x - 46 * s, y + 12 * s);
    g.lineStyle(0);
    if (e.dead || e.hp < 3) {
      g.beginFill(0x2b2b2b, e.dead ? 0.5 : 0.3);
      g.drawCircle(x + 26 * s, y - 14 * s, (e.dead ? 16 : 8) * s);
      g.drawCircle(x + 40 * s, y - 24 * s, (e.dead ? 22 : 11) * s);
      g.endFill();
    }
    if (e.dead) {
      // Fire in the wreck, breathing as it tumbles down.
      g.beginFill(0xff8c3a, 0.75 + Math.sin(now * 31) * 0.2);
      g.drawCircle(x + 10 * s, y - 6 * s, 7 * s);
      g.endFill();
      if (Math.random() < 0.5) burst(x, y, 0xff8c3a, 2, 60);
    }
    // Return fire: when her guns flash, two tracer lanes reach past the camera.
    if (e.muzzle > 0) {
      g.lineStyle(3, 0xffb066, 0.85);
      g.moveTo(x - 20 * s, y); g.lineTo(x - 90, H + 40);
      g.moveTo(x + 20 * s, y); g.lineTo(x + 130, H + 40);
      g.lineStyle(1, 0xfff0d0, 0.9);
      g.moveTo(x - 20 * s, y); g.lineTo(x - 90, H + 40);
      g.moveTo(x + 20 * s, y); g.lineTo(x + 130, H + 40);
      g.lineStyle(0);
      g.beginFill(0xffd977, 1); g.drawCircle(x, y, 4 * s + 2); g.endFill();
    }
  }

  // ---------------------------------------------------------- own aircraft
  /**
   * The player's fighter seen from behind and above — the chase camera.
   * Drawn whole: olive fuselage, broad wings that bank with the roll, tail,
   * canopy glass, a blurred prop at the far end and her shadow racing along
   * the ground below. Wing guns throw tracer lanes to the vanishing point.
   */
  function drawOwnPlane(g, state, now) {
    const px = CX - state.roll * 38;
    const py = (state.onGround ? 492 : 428) + state.pitch * 24;
    const k = 1.35;
    const spin = -state.roll * 0.55;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const R = (lx, ly) => [px + lx * cs - ly * sn, py + lx * sn + ly * cs];
    const poly = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push(...R(pts[i], pts[i + 1])); return out; };

    // Her shadow on the earth, tighter and darker the lower she flies.
    const shScale = clamp(1 - state.alt * 0.004, 0.35, 1);
    g.beginFill(0x1e2416, 0.28 * shScale + 0.08);
    g.drawEllipse(px + state.alt * 0.35, 694, 150 * shScale + 30, 15 * shScale + 4);
    g.endFill();

    if (state.firing) {
      for (const sgn of [-1, 1]) {
        const [gx, gy] = R(sgn * 62 * k, -4 * k);
        g.lineStyle(3, 0xffe98a, 0.85);
        g.moveTo(gx, gy); g.lineTo(CX + sgn * 9, 298);
        g.lineStyle(1, 0xffffff, 0.9);
        g.moveTo(gx, gy); g.lineTo(CX + sgn * 9, 298);
        g.lineStyle(0);
        g.beginFill(0xffe08a, 1); g.drawCircle(gx, gy, 5); g.endFill();
      }
    }
    // Tail feathers first, then ONE main wing straight across behind the
    // fuselage, so the silhouette reads as a single aeroplane.
    g.beginFill(0x424a33, 1);
    g.drawPolygon(poly([-52 * k, 52 * k, 52 * k, 52 * k, 42 * k, 64 * k, -42 * k, 64 * k]));
    g.drawPolygon(poly([-158 * k, -4 * k, 158 * k, -4 * k, 148 * k, 12 * k, -148 * k, 12 * k]));
    g.endFill();
    // Wing roundels: a plain ring marking of our own, no one's insignia copied.
    for (const sgn of [-1, 1]) {
      const [rx, ry] = R(sgn * 102 * k, 4 * k);
      g.beginFill(0xd8d3c2, 0.9); g.drawCircle(rx, ry, 9 * k); g.endFill();
      g.beginFill(0x5a6f9e, 0.95); g.drawCircle(rx, ry, 5.5 * k); g.endFill();
    }
    // Fuselage: a teardrop — round at the cowling, tapering to the tail.
    g.beginFill(0x4a5138, 1);
    g.drawPolygon(poly([
      0, -72 * k, 16 * k, -58 * k, 24 * k, -30 * k, 25 * k, 0,
      19 * k, 34 * k, 10 * k, 58 * k, 0, 68 * k,
      -10 * k, 58 * k, -19 * k, 34 * k, -25 * k, 0, -24 * k, -30 * k, -16 * k, -58 * k,
    ]));
    g.endFill();
    g.beginFill(0x59634a, 0.8);
    g.drawEllipse(px, py - 8 * k, 6.5 * k, 44 * k);
    g.endFill();
    // Canopy: a modest teardrop of slate glass, well forward.
    const [cxp, cyp] = R(0, -30 * k);
    g.beginFill(0x5d7684, 1); g.drawEllipse(cxp, cyp, 9.5 * k, 15 * k); g.endFill();
    g.beginFill(0xcfe2ea, 0.85); g.drawEllipse(cxp - 2.5 * k, cyp - 4 * k, 3.5 * k, 6.5 * k); g.endFill();
    // Propeller: a pale blurred band at the nose, strobing with rpm.
    const [nx, ny] = R(0, -76 * k);
    g.lineStyle(8, 0x22201c, 0.3 + state.throttle * 0.22);
    g.moveTo(nx - 36 * k, ny); g.lineTo(nx + 36 * k, ny);
    g.lineStyle(0);
    g.beginFill(0x2c2a24, 1); g.drawCircle(nx, ny, 4.5 * k); g.endFill();
    // WEP exhausts breathe blue flame either side of the cowling.
    if (state.wep) {
      for (const sgn of [-1, 1]) {
        const [ex, ey] = R(sgn * 15 * k, -52 * k);
        g.beginFill(0x7fb2ff, 0.75); g.drawEllipse(ex, ey, 4 * k, 9 * k); g.endFill();
      }
    }
    // A shot-up engine trails smoke behind her.
    if (state.hull < 70 && !state.onGround && Math.random() < 0.4) {
      burst(px + (Math.random() - 0.5) * 20, py + 60, state.hull < 35 ? 0x2b2b2b : 0x6a6a6a, 2, 26);
    }
    void now;
  }

  /**
   * The chase view's furniture: just a low leather ledge along the bottom —
   * the gauges float over the world the way a bush pilot's panel-top
   * instruments do, so the scenery (and a runway on final) stays visible.
   */
  function drawChaseStrip(g, state, now) {
    g.beginFill(0x26241f, 0.96);
    g.drawPolygon([0, H, 0, 676, W, 676, W, H]);
    g.endFill();
    g.lineStyle(7, 0x6d4a2f, 1);
    g.moveTo(0, 678); g.lineTo(W, 678);
    g.lineStyle(0);
    drawGauges(g, state, 0, 0);
    void now;
  }

  // -------------------------------------------------------------- cockpit
  function rivets(g, points) {
    g.beginFill(0x8f8a7c, 1);
    for (const [x, y] of points) g.drawCircle(x, y, 3);
    g.endFill();
    g.beginFill(0x2c2a24, 1);
    for (const [x, y] of points) g.drawCircle(x + 1, y + 1, 1.2);
    g.endFill();
  }

  function drawCockpit(g, state, now) {
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 7 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 5 : 0;
    const lean = -state.roll * 16;
    const ox = shakeX + lean * 0.3, oy = shakeY;

    // Canopy frame: slim raked pillars, side posts and a top rail, olive metal.
    g.beginFill(0x3a3d33, 1);
    g.drawPolygon([118 + ox, 0, 172 + ox, 0, 330 + ox, 500 + oy, 262 + ox, 516 + oy]);
    g.drawPolygon([W - 118 + ox, 0, W - 172 + ox, 0, W - 330 + ox, 500 + oy, W - 262 + ox, 516 + oy]);
    g.drawRect(0, 0, 40, H);
    g.drawRect(W - 40, 0, 40, H);
    g.drawRect(0, 0, W, 30);
    g.endFill();
    g.beginFill(0x2e3029, 1);
    g.drawPolygon([172 + ox, 0, 196 + ox, 0, 344 + ox, 498 + oy, 330 + ox, 500 + oy]);
    g.drawPolygon([W - 172 + ox, 0, W - 196 + ox, 0, W - 344 + ox, 498 + oy, W - 330 + ox, 500 + oy]);
    g.endFill();
    // Leather padding along the cockpit rim.
    g.lineStyle(13, 0x6d4a2f, 1);
    g.moveTo(196 + ox, 512 + oy);
    g.bezierCurveTo(420 + ox, 452 + oy, 860 + ox, 452 + oy, 1084 + ox, 512 + oy);
    g.lineStyle(0);
    // Rear-view mirror on the top rail.
    g.beginFill(0x22241f, 1); g.drawRoundedRect(CX - 52 + ox, 32, 104, 34, 6); g.endFill();
    g.beginFill(0x9fc4d4, 0.75); g.drawRoundedRect(CX - 47 + ox, 36, 94, 26, 4); g.endFill();

    // Main panel: a shallow arc of dark metal across the bottom of the view.
    g.beginFill(0x26241f, 1);
    g.drawPolygon([
      0, H, 0, 512 + oy, 196 + ox, 520 + oy, 330 + ox, 540 + oy,
      950 + ox, 540 + oy, 1084 + ox, 520 + oy, W, 512 + oy, W, H,
    ]);
    g.endFill();
    g.beginFill(0x33302a, 1);
    g.drawPolygon([0, 512 + oy, 196 + ox, 520 + oy, 330 + ox, 540 + oy, 950 + ox, 540 + oy, 1084 + ox, 520 + oy, W, 512 + oy, W, 548 + oy, 0, 548 + oy]);
    g.endFill();
    rivets(g, [[30, 540], [150, 545], [1150, 545], [1250, 540], [70, 330], [1210, 330], [330, 560], [950, 560]].map(([x, y]) => [x + ox, y + oy * 0.4]));

    // Propeller blur washing across the nose, felt more than seen: two soft
    // blade streaks sweeping the arc, never a hard disc outline.
    const propA = 0.03 + state.throttle * 0.04;
    g.lineStyle(15, 0x1c1a16, propA);
    g.arc(CX + ox, 322 + oy, 168, now * 22, now * 22 + 1.1);
    g.arc(CX + ox, 322 + oy, 168, now * 22 + 3.4, now * 22 + 4.5);
    g.lineStyle(0);

    drawGunsight(g, state, ox, oy, now);
    drawGauges(g, state, ox, oy);
    drawStick(g, state, ox, oy);

    // Muzzle light bouncing off the panel while the guns fire: soft nested
    // ellipses, brightest at the panel's top edge, fading as they grow.
    if (flash > 0.05) {
      for (let i = 3; i >= 1; i -= 1) {
        g.beginFill(0xffb84d, flash * 0.05);
        g.drawEllipse(CX + ox, 585 + oy, 190 * i, 42 * i);
        g.endFill();
      }
      g.beginFill(0xffe08a, flash * 0.8);
      g.drawCircle(CX - 168 + ox, 498 + oy, 13 * flash + 4);
      g.drawCircle(CX + 168 + ox, 498 + oy, 13 * flash + 4);
      g.endFill();
    }
    // Battle damage, felt from inside: smoke curling past the panel when the
    // engine is hit, and a star of cracks in the glass when she is hit hard.
    if (state.hull < 70 && !state.onGround) {
      const wisps = state.hull < 35 ? 5 : 3;
      for (let i = 0; i < wisps; i += 1) {
        const wx = 480 + ((i * 173 + now * 60) % 320);
        const wy = 520 - ((now * 46 + i * 61) % 130);
        g.beginFill(0x2b2b2b, 0.16 + (70 - state.hull) * 0.004);
        g.drawCircle(wx + ox, wy + oy, 15 + i * 5);
        g.endFill();
      }
    }
    if (state.hull < 40) {
      g.lineStyle(2, 0xe8f2f6, 0.65);
      const cxk = 905 + ox, cyk = 150 + oy;
      g.moveTo(cxk, cyk); g.lineTo(cxk + 44, cyk - 20);
      g.moveTo(cxk, cyk); g.lineTo(cxk + 58, cyk + 16);
      g.moveTo(cxk, cyk); g.lineTo(cxk + 18, cyk + 48);
      g.moveTo(cxk, cyk); g.lineTo(cxk - 30, cyk + 30);
      g.moveTo(cxk + 44, cyk - 20); g.lineTo(cxk + 74, cyk - 30);
      g.moveTo(cxk + 58, cyk + 16); g.lineTo(cxk + 88, cyk + 22);
      g.lineStyle(0);
    }
    // Sun glare on the glass when she noses down toward the light.
    const glare = clamp((-state.pitch) * 0.5 + 0.08, 0, 0.4);
    g.beginFill(0xfff2c0, glare * 0.35);
    g.drawPolygon([700, 0, W, 0, W, 300, 900, 190]);
    g.endFill();
  }

  function drawGunsight(g, state, ox, oy, now) {
    const x = CX + ox, y = 296 + oy;
    // Reflector glass, brass ring, glowing reticle.
    g.beginFill(0xbfe0ea, 0.1); g.drawCircle(x, y, 52); g.endFill();
    g.lineStyle(5, 0x8a6f35, 1); g.drawCircle(x, y, 52); g.lineStyle(0);
    g.lineStyle(2, 0xffdf8a, 0.95);
    g.drawCircle(x, y, 30);
    g.moveTo(x - 46, y); g.lineTo(x - 12, y);
    g.moveTo(x + 12, y); g.lineTo(x + 46, y);
    g.moveTo(x, y - 46); g.lineTo(x, y - 12);
    g.moveTo(x, y + 12); g.lineTo(x, y + 46);
    g.lineStyle(0);
    g.beginFill(0xffe98a, 1); g.drawCircle(x, y, 3.4); g.endFill();
    // Sight post down to the panel.
    g.beginFill(0x2c2a24, 1); g.drawRect(x - 7, y + 52, 14, 66); g.endFill();
    void now;
  }

  function gaugeFace(g, x, y, r) {
    g.beginFill(0x141310, 1); g.drawCircle(x, y, r + 7); g.endFill();
    g.lineStyle(3, 0x8a6f35, 1); g.drawCircle(x, y, r + 5); g.lineStyle(0);
    g.beginFill(0xf1e7cb, 1); g.drawCircle(x, y, r); g.endFill();
  }

  function needle(g, x, y, angle, len, colour = 0xb03a26) {
    const a = angle - Math.PI / 2;
    g.lineStyle(4, colour, 1);
    g.moveTo(x - Math.cos(a) * len * 0.25, y - Math.sin(a) * len * 0.25);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.lineStyle(0);
    g.beginFill(0x22211d, 1); g.drawCircle(x, y, 6); g.endFill();
  }

  function ticks(g, x, y, r, count, from, to) {
    g.lineStyle(2, 0x35322a, 1);
    for (let i = 0; i <= count; i += 1) {
      const a = from + (to - from) * (i / count);
      g.moveTo(x + Math.cos(a) * (r - 9), y + Math.sin(a) * (r - 9));
      g.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
    }
    g.lineStyle(0);
  }

  function drawGauges(g, state, ox, oy) {
    const spd = mph(state.speed);
    const altF = feet(state.alt);
    // Airspeed, bottom left.
    let x = 218 + ox, y = 622 + oy;
    gaugeFace(g, x, y, 52);
    ticks(g, x, y, 52, 10, Math.PI * 0.75, Math.PI * 2.25);
    needle(g, x, y, Math.PI * 0.75 + clamp(spd / 320, 0, 1) * Math.PI * 1.5, 40);
    // Artificial horizon, centre left: the ball rolls and pitches with the
    // aircraft. The earth half is the part of the disc below the tilted
    // horizon line, sampled around the rim so it never spills past the glass.
    x = 420 + ox; y = 618 + oy;
    g.beginFill(0x141310, 1); g.drawCircle(x, y, 63); g.endFill();
    g.lineStyle(3, 0x8a6f35, 1); g.drawCircle(x, y, 61); g.lineStyle(0);
    g.beginFill(0x7fb0d8, 1);
    g.drawCircle(x, y, 54);
    g.endFill();
    const rollA = -state.roll * 0.9;
    const pitchOff = clamp(state.pitch * 22, -18, 18);
    const downX = Math.sin(rollA), downY = Math.cos(rollA);
    const earth = [];
    for (let i = 0; i <= 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      const px = Math.cos(a) * 54, py = Math.sin(a) * 54;
      if (px * downX + py * downY > pitchOff) earth.push(x + px, y + py);
    }
    // Close the earth polygon along the horizon chord.
    const chord = Math.sqrt(Math.max(0, 54 * 54 - pitchOff * pitchOff));
    const alongX = Math.cos(rollA), alongY = -Math.sin(rollA);
    const cxp = x + downX * pitchOff, cyp = y + downY * pitchOff;
    if (earth.length > 2) {
      g.beginFill(0x7a5c38, 1);
      g.drawPolygon([...earth, cxp - alongX * chord, cyp - alongY * chord, cxp + alongX * chord, cyp + alongY * chord]);
      g.endFill();
    }
    g.lineStyle(2, 0xf1e7cb, 0.9);
    g.moveTo(cxp - alongX * chord, cyp - alongY * chord);
    g.lineTo(cxp + alongX * chord, cyp + alongY * chord);
    g.lineStyle(0);
    g.lineStyle(3, 0xffe98a, 1);
    g.moveTo(x - 26, y); g.lineTo(x - 8, y); g.moveTo(x + 8, y); g.lineTo(x + 26, y);
    g.moveTo(x, y - 3); g.lineTo(x, y + 3);
    g.lineStyle(0);
    // Altimeter, centre right, with a little hundreds drum.
    x = 858 + ox; y = 618 + oy;
    gaugeFace(g, x, y, 52);
    ticks(g, x, y, 52, 10, -Math.PI / 2, Math.PI * 1.5);
    needle(g, x, y, (altF % 1000) / 1000 * Math.PI * 2, 38);
    needle(g, x, y, (altF % 10000) / 10000 * Math.PI * 2, 28, 0x35322a);
    // Compass, bottom right: the card turns under a fixed lubber line.
    x = 1060 + ox; y = 622 + oy;
    gaugeFace(g, x, y, 52);
    const hdg = ((state.heading % 360) + 360) % 360;
    for (let i = 0; i < 12; i += 1) {
      const a = ((i * 30 - hdg) * Math.PI) / 180 - Math.PI / 2;
      g.lineStyle(i % 3 === 0 ? 3 : 1, 0x35322a, 1);
      g.moveTo(x + Math.cos(a) * 38, y + Math.sin(a) * 38);
      g.lineTo(x + Math.cos(a) * 47, y + Math.sin(a) * 47);
      g.lineStyle(0);
    }
    g.beginFill(0xb03a26, 1);
    g.drawPolygon([x - 6, y - 52, x + 6, y - 52, x, y - 40]);
    g.endFill();
    needle(g, x, y, 0, 0); // hub only; the card does the moving
    // RPM gauge, small, tucked left of the stick where the panel has room.
    x = 548 + ox; y = 652 + oy;
    gaugeFace(g, x, y, 32);
    ticks(g, x, y, 32, 6, Math.PI * 0.75, Math.PI * 2.25);
    needle(g, x, y, Math.PI * 0.75 + state.throttle * (state.wep ? 1.62 : 1.5), 22, 0x35322a);
    if (state.wep) { g.beginFill(0xd8472e, 1); g.drawCircle(x + 20, y - 22, 5); g.endFill(); }

    // Stencilled captions and painted value placards under each main gauge.
    valSpeed.position.set(218 + ox, 682 + oy); valSpeed.text = `${spd} MPH`;
    valAlt.position.set(858 + ox, 682 + oy); valAlt.text = `${altF} FT`;
    valHdg.position.set(1060 + ox, 682 + oy); valHdg.text = `HDG ${String(Math.round(hdg)).padStart(3, '0')}°`;
  }

  function drawStick(g, state, ox, oy) {
    const tiltX = state.roll * 26;
    const tiltY = state.pitch * 12;
    const bx = CX + ox, by = H + 6;
    g.beginFill(0x1d1b17, 1);
    g.drawPolygon([bx - 15, by, bx + tiltX - 8, by - 92 + tiltY, bx + tiltX + 8, by - 92 + tiltY, bx + 15, by]);
    g.endFill();
    g.beginFill(0x4a3520, 1);
    g.drawRoundedRect(bx + tiltX - 11, by - 128 + tiltY, 22, 42, 8);
    g.endFill();
    g.beginFill(0xd8472e, 1);
    g.drawCircle(bx + tiltX, by - 122 + tiltY, 5.5); // the firing button, under the thumb
    g.endFill();
    // Throttle lever on the left wall, sliding with power.
    const tx = 96 + ox, ty = 600 - state.throttle * 56 + oy;
    g.beginFill(0x1d1b17, 1); g.drawRoundedRect(84 + ox, 528 + oy, 22, 92, 8); g.endFill();
    g.beginFill(0x8a6f35, 1); g.drawCircle(tx, ty, 13); g.endFill();
  }

  /** Where the pilot's attention belongs, for the marker lettering. */
  function objectivePoint(state, enemies) {
    if (state.phase === PHASE.RINGS) {
      const ring = RING_COURSE[state.ringIndex];
      if (!ring) return null;
      const p = project(state, ring.x, ring.alt, ring.z);
      return p ? { ...p, label: `RING ${state.ringIndex + 1} · ${Math.round(p.rel * 3.281)} FT` } : null;
    }
    if (state.phase === PHASE.DOGFIGHT) {
      let best = null;
      for (const e of enemies) {
        if (e.dead) continue;
        const p = project(state, e.x, e.alt, e.z);
        if (p && (!best || p.rel < best.rel)) best = { ...p, label: `BANDIT · ${Math.round(p.rel * 3.281)} FT` };
      }
      return best;
    }
    if (state.phase === PHASE.RETURN) {
      const p = project(state, 0, 0, HOME_Z + 300);
      return p && p.rel > 0 ? { ...p, label: `RWY HOME · ${Math.round(p.rel * 3.281)} FT` } : null;
    }
    return null;
  }

  // ------------------------------------------------------------- screens
  function draw(state, enemies, screen, dt, now, camera = CAMERA.COCKPIT) {
    world.clear(); fx.clear(); cockpit.clear();
    drawWorld(world, state, screen === SCREEN.TITLE ? [] : enemies, now);
    // Particles and tracers live between world and cockpit.
    if (state.firing) spawnTracers(state);
    if (flash > 0) flash = Math.max(0, flash - dt * 9);
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      if (t.life <= 0) { tracers.splice(i, 1); continue; }
      fx.lineStyle(3, 0xffe98a, t.life * 5);
      fx.moveTo(t.fromX, t.fromY);
      fx.lineTo(t.x, t.y);
      fx.lineStyle(1, 0xffffff, t.life * 5);
      fx.moveTo(t.fromX, t.fromY); fx.lineTo(t.x, t.y);
      fx.lineStyle(0);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt;
      fx.beginFill(p.colour, clamp(p.life / p.max, 0, 1));
      fx.drawCircle(p.x, p.y, p.size);
      fx.endFill();
    }
    if (camera === CAMERA.CHASE && screen !== SCREEN.TITLE) {
      drawOwnPlane(fx, state, now);
      drawChaseStrip(cockpit, state, now);
    } else {
      drawCockpit(cockpit, state, now);
    }

    const inGame = screen === SCREEN.PLAY || screen === SCREEN.PAUSED;
    noteText.visible = inGame && state.messageTime > 0;
    noteText.text = state.message || '';
    plateText.visible = inGame;
    plate2Text.visible = inGame;
    if (inGame) {
      const phaseName = { takeoff: 'TAKE OFF', rings: 'RING COURSE', dogfight: 'AIR WAR — DOGFIGHT', return: 'RETURN — LAND', landed: 'LANDED', crashed: 'DOWN' }[state.phase] || '';
      plateText.text = `${phaseName}   ·   SCORE ${state.score}   ·   RINGS ${state.ringsHit}/6   ·   KILLS ${state.kills}/${KILLS_TO_CLEAR}`;
      plate2Text.text = `FUEL ${Math.round(state.fuel)} GAL   ·   HULL ${Math.round(state.hull)}%${state.hull < 45 ? ' — DAMAGED' : ''}   ·   CAM ${camera === CAMERA.CHASE ? 'CHASE' : 'COCKPIT'} (C)`;
    }
    const obj = inGame ? objectivePoint(state, enemies) : null;
    markerText.visible = Boolean(obj);
    if (obj) {
      markerText.text = obj.label;
      markerText.position.set(obj.x, obj.y - 26 / Math.max(0.4, obj.scale) - 14);
    }
    valSpeed.visible = valAlt.visible = valHdg.visible = screen !== SCREEN.TITLE;
    titleText.visible = subText.visible = promptText.visible = controlsText.visible = screen === SCREEN.TITLE;
    if (screen === SCREEN.TITLE) {
      titleText.text = 'IRON WINGS';
      subText.text = '— SKIES OF 1944 —';
      promptText.text = 'Click or press ENTER to take off';
      controlsText.text = 'MOUSE steer · W / S throttle · SPACE fire · SHIFT war emergency power · C camera\nP pause · M mute · Thread the rings, splash five bandits who shoot back, land her soft.';
    }
    pauseText.visible = screen === SCREEN.PAUSED;
    pauseText.text = '— PAUSED —';
    endTitle.visible = endLines.visible = screen === SCREEN.OVER;
    if (screen === SCREEN.OVER) {
      const landed = state.phase === PHASE.LANDED;
      endTitle.text = landed ? 'HOME FOR TEA' : 'IN THE DRINK';
      const td = state.touchdown;
      endLines.text = landed
        ? `Touchdown at ${mph(td.speed)} mph, sink ${Math.abs(td.vSpeed).toFixed(1)} m/s — ${Math.abs(td.vSpeed) < 3 ? 'a greaser!' : Math.abs(td.vSpeed) < 6 ? 'firm but fair.' : 'the undercarriage groans.'}\nRings ${state.ringsHit} of 6 · Bandits splashed ${state.kills} · Final score ${state.score}\n\nPress ENTER to fly the sortie again`
        : `The sortie ends in the sea off the coast.\nRings ${state.ringsHit} of 6 · Bandits splashed ${state.kills} · Score ${state.score}\n\nPress ENTER to try again`;
    }
  }

  /** Pre-seed a dramatic but deterministic frame for screenshots. */
  function primeExplosion(x, y) { burst(x, y, 0xff8c3a, 14, 130); burst(x, y, 0x3a3a3a, 8, 70); }

  return { app, draw, primeExplosion, burstAt: burst };
}
