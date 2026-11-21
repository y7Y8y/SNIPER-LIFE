import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION, defaultSave, migrateSave } from '../src/core/save.ts';

test('default save carries version and safe settings', () => {
  const save = defaultSave();
  assert.equal(save.version, SAVE_VERSION);
  assert.equal(save.settings.assistance, 'realiste');
  assert.deepEqual(save.progress.completedMissions, []);
});

test('migrate accepts a well-formed v1 and fills missing fields', () => {
  const migrated = migrateSave({
    version: 1,
    createdAt: 1,
    updatedAt: 1,
    settings: { assistance: 'accessible' },
    progress: { completedMissions: ['prologue'], flags: { spared_civilian: true } },
  });
  assert.equal(migrated.settings.assistance, 'accessible');
  assert.equal(migrated.settings.fpsTarget, 30, 'missing settings fall back to defaults');
  assert.deepEqual(migrated.progress.completedMissions, ['prologue']);
  assert.equal(migrated.progress.flags.spared_civilian, true);
});

test('migrate rejects garbage by returning a fresh save', () => {
  assert.equal(migrateSave(null).version, SAVE_VERSION);
  assert.equal(migrateSave('nonsense').version, SAVE_VERSION);
  assert.equal(migrateSave({ version: -3 }).settings.assistance, 'realiste');
  assert.doesNotThrow(() => migrateSave(JSON.parse(JSON.stringify(defaultSave()))));
});
