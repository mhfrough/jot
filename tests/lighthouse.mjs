// Lighthouse on the website and the app, phone and desktop. Prints the four scores per page and
// every audit that did not pass. Serve the folder first (npm run serve), then:
//   node tests/lighthouse.mjs [http://localhost:8190] [out-dir]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv.find(a => /^https?:/.test(a)) || 'http://localhost:8190').replace(/\/$/, '')
const OUT = process.argv.find(a => !/^https?:/.test(a) && a !== process.argv[0] && a !== process.argv[1]) || fs.mkdtempSync(path.join(os.tmpdir(), 'jot-lh-'))
const PAGES = ['', 'app/', 'design/', 'privacy/']
const WIN = process.platform === 'win32'
fs.mkdirSync(OUT, { recursive: true })

let low = 0
for (const preset of ['mobile', 'desktop']) {
  for (const p of PAGES) {
    const file = path.join(OUT, `${preset}-${p.replace(/\//g, '') || 'home'}.json`)
    const args = ['--yes', 'lighthouse@12.8.2', `${BASE}/${p}`, '--quiet', '--output=json', `--output-path=${file}`,
      '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --no-first-run']
    if (preset === 'desktop') args.push('--preset=desktop')
    execFileSync(WIN ? 'npx.cmd' : 'npx', WIN ? args.map(a => `"${a}"`) : args, { stdio: 'ignore', shell: WIN })
    const r = JSON.parse(fs.readFileSync(file, 'utf8'))
    const s = Object.fromEntries(Object.entries(r.categories).map(([k, c]) => [k, Math.round(c.score * 100)]))
    console.log(`${preset.padEnd(7)} /${p.padEnd(9)} perf ${s.performance}  a11y ${s.accessibility}  best ${s['best-practices']}  seo ${s.seo}`)
    for (const c of Object.values(r.categories)) {
      for (const ref of c.auditRefs) {
        const a = r.audits[ref.id]
        if (ref.weight > 0 && a.score !== null && a.score < 0.9) { console.log(`          ${c.id}: ${a.id} (${a.score}) ${a.displayValue || ''} ${a.title}`); low++ }
      }
    }
  }
}
console.log(low ? `\n${low} audits below 90` : '\nEvery weighted audit at 90 or above')
