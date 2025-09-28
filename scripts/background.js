// In Manifest V2, dependencies are loaded via manifest scripts array for both Firefox and Chrome
// Register Day.js plugins in global scope.
if (typeof dayjs !== 'undefined') {
  dayjs.extend(globalThis.dayjs_plugin_utc);
  dayjs.extend(globalThis.dayjs_plugin_timezone);
}

async function handleMessage(message) {
  if (message.action === 'formatDate' && message.text) {
    let settings = await browser.storage.local.get(['format', 'timezones', 'includeRegion']);

    const format = settings.format || 'ddd MMM DD YYYY HH:mm:ss ZZ';
    const timezones = settings.timezones && settings.timezones.length ? settings.timezones : ['Etc/UTC'];
    const includeRegion = settings.hasOwnProperty('includeRegion') ? settings.includeRegion : true;
    const timestamp = parseFloat(message.text);
    const formatFn = (typeof globalThis !== 'undefined' && globalThis.getFormattedString) ||
      (typeof getFormattedString !== 'undefined' && getFormattedString);
    if (!formatFn) {
      throw new Error('Formatter unavailable');
    }

    try {
      const dateStr = timezones
        .map(tz => formatFn(dayjs.unix(timestamp), tz, format, includeRegion))
        .join('\n');
      return Promise.resolve({ textContent: dateStr, fetchedIn: 'seconds' });
    } catch (e) {
      return Promise.resolve({ textContent: e.message, fetchedIn: null });
    }
  }
}
browser.runtime.onMessage.addListener(handleMessage);
