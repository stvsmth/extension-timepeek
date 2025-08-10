function getFormattedString(date, tz, format, includeRegion = true) {
  let formatted = date.tz(tz).format(format);
  if (tz && includeRegion) {
    const location = tz.split('/').pop().replace(/_/g, ' ');
    formatted += ' - ' + location;
  }
  return formatted;
}
