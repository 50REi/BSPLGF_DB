import { useCallback, useEffect, useState } from 'react'

export type ToastItem = {
  id: number
  type: 'success' | 'error'
  message: string
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  const doClose = useCallback(() => {
    setVisible(false)
    setTimeout(() => onClose(item.id), 280)
  }, [item.id, onClose])

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(doClose, 3000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [doClose])

  return (
    <div className={`toast-card toast-${item.type}${visible ? ' toast-enter' : ''}`}>
      <span className="toast-msg">
        {item.type === 'success' ? '✅' : '⚠️'} {item.message}
      </span>
      <button type="button" className="toast-close" onClick={doClose} aria-label="閉じる">
        ×
      </button>
    </div>
  )
}

export function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastItem[]
  onClose: (id: number) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onClose={onClose} />
      ))}
    </div>
  )
}
