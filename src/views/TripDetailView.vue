<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { supabase } from '../lib/supabaseClient'
  
  // 引入新拆分的組件
  import ItineraryTab from '../components/trip/ItineraryTab.vue'
  import AttractionTab from '../components/trip/AttractionTab.vue'
  import AccommodationTab from '../components/trip/AccommodationTab.vue'
  import ExpenseTab from '../components/trip/ExpenseTab.vue'

  const route = useRoute()
  const router = useRouter()
  const tripId = route.params.id as string
  
  // --- 共用變數 ---
  const tripName = ref('讀取中...')
  const activeTab = ref('itinerary')
  const tripDates = ref('')
  const subtitleRaw = ref('')
  const startDateRaw = ref('')
  const tripMembers = ref<string[]>([])
  const isEditMode = ref(false)
  const selectedDate = ref('')

  // 用於獲取子組件資料以計算日期標籤
  const itineraryRef = ref<any>(null)
  const attractionRef = ref<any>(null)

  function goBack() {
    router.push('/')
  }

  // 計算所有出現過的日期，用於頂部頁籤
  const uniqueDates = computed(() => {
    const actDates = itineraryRef.value?.activities?.map((a: any) => a.date) || []
    const attrDates = attractionRef.value?.attractions?.map((a: any) => a.date) || []
    return [...new Set([...actDates, ...attrDates])].filter(Boolean).sort() as string[]
  })

  // 當行程存檔後，更新選中日期
  function onActivitySaved(date: string) {
    selectedDate.value = date
  }

  async function loadData() {
    // 檢查管理員權限 
    isEditMode.value = localStorage.getItem('trip_admin_access') === 'true'

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (trip) {
        tripName.value = trip.name
        subtitleRaw.value = trip.subtitle || ''
        startDateRaw.value = trip.start_date
        tripMembers.value = trip.members || []
        if (trip.start_date && trip.end_date) {
            const f = (s: string) => { const d = new Date(s); return `${d.getMonth()+1}月${d.getDate()}日` }
            tripDates.value = `${f(trip.start_date)} - ${f(trip.end_date)}`
        }
    }
  }
  
  onMounted(loadData)
</script>
  
<template>
  <div class="min-h-screen bg-[#FDFCF8] pb-24 font-sans text-stone-700">
    <!-- 返回列表 -->
    <div class="px-4 py-2 flex items-center">
        <button @click="goBack" class="flex items-center gap-1 text-[#606C38] font-bold hover:text-[#283618] transition">
            <span class="text-lg">‹</span> 返回列表
        </button>
    </div>

    <!-- 旅行資訊 banner -->
    <div class="banner rounded-2xl overflow-hidden mb-4 mx-4 shadow-lg shadow-stone-200 bg-gradient-to-r from-[#606C38] to-[#283618]">
      <div class="p-6 text-white">
        <h1 class="text-xl font-extrabold tracking-wide">{{ tripName }}</h1>
        <p class="text-sm opacity-90 mt-1 font-medium">{{ tripDates }} <span v-if="subtitleRaw">| {{ subtitleRaw }}</span></p>
      </div>
    </div>

    <!-- 頂部功能導覽 -->
    <nav class="bg-white rounded-2xl shadow-sm border border-stone-100 mb-4 mx-4 flex justify-between px-3 py-2 z-20">
      <button class="tab" :class="{ active: activeTab==='itinerary' }" @click="activeTab='itinerary'"><div class="icon">🗓️</div><div class="label">行程</div></button>
      <button class="tab" :class="{ active: activeTab==='attractions' }" @click="activeTab='attractions'"><div class="icon">📍</div><div class="label">景點</div></button>
      <button class="tab" :class="{ active: activeTab==='accommodation' }" @click="activeTab='accommodation'"><div class="icon">🛏️</div><div class="label">住宿</div></button>
      <button class="tab" :class="{ active: activeTab==='expenses' }" @click="activeTab='expenses'"><div class="icon">💰</div><div class="label">記帳</div></button>
    </nav>

    <!-- 日期篩選頁籤 (僅在行程與景點頁面顯示) -->
    <div v-if="activeTab === 'itinerary' || activeTab === 'attractions'" class="z-10 bg-[#FDFCF8]/95 backdrop-blur-sm border-b border-stone-200 pt-2 mb-4">
        <div class="flex overflow-x-auto px-4 pb-3 gap-3 no-scrollbar">
            <button @click="selectedDate = ''" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm border" :class="selectedDate === '' ? 'bg-[#283618] text-white border-[#283618]' : 'bg-white text-stone-500 border-stone-200 hover:border-[#606C38]'">
                全部
            </button>
            <button v-for="date in uniqueDates" :key="date" @click="selectedDate = date" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm border" :class="selectedDate === date ? 'bg-[#283618] text-white border-[#283618]' : 'bg-white text-stone-500 border-stone-200 hover:border-[#606C38]'">
                {{ date.slice(5) }}
            </button>
        </div>
    </div>

    <!-- 各模組內容 -->
    <ItineraryTab 
      v-show="activeTab === 'itinerary'" 
      ref="itineraryRef"
      :trip-id="tripId" 
      :is-edit-mode="isEditMode" 
      :selected-date="selectedDate"
      :start-date-raw="startDateRaw"
      @activity-saved="onActivitySaved"
    />

    <AttractionTab 
      v-show="activeTab === 'attractions'" 
      ref="attractionRef"
      :trip-id="tripId" 
      :is-edit-mode="isEditMode" 
      :selected-date="selectedDate"
      :start-date-raw="startDateRaw"
    />

    <AccommodationTab 
      v-show="activeTab === 'accommodation'" 
      :trip-id="tripId" 
      :is-edit-mode="isEditMode" 
    />

    <ExpenseTab 
      v-show="activeTab === 'expenses'" 
      :trip-id="tripId" 
      :is-edit-mode="isEditMode" 
      :trip-members="tripMembers"
      :selected-date="selectedDate"
    />

  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.tab { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; background:transparent; border:none; padding:6px 8px; border-radius:12px; color:#a8a29e; cursor: pointer; transition: all 0.2s; }
.tab .icon { font-size:18px; margin-bottom: 2px; }
.tab .label { font-size:12px; font-weight: 500; }
.tab.active { background: #E9EDC9; color:#283618; box-shadow:0 1px 2px rgba(0,0,0,0.05); transform: translateY(-1px); }
</style>