/* Bruit déterministe et utilitaires — utilisé par le terrain, la végétation et les animations. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const v00 = hash2(xi, yi, seed);
  const v10 = hash2(xi + 1, yi, seed);
  const v01 = hash2(xi, yi + 1, seed);
  const v11 = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return v00 * (1 - u) * (1 - v) + v10 * u * (1 - v) + v01 * (1 - u) * v + v11 * u * v;
}

export function fbm2(x, y, seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + o * 101);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function dampf(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/* Angle entre -PI et PI, plus court chemin. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* Point le plus proche d'un segment AB depuis P (2D). Retourne la distance. */
export function distPointSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  const dx = ax + abx * t - px, dz = az + abz * t - pz;
  return Math.hypot(dx, dz);
}

/* Segment 2D vs AABB (utilisé pour les lignes de vue à travers les bâtiments). */
export function segmentIntersectsAABB(ax, az, bx, bz, box) {
  const invX = 1 / (bx - ax || 1e-9);
  const invZ = 1 / (bz - az || 1e-9);
  const t0x = (box.minX - ax) * invX;
  const t1x = (box.maxX - ax) * invX;
  const t0z = (box.minZ - az) * invZ;
  const t1z = (box.maxZ - az) * invZ;
  const tminX = Math.min(t0x, t1x), tmaxX = Math.max(t0x, t1x);
  const tminZ = Math.min(t0z, t1z), tmaxZ = Math.max(t0z, t1z);
  const tEnter = Math.max(tminX, tminZ);
  const tExit = Math.min(tmaxX, tmaxZ);
  return tEnter <= tExit && tExit >= 0 && tEnter <= 1;
}
