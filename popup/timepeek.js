dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);

const DEFAULT_FORMAT = 'ddd MMM DD YYYY HH:mm:ss ZZ'

document.addEventListener('DOMContentLoaded', async () => {


  // Set default settings if they do not exist.
  let format = await browser.storage.local.get('format');
  if (!Object.keys(format).length) {
    await browser.storage.local.set({ format: DEFAULT_FORMAT });
  }
  let timezones = await browser.storage.local.get('timezones');
  if (!Object.keys(timezones).length) {
    await browser.storage.local.set({ timezones: ['America/New_York'] });
  }

  // Load the browser storage.
  let settings = await browser.storage.local.get();

  // Get all the timezones.
  const allTimezones = Intl.supportedValuesOf('timeZone');

  // Create a data list for the timezones.
  let dataList = document.getElementById('timezones');
  for (let i = 0; i < allTimezones.length; i++) {
    let option = document.createElement('option');
    option.value = allTimezones[i];
    option.text = allTimezones[i];
    dataList.appendChild(option);
  }

  // Set the input for format.
  let formatInput = document.getElementById('timepeek-format');
  if (settings.hasOwnProperty('format') && settings.format) {
    formatInput.value = settings.format;
  }

  // Set the input for timezones.
  let timezonesInput = document.getElementById('timepeek-timezones');
  if (settings.hasOwnProperty('timezones') && settings.timezones) {
    timezonesInput.value = settings.timezones.join(', ');
    firstTz = settings.timezones[0];
  } else {
    timezonesInput.value = 'America/New_York';
    firstTz = timezonesInput.value;
  }

  // Initialize format preview
  let previewFormat = document.getElementById('timepeek-preview');
  previewFormat.value = dayjs().tz(firstTz).format(settings.format || DEFAULT_FORMAT);

  // Set the event listener for the format input
  formatInput.addEventListener('input', async () => {
    if (!formatInput.value) {
      await browser.storage.local.set({ format: null });
      return;
    }
    await browser.storage.local.set({ format: formatInput.value });
    previewFormat.value = dayjs().tz(firstTz).format(formatInput.value);
  });

  // Set the event listener for the timezones input.
  timezonesInput.addEventListener('input', async () => {
    if (!timezonesInput.value) {
      await browser.storage.local.set({ timezones: null, timezones: [] });
      return;
    }

    const entries = timezonesInput.value
      .split(',')
      .map(v => v.trim())
      .filter(v => v);
    const timezones = [];
    for (const entry of entries) {
      const matchTz = allTimezones.find(tz => tz.toLowerCase() === entry.toLowerCase());
      if (matchTz) {
        timezones.push(matchTz);
      }
    }
    if (timezones.length) {
      await browser.storage.local.set({ timezones: timezones });
      previewFormat.value = dayjs().tz(timezones[0]).format(formatInput.value);
    }
  });

  // Set the loading to false (add dn to loading, remove dn from content).
  let loading = document.querySelector('.loading');
  let content = document.querySelector('.content');

  loading.classList.add('dn');
  content.classList.remove('dn');
});
