<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'

const router = useRouter()
const trips = ref<any[]>([])
const newTripName = ref('') // 首頁輸入框暫存用
const isLoading = ref(true)
const isEditMode = ref(false)
const user = ref<any>(null)

// Supabase 離線處理變數
const isOffline = ref(!navigator.onLine)

onMounted(() => {
  window.addEventListener('online', () => isOffline.value = false)
  window.addEventListener('offline', () => isOffline.value = true)

  // 檢查登入狀態
  supabase.auth.getSession().then(({ data: { session } }) => {
    user.value = session?.user || null
    isEditMode.value = !!user.value
    if (user.value) {
      fetchTrips()
    } else {
      isLoading.value = false
    }
  })

  // 監聽登入狀態改變
  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user || null
    isEditMode.value = !!user.value
    if (user.value) {
      fetchTrips()
    } else {
      trips.value = []
    }
  })
})

async function login() {
  await supabase.auth.signInWithOAuth({
    provider: 'google'
  })
}

async function logout() {
  await supabase.auth.signOut()
}

// --- 新增行程 Modal 相關變數 ---
const showCreateModal = ref(false)
const createForm = ref({
  name: '',
  subtitle: '',
  start_date: '',
  end_date: ''
})

// 共用樣式 (與 TripDetailView 統一)
const inputClass = "w-full border border-stone-200 bg-stone-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-[#606C38] focus:ring-1 focus:ring-[#606C38] transition-all placeholder:text-stone-400"
const labelClass = "text-xs font-bold text-stone-500 mb-1.5 block tracking-wide"
const modalBtnBase = "flex-1 py-3 rounded-xl font-bold text-sm transition active:scale-95 shadow-sm"
const modalSaveBtn = `${modalBtnBase} bg-[#283618] text-white hover:bg-[#3A5A40]`

// 讀取行程列表
async function fetchTrips() {
  isLoading.value = true
  const { data } = await supabase.from('trips').select('id,name,subtitle,created_at,start_date,end_date').order('created_at', { ascending: false })
  trips.value = data || []
  isLoading.value = false
}

// 格式化日期
function formatDateString(s: string | null | undefined) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const da = d.getDate().toString().padStart(2, '0')
  return `${d.getFullYear()}.${m}.${da}`
}

function displayTripDates(trip: any) {
  if (trip.start_date && trip.end_date) {
    const s = formatDateString(trip.start_date)
    const e = formatDateString(trip.end_date)
    if (s === e) return s
    if (s.slice(0, 4) === e.slice(0, 4)) return `${s} - ${e.slice(5)}`
    return `${s} - ${e}`
  }
  return trip.created_at ? `建立於 ${formatDateString(trip.created_at)}` : ''
}

// 步驟 1: 打開新增視窗
function openCreateModal() {
  createForm.value = {
    name: newTripName.value, 
    subtitle: '',
    start_date: '',
    end_date: ''
  }
  showCreateModal.value = true
}

// 步驟 2: 送出建立請求
async function handleCreateTrip() {
  if (!createForm.value.name.trim()) return alert('請填寫行程名稱')
  if (!user.value) return alert('請先登入')

  const payload = {
    name: createForm.value.name,
    subtitle: createForm.value.subtitle,
    start_date: createForm.value.start_date || null,
    end_date: createForm.value.end_date || null,
    user_id: user.value.id // 明確指定擁有者
  }

  const { data, error } = await supabase.from('trips').insert([payload]).select().single()
  
  if (!error && data) {
    showCreateModal.value = false
    newTripName.value = '' // 清空首頁輸入框
    router.push(`/trip/${data.id}`)
  } else {
    alert('新增失敗: ' + (error?.message || ''))
  }
}

// 跳轉到詳細頁
function goToDetail(id: number) {
  router.push(`/trip/${id}`)
}
</script>

<template>
  <div class="min-h-screen bg-[#FDFCF8] p-6 font-sans text-stone-700 tracking-normal">
    <div class="max-w-md mx-auto pt-4">
      
  <div class="mb-8 pl-1 flex justify-between items-end">
      <div>
          <h1 class="text-3xl font-extrabold text-[#283618] tracking-wide mb-1">我的旅程 <span class="text-2xl align-middle">✈️</span></h1>
          <p class="text-stone-500 text-sm font-medium">
              規劃下一場精采的冒險
          </p>
      </div>
      
      <button v-if="user" @click="logout" class="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-sm font-bold transition">
          登出
      </button>
      <button v-else @click="login" class="px-4 py-2 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/></svg>
          Google 登入
      </button>
  </div>
      
  <div v-if="user" class="bg-white p-2 rounded-2xl shadow-lg shadow-stone-200/50 mb-10 flex gap-2 items-center border border-stone-100 animate-in fade-in zoom-in duration-300">
      <div class="flex-1 relative">
          <span class="absolute left-3 top-3 text-lg opacity-50">📝</span>
          <input 
              v-model="newTripName" 
              placeholder="輸入行程名稱" 
              class="w-full bg-stone-50 border border-transparent rounded-xl pl-10 pr-4 py-3 outline-none text-stone-700 placeholder:text-stone-400 focus:bg-white focus:border-[#606C38] focus:ring-1 focus:ring-[#606C38] transition-all font-medium text-sm"
              @keyup.enter="openCreateModal"
          />
      </div>
      <button @click="openCreateModal" class="bg-[#283618] text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-[#3A5A40] active:scale-95 transition-all text-sm whitespace-nowrap">
          新增
      </button>
  </div>

  <div v-else class="mb-6 p-4 bg-[#E8F0FE] rounded-2xl border border-[#D2E3FC] text-[#1967D2] text-sm font-medium flex items-center gap-3">
      <span>👋</span>
      請先使用 Google 登入，即可開始規劃並管理您的專屬行程。
  </div>

      <div v-if="isLoading" class="text-center py-12">
          <div class="text-3xl animate-bounce mb-2">🌏</div>
          <p class="text-stone-400 text-sm font-medium">正在載入您的旅程...</p>
      </div>
      
      <div v-else-if="user" class="space-y-4 pb-20">
        <div v-for="trip in trips" :key="trip.id" 
             @click="goToDetail(trip.id)"
             class="group bg-white p-5 rounded-2xl shadow-sm border border-stone-100 cursor-pointer hover:shadow-md hover:border-[#D4A373] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
             
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#D4A373] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div class="flex justify-between items-center pl-2">
              <div>
                  <h2 class="text-lg font-bold text-[#283618] group-hover:text-[#606C38] transition-colors tracking-wide">{{ trip.name }}</h2>
                  <p v-if="trip.subtitle" class="text-xs text-stone-500 font-medium mt-0.5">{{ trip.subtitle }}</p>
                  <div class="flex items-center gap-1 mt-2 text-xs text-stone-400 font-medium font-mono">
                      <span>📅</span>
                      <span>{{ displayTripDates(trip) || '尚未設定日期' }}</span>
                  </div>
              </div>
              <div class="text-stone-300 text-2xl group-hover:text-[#D4A373] group-hover:translate-x-1 transition-all">
                  ›
              </div>
          </div>
        </div>

        <div v-if="trips.length === 0" class="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
            <div class="text-4xl mb-3 opacity-30">🗺️</div>
            <p class="text-stone-400 text-sm font-medium mb-1">還沒有任何行程</p>
            <p class="text-stone-300 text-xs">在上方輸入名稱開始規劃吧！</p>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]" @click.self="showCreateModal = false">
        <div class="bg-[#FDFCF8] w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div class="flex justify-between mb-6 items-center border-b border-stone-100 pb-3">
                <h3 class="font-bold text-lg text-[#283618] tracking-wide">建立新行程</h3>
                <button @click="showCreateModal=false" class="text-2xl text-stone-400 hover:text-stone-600 transition">×</button>
            </div>
            <div class="space-y-5">
                <div>
                    <label :class="labelClass">行程名稱 <span class="text-red-400">*</span></label>
                    <input v-model="createForm.name" placeholder="例如: 2026 北海道滑雪" :class="inputClass" class="font-bold" />
                </div>
                <div>
                    <label :class="labelClass">副標題 (選填)</label>
                    <input v-model="createForm.subtitle" placeholder="例如: 吃爆海鮮之旅" :class="inputClass" />
                </div>
                <div class="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                    <div>
                        <label :class="labelClass">開始日期</label>
                        <input type="date" v-model="createForm.start_date" :class="inputClass" />
                    </div>
                    <div>
                        <label :class="labelClass">結束日期</label>
                        <input type="date" v-model="createForm.end_date" :class="inputClass" />
                    </div>
                </div>

                <div class="flex gap-3 mt-8 pt-2">
                    <button @click="handleCreateTrip" :class="modalSaveBtn">確認建立</button>
                </div>
            </div>
        </div>
    </div>

  </div>
</template>
