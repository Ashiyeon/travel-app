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
      injectRegister: 'auto',
      manifest: {
        name: 'travel-app',
        //更改app名稱
        short_name: '空姐叫我',
        display: 'standalone',
        start_url: '/travel-app/',
        scope: '/travel-app/',
        icons: [
          {
            src: 'icon-192x192.svg', 
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      // Workbox 設定 (離線讀取)
      workbox: {
        // 快取所有編譯後的 js, css, html 以及 public 裡的圖片
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,jpg,gif}'],
        // 確保離線時重新整理不會跳出 404
        navigateFallback: '/travel-app/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst', // 優先嘗試網路，失敗則回傳上次成功的快取
            options: {
              cacheName: 'supabase-data-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 資料保存 1 天
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
})