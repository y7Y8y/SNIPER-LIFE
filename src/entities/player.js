/* Le sniper : postures, deplacements, apnee, stress, FPS/TPS, lunette, tirs.
   Rien de magique : le meme controleur sert au prologue et aux contrats. */

import * as THREE from 'three';
import { terrainHeight } from '../world/terrain.js';
import { clamp, dampf, fbm2, angleDelta } from '../core/math.js';
import { STANCE_HEIGHT } from './character.js';

const SPEED = { 0: 3.4, 1: 1.7, 2: 0.75 };
const VIS_MULT = { 0: 1.0, 1: 0.55, 2: 0.22 };

export class Player {
  constructor(scene, camera, spawn) {
    this.camera = camera;
    this.x = spawn.x;
    this.z = spawn.z;
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.stance = 0;
    this.stanceTarget = 0;
    this.scoped = false;
    this.zoom = 0;              // 0..1 (4x -> 8x progressif via molette)
    this.camMode = 'fps';       // 'fps' | 'tps'
    this.breath = 1;
    this.stamina = 1;
    this.stress = 0;
    this.health = 100;
    this.alive = true;
    this.invisible = false;
    this.currentSpeed01 = 0;
    this.recoil = 0;
    this.recoilVel = 0;
    this.swayT = 0;
    this.bobPhase = 0;
    this.stepAccum = 0;
    this.forcedExhale = 0;
    this.fireImpulseHandler = null;
    this.heartbeatTimer = 0;
    this.onFireBullet = null;
    this.aimDir = new THREE.Vector3(0, 0, -1);

    // modele 3e personne (main armee visible en TPS)
    this.model3p = null;
  }

  get eyeHeight() {
    const base = STANCE_HEIGHT[this.stance];
    const target = Math.round(base * 100) / 100;
    return this._eyeH === undefined ? base : dampf(this._eyeH, target, 9, 0.016);
  }

  visibilityFactor() {
    const stanceM = VIS_MULT[this.stance] ?? 1;
    const moveM = 1 + this.currentSpeed01 * 0.6;
    return clamp(stanceM * moveM, 0.15, 2);
  }

  takeDamage(dmg, mission) {
    if (!this.alive) return;
    this.health -= dmg;
    this.stress = clamp(this.stress + 0.25, 0, 1);
    if (mission && mission.hud) mission.hud.hitFlash();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      if (mission) mission.fail('Vous avez été abattu.');
    }
  }

  toggleScope(lockZoom) {
    if (this.alive) {
      this.scoped = !this.scoped;
      if (!this.scoped) this.zoom = 0;
      else if (lockZoom !== undefined) this.zoom = lockZoom;
    }
  }

  cycleStance() {
    this.stanceTarget = (this.stanceTarget + 1) % 3;
    if (this.stanceTarget === 2) this.stance = 2;
    else this.stance = this.stanceTarget;
  }

  currentFov() {
    // 70 -> 18 degres selon le zoom de lunette
    const z01 = clamp(this.zoom, 0, 1);
    const base = this.scoped ? 45 - 27 * z01 : 70;
    return base;
  }

  update(dt, input, world, mission, audio) {
    if (this.alive === false) {
      this.updateCamera(dt, mission);
      return;
    }

    // impulsions
    if (input.scopeToggle) this.toggleScope();
    if (input.stanceToggle) this.cycleStance();
    if (input.cameraToggle) this.camMode = this.camMode === 'fps' ? 'tps' : 'fps';

    // posture transition douce
    this.stance = this.stanceTarget;

    // regard
    const sens = this.scoped ? 0.35 * (1 - this.zoom * 0.5) : 1;
    this.yaw -= input.look.dx * sens;
    this.pitch = clamp(this.pitch - input.look.dy * sens, -1.35, 1.35);
    input.look.dx = 0; input.look.dy = 0;

    // deplacement
    const scopedSlow = this.scoped ? 0.35 : 1;
    const baseSpeed = SPEED[this.stance] * scopedSlow * (input.sprint && this.stance === 0 ? 1.7 : 1);
    let spd = baseSpeed;
    if (this.stress > 0.85) spd *= 0.9;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const move = new THREE.Vector3()
      .addScaledVector(forward, input.move.y)
      .addScaledVector(right, input.move.x);
    const moving = move.lengthSq() > 0.0004;
    if (moving) {
      move.normalize();
      const nx = this.x + move.x * spd * dt;
      const nz = this.z + move.z * spd * dt;
      if (this._free(nx, this.z, world)) this.x = nx;
      if (this._free(this.x, nz, world)) this.z = nz;
      this.x = clamp(this.x, -122, 122);
      this.z = clamp(this.z, -122, 122);
    }

    const speedReal = moving ? spd : 0;
    this.currentSpeed01 = clamp(speedReal / (SPEED[0] * 1.7), 0, 1);
    this.bobPhase += dt * (moving ? speedReal * 2.6 : 0);

    // sprint/breath/stress
    if (input.sprint && this.stance === 0 && moving) {
      this.stamina = clamp(this.stamina - dt * 0.22, 0, 1);
    } else {
      this.stamina = clamp(this.stamina + dt * 0.09, 0, 1);
    }

    // apnee
    const wantHold = input.holdBreath && this.breath > 0.02 && this.scoped;
    this.holdingBreath = wantHold;
    if (wantHold) {
      this.breath = clamp(this.breath - dt * 0.30, 0, 1);
      if (this.breath <= 0.001) {
        this.forcedExhale = 1.6;
        if (audio) audio.gasp();
        this.stress = clamp(this.stress + 0.12, 0, 1);
      }
    } else {
      const regen = this.forcedExhale > 0 ? 0.28 : 0.16;
      this.breath = clamp(this.breath + dt * regen, 0, 1);
    }
    this.forcedExhale = Math.max(0, this.forcedExhale - dt);

    // stress suit l'alarme et la sante
    let stressTarget = (mission ? mission.alarmLevel * 0.45 : 0) + (1 - this.health / 100) * 0.5;
    if (this.forcedExhale > 0) stressTarget += 0.2;
    this.stress = dampf(this.stress, clamp(stressTarget, 0, 1), 0.8, dt);

    // battements de coeur
    if (audio && audio.ctx) {
      this.heartbeatTimer -= dt;
      const hb = Math.max(this.stress, this.holdingBreath ? this.breath * 0.8 : 0);
      if (hb > 0.25 && this.heartbeatTimer <= 0) {
        audio.heartbeat(hb);
        this.heartbeatTimer = 1.4 - hb * 0.7;
      }
    }

    // pas
    if (moving && audio) {
      this.stepAccum += speedReal * dt;
      const stride = this.stance === 2 ? 2.6 : (this.stance === 1 ? 1.3 : 1.7);
      if (this.stepAccum > stride) {
        this.stepAccum = 0;
        audio.step(distToNearestGuard(this, mission), this.stance === 0 && speedReal > 3.6);
      }
    }

    // recul
    this.recoilVel += (-this.recoil * 60 - this.recoilVel * 9) * dt;
    this.recoil += this.recoilVel * dt;

    // tir
    if (input.fire) {
      input.fire = false;
      this.tryFire(world, mission, audio);
    }

    this.updateCamera(dt, mission);

    // stress vignette
    if (mission && mission.hud) mission.hud.setStress(this.stress, this.breath, this.health);
  }

  tryFire(world, mission, audio) {
    if (!this.alive) return;
    if (mission && mission.ammo <= 0) {
      mission.toast('Plus de munitions.', true);
      return;
    }
    if (mission) mission.ammo -= 1;
    if (mission) mission.stats.shots += 1;

    const dir = this.aimDirection();
    const origin = this.muzzleWorld(dir);

    // tir realiste : le bras tremble, la balle part ou le canon pointe reellement
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.lastSwayYaw || 0);
    dir.y += this.lastSwayPitch || 0;
    dir.normalize();

    world.bullets.fire(origin, dir, 790, true);
    if (audio) audio.playerGunshot();
    this.recoilVel += 2.2;
    this.stress = clamp(this.stress + 0.08, 0, 1);

    // le craquement reveille la vallee
    if (mission) {
      mission.gunfireHappened(origin);
    }
  }

  aimDirection() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return dir;
  }

  muzzleWorld(dir) {
    const p = new THREE.Vector3(this.x, this.camera.position.y ?? terrainHeight(this.x, this.z) + 1.6, this.z);
    // en FPS, sortie approximative du canon (legerement devant-droite)
    const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
    p.addScaledVector(dir, 0.6);
    p.addScaledVector(right, 0.15);
    return p;
  }

  computeSway(dt, mission) {
    this.swayT += dt;
    const stanceStill = 1 - this.currentSpeed01 * 0.8;
    let amp = (this.scoped ? 0.0032 : 0.0016) * (this.stance === 2 ? 0.35 : this.stance === 1 ? 0.65 : 1);
    amp *= stanceStill;
    amp *= 1 + this.stress * 1.6;
    if (this.forcedExhale > 0) amp *= 2.6;
    const hold = this.holdingBreath ? 0.12 : 1;
    amp *= hold;
    const n1 = fbm2(this.swayT * 0.9, 0.5, 301, 2) - 0.5;
    const n2 = fbm2(0.3, this.swayT * 0.9, 601, 2) - 0.5;
    // derive du vent
    const windPush = mission && mission.weatherCurrent ? (mission.weatherCurrent.wind ?? 0.3) * 0.0008 : 0;
    this.lastSwayYaw = (n1 * amp + windPush * Math.sin(this.swayT * 0.6));
    this.lastSwayPitch = n2 * amp;
  }

  updateCamera(dt, mission) {
    this._eyeH = dampf(this._eyeH ?? STANCE_HEIGHT[0], STANCE_HEIGHT[this.stance], 9, dt);
    const groundY = terrainHeight(this.x, this.z);
    this.computeSway(dt, mission);

    if (this.alive === false) {
      // chute au sol
      this._eyeH = dampf(this._eyeH ?? 1.7, 0.3, 3, dt);
    }

    if (this.camMode === 'fps') {
      const bob = Math.sin(this.bobPhase * 2) * 0.035 * this.currentSpeed01;
      const swayY = Math.sin(this.bobPhase) * 0.02 * this.currentSpeed01;
      this.camera.position.set(this.x, groundY + this._eyeH + bob, this.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw + Math.PI + (this.lastSwayYaw || 0);
      this.camera.rotation.x = this.pitch + (this.lastSwayPitch || 0) + this.recoil * 0.05 + this.scoped * swayY * 0.25;
      this.camera.rotation.z = 0;
      if (this.model3p) this.model3p.visible = false;
    } else {
      const dist = this.scoped ? 2.6 : 4.6;
      const height = this._eyeH + (this.scoped ? 0.35 : 0.9);
      const back = new THREE.Vector3(Math.sin(this.yaw + Math.PI), 0, Math.cos(this.yaw + Math.PI)).multiplyScalar(dist);
      const camX = this.x + back.x;
      const camZ = this.z + back.z;
      const camY = Math.max(groundY + height, terrainHeight(camX, camZ) + 0.4);
      this.camera.position.set(camX, camY, camZ);
      const look = new THREE.Vector3(this.x, groundY + (this._eyeH ?? 1.7) + 0.2, this.z);
      this.camera.lookAt(look);
      this.camera.rotation.y += (this.lastSwayYaw || 0);
      this.camera.rotation.x += -(this.lastSwayPitch || 0);
      if (this.model3p) this.model3p.visible = true;
      if (this.model3p) {
        this.model3p.position.set(this.x, groundY, this.z);
        this.model3p.rotation.y = this.yaw + Math.PI;
      }
    }

    const fovTarget = this.currentFov();
    this.camera.fov = dampf(this.camera.fov, fovTarget, 10, dt);
    this.camera.updateProjectionMatrix();
  }

  pos() {
    return { x: this.x, z: this.z };
  }

  _free(x, z, world) {
    const r = 0.42;
    for (const c of world.colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return false;
    }
    return true;
  }

  /* le garde voit-il vraiment le corps/le joueur ? (occultation simple par batiments) */
  exposedTo(gx, gz, guard) {
    // teste sous 1.1m (toujours sous toits) et a hauteur des yeux
    for (const o of worldOccluders(guard)) {
      if (segmentLowBlocks(this.x, this.z, gx, gz, o, guard)) return false;
    }
    return true;
  }
}

function worldOccluders(guard) {
  return guard.occluders || [];
}

function segmentLowBlocks(x1, z1, x2, z2, box, guard) {
  const eyeY = guard ? 1.5 : 1.5;
  if ((box.height ?? 0) < (eyeY - 1.2)) return false;
  // segment 2D vs AABB + verif hauteur a l'entree
  const invX = 1 / ((x2 - x1) || 1e-9);
  const invZ = 1 / ((z2 - z1) || 1e-9);
  const t0x = (box.minX - x1) * invX;
  const t1x = (box.maxX - x1) * invX;
  const t0z = (box.minZ - z1) * invZ;
  const t1z = (box.maxZ - z1) * invZ;
  const tEnter = Math.max(Math.min(t0x, t1x), Math.min(t0z, t1z));
  const tExit = Math.min(Math.max(t0x, t1x), Math.max(t0z, t1z));
  if (tEnter > tExit || tExit < 0 || tEnter > 1) return false;
  return true;
}

function distToNearestGuard(player, mission) {
  if (!mission) return 0;
  let best = 999;
  for (const g of mission.guards) {
    if (g.dead) continue;
    const d = Math.hypot(g.x - player.x, g.z - player.z);
    if (d < best) best = d;
  }
  return best === 999 ? 0 : best;
}
