dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);

const DEFAULT_FORMAT = 'ddd MMM DD YYYY HH:mm:ss ZZ'
const DEFAULT_TIMEZONES = ['America/New_York'];

document.addEventListener('DOMContentLoaded', async () => {

  // Set default settings if they do not exist.
  let format = await browser.storage.local.get('format');
  if (!Object.keys(format).length) {
    await browser.storage.local.set({ format: DEFAULT_FORMAT });
  }
  let timezones = await browser.storage.local.get('timezones');
  if (!Object.keys(timezones).length) {
    await browser.storage.local.set({ timezones: DEFAULT_TIMEZONES });
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

  // Timezones management
  const timezonesContainer = document.getElementById('timezones-container');
  const timezonesInput = document.getElementById('timepeek-timezones-input');
  const previewFormat = document.getElementById('timepeek-preview');
  let currentTzs = settings.timezones;

  const updatePreview = () => {
    const format = formatInput.value || DEFAULT_FORMAT;
    const tz = currentTzs[0]; // defaults to system TZ if undefined
    previewFormat.value = dayjs().tz(tz).format(format);
  };

  const createTag = (timezone) => {
    const tag = document.createElement('span');
    tag.className = 'timezone-tag';
    tag.textContent = timezone;

    const removeBtn = document.createElement('span');
    removeBtn.textContent = ' \u00d7'; // multiplication sign
    removeBtn.className = 'remove-tag';
    removeBtn.style.cursor = 'pointer';

    removeBtn.addEventListener('click', async () => {
      currentTzs = currentTzs.filter(t => t !== timezone);
      await browser.storage.local.set({ timezones: currentTzs });
      renderTags();
    });

    tag.appendChild(removeBtn);
    return tag;
  };

  const renderTags = () => {
    // Clear existing tags
    timezonesContainer.querySelectorAll('.timezone-tag').forEach(tag => tag.remove());
    // Render new tags
    currentTzs.forEach(tz => {
      const tag = createTag(tz);
      timezonesContainer.insertBefore(tag, timezonesInput);
    });
    updatePreview();
  };

  // Set the event listener for the format input
  formatInput.addEventListener('input', async () => {
    await browser.storage.local.set({ format: formatInput.value || null });
    updatePreview();
  });

  // Set the event listener for the timezones input.
  timezonesInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && timezonesInput.value) {
      e.preventDefault();
      const entry = timezonesInput.value.trim();
      const matchTz = allTimezones.find(tz => tz.toLowerCase() === entry.toLowerCase());

      if (matchTz && !currentTzs.includes(matchTz)) {
        currentTzs.push(matchTz);
        await browser.storage.local.set({ timezones: currentTzs });
        renderTags();
      }
      timezonesInput.value = '';
    }
  });

  renderTags();

  // Set the loading to false (add dn to loading, remove dn from content).
  let loading = document.querySelector('.loading');
  let content = document.querySelector('.content');

  loading.classList.add('dn');
  content.classList.remove('dn');
});
