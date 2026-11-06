import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Content scripts can't be ES modules, so the in-page Gremlin is bundled as a
 * single self-contained IIFE (React included, CSS inlined into the shadow root).
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome110',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/index.tsx'),
      formats: ['iife'],
      name: 'InternetGremlin',
      fileName: () => 'content.js',
    },
  },
});
