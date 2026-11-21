export interface WindDisplay {
  directionDeg: number;
  speed: number;
}

export function initHud(): {
  portraitWarning: HTMLElement;
  touchStart: HTMLElement;
  hud: HTMLElement;
  fpsMeter: HTMLElement;
  qualityMeter: HTMLElement;
  windDirection: HTMLElement;
  windSpeed: HTMLElement;
  scopeOverlay: HTMLElement;
  hint: HTMLElement;
  glare: HTMLElement;
} {
  const pick = (id: string): HTMLElement => {
    const el = document.getElementById(id);
    if (el === null) {
      throw new Error(`HUD element missing: ${id}`);
    }
    return el;
  };
  return {
    portraitWarning: pick('portrait-warning'),
    touchStart: pick('touch-to-start'),
    hud: pick('hud'),
    fpsMeter: pick('fps-meter'),
    qualityMeter: pick('quality-meter'),
    windDirection: pick('wind-direction'),
    windSpeed: pick('wind-speed'),
    scopeOverlay: pick('scope-overlay'),
    glare: pick('scope-glare'),
    hint: pick('hint'),
  };
}

export function updateFpsMeter(fpsMeter: HTMLElement, fps: number): void {
  fpsMeter.textContent = `${Math.round(fps)} fps`;
}

export function updateQualityMeter(qualityMeter: HTMLElement, label: string): void {
  qualityMeter.textContent = `qualité ${label}`;
}

export function updateWind(windDirection: HTMLElement, windSpeed: HTMLElement, sample: WindDisplay): void {
  windDirection.textContent = `${Math.round(((sample.directionDeg * 180) / Math.PI + 360) % 360)}°`;
  windSpeed.textContent = `${sample.speed.toFixed(1)} m/s`;
}

export function setScopeVisible(scopeOverlay: HTMLElement, visible: boolean): void {
  scopeOverlay.classList.toggle('hidden', !visible);
}

export function setGlare(glare: HTMLElement, amount: number): void {
  if (amount > 0.02) {
    glare.classList.remove('hidden');
    glare.style.opacity = Math.min(1, amount).toFixed(3);
  } else {
    glare.classList.add('hidden');
  }
}

let hintTimer: number | null = null;
export function showHint(hint: HTMLElement, message: string, durationMs = 4000): void {
  hint.textContent = message;
  hint.classList.remove('hidden');
  if (hintTimer !== null) {
    window.clearTimeout(hintTimer);
  }
  hintTimer = window.setTimeout(() => {
    hint.classList.add('hidden');
  }, durationMs);
}
