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
  // 0. 修復 Supabase OAuth 回傳的 Hash 格式 (保險起見)
  // 確保在 Supabase 解析前，如果網址被加上了 '/'，我們將其移除
  if (window.location.hash.startsWith('#/access_token=')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.hash.replace('#/', '#'));
  }

  // 1. 優先讓 Supabase 處理登入回傳的 Hash (如 #access_token=...)
  // 避免 Vue Router 的 hash history 模式自動將其改為 #/access_token 導致無法解析 token
  supabase.auth.getSession().then(() => {
    // 2. 初始化 Vue
    const app = createApp(App)
    app.use(router)
    app.mount('#app')

    // 3. 偵錯資訊 (確認路徑用)
    console.log('--- PWA Debug Info ---')
    console.log('Base URL:', import.meta.env.BASE_URL) 
    console.log('Supabase Ready:', !!import.meta.env.VITE_SUPABASE_URL)

    // 清除網址上的 token，讓畫面更乾淨 (可選)
    if (window.location.hash.includes('access_token=')) {
      router.replace('/')
    }
  })
}