/* Entrées : joystick tactile + regard au doigt + boutons HUD, et clavier/souris pour le développement.
   Tout passe par InputState { move, look, impulsions }. */

import { clamp } from './math.js';

export class InputState {
  constructor() {
    this.move = { x: 0, y: 0 };       // -1..1, y avant
    this.look = { dx: 0, dy: 0 };     // delta consommé par la caméra
    this.fire = false;                // impulsion (consommée par le joueur)
    this.holdBreath = false;
    this.sprint = false;
    this.scopeToggle = false;
    this.stanceToggle = false;
    this.cameraToggle = false;
    this.pause = false;
    this.interact = false;
  }
  consumeImpulses() {
    this.fire = false;
    this.scopeToggle = false;
    this.stanceToggle = false;
    this.cameraToggle = false;
    this.pause = false;
    this.interact = false;
  }
}

const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

export class InputController {
  constructor(element, state) {
    this.el = element;
    this.state = state;
    this.keys = new Set();
    this.pointerId = null;
    this.stickPointer = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.sensitivity = 0.0026;
    this.onWheel = null;
    this._install();
  }

  _install() {
    const el = this.el;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._syncKeys();
      if (e.code === 'KeyC') this.state.stanceToggle = true;
      if (e.code === 'KeyV') this.state.cameraToggle = true;
      if (e.code === 'Escape') this.state.pause = true;
      if (e.code === 'KeyE') this.state.interact = true;
      if (e.code === 'KeyR') this.state.scopeToggle = true;
      if (e.code === 'Space') { this.state.fire = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._syncKeys();
    });
    window.addEventListener('blur', () => { this.keys.clear(); this._syncKeys(); });

    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.state.fire = true;
      if (e.button === 2) this.state.scopeToggle = true;
      if (document.pointerLockElement !== el && el.requestPointerLock) {
        const p = el.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === el) {
        this.state.look.dx += e.movementX * this.sensitivity * 1.4;
        this.state.look.dy += e.movementY * this.sensitivity * 1.4;
      }
    });
    window.addEventListener('wheel', (e) => {
      if (this.onWheel) this.onWheel(Math.sign(e.deltaY));
    }, { passive: true });

    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const x = e.clientX, y = e.clientY;
      const w = window.innerWidth;
      if (x < w * 0.38 && y > window.innerHeight * 0.25) {
        if (this.stickPointer === null) {
          this.stickPointer = e.pointerId;
          this.stickOrigin = { x, y };
          this._showStick(x, y);
        }
      } else if (this.pointerId === null) {
        this.pointerId = e.pointerId;
        this.lastX = x; this.lastY = y;
      }
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickPointer) {
        const dx = e.clientX - this.stickOrigin.x;
        const dy = e.clientY - this.stickOrigin.y;
        const max = 48;
        const len = Math.hypot(dx, dy);
        const k = len > max ? max / len : 1;
        this.state.move.x = clamp((dx * k) / max, -1, 1);
        this.state.move.y = clamp((-dy * k) / max, -1, 1);
        this._moveNub(dx * k, dy * k);
        e.preventDefault();
      } else if (e.pointerId === this.pointerId) {
        this.state.look.dx += (e.clientX - this.lastX) * this.sensitivity;
        this.state.look.dy += (e.clientY - this.lastY) * this.sensitivity;
        this.lastX = e.clientX; this.lastY = e.clientY;
        e.preventDefault();
      }
    });
    const endPointer = (e) => {
      if (e.pointerId === this.stickPointer) {
        this.stickPointer = null;
        this.state.move.x = 0; this.state.move.y = 0;
        this._hideStick();
      }
      if (e.pointerId === this.pointerId) this.pointerId = null;
    };
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
  }

  _syncKeys() {
    const k = this.keys, s = this.state;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('KeyZ') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('KeyQ') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    s.move.x = len > 0 ? x / len : 0;
    s.move.y = len > 0 ? y / len : 0;
    s.holdBreath = k.has('ShiftLeft') || k.has('ShiftRight');
    s.sprint = k.has('ControlLeft') || k.has('ControlRight');
  }

  pressFire() { this.state.fire = true; }
  pressScope() { this.state.scopeToggle = true; }
  pressStance() { this.state.stanceToggle = true; }
  pressCamera() { this.state.cameraToggle = true; }
  pressPause() { this.state.pause = true; }
  pressInteract() { this.state.interact = true; }
  setBreath(on) { this.state.holdBreath = on; }
  setSprint(on) { this.state.sprint = on; }

  _showStick(x, y) {
    const base = document.getElementById('stick-base');
    const nub = document.getElementById('stick-nub');
    if (!base || !nub) return;
    base.style.display = 'block';
    nub.style.display = 'block';
    base.style.left = `${x - 48}px`;
    base.style.top = `${y - 48}px`;
    nub.style.left = `${x - 22}px`;
    nub.style.top = `${y - 22}px`;
  }
  _moveNub(dx, dy) {
    const nub = document.getElementById('stick-nub');
    const base = document.getElementById('stick-base');
    if (!nub || !base) return;
    const ox = parseFloat(base.style.left) + 48;
    const oy = parseFloat(base.style.top) + 48;
    nub.style.left = `${ox + dx - 22}px`;
    nub.style.top = `${oy + dy - 22}px`;
  }
  _hideStick() {
    const base = document.getElementById('stick-base');
    const nub = document.getElementById('stick-nub');
    if (base) base.style.display = 'none';
    if (nub) nub.style.display = 'none';
  }
}

export function isTouch() {
  return hasTouch;
}
