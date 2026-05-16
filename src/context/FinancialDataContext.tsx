import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { sampleFinancialBundle } from '../data/sampleFinancials'
import { parseFinancialsJson } from '../lib/parseFinancialsJson'
import type { FinancialBundle } from '../types/financials'

export type FinancialDataSource = 'sample' | 'custom'

type Ctx = {
  bundle: FinancialBundle
  dataSource: FinancialDataSource
  loadError: string | null
}

const FinancialDataContext = createContext<Ctx | null>(null)

function defaultUrl() {
  return import.meta.env.VITE_FINANCIALS_URL ?? '/financials.json'
}

export function FinancialDataProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<FinancialBundle>(sampleFinancialBundle)
  const [dataSource, setDataSource] = useState<FinancialDataSource>('sample')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = defaultUrl()

    ;(async () => {
      setLoadError(null)
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

  const value = useMemo(
    () => ({ bundle, dataSource, loadError }),
    [bundle, dataSource, loadError],
  )

  return <FinancialDataContext.Provider value={value}>{children}</FinancialDataContext.Provider>
}

export function useFinancials(): Ctx {
  const ctx = useContext(FinancialDataContext)
  if (!ctx) {
    throw new Error('useFinancials は FinancialDataProvider 内で使ってください')
  }
  return ctx
}
