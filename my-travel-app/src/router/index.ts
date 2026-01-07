import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import TripDetailView from '../views/TripDetailView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/trip/:id', // :id 是動態參數，代表行程的 ID
      name: 'trip-detail',
      component: TripDetailView,
      props: true // 讓 id 可以直接作為 props 傳進組件
    }
  ]
})

export default router