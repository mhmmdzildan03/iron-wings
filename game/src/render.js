// IRON WINGS — renderer. PixiJS draws everything; there are no image assets.
// The world is painted as a layered 2.5D scene (sunset sky, parallax cloud,
// sea and patchwork coast scrolling below, true projected rings, bandits and
// the home strip), and over it sits a fully analogue 1944 cockpit: riveted
// metal, leather padding, four live round gauges, a reflector gunsight and a
// stick that leans with your hand. No digital HUD — the only lettering is
// stencilled placards and a chalked mission note, as a real panel would have.

import { PHASE, RING_COURSE, RING_RADIUS, HOME_Z, STRIP, KILLS_TO_CLEAR, clamp, knots, feet } from './flight.js';

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
  const markerText = mkText(19, { fill: 0x8affb0, stroke: 0x0a2013, strokeThickness: 4, fontWeight: 'bold' });
  markerText.anchor.set(0.5, 1);
  // Modern avionics lettering: green phosphor monospace for the HUD and MFDs.
  const mono = { fontFamily: '"Courier New", monospace', fill: 0x8affb0 };
  const mkMono = (size, opts = {}) => {
    const t = new PIXI.Text('', { ...mono, fontSize: size, ...opts });
    app.stage.addChild(t);
    return t;
  };
  const hudSpdVal = mkMono(21, { fontWeight: 'bold' }); hudSpdVal.anchor.set(0.5);
  const hudAltVal = mkMono(21, { fontWeight: 'bold' }); hudAltVal.anchor.set(0.5);
  const hudHdgVal = mkMono(20, { fontWeight: 'bold' }); hudHdgVal.anchor.set(0.5);
  const hudSys = mkMono(17, {}); hudSys.position.set(18, 688);
  const warnText = mkMono(24, { fill: 0xff5347, fontWeight: 'bold' }); warnText.anchor.set(0.5); warnText.position.set(CX, 120);
  const lockText = mkMono(17, { fill: 0xffb03a, fontWeight: 'bold' }); lockText.anchor.set(0.5, 1);
  const mfdText = mkMono(16, { fill: 0x9fe870, lineHeight: 24 }); mfdText.position.set(762, 570);
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
    drawMissiles(g, state);
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

  /** Live missiles: a white dart with a flame, and its curving smoke road behind it. */
  function drawMissiles(g, state) {
    for (const m of state.missilesLive) {
      for (let i = 0; i < m.trail.length; i += 1) {
        const tp = m.trail[i];
        const pp = project(state, tp.x, tp.alt, tp.z);
        if (!pp) continue;
        g.beginFill(0xd8d8d8, 0.22 * (1 - i / m.trail.length) + 0.04);
        g.drawCircle(pp.x, pp.y, 4.5 + i * 0.75);
        g.endFill();
      }
      const p = project(state, m.x, m.alt, m.z);
      if (!p) continue;
      const s = clamp(p.scale * 0.3, 0.15, 3.4);
      g.beginFill(0xff8c3a, 0.9); g.drawCircle(p.x, p.y + 6 * s, 5 * s); g.endFill();
      g.beginFill(0xf2f5f7, 1);
      g.drawPolygon([p.x - 3 * s, p.y - 10 * s, p.x + 3 * s, p.y - 10 * s, p.x + 2 * s, p.y + 8 * s, p.x - 2 * s, p.y + 8 * s]);
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
      g.lineStyle(Math.max(3, 9 * p.scale * 0.14), isNext ? 0x8affb0 : 0x4fae72, pulse);
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
    // A wreck spins as it falls: rotate the silhouette around its centre.
    const spin = e.dead ? e.smoke * 2.6 : Math.sin(now * 2 + e.z) * 0.06;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const R = (px2, py2) => [x + px2 * cs - py2 * sn, y + px2 * sn + py2 * cs];
    const poly = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push(...R(pts[i], pts[i + 1])); return out; };
    g.lineStyle(0);
    // Hostile jet, head-on: swept delta wings, twin fins, a long nose.
    g.beginFill(e.hitFlash > 0 ? 0xff6b4a : 0x3f464e, 1);
    g.drawPolygon(poly([-88 * s, 10 * s, -30 * s, -2 * s, 30 * s, -2 * s, 88 * s, 10 * s, 40 * s, 14 * s, -40 * s, 14 * s]));
    g.drawEllipse(x, y - 2 * s, 40 * s, 10 * s);
    g.drawPolygon(poly([-26 * s, -6 * s, -18 * s, -24 * s, -10 * s, -6 * s]));
    g.drawPolygon(poly([26 * s, -6 * s, 18 * s, -24 * s, 10 * s, -6 * s]));
    g.endFill();
    g.beginFill(0x9fc6dd, 0.9);
    g.drawEllipse(x, y - 8 * s, 11 * s, 5 * s); // canopy glint
    g.endFill();
    g.beginFill(0xc23b2a, 1);
    g.drawCircle(x - 52 * s, y + 8 * s, 3.4 * s); // wing markings
    g.drawCircle(x + 52 * s, y + 8 * s, 3.4 * s);
    g.endFill();
    if (e.dead || e.hp < 3) {
      g.beginFill(0x2b2b2b, e.dead ? 0.5 : 0.3);
      g.drawCircle(x + 26 * s, y - 14 * s, (e.dead ? 16 : 8) * s);
      g.drawCircle(x + 40 * s, y - 24 * s, (e.dead ? 22 : 11) * s);
      g.endFill();
    }
    // The kill moment: a fireball that blooms and sheds debris.
    if (e.boom > 0) {
      const br = (1 - e.boom) * 90 * s + 12 * s;
      g.beginFill(0xff8c3a, 0.55 * e.boom + 0.2); g.drawCircle(x, y, br); g.endFill();
      g.beginFill(0xffc46b, 0.75 * e.boom + 0.2); g.drawCircle(x, y, br * 0.62); g.endFill();
      g.beginFill(0xfff3cf, 0.9 * e.boom); g.drawCircle(x, y, br * 0.3); g.endFill();
      if (Math.random() < 0.6) burst(x, y, 0xff8c3a, 3, 90);
    }
    if (e.dead) {
      g.beginFill(0xff8c3a, 0.75 + Math.sin(now * 31) * 0.2);
      g.drawCircle(x + 10 * s, y - 6 * s, 7 * s);
      g.endFill();
      if (Math.random() < 0.5) burst(x, y, 0xff8c3a, 2, 60);
    }
    // Return fire: when her cannon flashes, two tracer lanes reach past the camera.
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
    // STEEL VIPER from behind-above: a modern twin-fin delta jet. Local axes:
    // nose is -y (away, up-screen), tail +y toward the camera.
    const px = CX - state.roll * 38;
    const py = (state.onGround ? 492 : 428) + state.pitch * 24;
    const k = 1.3;
    const spin = -state.roll * 0.55;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const R = (lx, ly) => [px + lx * cs - ly * sn, py + lx * sn + ly * cs];
    const poly = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push(...R(pts[i], pts[i + 1])); return out; };

    // Her shadow on the earth, tighter and darker the lower she flies.
    const shScale = clamp(1 - state.alt * 0.004, 0.35, 1);
    g.beginFill(0x1e2416, 0.28 * shScale + 0.08);
    g.drawEllipse(px + state.alt * 0.35, 694, 150 * shScale + 30, 15 * shScale + 4);
    g.endFill();

    // Flares: a fan of burning decoys spilling behind the tail, brightest at
    // release and drifting down as they burn out.
    if (state.flareT > 0) {
      const age = 1 - state.flareT;
      for (let i = 0; i < 12; i += 1) {
        const spread = (i - 5.5) * (7 + age * 26);
        const [fxp, fyp] = R(spread, 74 * k + age * 84 + ((i * i) % 7) * 6);
        const a = clamp(state.flareT, 0, 1);
        g.beginFill(0xffa63e, a * 0.9); g.drawCircle(fxp, fyp, 6 + age * 3); g.endFill();
        g.beginFill(0xfff3cf, a); g.drawCircle(fxp, fyp, 2.6); g.endFill();
      }
    }

    // Afterburner cones first (they sit behind everything): twin plumes that
    // flicker longer the harder she burns, blue heart inside orange.
    if (state.wep) {
      for (const sgn of [-1, 1]) {
        const flick = 1 + Math.sin(now * 47 + sgn * 2) * 0.16;
        const [bx, by] = R(sgn * 9 * k, 70 * k);
        const [tx, ty] = R(sgn * 9 * k, (70 + 40 * flick) * k);
        g.lineStyle(15 * k, 0xff7a2e, 0.55); g.moveTo(bx, by); g.lineTo(tx, ty);
        g.lineStyle(8 * k, 0xffc46b, 0.8); g.moveTo(bx, by); g.lineTo(tx, ty);
        g.lineStyle(4 * k, 0xbfe0ff, 0.95); g.moveTo(bx, by); g.lineTo(R(sgn * 9 * k, (70 + 30 * flick) * k)[0], R(sgn * 9 * k, (70 + 30 * flick) * k)[1]);
        g.lineStyle(0);
      }
    }

    if (state.firing) {
      for (const sgn of [-1, 1]) {
        const [gx, gy] = R(sgn * 20 * k, -38 * k);
        g.lineStyle(3, 0xffe98a, 0.85);
        g.moveTo(gx, gy); g.lineTo(CX + sgn * 9, 298);
        g.lineStyle(1, 0xffffff, 0.9);
        g.moveTo(gx, gy); g.lineTo(CX + sgn * 9, 298);
        g.lineStyle(0);
        g.beginFill(0xffe08a, 1); g.drawCircle(gx, gy, 5); g.endFill();
      }
    }

    // Delta wing: one great swept triangle either side, stabilators at the tail.
    g.beginFill(0x767f88, 1);
    g.drawPolygon(poly([-14 * k, -34 * k, -128 * k, 40 * k, -124 * k, 54 * k, -18 * k, 26 * k]));
    g.drawPolygon(poly([14 * k, -34 * k, 128 * k, 40 * k, 124 * k, 54 * k, 18 * k, 26 * k]));
    g.drawPolygon(poly([-16 * k, 48 * k, -58 * k, 62 * k, -54 * k, 72 * k, -14 * k, 66 * k]));
    g.drawPolygon(poly([16 * k, 48 * k, 58 * k, 62 * k, 54 * k, 72 * k, 14 * k, 66 * k]));
    g.endFill();
    // Missiles ride the wingtip rails, white with dark fins.
    for (const sgn of [-1, 1]) {
      if (state.missiles <= 0) break;
      const [mx, my] = R(sgn * 112 * k, 34 * k);
      g.beginFill(0xe8ecf0, 1); g.drawEllipse(mx, my, 4.5 * k, 15 * k); g.endFill();
      g.beginFill(0x3c434a, 1); g.drawPolygon(poly([sgn * 112 * k - 6 * k, 46 * k, sgn * 112 * k + 6 * k, 46 * k, sgn * 112 * k, 52 * k])); g.endFill();
    }
    // Twin fins, canted slightly outward.
    g.beginFill(0x69727b, 1);
    g.drawPolygon(poly([-24 * k, 30 * k, -13 * k, 34 * k, -15 * k, 62 * k, -26 * k, 58 * k]));
    g.drawPolygon(poly([24 * k, 30 * k, 13 * k, 34 * k, 15 * k, 62 * k, 26 * k, 58 * k]));
    g.endFill();
    // Fuselage: a long sleek spine, nose far ahead, intakes flanking it.
    g.beginFill(0x394047, 1);
    g.drawPolygon(poly([-19 * k, -8 * k, -15 * k, 22 * k, -19 * k, 24 * k, -19 * k, -6 * k]));
    g.drawPolygon(poly([19 * k, -8 * k, 15 * k, 22 * k, 19 * k, 24 * k, 19 * k, -6 * k]));
    g.endFill();
    g.beginFill(0x9aa4ad, 1);
    g.drawPolygon(poly([
      0, -98 * k, 9 * k, -70 * k, 15 * k, -34 * k, 16 * k, 6 * k,
      13 * k, 44 * k, 7 * k, 66 * k, 0, 70 * k,
      -7 * k, 66 * k, -13 * k, 44 * k, -16 * k, 6 * k, -15 * k, -34 * k, -9 * k, -70 * k,
    ]));
    g.endFill();
    g.beginFill(0xb4bec6, 0.85);
    g.drawEllipse(px, py - 16 * k, 5.5 * k, 46 * k);
    g.endFill();
    // Bubble canopy, smoked glass with a sunset streak.
    const [cxp, cyp] = R(0, -52 * k);
    g.beginFill(0x2c3e50, 1); g.drawEllipse(cxp, cyp, 8.5 * k, 16 * k); g.endFill();
    g.beginFill(0x9fc6dd, 0.8); g.drawEllipse(cxp - 2 * k, cyp - 5 * k, 3 * k, 7 * k); g.endFill();
    // Twin nozzles, dark rings at the tail.
    for (const sgn of [-1, 1]) {
      const [nx2, ny2] = R(sgn * 9 * k, 69 * k);
      g.beginFill(0x22262a, 1); g.drawCircle(nx2, ny2, 6.5 * k); g.endFill();
      g.beginFill(0x4d565e, 1); g.drawCircle(nx2, ny2, 3.5 * k); g.endFill();
    }
    // A shot-up jet trails smoke behind her.
    if (state.hull < 70 && !state.onGround && Math.random() < 0.4) {
      burst(px + (Math.random() - 0.5) * 20, py + 60, state.hull < 35 ? 0x2b2b2b : 0x6a6a6a, 2, 26);
    }
    void now;
  }


  // ------------------------------------------------------- modern avionics
  const HUD_GREEN = 0x8affb0;

  /**
   * The projected HUD, identical in both cameras: velocity tape left,
   * altitude tape right, heading strip across the top, a pitch ladder that
   * rolls with the jet, the aiming reticle, and — when the seeker works —
   * the lock diamond over its bandit, growing its arc until it burns red.
   */
  function drawHUD(g, state, enemies, now) {
    const ox = (Math.random() - 0.5) * state.shake * 7;
    const oy = (Math.random() - 0.5) * state.shake * 7;
    g.lineStyle(2, HUD_GREEN, 0.85);

    // Velocity tape (knots) on the left.
    const kt = knots(state.speed);
    g.drawRect(96 + ox, 196 + oy, 64, 236);
    for (let d = -40; d <= 40; d += 10) {
      const v = Math.round((kt + d) / 10) * 10;
      if (v < 0) continue;
      const ty = 314 + oy + (kt - v) * 1.55;
      if (ty < 204 + oy || ty > 424 + oy) continue;
      g.moveTo(132 + ox, ty); g.lineTo(150 + ox, ty);
    }
    hudSpdVal.text = `${kt}`;
    hudSpdVal.position.set(128 + ox, 314 + oy);
    g.drawRect(96 + ox, 296 + oy, 64, 36);

    // Altitude tape (feet) on the right.
    const ft = feet(state.alt);
    g.drawRect(1120 + ox, 196 + oy, 64, 236);
    for (let d = -200; d <= 200; d += 50) {
      const v = Math.round((ft + d) / 50) * 50;
      if (v < 0) continue;
      const ty = 314 + oy + (ft - v) * 0.55;
      if (ty < 204 + oy || ty > 424 + oy) continue;
      g.moveTo(1130 + ox, ty); g.lineTo(1148 + ox, ty);
    }
    hudAltVal.text = `${ft}`;
    hudAltVal.position.set(1152 + ox, 314 + oy);
    g.drawRect(1120 + ox, 296 + oy, 64, 36);

    // Heading strip across the top.
    g.drawRect(490 + ox, 64 + oy, 300, 34);
    for (let d = -30; d <= 30; d += 5) {
      const h = ((Math.round((state.heading + d) / 5) * 5) % 360 + 360) % 360;
      const tx = 640 + ox + (state.heading - (state.heading + d)) * -2.4 + (d * 2.4) * 0 + ((Math.round((state.heading + d) / 5) * 5 - (state.heading + d)) * 2.4);
      void tx;
      const px2 = 640 + ox + ((Math.round((state.heading + d) / 5) * 5 - state.heading) * 2.4);
      if (px2 < 496 + ox || px2 > 784 + ox) continue;
      g.moveTo(px2, 88 + oy); g.lineTo(px2, 96 + oy);
      void h;
    }
    hudHdgVal.text = `${String(((Math.round(state.heading) % 360) + 360) % 360).padStart(3, '0')}°`;
    hudHdgVal.position.set(640 + ox, 116 + oy);

    // Pitch ladder: bars that sink and roll with the nose.
    const ladA = -state.roll * 0.9;
    const lc = Math.cos(ladA), ls = Math.sin(ladA);
    for (const deg of [-20, -10, 10, 20]) {
      const off = (deg / 10) * 26 - state.pitch * 130;
      if (Math.abs(off) > 130) continue;
      const cxp = 640 + ox - Math.sin(ladA) * off * 0 + (-ls) * off;
      const cyp = 300 + oy + lc * off;
      const hx = lc * (deg > 0 ? 74 : 58), hy = ls * (deg > 0 ? 74 : 58);
      g.moveTo(cxp - hx, cyp - hy); g.lineTo(cxp - hx * 0.35, cyp - hy * 0.35);
      g.moveTo(cxp + hx * 0.35, cyp + hy * 0.35); g.lineTo(cxp + hx, cyp + hy);
      if (deg < 0) { g.moveTo(cxp - hx, cyp - hy); g.lineTo(cxp - hx, cyp - hy + 8); g.moveTo(cxp + hx, cyp + hy); g.lineTo(cxp + hx, cyp + hy + 8); }
    }

    // The aiming reticle: a calm green circle that warms as the seeker works.
    const lockCol = state.locked ? 0xff5347 : (state.lockProgress > 0.05 ? 0xffb03a : HUD_GREEN);
    g.lineStyle(2.5, lockCol, 0.95);
    g.drawCircle(640 + ox, 300 + oy, 27);
    g.moveTo(640 + ox - 40, 300 + oy); g.lineTo(640 + ox - 27, 300 + oy);
    g.moveTo(640 + ox + 27, 300 + oy); g.lineTo(640 + ox + 40, 300 + oy);
    g.moveTo(640 + ox, 300 + oy - 40); g.lineTo(640 + ox, 300 + oy - 27);
    g.beginFill(lockCol, 1); g.drawCircle(640 + ox, 300 + oy, 2.6); g.endFill();
    g.lineStyle(0);

    // The lock diamond rides its bandit, its arc filling toward LOCK.
    const tgt = state.lockTarget;
    if (tgt && !tgt.dead && state.phase === PHASE.DOGFIGHT) {
      const tp = project(state, tgt.x, tgt.alt, tgt.z);
      if (tp) {
        const s2 = 30;
        g.lineStyle(2.5, lockCol, 0.95);
        g.drawPolygon([tp.x, tp.y - s2, tp.x + s2, tp.y, tp.x, tp.y + s2, tp.x - s2, tp.y]);
        if (!state.locked) g.arc(tp.x, tp.y, s2 + 9, -Math.PI / 2, -Math.PI / 2 + state.lockProgress * Math.PI * 2);
        g.lineStyle(0);
        lockText.visible = true;
        lockText.text = state.locked ? 'LOCK — FOX TWO (F)' : 'TRACKING…';
        lockText.style.fill = state.locked ? 0xff5347 : 0xffb03a;
        lockText.position.set(tp.x, tp.y - s2 - 14);
      } else lockText.visible = false;
    } else lockText.visible = false;

    // Stores and burner status, bottom-left phosphor line.
    hudSys.visible = true;
    hudSys.text = `MSL ${state.missiles}   FLR ${state.flares}   AB ${state.wep ? 'ON' : 'OFF'}   GUN ${state.gunHeat > 0.92 ? 'HOT' : 'RDY'}`;
    hudSys.style.fill = state.wep ? 0xffb03a : 0x8affb0;

    // RWR: the inbound warning owns the top of the glass while it lives.
    if (state.inbound) {
      warnText.visible = Math.floor(now * 2.4) % 2 === 0;
      warnText.text = '⚠ MISSILE INBOUND — FLARES (X) ⚠';
      g.lineStyle(5, 0xff5347, warnText.visible ? 0.8 : 0.25);
      g.drawRect(10, 10, W - 20, H - 20);
      g.lineStyle(0);
    } else warnText.visible = false;
  }

  /**
   * The cockpit itself, modernised: slim canopy bows in dark composite, and
   * a low panel carrying two live MFDs — a sweeping radar scope with the
   * bandits on it, and a systems page with hull, fuel, stores and burner.
   */
  function drawPanel(g, state, enemies, now) {
    const ox = (Math.random() - 0.5) * state.shake * 6;
    const oy = (Math.random() - 0.5) * state.shake * 6;
    // Canopy bows.
    g.beginFill(0x23272c, 1);
    g.drawPolygon([0, 0, 150 + ox, 0, 215 + ox, 720, 60, 720]);
    g.drawPolygon([W, 0, 1130 + ox, 0, 1065 + ox, 720, 1220, 720]);
    g.drawPolygon([0, 0, W, 0, W, 34, 0, 40]);
    g.endFill();
    g.beginFill(0x31363d, 1);
    g.drawPolygon([560 + ox, 0, 720 + ox, 0, 706 + ox, 52, 574 + ox, 52]);
    g.endFill();
    // Panel slab and the two screens.
    g.beginFill(0x14181d, 1);
    g.drawPolygon([0, 720, 0, 560, 250 + ox, 542, 1030 + ox, 542, W, 560, W, 720]);
    g.endFill();
    g.lineStyle(2, 0x3d454e, 1);
    g.drawRect(292, 556, 250, 150);
    g.drawRect(738, 556, 250, 150);
    g.lineStyle(0);
    g.beginFill(0x0a140d, 1);
    g.drawRect(294, 558, 246, 146);
    g.drawRect(740, 558, 246, 146);
    g.endFill();

    // LEFT MFD — radar scope: rings, a rotating sweep, bandit blips.
    const rcx = 417, rcy = 631, rr = 66;
    g.lineStyle(1.5, 0x2f7a44, 0.9);
    g.drawCircle(rcx, rcy, rr);
    g.drawCircle(rcx, rcy, rr * 0.62);
    g.drawCircle(rcx, rcy, rr * 0.3);
    g.moveTo(rcx - rr, rcy); g.lineTo(rcx + rr, rcy);
    g.moveTo(rcx, rcy - rr); g.lineTo(rcx, rcy + rr);
    const sa = now * 1.9 % (Math.PI * 2);
    g.lineStyle(2.5, 0x8affb0, 0.9);
    g.moveTo(rcx, rcy); g.lineTo(rcx + Math.cos(sa) * rr, rcy + Math.sin(sa) * rr);
    g.lineStyle(0);
    g.beginFill(0x8affb0, 1);
    g.drawPolygon([rcx, rcy - 7, rcx + 5, rcy + 6, rcx - 5, rcy + 6]);
    g.endFill();
    for (const e of enemies) {
      if (e.dead) continue;
      const bx = clamp(rcx + (e.x - state.x) / 900 * rr, rcx - rr, rcx + rr);
      const by = clamp(rcy - (e.z - state.z) / 1600 * rr, rcy - rr, rcy + rr);
      g.beginFill(e === state.lockTarget ? 0xff5347 : 0xffb03a, 1);
      g.drawRect(bx - 3, by - 3, 6, 6);
      g.endFill();
    }
    if (state.inbound) {
      g.beginFill(0xff5347, Math.floor(now * 3) % 2 === 0 ? 1 : 0.3);
      g.drawCircle(rcx + rr * 0.55, rcy - rr * 0.55, 5);
      g.endFill();
    }

    // RIGHT MFD — systems page: bars for hull and fuel, stores in figures.
    const bar = (y, frac, col) => {
      g.beginFill(0x1d2b20, 1); g.drawRect(856, y, 118, 10); g.endFill();
      g.beginFill(col, 1); g.drawRect(856, y, 118 * clamp(frac, 0, 1), 10); g.endFill();
    };
    bar(576, state.hull / 100, state.hull < 45 ? 0xff5347 : 0x9fe870);
    bar(606, state.fuel / 100, state.fuel < 25 ? 0xffb03a : 0x9fe870);
    mfdText.text = [
      'SYS PAGE',
      `HULL ${Math.round(state.hull)}%`,
      `FUEL ${Math.round(state.fuel)}%`,
      `MSL ${state.missiles}  FLR ${state.flares}`,
      `AB ${state.wep ? 'ON' : 'OFF'}  GUN ${Math.round(state.gunHeat * 100)}%`,
    ].join('\n');
    mfdText.visible = true;

    // Damage still talks: smoke past the panel, cracks in the canopy.
    if (state.hull < 70 && !state.onGround) {
      const wisps = state.hull < 35 ? 5 : 3;
      for (let i = 0; i < wisps; i += 1) {
        const wx = 480 + ((i * 173 + now * 60) % 320);
        const wy = 520 - ((now * 46 + i * 61) % 130);
        g.beginFill(0x0c0c0c, 0.2 + (70 - state.hull) * 0.004);
        g.drawCircle(wx + ox, wy + oy, 15 + i * 5);
        g.endFill();
      }
    }
    if (state.hull < 40) {
      g.lineStyle(2, 0xd8ecf4, 0.6);
      const cxk = 905 + ox, cyk = 150 + oy;
      g.moveTo(cxk, cyk); g.lineTo(cxk + 44, cyk - 20);
      g.moveTo(cxk, cyk); g.lineTo(cxk + 58, cyk + 16);
      g.moveTo(cxk, cyk); g.lineTo(cxk + 18, cyk + 48);
      g.moveTo(cxk, cyk); g.lineTo(cxk - 30, cyk + 30);
      g.lineStyle(0);
    }
    void now;
  }

  /** A jet silhouette streaks across the title sky, burner lit. */
  function drawFlyby(g, now) {
    const fx0 = ((now * 150) % 1560) - 140;
    const fy0 = 196 + Math.sin(now * 0.8) * 16;
    const s = 1.15;
    // Sunset rim beneath, then the airframe over it.
    for (const [col, dy] of [[0xff9a4d, 3.5], [0x2e343a, 0]]) {
      g.beginFill(col, col === 0x2e343a ? 1 : 0.4);
      g.drawPolygon([
        fx0 - 86 * s, fy0 + dy, fx0 - 30 * s, fy0 - 9 * s, fx0 + 44 * s, fy0 - 11 * s,
        fx0 + 92 * s, fy0 - 3 * s, fx0 + 96 * s, fy0 + dy, fx0 + 40 * s, fy0 + 6 * s,
        fx0 + 6 * s, fy0 + 20 * s, fx0 - 4 * s, fy0 + 20 * s, fx0 - 24 * s, fy0 + 7 * s,
        fx0 - 62 * s, fy0 + 8 * s, fx0 - 78 * s, fy0 - 12 * s, fx0 - 66 * s, fy0 - 13 * s,
      ]);
      g.endFill();
    }
    // Burner flame trailing the tail.
    const fl = 34 + Math.sin(now * 43) * 7;
    g.beginFill(0xff7a2e, 0.75);
    g.drawPolygon([fx0 - 86 * s, fy0 - 2, fx0 - (86 + fl) * s, fy0 + 1, fx0 - 86 * s, fy0 + 4]);
    g.endFill();
    g.beginFill(0xbfe0ff, 0.9);
    g.drawPolygon([fx0 - 86 * s, fy0, fx0 - (86 + fl * 0.5) * s, fy0 + 1, fx0 - 86 * s, fy0 + 2.5]);
    g.endFill();
  }

  function objectivePoint(state, enemies) {
    if (state.phase === PHASE.RINGS) {
      const ring = RING_COURSE[state.ringIndex];
      if (!ring) return null;
      const p = project(state, ring.x, ring.alt, ring.z);
      return p ? { ...p, label: `WPT ${state.ringIndex + 1} · ${Math.round(p.rel * 3.281)} FT` } : null;
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
    for (const e of enemies) if (e.boom > 0) e.boom = Math.max(0, e.boom - dt * 0.7);
    drawWorld(world, state, screen === SCREEN.TITLE ? [] : enemies, now);
    if (screen === SCREEN.TITLE) drawFlyby(fx, now);
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
    // A launch flash blooms under the wing the moment a missile leaves.
    if (state.launchT > 0 && camera === CAMERA.CHASE) {
      fx.beginFill(0xffc46b, state.launchT * 1.6);
      fx.drawCircle(CX + 120, 470, 26 + (0.35 - state.launchT) * 60);
      fx.endFill();
    }
    const inGame = screen === SCREEN.PLAY || screen === SCREEN.PAUSED;
    if (camera === CAMERA.CHASE && screen !== SCREEN.TITLE) {
      drawOwnPlane(fx, state, now);
    } else if (screen !== SCREEN.TITLE) {
      drawPanel(cockpit, state, enemies, now);
    }
    if (screen !== SCREEN.TITLE) drawHUD(cockpit, state, enemies, now);
    if (!inGame) { hudSys.visible = false; warnText.visible = false; lockText.visible = false; mfdText.visible = false; hudSpdVal.visible = hudAltVal.visible = hudHdgVal.visible = false; }
    else { hudSpdVal.visible = hudAltVal.visible = hudHdgVal.visible = true; if (camera !== CAMERA.COCKPIT) mfdText.visible = false; }

    noteText.visible = inGame && state.messageTime > 0;
    noteText.text = state.message || '';
    plateText.visible = inGame;
    plate2Text.visible = inGame;
    if (inGame) {
      const phaseName = { takeoff: 'TAKE OFF', rings: 'WAYPOINT RUN', dogfight: 'AIR WAR — DOGFIGHT', return: 'RETURN — LAND', landed: 'LANDED', crashed: 'DOWN' }[state.phase] || '';
      plateText.text = `${phaseName}   ·   SCORE ${state.score}   ·   WPT ${state.ringsHit}/6   ·   KILLS ${state.kills}/${KILLS_TO_CLEAR}`;
      plate2Text.text = `FUEL ${Math.round(state.fuel)}%   ·   HULL ${Math.round(state.hull)}%${state.hull < 45 ? ' — DAMAGED' : ''}   ·   CAM ${camera === CAMERA.CHASE ? 'CHASE' : 'COCKPIT'} (C)`;
    }
    const obj = inGame ? objectivePoint(state, enemies) : null;
    markerText.visible = Boolean(obj);
    if (obj) {
      markerText.text = obj.label;
      markerText.position.set(obj.x, obj.y - 26 / Math.max(0.4, obj.scale) - 14);
    }
    titleText.visible = subText.visible = promptText.visible = controlsText.visible = screen === SCREEN.TITLE;
    if (screen === SCREEN.TITLE) {
      titleText.text = 'STEEL VIPER';
      subText.text = '— MODERN AIR COMBAT —';
      promptText.text = 'Click or press ENTER to take off';
      controlsText.text = 'MOUSE steer · W / S throttle · SPACE cannon · F missile (hold target in the circle to lock)\nSHIFT afterburner · X flares · C camera · P pause · M mute · Splash five bandits, land her soft.';
    }
    pauseText.visible = screen === SCREEN.PAUSED;
    pauseText.text = '— PAUSED —';
    endTitle.visible = endLines.visible = screen === SCREEN.OVER;
    if (screen === SCREEN.OVER) {
      const landed = state.phase === PHASE.LANDED;
      endTitle.text = landed ? 'BACK AT BASE' : 'VIPER DOWN';
      const td = state.touchdown;
      endLines.text = landed
        ? `Touchdown at ${knots(td.speed)} kt, sink ${Math.abs(td.vSpeed).toFixed(1)} m/s — ${Math.abs(td.vSpeed) < 3 ? 'a greaser!' : Math.abs(td.vSpeed) < 6 ? 'firm but fair.' : 'the gear groans.'}\nWaypoints ${state.ringsHit} of 6 · Bandits splashed ${state.kills} · Final score ${state.score}\n\nPress ENTER to fly the sortie again`
        : `The sortie ends in the sea off the coast.\nWaypoints ${state.ringsHit} of 6 · Bandits splashed ${state.kills} · Score ${state.score}\n\nPress ENTER to try again`;
    }
  }

  /** Pre-seed a dramatic but deterministic frame for screenshots. */
  function primeExplosion(x, y) { burst(x, y, 0xff8c3a, 14, 130); burst(x, y, 0x3a3a3a, 8, 70); }

  return { app, draw, primeExplosion, burstAt: burst };
}
