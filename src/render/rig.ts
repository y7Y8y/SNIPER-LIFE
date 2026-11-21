import { UniversalCamera, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import {
  createShooterCondition,
  releaseBreathHold,
  startBreathHold,
  sway,
  tickBreathHold,
  updateBody,
} from '../core/shooter.ts';
import type { AssistanceLevel, Posture, ShooterCondition } from '../core/shooter.ts';

const POSTURE_CYCLE: Posture[] = ['stand', 'kneel', 'prone', 'prone-supported'];

const POSTURE_PIVOT: Record<Posture, number> = {
  stand: 1.7,
  kneel: 1.2,
  prone: 0.62,
  'prone-supported': 0.62,
};

const POSTURE_SPEED: Record<Posture, number> = {
  stand: 2.6,
  kneel: 1.6,
  prone: 0.5,
  'prone-supported': 0.5,
};

export class Rig {
  readonly camera: UniversalCamera;

  yaw = Math.PI * 0.25;
  pitch = 0;
  scoped = false;
  condition: ShooterCondition;
  scopedSensitivity = 0.14;
  hipSensitivity = 0.5;

  constructor(scene: Scene, position: Vector3, assistance: AssistanceLevel) {
    this.condition = createShooterCondition(assistance);
    this.camera = new UniversalCamera('rig-cam', position.clone(), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 1200;
    this.camera.fov = 0.8;
    this.camera.inputs.clear();
    this.camera.rotation.set(this.yaw, this.pitch, 0);
  }

  cyclePosture(): Posture {
    const index = POSTURE_CYCLE.indexOf(this.condition.posture);
    const next = POSTURE_CYCLE[(index + 1) % POSTURE_CYCLE.length]!;
    this.condition = { ...this.condition, posture: next };
    return next;
  }

  setScoped(value: boolean): void {
    this.scoped = value;
    const zoom = value ? 0.8 / 8 : 0.8;
    this.camera.fov = zoom;
  }

  setBreathHold(active: boolean): void {
    if (active) {
      this.condition = startBreathHold(this.condition);
    } else {
      this.condition = releaseBreathHold(this.condition);
    }
  }

  lookDeltaX(dxPx: number, dtSec: number): void {
    const sensitivity = (this.scoped ? this.scopedSensitivity : this.hipSensitivity) / 1000;
    this.yaw -= dxPx * sensitivity * 60 * Math.min(dtSec * 60, 2) * 0.05;
  }

  lookDeltaY(dyPx: number, dtSec: number): void {
    const sensitivity = (this.scoped ? this.scopedSensitivity : this.hipSensitivity) / 1000;
    this.pitch -= dyPx * sensitivity * 60 * Math.min(dtSec * 60, 2) * 0.05;
  }

  applyGyroAlphaDelta(deltaDeg: number): void {
    this.yaw -= (deltaDeg * Math.PI) / 180;
  }

  applyGyroBetaDelta(deltaDeg: number): void {
    this.pitch -= (deltaDeg * Math.PI) / 180;
  }

  move(strafe: number, forward: number, dtSec: number, resolveHeight: (x: number, z: number) => number): void {
    if (Math.abs(strafe) < 0.001 && Math.abs(forward) < 0.001) {
      return;
    }
    const speed = POSTURE_SPEED[this.condition.posture];
    const len = Math.hypot(strafe, forward);
    const dirYaw = this.yaw + Math.atan2(strafe, forward);
    const distance = speed * dtSec * Math.min(1, len);
    this.camera.position.x -= Math.sin(dirYaw) * distance;
    this.camera.position.z -= Math.cos(dirYaw) * distance;
    this.camera.position.y =
      resolveHeight(this.camera.position.x, this.camera.position.z) + POSTURE_PIVOT[this.condition.posture];
  }

  update(dtSec: number, timeSec: number): void {
    this.condition = updateBody(this.condition, dtSec, 0);
    this.condition = tickBreathHold(this.condition, dtSec * 1000);
    const offsets = sway(this.condition, timeSec);
    this.camera.rotation.x = this.pitch + offsets.y * 8;
    this.camera.rotation.y = this.yaw + offsets.x * 8;
  }
}
