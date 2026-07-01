import type { FinancialBundle } from '../types/financials'
import type { SliderParams } from '../data/memorialFinancials'

// ===== bundle から導出する計算ベース（単位: 百万円）=====
export type ForecastBase = {
  revenue: number           // 百万円
  costRate: number          // ratio
  laborCost: number         // 百万円（SGA の推定固定費部分）
  otherExpenseRate: number  // ratio（SGA の変動費部分 / revenue）
  interestExpense: number   // 百万円
  cash: number              // 百万円（期末現金残高）
  depreciation: number      // 百万円
  annualRepayment: number   // 百万円（借入年間返済額）
  startYear: number         // 予測の起点年（最新実績期）
}

function findLast(
  rows: readonly { label: string; values: readonly number[] }[],
  label: string,
): number {
  const row = rows.find((r) => r.label === label)
  return row ? (row.values[row.values.length - 1] ?? 0) : 0
}

export function buildForecastBase(bundle: FinancialBundle): ForecastBase {
  const { profitLoss, cashFlow, balanceSheet } = bundle

  const revenue         = findLast(profitLoss, '売上高')
  const cogs            = findLast(profitLoss, '売上原価')
  const sga             = findLast(profitLoss, '販売費及び一般管理費')
  const interestExpense = findLast(profitLoss, '営業外費用')
  const depreciation    = findLast(cashFlow,   '減価償却費')
  const cash =
    findLast(cashFlow, '期末残高') ||
    findLast(balanceSheet.assets, '現金及び預金')

  // 借入年間返済額: 複数ラベル検索 → なければ財務CF絶対値
  let annualRepayment = 0
  for (const lbl of ['借入金の返済（純額）', '借入金の返済', '長期借入金の返済']) {
    const v = findLast(cashFlow, lbl)
    if (v !== 0) { annualRepayment = Math.abs(v); break }
  }
  if (annualRepayment === 0) {
    const finCF = findLast(cashFlow, '財務活動によるキャッシュ・フロー')
    annualRepayment = finCF < 0 ? Math.abs(finCF) : 0
  }

  const costRate = revenue > 0 ? cogs / revenue : 0.3
  // SGA を固定費(labor: 35%)・変動費(other: 65%)に分割（業界推定）
  const laborCost        = sga * 0.35
  const otherExpenseRate = revenue > 0 ? (sga * 0.65) / revenue : 0.65

  // 最終期の年度を抽出（"2025/9期" → 2025）
  const lastPeriod = bundle.periods[bundle.periods.length - 1] ?? ''
  const yearMatch  = lastPeriod.match(/(\d{4})/)
  const startYear  = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  return {
    revenue,
    costRate,
    laborCost,
    otherExpenseRate,
    interestExpense,
    cash,
    depreciation,
    annualRepayment,
    startYear,
  }
}

export function buildDefaultSliderParams(base: ForecastBase): SliderParams {
  return {
    revenueGrowth:    0.02,
    costRate:         base.costRate,
    laborGrowth:      0.01,
    debtRepayment:    base.annualRepayment,
    otherExpenseRate: base.otherExpenseRate,
  }
}

export function buildOptimizedParams(base: ForecastBase): SliderParams {
  return {
    revenueGrowth:    0.035,
    costRate:         Math.max(0.25, base.costRate - 0.02),
    laborGrowth:      0.005,
    debtRepayment:    base.annualRepayment * 0.85,
    otherExpenseRate: Math.max(0.05, base.otherExpenseRate - 0.03),
  }
}

// ===== 予測計算（単位: 百万円）=====
export type ForecastYearResult = {
  period: string
  yearIndex: number
  revenue: number
  grossProfit: number
  operatingProfit: number
  ordinaryProfit: number
  netProfit: number
  cashFlow: number
  cashBalance: number
  // チャート用（百万円・旧名を維持して後方互換）
  revenueMan: number
  opProfitMan: number
  ordinaryProfitMan: number
}

export function calcForecastYear(
  yearIndex: number,
  params: SliderParams,
  base: ForecastBase,
  priorCash: number,
): ForecastYearResult {
  const revenue       = base.revenue * (1 + params.revenueGrowth) ** yearIndex
  const costOfSales   = revenue * params.costRate
  const grossProfit   = revenue - costOfSales
  const laborCost     = base.laborCost * (1 + params.laborGrowth) ** yearIndex
  const otherExpenses = revenue * params.otherExpenseRate
  const sga           = laborCost + otherExpenses
  const operatingProfit  = grossProfit - sga
  const ordinaryProfit   = operatingProfit - base.interestExpense
  const netProfit        = ordinaryProfit > 0 ? ordinaryProfit * 0.7 : 0
  const cashFlow         = netProfit + base.depreciation - params.debtRepayment
  const cashBalance      = priorCash + cashFlow

  return {
    period:           `FY${base.startYear + yearIndex}(予)`,
    yearIndex,
    revenue,
    grossProfit,
    operatingProfit,
    ordinaryProfit,
    netProfit,
    cashFlow,
    cashBalance,
    revenueMan:        Math.round(revenue),
    opProfitMan:       Math.round(operatingProfit),
    ordinaryProfitMan: Math.round(ordinaryProfit),
  }
}

export function calcForecastHorizon(
  params: SliderParams,
  base: ForecastBase,
  years = 3,
): ForecastYearResult[] {
  const results: ForecastYearResult[] = []
  let cash = base.cash
  for (let i = 1; i <= years; i++) {
    const row = calcForecastYear(i, params, base, cash)
    cash = row.cashBalance
    results.push(row)
  }
  return results
}

// 黒字転換期を period 文字列で返す
export function findBreakEvenYear(forecasts: ForecastYearResult[]): string | null {
  return forecasts.find((f) => f.operatingProfit > 0)?.period ?? null
}

export type ChartRow = {
  period: string
  revenue: number
  opProfit: number
  ordinaryProfit: number
  type: 'actual' | 'forecast'
}

// bundle から実績チャートデータを生成（単位: 百万円）
export function buildActualChartData(bundle: FinancialBundle): ChartRow[] {
  const revenues    = bundle.profitLoss.find((r) => r.label === '売上高')?.values      ?? []
  const opProfits   = bundle.profitLoss.find((r) => r.label === '営業利益')?.values     ?? []
  const ordProfits  = bundle.profitLoss.find((r) => r.label === '経常利益')?.values     ?? []

  return bundle.periods.map((p, i) => {
    const m = p.match(/(\d{4})/)
    return {
      period:          m ? `FY${m[1]}` : p,
      revenue:         revenues[i]   ?? 0,
      opProfit:        opProfits[i]  ?? 0,
      ordinaryProfit:  ordProfits[i] ?? 0,
      type:            'actual' as const,
    }
  })
}

export function buildForecastChartData(
  forecasts: ForecastYearResult[],
  actuals: ChartRow[],
): ChartRow[] {
  const forecastRows: ChartRow[] = forecasts.map((f) => ({
    period:         f.period,
    revenue:        f.revenueMan,
    opProfit:       f.opProfitMan,
    ordinaryProfit: f.ordinaryProfitMan,
    type:           'forecast',
  }))
  return [...actuals, ...forecastRows]
}

// 百万円の値を符号付き小数1桁でフォーマット
export function formatForecastSummary(millionYen: number): string {
  const sign = millionYen < 0 ? '▲' : ''
  return `${sign}${Math.abs(millionYen).toFixed(1)}`
}
