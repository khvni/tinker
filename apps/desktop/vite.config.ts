import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  clearScreen: false,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['test-setup.ts'],
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
  server: {
    host: process.env.TAURI_DEV_HOST ?? '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
});
