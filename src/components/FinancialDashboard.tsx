import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFinancials } from '../context/FinancialDataContext'
import { kpiGlossary } from '../data/kpiGlossary'
import { formatMillionYen } from '../lib/format'
import type { FinancialBundle } from '../types/financials'
import { AmountTable } from './AmountTable'
import { ApiKeySetup, LS_KEY, LS_KEY_COMPANY, getLicensePlan, capsOf } from './ApiKeySetup'
import { BepSection } from './BepSection'
import { CockpitTab } from './CockpitTab'
import { ForecastTab } from './ForecastTab'
import { KpiCard } from './KpiCard'
import { StrategyTab } from './StrategyTab'
import { ToastContainer, type ToastItem } from './Toast'
import { UploadModal } from './UploadModal'
import { BSTab } from './BSTab'
import {
  CFActivityChart,
  PLDonutChart,
  PLTrendChart,
  type YearRange,
} from './TrendCharts'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const AXIS_TICK  = { fill: '#94a3b8', fontSize: 12 } as const
const AXIS_TICK_S = { fill: '#94a3b8', fontSize: 11 } as const
const GRID_STROKE = '#2d4057'
const tooltipSurface = { background: '#243447', border: '1px solid #2d4057', borderRadius: 8, color: '#ffffff', fontSize: '0.8rem' }

// プランバッジ表示（ライト/スタンダード/プレミアム）
const PLAN_BADGE = {
  lite:     { label: 'LITE',     title: 'Liteプラン認証済み',     grad: 'linear-gradient(135deg,#0d9488 0%,#10b981 100%)', shadow: '0 0 0 1px rgba(16,185,129,0.5), 0 0 12px rgba(16,185,129,0.35)' },
  standard: { label: 'STANDARD', title: 'Standardプラン認証済み', grad: 'linear-gradient(135deg,#0284c7 0%,#06b6d4 100%)', shadow: '0 0 0 1px rgba(6,182,212,0.5), 0 0 12px rgba(6,182,212,0.35)' },
  premium:  { label: 'PREMIUM',  title: 'Premiumプラン認証済み',  grad: 'linear-gradient(135deg,#7c3aed 0%,#c026d3 100%)', shadow: '0 0 0 1px rgba(192,38,211,0.5), 0 0 12px rgba(192,38,211,0.35)' },
} as const

// ===== 機能ロック表示（プランに応じて文言出し分け）=====
function FeatureLock({ need, feature }: { need: 'standard' | 'premium'; feature: string }) {
  const label = need === 'premium' ? 'プレミアム' : 'スタンダード'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '10px', padding: '56px 24px', textAlign: 'center',
      background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12,
      color: 'var(--text)',
    }}>
      <div style={{ fontSize: '2rem' }} aria-hidden="true">🔒</div>
      <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-h)' }}>{label}限定機能です</p>
      <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
        {feature}は{label}プラン以上でご利用いただけます。<br />
        ⚙️ からライセンスキーをアップグレードしてください。
      </p>
    </div>
  )
}

// ===== 近日提供（未実装・表示のみ・プレミアム画面内）=====
function ComingSoonPanel() {
  const items = ['健全性アラート・自動通知', '定期レポートの自動配信', '複数社（グループ）管理']
  return (
    <section style={{ marginTop: 20 }} aria-label="近日提供">
      <h3 style={{ fontSize: '0.95rem', color: 'var(--text-h)', marginBottom: 10 }}>🔜 近日提供予定（プレミアム）</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {items.map((it) => (
          <div key={it} style={{
            position: 'relative', padding: '18px 16px', borderRadius: 10,
            background: 'var(--surface)', border: '1px solid var(--border)', opacity: 0.65,
          }}>
            <span style={{
              position: 'absolute', top: 10, right: 10, fontSize: '0.62rem', fontWeight: 700,
              background: '#f59e0b', color: '#3b2600', padding: '2px 8px', borderRadius: 999,
            }}>近日提供</span>
            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{it}</p>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>準備中（現在はご利用いただけません）</p>
          </div>
        ))}
      </div>
    </section>
  )
}

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
  const [showApiSetup, setShowApiSetup] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(() => !!localStorage.getItem(LS_KEY))
  const [plan, setPlan] = useState<'free'|'lite'|'standard'|'premium'>(() => getLicensePlan())
  const [reportLoading, setReportLoading] = useState(false)
  const [storeTab, setStoreTab] = useState<string>('all')
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [storeNameInput, setStoreNameInput] = useState('')
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const {
    bundle, dataSource, loadError,
    pdfStatus, pdfFileName, pdfError,
    csvStatus, csvFileName, csvError,
    clearAll, deletePeriod, mergeWarning, clearMergeWarning,
    loadStoreFromPdf, storeStatus, storeFileName, storeError, deleteStore,
  } = useFinancials()

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

  // mergeWarning を監視してトースト発火
  const prevMergeWarning = useRef<string | null>(null)
  useEffect(() => {
    if (!mergeWarning || mergeWarning === prevMergeWarning.current) return
    prevMergeWarning.current = mergeWarning
    const isError = mergeWarning.startsWith('error:')
    const msg = mergeWarning.replace(/^(warn|error):/, '')
    addToast(isError ? 'error' : 'success', msg)
    clearMergeWarning()
  }, [mergeWarning, addToast, clearMergeWarning])

  // ===== 個別期削除ハンドラー =====
  const handleDeletePeriod = useCallback((period: string) => {
    const isLast = bundle.periods.length === 1
    const msg = isLast
      ? `「${period}」を削除すると全データがリセットされ、サンプル表示に戻ります。削除してよろしいですか？`
      : `「${period}」のデータを削除します。よろしいですか？`
    if (!window.confirm(msg)) return
    deletePeriod(period)
  }, [bundle.periods.length, deletePeriod])

  // 機能ゲーティング（確定マトリクス）
  const caps = capsOf(plan)
  // ローカル永続保存の対象プラン（FP-STD / FP-PRE）
  const persistEnabled = caps.persist

  // ===== 全クリアハンドラー（STD/PREは保存データも消去） =====
  const handleClearAll = useCallback(() => {
    const msg = persistEnabled
      ? 'ブラウザに保存された永続データを含め、全ての財務データを削除してサンプル表示に戻します。よろしいですか？'
      : '全ての財務データを削除します。よろしいですか？'
    if (!window.confirm(msg)) return
    clearAll()
  }, [clearAll, persistEnabled])

  // ===== 経営レポート生成 =====
  const handleGenerateReport = useCallback(async () => {
    const apiKey = localStorage.getItem(LS_KEY)
    if (!apiKey) { setShowApiSetup(true); return }
    const companyName = localStorage.getItem(LS_KEY_COMPANY) ?? '（会社名未設定）'
    const latestPeriod = bundle.periods.at(-1) ?? '最新期'

    const getVal = (rows: ReadonlyArray<{label: string; values: readonly number[]}>, label: string) =>
      rows.find(r => r.label === label)?.values.at(-1) ?? 0
    const getPrev = (rows: ReadonlyArray<{label: string; values: readonly number[]}>, label: string) =>
      rows.find(r => r.label === label)?.values.at(-2) ?? null

    const revenue    = getVal(bundle.profitLoss, '売上高')
    const prevRev    = getPrev(bundle.profitLoss, '売上高')
    const opProfit   = getVal(bundle.profitLoss, '営業利益')
    const netProfit  = getVal(bundle.profitLoss, '当期純利益')
    const totalAssets= getVal(bundle.balanceSheet.assets, '資産合計')
    const equity     = getVal(bundle.balanceSheet.liabilitiesAndEquity, '純資産')
    const longDebt   = getVal(bundle.balanceSheet.liabilitiesAndEquity, '長期借入金')
    const opCF       = getVal(bundle.cashFlow, '営業活動によるキャッシュ・フロー')
    const revenueYoY = prevRev && prevRev !== 0 ? ((revenue - prevRev) / prevRev * 100).toFixed(1) : 'N/A'
    const opMargin   = revenue > 0 ? (opProfit / revenue * 100).toFixed(1) : '0.0'
    const equityRatio= totalAssets !== 0 ? (equity / totalAssets * 100).toFixed(1) : '0.0'

    const dataText = `
会社名：${companyName}
対象期：${latestPeriod}
売上高：${revenue}百万円（前年比：${revenueYoY}%）
営業利益：${opProfit}百万円（営業利益率：${opMargin}%）
当期純利益：${netProfit}百万円
総資産：${totalAssets}百万円
純資産：${equity}百万円（自己資本比率：${equityRatio}%）
長期借入金：${longDebt}百万円
営業CF：${opCF}百万円
`
    setReportLoading(true)
    try {
      const isProd = window.location.hostname !== 'localhost'
      const reportUrl = isProd ? '/api/claude' : 'https://api.anthropic.com/v1/messages'
      const res = await fetch(reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(!isProd ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: 'あなたは中小企業の財務分析の専門家です。提供された財務データを元に、経営者向けの簡潔でわかりやすい経営財務レポートを作成してください。専門用語には括弧で説明を加えてください。',
          messages: [{
            role: 'user',
            content: `以下の財務データを元に経営財務レポートを作成してください。

${dataText}

以下の構成でHTML形式（本文部分のみ・<body>タグ不要）で出力してください：
<h2>1. 経営サマリー</h2>
<p>（3〜5行で今期の経営状況を総括）</p>
<h2>2. 損益分析</h2>
<p>（売上・利益トレンドの分析コメント）</p>
<h2>3. 財務安全性</h2>
<p>（BS・借入状況・自己資本比率の分析）</p>
<h2>4. 重点課題TOP3</h2>
<ol><li>...</li><li>...</li><li>...</li></ol>
<h2>5. 来期への提言</h2>
<p>（具体的な改善アクション）</p>`
          }]
        })
      })
      const data = await res.json()
      const content = data.content?.filter((b: {type: string}) => b.type === 'text')
        .map((b: {text: string}) => b.text).join('') ?? ''

      const today = new Date().toLocaleDateString('ja-JP')
      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>経営財務レポート - ${companyName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
  .report-header { border-bottom: 3px solid #00b4b4; padding-bottom: 16px; margin-bottom: 24px; }
  .report-title { font-size: 20pt; font-weight: 700; color: #00b4b4; }
  .report-meta { font-size: 10pt; color: #555; margin-top: 6px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
  .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
  .kpi-label { font-size: 8pt; color: #64748b; margin-bottom: 4px; }
  .kpi-value { font-size: 14pt; font-weight: 700; color: #0f172a; }
  h2 { font-size: 12pt; font-weight: 700; color: #00b4b4; border-left: 4px solid #00b4b4; padding-left: 10px; margin: 20px 0 8px; }
  p { line-height: 1.8; margin-bottom: 8px; }
  ol { padding-left: 20px; line-height: 2; }
  .report-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; text-align: right; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="report-header">
  <div class="report-title">経営財務レポート</div>
  <div class="report-meta">${companyName}　｜　対象期：${latestPeriod}　｜　作成日：${today}</div>
</div>
<div class="kpi-grid">
  <div class="kpi-card"><div class="kpi-label">売上高</div><div class="kpi-value">${revenue}百万円</div></div>
  <div class="kpi-card"><div class="kpi-label">営業利益率</div><div class="kpi-value">${opMargin}%</div></div>
  <div class="kpi-card"><div class="kpi-label">自己資本比率</div><div class="kpi-value">${equityRatio}%</div></div>
  <div class="kpi-card"><div class="kpi-label">長期借入金</div><div class="kpi-value">${longDebt}百万円</div></div>
</div>
${content}
<div class="report-footer">Powered by FinancePulse / 5web.jp　｜　本レポートはAIによる自動生成です。最終判断は専門家にご確認ください。</div>
</body>
</html>`

      setReportHtml(html)
    } catch (e) {
      addToast('error', 'レポート生成に失敗しました')
    } finally {
      setReportLoading(false)
    }
  }, [bundle, addToast])

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

  const kpiValues: readonly string[] = useMemo(() => {
    const lastOf = (rows: ReadonlyArray<{ label: string; values: readonly number[] }>, label: string) =>
      rows.find((r) => r.label === label)?.values.at(-1) ?? 0

    const revenue     = lastOf(bundle.profitLoss, '売上高')
    const prevRevenue = bundle.profitLoss.find((r) => r.label === '売上高')?.values.at(-2) ?? 0
    const opProfit    = lastOf(bundle.profitLoss, '営業利益')
    const equity      = lastOf(bundle.balanceSheet.liabilitiesAndEquity, '純資産')
    const totalAssets = lastOf(bundle.balanceSheet.assets, '資産合計')
    const opCF        = lastOf(bundle.cashFlow, '営業活動によるキャッシュ・フロー')
    const invCF       = lastOf(bundle.cashFlow, '投資活動によるキャッシュ・フロー')

    const revenueGrowth = prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue * 100 : 0
    const opMargin      = revenue > 0 ? opProfit / revenue * 100 : 0
    const equityRatio   = totalAssets !== 0 ? equity / totalAssets * 100 : 0
    const fcf           = opCF + invCF

    return [
      `${revenueGrowth.toFixed(1)}%`,
      `${opMargin.toFixed(1)}%`,
      `${equityRatio.toFixed(1)}%`,
      formatMillionYen(fcf),
    ]
  }, [bundle])

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">FinancePulse</h1>
          <p className="dash-sub">BS / PL / CF / Forecast / Strategy</p>
          {plan !== 'free' && (
            <span title={PLAN_BADGE[plan].title} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '6px',
              padding: '3px 10px 3px 7px',
              borderRadius: '20px',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              background: PLAN_BADGE[plan].grad,
              color: '#fff',
              boxShadow: PLAN_BADGE[plan].shadow,
              cursor: 'default',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1l2.39 3.31L18 3.27l.74 3.99 3.99.74-1.04 3.61L24 14l-3.31 2.39L21.73 20l-3.99-.74-.74 3.99-3.61-1.04L12 24l-2.39-3.31L6 21.73l-.74-3.99-3.99-.74 1.04-3.61L0 10l3.31-2.39L2.27 4l3.99.74L7 .75l3.61 1.04z" opacity="0.95"/>
                <path d="M9 12.5l2 2 4-4.5" stroke="#0a1628" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              {PLAN_BADGE[plan].label}
            </span>
          )}
        </div>
        <div className="dash-header-actions">
          <button
            type="button"
            className="btn-report"
            onClick={handleGenerateReport}
            disabled={reportLoading || dataSource === 'sample' || !caps.report}
            title={!caps.report ? 'ライト以上のプランで利用可能' : dataSource === 'sample' ? 'PDFを読み込んでから使用できます' : '経営財務レポートを生成'}
          >
            {reportLoading ? <><span className="spinner" aria-hidden="true" /> 生成中...</> : '📊 経営レポート'}
          </button>
          <button
            type="button"
            className="btn-upload-pdf"
            onClick={() => caps.pdf && setModalType('pdf')}
            disabled={pdfStatus === 'loading' || !caps.pdf}
            aria-busy={pdfStatus === 'loading'}
            title={!caps.pdf ? 'ライト以上のプランで利用可能' : '決算書PDFを読み込む'}
          >
            {pdfStatus === 'loading' ? (
              <><span className="spinner" aria-hidden="true" /> 解析中...</>
            ) : caps.pdf ? '📄 決算書PDF' : '🔒 決算書PDF'}
          </button>
          <button
            type="button"
            className="btn-upload-csv"
            onClick={() => caps.csv && setModalType('csv')}
            disabled={!caps.csv}
            title={!caps.csv ? 'スタンダード以上のプランで利用可能' : '月次CSVを取り込む'}
          >
            {caps.csv ? '📊 月次CSV' : '🔒 月次CSV'}
          </button>
          {dataSource !== 'sample' && (
            <button
              type="button"
              className="btn-clear-all"
              onClick={handleClearAll}
              title={persistEnabled ? '保存データ（IndexedDB）を含め全データを削除' : '全データを削除'}
            >
              {persistEnabled ? '🗑 保存データをクリア' : '🗑 全クリア'}
            </button>
          )}
          <button
            type="button"
            className="btn-settings"
            onClick={() => setShowApiSetup(true)}
            aria-label="APIキー設定"
            title="APIキー設定"
          >
            ⚙️
            {hasApiKey && <span className="btn-settings-dot" aria-hidden="true" />}
          </button>
          <p className="unit-pill">単位: 百万円</p>
        </div>
      </header>

      {loadError && (
        <p className="data-banner data-banner-err" role="alert">
          データの読み込みに失敗しました: {loadError}（サンプルを表示）
        </p>
      )}

      {dataSource !== 'sample' && (
        <section className="period-list-section" aria-label="蓄積期リスト">
          <span className="period-list-label">蓄積データ：</span>
          <div className="period-tags">
            {bundle.periods.map((period) => (
              <span key={period} className="period-tag">
                {period}
                <button
                  type="button"
                  className="period-tag-del"
                  onClick={() => handleDeletePeriod(period)}
                  aria-label={`${period}を削除`}
                  title={`${period}を削除`}
                >
                  🗑
                </button>
              </span>
            ))}
          </div>
        </section>
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
            {granularity === 'monthly' && (
              <p className="bs-annual-note">BSは年次表示のみ対応しています</p>
            )}
            <BSTab bundle={bundle} mode="cockpit" />
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
                {/* 店舗タブ（プレミアムのみ） */}
                {caps.stores && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setStoreTab('all')}
                      style={{ padding:'6px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight: storeTab === 'all' ? 700 : 400, background: storeTab === 'all' ? 'var(--accent)' : 'var(--surface)', color: storeTab === 'all' ? '#fff' : 'var(--text)', fontSize:'0.85rem' }}
                    >全社</button>
                    {(bundle.stores ?? []).map(s => (
                      <span key={s.storeName} style={{ display:'inline-flex', alignItems:'center', gap:'4px' }}>
                        <button
                          type="button"
                          onClick={() => setStoreTab(s.storeName)}
                          style={{ padding:'6px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight: storeTab === s.storeName ? 700 : 400, background: storeTab === s.storeName ? '#7c3aed' : 'var(--surface)', color: storeTab === s.storeName ? '#fff' : 'var(--text)', fontSize:'0.85rem' }}
                        >{s.storeName}</button>
                        <button type="button" onClick={() => { deleteStore(s.storeName); if (storeTab === s.storeName) setStoreTab('all') }} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:'0.8rem', padding:'2px' }} title="削除">✕</button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowStoreModal(true)}
                      style={{ padding:'6px 12px', borderRadius:'20px', border:'1px dashed #475569', cursor:'pointer', background:'transparent', color:'#94a3b8', fontSize:'0.82rem' }}
                    >＋ 店舗追加</button>
                  </div>
                )}
                {/* 店舗比較グラフ（2店舗以上・全社タブ時） */}
                {caps.stores && storeTab === 'all' && (bundle.stores ?? []).length >= 2 && (() => {
                  const stores = bundle.stores ?? []
                  const allStoreNames = stores.map(s => s.storeName)
                  const compData = stores[0].periods.map((p, pi) => {
                    const entry: Record<string, string | number> = { period: p.replace('期','') }
                    stores.forEach(s => {
                      const rev = s.profitLoss.find(r => r.label === '売上高')?.values[pi] ?? 0
                      const op  = s.profitLoss.find(r => r.label === '営業利益')?.values[pi] ?? 0
                      entry[`${s.storeName}_売上`] = rev
                      entry[`${s.storeName}_営業利益`] = op
                    })
                    return entry
                  })
                  const COLORS = ['#00b4b4','#7c3aed','#e8534a','#f59e0b','#059669']
                  return (
                    <figure className="chart-card">
                      <figcaption>店舗別 売上・営業利益比較（百万円）</figcaption>
                      <div className="chart-body">
                        <ResponsiveContainer width="100%" height={260}>
                          <ComposedChart data={compData} margin={{ top:8, right:16, left:8, bottom:0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                            <XAxis dataKey="period" tick={AXIS_TICK} />
                            <YAxis tick={AXIS_TICK_S} tickFormatter={(v) => formatMillionYen(v as number)} />
                            <Tooltip contentStyle={tooltipSurface} />
                            <Legend />
                            {allStoreNames.map((name, i) => (
                              <Bar key={name} dataKey={`${name}_売上`} name={`${name} 売上`} fill={COLORS[i % COLORS.length]} opacity={0.4} radius={[4,4,0,0]} />
                            ))}
                            {allStoreNames.map((name, i) => (
                              <Line key={`${name}_op`} type="monotone" dataKey={`${name}_営業利益`} name={`${name} 営業利益`} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r:3 }} />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </figure>
                  )
                })()}
                {/* 店舗個別PL or 全社PL */}
                {caps.stores && storeTab !== 'all' ? (() => {
                  const store = (bundle.stores ?? []).find(s => s.storeName === storeTab)
                  if (!store) return null
                  return (
                    <>
                      <PLDonutChart bundle={{ ...activeBundle, profitLoss: store.profitLoss, periods: store.periods }} />
                      <AmountTable rows={store.profitLoss} periods={store.periods} />
                    </>
                  )
                })() : (
                  <>
                    <PLTrendChart bundle={activeBundle} yearRange={granularity === 'annual' ? yearRange : undefined} />
                    <PLDonutChart bundle={activeBundle} />
                    <AmountTable rows={activeBundle.profitLoss} periods={activeBundle.periods} />
                    <BepSection bundle={activeBundle} />
                  </>
                )}
              </div>
            )}
            {/* 店舗追加モーダル */}
            {showStoreModal && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
                onClick={e => { if (e.target === e.currentTarget) setShowStoreModal(false) }}>
                <div style={{ background:'var(--surface)', borderRadius:12, padding:'28px', width:'420px', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
                  <h3 style={{ margin:'0 0 16px', color:'var(--text-h)', fontSize:'1.1rem' }}>🏪 店舗PDFを読み込む</h3>
                  <label style={{ fontSize:'0.8rem', color:'var(--text)', display:'block', marginBottom:6 }}>店舗名</label>
                  <input
                    value={storeNameInput}
                    onChange={e => setStoreNameInput(e.target.value)}
                    placeholder="例：大内店"
                    style={{ width:'100%', padding:'8px 12px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-h)', fontSize:'0.9rem', marginBottom:12, boxSizing:'border-box' }}
                  />
                  <label style={{ fontSize:'0.8rem', color:'var(--text)', display:'block', marginBottom:6 }}>試算表PDF</label>
                  <input
                    type="file" accept=".pdf"
                    disabled={!storeNameInput.trim() || storeStatus === 'loading'}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file || !storeNameInput.trim()) return
                      await loadStoreFromPdf(file, storeNameInput.trim())
                      setShowStoreModal(false)
                      setStoreNameInput('')
                      setStoreTab(storeNameInput.trim())
                    }}
                    style={{ width:'100%', fontSize:'0.85rem', color:'var(--text)' }}
                  />
                  {storeStatus === 'loading' && <p style={{ color:'#00b4b4', marginTop:8, fontSize:'0.85rem' }}>🔄 {storeFileName} 解析中...</p>}
                  {storeStatus === 'error' && <p style={{ color:'#e8534a', marginTop:8, fontSize:'0.85rem' }}>❌ {storeError}</p>}
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
                    <button type="button" onClick={() => setShowStoreModal(false)}
                      style={{ padding:'8px 20px', background:'var(--border)', color:'var(--text)', border:'none', borderRadius:6, cursor:'pointer' }}>閉じる</button>
                  </div>
                </div>
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
            {caps.forecast ? <ForecastTab bundle={bundle} /> : <FeatureLock need="standard" feature="業績予測（Forecast）" />}
          </div>
        )}

        {tab === 'strategy' && (
          <div className="panel" role="tabpanel">
            {caps.strategy ? (
              <>
                <StrategyTab bundle={bundle} />
                {caps.swot && <ComingSoonPanel />}
              </>
            ) : (
              <FeatureLock need="standard" feature="改善提案（Strategy）" />
            )}
          </div>
        )}
      </div>

      {modalType && (
        <UploadModal type={modalType} onClose={() => setModalType(null)} />
      )}

      {showApiSetup && (
        <ApiKeySetup
          onSave={() => { setShowApiSetup(false); setHasApiKey(true); setPlan(getLicensePlan()) }}
          onClose={() => setShowApiSetup(false)}
        />
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    {reportHtml && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', overflowY:'auto', padding:'20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setReportHtml(null) }}
        >
          <div style={{ background:'#fff', borderRadius:8, width:'100%', maxWidth:860, position:'relative' }}>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 16px', borderBottom:'1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => {
                  const w = window.open('', '_blank')
                  if (w) { w.document.write(reportHtml); w.document.close(); setTimeout(() => w.print(), 800) }
                }}
                style={{ padding:'6px 16px', background:'#00b4b4', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}
              >🖨️ 印刷 / PDF保存</button>
              <button
                type="button"
                onClick={() => setReportHtml(null)}
                style={{ padding:'6px 16px', background:'#e2e8f0', color:'#1a1a1a', border:'none', borderRadius:6, cursor:'pointer' }}
              >✕ 閉じる</button>
            </div>
            <iframe
              srcDoc={reportHtml}
              style={{ width:'100%', height:'80vh', border:'none', borderRadius:'0 0 8px 8px' }}
              title="経営財務レポート"
            />
          </div>
        </div>
      )}
    <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        marginTop: '2rem',
        borderTop: '1px solid rgba(148,163,184,0.15)',
        color: '#64748b',
        fontSize: '0.75rem',
        letterSpacing: '0.05em',
      }}>
        © 2026 5web.jp – Powered by Go Kawabata
      </footer>
    </div>
  )
}
