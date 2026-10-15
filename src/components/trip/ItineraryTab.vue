<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabaseClient'
import { Plane, Utensils, BedDouble, MapPin } from 'lucide-vue-next'

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

onMounted(loadActivitiesData)
defineExpose({ loadData: loadActivitiesData, activities })
</script>

<template>
  <section>
    <div class="p-4 space-y-4">
        <div v-if="activities.length === 0" class="card py-12 text-center !border-dashed !border-ink/15">
            <p class="text-muted mb-3">{{ props.isEditMode ? '這裡空空如也' : '暫無行程' }}</p>
            <button v-if="props.isEditMode" @click="openActivityForm()" class="btn-primary">新增第一個行程</button>
        </div>

        <template v-else>
            <div class="stagger space-y-4">
            <div v-for="(act, idx) in filteredActivities" :key="act.id"
                @click="props.isEditMode ? openActivityForm(act) : null"
                :style="{ '--i': idx }"
                :class="props.isEditMode ? 'cursor-pointer card-hover' : 'cursor-default'"
                class="card p-5 flex gap-8 relative group">

                <!-- 左側時間與飛行航線 -->
                <div class="flex flex-col items-center w-20 relative pt-1">
                    <div class="text-ink font-mono text-xl font-bold tracking-normal text-center leading-none antialiased">
                        {{ act.start_time || '--:--' }}
                    </div>
                    <!-- 裝飾細線 -->
                    <div class="w-8 h-[2px] bg-flare mt-2.5 rounded-full"></div>
                    <span class="eyebrow !text-[10px] mt-2 !tracking-[0.15em]">{{ act.category }}</span>

                    <!-- 航線路徑與圖標 -->
                    <div class="absolute -right-[23px] top-12 bottom-0 flex flex-col items-center">
                        <div class="w-[2px] h-full bg-ink/10"></div>
                    </div>
                    <div class="absolute -right-[35px] top-2.5 w-6 h-6 bg-paper-deep rounded-full flex items-center justify-center text-[12px] shadow-sm border border-ink/15 z-10">
                        <Plane v-if="act.category === '交通'" class="h-3.5 w-3.5 text-ink-soft" :stroke-width="2" aria-hidden="true" />
                        <Utensils v-else-if="act.category === '餐飲'" class="h-3.5 w-3.5 text-ink-soft" :stroke-width="2" aria-hidden="true" />
                        <BedDouble v-else-if="act.category === '住宿'" class="h-3.5 w-3.5 text-ink-soft" :stroke-width="2" aria-hidden="true" />
                        <MapPin v-else class="h-3.5 w-3.5 text-ink-soft" :stroke-width="2" aria-hidden="true" />
                    </div>
                </div>

                <div class="flex-1 pt-1 pl-2 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-display font-bold text-lg text-ink tracking-tight break-all">{{ act.title }}</h3>
                    </div>
                    <p class="text-muted text-sm leading-relaxed mb-3 break-all whitespace-pre-wrap">{{ act.description }}</p>

                    <div class="flex flex-wrap gap-2">
                        <a v-if="act.map_url" :href="act.map_url" target="_blank" @click.stop class="tag !text-flare !border-flare/30 !bg-flare/10 font-mono uppercase tracking-wider hover:!bg-flare/20 transition-all">
                             VIEW ON MAP
                        </a>
                    </div>
                </div>
                <div v-if="props.isEditMode" class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-faint">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </div>
            </div>
            </div>

            <div v-if="filteredActivities.length === 0" class="text-center py-20 text-faint">
                <p>這一天還沒有行程喔</p>
                <button v-if="props.isEditMode" @click="openActivityForm()" class="text-flare text-sm font-bold mt-2 hover:underline">+ 點此新增</button>
            </div>
        </template>
    </div>

    <button v-if="props.isEditMode" @click="openActivityForm()" class="btn-primary fixed bottom-28 right-6 !h-14 !w-14 !rounded-full !p-0 !pb-1 !text-3xl z-30 hover:scale-110" aria-label="新增行程">+</button>

    <!-- 行程表單 -->
    <div v-if="showActivityForm" class="modal-backdrop" @click.self="showActivityForm = false">
        <div class="modal-panel">
            <div class="flex justify-between items-center mb-5"><h3 class="font-display font-bold text-xl text-ink">{{ isEditingActivity ? '編輯行程' : '新增行程' }}</h3><button @click="showActivityForm=false" class="btn-icon" aria-label="關閉">✕</button></div>
            <div class="space-y-3">
                <input v-model="activityForm.date" type="date" class="field appearance-none m-0 min-h-[46px] font-mono" />
                <div class="flex gap-2 mt-2">
                    <input v-model="activityForm.start_time" placeholder="時間 (09:00)" class="field w-1/3 font-mono" />
                    <select v-model="activityForm.category" class="field flex-1"><option>景點</option><option>交通</option><option>餐飲</option><option>活動</option><option>住宿</option></select>
                </div>
                <input v-model="activityForm.title" placeholder="名稱" class="field" />
                <input v-model="activityForm.map_url" placeholder="Google Map 連結" class="field !text-flare" />
                <textarea v-model="activityForm.description" placeholder="備註" class="field h-24 resize-none break-all"></textarea>
                <div class="flex gap-2 mt-2">
                    <button v-if="isEditingActivity" @click="handleDeleteActivity" class="btn-danger flex-1">刪除</button>
                    <button @click="handleSaveActivity" class="btn-primary flex-1">確認</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>
