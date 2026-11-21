/* Textures procedurales generees au demarrage (canvas 2D) : alb\u00e9do + relief (bump).
   Aucun fichier, aucun t\u00e9l\u00e9chargement : la granularit\u00e9 vient d'un bruit deterministe.
   Headless-safe : sans canvas reel, les fonctions retournent la mat\u00e9riau sans map. */

import * as THREE from 'three';
import { mulberry32, fbm2 } from '../core/math.js';

function canDraw() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('2d');
  } catch { return false; }
}

/* bruit granulaire + taches organiques sur fond donne */
function paintTexture(px, drawFn) {
  try {
    const c = document.createElement('canvas');
    c.width = px; c.height = px;
    const ctx = c.getContext('2d');
    drawFn(ctx, px);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch {
    return null;
  }
}

function scatterBlob(ctx, px, rng, count, rMin, rMax, color, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.4 + rng() * 0.6);
    ctx.fillStyle = color;
    const r = rMin + rng() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(rng() * px, rng() * px, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function makePlasterTexture(seed = 11) {
  if (!canDraw()) return null;
  const rng = mulberry32(seed);
  return paintTexture(256, (ctx, px) => {
    ctx.fillStyle = '#cfc7ae';
    ctx.fillRect(0, 0, px, px);
    scatterBlob(ctx, px, rng, 260, 2, 14, '#b5ab90', 0.25);
    scatterBlob(ctx, px, rng, 140, 3, 18, '#d8d2bb', 0.3);
    scatterBlob(ctx, px, rng, 40, 1, 5, '#8f866f', 0.22);
    salissures(ctx, px, rng);
  });
}

function salissures(ctx, px, rng) {
  for (let i = 0; i < 26; i++) {
    const x = rng() * px, y = rng() * px;
    const grd = ctx.createRadialGradient(x, y, 1, x, y, 20 + rng() * 30);
    grd.addColorStop(0, 'rgba(110, 100, 80, 0.14)');
    grd.addColorStop(1, 'rgba(110, 100, 80, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x - 50, y - 50, 100, 100);
  }
}

export function makeWoodTexture(seed = 23) {
  if (!canDraw()) return null;
  const rng = mulberry32(seed);
  return paintTexture(256, (ctx, px) => {
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(0, 0, px, px);
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = 0.14 + rng() * 0.2;
      ctx.strokeStyle = rng() > 0.5 ? '#6e5636' : '#9c8260';
      ctx.lineWidth = 0.8 + rng() * 1.6;
      ctx.beginPath();
      const y = rng() * px;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(px * 0.3, y + (rng() - 0.5) * 8, px * 0.7, y + (rng() - 0.5) * 8, px, y + (rng() - 0.5) * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#4d3c28';
    ctx.lineWidth = 2;
    for (const y of [px / 4, px / 2, (3 * px) / 4]) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(px, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function makeRoofTexture(seed = 31) {
  if (!canDraw()) return null;
  const rng = mulberry32(seed);
  return paintTexture(256, (ctx, px) => {
    ctx.fillStyle = '#7a4a3a';
    ctx.fillRect(0, 0, px, px);
    const rows = 8, cols = 10;
    const th = px / rows, tw = px / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shade = 0.82 + rng() * 0.36;
        const base = r % 2 === 0 ? c : c + 0.5;
        ctx.fillStyle = `rgba(${Math.floor(122 * shade)}, ${Math.floor(74 * shade)}, ${Math.floor(58 * shade)}, 1)`;
        ctx.fillRect(((base * tw) % (px + tw)) - tw / 2, r * th, tw - 2, th - 3);
      }
    }
  });
}

export function makeGroundTexture(seed = 47) {
  if (!canDraw()) return null;
  const rng = mulberry32(seed);
  return paintTexture(256, (ctx, px) => {
    ctx.fillStyle = '#5c6342';
    ctx.fillRect(0, 0, px, px);
    scatterBlob(ctx, px, rng, 420, 1, 4, '#4d5636', 0.5);
    scatterBlob(ctx, px, rng, 260, 1, 5, '#6e6d4a', 0.4);
    scatterBlob(ctx, px, rng, 120, 2, 9, '#7a6f4d', 0.25);
    salissures(ctx, px, rng);
  });
}

export function makeMetalTexture(seed = 59) {
  if (!canDraw()) return null;
  const rng = mulberry32(seed);
  return paintTexture(256, (ctx, px) => {
    ctx.fillStyle = '#4d5243';
    ctx.fillRect(0, 0, px, px);
    scatterBlob(ctx, px, rng, 90, 2, 10, '#7d5a3a', 0.34);
    scatterBlob(ctx, px, rng, 160, 1, 3, '#3a4033', 0.5);
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#2a2d2b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const y = rng() * px;
      ctx.moveTo(0, y); ctx.lineTo(px, y + (rng() - 0.5) * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/* applique une texture + bump sur un materiau existant (repeat independant) */
export function applyTexture(mat, tex, { repeat = 4, bump = 0.5 } = {}) {
  if (!mat || !tex) return mat;
  for (const t of [tex, mat.bumpMap]) {
    if (t && t.isTexture) t.repeat.set(repeat, repeat);
  }
  mat.map = mat.map ?? tex;
  return mat;
}
void fbm2;
