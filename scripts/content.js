async function getFormattedDate(text) {

  // Regex out the spaces.
  text = text.replace(/[ ]/g, '');

  // Check if you selected a number.
  if (!/^[0-9]{1,}([\.]?[0-9]{1,})?$/.test(text)) {
    return { textContent: null, fetchedIn: null };
  }

  try {
    const response = await browser.runtime.sendMessage({
      action: 'formatDate',
      text: text
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

async function handleEvent(e) {
  // Get the text and the formatted date.
  let text = getSelectedText();

  // Fetch the date(s).
  let { textContent, fetchedIn } = await getFormattedDate(text);

  // If no CTRL key, no text, or no converted textContent/fetchedIn, return.
  if (!e.ctrlKey || !text || !textContent || !fetchedIn) return;

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
})();
