export interface AudioBuses {
  windGain: GainNode;
  setWind: (speed: number) => void;
  fire: () => void;
  impactDistance: (meters: number) => void;
  resume: () => void;
  suspend: () => void;
}

const NOISE_SECONDS = 3;

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 913;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

export function initAudio(): AudioBuses | null {
  const Ctor: typeof AudioContext | undefined =
    typeof window !== 'undefined' ? (window.AudioContext ?? undefined) : undefined;
  if (Ctor === undefined) {
    return null;
  }
  const ctx = new Ctor();

  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  const windSource = ctx.createBufferSource();
  windSource.buffer = createNoiseBuffer(ctx);
  windSource.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 420;
  windFilter.Q.value = 0.6;

  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;

  windSource.connect(windFilter).connect(windGain).connect(master);
  windSource.start();

  let lastFire = 0;

  return {
    windGain,
    setWind(speed: number): void {
      const target = Math.min(0.6, 0.04 + speed * 0.05);
      windGain.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
      windFilter.frequency.setTargetAtTime(300 + speed * 60, ctx.currentTime, 0.8);
    },
    fire(): void {
      const now = ctx.currentTime;
      if (now - lastFire < 0.08) {
        return;
      }
      lastFire = now;
      const burst = ctx.createBufferSource();
      burst.buffer = createNoiseBuffer(ctx);
      const boom = ctx.createBiquadFilter();
      boom.type = 'lowpass';
      boom.frequency.setValueAtTime(900, now);
      boom.frequency.exponentialRampToValueAtTime(120, now + 0.35);
      const crack = ctx.createBiquadFilter();
      crack.type = 'highpass';
      crack.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      burst.connect(boom).connect(master);
      burst.connect(crack).connect(gain).connect(master);
      gain.gain.setValueAtTime(0.5, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      burst.start(now, Math.random() * NOISE_SECONDS, 0.6);
    },
    impactDistance(meters: number): void {
      const delay = meters / 340;
      const now = ctx.currentTime + delay;
      const click = ctx.createBufferSource();
      click.buffer = createNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = meters > 150 ? 700 : 1400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      click.connect(filter).connect(gain).connect(master);
      click.start(now, Math.random() * NOISE_SECONDS, 0.25);
    },
    resume(): void {
      void ctx.resume();
    },
    suspend(): void {
      void ctx.suspend();
    },
  };
}
