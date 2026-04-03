import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** Sin PORT (solo `npm run dev`): Vite en 5173 y proxy `/api` → 3000 (donde debe estar `vercel dev`). Con PORT (p. ej. vercel dev): Vite usa ese puerto. */
const devPort = process.env.PORT ? Number(process.env.PORT) : 5173

/**
 * En `serve`, vite-plugin-pwa (injectManifest + devOptions) puede hacer que
 * `index.html` crudo pase por `vite:import-analysis` → error de sintaxis.
 * En `build` el plugin sí debe cargarse (manifest + SW).
 */
function pwaRegisterDevStub(): Plugin {
  const rid = '\0virtual:pwa-register'
  return {
    name: 'pwa-register-dev-stub',
    resolveId(id) {
      if (id === 'virtual:pwa-register') return rid
    },
    load(id) {
      if (id !== rid) return
      return `export function registerSW(_options = {}) {
  return async (_reloadPage = true) => {};
}
`
    },
  }
}

// https://vite.dev/config/server-options.html#server-port
export default defineConfig(({ command }) => ({
  server: {
    port: devPort,
    strictPort: Boolean(process.env.PORT),
    /** Evita precargas que a veces disparan transform raro con proxies (p. ej. vercel dev). */
    preTransformRequests: false,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    ...(command === 'serve'
      ? [pwaRegisterDevStub()]
      : VitePWA({
          registerType: 'autoUpdate',
          strategies: 'injectManifest',
          srcDir: 'src',
          filename: 'sw.ts',
          injectManifest: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          },
          manifest: {
            name: 'PulseTime',
            short_name: 'PulseTime',
            description: 'Recordatorios importantes con notificaciones en tu iPhone',
            theme_color: '#0f172a',
            background_color: '#0f172a',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            icons: [
              {
                src: 'pwa-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              },
            ],
          },
        })),
  ],
}))
