// Formats dates for Timepeek. Deliberately a plain classic script: loaded by
// the Chrome MV3 service worker via importScripts, by the Firefox event page
// via the manifest background.scripts array, by the popup via <script src>,
// and by Node tests via require.

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WEEKDAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// DTF construction is expensive and the popup preview formats per keystroke.
const dtfCache = new Map();
function getDtf(tz) {
  const key = tz || '';
  let dtf = dtfCache.get(key);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, // undefined → system zone (popup preview with no tz)
      weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', // h24 would render midnight as "24"
      timeZoneName: 'longOffset',
    });
    dtfCache.set(key, dtf);
  }
  return dtf;
}

// Mirrors Day.js's own format regex (longest-first per letter, [] escapes).
// Its greedy matching inside literal words is a Day.js compatibility
// requirement locked in by the golden tests.
//
// YYYY/YY are bounded with lookaround (unlike every other token) so that a
// bare `Y` or a `YYY` run passes through untouched instead of getting
// partially eaten - the one sanctioned divergence from Day.js, which
// (buggily) renders those as the UTC offset. No golden exercises bare Y/YYY,
// so this bounding can't affect parity elsewhere.
const TOKEN_RE = /\[([^\]]+)\]|(?<!Y)YYYY(?!Y)|(?<!Y)YY(?!Y)|MMMM|MMM|MM|M|DD|D|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|ZZ|Z|A|a/g;

function buildFields(date, tz) {
  const parts = {};
  for (const p of getDtf(tz).formatToParts(date)) parts[p.type] = p.value;

  const H = Number(parts.hour);
  const monthIdx = Number(parts.month) - 1;
  const weekdayIdx = WEEKDAYS_SHORT.indexOf(parts.weekday);
  const h12 = H % 12 === 0 ? 12 : H % 12;

  // timeZoneName is "GMT-05:00" / "GMT+00:00", bare "GMT" on some engines,
  // and some ICUs use U+2212 minus. UTC must come out as +00:00.
  const m = (parts.timeZoneName || '').match(/([+−-])(\d{1,2}):?(\d{2})/);
  const Z = m ? `${m[1] === '−' ? '-' : m[1]}${m[2].padStart(2, '0')}:${m[3]}` : '+00:00';

  return {
    YYYY: parts.year, YY: parts.year.slice(-2),
    MMMM: MONTHS_LONG[monthIdx], MMM: MONTHS_SHORT[monthIdx],
    MM: parts.month, M: String(Number(parts.month)),
    DD: parts.day, D: String(Number(parts.day)),
    dddd: WEEKDAYS_LONG[weekdayIdx], ddd: parts.weekday,
    dd: parts.weekday.slice(0, 2), d: String(weekdayIdx),
    HH: parts.hour, H: String(H),
    hh: String(h12).padStart(2, '0'), h: String(h12),
    mm: parts.minute, m: String(Number(parts.minute)),
    ss: parts.second, s: String(Number(parts.second)),
    SSS: String(((date.getTime() % 1000) + 1000) % 1000).padStart(3, '0'),
    A: H < 12 ? 'AM' : 'PM', a: H < 12 ? 'am' : 'pm',
    Z, ZZ: Z.replace(':', ''),
  };
}

function getFormattedString(date, tz, format, includeRegion = true) {
  let formatted;
  if (isNaN(date.getTime())) {
    formatted = 'Invalid Date'; // Day.js parity, region suffix still applies
  } else {
    const fields = buildFields(date, tz); // throws RangeError on bad tz, like Day.js
    formatted = format.replace(TOKEN_RE, (match, literal) =>
      literal !== undefined ? literal : fields[match]);
  }
  if (tz && includeRegion) {
    formatted += ' - ' + tz.split('/').pop().replace(/_/g, ' ');
  }
  return formatted;
}

function timestampToDate(n) {
  if (!Number.isFinite(n)) return new Date(NaN);
  if (n >= 1e15) return new Date(n / 1000); // microseconds
  if (n >= 1e12) return new Date(n);        // milliseconds
  return new Date(n * 1000);                // seconds; fractional preserved
}

const globalScope = typeof globalThis !== 'undefined' ? globalThis : self;
globalScope.getFormattedString = getFormattedString;
globalScope.timestampToDate = timestampToDate;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = getFormattedString;
  module.exports.timestampToDate = timestampToDate;
}
