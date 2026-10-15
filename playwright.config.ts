import { defineConfig, devices } from '@playwright/test';

// Dedicated ports: E2E never reuses a running dev server, which might have a real API key.
const WEB_PORT = 5174;
const API_PORT = 8790;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    // Health goes through the Vite proxy, so this waits for both the web app and the API server.
    url: `http://localhost:${WEB_PORT}/api/health`,
    reuseExistingServer: false,
    // An empty key wins over .env (Node's --env-file never overrides set variables): always the mock brain.
    env: { ANTHROPIC_API_KEY: '', PORT: String(API_PORT), WEB_PORT: String(WEB_PORT) },
    timeout: 60_000,
  },
});
