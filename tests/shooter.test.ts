import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POSTURES,
  createShooterCondition,
  releaseBreathHold,
  startBreathHold,
  sway,
  tickBreathHold,
  updateBody,
} from '../src/core/shooter.ts';

test('postures reduce sway in a sensible order', () => {
  assert.ok(POSTURES['prone-supported'].baseSway < POSTURES.prone.baseSway);
  assert.ok(POSTURES.prone.baseSway < POSTURES.kneel.baseSway);
  assert.ok(POSTURES.kneel.baseSway < POSTURES.stand.baseSway);
});

test('sway amplitude grows with fatigue and stress', () => {
  const calm = createShooterCondition('simulation');
  const tired: ReturnType<typeof createShooterCondition> = {
    ...calm,
    posture: 'stand',
    fatigue: 0.9,
    stress: 0.9,
  };
  let calmTotal = 0;
  let tiredTotal = 0;
  for (let t = 0; t < 60; t += 0.11) {
    calmTotal += Math.abs(sway(calm, t).x);
    tiredTotal += Math.abs(sway(tired, t).x);
  }
  assert.ok(tiredTotal > calmTotal * 1.3, 'fatigue/stress must widen sway');
});

test('breath hold opens a calm window once', () => {
  let c = createShooterCondition('simulation');
  c = startBreathHold(c);
  assert.equal(c.breathHoldActive, true);
  c = tickBreathHold(c, 100);
  assert.equal(c.breathHoldActive, true);
  assert.equal(sway(c, 1).x, sway(c, 1).x, 'sway stays finite while holding');
  assert.ok(Math.abs(sway(c, 1).x) < Math.abs(sway(createShooterCondition('simulation'), 1).x), 'sway collapses while holding');

  c = tickBreathHold(c, POSTURES.stand.breathCalmMs + 1);
  assert.equal(c.breathHoldUsed, true, 'hold collapsed under the timed window');
  const refused = startBreathHold(c);
  assert.equal(refused.breathHoldActive, false, 'hold cannot be reused immediately');

  const released = releaseBreathHold(c);
  assert.equal(released.breathHoldActive, false);
});

test('breath hold expires when the timed window elapses', () => {
  let c = createShooterCondition('simulation');
  c = startBreathHold(c);
  const budget = POSTURES.stand.breathCalmMs;
  c = tickBreathHold(c, budget + 1);
  assert.equal(c.breathHoldActive, false);
  assert.equal(c.breathHoldUsed, true);
});

test('body state converges toward targets', () => {
  let c = createShooterCondition('simulation');
  for (let i = 0; i < 1200; i++) {
    c = updateBody(c, 0.05, 1);
  }
  assert.ok(c.fatigue > 0.8, `sustained effort saturates fatigue, got ${c.fatigue.toFixed(2)}`);
  assert.ok(c.heartRate > 100, `heart rate follows effort, got ${Math.round(c.heartRate)}`);
  for (let i = 0; i < 1200; i++) {
    c = updateBody(c, 0.05, 0);
  }
  assert.ok(c.fatigue < 0.2, `fatigue recovers with rest, got ${c.fatigue.toFixed(2)}`);
});
