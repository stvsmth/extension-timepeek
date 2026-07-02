const api = globalThis.browser ?? globalThis.chrome;

const DEFAULT_FORMAT = 'ddd MMM DD YYYY HH:mm:ss ZZ'
const DEFAULT_TIMEZONES = ['Etc/UTC'];
const DEFAULT_INCLUDE_REGION = true;
const DEFAULT_SETTINGS = {
  format: DEFAULT_FORMAT,
  timezones: DEFAULT_TIMEZONES,
  includeRegion: DEFAULT_INCLUDE_REGION,
};

// Reads storage.sync, migrating pre-1.8 storage.local settings once.
// (Duplicated in scripts/background.js — no shared module pathway without a build step.)
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

document.addEventListener('DOMContentLoaded', async () => {
  // Display version from manifest
  const manifest = api.runtime.getManifest();
  document.getElementById('version').textContent = 'v' + manifest.version;

  // Load settings, with defaults applied for any missing keys. This returns
  // the defaults without writing anything for a fresh install - the
  // background already applies its own fallbacks too.
  let settings = await getSettings();

  // Chrome hides the utility Etc/UTC timezone, we need to add it if it's not present.
  const supportedTimezones = Intl.supportedValuesOf('timeZone');
  const hasUtc = supportedTimezones.some(tz => {
    const lower = tz.toLowerCase();
    return lower === 'utc' || lower === 'etc/utc';
  });
  const allTimezones = hasUtc ? [...supportedTimezones] : ['Etc/UTC', ...supportedTimezones];

  // Create a data list for the timezones.
  let dataList = document.getElementById('timezones');
  for (let i = 0; i < allTimezones.length; i++) {
    let option = document.createElement('option');
    const timezone = allTimezones[i];
    option.value = timezone;
    option.text = timezone === 'Etc/UTC' ? 'UTC' : timezone;
    dataList.appendChild(option);
  }

  // Set the input for format.
  let formatInput = document.getElementById('timepeek-format');
  formatInput.value = settings.format || DEFAULT_FORMAT;

  // Include region checkbox
  const includeRegionCheckbox = document.getElementById('timepeek-include-region');
  includeRegionCheckbox.checked = settings.hasOwnProperty('includeRegion') ? settings.includeRegion : DEFAULT_INCLUDE_REGION;

  // Timezones management
  const timezonesContainer = document.getElementById('timezones-container');
  const timezonesInput = document.getElementById('timepeek-timezones-input');
  const previewFormat = document.getElementById('timepeek-preview');
  let currentTzs = settings.timezones;

  const updatePreview = () => {
    const format = formatInput.value || DEFAULT_FORMAT;
    const tz = currentTzs[0] ?? 'Etc/UTC'; // shared fallback with the background
    previewFormat.value = getFormattedString(new Date(), tz, format, includeRegionCheckbox.checked);
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
      await api.storage.sync.set({ timezones: currentTzs });
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
    if (formatInput.value) {
      await api.storage.sync.set({ format: formatInput.value });
    } else {
      await api.storage.sync.remove('format');
    }
    updatePreview();
  });

  // Set the event listener for the include region checkbox
  includeRegionCheckbox.addEventListener('change', async () => {
    await api.storage.sync.set({ includeRegion: includeRegionCheckbox.checked });
    updatePreview();
  });

  // Set the event listener for the timezones input.
  timezonesInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && timezonesInput.value) {
      e.preventDefault();
      const entry = timezonesInput.value.trim();
      const entryLower = entry.toLowerCase();
      let matchTz = allTimezones.find(tz => tz.toLowerCase() === entryLower);

      if (!matchTz && entryLower === 'utc') {
        matchTz = allTimezones.find(tz => tz.toLowerCase() === 'etc/utc') || 'Etc/UTC';
      }

      if (matchTz && !currentTzs.includes(matchTz)) {
        currentTzs.push(matchTz);
        await api.storage.sync.set({ timezones: currentTzs });
        renderTags();
      }
      timezonesInput.value = '';
    }
  });

  renderTags();

  // Firefox MV3 host permissions are opt-in; without a granted <all_urls>
  // the content script silently never injects. Harmless no-op on Chrome,
  // where the manifest grant is automatic.
  const grantBtn = document.getElementById('timepeek-grant');
  if (api.permissions?.contains) {
    const granted = await api.permissions.contains({ origins: ['<all_urls>'] });
    if (!granted) {
      grantBtn.classList.remove('dn');
      grantBtn.addEventListener('click', async () => {
        // permissions.request must run in a user gesture; this click qualifies.
        if (await api.permissions.request({ origins: ['<all_urls>'] })) {
          grantBtn.classList.add('dn');
        }
      });
    }
  }

  // Set the loading to false (add dn to loading, remove dn from content).
  let loading = document.querySelector('.loading');
  let content = document.querySelector('.content');

  loading.classList.add('dn');
  content.classList.remove('dn');
});
