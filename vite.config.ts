/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { SLOGAN } from './src/lib/brand'

// "0.3.0 (build 17)": package.json version + git commit count, matching the Android versionName.
const pkgVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
let build = '0'
try { build = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { /* not a git checkout */ }

// Pages serves from /BliskFit/; Capacitor/custom domain builds set VITE_BASE=/.
const base = process.env.VITE_BASE ?? '/BliskFit/'
// The Android app bundles its own assets, so it needs neither the service worker nor the install manifest.
const native = process.env.VITE_NATIVE === '1'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(`${pkgVersion} (build ${process.env.BLISKFIT_VERSION_CODE ?? build})`),
    // Matches the Android versionCode; the update check compares it with the latest release's.
    __APP_BUILD__: JSON.stringify(Number(process.env.BLISKFIT_VERSION_CODE ?? build)),
  },
  plugins: [
    react(),
    VitePWA({
      disable: native,
      registerType: 'prompt',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'BliskFit',
        short_name: 'BliskFit',
        description: `${SLOGAN} Offline-first gym tracker.`,
        theme_color: '#0b1514',
        background_color: '#0b1514',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [{
          // Demo images are remote; cache them after first view so they work offline.
          urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/.*\.jpg$/,
          handler: 'CacheFirst',
          options: { cacheName: 'exercise-demos', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
      devOptions: { enabled: true },
    }),
  ],
  test: { environment: 'node', setupFiles: ['src/test-setup.ts'] },
})
