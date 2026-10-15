import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // E2E runs on its own ports so it never touches a dev server that may hold a real API key.
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${Number(process.env.PORT) || 8787}` },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    css: false,
  },
});
