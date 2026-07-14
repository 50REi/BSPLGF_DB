import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { sampleFinancialBundle } from '../data/sampleFinancials'
import {
  countNewPeriods,
  deletePeriod as deletePeriodUtil,
  mergeBundle,
} from '../lib/mergeBundle'
import { parseFinancialsJson } from '../lib/parseFinancialsJson'
import { parseCsv } from '../lib/parseCsv'
import {
  clearPersistedBundle,
  loadPersistedBundle,
  savePersistedBundle,
} from '../lib/persistBundle'
import { getLicensePlan } from '../components/ApiKeySetup'
import type { FinancialBundle } from '../types/financials'

// ローカル永続保存の対象プラン判定（FP-STD / FP-PRE のみ）
function persistEnabled(): boolean {
  const plan = getLicensePlan()
  return plan === 'standard' || plan === 'premium'
}

export type FinancialDataSource = 'sample' | 'custom' | 'pdf'

type Ctx = {
  bundle: FinancialBundle
  dataSource: FinancialDataSource
  loadError: string | null
  loadFromPdf: (file: File) => Promise<void>
  pdfStatus: 'idle' | 'loading' | 'success' | 'error'
  pdfFileName: string
  pdfError: string
  pdfProgress: number
  loadFromCsv: (file: File) => void
  csvStatus: 'idle' | 'success' | 'error'
  csvFileName: string
  csvError: string
  clearAll: () => void
  deletePeriod: (period: string) => void
  mergeWarning: string | null
  clearMergeWarning: () => void
  loadStoreFromPdf: (file: File, storeName: string) => Promise<void>
  storeStatus: 'idle' | 'loading' | 'success' | 'error'
  storeFileName: string
  storeError: string
  deleteStore: (storeName: string) => void
}

const FinancialDataContext = createContext<Ctx | null>(null)

function defaultUrl() {
  return import.meta.env.VITE_FINANCIALS_URL ?? '/financials.json'
}

// ===== Claude API へのプロンプト =====
const SYSTEM_PROMPT = `あなたは財務データ抽出の専門家です。
アップロードされた財務諸表PDFから数値を読み取り、指定のJSON形式で返してください。
必ずJSON形式のみを返し、説明文や前置きは一切不要です。
単位は百万円（小数点以下切り捨て）に統一してください。
データが読み取れない項目は 0 を入れてください。`

const USER_PROMPT = `この財務諸表PDFから以下のJSON形式でデータを抽出してください。
期間は「YYYY/M期」形式（例：2023/9期）で古い順に並べてください。
数値の単位は百万円（小数点以下切り捨て）です。

{
  "periods": ["YYYY/M期", "YYYY/M期", "YYYY/M期"],
  "balanceSheet": {
    "assets": [
      { "label": "流動資産", "values": [数値, 数値, 数値], "emphasis": true },
      { "label": "現金及び預金", "values": [数値, 数値, 数値], "indent": true },
      { "label": "売掛金", "values": [数値, 数値, 数値], "indent": true },
      { "label": "棚卸資産", "values": [数値, 数値, 数値], "indent": true },
      { "label": "その他流動資産", "values": [数値, 数値, 数値], "indent": true },
      { "label": "固定資産", "values": [数値, 数値, 数値], "emphasis": true },
      { "label": "有形固定資産", "values": [数値, 数値, 数値], "indent": true },
      { "label": "無形固定資産", "values": [数値, 数値, 数値], "indent": true },
      { "label": "投資その他", "values": [数値, 数値, 数値], "indent": true },
      { "label": "資産合計", "values": [数値, 数値, 数値], "emphasis": true }
    ],
    "liabilitiesAndEquity": [
      { "label": "流動負債", "values": [数値, 数値, 数値], "emphasis": true },
      { "label": "買掛金", "values": [数値, 数値, 数値], "indent": true },
      { "label": "短期借入金", "values": [数値, 数値, 数値], "indent": true },
      { "label": "その他流動負債", "values": [数値, 数値, 数値], "indent": true },
      { "label": "固定負債", "values": [数値, 数値, 数値], "emphasis": true },
      { "label": "長期借入金", "values": [数値, 数値, 数値], "indent": true },
      { "label": "純資産", "values": [数値, 数値, 数値], "emphasis": true },
      { "label": "資本金", "values": [数値, 数値, 数値], "indent": true },
      { "label": "利益剰余金", "values": [数値, 数値, 数値], "indent": true },
      { "label": "負債・純資産合計", "values": [数値, 数値, 数値], "emphasis": true }
    ]
  },
  "profitLoss": [
    { "label": "売上高", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "売上原価", "values": [数値, 数値, 数値], "indent": true },
    { "label": "売上総利益", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "販売費及び一般管理費", "values": [数値, 数値, 数値], "indent": true },
    { "label": "営業利益", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "営業外収益", "values": [数値, 数値, 数値], "indent": true },
    { "label": "営業外費用", "values": [数値, 数値, 数値], "indent": true },
    { "label": "経常利益", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "法人税等", "values": [数値, 数値, 数値], "indent": true },
    { "label": "当期純利益", "values": [数値, 数値, 数値], "emphasis": true }
  ],
  "cashFlow": [
    { "label": "営業活動によるキャッシュ・フロー", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "減価償却費", "values": [数値, 数値, 数値], "indent": true },
    { "label": "運転資本の増減", "values": [数値, 数値, 数値], "indent": true },
    { "label": "投資活動によるキャッシュ・フロー", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "有形固定資産の取得", "values": [数値, 数値, 数値], "indent": true },
    { "label": "財務活動によるキャッシュ・フロー", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "借入金の返済", "values": [数値, 数値, 数値], "indent": true },
    { "label": "現金及び現金同等物の増減", "values": [数値, 数値, 数値], "emphasis": true },
    { "label": "期末残高", "values": [数値, 数値, 数値], "emphasis": true }
  ],
  "kpis": {
    "revenueGrowthYoY": 直近期の前年比売上成長率（%小数第1位の数値のみ。前年データがない場合は0）,
    "operatingMarginPct": 直近期の営業利益率（%小数第1位の数値のみ）,
    "equityRatioPct": 直近期の自己資本比率（%小数第1位の数値のみ）,
    "freeCashFlow": 直近期のFCF（営業CF＋投資CF、百万円整数）
  }}`

export function FinancialDataProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<FinancialBundle>(sampleFinancialBundle)
  const [dataSource, setDataSource] = useState<FinancialDataSource>('sample')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mergeWarning, setMergeWarning] = useState<string | null>(null)

  // 店舗別PDF関連のstate
  const [storeStatus, setStoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [storeFileName, setStoreFileName] = useState('')
  const [storeError, setStoreError] = useState('')

  // PDF関連のstate
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [pdfProgress, setPdfProgress] = useState(0)

  // CSV関連のstate
  const [csvStatus, setCsvStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [csvFileName, setCsvFileName] = useState('')
  const [csvError, setCsvError] = useState('')

  // useCallback 内の非同期処理から最新 state を読むための ref
  const bundleRef = useRef<FinancialBundle>(bundle)
  const dataSourceRef = useRef<FinancialDataSource>(dataSource)
  useEffect(() => { bundleRef.current = bundle }, [bundle])
  useEffect(() => { dataSourceRef.current = dataSource }, [dataSource])

  // 起動時：永続データ（STD/PRE）を優先復元 → なければ financials.json → サンプル
  useEffect(() => {
    let cancelled = false
    const url = defaultUrl()

    ;(async () => {
      setLoadError(null)

      // 1. ローカル永続保存（IndexedDB）から復元（対象プランのみ）
      if (persistEnabled()) {
        const persisted = await loadPersistedBundle()
        if (persisted && !cancelled) {
          setBundle(persisted)
          setDataSource('pdf')
          return
        }
      }

      // 2. financials.json（デプロイ時カスタム／既存ロジックそのまま）
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          if (res.status === 404) return
          throw new Error(`HTTP ${res.status}`)
        }
        const json: unknown = await res.json()
        const parsed = parseFinancialsJson(json)
        if (!parsed.ok) {
          if (!cancelled) {
            setLoadError(parsed.errors.join(' / '))
            console.warn('[financials]', parsed.errors)
          }
          return
        }
        if (!cancelled) {
          setBundle(parsed.data)
          setDataSource('custom')
        }
      } catch (e) {
        if (import.meta.env.DEV && url === '/financials.json') {
          console.info('[financials] カスタムファイルなし（サンプル表示）:', url)
        }
        if (!cancelled && e instanceof Error && e.message !== 'HTTP 404') {
          setLoadError(e.message)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // ===== 永続保存：bundle変化時に保存（STD/PRE・サンプル時は保存しない） =====
  useEffect(() => {
    if (!persistEnabled()) return
    if (dataSource === 'sample') return
    void savePersistedBundle(bundle)
  }, [bundle, dataSource])

  // ===== 全クリア（保存データも消去） =====
  const clearAll = useCallback(() => {
    setBundle(sampleFinancialBundle)
    setDataSource('sample')
    void clearPersistedBundle()
  }, [])

  // ===== 個別期削除 =====
  const deletePeriod = useCallback((period: string) => {
    const newBundle = deletePeriodUtil(bundleRef.current, period)
    if (newBundle.periods.length === 0) {
      setBundle(sampleFinancialBundle)
      setDataSource('sample')
      void clearPersistedBundle()
    } else {
      setBundle(newBundle)
    }
  }, [])

  const clearMergeWarning = useCallback(() => setMergeWarning(null), [])

  // ===== 店舗削除 =====
  const deleteStore = useCallback((storeName: string) => {
    setBundle(prev => ({
      ...prev,
      stores: prev.stores?.filter(s => s.storeName !== storeName),
    }))
  }, [])

  // ===== 店舗別PDF読込 =====
  const loadStoreFromPdf = useCallback(async (file: File, storeName: string) => {
    const apiKey = localStorage.getItem('anthropic_api_key') ?? import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setStoreError('APIキーが未設定です')
      setStoreStatus('error')
      return
    }
    setStoreStatus('loading')
    setStoreFileName(file.name)
    setStoreError('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const isProd = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      const apiUrl = isProd ? '/api/claude' : 'https://api.anthropic.com/v1/messages'
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(!isProd ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: `あなたは財務データ抽出の専門家です。店舗・支店の試算表PDFから損益データを抽出し、指定のJSON形式で返してください。必ずJSON形式のみを返し、説明文は不要です。単位は百万円（小数点以下切り捨て）。`,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: `この試算表PDFから損益データを抽出してください。店舗名：${storeName}
{
  "storeName": "${storeName}",
  "periods": ["YYYY/M期"],
  "profitLoss": [
    { "label": "売上高", "values": [数値], "emphasis": true },
    { "label": "売上原価", "values": [数値], "indent": true },
    { "label": "売上総利益", "values": [数値], "emphasis": true },
    { "label": "販売費及び一般管理費", "values": [数値], "indent": true },
    { "label": "営業利益", "values": [数値], "emphasis": true },
    { "label": "経常利益", "values": [数値], "emphasis": true },
    { "label": "当期純利益", "values": [数値], "emphasis": true }
  ]
}` }
            ]
          }]
        })
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message ?? `APIエラー: ${response.status}`)
      }
      const result = await response.json()
      const rawText: string = result.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('')
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) ?? rawText.match(/(\{[\s\S]*\})/)
      if (!jsonMatch) throw new Error('JSONの抽出に失敗しました')
      const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as {
        storeName: string; periods: string[]; profitLoss: { label: string; values: number[]; emphasis?: boolean; indent?: boolean }[]
      }
      setBundle(prev => {
        const existing = prev.stores ?? []
        const filtered = existing.filter(s => s.storeName !== storeName)
        return {
          ...prev,
          stores: [...filtered, { storeName: parsed.storeName, periods: parsed.periods, profitLoss: parsed.profitLoss }]
        }
      })
      setStoreStatus('success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      setStoreError(msg)
      setStoreStatus('error')
    }
  }, [])

  // ===== PDF読み込み関数 =====
  const loadFromPdf = useCallback(async (file: File) => {
    const apiKey = localStorage.getItem('anthropic_api_key') ?? import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setPdfError('APIキーが未設定です。ヘッダーの⚙️ボタンからAPIキーを設定してください。')
      setPdfStatus('error')
      return
    }

    setPdfStatus('loading')
    setPdfFileName(file.name)
    setPdfError('')
    setPdfProgress(0)

    // 擬似プログレス: 15秒で 0 → 95%
    const DURATION = 15_000
    const INTERVAL = 100
    const STEP = (95 / DURATION) * INTERVAL
    const progressTimer = setInterval(() => {
      setPdfProgress(prev => {
        if (prev >= 95) { clearInterval(progressTimer); return 95 }
        return Math.min(prev + STEP, 95)
      })
    }, INTERVAL)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const isProd = window.location.hostname !== 'localhost'
      const apiUrl = isProd ? '/api/claude' : 'https://api.anthropic.com/v1/messages'
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          ...(window.location.hostname === 'localhost' ? {'anthropic-dangerous-direct-browser-access': 'true'} : {}),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 },
                },
                { type: 'text', text: USER_PROMPT },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message ?? `APIエラー: ${response.status}`)
      }

      const result = await response.json()
      const rawText: string = result.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('')

      const jsonMatch =
        rawText.match(/```json\s*([\s\S]*?)```/) ?? rawText.match(/(\{[\s\S]*\})/)
      if (!jsonMatch) throw new Error('JSONの抽出に失敗しました')

      const rawJson: unknown = JSON.parse(jsonMatch[1])
      const parsed = parseFinancialsJson(rawJson)
      if (!parsed.ok) throw new Error(parsed.errors.join(' / '))

      // ===== 期数チェック（マージ前） =====
      const currentBundle = bundleRef.current
      const isSample = dataSourceRef.current !== 'pdf'

      if (!isSample) {
        const newCount = countNewPeriods(currentBundle, parsed.data)
        const totalAfterMerge = currentBundle.periods.length + newCount

        if (totalAfterMerge > 20) {
          clearInterval(progressTimer)
          setPdfProgress(0)
          setPdfStatus('idle')
          setMergeWarning(
            'error:期数上限（20期）を超えます。古い期を削除してから追加してください。'
          )
          return
        }

        if (totalAfterMerge === 10) {
          setMergeWarning('warn:分析の目安は5〜10期です。引き続き追加できます。')
        }
      }

      const newBundle = isSample
        ? parsed.data
        : mergeBundle(currentBundle, parsed.data)

      clearInterval(progressTimer)
      setPdfProgress(100)
      setBundle(newBundle)
      setDataSource('pdf')
      setLoadError(null)

      // 100% を 0.5秒見せてからモーダルクローズ
      await new Promise<void>(r => setTimeout(r, 500))
      setPdfStatus('success')
    } catch (e: unknown) {
      clearInterval(progressTimer)
      const msg = e instanceof Error ? e.message : '不明なエラーが発生しました'
      setPdfError(msg)
      setPdfProgress(0)
      setPdfStatus('error')
    }
  }, [])

  // ===== CSV読み込み関数 =====
  const loadFromCsv = useCallback((file: File) => {
    setCsvFileName(file.name)
    setCsvError('')

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== 'string') {
        setCsvError('ファイルの読み込みに失敗しました')
        setCsvStatus('error')
        return
      }
      const result = parseCsv(text)
      if (!result.ok) {
        setCsvError(result.error)
        setCsvStatus('error')
        return
      }
      setBundle((prev) => ({ ...prev, monthly: result.data }))
      setCsvStatus('success')
    }
    reader.onerror = () => {
      setCsvError('ファイルの読み込みに失敗しました')
      setCsvStatus('error')
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const value = useMemo(
    () => ({
      bundle, dataSource, loadError,
      loadFromPdf, pdfStatus, pdfFileName, pdfError, pdfProgress,
      loadFromCsv, csvStatus, csvFileName, csvError,
      clearAll, deletePeriod, mergeWarning, clearMergeWarning,
      loadStoreFromPdf, storeStatus, storeFileName, storeError, deleteStore,
    }),
    [bundle, dataSource, loadError, loadFromPdf, pdfStatus, pdfFileName, pdfError, pdfProgress,
     loadFromCsv, csvStatus, csvFileName, csvError,
     clearAll, deletePeriod, mergeWarning, clearMergeWarning,
     loadStoreFromPdf, storeStatus, storeFileName, storeError, deleteStore],
  )

  return (
    <FinancialDataContext.Provider value={value}>{children}</FinancialDataContext.Provider>
  )
}

export function useFinancials(): Ctx {
  const ctx = useContext(FinancialDataContext)
  if (!ctx) {
    throw new Error('useFinancials は FinancialDataProvider 内で使ってください')
  }
  return ctx
}
