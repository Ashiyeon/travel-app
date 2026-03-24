import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import TripDetailView from '../views/TripDetailView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/trip/:id',
      name: 'trip-detail',
      component: TripDetailView,
      props: true
    },
    // 捕捉所有未定義的路徑，直接顯示 HomeView
    // 這可以解決 Supabase 登入後 Hash 內包含 access_token 導致路由匹配失敗的問題
    // 讓 HomeView 的 onMounted 邏輯有機會讀取到 URL 中的 token
    {
      path: '/:pathMatch(.*)*',
      component: HomeView
    }
  ]
})

export default router