import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import TripDetailView from '../views/TripDetailView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  
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
    }
  ]
})

export default router