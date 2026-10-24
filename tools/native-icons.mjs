// Draws every native app icon straight from Jot's logo (icon.svg), each at its own size so it
// stays sharp, with Playwright. Run after changing icon.svg:   node tools/native-icons.mjs
//
// Windows and Linux (native/src-tauri/icons):
//   icon.ico   16, 20, 24, 32, 40, 48, 64, 96, 128 and 256 px, the sizes Windows asks for in
//              title bars, taskbars, Start, lists and Explorer (PNG entries, Windows Vista and later)
//   32x32.png, 64x64.png, 128x128.png, 128x128@2x.png, icon.png (512)   for Linux packages
// Android (native/src-tauri/gen/android/app/src/main/res):
//   an adaptive icon: the glyph on a transparent 108 dp layer, inside the 66 dp safe circle, over
//   an ink background colour, plus a white monochrome layer for Android 13 themed icons, and the
//   square and round fallbacks for Android 7 to 7.1. Android Studio's default drawables are removed.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pw = createRequire(import.meta.url)('playwright-core')
const tauri = path.join(root, 'native/src-tauri')
const res = path.join(tauri, 'gen/android/app/src/main/res')

const INK = '#1f1d1a', PAPER = '#f1ece2', OCHRE = '#e0aa2a'
// The glyph, in icon.svg's 64-unit box: a square dot, the stem with its hook, and the cursor
const glyph = (paper, cursor) => `<g fill="${paper}"><rect x="24" y="11" width="9" height="9"/><path d="M24 24h9v21.5c0 6-4 9.5-10 9.5h-7v-7.5h5.5c1.7 0 2.5-.8 2.5-2.5z"/></g><rect x="37" y="49.5" width="15" height="5.5" fill="${cursor}"/>`
const svg = (box, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">${body}</svg>`

const TILE = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8')                               // rounded ink tile
const SQUARE = svg(64, `<rect width="64" height="64" fill="${INK}"/>${glyph(PAPER, OCHRE)}`)    // full bleed, for Android 7
const ROUND = svg(64, `<circle cx="32" cy="32" r="32" fill="${INK}"/><g transform="translate(32 33) scale(.78) translate(-32 -33)">${glyph(PAPER, OCHRE)}</g>`)
// Adaptive layers: 108 dp with the visible 72 dp in the middle; the glyph at 1 unit per dp keeps
// its farthest corner 31 dp from the centre, inside the 33 dp safe circle every launcher mask keeps
const FG = svg(108, `<g transform="translate(22 22)">${glyph(PAPER, OCHRE)}</g>`)
const MONO = svg(108, `<g transform="translate(22 22)">${glyph('#ffffff', '#ffffff')}</g>`)

const browser = await pw.chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
async function png(art, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`)
  return page.screenshot({ omitBackground: true, type: 'png' })
}
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data) }

// Windows .ico: a header, one 16-byte entry per size, then the PNGs
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
const images = []
for (const s of ICO_SIZES) images.push(await png(TILE, s))
const head = Buffer.alloc(6 + 16 * images.length)
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4)
let offset = head.length
images.forEach((img, i) => {
  const s = ICO_SIZES[i], e = 6 + 16 * i
  head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1)
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
  head.writeUInt32LE(img.length, e + 8); head.writeUInt32LE(offset, e + 12)
  offset += img.length
})
write(path.join(tauri, 'icons/icon.ico'), Buffer.concat([head, ...images]))

// Linux and the bundle's PNGs
for (const [name, s] of [['32x32.png', 32], ['64x64.png', 64], ['128x128.png', 128], ['128x128@2x.png', 256], ['icon.png', 512]]) {
  write(path.join(tauri, 'icons', name), await png(TILE, s))
}

// Android launcher icons per density
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(DENSITY)) {
  write(path.join(res, `mipmap-${d}/ic_launcher.png`), await png(SQUARE, Math.round(48 * k)))
  write(path.join(res, `mipmap-${d}/ic_launcher_round.png`), await png(ROUND, Math.round(48 * k)))
  write(path.join(res, `mipmap-${d}/ic_launcher_foreground.png`), await png(FG, Math.round(108 * k)))
  write(path.join(res, `mipmap-${d}/ic_launcher_monochrome.png`), await png(MONO, Math.round(108 * k)))
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`
write(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive)
write(path.join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive)
write(path.join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${INK}</color>\n</resources>\n`)
for (const f of ['drawable/ic_launcher_background.xml', 'drawable-v24/ic_launcher_foreground.xml']) fs.rmSync(path.join(res, f), { force: true })

await browser.close()
console.log(`icon.ico (${ICO_SIZES.join(', ')} px), Linux PNGs and Android launcher icons written`)
