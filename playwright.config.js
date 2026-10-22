import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

const localBrowsers = path.resolve('.playwright-browsers')
if (existsSync(localBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= localBrowsers
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
