// Renders the app icons and the social card from icon.svg with Playwright.
//   node tools/icons.mjs   (serve the folder on :8190 first, for the font in the social card)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pw = createRequire(import.meta.url)('playwright-core')
const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8')
const browser = await pw.chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
// A maskable icon is cropped to a circle (the safe zone is the middle 80%), so its glyph shrinks
const safe = s => s.replace(/(<rect width="64" height="64"[^>]*\/>)([\s\S]*)(<\/svg>)/, '$1<g transform="translate(32 33) scale(.7) translate(-32 -33)">$2</g>$3')
async function png(size, file, { pad = 0, bg = 'transparent', square = false, mask = false } = {}) {
  await page.setViewportSize({ width: size, height: size })
  let art = square ? svg.replace('rx="14"', 'rx="0"') : svg
  if (mask) art = safe(art)
  await page.setContent(`<style>html,body{margin:0;background:${bg}}div{width:${size}px;height:${size}px;display:grid;place-items:center}svg{width:${size - 2 * pad}px;height:${size - 2 * pad}px}</style><div>${art}</div>`)
  await page.screenshot({ path: path.join(root, file), omitBackground: bg === 'transparent' })
}
await png(192, 'app/icons/icon-192.png')
await png(512, 'app/icons/icon-512.png')
await png(512, 'app/icons/maskable-512.png', { square: true, mask: true })
await png(180, 'apple-touch-icon.png', { square: true })
// Social card, 1200 x 630
await page.setViewportSize({ width: 1200, height: 630 })
await page.goto('http://localhost:8190/assets/og.html')
await page.waitForFunction(() => document.fonts.ready.then(() => true))
await page.screenshot({ path: path.join(root, 'assets/og-image.jpg'), type: 'jpeg', quality: 88 })
await browser.close()
console.log('icons and og-image written')
