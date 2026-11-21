/* Bâtiments du village : maisons, fermes, tours de guet, murets, véhicules.
   Palette de matériaux partagée (identité visuelle) + AABB comme occludeurs et colliders. */

import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { mulberry32 } from '../core/math.js';

const MAT = {
  wallCream: new THREE.MeshStandardMaterial({ color: 0xb0a68c, roughness: 0.95 }),
  wallStone: new THREE.MeshStandardMaterial({ color: 0x8a857a, roughness: 1.0 }),
  wallWood: new THREE.MeshStandardMaterial({ color: 0x6e5a40, roughness: 0.9 }),
  roofTile: new THREE.MeshStandardMaterial({ color: 0x6b3b2e, roughness: 0.85 }),
  roofSlate: new THREE.MeshStandardMaterial({ color: 0x4a4f52, roughness: 0.85 }),
  roofThatch: new THREE.MeshStandardMaterial({ color: 0x8a7239, roughness: 1.0 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x54432e, roughness: 0.95 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x59605e, roughness: 0.5, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x2c3a40, roughness: 0.25, metalness: 0.4 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x1d1f1d, roughness: 1.0 })
};

const _tmpMin = new THREE.Vector3();
const _tmpMax = new THREE.Vector3();

function aabbOf(mesh) {
  mesh.geometry.computeBoundingBox();
  mesh.updateMatrixWorld(true);
  _tmpMin.copy(mesh.geometry.boundingBox.min).applyMatrix4(mesh.matrixWorld);
  _tmpMax.copy(mesh.geometry.boundingBox.max).applyMatrix4(mesh.matrixWorld);
  return {
    minX: Math.min(_tmpMin.x, _tmpMax.x),
    maxX: Math.max(_tmpMin.x, _tmpMax.x),
    minZ: Math.min(_tmpMin.z, _tmpMax.z),
    maxZ: Math.max(_tmpMin.z, _tmpMax.z),
    height: _tmpMax.y
  };
}

class Builder {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.occluders = [];
  }

  box(w, h, d, x, y, z, mat, rotY = 0, occlude = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    if (occlude) {
      this.colliders.push(aabbOf(m));
      this.occluders.push(aabbOf(m));
    }
    return m;
  }

  prism(w, h, d, x, y, z, mat, rotY = 0) {
    const geo = new THREE.BufferGeometry();
    const hw = w / 2, hd = d / 2;
    const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd];
    const RB = [0, h, -hd], RF = [0, h, hd];
    const faces = [
      [...A, ...B, ...RB],
      [...C, ...D, ...RF],
      [...A, ...D, ...RF],
      [...A, ...RF, ...RB],
      [...B, ...C, ...RF],
      [...B, ...RF, ...RB]
    ];
    const arr = new Float32Array(faces.length * 3);
    faces.forEach((p, i) => {
      arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2];
    });
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  house(spec, rng) {
    const { x, z, rot = 0 } = spec;
    const w = spec.w ?? 8, d = spec.d ?? 6, h = spec.h ?? 3.2;
    const y = terrainHeight(x, z) - 0.3;
    const wallMat = spec.stone ? MAT.wallStone : MAT.wallCream;
    this.box(w, h, d, x, y, z, wallMat, rot);
    this.box(w + 0.4, 0.6, d + 0.4, x, y - 0.3, z, MAT.wallStone, rot, false);
    const roofMat = spec.material === 'thatch' ? MAT.roofThatch : (spec.stone ? MAT.roofSlate : MAT.roofTile);
    this.prism(w + 1.2, 1.6 + rng() * 0.8, d + 1.2, x, y + h, z, roofMat, rot);
    const nw = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < nw; i++) {
      const off = (i - (nw - 1) / 2) * (w - 2) / nw;
      this.box(1.1, 1.1, 0.15, x + off, y + 1.5, z + d / 2 + 0.03, MAT.glass, rot, false);
    }
    if (rng() > 0.4) this.box(0.8, 1.8, 0.8, x + w * 0.25, y + h + 1.9, z, MAT.wallStone, rot, false);
  }

  barn(spec, rng) {
    const { x, z, rot = 0 } = spec;
    const w = spec.w ?? 12, d = spec.d ?? 8, h = spec.h ?? 4.2;
    const y = terrainHeight(x, z) - 0.3;
    this.box(w, h, d, x, y, z, MAT.wallWood, rot);
    this.prism(w + 0.8, 2.2, d + 0.8, x, y + h, z, MAT.roofSlate, rot);
    this.box(2.4, 2.8, 0.2, x, y, z + d / 2 + 0.05, MAT.wood, rot, false);
    void rng;
  }

  tower(spec) {
    const { x, z } = spec;
    const legR = 1.6;
    const h = spec.h ?? 7;
    const y = terrainHeight(x, z);
    for (let i = 0; i < 4; i++) {
      const ox = i % 2 === 0 ? -legR : legR;
      const oz = i < 2 ? -legR : legR;
      this.box(0.3, h, 0.3, x + ox, y, z + oz, MAT.wood, 0, false);
    }
    this.box(4.2, 0.25, 4.2, x, y + h, z, MAT.wood, 0, true);
    this.box(3.6, 1.1, 3.6, x, y + h + 0.25, z, MAT.wallWood, 0, false);
    this.prism(4.4, 1.4, 4.4, x, y + h + 1.35, z, MAT.roofThatch, 0);
    const aabb = { minX: x - legR - 0.3, maxX: x + legR + 0.3, minZ: z - legR - 0.3, maxZ: z + legR + 0.3, height: y + h };
    this.colliders.push(aabb);
    this.occluders.push(aabb);
  }

  wall(spec) {
    const { x, z, rot = 0, len = 6 } = spec;
    const h = spec.h ?? 1.4;
    const y = terrainHeight(x, z) - 0.1;
    this.box(len, h, 0.6, x, y, z, MAT.wallStone, rot);
  }

  crates(spec, rng) {
    const { x, z } = spec;
    const n = 2 + Math.floor(rng() * 3);
    const y = terrainHeight(x, z);
    for (let i = 0; i < n; i++) {
      const s = 1 + rng() * 0.6;
      this.box(s, s, s, x + (rng() - 0.5) * 3, y, z + (rng() - 0.5) * 3, MAT.wallWood, rng() * Math.PI, true);
    }
  }

  vehicle(spec) {
    const { x, z, rot = 0 } = spec;
    const y = terrainHeight(x, z);
    this.box(2.2, 1.4, 5, x, y + 0.3, z, spec.military ? MAT.metal : MAT.wallWood, rot, true);
    this.box(2.0, 1.1, 1.6, x, y + 1.7, z + 1.0, MAT.glass, rot, false);
    for (const [ox, oz] of [[-1.1, 1.6], [1.1, 1.6], [-1.1, -1.6], [1.1, -1.6]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12), MAT.tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x + ox, y + 0.42, z + oz);
      wheel.castShadow = true;
      this.scene.add(wheel);
    }
  }
}

export function buildVillage(scene, layout, seed = 7) {
  const rng = mulberry32(seed);
  const b = new Builder(scene);
  for (const spec of layout.buildings) {
    const t = spec.type;
    if (t === 'house') b.house(spec, rng);
    else if (t === 'barn') b.barn(spec, rng);
    else if (t === 'tower') b.tower(spec);
    else if (t === 'wall') b.wall(spec);
    else if (t === 'crates') b.crates(spec, rng);
    else if (t === 'vehicle') b.vehicle(spec);
  }
  return { colliders: b.colliders, occluders: b.occluders };
}
