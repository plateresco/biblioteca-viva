import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Mi Biblioteca Viva', short_name: 'Biblioteca', lang: 'es',
      description: 'Registro de lecturas con lector EPUB propio',
      theme_color: '#16262A', background_color: '#16262A', display: 'standalone', start_url: '.', scope: '.',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
      ]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, runtimeCaching: [
      { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } }
    ] }
  })]
});
