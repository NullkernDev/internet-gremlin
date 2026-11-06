// Builds the whole extension into ./dist
import { build } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

for (const config of ['vite.config.ts', 'vite.content.config.ts', 'vite.background.config.ts']) {
  console.log(`\n▶ building with ${config}`);
  await build({ configFile: resolve(root, config), logLevel: 'warn' });
}

const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
manifest.version = pkg.version;
writeFileSync(resolve(root, 'dist/manifest.json'), JSON.stringify(manifest, null, 2));

// Sanity check: every file the manifest points at must exist.
const required = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  'onboarding/index.html',
  ...manifest.content_scripts.flatMap((c) => c.js),
  ...Object.values(manifest.icons),
  'fonts/pixelify-sans-latin-400-normal.woff2',
];
const missing = required.filter((f) => !existsSync(resolve(root, 'dist', f)));
if (missing.length) {
  console.error('\n✖ Missing files in dist/:', missing);
  process.exit(1);
}
console.log(`\n✔ Internet Gremlin v${pkg.version} built into dist/ — load that folder in chrome://extensions`);
