// Rollup config to bundle Chrome MV3 background service worker
// It concatenates vendor libs + formatter + background into one file.

/** @type {import('rollup').RollupOptions[]} */
const config = [
  {
    input: 'scripts/background.sw.entry.js',
    // Ensure vendor UMD bundles run against the service worker global scope
    context: 'self',
    moduleContext: (id) => (id.includes('/vendor/') ? 'self' : undefined),
    output: {
      file: 'dist/chrome/scripts/background.js',
      format: 'iife',
      sourcemap: true,
      name: 'timepeek_sw'
    },
    // Keep side-effectful vendor scripts
    treeshake: false,
  },
];

export default config;
