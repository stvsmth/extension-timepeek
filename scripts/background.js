// Chrome MV3 classic service worker pulls its dependencies in via
// importScripts, which must run during initial synchronous evaluation.
// Firefox MV3 event pages have no importScripts; there formatter.js and
// settings.js load first via the manifest background.scripts array.
if (typeof importScripts === 'function') {
  importScripts('./formatter.js', './settings.js');
}

// One-time pre-1.8 migration: settings used to live in storage.local.
// Runs at install/update so per-message reads stay a single sync.get.
api.runtime.onInstalled.addListener(async () => {
  const sync = await api.storage.sync.get(['format', 'timezones', 'includeRegion']);
  if (Object.keys(sync).length) return;
  const local = await api.storage.local.get(['format', 'timezones', 'includeRegion']);
  if (Object.keys(local).length) await api.storage.sync.set(local);
});

async function handleMessage(message) {
  if (message.action !== 'formatDate' || !message.text) return { textContent: null };
  const settings = await getSettings();
  const date = timestampToDate(parseFloat(message.text));
  try {
    const textContent = settings.timezones
      .map(tz => getFormattedString(date, tz, settings.format, settings.includeRegion))
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
