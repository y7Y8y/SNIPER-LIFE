/* Humanoide procedural : proportions realistes, articulations en groupes Three.js,
   marche / accroupi / couche animes par le code. Aucun asset externe. */

import * as THREE from 'three';

const SKIN = new THREE.MeshStandardMaterial({ color: 0xb08a6a, roughness: 0.75 });

function limb(len, r, mat) {
  const root = new THREE.Group();
  const upperLen = len * 0.52;
  const lowerLen = len * 0.5;
  const upperGeo = new THREE.CapsuleGeometry(r, Math.max(0.02, upperLen - r * 2), 3, 8);
  const upperMesh = new THREE.Mesh(upperGeo, mat);
  upperMesh.position.y = -upperLen / 2;
  upperMesh.castShadow = true;
  const upper = new THREE.Group();
  upper.add(upperMesh);
  root.add(upper);
  const lower = new THREE.Group();
  lower.position.y = -upperLen;
  const lowerGeo = new THREE.CapsuleGeometry(r * 0.88, Math.max(0.02, lowerLen - r), 3, 8);
  const lowerMesh = new THREE.Mesh(lowerGeo, mat);
  lowerMesh.position.y = -lowerLen / 2 + r * 0.25;
  lowerMesh.castShadow = true;
  lower.add(lowerMesh);
  upper.add(lower);
  root.userData.upper = upper;
  root.userData.lower = lower;
  return root;
}

function setLower(limbRef, bend) {
  if (limbRef && limbRef.userData.lower) limbRef.userData.lower.rotation.x = bend;
}

export function createHumanoid(cfg = {}) {
  const uniform = new THREE.MeshStandardMaterial({
    color: cfg.uniform ?? 0x4a4f38,
    roughness: 0.9
  });
  const pants = new THREE.MeshStandardMaterial({
    color: cfg.pants ?? 0x3c422e,
    roughness: 0.95
  });
  const vestMat = cfg.vest
    ? new THREE.MeshStandardMaterial({ color: cfg.vest, roughness: 0.85 })
    : null;
  const hatMat = new THREE.MeshStandardMaterial({ color: cfg.hat ?? cfg.uniform ?? 0x4a4f38, roughness: 0.9 });

  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  group.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 4, 10), uniform);
  chest.position.y = 0.28;
  chest.scale.set(1.15, 1, 0.78);
  chest.castShadow = true;
  torso.add(chest);

  if (vestMat) {
    const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.26, 4, 10), vestMat);
    vest.position.y = 0.26;
    vest.scale.set(1.18, 1, 0.82);
    vest.castShadow = true;
    torso.add(vest);
  }

  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), SKIN);
  skull.position.y = 0.08;
  skull.scale.set(0.92, 1.1, 1.0);
  skull.castShadow = true;
  head.add(skull);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat);
  cap.position.y = 0.09;
  head.add(cap);
  if (cfg.helmet) cap.scale.set(1.08, 1.15, 1.12);

  const armL = limb(0.58, 0.052, uniform);
  armL.position.set(-0.27, 0.5, 0);
  torso.add(armL);
  const armR = limb(0.58, 0.052, uniform);
  armR.position.set(0.27, 0.5, 0);
  torso.add(armR);

  const legL = limb(0.9, 0.075, pants);
  legL.position.set(-0.11, 0, 0);
  hips.add(legL);
  const legR = limb(0.9, 0.075, pants);
  legR.position.set(0.11, 0, 0);
  hips.add(legR);

  let rifle = null;
  if (cfg.rifle) {
    rifle = createRifle();
    rifle.position.set(0.1, 0.34, -0.08);
    torso.add(rifle);
  }

  return {
    group, hips, torso, head, armL, armR, legL, legR, rifle,
    phase: 0
  };
}

export function createRifle() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4d4438, roughness: 0.6, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d2b, roughness: 0.5, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.7), mat);
  g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.6, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.62);
  g.add(barrel);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10), dark);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.09, -0.1);
  g.add(scope);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.26), mat);
  stock.position.set(0, -0.03, 0.42);
  g.add(stock);
  g.castShadow = true;
  return g;
}

export const STANCE_HIP = { 0: 0.95, 1: 0.62, 2: 0.22 };
export const STANCE_HEIGHT = { 0: 1.72, 1: 1.15, 2: 0.42 };

export function animateHumanoid(h, dt, speed01, stance, dyingT = -1) {
  if (dyingT >= 0) {
    const t = Math.min(1, dyingT);
    h.group.rotation.x = -t * (Math.PI / 2) * 0.94;
    h.group.position.y = -t * 0.12;
    h.torso.rotation.x = 0;
    h.armL.rotation.x = 0.6 * t;
    h.armR.rotation.x = 0.6 * t;
    h.legL.rotation.x = 0.2 * t;
    h.legR.rotation.x = 0.1 * t;
    setLower(h.legL, 0.5 * t);
    setLower(h.legR, 0.3 * t);
    setLower(h.armL, -0.4 * t);
    setLower(h.armR, -0.4 * t);
    return;
  }

  const hipsTarget = STANCE_HIP[stance] ?? 0.95;
  h.hips.position.y += (hipsTarget - h.hips.position.y) * Math.min(1, dt * 8);

  h.phase += dt * (2.2 + speed01 * 7.0);
  const swing = Math.sin(h.phase * 2) * (0.18 + speed01 * 0.75);
  const lift = Math.abs(Math.cos(h.phase * 2)) * speed01 * 0.25;

  if (stance === 2) {
    h.hips.position.y += (0.22 - h.hips.position.y) * Math.min(1, dt * 6);
    h.torso.rotation.x = (Math.PI / 2) * 0.86;
    h.group.rotation.x = 0;
    h.legL.rotation.x = 0.2; h.legR.rotation.x = 0.05;
    setLower(h.legL, 0.15); setLower(h.legR, 0.05);
    h.armL.rotation.x = -1.35; h.armR.rotation.x = -1.5;
    setLower(h.armL, -0.7); setLower(h.armR, -0.9);
    h.head.rotation.x = -0.6;
    return;
  }
  h.torso.rotation.x = speed01 * 0.07;
  h.head.rotation.x = 0;

  h.legL.rotation.x = swing * (stance === 1 ? 0.6 : 1);
  h.legR.rotation.x = -swing * (stance === 1 ? 0.6 : 1);
  const crouchMul = stance === 1 ? 1.5 : 1;
  setLower(h.legL, Math.max(0.04, -swing + Math.abs(swing) * 0.3) * (0.5 + speed01 * 0.7) * crouchMul);
  setLower(h.legR, Math.max(0.04, swing + Math.abs(swing) * 0.3) * (0.5 + speed01 * 0.7) * crouchMul);
  h.hips.position.y += lift * (stance === 1 ? 0.3 : 1);
  h.armL.rotation.x = -swing * 0.7;
  setLower(h.armL, -0.28 - Math.abs(swing) * 0.2);
  if (h.rifle) {
    h.armR.rotation.x = -0.9 - swing * 0.25;
    setLower(h.armR, -0.9);
  } else {
    h.armR.rotation.x = swing * 0.7;
    setLower(h.armR, -0.28 - Math.abs(swing) * 0.2);
  }
  h.torso.rotation.z = Math.sin(h.phase) * 0.03 * speed01;
  h.group.rotation.x = 0;
}

export function makeBloodPool() {
  const geo = new THREE.CircleGeometry(0.55, 12);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x5a1a14, transparent: true, opacity: 0.85 });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.04;
  return m;
}
