dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);

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

  // TODO: Not sure this is an error
  // If neither was found, console error.
  console.error('Cannot get the selected text.');
  return '';
}

async function handleEsc(e) {
  // If we get an escape key and the main window is up, close it.
  if (e.key === 'Escape') {
    let baseDiv = document.getElementById('timepeek-base');
    if (baseDiv) {
      baseDiv.remove()
    };
  }
}

async function handleEvent(e) {
  // Get the text and the formatted date.
  console.log('Mouse up event detected.');
  let text = getSelectedText();

  // Fetch the date(s).
  let { textContent, fetchedIn } = await getFormattedDate(text);

  // Get the base div.
  let baseDiv = document.getElementById('timepeek-base');

  // If the base div exists, do not allow more conversions.
  if (baseDiv) {
    // Check if target was not the base or the date and if neither, remove the base div.
    if (
      e.target.id !== 'timepeek-base' &&
      e.target.id !== 'timepeek-date'
    ) {
      baseDiv.remove();
    }

    return;
  }

  // If no CTRL key, no text, or no converted textContent/fetchedIn, return.
  if (!e.ctrlKey || !text || !textContent || !fetchedIn) return;

  // Create an element in the body.
  let div = document.createElement('div');

  // Set the ID and the top/left style based on the mouse position.
  div.id = 'timepeek-base';
  div.style.left = `${e.clientX}px`;
  div.style.top = `${e.clientY + 30}px`;

  // Create the actual timestamp.
  let p = document.createElement('p');
  p.id = 'timepeek-date';
  // Display multiple dates on separate lines if needed.
  p.innerText = Array.isArray(textContent)
    ? textContent.join('\n')
    : textContent;

  // Append elements.
  div.appendChild(p);
  document.body.appendChild(div);
}

(() => {
  // loadDefaultSettings();

  // Add an event listener on mouseup to handle the CTRL click conversion.
  document.addEventListener('mouseup', handleEvent, false);
  document.addEventListener('keydown', handleEsc, false);
})();
