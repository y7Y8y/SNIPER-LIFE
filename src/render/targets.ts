import { Animation, Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';

export interface BreatheTarget {
  mesh: Mesh;
  update: (dtSec: number) => void;
}

const BREATH_ANIM_NAME = 'breathing';

export function createMannequin(scene: Scene, name: string, at: Vector3, scale = 1): BreatheTarget {
  const root = new Mesh(`${name}-root`, scene);

  const torso = MeshBuilder.CreateCapsule(
    `${name}-torso`,
    { height: 0.62 * scale, radius: 0.13 * scale, tessellation: 12 },
    scene,
  );
  torso.position.y = 1.28 * scale;
  torso.parent = root;

  const head = MeshBuilder.CreateSphere(
    `${name}-head`,
    { diameter: 0.21 * scale, segments: 10 },
    scene,
  );
  head.position.y = 1.68 * scale;
  head.parent = root;

  const legL = MeshBuilder.CreateCapsule(
    `${name}-legL`,
    { height: 0.82 * scale, radius: 0.07 * scale, tessellation: 10 },
    scene,
  );
  legL.position.set(-0.09 * scale, 0.42 * scale, 0);
  legL.parent = root;

  const legR = MeshBuilder.CreateCapsule(
    `${name}-legR`,
    { height: 0.82 * scale, radius: 0.07 * scale, tessellation: 10 },
    scene,
  );
  legR.position.set(0.09 * scale, 0.42 * scale, 0);
  legR.parent = root;

  const mat = new StandardMaterial(`${name}-mat`, scene);
  mat.diffuseColor = new Color3(0.24, 0.26, 0.24);
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  for (const part of [torso, head, legL, legR]) {
    part.material = mat;
  }
  root.position.copyFrom(at);
  root.metadata = { material: 'flesh' };

  const breath = new Animation(
    BREATH_ANIM_NAME,
    'position.y',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  breath.setKeys([
    { frame: 0, value: 0 },
    { frame: 45, value: 0.012 * scale },
    { frame: 90, value: 0 },
  ]);
  root.animations = [breath];

  let started = false;
  return {
    mesh: root,
    update(): void {
      if (!started) {
        root.getScene().beginAnimation(root, 0, 90, true, 0.7);
        started = true;
      }
    },
  };
}
