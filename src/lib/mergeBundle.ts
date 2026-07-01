import type { AmountRow, FinancialBundle, FinancialKpis } from '../types/financials'

export function parsePeriodKey(period: string): { year: number; month: number } {
  const m = period.match(/^(\d{4})\/(\d{1,2})期$/)
  if (!m) {
    console.warn('期表記パース失敗(ソート最古に配置): ' + period)
    return { year: 0, month: 0 }
  }
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) }
}

export function sortPeriods(periods: readonly string[]): string[] {
  return [...periods].sort((a, b) => {
    const ka = parsePeriodKey(a)
    const kb = parsePeriodKey(b)
    return ka.year !== kb.year ? ka.year - kb.year : ka.month - kb.month
  })
}

export function countNewPeriods(existing: FinancialBundle, incoming: FinancialBundle): number {
  const existingSet = new Set(existing.periods)
  return incoming.periods.filter((p) => !existingSet.has(p)).length
}

function mergeSection(
  existingRows: readonly AmountRow[],
  incomingRows: readonly AmountRow[],
  mergedPeriods: readonly string[],
  existingPeriods: readonly string[],
  incomingPeriods: readonly string[],
): AmountRow[] {
  const existingLabelSet = new Set(existingRows.map((r) => r.label))
  const allLabels = [
    ...existingRows.map((r) => r.label),
    ...incomingRows.map((r) => r.label).filter((l) => !existingLabelSet.has(l)),
  ]

  const buildMap = (rows: readonly AmountRow[], periods: readonly string[]) => {
    const map = new Map<string, Map<string, number>>()
    for (const row of rows) {
      const cellMap = new Map<string, number>()
      for (let i = 0; i < periods.length; i++) {
        cellMap.set(periods[i], row.values[i] ?? 0)
      }
      map.set(row.label, cellMap)
    }
    return map
  }

  const existingMap = buildMap(existingRows, existingPeriods)
  const incomingMap = buildMap(incomingRows, incomingPeriods)
  const existingAttr = new Map(existingRows.map((r) => [r.label, { emphasis: r.emphasis, indent: r.indent }]))
  const incomingAttr = new Map(incomingRows.map((r) => [r.label, { emphasis: r.emphasis, indent: r.indent }]))

  return allLabels.map((label) => {
    const values: number[] = mergedPeriods.map((period) => {
      const inc = incomingMap.get(label)?.get(period)
      if (inc !== undefined) return inc
      const ex = existingMap.get(label)?.get(period)
      if (ex !== undefined) return ex
      return 0
    })
    const attr = existingAttr.get(label) ?? incomingAttr.get(label) ?? {}
    return { label, values, ...attr }
  })
}

const DUMMY_KPIS: FinancialKpis = {
  revenueGrowthYoY: 0,
  operatingMarginPct: 0,
  equityRatioPct: 0,
  freeCashFlow: 0,
}

export function mergeBundle(existing: FinancialBundle, incoming: FinancialBundle): FinancialBundle {
  const existingPeriods = existing.periods
  const incomingPeriods = incoming.periods
  const existingSet = new Set(existingPeriods)
  const mergedPeriods = sortPeriods([
    ...existingPeriods,
    ...incomingPeriods.filter((p) => !existingSet.has(p)),
  ])

  return {
    periods: mergedPeriods,
    balanceSheet: {
      assets: mergeSection(
        existing.balanceSheet.assets,
        incoming.balanceSheet.assets,
        mergedPeriods,
        existingPeriods,
        incomingPeriods,
      ),
      liabilitiesAndEquity: mergeSection(
        existing.balanceSheet.liabilitiesAndEquity,
        incoming.balanceSheet.liabilitiesAndEquity,
        mergedPeriods,
        existingPeriods,
        incomingPeriods,
      ),
    },
    profitLoss: mergeSection(
      existing.profitLoss,
      incoming.profitLoss,
      mergedPeriods,
      existingPeriods,
      incomingPeriods,
    ),
    cashFlow: mergeSection(
      existing.cashFlow,
      incoming.cashFlow,
      mergedPeriods,
      existingPeriods,
      incomingPeriods,
    ),
    kpis: DUMMY_KPIS,
    monthly: existing.monthly,
  }
}

export function deletePeriod(bundle: FinancialBundle, period: string): FinancialBundle {
  const idx = bundle.periods.indexOf(period)
  if (idx === -1) return bundle

  const removeCol = (rows: readonly AmountRow[]): AmountRow[] =>
    rows.map((row) => ({
      ...row,
      values: row.values.filter((_, i) => i !== idx),
    }))

  return {
    ...bundle,
    periods: bundle.periods.filter((_, i) => i !== idx),
    balanceSheet: {
      assets: removeCol(bundle.balanceSheet.assets),
      liabilitiesAndEquity: removeCol(bundle.balanceSheet.liabilitiesAndEquity),
    },
    profitLoss: removeCol(bundle.profitLoss),
    cashFlow: removeCol(bundle.cashFlow),
  }
}
