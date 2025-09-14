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

// Ensure background is exactly as override wants
if (override.background) merged.background = override.background;

// Ensure action/browser_action is exactly as override wants
if (override.action) merged.action = override.action;
if (override.browser_action) merged.browser_action = override.browser_action;

// Prepare dist/<target>
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// Copy all files except the manifest templates and dist itself
const exclude = new Set([
  'dist',
  'node_modules',
  'manifest.base.json',
  'manifest.chrome.json',
  'manifest.firefox.json',
  'scripts/gen-manifest.mjs'
]);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (exclude.has(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(root, outDir);

// Write the generated manifest over any copied manifest.json
const outManifest = path.join(outDir, 'manifest.json');
fs.writeFileSync(outManifest, JSON.stringify(merged, null, 2));

console.log(`Generated ${outManifest}`);

