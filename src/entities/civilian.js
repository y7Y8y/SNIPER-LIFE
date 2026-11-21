/* Civils : vies paisibles, panique credible. Ils fuient le danger, se terrent, temoignent. */

import * as THREE from 'three';
import { terrainHeight } from '../world/terrain.js';
import { angleDelta, clamp } from '../core/math.js';
import { animateHumanoid } from './character.js';

export class Civilian {
  constructor(spec, scene) {
    this.name = spec.name ?? 'Civil';
    this.home = spec.home;
    this.roamRadius = spec.roamRadius ?? 8;
    this.routine = spec.routine ?? null; // [{x,z,wait}]
    this.routineIndex = 0;
    this.waitTimer = Math.random() * 3;
    this.mode = 'routine'; // routine | flee | cower
    this.fleeDir = Math.random() * Math.PI * 2;
    this.speed = 1.0;
    this.speed01 = 0;
    this.stance = 0;
    this.dying = -1;
    this.dead = false;
    this.yaw = Math.random() * Math.PI * 2;
    this.isTarget = !!spec.isTarget;
    this.targetName = spec.targetName ?? null;
    this.essential = !!spec.essential;
    this.model = spec.model;
    this.group = spec.model.group;
    scene.add(this.group);
    this.setPos(spec.pos ? spec.pos.x : spec.home.x, spec.pos ? spec.pos.z : spec.home.z);
    this.x = this.group.position.x;
    this.z = this.group.position.z;
  }

  setPos(x, z) {
    this.group.position.set(x, terrainHeight(x, z), z);
    this.x = x; this.z = z;
  }

  onDanger(pos, mission) {
    if (this.dead || this.mode === 'flee') return;
    this.mode = 'flee';
    const dx = this.x - pos.x, dz = this.z - pos.z;
    this.fleeDir = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.8;
    mission.toast(`${this.name} panique.`, false, true);
  }

  update(dt, ctx) {
    if (this.dead) {
      if (this.dying < 1) {
        this.dying = Math.min(1, this.dying + dt * 2.2);
        animateHumanoid(this.model, dt, 0, 0, this.dying);
      }
      return;
    }
    const { mission } = ctx;

    if (this.mode === 'flee') {
      const speed = 3.1;
      const nx = this.x + Math.sin(this.fleeDir) * speed * dt;
      const nz = this.z + Math.cos(this.fleeDir) * speed * dt;
      if (Math.hypot(nx, nz) < 116 && this._free(nx, nz, mission)) { this.x = nx; this.z = nz; }
      else { this.fleeDir += 0.9; }
      this.faceDir(this.fleeDir, dt, 6);
      this.speed01 = 1;
      // s'est terre après une course
      this.cowerTimer = (this.cowerTimer ?? 6 + Math.random() * 5) - dt;
      if (this.cowerTimer <= 0) { this.mode = 'cower'; this.stance = 1; }
    } else if (this.mode === 'cower') {
      this.speed01 = 0;
      this.stance = 1;
      this.cowerTimer = (this.cowerTimer ?? 12) - dt;
      if (this.cowerTimer <= 0 && mission.alarmLevel === 0) {
        this.mode = 'routine';
        this.stance = 0;
      }
    } else {
      const target = this.routine
        ? this.routine[this.routineIndex]
        : { x: this.home.x + Math.sin(this.waitTimer * 0.25) * this.roamRadius, z: this.home.z + Math.cos(this.waitTimer * 0.21) * this.roamRadius };
      const dx = target.x - this.x, dz = target.z - this.z;
      const d = Math.hypot(dx, dz);
      if (this.routine && d < 0.9) {
        this.speed01 = 0;
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) {
          this.routineIndex = (this.routineIndex + 1) % this.routine.length;
          this.waitTimer = 2 + Math.random() * 4;
        }
      } else if (d > 0.8) {
        const speed = 1.0;
        const nx = this.x + (dx / d) * speed * dt;
        const nz = this.z + (dz / d) * speed * dt;
        if (this._free(nx, nz, mission)) { this.x = nx; this.z = nz; }
        this.faceDir(Math.atan2(dx, dz), dt, 4);
        this.speed01 = 0.45;
      } else {
        this.speed01 = 0;
        this.waitTimer -= dt;
        if (!this.routine && this.waitTimer <= 0) {
          this.waitTimer = 2 + Math.random() * 5;
        }
      }
    }

    animateHumanoid(this.model, dt, this.speed01, this.mode === 'cower' ? 1 : 0);
    this.group.rotation.y = this.yaw;
    this.group.position.y = terrainHeight(this.x, this.z);
  }

  faceDir(dir, dt, lambda) {
    this.yaw += angleDelta(this.yaw, dir) * Math.min(1, dt * lambda);
  }

  _free(x, z, mission) {
    const r = 0.45;
    for (const c of mission.colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return false;
    }
    return true;
  }

  kill(mission, byPlayer) {
    if (this.dead) return;
    this.dead = true;
    this.dying = 0;
    this.stance = 0;
    mission.onActorKilled(this, byPlayer);
    mission.onCivilianKilled(this);
  }
}
