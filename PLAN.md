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
| Type | JetBrains Mono for everything; a sans option for note text only |
| Colour | Paper `#f1ece2` and ink `#1f1d1a`; carbon `#151412` at night. One signal: Swiss poster orange `#ff5000` (Pantone Orange 021), never for body text; `#c43e00` where it is text |
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

- **Checklists are text.** `[ ]` and `[x]` are honest and portable but not as nice as real boxes. A
  mirrored overlay could draw boxes over a plain textarea without changing the file format.
- **No sync.** By design, but moving between phone and laptop is an export and an import. A later
  version could send a file between two devices directly.
- **The tally in the hero** (0 accounts, 0 servers…) uses its own four columns, so its rules do
  not land exactly on the page grid.
- **Long notes** grow the editor as you type; very long notes (tens of thousands of lines) would be
  better in a virtualised editor.
- **Storage can be cleared** by the browser or the user. The native apps (Tauri) will keep notes in
  their own storage, out of reach of "clear site data".

## Platforms

| Platform | Route | State |
| --- | --- | --- |
| Web, any OS | PWA from GitHub Pages | v1.0.0 |
| Windows, Linux, macOS | Tauri 2 installers from GitHub releases | next |
| Android | Tauri 2 APK from GitHub releases | next |
| iOS | Tauri 2; needs a Mac, Xcode and an Apple Developer account | set up, not built |

## Later

- **Locked notes (opt-in).** A private tab protected by a password: notes in it encrypted on the
  device (PBKDF2-SHA-256 to a key that wraps a random AES-256-GCM data key, one fresh IV per save).
  Everything else stays as it is, with no sign-in. Comes after the native apps.
