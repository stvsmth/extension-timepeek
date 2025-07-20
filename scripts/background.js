dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);

async function handleMessage(message) {
  if (message.action === 'formatDate' && message.text) {
    let settings = await browser.storage.local.get(['format', 'timezones']);

    const format = settings.format || 'ddd MMM DD YYYY HH:mm:ss ZZ';
    const timezones = settings.timezones && settings.timezones.length ? settings.timezones : ['America/New_York'];
    const timestamp = parseFloat(message.text);

    try {
      const dateStr = timezones.map(tz => {
        return dayjs.unix(timestamp).tz(tz).format(format);
      }).join('\n');
      return Promise.resolve({ textContent: dateStr, fetchedIn: 'seconds' });
    } catch (e) {
      return Promise.resolve({ textContent: e.message, fetchedIn: null });
    }
  }
}
browser.runtime.onMessage.addListener(handleMessage);
