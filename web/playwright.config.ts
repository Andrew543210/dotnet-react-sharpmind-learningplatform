import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'dotnet run --project ../src/SharpMind.Api --no-build --no-launch-profile',
      url: 'http://127.0.0.1:5081/api/health/ready',
      timeout: 60000,
      reuseExistingServer: false,
      env: { ASPNETCORE_URLS: 'http://127.0.0.1:5081', ASPNETCORE_ENVIRONMENT: 'Testing' },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      timeout: 60000,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:5081' },
    },
  ],
})
