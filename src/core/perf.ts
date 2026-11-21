export interface QualityLevel {
  resolutionScale: number;
  shadows: boolean;
  grassDensity: number;
}

export const QUALITY_LEVELS: QualityLevel[] = [
  { resolutionScale: 0.5, shadows: false, grassDensity: 0.4 },
  { resolutionScale: 0.6, shadows: true, grassDensity: 0.7 },
  { resolutionScale: 0.75, shadows: true, grassDensity: 1.0 },
];

export interface GovernorOptions {
  lowFpsThreshold: number;
  highFpsThreshold: number;
  lowDurationMs: number;
  highDurationMs: number;
}

export const DEFAULT_GOVERNOR_OPTIONS: GovernorOptions = {
  lowFpsThreshold: 28,
  highFpsThreshold: 40,
  lowDurationMs: 5000,
  highDurationMs: 10000,
};

export class QualityGovernor {
  private lowMs = 0;
  private highMs = 0;
  private level: number;
  private readonly options: GovernorOptions;

  constructor(initialLevel = QUALITY_LEVELS.length - 1, options: GovernorOptions = DEFAULT_GOVERNOR_OPTIONS) {
    this.level = Math.max(0, Math.min(QUALITY_LEVELS.length - 1, initialLevel));
    this.options = options;
  }

  get quality(): QualityLevel {
    return QUALITY_LEVELS[this.level]!;
  }

  get levelIndex(): number {
    return this.level;
  }

  onFrame(fps: number, dtMs: number): 'down' | 'up' | null {
    const { lowFpsThreshold, highFpsThreshold, lowDurationMs, highDurationMs } = this.options;

    if (fps < lowFpsThreshold) {
      this.lowMs += dtMs;
      this.highMs = Math.max(0, this.highMs - dtMs);
    } else if (fps > highFpsThreshold) {
      this.highMs += dtMs;
      this.lowMs = Math.max(0, this.lowMs - dtMs);
    } else {
      this.lowMs = Math.max(0, this.lowMs - dtMs * 0.5);
      this.highMs = Math.max(0, this.highMs - dtMs * 0.5);
    }

    if (this.lowMs >= lowDurationMs && this.level > 0) {
      this.lowMs = 0;
      this.level -= 1;
      return 'down';
    }
    if (this.highMs >= highDurationMs && this.level < QUALITY_LEVELS.length - 1) {
      this.highMs = 0;
      this.level += 1;
      return 'up';
    }
    return null;
  }
}

export class RollingFps {
  private readonly samples: number[] = [];
  private readonly windowSize: number;
  private readonly minSample: number;

  constructor(windowSize = 90, minSample = 1) {
    this.windowSize = windowSize;
    this.minSample = minSample;
  }

  push(fps: number): void {
    this.samples.push(fps);
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }

  get average(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    return sum / this.samples.length;
  }

  get stable(): boolean {
    return this.samples.length >= this.minSample;
  }
}
