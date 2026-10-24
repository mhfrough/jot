/* Jot: plain notes kept in this browser. No account, no server, nothing leaves the device.
 * db.js is the IndexedDB layer; vault.js seals the notes in the Locked tab; everything else lives here.
 */

import * as DB from './db.js'
import * as V from './vault.js'

const VERSION = '1.1.0'
const TRASH_DAYS = 30
const HIDDEN_LOCK_MS = 30000   // Locked closes this long after Jot goes to the background

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const root = document.documentElement
const body = document.body

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : v)
  }
  el.append(...kids.flat().filter(x => x != null && x !== false))
  return el
}

const prefs = {
  get(k, d) { try { return localStorage.getItem(`jot.${k}`) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(`jot.${k}`, v) } catch { /* private window */ } },
}
const newId = () => crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/* ---------- state ---------- */

const S = {
  notes: new Map(),   // id -> { id, space: 'm' | 'l', title, body, created, updated, state: active|archived|trashed, trashed, pinned }
  tab: 'notes',
  open: null,
  query: '',
  lheader: null,      // the Locked tab's key header, or null before a password is set
  lkey: null,         // its data key while Locked is open (non-extractable)
}
// What is stored: plain in 'notes'; for a locked note, the same fields go inside the seal
const record = n => ({ id: n.id, title: n.title, body: n.body, created: n.created, updated: n.updated, state: n.state, trashed: n.trashed || 0, pinned: !!n.pinned })
const sealed = n => ({ title: n.title, body: n.body, created: n.created, updated: n.updated, pinned: !!n.pinned })
const isLocked = n => n?.space === 'l'

/* ---------- dates ---------- */

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const fmtDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fmtDayYear = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const dayDiff = (a, b) => Math.round((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 864e5)

// The list: a time today, a day this year, a day and year before that
function short(ms) {
  const d = new Date(ms), now = new Date()
  if (dayDiff(d, now) === 0) return fmtTime.format(d)
  return d.getFullYear() === now.getFullYear() ? fmtDay.format(d) : fmtDayYear.format(d)
}
// The note: always the day and the time
function when(ms) {
  const d = new Date(ms), now = new Date(), diff = dayDiff(d, now)
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.getFullYear() === now.getFullYear() ? fmtDay.format(d) : fmtDayYear.format(d)
  return `${day}, ${fmtTime.format(d)}`
}

/* ---------- boot ---------- */

async function boot() {
  applyLook()
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(watchUpdate).catch(() => {})
  navigator.storage?.persist?.().catch(() => {})
  let recs = []
  try { recs = await DB.all() } catch { toast('This browser blocked storage, so notes cannot be saved here.') }
  const now = Date.now()
  for (const r of recs) {
    const blank = !r.title?.trim() && !r.body?.trim()
    if (blank || (r.state === 'trashed' && now - r.trashed > TRASH_DAYS * 864e5)) { DB.del(r.id); continue }
    S.notes.set(r.id, { ...r, space: 'm' })
  }
  S.lheader = await DB.getMeta('locked').catch(() => null) || null
  setTab('notes', false)
  body.classList.add('ready')
  if (location.hash === '#new') { history.replaceState(null, '', location.pathname); newNote() }
  else if (matchMedia('(min-width: 900px)').matches) openLatest()
}

// On a wide screen there is room for a note, so the newest one is open from the start
function openLatest() {
  const first = visible()[0]
  if (first) openNote(first.id, { focus: false, push: false })
}

/* ---------- look ---------- */

function applyLook() {
  const theme = prefs.get('theme', 'system')
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme
  $('#themeBtn').dataset.mode = theme
  root.dataset.size = prefs.get('size', 'm')
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  for (const m of $$('meta[name="theme-color"]')) m.content = dark ? '#151412' : '#f1ece2'
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyLook)

function cycleTheme() {
  const order = ['system', 'light', 'dark']
  const next = order[(order.indexOf(prefs.get('theme', 'system')) + 1) % 3]
  prefs.set('theme', next)
  applyLook()
  syncSettings()
  toast(`Theme: ${next === 'system' ? 'same as the device' : next}`)
}
$('#themeBtn').addEventListener('click', cycleTheme)

/* ---------- saving ---------- */

const saving = new Map()
function persist(n) {
  const prev = saving.get(n.id) || Promise.resolve()
  const locked = isLocked(n), key = S.lkey, rec = locked ? sealed(n) : record(n)
  if (locked && !key) return prev
  const next = prev
    .then(async () => (locked ? DB.put(await V.seal(key, 'l', n.id, rec), 'locked') : DB.put(rec)))
    .then(() => { if (S.open === n.id) $('#edSaved').textContent = 'Saved' })
    .catch(() => { if (S.open === n.id) $('#edSaved').textContent = 'Not saved, storage is full or blocked' })
  saving.set(n.id, next)
  next.finally(() => { if (saving.get(n.id) === next) saving.delete(n.id) })
  return next
}
const flushAll = () => Promise.all([...saving.values()])

/* ---------- tabs and list ---------- */

const TABS = ['notes', 'locked', 'archive', 'trash']
const TAB_NAME = { notes: 'Notes', locked: 'Locked', archive: 'Archive', trash: 'Trash' }
function setTab(tab, focus = true) {
  S.tab = tab
  for (const t of $$('#tabs [role="tab"]')) {
    const on = t.dataset.tab === tab
    t.setAttribute('aria-selected', on)
    t.tabIndex = on ? 0 : -1
    if (on && focus) t.focus()
  }
  $('#listPane').setAttribute('aria-labelledby', `tab-${tab}`)
  body.dataset.tab = tab
  render()
}
$('#tabs').addEventListener('click', e => { const t = e.target.closest('[role="tab"]'); if (t) setTab(t.dataset.tab, false) })
$('#tabs').addEventListener('keydown', e => {
  const tabs = $$('#tabs [role="tab"]')
  const i = tabs.indexOf(document.activeElement)
  if (i < 0) return
  const n = tabs.length
  const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key]
  if (j != null) { e.preventDefault(); setTab(tabs[j].dataset.tab) }
})

const inTab = (n, tab) => (tab === 'locked' ? isLocked(n) : isLocked(n) ? false
  : tab === 'notes' ? n.state === 'active' : tab === 'archive' ? n.state === 'archived' : n.state === 'trashed')
function titleOf(n) {
  if (n.title?.trim()) return n.title.trim()
  const first = (n.body || '').trim().split('\n')[0]
  return first ? first.slice(0, 120) : 'Untitled'
}
function previewOf(n) {
  const t = (n.body || '').trim()
  const rest = n.title?.trim() ? t : t.split('\n').slice(1).join('\n')
  return plainText(rest).split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])?\s*(?:\[( |x)\])?\s*/i, '').trim()).filter(Boolean).join(' · ').slice(0, 220)
}
// The note without its formatting marks, for the list preview
const plainText = t => t.replace(/`([^`\n]+)`/g, '$1').replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1').replace(/~~(\S(?:.*?\S)?)~~/g, '$1').replace(/(^|[^\w_])_(\S(?:.*?\S)?)_(?![\w_])/g, '$1$2')
const matches = (n, q) => `${n.title}\n${n.body}`.toLowerCase().includes(q)

function sorter(tab) {
  if (tab === 'trash') return (a, b) => b.trashed - a.trashed
  const by = prefs.get('sort', 'updated')
  const inner = by === 'title' ? (a, b) => titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base', numeric: true })
    : by === 'created' ? (a, b) => b.created - a.created
      : (a, b) => b.updated - a.updated
  return (a, b) => (b.pinned - a.pinned) || inner(a, b)
}
function visible(tab = S.tab) {
  const q = S.query.toLowerCase()
  return [...S.notes.values()].filter(n => inTab(n, tab) && (!q || matches(n, q))).sort(sorter(tab))
}

// Text with the search words marked, built from text nodes only
function marked(text, q) {
  if (!q) return [text]
  const out = [], low = text.toLowerCase()
  let i = 0, j
  while ((j = low.indexOf(q, i)) !== -1) { out.push(text.slice(i, j), h('mark', { text: text.slice(j, j + q.length) })); i = j + q.length }
  out.push(text.slice(i))
  return out
}

let renderQueued = false
function render() {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => { renderQueued = false; renderNow() })
}

function renderNow() {
  const tab = S.tab
  const q = S.query.toLowerCase()
  const counts = { notes: 0, locked: 0, archive: 0, trash: 0 }
  for (const n of S.notes.values()) for (const t of TABS) if (inTab(n, t)) counts[t]++
  for (const t of TABS) $(`#count-${t}`).textContent = counts[t] || ''

  const rows = visible()
  const shut = tab === 'locked' && !S.lkey
  body.classList.toggle('unlocked', !!S.lkey)
  renderGate(shut)
  const tools = $('#listTools')
  tools.hidden = !((tab === 'trash' && rows.length && !q) || (tab === 'locked' && S.lkey))
  if (tab === 'trash') {
    $('#listNote').textContent = `Deleted for good after ${TRASH_DAYS} days`
    $('#listAction').textContent = 'Empty trash'
    $('#listAction').onclick = emptyTrash
  } else if (tab === 'locked') {
    const m = Number(prefs.get('lockmin', '5'))
    $('#listNote').textContent = `Open · locks after ${m} min idle`
    $('#listAction').textContent = 'Lock now'
    $('#listAction').onclick = () => lockLocked('now')
  }

  const frag = document.createDocumentFragment()
  const pinned = tab !== 'trash' && rows.some(n => n.pinned)
  let group = null
  for (const n of rows) {
    if (pinned) {
      const g = n.pinned ? 'Pinned' : 'Others'
      if (g !== group) { group = g; frag.append(h('li', { class: 'group', 'aria-hidden': 'true', text: g })) }
    }
    const stamp = tab === 'trash' ? n.trashed : prefs.get('sort', 'updated') === 'created' ? n.created : n.updated
    const preview = previewOf(n)
    frag.append(h('li', {}, h('button', {
      type: 'button', class: `item${n.pinned && tab !== 'trash' ? ' pinned' : ''}`, 'data-id': n.id,
      'aria-current': S.open === n.id ? 'true' : null,
    },
    h('span', { class: 'it-title' }, marked(titleOf(n), q)),
    h('time', { class: 'it-date', datetime: new Date(stamp).toISOString(), text: short(stamp) }),
    preview ? h('span', { class: 'it-text' }, marked(preview, q)) : null)))
  }
  $('#list').replaceChildren(frag)

  const empty = $('#empty')
  empty.hidden = rows.length > 0 || shut
  if (!empty.hidden) {
    const [title, text] = q ? ['No match', `Nothing in ${TAB_NAME[tab].toLowerCase()} has “${S.query}”.`] : ({
      notes: ['No notes yet', 'Press N or tap + to write one. It saves as you type.'],
      locked: ['No locked notes yet', 'Write one here, or open any note and tap the lock to move it in.'],
      archive: ['Nothing archived', 'Archive a note to keep it out of the way without deleting it.'],
      trash: ['Trash is empty', `Deleted notes stay here for ${TRASH_DAYS} days.`],
    })[tab]
    $('#emptyTitle').textContent = title
    $('#emptyText').textContent = text
  }
}

$('#list').addEventListener('click', e => { const b = e.target.closest('.item'); if (b) openNote(b.dataset.id) })
$('#search').addEventListener('input', e => { S.query = e.target.value.trim(); render() })
$('#search').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.target.value = ''; S.query = ''; render(); e.target.blur() }
  if (e.key === 'Enter') { const first = visible()[0]; if (first) openNote(first.id) }
  if (e.key === 'ArrowDown') { e.preventDefault(); $('#list .item')?.focus() }
})
$('#list').addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return
  const items = $$('#list .item'), i = items.indexOf(document.activeElement)
  if (i < 0) return
  e.preventDefault()
  if (e.key === 'ArrowUp' && i === 0) return $('#search').focus()
  items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus()
})

/* ---------- editor ---------- */

let editTimer = 0, editDirty = false, fresh = null
const edTitle = $('#edTitle'), edBody = $('#edBody')

function openNote(id, { focus = null, push = true } = {}) {
  const n = S.notes.get(id)
  if (!n) return
  if (S.open && S.open !== id) { commitEdit(); dropIfEmpty(S.open) }
  S.open = id
  const ro = n.state === 'trashed'
  edTitle.value = n.title || ''
  edBody.value = n.body || ''
  edTitle.readOnly = edBody.readOnly = ro
  $('#editor').classList.toggle('ro', ro)
  paint()
  $('#editor').hidden = false
  $('#deskEmpty').hidden = true
  body.classList.add('reading')
  syncTools(n)
  dates(n)
  counts()
  grow()
  $('#edSaved').textContent = ''
  $('#sheet').scrollTop = 0
  if (push && !history.state?.note && !matchMedia('(min-width: 900px)').matches) history.pushState({ note: true }, '')
  render()
  // A new note, or a mouse, gets the caret; on a phone, opening a note should not pop the keyboard
  const want = focus ?? matchMedia('(pointer: fine)').matches
  if (want && !ro) (n.title || n.body ? edBody : fresh === id ? edTitle : edBody).focus({ preventScroll: true })
}

function syncTools(n) {
  const trashed = n.state === 'trashed'
  $('#pinBtn').setAttribute('aria-pressed', !!n.pinned)
  $('#pinBtn').setAttribute('aria-label', n.pinned ? 'Unpin' : 'Pin to the top')
  $('#pinBtn').dataset.tip = n.pinned ? 'Unpin' : 'Pin'
  $('#archBtn').setAttribute('aria-label', n.state === 'archived' ? 'Move back to notes' : 'Archive')
  $('#archBtn').dataset.tip = n.state === 'archived' ? 'Unarchive' : 'Archive'
  for (const id of ['#pinBtn', '#archBtn', '#delBtn', '#lockBtn']) $(id).hidden = trashed
  $('#archBtn').hidden = trashed || isLocked(n)
  $('#restoreBtn').hidden = $('#purgeBtn').hidden = !trashed
  $('#lockBtn').setAttribute('aria-pressed', isLocked(n))
  $('#lockBtn').setAttribute('aria-label', isLocked(n) ? 'Move out of Locked' : 'Move to Locked')
  $('#lockBtn').dataset.tip = isLocked(n) ? 'Unlock note' : 'Lock note'
  $('#delBtn').setAttribute('aria-label', isLocked(n) ? 'Delete for good' : 'Move to the trash')
  $('#edState').textContent = isLocked(n) ? 'Locked' : { active: 'Notes', archived: 'Archive', trashed: 'Trash, read only' }[n.state]
  $('#edState').classList.toggle('warn', n.state !== 'active' || isLocked(n))
}

function dates(n) {
  $('#edCreated').textContent = when(n.created)
  $('#edCreated').title = fmtLong.format(n.created)
  $('#edUpdated').textContent = when(n.updated)
  $('#edUpdated').title = fmtLong.format(n.updated)
}
function counts() {
  const t = `${edTitle.value}\n${edBody.value}`.trim()
  const words = t ? t.split(/\s+/).length : 0
  $('#edCount').textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} · ${t.length.toLocaleString()} chars`
}
function grow() {
  for (const el of [edTitle, edBody]) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
}

/* ---------- formatting: **bold**, _italic_, ~~strike~~, `code` ----------
   The note stays plain text. A copy of it is drawn under the textarea with the marks styled and
   the markers faint; the textarea's own text is transparent, so you type into the styled copy.
   JetBrains Mono keeps every weight and slant the same width, so the two always line up. */

const mirror = $('#edMirror')
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mk = m => `<span class="mk">${m}</span>`
function inline(t) {
  const codes = []
  t = t.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(`${mk('`')}<code>${c}</code>${mk('`')}`); return `\u0000${codes.length - 1}\u0000` })
  t = t.replace(/\*\*(\S(?:.*?\S)?)\*\*/g, (_, x) => `${mk('**')}<b>${x}</b>${mk('**')}`)
  t = t.replace(/~~(\S(?:.*?\S)?)~~/g, (_, x) => `${mk('~~')}<s>${x}</s>${mk('~~')}`)
  t = t.replace(/(^|[^\w_])_(\S(?:.*?\S)?)_(?![\w_])/g, (_, a, x) => `${a}${mk('_')}<i>${x}</i>${mk('_')}`)
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i])
}
function paint() {
  mirror.innerHTML = esc(edBody.value).split('\n').map(line => {
    const done = line.match(/^(\s*(?:- )?)(\[x\])(.*)$/i)
    return done ? `${done[1]}${mk(done[2])}<span class="done">${inline(done[3])}</span>` : inline(line)
  }).join('\n') + '\u200b'
}

// Wraps the selection in a mark, or takes the mark off if it is already there
function format(m) {
  if (edBody.readOnly) return
  const v = edBody.value, s = edBody.selectionStart, e = edBody.selectionEnd, w = m.length
  const inner = v.slice(s, e)
  edBody.focus()
  if (v.slice(s - w, s) === m && v.slice(e, e + w) === m) {
    edBody.setSelectionRange(s - w, e + w); insert(inner); edBody.setSelectionRange(s - w, e - w)
  } else if (inner.length > 2 * w && inner.startsWith(m) && inner.endsWith(m)) {
    insert(inner.slice(w, -w)); edBody.setSelectionRange(s, e - 2 * w)
  } else {
    insert(`${m}${inner}${m}`); edBody.setSelectionRange(s + w, e + w)
  }
}
const FORMATS = { b: '**', i: '_', s: '~~', code: '`' }
for (const b of $$('[data-fmt]')) {
  b.addEventListener('pointerdown', e => e.preventDefault())   // keep the selection in the note
  b.addEventListener('click', () => format(FORMATS[b.dataset.fmt]))
}
edBody.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return
  const k = e.key.toLowerCase()
  const m = k === 'b' ? '**' : k === 'i' ? '_' : k === 'e' ? '`' : (k === 'x' && e.shiftKey) ? '~~' : null
  if (m) { e.preventDefault(); format(m) }
})

function closeEditor(silent = false) {
  if (!S.open) return
  commitEdit()
  dropIfEmpty(S.open)
  S.open = null
  $('#editor').hidden = true
  $('#deskEmpty').hidden = false
  body.classList.remove('reading')
  if (!silent && history.state?.note) history.back()
  render()
}
$('#backBtn').addEventListener('click', () => closeEditor())
addEventListener('popstate', () => { if (S.open && !matchMedia('(min-width: 900px)').matches) closeEditor(true) })

function onEdit() {
  editDirty = true
  $('#edSaved').textContent = 'Editing'
  counts()
  clearTimeout(editTimer)
  editTimer = setTimeout(commitEdit, 300)
}
edTitle.addEventListener('input', () => { grow(); onEdit() })
edBody.addEventListener('input', () => { paint(); grow(); onEdit() })
edTitle.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); edBody.focus(); edBody.setSelectionRange(0, 0) } })
for (const el of [edTitle, edBody]) el.addEventListener('blur', () => commitEdit())
addEventListener('resize', grow)

function commitEdit() {
  clearTimeout(editTimer)
  if (!editDirty || !S.open) return
  editDirty = false
  const n = S.notes.get(S.open)
  if (!n || n.state === 'trashed') return
  const title = edTitle.value.replace(/\n/g, ' ')
  if (n.title === title && n.body === edBody.value) { $('#edSaved').textContent = 'Saved'; return }
  n.title = title
  n.body = edBody.value
  n.updated = Date.now()
  if (fresh === n.id && (n.title.trim() || n.body.trim())) fresh = null
  dates(n)
  persist(n)
  render()
}

// Lists keep going: Enter after "- ", "* ", "1. " or "[ ] " starts the next item; Enter on an empty item ends the list
edBody.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || edBody.readOnly) return
  const v = edBody.value, at = edBody.selectionStart
  if (at !== edBody.selectionEnd) return
  const start = v.lastIndexOf('\n', at - 1) + 1
  const line = v.slice(start, at)
  const m = line.match(/^(\s*)(- \[[ x]\] |\[[ x]\] |[-*•] |(\d+)[.)] )/i)
  if (!m) return
  e.preventDefault()
  if (line.trim() === m[2].trim()) { edBody.setSelectionRange(start, at); insert(''); return }
  let mark = m[2]
  if (m[3]) mark = `${Number(m[3]) + 1}${m[2].trim().slice(-1)} `
  mark = mark.replace(/\[x\]/i, '[ ]')
  insert(`\n${m[1]}${mark}`)
})
// Tapping the box of a "[ ]" line ticks it, and tapping "[x]" unticks it
edBody.addEventListener('click', () => {
  if (edBody.readOnly || edBody.selectionStart !== edBody.selectionEnd) return
  const v = edBody.value, at = edBody.selectionStart
  const start = v.lastIndexOf('\n', at - 1) + 1
  const m = v.slice(start).match(/^(\s*(?:- )?)\[( |x)\]/i)
  if (!m) return
  const box = start + m[1].length
  if (at < box || at > box + 3) return
  edBody.setSelectionRange(box, box + 3)
  insert(m[2] === ' ' ? '[x]' : '[ ]')
  edBody.setSelectionRange(box + 3, box + 3)
})
// Through execCommand when it works, so the browser's own undo keeps working
function insert(text) {
  edBody.focus()
  if (!document.execCommand?.('insertText', false, text)) {
    edBody.setRangeText(text, edBody.selectionStart, edBody.selectionEnd, 'end')
    edBody.dispatchEvent(new Event('input'))
  }
}

// A new note that was never written in is not kept
function dropIfEmpty(id) {
  const n = S.notes.get(id)
  if (!n || fresh !== id) return
  fresh = null
  if (n.title.trim() || n.body.trim()) return
  S.notes.delete(id)
  ;(saving.get(id) || Promise.resolve()).then(() => DB.del(id, isLocked(n) ? 'locked' : 'notes'))
}

function newNote() {
  const space = S.tab === 'locked' && S.lkey ? 'l' : 'm'
  if (space === 'm' && S.tab !== 'notes') setTab('notes', false)
  if (S.query) { S.query = ''; $('#search').value = '' }
  const now = Date.now()
  const n = { id: newId(), space, title: '', body: '', created: now, updated: now, state: 'active', trashed: 0, pinned: false }
  S.notes.set(n.id, n)
  fresh = n.id   // stored on the first keystroke, not before
  openNote(n.id, { focus: true })
}
$('#newBtn').addEventListener('click', newNote)
$('#fab').addEventListener('click', newNote)

const current = () => S.open && S.notes.get(S.open)

// Moves a note between notes, archive and trash, with an undo in the toast
function moveTo(state) {
  const n = current()
  if (!n) return
  commitEdit()
  fresh = null
  const before = { state: n.state, trashed: n.trashed }
  n.state = state
  n.trashed = state === 'trashed' ? Date.now() : 0
  persist(n)
  closeEditor()
  const msg = { active: 'Moved back to notes', archived: 'Archived', trashed: 'Moved to trash' }[state]
  toast(msg, () => { Object.assign(n, before); persist(n); render(); openNote(n.id) })
}
$('#pinBtn').addEventListener('click', () => {
  const n = current(); if (!n) return
  commitEdit(); fresh = null
  n.pinned = !n.pinned
  persist(n); syncTools(n); render()
  toast(n.pinned ? 'Pinned to the top' : 'Unpinned')
})
$('#archBtn').addEventListener('click', () => moveTo(current()?.state === 'archived' ? 'active' : 'archived'))
$('#delBtn').addEventListener('click', async () => {
  const n = current()
  if (!isLocked(n)) return moveTo('trashed')
  // Locked notes never go to the trash, which is not locked
  if (!await ask('Delete this locked note for good?', 'Locked notes skip the trash, so this cannot be undone.', 'Delete forever')) return
  fresh = null
  S.notes.delete(n.id)
  await saving.get(n.id)
  await DB.del(n.id, 'locked')
  closeEditor()
  toast('Deleted for good')
})
$('#lockBtn').addEventListener('click', async () => {
  const n = current(); if (!n) return
  if (!S.lkey) {
    toast(S.lheader ? 'Open Locked first, then move the note in' : 'Set a password for Locked first')
    closeEditor(); setTab('locked', false)
    return
  }
  commitEdit(); fresh = null
  await saving.get(n.id)
  const into = !isLocked(n)
  if (into) {
    n.state = 'active'; n.trashed = 0
    await DB.move('notes', 'locked', n.id, await V.seal(S.lkey, 'l', n.id, sealed(n)))
    n.space = 'l'
  } else {
    n.space = 'm'
    await DB.move('locked', 'notes', n.id, record(n))
  }
  syncTools(n); render()
  toast(into ? 'Moved to Locked' : 'Moved back to notes')
})
$('#restoreBtn').addEventListener('click', () => moveTo('active'))
$('#purgeBtn').addEventListener('click', async () => {
  const n = current(); if (!n) return
  if (!await ask('Delete this note for good?', 'It cannot be brought back.', 'Delete forever')) return
  S.notes.delete(n.id)
  await saving.get(n.id)
  await DB.del(n.id)
  closeEditor()
  toast('Deleted for good')
})
async function emptyTrash() {
  const dead = [...S.notes.values()].filter(n => n.state === 'trashed')
  if (!dead.length) return
  if (!await ask(`Delete ${dead.length} ${dead.length === 1 ? 'note' : 'notes'} for good?`, 'Everything in the trash is removed and cannot be brought back.', 'Empty trash')) return
  if (S.open && dead.some(n => n.id === S.open)) closeEditor(true)
  for (const n of dead) { S.notes.delete(n.id); await saving.get(n.id); await DB.del(n.id) }
  render()
  toast('Trash emptied')
}

/* ---------- toast ---------- */

let toastTimer = 0
function toast(text, undo = null, label = 'Undo', ms = 5000) {
  const t = $('#toast')
  $('#toastText').textContent = text
  const btn = $('#toastBtn')
  btn.hidden = !undo
  btn.textContent = label
  btn.onclick = undo ? () => { hideToast(); undo() } : null
  t.hidden = false
  requestAnimationFrame(() => t.classList.add('show'))
  clearTimeout(toastTimer)
  toastTimer = setTimeout(hideToast, undo ? ms : 2200)
}
function hideToast() {
  const t = $('#toast')
  t.classList.remove('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { t.hidden = true }, 250)
}

/* ---------- dialogs ---------- */

for (const d of $$('dialog')) {
  d.addEventListener('click', e => { if (e.target === d) d.close() })
  for (const b of $$('[data-close]', d)) b.addEventListener('click', () => d.close())
}

// One small dialog for every question: a confirm, or a few password fields with a check
function ask(title, text, ok, fields = [], check = null) {
  const d = $('#ask')
  $('#askTitle').textContent = title
  $('#askText').textContent = text
  $('#askOk').textContent = ok
  $('#askError').hidden = true
  $('#askFields').replaceChildren(...fields.map(f => h('label', { class: 'field' }, h('span', { text: f.label }),
    h('input', { type: 'password', name: f.name, autocomplete: 'off', required: true }))))
  d.showModal()
  ;($('#askFields input') || $('#askCancel')).focus()
  return new Promise(resolve => {
    const finish = v => { $('#askForm').onsubmit = null; $('#askCancel').onclick = null; d.onclose = null; if (d.open) d.close(); resolve(v) }
    $('#askForm').onsubmit = async e => {
      e.preventDefault()
      if (!fields.length) return finish(true)
      const values = Object.fromEntries($$('#askFields input').map(i => [i.name, i.value]))
      const problem = check && await check(values)
      if (problem) { $('#askError').textContent = problem; $('#askError').hidden = false; return }
      finish(values)
    }
    $('#askCancel').onclick = () => finish(false)
    d.onclose = () => finish(false)
  })
}

/* ---------- settings ---------- */

const PREF_DEFAULT = { theme: 'system', size: 'm', sort: 'updated', lockmin: '5' }
function syncSettings() {
  for (const g of $$('.seg[data-pref]')) {
    const v = prefs.get(g.dataset.pref, PREF_DEFAULT[g.dataset.pref])
    for (const r of $$('input', g)) r.checked = r.value === v
  }
}
for (const g of $$('.seg[data-pref]')) g.addEventListener('change', e => {
  prefs.set(g.dataset.pref, e.target.value)
  applyLook()
  if (g.dataset.pref === 'sort' || g.dataset.pref === 'lockmin') render()
  grow()
})

$('#settingsBtn').addEventListener('click', async () => {
  commitEdit()
  syncSettings()
  $('#version').textContent = VERSION
  $('#importResult').textContent = ''
  const est = await navigator.storage?.estimate?.().catch(() => null)
  const kept = await navigator.storage?.persisted?.().catch(() => false)
  const n = [...S.notes.values()].filter(x => !isLocked(x)).length
  const l = S.lheader ? (await DB.all('locked').catch(() => [])).length : 0
  $('#storeText').textContent = `${n} ${n === 1 ? 'note' : 'notes'}${l ? ` and ${l} locked` : ''}${est ? `, ${kb(est.usage)} used` : ''}${kept ? ', kept by the browser' : ''}`
  $('#lockSet').hidden = !S.lheader
  $('#settings').showModal()
})
const kb = b => (b < 1e6 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`)

$('#eraseBtn').addEventListener('click', async () => {
  if (!await ask('Erase every note?', 'All notes, locked notes, the archive and the trash are deleted from this device. Files you exported are not touched.', 'Erase everything')) return
  S.lkey = null
  S.notes.clear()
  await DB.wipe()
  location.reload()
})

/* ---------- export and import ---------- */

const stamp = () => new Date().toISOString().slice(0, 10)
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = h('a', { href: url, download: name })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

$('#exportBtn').addEventListener('click', async () => {
  commitEdit(); await flushAll()
  const notes = [...S.notes.values()].filter(n => !isLocked(n)).map(record)
  // Locked notes leave as they are stored: sealed, with the header that opens them
  const locked = S.lheader ? { header: S.lheader, notes: (await DB.all('locked')).map(r => ({ id: r.id, iv: V.b64(r.iv), ct: V.b64(r.ct) })) } : null
  download(`jot-${stamp()}.json`, JSON.stringify({ app: 'jot', kind: 'notes', v: 2, made: new Date().toISOString(), notes, locked }, null, 2), 'application/json')
  const l = locked?.notes.length || 0
  $('#importResult').textContent = `Exported ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}${l ? ` and ${l} locked, still encrypted` : ''}.`
})

$('#importBtn').addEventListener('click', () => $('#fileIn').click())
$('#fileIn').addEventListener('change', async e => {
  const files = [...e.target.files]
  e.target.value = ''
  if (!files.length) return
  const out = $('#importResult')
  let added = 0, skipped = 0
  try {
    for (const f of files) { const r = await importText(await f.text(), f.name, f.lastModified); added += r.added; skipped += r.skipped }
    await flushAll()
    render()
    out.textContent = `Imported ${added} ${added === 1 ? 'note' : 'notes'}${skipped ? `, skipped ${skipped} already here` : ''}.`
  } catch (err) {
    out.textContent = err.message || 'Jot could not read this file.'
  }
})

function parse(text) { try { return JSON.parse(text) } catch { return null } }

async function importText(text, name, modified) {
  const f = parse(text)
  const lockedIn = f?.app === 'jot' && f.locked?.header ? await importLocked(f.locked) : { added: 0, skipped: 0 }
  let list
  if (f?.app === 'jot' && Array.isArray(f.notes)) list = f.notes
  else if (Array.isArray(f) && f.length && f.every(x => x && typeof x === 'object' && 'value' in x && 'title' in x)) list = fromSimpleNotes(f)
  else if (f === null && text.trim()) list = [{ title: name.replace(/\.[^.]+$/, ''), body: text, created: modified, updated: modified }]
  else throw new Error('Jot could not read this file. It takes a Jot export, a Simple Notes or Fossify Notes export, or a text file.')

  const have = new Set([...S.notes.values()].map(n => `${n.title}\n${n.body}`))
  let added = 0, skipped = 0
  const now = Date.now()
  for (const x of list) {
    const n = {
      id: newId(), space: 'm', title: String(x.title ?? '').slice(0, 300), body: String(x.body ?? ''),
      created: Number(x.created) || now, updated: Number(x.updated) || Number(x.created) || now,
      state: ['active', 'archived', 'trashed'].includes(x.state) ? x.state : 'active',
      trashed: x.state === 'trashed' ? (Number(x.trashed) || now) : 0, pinned: !!x.pinned,
    }
    const key = `${n.title}\n${n.body}`
    if (have.has(key)) { skipped++; continue }
    have.add(key)
    S.notes.set(n.id, n)
    persist(n)
    added++
  }
  return { added: added + lockedIn.added, skipped: skipped + lockedIn.skipped }
}

// Locked notes from a Jot export: kept sealed. With no password here yet, the file's password
// becomes this device's; otherwise they are opened with the file's password and sealed again with ours.
async function importLocked({ header, notes }) {
  const recs = (Array.isArray(notes) ? notes : []).map(r => ({ id: String(r.id), iv: V.unb64(r.iv), ct: V.unb64(r.ct) }))
  if (!recs.length) return { added: 0, skipped: 0 }
  if (!S.lheader) {
    await DB.setMeta('locked', header); await DB.putMany(recs, 'locked')
    S.lheader = header
    return { added: recs.length, skipped: 0 }
  }
  const have = new Set((await DB.all('locked')).map(r => r.id))
  if (header.salt === S.lheader.salt) {
    const incoming = recs.filter(r => !have.has(r.id))
    await DB.putMany(incoming, 'locked')
    if (S.lkey) for (const r of incoming) S.notes.set(r.id, { id: r.id, space: 'l', state: 'active', trashed: 0, ...(await V.unseal(S.lkey, 'l', r)) })
    return { added: incoming.length, skipped: recs.length - incoming.length }
  }
  if (!S.lkey) throw new Error('This file has locked notes with another password. Open Locked first, then import it again.')
  let key = null
  const ok = await ask('Locked notes in this file', 'They use a different password. Type the password they were locked with, and they move into your Locked tab.', 'Bring them in',
    [{ name: 'pass', label: 'Their password' }], async ({ pass }) => { key = await V.open(header, pass).catch(() => null); return key ? null : 'That password does not open them.' })
  if (!ok || !key) return { added: 0, skipped: recs.length }
  let added = 0
  for (const r of recs) {
    if (have.has(r.id)) continue
    const n = { id: r.id, space: 'l', state: 'active', trashed: 0, ...(await V.unseal(key, 'l', r)) }
    S.notes.set(n.id, n); persist(n); added++
  }
  return { added, skipped: recs.length - added }
}

// Simple Notes and Fossify Notes: [{ id, title, value, type, path, protectionType }]
function fromSimpleNotes(arr) {
  return arr.map(x => {
    const checklist = x.type === 'TYPE_CHECKLIST' || x.type === 1
    let body = String(x.value ?? ''), created = 0
    if (checklist) {
      const tasks = parse(body)
      if (Array.isArray(tasks)) {
        body = tasks.map(t => `${t.isDone ? '[x]' : '[ ]'} ${t.title ?? ''}`).join('\n')
        created = Math.min(...tasks.map(t => Number(t.dateCreated) || Infinity))
      }
    }
    return { title: String(x.title ?? ''), body, created: Number.isFinite(created) && created > 0 ? created : 0 }
  })
}

/* ---------- the Locked tab ---------- */

function renderGate(on) {
  const f = $('#lockGate')
  f.hidden = !on
  if (!on) return
  const setup = !S.lheader
  $('#lgTitle').textContent = setup ? 'Lock notes with a password' : 'Locked'
  $('#lgText').textContent = setup
    ? 'Notes here are encrypted on this device and open only with this password. It is not stored anywhere and cannot be reset: if you forget it, these notes cannot be opened.'
    : 'Type the password to open your locked notes.'
  $('#lgPass2Wrap').hidden = !setup
  $('#lgPass2').required = setup
  $('#lgPass').autocomplete = setup ? 'new-password' : 'current-password'
  $('#lgSubmit').textContent = setup ? 'Set password' : 'Open'
}

$('#lockGate').addEventListener('submit', async e => {
  e.preventDefault()
  const err = $('#lgError'), pass = $('#lgPass').value, btn = $('#lgSubmit')
  err.hidden = true
  const fail = t => { err.textContent = t; err.hidden = false; btn.disabled = false; $('#lgPass').select() }
  btn.disabled = true
  if (!S.lheader) {
    if (pass.length < 6) return fail('Use at least 6 characters. A few words are best.')
    if (pass !== $('#lgPass2').value) return fail('The two passwords are not the same.')
    const { header, key } = await V.create(pass)
    await DB.setMeta('locked', header)
    S.lheader = header; S.lkey = key
  } else {
    const key = await V.open(S.lheader, pass).catch(() => null)
    if (!key) return fail('That password does not open Locked.')
    S.lkey = key
    for (const r of await DB.all('locked')) {
      try { S.notes.set(r.id, { id: r.id, space: 'l', state: 'active', trashed: 0, ...(await V.unseal(key, 'l', r)) }) } catch { /* left alone, never overwritten */ }
    }
  }
  btn.disabled = false
  $('#lgPass').value = $('#lgPass2').value = ''
  lastActive = Date.now()
  render()
})

// Locking drops the key and every opened note; what is on disk stays sealed
async function lockLocked(why) {
  if (!S.lkey) return
  const open = current()
  if (isLocked(open)) { commitEdit(); closeEditor(true); if (history.state?.note) history.back() }
  await flushAll()
  S.lkey = null
  for (const [id, n] of S.notes) if (isLocked(n)) S.notes.delete(id)
  if (isLocked(open)) { edTitle.value = edBody.value = ''; paint() }
  render()
  if (why === 'now') toast('Locked')
}

// Auto-lock: after the chosen minutes without use, and soon after Jot goes to the background
let lastActive = Date.now(), hiddenTimer = 0, hiddenAt = 0
for (const ev of ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart']) addEventListener(ev, () => { lastActive = Date.now() }, { passive: true, capture: true })
setInterval(() => {
  if (S.lkey && Date.now() - lastActive > Number(prefs.get('lockmin', '5')) * 60000) lockLocked('idle')
}, 5000)
document.addEventListener('visibilitychange', () => {
  clearTimeout(hiddenTimer)
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); hiddenTimer = setTimeout(() => lockLocked('hidden'), HIDDEN_LOCK_MS) }
  else if (hiddenAt && Date.now() - hiddenAt >= HIDDEN_LOCK_MS) lockLocked('hidden')
})

$('#lockPassBtn').addEventListener('click', async () => {
  let header = null
  const ok = await ask('Change the Locked password', 'Your locked notes stay as they are; only the key that opens them is locked again with the new password.', 'Change password',
    [{ name: 'old', label: 'Current password' }, { name: 'new1', label: 'New password' }, { name: 'new2', label: 'New password again' }],
    async ({ old, new1, new2 }) => {
      if (new1.length < 6) return 'Use at least 6 characters.'
      if (new1 !== new2) return 'The two new passwords are not the same.'
      header = await V.rewrap(S.lheader, old, new1).catch(() => null)
      return header ? null : 'The current password is not right.'
    })
  if (!ok || !header) return
  await DB.setMeta('locked', header)
  S.lheader = header
  toast('Password changed')
})
$('#lockForgetBtn').addEventListener('click', async () => {
  if (!await ask('Delete every locked note?', 'Use this only if the password is lost. Every locked note and the password are deleted from this device for good; your other notes are not touched.', 'Delete locked notes')) return
  await lockLocked()
  await DB.clear('locked'); await DB.delMeta('locked')
  S.lheader = null
  $('#lockSet').hidden = true
  render()
  toast('Locked notes deleted')
})

/* ---------- keyboard ---------- */

const KEYS = [
  ['N', 'New note', newNote],
  ['/', 'Search', () => $('#search').focus()],
  ['1', 'Notes', () => setTab('notes')],
  ['2', 'Locked', () => setTab('locked')],
  ['3', 'Archive', () => setTab('archive')],
  ['4', 'Trash', () => setTab('trash')],
  ['L', 'Lock Locked now', () => lockLocked('now')],
  ['T', 'Switch theme', cycleTheme],
  ['Ctrl B', 'Bold', null],
  ['Ctrl I', 'Italic', null],
  ['Ctrl Shift X', 'Strike through', null],
  ['Ctrl E', 'Code', null],
  ['?', 'These shortcuts', () => openKeys()],
  ['Esc', 'Close the note or dialog', null],
  ['Ctrl S', 'Save now (it saves anyway)', null],
]
function openKeys() {
  $('#keysList').replaceChildren(...KEYS.flatMap(([k, label]) => [h('dt', {}, ...k.split(' ').map(x => h('kbd', { text: x }))), h('dd', { text: label })]))
  if ($('#settings').open) $('#settings').close()
  $('#shortcuts').showModal()
}
$('#keysBtn').addEventListener('click', openKeys)
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); editDirty = true; commitEdit(); return }
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Escape' && S.open && !document.querySelector('dialog[open]')) {
    e.preventDefault()
    if (matchMedia('(min-width: 900px)').matches) { commitEdit(); document.activeElement?.blur(); $(`#list .item[data-id="${S.open}"]`)?.focus() } else closeEditor()
    return
  }
  if (document.querySelector('dialog[open]')) return
  if (e.target.closest('input, textarea, select, [contenteditable]')) return
  const k = KEYS.find(([key, , run]) => key.toLowerCase() === e.key.toLowerCase() && run)
  if (k) { e.preventDefault(); k[2]() }
})

/* ---------- leaving, install and updates ---------- */

addEventListener('pagehide', () => commitEdit())
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') commitEdit() })

let installPrompt = null
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#installRow').hidden = false })
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return
  installPrompt.prompt()
  await installPrompt.userChoice
  installPrompt = null
  $('#installRow').hidden = true
})
addEventListener('appinstalled', () => { $('#installRow').hidden = true })

// A new version waits until you choose to reload, so nothing changes under your typing
function watchUpdate(reg) {
  const apply = async () => {
    commitEdit(); await flushAll()
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    reg.waiting?.postMessage('skip')
  }
  const ready = () => { $('#updateRow').hidden = false; toast('A new version of Jot is ready', apply, 'Reload', 12000) }
  if (reg.waiting && navigator.serviceWorker.controller) ready()
  reg.addEventListener('updatefound', () => {
    const w = reg.installing
    w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ready() })
  })
  $('#updateBtn').addEventListener('click', apply)
}

boot()
