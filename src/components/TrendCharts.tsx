import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinancials } from '../context/FinancialDataContext'
import { formatMillionYen } from '../lib/format'

function valuesByLabel(
  rows: readonly { label: string; values: readonly number[] }[],
  label: string,
): number[] {
  const row = rows.find((r) => r.label === label)
  return row ? [...row.values] : []
}

const bsStructure = [
  { name: '流動資産' as const, color: 'var(--chart-1)' },
  { name: '固定資産' as const, color: 'var(--chart-2)' },
]

const bsLeStructure = [
  { name: '流動負債' as const, color: 'var(--chart-le-1)' },
  { name: '固定負債' as const, color: 'var(--chart-le-2)' },
  { name: '純資産' as const, color: 'var(--chart-le-3)' },
]

const tooltipSurface = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
}

export function PLTrendChart() {
  const { bundle } = useFinancials()
  const plTrendData = useMemo(
    () =>
      bundle.periods.map((p, i) => ({
        period: p.replace('期', ''),
        売上高: valuesByLabel(bundle.profitLoss, '売上高')[i] ?? 0,
        営業利益: valuesByLabel(bundle.profitLoss, '営業利益')[i] ?? 0,
        当期純利益: valuesByLabel(bundle.profitLoss, '当期純利益')[i] ?? 0,
      })),
    [bundle],
  )

  return (
    <figure className="chart-card">
      <figcaption>PL 主要指標の推移（百万円）</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={plTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: 'var(--text)', fontSize: 12 }} />
            <YAxis
              tick={{ fill: 'var(--text)', fontSize: 12 }}
              tickFormatter={(v) => formatMillionYen(v as number)}
            />
            <Tooltip contentStyle={tooltipSurface} />
            <Legend />
            <Bar dataKey="売上高" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="営業利益" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="当期純利益" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export function BSLiabilitiesEquityChart() {
  const { bundle } = useFinancials()
  const bsLeStackData = useMemo(
    () =>
      bundle.periods.map((p, i) => ({
        period: p.replace('期', ''),
        流動負債:
          valuesByLabel(bundle.balanceSheet.liabilitiesAndEquity, '流動負債')[i] ?? 0,
        固定負債:
          valuesByLabel(bundle.balanceSheet.liabilitiesAndEquity, '固定負債')[i] ?? 0,
        純資産: valuesByLabel(bundle.balanceSheet.liabilitiesAndEquity, '純資産')[i] ?? 0,
      })),
    [bundle],
  )

  return (
    <figure className="chart-card">
      <figcaption>BS 負債・純資産の構成推移（百万円）</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={bsLeStackData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: 'var(--text)', fontSize: 12 }} />
            <YAxis
              tick={{ fill: 'var(--text)', fontSize: 12 }}
              tickFormatter={(v) => formatMillionYen(v as number)}
            />
            <Tooltip contentStyle={tooltipSurface} />
            <Legend />
            {bsLeStructure.map((s) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                stackId="le"
                fill={s.color}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export function BSStackChart() {
  const { bundle } = useFinancials()
  const bsStackData = useMemo(
    () =>
      bundle.periods.map((p, i) => ({
        period: p.replace('期', ''),
        流動資産: valuesByLabel(bundle.balanceSheet.assets, '流動資産')[i] ?? 0,
        固定資産: valuesByLabel(bundle.balanceSheet.assets, '固定資産')[i] ?? 0,
      })),
    [bundle],
  )

  return (
    <figure className="chart-card">
      <figcaption>BS 資産構成の推移（百万円）</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={bsStackData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: 'var(--text)', fontSize: 12 }} />
            <YAxis
              tick={{ fill: 'var(--text)', fontSize: 12 }}
              tickFormatter={(v) => formatMillionYen(v as number)}
            />
            <Tooltip contentStyle={tooltipSurface} />
            <Legend />
            {bsStructure.map((s) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                stackId="a"
                fill={s.color}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export function CFActivityChart() {
  const { bundle } = useFinancials()
  const cfData = useMemo(
    () =>
      bundle.periods.map((p, i) => ({
        period: p.replace('期', ''),
        営業CF:
          valuesByLabel(bundle.cashFlow, '営業活動によるキャッシュ・フロー')[i] ?? 0,
        投資CF: valuesByLabel(bundle.cashFlow, '投資活動によるキャッシュ・フロー')[i] ?? 0,
        財務CF: valuesByLabel(bundle.cashFlow, '財務活動によるキャッシュ・フロー')[i] ?? 0,
      })),
    [bundle],
  )

  return (
    <figure className="chart-card">
      <figcaption>CF 活動別（百万円・投資・財務は符号どおり）</figcaption>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={cfData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: 'var(--text)', fontSize: 12 }} />
            <YAxis
              tick={{ fill: 'var(--text)', fontSize: 12 }}
              tickFormatter={(v) => formatMillionYen(v as number)}
            />
            <Tooltip contentStyle={tooltipSurface} />
            <Legend />
            <Bar dataKey="営業CF" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="投資CF" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="財務CF" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
