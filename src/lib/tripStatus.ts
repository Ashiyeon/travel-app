// 行程狀態 / 出發倒數（首頁、詳情頁、分享頁共用）

export type TripPhase = 'upcoming' | 'ongoing' | 'finished' | 'unknown'

export interface TripStatus {
  phase: TripPhase
  /** upcoming: 距出發天數；ongoing: 第幾天 (1-based)；finished: 結束幾天 */
  days: number
  /** 給畫面直接顯示的短字串，例如「還有 12 天出發」 */
  label: string
}

/** 把 'YYYY-MM-DD' 當成「當地日期」解析，避免 new Date('2026-04-01') 被當成 UTC 而在西半球差一天 */
export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 今天的 'YYYY-MM-DD'（當地時間） */
export function todayISO(now: Date = new Date()): string {
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

const DAY = 86400000

export function getTripStatus(start: string | null | undefined, end: string | null | undefined, now: Date = new Date()): TripStatus {
  const s = parseLocalDate(start)
  const e = parseLocalDate(end) ?? s
  if (!s || !e) return { phase: 'unknown', days: 0, label: '' }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const toStart = Math.round((s.getTime() - today.getTime()) / DAY)
  const sinceEnd = Math.round((today.getTime() - e.getTime()) / DAY)

  if (toStart > 0) return { phase: 'upcoming', days: toStart, label: toStart === 1 ? '明天出發' : `還有 ${toStart} 天出發` }
  if (sinceEnd > 0) return { phase: 'finished', days: sinceEnd, label: '旅程已結束' }
  const dayN = -toStart + 1
  return { phase: 'ongoing', days: dayN, label: `旅程第 ${dayN} 天` }
}
