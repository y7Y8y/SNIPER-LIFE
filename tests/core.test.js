import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, angleDelta, distPointSegment, segmentIntersectsAABB, valueNoise2, fbm2 } from '../src/core/math.js';
import { defaultSave, loadSave, adjustReputation } from '../src/core/save.js';
import { getMissionDef, CHOICES, nextMissionId, FACTIONS, EPISODES, CAUDRES_LAYOUT } from '../src/game/campaign.js';

test('clamp / lerp / angleDelta', () => {
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.ok(Math.abs(angleDelta(0.1, -0.1)) < 0.21);
  assert.ok(Math.abs(angleDelta(Math.PI - 0.01, -Math.PI + 0.01)) < 0.05);
});

test('segment/AABB', () => {
  const box = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
  assert.ok(segmentIntersectsAABB(-5, 5, 15, 5, box));
  assert.ok(!segmentIntersectsAABB(-5, 50, 15, 50, box));
});

test('bruit déterministe', () => {
  assert.equal(valueNoise2(1.5, 2.5, 42), valueNoise2(1.5, 2.5, 42));
  assert.ok(fbm2(0.3, 0.7, 5) >= 0 && fbm2(0.3, 0.7, 5) <= 1);
});

test('sauvegarde par defaut + réputation bornée', () => {
  const s = defaultSave();
  assert.equal(s.missionIndex, 0);
  adjustReputation(s, 'state', 999);
  assert.equal(s.reputation.state, 100);
});

test('campagne : définitions de missions cohérentes', () => {
  const save = defaultSave();
  for (const id of ['scout', 'faction']) {
    const def = getMissionDef(id, save);
    assert.ok(def, `mission ${id} définie`);
    assert.ok(def.objectives.length >= 4);
    assert.ok(def.spawn && def.extraction);
    for (const o of def.objectives) {
      if (o.type === 'goto' || o.type === 'decide' || o.type === 'extract') assert.ok(o.pos, `${id}:${o.id} pos`);
    }
  }
  // variantes de faction
  for (const f of Object.keys(FACTIONS)) {
    const saveF = { ...defaultSave(), faction: f };
    const def = getMissionDef('faction', saveF);
    assert.equal(def.faction, f);
    assert.ok(def.objectives.some((o) => o.targetName === 'Marek Voss'), `${f} : cible Voss`);
  }
  // prologue : cible Radec
  const scout = getMissionDef('scout', defaultSave());
  assert.ok(scout.objectives.some((o) => o.targetName === 'Officier Radec'));
});

test('choix : chaque option a des conséquences', () => {
  for (const c of Object.values(CHOICES)) {
    assert.ok(c.title && c.text);
    for (const o of c.options) {
      assert.ok(o.result.flags && o.result.reputation && typeof o.result.heat === 'number');
    }
  }
});

test('progression', () => {
  const s = defaultSave();
  assert.equal(nextMissionId(s), 'scout');
  s.missionIndex = 1; s.faction = 'circle';
  assert.equal(nextMissionId(s), 'faction');
  s.missionIndex = 2;
  assert.equal(nextMissionId(s), null);
  assert.ok(EPISODES.length >= 1);
  assert.ok(CAUDRES_LAYOUT.buildings.length >= 8);
});
