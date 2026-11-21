/* SNIPER-LIFE — orchestrateur : rendu, boucle, etats de jeu, sauvegarde. */

import * as THREE from 'three';
import './style.css';
import { InputController, InputState } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { loadSave, writeSave, defaultSave } from './core/save.js';
import { getMissionDef, nextMissionId, EPISODES } from './game/campaign.js';
import { Mission } from './game/mission.js';
import { Menus } from './ui/menus.js';
import { isTouch } from './core/input.js';

class Game {
  constructor() {
    this.uiRoot = document.getElementById('ui');
    this.canvas = document.getElementById('gl');
    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.mission = null;
    this.inputState = new InputState();
    this.input = null;
    this.audio = new AudioEngine();
    this.save = loadSave();
    this.mode = 'boot'; // boot | menu | brief | run | pause | screen
    this.renderActive = false;
    this.fpsAvg = 60;
    this.resScale = 1;
    this.lastT = performance.now();
    this.menus = new Menus(this);
  }

  boot() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 420);
    this.resize();

    this.input = new InputController(this.canvas, this.inputState);
    this.input.tapFireCheck = () => this.mission?.player?.scoped === true;
    this.input.onWheel = (dir) => {
      if (this.mission && this.playerScoped()) {
        this.mission.player.zoom = Math.min(1, Math.max(0, this.mission.player.zoom - dir * 0.25));
      }
    };

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'run') this.showPause();
    });

    // premier geste : reveiller l'audio (politique iOS)
    const wake = () => {
      this.audio.resume();
      this.audio.setVolume(this.save?.settings?.volume ?? 0.8);
    };
    window.addEventListener('pointerdown', wake, { once: false });
    window.addEventListener('keydown', wake, { once: false });

    this.showLoading();
  }

  playerScoped() {
    return this.mission?.player?.scoped ?? false;
  }

  showLoading() {
    const el = document.createElement('div');
    el.id = 'loading';
    el.innerHTML = '<div class="wordmark">SNIPER—LIFE</div>';
    document.getElementById('app').appendChild(el);
    setTimeout(() => {
      el.remove();
      this.mode = 'menu';
      this.menus.showMainMenu();
    }, 700);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyResolution();
  }

  applyResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr * this.resScale);
    const h = Math.floor(window.innerHeight * dpr * this.resScale);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
  }

  /* ---------- campagne ---------- */

  newCampaign() {
    this.save = defaultSave();
    writeSave(this.save);
    this.startCampaign(this.save);
  }

  startCampaign(save) {
    this.save = save;
    const id = nextMissionId(save);
    if (!id) {
      if (save.missionIndex !== null && save.missionIndex >= 2) {
        this.menus.showEpilogue(() => this.menus.showMainMenu());
      } else {
        // pas de faction encore : choisir (apres interruption du prologue)
        this.menus.showFactionChoice(save, (f) => {
          save.missionIndex = 1;
          writeSave(save);
          this.launchMissionFlow('faction');
        });
      }
      return;
    }
    this.launchMissionFlow(id);
  }

  launchMissionFlow(id) {
    const def = getMissionDef(id, this.save);
    if (!def) { this.menus.showMainMenu(); return; }
    this.menus.showBriefing(def, this.save, () => {
      this.startMission(id);
    });
  }

  startMission(id) {
    this.disposeMission();
    this.mission = new Mission(this, id, this.save);
    this.mission.build();
    this.mission.start();
    this.scene = this.mission.scene;
    this.mode = 'run';
    this.renderActive = true;
    if (this.mission.def.tutorial) {
      setTimeout(() => this.mission.toast('Joystick gauche : bouger. Glissez à droite : regarder. Posture/C : s’accroupir ou se coucher.'), 900);
      setTimeout(() => this.mission.toast('Apnée (Maj ou bouton) : ne l’utilisez qu’au moment du tir.'), 6500);
    }
  }

  disposeMission() {
    if (this.mission) {
      this.mission.dispose();
      this.mission = null;
    }
    if (this.scene) { this.scene = null; }
    this.renderActive = false;
    document.getElementById('vignette')?.classList.remove('stress', 'alert');
  }

  onMissionEnd(mission, success, reason) {
    this.mode = 'screen';
    this.renderActive = false;
    const save = this.save;
    save.stats.shots += mission.stats.shots;
    save.stats.kills += mission.kills;
    save.stats.playSeconds += Math.floor(mission.time);
    if (!success) save.stats.failMissions += 1;
    if (success) {
      save.stats.missions += 1;
      if (mission.def.id === 'scout') save.missionIndex = 1;
      else if (mission.def.id === 'faction') save.missionIndex = 2;
      save.stats.spares += save.flags.vossSpared || save.flags.sparedRadec ? 1 : 0;
    }
    writeSave(save);

    this.menus.showDebrief(mission, success, reason, (nextId) => {
      if (!success) {
        this.launchMissionFlow(nextId);
        return;
      }
      if (save.missionIndex === 1 && !save.faction) {
        // fin du prologue : interruption narrative -> choix de faction
        this.menus.showFactionChoice(save, (f) => {
          save.missionIndex = 1;
          writeSave(save);
          this.launchMissionFlow('faction');
        });
      } else if (save.missionIndex >= 2) {
        this.menus.showEpilogue(() => {
          this.mode = 'menu';
          this.menus.showMainMenu();
        });
      } else {
        this.launchMissionFlow(nextId);
      }
    });
  }

  showPause() {
    if (this.mode !== 'run') return;
    this.mode = 'pause';
    this.renderActive = false;
    this.menus.showPause(
      () => { this.mode = 'run'; this.renderActive = true; },
      () => {
        this.disposeMission();
        this.mode = 'menu';
        this.menus.showMainMenu();
      }
    );
  }

  /* ---------- boucle ---------- */

  frame() {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;

    if (this.mode === 'run' && this.renderActive && this.mission) {
      if (this.inputState.pause) {
        this.inputState.consumeImpulses();
        this.showPause();
        return;
      }
      this.mission.update(dt, this.inputState);
      this.inputState.consumeImpulses();
    } else {
      this.inputState.consumeImpulses();
    }

    if (this.renderer && this.scene && this.renderActive) {
      this.renderer.render(this.scene, this.camera);
    }

    // resolution dynamique : garder >= 45 fps sur l'iPhone
    this.fpsAvg = this.fpsAvg * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    if (this.fpsAvg < 42 && this.resScale > 0.62) {
      this.resScale = Math.max(0.62, this.resScale - 0.06);
      this.applyResolution();
    } else if (this.fpsAvg > 58 && this.resScale < 1) {
      this.resScale = Math.min(1, this.resScale + 0.03);
      this.applyResolution();
    }
  }
}

const game = new Game();
game.boot();
game.frame();

// hint PWA (ajout a l'ecran d'accueil) en developpement desktop
if (!isTouch()) {
  console.info('[SNIPER-LIFE] Astuce : sur iPhone, ouvrez une fois la page, puis "Sur l’écran d’accueil" pour le mode plein écran hors ligne.');
}
