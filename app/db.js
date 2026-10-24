/* Jot storage: a thin promise layer over IndexedDB, in this browser only.
 *   notes  { id, title, body, created, updated, state, trashed, pinned }
 */

const NAME = 'jot-notes'
let dbp = null

function db() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('notes', { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { dbp = null; reject(req.error) }
  })
  return dbp
}

async function tx(mode, fn) {
  const d = await db()
  const t = d.transaction('notes', mode)
  const out = fn(t.objectStore('notes'))
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error) })
  return out instanceof IDBRequest ? out.result : out
}

export const all = () => tx('readonly', s => s.getAll())
export const put = rec => tx('readwrite', s => s.put(rec))
export const putMany = recs => tx('readwrite', s => { for (const r of recs) s.put(r) })
export const del = id => tx('readwrite', s => s.delete(id))

export async function wipe() {
  const d = await db()
  d.close()
  dbp = null
  await new Promise(resolve => { const r = indexedDB.deleteDatabase(NAME); r.onsuccess = r.onerror = r.onblocked = resolve })
}
