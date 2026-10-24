// Copies the web app into native/ui for Tauri, which bundles only that folder.
// The app's files are copied as they are; index.html gets flat paths, absolute links to the
// website, and no CSP meta or manifest (Tauri sets its own CSP, and there is nothing to install).
//   node tools/sync-native.mjs
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ui = join(root, 'native/ui')
const SITE = 'https://mhfrough.github.io/jot/'

rmSync(ui, { recursive: true, force: true })
mkdirSync(ui, { recursive: true })
for (const f of ['app.js', 'db.js', 'vault.js', 'icons.svg']) cpSync(join(root, 'app', f), join(ui, f))
for (const f of ['css/paper.css', 'css/app.css', 'fonts/JetBrainsMono.woff2', 'fonts/OFL-jetbrains-mono.txt', 'icon.svg']) {
  mkdirSync(dirname(join(ui, f)), { recursive: true })
  cpSync(join(root, f), join(ui, f))
}

let html = readFileSync(join(root, 'app/index.html'), 'utf8')
const before = html
html = html
  .replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/\s*<link rel="canonical"[^>]*>/, '')
  .replaceAll('href="../css/', 'href="css/')
  .replaceAll('href="../fonts/', 'href="fonts/')
  .replaceAll('href="../icon.svg"', 'href="icon.svg"')
  .replace(/href="\.\.\/([^"]*)"/g, (_, p) => `href="${SITE}${p}"`)
if (html === before || html.includes('"../')) throw new Error('index.html did not change as expected; check the paths')
writeFileSync(join(ui, 'index.html'), html)
console.log('native/ui is up to date')
