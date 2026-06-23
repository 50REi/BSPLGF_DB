import { useCallback, useEffect, useRef, useState } from 'react'
import { useFinancials } from '../context/FinancialDataContext'
import { SAMPLE_CSV } from '../lib/parseCsv'

type Props = {
  type: 'pdf' | 'csv'
  onClose: () => void
}

const STAGES = [
  { pct: 0,   label: 'PDFを読み込み中...' },
  { pct: 20,  label: 'ページを解析中...' },
  { pct: 40,  label: '財務データを抽出中...' },
  { pct: 60,  label: 'BS/PL/CFを構造化中...' },
  { pct: 80,  label: 'データを検証中...' },
  { pct: 95,  label: 'もうすぐ完了...' },
  { pct: 100, label: '読み込み完了！' },
]

function getStageLabel(pct: number): string {
  let label = STAGES[0].label
  for (const s of STAGES) {
    if (pct >= s.pct) label = s.label
  }
  return label
}

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'monthly_sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function UploadModal({ type, onClose }: Props) {
  const {
    loadFromPdf, pdfStatus, pdfFileName, pdfError, pdfProgress,
    loadFromCsv, csvStatus, csvFileName, csvError,
  } = useFinancials()

  const [isDragOver, setIsDragOver] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const isLoading = type === 'pdf' && pdfStatus === 'loading'
  const status = type === 'pdf' ? pdfStatus : csvStatus
  const fileName = type === 'pdf' ? pdfFileName : csvFileName
  const errorMsg = type === 'pdf' ? pdfError : csvError

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isLoading, onClose])

  const handleFile = useCallback(
    (file: File) => {
      if (type === 'pdf') {
        if (file.type === 'application/pdf') loadFromPdf(file)
      } else {
        if (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
          loadFromCsv(file)
        }
      }
    },
    [type, loadFromPdf, loadFromCsv],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  const inputId = type === 'pdf' ? 'modal-pdf-input' : 'modal-csv-input'
  const accept  = type === 'pdf' ? 'application/pdf' : '.csv,text/csv'

  const borderColor =
    isDragOver        ? '#a78bfa'
    : status === 'success' ? '#34d399'
    : status === 'error'   ? '#f87171'
    : status === 'loading' ? '#00b4b4'
    : '#4b5563'

  const icon =
    status === 'success' ? '✅'
    : status === 'error'  ? '⚠️'
    : type === 'pdf'      ? '📄'
    : '📊'

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => { if (!isLoading && e.target === overlayRef.current) onClose() }}
    >
      <div className="modal-box" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">
            {type === 'pdf' ? '📄 決算書PDFを読み込む' : '📊 月次CSVを読み込む'}
          </h2>
          {!isLoading && (
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="閉じる"
            >
              ×
            </button>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={type === 'pdf' ? 'PDFをアップロード' : 'CSVをアップロード'}
          className={`modal-drop-zone${status === 'loading' ? ' modal-drop-zone-busy' : ''}`}
          style={{ borderColor }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => { if (!isLoading) document.getElementById(inputId)?.click() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) document.getElementById(inputId)?.click() }}
        >
          <input
            id={inputId}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={handleInput}
          />
          <span className="modal-drop-icon">
            {status === 'loading'
              ? <span className="spinner spinner-teal spinner-lg" aria-hidden="true" />
              : icon}
          </span>
          <div className="modal-drop-body">
            {status === 'idle' && type === 'pdf' && (
              <>
                <p className="modal-drop-main">PDFをドラッグ、またはクリックして選択</p>
                <p className="modal-drop-sub">Claude APIが自動解析してグラフに反映します（10〜30秒）</p>
              </>
            )}
            {status === 'idle' && type === 'csv' && (
              <>
                <p className="modal-drop-main">月次試算表CSVをドラッグ、またはクリックして選択</p>
                <p className="modal-drop-sub">freee / 弥生 / MFクラウド の月次エクスポートに対応</p>
              </>
            )}
            {status === 'loading' && (
              <>
                <p className="modal-drop-main modal-drop-loading">AIが決算書を解析中...</p>
                <p className="modal-drop-sub">{fileName}</p>
                <div className="modal-progress">
                  <div className="modal-progress-track">
                    <div
                      className="modal-progress-fill"
                      style={{ width: `${pdfProgress}%` }}
                    />
                  </div>
                  <p className="modal-progress-label">
                    {Math.round(pdfProgress)}% {getStageLabel(pdfProgress)}
                  </p>
                </div>
              </>
            )}
            {status === 'success' && (
              <>
                <p className="modal-drop-main modal-drop-ok">読み込み完了！グラフに反映されました</p>
                <p className="modal-drop-sub">
                  {fileName}　· 別のファイルを読み込む場合はクリック
                </p>
              </>
            )}
            {status === 'error' && (
              <>
                <p className="modal-drop-main modal-drop-err">エラー：{errorMsg}</p>
                <p className="modal-drop-sub">クリックして再試行</p>
              </>
            )}
          </div>
        </div>

        {type === 'csv' && (
          <div className="modal-footer">
            <p className="modal-format-note">
              必須列：年月・売上高　任意：売上原価・販管費・営業利益・営業CF・投資CF・財務CF
            </p>
            <button type="button" className="csv-sample-btn" onClick={downloadSampleCsv}>
              サンプルCSVをダウンロード
            </button>
          </div>
        )}

        {type === 'pdf' && (
          <p className="modal-api-note">※ PDFはAnthropicのAPIに送信されます</p>
        )}
      </div>
    </div>
  )
}
