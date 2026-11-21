/* Terrain vallonné analytique : la même fonction de hauteur sert au maillage, aux placements
   et aux collisions. Une zone plane et douce accueille le village. */

import * as THREE from 'three';
import { fbm2, smoothstep, clamp, lerp } from '../core/math.js';
import { makeGroundTexture } from './textures.js';

export const TERRAIN_SIZE = 260;
export const VILLAGE_CENTER = { x: 0, z: 0 };

export function villageMask(x, z) {
  const d = Math.hypot(x - VILLAGE_CENTER.x, z - VILLAGE_CENTER.z);
  return smoothstep(26, 85, d); // 0 dans le village, 1 au-delà
}

function terrainHeightRaw(x, z) {
  const rolling = fbm2(x * 0.013, z * 0.013, 11, 4) * 16 - 4;
  const detail = fbm2(x * 0.07, z * 0.07, 29, 3) * 1.6;
  return rolling + detail;
}

export function terrainHeight(x, z) {
  const m = villageMask(x, z);
  const hh = terrainHeightRaw(0, 0);
  return lerp(hh, terrainHeightRaw(x, z), m);
}

export function terrainSlope(x, z) {
  const e = 1.2;
  const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}

export function createTerrain(layout) {
  const segs = 140;
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const grassA = new THREE.Color(0x48603a);
  const grassB = new THREE.Color(0x66744a);
  const dry = new THREE.Color(0x86784a);
  const dirt = new THREE.Color(0x5b4a35);
  const rock = new THREE.Color(0x6b6a5e);
  const c = new THREE.Color();
  const dk = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    const patch = fbm2(x * 0.05, z * 0.05, 47);
    const micro = fbm2(x * 0.35, z * 0.35, 83);
    c.copy(grassA).lerp(grassB, micro);
    c.lerp(dry, smoothstep(0.55, 0.85, patch) * 0.7);

    const slope = terrainSlope(x, z);
    c.lerp(rock, smoothstep(0.55, 0.95, slope));

    let roadK = 0;
    for (const r of layout.roads) {
      const t = clamp(projectOnSegment(x, z, r), 0, 1);
      const rx = r.a.x + (r.b.x - r.a.x) * t;
      const rz = r.a.z + (r.b.z - r.a.z) * t;
      const d = Math.hypot(x - rx, z - rz);
      if (d < r.width) roadK = Math.max(roadK, 1 - d / r.width);
    }
    if (roadK > 0) {
      dk.copy(dirt).multiplyScalar(0.85 + micro * 0.3);
      c.lerp(dk, Math.min(1, roadK * 1.6));
    }

    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const groundTex = makeGroundTexture();
  if (groundTex) groundTex.repeat.set(22, 22);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: groundTex ?? undefined,
    bumpMap: groundTex ?? undefined,
    bumpScale: 0.35,
    roughness: 1.0,
    metalness: 0.0
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function projectOnSegment(x, z, seg) {
  const ax = seg.a.x, az = seg.a.z, bx = seg.b.x, bz = seg.b.z;
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz || 1e-9;
  return ((x - ax) * abx + (z - az) * abz) / len2;
}
