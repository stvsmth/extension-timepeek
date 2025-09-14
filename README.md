# Timepeek extension

## Overview

Timepeek is a browser extension that displays a formatted date when you select a Unix timestamp on
a page. If the selected text is all digits, we treat it as a timestamp and convert it to a
human‑readable date. You can control the format and choose one or more timezones.

Cross‑browser: Firefox (MV2) and Chrome (MV3) are supported via per‑target manifests and a small
build step.

## Project layout

- `manifest.json` → Firefox‑focused MV2 manifest for fast local dev.
- `manifest.base.json` → Shared fields used by both targets.
- `manifest.firefox.json` → Firefox override (MV2, `background.scripts`).
- `manifest.chrome.json` → Chrome override (MV3, `background.service_worker`).
- `scripts/` → Extension code (`background.js`, `content.js`, `formatter.js`) and tooling.
- `scripts/background.sw.entry.js` → Rollup entry to bundle Chrome MV3 service worker.
- `vendor/` → Day.js + plugins and `browser-polyfill` (global scripts).
- `popup/` → Options UI assets.
- `icons/`, `main.css` → Assets used by both targets.
- `dist/` → Generated target folders (`dist/firefox`, `dist/chrome`).

## Prerequisites

- Node.js LTS and npm
- `web-ext` for Firefox dev/build (either globally or via npx)
  - Global: `npm install --global web-ext`

## Development workflow

### Quick Firefox dev loop (recommended)

Run against the root (MV2) manifest for fast auto‑reload on file changes:

```bash
web-ext run
# Optional helpers:
#   web-ext run --start-url https://example.com
#   web-ext run --firefox "path/to/Firefox Nightly"
```

Edits to files under the repo root will trigger live reloads.

### Chrome dev loop

Chrome requires MV3 and a bundled background service worker.

```bash
npm install               # first time only
npm run build:chrome      # generates dist/chrome and bundles SW
# In Chrome: Extensions → Developer mode → Load unpacked → dist/chrome
```

Iterate by re‑running `npm run build:chrome` and clicking “Reload” on the extension in `chrome://extensions/`.

### Alternative Firefox dev (mirrors packaged layout)

Generate the Firefox dist and run from there:

```bash
npm run build:firefox
web-ext run -s dist/firefox
```

This path mirrors the packaged output but requires re‑running `npm run build:firefox` if you change files.

## Building for distribution

### Firefox (zip via web‑ext)

```bash
npm run build:firefox
web-ext build -s dist/firefox -a dist
# Produces a signed-ready zip in ./dist
```

Signing (requires AMO credentials):

```bash
web-ext sign \
  --source-dir dist/firefox \
  --api-key "user:YOUR_ID" \
  --api-secret "YOUR_SECRET" \
  --channel unlisted
```

### Chrome (unpacked or zip)

```bash
npm run build:chrome
# Load unpacked from dist/chrome, or zip it:
(cd dist && zip -r ../timepeek-chrome-unpacked.zip chrome)
```

## Cross‑browser manifest strategy

- We generate per‑target manifests into `dist/` using `scripts/gen-manifest.mjs`.
- Firefox uses MV2 with `background.scripts`; Chrome uses MV3 with `background.service_worker`.
- The Chrome background service worker bundles vendor libs + helpers via Rollup.

## NPM scripts

- `npm run build:firefox` → Generate `dist/firefox` with Manifest V2 (no bundling).
- `npm run build:chrome` → Generate `dist/chrome`, then bundle the background service worker to `dist/chrome/scripts/background.js` with Rollup.
- `npm run dev:firefox` → Shortcut for `web-ext run -s dist/firefox` (generate first if needed).

## CI builds (GitHub Actions)

Workflow: `.github/workflows/build.yml`
- Installs deps, builds Firefox and Chrome targets.
- Bundles Chrome MV3 background with Rollup.
- Packages artifacts:
  - Zips the Chrome unpacked folder.
  - Uses `web-ext build` to create a Firefox distributable zip.
- Uploads `dist/` folders and packaged zips as workflow artifacts.

## Tips & gotchas

- MV3 cannot use `background.scripts`; keep Chrome work in the bundled `scripts/background.js`
  output.
- If you add new files that Chrome needs, re‑run `npm run build:chrome` so they are copied into
  `dist/chrome`.
- For Firefox root‑manifest dev, `web-ext` auto‑reloads on changes; if you dev from `dist/firefox`,
  regenerate before reloading.
