<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { friendlyError } from '../lib/errorMessage'
import { getTripStatus, parseLocalDate } from '../lib/tripStatus'
import { Luggage, BellRing, Map as MapIcon } from 'lucide-vue-next'

const router = useRouter()
const trips = ref<any[]>([])
const newTripName = ref('') // 首頁輸入框暫存用
const isLoading = ref(true)
const isEditMode = ref(false)
const user = ref<any>(null)
const fetchError = ref('')

// Supabase 離線處理變數
const isOffline = ref(!navigator.onLine)
const setOnline = () => { isOffline.value = false }
const setOffline = () => { isOffline.value = true }

// 登入狀態監聽 (離開頁面時要取消，否則每次回首頁都會多一組監聽、多發一次請求)
let authSubscription: { unsubscribe: () => void } | null = null

onMounted(() => {
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)

  // onAuthStateChange 訂閱時會立刻送出 INITIAL_SESSION，不需要再另外呼叫 getSession
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const prevId = user.value?.id
    user.value = session?.user || null
    isEditMode.value = !!user.value
    if (!user.value) {
      trips.value = []
      isLoading.value = false
      return
    }
    // TOKEN_REFRESHED 等事件不需要重抓；只有初次載入或換帳號時才抓
    // (Supabase 建議不要在 callback 內直接 await 其他 supabase 呼叫，所以延後執行)
    if (event === 'INITIAL_SESSION' || prevId !== user.value.id) {
      setTimeout(fetchTrips, 0)
    }
  })
  authSubscription = data.subscription
})

onUnmounted(() => {
  window.removeEventListener('online', setOnline)
  window.removeEventListener('offline', setOffline)
  authSubscription?.unsubscribe()
})

async function login() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + import.meta.env.BASE_URL
    }
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

// 讀取行程列表
async function fetchTrips() {
  isLoading.value = true
  fetchError.value = ''
  const { data, error } = await supabase.from('trips').select('id,name,subtitle,created_at,start_date,end_date').order('created_at', { ascending: false })
  if (error) {
    // 保留上次成功的列表，只顯示錯誤提示
    fetchError.value = isOffline.value ? '目前離線，無法更新行程列表。' : friendlyError(error.message)
  } else {
    trips.value = data || []
  }
  isLoading.value = false
}

// 首頁卡片上的倒數文字
function tripStatus(trip: any) {
  return getTripStatus(trip.start_date, trip.end_date)
}

// 格式化日期
function formatDateString(s: string | null | undefined) {
  const d = parseLocalDate(s)
  if (!d) return ''
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

// 刊頭期號 (例如 2026 秋季號)
const issueLabel = (() => {
  const d = new Date()
  const season = ['冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬', '冬'][d.getMonth()]
  return `${d.getFullYear()} ${season}季號`
})()

// 行程天數 (例如 5 天)
function tripDays(trip: any) {
  if (!trip.start_date || !trip.end_date) return 0
  const diff = new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()
  return isNaN(diff) ? 0 : Math.round(diff / 86400000) + 1
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
    alert('新增失敗: ' + friendlyError(error?.message))
  }
}

// 跳轉到詳細頁
function goToDetail(id: number | string) {
  router.push(`/trip/${id}`)
}
</script>

<template>
  <div class="min-h-dvh px-5 pb-24 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-8">
    <div class="mx-auto max-w-xl">

      <!-- 刊頭 -->
      <header class="animate-fade">
        <div class="flex items-center justify-between pb-3">
          <span class="font-display text-lg font-black tracking-wider text-ink">空姐叫我</span>
          <div class="flex items-center gap-3">
            <span class="eyebrow hidden sm:inline">旅行手帖 · {{ issueLabel }}</span>
            <button v-if="user" @click="logout" class="btn-ghost !px-4 !py-1.5 !text-xs">登出</button>
          </div>
        </div>
        <div class="h-[3px] bg-ink"></div>
        <div class="mt-[3px] hairline"></div>
      </header>

      <!-- Hero -->
      <section class="pb-12 pt-12 sm:pt-16">
        <p class="eyebrow mb-4 animate-rise">
          {{ isOffline ? '目前離線 · 顯示上次的資料' : 'TRAVEL JOURNAL' }}
        </p>
        <h1 class="font-display text-[clamp(2.6rem,11vw,4.25rem)] font-black leading-[1.15] tracking-tight text-ink animate-rise" style="animation-delay: 80ms">
          把壓力，<br />丟在不同時區<span class="text-flare">。</span>
        </h1>

        <!-- 航線裝飾 -->
        <div class="mt-9 flex items-center gap-3 animate-rise" style="animation-delay: 160ms" aria-hidden="true">
          <span class="font-mono text-xs font-medium text-ink">TPE</span>
          <span class="h-2 w-2 rounded-full border-2 border-ink"></span>
          <div class="relative flex-1 border-t-2 border-dashed border-ink/25">
            <span class="plane-glide absolute -top-[11px] text-base leading-none text-flare">✈</span>
          </div>
          <span class="h-2 w-2 rounded-full bg-flare"></span>
          <span class="font-mono text-xs font-medium text-flare">ANYWHERE</span>
        </div>
      </section>

      <!-- 已登入：新增行程輸入列 -->
      <div v-if="user" class="card mb-14 flex items-center gap-2 !rounded-full p-1.5 pl-5 animate-rise" style="animation-delay: 220ms">
        <Luggage class="h-5 w-5 shrink-0 text-ink-soft" :stroke-width="1.75" aria-hidden="true" />
        <input
          v-model="newTripName"
          placeholder="下一趟要去哪裡？"
          class="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
          @keyup.enter="openCreateModal"
        />
        <button @click="openCreateModal" class="btn-primary">新增行程</button>
      </div>

      <!-- 未登入：呼叫鈴 + 範例 -->
      <div v-else-if="!isLoading">
        <div class="card mb-14 overflow-hidden p-7 animate-rise" style="animation-delay: 220ms">
          <div class="stamp absolute -right-3 -top-3 h-24 w-24 rotate-12 opacity-30" aria-hidden="true">
            <span class="font-display text-xs font-bold">AIR MAIL</span>
          </div>
          <p class="font-display mb-2 text-xl font-bold text-ink">登機前的準備</p>
          <p class="relative mb-6 text-sm leading-relaxed text-ink-soft">
            登入即可解鎖完整的行程規劃、共同編輯與智慧分帳功能，開始您的專屬旅程。
          </p>
          <button @click="login" class="btn-primary !px-7 !py-3 !text-base">
            <BellRing class="h-4 w-4" :stroke-width="2" aria-hidden="true" /> 按下呼叫鈴
          </button>
        </div>

        <div class="mb-2 flex items-baseline justify-between">
          <h2 class="font-display text-sm font-bold tracking-widest text-ink">範例行程</h2>
          <span class="eyebrow">SAMPLE</span>
        </div>
        <div class="hairline"></div>
        <div class="stagger">
          <article @click="goToDetail('demo-korea')" class="group flex cursor-pointer items-center gap-5 border-b border-ink/12 py-6 transition-colors hover:bg-paper-deep/40">
            <span class="font-display w-10 shrink-0 text-3xl font-black italic text-flare">00</span>
            <div class="min-w-0 flex-1">
              <h3 class="font-display text-xl font-bold text-ink transition-colors group-hover:text-flare">🇰🇷 首爾 5 天 4 夜自由行</h3>
              <p class="mt-1 text-sm text-muted">吃爆烤肉與逛街之旅 (範例)</p>
              <p class="mt-2 font-mono text-xs text-ink-soft">2026.04.01 — 04.05</p>
            </div>
            <div class="stamp h-16 w-16 -rotate-6 transition-transform duration-500 group-hover:rotate-0">
              <span class="font-display text-xl font-black leading-none">5</span>
              <span class="text-[9px] font-bold">DAYS</span>
            </div>
          </article>
        </div>
      </div>

      <!-- 載入中：骨架 -->
      <div v-if="isLoading" class="space-y-4" aria-label="正在載入您的旅程">
        <div v-for="n in 3" :key="n" class="card h-28 overflow-hidden">
          <div class="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"></div>
        </div>
        <p class="eyebrow pt-2 text-center">正在整理您的旅程…</p>
      </div>

      <!-- 已登入：行程目錄 -->
      <div v-else-if="user" class="pb-10">
        <div v-if="fetchError" class="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-alert/30 bg-alert/5 px-4 py-3 animate-rise" role="alert">
          <p class="text-sm text-alert">{{ fetchError }}</p>
          <button @click="fetchTrips" class="btn-ghost !px-3 !py-1.5 !text-xs shrink-0">重試</button>
        </div>
        <div class="mb-2 flex items-baseline justify-between">
          <h2 class="font-display text-sm font-bold tracking-widest text-ink">我的旅程</h2>
          <span class="eyebrow">共 {{ trips.length }} 趟</span>
        </div>
        <div class="hairline"></div>

        <div class="stagger">
          <article
            v-for="(trip, idx) in trips"
            :key="trip.id"
            :style="{ '--i': idx }"
            @click="goToDetail(trip.id)"
            class="group flex cursor-pointer items-center gap-5 border-b border-ink/12 py-6 transition-colors hover:bg-paper-deep/40"
          >
            <span class="font-display w-10 shrink-0 text-3xl font-black italic text-flare">{{ (trips.length - idx).toString().padStart(2, '0') }}</span>
            <div class="min-w-0 flex-1">
              <h3 class="font-display text-xl font-bold break-all text-ink transition-colors group-hover:text-flare">{{ trip.name }}</h3>
              <p v-if="trip.subtitle" class="mt-1 text-sm text-muted">{{ trip.subtitle }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="font-mono text-xs text-ink-soft">{{ displayTripDates(trip) || '尚未設定日期' }}</span>
                <span
                  v-if="tripStatus(trip).phase === 'ongoing'"
                  class="inline-flex items-center gap-1 rounded-full bg-flare px-2.5 py-0.5 text-[11px] font-bold text-card"
                >
                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-card"></span>{{ tripStatus(trip).label }}
                </span>
                <span v-else-if="tripStatus(trip).phase === 'upcoming'" class="tag !border-flare/40 !text-flare">{{ tripStatus(trip).label }}</span>
              </div>
            </div>
            <div v-if="tripDays(trip)" class="stamp h-16 w-16 -rotate-6 transition-transform duration-500 group-hover:rotate-0">
              <span class="font-display text-xl font-black leading-none">{{ tripDays(trip) }}</span>
              <span class="text-[9px] font-bold">DAYS</span>
            </div>
            <span v-else class="text-xl text-faint transition-all group-hover:translate-x-1 group-hover:text-flare">→</span>
          </article>
        </div>

        <div v-if="trips.length === 0 && !fetchError" class="mt-6 flex flex-col items-center rounded-2xl border-2 border-dashed border-ink/15 py-14 text-center animate-rise">
          <MapIcon class="mb-4 h-10 w-10 text-faint" :stroke-width="1.5" aria-hidden="true" />
          <p class="font-display text-lg font-bold text-ink">還沒有任何行程</p>
          <p class="mt-1 text-sm text-muted">在上方輸入名稱，開始規劃第一趟旅程</p>
        </div>
      </div>
    </div>

    <!-- 建立行程 Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-panel">
        <div class="mb-6 flex items-start justify-between">
          <div>
            <p class="eyebrow mb-1">NEW TRIP</p>
            <h3 class="font-display text-2xl font-bold text-ink">建立新行程</h3>
          </div>
          <button @click="showCreateModal = false" class="btn-icon" aria-label="關閉">✕</button>
        </div>
        <div class="space-y-5">
          <div>
            <label class="field-label">行程名稱 <span class="text-flare">*</span></label>
            <input v-model="createForm.name" placeholder="例如: 2026 北海道滑雪" class="field font-bold" />
          </div>
          <div>
            <label class="field-label">副標題 (選填)</label>
            <input v-model="createForm.subtitle" placeholder="例如: 吃爆海鮮之旅" class="field" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="field-label">開始日期</label>
              <input type="date" v-model="createForm.start_date" class="field" />
            </div>
            <div>
              <label class="field-label">結束日期</label>
              <input type="date" v-model="createForm.end_date" class="field" />
            </div>
          </div>
          <button @click="handleCreateTrip" class="btn-primary mt-4 w-full !py-3.5">確認建立</button>
        </div>
      </div>
    </div>
  </div>
</template>
