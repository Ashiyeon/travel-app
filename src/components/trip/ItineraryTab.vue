<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabaseClient'

const props = defineProps<{
  tripId: string | string[]
  isEditMode: boolean
  selectedDate: string
  startDateRaw: string
}>()

const activities = ref<any[]>([])
const showActivityForm = ref(false)
const isEditingActivity = ref(false)
const editingActivityId = ref<number | null>(null)

const activityForm = ref({
  title: '', date: '', start_time: '', category: '', description: '', map_url: ''
})

const filteredActivities = computed(() => {
  let filtered = activities.value.filter(a => a.date)
  if (props.selectedDate) {
    filtered = filtered.filter(a => a.date === props.selectedDate)
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
      title: '', date: props.selectedDate || props.startDateRaw, 
      start_time: '', 
      category: '景點', 
      description: '', 
      map_url: '' 
    }
  }
  showActivityForm.value = true
}

async function handleSaveActivity() {
  if (!activityForm.value.title || !activityForm.value.date) return alert('請填寫日期與名稱')
  const payload = { ...activityForm.value, trip_id: props.tripId }
  
  let error = null
  if (isEditingActivity.value && editingActivityId.value) {
      const res = await supabase.from('activities').update(payload).eq('id', editingActivityId.value)
      error = res.error
  } else {
      const res = await supabase.from('activities').insert([payload])
      error = res.error
  }
  if (!error) { showActivityForm.value = false; loadActivitiesData(); emit('activity-saved', payload.date) } else alert(error.message)
}

const emit = defineEmits(['activity-saved'])

async function handleDeleteActivity() {
  if (!editingActivityId.value || !confirm('確定刪除？')) return
  const { error } = await supabase.from('activities').delete().eq('id', editingActivityId.value)
  if (!error) { showActivityForm.value = false; loadActivitiesData() }
}

async function loadActivitiesData() {
  if (props.tripId === 'demo-korea') {
      activities.value = [
          { id: 1, date: '2026-04-01', start_time: '12:00', category: '交通', title: '抵達仁川機場', description: '搭乘 AREX 機場快線前往市區' },
          { id: 2, date: '2026-04-01', start_time: '15:00', category: '住宿', title: '弘大 L7 飯店 Check-in', description: '先放行李' },
          { id: 3, date: '2026-04-01', start_time: '17:00', category: '景點', title: '弘大商圈逛街', description: '買衣服、拍貼機' },
          { id: 4, date: '2026-04-01', start_time: '19:30', category: '餐飲', title: '荒謬的生肉', description: '烤五花肉吃到飽！' },
          { id: 5, date: '2026-04-02', start_time: '10:00', category: '景點', title: '景福宮韓服體驗', description: '記得提早預約韓服' },
          { id: 6, date: '2026-04-02', start_time: '13:00', category: '餐飲', title: '土俗村蔘雞湯', description: '逛完吃熱呼呼的雞湯' },
          { id: 7, date: '2026-04-02', start_time: '15:00', category: '景點', title: '北村韓屋村', description: '漫步傳統街道' },
          { id: 8, date: '2026-04-03', start_time: '10:30', category: '景點', title: '廣藏市場', description: '吃綠豆煎餅、生拌牛肉' },
          { id: 9, date: '2026-04-03', start_time: '14:00', category: '活動', title: '明洞商圈血拚', description: '美妝保養品補貨' }
      ]
      return
  }
  const { data } = await supabase.from('activities').select('*').eq('trip_id', props.tripId).order('date').order('start_time')
  activities.value = data || []
}

const getIcon = (cat: string) => {
  if (cat === '交通') return '🚃'; 
  if (cat === '餐飲') return '🍱'; 
  if (cat === '住宿') return '🏨'; 
  if (cat === '活動') return '⚾';
  return '📍'; 
}

onMounted(loadActivitiesData)
defineExpose({ loadData: loadActivitiesData, activities })
</script>

<template>
  <section>
    <div class="p-4 space-y-4">
        <div v-if="activities.length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-stone-300">
            <p class="text-stone-400 mb-2">{{ props.isEditMode ? '這裡空空如也' : '暫無行程' }}</p>
            <button v-if="props.isEditMode" @click="openActivityForm()" class="text-[#BC4749] font-bold hover:underline">新增第一個行程</button>
        </div>

        <template v-else>
            <div v-for="act in filteredActivities" :key="act.id" 
                @click="props.isEditMode ? openActivityForm(act) : null" 
                :class="{ 'cursor-default': !props.isEditMode, 'hover:border-stone-300': props.isEditMode }"
                class="bg-white p-5 rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] border border-white ring-1 ring-stone-200 flex gap-8 transition-all relative group mb-4">
                
                <!-- 左側時間與飛行航線 (Option B: Typography-focused + Monospaced) -->
                <div class="flex flex-col items-center w-20 relative pt-1">
                    <div class="text-[#283618] font-mono text-xl font-black tracking-tight text-center leading-none drop-shadow-sm">
                        {{ act.start_time || '--:--' }}
                    </div>
                    <!-- 裝飾細線 -->
                    <div class="w-8 h-[2px] bg-[#606C38]/40 mt-2.5 rounded-full"></div>
                    <span class="text-[10px] text-stone-400 mt-2 font-bold uppercase tracking-tighter">{{ act.category }}</span>
                    
                    <!-- 航線路徑與圖標 -->
                    <div class="absolute -right-[23px] top-12 bottom-0 flex flex-col items-center">
                        <div class="w-[2px] h-full bg-stone-300/50"></div>
                    </div>
                    <div class="absolute -right-[35px] top-2.5 w-6 h-6 bg-[#FDFCF8] rounded-full flex items-center justify-center text-[12px] shadow-sm border border-stone-200 z-10">
                        <span v-if="act.category === '交通'">✈️</span>
                        <span v-else-if="act.category === '餐飲'">🍽️</span>
                        <span v-else-if="act.category === '住宿'">🏨</span>
                        <span v-else>📍</span>
                    </div>
                </div>

                <div class="flex-1 pt-1 pl-2">
                    <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-black text-lg text-[#283618] tracking-tight">{{ act.title }}</h3>
                    </div>
                    <p class="text-stone-500 text-sm leading-relaxed mb-3 line-clamp-3">{{ act.description }}</p>
                    
                    <div class="flex flex-wrap gap-2">
                        <a v-if="act.map_url" :href="act.map_url" target="_blank" @click.stop class="inline-flex items-center gap-1.5 bg-[#E9EDC9]/30 text-[#283618] text-[11px] px-3 py-1.5 rounded-lg font-bold hover:bg-[#283618] hover:text-white transition-all shadow-sm border border-[#E9EDC9]">
                             VIEW ON MAP
                        </a>
                    </div>
                </div>
                <div v-if="props.isEditMode" class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-stone-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </div>
            </div>

            <div v-if="filteredActivities.length === 0" class="text-center py-20 text-stone-400">
                <p>這一天還沒有行程喔</p>
                <button v-if="props.isEditMode" @click="openActivityForm()" class="text-[#BC4749] text-sm font-bold mt-2 hover:underline">+ 點此新增</button>
            </div>
        </template>
    </div>

    <button v-if="props.isEditMode" @click="openActivityForm()" class="fixed bottom-8 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-20 transition hover:scale-110 active:scale-95">+</button>

    <!-- 行程表單 -->
    <div v-if="showActivityForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-center justify-center p-4" @click.self="showActivityForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div class="flex justify-between mb-4"><h3 class="font-bold text-lg text-[#283618]">{{ isEditingActivity ? '編輯行程' : '新增行程' }}</h3><button @click="showActivityForm=false" class="text-2xl text-stone-400">×</button></div>
            <div class="space-y-3">
                <input v-model="activityForm.date" type="date" class="w-full appearance-none m-0 border border-stone-300 px-3 py-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38] min-h-[42px]" />                
                <div class="flex gap-2 mt-2">
                    <input v-model="activityForm.start_time" placeholder="時間 (09:00)" class="w-1/3 border border-stone-300 p-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38]" />
                    <select v-model="activityForm.category" class="flex-1 border border-stone-300 p-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38]"><option>景點</option><option>交通</option><option>餐飲</option><option>活動</option><option>住宿</option></select>
                </div>
                <input v-model="activityForm.title" placeholder="名稱" class="w-full border border-stone-300 p-2 rounded-xl bg-white focus:outline-none focus:border-[#606C38]" />
                <input v-model="activityForm.map_url" placeholder="📍 Google Map 連結" class="w-full border border-stone-300 p-2 rounded-xl bg-white text-sm text-[#606C38] focus:outline-none focus:border-[#606C38]" />
                <textarea v-model="activityForm.description" placeholder="備註" class="w-full border border-stone-300 p-2 rounded-xl bg-white h-24 focus:outline-none focus:border-[#606C38] resize-none break-all"></textarea>
                <div class="flex gap-2 mt-2">
                    <button v-if="isEditingActivity" @click="handleDeleteActivity" class="bg-red-50 text-[#BC4749] flex-1 py-2 rounded-xl">刪除</button>
                    <button @click="handleSaveActivity" class="bg-[#283618] text-white flex-1 py-2 rounded-xl hover:bg-[#3A5A40]">確認</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>
