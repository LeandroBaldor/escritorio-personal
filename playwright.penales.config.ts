import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
const port = process.env.PEN_PORT ?? '5181';

export default defineConfig({
  testDir: 'tests', testMatch: 'kombat-penales-deaths.spec.ts', timeout: 120_000,
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}${base}docs/kombat-penales-muertes-preview.html`,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
