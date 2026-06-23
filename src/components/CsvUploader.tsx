import { useCallback, useState } from 'react'
import { useFinancials } from '../context/FinancialDataContext'
import { SAMPLE_CSV } from '../lib/parseCsv'

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'monthly_sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function CsvUploader() {
  const { loadFromCsv, csvStatus, csvFileName, csvError } = useFinancials()
  const [open, setOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      if (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
        loadFromCsv(file)
      }
    },
    [loadFromCsv],
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

  const dropZoneClass = [
    'csv-drop-zone',
    isDragOver ? 'csv-drop-zone-over' : '',
    csvStatus === 'success' ? 'csv-drop-zone-ok' : '',
    csvStatus === 'error' ? 'csv-drop-zone-err' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="csv-accordion" style={{ marginBottom: '12px' }}>
      <button
        type="button"
        className="csv-accordion-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="csv-accordion-title">
          月次CSV取り込み
          {csvStatus === 'success' && (
            <span className="csv-badge-ok">読込済</span>
          )}
        </span>
        <svg
          className={`csv-chevron ${open ? 'csv-chevron-open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="csv-accordion-body">
          <div
            role="button"
            tabIndex={0}
            aria-label="月次CSVをアップロード"
            className={dropZoneClass}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('csv-file-input')?.click()}
            onKeyDown={(e) => e.key === 'Enter' && document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleInput}
            />
            <span className="csv-drop-icon">
              {csvStatus === 'success' ? '✅' : csvStatus === 'error' ? '⚠️' : '📊'}
            </span>
            <div>
              {csvStatus === 'idle' && (
                <>
                  <p className="csv-drop-main">月次試算表CSVをドラッグ、またはクリックして選択</p>
                  <p className="csv-drop-sub">freee / 弥生 / MFクラウド の月次エクスポートに対応</p>
                </>
              )}
              {csvStatus === 'success' && (
                <>
                  <p className="csv-drop-main csv-drop-main-ok">読み込み完了　月次タブに反映されました</p>
                  <p className="csv-drop-sub">{csvFileName}　· 別のCSVを読み込む場合はクリック</p>
                </>
              )}
              {csvStatus === 'error' && (
                <>
                  <p className="csv-drop-main csv-drop-main-err">エラー：{csvError}</p>
                  <p className="csv-drop-sub">クリックして再試行</p>
                </>
              )}
            </div>
          </div>

          <div className="csv-footer">
            <p className="csv-format-note">
              必須列：年月・売上高　任意：売上原価・販管費・営業利益・営業CF・投資CF・財務CF
            </p>
            <button type="button" className="csv-sample-btn" onClick={downloadSampleCsv}>
              サンプルCSVをダウンロード
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
