import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// 先檢查必要的環境變數，避免覆寫整個 document.body 導致空白頁
const missingSupabaseUrl = !import.meta.env.VITE_SUPABASE_URL

if (missingSupabaseUrl) {
  // 在 #app 容器內顯示錯誤提示（較安全，方便除錯）
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = '<h1 style="color:red; padding:20px;">錯誤：找不到環境變數 VITE_SUPABASE_URL。請在專案根目錄建立 .env 並重啟 dev server。</h1>'
  }
  console.error('Missing environment variable: VITE_SUPABASE_URL')
} else {
  // Register service worker for PWA (only when env present)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service Worker registration failed: ', err)
      })
    })
  }

  const app = createApp(App)
  app.use(router)
  app.mount('#app')

  // 偵錯用代碼
  console.log('--- PWA Debug Info ---')
  console.log('Base URL:', import.meta.env.BASE_URL)
  console.log('Supabase URL exists:', !!import.meta.env.VITE_SUPABASE_URL)
  console.log('Current URL:', window.location.href)
}