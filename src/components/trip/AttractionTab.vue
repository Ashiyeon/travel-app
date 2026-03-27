<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabaseClient'

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
        <h2 class="text-xl font-bold text-[#BC4749] flex items-center gap-2"> 
            <span class="text-xl">🌅</span> 景點詳細介紹
        </h2>
    </div>

    <div class="grid gap-6">
        <div v-for="attr in filteredAttractions" :key="attr.id" class="bg-white rounded-xl shadow-md overflow-hidden border border-stone-100 relative group hover:shadow-lg transition-all">
            <button v-if="props.isEditMode" @click="openAttractionForm(attr)" class="absolute top-3 right-3 z-10 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition">✏️</button>
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
                    <h4 class="text-sm font-bold text-[#A98467] mb-2 flex items-center gap-1"><span>✨</span> 必訪亮點 </h4>
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
                    <div class="flex items-start gap-3" v-if="attr.transport_info"><div class="w-5 text-center text-lg shrink-0">🚇</div><div class="flex-1 border-b border-stone-100 pb-2 break-all">{{ attr.transport_info }}</div></div>
                    <div class="flex items-start gap-3" v-if="attr.opening_hours"><div class="w-5 text-center text-lg shrink-0">⏰</div><div class="flex-1 border-b border-stone-100 pb-2 break-all">{{ attr.opening_hours }}</div></div>
                    <div class="flex items-start gap-3" v-if="attr.ticket_price"><div class="w-5 text-center text-lg shrink-0">🎫</div><div class="flex-1 break-all">{{ attr.ticket_price }}</div></div>
                </div>
                <a v-if="attr.map_url" :href="attr.map_url" target="_blank" class="block w-full bg-[#606C38] hover:bg-[#283618] text-white text-center py-3 rounded-lg font-bold shadow-md active:scale-[0.98] transition-all flex justify-center items-center gap-2"><span>🗺️</span> Google 地圖導航</a>
            </div>
        </div>
        <div v-if="filteredAttractions.length === 0" class="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
            <p class="text-stone-400 mb-2">{{ props.isEditMode ? '這一天還沒有安排景點' : '暫無景點介紹' }}</p>
            <button v-if="props.isEditMode" @click="openAttractionForm()" class="text-[#BC4749] font-bold hover:underline">新增第一個景點</button>
        </div>
    </div>
    <button v-if="props.isEditMode" @click="openAttractionForm()" class="fixed bottom-32 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-30 transition hover:scale-110 active:scale-95">+</button>

    <!-- 景點表單 -->
    <div v-if="showAttractionForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-center justify-center p-4" @click.self="showAttractionForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between mb-4 items-center">
                <h3 class="font-bold text-lg text-[#283618]">{{ isEditingAttraction ? '編輯景點' : '新增景點' }}</h3>
                <button @click="showAttractionForm=false" class="text-2xl text-stone-400 hover:text-stone-600">×</button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="text-xs text-stone-500 mb-1 block">安排日期 (選填)</label>
                    <input v-model="attractionForm.date" type="date" class="w-full appearance-none border border-stone-300 bg-white rounded-lg px-3 py-2 m-0 focus:outline-none focus:border-[#606C38] min-h-[42px]" />
                </div>
                <div class="flex gap-2">
                    <div class="w-1/3">
                        <label class="text-xs text-stone-500 mb-1 block">地區標籤</label>
                        <input v-model="attractionForm.location_tag" class="w-full border border-stone-300 p-2 rounded-lg bg-white text-center focus:outline-none focus:border-[#606C38]" />
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-stone-500 mb-1 block">景點名稱</label>
                        <input v-model="attractionForm.title" class="w-full border border-stone-300 p-2 rounded-lg bg-white font-bold focus:outline-none focus:border-[#606C38]" />
                    </div>
                </div>
                <div>
                    <label class="text-xs text-stone-500 mb-1 block">副標題</label>
                    <input v-model="attractionForm.subtitle" class="w-full border border-stone-300 p-2 rounded-lg bg-white focus:outline-none focus:border-[#606C38]" />
                </div>
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
  </section>
</template>
