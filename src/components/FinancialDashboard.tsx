import { useState } from 'react'
import { useFinancials } from '../context/FinancialDataContext'
import { kpiGlossary } from '../data/kpiGlossary'
import { formatMillionYen } from '../lib/format'
import { AmountTable } from './AmountTable'
import { KpiCard } from './KpiCard'
import {
  BSLiabilitiesEquityChart,
  BSStackChart,
  CFActivityChart,
  PLTrendChart,
} from './TrendCharts'

type TabId = 'bs' | 'pl' | 'cf'

const tabs: { id: TabId; label: string; sub: string }[] = [
  { id: 'bs', label: 'BS', sub: '貸借対照表' },
  { id: 'pl', label: 'PL', sub: '損益計算書' },
  { id: 'cf', label: 'CF', sub: 'キャッシュ・フロー計算書' },
]

export function FinancialDashboard() {
  const [tab, setTab] = useState<TabId>('pl')
  const { bundle, dataSource, loadError } = useFinancials()
  const { balanceSheet, profitLoss, cashFlow, kpis, periods } = bundle

  const kpiValues: readonly string[] = [
    `${kpis.revenueGrowthYoY.toFixed(1)}%`,
    `${kpis.operatingMarginPct.toFixed(1)}%`,
    `${kpis.equityRatioPct.toFixed(1)}%`,
    formatMillionYen(kpis.freeCashFlow),
  ]

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">財務ダッシュボード</h1>
          <p className="dash-sub">BS / PL / CF のサマリーと推移</p>
        </div>
        <p className="unit-pill">単位: 百万円</p>
      </header>

      {dataSource === 'custom' ? (
        <p className="data-banner data-banner-ok" role="status">
          自社データ（<code className="data-banner-code">public/financials.json</code>
          または <code className="data-banner-code">VITE_FINANCIALS_URL</code>
          ）を表示しています。
        </p>
      ) : null}
      {loadError ? (
        <p className="data-banner data-banner-err" role="alert">
          データの読み込みに失敗しました: {loadError}（サンプルを表示）
        </p>
      ) : null}

      <section className="kpi-grid" aria-label="主要指標">
        {kpiGlossary.map((g, i) => (
          <KpiCard
            key={g.id}
            glossaryId={g.id}
            title={g.title}
            explanation={g.explanation}
          >
            <p className="kpi-value">{kpiValues[i]}</p>
          </KpiCard>
        ))}
      </section>

      <nav className="tab-bar" aria-label="表示切替">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn ${tab === t.id ? 'tab-btn-active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
          >
            <span className="tab-main">{t.label}</span>
            <span className="tab-sub">{t.sub}</span>
          </button>
        ))}
      </nav>

      <div className="tab-panels">
        {tab === 'bs' && (
          <div className="panel" role="tabpanel">
            <div className="panel-grid">
              <div className="bs-charts-row">
                <BSStackChart />
                <BSLiabilitiesEquityChart />
              </div>
              <div className="dual-tables">
                <AmountTable
                  rows={balanceSheet.assets}
                  periods={periods}
                  caption="資産の部"
                />
                <AmountTable
                  rows={balanceSheet.liabilitiesAndEquity}
                  periods={periods}
                  caption="負債・純資産の部"
                />
              </div>
            </div>
          </div>
        )}
        {tab === 'pl' && (
          <div className="panel" role="tabpanel">
            <div className="panel-grid">
              <PLTrendChart />
              <AmountTable rows={profitLoss} periods={periods} />
            </div>
          </div>
        )}
        {tab === 'cf' && (
          <div className="panel" role="tabpanel">
            <div className="panel-grid">
              <CFActivityChart />
              <AmountTable rows={cashFlow} periods={periods} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
