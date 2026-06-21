# Timepeek extension

## Overview

Timepeek is a browser extension that displays a formatted date when you select a Unix timestamp on
a web page. If the selected text is all digits, we treat it as a timestamp and convert it to a
human‑readable date. You can control the format and choose one or more timezones.

Cross‑browser: Firefox (MV2) and Chrome (MV3) are supported via per‑target manifests and a small
build step.

## Project layout

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

### Firefox dev loop

`dev:firefox` generates the Firefox dist (MV2) and runs it with auto‑reload:

```bash
npm install               # first time only
npm run dev:firefox       # builds dist/firefox, then runs web-ext
# Optional web-ext flags pass through after `--`:
#   npm run dev:firefox -- --start-url https://example.com
#   npm run dev:firefox -- --firefox "path/to/Firefox Nightly"
```

`web-ext` live‑reloads on changes under `dist/firefox`. If you edit source files at
the repo root, re‑run `npm run dev:firefox` to rebuild and relaunch.

### Chrome dev loop

Chrome requires MV3 and a bundled background service worker.

```bash
npm install               # first time only
npm run build:chrome      # generates dist/chrome and bundles SW
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

- We generate per‑target manifests into `dist/` using `scripts/gen-manifest.mjs`.
- Firefox uses MV2 with `background.scripts`; Chrome uses MV3 with `background.service_worker`.
- The Chrome background service worker bundles vendor libs + helpers via Rollup.

## NPM scripts

These wrap the build steps and the `web-ext` commands, so they are the source of truth for the
exact invocations:

- `npm run build:firefox` → Generate `dist/firefox` with Manifest V2 (no bundling).
- `npm run build:chrome` → Generate `dist/chrome`, then bundle the background service worker to
   `dist/chrome/scripts/background.js` with Rollup.
- `npm run dev:firefox` → Build `dist/firefox`, then `web-ext run` it with auto‑reload.
- `npm run pack:firefox` → Build `dist/firefox`, then `web-ext build` a distributable zip into `dist/`.
- `npm run pack:chrome` → Build `dist/chrome`, then zip it to `dist/timepeek-chrome-unpacked.zip`.
- `npm run sign:firefox` → Build `dist/firefox`, then `web-ext sign` it to AMO (unlisted channel).

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
- Firefox dev runs from `dist/firefox`; `web-ext` auto‑reloads on changes there, but edits to
  source files at the repo root require re‑running `npm run build:firefox`.
