export const SAVE_VERSION = 1;

export interface SettingsV1 {
  assistance: 'simulation' | 'realiste' | 'accessible';
  fpsTarget: 30 | 60;
  gyroEnabled: boolean;
  controlScale: number;
}

export interface SaveDataV1 {
  version: 1;
  createdAt: number;
  updatedAt: number;
  settings: SettingsV1;
  progress: {
    completedMissions: string[];
    flags: Record<string, boolean | number | string>;
  };
}

export function defaultSave(): SaveDataV1 {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    settings: { assistance: 'realiste', fpsTarget: 30, gyroEnabled: false, controlScale: 1 },
    progress: { completedMissions: [], flags: {} },
  };
}

export function migrateSave(raw: unknown): SaveDataV1 {
  if (typeof raw !== 'object' || raw === null) {
    return defaultSave();
  }
  const data = raw as { version?: number; flags?: Record<string, unknown> };
  switch (data.version) {
    case SAVE_VERSION: {
      const base = defaultSave();
      const provided = raw as Partial<SaveDataV1>;
      return {
        ...base,
        ...provided,
        version: 1,
        settings: { ...base.settings, ...(provided.settings ?? {}) },
        progress: {
          completedMissions: provided.progress?.completedMissions ?? [],
          flags: provided.progress?.flags ?? {},
        },
      };
    }
    default:
      return defaultSave();
  }
}

const DB_NAME = 'shadowline';
const STORE_NAME = 'save';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSave(): Promise<SaveDataV1> {
  try {
    const db = await openDb();
    return await new Promise<SaveDataV1>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get('current');
      request.onsuccess = () => resolve(migrateSave(request.result));
      request.onerror = () => reject(request.error);
    });
  } catch {
    return defaultSave();
  }
}

export async function writeSave(data: SaveDataV1): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ ...data, updatedAt: Date.now() }, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* save failure must never crash the game */
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function exportSaveFile(data: SaveDataV1): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shadowline-save-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importSaveFile(file: File): Promise<SaveDataV1> {
  const text = await file.text();
  return migrateSave(JSON.parse(text));
}
