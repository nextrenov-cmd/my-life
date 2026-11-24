// 端末内データベース（IndexedDB）。サーバーへの送信は一切行わない。

const DB_NAME = 'mylife';
const VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('events')) {
        const ev = db.createObjectStore('events', { keyPath: 'id' });
        ev.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('checkups')) db.createObjectStore('checkups', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function run(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        const rq = fn(s);
        if (rq) rq.onsuccess = () => (out = rq.result);
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const kvGet = (k) => run('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => run('kv', 'readwrite', (s) => s.put(v, k));
export const kvDel = (k) => run('kv', 'readwrite', (s) => s.delete(k));
export const kvAll = () =>
  open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const out = {};
        const t = db.transaction('kv', 'readonly');
        const req = t.objectStore('kv').openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) {
            out[c.key] = c.value;
            c.continue();
          }
        };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
      })
  );

export const putEvent = (e) => run('events', 'readwrite', (s) => s.put(e));
export const deleteEvent = (id) => run('events', 'readwrite', (s) => s.delete(id));
export const allEvents = () => run('events', 'readonly', (s) => s.getAll());

export const putCheckup = (c) => run('checkups', 'readwrite', (s) => s.put(c));
export const deleteCheckup = (id) => run('checkups', 'readwrite', (s) => s.delete(id));
export const allCheckups = () => run('checkups', 'readonly', (s) => s.getAll());

export async function clearAll() {
  for (const st of ['kv', 'events', 'checkups']) await run(st, 'readwrite', (s) => s.clear());
}

export async function replaceAll({ kv = {}, events = [], checkups = [] }) {
  await clearAll();
  for (const [k, v] of Object.entries(kv)) await kvSet(k, v);
  const db = await open();
  await new Promise((resolve, reject) => {
    const t = db.transaction(['events', 'checkups'], 'readwrite');
    const es = t.objectStore('events');
    const cs = t.objectStore('checkups');
    events.forEach((e) => es.put(e));
    checkups.forEach((c) => cs.put(c));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
