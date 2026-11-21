/* Lanceur de mission : construit le monde, pilote les objectifs, l'alerte, l'extraction
   et produit un debrief alimente par les consequences de sauvegarde. */

import * as THREE from 'three';
import { createTerrain, terrainHeight } from '../world/terrain.js';
import { buildVillage } from '../world/buildings.js';
import { createVegetation, updateVegetationWind } from '../world/scatter.js';
import { Environment } from '../world/environment.js';
import { Player } from '../entities/player.js';
import { BulletManager } from '../entities/bullet.js';
import { buildActors, CAUDRES_LAYOUT } from './campaign.js';
import { createHumanoid } from '../entities/character.js';
import { CHOICES, getMissionDef } from './campaign.js';
import { HUD } from '../ui/hud.js';
import { clamp } from '../core/math.js';
import { adjustReputation } from '../core/save.js';

export class Mission {
  constructor(game, missionId, save) {
    this.game = game;
    this.def = getMissionDef(missionId, save);
    this.save = save;
    this.scene = new THREE.Scene();
    this.status = 'brief'; // brief | run | choice | done | failed
    this.objectiveIndex = 0;
    this.objState = {};
    this.markTimer = 0;
    this.alarmLevel = 0;         // menace totale vue par le HUD
    this.alarmRaised = false;
    this.silentFlag = true;
    this.civKills = 0;
    this.kills = 0;
    this.stats = { shots: 0, kills: 0, spares: 0, alarmCount: 0 };
    this.ammo = this.def.ammo ?? 5;
    this.time = 0;
    this.deadActors = [];
    this.pendingChoice = null;
    this.weatherCurrent = null;
  }

  build() {
    const scene = this.scene;
    this.terrain = createTerrain(CAUDRES_LAYOUT);
    scene.add(this.terrain);
    this.env = new Environment(scene);
    this.env.setWeather(this.def.weather, true);
    this.env.timer = 999999; // meteo pilotee par le scenario pendant la mission

    const { colliders, occluders } = buildVillage(scene, CAUDRES_LAYOUT, 7);
    this.colliders = colliders;
    this.occluders = occluders;

    this.veg = createVegetation(scene, 42);
    for (const t of this.veg.treeCircles) {
      this.colliders.push({ minX: t.x - t.r, maxX: t.x + t.r, minZ: t.z - t.r, maxZ: t.z + t.r, height: t.height });
    }

    this.bullets = new BulletManager(scene);

    this.camera = this.game.camera;
    this.player = new Player(scene, this.camera, this.def.spawn);
    const actors = buildActors(this.def, scene, { save: this.save });
    this.guards = actors.guards;
    this.civilians = actors.civilians;

    // la cible bibliothequee : un garde ou un civil specifique au scenario
    this.target = this.findTarget(this.def.objectives.find(o => o.targetName)?.targetName);
    if (this.target) {
      this.target.isTarget = true;
      this.target.essential = true;
    }

    for (const g of this.guards) { g.occluders = occluders; g.worldColliders = colliders; }

    this.hud = new HUD(this.game.uiRoot, this.game.audio, this.player, this.game.input);
    this.hud.showTouchControls(true);
    this.hud.setAmmo(`${this.ammo} balles`);
    this.updateObjectiveHud();

    const playerModel = createHumanoid({ uniform: 0x3f4636, pants: 0x38402c, hat: 0x3f4636, rifle: true });
    this.player.model3p = playerModel.group;
    scene.add(playerModel.group);


    // marker d'extraction discret
    const ringGeo = new THREE.RingGeometry(this.def.extraction.r - 0.4, this.def.extraction.r, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xd99a2b, transparent: true, opacity: 0.5 }));
    const ex = this.def.extraction;
    ring.position.set(ex.x, terrainHeight(ex.x, ex.z) + 0.15, ex.z);
    this.scene.add(ring);
    this.extractionRing = ring;
    this.ringPulse = 0;
  }

  findTarget(name) {
    if (!name) return null;
    const surname = name.split(' ')[0];
    for (const g of this.guards) if (g.name.includes(surname) || g.name === name) return g;
    for (const c of this.civilians) if (c.name.includes(surname) || c.name === name) return c;
    return null;
  }

  currentObjective() {
    return this.def.objectives[this.objectiveIndex] ?? null;
  }

  updateObjectiveHud() {
    const o = this.currentObjective();
    if (o) this.hud.setObjective(o.text);
    else this.hud.setObjective('—');
  }

  dispose() {
    this.hud.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }

  toast(text, warn, quiet) {
    this.hud.toast(text, warn, quiet);
  }

  /* ---------- evenements remontes par les systemes ---------- */

  gunfireHappened(origin) {
    const loudness = this.weatherCurrent ? clamp(1.3 - this.weatherCurrent.rain * 0.75 - this.weatherCurrent.fogDensity * 18, 0.4, 1.3) : 1.2;
    for (const g of this.guards) g.hear(origin, loudness, this);
    for (const c of this.civilians) c.onDanger(origin, this);
    this.silentFlag = false;
  }

  onGuardShoots() {}

  setAlarm(sourceGuard) {
    if (!this.alarmRaised) {
      this.alarmRaised = true;
      this.stats.alarmCount += 1;
      this.toast('Alarme ! Ils vous cherchent.', true);
    }
    this.alarmLevel = 1;
    for (const g of this.guards) {
      if (g.dead) continue;
      if (g !== sourceGuard && (g.state === 'PATROL' || g.state === 'IDLE')) {
        g.setState('INVESTIGATE');
        g.lastKnown = sourceGuard.lastKnown ?? { x: sourceGuard.x, z: sourceGuard.z };
        g.alert = Math.max(g.alert, 0.7);
      }
    }
  }

  onCalmDown() {
    const anyHot = this.guards.some((g) => !g.dead && g.alert > 0.8);
    if (!anyHot) this.alarmLevel = 0;
  }

  onActorKilled(actor, byPlayer) {
    this.deadActors.push({ x: actor.x, z: actor.z, alerted: false, actor, onDiscovered: null });
    if (byPlayer) {
      this.kills += 1;
      if (actor === this.target) {
        this.completeObjective('eliminate');
        this.toast(`${actor.name} — cible neutralisée.`);
      }
      if (actor.isCivilian) this.civKills += 1;
    }
    // reaction des voisins : cri, panique
    for (const g of this.guards) {
      if (g.dead) continue;
      const d = Math.hypot(g.x - actor.x, g.z - actor.z);
      if (d < 26 && g === actor) continue;
      if (d < 12) {
        g.alert = Math.max(g.alert, 0.5);
        g.lastKnown = { x: actor.x, z: actor.z };
        if (g.state === 'PATROL' || g.state === 'IDLE') g.setState('INVESTIGATE');
        if (this.game.audio) this.game.audio.shout(d);
      }
    }
    for (const c of this.civilians) {
      if (!c.dead) c.onDanger({ x: actor.x, z: actor.z }, this);
    }
    // rearget si la cible vit encore
    if (this.target && !this.target.dead && actor !== this.target) {
      if (this.game.audio) this.game.audio.shout(Math.hypot(this.target.x - actor.x, this.target.z - actor.z));
    }
  }

  onCivilianKilled() {
    this.civKills += 1;
    this.toast('Un civil est tombé. Le récit ne l’oubliera pas.', true);
  }

  onConfirmedKill(actor) {
    void actor;
  }

  onBulletImpact() {}

  start() {
    this.status = 'run';
  }

  fail(reason) {
    if (this.status !== 'run') return;
    this.status = 'failed';
    this.failReason = reason;
    this.game.onMissionEnd(this, false, reason);
  }

  succeed() {
    if (this.status !== 'run') return;
    this.status = 'done';
    this.game.onMissionEnd(this, true, null);
  }

  /* décision narrative déclenchée par un objectif 'decide' */
  openChoice(choiceId) {
    const choice = CHOICES[choiceId];
    if (!choice) return;
    this.status = 'choice';
    this.game.menus.showChoice(choice, (optionId, result) => {
      this.applyChoice(result);
      this.status = 'run';
      this.completeObjective('decide');
      this.updateObjectiveHud();
    });
  }

  applyChoice(result) {
    for (const [k, v] of Object.entries(result?.flags ?? {})) this.save.flags[k] = v;
    if (result?.reputation) {
      for (const [fac, delta] of Object.entries(result.reputation)) {
        adjustReputation(this.save, fac, delta);
      }
    }
    this.save.heat = clamp(this.save.heat + (result.heat ?? 0), 0, 100);
    if (result.note) this.toast(result.note);
  }

  completeObjective(kind) {
    const o = this.currentObjective();
    if (!o) return;
    if (o.type === 'decide' && kind === 'eliminate') {
      // cible éliminée sans décision : option par défaut (exécuter)
      this.applyChoice(CHOICES[o.choice]?.options[0]?.result ?? {});
    } else if (o.type !== kind) {
      return;
    }
    this.objectiveIndex += 1;
    this.markTimer = 0;
    this.updateObjectiveHud();
    if (this.game.audio) this.game.audio.ui('confirm');
    if (!this.currentObjective()) this.succeed();
  }

  /* ---------- boucle ---------- */

  update(dt, input) {
    this.time += dt;

    const weather = this.env.update(dt, new THREE.Vector3(this.player.x, this.player.y ?? 0, this.player.z), this.game.audio);
    this.weatherCurrent = weather;
    updateVegetationWind(this.veg, this.time, weather.wind);

    // contenu systemique
    const ctx = { player: this.player, mission: this, weather: this.weatherVisual(), audio: this.game.audio };
    for (const g of this.guards) g.update(dt, ctx);
    for (const c of this.civilians) c.update(dt, ctx);
    this.player.update(dt, input, { colliders: this.colliders }, this, this.game.audio);
    this.bullets.update(dt, {
      player: this.player, guards: this.guards, civilians: this.civilians,
      occluders: this.occluders, audio: this.game.audio, camera: this.camera, mission: this
    });

    // détection des corps et alerte partagée
    this.scanBodies(dt);

    // progression des objectifs
    this.checkObjectives(dt, input);

    // alarme globale? menace max
    let menace = 0;
    for (const g of this.guards) {
      if (g.dead) continue;
      menace = Math.max(menace, clamp(g.alert / 1.2, 0, 1));
    }
    this.alarmLevel = clamp(this.alarmLevel * 0.995 + menace * 0.005, 0, 1);
    this.hud.setAlert(menace);
    void this.alarmLevel;

    this.hud.setStance(this.player.stance);
    this.hud.setWeather(weather.label ?? this.def.weather);
    this.hud.setAmmo(`${this.ammo} balles`);
    this.hud.updateCompass(this.player.yaw);
    this.hud.setScope(this.player.scoped, this.player.zoom, this.player.breath, this.player.holdingBreath);
    this.hud.renderScope(this.player, dt);

    // anneau d'extraction pulse
    this.ringPulse += dt;
    this.extractionRing.material.opacity = 0.35 + Math.sin(this.ringPulse * 2) * 0.25;

    if (this.def.noAlarmLimit && this.alarmRaised) {
      this.fail('L’alarme a sonné. La leçon est ratée.');
    }
  }

  weatherVisual() {
    if (!this._wv) {
      this._wv = {
        get visibilityMul() { return this._vm ?? 1; },
        set visibilityMul(v) { this._vm = v; },
        get conceal() { return this._cc ?? 1; },
        set conceal(v) { this._cc = v; }
      };
    }
    const w = this.weatherCurrent;
    this._wv.visibilityMul = clamp(1.25 - (w ? w.fogDensity * 30 : 0), 0.55, 1.25);
    this._wv.conceal = clamp(1 - (w ? w.rain * 0.35 : 0), 0.6, 1);
    return this._wv;
  }

  scanBodies(dt) {
    void dt;
    for (const g of this.guards) {
      if (g.dead) continue;
      for (const d of this.deadActors) {
        if (d.alerted) continue;
        const dist = Math.hypot(d.x - g.x, d.z - g.z);
        if (dist < 16) {
          d.alerted = true;
          g.alert = Math.max(g.alert, 0.9);
          g.lastKnown = { x: d.x, z: d.z };
          if (g.state === 'PATROL' || g.state === 'IDLE') g.setState('SUSPICIOUS');
          this.toast('Un corps a été découvert.', true);
          this.setAlarm(g);
        }
      }
    }
  }

  checkObjectives(dt, input) {
    void input;
    const o = this.currentObjective();
    if (!o) return;
    const p = this.player.pos();

    if (o.type === 'goto') {
      if (Math.hypot(p.x - o.pos.x, p.z - o.pos.z) < o.radius) {
        this.completeObjective('goto');
        if (this.def.tutorial) this.toast('Poste d’observation atteint. Lunette : bouton en bas à droite (ou clic droit).');
      }
    } else if (o.type === 'mark') {
      if (!this.target) { this.completeObjective('mark'); return; }
      // cible dans la lunette : proche du centre de l'ecran
      if (this.player.scoped) {
        const pos = this.target.group.position;
        this.camera.updateMatrixWorld();
        const projected = pos.clone().project(this.camera);
        const onScreen = projected.z < 1 && Math.abs(projected.x) < 0.09 && Math.abs(projected.y) < 0.09;
        const dist = Math.hypot(pos.x - this.player.x, pos.z - this.player.z);
        if (onScreen && dist > 10) {
          this.markTimer += dt;
          if (this.markTimer >= (o.duration ?? 3)) {
            this.completeObjective('mark');
            if (this.def.tutorial) this.toast('Cible fixée. Le tir se prépare : main ferme, souffle retenu.');
          }
        } else {
          this.markTimer = Math.max(0, this.markTimer - dt * 2);
        }
      }
    } else if (o.type === 'decide') {
      if (o.pos && Math.hypot(p.x - o.pos.x, p.z - o.pos.z) < o.radius && this.status === 'run') {
        this.openChoice(o.choice);
      }
    } else if (o.type === 'eliminate') {
      if (this.target && this.target.dead) {
        this.completeObjective('eliminate');
      }
    } else if (o.type === 'extract') {
      if (Math.hypot(p.x - o.pos.x, p.z - o.pos.z) < o.radius) {
        this.completeObjective('extract');
      }
    }
  }
}
