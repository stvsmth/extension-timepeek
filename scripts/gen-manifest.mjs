#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!target || !['chrome', 'firefox'].includes(target)) {
  console.error('Usage: node scripts/gen-manifest.mjs <chrome|firefox>');
  process.exit(1);
}

const root = process.cwd();
const outDir = path.join(root, 'dist', target);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override !== undefined ? override : base;
  }
  if (typeof base === 'object' && typeof override === 'object') {
    const out = { ...base };
    for (const k of Object.keys(override)) {
      out[k] = deepMerge(base?.[k], override[k]);
    }
    return out;
  }
  return override !== undefined ? override : base;
}

// Load base + override
const basePath = path.join(root, 'manifest.base.json');
const overridePath = path.join(root, `manifest.${target}.json`);
const base = readJson(basePath);
const override = readJson(overridePath);

// Merge with override taking precedence (especially for background/action/permissions)
const merged = deepMerge(base, override);

// Single source of truth for version: package.json, not the manifest.
merged.version = readJson(path.join(root, 'package.json')).version;

// Prepare dist/<target>
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// Allowlist of what actually ships. A new file that should ship shows up as
// visibly missing on first manual test; a stray repo file can never leak
// into a store submission.
const include = [
  'icons',
  'popup',
  'scripts/background.js',
  'scripts/content.js',
  'scripts/formatter.js',
  'scripts/settings.js',
  'LICENSE',
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      // Skip dotfiles within shipped dirs (.DS_Store and friends)
      if (entry.startsWith('.')) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

for (const entry of include) {
  copyRecursive(path.join(root, entry), path.join(outDir, entry));
}

// Write the generated manifest over any copied manifest.json
const outManifest = path.join(outDir, 'manifest.json');
fs.writeFileSync(outManifest, JSON.stringify(merged, null, 2));

console.log(`Generated ${outManifest}`);

