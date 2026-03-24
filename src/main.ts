import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { supabase } from './lib/supabaseClient'

// 檢查環境變數
const missingSupabaseUrl = !import.meta.env.VITE_SUPABASE_URL

if (missingSupabaseUrl) {
  console.error('Missing environment variable: VITE_SUPABASE_URL')
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.innerHTML = '<h1 style="color:red; padding:20px;">錯誤：找不到環境變數 VITE_SUPABASE_URL。</h1>'
  }
} else {
  // 優先讓 Supabase 處理登入回傳的 Hash (如 #access_token=...)
  // 避免 Vue Router 的 hash history 模式自動將其改為 #/access_token 導致無法解析 token
  supabase.auth.getSession().then(() => {
    // 1. 初始化 Vue
    const app = createApp(App)
    app.use(router)
    app.mount('#app')

    // 2. 偵錯資訊 (確認路徑用)
    console.log('--- PWA Debug Info ---')
    console.log('Base URL:', import.meta.env.BASE_URL) 
    console.log('Supabase Ready:', !!import.meta.env.VITE_SUPABASE_URL)
  })
}