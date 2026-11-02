import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', timeout:20000, fullyParallel:true, workers:2,
  use:{baseURL:'http://127.0.0.1:5174',trace:'retain-on-failure'},
  webServer:{command:'node scripts/serve.mjs --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:!process.env.CI,timeout:15000},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'webkit',use:{...devices['Desktop Safari']}}]
});
