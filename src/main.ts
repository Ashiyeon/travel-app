import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// Register service worker for PWA
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
console.log('--- PWA Debug Info ---');
console.log('Base URL:', import.meta.env.BASE_URL);
console.log('Supabase URL exists:', !!import.meta.env.VITE_SUPABASE_URL);
console.log('Current URL:', window.location.href);

// 如果這行報錯，畫面就會空白
if (!import.meta.env.VITE_SUPABASE_URL) {
  document.body.innerHTML = '<h1 style="color:red; padding:20px;">錯誤：找不到環境變數 VITE_SUPABASE_URL</h1>';
}