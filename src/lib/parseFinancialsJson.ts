import type { AmountRow, FinancialBundle, FinancialKpis, MonthlyBundle } from '../types/financials'

function isNumberArray(a: unknown): a is number[] {
  return Array.isArray(a) && a.every((x) => typeof x === 'number' && Number.isFinite(x))
}

function isAmountRow(o: unknown, periodCount: number): o is AmountRow {
  if (!o || typeof o !== 'object') return false
  const r = o as Record<string, unknown>
  if (typeof r.label !== 'string' || r.label.length === 0) return false
  if (!isNumberArray(r.values) || r.values.length !== periodCount) return false
  if (r.emphasis !== undefined && typeof r.emphasis !== 'boolean') return false
  if (r.indent !== undefined && typeof r.indent !== 'boolean') return false
  return true
}

function isKpis(o: unknown): o is FinancialKpis {
  if (!o || typeof o !== 'object') return false
  const k = o as Record<string, unknown>
  const keys = ['revenueGrowthYoY', 'operatingMarginPct', 'equityRatioPct', 'freeCashFlow'] as const
  for (const key of keys) {
    const v = k[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) return false
  }
  return true
}

export type ParseResult =
  | { ok: true; data: FinancialBundle }
  | { ok: false; errors: string[] }

export function parseFinancialsJson(raw: unknown): ParseResult {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['ルートがオブジェクトではありません'] }
  }
  const root = raw as Record<string, unknown>

  if (!Array.isArray(root.periods) || root.periods.length === 0) {
    errors.push('periods は空でない文字列の配列にしてください')
    return { ok: false, errors }
  }
  if (!root.periods.every((p) => typeof p === 'string' && p.length > 0)) {
    errors.push('periods の各要素は空でない文字列にしてください')
    return { ok: false, errors }
  }
  const periods = root.periods as string[]
  const n = periods.length

  const bs = root.balanceSheet
  if (!bs || typeof bs !== 'object') {
    errors.push('balanceSheet オブジェクトが必要です')
    return { ok: false, errors }
  }
  const bso = bs as Record<string, unknown>
  if (!Array.isArray(bso.assets)) {
    errors.push('balanceSheet.assets は配列にしてください')
    return { ok: false, errors }
  }
  if (!Array.isArray(bso.liabilitiesAndEquity)) {
    errors.push('balanceSheet.liabilitiesAndEquity は配列にしてください')
    return { ok: false, errors }
  }

  const assets = bso.assets
  const le = bso.liabilitiesAndEquity
  for (let i = 0; i < assets.length; i++) {
    if (!isAmountRow(assets[i], n)) {
      errors.push(`balanceSheet.assets[${i}] が不正です（label・values・期数の一致を確認）`)
      return { ok: false, errors }
    }
  }
  for (let i = 0; i < le.length; i++) {
    if (!isAmountRow(le[i], n)) {
      errors.push(`balanceSheet.liabilitiesAndEquity[${i}] が不正です`)
      return { ok: false, errors }
    }
  }

  if (!Array.isArray(root.profitLoss)) {
    errors.push('profitLoss は配列にしてください')
    return { ok: false, errors }
  }
  const pl = root.profitLoss
  for (let i = 0; i < pl.length; i++) {
    if (!isAmountRow(pl[i], n)) {
      errors.push(`profitLoss[${i}] が不正です`)
      return { ok: false, errors }
    }
  }

  if (!Array.isArray(root.cashFlow)) {
    errors.push('cashFlow は配列にしてください')
    return { ok: false, errors }
  }
  const cf = root.cashFlow
  for (let i = 0; i < cf.length; i++) {
    if (!isAmountRow(cf[i], n)) {
      errors.push(`cashFlow[${i}] が不正です`)
      return { ok: false, errors }
    }
  }

  if (!isKpis(root.kpis)) {
    errors.push(
      'kpis に revenueGrowthYoY, operatingMarginPct, equityRatioPct, freeCashFlow（数値）が必要です',
    )
    return { ok: false, errors }
  }

  const data: FinancialBundle = {
    periods,
    balanceSheet: {
      assets: assets as AmountRow[],
      liabilitiesAndEquity: le as AmountRow[],
    },
    profitLoss: pl as AmountRow[],
    cashFlow: cf as AmountRow[],
    kpis: root.kpis,
    monthly: parseMonthlyBundle(root.monthly),
  }

  return { ok: true, data }
}

function parseMonthlyBundle(raw: unknown): MonthlyBundle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const root = raw as Record<string, unknown>

  if (!Array.isArray(root.periods) || root.periods.length === 0) return undefined
  if (!root.periods.every((p) => typeof p === 'string' && p.length > 0)) return undefined
  const periods = root.periods as string[]
  const n = periods.length

  const bs = root.balanceSheet
  if (!bs || typeof bs !== 'object') return undefined
  const bso = bs as Record<string, unknown>
  if (!Array.isArray(bso.assets) || !Array.isArray(bso.liabilitiesAndEquity)) return undefined
  if (!bso.assets.every((r) => isAmountRow(r, n))) return undefined
  if (!bso.liabilitiesAndEquity.every((r) => isAmountRow(r, n))) return undefined

  if (!Array.isArray(root.profitLoss) || !root.profitLoss.every((r) => isAmountRow(r, n))) return undefined
  if (!Array.isArray(root.cashFlow) || !root.cashFlow.every((r) => isAmountRow(r, n))) return undefined

  return {
    periods,
    balanceSheet: {
      assets: bso.assets as AmountRow[],
      liabilitiesAndEquity: bso.liabilitiesAndEquity as AmountRow[],
    },
    profitLoss: root.profitLoss as AmountRow[],
    cashFlow: root.cashFlow as AmountRow[],
  }
}
