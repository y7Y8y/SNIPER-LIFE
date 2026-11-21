/* Végétation et rochers : tout est instancié et animé par le vent via un vertex shader.
   Une seule fonction de placement (bruit + pentes) pour une végétation crédible et cohérente. */

import * as THREE from 'three';
import { terrainHeight, terrainSlope, TERRAIN_SIZE, villageMask } from './terrain.js';
import { mulberry32 } from '../core/math.js';

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
  const canopyMat = makeSwayMaterial(0x44583a, true);
  swayMats.push(grassMat, bushMat, canopyMat);

  // herbe : brins croisés instanciés
  const grassGeo = new THREE.PlaneGeometry(0.7, 0.6);
  grassGeo.translate(0, 0.3, 0);
  const GRASS = 2600;
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, GRASS);
  placeInstances(grass, GRASS, rng, {
    test: (x, z, slope, vmask) => slope < 0.5 && vmask > 0.25,
    scale: [0.6, 1.4],
    yLift: -0.02
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
    yLift: -0.1
  });
  bushes.castShadow = true;
  group.add(bushes);

  // arbres : tronc + houppier
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6);
  trunkGeo.translate(0, 1.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3c28, roughness: 1.0 });
  const TREE = 90;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE);
  const canopyGeo = new THREE.IcosahedronGeometry(1.9, 1);
  canopyGeo.scale(1.0, 1.25, 1.0);
  canopyGeo.translate(0, 4.1, 0);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, TREE);
  const treeSpots = placeInstances(trunks, TREE, rng, {
    test: (x, z, slope, vmask) => slope < 0.5 && vmask > 0.05,
    scale: [0.9, 1.8],
    yLift: -0.1
  });
  for (let i = 0; i < treeSpots.length; i++) {
    const p = treeSpots[i];
    const s = p.scale.v;
    canopyDummy(p, canopies, i, s);
  }
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

function canopyDummy(p, canopies, i, s) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
    new THREE.Vector3(s, s, s)
  );
  canopies.setMatrixAt(i, m);
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
    e.set(0, rng() * Math.PI * 2, 0);
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
