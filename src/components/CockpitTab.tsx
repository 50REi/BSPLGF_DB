import { useMemo } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { formatMillionYen } from '../lib/format'
import type { FinancialBundle } from '../types/financials'

type Props = { bundle: FinancialBundle }
type SignalLevel = 'green' | 'yellow' | 'red'

function findValues(
  rows: readonly { label: string; values: readonly number[] }[],
  label: string,
): readonly number[] {
  return rows.find((r) => r.label === label)?.values ?? []
}

function last(arr: readonly number[]): number {
  return arr[arr.length - 1] ?? 0
}

function yoyPct(arr: readonly number[]): number {
  const p = arr[arr.length - 2] ?? 0
  if (p === 0) return 0
  return (((arr[arr.length - 1] ?? 0) - p) / Math.abs(p)) * 100
}

// ===== シグナル判定 =====
function currentRatioLevel(r: number): SignalLevel {
  return r > 150 ? 'green' : r >= 100 ? 'yellow' : 'red'
}
function equityRatioLevel(r: number): SignalLevel {
  return r > 30 ? 'green' : r >= 15 ? 'yellow' : 'red'
}
function operatingCFLevel(cf: number): SignalLevel {
  return cf > 0 ? 'green' : cf === 0 ? 'yellow' : 'red'
}
function debtRepaymentLevel(years: number): SignalLevel {
  return years > 3 ? 'green' : years >= 1 ? 'yellow' : 'red'
}

const GAUGE_COLOR: Record<SignalLevel, string> = {
  green:  '#00b4b4',
  yellow: '#f59e0b',
  red:    '#e8534a',
}
const GAUGE_STATUS_TEXT: Record<SignalLevel, string> = {
  green:  '良好',
  yellow: '注意',
  red:    '要改善',
}

// ===== 半円ゲージ =====
const G_CX = 100
const G_CY = 105
const G_R  = 88
const BG_ARC = `M ${G_CX - G_R} ${G_CY} A ${G_R} ${G_R} 0 0 1 ${G_CX + G_R} ${G_CY}`

function describeArc(pct: number): string {
  if (pct >= 100) return BG_ARC
  if (pct <= 0)   return ''
  const angle = Math.PI * (1 - pct / 100)
  const x = (G_CX + G_R * Math.cos(angle)).toFixed(2)
  const y = (G_CY - G_R * Math.sin(angle)).toFixed(2)
  return `M ${G_CX - G_R} ${G_CY} A ${G_R} ${G_R} 0 0 1 ${x} ${y}`
}

type GaugeCardProps = {
  label: string
  pct: number
  displayValue: string
  fontSize?: number
  color: string
  status: string
}

function GaugeCard({ label, pct, displayValue, fontSize = 26, color, status }: GaugeCardProps) {
  const arc = describeArc(pct)
  return (
    <div className="gauge-card">
      <svg
        viewBox="0 0 200 115"
        className="gauge-svg"
        role="img"
        aria-label={`${label}: ${displayValue} (${status})`}
      >
        <path d={BG_ARC} fill="none" stroke="#2d4057" strokeWidth="18" strokeLinecap="round" />
        {arc && (
          <path d={arc} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" />
        )}
        <text
          x={G_CX}
          y="90"
          textAnchor="middle"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight="800"
          fontFamily="system-ui,-apple-system,sans-serif"
        >
          {displayValue}
        </text>
      </svg>
      <div className="gauge-info">
        <p className="gauge-label">{label}</p>
        <p className="gauge-status" style={{ color }}>{status}</p>
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: '#243447',
  border: '1px solid #2d4057',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: '0.75rem',
}

const legendFmt = (v: string) => (
  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{v}</span>
)

export function CockpitTab({ bundle }: Props) {
  const { balanceSheet, profitLoss, cashFlow, periods } = bundle

  // ===== データ取得 =====
  const revenue       = useMemo(() => findValues(profitLoss, '売上高'),                          [profitLoss])
  const opProfit      = useMemo(() => findValues(profitLoss, '営業利益'),                        [profitLoss])
  const operatingCF   = useMemo(() => findValues(cashFlow, '営業活動によるキャッシュ・フロー'), [cashFlow])
  const investCF      = useMemo(() => findValues(cashFlow, '投資活動によるキャッシュ・フロー'), [cashFlow])
  const financeCF     = useMemo(() => findValues(cashFlow, '財務活動によるキャッシュ・フロー'), [cashFlow])
  const currentAssets = useMemo(() => findValues(balanceSheet.assets, '流動資産'),               [balanceSheet])
  const totalAssets   = useMemo(() => findValues(balanceSheet.assets, '資産合計'),               [balanceSheet])
  const currentLiab   = useMemo(() => findValues(balanceSheet.liabilitiesAndEquity, '流動負債'), [balanceSheet])
  const longDebt      = useMemo(() => findValues(balanceSheet.liabilitiesAndEquity, '長期借入金'),[balanceSheet])
  const shortDebt     = useMemo(() => findValues(balanceSheet.liabilitiesAndEquity, '短期借入金'),[balanceSheet])
  const equity        = useMemo(() => findValues(balanceSheet.liabilitiesAndEquity, '純資産'),    [balanceSheet])

  // 年間返済額: 複数ラベルで検索 → 見つからなければ財務CFの絶対値で代替
  const annualRepay = useMemo(() => {
    for (const lbl of ['借入金の返済（純額）', '借入金の返済', '長期借入金の返済']) {
      const vals = findValues(cashFlow, lbl)
      if (vals.length > 0) return Math.abs(last(vals))
    }
    const finCF = last(financeCF)
    return finCF < 0 ? Math.abs(finCF) : 0
  }, [cashFlow, financeCF])

  // ===== 最新値・指標 =====
  const latestRevenue  = last(revenue)
  const latestOpProfit = last(opProfit)
  const latestOpCF     = last(operatingCF)
  const latestInvCF    = last(investCF)

  const revenueYoY  = yoyPct(revenue)
  const opProfitYoY = yoyPct(opProfit)
  const opCFYoY     = yoyPct(operatingCF)
  const opMarginPct = latestRevenue !== 0 ? (latestOpProfit / latestRevenue) * 100 : 0

  const currentRatio = last(currentLiab) !== 0 ? (last(currentAssets) / last(currentLiab)) * 100 : 0
  const equityRatio  = last(totalAssets)  !== 0 ? (last(equity) / last(totalAssets)) * 100 : 0
  const totalDebt    = last(longDebt) + last(shortDebt)
  const fcf          = latestOpCF + latestInvCF

  // 借入返済余力 = 営業CF ÷ 年間返済額（年数カバレッジ）
  const repayYears = annualRepay > 0 ? latestOpCF / annualRepay : 999

  const latestPeriod = periods[periods.length - 1] ?? '最新期'

  const sparkData = useMemo(
    () =>
      periods.map((p, i) => ({
        period: p.replace('期', ''),
        revenue:  (revenue[i]  ?? 0),
        opProfit: (opProfit[i] ?? 0),
      })),
    [periods, revenue, opProfit],
  )

  // ===== ZONE1: 3大KPI =====
  const zone1 = [
    { label: '売上高',   value: latestRevenue,  sub: null as string | null, yoy: revenueYoY,  color: '#00b4b4' },
    { label: '営業利益', value: latestOpProfit,  sub: `営業利益率 ${opMarginPct.toFixed(1)}%`, yoy: opProfitYoY, color: '#e8534a' },
    { label: '営業CF',   value: latestOpCF,      sub: null,                  yoy: opCFYoY,     color: '#6366f1' },
  ]

  // ===== ZONE2: 財務健全性ゲージ =====
  const maxAbsOpCF = Math.max(1, ...operatingCF.map(v => Math.abs(v)))
  const zone2: GaugeCardProps[] = [
    {
      label:        '流動比率',
      pct:          Math.min(100, (currentRatio / 300) * 100),
      displayValue: `${currentRatio.toFixed(0)}%`,
      color:        GAUGE_COLOR[currentRatioLevel(currentRatio)],
      status:       GAUGE_STATUS_TEXT[currentRatioLevel(currentRatio)],
    },
    {
      label:        '自己資本比率',
      pct:          Math.min(100, Math.max(0, ((equityRatio + 20) / 80) * 100)),
      displayValue: `${equityRatio.toFixed(1)}%`,
      color:        GAUGE_COLOR[equityRatioLevel(equityRatio)],
      status:       GAUGE_STATUS_TEXT[equityRatioLevel(equityRatio)],
    },
    {
      label:        '営業CF',
      pct:          Math.max(3, Math.min(100, ((latestOpCF + maxAbsOpCF) / (2 * maxAbsOpCF)) * 100)),
      displayValue: `${latestOpCF > 0 ? '+' : ''}${formatMillionYen(latestOpCF)}`,
      fontSize:     22,
      color:        GAUGE_COLOR[operatingCFLevel(latestOpCF)],
      status:       GAUGE_STATUS_TEXT[operatingCFLevel(latestOpCF)],
    },
    {
      label:        '借入返済余力',
      pct:          repayYears > 20 ? 100 : (repayYears / 20) * 100,
      displayValue: repayYears > 99 ? '余裕あり' : `${repayYears.toFixed(1)}年`,
      fontSize:     repayYears > 99 ? 18 : 26,
      color:        GAUGE_COLOR[debtRepaymentLevel(repayYears)],
      status:       GAUGE_STATUS_TEXT[debtRepaymentLevel(repayYears)],
    },
  ]

  // ===== ZONE3: 重要数値5枚 =====
  const zone3 = [
    {
      label: '借入残高',
      value: formatMillionYen(totalDebt),
      unit: '百万円',
      color: '#e8534a',
      tooltip: '金融機関への返済義務がある\n借入金の総額。有利子負債とも呼ぶ。\n営業CFとの比率で返済余力を判断する。',
    },
    {
      label: '自己資本比率',
      value: `${equityRatio.toFixed(1)}%`,
      unit: '',
      color: equityRatio > 30 ? '#059669' : equityRatio >= 15 ? '#d97706' : '#dc2626',
      tooltip: '総資産に占める自己資本の割合。\n計算式：純資産 ÷ 総資産 × 100\n目安：30%以上◎ / 15-30%○ / 15%未満△',
    },
    {
      label: '流動比率',
      value: `${currentRatio.toFixed(0)}%`,
      unit: '',
      color: currentRatio > 150 ? '#059669' : currentRatio >= 100 ? '#d97706' : '#dc2626',
      tooltip: '1年以内に支払う負債に対する\n流動資産の比率。短期支払い能力の指標。\n計算式：流動資産 ÷ 流動負債 × 100\n目安：150%以上◎ / 100-150%○ / 100%未満△',
    },
    {
      label: 'FCF',
      value: formatMillionYen(fcf),
      unit: '百万円',
      color: fcf >= 0 ? '#00b4b4' : '#e8534a',
      tooltip: '事業活動で\n実際に生み出したキャッシュ。\n計算式：営業CF ＋ 投資CF\nプラスが継続していると財務健全性が高い。',
    },
    {
      label: '売上高成長率',
      value: `${revenueYoY >= 0 ? '+' : ''}${revenueYoY.toFixed(1)}%`,
      unit: '前年比',
      color: revenueYoY >= 0 ? '#00b4b4' : '#e8534a',
      tooltip: '前期比の売上高増減率。\n計算式：(当期売上 - 前期売上) ÷ 前期売上 × 100\nプラスが成長トレンド、マイナスは縮小傾向。',
    },
  ]

  return (
    <div className="cockpit-tab">

      {/* ── ZONE1: 3大KPI ── */}
      <section>
        <p className="cockpit-zone-label">主要KPI ／ {latestPeriod}</p>
        <div className="cockpit-kpi-grid">
          {zone1.map((k) => {
            const pos = k.yoy >= 0
            return (
              <div key={k.label} className="cockpit-kpi-card" style={{ borderTopColor: k.color }}>
                <p className="cockpit-kpi-label">{k.label}</p>
                <p className="cockpit-kpi-value" style={{ color: k.color }}>
                  {formatMillionYen(k.value)}
                  <span className="cockpit-kpi-unit">百万円</span>
                </p>
                {k.sub && <p className="cockpit-kpi-margin">{k.sub}</p>}
                <div className="cockpit-kpi-badges">
                  <span className={`cockpit-yoy ${pos ? 'cockpit-yoy-pos' : 'cockpit-yoy-neg'}`}>
                    {pos ? '▲' : '▼'} {Math.abs(k.yoy).toFixed(1)}%
                  </span>
                  <span className="cockpit-kpi-yoy-note">前年比</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── ZONE2: 財務健全性ゲージ ── */}
      <section className="gauge-section">
        <p className="gauge-zone-label">財務健全性シグナル</p>
        <div className="gauge-grid">
          {zone2.map((g) => (
            <GaugeCard key={g.label} {...g} />
          ))}
        </div>
      </section>

      {/* ── ZONE3 + ZONE4 ── */}
      <div className="cockpit-bottom-row">

        {/* ZONE3: 重要数値カード */}
        <section className="cockpit-highlight-section">
          <p className="cockpit-zone-label">財務ハイライト ／ {latestPeriod}</p>
          <div className="cockpit-highlight-grid">
            {zone3.map((item) => (
              <div key={item.label} className="cockpit-highlight-card">
                <div className="cockpit-highlight-tooltip">{item.tooltip}</div>
                <p className="cockpit-highlight-label">{item.label}</p>
                <p className="cockpit-highlight-value" style={{ color: item.color }}>
                  {item.value}
                  {item.unit && <span className="cockpit-highlight-unit">{item.unit}</span>}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ZONE4: スパークライン */}
        <section className="cockpit-spark-section">
          <p className="cockpit-zone-label">売上・営業利益トレンド</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={sparkData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="period"
                tick={{ fill: 'var(--text)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [
                  `${formatMillionYen(Number(v))} 百万円`,
                  name as string,
                ]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="売上高"
                stroke="#00b4b4"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#00b4b4', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="opProfit"
                name="営業利益"
                stroke="#e8534a"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#e8534a', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="cockpit-spark-legend">
            <span className="cockpit-spark-dot" style={{ background: '#00b4b4' }} />
            <span>売上高</span>
            <span className="cockpit-spark-dot" style={{ background: '#e8534a' }} />
            <span>営業利益</span>
          </div>
        </section>

      </div>
    </div>
  )
}
