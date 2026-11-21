export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface WindSample {
  direction: number;
  speed: number;
  gust: number;
}

export interface WindOptions {
  baseSpeed: number;
  baseDirection: number;
  speedVariance: number;
  gustFrequency: number;
}

const DEFAULT_WIND_OPTIONS: WindOptions = {
  baseSpeed: 4.0,
  baseDirection: (35 / 180) * Math.PI,
  speedVariance: 0.45,
  gustFrequency: 0.13,
};

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function normalizeAngle(angle: number): number {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

export function shortestAngleDelta(from: number, to: number): number {
  const delta = normalizeAngle(to - from);
  return delta > Math.PI ? delta - Math.PI * 2 : delta;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function addVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scaleVec(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor };
}

export function lengthVec(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function normalizeVec(a: Vec3): Vec3 {
  const len = lengthVec(a);
  return len < 1e-8 ? { x: 0, y: 0, z: 0 } : scaleVec(a, 1 / len);
}

export interface Wind {
  sample: (time: number) => WindSample;
  current: () => WindSample;
}

const TAU = Math.PI * 2;

export function createWind(options: Partial<WindOptions> = {}): Wind {
  const opts = { ...DEFAULT_WIND_OPTIONS, ...options };
  let lastTime = -1;
  let lastSample: WindSample = { direction: opts.baseDirection, speed: opts.baseSpeed, gust: 0 };

  return {
    sample(time: number): WindSample {
      if (time === lastTime) {
        return lastSample;
      }
      lastTime = time;

      const t = time * opts.gustFrequency;
      const wave1 = Math.sin(t * TAU + 1.3);
      const wave2 = Math.sin(t * TAU * 3.7 + 0.4);
      const wave3 = Math.sin(t * TAU * 11.3 + 2.1);

      const gust = clamp(0.55 * wave1 + 0.3 * wave2 + 0.15 * wave3, -1, 1);
      const speed = Math.max(
        0.05,
        (1 + opts.speedVariance * gust) * opts.baseSpeed,
      );

      const direction =
        opts.baseDirection +
        shortestAngleDelta(0, 0.12) * wave1 +
        shortestAngleDelta(0, 0.05) * wave2;

      lastSample = { direction: normalizeAngle(direction), speed, gust };
      return lastSample;
    },
    current(): WindSample {
      return lastSample;
    },
  };
}
