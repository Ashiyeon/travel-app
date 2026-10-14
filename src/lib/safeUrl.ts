// 使用者填的地圖連結只允許 http(s)，避免 javascript: 之類的網址被點擊執行
// （分享頁給未登入的訪客看，特別需要）
export function safeUrl(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return ''
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''
  } catch {
    return ''
  }
}
