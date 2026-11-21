import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/SNIPER-LIFE/';

export default defineConfig({
  base: BASE,
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'SHADOWLINE',
        short_name: 'SHADOWLINE',
        description: 'Sniper tactique et narratif. Chaque tir se prépare comme une enquête.',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0b0d10',
        theme_color: '#0b0d10',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,wasm}'],
        maximumFileSizeToCacheInBytes: 8_000_000,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
});
