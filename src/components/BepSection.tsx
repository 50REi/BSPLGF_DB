import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
} from 'recharts'
import { formatMillionYen } from '../lib/format'
import type { FinancialBundle } from '../types/financials'

type Props = { bundle: FinancialBundle }

const TEAL   = '#00b4b4'
const SALMON = '#e8534a'
const ORANGE = '#f59e0b'
const GRAY   = '#94a3b8'

const tooltipSurface = {
  background: '#243447',
  border: '1px solid #2d4057',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: '0.8rem',
}

type RefLabelProps = {
  viewBox?: { x?: number; y?: number }
  value: string
  color: string
  yShift?: number
}

function RefLineLabel({ viewBox, value, color, yShift = 4 }: RefLabelProps) {
  const x = viewBox?.x ?? 0
  const y = (viewBox?.y ?? 0) + yShift

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={-100} y={0} width={200} height={28} rx={4} fill="#243447" stroke={color} strokeWidth={1.5} />
      <text x={0} y={18} textAnchor="middle" fontSize={12} fontWeight="bold" fill={color}>
        {value}
      </text>
    </g>
  )
}

function ZoneLabels() {
  const plotArea = usePlotArea()
  if (!plotArea) return null
  const { x, y, width } = plotArea
  return (
    <g>
      <text
        x={x + 8}
        y={y + 20}
        textAnchor="start"
        fill={SALMON}
        fontSize={12}
        fontWeight="bold"
        fontFamily="system-ui,-apple-system,sans-serif"
      >
        ▼ 損失ゾーン
      </text>
      <text
        x={x + width - 8}
        y={y + 20}
        textAnchor="end"
        fill={TEAL}
        fontSize={12}
        fontWeight="bold"
        fontFamily="system-ui,-apple-system,sans-serif"
      >
        ▲ 利益ゾーン
      </text>
    </g>
  )
}

function findLast(
  rows: readonly { label: string; values: readonly number[] }[],
  label: string,
): number {
  const vals = rows.find((r) => r.label === label)?.values
  return vals ? (vals[vals.length - 1] ?? 0) : 0
}

const legendFormatter = (value: string) => (
  <span style={{ color: GRAY, fontSize: '0.78rem' }}>{value}</span>
)

export function BepSection({ bundle }: Props) {
  const { profitLoss } = bundle

  const revenue = findLast(profitLoss, '売上高')

  const hasExplicit =
    profitLoss.some((r) => r.label === '変動費') &&
    profitLoss.some((r) => r.label === '固定費')

  const variableCost = hasExplicit
    ? findLast(profitLoss, '変動費')
    : findLast(profitLoss, '売上原価')

  const fixedCost = hasExplicit
    ? findLast(profitLoss, '固定費')
    : findLast(profitLoss, '販売費及び一般管理費')

  const variableRate     = revenue > 0 ? variableCost / revenue : 0
  const contributionRate = 1 - variableRate
  const bep    = contributionRate > 0 ? fixedCost / contributionRate : 0
  const gap    = revenue - bep
  const gapPct = bep > 0 ? (gap / bep) * 100 : 0

  const maxX   = Math.ceil((revenue * 1.6) / 1000) * 1000
  const isClose = maxX > 0 && Math.abs(revenue - bep) / maxX < 0.10
  const STEPS = 20
  const chartData = useMemo(
    () =>
      Array.from({ length: STEPS + 1 }, (_, i) => {
        const x = (maxX / STEPS) * i
        return {
          x,
          売上高: x,
          総費用: fixedCost + variableRate * x,
          固定費: fixedCost,
        }
      }),
    [maxX, fixedCost, variableRate],
  )

  return (
    <section className="bep-section">
      <h2 className="section-title">損益分岐点（BEP）分析</h2>

      {!hasExplicit && (
        <p className="bep-fallback-note">
          変動費・固定費の明細がないため、売上原価を変動費、販管費を固定費として代替計算しています。
        </p>
      )}

      <div className="bep-kpi-row">
        <div className="bep-kpi-card bep-kpi-card-accent">
          <p className="bep-kpi-label">BEP 売上高</p>
          <p className="bep-kpi-value">
            {formatMillionYen(Math.round(bep))}
            <span className="bep-kpi-unit">百万円</span>
          </p>
        </div>

        <div className="bep-kpi-card">
          <p className="bep-kpi-label">現状売上との乖離</p>
          <p className="bep-kpi-value" style={{ color: gap >= 0 ? TEAL : SALMON }}>
            {gap >= 0 ? '+' : ''}{formatMillionYen(Math.round(gap))}
            <span className="bep-kpi-unit">百万円</span>
          </p>
          <p className="bep-kpi-sub" style={{ color: gap >= 0 ? TEAL : SALMON }}>
            {gap >= 0 ? '▲' : '▼'} {Math.abs(gapPct).toFixed(1)}%
          </p>
        </div>

        <div className="bep-kpi-card">
          <p className="bep-kpi-label">変動費率</p>
          <p className="bep-kpi-value">
            {(variableRate * 100).toFixed(1)}
            <span className="bep-kpi-unit">%</span>
          </p>
        </div>

        <div className="bep-kpi-card">
          <p className="bep-kpi-label">固定費</p>
          <p className="bep-kpi-value">
            {formatMillionYen(fixedCost)}
            <span className="bep-kpi-unit">百万円</span>
          </p>
        </div>
      </div>

      <figure className="chart-card">
        <figcaption>BEP チャート（百万円）</figcaption>
        <div className="chart-body">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 40, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d4057" vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, maxX]}
                tick={{ fill: GRAY, fontSize: 11 }}
                tickFormatter={(v) => formatMillionYen(v as number)}
              />
              <YAxis
                tick={{ fill: GRAY, fontSize: 11 }}
                tickFormatter={(v) => formatMillionYen(v as number)}
              />
              <Tooltip
                contentStyle={tooltipSurface}
                formatter={(v) => [`${formatMillionYen(Math.round(Number(v)))} 百万円`]}
                labelFormatter={(v) => `売上高: ${formatMillionYen(Math.round(Number(v)))} 百万円`}
              />
              <Legend formatter={legendFormatter} />

              {/* 損益ゾーンラベル */}
              <ZoneLabels />

              {/* BEP垂直線 */}
              <ReferenceLine
                x={bep}
                stroke={TEAL}
                strokeDasharray="4 4"
                label={
                  <RefLineLabel
                    value={`BEP: ${Math.round(bep).toLocaleString()}百万円`}
                    color={TEAL}
                    yShift={-10}
                  />
                }
              />
              {/* 現状売上垂直線 */}
              <ReferenceLine
                x={revenue}
                stroke={ORANGE}
                strokeDasharray="4 4"
                label={
                  <RefLineLabel
                    value={`現状売上: ${revenue.toLocaleString()}百万円`}
                    color={ORANGE}
                    yShift={isClose ? 25 : 30}
                  />
                }
              />

              {/* 総費用エリア（先に描いて損失ゾーンを可視化） */}
              <Area
                type="linear"
                dataKey="総費用"
                stroke={SALMON}
                strokeWidth={2.5}
                fill={SALMON}
                fillOpacity={0.15}
                dot={false}
                activeDot={{ r: 4, fill: SALMON }}
              />
              {/* 売上高エリア（後に描いて利益ゾーンを上書き） */}
              <Area
                type="linear"
                dataKey="売上高"
                stroke={TEAL}
                strokeWidth={2.5}
                fill={TEAL}
                fillOpacity={0.15}
                dot={false}
                activeDot={{ r: 4, fill: TEAL }}
              />
              {/* 固定費ライン（点線・グレー） */}
              <Line
                type="linear"
                dataKey="固定費"
                stroke={GRAY}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                legendType="plainline"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </section>
  )
}
