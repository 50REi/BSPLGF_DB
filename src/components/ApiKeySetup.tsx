import { useEffect, useRef, useState } from 'react'

export const LS_KEY = 'anthropic_api_key'
export const LS_KEY_COMPANY = 'finance_company_name'

type Props = {
  onSave: () => void
  onClose?: () => void
}

export function ApiKeySetup({ onSave, onClose }: Props) {
  const [value, setValue] = useState(() => localStorage.getItem(LS_KEY) ?? '')
  const [company, setCompany] = useState(() => localStorage.getItem('finance_company_name') ?? '')
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
