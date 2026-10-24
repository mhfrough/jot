// Draws the Windows installer's pictures from Jot's own font, colours and paper grain, and saves
// them as the 24-bit BMPs NSIS wants. They are drawn at twice the size so they stay sharp on
// scaled screens; the installer shrinks them to fit.
//   node tools/installer-art.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pw from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'native/src-tauri/installer')
const font = readFileSync(join(root, 'fonts/JetBrainsMono.woff2')).toString('base64')
const grain = readFileSync(join(root, 'css/paper.css'), 'utf8').match(/--grain: (url\("data:image\/svg\+xml,[^"]*"\))/)[1]

const page = (w, h, inner) => `<!doctype html><style>
  @font-face { font-family: Mono; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 800; }
  * { margin: 0; box-sizing: border-box; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; font-family: Mono; -webkit-font-smoothing: antialiased; }
  .word { display: inline-flex; align-items: baseline; gap: 0.06em; font-weight: 800; letter-spacing: -0.05em; }
  .caret { display: inline-block; width: 0.5em; height: 0.16em; background: #e0aa2a; }
</style>${inner}`

// The welcome and finish pages: ink, with the word mark large and the promise small
const sidebar = page(164, 314, `<style>
  body { position: relative; background: #1b1a17; color: #ebe5d9; }
  body::after { content: ""; position: absolute; inset: 0; background-image: ${grain.replace(".2 0 0 0 0 .15 0 0 0 0 .08", "1 0 0 0 0 .95 0 0 0 0 .88")}; opacity: 0.08; }
  .word { position: absolute; left: 18px; top: 26px; font-size: 46px; }
  .rule { position: absolute; left: 20px; right: 20px; bottom: 74px; border-top: 1px dashed #3a3732; }
  .say { position: absolute; left: 20px; bottom: 24px; color: #958f81; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; line-height: 1.7; text-transform: uppercase; }
</style><span class="word">jot<i class="caret"></i></span><p class="rule"></p><p class="say">Plain notes<br>that stay on<br>this computer</p>`)

// The other pages' header: the small word mark on the installer's paper colour
const header = page(150, 57, `<style>
  body { display: flex; align-items: center; justify-content: flex-end; padding-right: 14px; background: #f1ece2; color: #1f1d1a; }
  .word { font-size: 22px; } .caret { background: #b07d00; }
</style><span class="word">jot<i class="caret"></i></span>`)

// A bottom-up 24-bit BMP from RGBA pixels
function bmp(w, h, rgba) {
  const row = Math.ceil((w * 3) / 4) * 4, size = 54 + row * h, b = Buffer.alloc(size)
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10)
  b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28)
  b.writeUInt32LE(row * h, 34); b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((h - 1 - y) * w + x) * 4, d = 54 + y * row + x * 3
    b[d] = rgba[s + 2]; b[d + 1] = rgba[s + 1]; b[d + 2] = rgba[s]
  }
  return b
}

const browser = await pw.chromium.launch({ channel: 'chrome', headless: true })
const tab = await browser.newPage({ deviceScaleFactor: 2 })
mkdirSync(out, { recursive: true })
for (const [name, html, w, h] of [['sidebar', sidebar, 164, 314], ['header', header, 150, 57]]) {
  await tab.setViewportSize({ width: w, height: h })
  await tab.setContent(html)
  await tab.evaluate(() => document.fonts.ready)
  const png = (await tab.screenshot({ type: 'png' })).toString('base64')
  const px = await tab.evaluate(async src => {
    const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    return { w: img.width, h: img.height, data: [...g.getImageData(0, 0, img.width, img.height).data] }
  }, png)
  writeFileSync(join(out, `${name}.bmp`), bmp(px.w, px.h, px.data))
  console.log(`${name}.bmp ${px.w}x${px.h}`)
}
await browser.close()
