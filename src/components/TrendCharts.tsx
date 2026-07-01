import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMillionYen } from '../lib/format'
import type { FinancialBundle } from '../types/financials'

export type YearRange = 'recent5' | 'all'
type Props = { bundle: FinancialBundle; yearRange?: YearRange }

function valuesByLabel(
  rows: readonly { label: string; values: readonly number[] }[],
  label: string,
): number[] {
  const row = rows.find((r) => r.label === label)
  return row ? [...row.values] : []
}

function sliceStart(n: number, yearRange?: YearRange): number {
  return yearRange === 'recent5' && n > 5 ? n - 5 : 0
}


function lastValue(
  rows: readonly { label: string; values: readonly number[] }[],
  label: string,
  idx?: number,
): number {
  const vals = rows.find((r) => r.label === label)?.values
  if (!vals) return 0
  const i = idx !== undefined ? idx : vals.length - 1
  return vals[i] ?? 0
}

type DonutItem = { name: string; value: number; color: string }

const donutTooltip = {
  background: '#243447',
  border: '1px solid #2d4057',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: '0.8rem',
}

function DonutPanel({ data, total, centerLabel }: { data: DonutItem[]; total: number; centerLabel: string }) {
  return (
    <div className="donut-card">
      <div className="donut-chart-wrap">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
              <Label value={centerLabel} position="center" fill="#ffffff" fontSize={13} fontWeight={600} />
            </Pie>
            <Tooltip
              contentStyle={donutTooltip}
              formatter={(v) => [`${formatMillionYen(Number(v ?? 0))} 百万円`]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="donut-legend">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0
          return (
            <li key={d.name} className="donut-legend-item">
              <span className="donut-legend-dot" style={{ background: d.color }} />
              <span className="donut-legend-name">{d.name}</span>
              <span className="donut-legend-value">{formatMillionYen(d.value)}</span>
              <span className="donut-legend-pct">{pct.toFixed(1)}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const tooltipSurface = {
  background: '#243447',
  border: '1px solid #2d4057',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: '0.8rem',
}

const legendFmt = (v: string) => (
  <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{v}</span>
)

const AXIS_TICK  = { fill: '#94a3b8', fontSize: 12 } as const
const AXIS_TICK_S = { fill: '#94a3b8', fontSize: 11 } as const
const GRID_STROKE = '#2d4057'

// ===== PLTrendChart: 棒（売上高）＋折れ線2本（利益）・2軸 =====
export function PLTrendChart({ bundle, yearRange }: Props) {
  const plTrendData = useMemo(() => {
    const start = sliceStart(bundle.periods.length, yearRange)
    const rev = valuesByLabel(bundle.profitLoss, '売上高')
    const op  = valuesByLabel(bundle.profitLoss, '営業利益')
    const net = valuesByLabel(bundle.profitLoss, '当期純利益')
    return bundle.periods.slice(start).map((p, i) => ({
      period:     p.replace('期', ''),
      売上高:     rev[i + start] ?? 0,
      営業利益:   op[i + start]  ?? 0,
      当期純利益: net[i + start] ?? 0,
    }))
  }, [bundle, yearRange])

  return (
    <figure className="chart-card">
      <figcaption>PL 主要指標の推移（百万円）</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={plTrendData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="period" tick={AXIS_TICK} />
            <YAxis
              tick={AXIS_TICK_S}
              tickFormatter={(v) => formatMillionYen(v as number)}
              label={{
                value: '百万円',
                angle: -90,
                position: 'insideLeft' as const,
                offset: 12,
                fill: '#94a3b8',
                fontSize: 11,
              }}
            />
            <Tooltip contentStyle={tooltipSurface} />
            <Legend formatter={legendFmt} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
            <Bar
              dataKey="売上高"
              fill="#00b4b4"
              opacity={0.35}
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="営業利益"
              stroke="#e8534a"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#e8534a', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="当期純利益"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

// ===== BSBalanceChart: 資産 vs 負債・純資産の左右対照 =====
export function BSBalanceChart({ bundle, yearRange }: Props) {
  const bsData = useMemo(() => {
    const start = sliceStart(bundle.periods.length, yearRange)
    const ca  = valuesByLabel(bundle.balanceSheet.assets, '流動資産')
    const fa  = valuesByLabel(bundle.balanceSheet.assets, '固定資産')
    const cl  = valuesByLabel(bundle.balanceSheet.liabilitiesAndEquity, '流動負債')
    const ncl = valuesByLabel(bundle.balanceSheet.liabilitiesAndEquity, '固定負債')
    const eq  = valuesByLabel(bundle.balanceSheet.liabilitiesAndEquity, '純資産')
    return bundle.periods.slice(start).map((p, i) => ({
      period:  p.replace('期', ''),
      固定資産: fa[i + start]  ?? 0,
      流動資産: ca[i + start]  ?? 0,
      固定負債: ncl[i + start] ?? 0,
      流動負債: cl[i + start]  ?? 0,
      純資産:   eq[i + start]  ?? 0,
    }))
  }, [bundle, yearRange])

  return (
    <figure className="chart-card">
      <figcaption>BS 資産・負債純資産の対照（百万円）</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={bsData}
            barCategoryGap="35%"
            barGap={3}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="period" tick={AXIS_TICK} />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={(v) => formatMillionYen(v as number)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#243447', border: '1px solid #00b4b4', borderRadius: '8px', color: '#ffffff' }}
              formatter={(value, name) => [`${Number(value ?? 0).toLocaleString()} 百万円`, String(name)]}
              labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
            />
            <Legend formatter={legendFmt} />
            {/* 資産側（左棒）— 固定資産 bottom → 流動資産 top */}
            <Bar dataKey="固定資産" stackId="assets" fill="#00b4b4" isAnimationActive={false} />
            <Bar dataKey="流動資産" stackId="assets" fill="#4fd1d1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            {/* 負債・純資産側（右棒）— 固定負債 bottom → 流動負債 middle → 純資産 top */}
            <Bar dataKey="固定負債" stackId="le" fill="#a78bfa" isAnimationActive={false} />
            <Bar dataKey="流動負債" stackId="le" fill="#e8534a" isAnimationActive={false} />
            <Bar dataKey="純資産"   stackId="le" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

// ===== CFActivityChart: 活動別CF（変更なし） =====
export function CFActivityChart({ bundle, yearRange }: Props) {
  const cfData = useMemo(() => {
    const start = sliceStart(bundle.periods.length, yearRange)
    const op  = valuesByLabel(bundle.cashFlow, '営業活動によるキャッシュ・フロー')
    const inv = valuesByLabel(bundle.cashFlow, '投資活動によるキャッシュ・フロー')
    const fin = valuesByLabel(bundle.cashFlow, '財務活動によるキャッシュ・フロー')
    return bundle.periods.slice(start).map((p, i) => ({
      period: p.replace('期', ''),
      営業CF: op[i + start]  ?? 0,
      投資CF: inv[i + start] ?? 0,
      財務CF: fin[i + start] ?? 0,
    }))
  }, [bundle, yearRange])

  return (
    <figure className="chart-card">
      <figcaption>CF 活動別（百万円・投資・財務は符号どおり）</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={cfData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="period" tick={AXIS_TICK} />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={(v) => formatMillionYen(v as number)}
            />
            <Tooltip contentStyle={tooltipSurface} />
            <Legend formatter={legendFmt} />
            <Bar dataKey="営業CF" fill="#00b4b4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="投資CF" fill="#e8534a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="財務CF" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

// ===== BSDonutChart: 選択期の資産構成・負債純資産構成ドーナツ =====
export function BSDonutChart({ bundle, periodIdx }: { bundle: FinancialBundle; periodIdx?: number }) {
  const idx = periodIdx !== undefined ? periodIdx : bundle.periods.length - 1
  const period = bundle.periods[idx] ?? ''

  const assetsData: DonutItem[] = [
    { name: '固定資産', value: lastValue(bundle.balanceSheet.assets, '固定資産', idx), color: '#00b4b4' },
    { name: '流動資産', value: lastValue(bundle.balanceSheet.assets, '流動資産', idx), color: '#4fd1d1' },
  ].filter((d) => d.value > 0)

  const leData: DonutItem[] = [
    { name: '固定負債', value: lastValue(bundle.balanceSheet.liabilitiesAndEquity, '固定負債', idx), color: '#a78bfa' },
    { name: '流動負債', value: lastValue(bundle.balanceSheet.liabilitiesAndEquity, '流動負債', idx), color: '#e8534a' },
    { name: '純資産',   value: lastValue(bundle.balanceSheet.liabilitiesAndEquity, '純資産',   idx), color: '#10b981' },
  ].filter((d) => d.value > 0)

  const assetsTotal = assetsData.reduce((s, d) => s + d.value, 0)
  const leTotal     = leData.reduce((s, d) => s + d.value, 0)

  return (
    <figure className="chart-card">
      <figcaption>BS 構成比（{period}）</figcaption>
      <div className="donut-row">
        <DonutPanel data={assetsData} total={assetsTotal} centerLabel="資産構成" />
        <DonutPanel data={leData}     total={leTotal}     centerLabel="負債構成" />
      </div>
    </figure>
  )
}

// ===== PLDonutChart: 直近2期の費用・利益構成ドーナツ =====
function buildPLDonutData(bundle: FinancialBundle, idx: number) {
  const period    = bundle.periods[idx] ?? ''
  const cogs      = lastValue(bundle.profitLoss, '売上原価', idx)
  const sga       = lastValue(bundle.profitLoss, '販売費及び一般管理費', idx)
  const opProfit  = lastValue(bundle.profitLoss, '営業利益', idx)
  const isLoss    = opProfit < 0
  const data: DonutItem[] = [
    { name: '売上原価', value: cogs,      color: '#e8534a' },
    { name: '販管費',   value: sga,       color: '#a78bfa' },
    ...(isLoss ? [] : [{ name: '営業利益', value: opProfit, color: '#00b4b4' }]),
  ].filter((d) => d.value > 0)
  const total = data.reduce((s, d) => s + d.value, 0)
  return { period, data, total, isLoss, opProfit }
}

export function PLDonutChart({ bundle }: { bundle: FinancialBundle }) {
  const lastIdx = bundle.periods.length - 1
  const prevIdx = lastIdx - 1
  const hasPrev = prevIdx >= 0

  const curr = buildPLDonutData(bundle, lastIdx)
  const prev = hasPrev ? buildPLDonutData(bundle, prevIdx) : null

  return (
    <figure className="chart-card">
      <figcaption>PL 費用構成{hasPrev ? `（${prev!.period} → ${curr.period}）` : `（${curr.period}）`}</figcaption>
      <div className={`donut-row${hasPrev ? '' : ' donut-row-single'}`}>
        {prev && (
          <div className="donut-col">
            <p className="donut-period-label">{prev.period}</p>
            <DonutPanel data={prev.data} total={prev.total} centerLabel="費用構成" />
            {prev.isLoss && (
              <div className="donut-loss-note">
                <p>営業損失<br />{formatMillionYen(Math.abs(prev.opProfit))} 百万円</p>
              </div>
            )}
          </div>
        )}
        <div className="donut-col">
          {hasPrev && <p className="donut-period-label">{curr.period}</p>}
          <DonutPanel data={curr.data} total={curr.total} centerLabel="費用構成" />
          {curr.isLoss && (
            <div className="donut-loss-note">
              <p>営業損失<br />{formatMillionYen(Math.abs(curr.opProfit))} 百万円</p>
            </div>
          )}
        </div>
      </div>
    </figure>
  )
}
