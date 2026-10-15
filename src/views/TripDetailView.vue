<script setup lang="ts">
  import { ref, onMounted, computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { supabase } from '../lib/supabaseClient'
  import { getTripStatus, parseLocalDate, todayISO } from '../lib/tripStatus'
  import { friendlyError } from '../lib/errorMessage'

  // 引入新拆分的組件
  import ItineraryTab from '../components/trip/ItineraryTab.vue'
  import AttractionTab from '../components/trip/AttractionTab.vue'
  import AccommodationTab from '../components/trip/AccommodationTab.vue'
  import ExpenseTab from '../components/trip/ExpenseTab.vue'
  import PackingTab from '../components/trip/PackingTab.vue'

  const route = useRoute()
  const router = useRouter()
  const tripId = route.params.id as string
  const isDemo = tripId === 'demo-korea'

  // --- 共用變數 ---
  const tripName = ref('')
  const activeTab = ref('itinerary')
  const subtitleRaw = ref('')
  const startDateRaw = ref('')
  const endDateRaw = ref('')
  const tripMembers = ref<string[]>([])
  const sharedEmails = ref<string[]>([])
  const shareToken = ref<string | null>(null)
  const isEditMode = ref(false)
  const selectedDate = ref('')

  // 讀取狀態：loading / ok / notfound (不存在或沒權限) / error (網路或其他錯誤)
  const loadState = ref<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const loadError = ref('')

  // 參與者管理 Modal 狀態
  const showMembersModal = ref(false)
  const newMemberName = ref('')
  const newMemberEmail = ref('')

  // 用於獲取子組件資料以計算日期標籤與路線
  const itineraryRef = ref<any>(null)
  const attractionRef = ref<any>(null)

  function goBack() {
    router.push('/')
  }

  // ---------- 日期顯示 / 倒數 ----------
  function formatMonthDay(s: string) {
    const d = parseLocalDate(s)
    return d ? `${d.getMonth() + 1}月${d.getDate()}日` : ''
  }
  const dateFrom = computed(() => formatMonthDay(startDateRaw.value))
  const dateTo = computed(() => formatMonthDay(endDateRaw.value))
  const status = computed(() => getTripStatus(startDateRaw.value, endDateRaw.value))

  // ---------- 參與者 ----------
  async function updateTrip(payload: Record<string, any>) {
    const { data, error } = await supabase.from('trips').update(payload).eq('id', tripId).select('id')
    if (error) return friendlyError(error.message)
    if (!data || data.length === 0) return '沒有修改這個行程的權限'
    return ''
  }

  async function handleAddMember() {
      if (!newMemberName.value.trim()) return alert('請輸入名稱')
      if (tripMembers.value.includes(newMemberName.value.trim())) return alert('已經有同名的參與者')

      const updatedMembers = [...tripMembers.value, newMemberName.value.trim()]
      const updatedEmails = newMemberEmail.value.trim()
          ? [...sharedEmails.value, newMemberEmail.value.trim()]
          : sharedEmails.value

      const payload: any = { members: updatedMembers }
      if (newMemberEmail.value.trim()) {
          payload.shared_emails = updatedEmails
      }

      const err = await updateTrip(payload)
      if (err) {
          alert('新增失敗: ' + err)
      } else {
          tripMembers.value = updatedMembers
          sharedEmails.value = updatedEmails
          newMemberName.value = ''
          newMemberEmail.value = ''
      }
  }

  // 移除採兩段式：第一次點 × 進入待確認，再點一次才真的移除
  const pendingRemoval = ref('')

  async function removeMember(name: string) {
      if (pendingRemoval.value !== `m:${name}`) { pendingRemoval.value = `m:${name}`; return }
      pendingRemoval.value = ''
      const updated = tripMembers.value.filter(m => m !== name)
      const err = await updateTrip({ members: updated })
      if (err) return alert('移除失敗: ' + err)
      tripMembers.value = updated
  }

  async function removeEmail(email: string) {
      if (pendingRemoval.value !== `e:${email}`) { pendingRemoval.value = `e:${email}`; return }
      pendingRemoval.value = ''
      const updated = sharedEmails.value.filter(e => e !== email)
      const err = await updateTrip({ shared_emails: updated })
      if (err) return alert('移除失敗: ' + err)
      sharedEmails.value = updated
  }

  // ---------- 編輯 / 刪除行程 ----------
  const showEditModal = ref(false)
  const editForm = ref({ name: '', subtitle: '', start_date: '', end_date: '' })
  const deleteStep = ref(0) // 0: 未開始, 1: 等待輸入名稱確認
  const deleteConfirmText = ref('')
  const isSaving = ref(false)

  function openEditModal() {
      editForm.value = {
          name: tripName.value,
          subtitle: subtitleRaw.value,
          start_date: startDateRaw.value || '',
          end_date: endDateRaw.value || ''
      }
      deleteStep.value = 0
      deleteConfirmText.value = ''
      showEditModal.value = true
  }

  async function handleSaveTrip() {
      if (!editForm.value.name.trim()) return alert('請填寫行程名稱')
      if (editForm.value.start_date && editForm.value.end_date && editForm.value.end_date < editForm.value.start_date) {
          return alert('結束日期不能早於開始日期')
      }
      isSaving.value = true
      const payload = {
          name: editForm.value.name.trim(),
          subtitle: editForm.value.subtitle,
          start_date: editForm.value.start_date || null,
          end_date: editForm.value.end_date || null
      }
      const err = await updateTrip(payload)
      isSaving.value = false
      if (err) return alert('儲存失敗: ' + err)
      tripName.value = payload.name
      subtitleRaw.value = payload.subtitle
      startDateRaw.value = payload.start_date || ''
      endDateRaw.value = payload.end_date || ''
      showEditModal.value = false
  }

  async function handleDeleteTrip() {
      if (deleteConfirmText.value.trim() !== tripName.value.trim()) return
      isSaving.value = true

      // 先直接刪行程：若資料表設了 ON DELETE CASCADE 就一次完成；
      // 若被外鍵擋下 (23503)，代表有權限但子資料要先刪，再刪子資料後重試。
      let res = await supabase.from('trips').delete().eq('id', tripId).select('id')
      if (res.error?.code === '23503') {
          // packing_items 放第一個：資料表若尚未建立 (PostgREST 回 PGRST205 / Postgres 42P01) 就略過，
          // 避免刪了其他子表後才在這裡中止，留下一個沒有內容的空行程
          for (const table of ['packing_items', 'activities', 'attractions', 'accommodations', 'travel_expenses']) {
              const { error } = await supabase.from(table).delete().eq('trip_id', tripId)
              const missingTable = error?.code === 'PGRST205' || error?.code === '42P01'
              if (error && !(table === 'packing_items' && missingTable)) {
                  isSaving.value = false
                  return alert(`刪除失敗（${table}）: ${friendlyError(error.message)}`)
              }
          }
          res = await supabase.from('trips').delete().eq('id', tripId).select('id')
      }
      isSaving.value = false

      if (res.error) return alert('刪除失敗: ' + friendlyError(res.error.message))
      if (!res.data || res.data.length === 0) return alert('沒有刪除這個行程的權限（可能只有建立者可以刪除）')
      showEditModal.value = false
      router.replace('/')
  }

  // ---------- 唯讀分享連結 ----------
  const showShareModal = ref(false)
  const shareCopied = ref(false)
  const shareUrl = computed(() =>
      shareToken.value ? `${window.location.origin}${import.meta.env.BASE_URL}#/share/${shareToken.value}` : ''
  )

  async function createShareLink() {
      const token = crypto.randomUUID()
      const err = await updateTrip({ share_token: token })
      if (err) return alert('產生分享連結失敗: ' + err + '\n（若訊息提到 share_token，代表資料庫還沒執行更新 SQL）')
      shareToken.value = token
  }

  async function disableShareLink() {
      const err = await updateTrip({ share_token: null })
      if (err) return alert('停用失敗: ' + err)
      shareToken.value = null
  }

  async function copyShareLink() {
      try {
          if (navigator.share) {
              await navigator.share({ title: tripName.value, text: `${tripName.value}｜行程分享`, url: shareUrl.value })
              return
          }
          await navigator.clipboard.writeText(shareUrl.value)
          shareCopied.value = true
          setTimeout(() => (shareCopied.value = false), 2000)
      } catch {
          // 使用者取消分享面板時會丟例外，忽略即可
      }
  }

  // 計算所有出現過的日期，用於頂部頁籤
  const uniqueDates = computed(() => {
    const actDates = itineraryRef.value?.activities?.map((a: any) => a.date) || []
    const attrDates = attractionRef.value?.attractions?.map((a: any) => a.date) || []
    return [...new Set([...actDates, ...attrDates])].filter(Boolean).sort() as string[]
  })

  // 旅程進行中：第一次載到日期時，自動切到「今天」
  let autoSelectedToday = false
  watch(uniqueDates, (dates) => {
    if (autoSelectedToday || status.value.phase !== 'ongoing') return
    const today = todayISO()
    if (dates.includes(today)) {
      selectedDate.value = today
      autoSelectedToday = true
    }
  })

  // 當行程存檔後，更新選中日期
  function onActivitySaved(date: string) {
    selectedDate.value = date
  }

  async function loadData() {
    loadState.value = 'loading'
    loadError.value = ''

    if (isDemo) {
        tripName.value = '🇰🇷 首爾 5 天 4 夜自由行'
        subtitleRaw.value = '吃爆烤肉與逛街之旅 (範例)'
        startDateRaw.value = '2026-04-01'
        endDateRaw.value = '2026-04-05'
        tripMembers.value = ['小美', '大壯', '阿明']
        sharedEmails.value = []
        isEditMode.value = false // 範例不可編輯
        loadState.value = 'ok'
        return
    }

    // 檢查登入狀態
    const { data: { session } } = await supabase.auth.getSession()
    isEditMode.value = !!session?.user

    const { data: trip, error } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle()
    if (error) {
        loadState.value = 'error'
        loadError.value = navigator.onLine ? friendlyError(error.message) : '目前離線，而且這個行程還沒有離線資料。'
        return
    }
    if (!trip) {
        loadState.value = 'notfound'
        return
    }
    tripName.value = trip.name
    subtitleRaw.value = trip.subtitle || ''
    startDateRaw.value = trip.start_date || ''
    endDateRaw.value = trip.end_date || ''
    tripMembers.value = trip.members || []
    sharedEmails.value = trip.shared_emails || []
    shareToken.value = trip.share_token || null
    loadState.value = 'ok'
  }

  // 底部導覽項目 (SVG path 為 24x24 線條圖示)
  const tabs = [
    { key: 'itinerary', label: '行程', icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    { key: 'attractions', label: '景點', icon: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
    { key: 'accommodation', label: '住宿', icon: 'M3 20v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 16h18M7 10V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3M3 20v1M21 20v1' },
    { key: 'packing', label: '行李', icon: 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1zM9 11v6M15 11v6' },
    { key: 'expenses', label: '記帳', icon: 'M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2M7 11v4' },
  ]

  onMounted(loadData)
</script>

<template>
  <div class="min-h-dvh pb-36">
    <!-- 頂部列 -->
    <div class="mx-auto flex max-w-2xl items-center justify-between gap-2 px-5 pb-2 pt-[max(env(safe-area-inset-top),1rem)] animate-fade">
      <button @click="goBack" class="group flex items-center gap-2 text-sm font-bold text-ink-soft transition hover:text-ink cursor-pointer">
        <span class="transition-transform duration-300 group-hover:-translate-x-1">←</span> 我的旅程
      </button>
      <div v-if="isEditMode && loadState === 'ok'" class="flex items-center gap-2">
        <button @click="showShareModal = true" class="btn-ghost !px-3.5 !py-2 !text-xs">🔗 分享</button>
        <button @click="showMembersModal = true" class="btn-ghost !px-3.5 !py-2 !text-xs">
          👥 <span class="font-mono text-flare">{{ tripMembers.length }}</span>
        </button>
        <button @click="openEditModal" class="btn-icon !h-9 !w-9" aria-label="編輯行程資訊">✎</button>
      </div>
    </div>

    <!-- 載入中 -->
    <div v-if="loadState === 'loading'" class="mx-auto max-w-2xl px-5 pt-5">
      <div class="card-raised h-64 overflow-hidden">
        <div class="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"></div>
      </div>
      <p class="eyebrow pt-4 text-center">正在打開旅程…</p>
    </div>

    <!-- 找不到 / 沒權限 / 讀取錯誤 -->
    <div v-else-if="loadState !== 'ok'" class="mx-auto max-w-md px-5 pt-16 text-center animate-rise">
      <div class="stamp mx-auto mb-6 h-24 w-24 -rotate-12 !border-alert/70 !text-alert after:!border-alert/50">
        <span class="font-display text-sm font-black">{{ loadState === 'notfound' ? 'NOT FOUND' : 'ERROR' }}</span>
      </div>
      <h1 class="font-display text-2xl font-bold text-ink">
        {{ loadState === 'notfound' ? '找不到這個行程' : '行程讀取失敗' }}
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-ink-soft">
        <template v-if="loadState === 'notfound'">它可能已被刪除，或您沒有查看權限。若是旅伴邀請的行程，請確認對方填的是您登入用的 Google Email。</template>
        <template v-else>{{ loadError }}</template>
      </p>
      <div class="mt-8 flex justify-center gap-3">
        <button v-if="loadState === 'error'" @click="loadData" class="btn-primary">重試</button>
        <button @click="goBack" class="btn-ghost">回到我的旅程</button>
      </div>
    </div>

    <template v-else>
    <!-- 旅行資訊 banner (明信片 / 車票樣式) -->
    <div class="mx-auto max-w-2xl px-5 pt-5">
      <section class="card-raised overflow-hidden animate-rise">
        <!-- 色帶 -->
        <div class="flex h-2" aria-hidden="true">
          <span class="flex-1 bg-flare"></span><span class="flex-1 bg-amber"></span><span class="flex-1 bg-aurora"></span><span class="flex-1 bg-lagoon"></span>
        </div>

        <div class="relative p-6 sm:p-8">
          <div class="stamp absolute right-5 top-6 h-20 w-20 rotate-12 opacity-80 sm:right-8" aria-hidden="true">
            <span class="text-lg leading-none">✈</span>
            <span class="mt-0.5 text-[8px] font-bold tracking-wider">BON VOYAGE</span>
          </div>

          <div class="mb-3 flex flex-wrap items-center gap-2 pr-20">
            <span class="eyebrow">TRAVEL JOURNAL</span>
            <span
              v-if="status.phase === 'ongoing'"
              class="inline-flex items-center gap-1 rounded-full bg-flare px-2.5 py-0.5 text-[11px] font-bold text-card"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-card"></span>{{ status.label }}
            </span>
            <span v-else-if="status.phase === 'upcoming'" class="tag !border-flare/40 !text-flare">{{ status.label }}</span>
            <span v-else-if="status.phase === 'finished'" class="tag !text-muted">{{ status.label }}</span>
          </div>
          <h1 class="font-display pr-20 text-[clamp(1.9rem,7.5vw,2.9rem)] font-black leading-tight break-all text-ink">{{ tripName }}</h1>
          <p v-if="subtitleRaw" class="font-display mt-2 text-base italic text-ink-soft">— {{ subtitleRaw }}</p>

          <!-- 日期航線 -->
          <div v-if="dateFrom" class="mt-7 flex items-center gap-3">
            <div>
              <p class="eyebrow">出發</p>
              <p class="font-display text-lg font-bold text-ink">{{ dateFrom }}</p>
            </div>
            <div class="relative mx-1 flex-1 border-t-2 border-dashed border-ink/25" aria-hidden="true">
              <span class="absolute left-1/2 -top-[12px] -translate-x-1/2 bg-card px-1.5 text-base leading-none text-flare">✈</span>
            </div>
            <div class="text-right">
              <p class="eyebrow">回程</p>
              <p class="font-display text-lg font-bold text-ink">{{ dateTo || dateFrom }}</p>
            </div>
          </div>
          <button v-else-if="isEditMode" @click="openEditModal" class="mt-6 text-sm font-bold text-flare underline-offset-4 hover:underline cursor-pointer">
            ＋ 設定旅行日期
          </button>
        </div>

        <!-- 撕線 -->
        <div class="relative flex items-center" aria-hidden="true">
          <span class="absolute -left-3 h-6 w-6 rounded-full border border-ink/10 bg-paper"></span>
          <div class="mx-5 w-full border-t-2 border-dotted border-ink/15"></div>
          <span class="absolute -right-3 h-6 w-6 rounded-full border border-ink/10 bg-paper"></span>
        </div>

        <div class="flex items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <div class="flex flex-wrap gap-1.5">
            <span v-for="m in tripMembers" :key="m" class="tag">{{ m }}</span>
            <span v-if="tripMembers.length === 0" class="text-xs text-faint">尚未加入旅伴</span>
          </div>
          <span class="font-mono text-[10px] tracking-widest text-faint">NO. {{ String(tripId).slice(0, 6).toUpperCase() }}</span>
        </div>
      </section>
    </div>

    <!-- 日期篩選頁籤 (僅在行程與景點頁面顯示) -->
    <div v-if="activeTab === 'itinerary' || activeTab === 'attractions'" class="sticky top-0 z-30 mt-6 mb-4 bg-paper/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-5 py-3 no-scrollbar">
        <button @click="selectedDate = ''" class="chip" :class="{ 'chip-active': selectedDate === '' }">全部</button>
        <button v-for="date in uniqueDates" :key="date" @click="selectedDate = date" class="chip font-mono" :class="{ 'chip-active': selectedDate === date }">
          {{ date.slice(5).replace('-', '/') }}<span v-if="date === todayISO()" class="ml-0.5 text-[10px]">·今天</span>
        </button>
      </div>
      <div class="hairline"></div>
    </div>
    <div v-else class="h-6"></div>

    <!-- 各模組內容 -->
    <div class="mx-auto max-w-2xl">
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

      <PackingTab
        v-show="activeTab === 'packing'"
        :trip-id="tripId"
        :is-edit-mode="isEditMode"
        :trip-members="tripMembers"
      />

      <ExpenseTab
        v-show="activeTab === 'expenses'"
        :trip-id="tripId"
        :is-edit-mode="isEditMode"
        :trip-members="tripMembers"
        :selected-date="selectedDate"
      />
    </div>

    <!-- 底部功能導覽 (浮動 dock) -->
    <nav class="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div class="card-raised flex w-full max-w-md gap-1 !rounded-full p-1.5">
        <button
          v-for="t in tabs"
          :key="t.key"
          @click="activeTab = t.key"
          class="flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-bold transition-all duration-300 cursor-pointer"
          :class="activeTab === t.key ? 'bg-ink text-card' : 'text-muted hover:text-ink'"
          :aria-current="activeTab === t.key ? 'page' : undefined"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="t.icon" /></svg>
          {{ t.label }}
        </button>
      </div>
    </nav>
    </template>

    <!-- 參與者管理 Modal -->
    <div v-if="showMembersModal" class="modal-backdrop" @click.self="showMembersModal = false; pendingRemoval = ''">
      <div class="modal-panel">
        <div class="mb-6 flex items-start justify-between">
          <div>
            <p class="eyebrow mb-1">TRAVEL COMPANIONS</p>
            <h3 class="font-display text-2xl font-bold text-ink">參與者管理</h3>
          </div>
          <button @click="showMembersModal = false; pendingRemoval = ''" class="btn-icon" aria-label="關閉">✕</button>
        </div>

        <div class="mb-5">
          <p class="field-label">目前參與者（記帳時的付款人 / 分擔人）</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="member in tripMembers" :key="member" class="tag !gap-1.5 !py-1 !pl-3.5 !pr-1 !text-sm">
              {{ member }}
              <button
                @click="removeMember(member)"
                class="rounded-full px-2 py-0.5 text-xs font-bold transition cursor-pointer"
                :class="pendingRemoval === `m:${member}` ? 'bg-alert text-card' : 'text-faint hover:text-alert'"
                :aria-label="`移除 ${member}`"
              >{{ pendingRemoval === `m:${member}` ? '確定移除' : '×' }}</button>
            </span>
            <span v-if="tripMembers.length === 0" class="text-xs text-faint">尚無其他參與者</span>
          </div>
          <p v-if="pendingRemoval.startsWith('m:')" class="mt-2 text-[11px] text-alert">移除後，過去記帳裡這個名字仍會保留，但新記帳的選單中不會再出現。</p>
        </div>

        <div class="mb-6">
          <p class="field-label">可共同編輯的 Google 帳號</p>
          <div class="space-y-1.5">
            <div v-for="email in sharedEmails" :key="email" class="flex items-center justify-between gap-2 rounded-xl border border-ink/10 bg-paper-deep/40 px-3 py-2">
              <span class="truncate font-mono text-xs text-ink-soft">{{ email }}</span>
              <button
                @click="removeEmail(email)"
                class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold transition cursor-pointer"
                :class="pendingRemoval === `e:${email}` ? 'bg-alert text-card' : 'text-faint hover:text-alert'"
              >{{ pendingRemoval === `e:${email}` ? '確定取消權限' : '移除' }}</button>
            </div>
            <p v-if="sharedEmails.length === 0" class="text-xs text-faint">尚未共用給其他帳號</p>
          </div>
        </div>

        <div class="hairline mb-6"></div>

        <p class="font-display mb-4 text-base font-bold text-ink">新增參與者</p>
        <div class="space-y-4">
          <div>
            <label class="field-label">顯示名稱 *</label>
            <input v-model="newMemberName" placeholder="例如: 小明" class="field" />
          </div>
          <div>
            <label class="field-label">對方登入的 Email (供共用權限，選填)</label>
            <input v-model="newMemberEmail" type="email" placeholder="例如: ming@example.com" class="field" />
          </div>
          <button @click="handleAddMember" class="btn-primary w-full !py-3">新增並賦予權限</button>
        </div>
        <p class="mt-5 text-[11px] leading-relaxed text-muted">
          提示：若填寫對方的 Google 登入 Email，並在資料庫正確設定權限後，對方即可在首頁看到並共同編輯此行程。
        </p>
      </div>
    </div>

    <!-- 編輯行程 Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal = false">
      <div class="modal-panel">
        <div class="mb-6 flex items-start justify-between">
          <div>
            <p class="eyebrow mb-1">EDIT TRIP</p>
            <h3 class="font-display text-2xl font-bold text-ink">編輯行程資訊</h3>
          </div>
          <button @click="showEditModal = false" class="btn-icon" aria-label="關閉">✕</button>
        </div>
        <div class="space-y-5">
          <div>
            <label class="field-label">行程名稱 <span class="text-flare">*</span></label>
            <input v-model="editForm.name" class="field font-bold" />
          </div>
          <div>
            <label class="field-label">副標題 (選填)</label>
            <input v-model="editForm.subtitle" class="field" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="field-label">開始日期</label>
              <input type="date" v-model="editForm.start_date" class="field" />
            </div>
            <div>
              <label class="field-label">結束日期</label>
              <input type="date" v-model="editForm.end_date" :min="editForm.start_date" class="field" />
            </div>
          </div>
          <button @click="handleSaveTrip" :disabled="isSaving" class="btn-primary w-full !py-3.5">{{ isSaving ? '儲存中…' : '儲存' }}</button>
        </div>

        <!-- 危險區：刪除行程 -->
        <div class="mt-8 rounded-2xl border border-alert/25 bg-alert/5 p-4">
          <p class="text-sm font-bold text-alert">刪除這個行程</p>
          <p class="mt-1 text-xs leading-relaxed text-ink-soft">行程、景點、住宿、記帳與行李清單會一併刪除，無法復原。</p>
          <button v-if="deleteStep === 0" @click="deleteStep = 1" class="btn-danger mt-3 !px-4 !py-2 !text-xs">我要刪除</button>
          <div v-else class="mt-3 space-y-2">
            <label class="field-label !text-alert">請輸入行程名稱「{{ tripName }}」確認</label>
            <input v-model="deleteConfirmText" class="field !border-alert/40" :placeholder="tripName" />
            <div class="flex gap-2">
              <button @click="deleteStep = 0; deleteConfirmText = ''" class="btn-ghost flex-1 !py-2 !text-xs">取消</button>
              <button
                @click="handleDeleteTrip"
                :disabled="isSaving || deleteConfirmText.trim() !== tripName.trim()"
                class="btn flex-1 bg-alert !py-2 !text-xs text-card hover:bg-[#9C2F2F]"
              >{{ isSaving ? '刪除中…' : '永久刪除' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分享 Modal -->
    <div v-if="showShareModal" class="modal-backdrop" @click.self="showShareModal = false">
      <div class="modal-panel">
        <div class="mb-6 flex items-start justify-between">
          <div>
            <p class="eyebrow mb-1">SHARE</p>
            <h3 class="font-display text-2xl font-bold text-ink">唯讀分享連結</h3>
          </div>
          <button @click="showShareModal = false" class="btn-icon" aria-label="關閉">✕</button>
        </div>

        <p class="text-sm leading-relaxed text-ink-soft">
          拿到連結的人不用登入就能看<strong class="text-ink">行程、景點與住宿</strong>，但無法修改，也看不到記帳。
        </p>

        <div v-if="shareToken" class="mt-5 space-y-3">
          <div class="rounded-xl border border-ink/15 bg-paper-deep/40 px-3 py-2.5">
            <p class="break-all font-mono text-[11px] text-ink-soft">{{ shareUrl }}</p>
          </div>
          <button @click="copyShareLink" class="btn-primary w-full !py-3">{{ shareCopied ? '✓ 已複製' : '分享 / 複製連結' }}</button>
          <div class="flex gap-2">
            <button @click="createShareLink" class="btn-ghost flex-1 !py-2 !text-xs">重新產生（舊連結失效）</button>
            <button @click="disableShareLink" class="btn-danger flex-1 !py-2 !text-xs">停用分享</button>
          </div>
        </div>
        <div v-else class="mt-5">
          <button @click="createShareLink" class="btn-primary w-full !py-3">產生分享連結</button>
          <p class="mt-3 text-[11px] text-muted">目前未分享。</p>
        </div>
      </div>
    </div>
  </div>
</template>
