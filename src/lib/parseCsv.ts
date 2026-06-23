import type { AmountRow, MonthlyBundle } from '../types/financials'

export type CsvParseResult =
  | { ok: true; data: MonthlyBundle }
  | { ok: false; error: string }

// 列名エイリアス → 内部フィールド名
const ALIASES: Record<string, string> = {
  // 年月
  '年月': 'period', '月度': 'period', '期間': 'period', '月': 'period',
  // 売上高
  '売上高': 'revenue', '売上': 'revenue', '売上金額': 'revenue',
  // 売上原価
  '売上原価': 'cogs', '原価': 'cogs', '製造原価': 'cogs',
  // 販管費
  '販売費及び一般管理費': 'sga', '販管費': 'sga', '販売費・一般管理費': 'sga',
  '販売費および一般管理費': 'sga',
  // 営業利益
  '営業利益': 'opProfit',
  // 営業CF
  '営業CF': 'opCF', '営業活動によるキャッシュ・フロー': 'opCF',
  '営業キャッシュフロー': 'opCF', '営業活動CF': 'opCF',
  // 投資CF
  '投資CF': 'invCF', '投資活動によるキャッシュ・フロー': 'invCF',
  '投資キャッシュフロー': 'invCF', '投資活動CF': 'invCF',
  // 財務CF
  '財務CF': 'finCF', '財務活動によるキャッシュ・フロー': 'finCF',
  '財務キャッシュフロー': 'finCF', '財務活動CF': 'finCF',
}

type DataField = 'revenue' | 'cogs' | 'sga' | 'opProfit' | 'opCF' | 'invCF' | 'finCF'

type ParsedRow = { period: string } & Record<DataField, number>

// RFC 4180 準拠の1行パーサー
function parseLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else { inQ = !inQ }
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function toNum(cell: string): number {
  return parseFloat(cell.replace(/,/g, '').replace(/，/g, '')) || 0
}

function makeRow(label: string, values: readonly number[], opts: Partial<AmountRow> = {}): AmountRow {
  return { label, values, ...opts }
}

export function parseCsv(rawText: string): CsvParseResult {
  // BOM除去・改行正規化
  const text = rawText.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter(l => l.trim())

  if (lines.length < 2) {
    return { ok: false, error: '対応フォーマットではありません（ヘッダー＋データ行が必要です）' }
  }

  // ヘッダー行を解析してフィールドマップ構築
  const headerCells = parseLine(lines[0])
  const colMap: Record<number, string> = {}
  for (let i = 0; i < headerCells.length; i++) {
    const h = headerCells[i].trim()
    const field = ALIASES[h]
    if (field) colMap[i] = field
  }

  if (!Object.values(colMap).includes('period')) {
    return { ok: false, error: '対応フォーマットではありません（年月列が見つかりません）' }
  }
  if (!Object.values(colMap).includes('revenue')) {
    return { ok: false, error: '対応フォーマットではありません（売上高列が見つかりません）' }
  }

  // データ行をパース
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    if (cells.every(c => !c)) continue

    const row: ParsedRow = {
      period: '', revenue: 0, cogs: 0, sga: 0, opProfit: 0, opCF: 0, invCF: 0, finCF: 0,
    }
    for (const [idxStr, field] of Object.entries(colMap)) {
      const cell = cells[Number(idxStr)]?.trim() ?? ''
      if (field === 'period') row.period = cell
      else (row as Record<string, number>)[field] = toNum(cell)
    }
    if (row.period) rows.push(row)
  }

  if (rows.length === 0) {
    return { ok: false, error: '対応フォーマットではありません（データ行が見つかりません）' }
  }

  // 各系列を配列化
  const periods = rows.map(r => r.period)
  const f = (key: DataField): readonly number[] => rows.map(r => r[key])

  const revenues   = f('revenue')
  const cogs       = f('cogs')
  const sgas       = f('sga')
  const opCFs      = f('opCF')
  const invCFs     = f('invCF')
  const finCFs     = f('finCF')

  const hasCogs     = cogs.some(v => v !== 0)
  const hasSga      = sgas.some(v => v !== 0)
  const hasOpProfit = f('opProfit').some(v => v !== 0)
  const hasOpCF     = opCFs.some(v => v !== 0)
  const hasInvCF    = invCFs.some(v => v !== 0)
  const hasFinCF    = finCFs.some(v => v !== 0)

  const grossProfits = revenues.map((r, i) => r - (cogs[i] ?? 0))
  const opProfits: readonly number[] = hasOpProfit
    ? f('opProfit')
    : hasCogs && hasSga
      ? grossProfits.map((g, i) => g - (sgas[i] ?? 0))
      : grossProfits

  // PL行を構築
  const plRows: AmountRow[] = [
    makeRow('売上高', revenues, { emphasis: true }),
  ]
  if (hasCogs) {
    plRows.push(makeRow('売上原価', cogs, { indent: true }))
    plRows.push(makeRow('売上総利益', grossProfits, { emphasis: true }))
  }
  if (hasSga) {
    plRows.push(makeRow('販売費及び一般管理費', sgas, { indent: true }))
  }
  plRows.push(makeRow('営業利益', opProfits, { emphasis: true }))

  // CF行を構築（CF列が1つでもあれば出力）
  const cfRows: AmountRow[] = []
  if (hasOpCF)  cfRows.push(makeRow('営業活動によるキャッシュ・フロー', opCFs,  { emphasis: true }))
  if (hasInvCF) cfRows.push(makeRow('投資活動によるキャッシュ・フロー', invCFs, { emphasis: true }))
  if (hasFinCF) cfRows.push(makeRow('財務活動によるキャッシュ・フロー', finCFs, { emphasis: true }))

  const data: MonthlyBundle = {
    periods,
    balanceSheet: { assets: [], liabilitiesAndEquity: [] },
    profitLoss: plRows,
    cashFlow: cfRows,
  }

  return { ok: true, data }
}

// サンプルCSVテンプレート（UTF-8 BOMなし）
export const SAMPLE_CSV =
`年月,売上高,売上原価,販管費,営業利益,営業CF,投資CF,財務CF
2024/10,2003,587,1388,28,94,-5,-294
2024/11,1905,617,1360,-72,89,-5,-279
2024/12,2043,575,1401,67,96,-5,-300
2025/01,1886,629,1374,-117,88,-5,-277
2025/02,2023,581,1347,95,95,-5,-297
2025/03,1925,611,1415,-101,90,-5,-282
2025/04,2062,569,1333,160,97,-5,-302
2025/05,1866,623,1401,-158,87,-5,-274
2025/06,1984,599,1360,25,93,-6,-291
2025/07,1944,587,1388,-31,91,-5,-285
2025/08,2023,617,1374,32,95,-5,-297
2025/09,1905,593,1347,-35,89,-6,-279
`
