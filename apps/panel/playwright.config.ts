import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    // WHY: dummy values let the panel boot without a backend; specs that need the real local
    // Supabase (login.supabase.spec.ts) run only when E2E_SUPABASE_ANON_KEY is provided.
    env: {
      VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? 'e2e-dummy-anon-key',
      VITE_PUBLIC_APP_URL: 'http://localhost:5173',
    },
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit', use: devices['iPad (gen 7)'] },
  ],
})
