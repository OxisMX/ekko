import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'

// Plan de implementación §6.1: commit hash in the panel footer.
function commitHash(): string {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // WHY: builds outside a git checkout (tarball, sandbox) still need a footer value.
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __COMMIT_HASH__: JSON.stringify(commitHash()) },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
