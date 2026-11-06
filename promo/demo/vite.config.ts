import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/** Builds the browser-based promo demo (used to record promo/demo.mp4). */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  publicDir: resolve(import.meta.dirname, '../../public'),
  plugins: [react()],
  build: { outDir: resolve(import.meta.dirname, 'dist'), emptyOutDir: true, target: 'chrome110' },
});
