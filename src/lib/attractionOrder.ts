// 景點卡片排序：先依日期，同一天再依「行程裡同名項目的開始時間」，最後依建立順序（id）。
// 景點卡片沒有時間欄位，所以借用行程的時間；名稱對不上或行程沒填時間的卡片排在當天最後。

type Activity = { date?: string | null; start_time?: string | null; title?: string | null }
type Attraction = { id?: number | null; date?: string | null; title?: string | null }

const NO_TIME = '99:99'

// 去空白、轉小寫，並只取括號前的主名稱：「景福宮 (Gyeongbokgung)」→「景福宮」
function coreName(text: string | null | undefined): string {
  const s = (text || '').toLowerCase().replace(/\s+/g, '')
  const cut = s.search(/[(（《【「]/)
  return cut > 0 ? s.slice(0, cut) : s
}

function matches(a: string, b: string): boolean {
  if (a.length < 2 || b.length < 2) return false
  return a.includes(b) || b.includes(a)
}

function timeOf(attr: Attraction, activities: Activity[]): string {
  const name = coreName(attr.title)
  let best = NO_TIME
  for (const act of activities) {
    if (act.date !== attr.date || !act.start_time) continue
    if (!matches(name, coreName(act.title))) continue
    const t = act.start_time.slice(0, 5)
    if (t < best) best = t
  }
  return best
}

export function sortAttractions<T extends Attraction>(attractions: T[], activities: Activity[]): T[] {
  return attractions
    .map(a => ({ a, date: a.date || '9999-99-99', time: timeOf(a, activities), id: a.id ?? 0 }))
    .sort((x, y) =>
      x.date !== y.date ? (x.date < y.date ? -1 : 1)
      : x.time !== y.time ? (x.time < y.time ? -1 : 1)
      : x.id - y.id)
    .map(({ a }) => a)
}
