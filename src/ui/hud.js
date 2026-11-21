/* HUD complet : objectif, boussole, souffle/sante, posture, munitions, alerte, lunette. */

import { clamp } from '../core/math.js';
import { isTouch } from '../core/input.js';

export class HUD {
  constructor(root, audio, player, input) {
    this.root = root;
    this.audio = audio;
    this.player = player;
    this.input = input;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div class="hud-objective"><span class="kicker">Objectif</span><span id="obj-text">—</span></div>
      <canvas id="minimap" width="110" height="110"></canvas>
      <div class="compass"><div class="compass-strip" id="compass-strip"></div></div>
      <div class="stance-glyph" id="stance-glyph">Debout</div>
      <div id="alert-eye"><span>Menace</span><div class="eye"><i id="eye-fill"></i></div></div>
      <div class="hud-left">
        <div class="meter breath"><div class="label">Souffle</div><div class="bar"><i id="breath-fill"></i></div></div>
        <div class="meter health"><div class="label">Santé</div><div class="bar"><i id="health-fill"></i></div></div>
      </div>
      <div class="hud-right">
        <div class="ammo" id="ammo">5.56</div>
        <div id="weather-label">—</div>
      </div>
      <div id="hit-flash"></div>
      <div class="toasts" id="toasts"></div>
    `;
    root.appendChild(this.el);

    this.scopeCanvas = document.getElementById('scope-fx');
    this.scopeCtx = this.scopeCanvas.getContext('2d');
    this.miniCtx = document.getElementById('minimap')?.getContext('2d');
    this.mildotSpacing = 44; // px entre mildots a 8x

    this._buildCompass();
    this._buildTouch();
    this.stressActive = 0;
  }

  _buildCompass() {
    const strip = this.el.querySelector('#compass-strip');
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
    const frag = document.createElement('div');
    frag.className = 'compass-strip';
    frag.id = 'compass-strip';
    for (let r = -1; r <= 1; r++) {
      for (let a = 0; a < 360; a += 15) {
        const t = document.createElement('div');
        t.className = 'tick' + (a % 45 === 0 ? ' major' : '');
        if (a % 45 === 0) {
          const lbl = document.createElement('span');
          const real = ((a + r * 360) % 360 + 360) % 360;
          lbl.textContent = names[real] ?? '';
          t.appendChild(lbl);
        }
        frag.appendChild(t);
      }
    }
    strip.replaceWith(frag);
    this.compassStrip = frag;
  }

  _buildTouch() {
    if (!isTouch()) return;
    const layer = document.createElement('div');
    layer.id = 'touch-layer';
    layer.innerHTML = `
      <div class="stick-zone"></div>
      <div class="stick-base" id="stick-base" style="display:none"></div>
      <div class="stick-nub" id="stick-nub" style="display:none"></div>
      <div class="touch-btn round" id="btn-fire">Tir</div>
      <div class="touch-btn round" id="btn-scope">Lunette</div>
      <div class="touch-btn round" id="btn-stance">Posture</div>
      <div class="touch-btn round" id="btn-breath">Apnée</div>
      <div class="touch-btn round" id="btn-camera">Cam</div>
      <div class="touch-btn round" id="btn-pause">II</div>
    `;
    this.root.appendChild(layer);
    this.touchLayer = layer;

    const press = (id, fn, holdFn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('active');
        if (holdFn) holdFn(true); else fn();
      };
      const up = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('active');
        if (holdFn) holdFn(false);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    };
    press('btn-fire', () => this.input.pressFire());
    press('btn-scope', () => this.input.pressScope());
    press('btn-stance', () => this.input.pressStance());
    press('btn-camera', () => this.input.pressCamera());
    press('btn-pause', () => this.input.pressPause());
    press('btn-breath', null, (on) => this.input.setBreath(on));
    this.bindCameraToggle = () => {};
  }

  showTouchControls(on) {
    if (this.touchLayer) this.touchLayer.classList.toggle('hidden', !on);
  }

  setObjective(text) {
    this.el.querySelector('#obj-text').textContent = text;
  }

  setAmmo(shown) {
    this.el.querySelector('#ammo').textContent = shown;
  }

  /* minimap tactique : nord en haut, 1 px = 1.13 m, nous au centre */
  renderMinimap(mission) {
    const ctx = this.miniCtx;
    if (!ctx) return;
    const S = 110, s = S / 124, half = S / 2;
    const px = this.player.x, pz = this.player.z;
    const mx = (wx) => half + (wx - px) * s;
    const mz = (wz) => half + (wz - pz) * s;
    ctx.clearRect(0, 0, S, S);

    for (const o of mission.occluders ?? []) {
      ctx.fillStyle = 'rgba(190, 196, 170, 0.14)';
      ctx.fillRect(mx(o.minX), mz(o.minZ), (o.maxX - o.minX) * s, (o.maxZ - o.minZ) * s);
    }
    const o = mission.currentObjective?.();
    if (o?.pos) {
      ctx.strokeStyle = 'rgba(217, 154, 43, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mx(o.pos.x) - 3, mz(o.pos.z) - 3, 6, 6);
    }
    if (mission.def?.extraction) {
      ctx.strokeStyle = 'rgba(217, 154, 43, 0.5)';
      ctx.beginPath();
      ctx.arc(mx(mission.def.extraction.x), mz(mission.def.extraction.z), mission.def.extraction.r * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const g of mission.guards ?? []) {
      if (g.dead) continue;
      ctx.fillStyle = g.alert > 0.85 ? 'rgba(196, 74, 53, 0.95)'
        : g.alert > 0.3 ? 'rgba(217, 154, 43, 0.8)' : 'rgba(150, 164, 110, 0.6)';
      ctx.beginPath();
      ctx.arc(mx(g.x), mz(g.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(Math.PI - this.player.yaw);
    ctx.fillStyle = '#f2e8c9';
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(3.6, 4); ctx.lineTo(0, 2); ctx.lineTo(-3.6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  setWeather(label) {
    this.el.querySelector('#weather-label').textContent = label;
  }

  setStance(s) {
    const names = ['Debout', 'Accroupi', 'Couché'];
    this.el.querySelector('#stance-glyph').textContent = names[s] ?? '';
  }

  setBreathHealth(breath, health) {
    this.el.querySelector('#breath-fill').style.transform = `scaleX(${clamp(breath, 0, 1)})`;
    this.el.querySelector('#health-fill').style.transform = `scaleX(${clamp(health / 100, 0, 1)})`;
  }

  setAlert(level) {
    // level 0..1 : remplissage de l'oeil + couleur
    const fill = this.el.querySelector('#eye-fill');
    fill.style.width = `${clamp(level, 0, 1) * 100}%`;
  }

  setStress(stress, breath, health) {
    const v = document.getElementById('vignette');
    v.classList.toggle('stress', stress > 0.45);
    this.setBreathHealth(breath, health);
  }

  hitFlash() {
    const f = this.el.querySelector('#hit-flash');
    f.style.transition = 'none';
    f.style.opacity = '0.85';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 0.7s';
      f.style.opacity = '0';
    });
  }

  toast(text, warn = false, quiet = false) {
    if (quiet) return; // whispers pour l'ambiance plus tard
    const wrap = this.el.querySelector('#toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (warn ? ' warn' : '');
    t.textContent = text;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3800);
  }

  updateCompass(yaw) {
    const width = this.compassStrip ? this.compassStrip.parentElement.clientWidth : 300;
    const deg = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const strip = this.compassStrip;
    if (!strip) return;
    const pxPerDeg = 2; // marge de 45 px par tick de 15 deg
    const offset = width / 2 - (deg + 360) * pxPerDeg - 22.5;
    strip.style.transform = `translateX(${offset}px)`;
  }

  setScope(enabled, zoom, breath, holding) {
    this.scopeOn = enabled;
    this.scopeZoom = zoom;
    this.scopeBreath = breath;
    this.scopeHolding = holding;
  }

  /* Rendu de la lunette (canvas 2D superpose au rendu 3D) */
  renderScope(player, dt) {
    void dt;
    const c = this.scopeCanvas;
    const ctx = this.scopeCtx;
    if (!player.scoped) {
      if (this._scopeShown) {
        ctx.clearRect(0, 0, c.width, c.height);
        this._scopeShown = false;
      }
      return;
    }
    if (c.width !== c.clientWidth || c.height !== c.clientHeight) {
      c.width = c.clientWidth;
      c.height = c.clientHeight;
    }
    const W = c.width, H = c.height;
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.46;
    ctx.clearRect(0, 0, W, H);

    // exterieur opaque avec vignette interne
    const grad = ctx.createRadialGradient(cx, cy, R * 0.75, cx, cy, R * 1.06);
    grad.addColorStop(0, 'rgba(4,6,4,0)');
    grad.addColorStop(1, 'rgba(4,6,4,1)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
    ctx.fill();

    // teinte de verre
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(190, 210, 190, 0.05)';
    ctx.fillRect(0, 0, W, H);

    // reticule : croix + mildots
    ctx.strokeStyle = 'rgba(10, 12, 10, 0.9)';
    ctx.lineWidth = Math.max(1, W / 900);
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx - 12, cy);
    ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy - 12);
    ctx.moveTo(cx, cy + 12); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    const spacing = this.mildotSpacing * (this.player.currentFov() / 18);
    ctx.fillStyle = 'rgba(10,12,10,0.9)';
    for (let i = 1; i <= 4; i++) {
      for (const [dx, dy] of [[0, i], [0, -i], [i, 0], [-i, 0]]) {
        ctx.beginPath();
        ctx.arc(cx + dx * spacing, cy + dy * spacing, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // chevron central
    ctx.strokeStyle = 'rgba(190, 30, 30, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 4); ctx.lineTo(cx, cy - 4); ctx.lineTo(cx + 6, cy + 4);
    ctx.stroke();
    ctx.restore();

    // vignette de souffle : le relief tremble si le souffle manque
    const breathEdge = 1 - player.breath;
    if (breathEdge > 0.25) {
      const vg = ctx.createRadialGradient(cx, cy, R * (0.55 - breathEdge * 0.2), cx, cy, R);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${(breathEdge - 0.25) * 1.2})`);
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // indication d'apnee
    if (player.holdingBreath) {
      ctx.fillStyle = 'rgba(216, 222, 200, 0.8)';
      ctx.font = `11px ${'monospace'}`;
      ctx.textAlign = 'center';
      ctx.fillText('— apnée —', cx, cy + R * 0.86);
    }
    this._scopeShown = true;
  }

  dispose() {
    this.el.remove();
    const layer = document.getElementById('touch-layer');
    if (layer) layer.remove();
    const ctx = this.scopeCtx;
    ctx.clearRect(0, 0, this.scopeCanvas.width, this.scopeCanvas.height);
  }
}
