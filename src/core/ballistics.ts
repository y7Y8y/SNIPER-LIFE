import { clamp, normalizeAngle, normalizeVec, scaleVec } from './wind.ts';
import type { Vec3, WindSample } from './wind.ts';

export type MaterialId =
  | 'air'
  | 'dirt'
  | 'wood'
  | 'sheet-metal'
  | 'glass'
  | 'concrete'
  | 'vegetation'
  | 'flesh';

export interface MaterialProperties {
  penetration: number;
  deviation: number;
  energyLoss: number;
}

export const MATERIALS: Record<MaterialId, MaterialProperties> = {
  air: { penetration: 1, deviation: 0, energyLoss: 0 },
  dirt: { penetration: 0, deviation: 0.5, energyLoss: 1 },
  wood: { penetration: 0.45, deviation: 0.08, energyLoss: 0.5 },
  'sheet-metal': { penetration: 0.6, deviation: 0.15, energyLoss: 0.4 },
  glass: { penetration: 0.92, deviation: 0.03, energyLoss: 0.12 },
  concrete: { penetration: 0.05, deviation: 0.4, energyLoss: 0.95 },
  vegetation: { penetration: 0.85, deviation: 0.1, energyLoss: 0.25 },
  flesh: { penetration: 0.7, deviation: 0.02, energyLoss: 0.6 },
};

export const MUZZLE_VELOCITY_7_62 = 810;
export const SOUND_SPEED = 340;
export const GRAVITY = 9.81;

export interface BallisticHit {
  material: MaterialId;
  position: Vec3;
  time: number;
  remainingEnergy: number;
}

export interface ShotResult {
  path: Vec3[];
  times: number[];
  hit: BallisticHit | null;
  flyTime: number;
}

export interface ShotOptions {
  origin: Vec3;
  direction: Vec3;
  muzzleVelocity: number;
  wind: WindSample;
  timeStep?: number;
  maxFlightTime?: number;
  resolveMaterial?: (from: Vec3, to: Vec3) => MaterialId | null;
}

export function simulateShot(options: ShotOptions): ShotResult {
  const timeStep = options.timeStep ?? 0.004;
  const maxFlightTime = options.maxFlightTime ?? 2.5;
  const dir = normalizeVec(options.direction);

  let position: Vec3 = { ...options.origin };
  let velocity = scaleVec(dir, options.muzzleVelocity);
  let time = 0;
  let energy = 1;

  const path: Vec3[] = [{ ...position }];
  const times: number[] = [0];
  let hit: BallisticHit | null = null;

  while (time < maxFlightTime) {
    const windFactor = 0.0006;
    const lateral = {
      x: -Math.sin(options.wind.direction) * options.wind.speed * windFactor,
      y: 0,
      z: -Math.cos(options.wind.direction) * options.wind.speed * windFactor,
    };

    velocity = {
      x: velocity.x + lateral.x * timeStep,
      y: velocity.y - GRAVITY * timeStep,
      z: velocity.z + lateral.z * timeStep,
    };

    const next = {
      x: position.x + velocity.x * timeStep,
      y: position.y + velocity.y * timeStep,
      z: position.z + velocity.z * timeStep,
    };
    time += timeStep;

    const material = options.resolveMaterial?.(position, next) ?? null;
    if (material !== null && material !== 'air') {
      const props = MATERIALS[material];
      position = next;
      path.push({ ...next });
      times.push(time);
      energy *= 1 - props.energyLoss;
      hit = { material, position: { ...next }, time, remainingEnergy: energy };
      break;
    }

    position = next;
    path.push({ ...next });
    times.push(time);

    if (position.y < -50) {
      break;
    }
  }

  return { path, times, hit, flyTime: time };
}

export function windageHoldMil(wind: WindSample, distance: number): number {
  const crossWind = Math.sin(wind.direction) * wind.speed;
  const driftMeters = clamp(-crossWind * (distance / 300), -50, 50) * 0.25;
  return -driftMeters / Math.max(distance, 1) * 1000;
}

export function dropMil(muzzleVelocity: number, distance: number): number {
  const flightTime = distance / muzzleVelocity;
  const dropMeters = 0.5 * GRAVITY * flightTime * flightTime * 0.25;
  return dropMeters / Math.max(distance, 1) * 1000;
}

export function soundDelay(distance: number): number {
  return distance / SOUND_SPEED;
}

export function aimAngles(target: Vec3, shooter: Vec3): { yaw: number; pitch: number } {
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const dz = target.z - shooter.z;
  const flat = Math.sqrt(dx * dx + dz * dz);
  return {
    yaw: normalizeAngle(Math.atan2(dx, dz)),
    pitch: Math.atan2(dy, flat),
  };
}
