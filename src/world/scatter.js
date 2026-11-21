/* Végétation et rochers : tout est instancié et animé par le vent via un vertex shader.
   Une seule fonction de placement (bruit + pentes) pour une végétation crédible et cohérente. */

import * as THREE from 'three';
import { terrainHeight, terrainSlope, TERRAIN_SIZE, villageMask } from './terrain.js';
import { mulberry32 } from '../core/math.js';
import { makeWoodTexture } from './textures.js';

const WIND_CHUNK = `
uniform float uTime;
uniform float uWind;
`;

function makeSwayMaterial(baseColor, isTree) {
  const mat = new THREE.MeshLambertMaterial({
    color: baseColor,
    side: THREE.DoubleSide
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 0.3 };
    shader.vertexShader = `
uniform float uTime;
uniform float uWind;
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
#ifdef USE_INSTANCING
  vec4 swayBase = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float swayPhase = swayBase.x * 0.35 + swayBase.z * 0.25;
  float swayAmt = max(0.0, position.y) * ${isTree ? '0.02' : '0.25'} * uWind;
  vec3 transformed = vec3(position);
  transformed.x += sin(uTime * 1.7 + swayPhase) * swayAmt;
  transformed.z += cos(uTime * 1.3 + swayPhase * 1.3) * swayAmt * 0.6;
#else
  vec3 transformed = vec3(position);
#endif
`
    );
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => `sway-${isTree ? 'tree' : 'grass'}`;
  return mat;
}

export function updateVegetationWind(veg, time, wind01) {
  for (const mat of veg.swayMats) {
    const shader = mat.userData.shader;
    if (shader) {
      shader.uniforms.uTime.value = time;
      shader.uniforms.uWind.value = 0.3 + wind01 * 1.2;
    }
  }
  veg.wind01 = wind01;
}

export function createVegetation(scene, seed = 42) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const swayMats = [];

  const grassMat = makeSwayMaterial(0x51603c, false);
  const bushMat = makeSwayMaterial(0x3e4f30, false);
  const canopyMat = makeSwayMaterial(0xffffff, true);
  swayMats.push(grassMat, bushMat, canopyMat);

  // herbe : brins croisés instanciés, légèrement inclinés
  const grassGeo = new THREE.PlaneGeometry(0.55, 0.8, 1, 2);
  grassGeo.translate(0, 0.4, 0);
  const GRASS = 2600;
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, GRASS);
  placeInstances(grass, GRASS, rng, {
    test: (x, z, slope, vmask) => slope < 0.5 && vmask > 0.25,
    scale: [0.6, 1.4],
    yLift: -0.02,
    tilt: 0.3
  });
  group.add(grass);

  // buissons
  const bushGeo = new THREE.IcosahedronGeometry(0.9, 1);
  bushGeo.scale(1.3, 0.7, 1.3);
  bushGeo.translate(0, 0.4, 0);
  const BUSH = 130;
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, BUSH);
  placeInstances(bushes, BUSH, rng, {
    test: (x, z, slope, vmask) => slope < 0.55 && vmask > 0.1,
    scale: [0.8, 1.7],
    yLift: -0.1,
    tilt: 0.2
  });
  bushes.castShadow = true;
  group.add(bushes);

  // arbres : tronc + houppier en 3 masses décalées (jamais un simple cône)
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6);
  trunkGeo.translate(0, 1.6, 0);
  const barkTex = makeWoodTexture(73);
  if (barkTex) barkTex.repeat.set(1.5, 2);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, map: barkTex ?? undefined, bumpMap: barkTex ?? undefined, bumpScale: 0.5 });
  const TREE = 90;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE);
  const canopyGeo = new THREE.IcosahedronGeometry(1.5, 1);
  const BLOBS = 3;
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, TREE * BLOBS);
  const treeSpots = placeInstances(trunks, TREE, rng, {
    test: (x, z, slope, vmask) => slope < 0.5 && vmask > 0.05,
    scale: [0.9, 1.8],
    yLift: -0.1
  });
  const blobOffsets = [
    { x: 0.0, y: 4.3, z: 0.0, s: 1.0 },
    { x: -1.0, y: 3.6, z: 0.5, s: 0.72 },
    { x: 0.7, y: 5.3, z: -0.6, s: 0.62 }
  ];
  const colorA = new THREE.Color(0x44583a), colorB = new THREE.Color(0x5d6b41);
  const c = new THREE.Color();
  let ci = 0;
  for (const p of treeSpots) {
    const s = p.scale.v;
    for (const b of blobOffsets) {
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(p.x + b.x * s, p.y + b.y * s, p.z + b.z * s),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 0.25, rng() * Math.PI, rng() * 0.25)),
        new THREE.Vector3(b.s * s, b.s * s * 1.15, b.s * s)
      );
      canopies.setMatrixAt(ci, m);
      c.copy(colorA).lerp(colorB, rng());
      canopies.setColorAt(ci, c);
      ci++;
    }
  }
  canopies.count = ci;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  trunks.castShadow = true;
  canopies.castShadow = true;
  group.add(trunks);
  group.add(canopies);

  // rochers
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6a5e, roughness: 1.0 });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const ROCK = 70;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCK);
  placeInstances(rocks, ROCK, rng, {
    test: (x, z, slope, vmask) => vmask > 0.1,
    scale: [0.5, 2.2],
    yLift: -0.4,
    squashY: 0.7
  });
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  scene.add(group);
  treeSpots.forEach(p => { p.radius = 0.5 * p.scale.v; });
  const treeCircles = treeSpots.map(p => ({ x: p.x, z: p.z, r: 0.45 * p.scale.v, height: terrainHeight(p.x, p.z) + 3.2 * p.scale.v }));
  return { group, swayMats, treeCircles, instanced: [grass, bushes, trunks, canopies, rocks], wind01: 0.3 };
}

function placeInstances(mesh, count, rng, opts) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const spots = [];
  let placed = 0, guard = 0;
  const half = TERRAIN_SIZE / 2 - 6;
  while (placed < count && guard < count * 30) {
    guard++;
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const slope = terrainSlope(x, z);
    const vmask = villageMask(x, z);
    if (!opts.test(x, z, slope, vmask)) continue;
    const sv = opts.scale[0] + rng() * (opts.scale[1] - opts.scale[0]);
    const y = terrainHeight(x, z) + (opts.yLift ?? 0);
    const tilt = opts.tilt ?? 0;
    e.set((rng() - 0.5) * tilt, rng() * Math.PI * 2, (rng() - 0.5) * tilt);
    q.setFromEuler(e);
    const sx = sv, sz = sv;
    const sy = sv * (opts.squashY ?? 1);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    mesh.setMatrixAt(placed, m);
    spots.push({ x, z, y, scale: { v: sv } });
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  return spots;
}
