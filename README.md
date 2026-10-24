# <img src="icon.svg" alt="" width="36" height="36"> Jot

Plain notes. Nothing else. A quiet notes app that runs in any browser and installs like an app: no sign-in, no server, no tracking. Notes stay on your device, open offline, and show when each one was created and last updated.

<a href="https://mhfrough.github.io/jot/"><img src="assets/og-image.jpg" alt="Jot: plain notes, nothing else. The notes list on a phone over a grid of circles and squares." width="720"></a>

**Open the app:** https://mhfrough.github.io/jot/app/ &nbsp;·&nbsp; **Site:** https://mhfrough.github.io/jot/ &nbsp;·&nbsp; **Licence:** [MIT](LICENSE)

## What it does

Jot replaces Simple Notes on an Android phone. It keeps what made that app good, plain and quick, and drops everything else.

| Part | What you get |
| --- | --- |
| Notes | As many as you like, saved as you type, with an optional title |
| Dates | Created and updated, day and time, at the top of every note |
| Search | Titles and text, as you type, with matches marked |
| Pins | Pinned notes stay above the rest |
| Formatting | Bold, italic, strike and code, shown formatted with no marks on screen; stored as `**bold**`, `_italic_`, `~~strike~~` and `` `code` ``; Ctrl B, I, Shift X, E |
| Checklists | Plain `[ ]` lines; tap the box to tick it; ticked lines fade; lists carry on when you press Enter |
| Locked | A tab with its own password: notes encrypted on the device, closed after idle minutes or 30 s in the background |
| Archive and trash | Put away or delete with an undo; the trash empties after 30 days |
| Look | Paper (light) or carbon (dark), JetBrains Mono, three text sizes, sort by updated, created or A–Z |
| Export and import | One JSON file with everything (locked notes stay encrypted); imports Simple Notes and Fossify Notes exports and `.txt` files |
| Offline | Installs as an app from the browser and opens with no network |
| Apps | Windows and Android apps ([download](https://github.com/mhfrough/jot/releases/latest)); Linux, macOS and iOS run Jot as an installed web app, with apps coming later |

<p>
  <img src="assets/img/phone-list-light-390.webp" alt="The notes list, light" width="200">
  <img src="assets/img/phone-note-dark-390.webp" alt="A checklist note, dark" width="200">
</p>
<img src="assets/img/desk-light-800.webp" alt="Jot on a laptop: list and note side by side" width="640">

## Where notes live

In the browser's IndexedDB on the device you use, and nowhere else. There is no Jot server and no account, so there is nothing to sync and nothing to leak. Clearing the site's data in the browser deletes the notes, so export a copy from Settings now and then.

## How Locked works

| Piece | How |
| --- | --- |
| Password to key | PBKDF2-SHA-256, 600,000 rounds, random 16-byte salt. The password is never stored |
| Data key | A random 256-bit AES key, wrapped by the password key. Changing the password rewraps only this |
| Each note | Title, text, dates and pin as one JSON object, sealed with AES-256-GCM, a fresh 12-byte IV per save, the note id bound in, padded to 64 bytes |
| Closing | After 1, 5 or 15 minutes without use, 30 s after Jot goes to the background, or Lock now. Closing drops the key and the opened notes |
| Export | Locked notes leave sealed, with the header; a new device opens them with the same password |
| Forgotten password | No reset. Settings can delete every locked note so the tab can start again |

## The apps

Windows and Android are released (from 1.3.0); Linux is built by CI but not released yet. `native/` wraps the same files in [Tauri 2](https://tauri.app) for Windows, Linux and Android. `tools/sync-native.mjs` copies the app into `native/ui` with flat paths and no CSP meta (Tauri sets its own). In the apps, Export opens a save dialog and web links open in the browser; there is no service worker.

```bash
cd native
npm install
npm run build
```

That makes the Windows installer (`.exe`) on Windows, or `.deb`, `.rpm` and `.AppImage` on Linux, under `native/src-tauri/target/release/bundle/`. For Android, with the Android SDK, NDK and a JDK 17:

```bash
npm run android:build
```

On Windows without Developer Mode, Tauri cannot symlink the Rust library into the Android project, so use `npm run android:build:windows` instead (`tools/android-local.mjs`): it copies the library and runs Gradle itself. It builds for phones (`aarch64`) unless you name targets, for example `node ../tools/android-local.mjs aarch64 x86_64`.

The APK is signed when `native/src-tauri/gen/android/keystore.properties` exists (`storeFile`, `password`, `keyAlias=jot`); it is never committed. Keep the keystore safe: an app update must be signed with the same key. The `Native apps` workflow (`native.yml`, run by hand) builds all of them in GitHub Actions; Android there needs the `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD` secrets. A version tag (`release.yml`) releases only the web app for now.

## Run it

The app is plain files. Serve the folder and open `/app/`:

```bash
npm run serve
```

Then open http://localhost:8190/ for the site and http://localhost:8190/app/ for the app. Service workers need `localhost` or HTTPS.

## Tests

End-to-end in real Chrome with Playwright (`playwright-core`):

```bash
npm install
npm test
```

| Test | Checks |
| --- | --- |
| Opens straight away | No sign-in, no password field, no request leaves the site |
| Save and dates | Notes in IndexedDB, back after reload, created stays, updated moves on edit, word count |
| Empty note | A new note that is never written in is not kept |
| Pin, archive, trash | Pin order, undo, archive and back, read-only trash, restore, delete forever, empty trash |
| Search | Filters and marks matches, empty state |
| Checklists | Tap to tick, Enter carries a list on, Enter on an empty item ends it |
| Formatting | Shortcuts and buttons format the selection; it shows formatted with no marks on screen, is stored with marks, survives a reload unchanged; paste comes in plain |
| Follow the tab | Switching tabs switches the open note; locking closes an open locked note |
| Locked | No plain text or password in storage, lock and reopen, wrong password refused, move in and out, deletes skip the trash |
| Locked closing | Closes after the idle time and 30 s in the background (with Playwright's fake clock) |
| Locked export | Exports stay encrypted, open on a new device; change and forget the password |
| Export and import | Export file, import on a new device, duplicates skipped, Simple Notes and text files |
| Settings | Theme, size and sort apply and survive a reload |
| Phone | No sideways scroll at 390 px, editor over the list, browser back closes the note |
| Offline | The service worker serves the app with the network off |
| Website | Every page loads with no errors and no sideways scroll at 390 px |

## Quality checks

```bash
node tests/audit.mjs
node tests/lighthouse.mjs
```

`audit.mjs` runs axe-core (WCAG 2.2 A and AA plus best practices) on every page of the site and on the app's screens and dialogs (list, open note, settings, shortcuts, Locked, a question, a toast, the phone layout), in light and dark, and checks each page's title, description, canonical link, Open Graph tags, headings, image alt text and JSON-LD (WebSite, SoftwareApplication, WebApplication, FAQPage, WebPage, BreadcrumbList). `lighthouse.mjs` runs Lighthouse on the home page, the app, the design page and a text page, phone and desktop.

Lighthouse 12.8, 24 October 2026, served locally:

| Page | Phone: performance · accessibility · best practices · SEO | Desktop |
| --- | --- | --- |
| Home | 97 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |
| App | 99 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |
| Design | 97 · 100 · 100 · 100 | 98 · 100 · 100 · 100 |
| Privacy | 99 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |

axe-core: no violations on any page or app screen, light or dark.

`npm run shots` retakes the screenshots in `assets/img/`; `node tools/icons.mjs` renders the app icons and the social card; `npm run pages` builds the inner pages.

## Files

| Path | What it holds |
| --- | --- |
| `app/index.html`, `app/app.js` | The app: list, editor, settings, export and import |
| `app/db.js` | IndexedDB storage |
| `app/vault.js` | Key derivation, key wrapping and note sealing for Locked |
| `app/sw.js`, `app/manifest.webmanifest` | Offline cache and install |
| `css/paper.css` | The shared font and colours: paper, ink, one ochre signal |
| `css/app.css`, `css/site.css` | The app and the website, plain CSS with no build step |
| `index.html`, `js/site.js` | The website |
| `design/`, `changelog/`, `privacy/`, `terms/`, `cookies/`, `credits/`, `sitemap/`, `404.html` | Inner pages, built by `tools/pages.py` |
| `native/` | The Tauri 2 apps, not released yet: `src-tauri/` (Rust, config, icons, `gen/android`), `ui/` made by `tools/sync-native.mjs` |
| `tests/` | Playwright tests, the screenshot script, the accessibility and SEO audit, Lighthouse |
| `PLAN.md` | Design notes: research, decisions and a self-critique |

## Credits

| Work | By | Licence |
| --- | --- | --- |
| JetBrains Mono | JetBrains | SIL OFL 1.1 |
| Phosphor Icons | Helena Zhang, Tobias Fried | MIT |
| Simple Icons (platform logos) | Simple Icons contributors | CC0 1.0 |

## Licence

MIT. Made by [Mohammad Hamza](https://github.com/mhfrough).
