// Deterministic randomness for Sky Courier: one seeded generator plus the value noise
// the terrain, clouds and ring course are built from, so a seed always grows the same
// islands and the screenshot poses always replay the same flight.

/** mulberry32: a small, fast seeded PRNG with a uniform [0, 1) output. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 2D hash: the same integer lattice point always returns the same [0, 1). */
function latticeHash(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634781) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1): bilinear blend of the four lattice corners. */
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = latticeHash(ix, iz, seed);
  const b = latticeHash(ix + 1, iz, seed);
  const c = latticeHash(ix, iz + 1, seed);
  const d = latticeHash(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise: three octaves of value noise, still in roughly [0, 1). */
export function fbm(x, z, seed) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let octave = 0; octave < 3; octave += 1) {
    sum += amp * valueNoise(x * freq, z * freq, seed + octave * 101);
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum;
}

/** Pick `count` items from `list` without replacement, using the given rng. */
export function pickSome(rng, list, count) {
  const pool = list.slice();
  const out = [];
  while (pool.length > 0 && out.length < count) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}
