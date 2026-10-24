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


# The maker's other tools, as on the home page footer (index.html); the website test checks the two match
MORE = [('flick', 'Flick, send files nearby'), ('pinch', 'Pinch, shrink images'), ('scrawl', 'Scrawl, a sketchbook'),
        ('sizzle', 'Sizzle, promo reels by your AI agent'), ('swoop', 'Swoop, screenshots')]
MORE_LINKS = ''.join(f'<a href="https://mhfrough.github.io/{slug}/">{name}</a>' for slug, name in MORE)


def page(slug, no, title, desc, h1, body, base='../', wide=False, out=None):
    # base: how links reach the site root; the 404 page is served at any depth, so it uses /jot/
    B = base
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
  <link rel="icon" href="{B}icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="{B}apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Jot">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}assets/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  {THEME}
  <link rel="stylesheet" href="{B}css/paper.css">
  <link rel="stylesheet" href="{B}css/site.css">
  <script type="application/ld+json">{json.dumps(ld)}</script>
  <script defer src="{B}js/site.js"></script>
</head>
<body>
  {SPRITE}
  <a class="skip" href="#main">Skip to the content</a>
  <div class="gridlines" aria-hidden="true"></div>
  <header class="top">
    <div class="wrap top-in">
      <a class="word" href="{B}" aria-label="Jot, home"><span>jot</span><i class="caret" aria-hidden="true"></i></a>
      <div class="top-act" style="margin-left:auto">
        <a class="star" href="https://github.com/mhfrough/jot" data-stars="mhfrough/jot"><svg aria-hidden="true"><use href="#i-github"/></svg><span class="star-label">Star</span><span class="sr-only"> Jot on GitHub</span><span class="sr-only star-sr"></span><span class="star-n" aria-hidden="true"></span></a>
        <button class="sq-btn" type="button" data-theme-toggle aria-label="Theme: same as the device"><svg aria-hidden="true"><use href="#i-theme"/></svg></button>
        <a class="btn ink" href="{B}app/"><span>Open Jot</span><svg aria-hidden="true"><use href="#i-arrow"/></svg></a>
      </div>
    </div>
  </header>
  <main id="main" tabindex="-1" class="page wrap">
    <header class="sec-head grid">
      <p class="sec-no">{no}</p>
      <p class="sec-label"><a href="{B}">Jot</a> / {h1}</p>
      <h1>{h1}</h1>
    </header>
    <div class="grid">
      <div class="page-body{' wide' if wide else ''}">
{body}
      </div>
    </div>
  </main>
  <footer class="foot">
    <div class="wrap grid foot-in">
      <div class="foot-col"><p class="foot-h">Jot</p><a href="{B}app/">Open the app</a><a href="{B}">About</a><a href="https://github.com/mhfrough/jot">Source on GitHub</a></div>
      <div class="foot-col"><p class="foot-h">Pages</p><a href="{B}design/">Design</a><a href="{B}changelog/">Changelog</a><a href="{B}privacy/">Privacy</a><a href="{B}terms/">Terms</a><a href="{B}cookies/">Cookies</a><a href="{B}credits/">Credits</a><a href="{B}sitemap/">Sitemap</a></div>
      <div class="foot-col"><p class="foot-h">More by the maker</p>{MORE_LINKS}</div>
      <p class="foot-small">Made by <a href="https://github.com/mhfrough">Mohammad Hamza</a>. MIT licence.</p>
      <p class="foot-word" aria-hidden="true">jot<i class="caret"></i></p>
    </div>
  </footer>
</body>
</html>
'''
    if out:
        (ROOT / out).write_text(html, encoding='utf8')
        return
    (ROOT / slug).mkdir(exist_ok=True)
    (ROOT / slug / 'index.html').write_text(html, encoding='utf8')


UPDATED = '<p class="updated">Last updated 24 October 2026.</p>'

page('privacy', 'P1', 'Privacy: Jot keeps your notes on your device',
     'How Jot handles your notes: stored in your own browser, never uploaded, no accounts, no analytics, no cookies.',
     'Privacy', f'''        {UPDATED}
        <p>Jot does not collect, send, sell or share your notes or anything about you. There is no Jot server, no account, no analytics and no advertising.</p>
        <h2>Your notes</h2>
        <p>Notes are stored in your browser's own database (IndexedDB) on the device you use, and nowhere else. Notes in the main list are stored as plain text: anyone who can use your unlocked device and browser can open them, as with any other app.</p>
        <h2>Locked notes</h2>
        <p>Notes in the Locked tab are encrypted on the device with AES-256-GCM before they are stored. The key comes from your password through PBKDF2-SHA-256 with 600,000 rounds; the password itself is never stored or sent anywhere. Nobody, including the maker of Jot, can open them without it, and there is no way to reset it. In an export they stay encrypted.</p>
        <h2>Settings</h2>
        <p>A few settings that hold nothing personal are kept in local storage: the theme, the text size, the sort order and how soon Locked closes. The full list is on the <a href="../cookies/">cookies page</a>.</p>
        <h2>Hosting</h2>
        <p>The website and app files are served by GitHub Pages. Like any web host, GitHub may log the IP address and browser of visitors. See the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a>. After the first visit, the app runs from your device's own copy. The website (not the app) asks GitHub's public API for the star count of the Jot repository.</p>
        <h2>Exports</h2>
        <p>An export is a JSON file saved where you choose. Your main notes are plain text in it, so anyone who gets the file can read those; locked notes stay encrypted. Keep it somewhere safe.</p>
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
        <h2>The Locked password</h2>
        <p>You are the only holder of the Locked password. If you forget it, the notes it protects cannot be opened by anyone, and the maker cannot help.</p>
        <h2>Changes</h2>
        <p>These terms may change with new versions of Jot. Changes are published here and in the source history.</p>''')

page('cookies', 'P3', 'Cookies: Jot sets none, here is what it stores',
     'Jot sets no cookies. This page lists everything the site and app keep in your browser, and how to remove it.',
     'Cookies', f'''        {UPDATED}
        <p>Jot sets no cookies, and loads nobody else's. It keeps these things in your browser:</p>
        <h2>Local storage</h2>
        <ul>
          <li><code>jot.theme</code>: auto, light or dark.</li>
          <li><code>jot.size</code>: the note text size.</li>
          <li><code>jot.sort</code>: how the list is sorted.</li>
          <li><code>jot.lockmin</code>: minutes without use before Locked closes.</li>
          <li><code>stars:mhfrough/jot</code>: the cached GitHub star count, on the website.</li>
        </ul>
        <h2>IndexedDB</h2>
        <p>The database named <code>jot-notes</code> holds your notes: title, text, the created and updated times, and whether each is pinned, archived or in the trash. Locked notes are kept apart in it, encrypted, with the header that opens them (a salt, a round count and an encrypted key).</p>
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
            <tr><td><a href="https://playwright.dev">Playwright</a> (tests and screenshots)</td><td>Microsoft</td><td>Apache 2.0</td></tr>
            <tr><td><a href="https://simpleicons.org">Simple Icons</a> (Android, Apple and Linux logos)</td><td>Simple Icons contributors</td><td>CC0 1.0</td></tr>
          </tbody>
        </table>
        <h2>Pictures</h2>
        <p>Every picture on the site is a real screenshot of Jot with sample notes. The shapes are drawn in plain SVG.</p>
        <h2>Ideas</h2>
        <p>The grid follows Josef Müller-Brockmann's <i>Grid Systems in Graphic Design</i>. The focus on the words owes a lot to iA Writer, and the plain list and editor to Simplenote and Simple Notes. See the <a href="../design/">design page</a>.</p>''')

def sw(name, hexv, role):
    return f'<li class="sw"><span class="sw-chip" style="background:{hexv}"></span><b>{name}</b><code>{hexv}</code><span>{role}</span></li>'

LIGHT = [('paper', '#f1ece2', 'the page'), ('sheet', '#f8f5ee', 'the note, dialogs'), ('ink', '#1f1d1a', 'text, solid shapes'),
         ('ink-2', '#5d574d', 'supporting text'), ('ink-3', '#645e53', 'labels, dates, 4.6:1'), ('rule', '#ddd5c6', 'hairlines'),
         ('signal', '#b07d00', 'marks and shapes'), ('signal-ink', '#8a5f00', 'signal as text, 4.8:1')]
DARK = [('paper', '#151412', 'the page'), ('sheet', '#1b1a17', 'the note, dialogs'), ('ink', '#ebe5d9', 'text, solid shapes'),
        ('ink-2', '#a39b8b', 'supporting text'), ('ink-3', '#958f81', 'labels, dates, 4.8:1'), ('rule', '#2a2824', 'hairlines'),
        ('signal', '#e0aa2a', 'marks, shapes and text'), ('select', '#272420', 'the open note in the list')]
SW_LIGHT = ''.join(sw(*c) for c in LIGHT)
SW_DARK = ''.join(sw(*c) for c in DARK)
GRID_DEMO = ''.join('<span></span>' for _ in range(12))

page('design', 'P0', 'Design: the Jot design system, paper, ink and a grid',
     'How Jot looks and why: the paper and carbon colours, the ochre signal, JetBrains Mono, the 12-column grid, the geometry and the components.',
     'Design', f"""        <p class="lead">Jot is designed like a printed page. Paper and ink, one typeface, a visible grid, square corners and one signal colour. Nothing is decoration: every rule, shape and colour carries information or holds the grid.</p>

        <h2>1 · Principles</h2>
        <ol class="rules">
          <li><b>Words first.</b> The note is the largest thing on the screen. Tools stay small, grey and out of the way.</li>
          <li><b>One face.</b> JetBrains Mono everywhere, so every character lines up like a typewriter page. Hierarchy comes from size, weight and capitals, never from a second font. Because every weight and slant has the same width, formatting can be drawn right under the text as you type.</li>
          <li><b>Square.</b> No rounded corners. The only curves are true circles and the phones in pictures.</li>
          <li><b>The grid shows.</b> Twelve columns, drawn as hairlines in the gutters. Text sits flush left on a column edge.</li>
          <li><b>One signal.</b> Ochre marks what matters now: the open tab, the open note, a pin, the caret. Never body text on paper.</li>
          <li><b>Plain words.</b> Short sentences, sentence case, no exclamation marks, no jargon.</li>
        </ol>

        <h2>2 · Colour</h2>
        <p>Eight tokens per theme, in <code>css/paper.css</code>. The app and the site read the same file.</p>
        <p class="sw-h">Paper (light)</p>
        <ul class="sws" role="list">{SW_LIGHT}</ul>
        <p class="sw-h">Carbon (dark)</p>
        <ul class="sws dark" role="list">{SW_DARK}</ul>
        <p>Ochre was chosen to stand apart from the maker's other tools (Swoop is orange, Pinch blue, Flick lime, Scrawl yellow) and from Claude's clay. On paper it is too light for small text (3.1:1), so text uses the darker <code>#8a5f00</code>. Ink on an ochre fill reads at 4.6:1.</p>

        <h2>3 · Type</h2>
        <p>JetBrains Mono, one variable file, weights 400 to 800. Contextual alternates off, slashed zero on.</p>
        <div class="specimen">
          <p class="sp-1">Plain notes.</p>
          <p class="sp-2">Everything you need. Nothing you do not.</p>
          <p class="sp-3">Saves as you type</p>
          <p class="sp-4">Every note shows the day and time it was made and last changed.</p>
          <p class="sp-5">Created · Updated · 01 Features</p>
        </div>
        <table>
          <thead><tr><th scope="col">Role</th><th scope="col">Size</th><th scope="col">Weight</th><th scope="col">Tracking</th></tr></thead>
          <tbody>
            <tr><td>Display</td><td>44–108 px</td><td>800</td><td>−6.5%</td></tr>
            <tr><td>Section heading</td><td>28–52 px</td><td>800</td><td>−5%</td></tr>
            <tr><td>Card heading</td><td>17–20 px</td><td>800</td><td>−3%</td></tr>
            <tr><td>Body, note text</td><td>15–18.5 px</td><td>400</td><td>0, leading 1.65–1.75</td></tr>
            <tr><td>Label</td><td>10.5–12.5 px</td><td>700, capitals</td><td>+12–14%</td></tr>
          </tbody>
        </table>

        <h2>4 · Grid</h2>
        <p>Twelve columns on wide screens and four on phones, with gutters of 14–28 px and a 1320 px maximum. The hairlines sit in the middle of each gutter, so a column's text starts on its edge. Section heads use one pattern everywhere: the number in column 1, the label in columns 2–4, the heading from column 5 (shown in ink below).</p>
        <div class="grid-demo" aria-hidden="true">{GRID_DEMO}</div>

        <h2>5 · Geometry</h2>
        <p>Every shape is built from the grid's square module: whole circles, squares, quarter and half circles, and two print textures, a halftone dot screen and a 45° hatch. They are filled with ink, the signal or a texture, never a gradient.</p>
        <svg class="geo-set" viewBox="0 0 600 100" aria-hidden="true">
          <defs>
            <pattern id="ds" width="10" height="10" patternUnits="userSpaceOnUse"><circle class="p-ink" cx="5" cy="5" r="2.2"/></pattern>
            <pattern id="hs" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="p-ink" width="2.6" height="8"/></pattern>
          </defs>
          <circle class="g-sun" cx="50" cy="50" r="46"/>
          <rect class="g-ink" x="120" y="4" width="92" height="92"/>
          <path class="g-quarter" d="M236 96V4A92 92 0 0 1 328 96Z"/>
          <circle class="g-ring" cx="398" cy="50" r="45"/>
          <rect x="464" y="4" width="56" height="92" fill="url(#ds)"/>
          <rect x="534" y="4" width="62" height="92" fill="url(#hs)"/>
        </svg>

        <h2>6 · Components</h2>
        <div class="kit">
          <a class="btn ink" href="../app/"><span>Open Jot</span><svg aria-hidden="true"><use href="#i-arrow"/></svg></a>
          <a class="btn line" href="#main"><span>Line button</span></a>
          <p class="tag on">Ready</p>
          <p class="tag">Coming</p>
          <button class="sq-btn" type="button" aria-label="Square icon button"><svg aria-hidden="true"><use href="#i-theme"/></svg></button>
        </div>
        <p>Buttons are ink blocks or ink outlines, 40 or 54 px tall, square. Hover turns an ink button ochre. In the app, the list row for the open note gets a 3 px ochre bar; a pinned note, a small ochre square; the open tab, an ochre underline.</p>

        <h2>7 · Icon</h2>
        <div class="icons">
          <figure><img src="../icon.svg" width="96" height="96" alt="The Jot icon: a paper j and an ochre cursor on an ink tile"><figcaption class="fig">icon.svg</figcaption></figure>
          <figure><img src="../app/icons/maskable-512.png" width="96" height="96" alt="The maskable Android icon, with the glyph inside the safe circle"><figcaption class="fig">Android, maskable</figcaption></figure>
        </div>
        <p>A lowercase j drawn from squares and one curve, followed by an ochre cursor, as if the word is still being typed. The maskable version shrinks the glyph to 70% so Android's circular crop never cuts the cursor.</p>

        <h2>8 · Research</h2>
        <ul>
          <li>Josef Müller-Brockmann, <i>Grid Systems in Graphic Design</i>: the modular grid, flush-left text, information over decoration.</li>
          <li>iA Writer: typography as the interface, a monospaced face, nothing around the words.</li>
          <li>Simplenote and Simple Notes: a list and an editor, pins, search and nothing else.</li>
        </ul>""", wide=True)

page('changelog', 'P6', 'Changelog: every version of Jot',
     'What changed in each version of Jot, newest first.',
     'Changelog', """        <article class="ver">
          <h2>1.2.1 <span class="updated">24 October 2026</span></h2>
          <ul>
            <li>The toast sizes to its text instead of wrapping into a narrow column.</li>
            <li>On small phones (360 px, like the Realme C25s) every editor tool fits on one row.</li>
            <li>The install sheet shows screenshots, a description and the new-note shortcut.</li>
          </ul>
        </article>
        <article class="ver">
          <h2>1.2.0 <span class="updated">24 October 2026</span></h2>
          <ul>
            <li>Formatting now shows as formatting: bold is bold, with no marks on screen. Notes are still stored as plain text.</li>
            <li>Switching tabs switches the note on the right, and closing Locked closes an open locked note.</li>
            <li>Accessibility and SEO pass: stronger contrast for labels and dates, a main heading and landmark in the app, structured data for the app and the questions.</li>
            <li>Real platform logos on the Get Jot section. Apps for Windows, Linux, Android, macOS and iOS are coming soon.</li>
          </ul>
        </article>
        <article class="ver">
          <h2>1.1.0 <span class="updated">24 October 2026</span></h2>
          <ul>
            <li>Locked: a tab with its own password. Its notes are encrypted on the device (AES-256-GCM, PBKDF2 with 600,000 rounds), close after a few idle minutes or 30 seconds in the background, and stay encrypted in exports.</li>
            <li>Formatting: bold, italic, strike and code, shown as you type, with Ctrl B, Ctrl I, Ctrl Shift X and Ctrl E.</li>
            <li>Ticked checklist lines are struck through and faded.</li>
            <li>Notes are mono only, so formatting always lines up with the text.</li>
          </ul>
        </article>
        <article class="ver">
          <h2>1.0.1 <span class="updated">24 October 2026</span></h2>
          <ul>
            <li>Square corners everywhere in the app.</li>
            <li>The icon's cursor is ochre, and the Android icon keeps it inside the safe circle.</li>
            <li>A new version now says so with a Reload button, instead of waiting quietly.</li>
            <li>A Get Jot section for the web, Android, iPhone and iPad, Windows, macOS and Linux.</li>
            <li>New pages: Design, Changelog and a 404 page.</li>
          </ul>
        </article>
        <article class="ver">
          <h2>1.0.0 <span class="updated">24 October 2026</span></h2>
          <ul>
            <li>Plain notes with no sign-in, kept in the browser on your device.</li>
            <li>Created and updated dates on every note, pins, search, checklists, archive and trash with undo.</li>
            <li>Paper and carbon themes, JetBrains Mono, an ochre signal.</li>
            <li>Export to JSON; import from Simple Notes, Fossify Notes and text files.</li>
          </ul>
        </article>""")

page('404', '404', 'Not found: Jot', 'This page does not exist.', 'Nothing here',
     """        <p class="lead">This page does not exist, or it moved. Your notes are fine: they live in the app, not on this site.</p>
        <p><a class="btn ink" href="/jot/app/"><span>Open Jot</span><svg aria-hidden="true"><use href="#i-arrow"/></svg></a></p>
        <p><a href="/jot/">Go to the Jot home page</a></p>""", base='/jot/', out='404.html')

PAGES = [('', 'Jot'), ('app/', 'The Jot app'), ('design/', 'Design'), ('changelog/', 'Changelog'), ('privacy/', 'Privacy'),
         ('terms/', 'Terms'), ('cookies/', 'Cookies'), ('credits/', 'Credits'), ('sitemap/', 'Sitemap')]
items = '\n'.join(f'          <li><a href="../{p}">{name}</a></li>' for p, name in PAGES)
page('sitemap', 'P5', 'Sitemap: every page on the Jot website',
     'All the pages of the Jot website in one list: the landing page, the app, design, changelog, privacy, terms, cookies and credits.',
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
