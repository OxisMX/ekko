import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import type { Connect, Plugin } from 'vite'
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

// WHY: Vite ignores public/_redirects, so without this its SPA fallback would answer /v/<token>
// with the React app. Mirrors `/v/* /v/ 200` so dev, preview and Playwright hit the real URL shape.
function staticW01(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (req.url?.startsWith('/v/')) req.url = '/v/index.html'
    next()
  }
  return {
    name: 'ekko-static-w01',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), staticW01()],
  define: { __COMMIT_HASH__: JSON.stringify(commitHash()) },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], env: { VITE_PUBLIC_APP_URL: 'http://localhost:5173' } },
})
