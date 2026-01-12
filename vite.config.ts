import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  base: '/travel-app/', 
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'travel-app',
        short_name: 'Travel',
        description: 'Track and plan your trips',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/travel-app/',
        start_url: '/travel-app/',
        icons: [
          {
            src: 'icon-192x192.png', 
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['travel', 'productivity']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,jpg,gif}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              }
            }
          }
        ]
      }
    })
  ],
})