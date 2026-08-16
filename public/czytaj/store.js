import { createProgress, PROGRESS_SCHEMA_VERSION } from './engine.js';

const DB_NAME = 'czytaj-progress';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'progress';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => database.close();
    tx.onerror = () => reject(tx.error);
  });
}

export const progressStore = {
  async load() {
    const progress = await transaction('readonly', (store) => store.get(KEY));
    if (!progress) return createProgress();
    if (progress.schemaVersion !== PROGRESS_SCHEMA_VERSION) throw new Error('Nieobsługiwana wersja danych postępu.');
    return progress;
  },
  async save(progress) {
    const next = structuredClone(progress);
    next.updatedAt = new Date().toISOString();
    await transaction('readwrite', (store) => store.put(next, KEY));
    return next;
  },
  async reset() {
    await transaction('readwrite', (store) => store.delete(KEY));
    return createProgress();
  }
};

async function checksum(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function exportBackup(progress) {
  const payload = { format: 'czytaj-progress', schemaVersion: PROGRESS_SCHEMA_VERSION, exportedAt: new Date().toISOString(), progress };
  const serialized = JSON.stringify(payload);
  return JSON.stringify({ payload, checksum: await checksum(serialized) }, null, 2);
}

export async function validateBackup(text) {
  let wrapper;
  try { wrapper = JSON.parse(text); } catch { throw new Error('Plik nie jest poprawnym JSON-em.'); }
  if (!wrapper?.payload || !wrapper?.checksum) throw new Error('Brakuje danych lub sumy kontrolnej.');
  const actual = await checksum(JSON.stringify(wrapper.payload));
  if (actual !== wrapper.checksum) throw new Error('Suma kontrolna nie pasuje. Plik mógł zostać uszkodzony.');
  if (wrapper.payload.format !== 'czytaj-progress') throw new Error('To nie jest kopia aplikacji Czytaj.');
  if (wrapper.payload.schemaVersion > PROGRESS_SCHEMA_VERSION) throw new Error('Kopia pochodzi z nowszej wersji aplikacji.');
  if (wrapper.payload.schemaVersion !== PROGRESS_SCHEMA_VERSION) throw new Error('Ta wersja kopii nie jest obsługiwana.');
  const progress = wrapper.payload.progress;
  if (!progress?.profile || !Array.isArray(progress.sessions) || !Array.isArray(progress.reviewQueue)) throw new Error('Kopia nie zawiera kompletnego postępu.');
  return structuredClone(progress);
}

export async function importBackupAtomically(text) {
  const validated = await validateBackup(text);
  await progressStore.save(validated);
  return validated;
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}
