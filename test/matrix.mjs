// Shared case table for golden generation (test/gen-goldens.mjs) and golden
// assertions (test/golden.test.mjs). All timestamps are historical/fixed so
// TZDB updates can't silently flip an expected value. Do not add cases whose
// expected output depends on the *host machine's* default timezone — see the
// DST cases below, which are deliberately placed a few hours away from the
// literal transition instant (the legacy vendored Day.js timezone plugin has
// a documented bug where its offset math briefly borrows the host's own
// local DST transition when they don't coincide; picking points with margin
// avoids capturing that host-dependent artifact into the frozen goldens).

const DEFAULT_FORMAT = 'ddd MMM DD YYYY HH:mm:ss ZZ';
const KITCHEN_SINK =
  'YYYY-YY MMMM MMM MM M dddd ddd dd d DD D HH H hh h mm m ss s SSS ZZ Z A a';

export const MATRIX = [
  { id: 'default-format-utc-region-on', ts: 1700000000, tz: 'Etc/UTC', format: DEFAULT_FORMAT, includeRegion: true },
  { id: 'default-format-utc-region-off', ts: 1700000000, tz: 'Etc/UTC', format: DEFAULT_FORMAT, includeRegion: false },
  { id: 'kitchen-sink-ny', ts: 1700000000, tz: 'America/New_York', format: KITCHEN_SINK, includeRegion: true },
  { id: 'negative-ts', ts: -1000000000, tz: 'America/New_York', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: true },

  // DST spring-forward, America/New_York, 2023-03-12 (transition at 07:00:00Z).
  { id: 'dst-spring-before', ts: 1678600800, tz: 'America/New_York', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: false },
  { id: 'dst-spring-after', ts: 1678615200, tz: 'America/New_York', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: false },

  // DST fall-back, America/New_York, 2023-11-05 (transition at 06:00:00Z).
  { id: 'dst-fall-before', ts: 1699149600, tz: 'America/New_York', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: false },
  { id: 'dst-fall-after', ts: 1699171200, tz: 'America/New_York', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: false },

  { id: 'tz-kolkata', ts: 1700000000, tz: 'Asia/Kolkata', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: true },
  { id: 'tz-kathmandu', ts: 1700000000, tz: 'Asia/Kathmandu', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: true },
  { id: 'tz-sydney', ts: 1700000000, tz: 'Australia/Sydney', format: 'YYYY-MM-DD HH:mm:ss ZZ', includeRegion: true },

  { id: 'midnight-h23', ts: 0, tz: 'Etc/UTC', format: 'HH hh A a', includeRegion: false },
  { id: 'noon-h23', ts: 43200, tz: 'Etc/UTC', format: 'HH hh A a', includeRegion: false },

  // 2020-06-15T12:00:00Z = 08:00 America/New_York (EDT, AM) - chosen so the
  // unescaped-literal quirk case below lands on an AM hour, matching the
  // reference illustration ("amt am").
  { id: 'escaped-literal', ts: 1592222400, tz: 'America/New_York', format: 'HH:mm [at] a', includeRegion: false },
  { id: 'unescaped-literal-quirk', ts: 1592222400, tz: 'America/New_York', format: 'HH:mm at a', includeRegion: false },

  { id: 'fractional-seconds', ts: 1700000000.123456, tz: 'Etc/UTC', format: 'HH:mm:ss.SSS', includeRegion: false },

  { id: 'multiword-region', ts: 1700000000, tz: 'America/Argentina/Buenos_Aires', format: 'YYYY-MM-DD', includeRegion: true },
];
