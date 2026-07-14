import { useEffect, useRef, useState } from 'react'

export const LS_KEY = 'anthropic_api_key'
export const LS_KEY_COMPANY = 'finance_company_name'
export const LS_KEY_LICENSE = 'finance_license_key'

export type LicensePlan = 'free' | 'lite' | 'standard' | 'premium'

// ライセンスキー検証（プレフィックスでプラン判定）
// 旧 FS- 系は認証を通さない（併存なし・クリーン移行）
export function isValidLicenseKey(key: string): boolean {
  return key.startsWith('FP-LITE-') || key.startsWith('FP-STD-') || key.startsWith('FP-PRE-')
}

export function planFromKey(key: string): LicensePlan {
  if (key.startsWith('FP-PRE-')) return 'premium'
  if (key.startsWith('FP-STD-')) return 'standard'
  if (key.startsWith('FP-LITE-')) return 'lite'
  return 'free'
}

export function getLicensePlan(): LicensePlan {
  return planFromKey(localStorage.getItem(LS_KEY_LICENSE) ?? '')
}

// ===== 機能ゲーティング（確定マトリクスの正本・ここだけ触れば全機能に反映）=====
export const PLAN_RANK: Record<LicensePlan, number> = { free: 0, lite: 1, standard: 2, premium: 3 }

export function planAtLeast(plan: LicensePlan, min: LicensePlan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min]
}

export type Capabilities = {
  pdf: boolean       // PDF解析・財務三表(BS/PL/CF)・KPI（ライト以上）
  report: boolean    // 経営レポート自動生成（ライト以上）
  forecast: boolean  // 業績予測 Forecast（スタンダード以上）
  strategy: boolean  // 改善提案 Strategy（スタンダード以上）
  csv: boolean       // 月次CSV取込（スタンダード以上）
  persist: boolean   // ローカル永続保存・複数期追跡（スタンダード以上）
  stores: boolean    // 店舗別/複数拠点PL・店舗間比較（プレミアムのみ）
  swot: boolean      // SWOT・3C（プレミアムのみ）
}

export function capsOf(plan: LicensePlan): Capabilities {
  return {
    pdf:      planAtLeast(plan, 'lite'),
    report:   planAtLeast(plan, 'lite'),
    forecast: planAtLeast(plan, 'standard'),
    strategy: planAtLeast(plan, 'standard'),
    csv:      planAtLeast(plan, 'standard'),
    persist:  planAtLeast(plan, 'standard'),
    stores:   planAtLeast(plan, 'premium'),
    swot:     planAtLeast(plan, 'premium'),
  }
}

const PLAN_LABEL: Record<LicensePlan, string> = {
  free: '無料',
  lite: 'ライト',
  standard: 'スタンダード',
  premium: 'プレミアム',
}

type Props = {
  onSave: () => void
  onClose?: () => void
}

export function ApiKeySetup({ onSave, onClose }: Props) {
  const [value, setValue] = useState(() => localStorage.getItem(LS_KEY) ?? '')
  const [company, setCompany] = useState(() => localStorage.getItem('finance_company_name') ?? '')
  const [license, setLicense] = useState(() => localStorage.getItem(LS_KEY_LICENSE) ?? '')
  const [licenseStatus, setLicenseStatus] = useState<'idle'|'ok'|'invalid'>(() => {
    const saved = localStorage.getItem(LS_KEY_LICENSE) ?? ''
    if (isValidLicenseKey(saved)) return 'ok'
    return 'idle'
  })
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!onClose) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setError('APIキーは「sk-ant-」で始まる必要があります')
      return
    }
    localStorage.setItem(LS_KEY, trimmed)
    localStorage.setItem('finance_company_name', company.trim())
    const trimmedLicense = license.trim()
    if (trimmedLicense && !isValidLicenseKey(trimmedLicense)) {
      setLicenseStatus('invalid')
      return
    }
    if (trimmedLicense) localStorage.setItem(LS_KEY_LICENSE, trimmedLicense)
    else localStorage.removeItem(LS_KEY_LICENSE)
    setLicenseStatus(trimmedLicense ? 'ok' : 'idle')
    setError('')
    onSave()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  const body = (
    <>
      <p className="apikey-desc">
        このツールはAnthropicのAIを使って決算書を解析します。
        お客様ご自身のAPIキーを入力してください。
        キーはこのブラウザにのみ保存され、サーバーには送信されません。
      </p>

      <div className="apikey-field">
        <label className="apikey-label" htmlFor="company-input">会社名（レポートに表示）</label>
        <input
          id="company-input"
          className="apikey-input"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="例：株式会社メモリアルサービス"
          autoComplete="off"
        />
      </div>
      <div className="apikey-field">
        <label className="apikey-label" htmlFor="apikey-input">APIキー</label>
        <div className="apikey-input-wrap">
          <input
            id="apikey-input"
            ref={inputRef}
            className={`apikey-input${error ? ' apikey-input-err' : ''}`}
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="apikey-toggle-btn"
            onClick={() => setShowKey((s) => !s)}
            aria-label={showKey ? 'APIキーを隠す' : 'APIキーを表示'}
            tabIndex={-1}
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
        {error && <p className="apikey-error" role="alert">{error}</p>}
      </div>

      <div className="apikey-field">
        <label className="apikey-label" htmlFor="license-input">ライセンスキー（オプション）</label>
        <input
          id="license-input"
          className={`apikey-input${licenseStatus === 'invalid' ? ' apikey-input-err' : ''}`}
          type="text"
          value={license}
          onChange={(e) => {
            const v = e.target.value
            setLicense(v)
            if (v === '') setLicenseStatus('idle')
            else if (isValidLicenseKey(v)) setLicenseStatus('ok')
            else setLicenseStatus('invalid')
          }}
          placeholder="FP-LITE-XXXX / FP-STD-XXXX / FP-PRE-XXXX"
          autoComplete="off"
          spellCheck={false}
        />
        {licenseStatus === 'invalid' && <p className="apikey-error" role="alert">無効なライセンスキーです（FP-LITE- / FP-STD- / FP-PRE- で始まる必要があります）</p>}
        {licenseStatus === 'ok' && <p style={{color:'#059669',fontSize:'0.8rem',marginTop:4}}>✅ ライセンス認証済み（{PLAN_LABEL[planFromKey(license.trim())]}プラン）</p>}
        <p style={{fontSize:'0.75rem',color:'#94a3b8',marginTop:4}}>未入力の場合は無料プラン（サンプルデータのみ）</p>
        <div style={{fontSize:'0.72rem',color:'#94a3b8',marginTop:8,lineHeight:1.7,background:'rgba(148,163,184,0.08)',borderRadius:6,padding:'8px 10px'}}>
          <div><strong style={{color:'#cbd5e1'}}>プラン：</strong>ライト ¥19,800 ／ スタンダード ¥29,800 ／ プレミアム ¥49,800（月額・税別）</div>
          <div style={{marginTop:2}}><strong style={{color:'#cbd5e1'}}>金庫（保存先）：</strong>ローカル ¥0 ／ SaaS ¥0 ／ オンプレ 個別見積り ※ローカル永続保存はスタンダード以上</div>
        </div>
      </div>
      <a
        className="apikey-link"
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noopener noreferrer"
      >
        APIキーを取得する →
      </a>

      <button
        type="button"
        className="apikey-submit-btn"
        onClick={handleSubmit}
      >
        設定して始める
      </button>
    </>
  )

  if (onClose) {
    return (
      <div
        ref={overlayRef}
        className="modal-overlay"
        onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      >
        <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="apikey-modal-title">
          <div className="modal-header">
            <h2 id="apikey-modal-title" className="modal-title">🔑 Anthropic APIキーを設定</h2>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className="apikey-fullscreen">
      <div className="apikey-card" role="main">
        <div className="apikey-card-icon" aria-hidden="true">🔑</div>
        <h1 className="apikey-card-title">Anthropic APIキーを設定</h1>
        {body}
      </div>
    </div>
  )
}
