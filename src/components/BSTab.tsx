import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMillionYen } from '../lib/format'
import type { AmountRow, FinancialBundle } from '../types/financials'
import { BSDonutChart } from './TrendCharts'

// ─── Types ───────────────────────────────────────────────
export type BsMode = 'scope' | 'cockpit'
type ViewMode    = 'single' | 'compare'
type CompareRange = 'all' | 'recent5' | number  // number = period index

// ─── Constants ───────────────────────────────────────────
const SEG: { key: string; color: string; stack: string; radius?: [number,number,number,number] }[] = [
  { key: '固定資産', color: '#00b4b4', stack: 'assets' },
  { key: '流動資産', color: '#4fd1d1', stack: 'assets', radius: [4,4,0,0] },
  { key: '固定負債', color: '#a78bfa', stack: 'le' },
  { key: '流動負債', color: '#e8534a', stack: 'le' },
  { key: '純資産',   color: '#10b981', stack: 'le',     radius: [4,4,0,0] },
]
const SEG_COLOR: Record<string, string> = Object.fromEntries(SEG.map(s => [s.key, s.color]))

const AXIS_TICK   = { fill: 'var(--text)', fontSize: 11 } as const
const GRID_STROKE = 'rgba(255,255,255,0.06)'

// ─── Helpers ─────────────────────────────────────────────
type Rows = readonly AmountRow[]

function valAt(rows: Rows, label: string, i: number): number {
  return rows.find(r => r.label === label)?.values[i] ?? 0
}

function yoyAt(rows: Rows, label: string, i: number): number | null {
  const vals = rows.find(r => r.label === label)?.values
  if (!vals || i === 0) return null
  const cur = vals[i] ?? 0, prv = vals[i - 1] ?? 0
  return prv === 0 ? null : ((cur - prv) / Math.abs(prv)) * 100
}

// Maps each row label → its group-header label (first non-indent ancestor)
function makeGroupMap(rows: Rows): Map<string, string> {
  const m = new Map<string, string>()
  let g = ''
  for (const r of rows) {
    if (!r.indent) g = r.label
    m.set(r.label, g)
  }
  return m
}

// ─── PeriodNav ───────────────────────────────────────────
function PeriodNav({
  periods, idx, onPrev, onNext, onShowAll, canShowAll,
}: {
  periods: readonly string[]
  idx: number
  onPrev: () => void
  onNext: () => void
  onShowAll: () => void
  canShowAll: boolean
}) {
  return (
    <div className="bs-period-nav">
      <div className="bs-period-arrows">
        <button className="bs-arrow-btn" onClick={onPrev} disabled={idx <= 0} aria-label="前の期">
          ◀
        </button>
        <span className="bs-period-label">{periods[idx]}</span>
        <button
          className="bs-arrow-btn"
          onClick={onNext}
          disabled={idx >= periods.length - 1}
          aria-label="次の期"
        >
          ▶
        </button>
      </div>
      <button
        className="bs-show-all-btn"
        onClick={onShowAll}
        disabled={!canShowAll}
        title={!canShowAll ? 'このプランでは利用できません' : undefined}
      >
        全期間を見る
      </button>
    </div>
  )
}

// ─── CompareNav ──────────────────────────────────────────
function CompareNav({
  periods, range, onChange, onBack,
}: {
  periods: readonly string[]
  range: CompareRange
  onChange: (r: CompareRange) => void
  onBack: () => void
}) {
  return (
    <div className="bs-compare-nav">
      <div className="bs-compare-tabs">
        {periods.map((p, i) => (
          <button
            key={p}
            className={`bs-ctab ${range === i ? 'active' : ''}`}
            onClick={() => onChange(i)}
          >
            {p.replace('期', '')}
          </button>
        ))}
        <span className="bs-ctab-sep" aria-hidden />
        <button
          className={`bs-ctab bs-ctab-range ${range === 'recent5' ? 'active' : ''}`}
          onClick={() => onChange('recent5')}
        >
          直近5年
        </button>
        <button
          className={`bs-ctab bs-ctab-range ${range === 'all' ? 'active' : ''}`}
          onClick={() => onChange('all')}
        >
          全期間
        </button>
      </div>
      <button className="bs-back-btn" onClick={onBack}>
        ↑ 1期表示
      </button>
    </div>
  )
}

// ─── BSChart ─────────────────────────────────────────────
type ChartEntry = Record<string, string | number>

function BSChart({
  bundle,
  singleIdx,
  isCompare,
  compareRange,
  highlight,
  onHover,
  onPin,
}: {
  bundle: FinancialBundle
  singleIdx: number
  isCompare: boolean
  compareRange: CompareRange
  highlight: string | null
  onHover: (label: string | null) => void
  onPin: (label: string) => void
}) {
  const { periods, balanceSheet: { assets: a, liabilitiesAndEquity: le } } = bundle

  const isMulti = isCompare && typeof compareRange !== 'number'
  const displayIdx: number | null = isMulti
    ? null
    : typeof compareRange === 'number'
      ? compareRange
      : singleIdx

  const data: ChartEntry[] = useMemo(() => {
    if (displayIdx !== null) {
      return [{
        period: periods[displayIdx]?.replace('期', '') ?? '',
        固定資産: valAt(a, '固定資産', displayIdx),
        流動資産: valAt(a, '流動資産', displayIdx),
        固定負債: valAt(le, '固定負債', displayIdx),
        流動負債: valAt(le, '流動負債', displayIdx),
        純資産:   valAt(le, '純資産',   displayIdx),
      }]
    }
    const n = periods.length
    const start = compareRange === 'recent5' && n > 5 ? n - 5 : 0
    return periods.slice(start).map((p, i) => ({
      period: p.replace('期', ''),
      固定資産: valAt(a, '固定資産', i + start),
      流動資産: valAt(a, '流動資産', i + start),
      固定負債: valAt(le, '固定負債', i + start),
      流動負債: valAt(le, '流動負債', i + start),
      純資産:   valAt(le, '純資産',   i + start),
    }))
  }, [a, le, periods, displayIdx, compareRange])

  const op = (key: string) => (highlight && highlight !== key ? 0.25 : 1)

  const caption = displayIdx !== null
    ? `BS 対照（${periods[displayIdx]}）`
    : 'BS 資産・負債純資産の対照（百万円）'

  return (
    <figure
      className="chart-card bs-chart-card"
      onMouseLeave={() => onHover(null)}
    >
      <figcaption>{caption}</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            barCategoryGap="30%"
            barGap={3}
            barSize={data.length === 1 ? 80 : undefined}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="period" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={(v) => formatMillionYen(v as number)}
            />
            <Legend
              formatter={(v) => (
                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{v}</span>
              )}
            />
            {SEG.map(({ key, color, stack, radius }) => (
              <Bar
                key={key}
                dataKey={key}
                stackId={stack}
                fill={color}
                fillOpacity={op(key)}
                radius={radius}
                isAnimationActive={false}
                onMouseEnter={() => onHover(key)}
                onClick={() => onPin(key)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {highlight && (
        <p className="bs-chart-hint" style={{ borderTopColor: SEG_COLOR[highlight] }}>
          <span style={{ color: SEG_COLOR[highlight] }}>●</span>
          &nbsp;{highlight} をハイライト中&emsp;
          <span className="bs-hint-muted">
            （クリックで固定 / もう一度クリックで解除）
          </span>
        </p>
      )}
    </figure>
  )
}

// ─── BSExpandableSection ─────────────────────────────────
// One side of the paired BS table (assets OR liabilities).
// Non-indent rows are always shown; indent rows expand under their parent on click.
function BSExpandableSection({
  rows,
  singleIdx,
  periods,
  start,
  isMulti,
  highlight,
  caption,
}: {
  rows: Rows
  singleIdx: number
  periods: readonly string[]
  start: number
  isMulti: boolean
  highlight: string | null
  caption: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const gmap = useMemo(() => makeGroupMap(rows), [rows])

  // Which non-indent labels have at least one indent child?
  const expandable = useMemo((): Set<string> => {
    const s = new Set<string>()
    let cur = ''
    for (const r of rows) {
      if (!r.indent) { cur = r.label }
      else if (cur)  { s.add(cur) }
    }
    return s
  }, [rows])

  const toggle = (label: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })

  const slicedPeriods = periods.slice(start)

  return (
    <div className="bs-expandable-section">
      <p className="table-caption">{caption}</p>
      <table className="fin-table bs-paired-table">
        <thead>
          <tr>
            <th className="fin-th-label">科目</th>
            {isMulti
              ? slicedPeriods.map(p => <th key={p} className="fin-th-num">{p}</th>)
              : (
                <>
                  <th className="fin-th-num">金額（百万円）</th>
                  <th className="fin-th-num">前期比</th>
                </>
              )
            }
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            if (row.indent) {
              const parent = gmap.get(row.label) ?? ''
              if (!expanded.has(parent)) return null

              const isHl = !!highlight && parent === highlight
              const col  = SEG_COLOR[parent]
              const yoy  = !isMulti ? yoyAt(rows, row.label, singleIdx) : null
              return (
                <tr
                  key={row.label}
                  className={['fin-row-indent', isHl ? 'bs-row-hl' : ''].filter(Boolean).join(' ')}
                  style={isHl && col ? ({ '--hl-color': col } as React.CSSProperties) : undefined}
                >
                  <th scope="row" className="fin-label">
                    <span className="indent">{row.label}</span>
                  </th>
                  {isMulti
                    ? row.values.slice(start).map((v, i) => (
                        <td key={i} className="fin-num">{formatMillionYen(v)}</td>
                      ))
                    : (
                      <>
                        <td className="fin-num">{formatMillionYen(row.values[singleIdx] ?? 0)}</td>
                        <td className={`fin-num ${yoy === null ? 'bs-yoy-na' : yoy >= 0 ? 'bs-yoy-pos' : 'bs-yoy-neg'}`}>
                          {yoy === null ? '—' : `${yoy >= 0 ? '▲' : '▼'} ${Math.abs(yoy).toFixed(1)}%`}
                        </td>
                      </>
                    )
                  }
                </tr>
              )
            }

            // Non-indent row (section header or total)
            const isExp  = expanded.has(row.label)
            const canExp = expandable.has(row.label)
            const grp    = gmap.get(row.label) ?? row.label
            const isHl   = !!highlight && grp === highlight
            const col    = SEG_COLOR[grp]
            const yoy    = !isMulti ? yoyAt(rows, row.label, singleIdx) : null

            return (
              <tr
                key={row.label}
                className={[
                  row.emphasis ? 'fin-row-em' : '',
                  isHl ? 'bs-row-hl' : '',
                  canExp ? 'bs-expandable-row' : '',
                ].filter(Boolean).join(' ')}
                style={isHl && col ? ({ '--hl-color': col } as React.CSSProperties) : undefined}
                onClick={canExp ? () => toggle(row.label) : undefined}
              >
                <th scope="row" className="fin-label">
                  {canExp && (
                    <span className="bs-expand-icon" aria-hidden>
                      {isExp ? '▼' : '▶'}
                    </span>
                  )}
                  {row.label}
                </th>
                {isMulti
                  ? row.values.slice(start).map((v, i) => (
                      <td key={i} className="fin-num">{formatMillionYen(v)}</td>
                    ))
                  : (
                    <>
                      <td className="fin-num">{formatMillionYen(row.values[singleIdx] ?? 0)}</td>
                      <td className={`fin-num ${yoy === null ? 'bs-yoy-na' : yoy >= 0 ? 'bs-yoy-pos' : 'bs-yoy-neg'}`}>
                        {yoy === null ? '—' : `${yoy >= 0 ? '▲' : '▼'} ${Math.abs(yoy).toFixed(1)}%`}
                      </td>
                    </>
                  )
                }
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── BSPairedTable ───────────────────────────────────────
// Renders assets (left) and liabilities (right) side-by-side.
function BSPairedTable({
  bundle,
  singleIdx,
  isMulti,
  periods,
  start,
  highlight,
}: {
  bundle: FinancialBundle
  singleIdx: number
  isMulti: boolean
  periods: readonly string[]
  start: number
  highlight: string | null
}) {
  return (
    <div className="bs-paired-wrapper">
      <BSExpandableSection
        rows={bundle.balanceSheet.assets}
        singleIdx={singleIdx}
        periods={periods}
        start={start}
        isMulti={isMulti}
        highlight={highlight}
        caption="資産の部"
      />
      <div className="bs-paired-divider" aria-hidden />
      <BSExpandableSection
        rows={bundle.balanceSheet.liabilitiesAndEquity}
        singleIdx={singleIdx}
        periods={periods}
        start={start}
        isMulti={isMulti}
        highlight={highlight}
        caption="負債・純資産の部"
      />
    </div>
  )
}

// ─── BSMetricsCards ──────────────────────────────────────
type JudgeLevel = '◎' | '○' | '△' | '—'

function judgeColor(lv: JudgeLevel): string {
  return lv === '◎' ? '#059669' : lv === '○' ? '#d97706' : lv === '△' ? '#dc2626' : '#94a3b8'
}

function BSMetricsCards({ bundle }: { bundle: FinancialBundle }) {
  const { balanceSheet, periods } = bundle
  const li = periods.length - 1  // latest index

  const ca  = valAt(balanceSheet.assets,              '流動資産', li)
  const fa  = valAt(balanceSheet.assets,              '固定資産', li)
  const ta  = valAt(balanceSheet.assets,              '資産合計', li)
  const cl  = valAt(balanceSheet.liabilitiesAndEquity,'流動負債', li)
  const ncl = valAt(balanceSheet.liabilitiesAndEquity,'固定負債', li)
  const eq  = valAt(balanceSheet.liabilitiesAndEquity,'純資産',   li)

  const hasInventory = balanceSheet.assets.some(r => r.label === '棚卸資産')
  const inv = hasInventory ? valAt(balanceSheet.assets, '棚卸資産', li) : null

  // ── 自己資本比率 ──
  const erVal   = ta !== 0 ? (eq / ta) * 100 : 0
  const erLv: JudgeLevel = erVal >= 30 ? '◎' : erVal >= 15 ? '○' : '△'

  // ── 流動比率 ──
  const crVal   = cl !== 0 ? (ca / cl) * 100 : 0
  const crLv: JudgeLevel = crVal >= 150 ? '◎' : crVal >= 100 ? '○' : '△'

  // ── 当座比率 ──
  const qrVal   = inv !== null && cl !== 0 ? ((ca - inv) / cl) * 100 : null
  const qrLv: JudgeLevel = qrVal === null ? '—' : qrVal >= 100 ? '◎' : qrVal >= 70 ? '○' : '△'

  // ── 負債比率 ──
  const drNeg   = eq <= 0
  const drVal   = !drNeg ? ((ncl + cl) / eq) * 100 : null
  const drLv: JudgeLevel = drNeg ? '—' : drVal! < 100 ? '◎' : drVal! < 200 ? '○' : '△'

  // ── 固定比率 ──
  const frNeg   = eq <= 0
  const frVal   = !frNeg ? (fa / eq) * 100 : null
  const frLv: JudgeLevel = frNeg ? '—' : frVal! < 100 ? '◎' : frVal! < 200 ? '○' : '△'

  // ── 固定長期適合率 ──
  const flaDenom = eq + ncl
  const flaInvalid = flaDenom <= 0
  const flaVal   = !flaInvalid ? (fa / flaDenom) * 100 : null
  const flaLv: JudgeLevel = flaInvalid ? '—' : flaVal! < 100 ? '◎' : flaVal! < 120 ? '○' : '△'

  const cards = [
    {
      label: '自己資本比率',
      value: `${erVal.toFixed(1)}%`,
      unit: erLv,
      color: judgeColor(erLv),
      tooltip: '総資産に占める純資産の割合。財務的な安定性を示す基本指標。\n計算式：純資産 ÷ 総資産 × 100\n判断基準：30%以上◎ / 15-30%○ / 15%未満△',
    },
    {
      label: '流動比率',
      value: `${crVal.toFixed(0)}%`,
      unit: crLv,
      color: judgeColor(crLv),
      tooltip: '短期的な支払い能力を示す指標。\n計算式：流動資産 ÷ 流動負債 × 100\n判断基準：150%以上◎ / 100-150%○ / 100%未満△',
    },
    {
      label: '当座比率',
      value: qrVal !== null ? `${qrVal.toFixed(0)}%` : '算出不可',
      unit: qrLv === '—' ? '' : qrLv,
      color: judgeColor(qrLv),
      note: inv === null ? '棚卸資産データなし' : undefined,
      tooltip: '棚卸資産を除く流動資産で評価する厳格な短期支払い能力指標。\n計算式：(流動資産 - 棚卸資産) ÷ 流動負債 × 100\n判断基準：100%以上◎ / 70-100%○ / 70%未満△',
    },
    {
      label: '負債比率',
      value: drNeg ? '算出不可' : `${drVal!.toFixed(0)}%`,
      unit: drLv === '—' ? '' : drLv,
      color: judgeColor(drLv),
      note: drNeg ? '純資産がマイナスのため算出不可' : undefined,
      tooltip: '純資産に対する総負債の割合。レバレッジの大きさを示す。\n計算式：総負債 ÷ 純資産 × 100\n判断基準：100%未満◎ / 100-200%○ / 200%以上△\n※純資産がマイナスの場合は算出不可',
    },
    {
      label: '固定比率',
      value: frNeg ? '算出不可' : `${frVal!.toFixed(0)}%`,
      unit: frLv === '—' ? '' : frLv,
      color: judgeColor(frLv),
      note: frNeg ? '純資産がマイナスのため算出不可' : undefined,
      tooltip: '固定資産が自己資本でどれだけ賄われているかを示す指標。\n低いほど財務安定性が高い。\n計算式：固定資産 ÷ 純資産 × 100\n判断基準：100%未満◎ / 100-200%○ / 200%以上△\n※純資産がマイナスの場合は算出不可',
    },
    {
      label: '固定長期適合率',
      value: flaInvalid ? '算出不可' : `${flaVal!.toFixed(0)}%`,
      unit: flaLv === '—' ? '' : flaLv,
      color: judgeColor(flaLv),
      note: flaInvalid ? '(純資産＋固定負債)がゼロ以下' : undefined,
      tooltip: '固定資産を純資産と固定負債（長期資金）で\nどれだけ賄っているかを示す指標。\n計算式：固定資産 ÷ (純資産＋固定負債) × 100\n判断基準：100%未満◎ / 100-120%○ / 120%以上△',
    },
  ]

  return (
    <section className="bs-metrics-section">
      <p className="cockpit-zone-label">財務安全性指標</p>
      <div className="bs-metrics-grid">
        {cards.map((c) => (
          <div key={c.label} className="cockpit-highlight-card">
            <div className="cockpit-highlight-tooltip">{c.tooltip}</div>
            <p className="cockpit-highlight-label">{c.label}</p>
            <p className="cockpit-highlight-value" style={{ color: c.color }}>
              {c.value}
              {c.unit && <span className="cockpit-highlight-unit">{c.unit}</span>}
            </p>
            {c.note && <p className="cockpit-highlight-note">{c.note}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── BSTab (main export) ─────────────────────────────────
type Props = {
  bundle: FinancialBundle
  mode?: BsMode
}

export function BSTab({ bundle, mode = 'cockpit' }: Props) {
  const { periods } = bundle

  const [viewMode,     setViewMode]     = useState<ViewMode>('single')
  const [singleIdx,    setSingleIdx]    = useState<number>(periods.length - 1)
  const [compareRange, setCompareRange] = useState<CompareRange>('all')
  const [hovered,      setHovered]      = useState<string | null>(null)
  const [pinned,       setPinned]       = useState<string | null>(null)

  const highlight = hovered ?? pinned
  const isCompare = viewMode === 'compare'
  const canShowAll = mode === 'cockpit'

  const handleShowAll = () => {
    if (!canShowAll) return
    setViewMode('compare')
    setCompareRange('all')
  }

  const handleBack = () => {
    setViewMode('single')
    setPinned(null)
    setHovered(null)
  }

  const handleRangeChange = (r: CompareRange) => {
    setCompareRange(r)
    setPinned(null)
    setHovered(null)
  }

  const handlePin = (label: string) => {
    setPinned(v => v === label ? null : label)
  }

  // Table display index / start
  const isMultiTable = isCompare && typeof compareRange !== 'number'

  const tableIdx = isCompare && typeof compareRange === 'number'
    ? compareRange
    : singleIdx

  const compareStart = useMemo(() => {
    if (typeof compareRange === 'number') return compareRange
    if (compareRange === 'recent5') {
      const n = periods.length
      return n > 5 ? n - 5 : 0
    }
    return 0
  }, [compareRange, periods.length])

  return (
    <div className="bs-tab-2col">
      {/* ── 期間選択コントロール ── */}
      {!isCompare ? (
        <PeriodNav
          periods={periods}
          idx={singleIdx}
          onPrev={() => setSingleIdx(i => Math.max(0, i - 1))}
          onNext={() => setSingleIdx(i => Math.min(periods.length - 1, i + 1))}
          onShowAll={handleShowAll}
          canShowAll={canShowAll}
        />
      ) : (
        <CompareNav
          periods={periods}
          range={compareRange}
          onChange={handleRangeChange}
          onBack={handleBack}
        />
      )}

      {/* ── 2カラムグリッド ── */}
      <div className="bs-col-grid">
        {/* 左：グラフ */}
        <BSChart
          bundle={bundle}
          singleIdx={singleIdx}
          isCompare={isCompare}
          compareRange={compareRange}
          highlight={highlight}
          onHover={setHovered}
          onPin={handlePin}
        />

        {/* 右：左右対照テーブル */}
        <div className="bs-right-col">
          <BSPairedTable
            bundle={bundle}
            singleIdx={tableIdx}
            isMulti={isMultiTable}
            periods={periods}
            start={compareStart}
            highlight={highlight}
          />
        </div>
      </div>

      {/* ── 構成比ドーナツ ── */}
      <BSDonutChart bundle={bundle} periodIdx={singleIdx} />

      {/* ── 財務安全性指標 ── */}
      <BSMetricsCards bundle={bundle} />
    </div>
  )
}
