import test from 'node:test';
import assert from 'node:assert/strict';
import { QualityGovernor, QUALITY_LEVELS, RollingFps } from '../src/core/perf.ts';

const TIGHT = { lowFpsThreshold: 28, highFpsThreshold: 40, lowDurationMs: 5000, highDurationMs: 10000 };

test('governor lowers quality only after sustained low fps', () => {
  const governor = new QualityGovernor(2, TIGHT);
  let change: 'down' | 'up' | null = null;
  for (let i = 0; i < 400; i++) {
    change = governor.onFrame(20, 16.7);
  }
  assert.ok(governor.levelIndex < 2, 'must not stay at the top level');
  assert.ok(change === 'down' || change === null);
  const elapsed = 400 * 16.7;
  assert.ok(elapsed >= TIGHT.lowDurationMs - 500 || governor.levelIndex < 2);
  for (let i = 0; i < 200; i++) {
    governor.onFrame(20, 16.7);
  }
  assert.ok(governor.quality.resolutionScale <= 0.6, 'drops to a lighter level, not to zero');
});

test('governor is hysteretic and does not flap', () => {
  const governor = new QualityGovernor(2, TIGHT);
  for (let i = 0; i < 400; i++) {
    governor.onFrame(10, 16.7);
  }
  const afterDrop = governor.levelIndex;
  governor.onFrame(60, 16.7);
  let flips = 0;
  for (let i = 0; i < 60; i++) {
    const change = governor.onFrame(i % 2 === 0 ? 45 : 15, 16.7);
    if (change !== null) {
      flips++;
    }
  }
  assert.equal(flips, 0, 'mixed frames must not flip quality twice');
  assert.notEqual(governor.levelIndex, afterDrop - 2, 'recovery needs sustained good fps');
});

test('governor raises quality after sustained high fps', () => {
  const governor = new QualityGovernor(0, TIGHT);
  for (let i = 0; i < 700; i++) {
    governor.onFrame(60, 16.7);
  }
  assert.ok(governor.levelIndex > 0, 'quality must climb back');
});

test('quality levels define the documented scales', () => {
  assert.equal(QUALITY_LEVELS.length, 3);
  assert.ok(QUALITY_LEVELS[1]!.resolutionScale >= 0.5);
  assert.ok(QUALITY_LEVELS[0]!.resolutionScale <= 0.6);
});

test('rolling fps averages and stabilizes', () => {
  const rolling = new RollingFps(5);
  assert.equal(rolling.stable, false);
  for (let i = 0; i < 10; i++) {
    rolling.push(60);
  }
  assert.equal(rolling.stable, true);
  assert.equal(rolling.average, 60);
  rolling.push(30);
  assert.ok(rolling.average < 60);
});
