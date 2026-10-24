/* Jot website: the theme switch (shared with the app), the GitHub star count, the phone menu
   and a gentle reveal. */
(() => {
  'use strict'
  const root = document.documentElement
  root.classList.add('js')

  /* Theme: same as the device, light, dark. Stored as jot.theme, which the app reads too. */
  const get = () => { try { return localStorage.getItem('jot.theme') || 'system' } catch { return 'system' } }
  const set = v => { try { localStorage.setItem('jot.theme', v) } catch { /* private window */ } }
  const label = { system: 'same as the device', light: 'light', dark: 'dark' }
  function apply(mode) {
    if (mode === 'light' || mode === 'dark') root.dataset.theme = mode
    else delete root.dataset.theme
    for (const b of document.querySelectorAll('[data-theme-toggle]')) b.setAttribute('aria-label', `Theme: ${label[mode]}`)
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('is-dark', dark)
  }
  apply(get())
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(get()))
  for (const b of document.querySelectorAll('[data-theme-toggle]')) b.addEventListener('click', () => {
    const order = ['system', 'light', 'dark']
    const next = order[(order.indexOf(get()) + 1) % 3]
    set(next); apply(next)
  })

  /* GitHub stars: the cached count first, then GitHub when it is over five minutes old */
  for (const a of document.querySelectorAll('[data-stars]')) {
    const repo = a.dataset.stars, key = `stars:${repo}`
    const show = n => {
      a.classList.add('has-count')
      a.querySelector('.star-n').textContent = n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
      a.querySelector('.star-sr').textContent = `, ${n} ${n === 1 ? 'star' : 'stars'}`
    }
    let cached = null
    try { cached = JSON.parse(localStorage.getItem(key)) } catch { /* none yet */ }
    if (typeof cached?.n === 'number') show(cached.n)
    if (cached && Date.now() - cached.t < 5 * 60e3) continue
    // Give up after 5 s: a slow API must never hold anything up
    fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout?.(5000) })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (typeof j?.stargazers_count !== 'number') return
        show(j.stargazers_count)
        try { localStorage.setItem(key, JSON.stringify({ n: j.stargazers_count, t: Date.now() })) } catch { /* private window */ }
      })
      .catch(() => { /* offline: keep the cached count */ })
  }

  /* Phone menu */
  const top = document.querySelector('.top'), menu = document.querySelector('.menu')
  if (menu) {
    const close = () => { top.classList.remove('open'); menu.setAttribute('aria-expanded', 'false') }
    menu.addEventListener('click', () => { const open = top.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)) })
    for (const a of document.querySelectorAll('.nav a')) a.addEventListener('click', close)
    addEventListener('keydown', e => { if (e.key === 'Escape') close() })
  }

  /* Reveal: cells and steps rise in once, in reading order */
  const items = [...document.querySelectorAll('[data-reveal]')]
  if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return }
  const io = new IntersectionObserver(entries => {
    let i = 0
    for (const e of entries) if (e.isIntersecting) { e.target.style.setProperty('--d', `${(i++ % 3) * 0.08}s`); e.target.classList.add('in'); io.unobserve(e.target) }
  }, { rootMargin: '0px 0px -8% 0px' })
  items.forEach(el => io.observe(el))
})()
