export interface TouchCallbacks {
  onStick: (strafe: number, forward: number) => void;
  onLook: (dxPx: number, dyPx: number, firstMove: boolean) => void;
  onScope: (active: boolean) => void;
  onBreath: (active: boolean) => void;
  onFire: () => void;
  onPosture: () => void;
  onFocus: () => void;
}

const STICK = { deadZone: 0.14, maxRadius: 55 };

interface PointerRecord {
  role: 'stick' | 'look';
  lastX: number;
  lastY: number;
  firstMove: boolean;
}

export function bindTouchControls(root: HTMLElement, callbacks: TouchCallbacks): () => void {
  root.style.touchAction = 'none';
  const pointers = new Map<number, PointerRecord>();
  const stickContainer = document.getElementById('stick-container')!;
  const stickKnob = document.getElementById('stick-knob')!;
  const btnScope = document.getElementById('btn-scope')!;
  const btnBreath = document.getElementById('btn-breath')!;
  const btnFire = document.getElementById('btn-fire')!;
  const btnPosture = document.getElementById('btn-posture')!;

  let stickCenterX = 0;
  let stickCenterY = 0;

  const setKnob = (dx: number, dy: number): void => {
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  let scopedActive = false;

  window.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('.pill') !== null) {
      return;
    }
    event.preventDefault();
    if (event.clientX < window.innerWidth / 2) {
      stickCenterX = event.clientX;
      stickCenterY = event.clientY;
      stickContainer.style.left = `${event.clientX - STICK.maxRadius}px`;
      stickContainer.style.bottom = 'auto';
      stickContainer.style.top = `${event.clientY - STICK.maxRadius}px`;
      pointers.set(event.pointerId, { role: 'stick', lastX: event.clientX, lastY: event.clientY, firstMove: true });
      setKnob(0, 0);
      return;
    }
    pointers.set(event.pointerId, { role: 'look', lastX: event.clientX, lastY: event.clientY, firstMove: true });
  });

  window.addEventListener('pointermove', (event) => {
    const record = pointers.get(event.pointerId);
    if (record === undefined) {
      return;
    }
    if (record.role === 'stick') {
      const dx = event.clientX - stickCenterX;
      const dy = event.clientY - stickCenterY;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, STICK.maxRadius);
      const nx = (dx / len) * clamped;
      const ny = (dy / len) * clamped;
      setKnob(nx, ny);
      let strafe = nx / STICK.maxRadius;
      let forward = -ny / STICK.maxRadius;
      if (Math.hypot(strafe, forward) < STICK.deadZone) {
        strafe = 0;
        forward = 0;
      }
      callbacks.onStick(strafe, forward);
    } else {
      const dx = event.clientX - record.lastX;
      const dy = event.clientY - record.lastY;
      record.lastX = event.clientX;
      record.lastY = event.clientY;
      const first = record.firstMove;
      record.firstMove = false;
      callbacks.onLook(dx, dy, first);
    }
  });

  const releasePointer = (event: PointerEvent): void => {
    const record = pointers.get(event.pointerId);
    if (record === undefined) {
      return;
    }
    pointers.delete(event.pointerId);
    if (record.role === 'stick') {
      callbacks.onStick(0, 0);
      setKnob(0, 0);
      stickContainer.style.left = `calc(28px + env(safe-area-inset-left, 0px))`;
      stickContainer.style.top = 'auto';
      stickContainer.style.bottom = `calc(28px + env(safe-area-inset-bottom, 0px))`;
    }
  };
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);

  const bindButton = (
    element: HTMLElement,
    down: () => void,
    up?: () => void,
  ): void => {
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      element.classList.add('active');
      down();
      callbacks.onFocus();
    });
    element.addEventListener('pointerup', () => {
      element.classList.remove('active');
      up?.();
    });
    element.addEventListener('pointerleave', () => {
      element.classList.remove('active');
      up?.();
    });
  };

  bindButton(btnScope, () => {
    scopedActive = !scopedActive;
    callbacks.onScope(scopedActive);
  });
  bindButton(btnBreath, () => callbacks.onBreath(true), () => callbacks.onBreath(false));
  bindButton(btnFire, () => callbacks.onFire());
  bindButton(btnPosture, () => callbacks.onPosture());

  return () => {
    pointers.clear();
  };
}
