// Rendering for Sky Courier: sky, projected island terrain, runways, rings, the
// aircraft, the instruments and the menu screens — everything the pilot sees, drawn
// on one canvas with plain 2D paths. One clear job: turn a game state into a picture.

import { AIRFIELDS, COLOURS, VIEW } from './config.js';
import { compassDegrees, heightAboveGround } from './flight.js';
import { currentRing, objectiveLine } from './missions.js';
import {
  GROUND_COLOURS,
  cameraBasis,
  cameraPosition,
  focalLength,
  groundKind,
  project,
  terrainHeight,
} from './world.js';
import { valueNoise } from './random.js';

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, colour, align = 'left', weight = 'bold') {
  ctx.fillStyle = colour;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(8, 18, 30, ${alpha})`;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Draw the whole frame. Returns the clickable buttons of this screen, if any. */
export function renderGame(ctx, state, width, height) {
  const { plane, world, mission, screen } = state;
  const cx = width / 2;
  const focal = focalLength(height);
  const camera = cameraPosition(plane);
  const basis = cameraBasis(plane);
  // The horizon sits where the camera looks: pitch lifts or drops it.
  const horizonY = height * 0.52 - plane.pitch * focal * 0.55;

  drawSky(ctx, state, width, height, horizonY, cx);
  drawGround(ctx, state, width, height, horizonY, cx, focal, camera, basis);
  drawRunways(ctx, state, width, height, horizonY, cx, focal, camera, basis);
  drawRings(ctx, state, width, height, horizonY, cx, focal, camera, basis);
  drawScenery(ctx, state, width, height, horizonY, cx, focal, camera, basis);
  if (screen !== 'title') drawPlane(ctx, plane, cx, height);
  if (screen === 'fly' || screen === 'paused' || screen === 'done') {
    drawHud(ctx, state, width, height);
  }
  if (screen === 'title') return drawTitle(ctx, state, width, height);
  if (screen === 'brief') return drawBrief(ctx, state, width, height);
  if (screen === 'paused') return drawPaused(ctx, width, height);
  if (screen === 'done') return drawDebrief(ctx, state, width, height);
  return [];
}

// ---------------------------------------------------------------- sky

function drawSky(ctx, state, width, height, horizonY, cx) {
  const { plane } = state;
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, COLOURS.skyTop);
  sky.addColorStop(0.62, COLOURS.skyMid);
  sky.addColorStop(1, COLOURS.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, Math.max(0, horizonY) + 1);
  // Sea below the horizon until the terrain quads paint over it.
  ctx.fillStyle = COLOURS.seaDeep;
  ctx.fillRect(0, Math.max(0, horizonY), width, height - Math.max(0, horizonY));

  // Sun: fixed in the world, so it slides across the sky as the pilot turns.
  const sunAz = 0.9;
  const sunOff = wrapAngle(sunAz - plane.heading);
  const sunX = cx + sunOff * 620;
  const sunY = horizonY - 150;
  if (sunX > -80 && sunX < width + 80) {
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    glow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
    glow.addColorStop(0.35, 'rgba(255, 214, 120, 0.55)');
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    ctx.fillStyle = '#ffedb0';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, TAU);
    ctx.fill();
  }

  // Drifting cloud puffs, parallaxed by heading, above the horizon.
  for (let i = 0; i < 9; i += 1) {
    const az = (i / 9) * TAU + 0.4;
    const off = wrapAngle(az - plane.heading);
    const x = cx + off * 700;
    const y = 60 + ((i * 97) % 190);
    if (x < -220 || x > width + 220) continue;
    cloudPuff(ctx, x, y, 60 + ((i * 53) % 70), 0.85);
  }

  // Distant island ridges: two hazy silhouettes riding the horizon line.
  drawRidge(ctx, state, width, horizonY, 46, 'rgba(70, 110, 150, 0.55)', 3.1);
  drawRidge(ctx, state, width, horizonY, 26, 'rgba(52, 92, 110, 0.7)', 5.7);
}

function drawRidge(ctx, state, width, horizonY, amp, colour, seedOff) {
  const { plane } = state;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 2);
  for (let x = 0; x <= width; x += 16) {
    const n = valueNoise(x / 260 + plane.heading * 1.7 + seedOff, seedOff, 11);
    ctx.lineTo(x, horizonY - n * amp - valueNoise(x / 90, seedOff, 23) * amp * 0.5);
  }
  ctx.lineTo(width, horizonY + 2);
  ctx.closePath();
  ctx.fill();
}

function cloudPuff(ctx, x, y, size, alpha) {
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.32, 0, 0, TAU);
  ctx.ellipse(x - size * 0.45, y + size * 0.06, size * 0.55, size * 0.24, 0, 0, TAU);
  ctx.ellipse(x + size * 0.45, y + size * 0.05, size * 0.6, size * 0.26, 0, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------- ground

const DEPTHS = [26, 42, 66, 100, 148, 215, 310, 445, 640, 920, 1320, 1900];
// Lateral fractions of the forward distance: the fan opens with the view frustum,
// so near rows stay narrow and far rows cover the horizon.
const LATERALS = [-1, -0.7, -0.5, -0.35, -0.22, -0.13, -0.07, -0.03, 0, 0.03, 0.07, 0.13, 0.22, 0.35, 0.5, 0.7, 1];

function groundPoint(plane, lateralFraction, forward) {
  const lateral = lateralFraction * forward * 1.7;
  const sh = Math.sin(plane.heading);
  const ch = Math.cos(plane.heading);
  const x = plane.x + sh * forward + ch * lateral;
  const z = plane.z + ch * forward - sh * lateral;
  return { x, y: terrainHeight(x, z), z };
}

function drawGround(ctx, state, width, height, horizonY, cx, focal, camera, basis) {
  const { plane } = state;
  // Paint far rows first so near rows cover them.
  for (let r = DEPTHS.length - 1; r > 0; r -= 1) {
    const zFar = DEPTHS[r];
    const zNear = DEPTHS[r - 1];
    for (let c = 0; c < LATERALS.length - 1; c += 1) {
      const l0 = LATERALS[c];
      const l1 = LATERALS[c + 1];
      const mid = groundPoint(plane, (l0 + l1) / 2, (zNear + zFar) / 2);
      const kind = groundKind(mid.x, mid.z);
      let colour = GROUND_COLOURS[kind];
      // The sea gets a slow swell of two blues, so open water is not one flat slab.
      if (kind === 'sea') {
        colour = valueNoise(mid.x / 420, mid.z / 420, 5) > 0.52 ? '#1a5e7e' : COLOURS.seaDeep;
      }
      const p00 = project(groundPoint(plane, l0, zNear), camera, basis, focal, cx, horizonY);
      const p10 = project(groundPoint(plane, l1, zNear), camera, basis, focal, cx, horizonY);
      const p11 = project(groundPoint(plane, l1, zFar), camera, basis, focal, cx, horizonY);
      const p01 = project(groundPoint(plane, l0, zFar), camera, basis, focal, cx, horizonY);
      if (!p00 || !p10 || !p11 || !p01) continue;
      ctx.fillStyle = GROUND_COLOURS[kind];
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- runways

function drawRunways(ctx, state, width, height, horizonY, cx, focal, camera, basis) {
  const { plane, world } = state;
  for (const field of world.airfields) {
    const dx = field.x - plane.x;
    const dz = field.z - plane.z;
    if (dx * dx + dz * dz > 2600 * 2600) continue;
    const sh = Math.sin(field.heading);
    const ch = Math.cos(field.heading);
    const gy = terrainHeight(field.x, field.z);
    const corners = [];
    for (const [along, across] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      corners.push({
        x: field.x + sh * (along * field.length) / 2 + ch * (across * field.width) / 2,
        y: gy + 0.6,
        z: field.z + ch * (along * field.length) / 2 - sh * (across * field.width) / 2,
      });
    }
    const pts = corners.map((p) => project(p, camera, basis, focal, cx, horizonY));
    if (pts.some((p) => p === null)) continue;
    ctx.fillStyle = COLOURS.runway;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLOURS.runwayEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Centreline dashes down the strip.
    ctx.strokeStyle = '#f7f7e8';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    const c0 = project(
      { x: field.x - (sh * field.length) / 2, y: gy + 0.8, z: field.z - (ch * field.length) / 2 },
      camera, basis, focal, cx, horizonY,
    );
    const c1 = project(
      { x: field.x + (sh * field.length) / 2, y: gy + 0.8, z: field.z + (ch * field.length) / 2 },
      camera, basis, focal, cx, horizonY,
    );
    if (c0 && c1) {
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // The strip's name, floating over its near end.
    const label = project(
      { x: field.x, y: gy + 14, z: field.z },
      camera, basis, focal, cx, horizonY,
    );
    if (label && label.depth < 1600) {
      text(ctx, field.name.toUpperCase(), label.x, label.y, 15, '#ffffff', 'center');
    }
  }
}

// ---------------------------------------------------------------- rings

function drawRings(ctx, state, width, height, horizonY, cx, focal, camera, basis) {
  const { mission } = state;
  mission.rings.forEach((ring, index) => {
    if (ring.passed) return;
    const p = project(ring, camera, basis, focal, cx, horizonY);
    if (!p || p.depth < 8 || p.depth > 3200) return;
    const r = ring.radius * p.scale;
    if (r < 2) return;
    const isNext = index === mission.nextRing;
    const alpha = clamp(1.4 - p.depth / 2400, 0.25, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = isNext ? COLOURS.ringNext : COLOURS.ring;
    ctx.lineWidth = isNext ? 7 : 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = isNext ? 22 : 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.82, 0, TAU);
    ctx.stroke();
    if (isNext) {
      text(ctx, `${index + 1}`, p.x, p.y, Math.max(14, r * 0.5), '#ffffff', 'center');
      text(ctx, `${Math.round(p.depth)} m`, p.x, p.y + r + 16, 13, '#ffe9a8', 'center');
    }
    ctx.restore();
  });
}

// ---------------------------------------------------------------- scenery

function drawScenery(ctx, state, width, height, horizonY, cx, focal, camera, basis) {
  const { plane, world } = state;
  for (const tree of world.trees) {
    const dx = tree.x - plane.x;
    const dz = tree.z - plane.z;
    if (dx * dx + dz * dz > 1500 * 1500) continue;
    const p = project({ x: tree.x, y: tree.y, z: tree.z }, camera, basis, focal, cx, horizonY);
    if (!p) continue;
    const s = tree.size * p.scale;
    if (s < 1.5 || s > 90) continue;
    ctx.fillStyle = '#1f5230';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.6);
    ctx.lineTo(p.x - s * 0.7, p.y);
    ctx.lineTo(p.x + s * 0.7, p.y);
    ctx.closePath();
    ctx.fill();
  }
  for (const house of world.houses) {
    const dx = house.x - plane.x;
    const dz = house.z - plane.z;
    if (dx * dx + dz * dz > 1500 * 1500) continue;
    const p = project({ x: house.x, y: house.y, z: house.z }, camera, basis, focal, cx, horizonY);
    if (!p) continue;
    const s = house.size * p.scale;
    if (s < 2 || s > 80) continue;
    ctx.fillStyle = house.hue > 0.5 ? '#e8dcc8' : '#d8b48f';
    ctx.fillRect(p.x - s / 2, p.y - s * 0.8, s, s * 0.8);
    ctx.fillStyle = '#a34a2e';
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.62, p.y - s * 0.8);
    ctx.lineTo(p.x, p.y - s * 1.35);
    ctx.lineTo(p.x + s * 0.62, p.y - s * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  for (const cloud of world.clouds) {
    const p = project(cloud, camera, basis, focal, cx, horizonY);
    if (!p) continue;
    const s = cloud.size * p.scale;
    if (s < 4 || s > 700) continue;
    cloudPuff(ctx, p.x, p.y, s, 0.9);
  }
}

// ---------------------------------------------------------------- aircraft

function drawPlane(ctx, plane, cx, height) {
  const px = cx;
  const py = height * 0.60 - plane.pitch * 90;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(plane.roll * 0.9);
  ctx.scale(1.05, 1);

  // Soft shadow of the plane on the ground far below, when low.
  // (Drawn in screen space: a small dark ellipse under the fuselage.)
  if (plane.y < 60) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 150, 60, 10, 0, 0, TAU);
    ctx.fill();
  }

  // Main wing, cream with red tips.
  ctx.fillStyle = '#f3ead2';
  ctx.beginPath();
  ctx.moveTo(-168, -6);
  ctx.quadraticCurveTo(-150, -22, -120, -20);
  ctx.lineTo(120, -20);
  ctx.quadraticCurveTo(150, -22, 168, -6);
  ctx.quadraticCurveTo(150, 14, 120, 14);
  ctx.lineTo(-120, 14);
  ctx.quadraticCurveTo(-150, 14, -168, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c33b2a';
  ctx.beginPath();
  ctx.moveTo(-168, -6);
  ctx.quadraticCurveTo(-150, -22, -132, -20);
  ctx.lineTo(-128, 12);
  ctx.quadraticCurveTo(-150, 14, -168, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(168, -6);
  ctx.quadraticCurveTo(150, -22, 132, -20);
  ctx.lineTo(128, 12);
  ctx.quadraticCurveTo(150, 14, 168, -6);
  ctx.closePath();
  ctx.fill();
  // Navigation lights: red port, green starboard.
  ctx.fillStyle = '#ff2d2d';
  ctx.beginPath();
  ctx.arc(-166, -4, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2dff5e';
  ctx.beginPath();
  ctx.arc(166, -4, 4, 0, TAU);
  ctx.fill();

  // Fuselage: tail (near, wide) to nose (far, narrow), cream with a red cheatline.
  ctx.fillStyle = '#f3ead2';
  ctx.beginPath();
  ctx.moveTo(-24, 92);
  ctx.quadraticCurveTo(-30, 20, -16, -92);
  ctx.quadraticCurveTo(0, -104, 16, -92);
  ctx.quadraticCurveTo(30, 20, 24, 92);
  ctx.quadraticCurveTo(0, 100, -24, 92);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c33b2a';
  ctx.beginPath();
  ctx.moveTo(-25, 46);
  ctx.lineTo(25, 46);
  ctx.lineTo(22, 34);
  ctx.lineTo(-22, 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c33b2a';
  ctx.fillRect(-19, -58, 38, 10);

  // Cockpit windows, dark glass on the nose.
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath();
  ctx.moveTo(-13, -78);
  ctx.lineTo(13, -78);
  ctx.lineTo(10, -62);
  ctx.lineTo(-10, -62);
  ctx.closePath();
  ctx.fill();

  // Tailplane and fin, at the near end.
  ctx.fillStyle = '#e6dcc0';
  ctx.beginPath();
  ctx.moveTo(-74, 62);
  ctx.lineTo(74, 62);
  ctx.lineTo(60, 82);
  ctx.lineTo(-60, 82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c33b2a';
  ctx.beginPath();
  ctx.moveTo(-14, 88);
  ctx.lineTo(0, 34);
  ctx.lineTo(14, 88);
  ctx.closePath();
  ctx.fill();

  // Spinning prop disc at the nose, with a blur of blades.
  ctx.fillStyle = 'rgba(40, 40, 40, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, -100, 26, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(0, -100, 4, 0, TAU);
  ctx.fill();

  // Registration on the fuselage.
  ctx.fillStyle = '#33302a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PK-SKY', 0, 12);

  ctx.restore();
}

// ---------------------------------------------------------------- HUD

function drawHud(ctx, state, width, height) {
  const { plane, mission } = state;
  const agl = Math.round(heightAboveGround(plane));
  const speedKts = Math.round(plane.speed * 1.944);
  const altFt = Math.round(plane.y * 3.281);

  // Top bar: mission, objective, score, clock.
  panel(ctx, 16, 14, 430, 64, 0.66);
  text(ctx, mission.def.name.toUpperCase(), 30, 32, 15, '#ffd23e');
  text(ctx, objectiveLine(mission), 30, 56, 14, '#ffffff', 'left', 'normal');
  panel(ctx, width - 236, 14, 220, 64, 0.66);
  text(ctx, `SCORE  ${mission.score}`, width - 222, 32, 16, '#ffffff');
  const clock = mission.def.timeLimit > 0
    ? `TIME  ${Math.floor(mission.timeLeft / 60)}:${String(Math.floor(mission.timeLeft % 60)).padStart(2, '0')}`
    : `RINGS  ${mission.ringsPassed}/${mission.rings.length}`;
  text(ctx, clock, width - 222, 56, 14, mission.def.timeLimit > 0 && mission.timeLeft < 30 ? '#ff6b5e' : '#cfe8ff', 'left', 'normal');

  drawCompass(ctx, plane, width);
  drawSpeedTape(ctx, plane, speedKts, 16, 108);
  drawAltitudeTape(ctx, altFt, agl, width - 116, 108);
  drawArtificialHorizon(ctx, plane, 16, height - 168);
  drawEnginePanel(ctx, plane, 150, height - 168);
  drawMessages(ctx, mission, width - 330, 92);

  // Stall warning, loud and centred.
  if (!plane.onGround && plane.speed < 28) {
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(performance.now() / 120);
    text(ctx, 'STALL — NOSE DOWN, FULL THROTTLE', width / 2, 150, 24, '#ff5148', 'center');
    ctx.restore();
  }
  if (plane.fuel < 20 && plane.fuel > 0) {
    text(ctx, 'LOW FUEL', width / 2, 182, 20, '#ffb02e', 'center');
  }
  // Controls hint, small, bottom centre.
  text(ctx, '↑↓ pitch   ←→ bank   SHIFT/CTRL throttle   F flaps   G gear   P pause', width / 2, height - 16, 13, 'rgba(255,255,255,0.75)', 'center', 'normal');
}

function drawCompass(ctx, plane, width) {
  const cx = width / 2;
  const y = 34;
  panel(ctx, cx - 190, 14, 380, 44, 0.66);
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, cx - 190, 14, 380, 44, 10);
  ctx.clip();
  const deg = compassDegrees(plane);
  const points = [
    [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
    [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
  ];
  for (const [bearing, label] of points) {
    let diff = ((bearing - deg + 540) % 360) - 180;
    const x = cx + diff * 2.4;
    if (x < cx - 180 || x > cx + 180) continue;
    text(ctx, label, x, y + 8, 14, bearing % 90 === 0 ? '#ffd23e' : '#ffffff', 'center');
  }
  for (let d = -180; d <= 180; d += 10) {
    const bearing = (deg + d + 360) % 360;
    if (bearing % 30 !== 0) continue;
    const x = cx + d * 2.4;
    if (x < cx - 180 || x > cx + 180) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, y + 16);
    ctx.lineTo(x, y + 22);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(cx, 52);
  ctx.lineTo(cx - 6, 42);
  ctx.lineTo(cx + 6, 42);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${String(Math.round(deg)).padStart(3, '0')}°`, cx, 26, 12, '#ffffff', 'center');
}

function drawSpeedTape(ctx, plane, kts, x, y) {
  panel(ctx, x, y, 96, 210, 0.66);
  text(ctx, 'AIRSPEED', x + 48, y + 16, 11, '#9fc6e8', 'center');
  text(ctx, `${kts}`, x + 48, y + 52, 30, '#ffffff', 'center');
  text(ctx, 'kt', x + 48, y + 80, 12, '#9fc6e8', 'center');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 104);
  ctx.lineTo(x + 84, y + 104);
  ctx.stroke();
  text(ctx, `THR ${Math.round(plane.throttle * 100)}%`, x + 48, y + 126, 12, '#ffffff', 'center');
  text(ctx, `FLAP ${plane.flaps ? 'OUT' : 'IN'}`, x + 48, y + 152, 12, plane.flaps ? '#4fc94f' : '#9fc6e8', 'center');
  text(ctx, `GEAR ${plane.gear === 'down' ? 'DOWN' : 'UP'}`, x + 48, y + 178, 12, plane.gear === 'down' ? '#4fc94f' : '#ffb02e', 'center');
}

function drawAltitudeTape(ctx, altFt, agl, x, y) {
  panel(ctx, x, y, 96, 210, 0.66);
  text(ctx, 'ALTITUDE', x + 48, y + 16, 11, '#9fc6e8', 'center');
  text(ctx, `${altFt}`, x + 48, y + 52, 30, '#ffffff', 'center');
  text(ctx, 'ft', x + 48, y + 80, 12, '#9fc6e8', 'center');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 104);
  ctx.lineTo(x + 84, y + 104);
  ctx.stroke();
  text(ctx, `AGL ${agl} m`, x + 48, y + 128, 13, '#ffffff', 'center');
  text(ctx, 'RADIO ALT', x + 48, y + 152, 10, '#9fc6e8', 'center');
}

function drawArtificialHorizon(ctx, plane, x, y) {
  const r = 62;
  const cx = x + r;
  const cy = y + r;
  panel(ctx, x - 6, y - 6, r * 2 + 12, r * 2 + 12, 0.66);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  ctx.translate(0, plane.pitch * 90);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r - 4, -r - 4, r * 2 + 8, r + 4);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r - 4, 0, r * 2 + 8, r + 4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker over the ball.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(cx + 34, cy);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, TAU);
  ctx.fill();
  text(ctx, 'ATTITUDE', cx, y + r * 2 + 22, 11, '#9fc6e8', 'center');
}

function drawEnginePanel(ctx, plane, x, y) {
  panel(ctx, x, y, 220, 128, 0.66);
  text(ctx, 'FUEL', x + 14, y + 20, 12, '#9fc6e8');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x + 14, y + 32, 192, 14, 7);
  ctx.fill();
  ctx.fillStyle = plane.fuel < 20 ? '#ff5148' : '#4fc94f';
  const fw = 192 * (plane.fuel / 100);
  if (fw > 2) {
    roundRect(ctx, x + 14, y + 32, fw, 14, 7);
    ctx.fill();
  }
  text(ctx, `${Math.round(plane.fuel)}%`, x + 206, y + 20, 12, '#ffffff', 'right');
  text(ctx, 'THROTTLE', x + 14, y + 66, 12, '#9fc6e8');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x + 14, y + 78, 192, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  const tw = 192 * plane.throttle;
  if (tw > 2) {
    roundRect(ctx, x + 14, y + 78, tw, 14, 7);
    ctx.fill();
  }
  text(ctx, `${Math.round(plane.throttle * 100)}%`, x + 206, y + 66, 12, '#ffffff', 'right');
  const gear = plane.gear === 'down' ? 'DOWN' : 'UP';
  const gearColour = plane.gear === 'down' ? '#4fc94f' : '#ffb02e';
  text(ctx, `GEAR ${gear}`, x + 14, y + 112, 12, gearColour);
  text(ctx, `FLAPS ${plane.flaps ? 'OUT' : 'IN'}`, x + 118, y + 112, 12, plane.flaps ? '#4fc94f' : '#9fc6e8');
}

function drawMessages(ctx, mission, x, y) {
  mission.messages.slice(0, 4).forEach((msg, i) => {
    ctx.globalAlpha = 1 - i * 0.22;
    text(ctx, msg, x, y + i * 22, 14, '#ffffff', 'left', 'normal');
  });
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- screens

function drawTitle(ctx, state, width, height) {
  const { mission } = state;
  ctx.fillStyle = 'rgba(6, 14, 24, 0.45)';
  ctx.fillRect(0, 0, width, height);
  text(ctx, 'SKY COURIER', width / 2, 108, 64, '#ffffff', 'center');
  text(ctx, 'I S L A N D   R U N', width / 2, 156, 22, '#ffd23e', 'center');
  text(ctx, 'A bush-plane courier over the islands. Thread the rings, mind the fuel,', width / 2, 196, 16, '#e8f2fb', 'center', 'normal');
  text(ctx, 'and set her down gently on the grass.', width / 2, 220, 16, '#e8f2fb', 'center', 'normal');

  const buttons = [];
  const cardW = 300;
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const startX = (width - totalW) / 2;
  const cardY = 268;
  const cardH = 210;
  const defs = state.missionDefs;
  defs.forEach((def, i) => {
    const x = startX + i * (cardW + gap);
    const selected = def.id === mission.def.id;
    ctx.fillStyle = selected ? 'rgba(255, 210, 62, 0.16)' : 'rgba(8, 18, 30, 0.78)';
    roundRect(ctx, x, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd23e' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = selected ? 3 : 1;
    ctx.stroke();
    text(ctx, def.name.toUpperCase(), x + cardW / 2, cardY + 34, 20, selected ? '#ffd23e' : '#ffffff', 'center');
    wrapText(ctx, def.blurb, x + 20, cardY + 66, cardW - 40, 18, '#dfeaf4');
    const meta = def.timeLimit > 0
      ? `${def.rings} rings · ${Math.floor(def.timeLimit / 60)} min · strong wind`
      : `${def.rings} rings · no clock${def.wind > 0 ? ' · breeze' : ''}`;
    text(ctx, meta, x + cardW / 2, cardY + 158, 13, '#9fc6e8', 'center', 'normal');
    text(ctx, selected ? 'SELECTED — CLICK TO FLY' : 'CLICK TO SELECT', x + cardW / 2, cardY + 186, 12, selected ? '#ffd23e' : '#cfe8ff', 'center');
    buttons.push({ id: `mission-${def.id}`, x, y: cardY, w: cardW, h: cardH });
  });

  text(ctx, 'Fly with keyboard or mouse — arrows pitch and bank, SHIFT / CTRL throttle, F flaps, G gear.', width / 2, 540, 15, '#e8f2fb', 'center', 'normal');
  text(ctx, 'Land soft on a strip: slow, level, gear down. Rings are worth 100 points each.', width / 2, 566, 15, '#e8f2fb', 'center', 'normal');
  panel(ctx, width / 2 - 190, 606, 380, 52, 0.66);
  text(ctx, 'CLICK A MISSION CARD TO FLY', width / 2, 632, 17, '#ffd23e', 'center');
  buttons.push({ id: 'fly', x: width / 2 - 190, y: 606, w: 380, h: 52 });
  return buttons;
}

function wrapText(ctx, str, x, y, maxWidth, lineHeight, colour) {
  ctx.fillStyle = colour;
  ctx.font = 'normal 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const words = str.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function drawBrief(ctx, state, width, height) {
  const { mission } = state;
  ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.fillRect(0, 0, width, height);
  panel(ctx, width / 2 - 330, 150, 660, 380, 0.85);
  text(ctx, mission.def.name.toUpperCase(), width / 2, 196, 30, '#ffd23e', 'center');
  wrapText(ctx, mission.def.blurb, width / 2 - 280, 240, 560, 22, '#ffffff');
  const lines = [
    `Rings on the course: ${mission.rings.length} — each worth 100 points.`,
    mission.def.timeLimit > 0
      ? `Clock: ${Math.floor(mission.def.timeLimit / 60)} minutes. Beat it for a time bonus.`
      : 'No clock on this run — fly it clean.',
    mission.def.id === 'hop'
      ? 'Finish the rings, then land on South Strip to deliver the mail (+400).'
      : 'Finish the rings, then land anywhere soft for the landing bonus.',
    'Fuel burns with the throttle. Empty tanks still glide — pick a field.',
    'A hard landing bends the aeroplane. A soft one is worth 250 points.',
  ];
  lines.forEach((line, i) => {
    text(ctx, `•  ${line}`, width / 2 - 280, 300 + i * 30, 15, '#dfeaf4', 'left', 'normal');
  });
  panel(ctx, width / 2 - 190, 468, 380, 52, 0.9);
  text(ctx, 'CLICK OR PRESS ENTER TO TAKE OFF', width / 2, 494, 16, '#ffd23e', 'center');
  return [{ id: 'takeoff', x: width / 2 - 190, y: 468, w: 380, h: 52 }];
}

function drawPaused(ctx, width, height) {
  ctx.fillStyle = 'rgba(6, 14, 24, 0.6)';
  ctx.fillRect(0, 0, width, height);
  text(ctx, 'PAUSED', width / 2, height / 2 - 30, 44, '#ffffff', 'center');
  text(ctx, 'Press P or click to keep flying', width / 2, height / 2 + 22, 16, '#cfe8ff', 'center', 'normal');
  return [{ id: 'resume', x: 0, y: 0, w: width, h: height }];
}

function drawDebrief(ctx, state, width, height) {
  const { mission } = state;
  ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.fillRect(0, 0, width, height);
  panel(ctx, width / 2 - 330, 130, 660, 420, 0.88);
  const won = mission.outcome === 'complete' || mission.outcome === 'delivered' || mission.outcome === 'landed';
  text(ctx, won ? 'SORTIE COMPLETE' : 'SORTIE OVER', width / 2, 176, 32, won ? '#4fc94f' : '#ff6b5e', 'center');
  text(ctx, mission.outcomeText, width / 2, 214, 16, '#ffffff', 'center', 'normal');
  text(ctx, `FINAL SCORE`, width / 2, 268, 13, '#9fc6e8', 'center');
  text(ctx, `${mission.score}`, width / 2, 312, 52, '#ffd23e', 'center');
  const mins = Math.floor(mission.elapsed / 60);
  const secs = Math.floor(mission.elapsed % 60);
  text(ctx, `Rings ${mission.ringsPassed}/${mission.rings.length}  ·  Near misses ${mission.nearMisses}  ·  Time ${mins}:${String(secs).padStart(2, '0')}`, width / 2, 360, 15, '#dfeaf4', 'center', 'normal');
  text(ctx, `Fuel left ${Math.round(state.plane.fuel)}%  ·  Damage ${Math.round(state.plane.damage)}%`, width / 2, 388, 15, '#dfeaf4', 'center', 'normal');
  text(ctx, `Mission: ${mission.def.name}`, width / 2, 416, 15, '#dfeaf4', 'center', 'normal');
  panel(ctx, width / 2 - 300, 458, 290, 52, 0.9);
  text(ctx, 'FLY AGAIN', width / 2 - 155, 484, 16, '#ffd23e', 'center');
  panel(ctx, width / 2 + 10, 458, 290, 52, 0.9);
  text(ctx, 'CHANGE MISSION', width / 2 + 155, 484, 16, '#ffffff', 'center');
  return [
    { id: 'again', x: width / 2 - 300, y: 458, w: 290, h: 52 },
    { id: 'change', x: width / 2 + 10, y: 458, w: 290, h: 52 },
  ];
}
