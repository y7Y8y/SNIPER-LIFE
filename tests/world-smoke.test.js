import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

test('monde : terrain, village, vegetation, joueur — construction sans erreur', async () => {
  const { createTerrain, terrainHeight } = await import('../src/world/terrain.js');
  const { buildVillage } = await import('../src/world/buildings.js');
  const { createVegetation, updateVegetationWind } = await import('../src/world/scatter.js');
  const { Environment } = await import('../src/world/environment.js');
  const { Player } = await import('../src/entities/player.js');
  const { createHumanoid, animateHumanoid } = await import('../src/entities/character.js');
  const { Guard } = await import('../src/entities/guard.js');
  const { Civilian } = await import('../src/entities/civilian.js');
  const { BulletManager } = await import('../src/entities/bullet.js');
  const { CAUDRES_LAYOUT } = await import('../src/game/campaign.js');

  const scene = new THREE.Scene();
  const terrain = createTerrain(CAUDRES_LAYOUT);
  assert.ok(terrain);
  const { colliders, occluders } = buildVillage(scene, CAUDRES_LAYOUT, 7);
  assert.ok(colliders.length > 5);
  assert.ok(occluders.length > 5);

  const veg = createVegetation(scene, 42);
  assert.ok(veg.treeCircles.length > 10);
  updateVegetationWind(veg, 1.0, 0.5);

  const env = new Environment(scene);
  env.setWeather('rain', true);
  env.update(0.05, new THREE.Vector3(0, 0, 0), null);

  const camera = new THREE.PerspectiveCamera(70, 1.7, 0.1, 420);
  const player = new Player(scene, camera, CAUDRES_LAYOUT.buildings ? { x: -92, z: 62, yaw: 0.7 } : {});
  for (let i = 0; i < 60; i++) {
    player.update(0.016, { move: { x: 0, y: 1 }, look: { dx: i < 3 ? 0.05 : 0, dy: 0 }, fire: false, holdBreath: false, sprint: false, scopeToggle: false, stanceToggle: false, cameraToggle: false, pause: false, interact: false }, { colliders }, null, null);
  }
  assert.ok(player.z > 62, `le joueur a avancé (z=${player.z})`);
  assert.ok(player.camera.position.y > terrainHeight(player.x, player.z), 'camera au-dessus du sol');

  // garde et civil animés
  const model = createHumanoid({ uniform: 0x49503a, helmet: true, rifle: true });
  const guard = new Guard({ name: 'Test', route: [{ x: 0, z: 0 }, { x: 5, z: 5 }], model }, scene);
  guard.occluders = occluders; guard.worldColliders = colliders;
  const saveLike = { heat: 0 };
  void saveLike;
  const weather = { visibilityMul: 1, conceal: 1 };
  const playerProxy = {
    x: 2, z: 2, stance: 0, scoped: false, currentSpeed01: 0.5, invisible: true,
    visibilityFactor: () => 1, exposedTo: () => true
  };
  const missionStub = {
    guards: [], deadActors: [], alarmLevel: 0, setAlarm() {}, onCalmDown() {}, onActorKilled() {}, onGuardShoots() {}, toast() {},
    onConfirmedKill() {}, onCivilianKilled() {}, onBulletImpact() {}
  };
  for (let i = 0; i < 120; i++) {
    guard.update(0.016, { player: playerProxy, mission: missionStub, weather, audio: null });
  }
  assert.ok(guard.x !== 0 || guard.z !== 0, 'garde a patrouillé');

  // cible visible : l'alerte doit monter jusqu'en COMBAT
  playerProxy.invisible = false;
  for (let i = 0; i < 200; i++) {
    guard.update(0.016, { player: playerProxy, mission: missionStub, weather, audio: null });
  }
  assert.equal(guard.state, 'COMBAT', `état après détection: ${guard.state}`);

  const civModel = createHumanoid({ uniform: 0x6b5a44 });
  const civ = new Civilian({ name: 'Test Civil', home: { x: 3, z: 3 }, pos: { x: 3, z: 3 }, model: civModel }, scene);
  const civStub = { colliders, alarmLevel: 0, toast() {}, onActorKilled() {}, onCivilianKilled() {} };
  for (let i = 0; i < 120; i++) civ.update(0.016, { mission: civStub });
  civ.kill(civStub, true);
  assert.ok(civ.dead);

  // balistique
  const bullets = new BulletManager(scene);
  const origin = new THREE.Vector3(player.x, terrainHeight(player.x, player.z) + 1.6, player.z);
  const dir = new THREE.Vector3(Math.sin(0), 0, Math.cos(0)).normalize();
  bullets.fire(origin, dir, 790, true);
  const guardsArr = [guard];
  for (let i = 0; i < 200; i++) {
    bullets.update(0.016, { player, guards: guardsArr, civilians: [civ], occluders, audio: null, camera, mission: missionStub });
  }
  assert.ok(bullets.bullets.length === 0, 'les balles se résolvent');

  // animations
  for (let i = 0; i < 20; i++) animateHumanoid(model, 0.016, 0.8, 0);
  animateHumanoid(model, 0.016, 0, 2);
  animateHumanoid(model, 0.016, 0, 0, 0.5);
});
