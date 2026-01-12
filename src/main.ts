import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// 檢查環境變數
const missingSupabaseUrl = !import.meta.env.VITE_SUPABASE_URL

if (missingSupabaseUrl) {
  console.error('Missing environment variable: VITE_SUPABASE_URL')
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = '<h1 style="color:red; padding:20px;">錯誤：找不到環境變數 VITE_SUPABASE_URL。</h1>'
  }
} else {
  // 1. 初始化 Vue
  const app = createApp(App)
  app.use(router)
  app.mount('#app')

  // 2. 偵錯資訊 (確認路徑用)
  console.log('--- PWA Debug Info ---')
  console.log('Base URL:', import.meta.env.BASE_URL) // 應該印出 /travel-app/
  console.log('Supabase Ready:', !!import.meta.env.VITE_SUPABASE_URL)
  
  // 注意：不需要手動 navigator.serviceWorker.register
  // vite-plugin-pwa 的 injectRegister: 'auto' 會幫你做這件事
}