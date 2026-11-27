// The world of Sky Courier: seeded island terrain, the two grass strips, the ring
// course, and the scattered trees, houses and clouds — plus the camera projection
// every renderer uses to turn a world point into a screen point.

import { AIRFIELDS, COLOURS, RING, VIEW, WORLD } from './config.js';
import { fbm, mulberry32, valueNoise } from './random.js';

/** Ground height in metres at world (x, z). Sea is 0; islands rise smoothly. */
export function terrainHeight(x, z) {
  let height = rawTerrainHeight(x, z);
  // Each grass strip is flattened to its own elevation, fading out over 120 m,
  // so a runway is a runway and not a hillside.
  for (const field of AIRFIELDS) {
    const dx = x - field.x;
    const dz = z - field.z;
    const along = dx * Math.sin(field.heading) + dz * Math.cos(field.heading);
    const across = dx * Math.cos(field.heading) - dz * Math.sin(field.heading);
    const margin = 120;
    const fAlong = Math.max(0, 1 - Math.max(0, Math.abs(along) - field.length / 2) / margin);
    const fAcross = Math.max(0, 1 - Math.max(0, Math.abs(across) - field.width / 2) / margin);
    const f = Math.min(fAlong, fAcross);
    if (f > 0) {
      const base = rawTerrainHeight(field.x, field.z);
      height = height * (1 - f) + base * f;
    }
  }
  return height;
}

/** The unflattened island height: hills and sea before the strips are levelled. */
function rawTerrainHeight(x, z) {
  let height = 0;
  for (const island of WORLD.islands) {
    const dx = x - island.x;
    const dz = z - island.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist >= island.radius) continue;
    const fall = Math.cos((dist / island.radius) * Math.PI * 0.5);
    const hills = 0.45 + 0.55 * fbm(x / 900 + 3.7, z / 900 + 1.3, WORLD.seed);
    height = Math.max(height, island.peak * fall * fall * hills);
  }
  return height;
}

/** What the ground looks like at (x, z): sea, sand, grass, field, forest or rock. */
export function groundKind(x, z) {
  const h = terrainHeight(x, z);
  if (h <= 1.5) return 'sea';
  if (h <= 4) return 'sand';
  if (h > 96) return 'rock';
  const n = valueNoise(x / 260, z / 260, WORLD.seed + 31);
  if (n > 0.62) return 'forest';
  if (n > 0.45) return 'field';
  return 'grass';
}

export const GROUND_COLOURS = {
  sea: COLOURS.seaDeep,
  sand: COLOURS.sand,
  grass: COLOURS.grass,
  field: COLOURS.field,
  forest: COLOURS.forest,
  rock: COLOURS.rock,
};

/** Build the world: airfield strips flattened, trees, houses and clouds placed. */
export function createWorld(seed) {
  const rng = mulberry32(seed);
  const airfields = AIRFIELDS.map((field) => ({ ...field }));
  const trees = [];
  const houses = [];
  for (let i = 0; i < 260; i += 1) {
    const x = (rng() * 2 - 1) * WORLD.halfSize * 0.9;
    const z = (rng() * 2 - 1) * WORLD.halfSize * 0.9;
    const h = terrainHeight(x, z);
    if (h < 5 || h > 90) continue;
    if (nearRunway(x, z, 60)) continue;
    if (rng() < 0.72) {
      trees.push({ x, z, y: h, size: 6 + rng() * 9 });
    } else {
      houses.push({ x, z, y: h, size: 8 + rng() * 7, hue: rng() });
    }
  }
  const clouds = [];
  for (let i = 0; i < 46; i += 1) {
    clouds.push({
      x: (rng() * 2 - 1) * WORLD.halfSize,
      z: (rng() * 2 - 1) * WORLD.halfSize,
      y: 260 + rng() * 220,
      size: 90 + rng() * 160,
      speed: 2 + rng() * 3,
    });
  }
  return { airfields, trees, houses, clouds, rng };
}

function nearRunway(x, z, margin) {
  for (const field of AIRFIELDS) {
    const dx = x - field.x;
    const dz = z - field.z;
    const along = dx * Math.sin(field.heading) + dz * Math.cos(field.heading);
    const across = dx * Math.cos(field.heading) - dz * Math.sin(field.heading);
    if (Math.abs(along) < field.length / 2 + margin && Math.abs(across) < field.width / 2 + margin) {
      return true;
    }
  }
  return false;
}

/** The airfield whose strip the point is over, or null when it is open ground. */
export function runwayAt(world, x, z) {
  for (const field of world.airfields) {
    const dx = x - field.x;
    const dz = z - field.z;
    const along = dx * Math.sin(field.heading) + dz * Math.cos(field.heading);
    const across = dx * Math.cos(field.heading) - dz * Math.sin(field.heading);
    if (Math.abs(along) < field.length / 2 && Math.abs(across) < field.width / 2) {
      return { field, along, across };
    }
  }
  return null;
}

/** Ring course for a mission: rings strung between the two airfields and over the sea. */
export function buildRingCourse(seed, count) {
  const rng = mulberry32(seed * 7919 + 13);
  const course = [];
  const a = AIRFIELDS[0];
  const b = AIRFIELDS[1];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 1) / (count + 1);
    const x = a.x + (b.x - a.x) * t + (rng() * 2 - 1) * 700;
    const z = a.z + (b.z - a.z) * t + (rng() * 2 - 1) * 700;
    // Every ring hangs well clear of the hills below it, so the course is
    // flyable without threading a hillside.
    const y = Math.max(110 + rng() * 130, terrainHeight(x, z) + 55);
    course.push({ x, y, z, radius: RING.radius, passed: false });
  }
  // The last ring always hangs over the destination strip, as a gate to land through.
  const last = course[course.length - 1];
  last.x = b.x;
  last.z = b.z - 260;
  last.y = Math.max(120, terrainHeight(last.x, last.z) + 55);
  return course;
}

/** Camera basis from the plane's attitude, for the chase view. The camera banks
 * with the aircraft, but only a little over half as far: a full roll would swing
 * the horizon wildly and fight the pilot's eyes. */
export function cameraBasis(plane) {
  const { heading, pitch } = plane;
  const roll = plane.roll * 0.55;
  const cp = Math.cos(pitch);
  const forward = { x: Math.sin(heading) * cp, y: Math.sin(pitch), z: Math.cos(heading) * cp };
  // Right vector, rolled with the aircraft so the horizon banks with the plane.
  const rightFlat = { x: Math.cos(heading), y: 0, z: -Math.sin(heading) };
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const right = {
    x: rightFlat.x * cr,
    y: sr,
    z: rightFlat.z * cr,
  };
  const up = {
    x: forward.z * right.y - forward.y * right.z,
    y: forward.x * right.z - forward.z * right.x,
    z: forward.y * right.x - forward.x * right.y,
  };
  return { forward, right, up };
}

/** Where the chase camera sits: behind and above the plane, looking ahead. */
export function cameraPosition(plane) {
  const { heading, pitch } = plane;
  const cp = Math.cos(pitch);
  const back = {
    x: Math.sin(heading) * cp,
    y: Math.sin(pitch),
    z: Math.cos(heading) * cp,
  };
  return {
    x: plane.x - back.x * VIEW.cameraDistance,
    y: Math.max(plane.y + VIEW.cameraHeight - back.y * VIEW.cameraDistance, 3),
    z: plane.z - back.z * VIEW.cameraDistance,
  };
}

/**
 * Project a world point into screen space. Returns null when behind the camera.
 * `focal` is pixels per unit at unit depth; cy is the horizon's screen height.
 */
export function project(point, camera, basis, focal, cx, cy) {
  const dx = point.x - camera.x;
  const dy = point.y - camera.y;
  const dz = point.z - camera.z;
  const forward = dx * basis.forward.x + dy * basis.forward.y + dz * basis.forward.z;
  if (forward < 2) return null;
  const lateral = dx * basis.right.x + dy * basis.right.y + dz * basis.right.z;
  const vertical = dx * basis.up.x + dy * basis.up.y + dz * basis.up.z;
  return {
    x: cx + (lateral * focal) / forward,
    y: cy - (vertical * focal) / forward,
    depth: forward,
    scale: focal / forward,
  };
}

/** Focal length in pixels for the canvas height and the configured field of view. */
export function focalLength(canvasHeight) {
  return (canvasHeight / 2) / Math.tan((VIEW.fovDegrees * Math.PI) / 360);
}
