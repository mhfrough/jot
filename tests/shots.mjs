// Real screenshots of the Jot app for the website and README, with sample notes, saved as WebP.
//   node tests/shots.mjs [http://localhost:8190]   ->  assets/img/*.webp
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pw = require(process.env.PLAYWRIGHT || 'playwright-core')
const BASE = (process.argv.find(a => /^https?:/.test(a)) || 'http://localhost:8190').replace(/\/$/, '')
const OUT = path.resolve(here, '../assets/img')
fs.mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))

const H = 3600e3, D = 24 * H, now = Date.now()
export const SAMPLE = [
  { title: 'Groceries', body: '[ ] basmati rice\n[ ] cardamom pods\n[x] milk\n[ ] lemons, four\n[x] coriander\n[ ] dishwasher tablets', pinned: true, created: now - 9 * D, updated: now - 2 * H },
  { title: 'Car service', body: 'Due at **60,000 miles**.\nGarage on Mill Lane — ask them to look at the _front brakes_ and the wiper on the passenger side.\n\n~~Friday~~ Book for a Saturday morning. Reference `MOT-2291`.', created: now - 30 * D, updated: now - 5 * H },
  { title: 'Books to read', body: '- The Remains of the Day\n- A Fine Balance\n- The Shadow Lines\n- Piranesi', created: now - 60 * D, updated: now - 1.2 * D },
  { title: 'Gift ideas', body: 'Ammi: a teapot with a blue glaze, from the market on Saturday.\nSara: a good fountain pen and green ink.', created: now - 40 * D, updated: now - 3 * D },
  { title: 'Trip packing', body: 'Adapters, the grey jacket, chargers, passport, printed booking, medicine for the flight.', created: now - 90 * D, updated: now - 12 * D },
  { title: '', body: 'Flat viewing questions\nHow old is the boiler? Who looks after the garden? Is there a bike store?', created: now - 400 * D, updated: now - 300 * D },
]

async function seed(page) {
  await page.goto(`${BASE}/app/`)
  await page.evaluate(async notes => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('jot-notes'); r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = rej })
    const t = db.transaction('notes', 'readwrite')
    notes.forEach((n, i) => t.objectStore('notes').put({ id: `sample-${i}`, state: 'active', trashed: 0, pinned: false, ...n }))
    await new Promise(r => { t.oncomplete = r })
  }, SAMPLE)
  await page.reload()
  await page.waitForSelector('body.ready')
  await sleep(400)
}

// PNG -> WebP at the given widths, in the browser itself, so nothing else needs installing
async function webp(page, png, name, widths) {
  const src = `data:image/png;base64,${png.toString('base64')}`
  for (const w of widths) {
    const data = await page.evaluate(async ({ src, w }) => {
      const img = new Image(); img.src = src; await img.decode()
      const c = document.createElement('canvas'); c.width = w; c.height = Math.round(img.height * w / img.width)
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height)
      return c.toDataURL('image/webp', 0.86).split(',')[1]
    }, { src, w })
    fs.writeFileSync(`${OUT}/${name}-${w}.webp`, Buffer.from(data, 'base64'))
  }
}

const browser = await pw.chromium.launch({ channel: 'chrome', headless: true })
for (const scheme of ['light', 'dark']) {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const p = await phone.newPage()
  await seed(p)
  await webp(p, await p.screenshot(), `phone-list-${scheme}`, [390, 780])
  await p.tap('#list .item >> text=Groceries'); await sleep(300)
  await webp(p, await p.screenshot(), `phone-note-${scheme}`, [390, 780])
  await phone.close()

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const d = await desk.newPage()
  await seed(d)
  await d.click('#list .item >> text=Car service'); await sleep(300)
  await d.mouse.move(0, 0)
  await webp(d, await d.screenshot(), `desk-${scheme}`, [800, 1440])
  await desk.close()
}
await browser.close()
console.log(fs.readdirSync(OUT).filter(f => f.endsWith('.webp')).join('\n'))
