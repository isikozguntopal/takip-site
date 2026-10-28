// Everything is stored in this browser's IndexedDB. Nothing leaves the device.
const DB_NAME = 'seans-takip';
const DB_VERSION = 2;
const STORES = ['clients', 'sessions', 'payments', 'series'];

let dbPromise = null;

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!req.result.objectStoreNames.contains(name)) {
            req.result.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await openDb();
  return request(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function put(store, record) {
  const db = await openDb();
  return request(db.transaction(store, 'readwrite').objectStore(store).put(record));
}

export async function remove(store, id) {
  const db = await openDb();
  return request(db.transaction(store, 'readwrite').objectStore(store).delete(id));
}

// Replaces all data in one transaction, so a failed import leaves the old data intact.
export async function replaceAll({ clients, sessions, payments, series = [] }) {
  const db = await openDb();
  const data = { clients, sessions, payments, series };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    for (const name of STORES) {
      const store = tx.objectStore(name);
      store.clear();
      for (const record of data[name]) store.put(record);
    }
  });
}
