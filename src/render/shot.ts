import {
  Color3,
  CreateLines,
  LinesMesh,
  Mesh,
  Ray,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { PickingInfo, Scene } from '@babylonjs/core';
import type { MaterialId, ShotResult } from '../core/ballistics.ts';
import type { Vec3 } from '../core/wind.ts';

export interface FiringCheck {
  resolveMaterial: (from: Vec3, to: Vec3) => MaterialId | null;
}

export function makePicker(scene: Scene): FiringCheck {
  const fromV = new Vector3();
  const dirV = new Vector3();
  return {
    resolveMaterial(from: Vec3, to: Vec3): MaterialId | null {
      fromV.set(from.x, from.y, from.z);
      dirV.set(to.x - from.x, to.y - from.y, to.z - from.z);
      const length = dirV.length();
      if (length < 1e-6) {
        return null;
      }
      dirV.scaleInPlace(1 / length);
      const pick: PickingInfo | null = scene.pickWithRay(new Ray(fromV, dirV, length), (mesh) => {
        return mesh.isPickable && mesh.name !== 'grass-field';
      });
      if (pick === null || !pick.hit || pick.pickedPoint === null || pick.pickedMesh === null) {
        return null;
      }
      const metadata = pick.pickedMesh.metadata as { material?: MaterialId } | undefined;
      if (metadata?.material) {
        return metadata.material;
      }
      return pick.pickedMesh.name === 'ground' ? 'dirt' : 'air';
    },
  };
}

const TRAJ_MAT_KEY = 'trajectory-mat';

export function drawTrajectory(scene: Scene, result: ShotResult, prev: LinesMesh | null): LinesMesh | null {
  if (prev !== null) {
    scene.removeMesh(prev);
    prev.dispose();
  }
  const points = result.path.map((p) => new Vector3(p.x, p.y, p.z));
  if (points.length < 2) {
    return null;
  }
  const line: LinesMesh = CreateLines(
    'trajectory',
    { points, updatable: false, instance: undefined },
    scene,
  );
  void Mesh;
  let mat = scene.getMaterialByName(TRAJ_MAT_KEY) as StandardMaterial | null;
  if (mat === null) {
    mat = new StandardMaterial(TRAJ_MAT_KEY, scene);
    mat.emissiveColor = new Color3(1, 0.7, 0.2);
    mat.disableLighting = true;
  }
  line.material = mat;
  line.isPickable = false;
  scene.addMesh(line);
  return line;
}
