# Builds the inner pages (privacy, terms, cookies, credits, sitemap), sitemap.xml and robots.txt
# from one template, so the head, top bar and footer stay the same everywhere.
#   python tools/pages.py
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://mhfrough.github.io/jot/'
TODAY = '2026-10-24'
THEME = "<script>try{var t=localStorage.getItem('jot.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>"
SPRITE = '''<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></symbol>
    <symbol id="i-github" viewBox="0 0 256 256"><path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z"/></symbol>
    <symbol id="i-theme" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></symbol>
  </svg>'''


def page(slug, no, title, desc, h1, body):
    url = f'{SITE}{slug}/'
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "url": url, "name": h1, "description": desc, "inLanguage": "en",
         "isPartOf": {"@type": "WebSite", "name": "Jot", "url": SITE}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Jot", "item": SITE},
            {"@type": "ListItem", "position": 2, "name": h1, "item": url}]}]}
    html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="author" content="Mohammad Hamza">
  <link rel="canonical" href="{url}">
  <meta name="theme-color" content="#f1ece2" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#151412" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="../icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Jot">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}assets/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  {THEME}
  <link rel="stylesheet" href="../css/paper.css">
  <link rel="stylesheet" href="../css/site.css">
  <script type="application/ld+json">{json.dumps(ld)}</script>
  <script defer src="../js/site.js"></script>
</head>
<body>
  {SPRITE}
  <a class="skip" href="#main">Skip to the content</a>
  <div class="gridlines" aria-hidden="true"></div>
  <header class="top">
    <div class="wrap top-in">
      <a class="word" href="../" aria-label="Jot, home"><span>jot</span><i class="caret" aria-hidden="true"></i></a>
      <div class="top-act" style="margin-left:auto">
        <a class="star" href="https://github.com/mhfrough/jot" data-stars="mhfrough/jot"><svg aria-hidden="true"><use href="#i-github"/></svg><span class="star-label">Star</span><span class="sr-only"> Jot on GitHub</span><span class="sr-only star-sr"></span><span class="star-n" aria-hidden="true"></span></a>
        <button class="sq-btn" type="button" data-theme-toggle aria-label="Theme: same as the device"><svg aria-hidden="true"><use href="#i-theme"/></svg></button>
        <a class="btn ink" href="../app/"><span>Open Jot</span><svg aria-hidden="true"><use href="#i-arrow"/></svg></a>
      </div>
    </div>
  </header>
  <main id="main" tabindex="-1" class="page wrap">
    <header class="sec-head grid">
      <p class="sec-no">{no}</p>
      <p class="sec-label"><a href="../">Jot</a> / {h1}</p>
      <h1>{h1}</h1>
    </header>
    <div class="grid">
      <div class="page-body">
{body}
      </div>
    </div>
  </main>
  <footer class="foot">
    <div class="wrap grid foot-in">
      <div class="foot-col"><p class="foot-h">Jot</p><a href="../app/">Open the app</a><a href="../">About</a><a href="https://github.com/mhfrough/jot">Source on GitHub</a></div>
      <div class="foot-col"><p class="foot-h">Pages</p><a href="../privacy/">Privacy</a><a href="../terms/">Terms</a><a href="../cookies/">Cookies</a><a href="../credits/">Credits</a><a href="../sitemap/">Sitemap</a></div>
      <p class="foot-small">Made by <a href="https://github.com/mhfrough">Mohammad Hamza</a>. MIT licence.</p>
      <p class="foot-word" aria-hidden="true">jot<i class="caret"></i></p>
    </div>
  </footer>
</body>
</html>
'''
    (ROOT / slug).mkdir(exist_ok=True)
    (ROOT / slug / 'index.html').write_text(html, encoding='utf8')


UPDATED = '<p class="updated">Last updated 24 October 2026.</p>'

page('privacy', 'P1', 'Privacy: Jot keeps your notes on your device',
     'How Jot handles your notes: stored in your own browser, never uploaded, no accounts, no analytics, no cookies.',
     'Privacy', f'''        {UPDATED}
        <p>Jot does not collect, send, sell or share your notes or anything about you. There is no Jot server, no account, no analytics and no advertising.</p>
        <h2>Your notes</h2>
        <p>Notes are stored in your browser's own database (IndexedDB) on the device you use, and nowhere else. They are not encrypted by Jot: anyone who can use your unlocked device and browser can open them, just as they could open any other app. Use your phone's screen lock to keep them to yourself.</p>
        <h2>Settings</h2>
        <p>A few settings that hold nothing personal are kept in local storage: the theme, the note font, the text size and the sort order. The full list is on the <a href="../cookies/">cookies page</a>.</p>
        <h2>Hosting</h2>
        <p>The website and app files are served by GitHub Pages. Like any web host, GitHub may log the IP address and browser of visitors. See the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a>. After the first visit, the app runs from your device's own copy. The website (not the app) asks GitHub's public API for the star count of the Jot repository.</p>
        <h2>Exports</h2>
        <p>An export is a plain JSON file saved where you choose. Anyone who gets the file can read it, so keep it somewhere safe.</p>
        <h2>Changes and questions</h2>
        <p>Any change to this policy is published here and in the source history. Questions are welcome as an issue on <a href="https://github.com/mhfrough/jot/issues">GitHub</a>.</p>''')

page('terms', 'P2', 'Terms of use for Jot, the free notes app',
     'The terms for using Jot: free and open source under the MIT licence, provided as is, with notes kept only on your device.',
     'Terms', f'''        {UPDATED}
        <p>Jot is free software by Mohammad Hamza, released under the <a href="https://github.com/mhfrough/jot/blob/main/LICENSE">MIT licence</a>. By using it you agree to these terms.</p>
        <h2>As is</h2>
        <p>Jot is provided as is, without warranty of any kind. The maker is not liable for lost notes or any damage that comes from using it.</p>
        <h2>Your notes are yours to keep</h2>
        <p>Notes live only in your browser on your device. Clearing the browser's data for this site, or losing the device, deletes them. Export a copy from Settings now and then.</p>
        <h2>Changes</h2>
        <p>These terms may change with new versions of Jot. Changes are published here and in the source history.</p>''')

page('cookies', 'P3', 'Cookies: Jot sets none, here is what it stores',
     'Jot sets no cookies. This page lists everything the site and app keep in your browser, and how to remove it.',
     'Cookies', f'''        {UPDATED}
        <p>Jot sets no cookies, and loads nobody else's. It keeps these things in your browser:</p>
        <h2>Local storage</h2>
        <ul>
          <li><code>jot.theme</code>: auto, light or dark.</li>
          <li><code>jot.font</code>: mono or sans for notes.</li>
          <li><code>jot.size</code>: the note text size.</li>
          <li><code>jot.sort</code>: how the list is sorted.</li>
          <li><code>stars:mhfrough/jot</code>: the cached GitHub star count, on the website.</li>
        </ul>
        <h2>IndexedDB</h2>
        <p>The database named <code>jot-notes</code> holds your notes: title, text, the created and updated times, and whether each is pinned, archived or in the trash.</p>
        <h2>App cache</h2>
        <p>The service worker keeps a copy of the app's own files so it opens offline. It holds no notes.</p>
        <h2>Removing it all</h2>
        <p>In the app, open Settings and choose Erase. Or clear the site data for mhfrough.github.io in your browser settings.</p>''')

page('credits', 'P4', 'Credits and licences for Jot',
     'The font and icons in Jot, with their authors and licences: JetBrains Mono and Phosphor Icons.',
     'Credits', '''        <p>Jot is made by Mohammad Hamza with these open works. Thank you to their authors.</p>
        <table>
          <thead><tr><th scope="col">Work</th><th scope="col">By</th><th scope="col">Licence</th></tr></thead>
          <tbody>
            <tr><td><a href="https://github.com/JetBrains/JetBrainsMono">JetBrains Mono</a></td><td>JetBrains</td><td>SIL Open Font License 1.1</td></tr>
            <tr><td><a href="https://phosphoricons.com">Phosphor Icons</a> (in the app)</td><td>Helena Zhang and Tobias Fried</td><td>MIT</td></tr>
          </tbody>
        </table>
        <h2>Pictures</h2>
        <p>Every picture on the site is a real screenshot of Jot with sample notes. The shapes are drawn in plain SVG.</p>''')

PAGES = [('', 'Jot'), ('app/', 'The Jot app'), ('privacy/', 'Privacy'), ('terms/', 'Terms'),
         ('cookies/', 'Cookies'), ('credits/', 'Credits'), ('sitemap/', 'Sitemap')]
items = '\n'.join(f'          <li><a href="../{p}">{name}</a></li>' for p, name in PAGES)
page('sitemap', 'P5', 'Sitemap: every page on the Jot website',
     'All the pages of the Jot website in one list: the landing page, the app, privacy, terms, cookies and credits.',
     'Sitemap', f'''        <p>Every page on this site. The same list is in <a href="../sitemap.xml">sitemap.xml</a>.</p>
        <ul>
{items}
        </ul>''')

(ROOT / 'sitemap.xml').write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + ''.join(f'  <url><loc>{SITE}{p}</loc><lastmod>{TODAY}</lastmod></url>\n' for p, _ in PAGES)
    + '</urlset>\n', encoding='utf8')
(ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /assets/og.html\n\nSitemap: {SITE}sitemap.xml\n', encoding='utf8')
print('pages written')
