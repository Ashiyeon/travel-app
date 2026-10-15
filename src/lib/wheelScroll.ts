/**
 * 讓滑鼠滾輪在橫向捲動列上左右捲動 (電腦沒有觸控滑動，否則選不到後面的項目)。
 * 用法：<div class="overflow-x-auto" @wheel="wheelToHorizontal">
 * 已捲到底或觸控板本身就在橫向捲動時不攔截，讓頁面照常上下捲動。
 */
export function wheelToHorizontal(e: WheelEvent): void {
  const el = e.currentTarget as HTMLElement | null
  if (!el || e.ctrlKey) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return

  // deltaMode 1 = 以「行」為單位 (Firefox)，換算成像素
  const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
  if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= max - 1)) return

  e.preventDefault()
  el.scrollLeft = Math.min(max, Math.max(0, el.scrollLeft + delta))
}
