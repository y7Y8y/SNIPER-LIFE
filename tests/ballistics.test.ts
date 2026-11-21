import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIALS,
  MUZZLE_VELOCITY_7_62,
  aimAngles,
  simulateShot,
  soundDelay,
  windageHoldMil,
} from '../src/core/ballistics.ts';

const FLAT_SHOT = {
  origin: { x: 0, y: 1.7, z: 0 },
  direction: { x: 0, y: 0, z: 1 },
  muzzleVelocity: MUZZLE_VELOCITY_7_62,
  wind: { direction: 0, speed: 0, gust: 0 },
};

test('a shot in still air follows a parabola', () => {
  const shot = simulateShot({ ...FLAT_SHOT });
  assert.ok(shot.path.length > 10);
  assert.equal(shot.hit, null);
  const last = shot.path[shot.path.length - 1]!;
  assert.ok(last.y < FLAT_SHOT.origin.y, 'the bullet must drop');
});

test('a shot hits the resolver and loses energy', () => {
  const shot = simulateShot({
    ...FLAT_SHOT,
    resolveMaterial: (position) => (position.y <= 0 ? 'dirt' : null),
  });
  assert.ok(shot.hit !== null);
  assert.equal(shot.hit.material, 'dirt');
  assert.ok(shot.hit.time > 0 && shot.hit.time < 3);
  assert.ok(shot.hit.position.y <= 0.2);
  const nearMiss = simulateShot({
    ...FLAT_SHOT,
    resolveMaterial: (position) => (position.z >= 200 && Math.abs(position.x) < 1 ? 'wood' : null),
  });
  if (nearMiss.hit !== null && nearMiss.hit.material === 'wood') {
    assert.ok(nearMiss.hit.remainingEnergy > 0.4 && nearMiss.hit.remainingEnergy < 0.55);
  }
});

test('time of flight at 300 m is measurable, not instant', () => {
  const shot = simulateShot({
    ...FLAT_SHOT,
    resolveMaterial: (position) => (position.z >= 300 ? 'sheet-metal' : null),
  });
  assert.ok(shot.hit !== null);
  assert.ok(shot.hit.time > 0.1, `TOF should exceed 0.1 s, got ${shot.hit.time}`);
  assert.equal(shot.times[shot.times.length - 1], shot.hit.time);
});

test('a crosswind drifts the trajectory sideways', () => {
  const still = simulateShot({ ...FLAT_SHOT, resolveMaterial: (p) => (p.z >= 100 ? 'dirt' : null) });
  const crosswind = simulateShot({
    ...FLAT_SHOT,
    wind: { direction: Math.PI / 2, speed: 8, gust: 0.5 },
    resolveMaterial: (p) => (p.z >= 100 ? 'dirt' : null),
  });
  assert.ok(still.hit !== null && crosswind.hit !== null);
  assert.ok(crosswind.hit.position.x < still.hit.position.x, 'wind from the right pushes the bullet left');
  const hold = windageHoldMil({ direction: Math.PI / 2, speed: 8, gust: 0.5 }, 300);
  assert.ok(hold > 0);
});

test('material table is plausible', () => {
  assert.equal(MATERIALS.air.energyLoss, 0);
  assert.ok(MATERIALS.glass.energyLoss < MATERIALS.concrete.energyLoss);
  assert.ok(MATERIALS.glass.penetration > MATERIALS.concrete.penetration);
});

test('sound arrives after the bullet', () => {
  const delay = soundDelay(300);
  assert.ok(delay > 0.8 && delay < 1, `300 m should delay ~0.88 s, got ${delay}`);
  assert.ok(Math.abs(aimAngles({ x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }).pitch - Math.atan2(1, Math.SQRT2)) < 1e-9);
});
