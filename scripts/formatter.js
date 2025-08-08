function getFormattedString(date, tz, format) {
  let formatted = date.tz(tz).format(format);
  if (tz) {
    const location = tz.split('/').pop().replace(/_/g, ' ');
    formatted += ' - ' + location;
  }
  return formatted;
}
