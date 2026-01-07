<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'

const router = useRouter()
const trips = ref<any[]>([])
const newTripName = ref('')
const isLoading = ref(true)

// 讀取行程列表
async function fetchTrips() {
  isLoading.value = true
  const { data } = await supabase.from('trips').select('*').order('created_at', { ascending: false })
  trips.value = data || []
  isLoading.value = false
}

// 新增行程
async function addTrip() {
  if (!newTripName.value.trim()) return
  const { error } = await supabase.from('trips').insert([{ name: newTripName.value }])
  if (!error) {
    newTripName.value = ''
    fetchTrips()
  } else {
    alert('新增失敗(請檢查RLS權限): ' + error.message)
  }
}

// 跳轉到詳細頁
function goToDetail(id: number) {
  router.push(`/trip/${id}`)
}

onMounted(fetchTrips)
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-6 font-sans">
    <div class="max-w-md mx-auto">
      <h1 class="text-3xl font-black text-blue-600 mb-6">我的旅程 ✈️</h1>
      
      <div class="bg-white p-2 rounded-2xl shadow-sm mb-8 flex gap-2">
        <input 
          v-model="newTripName" 
          placeholder="建立新行程 (如: 2026 日本行)" 
          class="flex-1 bg-transparent px-4 py-2 outline-none text-slate-700"
          @keyup.enter="addTrip"
        />
        <button 
          @click="addTrip"
          class="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all"
        >
          新增
        </button>
      </div>

      <div v-if="isLoading" class="text-center text-slate-400 py-10">載入中...</div>
      
      <div v-else class="space-y-4">
        <div v-for="trip in trips" :key="trip.id" 
             @click="goToDetail(trip.id)"
             class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
          <h2 class="text-xl font-bold text-slate-800">{{ trip.name }}</h2>
          <p class="text-xs text-slate-400 mt-1">{{ new Date(trip.created_at).toLocaleDateString() }}</p>
        </div>
      </div>
    </div>
  </div>
</template>