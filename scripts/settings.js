// Shared settings access for the popup and background — loaded, like
// formatter.js, as a plain classic script by the popup (<script src>), the
// Firefox event page (manifest background.scripts), and the Chrome service
// worker (importScripts). The content script never touches settings.

const api = globalThis.browser ?? globalThis.chrome;

const DEFAULT_SETTINGS = {
  format: 'ddd MMM DD YYYY HH:mm:ss ZZ',
  timezones: ['Etc/UTC'],
  includeRegion: true,
};

// Settings change only through the popup; serve repeat reads (one per
// tooltip in the background) from memory and invalidate on any write.
let settingsCache = null;
api.storage.onChanged.addListener(() => { settingsCache = null; });

// Returns fully-defaulted, normalized settings: format is never empty and
// timezones is never an empty list, so callers use the values directly.
async function getSettings() {
  if (!settingsCache) {
    const stored = await api.storage.sync.get(['format', 'timezones', 'includeRegion']);
    const s = { ...DEFAULT_SETTINGS, ...stored };
    if (!s.format) s.format = DEFAULT_SETTINGS.format;
    if (!Array.isArray(s.timezones) || !s.timezones.length) s.timezones = DEFAULT_SETTINGS.timezones;
    settingsCache = s;
  }
  return settingsCache;
}
