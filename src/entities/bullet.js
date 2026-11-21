/* Balistique : balle simulee (vitesse, gravite), collisions terrain / batiments / personnages. */

import * as THREE from 'three';
import { terrainHeight } from '../world/terrain.js';
import { distPointSegment } from '../core/math.js';

const GRAVITY = 9.81;

export class BulletManager {
  constructor(scene) {
    this.scene = scene;
    this.bullets = [];
    this.impacts = [];
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.85 });
    this.impactMat = new THREE.MeshBasicMaterial({ color: 0xb0a284, transparent: true, opacity: 0.8 });
  }

  fire(origin, dir, speed = 790, fromPlayer = true) {
    const vel = dir.clone().multiplyScalar(speed);
    const geo = new THREE.BoxGeometry(0.02, 0.02, 1.4);
    const mesh = new THREE.Mesh(geo, this.tracerMat);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(dir));
    this.scene.add(mesh);
    this.bullets.push({ pos: origin.clone(), vel, mesh, life: 3, fromPlayer });
  }

  spawnImpact(pos, kind) {
    const geo = new THREE.SphereGeometry(kind === 'blood' ? 0.09 : 0.14, 6, 5);
    const m = new THREE.Mesh(geo, kind === 'blood'
      ? new THREE.MeshBasicMaterial({ color: 0x6b1a12 })
      : this.impactMat);
    m.position.copy(pos);
    this.scene.add(m);
    this.impacts.push({ mesh: m, life: 1.2 });
  }

  update(dt, ctx) {
    const { player, guards, civilians, occluders, audio, mission } = ctx;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.vel.y -= GRAVITY * dt;
      const next = b.pos.clone().addScaledVector(b.vel, dt);

      let hit = false;
      let hitPos = null;

      // terrain ?
      if (!hit) {
        const steps = 4;
        for (let s = 1; s <= steps; s++) {
          const p = b.pos.clone().lerp(next, s / steps);
          if (p.y <= terrainHeight(p.x, p.z)) {
            hit = true; hitPos = p;
            break;
          }
        }
      }

      // batiments (couvrent les personnages)
      if (!hit) {
        for (const o of occluders) {
          if (segmentCrossesBox(b.pos, next, o)) {
            hit = true; hitPos = next.clone().lerp(b.pos, 0.5);
            break;
          }
        }
      }

      // personnages (segment vs cylindre vertical)
      if (!hit) {
        const actors = [];
        for (const g of guards) if (!g.dead) actors.push({ kind: 'guard', a: g });
        for (const c of civilians) if (!c.dead) actors.push({ kind: 'civ', a: c });
        for (const act of actors) {
          const ax = act.a.x, az = act.a.z;
          const p = act.a.group.position;
          const feetY = p.y;
          const headY = feetY + (act.a.stance === 2 ? 0.65 : 1.75);
          const d = segmentDistance3(b.pos, next, ax, feetY + 0.9, az, 0.34);
          if (d < 0.34 && next.y > feetY && next.y < headY + 0.3) {
            hit = true; hitPos = next.clone();
            if (b.fromPlayer) {
              act.a.kill(mission, true);
              mission.onConfirmedKill(act.a, hitPos);
            }
            this.spawnImpact(hitPos, 'blood');
            break;
          }
        }
      }

      if (hit) {
        const d = hitPos.distanceTo(ctx.camera ? ctx.camera.position : b.pos);
        if (audio) audio.impact(d);
        this.spawnImpact(hitPos, hitPos.y <= terrainHeight(hitPos.x, hitPos.z) + 0.05 ? 'dust' : 'dust');
        if (b.fromPlayer) mission.onBulletImpact(hitPos, b);
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
        continue;
      }

      b.pos.copy(next);
      b.mesh.position.copy(next);
      b.mesh.lookAt(next.clone().add(b.vel));
      if (b.life <= 0 || b.pos.y < -40) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const imp = this.impacts[i];
      imp.life -= dt;
      imp.mesh.scale.multiplyScalar(1 + dt * 2.5);
      const mm = imp.mesh.material;
      if ('opacity' in mm) {
        mm.opacity = Math.max(0, (imp.life / 1.2) * 0.8);
      }
      if (imp.life <= 0) {
        this.scene.remove(imp.mesh);
        this.impacts.splice(i, 1);
      }
    }
  }
}

function segmentDistance3(a, b, cx, cy, cz, r) {
  const t = clampT(a, b, cx, cy, cz);
  const px = a.x + (b.x - a.x) * t;
  const py = a.y + (b.y - a.y) * t;
  const pz = a.z + (b.z - a.z) * t;
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function clampT(a, b, cx, cy, cz) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (len2 > 0) {
    t = ((cx - a.x) * abx + (cy - a.y) * aby + (cz - a.z) * abz) / len2;
  }
  return Math.min(1, Math.max(0, t));
}

function segmentCrossesBox(a, b, box) {
  const t0x = (box.minX - a.x) / (b.x - a.x || 1e-9);
  const t1x = (box.maxX - a.x) / (b.x - a.x || 1e-9);
  const t0z = (box.minZ - a.z) / (b.z - a.z || 1e-9);
  const t1z = (box.maxZ - a.z) / (b.z - a.z || 1e-9);
  const tEnter = Math.max(Math.min(t0x, t1x), Math.min(t0z, t1z), 0);
  const tExit = Math.min(Math.max(t0x, t1x), Math.max(t0z, t1z), 1);
  if (tEnter > tExit) return false;
  // check height at entry
  const px = a.x + (b.x - a.x) * tEnter;
  const py = a.y + (b.y - a.y) * tEnter;
  const pz = a.z + (b.z - a.z) * tEnter;
  return py <= (box.height ?? 4) && py >= (box.baseY ?? -1);
}
