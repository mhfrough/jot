# Jot: design notes

Jot is a plain notes app that replaces Simple Notes on an Android phone. One web codebase: a PWA
today, wrapped by Tauri 2 for Windows, Linux, Android and iOS next.

## Research

- **Swiss grid (Müller-Brockmann).** A strict modular grid, flush-left text, hairline rules that show
  the grid, one signal colour used as information rather than decoration.
- **iA Writer.** Typography is the interface: large type, generous leading, a monospaced face, no
  toolbars around the words.
- **Simple Notes / Simplenote.** Speed and nothing else: a list and an editor, pins, search,
  checklists. Its exports (Settings, Export notes) are what Jot imports.
- **Paper texture.** Works only when it is barely there: a warm paper tone and a fine grain.

## Decisions

| Part | Decision |
| --- | --- |
| Accounts | None. No sign-in, no passphrase: the app opens on the list |
| Storage | IndexedDB in the browser, asks for persistent storage; export to one JSON file |
| Type | JetBrains Mono for everything, notes included (the sans option went in 1.1.0) |
| Colour | Paper `#f1ece2` and ink `#1f1d1a`; carbon `#151412` at night. One signal: ochre `#b07d00` (`#e0aa2a` at night) for marks and shapes; `#8a5f00` where it sets text, for 4.8:1 contrast. Chosen to stand apart from Swoop's orange and Claude's clay |
| App layout | Phone: list, then the note over it. Wide: list and note side by side, the note on a centred 42 rem column |
| Dates | Created and updated on every note, always both, as "Today, 14:05" or "24 Oct, 14:05" |
| Website | A visible 12-column grid (hairlines in the gutters), numbered sections, poster geometry built on the same modules: circles, squares, quarter circles, halftone dots, hatching |
| Removed | Encryption, the private tab and device-to-device viewing: they asked for passphrases, which Jot no longer has |

## Self-critique

What is good:

- The list reads like Simple Notes but quieter: one weight for titles, two lines of preview, dates in tabular figures.
- Both themes come from the same eight tokens, so nothing drifts between light and dark.
- The website's geometry is the grid itself, not decoration: every shape sits on the modules.

What is still weak, and what would fix it:

- **Checklists are text.** `[ ]` and `[x]` are honest and portable; ticked lines now fade and strike
  through, but the box itself is still two brackets.
- **No sync.** By design, but moving between phone and laptop is an export and an import. A later
  version could send a file between two devices directly.
- **The tally in the hero** (0 accounts, 0 servers…) uses its own four columns, so its rules do
  not land exactly on the page grid.
- **Long notes** grow the editor as you type; very long notes (tens of thousands of lines) would be
  better in a virtualised editor.
- **Storage can be cleared** by the browser or the user. The native apps (Tauri, coming soon) keep
  notes in their own storage, out of reach of "clear site data".

## Platforms

| Platform | Route | State |
| --- | --- | --- |
| Web, any OS | PWA from GitHub Pages | v1.0.0 |
| Windows | Tauri 2 installer from GitHub releases | v1.3.0 |
| Android | Tauri 2 APK, signed, arm64 and armv7 | v1.3.0 |
| Linux | Tauri 2 .deb, .rpm, .AppImage (native.yml) | built in CI, not released |
| macOS, iOS | Tauri 2; needs a Mac (and an Apple Developer account for iOS) | later |

### PWA or native

The web app stays the one codebase. A Tauri shell adds what a browser cannot give: storage that
"clear site data" cannot wipe, an installer, and a place for one native piece worth having, a
Locked key kept in the Android Keystore or Windows Hello for fingerprint or face unlock. A full
native rewrite per platform would double every change for no gain in safety over a sandboxed
web view.

## Locked (1.1.0)

An opt-in tab with its own password. Everything else stays as it is, with no sign-in.

- The password is stretched with PBKDF2-SHA-256 (600,000 rounds) into a key that wraps a random
  AES-256-GCM data key. Each note is sealed with a fresh IV, its id bound in, padded to 64 bytes.
- Locked notes never go to the trash (the trash is not locked), cannot be archived, and leave an
  export sealed.
- It closes after the chosen idle minutes, 30 s after Jot goes to the background, or on Lock now.
- No reset: a lost password means the notes are gone; Settings can delete them to start again.

## Formatting (1.1.0)

`**bold**`, `_italic_`, `~~strike~~` and `` `code` ``. Since 1.2.0 the note body is a rich editor
that shows them formatted with no marks, one `<div>` per line, and turns what you type back into
the same plain text with marks. Paste and drop come in as plain text.
