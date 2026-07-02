// api, DEFAULT_SETTINGS, and getSettings come from ../scripts/settings.js,
// loaded before this file in timepeek.html.

document.addEventListener('DOMContentLoaded', async () => {
  // Start the storage read while the DOM work below runs.
  const settingsPromise = getSettings();

  // Display version from manifest
  const manifest = api.runtime.getManifest();
  document.getElementById('version').textContent = 'v' + manifest.version;

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

  // getSettings() returns normalized values, so no per-field fallbacks here.
  const settings = await settingsPromise;

  // Set the input for format.
  let formatInput = document.getElementById('timepeek-format');
  formatInput.value = settings.format;

  // Include region checkbox
  const includeRegionCheckbox = document.getElementById('timepeek-include-region');
  includeRegionCheckbox.checked = settings.includeRegion;

  // Timezones management
  const timezonesContainer = document.getElementById('timezones-container');
  const timezonesInput = document.getElementById('timepeek-timezones-input');
  const previewFormat = document.getElementById('timepeek-preview');
  let currentTzs = [...settings.timezones]; // copy: never mutate the shared cache

  const updatePreview = () => {
    // Runtime fallbacks for live-emptied inputs (cleared format field,
    // all timezone tags removed) — matches what the background would use.
    const format = formatInput.value || DEFAULT_SETTINGS.format;
    const tz = currentTzs[0] ?? DEFAULT_SETTINGS.timezones[0];
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

  // Format input: preview updates per keystroke, but the storage.sync write
  // is debounced (Chrome quotas sync writes per minute) and flushed on blur.
  const saveFormat = () => formatInput.value
    ? api.storage.sync.set({ format: formatInput.value })
    : api.storage.sync.remove('format');
  let formatSaveTimer;
  formatInput.addEventListener('input', () => {
    updatePreview();
    clearTimeout(formatSaveTimer);
    formatSaveTimer = setTimeout(saveFormat, 300);
  });
  formatInput.addEventListener('change', () => {
    clearTimeout(formatSaveTimer);
    saveFormat();
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
