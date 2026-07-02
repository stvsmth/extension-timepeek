const api = globalThis.browser ?? globalThis.chrome;

const TIMESTAMP_REGEX = /^[0-9]{1,}(\.?[0-9]{1,})?$/;
let lastTimestampSelection = { text: '', updatedAt: 0 };

function normalizeTimestamp(text = '') {
  return text.replace(/\s+/g, '');
}

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

// Former main.css rules. Injected into each tooltip's shadow root so
// aggressive page CSS (resets, high z-indexes) can't break or bury it.
const TOOLTIP_CSS = `
.timepeek-base {
    width: auto;
    position: fixed;
    z-index: 99999;
    background: black;
    min-height: 35px;
    padding: 5px 10px;
    white-space: pre-wrap;
}

.timepeek-date {
    margin: 10px 10px 0 10px;
    color: white;
    padding: 0;
    font-size: 14px;
    font-family: monospace;
}

.timepeek-icon {
    color: gray;
    position: absolute;
    right: 6px;
    top: 4px;
    font-size: 20px;
    cursor: pointer;
}
`;

function handleEsc(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.timepeek-host').forEach(n => n.remove());
  }
}

function showTooltip(textContent, x, y) {
  const host = document.createElement('div');
  host.className = 'timepeek-host'; // Escape handler targets this
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = TOOLTIP_CSS;
  root.appendChild(style);

  const div = document.createElement('div');
  div.className = 'timepeek-base';

  const close = document.createElement('span');
  close.className = 'timepeek-icon';
  close.textContent = '×';
  close.title = 'Close';
  close.addEventListener('click', () => {
    host.remove();
  });

  const p = document.createElement('p');
  p.className = 'timepeek-date';
  p.textContent = textContent;

  div.appendChild(close);
  div.appendChild(p);
  root.appendChild(div);

  document.body.appendChild(host);

  // Clamp to viewport: measure, then pull left of the right edge and flip
  // above the cursor if the bottom would overflow.
  const rect = div.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = (y + 30 + rect.height > window.innerHeight) ? y - rect.height - 8 : y + 30;
  div.style.left = `${Math.max(left, 0)}px`;
  div.style.top = `${Math.max(top, 0)}px`;
}

async function handleEvent(e) {
  // Bail before doing any work (including waking the background) unless the
  // modifier is held and the selection actually looks like a timestamp.
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
    return; // background unreachable (e.g. extension reloaded) - fail silently
  }
  if (!response || !response.textContent) return;

  // Clear the cached selection once we've used it.
  lastTimestampSelection = { text: '', updatedAt: 0 };

  showTooltip(response.textContent, e.clientX, e.clientY);
}

(() => {
  // Add an event listener on mouseup to handle the CTRL click conversion.
  document.addEventListener('mouseup', handleEvent, false);
  // Track the current selection so ctrl/cmd+click can use it before the click clears it.
  document.addEventListener('selectionchange', () => {
    const text = normalizeTimestamp(getSelectedText());
    if (TIMESTAMP_REGEX.test(text)) {
      lastTimestampSelection = { text, updatedAt: Date.now() };
    }
  }, false);
  // Add Escape key to close all open popovers.
  document.addEventListener('keydown', handleEsc, false);
})();
