<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabaseClient'

const props = defineProps<{
  tripId: string | string[]
  isEditMode: boolean
}>()

// --- 產生每 30 分鐘的時間選項 ---
const timeOptions = computed(() => {
  const times = []
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0')
    times.push(`${hour}:00`)
    times.push(`${hour}:30`)
  }
  return times
})

//  PART 3: 住宿 (Accommodation)
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
    trip_id: props.tripId, 
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
    if (props.tripId === 'demo-korea') {
        accommodations.value = [
            { 
                id: 1, 
                name: 'L7 弘大飯店 (L7 Hongdae by LOTTE)', 
                address: '首爾特別市麻浦區楊花路141', 
                station: '弘大入口站 1號出口 (步行 1 分鐘)', 
                check_in_date: '2026-04-01', 
                check_out_date: '2026-04-05', 
                check_in_time: '15:00', 
                check_out_time: '12:00', 
                google_map_url: 'https://maps.app.goo.gl/dummy',
                transportation: [
                    { step: 1, text: '從仁川機場搭乘 AREX 機場快線 (普通車)' }, 
                    { step: 2, text: '於「弘大入口站」下車，由 1 號出口出站' },
                    { step: 3, text: '出站後向右步行約 1 分鐘即達' }
                ],
                transport_note: '若行李較多，建議搭乘普通車免轉乘直達弘大，費用也比直達車便宜！'
            }
        ]
        return
    }
    const { data } = await supabase.from('accommodations').select('*').eq('trip_id', props.tripId).order('check_in_date', { ascending: true })
    accommodations.value = data || []
}

const getDisplayCheckInDate = (item: any) => item.check_in_date ? `${new Date(item.check_in_date).getMonth() + 1}月${new Date(item.check_in_date).getDate()}日` : '未設定'
const getStayDuration = (item: any) => (item.check_in_date && item.check_out_date) ? Math.max(0, Math.ceil((new Date(item.check_out_date).getTime() - new Date(item.check_in_date).getTime()) / 86400000)) : 1

onMounted(loadAccommodationData)

defineExpose({ loadData: loadAccommodationData })
</script>

<template>
  <section class="px-4 pb-20">
    <div class="flex justify-between items-center mb-4 pl-1">
        <h2 class="text-xl font-bold text-[#BC4749] flex items-center gap-2">
            <span class="text-2xl">🏨</span> 住宿資訊
        </h2>
         <span class="text-xs text-stone-400" v-if="accommodations.length > 0">共 {{ accommodations.length }} 間</span>
    </div>

    <div v-if="accommodations.length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-stone-300">
        <p class="text-stone-400 mb-2">{{ props.isEditMode ? '這裡空空如也' : '暫無住宿資料' }}</p>
        <button v-if="props.isEditMode" @click="openAccEdit()" class="text-[#BC4749] font-bold hover:underline">新增第一間住宿</button>
    </div>

    <div v-else class="space-y-8">
        <div v-for="item in accommodations" :key="item.id">
            <div class="bg-white rounded-xl shadow-md border border-stone-100 overflow-hidden relative group hover:shadow-lg transition-shadow">
                
                <button v-if="props.isEditMode" @click="openAccEdit(item)" class="absolute top-3 right-3 z-10 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition">
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
                            <div class="text-[#BC4749] mt-0.5 text-lg shrink-0">📍</div>
                            <div class="flex-1 min-w-0">
                                <div class="text-stone-400 text-xs mb-0.5">地址</div>
                                <div class="font-medium text-stone-800 break-all">{{ item.address }}</div>
                            </div>
                        </div>
                        <div class="flex gap-3">
                            <div class="text-[#606C38] mt-0.5 text-lg shrink-0">🚇</div>
                            <div class="flex-1 min-w-0">
                                <div class="text-stone-400 text-xs mb-0.5">最近車站</div>
                                <div class="font-medium text-stone-800 break-all">{{ item.station || '未設定' }}</div>
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
    
    <button v-if="props.isEditMode" @click="openAccEdit()" class="fixed bottom-32 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-30 transition hover:scale-110 active:scale-95">+</button>

    <!-- 住宿表單 -->
    <div v-if="showAccForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" @click.self="showAccForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-5 bg-[#FDFCF8] z-10 py-2 border-b border-stone-200"><h3 class="text-lg font-black text-[#283618]">{{ isEditingAcc ? '編輯住宿' : '新增住宿' }}</h3><button @click="showAccForm = false" class="text-stone-400 text-2xl">×</button></div>
            <div class="space-y-4">
                <div><label class="text-xs text-stone-500">名稱</label><input v-model="accForm.name" class="w-full border border-stone-300 bg-white rounded px-2 py-2 focus:outline-none focus:border-[#606C38]" /></div>
                <div class="grid grid-cols-2 gap-x-3 gap-y-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                    
                    <div class="col-span-2 text-xs font-bold text-stone-700 flex items-center gap-1">
                        <span>📥</span> 入住時間 (Check-in)
                    </div>
                    
                    <div>
                        <label class="text-[10px] text-stone-400 font-bold mb-0.5 block">日期</label>
                        <input 
                            v-model="accForm.check_in_date" 
                            type="date" 
                            class="w-full appearance-none m-0 bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#606C38] min-w-0" 
                        />
                    </div>
                    
                    <div>
                        <label class="text-[10px] text-stone-400 font-bold mb-0.5 block">時間</label>
                        <div class="relative">
                            <select v-model="accForm.check_in_time" class="w-full appearance-none bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#606C38]">
                                <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
                            </select>
                            <div class="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none text-[10px]">▼</div>
                        </div>
                    </div>

                    <div class="col-span-2 border-t border-stone-200 my-1"></div>

                    <div class="col-span-2 text-xs font-bold text-stone-700 flex items-center gap-1">
                        <span>📤</span> 退房時間 (Check-out)
                    </div>
                    
                    <div>
                        <label class="text-[10px] text-stone-400 font-bold mb-0.5 block">日期</label>
                        <input 
                            v-model="accForm.check_out_date" 
                            type="date" 
                            class="w-full appearance-none m-0 bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#606C38] min-w-0" 
                        />
                    </div>
                    
                    <div>
                        <label class="text-[10px] text-stone-400 font-bold mb-0.5 block">時間</label>
                        <div class="relative">
                            <select v-model="accForm.check_out_time" class="w-full appearance-none bg-white border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#606C38]">
                                <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
                            </select>
                            <div class="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none text-[10px]">▼</div>
                        </div>
                    </div>
                </div>
                <div><label class="text-xs text-stone-500">地址</label><input v-model="accForm.address" class="w-full border border-stone-300 bg-white rounded px-2 py-2 focus:outline-none focus:border-[#606C38]" /></div>
                <div><label class="text-xs text-stone-500">最近車站</label><input v-model="accForm.station" placeholder="例如: JR淺草站 (步行5分)" class="w-full border border-stone-300 bg-white rounded px-2 py-2 focus:outline-none focus:border-[#606C38]" /></div>
                <div><label class="text-xs text-stone-500">Google Map URL</label><input v-model="accForm.google_map_url" class="w-full border border-stone-300 bg-white rounded px-2 py-2 text-[#606C38] focus:outline-none focus:border-[#606C38]" /></div>
                <div class="bg-stone-50 p-3 rounded border border-stone-200">
                    <label class="text-xs font-bold mb-2 block text-stone-700">交通步驟</label>
                    <div v-for="(step, idx) in accForm.transportation" :key="idx" class="flex gap-2 mb-2"><span class="w-6 h-6 flex items-center justify-center bg-white border border-stone-300 rounded-full text-xs mt-2 text-[#606C38] font-bold">{{ Number(idx)+1 }}</span><textarea v-model="step.text" class="flex-1 bg-white border border-stone-300 rounded px-2 py-1 h-16 resize-none focus:outline-none focus:border-[#606C38] break-all"></textarea><button @click="removeTransportStep(idx)" class="text-[#BC4749] self-center">×</button></div>
                    <button @click="addTransportStep" class="w-full py-2 border border-dashed border-stone-300 rounded text-xs text-stone-500 hover:bg-stone-100">+ 步驟</button>
                </div>
                
                <div class="flex gap-3 mt-6 pt-2 border-t border-stone-100">
                    <button v-if="isEditingAcc" @click="handleDeleteAccommodation" class="bg-red-50 text-[#BC4749] px-4 py-3 rounded-xl font-bold text-sm">刪除</button>
                    <button @click="saveAccommodation" class="flex-1 bg-[#283618] text-white py-3 rounded-xl font-bold hover:bg-[#3A5A40]">儲存</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>
