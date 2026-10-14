<script setup lang="ts">
  import { safeUrl } from '../../lib/safeUrl'
  import { computed } from 'vue'
  import { parseLocalDate, todayISO } from '../../lib/tripStatus'

  // 每日路線總覽：純展示元件，不查資料庫。
  // 資料庫沒有座標，所有地圖連結都用 Google Maps URL (名稱 / 地址文字)，不需要 API key。
  const props = defineProps<{
    activities: any[]
    attractions: any[]
    accommodations: any[]
    selectedDate: string
  }>()

  // ===== PURE-LOGIC-START (不依賴 Vue，方便單獨驗證) =====
  const MAX_WAYPOINTS = 9
  const MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query='
  const MAPS_DIR = 'https://www.google.com/maps/dir/?api=1'

  interface Place {
    key: string
    time: string
    name: string
    category: string
    url: string
  }
  interface Lodging {
    name: string
    query: string
    url: string
  }
  interface DayRoute {
    date: string
    dayNo: number
    label: string
    places: Place[]
    from: Lodging | null
    to: Lodging | null
    routeUrl: string
    tooMany: boolean
  }

  function cleanText(v: any): string {
    return typeof v === 'string' ? v.trim() : ''
  }

  function searchUrl(q: string): string {
    return MAPS_SEARCH + encodeURIComponent(q)
  }

  /** 'YYYY-MM-DD' 加減天數 (用當地日期運算，不經過 UTC) */
  function shiftDate(date: string, delta: number): string {
    const d = parseLocalDate(date)
    if (!d) return ''
    d.setDate(d.getDate() + delta)
    return todayISO(d)
  }

  /** waypoint 以 | 分隔，名稱內若含 | 先換成空白 */
  function routeText(s: string): string {
    return s.replace(/\|/g, ' ').trim()
  }

  function buildPlaces(date: string, activities: any[], attractions: any[]): Place[] {
    const acts = activities
      .filter(a => a && a.date === date && cleanText(a.title))
      .map((a, i) => ({ a, i }))
      .sort((x, y) => {
        const tx = cleanText(x.a.start_time) || '99:99'
        const ty = cleanText(y.a.start_time) || '99:99'
        return tx === ty ? x.i - y.i : tx < ty ? -1 : 1
      })
      .map(({ a }) => a)

    const places: Place[] = acts.map((a, i) => ({
      key: `act-${a.id ?? i}`,
      time: cleanText(a.start_time).slice(0, 5),
      name: cleanText(a.title),
      category: cleanText(a.category),
      url: safeUrl(a.map_url) || searchUrl(cleanText(a.title)),
    }))
    const byName = new Map<string, Place>()
    const hasRealUrl = new Set<string>()
    acts.forEach((a, i) => {
      const p = places[i]
      if (!p) return
      if (!byName.has(p.name)) byName.set(p.name, p)
      if (safeUrl(a.map_url)) hasRealUrl.add(p.name)
    })

    attractions
      .filter(t => t && t.date === date && cleanText(t.title))
      .forEach((t, i) => {
        const name = cleanText(t.title)
        const url = safeUrl(t.map_url)
        const existing = byName.get(name)
        if (existing) {
          // 同名：不重複列出；行程沒有自己的連結時，借用景點的連結
          if (url && !hasRealUrl.has(name)) existing.url = url
          return
        }
        const p: Place = {
          key: `attr-${t.id ?? i}`,
          time: '',
          name,
          category: cleanText(t.location_tag),
          url: url || searchUrl(name),
        }
        places.push(p)
        byName.set(name, p)
        if (url) hasRealUrl.add(name)
      })
    return places
  }

  /** 該日「夜晚」住的那間：check_in_date <= date < check_out_date */
  function lodgingForNight(date: string, accommodations: any[]): Lodging | null {
    if (!date) return null
    const hit = accommodations.find(h => h && h.check_in_date && h.check_out_date && h.check_in_date <= date && date < h.check_out_date)
    if (!hit) return null
    const name = cleanText(hit.name)
    const address = cleanText(hit.address)
    const query = address || name
    if (!query) return null
    return { name: name || address, query, url: safeUrl(hit.google_map_url) || searchUrl(query) }
  }

  function buildRouteUrl(places: Place[], from: Lodging | null, to: Lodging | null): { url: string; tooMany: boolean } {
    if (places.length === 0) return { url: '', tooMany: false }
    const only = places[0]
    if (places.length === 1 && only) return { url: searchUrl(only.name), tooMany: false }

    // waypoint 名稱去重，保留順序
    let stops: string[] = []
    for (const p of places) {
      const n = routeText(p.name)
      if (n && !stops.includes(n)) stops.push(n)
    }
    let destination = to ? routeText(to.query) : ''
    // 沒有當晚住宿：以最後一個地點當終點，其餘當 waypoint
    if (!destination && stops.length > 0) destination = stops.pop() as string
    const origin = from ? routeText(from.query) : ''

    const tooMany = stops.length > MAX_WAYPOINTS
    const waypoints = stops.slice(0, MAX_WAYPOINTS)

    let url = MAPS_DIR
    if (origin) url += '&origin=' + encodeURIComponent(origin)
    url += '&destination=' + encodeURIComponent(destination)
    if (waypoints.length > 0) url += '&waypoints=' + encodeURIComponent(waypoints.join('|'))
    url += '&travelmode=transit'
    return { url, tooMany }
  }

  function weekdayOf(date: string): string {
    const d = parseLocalDate(date)
    return d ? ('日一二三四五六'[d.getDay()] ?? '') : ''
  }

  function buildDays(
    activities: any[], attractions: any[], accommodations: any[], selectedDate: string
  ): DayRoute[] {
    const dateSet = new Set<string>()
    activities.forEach(a => a?.date && dateSet.add(a.date))
    attractions.forEach(a => a?.date && dateSet.add(a.date))
    const allDates = [...dateSet].sort()

    return allDates
      .filter(d => !selectedDate || d === selectedDate)
      .map(date => {
        const places = buildPlaces(date, activities, attractions)
        const from = lodgingForNight(shiftDate(date, -1), accommodations)
        const to = lodgingForNight(date, accommodations)
        const { url, tooMany } = buildRouteUrl(places, from, to)
        const d = parseLocalDate(date)
        return {
          date,
          dayNo: allDates.indexOf(date) + 1,
          label: d ? `${d.getMonth() + 1}/${d.getDate()}（週${weekdayOf(date)}）` : date,
          places,
          from,
          to,
          routeUrl: url,
          tooMany,
        }
      })
      .filter(day => day.places.length > 0)
  }
  // ===== PURE-LOGIC-END =====

  const today = todayISO()

  const days = computed<DayRoute[]>(() =>
    buildDays(props.activities || [], props.attractions || [], props.accommodations || [], props.selectedDate || '')
  )
</script>

<template>
  <div class="space-y-5 px-5 pb-8">
    <!-- 空狀態 -->
    <div v-if="days.length === 0" class="card p-8 text-center animate-fade">
      <div class="stamp mx-auto mb-4 h-16 w-16 -rotate-6 opacity-60" aria-hidden="true">
        <span class="text-xl leading-none">🗺</span>
      </div>
      <p class="font-display text-lg font-bold text-ink">還沒有可以串成路線的地點</p>
      <p class="mt-1 text-sm text-muted">當天加入行程或景點後，這裡會自動整理出路線。</p>
    </div>

    <div v-else class="stagger space-y-5">
      <article
        v-for="(day, i) in days"
        :key="day.date"
        class="card overflow-hidden p-5 sm:p-6"
        :class="day.date === today ? 'ring-2 ring-flare/60 shadow-lg' : ''"
        :style="`--i: ${i}`"
      >
        <!-- 標題列 -->
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="eyebrow mb-1 flex items-center gap-2">
              DAY {{ String(day.dayNo).padStart(2, '0') }}
              <span v-if="day.date === today" class="rounded-full bg-flare px-2 py-0.5 text-[10px] font-bold tracking-wider text-card">今天</span>
            </p>
            <h3 class="font-display text-xl font-bold text-ink">
              Day {{ day.dayNo }} · <span class="font-mono text-lg">{{ day.label }}</span>
            </h3>
          </div>
          <a
            v-if="day.routeUrl"
            :href="day.routeUrl"
            target="_blank"
            rel="noopener"
            class="btn-primary !px-4 !py-2 !text-xs shrink-0"
          >
            {{ day.places.length === 1 ? '在 Google 地圖開啟' : '在 Google 地圖開啟路線' }} ↗
          </a>
        </header>

        <p v-if="day.tooMany" class="mt-3 rounded-lg bg-amber/15 px-3 py-2 text-xs font-bold text-ink-soft">
          地點較多，Google 地圖只會帶入前 9 站
        </p>

        <div class="hairline my-4"></div>

        <ol class="space-y-1">
          <!-- 起點：前一晚住宿 -->
          <li v-if="day.from">
            <a :href="day.from.url" target="_blank" rel="noopener" class="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-paper-deep/50">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aurora/15 text-sm" aria-hidden="true">🏨</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[10px] font-bold tracking-widest text-faint">出發 · 住宿</span>
                <span class="block truncate text-sm font-bold text-ink-soft group-hover:text-flare">{{ day.from.name }}</span>
              </span>
              <span class="text-faint group-hover:text-flare" aria-hidden="true">↗</span>
            </a>
          </li>

          <li v-for="(p, idx) in day.places" :key="p.key">
            <a :href="p.url" target="_blank" rel="noopener" class="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-paper-deep/50">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs font-bold text-card">{{ idx + 1 }}</span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span v-if="p.time" class="font-mono text-xs font-medium text-flare">{{ p.time }}</span>
                  <span v-if="p.category" class="tag !px-2 !py-0 !text-[10px]">{{ p.category }}</span>
                </span>
                <span class="block break-all text-sm font-bold text-ink group-hover:text-flare">{{ p.name }}</span>
              </span>
              <span class="text-faint group-hover:text-flare" aria-hidden="true">↗</span>
            </a>
          </li>

          <!-- 終點：當晚住宿 -->
          <li v-if="day.to">
            <a :href="day.to.url" target="_blank" rel="noopener" class="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-paper-deep/50">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aurora/15 text-sm" aria-hidden="true">🏨</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[10px] font-bold tracking-widest text-faint">回到 · 今晚住宿</span>
                <span class="block truncate text-sm font-bold text-ink-soft group-hover:text-flare">{{ day.to.name }}</span>
              </span>
              <span class="text-faint group-hover:text-flare" aria-hidden="true">↗</span>
            </a>
          </li>
        </ol>
      </article>
    </div>
  </div>
</template>
