import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Usamos rutas relativas ('./') para que la app funcione sin importar
// en qué subcarpeta la sirva GitHub Pages (https://usuario.github.io/repo/).
// No hace falta editar nada aquí, sea cual sea el nombre de tu repositorio.
export default defineConfig({
  base: './',
  server: {
    port: 5173
  },
  optimizeDeps: {
    exclude: ['telegram'],
    esbuildOptions: {
      define: { global: 'globalThis' }
    }
  },
  plugins: [
    // GramJS (la librería de Telegram) fue escrita pensando en Node.js y
    // usa Buffer/process/crypto internamente. Este plugin le da al navegador
    // versiones compatibles de esas APIs para que no truene al cargar.
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true
      },
      protocolImports: true
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'TeleDrive',
        short_name: 'TeleDrive',
        description: 'Tu nube personal potenciada por Telegram',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Solo cacheamos el "shell" de la app (HTML/CSS/JS).
        // Los archivos reales siempre se piden en vivo a Telegram.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: []
      }
    })
  ]
});
