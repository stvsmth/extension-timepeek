// Chrome MV3 background service worker bundle entry
// Ensure vendor libs and helpers load before background logic
import '../vendor/browser-polyfill.min.js';
import '../vendor/dayjs.js';
import '../vendor/utc.js';
import '../vendor/timezone.js';
import './formatter.js';
import './background.js';

