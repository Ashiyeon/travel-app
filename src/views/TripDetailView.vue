<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { supabase } from '../lib/supabaseClient'
  
  const route = useRoute()
  const router = useRouter()
  const tripId = route.params.id
  
  // --- 共用變數 ---
  const tripName = ref('讀取中...')
  const activeTab = ref('itinerary')
  const tripDates = ref('')
  const subtitleRaw = ref('')
  const startDateRaw = ref('')

  // --- 管理員權限控制 ---
  const isEditMode = ref(false)

  // 移除了 toggleEditMode 函式，因為此頁面不再提供切換

  function goBack() {
    router.push('/')
  }

  // ==========================================
  //  PART 1: 景點 (Attractions) - 邏輯保持不變
  // ==========================================
  const attractions = ref<any[]>([])
  const showAttractionForm = ref(false)
  const isEditingAttraction = ref(false)
  const editingAttractionId = ref<number | null>(null)

  const attractionForm = ref({
    title: '', subtitle: '', location_tag: '', description: '',
    highlights: '', transport_info: '', must_eat: '', 
    ticket_price: '', opening_hours: '', map_url: ''
  })

  function openAttractionForm(attr?: any) {
    if (attr) {
      isEditingAttraction.value = true
      editingAttractionId.value = attr.id
      attractionForm.value = { ...attr }
    } else {
      isEditingAttraction.value = false
      editingAttractionId.value = null
      attractionForm.value = {
        title: '', subtitle: '', location_tag: '', description: '', highlights: '', 
        transport_info: '', must_eat: '', ticket_price: '', opening_hours: '', map_url: ''
      }
    }
    showAttractionForm.value = true
  }

  async function handleSaveAttraction() {
    if (!attractionForm.value.title) return alert('請填寫景點名稱')
    const payload = { ...attractionForm.value, trip_id: tripId }
    delete (payload as any).id 
    
    let error = null
    if (isEditingAttraction.value && editingAttractionId.value) {
        const res = await supabase.from('attractions').update(payload).eq('id', editingAttractionId.value)
        error = res.error
    } else {
        const res = await supabase.from('attractions').insert([payload])
        error = res.error
    }
    if (!error) { showAttractionForm.value = false; loadAttractionsData() } else alert(error.message)
  }

  async function handleDeleteAttraction() {
    if (!editingAttractionId.value || !confirm('確定刪除此景點？')) return
    const { error } = await supabase.from('attractions').delete().eq('id', editingAttractionId.value)
    if (!error) { showAttractionForm.value = false; loadAttractionsData() }
  }

  async function loadAttractionsData() {
    const { data } = await supabase.from('attractions').select('*').eq('trip_id', tripId).order('id', { ascending: true })
    attractions.value = data || []
  }

  function parseLines(text: string) {
    if (!text) return []
    return text.split('\n').filter(line => line.trim() !== '')
  }

  // ==========================================
  //  PART 2: 行程 (Itinerary) - 邏輯保持不變
  // ==========================================
  const activities = ref<any[]>([])
  const selectedDate = ref('')
  const showActivityForm = ref(false)
  const isEditingActivity = ref(false)
  const editingActivityId = ref<number | null>(null)
  
  const activityForm = ref({
    title: '', date: '', start_time: '', category: '景點', description: '', map_url: ''
  })

  const uniqueDates = computed(() => {
    const dates = activities.value.map(a => a.date).filter(Boolean)
    return [...new Set(dates)].sort()
  })

  const filteredActivities = computed(() => {
    let filtered = activities.value.filter(a => a.date)
    if (selectedDate.value) {
      filtered = filtered.filter(a => a.date === selectedDate.value)
    }
    return filtered.sort((a, b) => {
       const timeA = a.start_time || ''
       const timeB = b.start_time || ''
       return timeA.localeCompare(timeB) || (a.id - b.id)
    })
  })

  function openActivityForm(act?: any) {
    if (act) {
      isEditingActivity.value = true
      editingActivityId.value = act.id
      activityForm.value = { ...act }
    } else {
      isEditingActivity.value = false
      editingActivityId.value = null
      activityForm.value = { 
        title: '', date: selectedDate.value || startDateRaw.value, 
        start_time: '', category: '景點', description: '', map_url: '' 
      }
    }
    showActivityForm.value = true
  }

  async function handleSaveActivity() {
    if (!activityForm.value.title || !activityForm.value.date) return alert('請填寫日期與名稱')
    const payload = { ...activityForm.value, trip_id: tripId }
    delete (payload as any).id
    
    let error = null
    if (isEditingActivity.value && editingActivityId.value) {
        const res = await supabase.from('activities').update(payload).eq('id', editingActivityId.value)
        error = res.error
    } else {
        const res = await supabase.from('activities').insert([payload])
        error = res.error
    }
    if (!error) { showActivityForm.value = false; if (payload.date) selectedDate.value = payload.date; loadActivitiesData() } else alert(error.message)
  }

  async function handleDeleteActivity() {
    if (!editingActivityId.value || !confirm('確定刪除？')) return
    const { error } = await supabase.from('activities').delete().eq('id', editingActivityId.value)
    if (!error) { showActivityForm.value = false; loadActivitiesData() }
  }

  async function loadActivitiesData() {
    const { data } = await supabase.from('activities').select('*').eq('trip_id', tripId).order('date').order('start_time')
    activities.value = data || []
    if (!selectedDate.value && uniqueDates.value.length > 0) selectedDate.value = uniqueDates.value[0]
  }

  const getIcon = (cat: string) => {
    if (cat === '交通') return '🚃'; if (cat === '餐飲') return '🍱'; if (cat === '住宿') return '🏨'; return '📍'
  }

  // ==========================================
  //  PART 3: 住宿 (Accommodation) - 邏輯保持不變
  // ==========================================
  const accommodations = ref<any[]>([]) 
  const showAccForm = ref(false)
  const isEditingAcc = ref(false)       
  const editingAccId = ref<number | null>(null) 
  
  const accForm = ref({
    name: '', address: '', station: '', 
    check_in_date: '', check_out_date: '',
    check_in_time: '15:00', check_out_time: '10:00',
    google_map_url: '', transportation: [] as any[], transport_note: ''
  })

  function openAccEdit(item?: any) {
    if (item) {
      isEditingAcc.value = true
      editingAccId.value = item.id
      accForm.value = { 
          ...item, 
          transportation: item.transportation || [{ step: 1, text: '' }],
          station: item.station || '' 
      }
    } else {
      isEditingAcc.value = false
      editingAccId.value = null
      accForm.value = {
        name: '', address: '', station: '', 
        check_in_date: '', check_out_date: '',
        check_in_time: '15:00', check_out_time: '10:00', 
        google_map_url: '', transportation: [{ step: 1, text: '' }], transport_note: ''
      }
    }
    showAccForm.value = true
  }
  
  function addTransportStep() { accForm.value.transportation.push({ step: accForm.value.transportation.length + 1, text: '' }) }
  function removeTransportStep(index: number) { 
    if (accForm.value.transportation.length > 1) { 
        accForm.value.transportation.splice(index, 1); 
        accForm.value.transportation.forEach((t, i) => t.step = i + 1) 
    } 
  }
  
  async function saveAccommodation() {
    if (!accForm.value.name) return alert('請填寫住宿名稱')
    const payload = {
      trip_id: tripId, 
      ...accForm.value,
      check_in_date: accForm.value.check_in_date || null,
      check_out_date: accForm.value.check_out_date || null
    }
    delete (payload as any).id

    let error = null
    if (isEditingAcc.value && editingAccId.value) {
        const res = await supabase.from('accommodations').update(payload).eq('id', editingAccId.value)
        error = res.error
    } else {
        const res = await supabase.from('accommodations').insert([payload])
        error = res.error
    }
    if (!error) { showAccForm.value = false; loadAccommodationData() } else alert(error.message)
  }

  async function handleDeleteAccommodation() {
     if (!editingAccId.value || !confirm('確定刪除此住宿地點？')) return
     const { error } = await supabase.from('accommodations').delete().eq('id', editingAccId.value)
     if (!error) { showAccForm.value = false; loadAccommodationData() }
  }
  
  async function loadAccommodationData() {
      const { data } = await supabase.from('accommodations').select('*').eq('trip_id', tripId).order('check_in_date', { ascending: true })
      accommodations.value = data || []
  }

  const getDisplayCheckInDate = (item: any) => item.check_in_date ? `${new Date(item.check_in_date).getMonth() + 1}月${new Date(item.check_in_date).getDate()}日` : '未設定'
  const getStayDuration = (item: any) => (item.check_in_date && item.check_out_date) ? Math.max(0, Math.ceil((new Date(item.check_out_date).getTime() - new Date(item.check_in_date).getTime()) / 86400000)) : 1

  // ==========================================
  //  PART 4: 交通 (Transport) - 邏輯保持不變
  // ==========================================
  const transports = ref<any[]>([])
  const showTransportForm = ref(false)
  const isEditingTransport = ref(false)
  const editingTransportId = ref<number | null>(null)

  const transportForm = ref({
    title: '', transport_type: '', duration: '', price: '', map_url: '',
    steps: [] as any[] 
  })

  function openTransportForm(item?: any) {
    if (item) {
      isEditingTransport.value = true
      editingTransportId.value = item.id
      transportForm.value = { ...item, steps: item.steps || [] }
    } else {
      isEditingTransport.value = false
      editingTransportId.value = null
      transportForm.value = {
        title: '', transport_type: '', duration: '', price: '', map_url: '',
        steps: [{ title: '', desc: '', tip: '' }]
      }
    }
    showTransportForm.value = true
  }

  function addTransStep() {
    transportForm.value.steps.push({ title: '', desc: '', tip: '' })
  }

  function removeTransStep(idx: number) {
    if (transportForm.value.steps.length > 1) {
        transportForm.value.steps.splice(idx, 1)
    }
  }

  async function handleSaveTransport() {
    if (!transportForm.value.title) return alert('請填寫路線名稱')
    const payload = { ...transportForm.value, trip_id: tripId }
    delete (payload as any).id

    let error = null
    if (isEditingTransport.value && editingTransportId.value) {
        const res = await supabase.from('transports').update(payload).eq('id', editingTransportId.value)
        error = res.error
    } else {
        const res = await supabase.from('transports').insert([payload])
        error = res.error
    }
    if (!error) { showTransportForm.value = false; loadTransportData() } else alert(error.message)
  }

  async function handleDeleteTransport() {
     if (!editingTransportId.value || !confirm('確定刪除此路線？')) return
     const { error } = await supabase.from('transports').delete().eq('id', editingTransportId.value)
     if (!error) { showTransportForm.value = false; loadTransportData() }
  }

  async function loadTransportData() {
    const { data } = await supabase.from('transports').select('*').eq('trip_id', tripId).order('id')
    transports.value = data || []
  }


  // ==========================================
  //  全部載入
  // ==========================================
  async function loadData() {
    // 檢查是否有管理員權限 (關鍵邏輯：只讀取，不切換)
    if (localStorage.getItem('trip_admin_access') === 'true') {
        isEditMode.value = true
    } else {
        isEditMode.value = false
    }

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (trip) {
        tripName.value = trip.name
        subtitleRaw.value = trip.subtitle || ''
        startDateRaw.value = trip.start_date
        if (trip.start_date && trip.end_date) {
            const f = (s: string) => { const d = new Date(s); return `${d.getMonth()+1}月${d.getDate()}日` }
            tripDates.value = `${f(trip.start_date)} - ${f(trip.end_date)}`
        }
    }
    loadAttractionsData()
    loadActivitiesData()
    loadAccommodationData()
    loadTransportData()
  }
  
  onMounted(loadData)
</script>
  
<template>
  <div class="min-h-screen bg-[#FDFCF8] pb-24 font-sans text-stone-700">
    
    <div class="px-4 py-2 flex items-center">
        <button @click="goBack" class="flex items-center gap-1 text-[#606C38] font-bold text-sm hover:text-[#283618] transition">
            <span class="text-lg">‹</span> 返回列表
        </button>
        </div>

    <div class="banner rounded-2xl overflow-hidden mb-4 mx-4 shadow-lg shadow-stone-200 bg-gradient-to-r from-[#606C38] to-[#283618]">
      <div class="p-6 text-white">
        <h1 class="text-xl font-extrabold tracking-wide">{{ tripName }}</h1>
        <p class="text-sm opacity-90 mt-1 font-medium">{{ tripDates }} <span v-if="subtitleRaw">| {{ subtitleRaw }}</span></p>
      </div>
    </div>

    <nav class="bg-white rounded-2xl shadow-sm border border-stone-100 mb-4 mx-4 flex justify-between px-3 py-2 z-20">
      <button class="tab" :class="{ active: activeTab==='itinerary' }" @click="activeTab='itinerary'"><div class="icon">🗓️</div><div class="label">行程</div></button>
      <button class="tab" :class="{ active: activeTab==='attractions' }" @click="activeTab='attractions'"><div class="icon">📍</div><div class="label">景點</div></button>
      <button class="tab" :class="{ active: activeTab==='accommodation' }" @click="activeTab='accommodation'"><div class="icon">🛏️</div><div class="label">住宿</div></button>
      <button class="tab" :class="{ active: activeTab==='transport' }" @click="activeTab='transport'"><div class="icon">🚌</div><div class="label">交通</div></button>
    </nav>

    <section v-show="activeTab==='transport'" class="px-4 pb-20">
        <div class="flex justify-between items-center mb-4 pl-1">
            <h2 class="text-xl font-bold text-[#BC4749] flex items-center gap-2">
                <span class="text-xl">🚆</span> 交通詳細指南
            </h2>
        </div>

        <div class="space-y-6">
            <div v-for="trans in transports" :key="trans.id" class="bg-white rounded-xl shadow-md border border-stone-100 overflow-hidden relative group hover:shadow-lg transition-shadow">
                
                <button v-if="isEditMode" @click="openTransportForm(trans)" class="absolute top-3 right-3 z-10 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition">
                    ✏️
                </button>

                <div class="bg-gradient-to-r from-[#6B905C] to-[#463F3A] text-white p-4">
                    <div class="flex items-start gap-3">
                        <div class="text-2xl mt-0.5 text-[#FFE8D6]">✈️</div> <div>
                            <h3 class="font-bold text-lg text-white drop-shadow-sm">{{ trans.title }}</h3>
                            <div class="text-[#F0EFEB] text-xs mt-1 flex gap-2 opacity-90 font-medium">
                                <span v-if="trans.duration">{{ trans.duration }}</span>
                                <span v-if="trans.duration && trans.transport_type">|</span>
                                <span v-if="trans.transport_type">{{ trans.transport_type }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="p-5">
                    <div class="relative border-l-2 border-[#BC4749]/30 ml-2 space-y-8 my-2">
                        <div v-for="(step, idx) in trans.steps" :key="idx" class="ml-6 relative">
                            <span class="absolute -left-[31px] top-1 w-4 h-4 bg-[#BC4749] rounded-full border-2 border-white shadow-sm"></span>
                            
                            <h4 class="font-bold text-[#283618] text-sm mb-1">{{ Number(idx) + 1 }}. {{ step.title }}</h4>
                            <p class="text-xs text-stone-500 leading-relaxed">{{ step.desc }}</p>

                            <div v-if="step.tip" class="mt-2 bg-[#FEFAE0] border-l-4 border-[#D4A373] p-2 text-[11px] text-[#606C38] rounded-r">
                                <span class="font-bold text-[#BC4749]">💡 提示：</span>{{ step.tip }}
                            </div>
                        </div>
                    </div>

                    <div class="bg-stone-50 p-3 rounded-lg flex justify-between items-center mt-6 mb-3 border border-stone-100">
                        <span class="text-xs text-stone-400">預估票價</span>
                        <span class="text-[#BC4749] font-bold text-lg">{{ trans.price }}</span>
                    </div>

                    <a v-if="trans.map_url" :href="trans.map_url" target="_blank" class="block w-full bg-[#606C38] hover:bg-[#283618] text-white text-center py-3 rounded-lg font-bold shadow-sm active:scale-[0.99] transition-all flex justify-center items-center gap-2">
                        <span>🗺️</span> Google 地圖導航
                    </a>
                </div>
            </div>

             <div v-if="transports.length === 0" class="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
                <p class="text-stone-400 mb-2">{{ isEditMode ? '這裡空空如也' : '暫無交通資訊' }}</p>
                <button v-if="isEditMode" @click="openTransportForm()" class="text-[#BC4749] font-bold hover:underline">新增第一條路線</button>
            </div>
        </div>
        
        <button v-if="isEditMode" @click="openTransportForm()" class="fixed bottom-8 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-30 transition hover:scale-110 active:scale-95">+</button>
    </section>

    <section v-show="activeTab==='attractions'" class="px-4 pb-20">
        <div class="flex justify-between items-center mb-4 pl-1">
            <h2 class="text-xl font-bold text-[#BC4749] flex items-center gap-2"> 
                <span class="text-xl">🌅</span> 景點詳細介紹
            </h2>
        </div>
         <div class="grid gap-6">
            <div v-for="attr in attractions" :key="attr.id" class="bg-white rounded-xl shadow-md overflow-hidden border border-stone-100 relative group hover:shadow-lg transition-all">
                <button v-if="isEditMode" @click="openAttractionForm(attr)" class="absolute top-3 right-3 z-10 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition">✏️</button>

                <div class="bg-gradient-to-br from-[#D4A373] to-[#B08968] p-6 text-white pt-10 pb-8 relative">
                <div v-if="attr.location_tag" class="absolute top-6 left-6 bg-[#FEFAE0] text-[#9C6644] text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                    {{ attr.location_tag }}
                </div>
                
                <h3 class="text-2xl font-bold mb-1 mt-4 text-white shadow-sm">{{ attr.title }}</h3>
                <p class="text-sm text-[#FEFAE0]/90 font-medium">{{ attr.subtitle }}</p>
            </div>            

                <div class="p-5">
                    <p class="text-stone-600 text-sm leading-relaxed mb-5 text-justify">{{ attr.description || '暫無描述' }}</p>
                    
                    <div class="bg-[#FEFAE0] rounded-lg p-4 mb-5 border border-[#E9EDC9]" v-if="attr.highlights || attr.must_eat">
                        <h4 class="text-sm font-bold text-[#A98467] mb-2 flex items-center gap-1"><span>✨</span> 必訪亮點 & 美食</h4>
                        <ul class="space-y-2">
                            <li v-for="(line, idx) in parseLines(attr.highlights)" :key="'h'+idx" class="flex items-start gap-2 text-sm text-stone-700">
                                <span class="mt-0.5 text-xs text-[#A98467]">●</span><span>{{ line }}</span>
                            </li>
                            <li v-for="(line, idx) in parseLines(attr.must_eat)" :key="'m'+idx" class="flex items-start gap-2 text-sm text-stone-700">
                                <span class="mt-0.5 text-xs text-[#A98467]">🍽️</span><span>{{ line }}</span>
                            </li>
                        </ul>
                    </div>

                    <div class="grid grid-cols-1 gap-y-3 text-sm text-stone-600 mb-6">
                         <div class="flex items-start gap-3" v-if="attr.transport_info"><div class="w-5 text-center text-lg">🚇</div><div class="flex-1 border-b border-stone-100 pb-2">{{ attr.transport_info }}</div></div>
                         <div class="flex items-start gap-3" v-if="attr.opening_hours"><div class="w-5 text-center text-lg">⏰</div><div class="flex-1 border-b border-stone-100 pb-2">{{ attr.opening_hours }}</div></div>
                         <div class="flex items-start gap-3" v-if="attr.ticket_price"><div class="w-5 text-center text-lg">🎫</div><div class="flex-1">{{ attr.ticket_price }}</div></div>
                    </div>
                    
                    <a v-if="attr.map_url" :href="attr.map_url" target="_blank" class="block w-full bg-[#606C38] hover:bg-[#283618] text-white text-center py-3 rounded-lg font-bold shadow-md active:scale-[0.98] transition-all flex justify-center items-center gap-2"><span>🗺️</span> Google 地圖導航</a>
                </div>
            </div>
            <div v-if="attractions.length === 0" class="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50"><p class="text-stone-400 mb-2">{{ isEditMode ? '這裡空空如也' : '暫無景點介紹' }}</p><button v-if="isEditMode" @click="openAttractionForm()" class="text-[#BC4749] font-bold hover:underline">新增第一個景點</button></div>
        </div>
        <button v-if="isEditMode" @click="openAttractionForm()" class="fixed bottom-8 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-30 transition hover:scale-110 active:scale-95">+</button>
    </section>

    <section v-show="activeTab==='itinerary'">
        <div v-if="activities.length > 0" class="sticky top-16 z-10 bg-[#FDFCF8]/95 backdrop-blur-sm border-b border-stone-200 pt-2">
            <div class="flex overflow-x-auto px-4 pb-3 gap-3 no-scrollbar">
                <button v-for="date in uniqueDates" :key="date" @click="selectedDate = date" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm border" :class="selectedDate === date ? 'bg-[#283618] text-white border-[#283618]' : 'bg-white text-stone-500 border-stone-200 hover:border-[#606C38]'">
                    {{ date.slice(5) }}
                </button>
            </div>
        </div>

        <div class="p-4 space-y-4">
            <div v-if="activities.length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-stone-300">
                <p class="text-stone-400 mb-2">{{ isEditMode ? '這裡空空如也' : '暫無行程' }}</p>
                <button v-if="isEditMode" @click="openActivityForm()" class="text-[#BC4749] font-bold hover:underline">新增第一個行程</button>
            </div>

            <template v-else>
                <div v-for="act in filteredActivities" :key="act.id" 
                    @click="isEditMode ? openActivityForm(act) : null" 
                    :class="{ 'cursor-default': !isEditMode, 'hover:border-[#D4A373]': isEditMode }"
                    class="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex gap-4 transition-colors relative group">
                    
                    <div class="flex flex-col items-center w-14 border-r border-stone-100 pr-2">
                        <span class="text-[#BC4749] font-black font-mono text-sm">{{ act.start_time || '--:--' }}</span>
                        <span class="text-[14px] text-stone-400 mt-1">{{ act.category }}</span>
                    </div>

                    <div class="flex-1">
                        <div class="flex items-center gap-1 mb-1">
                            <span>{{ getIcon(act.category) }}</span>
                            <h3 class="font-bold text-[#283618]">{{ act.title }}</h3>
                        </div>

                        <p class="text-stone-500 text-sm mt-1 line-clamp-2">{{ act.description }}</p>

                        <a v-if="act.map_url" 
                        :href="act.map_url" 
                        target="_blank" 
                        @click.stop
                        class="inline-flex items-center gap-1 mt-2 bg-[#E9EDC9] text-[#283618] text-[12px] px-2 py-1 rounded-full font-bold hover:bg-[#606C38] hover:text-white transition-colors shadow-sm">
                             查看地圖
                        </a>
                    </div>

                    <div v-if="isEditMode" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-stone-300">
                        ✏️
                    </div>
                </div>

                <div v-if="filteredActivities.length === 0" class="text-center py-20 text-stone-400">
                    <p>這一天還沒有行程喔</p>
                    <button v-if="isEditMode" @click="openActivityForm()" class="text-[#BC4749] text-xs font-bold mt-2 hover:underline">+ 點此新增</button>
                </div>
            </template>
        </div>

        <button v-if="isEditMode" @click="openActivityForm()" class="fixed bottom-8 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-20 transition hover:scale-110 active:scale-95">+</button>
    </section>
    
    <section v-show="activeTab==='accommodation'" class="px-4 pb-20">
        <div class="flex justify-between items-center mb-4 pl-1">
            <h2 class="text-xl font-bold text-[#BC4749] flex items-center gap-2">
                <span class="text-2xl">🏨</span> 住宿資訊
            </h2>
             <span class="text-xs text-stone-400" v-if="accommodations.length > 0">共 {{ accommodations.length }} 間</span>
        </div>

        <div v-if="accommodations.length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-stone-300">
            <p class="text-stone-400 mb-2">{{ isEditMode ? '這裡空空如也' : '暫無住宿資料' }}</p>
            <button v-if="isEditMode" @click="openAccEdit()" class="text-[#BC4749] font-bold hover:underline">新增第一間住宿</button>
        </div>

        <div v-else class="space-y-8">
            <div v-for="item in accommodations" :key="item.id">
                <div class="bg-white rounded-xl shadow-md border border-stone-100 overflow-hidden relative group hover:shadow-lg transition-shadow">
                    
                    <button v-if="isEditMode" @click="openAccEdit(item)" class="absolute top-3 right-3 z-10 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition">
                        ✏️
                    </button>

                    <div class="bg-[#6F4E37] text-white p-4">
                        <div class="flex items-start gap-3">
                            <div class="bg-white/20 p-2 rounded-lg text-2xl">🏠</div>
                            <div>
                                <h3 class="font-bold text-lg leading-tight">{{ item.name }}</h3>
                                <div class="text-white/80 text-sm mt-1 flex items-center gap-2">
                                    <div class="flex items-center gap-1"><span>📅</span><span>{{ getDisplayCheckInDate(item) }} 入住</span></div>
                                    <span class="bg-white/20 text-[10px] px-2 py-0.5 rounded font-mono">{{ getStayDuration(item) }} 晚</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="p-5">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 mb-6 text-sm">
                            <div class="flex gap-3">
                                <div class="text-[#BC4749] mt-0.5 text-lg">📍</div>
                                <div class="flex-1">
                                    <div class="text-stone-400 text-xs mb-0.5">地址</div>
                                    <div class="font-medium text-stone-800">{{ item.address }}</div>
                                </div>
                            </div>
                            <div class="flex gap-3">
                                <div class="text-[#606C38] mt-0.5 text-lg">🚇</div>
                                <div class="flex-1">
                                    <div class="text-stone-400 text-xs mb-0.5">最近車站</div>
                                    <div class="font-medium text-stone-800">{{ item.station || '未設定' }}</div>
                                </div>
                            </div>
                            <div class="flex gap-3">
                                <div class="text-stone-500 mt-0.5 text-lg">🕒</div>
                                <div class="flex-1">
                                    <div class="text-stone-400 text-xs mb-0.5">Check-in</div>
                                    <div class="font-bold text-stone-800 font-mono text-base">{{ item.check_in_time }}</div>
                                </div>
                            </div>
                            <div class="flex gap-3">
                                <div class="text-stone-500 mt-0.5 text-lg">🕒</div>
                                <div class="flex-1">
                                    <div class="text-stone-400 text-xs mb-0.5">Check-out</div>
                                    <div class="font-bold text-stone-800 font-mono text-base">{{ item.check_out_time }}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-[#F5F5F4] rounded-xl border border-stone-200 overflow-hidden shadow-sm mb-6" v-if="item.transportation && item.transportation.length > 0">
                            <div class="p-3 border-b border-stone-200 flex items-center gap-2 bg-[#E7E5E4]/50"><span class="text-xl">🚄</span>
                                <h3 class="font-bold text-[#6F4E37] text-sm">交通方式</h3>
                            </div>
                            <div class="p-5">
                                <ol class="relative border-l-2 border-[#D4A373] ml-2 space-y-6">
                                    <li v-for="(trans, index) in item.transportation" :key="index" class="ml-6"><span class="absolute -left-[9px] flex items-center justify-center w-5 h-5 bg-stone-100 rounded-full border-2 border-[#D4A373] text-[10px] font-bold text-[#6F4E37] bg-white">{{ trans.step }}</span>
                                        <p class="text-sm text-[#6F4E37] leading-relaxed font-medium">{{ trans.text }}</p>
                                    </li>
                                </ol>
                                <div class="mt-6 flex items-start gap-2 bg-white/60 p-3 rounded-lg border border-white/50" v-if="item.transport_note"><span class="text-[#D4A373] mt-0.5">💡</span>
                                    <p class="text-xs text-stone-600 font-medium">{{ item.transport_note }}</p>
                                </div>
                            </div>
                        </div>

                        <a v-if="item.google_map_url" :href="item.google_map_url" target="_blank" class="block w-full bg-[#606C38] hover:bg-[#283618] text-white text-center py-3 rounded-lg font-bold shadow-sm active:scale-[0.99] transition-transform flex justify-center items-center gap-2">🗺️ Google地圖導航</a>
                    </div>
                </div>
            </div>
        </div>
        
        <button v-if="isEditMode" @click="openAccEdit()" class="fixed bottom-8 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-30 transition hover:scale-110 active:scale-95">+</button>
    </section>

    <div v-if="showTransportForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-center justify-center p-4" @click.self="showTransportForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
             <div class="flex justify-between mb-4 items-center">
                <h3 class="font-bold text-lg text-[#283618]">{{ isEditingTransport ? '編輯路線' : '新增路線' }}</h3>
                <button @click="showTransportForm=false" class="text-2xl text-stone-400 hover:text-stone-600">×</button>
            </div>
            <div class="space-y-4">
                 <div class="flex gap-2">
                    <div class="flex-1"><label class="text-xs text-stone-500 mb-1 block">路線名稱</label><input v-model="transportForm.title" placeholder="例: 關西機場 → 難波" class="w-full border border-stone-300 p-2 rounded-lg bg-white font-bold focus:outline-none focus:border-[#606C38] focus:ring-1 focus:ring-[#606C38]" /></div>
                    <div class="w-1/3"><label class="text-xs text-stone-500 mb-1 block">交通工具</label><input v-model="transportForm.transport_type" placeholder="例: 南海電鐵" class="w-full border border-stone-300 p-2 rounded-lg bg-white focus:outline-none focus:border-[#606C38]" /></div>
                 </div>
                 <div class="flex gap-2">
                    <div class="flex-1"><label class="text-xs text-stone-500 mb-1 block">行車時間</label><input v-model="transportForm.duration" placeholder="例: 約48分鐘" class="w-full border border-stone-300 p-2 rounded-lg bg-white focus:outline-none focus:border-[#606C38]" /></div>
                    <div class="flex-1"><label class="text-xs text-stone-500 mb-1 block">預估票價</label><input v-model="transportForm.price" placeholder="例: ¥970 / 人" class="w-full border border-stone-300 p-2 rounded-lg bg-white font-bold text-[#BC4749] focus:outline-none focus:border-[#606C38]" /></div>
                 </div>
                 
                 <div class="bg-stone-50 p-3 rounded-lg border border-stone-200">
                    <label class="text-xs font-bold text-stone-700 mb-2 block">路線步驟</label>
                    <div v-for="(step, idx) in transportForm.steps" :key="idx" class="mb-4 pb-4 border-b border-stone-200 last:border-0 last:pb-0 last:mb-0">
                        <div class="flex justify-between items-center mb-1">
                             <span class="text-xs bg-[#E9EDC9] px-2 py-0.5 rounded text-[#283618] font-bold">Step {{ Number(idx)+1 }}</span>
                             <button @click="removeTransStep(idx)" class="text-[#BC4749] text-xs" v-if="transportForm.steps.length > 1">刪除</button>
                        </div>
                        <input v-model="step.title" placeholder="步驟標題" class="w-full border border-stone-300 p-2 rounded mb-2 text-sm font-bold focus:outline-none focus:border-[#606C38]" />
                        <textarea v-model="step.desc" placeholder="詳細說明..." class="w-full border border-stone-300 p-2 rounded mb-2 text-xs h-16 focus:outline-none focus:border-[#606C38]"></textarea>
                        <input v-model="step.tip" placeholder="💡 黃色底提示 (選填)" class="w-full border border-[#D4A373]/30 bg-[#FEFAE0] p-2 rounded text-xs text-[#6F4E37] focus:outline-none focus:border-[#D4A373]" />
                    </div>
                    <button @click="addTransStep" class="w-full py-2 border border-dashed border-stone-300 rounded text-stone-500 text-xs mt-2 hover:bg-stone-100">+ 新增步驟</button>
                 </div>

                 <div><label class="text-xs text-stone-500 mb-1 block">Google Map URL</label><input v-model="transportForm.map_url" placeholder="http..." class="w-full border border-stone-300 p-2 rounded-lg bg-white text-[#606C38] text-xs focus:outline-none focus:border-[#606C38]" /></div>

                 <div class="flex gap-3 mt-6 pt-2 border-t border-stone-100">
                    <button v-if="isEditingTransport" @click="handleDeleteTransport" class="bg-red-50 text-[#BC4749] px-4 py-3 rounded-xl font-bold text-sm">刪除</button>
                    <button @click="handleSaveTransport" class="bg-[#283618] text-white flex-1 py-3 rounded-xl font-bold shadow-md active:scale-95 transition hover:bg-[#3A5A40]">儲存設定</button>
                </div>
            </div>
        </div>
    </div>

    <div v-if="showAttractionForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-center justify-center p-4" @click.self="showAttractionForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between mb-4 items-center">
                <h3 class="font-bold text-lg text-[#283618]">{{ isEditingAttraction ? '編輯景點' : '新增景點' }}</h3>
                <button @click="showAttractionForm=false" class="text-2xl text-stone-400 hover:text-stone-600">×</button>
            </div>
            <div class="space-y-4">
                <div class="flex gap-2">
                    <div class="w-1/3"><label class="text-xs text-stone-500 mb-1 block">地區標籤</label><input v-model="attractionForm.location_tag" class="w-full border border-stone-300 p-2 rounded-lg bg-white text-center focus:outline-none focus:border-[#606C38]" /></div>
                    <div class="flex-1"><label class="text-xs text-stone-500 mb-1 block">景點名稱</label><input v-model="attractionForm.title" class="w-full border border-stone-300 p-2 rounded-lg bg-white font-bold focus:outline-none focus:border-[#606C38]" /></div>
                </div>
                <div><label class="text-xs text-stone-500 mb-1 block">副標題</label><input v-model="attractionForm.subtitle" class="w-full border border-stone-300 p-2 rounded-lg bg-white focus:outline-none focus:border-[#606C38]" /></div>
                <div><label class="text-xs text-stone-500 mb-1 block">介紹描述</label><textarea v-model="attractionForm.description" class="w-full border border-stone-300 p-2 rounded-lg bg-white h-24 text-sm focus:outline-none focus:border-[#606C38]"></textarea></div>
                <div class="bg-[#FEFAE0] p-3 rounded-lg border border-[#E9EDC9]">
                    <label class="text-xs font-bold text-[#D4A373] mb-1 block">✨ 必訪亮點 (一行一個)</label><textarea v-model="attractionForm.highlights" class="w-full border border-stone-200 p-2 rounded-lg bg-white h-20 text-sm focus:outline-none focus:border-[#D4A373]"></textarea>
                    <label class="text-xs font-bold text-[#D4A373] mt-2 mb-1 block">🍽️ 必吃美食 (一行一個，可選)</label><textarea v-model="attractionForm.must_eat" class="w-full border border-stone-200 p-2 rounded-lg bg-white h-16 text-sm focus:outline-none focus:border-[#D4A373]"></textarea>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="text-xs text-stone-500 mb-1 block">🚇 交通方式</label><input v-model="attractionForm.transport_info" class="w-full border border-stone-300 p-2 rounded-lg bg-white text-sm focus:outline-none focus:border-[#606C38]" /></div>
                    <div><label class="text-xs text-stone-500 mb-1 block">🎫 門票/費用</label><input v-model="attractionForm.ticket_price" class="w-full border border-stone-300 p-2 rounded-lg bg-white text-sm focus:outline-none focus:border-[#606C38]" /></div>
                    <div class="col-span-2"><label class="text-xs text-stone-500 mb-1 block">⏰ 營業時間</label><input v-model="attractionForm.opening_hours" class="w-full border border-stone-300 p-2 rounded-lg bg-white text-sm focus:outline-none focus:border-[#606C38]" /></div>
                </div>
                <div><label class="text-xs text-stone-500 mb-1 block">📍 Google Map URL</label><input v-model="attractionForm.map_url" class="w-full border border-stone-300 p-2 rounded-lg bg-white text-[#606C38] text-xs focus:outline-none focus:border-[#606C38]" /></div>
                <div class="flex gap-3 mt-6 pt-2 border-t border-stone-100">
                    <button v-if="isEditingAttraction" @click="handleDeleteAttraction" class="bg-red-50 text-[#BC4749] px-4 py-3 rounded-xl font-bold text-sm">刪除</button>
                    <button @click="handleSaveAttraction" class="bg-[#283618] text-white flex-1 py-3 rounded-xl font-bold shadow-md active:scale-95 transition hover:bg-[#3A5A40]">儲存設定</button>
                </div>
            </div>
        </div>
    </div>

<div v-if="showActivityForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-center justify-center p-4" @click.self="showActivityForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div class="flex justify-between mb-4"><h3 class="font-bold text-lg text-[#283618]">{{ isEditingActivity ? '編輯行程' : '新增行程' }}</h3><button @click="showActivityForm=false" class="text-2xl text-stone-400">×</button></div>
            <div class="space-y-3">
                <input v-model="activityForm.date" type="date" class="w-full border border-stone-300 p-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38]" />
                <div class="flex gap-2">
                    <input v-model="activityForm.start_time" placeholder="時間 (09:00)" class="w-1/3 border border-stone-300 p-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38]" />
                    <select v-model="activityForm.category" class="flex-1 border border-stone-300 p-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38]"><option>景點</option><option>交通</option><option>餐飲</option><option>活動</option><option>住宿</option></select>
                </div>
                <input v-model="activityForm.title" placeholder="名稱" class="w-full border border-stone-300 p-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38]" />
                
                <input v-model="activityForm.map_url" placeholder="📍 Google Map 連結" class="w-full border border-stone-300 p-2 rounded-xl bg-white text-sm text-[#606C38] focus:outline-none focus:border-[#606C38]" />

                <textarea v-model="activityForm.description" placeholder="備註" class="w-full border border-stone-300 p-2 rounded-xl bg-white h-20 focus:outline-none focus:border-[#606C38]"></textarea>
                <div class="flex gap-2 mt-2">
                    <button v-if="isEditingActivity" @click="handleDeleteActivity" class="bg-red-50 text-[#BC4749] flex-1 py-2 rounded-xl">刪除</button>
                    <button @click="handleSaveActivity" class="bg-[#283618] text-white flex-1 py-2 rounded-xl hover:bg-[#3A5A40]">確認</button>
                </div>
            </div>
        </div>
    </div>

    <div v-if="showAccForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" @click.self="showAccForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-5 sticky top-0 bg-[#FDFCF8] z-10 py-2 border-b border-stone-200"><h3 class="text-lg font-black text-[#283618]">{{ isEditingAcc ? '編輯住宿' : '新增住宿' }}</h3><button @click="showAccForm = false" class="text-stone-400 text-2xl">×</button></div>
            <div class="space-y-4">
                <div><label class="text-xs text-stone-500">名稱</label><input v-model="accForm.name" class="w-full border border-stone-300 bg-white rounded px-2 py-2 focus:outline-none focus:border-[#606C38]" /></div>
                <div class="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded border border-stone-200">
                    <div class="col-span-2 text-xs font-bold text-stone-700">入住設定</div>
                    <div><label class="text-[10px] text-stone-400">日期</label><input v-model="accForm.check_in_date" type="date" class="w-full bg-white border border-stone-300 rounded px-1 py-1" /></div>
                    <div><label class="text-[10px] text-stone-400">時間</label><input v-model="accForm.check_in_time" class="w-full bg-white border border-stone-300 rounded px-1 py-1" /></div>
                    <div class="col-span-2 text-xs font-bold text-stone-700 mt-2">退房設定</div>
                    <div><label class="text-[10px] text-stone-400">日期</label><input v-model="accForm.check_out_date" type="date" class="w-full bg-white border border-stone-300 rounded px-1 py-1" /></div>
                    <div><label class="text-[10px] text-stone-400">時間</label><input v-model="accForm.check_out_time" class="w-full bg-white border border-stone-300 rounded px-1 py-1" /></div>
                </div>
                <div><label class="text-xs text-stone-500">地址</label><input v-model="accForm.address" class="w-full border border-stone-300 bg-white rounded px-2 py-2 focus:outline-none focus:border-[#606C38]" /></div>
                <div><label class="text-xs text-stone-500">最近車站</label><input v-model="accForm.station" placeholder="例如: JR淺草站 (步行5分)" class="w-full border border-stone-300 bg-white rounded px-2 py-2 focus:outline-none focus:border-[#606C38]" /></div>
                <div><label class="text-xs text-stone-500">Google Map URL</label><input v-model="accForm.google_map_url" class="w-full border border-stone-300 bg-white rounded px-2 py-2 text-[#606C38] focus:outline-none focus:border-[#606C38]" /></div>
                <div class="bg-stone-50 p-3 rounded border border-stone-200">
                    <label class="text-xs font-bold mb-2 block text-stone-700">交通步驟</label>
                    <div v-for="(step, idx) in accForm.transportation" :key="idx" class="flex gap-2 mb-2"><span class="w-6 h-6 flex items-center justify-center bg-white border border-stone-300 rounded-full text-xs mt-2 text-[#606C38] font-bold">{{ Number(idx)+1 }}</span><textarea v-model="step.text" class="flex-1 bg-white border border-stone-300 rounded px-2 py-1 h-16 resize-none focus:outline-none focus:border-[#606C38]"></textarea><button @click="removeTransportStep(idx)" class="text-[#BC4749] self-center">×</button></div>
                    <button @click="addTransportStep" class="w-full py-2 border border-dashed border-stone-300 rounded text-xs text-stone-500 hover:bg-stone-100">+ 步驟</button>
                </div>
                
                <div class="flex gap-3 mt-6 pt-2 border-t border-stone-100">
                    <button v-if="isEditingAcc" @click="handleDeleteAccommodation" class="bg-red-50 text-[#BC4749] px-4 py-3 rounded-xl font-bold text-sm">刪除</button>
                    <button @click="saveAccommodation" class="flex-1 bg-[#283618] text-white py-3 rounded-xl font-bold hover:bg-[#3A5A40]">儲存</button>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.tab { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; background:transparent; border:none; padding:6px 8px; border-radius:12px; color:#a8a29e; cursor: pointer; transition: all 0.2s; }
.tab .icon { font-size:18px; margin-bottom: 2px; }
.tab .label { font-size:11px; font-weight: 500; }
.tab.active { background: #E9EDC9; color:#283618; box-shadow:0 1px 2px rgba(0,0,0,0.05); transform: translateY(-1px); }
</style>