/** 単位は JSON 側の運用（百万円推奨）で揃える */

export type AmountRow = {
  label: string
  values: readonly number[]
  emphasis?: boolean
  indent?: boolean
}

export type FinancialKpis = {
  revenueGrowthYoY: number
  operatingMarginPct: number
  equityRatioPct: number
  freeCashFlow: number
}

export type MonthlyBundle = {
  periods: readonly string[]
  balanceSheet: {
    assets: readonly AmountRow[]
    liabilitiesAndEquity: readonly AmountRow[]
  }
  profitLoss: readonly AmountRow[]
  cashFlow: readonly AmountRow[]
}

export type FinancialBundle = {
  periods: readonly string[]
  balanceSheet: {
    assets: readonly AmountRow[]
    liabilitiesAndEquity: readonly AmountRow[]
  }
  profitLoss: readonly AmountRow[]
  cashFlow: readonly AmountRow[]
  kpis: FinancialKpis
  monthly?: MonthlyBundle
}
