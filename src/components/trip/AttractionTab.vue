<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabaseClient'
import { Pencil, Sparkles, Utensils, TrainFront, Clock, Ticket, Navigation, MapPin } from 'lucide-vue-next'

const props = defineProps<{
  tripId: string | string[]
  isEditMode: boolean
  selectedDate: string
  startDateRaw: string
}>()

const attractions = ref<any[]>([])
const showAttractionForm = ref(false)
const isEditingAttraction = ref(false)
const editingAttractionId = ref<number | null>(null)

const attractionForm = ref({
  title: '', 
  date: '',
  subtitle: '', 
  location_tag: '', 
  description: '',
  highlights: '', 
  transport_info: '', 
  must_eat: '', 
  ticket_price: '', 
  opening_hours: '', 
  map_url: ''
})

const filteredAttractions = computed(() => {
  let filtered = attractions.value
  if (props.selectedDate) {
    filtered = filtered.filter(a => a.date === props.selectedDate)
  }
  return filtered.sort((a, b) => a.id - b.id)
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
      title: '', 
      date: props.selectedDate || props.startDateRaw,
      subtitle: '', 
      location_tag: '', 
      description: '', 
      highlights: '', 
      transport_info: '', 
      must_eat: '', 
      ticket_price: '', 
      opening_hours: '', 
      map_url: ''
    }
  }
  showAttractionForm.value = true
}

async function handleSaveAttraction() {
  if (!attractionForm.value.title) return alert('請填寫景點名稱')
  const payload = { ...attractionForm.value, trip_id: props.tripId }
  
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
  if (props.tripId === 'demo-korea') {
      attractions.value = [
          { 
              id: 1, date: '2026-04-01', location_tag: '弘大', title: '弘大商圈 (Hongdae)', subtitle: '年輕人必逛的街頭潮流聖地', 
              description: '充滿街頭表演、獨立服飾店、拍貼機與無數特色美食的商圈，越晚越熱鬧！', 
              highlights: '便宜好看的韓系服飾\n各式特色咖啡廳\n街頭藝人熱舞表演', 
              must_eat: '糖葫蘆\n烤腸\n路邊小吃黑輪', 
              transport_info: '地鐵2號線 弘大入口站 9號出口',
              opening_hours: '大部分店家 11:00 - 22:00',
              map_url: 'https://maps.app.goo.gl/dummy' 
          },
          { 
              id: 2, date: '2026-04-02', location_tag: '鐘路區', title: '景福宮 (Gyeongbokgung)', subtitle: '穿韓服穿越朝鮮時代', 
              description: '韓國最具代表性的皇家宮殿，穿著韓服可以免費入場！', 
              highlights: '勤政殿拍照\n光化門交接儀式\n秋季賞楓/春季賞櫻', 
              ticket_price: '3000 韓元 (穿韓服免費)',
              transport_info: '地鐵3號線 景福宮站 5號出口', 
              opening_hours: '09:00 - 18:00 (週二公休)',
              map_url: 'https://maps.app.goo.gl/dummy2' 
          }
      ]
      return
  }
  const { data } = await supabase.from('attractions').select('*').eq('trip_id', props.tripId).order('id', { ascending: true })
  attractions.value = data || []
}

function parseLines(text: string) {
  if (!text) return []
  return text.split('\n').filter(line => line.trim() !== '')
}

onMounted(loadAttractionsData)
defineExpose({ loadData: loadAttractionsData, attractions })
</script>

<template>
  <section class="px-4 pb-20">
    <div class="flex justify-between items-center mb-4 pl-1">
        <h2 class="font-display text-xl font-bold text-ink flex items-center gap-2">
            景點詳細介紹
        </h2>
    </div>

    <div class="grid gap-6 stagger">
        <div v-for="(attr, cardIdx) in filteredAttractions" :key="attr.id" :style="{ '--i': cardIdx }" class="card overflow-hidden relative group">
            <button v-if="props.isEditMode" @click="openAttractionForm(attr)" class="btn-icon absolute top-3 right-3 z-10 backdrop-blur-sm" aria-label="編輯景點"><Pencil class="h-4 w-4" :stroke-width="1.75" aria-hidden="true" /></button>
            <div class="relative overflow-hidden p-6 pt-10 pb-8">
                <div class="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-flare"></div>
                <div v-if="attr.location_tag" class="tag relative !text-flare !border-flare/30 !bg-flare/10 font-mono uppercase tracking-wider mb-3">
                    {{ attr.location_tag }}
                </div>
                <h3 class="relative font-display text-2xl font-bold mb-1 text-ink">{{ attr.title }}</h3>
                <p class="relative text-sm text-ink-soft font-medium">{{ attr.subtitle }}</p>
            </div>
            <div class="hairline"></div>
            <div class="p-5">
                <p class="text-ink-soft text-sm leading-relaxed mb-5 text-justify">{{ attr.description || '暫無描述' }}</p>
                <div class="rounded-2xl p-4 mb-5 border border-ink/10 bg-paper-deep/50" v-if="attr.highlights || attr.must_eat">
                    <h4 class="eyebrow !text-amber mb-3 flex items-center gap-1"><Sparkles class="h-3.5 w-3.5 shrink-0" :stroke-width="2" aria-hidden="true" /> 必訪亮點 </h4>
                    <ul class="space-y-2">
                        <li v-for="(line, idx) in parseLines(attr.highlights)" :key="'h'+idx" class="flex items-start gap-2 text-sm text-ink">
                            <span class="mt-0.5 text-xs text-flare">●</span><span>{{ line }}</span>
                        </li>
                        <li v-for="(line, idx) in parseLines(attr.must_eat)" :key="'m'+idx" class="flex items-start gap-2 text-sm text-ink">
                            <Utensils class="mt-0.5 h-3.5 w-3.5 shrink-0 text-flare" :stroke-width="2" aria-hidden="true" /><span>{{ line }}</span>
                        </li>
                    </ul>
                </div>
                <div class="grid grid-cols-1 gap-y-3 text-sm text-muted mb-6">
                    <div class="flex items-start gap-3" v-if="attr.transport_info"><TrainFront class="mt-0.5 h-5 w-5 shrink-0" :stroke-width="1.75" aria-hidden="true" /><div class="flex-1 border-b border-ink/10 pb-2 break-all">{{ attr.transport_info }}</div></div>
                    <div class="flex items-start gap-3" v-if="attr.opening_hours"><Clock class="mt-0.5 h-5 w-5 shrink-0" :stroke-width="1.75" aria-hidden="true" /><div class="flex-1 border-b border-ink/10 pb-2 break-all font-mono">{{ attr.opening_hours }}</div></div>
                    <div class="flex items-start gap-3" v-if="attr.ticket_price"><Ticket class="mt-0.5 h-5 w-5 shrink-0" :stroke-width="1.75" aria-hidden="true" /><div class="flex-1 break-all">{{ attr.ticket_price }}</div></div>
                </div>
                <a v-if="attr.map_url" :href="attr.map_url" target="_blank" class="btn-primary w-full !py-3"><Navigation class="h-4 w-4" :stroke-width="2" aria-hidden="true" /> Google 地圖導航</a>
            </div>
        </div>
        <div v-if="filteredAttractions.length === 0" class="card py-12 text-center !border-dashed !border-ink/15">
            <p class="text-muted mb-3">{{ props.isEditMode ? '這一天還沒有安排景點' : '暫無景點介紹' }}</p>
            <button v-if="props.isEditMode" @click="openAttractionForm()" class="btn-primary">新增第一個景點</button>
        </div>
    </div>
    <button v-if="props.isEditMode" @click="openAttractionForm()" class="btn-primary fixed bottom-28 right-6 !h-14 !w-14 !rounded-full !p-0 !pb-1 !text-3xl z-30 hover:scale-110" aria-label="新增景點">+</button>

    <!-- 景點表單 -->
    <div v-if="showAttractionForm" class="modal-backdrop" @click.self="showAttractionForm = false">
        <div class="modal-panel">
            <div class="flex justify-between mb-5 items-center">
                <h3 class="font-display font-bold text-xl text-ink">{{ isEditingAttraction ? '編輯景點' : '新增景點' }}</h3>
                <button @click="showAttractionForm=false" class="btn-icon" aria-label="關閉">✕</button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="field-label">安排日期 (選填)</label>
                    <input v-model="attractionForm.date" type="date" class="field appearance-none m-0 min-h-[46px] font-mono" />
                </div>
                <div class="flex gap-2">
                    <div class="w-1/3">
                        <label class="field-label">地區標籤</label>
                        <input v-model="attractionForm.location_tag" class="field text-center" />
                    </div>
                    <div class="flex-1">
                        <label class="field-label">景點名稱</label>
                        <input v-model="attractionForm.title" class="field font-bold" />
                    </div>
                </div>
                <div>
                    <label class="field-label">副標題</label>
                    <input v-model="attractionForm.subtitle" class="field" />
                </div>
                <div><label class="field-label">介紹描述</label><textarea v-model="attractionForm.description" class="field h-24"></textarea></div>
                <div class="rounded-2xl border border-ink/10 bg-paper-deep/50 p-3">
                    <label class="field-label !text-amber"><Sparkles class="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" :stroke-width="2" aria-hidden="true" />必訪亮點 (一行一個)</label><textarea v-model="attractionForm.highlights" class="field h-20"></textarea>
                    <label class="field-label !text-amber mt-3"><Utensils class="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" :stroke-width="2" aria-hidden="true" />必吃美食 (一行一個，可選)</label><textarea v-model="attractionForm.must_eat" class="field h-16"></textarea>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="field-label"><TrainFront class="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" :stroke-width="2" aria-hidden="true" />交通方式</label><input v-model="attractionForm.transport_info" class="field" /></div>
                    <div><label class="field-label"><Ticket class="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" :stroke-width="2" aria-hidden="true" />門票/費用</label><input v-model="attractionForm.ticket_price" class="field" /></div>
                    <div class="col-span-2"><label class="field-label"><Clock class="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" :stroke-width="2" aria-hidden="true" />營業時間</label><input v-model="attractionForm.opening_hours" class="field" /></div>
                </div>
                <div><label class="field-label"><MapPin class="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" :stroke-width="2" aria-hidden="true" />Google Map URL</label><input v-model="attractionForm.map_url" class="field !text-xs !text-flare" /></div>
                <div class="flex gap-3 mt-6 pt-4 border-t border-ink/10">
                    <button v-if="isEditingAttraction" @click="handleDeleteAttraction" class="btn-danger">刪除</button>
                    <button @click="handleSaveAttraction" class="btn-primary flex-1">儲存設定</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>
