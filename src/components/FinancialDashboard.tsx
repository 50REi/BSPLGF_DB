import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFinancials } from '../context/FinancialDataContext'
import { kpiGlossary } from '../data/kpiGlossary'
import { formatMillionYen } from '../lib/format'
import type { FinancialBundle } from '../types/financials'
import { AmountTable } from './AmountTable'
import { BepSection } from './BepSection'
import { CockpitTab } from './CockpitTab'
import { ForecastTab } from './ForecastTab'
import { KpiCard } from './KpiCard'
import { StrategyTab } from './StrategyTab'
import { ToastContainer, type ToastItem } from './Toast'
import { UploadModal } from './UploadModal'
import {
  BSBalanceChart,
  BSDonutChart,
  CFActivityChart,
  PLDonutChart,
  PLTrendChart,
  type YearRange,
} from './TrendCharts'

type TabId = 'cockpit' | 'bs' | 'pl' | 'cf' | 'forecast' | 'strategy'
type Granularity = 'annual' | 'monthly'

const tabs: { id: TabId; label: string; sub: string }[] = [
  { id: 'cockpit',   label: 'Cockpit',   sub: '経営コックピット' },
  { id: 'bs',        label: 'BS',        sub: '貸借対照表' },
  { id: 'pl',        label: 'PL',        sub: '損益計算書' },
  { id: 'cf',        label: 'CF',        sub: 'キャッシュ・フロー計算書' },
  { id: 'forecast',  label: 'Forecast',  sub: '業績予想' },
  { id: 'strategy',  label: 'Strategy',  sub: '改善優先度' },
]

// ===== セグメントコントロール =====
function SegmentControl({
  value,
  onChange,
}: {
  value: Granularity
  onChange: (v: Granularity) => void
}) {
  return (
    <div className="seg-ctrl" role="group" aria-label="表示粒度">
      {(['annual', 'monthly'] as const).map((g) => (
        <button
          key={g}
          type="button"
          className={`seg-btn ${value === g ? 'seg-btn-active' : ''}`}
          onClick={() => onChange(g)}
          aria-pressed={value === g}
        >
          {g === 'annual' ? '年次' : '月次'}
        </button>
      ))}
    </div>
  )
}

// ===== 年度レンジコントロール =====
function YearRangeControl({
  value,
  onChange,
}: {
  value: YearRange
  onChange: (v: YearRange) => void
}) {
  return (
    <div className="seg-ctrl" role="group" aria-label="表示年数">
      {(['recent5', 'all'] as const).map((r) => (
        <button
          key={r}
          type="button"
          className={`seg-btn ${value === r ? 'seg-btn-active' : ''}`}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
        >
          {r === 'recent5' ? '直近5年' : '全期間'}
        </button>
      ))}
    </div>
  )
}

// ===== 月次データなし表示 =====
function NoMonthlyData() {
  return (
    <div className="no-monthly-msg">
      <p className="no-monthly-msg-title">月次データがありません</p>
      <p className="no-monthly-msg-sub">
        ヘッダーの「📊 月次CSV」ボタンからCSVをアップロードするか、PDFから月次財務諸表を読み込んでください。
      </p>
    </div>
  )
}

// ===== メインダッシュボード =====
export function FinancialDashboard() {
  const [tab, setTab] = useState<TabId>('cockpit')
  const [granularity, setGranularity] = useState<Granularity>('annual')
  const [yearRange, setYearRange] = useState<YearRange>('recent5')
  const [modalType, setModalType] = useState<'pdf' | 'csv' | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const {
    bundle, loadError,
    pdfStatus, pdfFileName, pdfError,
    csvStatus, csvFileName, csvError,
  } = useFinancials()

  const { kpis } = bundle

  // ===== トースト管理 =====
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now(), type, message }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // PDF ステータス変化を監視
  const prevPdfStatus = useRef(pdfStatus)
  useEffect(() => {
    if (pdfStatus === prevPdfStatus.current) return
    prevPdfStatus.current = pdfStatus
    if (pdfStatus === 'success') {
      addToast('success', `${pdfFileName} 読み込み完了`)
      setModalType(null)
    } else if (pdfStatus === 'error') {
      addToast('error', `エラー：${pdfError}`)
    }
  }, [pdfStatus, pdfFileName, pdfError, addToast])

  // CSV ステータス変化を監視
  const prevCsvStatus = useRef(csvStatus)
  useEffect(() => {
    if (csvStatus === prevCsvStatus.current) return
    prevCsvStatus.current = csvStatus
    if (csvStatus === 'success') {
      addToast('success', `${csvFileName} 読み込み完了`)
      setModalType(null)
    } else if (csvStatus === 'error') {
      addToast('error', `エラー：${csvError}`)
    }
  }, [csvStatus, csvFileName, csvError, addToast])

  // 粒度に応じたアクティブ bundle（月次がない場合は年次にフォールバック）
  const activeBundle = useMemo((): FinancialBundle => {
    if (granularity === 'monthly' && bundle.monthly) {
      return {
        ...bundle,
        periods: bundle.monthly.periods,
        balanceSheet: bundle.monthly.balanceSheet,
        profitLoss: bundle.monthly.profitLoss,
        cashFlow: bundle.monthly.cashFlow,
      }
    }
    return bundle
  }, [bundle, granularity])

  const hasMonthly = Boolean(bundle.monthly)
  const showNoMonthly = granularity === 'monthly' && !hasMonthly

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
          <p className="dash-sub">BS / PL / CF / Forecast / Strategy</p>
        </div>
        <div className="dash-header-actions">
          <button
            type="button"
            className="btn-upload-pdf"
            onClick={() => setModalType('pdf')}
            disabled={pdfStatus === 'loading'}
            aria-busy={pdfStatus === 'loading'}
          >
            {pdfStatus === 'loading' ? (
              <><span className="spinner" aria-hidden="true" /> 解析中...</>
            ) : '📄 決算書PDF'}
          </button>
          <button
            type="button"
            className="btn-upload-csv"
            onClick={() => setModalType('csv')}
          >
            📊 月次CSV
          </button>
          <p className="unit-pill">単位: 百万円</p>
        </div>
      </header>

      {loadError && (
        <p className="data-banner data-banner-err" role="alert">
          データの読み込みに失敗しました: {loadError}（サンプルを表示）
        </p>
      )}

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
        {tab === 'cockpit' && (
          <div className="panel" role="tabpanel">
            <CockpitTab bundle={bundle} />
          </div>
        )}

        {tab === 'bs' && (
          <div className="panel" role="tabpanel">
            <div className="panel-tab-header">
              <YearRangeControl value={yearRange} onChange={setYearRange} />
            </div>
            {granularity === 'monthly' && (
              <p className="bs-annual-note">BSは年次表示のみ対応しています</p>
            )}
            <div className="panel-grid">
              <BSBalanceChart bundle={bundle} yearRange={yearRange} />
              <BSDonutChart bundle={bundle} />
              <div className="dual-tables">
                <AmountTable
                  rows={bundle.balanceSheet.assets}
                  periods={bundle.periods}
                  caption="資産の部"
                />
                <AmountTable
                  rows={bundle.balanceSheet.liabilitiesAndEquity}
                  periods={bundle.periods}
                  caption="負債・純資産の部"
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'pl' && (
          <div className="panel" role="tabpanel">
            <div className="panel-tab-header">
              <SegmentControl value={granularity} onChange={setGranularity} />
              {granularity === 'annual' && (
                <YearRangeControl value={yearRange} onChange={setYearRange} />
              )}
            </div>
            {showNoMonthly ? (
              <NoMonthlyData />
            ) : (
              <div className="panel-grid">
                <PLTrendChart
                  bundle={activeBundle}
                  yearRange={granularity === 'annual' ? yearRange : undefined}
                />
                <PLDonutChart bundle={activeBundle} />
                <AmountTable rows={activeBundle.profitLoss} periods={activeBundle.periods} />
                <BepSection bundle={activeBundle} />
              </div>
            )}
          </div>
        )}

        {tab === 'cf' && (
          <div className="panel" role="tabpanel">
            <div className="panel-tab-header">
              <SegmentControl value={granularity} onChange={setGranularity} />
              {granularity === 'annual' && (
                <YearRangeControl value={yearRange} onChange={setYearRange} />
              )}
            </div>
            {showNoMonthly ? (
              <NoMonthlyData />
            ) : (
              <div className="panel-grid">
                <CFActivityChart
                  bundle={activeBundle}
                  yearRange={granularity === 'annual' ? yearRange : undefined}
                />
                <AmountTable rows={activeBundle.cashFlow} periods={activeBundle.periods} />
              </div>
            )}
          </div>
        )}

        {tab === 'forecast' && (
          <div className="panel" role="tabpanel">
            <ForecastTab bundle={bundle} />
          </div>
        )}

        {tab === 'strategy' && (
          <div className="panel" role="tabpanel">
            <StrategyTab bundle={bundle} />
          </div>
        )}
      </div>

      {modalType && (
        <UploadModal type={modalType} onClose={() => setModalType(null)} />
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
