/* Jot vault: every key and every encrypted byte. No DOM, no storage; app.js does those.
 *
 * A passphrase never encrypts notes directly. It is stretched with PBKDF2-SHA-256 into a key
 * that wraps (encrypts) a random 256-bit data key, and the data key encrypts the notes with
 * AES-256-GCM. Changing the passphrase rewraps one key. Only the Locked tab uses it.
 *
 * Header: { v, kdf, iter, salt, iv, key }   (base64 strings, so a backup can carry it as is)
 * Record: { id, iv, ct }                    (Uint8Array in IndexedDB, base64 in a backup)
 */

const enc = new TextEncoder()
const dec = new TextDecoder()
const subtle = crypto.subtle

export const ITERATIONS = 600000
const PAD = 64

export const b64 = bytes => {
  let s = ''
  const u = new Uint8Array(bytes)
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
export const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0))
export const random = n => crypto.getRandomValues(new Uint8Array(n))

async function stretch(pass, salt, iter, usages) {
  const base = await subtle.importKey('raw', enc.encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, usages)
}

const WRAP_AAD = enc.encode('jot:key:v1')

// A new vault: a random data key, wrapped by the passphrase. Returns the header and the key.
export async function create(pass, iter = ITERATIONS) {
  const salt = random(16)
  const iv = random(12)
  const kek = await stretch(pass, salt, iter, ['wrapKey'])
  const dataKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const wrapped = await subtle.wrapKey('raw', dataKey, kek, { name: 'AES-GCM', iv, additionalData: WRAP_AAD })
  const header = { v: 1, kdf: 'PBKDF2-SHA-256', iter, salt: b64(salt), iv: b64(iv), key: b64(wrapped) }
  return { header, key: await open(header, pass) }
}

// The data key for a header, or null when the passphrase is wrong (GCM refuses to unwrap).
// The key comes back non-extractable: script can use it but never read its bytes.
export async function open(header, pass, extractable = false) {
  if (!header || header.v !== 1 || header.kdf !== 'PBKDF2-SHA-256') throw new Error('Unknown vault format')
  const kek = await stretch(pass, unb64(header.salt), header.iter, ['unwrapKey'])
  try {
    return await subtle.unwrapKey('raw', unb64(header.key), kek, { name: 'AES-GCM', iv: unb64(header.iv), additionalData: WRAP_AAD },
      { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt'])
  } catch { return null }
}

// Same data key under a new passphrase (and a fresh salt). Notes stay as they are.
export async function rewrap(header, oldPass, newPass, iter = ITERATIONS) {
  const dataKey = await open(header, oldPass, true)
  if (!dataKey) return null
  const salt = random(16)
  const iv = random(12)
  const kek = await stretch(newPass, salt, iter, ['wrapKey'])
  const wrapped = await subtle.wrapKey('raw', dataKey, kek, { name: 'AES-GCM', iv, additionalData: WRAP_AAD })
  return { v: 1, kdf: 'PBKDF2-SHA-256', iter, salt: b64(salt), iv: b64(iv), key: b64(wrapped) }
}

// The note id and its section are bound in, so one stored record cannot stand in for another.
const aad = (space, id) => enc.encode(`jot:note:v1:${space}:${id}`)

export async function seal(key, space, id, note) {
  let text = JSON.stringify(note)
  // Pad to a multiple of 64 bytes so stored sizes say less about the text
  const len = enc.encode(text).length
  text += ' '.repeat((PAD - (len % PAD)) % PAD)
  const iv = random(12)
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(space, id) }, key, enc.encode(text)))
  return { id, iv, ct }
}

export async function unseal(key, space, rec) {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: rec.iv, additionalData: aad(space, rec.id) }, key, rec.ct)
  return JSON.parse(dec.decode(pt))
}

export const newId = () => b64(random(12)).replace(/\+/g, '-').replace(/\//g, '_')
