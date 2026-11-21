/* Flux de mission complet en headless : mini-DOM factice, monde réel. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

function fakeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function fakeEl(tag = 'div') {
  const el = {
    tag,
    children: {},
    style: {},
    classList: {
      add() {}, remove() {}, toggle() {}, contains: () => false
    },
    textContent: '',
    innerHTML: '',
    disabled: false,
    appendChild(c) { this.children._last = c; return c; },
    removeChild() {},
    remove() {},
    querySelector(sel) {
      const id = sel.replace('#', '');
      this.children[id] = this.children[id] ?? fakeEl('span');
      return this.children[id];
    },
    querySelectorAll() { return []; },
    getElementById(sel) { return undefined; },
    replaceWith() {},
    addEventListener() {},
    removeEventListener() {},
    get parentElement() { return { clientWidth: 300 }; },
    get clientWidth() { return 300; },
    get clientHeight() { return 200; },
    getContext: () => fakeCtx(),
    getBoundingClientRect: () => ({ width: 300, height: 200 })
  };
  return el;
}

globalThis.window = globalThis;

globalThis.document = {
  createElement: (t) => fakeEl(t),
  getElementById: (id) => (id === 'scope-fx' ? fakeEl('canvas') : fakeEl('div')),
  querySelectorAll: () => []
};
globalThis.mock = {}; // évite le shadowing
globalThis.requestAnimationFrame = () => 0;

test('flux de mission : spawn → objectifs → décision → tir → extraction', async () => {
  const THREE = await import('three');
  const { Mission } = await import('../src/game/mission.js');
  const { AudioEngine } = await import('../src/core/audio.js');
  const { CHOICES, getMissionDef } = await import('../src/game/campaign.js');

  const ended = { calls: [] };
  const game = {
    camera: new THREE.PerspectiveCamera(70, 1.77, 0.1, 420),
    uiRoot: fakeEl('div'),
    audio: new AudioEngine(),
    input: { pressFire() {}, setBreath() {} },
    menus: {
      showChoice(choice, onResolve) {
        game.lastChoiceShown = choice;
        const option = choice.options[0];
        onResolve(option.id, option.result);
      },
      showDebrief() {},
      showFactionChoice() {}
    },
    onMissionEnd(mission, success, reason) { ended.calls.push({ success, reason }); }
  };

  const mission = new Mission(game, 'scout', game.save ?? { heat: 0, reputation: { state: 50, market: 50, circle: 50 }, flags: {}, stats: {}, faction: null });
  mission.build();
  mission.start();
  assert.ok(mission.player, 'joueur créé');
  assert.ok(mission.guards.length >= 3, 'gardes créés');
  assert.ok(mission.target, 'cible narrative présente (Radec)');

  const input = { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, fire: false, holdBreath: false, sprint: false, scopeToggle: false, stanceToggle: false, cameraToggle: false, pause: false, interact: false };

  // objectif 1 : goto — téléporter le joueur au poste d'observation
  mission.player.x = -62; mission.player.z = 34;
  mission.update(0.016, input);
  assert.equal(mission.objectiveIndex, 1, 'goto complété');

  // objectif 2 : mark — lunette sur la cible (on vise vraiment)
  const t = mission.target;
  const dx = t.x - mission.player.x, dz = t.z - mission.player.z;
  const dist = Math.hypot(dx, dz);
  const camY = mission.player.camera.position.y;
  mission.player.yaw = Math.atan2(dx, dz);
  mission.player.pitch = Math.atan2(t.group.position.y + 0.9 - camY, dist);
  mission.player.scoped = true;
  for (let i = 0; i < 300; i++) {
    mission.update(0.016, input);
    if (mission.objectiveIndex > 2) break; // la décision s'est déjà ouverte (on est dans son rayon)
  }
  assert.ok(mission.objectiveIndex >= 2, `mark complété (état: ${mission.objectiveIndex})`);

  // objectif 3 : decide — le choix doit s'afficher et se résoudre
  assert.equal(mission.status, 'run');
  assert.equal(mission.objectiveIndex, 3, 'décision appliquée puis objectif avancé');
  assert.ok(mission.save.flags.obeyedVairel === true, 'conséquence du choix appliquée');

  // objectif 4 : eliminate — tirer sur la cible (simulation de balle obtenue)
  mission.ammo = 3;
  mission.target.kill(mission, true);
  mission.update(0.016, input);
  assert.equal(mission.objectiveIndex, 4, 'élimination complétée');

  // objectif 5 : extraction
  mission.player.x = mission.def.extraction.x;
  mission.player.z = mission.def.extraction.z;
  mission.update(0.016, input);
  assert.equal(ended.calls.length, 1, 'mission terminée');
  assert.equal(ended.calls[0].success, true);
});

test('échec si alarme (variante Cercle)', async () => {
  const THREE = await import('three');
  const { Mission } = await import('../src/game/mission.js');
  const { AudioEngine } = await import('../src/core/audio.js');
  void AudioEngine;

  const game = {
    camera: new THREE.PerspectiveCamera(70, 1.77, 0.1, 420),
    uiRoot: { appendChild() {}, querySelectorAll: () => [] },
    audio: new AudioEngine(),
    input: null,
    menus: { showChoice() {}, showDebrief() {} },
    onMissionEnd(mission, success, reason) { game.endReason = reason; game.endSuccess = success; }
  };
  const save = { heat: 0, reputation: { state: 50, market: 50, circle: 50 }, flags: {}, stats: {}, faction: 'circle' };
  const mission = new Mission(game, 'faction', save);
  mission.build();
  mission.start();
  mission.setAlarm(mission.guards[0]);
  mission.update(0.016, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, fire: false, holdBreath: false, sprint: false, scopeToggle: false, stanceToggle: false, cameraToggle: false, pause: false, interact: false });
  assert.equal(game.endSuccess, false, 'échec attendu (alarme sous contrainte Cercle)');
  assert.ok(game.endReason.includes('alarme'), 'raison explicite');
});
