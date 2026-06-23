import { useMemo } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import type { ImprovementItem } from '../data/memorialFinancials'
import type { FinancialBundle } from '../types/financials'
import {
  buildDefaultSliderParams,
  buildForecastBase,
  buildOptimizedParams,
  calcForecastHorizon,
  findBreakEvenYear,
  formatForecastSummary,
} from '../lib/forecastCalc'

type Props = { bundle: FinancialBundle }

const tooltipSurface = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
}

// ===== bundle から改善施策を動的生成 =====
function buildImprovements(bundle: FinancialBundle): ImprovementItem[] {
  const last = (
    rows: readonly { label: string; values: readonly number[] }[],
    label: string,
  ) => rows.find((r) => r.label === label)?.values.at(-1) ?? 0

  const revenue      = last(bundle.profitLoss, '売上高')
  const opProfit     = last(bundle.profitLoss, '営業利益')
  const cogs         = last(bundle.profitLoss, '売上原価')
  const sga          = last(bundle.profitLoss, '販売費及び一般管理費')
  const opCF         = last(bundle.cashFlow,   '営業活動によるキャッシュ・フロー')
  const equity       = last(bundle.balanceSheet.liabilitiesAndEquity, '純資産')
  const totalAssets  = last(bundle.balanceSheet.assets,               '資産合計')
  const longDebt     = last(bundle.balanceSheet.liabilitiesAndEquity, '長期借入金')
  const shortDebt    = last(bundle.balanceSheet.liabilitiesAndEquity, '短期借入金')

  const opMargin    = revenue > 0 ? opProfit / revenue : 0
  const cogsRate    = revenue > 0 ? cogs / revenue : 0
  const sgaRate     = revenue > 0 ? sga / revenue : 0
  const equityRatio = totalAssets > 0 ? equity / totalAssets : 0
  const totalDebt   = longDebt + shortDebt

  const items: ImprovementItem[] = []

  // 1. 収益性
  if (opProfit <= 0) {
    items.push({
      id: 'profitability',
      title: '収益力の改善',
      score: Math.min(100, Math.round(85 + Math.abs(opMargin) * 300)),
      urgency: '高',
      detail: `営業利益 ${opProfit.toFixed(0)}百万円（営業利益率 ${(opMargin * 100).toFixed(1)}%）`,
      action: '売上単価の見直し・高粗利サービスへのシフト、固定費の選択的削減',
      annualEffect: Math.round(Math.abs(opProfit) * 0.5),
    })
  } else {
    items.push({
      id: 'profitability',
      title: '収益力の維持・向上',
      score: Math.round(60 - opMargin * 200),
      urgency: opMargin < 0.05 ? '中' : '低',
      detail: `営業利益率 ${(opMargin * 100).toFixed(1)}%`,
      action: '付加価値サービスの強化・クロスセル推進',
      annualEffect: Math.round(revenue * 0.01),
    })
  }

  // 2. 財務健全化（自己資本比率 < 15%）
  if (equityRatio < 0.15) {
    items.push({
      id: 'financial_health',
      title: '財務健全化',
      score: equityRatio < 0 ? 90 : 72,
      urgency: equityRatio < 0 ? '高' : '中',
      detail: `自己資本比率 ${(equityRatio * 100).toFixed(1)}%、借入残高 ${totalDebt.toFixed(0)}百万円`,
      action: '遊休資産の売却・借入条件の見直し交渉・利益の内部留保積み上げ',
      annualEffect: Math.round(totalDebt * 0.02),
    })
  }

  // 3. 原価率改善（28% 超）
  if (cogsRate > 0.28) {
    items.push({
      id: 'cogs',
      title: '原価率の改善',
      score: Math.min(95, Math.round(50 + (cogsRate - 0.28) * 500)),
      urgency: cogsRate > 0.35 ? '高' : '中',
      detail: `売上原価率 ${(cogsRate * 100).toFixed(1)}%（目安 28%）`,
      action: '仕入れコスト見直し・外注比率の最適化・自社施行比率の向上',
      annualEffect: Math.round(revenue * (cogsRate - 0.28) * 0.3),
    })
  }

  // 4. 販管費削減（60% 超）
  if (sgaRate > 0.60) {
    items.push({
      id: 'sga',
      title: '販管費の効率化',
      score: Math.min(90, Math.round(40 + (sgaRate - 0.60) * 300)),
      urgency: sgaRate > 0.75 ? '高' : '中',
      detail: `販管費率 ${(sgaRate * 100).toFixed(1)}%`,
      action: 'シフト最適化・間接費の見直し・DX化による業務効率向上',
      annualEffect: Math.round(revenue * (sgaRate - 0.60) * 0.2),
    })
  }

  // 5. CF強化
  if (opCF < revenue * 0.05) {
    items.push({
      id: 'cashflow',
      title: 'キャッシュポジション強化',
      score: Math.min(80, Math.round(30 + Math.max(0, revenue * 0.05 - opCF) / Math.max(1, revenue) * 300)),
      urgency: opCF < 0 ? '高' : '低',
      detail: `営業CF ${opCF.toFixed(0)}百万円（売上比 ${(opCF / Math.max(1, revenue) * 100).toFixed(1)}%）`,
      action: '売掛金回収サイクル短縮・在庫最適化・不要資産の現金化',
      annualEffect: Math.round(revenue * 0.005),
    })
  }

  // スコア降順
  return items.sort((a, b) => b.score - a.score)
}

// ===== bundle から財務健全性レーダーを動的生成（0-100スコア）=====
function buildRadarData(bundle: FinancialBundle) {
  const last = (
    rows: readonly { label: string; values: readonly number[] }[],
    label: string,
  ) => rows.find((r) => r.label === label)?.values.at(-1) ?? 0

  const revenue       = last(bundle.profitLoss, '売上高')
  const prevRevenue   = bundle.profitLoss.find((r) => r.label === '売上高')?.values.at(-2) ?? 0
  const opProfit      = last(bundle.profitLoss, '営業利益')
  const sga           = last(bundle.profitLoss, '販売費及び一般管理費')
  const currentAssets = last(bundle.balanceSheet.assets,               '流動資産')
  const currentLiab   = last(bundle.balanceSheet.liabilitiesAndEquity, '流動負債')
  const equity        = last(bundle.balanceSheet.liabilitiesAndEquity, '純資産')
  const totalAssets   = last(bundle.balanceSheet.assets,               '資産合計')
  const opMargin      = revenue > 0 ? opProfit / revenue : 0
  const revenueGrowth = prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue : 0
  const currentRatio  = currentLiab > 0 ? currentAssets / currentLiab : 0
  const equityRatio   = totalAssets > 0 ? equity / totalAssets : 0
  const sgaRate       = revenue > 0 ? sga / revenue : 1

  // 各指標を 0-100 にスケーリング
  // 収益性: opMargin -20% → 0, 0% → 40, +20% → 100
  const profitabilityScore = Math.round(clamp((opMargin + 0.20) / 0.40 * 100))
  // 安全性: equityRatio -50% → 0, 0% → 30, +50% → 100
  const safetyScore        = Math.round(clamp((equityRatio + 0.50) / 1.00 * 100))
  // 成長性: revenueGrowth -20% → 0, 0% → 50, +20% → 100
  const growthScore        = Math.round(clamp((revenueGrowth + 0.20) / 0.40 * 100))
  // 効率性: sgaRate 高いほど低スコア (85% → 0, 50% → 100)
  const efficiencyScore    = Math.round(clamp((0.85 - sgaRate) / 0.35 * 100))
  // 流動性: currentRatio 0 → 0, 3.0 → 100
  const liquidityScore     = Math.round(clamp(currentRatio / 3.0 * 100))
  return [
    { subject: '収益性', actual: profitabilityScore, benchmark: 60 },
    { subject: '安全性', actual: safetyScore,         benchmark: 60 },
    { subject: '成長性', actual: growthScore,          benchmark: 55 },
    { subject: '効率性', actual: efficiencyScore,      benchmark: 60 },
    { subject: '流動性', actual: liquidityScore,       benchmark: 60 },
  ]
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v))
}

function scoreBarWidth(score: number): string {
  return `${Math.min(100, Math.max(0, score))}%`
}

function urgencyClass(urgency: string): string {
  if (urgency === '高') return 'strategy-urgency-high'
  if (urgency === '中') return 'strategy-urgency-mid'
  return 'strategy-urgency-low'
}

export function StrategyTab({ bundle }: Props) {
  const base           = useMemo(() => buildForecastBase(bundle),      [bundle])
  const defaultParams  = useMemo(() => buildDefaultSliderParams(base), [base])
  const optimizedParams = useMemo(() => buildOptimizedParams(base),    [base])
  const improvements   = useMemo(() => buildImprovements(bundle),      [bundle])
  const radarData      = useMemo(() => buildRadarData(bundle),         [bundle])

  const baseline  = useMemo(() => calcForecastHorizon(defaultParams,  base), [defaultParams,  base])
  const optimized = useMemo(() => calcForecastHorizon(optimizedParams, base), [optimizedParams, base])

  const baselineBe  = findBreakEvenYear(baseline)
  const optimizedBe = findBreakEvenYear(optimized)
  const totalEffect = improvements.reduce((s, i) => s + i.annualEffect, 0)

  return (
    <div className="strategy-tab panel-grid">
      <section className="strategy-section">
        <h2 className="section-title">改善インパクト分析</h2>
        <ol className="strategy-list">
          {improvements.map((item, idx) => (
            <li key={item.id} className="strategy-card">
              <div className="strategy-card-head">
                <span className="strategy-rank">{idx + 1}</span>
                <span className="strategy-card-title">{item.title}</span>
                <span className={`strategy-urgency ${urgencyClass(item.urgency)}`}>
                  {item.urgency}
                </span>
              </div>
              <div className="strategy-score-row">
                <span className="strategy-score-label">インパクト</span>
                <div className="strategy-score-track" aria-hidden>
                  <span className="strategy-score-fill" style={{ width: scoreBarWidth(item.score) }} />
                </div>
                <span className="strategy-score-num">{item.score}点</span>
              </div>
              <p className="strategy-detail">{item.detail}</p>
              <p className="strategy-action"><strong>推奨:</strong> {item.action}</p>
              <p className="strategy-effect">
                年間改善効果（試算）: <strong>{item.annualEffect}</strong> 百万円
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="strategy-section chart-card">
        <h2 className="section-title chart-card-heading">財務健全性スコア（レーダー）</h2>
        <div className="chart-body">
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text)', fontSize: 12 }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: 'var(--text)', fontSize: 10 }}
              />
              <Tooltip contentStyle={tooltipSurface} />
              <Legend />
              <Radar name="現状"   dataKey="actual"    stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              <Radar name="業界標準" dataKey="benchmark" stroke="#6b7280" fill="#6b7280" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="strategy-section strategy-sim">
        <h2 className="section-title">改善シミュレーション（全施策実行想定）</h2>
        <p className="strategy-sim-lead">
          施策の年間効果合計（試算）: <strong>{totalEffect}</strong> 百万円相当。
          下表はデフォルト前提と最適化前提の営業利益予測です。
        </p>
        <div className="strategy-sim-grid">
          <div className="strategy-sim-col">
            <h3>現状前提（Forecast 初期値）</h3>
            <table className="fin-table strategy-sim-table">
              <thead>
                <tr><th>期</th><th>営業利益（百万円）</th></tr>
              </thead>
              <tbody>
                {baseline.map((r) => (
                  <tr key={r.period}>
                    <th scope="row">{r.period}</th>
                    <td className="fin-num">{formatForecastSummary(r.operatingProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {baselineBe ? (
              <p className="break-even-badge">黒字転換（営業利益）: {baselineBe}</p>
            ) : (
              <p className="strategy-sim-muted">現状前提では3期内に営業黒字転換なし</p>
            )}
          </div>
          <div className="strategy-sim-col strategy-sim-col-opt">
            <h3>全施策実行後（最適化前提）</h3>
            <table className="fin-table strategy-sim-table">
              <thead>
                <tr><th>期</th><th>営業利益（百万円）</th></tr>
              </thead>
              <tbody>
                {optimized.map((r) => (
                  <tr key={r.period}>
                    <th scope="row">{r.period}</th>
                    <td className={`fin-num ${r.operatingProfit > 0 ? 'strategy-positive' : ''}`}>
                      {formatForecastSummary(r.operatingProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {optimizedBe ? (
              <p className="break-even-badge break-even-badge-strong">
                黒字転換（営業利益）: {optimizedBe}
              </p>
            ) : (
              <p className="strategy-sim-muted">最適化後も3期内に営業黒字転換なし</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
