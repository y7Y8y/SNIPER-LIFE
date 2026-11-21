import { Engine, Vector3 } from '@babylonjs/core';
import './styles.css';
import { createWind } from './core/wind.ts';
import { dropMil, simulateShot } from './core/ballistics.ts';
import { QualityGovernor, RollingFps, QUALITY_LEVELS } from './core/perf.ts';
import type { QualityLevel } from './core/perf.ts';
import { loadSave, requestPersistentStorage, writeSave } from './core/save.ts';
import { createWorld, hillHeight } from './render/world.ts';
import { createGrassField } from './render/grass.ts';
import { createWindFlags } from './render/indicators.ts';
import { createMannequin } from './render/targets.ts';
import { Rig } from './render/rig.ts';
import { drawTrajectory, makePicker } from './render/shot.ts';
import type { LinesMesh, Scene } from '@babylonjs/core';
import { initAudio } from './audio.ts';
import type { AudioBuses } from './audio.ts';
import {
  initHud,
  setGlare,
  setScopeVisible,
  showHint,
  updateFpsMeter,
  updateQualityMeter,
  updateWind,
} from './ui/hud.ts';
import { bindTouchControls } from './ui/touch.ts';

type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockSentinelLike> };

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
}

const SUN_DIR = new Vector3(-0.42, -0.62, 0.34).normalize();
const MUZZLE_VELOCITY = 810;
const QUALITY_LABELS = ['basse', 'moyenne', 'haute'] as const;

const hud = initHud();

let engine: Engine | null = null;
let scene: Scene | null = null;
let rig: Rig | null = null;
let audio: AudioBuses | null = null;
let grass: ReturnType<typeof createGrassField> | null = null;
let picker: ReturnType<typeof makePicker> | null = null;
let trajectory: LinesMesh | null = null;
let currentQuality: QualityLevel = QUALITY_LEVELS[QUALITY_LEVELS.length - 1]!;
let wakeLock: WakeLockSentinelLike | null = null;

const wind = createWind();
const rollingFps = new RollingFps();
const governor = new QualityGovernor();

const state = {
  time: 0,
  stick: { strafe: 0, forward: 0 },
  keys: new Set<string>(),
  gyro: {
    enabled: false,
    lastAlpha: null as number | null,
    lastBeta: null as number | null,
    hasBaseline: false,
  } as { enabled: boolean; lastAlpha: number | null; lastBeta: number | null; hasBaseline: boolean },
};

async function requestWakeLock(): Promise<void> {
  const nav = navigator as unknown as { wakeLock?: WakeLockApi };
  try {
    if (nav.wakeLock && (wakeLock === null || wakeLock.released)) {
      wakeLock = await nav.wakeLock.request('screen');
    }
  } catch {
    /* wake lock is best-effort */
  }
}

function applyQuality(quality: QualityLevel): void {
  if (engine === null) {
    return;
  }
  currentQuality = quality;
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio) / quality.resolutionScale);
  if (scene !== null && grass !== null) {
    scene.removeMesh(grass.mesh);
    grass.mesh.dispose();
    grass = null;
  }
  if (scene !== null && rig !== null) {
    grass = createGrassField(engine, scene, hillHeight, quality.grassDensity);
    grass.setCamera(rig.camera.position.clone());
  }
  updateQualityMeter(hud.qualityMeter, QUALITY_LABELS[governor.levelIndex] ?? QUALITY_LABELS[0]!);
  rebuildShadowTargets();
}

function rebuildShadowTargets(): void {
  if (scene === null) {
    return;
  }
  const ground = scene.getMeshByName('ground');
  if (ground !== null) {
    ground.receiveShadows = currentQuality.shadows;
  }
}

function updateSunGlare(): void {
  if (rig === null) {
    return;
  }
  const forward = rig.camera.getForwardRay().direction;
  const dot = Vector3.Dot(forward, SUN_DIR);
  const amount = Math.max(0, (dot - 0.98) / 0.02);
  setGlare(hud.glare, amount);
  if (amount > 0.4) {
    showHint(hud.hint, 'Reflet de lunette, position exposée', 2500);
  }
}

function fire(): void {
  if (rig === null || scene === null || picker === null) {
    return;
  }
  const camera = rig.camera;
  const origin = camera.position.clone();
  const forward = camera.getForwardRay(1000).direction.clone();
  const shot = simulateShot({
    origin: { x: origin.x, y: origin.y, z: origin.z },
    direction: { x: forward.x, y: forward.y, z: forward.z },
    muzzleVelocity: MUZZLE_VELOCITY,
    wind: wind.sample(state.time),
    resolveMaterial: (from, to) => picker!.resolveMaterial(from, to),
  });
  trajectory = drawTrajectory(scene, shot, trajectory);
  audio?.fire();
  if (shot.hit !== null) {
    const distance = Math.hypot(
      shot.hit.position.x - origin.x,
      shot.hit.position.y - origin.y,
      shot.hit.position.z - origin.z,
    );
    audio?.impactDistance(distance);
    showHint(
      hud.hint,
      `Impact ${shot.hit.material} à ${Math.round(distance)} m — temps de vol ${(shot.hit.time * 1000).toFixed(0)} ms, énergie restante ${(shot.hit.remainingEnergy * 100).toFixed(0)} %`,
    );
  } else {
    showHint(
      hud.hint,
      `Manqué — chute de balle ${dropMil(MUZZLE_VELOCITY, 300).toFixed(1)} mrad à 300 m, pas d'obstacle touché`,
    );
  }
}


function toggleScope(value: boolean): void {
  rig?.setScoped(value);
  setScopeVisible(hud.scopeOverlay, value);
}

function cyclePosture(): void {
  if (rig === null) {
    return;
  }
  const next = rig.cyclePosture();
  showHint(hud.hint, `Posture : ${next}`, 1800);
}

function bindInput(): void {
  bindTouchControls(document.body, {
    onStick: (strafe, forward) => {
      state.stick.strafe = strafe;
      state.stick.forward = forward;
    },
    onLook: (dxPx, dyPx, firstMove) => {
      if (rig === null || firstMove) {
        return;
      }
      const dt = 1 / 60;
      rig.lookDeltaX(dxPx, dt);
      rig.lookDeltaY(dyPx, dt);
    },
    onScope: toggleScope,
    onBreath: (active) => {
      rig?.setBreathHold(active);
    },
    onFire: fire,
    onPosture: cyclePosture,
    onFocus: () => audio?.resume(),
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    state.keys.add(key);
    if (key === 'z') {
      toggleScope(rig !== null && !rig.scoped);
    }
    if (key === 'c') {
      cyclePosture();
    }
    if (key === ' ') {
      event.preventDefault();
      fire();
    }
  });
  window.addEventListener('keyup', (event) => {
    state.keys.delete(event.key.toLowerCase());
  });
}

function syncKeyboardToStick(): void {
  let strafe = 0;
  let forward = 0;
  if (state.keys.has('w') || state.keys.has('arrowup')) {
    forward += 1;
  }
  if (state.keys.has('s') || state.keys.has('arrowdown')) {
    forward -= 1;
  }
  if (state.keys.has('a') || state.keys.has('arrowleft')) {
    strafe -= 1;
  }
  if (state.keys.has('d') || state.keys.has('arrowright')) {
    strafe += 1;
  }
  if (strafe !== 0 || forward !== 0) {
    state.stick.strafe = strafe;
    state.stick.forward = forward;
  }
}

function start(): void {
  if (engine !== null) {
    return;
  }
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const babylonEngine = new Engine(canvas, true, { powerPreference: 'high-performance', stencil: false }, true);
  engine = babylonEngine;

  const world = createWorld(engine);
  scene = world.scene;
  scene.skipPointerMovePicking = true;
  picker = makePicker(scene);

  rig = new Rig(scene, new Vector3(0, 0, 260), 'realiste');
  rig.camera.position.y = hillHeight(0, 260) + 1.7;
  scene.activeCamera = rig.camera;

  const dummy = createMannequin(scene, 'target', new Vector3(300, 0, 260), 1);
  dummy.mesh.position.y = hillHeight(300, 260);
  scene.addMesh(dummy.mesh);

  for (const mesh of scene.meshes) {
    if (mesh.metadata !== undefined && (mesh.metadata as { material?: string }).material !== undefined) {
      world.shadows.addShadowCaster(mesh);
    }
  }
  world.shadows.addShadowCaster(dummy.mesh);
  world.ground.receiveShadows = true;

  const flags = createWindFlags(scene, [
    new Vector3(40, hillHeight(40, 80), 80),
    new Vector3(-120, hillHeight(-120, 160), 160),
    new Vector3(180, hillHeight(180, -120), -120),
  ]);

  applyQuality(governor.quality);

  bindInput();

  engine.runRenderLoop(() => {
    if (scene === null || rig === null || audio === null) {
      return;
    }
    const dt = Math.min(engine!.getDeltaTime() / 1000, 0.1);
    state.time += dt;

    syncKeyboardToStick();
    const sample = wind.sample(state.time);
    grass?.setWind(sample, state.time);
    flags.setWind(sample, state.time);
    grass?.setCamera(rig.camera.position);
    audio.setWind(sample.speed);
    updateWind(hud.windDirection, hud.windSpeed, { directionDeg: sample.direction, speed: sample.speed });

    rig.move(state.stick.strafe, state.stick.forward, dt, hillHeight);
    rig.update(dt, state.time);

    updateSunGlare();
    scene.render();

    const fps = engine!.getFps();
    rollingFps.push(fps);
    updateFpsMeter(hud.fpsMeter, rollingFps.average);
    if (rollingFps.stable) {
      const step = governor.onFrame(rollingFps.average, dt * 1000);
      if (step === 'down') {
        applyQuality(governor.quality);
        showHint(hud.hint, 'Qualité réduite', 2500);
      } else if (step === 'up') {
        applyQuality(governor.quality);
        showHint(hud.hint, 'Qualité augmentée', 2500);
      }
    }
  });

  hud.touchStart.classList.add('hidden');
  hud.hud.classList.remove('hidden');
}

function ensureGyroPermission(): void {
  const deviceOrientation = globalThis.DeviceOrientationEvent as
    | { requestPermission?: () => Promise<'granted' | 'denied'> }
    | undefined;
  const request = deviceOrientation?.requestPermission;
  if (typeof request === 'function') {
    request
      .call(globalThis.DeviceOrientationEvent)
      .then((answer) => {
        state.gyro = { ...state.gyro, enabled: answer === 'granted' };
      })
      .catch(() => {
        state.gyro.enabled = false;
      });
  } else {
    state.gyro.enabled = 'DeviceOrientationEvent' in globalThis;
  }
}

window.addEventListener('deviceorientation', (event) => {
  if (!state.gyro.enabled || rig === null || !rig.scoped) {
    state.gyro.hasBaseline = false;
    return;
  }
  if (state.gyro.lastAlpha !== null && state.gyro.hasBaseline) {
    const dAlpha = (event.alpha ?? 0) - state.gyro.lastAlpha;
    const dBeta = (event.beta ?? 0) - (state.gyro.lastBeta ?? 0);
    if (Math.abs(dAlpha) < 5) {
      rig.applyGyroAlphaDelta(dAlpha * 0.4);
    }
    if (Math.abs(dBeta) < 5) {
      rig.applyGyroBetaDelta(dBeta * 0.4);
    }
  } else {
    state.gyro.hasBaseline = true;
  }
  state.gyro.lastAlpha = event.alpha;
  state.gyro.lastBeta = event.beta;
});

function bindLifecycle(): void {
  hud.touchStart.addEventListener('pointerdown', () => {
    if (audio === null) {
      audio = initAudio();
    }
    audio?.resume();
    void requestWakeLock();
    ensureGyroPermission();
    start();
  });

  const orientationQuery = window.matchMedia('(orientation: portrait)');
  const onOrientationChange = (): void => {
    hud.portraitWarning.classList.toggle('hidden', !orientationQuery.matches);
  };
  orientationQuery.addEventListener('change', onOrientationChange);
  onOrientationChange();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      audio?.resume();
      void requestWakeLock();
    } else {
      audio?.suspend();
    }
  });

  window.addEventListener('resize', () => {
    engine?.resize();
  });

  void loadSave().then((save) => {
    void requestPersistentStorage();
    void writeSave(save);
  });
}

bindLifecycle();
