import test from 'node:test';
import assert from 'node:assert/strict';
import { createWind, normalizeAngle, shortestAngleDelta } from '../src/core/wind.ts';

test('wind sample is deterministic for the same time', () => {
  const a = createWind();
  const b = createWind();
  const first = a.sample(12.34);
  const second = b.sample(12.34);
  assert.equal(first.speed, second.speed);
  assert.equal(first.direction, second.direction);
  assert.equal(first.gust, second.gust);
});

test('wind speed stays positive and bounded', () => {
  const wind = createWind();
  for (let t = 0; t < 600; t += 0.5) {
    const sample = wind.sample(t);
    assert.ok(sample.speed > 0, `speed at t=${t} should be > 0`);
    assert.ok(sample.speed < 20, `speed at t=${t} should be < 20`);
    assert.ok(sample.gust >= -1 && sample.gust <= 1, 'gust in [-1, 1]');
    assert.ok(sample.direction >= 0 && sample.direction < Math.PI * 2, 'direction normalized');
  }
});

test('wind evolves over time', () => {
  const wind = createWind();
  const start = wind.sample(0);
  const later = wind.sample(30);
  assert.notEqual(start.speed, later.speed);
});

test('angle helpers keep values normalized', () => {
  assert.equal(normalizeAngle(-Math.PI / 2), (3 * Math.PI) / 2);
  assert.ok(Math.abs(shortestAngleDelta(3, 3.1)) <= 0.101);
  assert.ok(Math.abs(shortestAngleDelta(0.1, 2 * Math.PI - 0.1) + 0.2) < 1e-12);
});
