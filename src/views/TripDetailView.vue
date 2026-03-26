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
  const sharedEmails = ref<string[]>([])
  const isEditMode = ref(false)
  const selectedDate = ref('')
  
  // 參與者管理 Modal 狀態
  const showMembersModal = ref(false)
  const newMemberName = ref('')
  const newMemberEmail = ref('')

  // 用於獲取子組件資料以計算日期標籤
  const itineraryRef = ref<any>(null)
  const attractionRef = ref<any>(null)

  function goBack() {
    router.push('/')
  }

  async function handleAddMember() {
      if (!newMemberName.value.trim()) return alert('請輸入名稱')
      
      const updatedMembers = [...tripMembers.value, newMemberName.value.trim()]
      const updatedEmails = newMemberEmail.value.trim() 
          ? [...sharedEmails.value, newMemberEmail.value.trim()] 
          : sharedEmails.value

      const payload: any = { members: updatedMembers }
      if (newMemberEmail.value.trim()) {
          payload.shared_emails = updatedEmails
      }

      const { error } = await supabase.from('trips').update(payload).eq('id', tripId)
      if (error) {
          alert('新增失敗: ' + error.message)
      } else {
          tripMembers.value = updatedMembers
          sharedEmails.value = updatedEmails
          newMemberName.value = ''
          newMemberEmail.value = ''
      }
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
    // 檢查登入狀態
    const { data: { session } } = await supabase.auth.getSession()
    isEditMode.value = !!session?.user

    if (tripId === 'demo-korea') {
        tripName.value = '🇰🇷 首爾 5 天 4 夜自由行'
        subtitleRaw.value = '吃爆烤肉與逛街之旅 (範例)'
        startDateRaw.value = '2026-04-01'
        tripDates.value = '4月1日 - 4月5日'
        tripMembers.value = ['小美', '大壯', '阿明']
        sharedEmails.value = []
        isEditMode.value = false // 範例不可編輯
        return
    }

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (trip) {
        tripName.value = trip.name
        subtitleRaw.value = trip.subtitle || ''
        startDateRaw.value = trip.start_date
        tripMembers.value = trip.members || []
        sharedEmails.value = trip.shared_emails || []
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
    <div class="px-4 py-4 flex items-center justify-between">
        <button @click="goBack" class="flex items-center gap-1 text-[#606C38] font-bold hover:text-[#283618] transition">
            <span class="text-xl">‹</span> 返回列表
        </button>
        <button v-if="isEditMode" @click="showMembersModal = true" class="text-sm font-bold text-[#283618] bg-[#E9EDC9] px-4 py-2 rounded-xl shadow-sm hover:bg-[#D4A373] hover:text-white transition">
            👥 參與者
        </button>
    </div>

    <!-- 旅行資訊 banner (擬真行李吊牌樣式) -->
    <div class="relative mb-10 mx-6">
      <!-- 模擬皮線/掛繩 -->
      <div class="absolute -top-6 left-12 w-1 h-12 bg-[#8B4513] rounded-full -rotate-12 z-0 shadow-sm"></div>
      <div class="absolute -top-8 left-10 w-4 h-4 rounded-full border-2 border-[#8B4513] -rotate-12 z-0"></div>

      <!-- 行利吊牌本體 -->
      <div class="relative bg-gradient-to-r from-[#606C38] to-[#283618] rounded-r-3xl rounded-l-lg p-6 pl-14 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] drop-shadow-lg transform -rotate-1 transition-transform hover:rotate-0">
        <!-- 吊牌孔 -->
        <div class="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#F5E6D3] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center">
          <div class="w-4 h-4 bg-stone-800/20 rounded-full border border-stone-400/30"></div>
        </div>

        <!-- 吊牌內容 -->
        <div class="border-l-2 border-white/20 pl-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-black tracking-[0.2em] text-[#E9EDC9]/60 uppercase">Priority / Seoul Bound</span>
          </div>
          <h1 class="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{{ tripName }}</h1>
          <div class="flex items-center gap-3 mt-2">
            <div class="flex flex-col">
              <span class="text-[10px] text-[#E9EDC9]/70 font-bold uppercase tracking-wider">Date / Period</span>
              <p class="text-sm font-mono font-bold text-white">{{ tripDates }}</p>
            </div>
            <div v-if="subtitleRaw" class="w-px h-8 bg-white/20 mx-1"></div>
            <div v-if="subtitleRaw" class="flex flex-col">
              <span class="text-[10px] text-[#E9EDC9]/70 font-bold uppercase tracking-wider">Remarks</span>
              <p class="text-sm font-medium text-white/90 truncate max-w-[150px]">{{ subtitleRaw }}</p>
            </div>
          </div>
        </div>

        <!-- 條碼裝飾 (增加航旅質感) -->
        <div class="absolute right-6 bottom-4 opacity-30 flex gap-[1px] h-8 items-end">
          <div class="w-0.5 h-6 bg-white"></div>
          <div class="w-1 h-8 bg-white"></div>
          <div class="w-0.5 h-4 bg-white"></div>
          <div class="w-0.5 h-7 bg-white"></div>
          <div class="w-1.5 h-5 bg-white"></div>
          <div class="w-0.5 h-8 bg-white"></div>
          <div class="w-1 h-6 bg-white"></div>
          <div class="w-0.5 h-7 bg-white"></div>
        </div>
      </div>
    </div>

    <!-- 頂部功能導覽 -->
    <nav class="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 mb-6 mx-4 flex justify-between px-2 py-2 z-20 sticky top-4">
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

    <!-- 參與者管理 Modal -->
    <div v-if="showMembersModal" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]" @click.self="showMembersModal = false">
        <div class="bg-[#FDFCF8] w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div class="flex justify-between mb-4 items-center border-b border-stone-100 pb-3">
                <h3 class="font-bold text-lg text-[#283618] tracking-wide flex items-center gap-2">👥 參與者管理</h3>
                <button @click="showMembersModal=false" class="text-2xl text-stone-400 hover:text-stone-600 transition">×</button>
            </div>
            
            <div class="mb-4">
                <p class="text-xs font-bold text-stone-500 mb-2">目前參與者</p>
                <div class="flex flex-wrap gap-2">
                    <span v-for="member in tripMembers" :key="member" class="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-sm font-bold border border-stone-200">
                        {{ member }}
                    </span>
                    <span v-if="tripMembers.length === 0" class="text-xs text-stone-400">尚無其他參與者</span>
                </div>
            </div>

            <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-sm mt-6">
                <p class="text-sm font-bold text-[#606C38] mb-3">新增參與者</p>
                <div class="space-y-3">
                    <div>
                        <label class="text-xs font-bold text-stone-500 mb-1 block">顯示名稱 *</label>
                        <input v-model="newMemberName" placeholder="例如: 小明" class="w-full border border-stone-200 bg-stone-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#606C38]" />
                    </div>
                    <div>
                        <label class="text-xs font-bold text-stone-500 mb-1 block">對方登入的 Email (供共用權限，選填)</label>
                        <input v-model="newMemberEmail" type="email" placeholder="例如: ming@example.com" class="w-full border border-stone-200 bg-stone-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#606C38]" />
                    </div>
                    <button @click="handleAddMember" class="w-full py-2.5 mt-2 bg-[#283618] text-white rounded-xl font-bold text-sm hover:bg-[#3A5A40] transition active:scale-95">新增並賦予權限</button>
                </div>
            </div>
            <p class="text-[10px] text-stone-400 mt-4 leading-relaxed">
                提示：若填寫對方的 Google 登入 Email，並在資料庫正確設定權限後，對方即可在首頁看到並共同編輯此行程。
            </p>
        </div>
    </div>

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