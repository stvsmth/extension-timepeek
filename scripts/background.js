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
