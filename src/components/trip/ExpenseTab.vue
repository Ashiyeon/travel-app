<script setup lang="ts">
import { ref, onMounted, computed, watch, markRaw } from 'vue'
import { supabase } from '../../lib/supabaseClient'
import { Utensils, Bus, BedDouble, Ticket, Gift, ShoppingBag, Plane, Ellipsis, CircleCheck } from 'lucide-vue-next'

// --- 引入 Chart.js ---
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

// 註冊元件
ChartJS.register(ArcElement, Tooltip, Legend)

// --- 型別定義 ---
interface Expense {
    id?: number
    trip_id?: string | number
    title: string
    amount_original: number
    currency: string
    exchange_rate: number
    category: string
    payment_method: string
    expense_date?: string
    note: string
    paid_by: string
    split_with: string[]
    split_rule?: string
    split_details?: Record<string, number>
}

interface ExpenseForm extends Omit<Expense, 'id' | 'trip_id'> {
    split_details: Record<string, number>
}

const props = defineProps<{
  tripId: string | string[]
  isEditMode: boolean
  tripMembers: string[]
  selectedDate: string
}>()

//  PART 4: 記帳 (Expenses)
const expenses = ref<Expense[]>([])
const showExpenseForm = ref(false)
const isEditingExpense = ref(false)
const editingExpenseId = ref<number | null>(null)

// 記帳分類
const expenseCategories = [
  { name: '餐飲', icon: markRaw(Utensils) },
  { name: '交通', icon: markRaw(Bus) },
  { name: '住宿', icon: markRaw(BedDouble) },
  { name: '門票', icon: markRaw(Ticket) },
  { name: '伴手禮', icon: markRaw(Gift) },
  { name: '購物', icon: markRaw(ShoppingBag) },
  { name: '機票', icon: markRaw(Plane) },
  { name: '其他', icon: markRaw(Ellipsis) }
]

// 支付方式
const paymentMethods = ['現金', '信用卡', 'IC卡']

// 空白記帳表單
const expenseForm = ref<ExpenseForm>({
  title: '',
  amount_original: 0,
  currency: 'JPY',
  exchange_rate: 0.215,
  category: '餐飲',
  payment_method: '現金',
  expense_date: new Date().toISOString().split('T')[0],
  note: '',
  paid_by: '', // 誰付的
  split_with: [] as string[], // 分擔的人
  split_rule: 'EQUAL',
  split_details: {}
})

// 幣值符號
function getCurrencySymbol(currency: string) {
    switch (currency) {
    case 'JPY': return '¥'
    case 'USD': return '$'
    case 'TWD': return 'NT$'
    case 'EUR': return '€'
    case 'KRW': return '₩'
    default: return currency
    }
}

function calculateAmountTWD(expense: Partial<Expense> | any) {
    if (!expense || !expense.amount_original || !expense.exchange_rate) return 0
    return Math.round(expense.amount_original * expense.exchange_rate)
}

// 自動獲取匯率
async function fetchExchangeRate(currency: string) {
  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`)
    const data = await response.json()
    return data.rates.TWD
  } catch (error) {
    console.error('獲取匯率失敗:', error)
    return null
  }
}

async function openExpenseForm(expense?: Partial<Expense>) {
    if (expense && (expense as any).id) {
        isEditingExpense.value = true
        editingExpenseId.value = (expense as any).id

        expenseForm.value = {
            title: expense.title || '',
            amount_original: expense.amount_original || 0,
            currency: expense.currency || 'JPY',
            exchange_rate: expense.exchange_rate || 0.215,
            category: expense.category || '餐飲',
            payment_method: expense.payment_method || '現金',
            expense_date: expense.expense_date || props.selectedDate || new Date().toISOString().split('T')[0],
            note: expense.note || '',
            paid_by: expense.paid_by ?? (props.tripMembers[0] || ''),
            split_with: expense.split_with || [],
            split_rule: expense.split_rule || 'EQUAL',
            split_details: expense.split_details || {}
        }
    } else {
        isEditingExpense.value = false
        editingExpenseId.value = null
        
        const defaultCategory = expense?.category || '餐飲'

        expenseForm.value = {
            title: '',
            amount_original: 0,
            currency: 'JPY',
            exchange_rate: 0.215,
            category: defaultCategory,
            payment_method: '現金',
            expense_date: (props.selectedDate && props.selectedDate !== '') ? props.selectedDate : new Date().toISOString().split('T')[0],
            note: '',
            paid_by: props.tripMembers[0] || '',
            split_with: [...props.tripMembers],
            split_rule: 'EQUAL',
            split_details: {}
        }
        
        const rate = await fetchExchangeRate('JPY')
        if (rate) expenseForm.value.exchange_rate = rate
    }
    showExpenseForm.value = true
}

async function handleSaveExpense() {
  if (expenseForm.value.split_with.length === 0) {
      expenseForm.value.split_with = [expenseForm.value.paid_by]
  }

  if (!expenseForm.value.title || expenseForm.value.amount_original === 0) return alert('請填寫項目名稱與金額')
  if (!expenseForm.value.paid_by) return alert('請選擇誰付款')
  
  if (expenseForm.value.split_rule === 'EXACT') {
      const totalExact = expenseForm.value.split_with.reduce((sum, p) => sum + (expenseForm.value.split_details?.[p] || 0), 0)
      if (totalExact !== expenseForm.value.amount_original) {
          return alert(`具體金額加總 (${totalExact}) 不等於原始金額 (${expenseForm.value.amount_original})`)
      }
  } else if (expenseForm.value.split_rule === 'PERCENT') {
      const totalPercent = expenseForm.value.split_with.reduce((sum, p) => sum + (expenseForm.value.split_details?.[p] || 0), 0)
      if (totalPercent !== 100) {
          return alert(`百分比加總 (${totalPercent}%) 不等於 100%`)
      }
  }

  const payload = {
    trip_id: props.tripId,
    title: expenseForm.value.title,
    amount_original: expenseForm.value.amount_original,
    currency: expenseForm.value.currency,
    exchange_rate: expenseForm.value.exchange_rate,
    category: expenseForm.value.category,
    payment_method: expenseForm.value.payment_method,
    expense_date: expenseForm.value.expense_date || new Date().toISOString().split('T')[0],
    note: expenseForm.value.note,
    paid_by: expenseForm.value.paid_by || '',
    split_with: expenseForm.value.split_with,
    split_rule: expenseForm.value.split_rule,
    split_details: expenseForm.value.split_details
  }

  let error = null
  if (isEditingExpense.value && editingExpenseId.value) {
      const res = await supabase.from('travel_expenses').update(payload).eq('id', editingExpenseId.value)
      error = res.error
  } else {
      const res = await supabase.from('travel_expenses').insert([payload])
      error = res.error
  }
  if (!error) { showExpenseForm.value = false; loadExpensesData() } else alert(error.message)
}

async function handleDeleteExpense() {
   if (!editingExpenseId.value || !confirm('確定刪除此記帳？')) return
   const { error } = await supabase.from('travel_expenses').delete().eq('id', editingExpenseId.value)
   if (!error) { showExpenseForm.value = false; loadExpensesData() }
}

async function loadExpensesData() {
    if (props.tripId === 'demo-korea') {
        expenses.value = [
            { id: 1, title: '首爾來回機票', amount_original: 36000, currency: 'TWD', exchange_rate: 1, category: '機票', payment_method: '信用卡', expense_date: '2026-03-01', note: '長榮早去晚回', paid_by: '小美', split_with: ['小美', '大壯', '阿明'], split_rule: 'EQUAL', split_details: {} },
            { id: 2, title: '荒謬的生肉', amount_original: 45000, currency: 'KRW', exchange_rate: 0.024, category: '餐飲', payment_method: '現金', expense_date: '2026-04-01', note: '烤五花肉吃到飽', paid_by: '大壯', split_with: ['小美', '大壯', '阿明'], split_rule: 'EQUAL', split_details: {} },
            { id: 3, title: 'L7 弘大飯店(4晚)', amount_original: 16000, currency: 'TWD', exchange_rate: 1, category: '住宿', payment_method: '信用卡', expense_date: '2026-04-01', note: 'Agoda 訂房', paid_by: '阿明', split_with: ['小美', '大壯', '阿明'], split_rule: 'EQUAL', split_details: {} },
            { id: 4, title: 'Olive Young 美妝', amount_original: 120000, currency: 'KRW', exchange_rate: 0.024, category: '購物', payment_method: '信用卡', expense_date: '2026-04-03', note: '小美自己買的保養品', paid_by: '小美', split_with: ['小美'], split_rule: 'EQUAL', split_details: {} },
            { id: 5, title: '機場包車接送', amount_original: 2500, currency: 'TWD', exchange_rate: 1, category: '交通', payment_method: '信用卡', expense_date: '2026-04-05', note: '回程行李太多叫車', paid_by: '大壯', split_with: ['小美', '大壯', '阿明'], split_rule: 'EXACT', split_details: { '小美': 800, '大壯': 800, '阿明': 900 } },
        ]
        return
    }
    const { data } = await supabase.from('travel_expenses').select('*').eq('trip_id', props.tripId).order('expense_date', { ascending: false })
    expenses.value = data || []
}

// --- 計算圖表資料 ---
const expenseChartData = computed(() => {
    const categoryMap: Record<string, number> = {}
    expenseCategories.forEach(c => categoryMap[c.name] = 0)

    expenses.value.forEach((e: Expense) => {
        const amount = calculateAmountTWD(e)
        const category = e.category || '其他'
        if (categoryMap[category] !== undefined) {
            categoryMap[category] += amount
        } else {
            categoryMap['其他'] = (categoryMap['其他'] || 0) + amount
        }
    })

    const labels: string[] = []
    const data: number[] = []
    const backgroundColors = ['#C2553A', '#2E6E8E', '#D69A3C', '#5E8C5A', '#8C5A7A', '#E08A5F', '#7FA8B8', '#A3896B']

    Object.entries(categoryMap).forEach(([key, value]) => {
        if (value > 0) {
            labels.push(key)
            data.push(value)
        }
    })

    return {
        labels: labels,
        datasets: [{
            backgroundColor: backgroundColors,
            data: data,
            borderColor: '#FBF8F2',
            borderWidth: 3
        }]
    }
})

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'right' as const,
            labels: {
                usePointStyle: true,
                boxWidth: 8,
                color: '#4A4239',
                font: { size: 12, family: "'Noto Sans TC', sans-serif" },
                generateLabels: (chart: any) => {
                    const data = chart.data;
                    if (data.labels.length && data.datasets.length) {
                        const total = data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
                        return data.labels.map((label: string, i: number) => {
                            const value = data.datasets[0].data[i];
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                            return {
                                text: `${label}: ${percentage}%`,
                                fillStyle: data.datasets[0].backgroundColor[i],
                                strokeStyle: data.datasets[0].backgroundColor[i],
                                fontColor: '#4A4239',
                                hidden: false,
                                index: i
                            };
                        });
                    }
                    return [];
                }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(30, 26, 22, 0.92)',
            titleColor: '#FBF8F2',
            bodyColor: '#EDE4D3',
            borderColor: 'rgba(30, 26, 22, 0.1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 12,
            titleFont: { family: "'Noto Sans TC', sans-serif" },
            bodyFont: { family: "'Noto Sans TC', sans-serif" },
            callbacks: {
                label: (context: any) => {
                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0';
                    return `${context.label}: NT$ ${context.parsed.toLocaleString()} (${percentage}%)`;
                }
            }
        }
    }
}

const settlementCalculation = computed(() => {
    const settlement: Record<string, { paid: number, should_pay: number }> = {}
    expenses.value.forEach(expense => {
        const amountTWD = calculateAmountTWD(expense)
        const payer = expense.paid_by || '未指定'
        if (!settlement[payer]) settlement[payer] = { paid: 0, should_pay: 0 }
        settlement[payer].paid += amountTWD

        const splits = [...(expense.split_with || []), payer]
        const uniqueSplits = [...new Set(splits)]
        
        const rule = expense.split_rule || 'EQUAL'
        const details = expense.split_details || {}

        if (rule === 'EQUAL') {
            const perPerson = amountTWD / uniqueSplits.length
            uniqueSplits.forEach(person => {
                if (!settlement[person]) settlement[person] = { paid: 0, should_pay: 0 }
                settlement[person].should_pay += perPerson
            })
        } else if (rule === 'EXACT') {
            uniqueSplits.forEach(person => {
                if (!settlement[person]) settlement[person] = { paid: 0, should_pay: 0 }
                const exactOrig = details[person] || 0
                const exactTWD = expense.amount_original ? (exactOrig / expense.amount_original) * amountTWD : 0
                settlement[person].should_pay += exactTWD
            })
        } else if (rule === 'PERCENT') {
            uniqueSplits.forEach(person => {
                if (!settlement[person]) settlement[person] = { paid: 0, should_pay: 0 }
                const percent = details[person] || 0
                const percentTWD = amountTWD * (percent / 100)
                settlement[person].should_pay += percentTWD
            })
        }
    })

    // 計算淨額
    const balances: { name: string, balance: number }[] = []
    Object.entries(settlement).forEach(([person, amounts]) => {
        const balance = Math.round(amounts.paid - amounts.should_pay)
        if (balance !== 0) {
            balances.push({ name: person, balance })
        }
    })

    // 分離債權人與債務人
    const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, balance: Math.abs(b.balance) }))
    const creditors = balances.filter(b => b.balance > 0)

    // 由大到小排序，盡量減少交易次數
    debtors.sort((a, b) => b.balance - a.balance)
    creditors.sort((a, b) => b.balance - a.balance)

    const transactions: { from: string, to: string, amount: number }[] = []
    
    let i = 0 // debtors index
    let j = 0 // creditors index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i]
        const creditor = creditors[j]
        
        if (!debtor || !creditor) break;

        const amount = Math.min(debtor.balance, creditor.balance)
        
        if (amount > 0) {
             transactions.push({
                 from: debtor.name,
                 to: creditor.name,
                 amount: amount
             })
        }

        debtor.balance -= amount
        creditor.balance -= amount

        if (debtor.balance === 0) i++
        if (creditor.balance === 0) j++
    }

    return { settlement, transactions }
})

// 每人實際花費：依各筆的分擔名單算出的應付總額（沒參與的支出不會算進去）
const perPersonSpending = computed(() =>
    Object.entries(settlementCalculation.value.settlement)
        .map(([name, s]) => ({ name, amount: Math.round(s.should_pay) }))
        .filter(p => p.amount > 0)
        .sort((a, b) => b.amount - a.amount)
)

watch(() => expenseForm.value.currency, async (newCurrency) => {
    if (newCurrency && showExpenseForm.value) {
        const rate = await fetchExchangeRate(newCurrency)
        if (rate) expenseForm.value.exchange_rate = rate
    }
})

onMounted(loadExpensesData)
defineExpose({ loadData: loadExpensesData })
</script>

<template>
  <section class="px-4 pb-20">
    <div class="flex justify-between items-center mb-4 pl-1">
        <h2 class="font-display text-xl font-bold text-ink flex items-center gap-2">
            旅程記帳
        </h2>
        <span class="eyebrow" v-if="expenses.length > 0">共 {{ expenses.length }} 筆</span>
    </div>

    <!-- 快速記帳按鈕 -->
    <div v-if="props.isEditMode" class="card p-4 mb-6">
        <p class="eyebrow mb-3">快速記帳</p>
        <div class="grid grid-cols-4 gap-2">
            <button v-for="cat in expenseCategories" :key="cat.name"
                @click="openExpenseForm({ category: cat.name })"
                class="p-3 rounded-2xl bg-paper-deep/50 hover:bg-paper-deep border border-ink/10 hover:border-flare/50 transition-all flex flex-col items-center gap-1 group cursor-pointer">
                <component :is="cat.icon" class="h-6 w-6 text-ink-soft transition group-hover:scale-110" :stroke-width="1.75" aria-hidden="true" />
                <span class="text-[10px] font-bold text-ink-soft">{{ cat.name }}</span>
            </button>
        </div>
    </div>

    <!-- 記帳統計 -->
    <div v-if="expenses.length > 0" class="card p-5 mb-6">
        <div class="grid grid-cols-2 gap-4">
            <div class="text-center border-r border-ink/10">
                <p class="eyebrow mb-1">總支出 (TWD)</p>
                <p class="font-display text-2xl font-bold text-gradient">{{ Math.round(expenses.reduce((sum, e) => sum + calculateAmountTWD(e), 0)) }}</p>
            </div>
            <div class="text-center">
                <p class="eyebrow mb-1">記帳筆數</p>
                <p class="font-mono text-xl font-bold text-ink">{{ expenses.length }}</p>
            </div>
        </div>
        <div v-if="perPersonSpending.length > 0" class="mt-4 pt-4 border-t border-ink/10">
            <p class="eyebrow mb-2">每人實際花費 (TWD)</p>
            <div v-for="p in perPersonSpending" :key="p.name" class="flex justify-between items-center py-1">
                <span class="text-sm font-medium text-ink">{{ p.name }}</span>
                <span class="font-mono text-sm font-bold text-lagoon">{{ p.amount.toLocaleString() }}</span>
            </div>
        </div>
    </div>

    <div v-if="expenses.length > 0" class="card p-5 mb-6">
        <h3 class="font-display font-bold text-ink mb-4 flex items-center gap-2">支出分佈</h3>
        <div class="h-48 relative flex justify-center">
            <Doughnut :data="expenseChartData" :options="chartOptions" />
        </div>
        <div class="mt-4 pt-3 border-t border-ink/10 text-center">
            <p class="eyebrow">花費最多的項目</p>
            <div v-if="expenseChartData.datasets && expenseChartData.datasets[0] && expenseChartData.datasets[0].data && expenseChartData.datasets[0].data.length > 0">
               <p class="font-display font-bold text-flare text-lg mt-1">
                   {{ expenseChartData.labels[expenseChartData.datasets[0].data.indexOf(Math.max(...expenseChartData.datasets[0].data))] }}
               </p>
               <p class="text-xs text-muted font-mono">
                   NT$ {{ Math.max(...expenseChartData.datasets[0].data).toLocaleString() }}
               </p>
            </div>
        </div>
    </div>

    <div v-if="expenses.length === 0" class="text-center py-12 rounded-3xl bg-paper-deep/50 border border-dashed border-ink/15">
        <p class="text-muted mb-3">{{ props.isEditMode ? '還沒有任何記帳' : '暫無記帳資料' }}</p>
        <button v-if="props.isEditMode" @click="openExpenseForm()" class="btn-primary">開始記帳</button>
    </div>

    <div v-else class="space-y-3">
        <div v-for="expense in expenses" :key="expense.id"
            @click="props.isEditMode ? openExpenseForm(expense) : null"
            :class="{ 'cursor-default': !props.isEditMode, 'card-hover cursor-pointer': props.isEditMode }"
            class="card p-4 flex justify-between items-center">
            <div class="flex-1 flex items-center gap-4 min-w-0">
                <component :is="expenseCategories.find(c => c.name === expense.category)?.icon || Ellipsis" class="h-6 w-6 shrink-0 text-ink-soft" :stroke-width="1.75" aria-hidden="true" />
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-ink break-all">{{ expense.title }}</p>
                    <p class="text-xs text-muted truncate font-mono">{{ expense.expense_date }} · {{ expense.category }} · {{ expense.payment_method }}</p>
                    <p v-if="expense.note" class="text-xs text-faint mt-1 break-all">{{ expense.note }}</p>
                    <span class="font-bold text-ink-soft text-xs break-all">付款人:{{ expense.paid_by }}</span>
                    <p v-if="expense.split_with && expense.split_with.length > 0" class="text-xs text-faint mt-1 break-all">分擔: {{ expense.split_with.join(', ') }}</p>                </div>
            </div>
            <div class="text-right">
                <p class="text-lg font-bold font-mono text-flare">{{ getCurrencySymbol(expense.currency) }} {{ expense.amount_original }}</p>
                <p class="text-xs text-faint font-mono">NT${{ calculateAmountTWD(expense) }}</p>
            </div>
        </div>
    </div>

    <!-- 清算結算 -->
    <div v-if="expenses.length > 0 && settlementCalculation.settlement && Object.keys(settlementCalculation.settlement).length > 0" class="mt-8 space-y-4">
        <!-- 付款統計 -->
        <div class="card p-5">
            <h3 class="font-display font-bold text-ink mb-4 flex items-center gap-2">付款統計</h3>
            <div class="space-y-2">
                <div v-for="(amount, person) in settlementCalculation.settlement" :key="person" class="rounded-2xl p-3 bg-paper-deep/50 border border-ink/10 flex justify-between items-center">
                    <p class="font-bold text-ink">{{ person }}</p>
                    <div class="text-right">
                        <p class="text-[10px] text-muted font-mono mb-0.5">已付 NT${{ Math.round(amount.paid) }} / 應付 NT${{ Math.round(amount.should_pay) }}</p>
                        <p class="font-bold font-mono text-lg" :class="(amount.paid - amount.should_pay) > 0 ? 'text-lagoon' : ((amount.paid - amount.should_pay) < 0 ? 'text-alert' : 'text-faint')">
                            {{ (amount.paid - amount.should_pay) > 0 ? '+' : '' }}{{ Math.round(amount.paid - amount.should_pay) }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 誰欠誰錢 (結算指示) -->
        <div v-if="settlementCalculation.transactions && settlementCalculation.transactions.length > 0" class="card p-5">
            <h3 class="font-display font-bold text-ink mb-4 flex items-center gap-2">結算清單</h3>
            <div class="space-y-3">
                <div v-for="(tx, index) in settlementCalculation.transactions" :key="index" class="flex items-center justify-between p-3 bg-paper-deep/50 rounded-2xl border border-ink/10">
                    <div class="flex items-center gap-3">
                        <div class="px-3 h-8 rounded-full bg-alert/10 border border-alert/30 text-alert flex items-center justify-center font-bold text-sm truncate max-w-[100px]">{{ tx.from }}</div>
                        <span class="text-faint text-xs shrink-0">應付</span>
                        <div class="px-3 h-8 rounded-full bg-lagoon/10 border border-lagoon/30 text-lagoon flex items-center justify-center font-bold text-sm truncate max-w-[100px]">{{ tx.to }}</div>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="font-black font-mono text-alert">NT$ {{ tx.amount.toLocaleString() }}</p>
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="expenses.length > 0" class="bg-lagoon/10 text-lagoon rounded-3xl border border-lagoon/30 p-4 text-center font-bold text-sm flex items-center justify-center gap-2">
            <CircleCheck class="h-5 w-5 shrink-0" :stroke-width="1.75" aria-hidden="true" /> 大家都互不相欠，帳目已結清！
        </div>
    </div>

    <button v-if="props.isEditMode" @click="openExpenseForm()" class="btn-primary fixed bottom-28 right-6 w-14! h-14! p-0! text-3xl pb-1 z-30 hover:scale-110" aria-label="新增記帳">+</button>

    <!-- 記帳表單 -->
    <div v-if="showExpenseForm" class="modal-backdrop" @click.self="showExpenseForm = false">
        <div class="modal-panel !max-w-lg">
            <div class="flex justify-between items-center mb-5 py-2 border-b border-ink/10"><h3 class="font-display text-lg font-black text-ink">{{ isEditingExpense ? '編輯記帳' : '新增記帳' }}</h3><button @click="showExpenseForm = false" class="btn-icon" aria-label="關閉">✕</button></div>
            <div class="space-y-4">
                <div>
                    <label class="field-label">項目名稱</label>
                    <input v-model="expenseForm.title" placeholder="例如: 築地早餐" class="field" />
                </div>
                <div>
                    <label class="field-label">原始金額</label>
                    <div class="flex gap-2">
                        <input type="number" v-model.number="expenseForm.amount_original" placeholder="金額" class="field flex-1 min-w-0 font-mono" />
                        <select v-model="expenseForm.currency" class="field !w-24 shrink-0">
                            <option>JPY</option><option>USD</option><option>TWD</option>
                        </select>
                    </div>
                    <p class="text-xs text-muted font-mono mt-1" v-if="expenseForm.amount_original">估算 TWD {{ calculateAmountTWD({ amount_original: expenseForm.amount_original, exchange_rate: expenseForm.exchange_rate }) }}</p>
                </div>
                <div>
                    <label class="field-label">匯率</label>
                    <input type="number" v-model.number="expenseForm.exchange_rate" step="0.001" placeholder="0.215" class="field font-mono" />
                </div>
                <div>
                    <label class="field-label">分類</label>
                    <div class="grid grid-cols-4 gap-2">
                        <button v-for="cat in expenseCategories" :key="cat.name" @click="expenseForm.category = cat.name" class="chip !flex-col !gap-0.5 !px-2 !py-2 !rounded-2xl justify-center" :class="expenseForm.category === cat.name ? 'chip-active' : ''">
                            <component :is="cat.icon" class="h-5 w-5" :stroke-width="1.75" aria-hidden="true" />
                            <span class="text-[10px] font-bold">{{ cat.name }}</span>
                        </button>
                    </div>
                </div>
                <div>
                    <label class="field-label">支付方式</label>
                    <div class="flex gap-2">
                        <button v-for="method in paymentMethods" :key="method" @click="expenseForm.payment_method = method" class="chip flex-1 justify-center font-bold" :class="expenseForm.payment_method === method ? 'chip-active' : ''">
                            {{ method }}
                        </button>
                    </div>
                </div>
                <div>
                    <label class="field-label">消費日期</label>
                    <input v-model="expenseForm.expense_date" type="date" class="field appearance-none m-0 min-h-[46px] font-mono" />
                </div>
                <div>
                    <label class="field-label flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">誰付的？ *必填</label>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="member in props.tripMembers" :key="member" @click="expenseForm.paid_by = member" class="chip font-bold" :class="expenseForm.paid_by === member ? 'chip-active' : ''">
                            {{ member }}
                        </button>
                    </div>
                </div>
                <div class="mt-2">
                    <div class="flex justify-between items-end mb-2">
                        <label class="field-label !mb-0">分擔的人</label>
                        <button @click="expenseForm.split_with = [...props.tripMembers]" class="tag text-flare border-flare/30 bg-flare/10 hover:bg-flare/20 cursor-pointer">全選</button>
                    </div>

                    <div class="flex gap-2 mb-3 bg-paper-deep/50 border border-ink/10 p-1 rounded-full">
                        <button @click="expenseForm.split_rule = 'EQUAL'" class="chip flex-1 justify-center !py-1 !px-2 text-xs font-bold" :class="expenseForm.split_rule === 'EQUAL' ? 'chip-active' : '!border-transparent !bg-transparent'"> 平分</button>
                        <button @click="expenseForm.split_rule = 'EXACT'" class="chip flex-1 justify-center !py-1 !px-2 text-xs font-bold" :class="expenseForm.split_rule === 'EXACT' ? 'chip-active' : '!border-transparent !bg-transparent'"> 具體金額</button>
                        <button @click="expenseForm.split_rule = 'PERCENT'" class="chip flex-1 justify-center !py-1 !px-2 text-xs font-bold" :class="expenseForm.split_rule === 'PERCENT' ? 'chip-active' : '!border-transparent !bg-transparent'"> 百分比</button>
                    </div>

                    <div class="space-y-2">
                        <div v-for="member in props.tripMembers" :key="member"
                               class="flex items-center justify-between p-2 rounded-2xl border transition-all"
                               :class="expenseForm.split_with.includes(member) ? 'bg-flare/10 border-flare/40' : 'bg-paper-deep/50 border-ink/10 opacity-70'">
                            <label class="flex items-center gap-2 cursor-pointer select-none flex-1">
                                <input type="checkbox" :value="member" v-model="expenseForm.split_with" class="w-4 h-4 accent-flare">
                                <span class="text-muted font-medium text-xs" :class="{'text-ink font-bold': expenseForm.split_with.includes(member)}">{{ member }}</span>
                            </label>

                            <div v-if="expenseForm.split_with.includes(member) && expenseForm.split_rule !== 'EQUAL'" class="w-24">
                                <div class="relative flex items-center">
                                    <input type="number" v-model.number="expenseForm.split_details[member]" placeholder="0" class="field !rounded-lg !px-2 !py-1 !pr-9 text-right text-xs font-mono">
                                    <span class="absolute right-2 text-[10px] text-muted font-bold font-mono">{{ expenseForm.split_rule === 'PERCENT' ? '%' : expenseForm.currency }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="expenseForm.split_rule === 'EXACT'" class="mt-2 text-xs text-right font-bold font-mono" :class="expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) === expenseForm.amount_original ? 'text-lagoon' : 'text-alert'">
                        目前加總: {{ expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) }} / {{ expenseForm.amount_original }}
                    </div>
                    <div v-if="expenseForm.split_rule === 'PERCENT'" class="mt-2 text-xs text-right font-bold font-mono" :class="expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) === 100 ? 'text-lagoon' : 'text-alert'">
                        目前加總: {{ expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) }}% / 100%
                    </div>
                </div>
                <div>
                    <label class="field-label">備註 (可選)</label>
                    <textarea v-model="expenseForm.note" class="field h-16 resize-none break-all"></textarea>
                </div>
                <div class="flex gap-3 mt-6 pt-4 border-t border-ink/10">
                    <button v-if="isEditingExpense" @click="handleDeleteExpense" class="btn-danger">刪除</button>
                    <button @click="handleSaveExpense" class="btn-primary flex-1">儲存</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>
