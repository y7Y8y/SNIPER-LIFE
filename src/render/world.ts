import {
  Color3,
  Color4,
  DirectionalLight,
  ShadowGenerator,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core';
import type { Engine } from '@babylonjs/core';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function hillHeight(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const far = smoothstep(240, 420, d);
  const bumps =
    Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.009 + 0.4) +
    Math.sin(x * 0.031 + 0.2) * Math.cos(z * 0.027 + 2.1) * 0.4;
  return far * (10 + 14 * Math.abs(bumps)) + smoothstep(90, 240, d) * 2.5 * Math.abs(bumps);
}

function noiseTexture(scene: Scene, key: string, size: number, palette: string[]): DynamicTexture {
  const texture = new DynamicTexture(key, { width: size, height: size }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = palette[0]!;
  ctx.fillRect(0, 0, size, size);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const blotches = size * 2.2;
  for (let i = 0; i < blotches; i++) {
    const r = 2 + rand() * 14;
    ctx.fillStyle = palette[1 + Math.floor(rand() * (palette.length - 1))]!;
    ctx.globalAlpha = 0.05 + rand() * 0.18;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, r, r * (0.4 + rand() * 0.8), rand() * 3.14, 0, 6.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  texture.update(false);
  texture.uScale = 26;
  texture.vScale = 26;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

export interface WorldRefs {
  scene: Scene;
  sun: DirectionalLight;
  ground: Mesh;
  shadows: ShadowGenerator;
}

export function createWorld(engine: Engine): WorldRefs {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.62, 0.66, 0.71, 1);
  scene.ambientColor = new Color3(0.25, 0.26, 0.28);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.62, 0.66, 0.71);
  scene.fogDensity = 0.0022;
  scene.autoClear = true;

  const sun = new DirectionalLight('sun', new Vector3(-0.42, -0.62, 0.34).normalize(), scene);
  sun.position = new Vector3(180, 260, -140);
  sun.intensity = 2.3;
  sun.diffuse = new Color3(1.0, 0.94, 0.82);
  sun.specular = new Color3(0.7, 0.68, 0.6);

  const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  sky.intensity = 0.55;
  sky.diffuse = new Color3(0.55, 0.6, 0.7);
  sky.groundColor = new Color3(0.2, 0.19, 0.16);

  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: 760, height: 760, subdivisions: 72 },
    scene,
  );
  {
    const pos = ground.getVerticesData('position')!;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] = hillHeight(pos[i]!, pos[i + 2]!);
    }
    ground.updateVerticesData('position', pos, false);
    ground.createNormals(false);
  }
  const groundMat = new StandardMaterial('ground-mat', scene);
  groundMat.diffuseTexture = noiseTexture(scene, 'ground-tex', 512, [
    '#4d4a35',
    '#5a5740',
    '#3f3d2c',
    '#645f45',
    '#585640',
  ]);
  groundMat.specularColor = new Color3(0.03, 0.03, 0.03);
  groundMat.ambientColor = scene.ambientColor;
  ground.receiveShadows = true;
  ground.material = groundMat;

  const props: { kind: string; mat: 'wood' | 'sheet-metal' | 'concrete'; pos: Vector3; size: Vector3; rotY: number }[] = [
    { kind: 'wood', mat: 'wood', pos: new Vector3(60, 1.25, -40), size: new Vector3(6, 2.5, 2.2), rotY: 0.4 },
    { kind: 'wood', mat: 'wood', pos: new Vector3(48, 1.1, -55), size: new Vector3(4, 2.2, 2), rotY: 1.1 },
    { kind: 'crate', mat: 'wood', pos: new Vector3(70, 0.6, -60), size: new Vector3(1.6, 1.2, 1.4), rotY: 0.2 },
    { kind: 'crate', mat: 'wood', pos: new Vector3(72, 0.6, -57), size: new Vector3(1.6, 1.2, 1.4), rotY: 0.7 },
    { kind: 'container', mat: 'sheet-metal', pos: new Vector3(120, 1.3, 130), size: new Vector3(7, 2.6, 2.6), rotY: -0.5 },
    { kind: 'container', mat: 'sheet-metal', pos: new Vector3(129, 1.3, 138), size: new Vector3(7, 2.6, 2.6), rotY: -0.5 },
    { kind: 'wall', mat: 'concrete', pos: new Vector3(210, 1.1, 205), size: new Vector3(14, 2.2, 0.5), rotY: 0.15 },
    { kind: 'cistern', mat: 'sheet-metal', pos: new Vector3(255, 1.6, 235), size: new Vector3(4, 3.2, 4), rotY: 0 },
  ];
  for (const prop of props) {
    const mesh = MeshBuilder.CreateBox(prop.kind, { width: prop.size.x, height: prop.size.y, depth: prop.size.z }, scene);
    mesh.position.copyFrom(prop.pos);
    mesh.position.y = prop.pos.y + hillHeight(prop.pos.x, prop.pos.z);
    mesh.rotation.y = prop.rotY;
    mesh.metadata = { material: prop.mat };
    const mat = new StandardMaterial(`${prop.kind}-mat`, scene);
    if (prop.mat === 'sheet-metal') {
      mat.diffuseColor = new Color3(0.42, 0.34, 0.3);
      mat.specularColor = new Color3(0.25, 0.24, 0.2);
      mat.specularPower = 48;
    } else if (prop.mat === 'concrete') {
      mat.diffuseColor = new Color3(0.55, 0.54, 0.5);
      mat.specularColor = new Color3(0.05, 0.05, 0.05);
    } else {
      mat.diffuseTexture = noiseTexture(scene, `${prop.kind}-tex`, 256, [
        '#6b5642',
        '#7a6550',
        '#584638',
      ]);
      mat.specularColor = new Color3(0.05, 0.05, 0.05);
    }
    mat.ambientColor = scene.ambientColor;
    mesh.material = mat;
    mesh.receiveShadows = true;
  }

  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;

  return { scene, sun, ground, shadows };
}
