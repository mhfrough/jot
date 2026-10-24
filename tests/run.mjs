// Jot end-to-end tests in real Chrome (Playwright). Serve the folder first:
//   npm run serve      (python -m http.server 8190)
//   npm test           (node tests/run.mjs http://localhost:8190 [--only name])

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'

const pw = createRequire(import.meta.url)('playwright-core')
const BASE = (process.argv.find(a => /^https?:/.test(a)) || 'http://localhost:8190').replace(/\/$/, '')
const APP = `${BASE}/app/`
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jot-test-'))
const results = []
let browser

const sleep = ms => new Promise(r => setTimeout(r, ms))
function check(cond, msg) { if (!cond) throw new Error(msg) }

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 }, ...opts })
  const page = await ctx.newPage()
  page.errors = []
  page.on('pageerror', e => page.errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()) })
  page.foreign = []
  page.on('request', r => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) page.foreign.push(r.url()) })
  await page.goto(APP)
  await page.waitForSelector('body.ready')
  return { ctx, page }
}
const back = async page => { if (await page.isVisible('#backBtn')) await page.click('#backBtn'); else await page.keyboard.press('Escape'); await sleep(60) }
async function write(page, title, text) {
  if (await page.isVisible('#backBtn')) await page.click('#backBtn')
  if (await page.isVisible('#newBtn')) await page.click('#newBtn'); else await page.click('#fab')
  await page.fill('#edTitle', title)
  await page.fill('#edBody', text)
  await page.locator('#edBody').blur()
  await page.waitForFunction(() => document.querySelector('#edSaved').textContent === 'Saved')
}
const titles = page => page.$$eval('#list .it-title', els => els.map(e => e.textContent.trim()))
const tab = async (page, name) => { await page.click(`#tab-${name}`); await sleep(60) }
const open = (page, title) => page.click(`#list .item:has(.it-title:text-is("${title}"))`)
const stored = (page, store = 'notes') => page.evaluate(store => new Promise(res => {
  const r = indexedDB.open('jot-notes'); r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result) }
}), store)
// Everything Jot keeps, as text: both stores (ciphertext as base64), the key header and local storage
const everything = page => page.evaluate(() => new Promise(res => {
  const r = indexedDB.open('jot-notes')
  r.onsuccess = () => {
    const t = r.result.transaction(['notes', 'locked', 'meta'])
    const out = {}
    let left = 3
    const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)))
    for (const st of ['notes', 'locked', 'meta']) {
      const q = t.objectStore(st).getAll()
      q.onsuccess = () => { out[st] = JSON.stringify(q.result, (k, v) => (v instanceof Uint8Array ? b64(v) : v)); if (!--left) res(out.notes + out.locked + out.meta + JSON.stringify(localStorage)) }
    }
  }
}))
const LOCKPASS = 'brass lantern seven'
async function setLocked(page, pass = LOCKPASS) {
  await tab(page, 'locked')
  await page.fill('#lgPass', pass)
  if (await page.isVisible('#lgPass2')) await page.fill('#lgPass2', pass)
  await page.click('#lgSubmit')
  await page.waitForSelector('#lockGate', { state: 'hidden' })
}

async function test(name, fn) {
  if (only && !name.toLowerCase().includes(only)) return
  const t = Date.now()
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log(`  ok    ${name}`) }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log(`  FAIL  ${name}\n        ${e.message}`) }
}

browser = await pw.chromium.launch({ channel: 'chrome', headless: true })
console.log(`Jot tests against ${BASE}`)

await test('Opens straight away: no sign-in, no foreign requests', async () => {
  const { ctx, page } = await fresh()
  check(await page.isVisible('#listPane') && await page.isVisible('#tabs'), 'the notes list is not showing')
  check(!(await page.isVisible('input[type="password"]')), 'a password field shows on opening')
  check(await page.isVisible('#empty'), 'no empty state for a new device')
  await write(page, 'Hello', 'first words')
  await sleep(300)
  check(page.foreign.length === 0, `requests left the site: ${page.foreign.join(', ')}`)
  check(page.errors.length === 0, `errors: ${page.errors.join(' | ')}`)
  await ctx.close()
})

await test('Notes save, survive a reload and show both dates', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'Shopping', 'saffron and rice')
  await write(page, 'Bank letters', 'file the statement')
  const recs = await stored(page)
  check(recs.length === 2 && recs.some(r => r.body === 'saffron and rice'), 'note not in IndexedDB')
  await page.reload(); await page.waitForSelector('body.ready')
  const t = await titles(page)
  check(t.includes('Shopping') && t.includes('Bank letters'), `titles after reload: ${t}`)
  await open(page, 'Shopping')
  const created = await page.textContent('#edCreated'), updated = await page.textContent('#edUpdated')
  check(/^Today, /.test(created) && /^Today, /.test(updated), `dates: ${created} / ${updated}`)
  const before = (await stored(page)).find(r => r.title === 'Shopping')
  await sleep(1100)
  await page.fill('#edBody', 'saffron, rice and lemons'); await page.locator('#edBody').blur()
  await page.waitForFunction(() => document.querySelector('#edSaved').textContent === 'Saved')
  const after = (await stored(page)).find(r => r.title === 'Shopping')
  check(after.updated > before.updated && after.created === before.created, 'updated time did not move, or created changed')
  check(/words/.test(await page.textContent('#edCount')), 'no word count')
  await ctx.close()
})

await test('An empty new note is not kept', async () => {
  const { ctx, page } = await fresh()
  await page.click('#newBtn'); await sleep(400)
  await page.reload(); await page.waitForSelector('body.ready')
  check((await stored(page)).length === 0, 'an empty note was saved')
  await ctx.close()
})

await test('Pin, archive, trash, undo, restore, delete forever', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'Older', 'a'); await write(page, 'Keep me', 'b'); await write(page, 'Newest', 'c')
  await open(page, 'Older'); await page.click('#pinBtn'); await sleep(100)
  check((await titles(page))[0] === 'Older', 'pinned note not first')
  check(await page.isVisible('#list .group'), 'no Pinned group label')
  await open(page, 'Keep me'); await page.click('#archBtn'); await sleep(100)
  check(!(await titles(page)).includes('Keep me'), 'archived note still in Notes')
  await page.click('#toastBtn'); await sleep(150)
  check((await titles(page)).includes('Keep me'), 'undo did not bring the note back')
  await open(page, 'Keep me'); await page.click('#archBtn'); await sleep(100)
  await tab(page, 'archive')
  check((await titles(page)).includes('Keep me'), 'note not in Archive')
  await open(page, 'Keep me'); await page.click('#archBtn'); await sleep(100)
  await tab(page, 'notes'); await open(page, 'Keep me'); await page.click('#delBtn'); await sleep(100)
  await tab(page, 'trash')
  check((await titles(page)).includes('Keep me'), 'note not in Trash')
  await open(page, 'Keep me')
  check(await page.$eval('#edBody', el => el.readOnly), 'trashed note is editable')
  await page.click('#restoreBtn'); await sleep(100)
  await page.reload(); await page.waitForSelector('body.ready')
  check((await titles(page)).includes('Keep me'), 'restored note gone after reload')
  await open(page, 'Keep me'); await page.click('#delBtn'); await tab(page, 'trash')
  await open(page, 'Keep me'); await page.click('#purgeBtn'); await page.click('#askOk'); await sleep(200)
  check(!(await stored(page)).some(r => r.title === 'Keep me'), 'purged note still stored')
  await tab(page, 'notes'); await open(page, 'Newest'); await page.click('#delBtn'); await tab(page, 'trash')
  await page.click('#listAction'); await page.click('#askOk'); await sleep(200)
  check((await stored(page)).every(r => r.state !== 'trashed'), 'trash not emptied')
  await ctx.close()
})

await test('Search filters and marks matches', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'Garden', 'tomatoes and basil'); await write(page, 'Car', 'tyres and oil')
  await page.fill('#search', 'basil'); await sleep(80)
  const t = await titles(page)
  check(t.length === 1 && t[0] === 'Garden', `search result: ${t}`)
  check(await page.isVisible('#list mark'), 'match not marked')
  await page.fill('#search', 'zzz'); await sleep(80)
  check(await page.isVisible('#empty'), 'no empty state for no match')
  await ctx.close()
})

await test('Checklists: tap a box to tick it, lists carry on', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'List', '[ ] milk')
  await open(page, 'List')
  await page.evaluate(() => { const b = document.querySelector('#edBody'); b.focus(); b.setSelectionRange(1, 1); b.click() })
  await sleep(100)
  check((await page.inputValue('#edBody')).startsWith('[x] milk'), `tick failed: ${await page.inputValue('#edBody')}`)
  await page.evaluate(() => { const b = document.querySelector('#edBody'); b.setSelectionRange(b.value.length, b.value.length) })
  await page.keyboard.press('Enter'); await page.keyboard.type('eggs')
  check((await page.inputValue('#edBody')) === '[x] milk\n[ ] eggs', `list carry-on: ${JSON.stringify(await page.inputValue('#edBody'))}`)
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  check((await page.inputValue('#edBody')) === '[x] milk\n[ ] eggs\n', `empty item did not end the list: ${JSON.stringify(await page.inputValue('#edBody'))}`)
  await ctx.close()
})

await test('Formatting: bold, italic, strike and code, drawn in line with the text', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'Styled', 'plain words here')
  await open(page, 'Styled')
  await page.evaluate(() => { const b = document.querySelector('#edBody'); b.focus(); b.setSelectionRange(6, 11) })
  await page.keyboard.press('Control+b')
  check((await page.inputValue('#edBody')) === 'plain **words** here', `bold: ${await page.inputValue('#edBody')}`)
  await page.keyboard.press('Control+b')
  check((await page.inputValue('#edBody')) === 'plain words here', `bold off: ${await page.inputValue('#edBody')}`)
  await page.evaluate(() => { const b = document.querySelector('#edBody'); b.setSelectionRange(0, 5) })
  await page.click('[data-fmt="i"]')
  await page.evaluate(() => { const b = document.querySelector('#edBody'); b.setSelectionRange(b.value.length - 4, b.value.length) })
  await page.click('[data-fmt="s"]')
  await page.keyboard.press('End'); await page.keyboard.type(' and ')
  await page.click('[data-fmt="code"]'); await page.keyboard.type('x = 1')
  const v = await page.inputValue('#edBody')
  check(v === '_plain_ words ~~here~~ and `x = 1`', `marks: ${v}`)
  check(await page.$eval('#edMirror', m => !!m.querySelector('i') && !!m.querySelector('s') && !!m.querySelector('code')), 'marks not drawn')
  // the styled copy wraps exactly like the text: same height
  await page.fill('#edBody', '**bold** '.repeat(60) + '\n_slanted_ '.repeat(20))
  const [a, b] = await page.evaluate(() => [document.querySelector('#edBody').scrollHeight, document.querySelector('#edMirror').scrollHeight])
  check(Math.abs(a - b) <= 2, `mirror ${b}px, text ${a}px: they would drift apart`)
  await page.locator('#edBody').blur()
  await page.waitForFunction(() => document.querySelector('#edSaved').textContent === 'Saved')
  check(!(await page.textContent('#list .item:has(.it-title:text-is("Styled")) .it-text')).includes('**'), 'marks shown in the list preview')
  await ctx.close()
})

await test('Locked: password, encrypted at rest, lock and reopen, wrong password refused', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'Shopping', 'bread')
  await tab(page, 'locked')
  check(await page.isVisible('#lockGate') && await page.isVisible('#lgPass2'), 'no password setup on first visit')
  await page.fill('#lgPass', 'abc'); await page.fill('#lgPass2', 'abc'); await page.click('#lgSubmit')
  check(await page.isVisible('#lgError'), 'a short password was accepted')
  await page.fill('#lgPass', LOCKPASS); await page.fill('#lgPass2', LOCKPASS + 'x'); await page.click('#lgSubmit')
  check(await page.isVisible('#lgError'), 'two different passwords were accepted')
  await setLocked(page)
  await write(page, 'Locker code', 'GRANITE 4471 at the gym')
  check((await titles(page)).includes('Locker code'), 'locked note not listed')
  const all = await everything(page)
  check(!all.includes('GRANITE') && !all.includes('Locker code') && !all.includes(LOCKPASS), 'locked text or the password is stored in plain form')
  check((await stored(page, 'locked')).length === 1 && !(await stored(page)).some(r => r.title === 'Locker code'), 'locked note not in its own store')
  await page.click('#tab-locked'); await page.click('#listAction'); await sleep(150)
  check(await page.isVisible('#lockGate') && !(await page.content()).includes('GRANITE'), 'locked text left in the page after locking')
  await page.fill('#lgPass', 'wrong password'); await page.click('#lgSubmit')
  await page.waitForSelector('#lgError:not([hidden])')
  await page.reload(); await page.waitForSelector('body.ready')
  await tab(page, 'locked')
  check(await page.isVisible('#lockGate') && !(await page.isVisible('#lgPass2')), 'not asking for the password after a reload')
  await setLocked(page)
  check((await titles(page)).includes('Locker code'), 'locked note missing after reopening')
  // move a plain note in and out
  await tab(page, 'notes'); await open(page, 'Shopping'); await page.click('#lockBtn'); await sleep(150)
  check((await stored(page, 'locked')).length === 2 && !(await stored(page)).some(r => r.title === 'Shopping'), 'note not moved into Locked')
  await tab(page, 'locked'); await open(page, 'Shopping'); await page.click('#lockBtn'); await sleep(150)
  check((await stored(page)).some(r => r.title === 'Shopping') && (await stored(page, 'locked')).length === 1, 'note not moved back out')
  // deleting a locked note skips the trash
  await write(page, 'Throwaway', 'x')
  await tab(page, 'locked')
  if (!(await titles(page)).includes('Throwaway')) { await tab(page, 'notes'); await open(page, 'Throwaway'); await page.click('#lockBtn'); await sleep(100); await tab(page, 'locked') }
  await open(page, 'Throwaway'); await page.click('#delBtn'); await page.click('#askOk'); await sleep(150)
  check((await stored(page, 'locked')).length === 1, `locked note not deleted: ${(await stored(page, 'locked')).length} left`)
  await tab(page, 'trash')
  check(!(await titles(page)).includes('Throwaway'), 'a locked note went to the unlocked trash')
  await ctx.close()
})

await test('Locked: closes after the idle time and soon after going to the background', async () => {
  const { ctx, page } = await fresh()
  await page.clock.install()
  await page.reload(); await page.waitForSelector('body.ready')
  await setLocked(page)
  await write(page, 'Idle test', 'secret words')
  await page.clock.fastForward('06:00')
  await page.clock.runFor(6000)
  await tab(page, 'locked')
  check(await page.isVisible('#lockGate'), 'Locked still open after 6 minutes without use')
  await setLocked(page)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.clock.runFor(31000)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
  check(await page.isVisible('#lockGate'), 'Locked still open 30 s after going to the background')
  await ctx.close()
})

await test('Locked: exports stay encrypted and open on a new device; change and forget the password', async () => {
  const a = await fresh()
  await setLocked(a.page)
  await write(a.page, 'Bank', 'PIN hint: ORCHARD')
  await a.page.click('#settingsBtn')
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#exportBtn')])
  const file = path.join(TMP, 'locked.json'); await dl.saveAs(file)
  const raw = fs.readFileSync(file, 'utf8')
  check(!raw.includes('ORCHARD') && JSON.parse(raw).locked.notes.length === 1, 'export has locked text in plain form')
  // change the password, then the old one no longer opens it
  await a.page.click('#lockPassBtn')
  const inputs = a.page.locator('#askFields input')
  await inputs.nth(0).fill(LOCKPASS); await inputs.nth(1).fill('new door brass'); await inputs.nth(2).fill('new door brass')
  await a.page.click('#askOk'); await sleep(1500)
  await a.page.keyboard.press('Escape')
  await a.page.click('#tab-locked'); await a.page.click('#listAction'); await sleep(100)
  await a.page.fill('#lgPass', LOCKPASS); await a.page.click('#lgSubmit')
  await a.page.waitForSelector('#lgError:not([hidden])')
  await setLocked(a.page, 'new door brass')
  check((await titles(a.page)).includes('Bank'), 'new password did not open Locked')
  // forget: every locked note and the password go
  await a.page.click('#settingsBtn'); await a.page.click('#lockForgetBtn'); await a.page.click('#askOk'); await sleep(200)
  check((await stored(a.page, 'locked')).length === 0, 'locked notes not deleted')
  await a.ctx.close()

  const b = await fresh()
  await b.page.click('#settingsBtn')
  await b.page.setInputFiles('#fileIn', file)
  await b.page.waitForFunction(() => /Imported 1 note/.test(document.querySelector('#importResult').textContent))
  await b.page.keyboard.press('Escape')
  await setLocked(b.page)
  check((await titles(b.page)).includes('Bank'), 'locked note did not come over')
  await b.ctx.close()
})

await test('Export, import into a new device, Simple Notes and text files', async () => {
  const a = await fresh()
  await write(a.page, 'Passport', 'renew in May'); await write(a.page, 'Recipes', 'dal with lentils')
  await a.page.click('#settingsBtn')
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#exportBtn')])
  const file = path.join(TMP, 'jot.json'); await dl.saveAs(file)
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  check(data.app === 'jot' && data.notes.length === 2 && data.notes.every(n => n.created && n.updated), 'export file is wrong')
  await a.ctx.close()

  const b = await fresh()
  await b.page.click('#settingsBtn')
  await b.page.setInputFiles('#fileIn', file)
  await b.page.waitForFunction(() => /Imported 2 notes/.test(document.querySelector('#importResult').textContent))
  await b.page.setInputFiles('#fileIn', file)
  await b.page.waitForFunction(() => /Imported 0 notes, skipped 2/.test(document.querySelector('#importResult').textContent))
  const simple = path.join(TMP, 'simple.json')
  fs.writeFileSync(simple, JSON.stringify([
    { id: 1, title: 'General note', value: 'Plain text', type: 0, path: '', protectionType: -1, protectionHash: '' },
    { id: 2, title: 'Groceries', value: JSON.stringify([{ id: 1, dateCreated: 1700000000000, isDone: false, title: 'eggs' }, { id: 2, dateCreated: 1700000100000, isDone: true, title: 'bread' }]), type: 1, path: '', protectionType: -1, protectionHash: '' },
  ]))
  const txt = path.join(TMP, 'Wifi at home.txt'); fs.writeFileSync(txt, 'guest key: plum')
  await b.page.setInputFiles('#fileIn', [simple, txt])
  await b.page.waitForFunction(() => /Imported 3 notes/.test(document.querySelector('#importResult').textContent))
  await b.page.keyboard.press('Escape')
  const t = await titles(b.page)
  check(['Passport', 'Recipes', 'General note', 'Groceries', 'Wifi at home'].every(x => t.includes(x)), `titles: ${t}`)
  await open(b.page, 'Groceries')
  check((await b.page.inputValue('#edBody')) === '[ ] eggs\n[x] bread', 'checklist not converted')
  check((await b.page.textContent('#edCreated')).includes('2023'), 'checklist date not taken from its first task')
  await b.ctx.close()
})

await test('Settings: theme, size and sort apply and stay', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'Beta', 'x'); await write(page, 'Alpha', 'y')
  await page.click('#settingsBtn')
  await page.click('.seg[data-pref="theme"] label:has(input[value="dark"])')
  await page.click('.seg[data-pref="size"] label:has(input[value="l"])')
  await page.click('.seg[data-pref="sort"] label:has(input[value="title"])')
  await page.keyboard.press('Escape'); await sleep(100)
  check((await titles(page)).join() === 'Alpha,Beta', `A–Z sort: ${await titles(page)}`)
  await page.reload(); await page.waitForSelector('body.ready')
  const d = await page.evaluate(() => ({ ...document.documentElement.dataset, bg: getComputedStyle(document.body).backgroundColor }))
  check(d.theme === 'dark' && d.size === 'l', `prefs after reload: ${JSON.stringify(d)}`)
  check(d.bg === 'rgb(21, 20, 18)', `dark background: ${d.bg}`)
  await ctx.close()
})

await test('Phone: no sideways scroll, editor over the list, back closes it', async () => {
  const { ctx, page } = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await write(page, 'Phone note', 'a long line '.repeat(40))
  check(await page.isVisible('#backBtn'), 'no back button on the phone')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sideways scroll in the editor')
  await page.goBack(); await sleep(200)
  check(!(await page.isVisible('#editor')), 'browser back did not close the note')
  check(await page.isVisible('#fab'), 'no new-note button on the list')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sideways scroll in the list')
  await ctx.close()
})

await test('Offline: the service worker serves the app with the network off', async () => {
  const { ctx, page } = await fresh()
  await write(page, 'Offline note', 'still here')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload(); await page.waitForSelector('body.ready')
  await ctx.setOffline(true)
  await page.reload(); await page.waitForSelector('body.ready')
  check((await titles(page)).includes('Offline note'), 'note missing offline')
  await ctx.close()
})

await test('Website: every page loads clean with no sideways scroll at 390 px', async () => {
  for (const p of ['', 'privacy/', 'terms/', 'cookies/', 'credits/', 'sitemap/']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    // The star count asks GitHub; a 404 there (repository not public yet) is handled by the page
    page.on('console', m => { if (m.type() === 'error' && !m.location().url.includes('api.github.com')) errors.push(m.text()) })
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errors.push(`${r.status()} ${r.url()}`) })
    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' })
    check(errors.length === 0, `/${p}: ${errors.join(' | ')}`)
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `/${p} scrolls sideways`)
    await ctx.close()
  }
})

await browser.close()
fs.rmSync(TMP, { recursive: true, force: true })
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length} of ${results.length} passed`)
process.exit(failed.length ? 1 : 0)
