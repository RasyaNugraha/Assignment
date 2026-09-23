// End-to-end tests (Playwright): real browser + real Angular app + real server + MongoDB.
// Uses its own database (fabulari_e2e) and ports (3100 / 4300), so your normal
// data and a running dev server aren't touched. Needs mongod running.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4300',
    launchOptions: process.env['PW_CHROMIUM_PATH'] ? { executablePath: process.env['PW_CHROMIUM_PATH'] } : {},
  },
  webServer: [
    {
      // Fresh e2e database, then start the API on port 3100.
      command: 'node scripts/reset-db.js && node server.js',
      cwd: '../server',
      env: { DB_NAME: 'fabulari_e2e', PORT: '3100', CLIENT_ORIGIN: 'http://localhost:4300' },
      url: 'http://localhost:3100/api/status',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx ng serve --port 4300 --proxy-config proxy.e2e.conf.json',
      url: 'http://localhost:4300',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
