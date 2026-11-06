import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/** The background service worker (tab counting + onboarding). */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome110',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/background/index.ts'),
      formats: ['iife'],
      name: 'InternetGremlinWorker',
      fileName: () => 'background.js',
    },
  },
});
