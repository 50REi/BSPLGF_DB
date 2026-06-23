import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SliderParams } from '../data/memorialFinancials'
import type { FinancialBundle } from '../types/financials'
import {
  buildActualChartData,
  buildDefaultSliderParams,
  buildForecastBase,
  buildForecastChartData,
  calcForecastHorizon,
  findBreakEvenYear,
  formatForecastSummary,
  type ForecastBase,
} from '../lib/forecastCalc'

type Props = { bundle: FinancialBundle }

const tooltipSurface = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
}

type SliderDef = {
  key: keyof SliderParams
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
  toValue: (display: number) => number
  fromValue: (v: number) => number
}

function makeSliders(base: ForecastBase): SliderDef[] {
  // debtRepayment はbundleの返済額を中心に ±50% の範囲（単位: 百万円）
  const rep    = base.annualRepayment || 100
  const rMin   = Math.max(10, Math.round(rep * 0.5 / 10) * 10)
  const rMax   = Math.round(rep * 2 / 10) * 10
  const rStep  = Math.max(10, Math.round(rep * 0.05 / 10) * 10)

  return [
    {
      key: 'revenueGrowth',
      label: '売上成長率',
      min: -10, max: 10, step: 0.5,
      format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
      toValue: (d) => d / 100,
      fromValue: (v) => v * 100,
    },
    {
      key: 'costRate',
      label: '原価率',
      min: 20, max: 50, step: 0.5,
      format: (v) => `${v.toFixed(1)}%`,
      toValue: (d) => d / 100,
      fromValue: (v) => v * 100,
    },
    {
      key: 'laborGrowth',
      label: '人件費増減率',
      min: -5, max: 10, step: 0.5,
      format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
      toValue: (d) => d / 100,
      fromValue: (v) => v * 100,
    },
    {
      key: 'debtRepayment',
      label: '借入返済額/年',
      min: rMin, max: rMax, step: rStep,
      // 百万円をそのまま使い、億円単位で表示
      format: (v) => `${(v / 100).toFixed(1)}億円`,
      toValue: (d) => d,      // 百万円 → 百万円（恒等）
      fromValue: (v) => v,    // 百万円 → 百万円（恒等）
    },
    {
      key: 'otherExpenseRate',
      label: 'その他経費率',
      min: 50, max: 85, step: 0.5,
      format: (v) => `${v.toFixed(1)}%`,
      toValue: (d) => d / 100,
      fromValue: (v) => v * 100,
    },
  ]
}

function formatMn(value: number): string {
  return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(value)
}

export function ForecastTab({ bundle }: Props) {
  const base         = useMemo(() => buildForecastBase(bundle),          [bundle])
  const defaultParams = useMemo(() => buildDefaultSliderParams(base),    [base])
  const sliders      = useMemo(() => makeSliders(base),                  [base])
  const actuals      = useMemo(() => buildActualChartData(bundle),       [bundle])
  const lastActual   = actuals[actuals.length - 1]?.period ?? ''

  const [params, setParams] = useState<SliderParams>(() => ({ ...defaultParams }))

  // bundle が切り替わったらスライダーをリセット
  useEffect(() => {
    setParams({ ...defaultParams })
  }, [defaultParams])

  const forecasts    = useMemo(() => calcForecastHorizon(params, base),           [params, base])
  const chartData    = useMemo(() => buildForecastChartData(forecasts, actuals),  [forecasts, actuals])
  const breakEvenYear = findBreakEvenYear(forecasts)

  const updateParam = <K extends keyof SliderParams>(key: K, value: SliderParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }))
  }

  return (
    <div className="forecast-tab panel-grid">
      <div className="forecast-layout">
        <aside className="forecast-sliders chart-card">
          <h2 className="section-title chart-card-heading">前提条件</h2>
          <div className="forecast-sliders-body">
            {sliders.map((s) => {
              const raw     = params[s.key]
              const display = s.fromValue(raw as number)
              return (
                <div key={s.key} className="slider-row">
                  <div className="slider-label-row">
                    <label htmlFor={`slider-${s.key}`}>{s.label}</label>
                    <span className="slider-current">現在: {s.format(display)}</span>
                  </div>
                  <input
                    id={`slider-${s.key}`}
                    type="range"
                    className="forecast-range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={display}
                    onChange={(e) =>
                      updateParam(s.key, s.toValue(Number(e.target.value)) as SliderParams[typeof s.key])
                    }
                  />
                  <div className="slider-bounds">
                    <span>{s.format(s.min)}</span>
                    <span>{s.format(s.max)}</span>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              className="forecast-reset"
              onClick={() => setParams({ ...defaultParams })}
            >
              リセット
            </button>
          </div>
        </aside>

        <figure className="chart-card forecast-chart-wrap">
          <figcaption>売上高・営業利益・経常利益の推移（百万円）</figcaption>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'var(--text)', fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'var(--text)', fontSize: 11 }}
                  tickFormatter={(v) => formatMn(v as number)}
                />
                <Tooltip contentStyle={tooltipSurface} />
                <Legend />
                {lastActual && (
                  <ReferenceLine
                    yAxisId="left"
                    x={lastActual}
                    stroke="var(--text)"
                    strokeDasharray="3 3"
                    label={{ value: '実績/予測', fill: 'var(--text)', fontSize: 11 }}
                  />
                )}
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  name="売上高"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="opProfit"
                  name="営業利益"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ordinaryProfit"
                  name="経常利益"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="forecast-chart-note">
              予測期はスライダー前提で自動試算。棒＝売上、実線＝営業利益、点線＝経常利益。
            </p>
          </div>
        </figure>
      </div>

      <section className="forecast-summary">
        <h2 className="section-title">予測財務サマリー（百万円）</h2>
        <div className="table-wrap">
          <table className="fin-table forecast-summary-table">
            <thead>
              <tr>
                <th scope="col">科目</th>
                {forecasts.map((f) => (
                  <th key={f.period} scope="col" className="fin-th-num">
                    {f.period}
                    {breakEvenYear === f.period && (
                      <span className="break-even-badge break-even-badge-inline">黒字転換</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['売上高',   (r: (typeof forecasts)[0]) => r.revenue],
                  ['営業利益', (r: (typeof forecasts)[0]) => r.operatingProfit],
                  ['経常利益', (r: (typeof forecasts)[0]) => r.ordinaryProfit],
                  ['純利益',   (r: (typeof forecasts)[0]) => r.netProfit],
                  ['現金残高', (r: (typeof forecasts)[0]) => r.cashBalance],
                ] as const
              ).map(([label, getter]) => (
                <tr key={label}>
                  <th scope="row" className="fin-label">{label}</th>
                  {forecasts.map((row) => {
                    const val = getter(row)
                    const positive = label !== '売上高' && label !== '現金残高' && val > 0
                    return (
                      <td
                        key={row.period}
                        className={`fin-num ${positive ? 'strategy-positive' : ''}`}
                      >
                        {formatForecastSummary(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {breakEvenYear && (
          <p className="break-even-badge break-even-badge-strong forecast-be-banner">
            営業利益の黒字転換: {breakEvenYear}
          </p>
        )}
      </section>
    </div>
  )
}
