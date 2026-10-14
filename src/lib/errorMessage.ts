// 把 Supabase / 網路錯誤轉成使用者看得懂的訊息
export function friendlyError(message: string | null | undefined): string {
  const msg = message || ''
  if (!navigator.onLine) return '目前離線，請連上網路後再試一次。'
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return '無法連線到伺服器，請檢查網路後再試一次。'
  }
  if (/jwt|token.*expired|not authenticated/i.test(msg)) return '登入已過期，請回首頁重新登入。'
  return msg || '發生未知錯誤，請稍後再試。'
}
