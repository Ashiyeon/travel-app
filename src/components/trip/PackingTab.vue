<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabaseClient'

const props = defineProps<{
  tripId: string | string[]
  isEditMode: boolean
  tripMembers: string[]
}>()

interface PackingItem {
  id: number
  name: string
  category: string
  assignee: string | null
  is_packed: boolean
}

const FILTER_ALL = '__all__'
const FILTER_NONE = '__none__'
const CUSTOM_CATEGORY = '__custom__'
const DEFAULT_CATEGORY = '其他'
const PRESET_CATEGORIES = ['證件', '金錢', '電子產品', '衣物', '盥洗', '藥品', '其他']

// 常用範本（assignee 一律不指定，讓旅伴自己分配）
const TEMPLATE_ITEMS: { name: string; category: string }[] = [
  { name: '護照', category: '證件' },
  { name: '機票/電子登機證', category: '證件' },
  { name: '外幣/信用卡', category: '金錢' },
  { name: '網卡/eSIM', category: '電子產品' },
  { name: '手機充電器', category: '電子產品' },
  { name: '行動電源', category: '電子產品' },
  { name: '轉接頭', category: '電子產品' },
  { name: '換洗衣物', category: '衣物' },
  { name: '外套/雨具', category: '衣物' },
  { name: '盥洗用品', category: '盥洗' },
  { name: '常備藥品', category: '藥品' },
  { name: '口罩/濕紙巾', category: '其他' },
]

const isDemo = computed(() => props.tripId === 'demo-korea')

const items = ref<PackingItem[]>([])
const loading = ref(false)
const loadError = ref('')
const filter = ref<string>(FILTER_ALL)
const pendingIds = ref<number[]>([])
const applyingTemplate = ref(false)

// --- 表單 ---
const showForm = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const confirmingDelete = ref(false)
const form = ref({ name: '', categorySelect: DEFAULT_CATEGORY, customCategory: '', assignee: '' })

// --- 衍生資料 ---
const totalCount = computed(() => items.value.length)
const packedCount = computed(() => items.value.filter(i => i.is_packed).length)
const progressPct = computed(() => totalCount.value === 0 ? 0 : Math.round((packedCount.value / totalCount.value) * 100))

// 篩選 chip：旅伴 + 清單裡出現過但不在旅伴名單的負責人（例如旅伴被移除後）
const memberChips = computed(() => {
  const list = [...(props.tripMembers || [])]
  for (const it of items.value) {
    if (it.assignee && !list.includes(it.assignee)) list.push(it.assignee)
  }
  return list
})

const categoryOptions = computed(() => {
  const list = [...PRESET_CATEGORIES]
  for (const it of items.value) {
    if (it.category && !list.includes(it.category)) list.push(it.category)
  }
  return list
})

const assigneeOptions = computed(() => {
  const list = [...(props.tripMembers || [])]
  const cur = form.value.assignee
  if (cur && !list.includes(cur)) list.push(cur)
  return list
})

const filteredItems = computed(() => {
  if (filter.value === FILTER_ALL) return items.value
  if (filter.value === FILTER_NONE) return items.value.filter(i => !i.assignee)
  return items.value.filter(i => i.assignee === filter.value)
})

const groups = computed(() => {
  const map = new Map<string, PackingItem[]>()
  const sorted = [...filteredItems.value].sort((a, b) => a.id - b.id)
  for (const it of sorted) {
    const key = it.category || DEFAULT_CATEGORY
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  const rank = (c: string) => {
    const i = PRESET_CATEGORIES.indexOf(c)
    return i === -1 ? PRESET_CATEGORIES.length : i
  }
  return [...map.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([category, list]) => ({
      category,
      list,
      packed: list.filter(i => i.is_packed).length,
    }))
})

// --- 讀取 ---
async function loadData() {
  if (isDemo.value) {
    items.value = [
      { id: 1, name: '護照', category: '證件', assignee: null, is_packed: true },
      { id: 2, name: '電子登機證', category: '證件', assignee: null, is_packed: true },
      { id: 3, name: '網卡/eSIM', category: '電子產品', assignee: '小美', is_packed: true },
      { id: 4, name: '轉接頭', category: '電子產品', assignee: '大壯', is_packed: false },
      { id: 5, name: '行動電源', category: '電子產品', assignee: '阿明', is_packed: false },
      { id: 6, name: '換洗衣物', category: '衣物', assignee: null, is_packed: false },
      { id: 7, name: '薄外套', category: '衣物', assignee: '小美', is_packed: true },
      { id: 8, name: '牙刷牙膏', category: '盥洗', assignee: null, is_packed: false },
      { id: 9, name: '防曬乳', category: '盥洗', assignee: '小美', is_packed: false },
      { id: 10, name: '常備藥品（腸胃藥、感冒藥）', category: '藥品', assignee: '阿明', is_packed: false },
    ]
    loadError.value = ''
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const { data, error } = await supabase
      .from('packing_items')
      .select('*')
      .eq('trip_id', props.tripId)
      .order('id', { ascending: true })
    if (error) {
      loadError.value = error.message
    } else {
      items.value = (data || []) as PackingItem[]
    }
  } catch (e: any) {
    loadError.value = e?.message || '讀取失敗'
  } finally {
    loading.value = false
  }
}

// --- 勾選打包（樂觀更新） ---
async function togglePacked(item: PackingItem) {
  if (pendingIds.value.includes(item.id)) return
  const prev = item.is_packed
  const next = !prev
  item.is_packed = next

  if (isDemo.value) return // 範例行程：只改本地狀態

  pendingIds.value.push(item.id)
  try {
    const { error } = await supabase.from('packing_items').update({ is_packed: next }).eq('id', item.id)
    if (error) {
      item.is_packed = prev
      alert(error.message)
    }
  } catch (e: any) {
    item.is_packed = prev
    alert(e?.message || '更新失敗')
  } finally {
    pendingIds.value = pendingIds.value.filter(id => id !== item.id)
  }
}

// --- 表單 ---
function openForm(item?: PackingItem) {
  if (isDemo.value) return
  confirmingDelete.value = false
  if (item) {
    isEditing.value = true
    editingId.value = item.id
    const cat = item.category || DEFAULT_CATEGORY
    const known = categoryOptions.value.includes(cat)
    form.value = {
      name: item.name,
      categorySelect: known ? cat : CUSTOM_CATEGORY,
      customCategory: known ? '' : cat,
      assignee: item.assignee || '',
    }
  } else {
    isEditing.value = false
    editingId.value = null
    form.value = { name: '', categorySelect: DEFAULT_CATEGORY, customCategory: '', assignee: '' }
  }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  confirmingDelete.value = false
}

async function handleSave() {
  const name = form.value.name.trim()
  if (!name) return alert('請填寫項目名稱')
  const category = (form.value.categorySelect === CUSTOM_CATEGORY
    ? form.value.customCategory.trim()
    : form.value.categorySelect) || DEFAULT_CATEGORY
  const payload = {
    name,
    category,
    assignee: form.value.assignee || null,
  }

  saving.value = true
  try {
    let error = null
    if (isEditing.value && editingId.value !== null) {
      const res = await supabase.from('packing_items').update(payload).eq('id', editingId.value)
      error = res.error
    } else {
      const res = await supabase.from('packing_items').insert([{ ...payload, trip_id: props.tripId }])
      error = res.error
    }
    if (error) return alert(error.message)
    closeForm()
    await loadData()
  } catch (e: any) {
    alert(e?.message || '儲存失敗')
  } finally {
    saving.value = false
  }
}

// 兩段式刪除：第一次按只進入確認狀態，第二次才真的刪
async function handleDelete() {
  if (editingId.value === null) return
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  saving.value = true
  try {
    const { error } = await supabase.from('packing_items').delete().eq('id', editingId.value)
    if (error) return alert(error.message)
    closeForm()
    await loadData()
  } catch (e: any) {
    alert(e?.message || '刪除失敗')
  } finally {
    saving.value = false
  }
}

// --- 套用範本 ---
async function applyTemplate() {
  if (isDemo.value || applyingTemplate.value) return
  const existing = new Set(items.value.map(i => i.name.trim().toLowerCase()))
  const toInsert = TEMPLATE_ITEMS
    .filter(t => !existing.has(t.name.trim().toLowerCase()))
    .map(t => ({ trip_id: props.tripId, name: t.name, category: t.category, assignee: null }))
  if (toInsert.length === 0) return alert('範本裡的項目都已經在清單中了')

  applyingTemplate.value = true
  try {
    const { error } = await supabase.from('packing_items').insert(toInsert)
    if (error) return alert(error.message)
    await loadData()
  } catch (e: any) {
    alert(e?.message || '套用範本失敗')
  } finally {
    applyingTemplate.value = false
  }
}

onMounted(loadData)
defineExpose({ loadData, items })
</script>

<template>
  <section class="px-4 pb-24">
    <!-- 標題與整體進度 -->
    <div class="mb-4 pl-1">
      <div class="flex justify-between items-center">
        <h2 class="font-display text-xl font-bold text-ink flex items-center gap-2">
          <span class="text-2xl">🧳</span> 行李清單
        </h2>
        <span v-if="totalCount > 0" class="eyebrow">
          已打包 <span class="font-mono text-ink font-bold">{{ packedCount }}</span> / 共 <span class="font-mono text-ink font-bold">{{ totalCount }}</span>
        </span>
      </div>
      <div v-if="totalCount > 0" class="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-deep" role="progressbar" :aria-valuenow="progressPct" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full rounded-full bg-lagoon transition-all duration-500" :style="{ width: progressPct + '%' }"></div>
      </div>
    </div>

    <!-- 讀取失敗 -->
    <div v-if="loadError" class="card py-10 px-5 text-center !border-alert/30">
      <p class="text-alert font-bold mb-1">行李清單讀取失敗</p>
      <p class="text-muted text-sm mb-4 break-all">{{ loadError }}</p>
      <button @click="loadData" class="btn-primary" :disabled="loading">{{ loading ? '讀取中…' : '重試' }}</button>
    </div>

    <!-- 讀取中（第一次） -->
    <div v-else-if="loading && items.length === 0" class="card py-12 text-center text-faint">讀取中…</div>

    <!-- 空狀態 -->
    <div v-else-if="items.length === 0" class="card py-12 px-5 text-center !border-dashed !border-ink/15">
      <div class="text-4xl mb-2">🧳</div>
      <p class="text-muted mb-1">{{ props.isEditMode ? '還沒有任何要帶的東西' : '行李清單還是空的' }}</p>
      <p v-if="props.isEditMode" class="text-faint text-xs mb-4">可以一鍵帶入常用項目，再慢慢調整</p>
      <div v-if="props.isEditMode" class="flex flex-wrap justify-center gap-2">
        <button @click="applyTemplate" class="btn-primary" :disabled="applyingTemplate">{{ applyingTemplate ? '套用中…' : '套用常用範本' }}</button>
        <button @click="openForm()" class="btn-ghost">自己新增</button>
      </div>
    </div>

    <template v-else>
      <!-- 篩選 chip -->
      <div class="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4">
        <button class="chip" :class="{ 'chip-active': filter === FILTER_ALL }" @click="filter = FILTER_ALL">全部</button>
        <button v-for="m in memberChips" :key="m" class="chip" :class="{ 'chip-active': filter === m }" @click="filter = m">{{ m }}</button>
        <button class="chip" :class="{ 'chip-active': filter === FILTER_NONE }" @click="filter = FILTER_NONE">未指定</button>
      </div>

      <div v-if="props.isEditMode" class="mb-3 flex justify-end">
        <button @click="applyTemplate" class="btn-ghost !py-1.5 !text-xs" :disabled="applyingTemplate">{{ applyingTemplate ? '套用中…' : '＋ 套用常用範本' }}</button>
      </div>

      <div v-if="groups.length === 0" class="text-center py-16 text-faint">
        <p>這個篩選條件下沒有項目</p>
        <button class="text-flare text-sm font-bold mt-2 hover:underline" @click="filter = FILTER_ALL">看全部</button>
      </div>

      <div v-else class="stagger space-y-4">
        <div v-for="(g, gi) in groups" :key="g.category" :style="{ '--i': gi }" class="card overflow-hidden">
          <div class="flex items-center justify-between px-5 pt-4 pb-2">
            <span class="eyebrow !text-[11px] uppercase">{{ g.category }}</span>
            <span class="font-mono text-[11px] text-faint">{{ g.packed }}/{{ g.list.length }}</span>
          </div>
          <div class="hairline"></div>
          <ul>
            <li v-for="(it, idx) in g.list" :key="it.id" class="flex items-center gap-3 px-4 py-2" :class="idx > 0 ? 'border-t border-ink/5' : ''">
              <!-- 勾選框 -->
              <button
                type="button"
                role="checkbox"
                :aria-checked="it.is_packed"
                :aria-label="(it.is_packed ? '取消已打包：' : '標記已打包：') + it.name"
                :disabled="pendingIds.includes(it.id)"
                @click="togglePacked(it)"
                class="flex h-11 w-11 shrink-0 items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all duration-200"
                  :class="it.is_packed ? 'border-lagoon bg-lagoon text-card' : 'border-ink/25 bg-card text-transparent'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
              </button>

              <!-- 名稱 -->
              <component
                :is="props.isEditMode && !isDemo ? 'button' : 'span'"
                :type="props.isEditMode && !isDemo ? 'button' : undefined"
                @click="props.isEditMode && !isDemo ? openForm(it) : null"
                class="flex-1 min-w-0 text-left text-base break-all transition-colors"
                :class="[
                  it.is_packed ? 'line-through text-faint' : 'text-ink font-medium',
                  props.isEditMode && !isDemo ? 'cursor-pointer hover:text-flare' : '',
                ]"
              >{{ it.name }}</component>

              <!-- 負責人 -->
              <span
                class="tag shrink-0"
                :class="it.assignee ? '!text-aurora !border-aurora/30 !bg-aurora/10' : '!text-faint'"
              >{{ it.assignee || '各自帶' }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <button v-if="props.isEditMode && !isDemo" @click="openForm()" class="btn-primary fixed bottom-28 right-6 !h-14 !w-14 !rounded-full !p-0 !pb-1 !text-3xl z-30 hover:scale-110" aria-label="新增項目">+</button>

    <!-- 新增 / 編輯 modal -->
    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
      <div class="modal-panel">
        <div class="flex justify-between items-center mb-5">
          <h3 class="font-display font-bold text-xl text-ink">{{ isEditing ? '編輯項目' : '新增項目' }}</h3>
          <button @click="closeForm" class="btn-icon" aria-label="關閉">✕</button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="field-label">名稱</label>
            <input v-model="form.name" placeholder="例如：轉接頭" class="field" @keyup.enter="handleSave" />
          </div>
          <div>
            <label class="field-label">分類</label>
            <div class="relative">
              <select v-model="form.categorySelect" class="field appearance-none">
                <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
                <option :value="CUSTOM_CATEGORY">自訂分類…</option>
              </select>
              <div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none text-[10px]">▼</div>
            </div>
            <input v-if="form.categorySelect === CUSTOM_CATEGORY" v-model="form.customCategory" placeholder="輸入分類名稱" class="field mt-2" />
          </div>
          <div>
            <label class="field-label">誰負責帶</label>
            <div class="relative">
              <select v-model="form.assignee" class="field appearance-none">
                <option value="">未指定（各自帶）</option>
                <option v-for="m in assigneeOptions" :key="m" :value="m">{{ m }}</option>
              </select>
              <div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none text-[10px]">▼</div>
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <button v-if="isEditing" @click="handleDelete" :disabled="saving" class="btn-danger" :class="confirmingDelete ? '!bg-alert !text-card' : ''">
              {{ confirmingDelete ? '再按一次確認刪除' : '刪除' }}
            </button>
            <button v-if="confirmingDelete" @click="confirmingDelete = false" class="btn-ghost">取消</button>
            <button v-else @click="handleSave" :disabled="saving" class="btn-primary flex-1">{{ saving ? '儲存中…' : '確認' }}</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
