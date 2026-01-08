<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { supabase } from '../lib/supabaseClient'
  
  const route = useRoute()
  const tripId = route.params.id
  const activities = ref<any[]>([])
  const tripName = ref('讀取中...')
  const activeTab = ref('itinerary')
  const tripDates = ref('')
  const subtitleRaw = ref('')
  const editingSubtitle = ref(false)
  const editingBanner = ref(false)
  const startDateRaw = ref('')
  const endDateRaw = ref('')
  const selectedDate = ref('') // 目前選中的日期
  const initialMaxId = ref(0) // 記錄初始載入時的最大 id，用於區分新舊行程
  
  // 1. 計算出所有有行程的日期 (不重複)
  const uniqueDates = computed(() => {
    const dates = activities.value.map(a => a.date).filter(Boolean)
    // 去除重複並排序
    return [...new Set(dates)].sort()
  })
  
  // 2. 根據選中日期過濾顯示的活動，並確保新增行程出現在現有行程下方
  const filteredActivities = computed(() => {
    let filtered = activities.value
    if (selectedDate.value) {
      filtered = activities.value.filter(a => a.date === selectedDate.value)
    }
    // 排序：先按時間排序現有行程，然後新建立的行程（id > initialMaxId）一律排在最後
    return filtered.sort((a, b) => {
      const aIsNew = a.id > initialMaxId.value
      const bIsNew = b.id > initialMaxId.value
      
      // 如果其中一個是新建立的，新建立的排在最後
      if (aIsNew && !bIsNew) return 1
      if (!aIsNew && bIsNew) return -1
      
      // 如果都是新建立的或都不是新建立的，按時間排序
      if (a.start_time && b.start_time) {
        const timeCompare = a.start_time.localeCompare(b.start_time)
        if (timeCompare !== 0) return timeCompare
      } else if (a.start_time && !b.start_time) {
        return -1
      } else if (!a.start_time && b.start_time) {
        return 1
      }
      // 時間相同或都沒有時間時，按 id 排序
      return a.id - b.id
    })
  })
  
  // 3. 載入資料
  async function loadData() {
    // 抓行程名稱、日期與副標題
    const { data: trip } = await supabase.from('trips').select('name, start_date, end_date, subtitle').eq('id', tripId).single()
    if (trip) {
      tripName.value = trip.name
      subtitleRaw.value = trip.subtitle || ''
      startDateRaw.value = trip.start_date || ''
      endDateRaw.value = trip.end_date || ''
      if (trip.start_date && trip.end_date) {
        const f = (s: string) => { const d = new Date(s); return `${d.getMonth()+1}月${d.getDate()}日` }
        tripDates.value = `${f(trip.start_date)} - ${f(trip.end_date)}`
      }
    }
  
    // 抓所有活動
    const { data } = await supabase.from('activities')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true })       // 先按日期排
      .order('start_time', { ascending: true }) // 再按時間排
    
    activities.value = data || []
    
    // 只在第一次載入時記錄最大 id，用於區分新舊行程
    // 這樣在當前會話中新增的行程（id > initialMaxId）會一直排在最後
    if (initialMaxId.value === 0 && activities.value.length > 0) {
      initialMaxId.value = Math.max(...activities.value.map(a => a.id))
    }
  
    // 如果目前沒選日期，且有資料，預設選第一天
    if (!selectedDate.value && uniqueDates.value.length > 0) {
      selectedDate.value = uniqueDates.value[0]
    }
  }
  
  // 4. 新增/編輯表單
  const showForm = ref(false)
  const isEditing = ref(false)
  const editingActivityId = ref<number | null>(null)
  const formData = ref({
    title: '',
    date: '', 
    start_time: '',
    category: '景點',
    description: '',
    map_url: ''
  })
  
  // 打開新增表單
  function openAddForm() {
    isEditing.value = false
    editingActivityId.value = null
    formData.value = {
      title: '',
      date: selectedDate.value, // 預設為當前分頁的日期
      start_time: '',
      category: '景點',
      description: '',
      map_url: ''
    }
    showForm.value = true
  }
  
  // 打開編輯表單（點擊卡片時）
  function openEditForm(activity: any) {
    isEditing.value = true
    editingActivityId.value = activity.id
    formData.value = {
      title: activity.title || '',
      date: activity.date || '',
      start_time: activity.start_time || '',
      category: activity.category || '景點',
      description: activity.description || '',
      map_url: activity.map_url || ''
    }
    showForm.value = true
  }
  
  // 新增行程
  async function handleAdd() {
    if (!formData.value.title || !formData.value.date) {
      alert('請填寫日期與名稱')
      return
    }
    
    const { error } = await supabase.from('activities').insert([{ ...formData.value, trip_id: tripId }])
    
    if (!error) {
      // 如果新增的日期不是當前選中的，自動切換過去
      selectedDate.value = formData.value.date
      showForm.value = false
      // 清空表單
      formData.value = { title: '', date: '', start_time: '', category: '景點', description: '', map_url: '' }
      loadData()
    } else {
      alert('新增失敗：' + error.message)
    }
  }
  
  // 儲存修改
  async function handleSave() {
    if (!formData.value.title || !formData.value.date) {
      alert('請填寫日期與名稱')
      return
    }
    
    if (!editingActivityId.value) return
    
    const { error } = await supabase
      .from('activities')
      .update({ ...formData.value })
      .eq('id', editingActivityId.value)
    
    if (!error) {
      // 如果修改的日期不是當前選中的，自動切換過去
      selectedDate.value = formData.value.date
      showForm.value = false
      loadData()
    } else {
      alert('修改失敗：' + error.message)
    }
  }
  
  // 刪除行程
  async function handleDelete() {
    if (!editingActivityId.value) return
    
    if (!confirm('確定要刪除這個行程嗎？')) return
    
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', editingActivityId.value)
    
    if (!error) {
      showForm.value = false
      loadData()
    } else {
      alert('刪除失敗：' + error.message)
    }
  }
  
  // 類別圖示
  const getIcon = (cat: string) => {
    if (cat === '交通') return '🚃'
    if (cat === '餐飲') return '🍱'
    if (cat === '住宿') return '🏨'
    return '📍'
  }

  // 儲存行程的開始/結束日期
  async function saveTripDates() {
    if (!startDateRaw.value || !endDateRaw.value) {
      alert('請選擇開始與結束日期')
      return
    }
    if (new Date(startDateRaw.value) > new Date(endDateRaw.value)) {
      alert('開始日期不得晚於結束日期')
      return
    }

    const { error } = await supabase.from('trips').update({ start_date: startDateRaw.value, end_date: endDateRaw.value }).eq('id', tripId)
    if (!error) {
      const f = (s: string) => { const d = new Date(s); return `${d.getMonth()+1}月${d.getDate()}日` }
      tripDates.value = `${f(startDateRaw.value)} - ${f(endDateRaw.value)}`
      // reload activities/dates
      loadData()
    } else {
      alert('儲存失敗：' + error.message)
    }
  }

  // 儲存自訂副標題
  async function saveSubtitle() {
    const { error } = await supabase.from('trips').update({ subtitle: subtitleRaw.value }).eq('id', tripId)
    if (!error) {
      editingSubtitle.value = false
    } else {
      alert('儲存副標題失敗：' + error.message)
    }
  }

  function cancelEditSubtitle() {
    editingSubtitle.value = false
    // reload subtitle from server in case it changed
    loadData()
  }

  // 儲存 banner（包含開始/結束日期與副標題）
  async function saveBanner() {
    if (!startDateRaw.value || !endDateRaw.value) {
      alert('請選擇開始與結束日期')
      return
    }
    if (new Date(startDateRaw.value) > new Date(endDateRaw.value)) {
      alert('開始日期不得晚於結束日期')
      return
    }

    const { error } = await supabase.from('trips').update({ start_date: startDateRaw.value, end_date: endDateRaw.value, subtitle: subtitleRaw.value }).eq('id', tripId)
    if (!error) {
      const f = (s: string) => { const d = new Date(s); return `${d.getMonth()+1}月${d.getDate()}日` }
      tripDates.value = `${f(startDateRaw.value)} - ${f(endDateRaw.value)}`
      editingBanner.value = false
      loadData()
    } else {
      alert('儲存失敗：' + error.message)
    }
  }

  function cancelBannerEdit() {
    editingBanner.value = false
    loadData()
  }
  
  onMounted(loadData)
  </script>
  
  <template>
    <div class="min-h-screen bg-slate-50 pb-24 font-sans">

      <div class="banner rounded-2xl overflow-hidden mb-4 mx-4">
        <div class="banner-inner p-5 text-white">
          <h1 class="banner-title">{{ tripName }}</h1>
          <div class="mt-2">
            <div v-if="!editingBanner" class="flex items-center gap-3">
              <p class="banner-sub">{{ tripDates ? tripDates : '' }}<span v-if="tripDates && subtitleRaw"> | </span>{{ subtitleRaw }}</p>
              <button @click="editingBanner = true" class="text-sm bg-white/20 px-2 py-1 rounded">編輯</button>
            </div>

            <div v-else class="bg-white/10 p-3 rounded-2xl flex flex-col gap-2">
              <div class="flex gap-2 items-center">
                <input v-model="startDateRaw" type="date" class="w-36 bg-white text-black px-3 py-2 rounded-xl border border-white/30" />
                <span class="text-white/80">〜</span>
                <input v-model="endDateRaw" type="date" class="w-36 bg-white text-black px-3 py-2 rounded-xl border border-white/30" />
              </div>
              <input v-model="subtitleRaw" class="rounded px-2 py-2 text-sm text-black" placeholder="輸入副標題" />
              <div class="flex gap-2 justify-end">
                <button @click="saveBanner" class="bg-white text-red-600 px-3 py-1 rounded font-bold">儲存</button>
                <button @click="cancelBannerEdit" class="bg-white/20 text-white px-3 py-1 rounded">取消</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav class="tabs bg-white rounded-2xl shadow-sm mb-6 mx-4 flex justify-between px-3 py-3">
        <button class="tab" :class="{ active: activeTab==='itinerary' }" @click="activeTab='itinerary'">
          <div class="icon">🗓️</div>
          <div class="label">行程</div>
        </button>
        <button class="tab" :class="{ active: activeTab==='accommodation' }" @click="activeTab='accommodation'">
          <div class="icon">🛏️</div>
          <div class="label">住宿</div>
        </button>
        <button class="tab" :class="{ active: activeTab==='attractions' }" @click="activeTab='attractions'">
          <div class="icon">📍</div>
          <div class="label">景點</div>
        </button>
        <button class="tab" :class="{ active: activeTab==='transport' }" @click="activeTab='transport'">
          <div class="icon">🚌</div>
          <div class="label">交通</div>
        </button>
        <button class="tab" :class="{ active: activeTab==='info' }" @click="activeTab='info'">
          <div class="icon">ℹ️</div>
          <div class="label">資訊</div>
        </button>
      </nav>

      <div>
        <section v-show="activeTab==='itinerary'">
          <div class="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
            <div class="p-4 flex items-center justify-between">
              <router-link to="/" class="text-blue-600 font-bold text-sm">← 返回</router-link>
              <h1 class="font-black text-lg text-slate-800">{{ tripName }}</h1>
              <div class="w-8"></div> </div>

            <div class="flex overflow-x-auto px-4 pb-3 gap-3 no-scrollbar">
              <button 
                v-for="date in uniqueDates" :key="date"
                @click="selectedDate = date"
                class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm border"
                :class="selectedDate === date ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'"
              >
                {{ date.slice(5) }}
              </button>
            </div>
          </div>

          <div class="p-4 space-y-4">
            <div v-for="act in filteredActivities" :key="act.id" 
                 @click="openEditForm(act)"
                 class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
              
              <div class="flex flex-col items-center w-14 border-r border-slate-100 pr-2">
                <span class="text-blue-600 font-black font-mono text-sm">{{ act.start_time }}</span>
                <span class="text-[10px] text-slate-400 mt-1">{{ act.category }}</span>
              </div>

              <div class="flex-1">
                <div class="flex items-center gap-1 mb-1">
                  <span>{{ getIcon(act.category) }}</span>
                  <h3 class="font-bold text-slate-800">{{ act.title }}</h3>
                </div>
                <p class="text-slate-500 text-xs leading-relaxed">{{ act.description }}</p>
                
                <a v-if="act.map_url" :href="act.map_url" target="_blank"
                   class="inline-block mt-3 text-[10px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-bold">
                  📍 開啟導航
                </a>
              </div>
            </div>

            <div v-if="filteredActivities.length === 0" class="text-center py-20 text-slate-400">
              <p v-if="uniqueDates.length === 0">還沒有任何行程，快按右下角新增！</p>
              <p v-else>這一天沒有行程喔</p>
            </div>
          </div>

          <button 
            @click="openAddForm"
            class="fixed bottom-8 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl pb-1 hover:scale-110 active:scale-90 transition-transform z-20"
          >
            +
          </button>

          <div v-if="showForm" class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" @click.self="showForm = false">
            <div class="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
              <div class="flex justify-between items-center mb-5">
                <h3 class="text-lg font-black text-slate-800">{{ isEditing ? '編輯行程' : '新增行程' }}</h3>
                <button @click="showForm = false" class="text-slate-400 text-2xl">×</button>
              </div>
              
              <div class="space-y-3">
                <input v-model="formData.date" type="date" class="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                
                <div class="flex gap-2">
                  <input v-model="formData.start_time" placeholder="時間 (09:00)" class="w-1/3 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <select v-model="formData.category" class="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option>景點</option><option>交通</option><option>餐飲</option><option>住宿</option>
                  </select>
                </div>

                <input v-model="formData.title" placeholder="活動名稱 (如: 水戶偕樂園)" class="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <textarea v-model="formData.description" placeholder="備註 / 交通方式" class="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-20"></textarea>
                <input v-model="formData.map_url" placeholder="Google Maps 連結" class="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                
                <div class="flex gap-3 mt-4">
                  <button 
                    v-if="isEditing"
                    @click="handleDelete" 
                    class="flex-1 bg-red-500 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-red-200 active:scale-95 transition-transform"
                  >
                    刪除
                  </button>
                  <button 
                    @click="isEditing ? handleSave() : handleAdd()" 
                    class="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                  >
                    {{ isEditing ? '儲存' : '確認加入' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-show="activeTab!=='itinerary'" class="bg-white p-8 rounded-2xl shadow-sm text-slate-400 text-center mx-4">
          <!-- 其他分頁暫時留白 -->
        </section>
      </div>
    </div>
  </template>
  
  <style scoped>
  /* 隱藏橫向捲軸但保留功能 */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .banner { background: linear-gradient(180deg,#a3181a,#b71c1c); }
  .banner-inner { color: white; }
  .banner-title { font-size: 1.25rem; font-weight: 800; margin: 0; }
  .banner-sub { font-size: 0.85rem; margin-top: 6px; opacity: 0.95 }
  .tabs { gap: 4px; }
  .tab { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; background:transparent; border:none; padding:6px 8px; border-radius:12px; color:#6b7280; }
  .tab .icon { font-size:18px }
  .tab .label { font-size:12px; margin-top:4px }
  .tab.active { background: linear-gradient(180deg,#fef2f2,#fff1f1); color:#b91c1c; box-shadow:0 1px 0 rgba(0,0,0,0.03); }
  </style>