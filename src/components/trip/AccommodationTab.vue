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

defineExpose({ loadData: loadAccommodationData, accommodations })
</script>

<template>
  <section class="px-4 pb-20">
    <div class="flex justify-between items-center mb-4 pl-1">
        <h2 class="font-display text-xl font-bold text-ink flex items-center gap-2">
            <span class="text-2xl">🏨</span> 住宿資訊
        </h2>
         <span class="eyebrow" v-if="accommodations.length > 0">共 {{ accommodations.length }} 間</span>
    </div>

    <div v-if="accommodations.length === 0" class="card py-12 text-center !border-dashed !border-ink/15">
        <p class="text-muted mb-3">{{ props.isEditMode ? '這裡空空如也' : '暫無住宿資料' }}</p>
        <button v-if="props.isEditMode" @click="openAccEdit()" class="btn-primary">新增第一間住宿</button>
    </div>

    <div v-else class="space-y-8 stagger">
        <div v-for="(item, cardIdx) in accommodations" :key="item.id" :style="{ '--i': cardIdx }">
            <div class="card overflow-hidden relative group">

                <button v-if="props.isEditMode" @click="openAccEdit(item)" class="btn-icon absolute top-3 right-3 z-10 backdrop-blur-sm">
                    ✏️
                </button>

                <div class="relative overflow-hidden p-5 pr-16">
                    <div class="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-aurora"></div>
                    <div class="relative flex items-start gap-3">
                        <div class="rounded-2xl border border-ink/10 bg-paper-deep p-2 text-2xl">🏠</div>
                        <div>
                            <h3 class="font-display font-bold text-lg leading-tight text-ink">{{ item.name }}</h3>
                            <div class="text-muted text-sm mt-1.5 flex flex-wrap items-center gap-2">
                                <div class="flex items-center gap-1"><span>📅</span><span>{{ getDisplayCheckInDate(item) }} 入住</span></div>
                                <span class="tag !text-flare !border-flare/30 !bg-flare/10 font-mono">{{ getStayDuration(item) }} 晚</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="hairline"></div>

                <div class="p-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 mb-6 text-sm">
                        <div class="flex gap-3">
                            <div class="text-flare mt-0.5 text-lg shrink-0">📍</div>
                            <div class="flex-1 min-w-0">
                                <div class="eyebrow mb-1">地址</div>
                                <div class="font-medium text-ink break-all">{{ item.address }}</div>
                            </div>
                        </div>
                        <div class="flex gap-3">
                            <div class="text-lagoon mt-0.5 text-lg shrink-0">🚇</div>
                            <div class="flex-1 min-w-0">
                                <div class="eyebrow mb-1">最近車站</div>
                                <div class="font-medium text-ink break-all">{{ item.station || '未設定' }}</div>
                            </div>
                        </div>
                        <div class="flex gap-3">
                            <div class="text-muted mt-0.5 text-lg">🕒</div>
                            <div class="flex-1">
                                <div class="eyebrow mb-1">Check-in</div>
                                <div class="font-bold text-ink font-mono text-base">{{ item.check_in_time }}</div>
                            </div>
                        </div>
                        <div class="flex gap-3">
                            <div class="text-muted mt-0.5 text-lg">🕒</div>
                            <div class="flex-1">
                                <div class="eyebrow mb-1">Check-out</div>
                                <div class="font-bold text-ink font-mono text-base">{{ item.check_out_time }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-ink/10 bg-paper-deep/50 overflow-hidden mb-6" v-if="item.transportation && item.transportation.length > 0">
                        <div class="p-3 border-b border-ink/10 flex items-center gap-2 bg-paper-deep/50"><span class="text-xl">🚄</span>
                            <h3 class="font-display font-bold text-ink text-sm">交通方式</h3>
                        </div>
                        <div class="p-5">
                            <ol class="relative border-l-2 border-flare/40 ml-2 space-y-6">
                                <li v-for="(trans, index) in item.transportation" :key="index" class="ml-6"><span class="absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full border-2 border-flare bg-paper-deep font-mono text-[10px] font-bold text-flare">{{ trans.step }}</span>
                                    <p class="text-sm text-ink-soft leading-relaxed font-medium">{{ trans.text }}</p>
                                </li>
                            </ol>
                            <div class="mt-6 flex items-start gap-2 rounded-xl border border-amber/20 bg-amber/10 p-3" v-if="item.transport_note"><span class="text-amber mt-0.5">💡</span>
                                <p class="text-xs text-ink-soft font-medium">{{ item.transport_note }}</p>
                            </div>
                        </div>
                    </div>

                    <a v-if="item.google_map_url" :href="item.google_map_url" target="_blank" class="btn-primary w-full !py-3">🗺️ Google地圖導航</a>
                </div>
            </div>
        </div>
    </div>

    <button v-if="props.isEditMode" @click="openAccEdit()" class="btn-primary fixed bottom-28 right-6 !h-14 !w-14 !rounded-full !p-0 !pb-1 !text-3xl z-30 hover:scale-110" aria-label="新增住宿">+</button>

    <!-- 住宿表單 -->
    <div v-if="showAccForm" class="modal-backdrop" @click.self="showAccForm = false">
        <div class="modal-panel !max-w-lg">
            <div class="flex justify-between items-center mb-5"><h3 class="font-display text-xl font-bold text-ink">{{ isEditingAcc ? '編輯住宿' : '新增住宿' }}</h3><button @click="showAccForm = false" class="btn-icon" aria-label="關閉">✕</button></div>
            <div class="space-y-4">
                <div><label class="field-label">名稱</label><input v-model="accForm.name" class="field" /></div>
                <div class="grid grid-cols-2 gap-x-3 gap-y-3 rounded-2xl border border-ink/10 bg-paper-deep/50 p-3">

                    <div class="col-span-2 text-xs font-bold text-ink flex items-center gap-1">
                        <span>📥</span> 入住時間 (Check-in)
                    </div>

                    <div>
                        <label class="field-label">日期</label>
                        <input
                            v-model="accForm.check_in_date"
                            type="date"
                            class="field appearance-none m-0 min-w-0 font-mono !px-3"
                        />
                    </div>

                    <div>
                        <label class="field-label">時間</label>
                        <div class="relative">
                            <select v-model="accForm.check_in_time" class="field appearance-none font-mono !px-3">
                                <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
                            </select>
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none text-[10px]">▼</div>
                        </div>
                    </div>

                    <div class="col-span-2 hairline my-1"></div>

                    <div class="col-span-2 text-xs font-bold text-ink flex items-center gap-1">
                        <span>📤</span> 退房時間 (Check-out)
                    </div>

                    <div>
                        <label class="field-label">日期</label>
                        <input
                            v-model="accForm.check_out_date"
                            type="date"
                            class="field appearance-none m-0 min-w-0 font-mono !px-3"
                        />
                    </div>

                    <div>
                        <label class="field-label">時間</label>
                        <div class="relative">
                            <select v-model="accForm.check_out_time" class="field appearance-none font-mono !px-3">
                                <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
                            </select>
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none text-[10px]">▼</div>
                        </div>
                    </div>
                </div>
                <div><label class="field-label">地址</label><input v-model="accForm.address" class="field" /></div>
                <div><label class="field-label">最近車站</label><input v-model="accForm.station" placeholder="例如: JR淺草站 (步行5分)" class="field" /></div>
                <div><label class="field-label">Google Map URL</label><input v-model="accForm.google_map_url" class="field !text-flare" /></div>
                <div class="rounded-2xl border border-ink/10 bg-paper-deep/50 p-3">
                    <label class="field-label">交通步驟</label>
                    <div v-for="(step, idx) in accForm.transportation" :key="idx" class="flex gap-2 mb-2"><span class="w-6 h-6 shrink-0 flex items-center justify-center bg-paper-deep border border-flare/50 rounded-full font-mono text-xs mt-3 text-flare font-bold">{{ Number(idx)+1 }}</span><textarea v-model="step.text" class="field flex-1 !py-2 h-16 resize-none break-all"></textarea><button @click="removeTransportStep(idx)" class="text-alert self-center px-1 text-lg">×</button></div>
                    <button @click="addTransportStep" class="w-full py-2 border border-dashed border-ink/15 rounded-xl text-xs text-muted transition hover:bg-paper-deep hover:text-ink">+ 步驟</button>
                </div>

                <div class="flex gap-3 mt-6 pt-4 border-t border-ink/10">
                    <button v-if="isEditingAcc" @click="handleDeleteAccommodation" class="btn-danger">刪除</button>
                    <button @click="saveAccommodation" class="btn-primary flex-1">儲存</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>
