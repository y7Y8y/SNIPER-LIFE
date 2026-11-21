/* IA des gardes : patrouille, suspicion progressive, investigation, alarme, riposte.
   Perception : distance, cone de vision, posture du joueur, meteo, occultation par batiments. */

import * as THREE from 'three';
import { animateHumanoid } from './character.js';
import { angleDelta, clamp } from '../core/math.js';
import { terrainHeight } from '../world/terrain.js';

export const GState = { PATROL: 'PATROL', IDLE: 'IDLE', SUSPICIOUS: 'SUSPICIOUS', INVESTIGATE: 'INVESTIGATE', COMBAT: 'COMBAT', SEARCH: 'SEARCH', DEAD: 'DEAD' };

let nextId = 1;

export class Guard {
  constructor(spec, scene) {
    this.id = nextId++;
    this.name = spec.name ?? 'Garde';
    this.fov = (spec.fov ?? 110) * Math.PI / 180;
    this.viewDist = spec.viewDist ?? 42;
    this.accuracy = spec.accuracy ?? 0.42;
    this.waypoints = spec.route;
    this.wpIndex = 0;
    this.waitTimer = spec.wait ?? 1.5;
    this.state = spec.idleOnly ? GState.IDLE : GState.PATROL;
    this.alert = 0;
    this.lastKnown = null;
    this.timer = 0;
    this.senseTimer = Math.random() * 0.25;
    this.shootCooldown = 0;
    this.dying = -1;
    this.dead = false;
    this.isTarget = !!spec.isTarget;
    this.targetName = spec.targetName ?? null;
    this.essential = !!spec.essential;
    this.nightVision = spec.nightVision ?? false;
    this.senseSpeed = spec.senseSpeed ?? 1.0;
    this.combatRange = spec.combatRange ?? 34;
    this.yaw = 0;
    this.speedWalk = 1.4;
    this.speedHunt = 2.9;
    this.stance = 0;
    this.speed01 = 0;
    this.searchTimer = 0;
    this.searchDir = Math.random() * Math.PI * 2;
    this.radio = spec.radio !== false;
    this.spareable = spec.spareable ?? true;

    this.model = spec.model;
    this.group = spec.model.group;
    scene.add(this.group);
    this.setPos(spec.route ? spec.route[0].x : spec.pos.x, spec.route ? spec.route[0].z : spec.pos.z);
    if (spec.route) this.setPos(spec.route[0].x, spec.route[0].z);
  }

  setPos(x, z) {
    this.x = x; this.z = z;
    this.group.position.set(x, terrainHeight(x, z), z);
  }

  get pos() {
    return { x: this.x, z: this.z };
  }

  headWorld(out) {
    out.set(this.x, this.group.position.y + 1.55, this.z);
    return out;
  }

  /* déclenché quand un tir retentit à {pos, loudness} */
  hear(pos, loudness, mission) {
    if (this.dead) return;
    const d = Math.hypot(pos.x - this.x, pos.z - this.z);
    const radius = 90 * loudness;
    if (d > radius) return;
    if (this.state === GState.PATROL || this.state === GState.IDLE) {
      this.setState(GState.INVESTIGATE);
      this.lastKnown = { x: pos.x, z: pos.z };
      this.alert = Math.max(this.alert, 0.6);
      if (this.radio) mission.setAlarm(this);
    } else if (this.state === GState.SUSPICIOUS) {
      this.setState(GState.INVESTIGATE);
      this.lastKnown = { x: pos.x, z: pos.z };
      if (this.radio) mission.setAlarm(this);
    } else if (this.state === GState.COMBAT) {
      this.lastKnown = { x: pos.x, z: pos.z };
    }
  }

  setState(s) {
    if (this.state === s) return;
    if (this.state === GState.DEAD) return;
    this.state = s;
    this.timer = 0;
  }

  /* visibilité du joueur vue par ce garde */
  visibilityOf(player, weather) {
    if (player.invisible) return 0;
    const d = Math.hypot(player.x - this.x, player.z - this.z);
    if (d > this.viewDist * weather.visibilityMul) return 0;
    const dx = player.x - this.x, dz = player.z - this.z;
    const ang = Math.atan2(dx, dz);
    const delta = Math.abs(angleDelta(this.yaw, ang));
    if (delta > this.fov / 2) return 0;
    // occultation : batiments + relief grossier
    if (!player.exposedTo(this.x, this.z, this)) return 0;
    let vis = (1 - d / this.viewDist) * 1.4;
    vis *= player.visibilityFactor();
    if (player.scoped && player.stance === 2) vis *= 0.7;
    vis *= weather.conceal;
    return clamp(vis, 0, 2);
  }

  update(dt, ctx) {
    const { player, mission, weather, audio, world } = ctx;
    if (this.dead) {
      if (this.dying >= 0 && this.dying < 1) {
        this.dying += dt * 2.2;
        animateHumanoid(this.model, dt, 0, 0, this.dying);
        if (this.dying >= 1) this.dying = 1;
      } else {
        animateHumanoid(this.model, dt, 0, 0, 1);
      }
      return;
    }

    this.timer += dt;
    this.senseTimer -= dt;
    this.shootCooldown -= dt;

    if (this.senseTimer <= 0) {
      this.senseTimer = 0.22;
      const vis = this.visibilityOf(player, weather);
      if (vis > 0) {
        this.alert = clamp(this.alert + vis * dt * 8 * this.senseSpeed, 0, 1.4);
        this.lastKnown = { x: player.x, z: player.z };
      } else {
        this.alert = clamp(this.alert - dt * 0.05, 0, 1.4);
      }
    }

    switch (this.state) {
      case GState.PATROL: {
        const wp = this.waypoints[this.wpIndex];
        const dx = wp.x - this.x, dz = wp.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8) {
          this.speed01 = 0;
          if (this.timer > this.waitTimer) {
            this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
            this.timer = 0;
          }
        } else {
          this.walkToward(dx, dz, dt, this.speedWalk);
        }
        if (this.alert > 0.85) this.setState(GState.COMBAT);
        else if (this.alert > 0.35) this.setState(GState.SUSPICIOUS);
        break;
      }
      case GState.IDLE: {
        this.speed01 = 0;
        this.yaw += Math.sin(this.timer * 0.5) * dt * 0.25;
        if (this.alert > 0.85) this.setState(GState.COMBAT);
        else if (this.alert > 0.35) this.setState(GState.SUSPICIOUS);
        break;
      }
      case GState.SUSPICIOUS: {
        this.speed01 = 0;
        if (this.lastKnown) this.faceToward(this.lastKnown.x, this.lastKnown.z, dt, 2.2);
        if (this.alert > 0.85) this.setState(GState.COMBAT);
        else if (this.alert < 0.12) this.setState(this.waypoints ? GState.PATROL : GState.IDLE);
        break;
      }
      case GState.INVESTIGATE: {
        if (this.lastKnown) {
          const dx = this.lastKnown.x - this.x, dz = this.lastKnown.z - this.z;
          const d = Math.hypot(dx, dz);
          if (d > 2.2) {
            this.walkToward(dx, dz, dt, this.speedHunt * 0.75);
          } else {
            this.speed01 = 0;
            this.setState(GState.SEARCH);
            this.searchTimer = 8 + Math.random() * 8;
          }
        } else {
          this.setState(this.waypoints ? GState.PATROL : GState.IDLE);
        }
        if (this.alert > 0.85) this.setState(GState.COMBAT);
        break;
      }
      case GState.SEARCH: {
        this.searchTimer -= dt;
        this.searchDir += Math.sin(this.timer * 0.7) * dt * 1.2;
        this.yaw += angleDelta(this.yaw, this.searchDir) * dt * 1.5;
        this.speed01 = 0;
        if (this.alert > 0.85) this.setState(GState.COMBAT);
        if (this.searchTimer <= 0) {
          this.alert = 0.05;
          this.setState(this.waypoints ? GState.PATROL : GState.IDLE);
          mission.onCalmDown(this);
        }
        break;
      }
      case GState.COMBAT: {
        const p = this.lastKnown;
        this.speed01 = 0;
        if (p) {
          const d = Math.hypot(p.x - this.x, p.z - this.z);
          this.faceToward(p.x, p.z, dt, 3.5);
          if (d > this.combatRange) {
            this.walkToward(p.x - this.x, p.z - this.z, dt, this.speedHunt);
          }
          // riposte diminuee : distance, mouvement du joueur, meteo
          if (this.shootCooldown <= 0 && player.alive) {
            const pv = player.currentSpeed01;
            let hitChance = this.accuracy * (1 - d / 70) - pv * 0.12;
            if (player.stance === 2) hitChance *= 0.5;
            if (Math.random() < clamp(hitChance, 0.02, 0.5)) {
              player.takeDamage(12 + Math.random() * 14, mission);
              if (audio) audio.whizz(1.5);
            } else if (audio) {
              audio.whizz(Math.random() * 8 + 2);
            }
            if (audio) audio.gunshot(Math.hypot(player.x - this.x, player.z - this.z), 200);
            mission.onGuardShoots(this, p);
            this.shootCooldown = 1.1 + Math.random() * 0.9;
          }
        }
        this.alert = 1.2;
        break;
      }
      default: break;
    }

    this.stance = this.state === GState.COMBAT ? 0 : (this.state === GState.INVESTIGATE ? 0 : 0);
    animateHumanoid(this.model, dt, this.speed01, this.stance);
    this.group.rotation.y = this.yaw;
    this.group.position.y = terrainHeight(this.x, this.z);
  }

  walkToward(dx, dz, dt, speed) {
    const d = Math.hypot(dx, dz) || 1;
    this.faceToward(this.x + dx, this.z + dz, dt, 6, true);
    const nx = this.x + (dx / d) * speed * dt;
    const nz = this.z + (dz / d) * speed * dt;
    if (this._free(nx, this.z)) this.x = nx;
    if (this._free(this.x, nz)) this.z = nz;
    this.speed01 = speed / this.speedHunt;
  }

  faceToward(x, z, dt, lambda = 3, silent = false) {
    const target = Math.atan2(x - this.x, z - this.z);
    this.yaw += angleDelta(this.yaw, target) * Math.min(1, dt * lambda);
    void silent;
  }

  _free(x, z) {
    const r = 0.5;
    for (const c of this._colliders()) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return false;
    }
    if (Math.hypot(x, z) > 118) return false;
    return true;
  }

  _colliders() {
    return this.worldColliders || [];
  }

  kill(mission, byPlayer) {
    if (this.dead) return;
    this.dead = true;
    this.dying = 0;
    this.setState(GState.DEAD);
    mission.onActorKilled(this, byPlayer);
    if (this.rifleOwned && this.model.rifle) this.model.rifle.visible = false;
  }
}

