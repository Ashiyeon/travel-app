<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { supabase } from '../../lib/supabaseClient'

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
  { name: '餐飲', icon: '🍽️' },
  { name: '交通', icon: '🚌' },
  { name: '住宿', icon: '🛏️' },
  { name: '門票', icon: '🎫' },
  { name: '伴手禮', icon: '🎁' },
  { name: '購物', icon: '🛍️' },
  { name: '機票', icon: '✈️' },
  { name: '其他', icon: '📍' }
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
    const backgroundColors = ['#BC4749', '#2E8B57', '#D4A373', '#FF6B35', '#8B4513', '#32CD32', '#1E90FF', '#696969']

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
            borderWidth: 0
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
                font: { size: 12 },
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
        <h2 class="text-xl font-bold text-[#BC4749] flex items-center gap-2">
            <span class="text-2xl">💰</span> 旅程記帳
        </h2>
        <span class="text-xs text-stone-400" v-if="expenses.length > 0">共 {{ expenses.length }} 筆</span>
    </div>

    <!-- 快速記帳按鈕 -->
    <div v-if="props.isEditMode" class="bg-white rounded-xl shadow-sm border border-stone-100 p-4 mb-6">
        <p class="text-xs text-stone-600 font-bold mb-3">快速記帳</p>
        <div class="grid grid-cols-4 gap-2">
            <button v-for="cat in expenseCategories" :key="cat.name" 
                @click="openExpenseForm({ category: cat.name })" 
                class="p-3 rounded-lg bg-stone-50 hover:bg-[#E9EDC9] border border-stone-200 hover:border-[#606C38] transition-all flex flex-col items-center gap-1 group">
                <span class="text-2xl group-hover:scale-110 transition">{{ cat.icon }}</span>
                <span class="text-[10px] font-bold text-stone-700">{{ cat.name }}</span>
            </button>
        </div>
    </div>

    <!-- 記帳統計 -->
    <div v-if="expenses.length > 0" class="bg-gradient-to-br from-[#E9EDC9] to-[#F5F5F4] rounded-xl border border-[#D4A373]/30 p-4 mb-6">
        <div class="grid grid-cols-3 gap-4">
            <div class="text-center">
                <p class="text-xs text-stone-600 mb-1">總支出 (TWD)</p>
                <p class="text-xl font-bold text-[#BC4749]">{{ Math.round(expenses.reduce((sum, e) => sum + calculateAmountTWD(e), 0)) }}</p>
            </div>
            <div class="text-center border-l border-r border-[#D4A373]/30">
                <p class="text-xs text-stone-600 mb-1">平均每人</p>
                <p class="text-xl font-bold text-[#606C38]">{{ expenses.length > 0 ? Math.round(expenses.reduce((sum, e) => sum + calculateAmountTWD(e), 0) / (new Set(expenses.map(e => e.paid_by)).size || 1)) : 0 }}</p>
            </div>
            <div class="text-center">
                <p class="text-xs text-stone-600 mb-1">記帳筆數</p>
                <p class="text-xl font-bold text-[#283618]">{{ expenses.length }}</p>
            </div>
        </div>
    </div>

    <div v-if="expenses.length > 0" class="bg-white rounded-xl border border-stone-100 shadow-sm p-4 mb-6">
        <h3 class="font-bold text-[#6F4E37] mb-4 flex items-center gap-2">🍰 支出分佈</h3>
        <div class="h-48 relative flex justify-center">
            <Doughnut :data="expenseChartData" :options="chartOptions" />
        </div>
        <div class="mt-4 pt-3 border-t border-stone-100 text-center">
            <p class="text-xs text-stone-400">花費最多的項目</p>
            <div v-if="expenseChartData.datasets && expenseChartData.datasets[0] && expenseChartData.datasets[0].data && expenseChartData.datasets[0].data.length > 0">
               <p class="font-bold text-[#BC4749] text-lg">
                   {{ expenseChartData.labels[expenseChartData.datasets[0].data.indexOf(Math.max(...expenseChartData.datasets[0].data))] }}
               </p>
               <p class="text-xs text-stone-500">
                   NT$ {{ Math.max(...expenseChartData.datasets[0].data).toLocaleString() }}
               </p>
            </div>
        </div>
    </div>

    <div v-if="expenses.length === 0" class="text-center py-12 bg-white rounded-xl border border-dashed border-stone-300">
        <p class="text-stone-400 mb-2">{{ props.isEditMode ? '還沒有任何記帳' : '暫無記帳資料' }}</p>
        <button v-if="props.isEditMode" @click="openExpenseForm()" class="text-[#BC4749] font-bold hover:underline">開始記帳</button>
    </div>

    <div v-else class="space-y-3">
        <div v-for="expense in expenses" :key="expense.id" 
            @click="props.isEditMode ? openExpenseForm(expense) : null" 
            :class="{ 'cursor-default': !props.isEditMode, 'hover:shadow-md': props.isEditMode }"
            class="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex justify-between items-center transition-shadow">
            <div class="flex-1 flex items-center gap-4">
                <span class="text-2xl">{{ expenseCategories.find(c => c.name === expense.category)?.icon || '📍' }}</span>
                <div class="flex-1">
                    <p class="font-bold text-stone-800">{{ expense.title }}</p>
                    <p class="text-xs text-stone-500">{{ expense.expense_date }} · {{ expense.category }} · {{ expense.payment_method }}</p>
                    <p v-if="expense.note" class="text-xs text-stone-400 mt-1">{{ expense.note }}</p>
                    <span class="font-bold text-stone-600 text-xs">付款人:{{ expense.paid_by }}</span> 
                    <p v-if="expense.split_with && expense.split_with.length > 0" class="text-xs text-stone-400 mt-1">分擔: {{ expense.split_with.join(', ') }}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-lg font-bold text-[#BC4749]">{{ getCurrencySymbol(expense.currency) }} {{ expense.amount_original }}</p>
                <p class="text-xs text-stone-400 font-mono">NT${{ calculateAmountTWD(expense) }}</p>
            </div>
        </div>
    </div>

    <!-- 清算結算 -->
    <div v-if="expenses.length > 0 && settlementCalculation.settlement && Object.keys(settlementCalculation.settlement).length > 0" class="mt-8 space-y-4">
        <!-- 付款統計 -->
        <div class="bg-gradient-to-br from-[#FEF6E4] to-[#F5F5F4] rounded-xl border border-[#D4A373]/30 p-5">
            <h3 class="font-bold text-[#6F4E37] mb-4 flex items-center gap-2">📊 付款統計</h3>
            <div class="space-y-2">
                <div v-for="(amount, person) in settlementCalculation.settlement" :key="person" class="bg-white rounded-lg p-3 border border-stone-100 flex justify-between items-center shadow-sm">
                    <p class="font-bold text-stone-800">{{ person }}</p>
                    <div class="text-right">
                        <p class="text-[10px] text-stone-400 mb-0.5">已付 NT${{ Math.round(amount.paid) }} / 應付 NT${{ Math.round(amount.should_pay) }}</p>
                        <p class="font-bold text-lg" :class="(amount.paid - amount.should_pay) > 0 ? 'text-green-600' : ((amount.paid - amount.should_pay) < 0 ? 'text-red-500' : 'text-stone-400')">
                            {{ (amount.paid - amount.should_pay) > 0 ? '+' : '' }}{{ Math.round(amount.paid - amount.should_pay) }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 誰欠誰錢 (結算指示) -->
        <div v-if="settlementCalculation.transactions && settlementCalculation.transactions.length > 0" class="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <h3 class="font-bold text-[#283618] mb-4 flex items-center gap-2">💸 結算清單</h3>
            <div class="space-y-3">
                <div v-for="(tx, index) in settlementCalculation.transactions" :key="index" class="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100">
                    <div class="flex items-center gap-3">
                        <div class="px-3 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm truncate max-w-[100px]">{{ tx.from }}</div>
                        <span class="text-stone-400 text-xs shrink-0">應付</span>
                        <div class="px-3 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm truncate max-w-[100px]">{{ tx.to }}</div>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="font-black text-[#BC4749]">NT$ {{ tx.amount.toLocaleString() }}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div v-else-if="expenses.length > 0" class="bg-green-50 text-green-700 rounded-xl border border-green-200 p-4 text-center font-bold text-sm flex items-center justify-center gap-2">
            <span>🎉</span> 大家都互不相欠，帳目已結清！
        </div>
    </div>

    <button v-if="props.isEditMode" @click="openExpenseForm()" class="fixed bottom-8 right-6 w-14 h-14 bg-[#BC4749] text-white rounded-full shadow-xl shadow-[#BC4749]/30 flex items-center justify-center text-3xl pb-1 z-30 transition hover:scale-110 active:scale-95">+</button>

    <!-- 記帳表單 -->
    <div v-if="showExpenseForm" class="fixed inset-0 bg-[#283618]/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" @click.self="showExpenseForm = false">
        <div class="bg-[#FDFCF8] w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-5 bg-[#FDFCF8] z-10 py-2 border-b border-stone-200"><h3 class="text-lg font-black text-[#283618]">{{ isEditingExpense ? '編輯記帳' : '新增記帳' }}</h3><button @click="showExpenseForm = false" class="text-stone-400 text-2xl">×</button></div>
            <div class="space-y-4">
                <div>
                    <label class="text-xs text-stone-500 font-bold mb-1 block">項目名稱</label>
                    <input v-model="expenseForm.title" placeholder="例如: 築地早餐" class="w-full border border-stone-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#606C38]" />
                </div>
                <div>
                    <label class="text-xs text-stone-500 font-bold mb-1 block">原始金額</label>
                    <div class="flex gap-2">
                        <input type="number" v-model.number="expenseForm.amount_original" placeholder="金額" class="flex-1 border border-stone-300 bg-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#606C38]" />
                        <select v-model="expenseForm.currency" class="w-20 border border-stone-300 bg-white rounded-lg px-2 py-2 focus:outline-none focus:border-[#606C38]">
                            <option>JPY</option><option>USD</option><option>TWD</option>
                        </select>
                    </div>
                    <p class="text-xs text-stone-400 mt-1" v-if="expenseForm.amount_original">估算 TWD {{ calculateAmountTWD({ amount_original: expenseForm.amount_original, exchange_rate: expenseForm.exchange_rate }) }}</p>
                </div>
                <div>
                    <label class="text-xs text-stone-500 font-bold mb-1 block">匯率</label>
                    <input type="number" v-model.number="expenseForm.exchange_rate" step="0.001" placeholder="0.215" class="w-full border border-stone-300 bg-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#606C38]" />
                </div>
                <div>
                    <label class="text-xs text-stone-500 font-bold mb-2 block">分類</label>
                    <div class="grid grid-cols-4 gap-2">
                        <button v-for="cat in expenseCategories" :key="cat.name" @click="expenseForm.category = cat.name" class="p-2 rounded-lg border-2 transition-all text-center" :class="expenseForm.category === cat.name ? 'bg-[#E9EDC9] border-[#606C38]' : 'bg-stone-50 border-stone-200 hover:border-[#606C38]'">
                            <span class="text-xl block">{{ cat.icon }}</span>
                            <span class="text-[10px] font-bold text-stone-700">{{ cat.name }}</span>
                        </button>
                    </div>
                </div>
                <div>
                    <label class="text-xs text-stone-500 font-bold mb-2 block">支付方式</label>
                    <div class="flex gap-2">
                        <button v-for="method in paymentMethods" :key="method" @click="expenseForm.payment_method = method" class="flex-1 py-2 rounded-lg border-2 font-bold transition-all" :class="expenseForm.payment_method === method ? 'bg-[#283618] text-white border-[#283618]' : 'bg-white border-stone-300 text-stone-700 hover:border-[#606C38]'">
                            {{ method }}
                        </button>
                    </div>
                </div>
                <div>
                    <label class="text-xs text-stone-500 font-bold mb-1 block">消費日期</label>
                    <input v-model="expenseForm.expense_date" type="date" class="w-full appearance-none border border-stone-300 bg-white rounded-lg px-3 py-2 m-0 focus:outline-none focus:border-[#606C38] min-h-[42px]" />
                </div>
                <div>
                    <label class="text-xs text-stone-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 mb-2">誰付的？ *必填</label>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="member in props.tripMembers" :key="member" @click="expenseForm.paid_by = member" class="px-4 py-2 rounded-full text-sm font-bold transition-all border-2" :class="expenseForm.paid_by === member ? 'bg-[#283618] text-white border-[#283618] shadow-md' : 'bg-white text-stone-600 border-stone-200 hover:border-[#606C38]'">
                            {{ member }}
                        </button>
                    </div>
                </div>
                <div class="mt-2">
                    <div class="flex justify-between items-end mb-2">
                        <label class="text-xs text-stone-500 font-bold block">分擔的人</label>
                        <button @click="expenseForm.split_with = [...props.tripMembers]" class="text-[10px] text-[#606C38] font-bold bg-[#E9EDC9] px-2 py-1 rounded">全選</button>
                    </div>
                    
                    <div class="flex gap-2 mb-3 bg-stone-100 p-1 rounded-lg">
                        <button @click="expenseForm.split_rule = 'EQUAL'" class="flex-1 py-1 text-xs font-bold rounded-md transition-all" :class="expenseForm.split_rule === 'EQUAL' ? 'bg-white shadow text-[#283618]' : 'text-stone-500'"> 平分</button>
                        <button @click="expenseForm.split_rule = 'EXACT'" class="flex-1 py-1 text-xs font-bold rounded-md transition-all" :class="expenseForm.split_rule === 'EXACT' ? 'bg-white shadow text-[#283618]' : 'text-stone-500'"> 具體金額</button>
                        <button @click="expenseForm.split_rule = 'PERCENT'" class="flex-1 py-1 text-xs font-bold rounded-md transition-all" :class="expenseForm.split_rule === 'PERCENT' ? 'bg-white shadow text-[#283618]' : 'text-stone-500'"> 百分比</button>
                    </div>

                    <div class="space-y-2">
                        <div v-for="member in props.tripMembers" :key="member" 
                               class="flex items-center justify-between p-2 rounded-lg border transition-all"
                               :class="expenseForm.split_with.includes(member) ? 'bg-[#FDFCF8] border-[#606C38] shadow-sm' : 'bg-stone-50 border-stone-200 opacity-70'">
                            <label class="flex items-center gap-2 cursor-pointer select-none flex-1">
                                <input type="checkbox" :value="member" v-model="expenseForm.split_with" class="w-4 h-4 accent-[#606C38]">
                                <span class="text-stone-700 font-medium text-xs" :class="{'text-[#283618] font-bold': expenseForm.split_with.includes(member)}">{{ member }}</span>
                            </label>
                            
                            <div v-if="expenseForm.split_with.includes(member) && expenseForm.split_rule !== 'EQUAL'" class="w-24">
                                <div class="relative flex items-center">
                                    <input type="number" v-model.number="expenseForm.split_details[member]" placeholder="0" class="w-full text-right text-xs border border-stone-300 rounded px-2 py-1 pr-6 focus:outline-none focus:border-[#606C38]">
                                    <span class="absolute right-2 text-[10px] text-stone-400 font-bold">{{ expenseForm.split_rule === 'PERCENT' ? '%' : expenseForm.currency }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div v-if="expenseForm.split_rule === 'EXACT'" class="mt-2 text-xs text-right font-bold" :class="expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) === expenseForm.amount_original ? 'text-green-600' : 'text-red-500'">
                        目前加總: {{ expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) }} / {{ expenseForm.amount_original }}
                    </div>
                    <div v-if="expenseForm.split_rule === 'PERCENT'" class="mt-2 text-xs text-right font-bold" :class="expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) === 100 ? 'text-green-600' : 'text-red-500'">
                        目前加總: {{ expenseForm.split_with.reduce((sum, p) => sum + (expenseForm.split_details[p] || 0), 0) }}% / 100%
                    </div>
                </div>
                <div>
                    <label class="text-xs text-stone-500 font-bold mb-1 block">備註 (可選)</label>
                    <textarea v-model="expenseForm.note" class="w-full border border-stone-300 bg-white rounded-lg px-3 py-2 h-12 resize-none text-sm focus:outline-none focus:border-[#606C38]"></textarea>
                </div>
                <div class="flex gap-3 mt-6 pt-2 border-t border-stone-100">
                    <button v-if="isEditingExpense" @click="handleDeleteExpense" class="bg-red-50 text-[#BC4749] px-4 py-3 rounded-xl font-bold text-sm">刪除</button>
                    <button @click="handleSaveExpense" class="flex-1 bg-[#283618] text-white py-3 rounded-xl font-bold hover:bg-[#3A5A40]">儲存</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>
