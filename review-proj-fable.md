# Timepeek Extension Review

*Staff-engineer sweep — 2026-07-01*

Overall verdict: this is in good shape for its size. The split-manifest + `gen-manifest.mjs` approach is a sensible cross-browser strategy, the code is readable, and the privacy posture (all local, no data collection) matches AGENTS.md. Below is what I'd flag, ordered by impact.

## Highest-impact items

**1. The content script does work on every mouseup, on every page, in every frame — before checking the modifier key.**
In `handleEvent` (`scripts/content.js:59-78`), the flow is: extract selection → regex → `sendMessage` to the background → *then* check `modifierPressed`. On Chrome MV3 that `sendMessage` wakes the service worker. Since the extension injects into `<all_urls>` with `all_frames: true`, every plain click on any page pays this cost. The fix is a two-line reorder: bail immediately if `!(e.ctrlKey || e.metaKey)` and if the regex doesn't match, before awaiting anything. This is the single best easy win in the repo.

**2. Requesting permissions that aren't used.**
- `activeTab` (both manifests) — nothing in the code uses the tabs API or programmatic injection. Remove it.
- `host_permissions: ["<all_urls>"]` in `manifest.chrome.json:7-9` and `"http://*/", "https://*/"` in `manifest.firefox.json:5-6` — manifest-declared `content_scripts` don't need host permissions to inject; the `matches` array grants that by itself. Host permissions are for API access (fetch, `scripting.executeScript`, etc.), which this extension doesn't do.

Dropping both shrinks the permission surface to just `storage`, which speeds store review and is the direction both stores are pushing.

**3. Firefox is still MV2; that runway is ending.**
Firefox has had solid MV3 support for a long time now, and Mozilla has been signaling MV2 deprecation. The migration here is unusually cheap because Firefox MV3 keeps `background.scripts` (event pages) — no service-worker bundle needed for Firefox. Roughly: bump `manifest_version` to 3, rename `browser_action` → `action`, move host permissions out (moot after item 2). The base manifest gets more shared as a bonus.

**4. Millisecond timestamps produce garbage.**
`dayjs.unix(parseFloat(text))` in `scripts/background.js:24` treats everything as seconds, so a 13-digit timestamp (very common — JS `Date.now()`, Java, log lines) renders as year ~46,000. A simple heuristic fixes it: if the integer part is ≥ 1e12, divide by 1000 (and ≥ 1e15 for microseconds to go further). The vestigial `fetchedIn` field — which is only ever the literal `'seconds'` and used as a truthiness gate — looks like this feature was once planned. Either build it or delete the field.

## Bugs and sharp edges

- **Errors render into the tooltip.** `scripts/content.js:23` returns the caught exception object as `textContent` with `fetchedIn: 'seconds'`, so if the background is unreachable (classic case: extension was updated and the old content script is orphaned), the user sees "Error: Extension context invalidated" in a black box. That path should fail silently or show a friendly one-liner.
- **`getSelectedText` input handling** (`scripts/content.js:31`): `activeElement.value` truthiness means a focused input hijacks selection detection — and `selectionStart` *throws* on `<input type="email">` and `type="number"` in Chrome. Safer: check `typeof activeElement.selectionStart === 'number'` inside a try, or restrict to `text`/`textarea`/`search` types. Also, the `document.selection` branch at line 44 is IE-only dead code — delete it.
- **Preview diverges from behavior.** If the user removes all timezones, the popup preview (`popup/timepeek.js:67`) falls back to the system timezone, but the background (`scripts/background.js:13`) falls back to `Etc/UTC`. Pick one fallback and share it.
- **Tooltip isn't isolated from page CSS.** It's a plain `div` in `document.body` styled by injected `main.css`. Aggressive site CSS (resets on `p`, higher z-indexes than 99999) can break or bury it. Current best practice is a shadow root (even open is fine) or fully inline styles. Related polish: the tooltip can render off-screen near the right/bottom edges since it's placed at raw `clientX/clientY + 30`.

## Simplifications and easy wins

- **The popup's settings seeding can be deleted.** `popup/timepeek.js:14-25` does three get/set roundtrips to write defaults, but `browser.storage.local.get({format: DEFAULT_FORMAT, timezones: DEFAULT_TIMEZONES, includeRegion: true})` returns defaults for missing keys without writing anything — and the background already applies its own fallbacks. Six storage calls become one. Relatedly, clearing the format input stores `format: null` (line 104); `storage.local.remove('format')` is cleaner.
- **Version single-sourcing.** Version lives in both `package.json` and `manifest.base.json` — and commit a04bb82 ("fix version drift") shows this has already bitten. Have `gen-manifest.mjs` read `version` from `package.json` and inject it; delete it from the base manifest.
- **CI:** use `npm ci` instead of `npm install`, and add `npx web-ext lint -s dist/firefox` as a gate — it catches manifest mistakes and store-submission blockers before AMO does.
- **No tests, but the hook is there.** `formatter.js:20-22` exports CommonJS for tests that don't exist. A single zero-dependency `node:test` file covering `getFormattedString`, the timestamp regex, and the (future) ms heuristic would cover most of the logic that can actually regress.
- **Git hygiene:** `.web-extension-id` is tracked despite the `.web-ext-*` ignore rule (committed before the rule, presumably) — `git rm --cached .web-extension-id`. Also confirm `.web-ext-config.mjs` never grows AMO credentials, since it lives at repo root; it's correctly ignored today.
- **Dead weight in `popup/timepeek.html`:** the commented-out Day.js format-docs link (lines 50-55) — restoring it is the better move; it's genuinely useful for users editing the format string.
- **`gen-manifest.mjs:42-46`:** the explicit `background`/`action` re-assignments after `deepMerge` are redundant — the merge already gives overrides precedence. Harmless, but it reads like the merge can't be trusted.

## Structural: replace Day.js with native `Intl.DateTimeFormat`

*(Originally set aside as a breaking config change; reconsidered — with a single user there's nothing to break, and the payoff cascades.)*

The Day.js timezone plugin is itself built on `Intl.DateTimeFormat`, so all IANA zone math already runs through Intl; Day.js is just a wrapper. Removing it cascades:

1. **Day.js + utc + timezone plugins deleted** (`vendor/dayjs.js`, `vendor/utc.js`, `vendor/timezone.js`).
2. **Rollup deleted.** `rollup.config.mjs`, `background.sw.entry.js`, and the rollup devDependency exist solely to bundle vendor UMD scripts into the Chrome MV3 service worker. No vendor libs → `build:chrome` is just `gen-manifest.mjs`.
3. **Polyfill likely deleted too.** Chrome MV3's `chrome.storage` / `chrome.runtime.sendMessage` are natively promise-based; a one-line shim (`const api = globalThis.browser ?? chrome;`) replaces `browser-polyfill.min.js`. Then `vendor/` is empty.

End state: the build is a manifest merge plus file copy, `devDependencies` is empty, and every shipped line of JS is project code.

**Cost:** `Intl.DateTimeFormat` takes an options object, not a format string, so keeping the `ddd MMM DD YYYY HH:mm:ss ZZ` config requires a small token formatter over `formatToParts()` — ~50–80 lines in `formatter.js` mapping the tokens actually in use (`YYYY`, `MM`, `DD`, `ddd`, `MMM`, `HH`, `mm`, `ss`, `ZZ`, plus obvious siblings). Stored settings don't change.

**Migration plan:** write unit tests asserting current Day.js output first, then swap the implementation and keep the tests green. Verify output parity on two points: `ZZ` (derive `-0500` from `timeZoneName: 'longOffset'` parts) and pinning the locale (`en-US`) so `ddd`/`MMM` don't drift with browser locale.

## Open questions

1. **Firefox MV3 migration** — do it now, or keep MV2 until AMO forces the issue?
2. **`storage.sync` vs `storage.local`** — settings currently don't roam across synced browsers. Switching is trivial, and with a single user the one-time settings "reset" on switch is a non-issue. Preference?
3. **Millisecond timestamps** — is auto-detecting them (≥ 1e12 → ms) desired behavior, or is seconds-only deliberate?

---

# Implementation plan

## Context

The review above found the extension healthy but flagged perf, permission, and correctness issues, plus a structural opportunity: since the sole user is the author, Day.js can be replaced with a native `Intl.DateTimeFormat`-based formatter — cascading into deleting Rollup and the browser polyfill, reducing the build to a manifest merge + file copy with zero dependencies. All four scope questions were confirmed: migrate Firefox to MV3, auto-detect ms/µs timestamps, switch to `storage.sync`, harden the tooltip.

Design for the formatter/loading slice was validated empirically (vendored Day.js 1.11.13 vs Node 24 Intl/V8): token semantics, offset rendering, h23 midnight, invalid-date/tz behavior, and Day.js's literal-corruption quirk were all verified, not assumed.

Sequencing principle: characterization tests lock in Day.js output **before** the swap; they stay green throughout.

## Phase 0 — Characterization tests (before any behavior change)

- `test/golden.test.mjs` (zero-dep `node:test`): matrix of **committed literal golden strings** — not dual-run comparisons — so the suite survives Day.js deletion unchanged. Temporary impl switch: `TIMEPEEK_IMPL=dayjs` loads vendor dayjs+plugins via `createRequire` (`vendor/dayjs.js` is UMD, `require()`-able; `scripts/formatter.js` already has `module.exports`); default loads the new implementation.
- Matrix (all historical timestamps so TZDB drift can't flip them): default format at Etc/UTC (region on/off); all-tokens kitchen sink at America/New_York; negative ts; DST spring-forward and fall-back pairs (NY); Asia/Kolkata `+0530`; Asia/Kathmandu `+0545`; Australia/Sydney; midnight/noon `HH hh A a` (h23: midnight = `00`); escaped literal `[at]`; **unescaped literal quirk** (`'HH:mm at a'` → `amt am` — Day.js corrupts it; we replicate for parity); fractional seconds `.SSS`; multi-word region (`Buenos Aires`); invalid date → `"Invalid Date - New York"`; invalid tz → `assert.throws(RangeError)`.
- `test/formatter.test.mjs`: new-behavior units — `timestampToDate` boundaries (`1e12-1` sec / `1e12` ms / `1e15` µs; same instant across encodings), non-finite → Invalid Date, documented `Y`/`YYY` divergence (Day.js renders these as the offset — a bug we intentionally don't replicate).
- package.json: `"test": "node --test test/"`. Verify: `TIMEPEEK_IMPL=dayjs node --test test/` green proves goldens capture reality.

## Phase 1 — Behavioral quick wins

**scripts/content.js**
- Reorder `handleEvent`: bail on `!(e.ctrlKey || e.metaKey)` and regex mismatch **before** `sendMessage` — stops waking the SW on every mouseup on every page/frame.
- Error path (line 23): stop rendering caught exceptions into the tooltip; fail silently.
- `getSelectedText`: restrict input-selection reading to text/textarea/search (or try/catch — `selectionStart` throws on email/number inputs); delete IE-only `document.selection` branch.
- Drop reliance on the vestigial `fetchedIn` field; key off `textContent` presence.

**scripts/background.js** — ms/µs heuristic via `timestampToDate` (Phase 2); remove `fetchedIn`; empty-timezones fallback = `Etc/UTC` (shared with popup).

**popup/timepeek.js** — delete the 3×get/3×set default-seeding block; single `storage.get({format: DEFAULT_FORMAT, timezones: DEFAULT_TIMEZONES, includeRegion: true})` with defaults. Clearing format input → `storage.remove('format')`, not `set({format: null})`. Preview empty-tz fallback = `Etc/UTC`.

**popup/timepeek.html** — restore the commented-out Day.js format-docs link (token syntax stays valid post-swap).

## Phase 2 — Day.js → Intl formatter; delete Rollup + polyfill

**Rewrite `scripts/formatter.js`** (stays a plain classic script: loaded by Chrome SW via `importScripts`, Firefox event page via `background.scripts`, popup via `<script>`, Node via `require`):
- `getFormattedString(date /* Date */, tz, format, includeRegion = true)` + new `timestampToDate(n)` (≥1e15 → µs, ≥1e12 → ms, else seconds; fractional seconds preserved; non-finite → `new Date(NaN)`).
- Tokenizer: single-pass replace with one alternation regex replicating Day.js semantics exactly (including `[literal]` escapes and the greedy-`a` quirk):
  `/\[([^\]]+)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|ZZ|Z|A|a/g` — do NOT build a "smarter" word-boundary tokenizer; parity is the requirement. Unmatched letters pass through verbatim (matches Day.js).
- One `Intl.DateTimeFormat` per tz cached in a module-level Map (popup preview fires per keystroke): locale pinned `'en-US'`, `hourCycle: 'h23'` (h24 renders midnight as "24"), `timeZoneName: 'longOffset'`, 2-digit fields; `timeZone: undefined` → system zone (matches current preview behavior).
- Month/weekday names (`MMMM/MMM/dddd/ddd/dd`) from static en-US tables indexed by Intl parts; `hh/h/A/a` computed from H; `SSS` = `((date.getTime() % 1000) + 1000) % 1000` padded (tz-independent, pre-1970 safe).
- ZZ/Z transform, robust to engine variance (`"GMT-05:00"`, bare `"GMT"`, U+2212 minus): `raw.match(/([+−-])(\d{1,2}):?(\d{2})/)` → normalize; no match → `+00:00`. UTC yields `+0000`.
- Invalid date → literal `'Invalid Date'` + region suffix (byte-identical to Day.js); invalid tz → let Intl's `RangeError` propagate (background catch already maps it; identical message on V8).
- Keep `globalThis` attach + `module.exports = getFormattedString; module.exports.timestampToDate = timestampToDate`.

**Rewrite `scripts/background.js`:**
- Top: `const api = globalThis.browser ?? globalThis.chrome;` and guarded load — `if (typeof importScripts === 'function') importScripts('./formatter.js');` (Chrome classic SW; must run during initial synchronous evaluation. Firefox event pages have no `importScripts` — formatter comes from `background.scripts`).
- **Critical:** raw `chrome.runtime.onMessage` ignores returned promises (that was a polyfill semantic). Use callback pattern: `addListener((msg, sender, sendResponse) => { handleMessage(msg).then(sendResponse, () => sendResponse({textContent: null})); return true; })`.
- Format via `formatFn(timestampToDate(parseFloat(text)), tz, format, includeRegion)`.

**Deletions:** `vendor/` (dayjs.js, utc.js, timezone.js, browser-polyfill.min.js + .map), `rollup.config.mjs`, `scripts/background.sw.entry.js`, rollup devDependency. `build:chrome` → just `gen-manifest.mjs chrome`. Popup HTML drops dayjs/plugins/polyfill `<script>` tags (keeps formatter.js + timepeek.js); popup JS drops `dayjs.extend` lines, preview uses `getFormattedString(new Date(), ...)`. content.js and popup get the same one-line `api` shim (Chrome MV3 `runtime.sendMessage`/`storage` are natively promise-based).

**After swap green:** delete the `loadLegacy`/env branch from the golden test; goldens unchanged.

## Phase 3 — Manifests: Firefox MV3, permission trim, storage.sync

- `manifest.chrome.json`: permissions → `["storage"]` (drop unused `activeTab`; drop `host_permissions` — manifest `content_scripts.matches` alone grants injection in Chrome). `service_worker: "scripts/background.js"` unchanged, classic (no `"type"`).
- `manifest.firefox.json` → MV3: `manifest_version: 3`, `browser_action` → `action`, `background.scripts: ["scripts/formatter.js", "scripts/background.js"]` (event page — Firefox doesn't reliably support `service_worker`; no `persistent` key), keep gecko id, add `strict_min_version: "115.0"`, permissions → `["storage"]`.
- **Firefox MV3 pitfall (top risk of the whole change):** host permissions are opt-in in Firefox MV3 — without a granted `<all_urls>` the content script silently never injects. So Firefox **keeps** `host_permissions: ["<all_urls>"]`, and the popup gains a guard: on load, `api.permissions.contains({origins: ['<all_urls>']})`; if false, show a "Grant page access" button calling `api.permissions.request(...)` (user gesture required — the click qualifies). Verify grant behavior live with `web-ext run` before shipping.
- `manifest.base.json`: `content_scripts[0].js` → `["scripts/content.js"]` (polyfill removed); move shared `action` block here now that both targets are MV3.
- **storage.sync:** all `storage.local` call sites (6 in popup, 1 in background) → `storage.sync`, with a small one-time migration helper shared by background/popup: read sync → if empty, read local → if present, copy to sync.
- `scripts/gen-manifest.mjs`: inject `version` from package.json (single source; delete from manifest.base.json); remove redundant post-merge `background`/`action` re-assignments; add `test`, `review-proj-fable.md` to the exclude set; stop copying `gen-manifest.mjs` itself into dist (pre-existing wart).

## Phase 4 — Tooltip hardening (content.js)

- Render tooltip inside a shadow root: host div (with a class for Escape-to-close targeting) appended to body; styles as a `<style>` inside the shadow root. Delete `main.css` and the `css` entry from `content_scripts`.
- Clamp position to viewport after measuring (pull left / flip above cursor near right/bottom edges).

## Phase 5 — CI, hygiene, docs

- `.github/workflows/build.yml`: `npm ci`; add `npm test` step; add `npx web-ext lint -s dist/firefox` after build.
- `git rm --cached .web-extension-id`.
- README: no rollup, no vendor dir, both targets MV3; update layout/build sections. Delete stale MV2 gotchas.
- Bump version to 1.8.0 in package.json (now the single source).

## Verification

1. `TIMEPEEK_IMPL=dayjs node --test test/` green (Phase 0, pre-swap) → `npm test` green (post-swap) — the core safety net.
2. `npm run build:firefox && npx web-ext lint -s dist/firefox` — zero errors on the MV3 manifest.
3. `npm run build:chrome`; load `dist/chrome` unpacked — SW console shows clean `importScripts`; ctrl/cmd+click on a 10-digit timestamp shows tooltip; 13-digit shows the same instant (ms detection); popup preview updates per keystroke and matches tooltip output.
4. `web-ext run -s dist/firefox` — event page loads; **confirm `<all_urls>` host permission is actually granted** (the top Firefox risk; exercise the popup grant button if not); tooltip works.
5. Regression smoke: Escape closes tooltips; tooltip stays on-screen near window edges; plain clicks leave the SW asleep (SW inspector); settings roam via sync — seed `storage.local` first to confirm the one-time local→sync migration; extension installs with only the `storage` permission.

---

# Appendix A — Execution notes for the implementing model

Read these before writing any code. They are constraints, not suggestions.

1. **Parity beats quality.** The new formatter must reproduce Day.js output byte-for-byte for every stored user format, *including Day.js bugs*: the greedy tokenizer corrupts unescaped literals (`'HH:mm at a'` → `"... amt am"`). Replicate this. Do NOT build a word-boundary-aware tokenizer, do NOT "fix" quirks the goldens lock in. The only sanctioned divergence: bare `Y`/`YYY` tokens (Day.js renders them as the UTC offset — a bug we drop; they're excluded from goldens and covered by a unit test documenting the new pass-through behavior).
2. **Goldens are machine-generated, never hand-written.** Generate `test/goldens.json` by running the matrix through the *real vendored Day.js* (`node test/gen-goldens.mjs`, Appendix B). If a golden looks wrong, the generator or matrix is wrong — never edit `goldens.json` by hand. Commit it.
3. **Phase order is load-bearing.** Tests (Phase 0) must be green against Day.js *before* the formatter swap (Phase 2). Run `npm test` after every phase; a red suite means stop and fix, not adjust goldens.
4. **Scope discipline.** Do not reformat untouched code, do not touch `dist/` (generated), do not rename public message fields beyond removing `fetchedIn`, do not add dependencies. The end state has an empty `devDependencies`.
5. **The `onMessage` listener must use the callback + `return true` pattern** (Appendix B). Returning a promise from the listener silently breaks on raw `chrome.*` — this is the polyfill semantic we're removing.
6. **`importScripts` guard placement matters**: it must execute during the service worker's initial synchronous evaluation — first statement in `background.js`, not inside any function or event handler.
7. After each phase, checkpoint: `npm test`, `npm run build:firefox`, `npm run build:chrome` all succeed.

# Appendix B — Reference implementations and exact file targets

Code below is the intended implementation. Deviate only where it demonstrably fails a golden.

## B1. `scripts/formatter.js` (complete rewrite)

```js
// Formats dates for Timepeek. Deliberately a plain classic script: loaded by
// the Chrome MV3 service worker via importScripts, by the Firefox event page
// via the manifest background.scripts array, by the popup via <script src>,
// and by Node tests via require.

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WEEKDAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// DTF construction is expensive and the popup preview formats per keystroke.
const dtfCache = new Map();
function getDtf(tz) {
  const key = tz || '';
  let dtf = dtfCache.get(key);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, // undefined → system zone (popup preview with no tz)
      weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', // h24 would render midnight as "24"
      timeZoneName: 'longOffset',
    });
    dtfCache.set(key, dtf);
  }
  return dtf;
}

// Mirrors Day.js's own format regex (longest-first per letter, [] escapes).
// Its greedy matching inside literal words is a Day.js compatibility
// requirement locked in by the golden tests.
const TOKEN_RE = /\[([^\]]+)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|ZZ|Z|A|a/g;

function buildFields(date, tz) {
  const parts = {};
  for (const p of getDtf(tz).formatToParts(date)) parts[p.type] = p.value;

  const H = Number(parts.hour);
  const monthIdx = Number(parts.month) - 1;
  const weekdayIdx = WEEKDAYS_SHORT.indexOf(parts.weekday);
  const h12 = H % 12 === 0 ? 12 : H % 12;

  // timeZoneName is "GMT-05:00" / "GMT+00:00", bare "GMT" on some engines,
  // and some ICUs use U+2212 minus. UTC must come out as +00:00.
  const m = (parts.timeZoneName || '').match(/([+−-])(\d{1,2}):?(\d{2})/);
  const Z = m ? `${m[1] === '−' ? '-' : m[1]}${m[2].padStart(2, '0')}:${m[3]}` : '+00:00';

  return {
    YYYY: parts.year, YY: parts.year.slice(-2),
    MMMM: MONTHS_LONG[monthIdx], MMM: MONTHS_SHORT[monthIdx],
    MM: parts.month, M: String(Number(parts.month)),
    DD: parts.day, D: String(Number(parts.day)),
    dddd: WEEKDAYS_LONG[weekdayIdx], ddd: parts.weekday,
    dd: parts.weekday.slice(0, 2), d: String(weekdayIdx),
    HH: parts.hour, H: String(H),
    hh: String(h12).padStart(2, '0'), h: String(h12),
    mm: parts.minute, m: String(Number(parts.minute)),
    ss: parts.second, s: String(Number(parts.second)),
    SSS: String(((date.getTime() % 1000) + 1000) % 1000).padStart(3, '0'),
    A: H < 12 ? 'AM' : 'PM', a: H < 12 ? 'am' : 'pm',
    Z, ZZ: Z.replace(':', ''),
  };
}

function getFormattedString(date, tz, format, includeRegion = true) {
  let formatted;
  if (isNaN(date.getTime())) {
    formatted = 'Invalid Date'; // Day.js parity, region suffix still applies
  } else {
    const fields = buildFields(date, tz); // throws RangeError on bad tz, like Day.js
    formatted = format.replace(TOKEN_RE, (match, literal) =>
      literal !== undefined ? literal : fields[match]);
  }
  if (tz && includeRegion) {
    formatted += ' - ' + tz.split('/').pop().replace(/_/g, ' ');
  }
  return formatted;
}

function timestampToDate(n) {
  if (!Number.isFinite(n)) return new Date(NaN);
  if (n >= 1e15) return new Date(n / 1000); // microseconds
  if (n >= 1e12) return new Date(n);        // milliseconds
  return new Date(n * 1000);                // seconds; fractional preserved
}

const globalScope = typeof globalThis !== 'undefined' ? globalThis : self;
globalScope.getFormattedString = getFormattedString;
globalScope.timestampToDate = timestampToDate;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = getFormattedString;
  module.exports.timestampToDate = timestampToDate;
}
```

## B2. `scripts/background.js` (complete rewrite)

```js
// Chrome MV3 classic service worker pulls the formatter in via importScripts,
// which must run during initial synchronous evaluation. Firefox MV3 event
// pages have no importScripts; there formatter.js loads first via the
// manifest background.scripts array.
if (typeof importScripts === 'function') {
  importScripts('./formatter.js');
}

const api = globalThis.browser ?? globalThis.chrome;

const DEFAULT_SETTINGS = {
  format: 'ddd MMM DD YYYY HH:mm:ss ZZ',
  timezones: ['Etc/UTC'],
  includeRegion: true,
};

// Reads storage.sync, migrating pre-1.8 storage.local settings once.
// (Duplicated in popup/timepeek.js — no shared module pathway without a build step.)
async function getSettings() {
  let s = await api.storage.sync.get(['format', 'timezones', 'includeRegion']);
  if (Object.keys(s).length === 0) {
    const local = await api.storage.local.get(['format', 'timezones', 'includeRegion']);
    if (Object.keys(local).length) {
      await api.storage.sync.set(local);
      s = local;
    }
  }
  return { ...DEFAULT_SETTINGS, ...s };
}

async function handleMessage(message) {
  if (message.action !== 'formatDate' || !message.text) return { textContent: null };
  const settings = await getSettings();
  const timezones = settings.timezones.length ? settings.timezones : DEFAULT_SETTINGS.timezones;
  const date = timestampToDate(parseFloat(message.text));
  try {
    const textContent = timezones
      .map(tz => getFormattedString(date, tz, settings.format || DEFAULT_SETTINGS.format, settings.includeRegion))
      .join('\n');
    return { textContent };
  } catch {
    return { textContent: null }; // e.g. invalid tz — fail silently
  }
}

// Callback pattern, NOT a returned promise: raw chrome.runtime.onMessage
// ignores promise returns (that was polyfill behavior).
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse, () => sendResponse({ textContent: null }));
  return true; // keep the channel open for the async response
});
```

## B3. `scripts/content.js` — target shapes

Top of file: `const api = globalThis.browser ?? globalThis.chrome;`

New `handleEvent` control flow (bail order is the point — nothing async before all three gates):

```js
async function handleEvent(e) {
  if (!(e.ctrlKey || e.metaKey)) return;

  let text = normalizeTimestamp(getSelectedText());
  if (!text && lastTimestampSelection.text &&
      Date.now() - lastTimestampSelection.updatedAt < 2000) {
    text = lastTimestampSelection.text;
  }
  if (!TIMESTAMP_REGEX.test(text)) return;

  let response;
  try {
    response = await api.runtime.sendMessage({ action: 'formatDate', text });
  } catch {
    return; // background unreachable (extension reloaded) — never render errors
  }
  if (!response || !response.textContent) return;

  lastTimestampSelection = { text: '', updatedAt: 0 };
  showTooltip(response.textContent, e.clientX, e.clientY);
}
```

Hardened selection reading (replaces both the `activeElement.value` branch and the IE `document.selection` branch, which is deleted):

```js
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'password']);

function getSelectedText() {
  const el = document.activeElement;
  // selectionStart throws on email/number inputs; only touch selectable types.
  if (el && (el.tagName === 'TEXTAREA' ||
      (el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(el.type)))) {
    return el.value.substring(el.selectionStart, el.selectionEnd).trim();
  }
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}
```

Shadow-root tooltip (`main.css` rules move into `TOOLTIP_CSS`; `main.css` and the manifest `css` entry are then deleted). Clamp after appending so measurements are real:

```js
const TOOLTIP_CSS = `/* former main.css rules: .timepeek-base, .timepeek-date, .timepeek-icon */`;

function showTooltip(textContent, x, y) {
  const host = document.createElement('div');
  host.className = 'timepeek-host'; // Escape handler targets this
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = TOOLTIP_CSS;
  root.appendChild(style);

  // build .timepeek-base div with close span + date <p> exactly as today,
  // but append into `root` instead of document.body
  document.body.appendChild(host);

  // Clamp to viewport: measure, then pull left of the right edge and flip
  // above the cursor if the bottom would overflow.
  const rect = div.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = (y + 30 + rect.height > window.innerHeight) ? y - rect.height - 8 : y + 30;
  div.style.left = `${Math.max(left, 0)}px`;
  div.style.top = `${Math.max(top, 0)}px`;
}
```

Escape handler now removes hosts: `document.querySelectorAll('.timepeek-host').forEach(n => n.remove())`. The close-icon click removes `host`, not `div`.

## B4. Manifests — exact target contents

`manifest.base.json` (no `version` — injected from package.json; `css` entry gone after Phase 4):

```json
{
  "name": "Timepeek",
  "short_name": "Timepeek",
  "description": "Hover over any Unix timestamp to display a human-readable date and time.",
  "homepage_url": "https://github.com/stvsmth/extension-timepeek",
  "author": "stvsmth",
  "manifest_version": 3,
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["scripts/content.js"],
      "all_frames": true
    }
  ],
  "action": {
    "default_icon": "icons/timepeek-48.png",
    "default_popup": "popup/timepeek.html",
    "default_title": "Timepeek"
  },
  "icons": {
    "16": "icons/timepeek-16.png",
    "48": "icons/timepeek-48.png",
    "128": "icons/timepeek-128.png"
  }
}
```

`manifest.chrome.json` (shrinks to just the background override — no host_permissions, no activeTab):

```json
{
  "background": { "service_worker": "scripts/background.js" }
}
```

`manifest.firefox.json` (keeps host_permissions — Firefox MV3 host access is opt-in and without it the content script silently never injects):

```json
{
  "host_permissions": ["<all_urls>"],
  "background": {
    "scripts": ["scripts/formatter.js", "scripts/background.js"]
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "{ed14e330-6c75-483f-8ddc-72987c4a5162}",
      "strict_min_version": "115.0"
    }
  }
}
```

`scripts/gen-manifest.mjs` changes: after merging, `merged.version = readJson(path.join(root, 'package.json')).version;` — and extend the exclude set with `'test'`, `'review-proj-fable.md'`, `'gen-manifest.mjs'` (stops shipping the build script itself, a pre-existing wart visible in `dist/chrome/scripts/`).

## B5. Popup — target changes

`popup/timepeek.html`: delete the `browser-polyfill`/`dayjs`/`utc`/`timezone` script tags (keep `formatter.js` + `timepeek.js`); un-comment the Day.js format-docs link; add (hidden by default) below the settings:

```html
<button id="timepeek-grant" class="dn">Grant page access</button>
```

`popup/timepeek.js`:
- `const api = globalThis.browser ?? globalThis.chrome;`; delete both `dayjs.extend` lines.
- Replace the three-get/three-set seeding block with the same `getSettings()` helper as background (sync + one-time local migration), then merge defaults — no writes on load.
- All `storage.local.set` call sites → `storage.sync.set`; clearing the format input calls `api.storage.sync.remove('format')` instead of `set({ format: null })`.
- Preview: `getFormattedString(new Date(), currentTzs[0] ?? 'Etc/UTC', format, includeRegionCheckbox.checked)` — the `Etc/UTC` fallback matches the background so preview and tooltip can't diverge.
- Firefox host-permission guard (harmless no-op on Chrome, where the manifest grant is automatic):

```js
const grantBtn = document.getElementById('timepeek-grant');
if (api.permissions?.contains) {
  const granted = await api.permissions.contains({ origins: ['<all_urls>'] });
  if (!granted) {
    grantBtn.classList.remove('dn');
    grantBtn.addEventListener('click', async () => {
      // permissions.request must run in a user gesture; this click qualifies
      if (await api.permissions.request({ origins: ['<all_urls>'] })) {
        grantBtn.classList.add('dn');
      }
    });
  }
}
```

## B6. Test scaffolding — golden generation procedure

Three files. Goldens flow one way: Day.js → `goldens.json` → assertions.

`test/matrix.mjs` — exports the case list (id, ts, tz, format, includeRegion) from the Phase 0 table. Shared by generator and test.

`test/gen-goldens.mjs` — runs ONLY against vendored Day.js; writes `test/goldens.json`:

```js
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { MATRIX } from './matrix.mjs';
const require = createRequire(import.meta.url);

globalThis.dayjs = require('../vendor/dayjs.js');
globalThis.dayjs.extend(require('../vendor/utc.js'));
globalThis.dayjs.extend(require('../vendor/timezone.js'));
const legacyFormat = require('../scripts/formatter.js');

const goldens = {};
for (const c of MATRIX) {
  goldens[c.id] = legacyFormat(globalThis.dayjs.unix(c.ts), c.tz, c.format, c.includeRegion);
}
writeFileSync(new URL('./goldens.json', import.meta.url), JSON.stringify(goldens, null, 2));
```

`test/golden.test.mjs` — loads `goldens.json`, runs every case through the CURRENT `scripts/formatter.js` (as `fmt(new Date(c.ts * 1000), c.tz, c.format, c.includeRegion)`), asserts equality. Plus `assert.throws(() => fmt(new Date(0), 'Nope/Zip', 'YYYY'), RangeError)` and the invalid-date case (`new Date(NaN)` → `"Invalid Date - New York"`).

Sequence: (1) write matrix + generator while Day.js still exists, run generator, commit `goldens.json`; (2) sanity-run the test file against a thin dayjs-backed wrapper (or eyeball 2–3 goldens) to prove the harness; (3) after the Phase 2 rewrite, `npm test` must pass against the same committed goldens; (4) when Day.js is deleted, delete `gen-goldens.mjs` too — `goldens.json` remains as the frozen contract.

`test/formatter.test.mjs` (new-behavior units, no goldens): `timestampToDate` boundaries (`1e12 - 1` → seconds, `1e12` → ms, `1e15` → µs; `1719855045`, `1719855045000`, `1719855045000000` all → same `getTime()`), non-finite → `NaN` date, `Y`/`YYY` pass-through divergence, DTF cache returns the same instance for repeated tz.

`package.json`: `"test": "node --test test/"`. CI: `npm ci` → `npm test` → builds → `npx web-ext lint -s dist/firefox`.
