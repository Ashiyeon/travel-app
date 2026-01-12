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