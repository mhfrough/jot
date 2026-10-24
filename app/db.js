/* Jot storage: a thin promise layer over IndexedDB, in this browser only.
 *   notes   { id, title, body, created, updated, state, trashed, pinned }   plain
 *   locked  { id, iv, ct }                                                 sealed by vault.js
 *   meta    key -> value ('locked': the Locked tab's key header)
 */

const NAME = 'jot-notes'
let dbp = null

function db() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 2)
    req.onupgradeneeded = () => {
      const d = req.result
      for (const [store, key] of [['notes', 'id'], ['locked', 'id'], ['meta', null]]) {
        if (!d.objectStoreNames.contains(store)) d.createObjectStore(store, key ? { keyPath: key } : undefined)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { dbp = null; reject(req.error) }
  })
  return dbp
}

async function tx(store, mode, fn) {
  const d = await db()
  const t = d.transaction(store, mode)
  const out = fn(t.objectStore(store))
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error) })
  return out instanceof IDBRequest ? out.result : out
}

export const all = (store = 'notes') => tx(store, 'readonly', s => s.getAll())
export const put = (rec, store = 'notes') => tx(store, 'readwrite', s => s.put(rec))
export const putMany = (recs, store = 'notes') => tx(store, 'readwrite', s => { for (const r of recs) s.put(r) })
export const del = (id, store = 'notes') => tx(store, 'readwrite', s => s.delete(id))
export const clear = store => tx(store, 'readwrite', s => s.clear())
export const getMeta = key => tx('meta', 'readonly', s => s.get(key))
export const setMeta = (key, value) => tx('meta', 'readwrite', s => s.put(value, key))
export const delMeta = key => tx('meta', 'readwrite', s => s.delete(key))

// Moves a note between the plain and the locked store in one transaction, so it is never in both or neither
export async function move(from, to, id, rec) {
  const d = await db()
  const t = d.transaction([from, to], 'readwrite')
  t.objectStore(from).delete(id)
  t.objectStore(to).put(rec)
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error) })
}

export async function wipe() {
  const d = await db()
  d.close()
  dbp = null
  await new Promise(resolve => { const r = indexedDB.deleteDatabase(NAME); r.onsuccess = r.onerror = r.onblocked = resolve })
}
