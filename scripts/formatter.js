function getFormattedString(date, tz, format, includeRegion = true) {
  let formatted = date.tz(tz).format(format);
  if (tz && includeRegion) {
    const location = tz.split('/').pop().replace(/_/g, ' ');
    formatted += ' - ' + location;
  }
  return formatted;
}

const globalScope = typeof globalThis !== 'undefined'
  ? globalThis
  : typeof self !== 'undefined'
    ? self
    : typeof window !== 'undefined'
      ? window
      : {};

globalScope.getFormattedString = getFormattedString;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = getFormattedString;
}
