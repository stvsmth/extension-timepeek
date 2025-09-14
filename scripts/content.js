const TIMESTAMP_REGEX = /^[0-9]{1,}(\.?[0-9]{1,})?$/;
let lastTimestampSelection = { text: '', updatedAt: 0 };

function normalizeTimestamp(text = '') {
  return text.replace(/\s+/g, '');
}

async function getFormattedDate(text) {
  const normalized = normalizeTimestamp(text);

  // Check if you selected a number.
  if (!TIMESTAMP_REGEX.test(normalized)) {
    return { textContent: null, fetchedIn: null };
  }

  try {
    const response = await browser.runtime.sendMessage({
      action: 'formatDate',
      text: normalized
    });
    return response;
  } catch (e) {
    return { textContent: e, fetchedIn: 'seconds' };
  }
}

function getSelectedText() {
  // Try window.getSelection. If not found use document.selection.
  if (window.getSelection) {
    var activeElement = document.activeElement;
    if (activeElement && activeElement.value) {
      return activeElement.value
        .substring(
          activeElement.selectionStart,
          activeElement.selectionEnd
        )
        .trim();
    } else {
      let selection = window.getSelection();
      if (selection) {
        return selection.toString().trim();
      }
    }
  } else if (document.selection) {
    return document.selection.createRange().text.trim();
  }

  // If no selection, return empty string.
  return '';
}

function handleEsc(e) {
  if (e.key === 'Escape') {
    const nodes = document.querySelectorAll('.timepeek-base');
    nodes.forEach(n => n.remove());
  }
}

async function handleEvent(e) {
  // Support Ctrl on Windows/Linux and Command on macOS.
  const modifierPressed = e.ctrlKey || e.metaKey;

  // Get the text and the formatted date.
  let text = normalizeTimestamp(getSelectedText());

  if (
    !text &&
    lastTimestampSelection.text &&
    Date.now() - lastTimestampSelection.updatedAt < 2000
  ) {
    text = lastTimestampSelection.text;
  }

  // Fetch the date(s).
  let { textContent, fetchedIn } = await getFormattedDate(text);

  // If no CTRL key, no text, or no converted textContent/fetchedIn, return.
  if (!modifierPressed || !text || !textContent || !fetchedIn) return;

  // Clear the cached selection once we've used it.
  lastTimestampSelection = { text: '', updatedAt: 0 };

  // Create an element in the body.
  let div = document.createElement('div');

  // Set the ID and the top/left style based on the mouse position.
  div.className = 'timepeek-base';
  div.style.left = `${e.clientX}px`;
  div.style.top = `${e.clientY + 30}px`;

  // Create a close icon.
  let close = document.createElement('span');
  close.className = 'timepeek-icon';
  close.textContent = '×';
  close.title = 'Close';
  close.addEventListener('click', () => {
    div.remove();
  });

  // Create the actual timestamp.
  let p = document.createElement('p');
  p.className = 'timepeek-date';

  // Display multiple dates on separate lines if needed.
  p.textContent = Array.isArray(textContent)
    ? textContent.join('\n')
    : textContent;

  // Append elements.
  div.appendChild(close);
  div.appendChild(p);
  document.body.appendChild(div);
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
