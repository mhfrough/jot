// Accessibility, SEO and structured-data audit of the website and the app, in real Chrome.
//   npm run serve, then: node tests/audit.mjs [http://localhost:8190]
// axe-core (WCAG 2.2 A and AA) on every page and on the app's screens and dialogs, in light and
// dark; plus the SEO basics and JSON-LD on every page. Exits 1 on any problem.
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pw = require('playwright-core')
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const BASE = (process.argv.find(a => /^https?:/.test(a)) || 'http://localhost:8190').replace(/\/$/, '')
const PAGES = ['', 'design/', 'changelog/', 'privacy/', 'terms/', 'cookies/', 'credits/', 'sitemap/']
const sleep = ms => new Promise(r => setTimeout(r, ms))
const problems = []
const note = (where, msg) => { problems.push(`${where}: ${msg}`); console.log(`  ✗ ${where}: ${msg}`) }

async function axe(page, where) {
  await page.addScriptTag({ content: AXE })
  const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }))
  for (const v of r.violations) note(where, `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)
  return r.violations.length
}

async function seo(page, where, { app = false } = {}) {
  const d = await page.evaluate(() => {
    const m = n => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content || ''
    return {
      lang: document.documentElement.lang, title: document.title, desc: m('description'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      h1: document.querySelectorAll('h1').length, ogTitle: m('og:title'), ogDesc: m('og:description'), ogImage: m('og:image'),
      robots: m('robots'), viewport: m('viewport'),
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
      imgsNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
      linksNoName: [...document.querySelectorAll('a')].filter(a => !(a.textContent.trim() || a.getAttribute('aria-label'))).length,
    }
  })
  if (!d.lang) note(where, 'no lang on <html>')
  if (d.title.length < 10 || d.title.length > 65) note(where, `title is ${d.title.length} characters: "${d.title}"`)
  if (d.desc.length < 50 || d.desc.length > 165) note(where, `description is ${d.desc.length} characters`)
  if (!d.canonical) note(where, 'no canonical link')
  if (!app && d.h1 !== 1) note(where, `${d.h1} h1 elements`)
  if (!d.ogTitle || !d.ogDesc || !d.ogImage) note(where, 'Open Graph title, description or image missing')
  if (!d.viewport) note(where, 'no viewport meta')
  if (d.imgsNoAlt) note(where, `${d.imgsNoAlt} images without alt`)
  if (d.linksNoName) note(where, `${d.linksNoName} links without a name`)
  if (!d.ld.length) note(where, 'no JSON-LD')
  for (const raw of d.ld) {
    let j
    try { j = JSON.parse(raw) } catch (e) { note(where, `JSON-LD does not parse: ${e.message}`); continue }
    const items = j['@graph'] || [j]
    for (const it of items) {
      if (!it['@type']) note(where, 'a JSON-LD item has no @type')
      const need = { SoftwareApplication: ['name', 'operatingSystem', 'applicationCategory', 'offers'], WebApplication: ['name', 'applicationCategory', 'offers'], FAQPage: ['mainEntity'], WebPage: ['name', 'url'], BreadcrumbList: ['itemListElement'] }[it['@type']] || []
      for (const k of need) if (!it[k]) note(where, `${it['@type']} has no ${k}`)
      if (it['@type'] === 'FAQPage') for (const q of it.mainEntity) if (!q.name || !q.acceptedAnswer?.text) note(where, 'an FAQ entry is incomplete')
    }
  }
  return d
}

const browser = await pw.chromium.launch({ channel: 'chrome', headless: true })
for (const scheme of ['light', 'dark']) {
  console.log(`\nWebsite, ${scheme}`)
  // 404.html uses /jot/ paths, so it is checked on the live site rather than here
  for (const p of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('in')))
    const n = await axe(page, `/${p} ${scheme}`)
    if (scheme === 'light' && p !== '404.html') await seo(page, `/${p}`)
    if (!n) console.log(`  ✓ /${p}`)
    await ctx.close()
  }

  console.log(`\nApp, ${scheme}`)
  // bypassCSP only lets the audit script in; the app's own CSP is unchanged
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block', bypassCSP: true })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/app/`); await page.waitForSelector('body.ready')
  const step = async (name, fn) => { await fn(); await sleep(250); if (!(await axe(page, `app ${name} ${scheme}`))) console.log(`  ✓ ${name}`) }
  await step('empty list', async () => {})
  if (scheme === 'light') await seo(page, '/app/', { app: true })
  await step('a note open', async () => {
    await page.click('#newBtn'); await page.fill('#edTitle', 'Groceries'); await page.click('#edBody'); await page.keyboard.type('[ ] rice and **milk**')
    await page.locator('#edBody').blur(); await sleep(400)
  })
  await step('settings', async () => { await page.click('#settingsBtn') })
  await step('shortcuts', async () => { await page.click('#keysBtn') })
  await step('locked, first visit', async () => { await page.keyboard.press('Escape'); await page.click('#tab-locked') })
  await step('locked, open', async () => {
    await page.fill('#lgPass', 'brass lantern seven'); await page.fill('#lgPass2', 'brass lantern seven'); await page.click('#lgSubmit')
    await page.waitForSelector('#lockGate', { state: 'hidden' })
  })
  await step('a question', async () => { await page.click('#tab-notes'); await page.click('#list .item'); await page.click('#delBtn'); await page.click('#tab-trash'); await page.click('#list .item'); await page.click('#purgeBtn') })
  await step('toast', async () => { await page.click('#askCancel'); await page.click('#tab-notes'); await page.click('#newBtn'); await page.fill('#edTitle', 'x'); await page.click('#pinBtn') })
  await ctx.close()

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block', bypassCSP: true })
  const pp = await phone.newPage()
  await pp.goto(`${BASE}/app/`); await pp.waitForSelector('body.ready')
  if (!(await axe(pp, `app phone ${scheme}`))) console.log('  ✓ phone list')
  await phone.close()
}
await browser.close()
console.log(problems.length ? `\n${problems.length} problems` : '\nNo problems found')
process.exit(problems.length ? 1 : 0)
