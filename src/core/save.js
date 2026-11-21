/* Sauvegarde de campagne (localStorage). */

const KEY = 'sniper-life:save:v1';

export function defaultSave() {
  return {
    version: 1,
    createdAt: Date.now(),
    faction: null,          // 'state' | 'freelance' | 'circle'
    callsign: 'Ombre',
    episode: 0,
    missionIndex: 0,
    reputation: { state: 50, market: 50, circle: 50 },
    heat: 0,                // traque : plus elle est haute, plus les futures missions sont surveillées
    cash: 0,
    flags: {},
    stats: { missions: 0, kills: 0, spares: 0, shots: 0, failMissions: 0, playSeconds: 0 },
    settings: { quality: 'auto', volume: 0.8 }
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    console.warn('sauvegarde illisible', e);
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('sauvegarde impossible', e);
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
}

export function adjustReputation(save, faction, delta) {
  save.reputation[faction] = Math.max(0, Math.min(100, save.reputation[faction] + delta));
}
