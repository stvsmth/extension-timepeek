# Timepeek extension

## Overview

Timepeek is a browser extension that displays a formatted date when you select a Unix timestamp on
a web page. If the selected text is all digits, we treat it as a timestamp and convert it to a
human‑readable date. You can control the format and choose one or more timezones.

Cross‑browser: Firefox and Chrome are both Manifest V3, supported via per‑target manifests and a
small build step. There are no runtime dependencies — every shipped line of JS is project code,
formatting dates with native `Intl.DateTimeFormat`.

## Project layout

- `manifest.base.json` → Shared fields used by both targets (MV3, `storage` permission, popup
  action, content script).
- `manifest.firefox.json` → Firefox override (`background.scripts` event page, `host_permissions`,
  Gecko id).
- `manifest.chrome.json` → Chrome override (`background.service_worker`).
- `scripts/` → Extension code: `background.js`, `content.js`, `formatter.js`, and
  `gen-manifest.mjs` (the build tool).
- `popup/` → Options UI assets.
- `icons/` → Extension icons.
- `test/` → Zero-dependency `node:test` suite (golden parity + new-behavior unit tests).
- `dist/` → Generated target folders (`dist/firefox`, `dist/chrome`).

## Prerequisites

- Node.js LTS and npm
- `web-ext` for Firefox dev/build/lint (either globally or via npx)
  - Global: `npm install --global web-ext`

## Development workflow

### Firefox dev loop

`dev:firefox` generates the Firefox dist (MV3) and runs it with auto‑reload:

```bash
npm install               # first time only
npm run dev:firefox       # builds dist/firefox, then runs web-ext
# Optional web-ext flags pass through after `--`:
#   npm run dev:firefox -- --start-url https://example.com
#   npm run dev:firefox -- --firefox "path/to/Firefox Nightly"
```

`web-ext` live‑reloads on changes under `dist/firefox`. If you edit source files at
the repo root, re‑run `npm run dev:firefox` to rebuild and relaunch.

Firefox MV3 host permissions are opt‑in: on first run, use the popup's "Grant page access"
button if the content script doesn't seem to be injecting.

### Chrome dev loop

```bash
npm install               # first time only
npm run build:chrome      # generates dist/chrome
# In Chrome: Extensions → Developer mode → Load unpacked → dist/chrome
```

Iterate by re‑running `npm run build:chrome` and clicking “Reload” on the extension in
`chrome://extensions/`.

## Building for distribution

### Firefox (zip via web‑ext)

```bash
npm run pack:firefox      # builds dist/firefox, writes a zip to ./dist
```

Signing publishes to AMO and requires credentials. `web-ext` reads them from
`WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` (or a local `.web-ext-config.mjs`):

```bash
npm run sign:firefox      # builds dist/firefox, then web-ext sign --channel unlisted
```

### Chrome (unpacked or zip)

```bash
npm run pack:chrome       # builds dist/chrome, zips it to dist/timepeek-chrome-unpacked.zip
# Or just load unpacked from dist/chrome in chrome://extensions/
```

## Cross‑browser manifest strategy

- We generate per‑target manifests into `dist/` using `scripts/gen-manifest.mjs`, which also
  injects `version` from `package.json` (the single source of truth for the version number).
- Both targets are MV3. Chrome uses `background.service_worker` (a classic, non-module service
  worker that pulls in the formatter via `importScripts`). Firefox uses `background.scripts`
  (an event page — Firefox doesn't reliably support `service_worker`).
- Firefox keeps `host_permissions: ["<all_urls>"]` since Firefox MV3 host access is opt-in; Chrome
  drops it because `content_scripts.matches` alone is sufficient there.

## Tests

```bash
npm test                  # node --test over test/*.test.mjs
```

`test/golden.test.mjs` checks `scripts/formatter.js` against committed literal strings in
`test/goldens.json` (originally generated from the vendored Day.js library before it was replaced
by `Intl.DateTimeFormat` — see `test/matrix.mjs` for the case list). `test/formatter.test.mjs`
covers `timestampToDate` boundaries and other new-behavior units.

## NPM scripts

These wrap the build steps and the `web-ext` commands, so they are the source of truth for the
exact invocations:

- `npm test` → Run the test suite.
- `npm run build:firefox` → Generate `dist/firefox` (MV3, no bundling).
- `npm run build:chrome` → Generate `dist/chrome` (MV3, no bundling).
- `npm run dev:firefox` → Build `dist/firefox`, then `web-ext run` it with auto‑reload.
- `npm run pack:firefox` → Build `dist/firefox`, then `web-ext build` a distributable zip into `dist/`.
- `npm run pack:chrome` → Build `dist/chrome`, then zip it to `dist/timepeek-chrome-unpacked.zip`.
- `npm run sign:firefox` → Build `dist/firefox`, then `web-ext sign` it to AMO (unlisted channel).

## CI builds (GitHub Actions)

Workflow: `.github/workflows/build.yml`
- Installs deps with `npm ci`, runs `npm test`.
- Builds Firefox and Chrome targets.
- Lints the Firefox build with `web-ext lint`.
- Packages artifacts:
  - Zips the Chrome unpacked folder.
  - Uses `web-ext build` to create a Firefox distributable zip.
- Uploads `dist/` folders and packaged zips as workflow artifacts.

## Tips & gotchas

- If you add new files that either target needs, re‑run the corresponding `npm run build:*` so
  they are copied into `dist/`.
- Firefox dev runs from `dist/firefox`; `web-ext` auto‑reloads on changes there, but edits to
  source files at the repo root require re‑running `npm run build:firefox`.
- Settings are stored in `storage.sync` (roams across signed-in browsers). A one-time migration
  copies any pre-existing `storage.local` settings the first time `storage.sync` is read empty.
