/** 株式会社メモリアルサービス向け実数・分析データ
 *  ロールバック用にコメントアウトして残す。
 *  動的生成への切り替えは forecastCalc.ts / ForecastTab / StrategyTab を参照。
 */

// ===== 型定義（他ファイルが参照するため維持）=====

export type SliderParams = {
  revenueGrowth: number
  costRate: number
  laborGrowth: number
  debtRepayment: number   // 百万円（旧: 円）
  otherExpenseRate: number
}

export type ImprovementItem = {
  id: string
  title: string
  score: number
  urgency: '高' | '中' | '低'
  detail: string
  action: string
  annualEffect: number   // 百万円
}

// ===== ユーティリティ（参照用に維持）=====
/** グラフ用：万円 */
export function yenToMan(yen: number): number {
  return Math.round(yen / 10_000)
}
/** 表示用：百万円 */
export function yenToMillion(yen: number): number {
  return yen / 1_000_000
}

// ===== メモリアル固有定数（ロールバック用・コメントアウト）=====

/*
export const MEMORIAL_BASE = {
  revenue: 235_680_860,
  costRate: 0.305,
  laborCost: 48_795_056,
  otherExpenseRate: 0.699,
  debtRepayment: 345_200_000,
  interestExpense: 7_022_036,
  cash: 34_897_055,
  depreciation: 7_783_000,
} as const

export const DEFAULT_SLIDER_PARAMS = {
  revenueGrowth: 0.02,
  costRate: 0.305,
  laborGrowth: 0.03,
  debtRepayment: 345_200_000,
  otherExpenseRate: 0.699,
} as const

export const MEMORIAL_ACTUAL_CHART = [
  { period: 'FY2023', revenue: 23_070, opProfit: 1_426, ordinaryProfit: 1_350, type: 'actual' as const },
  { period: 'FY2024', revenue: 24_461, opProfit: 805,   ordinaryProfit: 750,   type: 'actual' as const },
  { period: 'FY2025', revenue: 23_568, opProfit: -198,  ordinaryProfit: -270,  type: 'actual' as const },
]

export const FORECAST_PERIOD_LABELS = ['FY2026(予)', 'FY2027(予)', 'FY2028(予)'] as const

export const MEMORIAL_IMPROVEMENTS: readonly ImprovementItem[] = [
  { id: 'debt',    title: '借入負担の軽減',       score: 92, urgency: '高', detail: '長期借入金 3.94億円、純資産 ▲1.38億円（債務超過）',         action: '遊休資産（さぬき長尾店舗）の売却または賃貸転用、借入条件の見直し交渉', annualEffect: 700 },
  { id: 'labor',   title: '人件費の最適化',       score: 78, urgency: '高', detail: '人件費比率 20.7%（売上比）、業界標準 15%との乖離',           action: 'パートシフト最適化、季節変動に合わせた人員配置',                      annualEffect: 120 },
  { id: 'revenue', title: '売上・単価の回復',     score: 71, urgency: '中', detail: '売上高 3期ピークアウト傾向、競合ドミナント戦略の影響',         action: '相続相談室の開設（新収益源）、事前相談・LINE囲い込みによるシェア防衛', annualEffect: 200 },
  { id: 'cogs',    title: '原価率の改善',         score: 58, urgency: '中', detail: '売上原価率 30.5%、業界平均 28%との比較',                     action: '外注費・仕入れの見直し、自社施行比率の向上',                          annualEffect:  80 },
  { id: 'cash',    title: 'キャッシュポジション強化', score: 45, urgency: '低', detail: '現金残高 3.49億（FY2023比 ▲50%）',                      action: '売掛金回収サイクル短縮、遊休資産の現金化',                            annualEffect:  50 },
]

export const MEMORIAL_RADAR_DATA = [
  { subject: '収益性', actual: 15, benchmark: 60 },
  { subject: '安全性', actual:  5, benchmark: 60 },
  { subject: '成長性', actual: 25, benchmark: 55 },
  { subject: '効率性', actual: 40, benchmark: 60 },
  { subject: '流動性', actual: 35, benchmark: 60 },
]

export const STRATEGY_OPTIMIZED_PARAMS: SliderParams = {
  revenueGrowth: 0.035,
  costRate: 0.28,
  laborGrowth: 0.01,
  debtRepayment: 280_000_000,
  otherExpenseRate: 0.65,
}
*/
