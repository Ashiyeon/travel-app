<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const tripId = route.params.id
const activities = ref<any[]>([])
const tripName = ref('讀取中...')

// 1. 載入資料
async function loadData() {
  // 抓取行程名稱
  const { data: trip } = await supabase.from('trips').select('name').eq('id', tripId).single()
  // 如果有抓到資料，更新名稱；沒抓到(或被擋住)就會停在預設值
  if (trip) tripName.value = trip.name
  else tripName.value = '找不到行程 (或權限未開)'

  // 抓取活動清單
  const { data } = await supabase.from('activities')
    .select('*')
    .eq('trip_id', tripId)
    .order('start_time', { ascending: true })
  activities.value = data || []
}

// 2. 新增表單控制
const showAddForm = ref(false)
const newAct = ref({
  title: '',
  start_time: '',
  category: '景點',
  description: '',
  map_url: ''
})

async function handleAdd() {
  if (!newAct.value.title) return
  const { error } = await supabase.from('activities').insert([{ ...newAct.value, trip_id: tripId }])
  if (!error) {
    showAddForm.value = false
    newAct.value = { title: '', start_time: '', category: '景點', description: '', map_url: '' }
    loadData()
  } else {
    alert('新增失敗：' + error.message)
  }
}

onMounted(loadData)
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20 font-sans">
    <div class="bg-blue-600 text-white p-6 rounded-b-3xl shadow-lg mb-6">
      <router-link to="/" class="text-blue-200 text-sm mb-2 inline-flex items-center gap-1 hover:text-white transition-colors">
        <span>←</span> 返回列表
      </router-link>
      <h1 class="text-2xl font-black">{{ tripName }}</h1>
    </div>

    <div class="px-4 space-y-4">
      <div v-for="act in activities" :key="act.id" 
           class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
        <div class="text-blue-600 font-bold font-mono text-sm pt-1 w-12">{{ act.start_time }}</div>
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <h3 class="font-bold text-slate-800">{{ act.title }}</h3>
            <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{{ act.category }}</span>
          </div>
          <p class="text-slate-500 text-xs mt-1">{{ act.description }}</p>
          <a v-if="act.map_url" :href="act.map_url" target="_blank"
             class="inline-block mt-3 text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold">
            📍 地圖
          </a>
        </div>
      </div>
      
      <div v-if="activities.length === 0" class="text-center py-10 text-slate-400">
        目前沒有活動，點擊右下角新增！
      </div>
    </div>

    <button 
      @click="showAddForm = true"
      class="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center text-3xl pb-1 hover:scale-110 transition-transform active:scale-90"
    >
      +
    </button>

    <div v-if="showAddForm" class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in-up">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold">新增活動</h3>
          <button @click="showAddForm = false" class="text-slate-400 text-2xl">×</button>
        </div>
        
        <div class="space-y-3">
          <div class="flex gap-2">
            <input v-model="newAct.start_time" placeholder="時間 (09:00)" 
                   class="w-1/3 bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <select v-model="newAct.category" 
                    class="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option>景點</option><option>交通</option><option>餐飲</option><option>住宿</option>
            </select>
          </div>
          <input v-model="newAct.title" placeholder="活動名稱 (如: 淺草寺)" 
                 class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <textarea v-model="newAct.description" placeholder="備註" 
                    class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"></textarea>
          <input v-model="newAct.map_url" placeholder="Google Map 連結" 
                 class="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          
          <button @click="handleAdd" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow-md mt-2">
            確認新增
          </button>
        </div>
      </div>
    </div>
  </div>
</template>