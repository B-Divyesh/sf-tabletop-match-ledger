import type { Match } from './model';

const DB_NAME = 'tabletop-match-ledger';
const STORE = 'ledger';
export const REAL_MATCH_KEY = 'current-match';
export const DEMO_MATCH_KEY = 'demo:current-match';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
  });
}

export async function loadMatch(key = REAL_MATCH_KEY): Promise<Match | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as Match | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read the saved match.'));
  });
}

export async function saveMatch(match: Match | null, key = REAL_MATCH_KEY): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    if (match) transaction.objectStore(STORE).put(match, key);
    else transaction.objectStore(STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the match.'));
  });
}
