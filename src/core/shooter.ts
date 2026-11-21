import { clamp } from './wind.ts';

export type Posture = 'stand' | 'kneel' | 'prone' | 'prone-supported';

export interface PostureProfile {
  baseSway: number;
  swayRecovery: number;
  breathCalmMs: number;
}

export const POSTURES: Record<Posture, PostureProfile> = {
  stand: { baseSway: 1.0, swayRecovery: 0.5, breathCalmMs: 4000 },
  kneel: { baseSway: 0.62, swayRecovery: 0.7, breathCalmMs: 4600 },
  prone: { baseSway: 0.3, swayRecovery: 0.85, breathCalmMs: 5200 },
  'prone-supported': { baseSway: 0.16, swayRecovery: 1.0, breathCalmMs: 6000 },
};

export type AssistanceLevel = 'simulation' | 'realiste' | 'accessible';

export interface ShooterCondition {
  posture: Posture;
  assistance: AssistanceLevel;
  fatigue: number;
  stress: number;
  heartRate: number;
  injuries: Set<'arm' | 'leg' | 'torso'>;
  breathHoldActive: boolean;
  breathHoldRemaining: number;
  breathHoldUsed: boolean;
}

export function createShooterCondition(assistance: AssistanceLevel, injured = false): ShooterCondition {
  const injuries = new Set<'arm' | 'leg' | 'torso'>();
  if (injured) {
    injuries.add('arm');
  }
  return {
    posture: 'stand',
    assistance,
    fatigue: 0,
    stress: 0.15,
    heartRate: 68,
    injuries,
    breathHoldActive: false,
    breathHoldRemaining: 0,
    breathHoldUsed: false,
  };
}

export function updateBody(state: ShooterCondition, dtSec: number, exertion: number): ShooterCondition {
  const halfLifeUpdate = (value: number, target: number, tau: number): number =>
    value + (target - value) * (1 - Math.exp(-dtSec / tau));

  const fatigueTarget = clamp(exertion, 0, 1);
  const stressTarget = clamp(state.stress + exertion * 0.1 - 0.05, 0, 1);
  const heartTarget = 58 + state.fatigue * 30 + state.stress * 40 + exertion * 25;

  return {
    ...state,
    fatigue: clamp(halfLifeUpdate(state.fatigue, fatigueTarget, 20), 0, 1),
    stress: clamp(halfLifeUpdate(state.stress, stressTarget, 6), 0, 1),
    heartRate: halfLifeUpdate(state.heartRate, heartTarget, 4),
  };
}

export function startBreathHold(state: ShooterCondition): ShooterCondition {
  if (state.breathHoldUsed || state.breathHoldActive) {
    return state;
  }
  const ms = POSTURES[state.posture].breathCalmMs;
  return { ...state, breathHoldActive: true, breathHoldRemaining: ms };
}

export function tickBreathHold(state: ShooterCondition, dtMs: number): ShooterCondition {
  if (!state.breathHoldActive) {
    return state;
  }
  const remaining = state.breathHoldRemaining - dtMs;
  return remaining <= 0
    ? { ...state, breathHoldActive: false, breathHoldRemaining: 0, breathHoldUsed: true }
    : { ...state, breathHoldRemaining: remaining };
}

export function releaseBreathHold(state: ShooterCondition): ShooterCondition {
  if (!state.breathHoldActive) {
    return state;
  }
  const penaltyRatio = 1 - state.breathHoldRemaining / POSTURES[state.posture].breathCalmMs;
  return { ...state, breathHoldActive: false, stress: clamp(state.stress + penaltyRatio * 0.25, 0, 1) };
}

const SWAY_HARMONICS = [
  { freq: 1.7, amp: 0.5, phase: 0.0 },
  { freq: 3.1, amp: 0.3, phase: 1.9 },
  { freq: 5.3, amp: 0.13, phase: 4.1 },
  { freq: 8.9, amp: 0.07, phase: 2.6 },
];

export interface SwayOffsets {
  x: number;
  y: number;
}

export function sway(state: ShooterCondition, timeSec: number): SwayOffsets {
  const profile = POSTURES[state.posture];
  const injury = state.injuries.has('arm') ? 1.35 : 1;
  const fatigueFactor = 1 + state.fatigue * 0.25;
  const stressFactor = 1 + state.stress * 0.2;
  const assistance = state.breathHoldActive ? 0.25 : 1;

  let x = 0;
  let y = 0;
  for (const h of SWAY_HARMONICS) {
    const t = timeSec * h.freq + h.phase;
    x += Math.sin(t) * h.amp;
    y += Math.cos(t * 0.83 + h.phase) * h.amp * 0.7;
  }

  const amplitude = (profile.baseSway / 8000) * injury * fatigueFactor * stressFactor * assistance;
  return { x: x * amplitude, y: y * amplitude };
}

export const TOTAL_SWAY_HARMONICS = SWAY_HARMONICS.length;
