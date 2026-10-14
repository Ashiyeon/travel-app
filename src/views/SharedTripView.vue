<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { supabase } from '../lib/supabaseClient'
import { friendlyError } from '../lib/errorMessage'
import { safeUrl } from '../lib/safeUrl'
  import { getTripStatus, parseLocalDate } from '../lib/tripStatus'
  import RouteOverview from '../components/trip/RouteOverview.vue'

  // 唯讀分享頁：不需登入，資料只來自 RPC get_shared_trip (不含記帳、Email)。
  // 刻意不 import ItineraryTab / AttractionTab / AccommodationTab (它們直接查資料表，未登入會被權限擋)。
  const route = useRoute()
  const token = String(route.params.token || '')

  const loading = ref(true)
  const errorMsg = ref('')
  const invalid = ref(false)

  const trip = ref<any>(null)
  const activities = ref<any[]>([])
  const attractions = ref<any[]>([])
  const accommodations = ref<any[]>([])

  const section = ref<'daily' | 'route' | 'places'>('daily')
  const selectedDate = ref('')

  async function load() {
    loading.value = true
    errorMsg.value = ''
    invalid.value = false
    try {
      // 不是 uuid 格式就直接視為失效連結，不送出請求（否則會看到資料庫的型別錯誤訊息）
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
        invalid.value = true
        return
      }
      const { data, error } = await supabase.rpc('get_shared_trip', { p_token: token })
      if (error) {
        errorMsg.value = friendlyError(error.message)
        return
      }
      if (!data || !data.trip) {
        invalid.value = true
        return
      }
      trip.value = data.trip
      activities.value = Array.isArray(data.activities) ? data.activities : []
      attractions.value = Array.isArray(data.attractions) ? data.attractions : []
      accommodations.value = Array.isArray(data.accommodations) ? data.accommodations : []
    } catch (e: any) {
      errorMsg.value = friendlyError(e?.message)
    } finally {
      loading.value = false
    }
  }

  // ----- 顯示用 -----
  function fmtMD(s: string | null | undefined): string {
    const d = parseLocalDate(s)
    return d ? `${d.getMonth() + 1}月${d.getDate()}日` : ''
  }
  function fmtSlash(s: string): string {
    const d = parseLocalDate(s)
    return d ? `${d.getMonth() + 1}/${d.getDate()}` : s
  }
  function fmtDayFull(s: string): string {
    const d = parseLocalDate(s)
    return d ? `${d.getMonth() + 1}/${d.getDate()}（週${'日一二三四五六'[d.getDay()]}）` : s
  }
  function hhmm(s: string | null | undefined): string {
    return s ? String(s).slice(0, 5) : ''
  }
  function mapSearch(q: string): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q)
  }
  function lines(s: string | null | undefined): string[] {
    return (s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  }
  function steps(t: any): { step: string; text: string }[] {
    if (!Array.isArray(t)) return []
    return t.filter((x: any) => x && (x.step || x.text)).map((x: any) => ({ step: String(x.step ?? ''), text: String(x.text ?? '') }))
  }

  const members = computed<string[]>(() => (Array.isArray(trip.value?.members) ? trip.value.members : []))
  const dateFrom = computed(() => fmtMD(trip.value?.start_date))
  const dateTo = computed(() => fmtMD(trip.value?.end_date))
  const status = computed(() => getTripStatus(trip.value?.start_date, trip.value?.end_date))

  const uniqueDates = computed(() => {
    const all = [...activities.value.map(a => a.date), ...attractions.value.map(a => a.date)]
    return [...new Set(all)].filter(Boolean).sort() as string[]
  })

  // 每日行程：依日期分組，組內依時間排序
  const dailyGroups = computed(() => {
    const map = new Map<string, any[]>()
    for (const a of activities.value) {
      if (!a?.date) continue
      if (selectedDate.value && a.date !== selectedDate.value) continue
      if (!map.has(a.date)) map.set(a.date, [])
      map.get(a.date)!.push(a)
    }
    return [...map.entries()]
      .sort(([x], [y]) => (x < y ? -1 : 1))
      .map(([date, list]) => ({
        date,
        list: list
          .map((a, i) => ({ a, i }))
          .sort((x, y) => {
            const tx = x.a.start_time || '99:99'
            const ty = y.a.start_time || '99:99'
            return tx === ty ? x.i - y.i : tx < ty ? -1 : 1
          })
          .map(({ a }) => a),
      }))
  })

  const sections = [
    { key: 'daily', label: '每日行程' },
    { key: 'route', label: '路線' },
    { key: 'places', label: '景點與住宿' },
  ] as const

  onMounted(load)
</script>

<template>
  <div class="min-h-dvh pb-16">
    <!-- 頂部列 -->
    <div class="mx-auto flex max-w-2xl items-center justify-between px-5 pb-2 pt-[max(env(safe-area-inset-top),1rem)] animate-fade">
      <span class="font-display text-base font-black tracking-wider text-ink">空姐叫我</span>
      <span
        v-if="trip && status.label"
        class="rounded-full border border-flare/40 bg-flare/10 px-3 py-1 font-mono text-xs font-bold text-flare"
      >{{ status.label }}</span>
    </div>

    <!-- 載入中 -->
    <div v-if="loading" class="mx-auto max-w-2xl space-y-4 px-5 pt-5" aria-label="正在載入分享的行程">
      <div v-for="n in 2" :key="n" class="card h-40 overflow-hidden">
        <div class="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"></div>
      </div>
      <p class="eyebrow pt-2 text-center">正在打開行程…</p>
    </div>

    <!-- 連結無效 / 已停用 -->
    <div v-else-if="invalid" class="mx-auto max-w-2xl px-5 pt-8">
      <section class="card-raised overflow-hidden p-8 text-center animate-rise">
        <div class="stamp mx-auto mb-5 h-20 w-20 -rotate-6 opacity-70" aria-hidden="true">
          <span class="text-xl leading-none">✕</span>
          <span class="mt-0.5 text-[8px] font-bold tracking-wider">VOID</span>
        </div>
        <h1 class="font-display text-2xl font-black text-ink">這個分享連結已失效</h1>
        <p class="mt-3 text-sm leading-relaxed text-ink-soft">請向分享者索取新連結。</p>
        <router-link to="/" class="btn-ghost mt-6 inline-flex">回到首頁</router-link>
      </section>
    </div>

    <!-- 讀取錯誤 -->
    <div v-else-if="errorMsg" class="mx-auto max-w-2xl px-5 pt-8">
      <section class="card-raised p-8 text-center animate-rise">
        <h1 class="font-display text-2xl font-black text-ink">讀取失敗</h1>
        <p class="mt-3 break-all text-sm leading-relaxed text-alert">{{ errorMsg }}</p>
        <button @click="load" class="btn-primary mt-6">重試</button>
      </section>
    </div>

    <!-- 正常 -->
    <template v-else-if="trip">
      <!-- 唯讀提示 -->
      <div class="mx-auto max-w-2xl px-5">
        <p class="rounded-full bg-paper-deep/70 px-4 py-1.5 text-center text-[11px] font-bold tracking-wide text-ink-soft">
          唯讀分享 · 由旅伴分享給你
        </p>
      </div>

      <!-- 明信片 hero -->
      <div class="mx-auto max-w-2xl px-5 pt-4">
        <section class="card-raised overflow-hidden animate-rise">
          <div class="flex h-2" aria-hidden="true">
            <span class="flex-1 bg-flare"></span><span class="flex-1 bg-amber"></span><span class="flex-1 bg-aurora"></span><span class="flex-1 bg-lagoon"></span>
          </div>

          <div class="relative p-6 sm:p-8">
            <div class="stamp absolute right-5 top-6 h-20 w-20 rotate-12 opacity-80 sm:right-8" aria-hidden="true">
              <span class="text-lg leading-none">✈</span>
              <span class="mt-0.5 text-[8px] font-bold tracking-wider">BON VOYAGE</span>
            </div>

            <p class="eyebrow mb-3">TRAVEL JOURNAL</p>
            <h1 class="font-display pr-20 text-[clamp(1.9rem,7.5vw,2.9rem)] font-black leading-tight break-all text-ink">{{ trip.name }}</h1>
            <p v-if="trip.subtitle" class="font-display mt-2 text-base italic text-ink-soft">— {{ trip.subtitle }}</p>

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
                <p class="font-display text-lg font-bold text-ink">{{ dateTo }}</p>
              </div>
            </div>
          </div>

          <div class="relative flex items-center" aria-hidden="true">
            <span class="absolute -left-3 h-6 w-6 rounded-full border border-ink/10 bg-paper"></span>
            <div class="mx-5 w-full border-t-2 border-dotted border-ink/15"></div>
            <span class="absolute -right-3 h-6 w-6 rounded-full border border-ink/10 bg-paper"></span>
          </div>

          <div class="flex flex-wrap gap-1.5 px-6 py-4 sm:px-8">
            <span v-for="m in members" :key="m" class="tag">{{ m }}</span>
            <span v-if="members.length === 0" class="text-xs text-faint">尚未加入旅伴</span>
          </div>
        </section>
      </div>

      <!-- 區段切換 -->
      <div class="mx-auto mt-6 flex max-w-2xl gap-2 px-5">
        <button
          v-for="s in sections"
          :key="s.key"
          @click="section = s.key"
          class="chip"
          :class="{ 'chip-active': section === s.key }"
        >{{ s.label }}</button>
      </div>

      <!-- 日期篩選 (作用於每日行程與路線) -->
      <div v-if="section !== 'places'" class="sticky top-0 z-30 mt-3 mb-4 bg-paper/85 backdrop-blur-md">
        <div class="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-5 py-3 no-scrollbar">
          <button @click="selectedDate = ''" class="chip" :class="{ 'chip-active': selectedDate === '' }">全部</button>
          <button
            v-for="date in uniqueDates"
            :key="date"
            @click="selectedDate = date"
            class="chip font-mono"
            :class="{ 'chip-active': selectedDate === date }"
          >{{ fmtSlash(date) }}</button>
        </div>
        <div class="hairline"></div>
      </div>
      <div v-else class="h-5"></div>

      <div class="mx-auto max-w-2xl">
        <!-- 每日行程 -->
        <div v-if="section === 'daily'" class="space-y-6 px-5">
          <div v-if="dailyGroups.length === 0" class="card p-8 text-center text-sm text-muted">還沒有安排行程。</div>
          <section v-for="g in dailyGroups" :key="g.date" class="animate-rise">
            <div class="mb-2 flex items-baseline justify-between">
              <h2 class="font-display text-lg font-bold text-ink">{{ fmtDayFull(g.date) }}</h2>
              <span class="eyebrow">{{ g.list.length }} 項</span>
            </div>
            <div class="hairline"></div>
            <div class="stagger">
              <article
                v-for="(a, i) in g.list"
                :key="a.id ?? i"
                :style="`--i: ${i}`"
                class="flex gap-4 border-b border-ink/12 py-4"
              >
                <span class="w-12 shrink-0 pt-0.5 font-mono text-sm font-medium text-flare">{{ hhmm(a.start_time) || '—' }}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-display break-all text-base font-bold text-ink">{{ a.title }}</h3>
                    <span v-if="a.category" class="tag !px-2 !py-0 !text-[10px]">{{ a.category }}</span>
                  </div>
                  <p v-if="a.description" class="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{{ a.description }}</p>
                </div>
              </article>
            </div>
          </section>
        </div>

        <!-- 路線 -->
        <RouteOverview
          v-else-if="section === 'route'"
          :activities="activities"
          :attractions="attractions"
          :accommodations="accommodations"
          :selected-date="selectedDate"
        />

        <!-- 景點與住宿 -->
        <div v-else class="space-y-8 px-5">
          <section>
            <div class="mb-2 flex items-baseline justify-between">
              <h2 class="font-display text-sm font-bold tracking-widest text-ink">景點</h2>
              <span class="eyebrow">ATTRACTIONS</span>
            </div>
            <div class="hairline mb-4"></div>
            <div v-if="attractions.length === 0" class="card p-6 text-center text-sm text-muted">還沒有景點資料。</div>
            <div class="stagger space-y-4">
              <article v-for="(t, i) in attractions" :key="t.id ?? i" :style="`--i: ${i}`" class="card p-5">
                <div class="flex flex-wrap items-center gap-2">
                  <span v-if="t.date" class="font-mono text-xs font-medium text-flare">{{ fmtSlash(t.date) }}</span>
                  <span v-if="t.location_tag" class="tag !px-2 !py-0 !text-[10px]">{{ t.location_tag }}</span>
                </div>
                <h3 class="font-display mt-1 break-all text-xl font-bold text-ink">{{ t.title }}</h3>
                <p v-if="t.subtitle" class="font-display text-sm italic text-ink-soft">{{ t.subtitle }}</p>
                <p v-if="t.description" class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{{ t.description }}</p>

                <ul v-if="lines(t.highlights).length" class="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  <li v-for="(h, hi) in lines(t.highlights)" :key="hi">{{ h }}</li>
                </ul>

                <dl class="mt-3 space-y-1.5 text-sm">
                  <div v-if="t.transport_info" class="flex gap-2"><dt class="w-16 shrink-0 text-xs font-bold text-muted">交通</dt><dd class="whitespace-pre-line text-ink-soft">{{ t.transport_info }}</dd></div>
                  <div v-if="t.opening_hours" class="flex gap-2"><dt class="w-16 shrink-0 text-xs font-bold text-muted">營業時間</dt><dd class="whitespace-pre-line text-ink-soft">{{ t.opening_hours }}</dd></div>
                  <div v-if="t.ticket_price" class="flex gap-2"><dt class="w-16 shrink-0 text-xs font-bold text-muted">門票</dt><dd class="text-ink-soft">{{ t.ticket_price }}</dd></div>
                  <div v-if="t.must_eat" class="flex gap-2"><dt class="w-16 shrink-0 text-xs font-bold text-muted">必吃</dt><dd class="whitespace-pre-line text-ink-soft">{{ t.must_eat }}</dd></div>
                </dl>

                <a
                  :href="safeUrl(t.map_url) || mapSearch(t.title)"
                  target="_blank"
                  rel="noopener"
                  class="btn-ghost mt-4 inline-flex !px-4 !py-2 !text-xs"
                >📍 在地圖開啟 ↗</a>
              </article>
            </div>
          </section>

          <section>
            <div class="mb-2 flex items-baseline justify-between">
              <h2 class="font-display text-sm font-bold tracking-widest text-ink">住宿</h2>
              <span class="eyebrow">STAY</span>
            </div>
            <div class="hairline mb-4"></div>
            <div v-if="accommodations.length === 0" class="card p-6 text-center text-sm text-muted">還沒有住宿資料。</div>
            <div class="stagger space-y-4">
              <article v-for="(h, i) in accommodations" :key="h.id ?? i" :style="`--i: ${i}`" class="card p-5">
                <h3 class="font-display break-all text-xl font-bold text-ink">🏨 {{ h.name }}</h3>
                <p v-if="h.address" class="mt-1 text-sm text-ink-soft">{{ h.address }}</p>
                <p v-if="h.station" class="mt-0.5 text-xs text-muted">最近車站：{{ h.station }}</p>

                <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p class="eyebrow">入住</p>
                    <p class="font-mono text-ink">{{ h.check_in_date ? fmtSlash(h.check_in_date) : '—' }} <span class="text-flare">{{ hhmm(h.check_in_time) }}</span></p>
                  </div>
                  <div>
                    <p class="eyebrow">退房</p>
                    <p class="font-mono text-ink">{{ h.check_out_date ? fmtSlash(h.check_out_date) : '—' }} <span class="text-flare">{{ hhmm(h.check_out_time) }}</span></p>
                  </div>
                </div>

                <ol v-if="steps(h.transportation).length" class="mt-4 space-y-1.5 border-l-2 border-dashed border-ink/20 pl-4 text-sm">
                  <li v-for="(s, si) in steps(h.transportation)" :key="si">
                    <span v-if="s.step" class="font-mono text-xs font-bold text-flare">{{ s.step }}</span>
                    <span class="text-ink-soft"> {{ s.text }}</span>
                  </li>
                </ol>
                <p v-if="h.transport_note" class="mt-3 whitespace-pre-line text-xs leading-relaxed text-muted">{{ h.transport_note }}</p>

                <a
                  :href="safeUrl(h.google_map_url) || mapSearch(h.address || h.name)"
                  target="_blank"
                  rel="noopener"
                  class="btn-ghost mt-4 inline-flex !px-4 !py-2 !text-xs"
                >📍 在地圖開啟 ↗</a>
              </article>
            </div>
          </section>
        </div>
      </div>

      <!-- 頁尾 -->
      <footer class="mx-auto mt-12 max-w-2xl px-5 text-center">
        <div class="hairline mb-5"></div>
        <router-link to="/" class="text-sm font-bold text-flare transition hover:underline">用 空姐叫我 規劃你的旅程 →</router-link>
      </footer>
    </template>
  </div>
</template>
