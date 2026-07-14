import type { FinancialBundle } from '../types/financials'

// ===== ローカル永続保存（IndexedDB・最小実装） =====
// 対象プラン：FP-STD / FP-PRE のみ（呼び出し側でプラン判定する）
// 無料・LITE は保存しない揮発仕様を維持する。
// 単一PC想定。サーバー同期・複数端末・自動処理は入れない（Dスコープ）。

const DB_NAME = 'financepulse'
const STORE = 'bundles'
const KEY = 'current'
const DB_VERSION = 1

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// 蓄積bundleを保存（year次マージ最大20期をそのまま格納）
export async function savePersistedBundle(bundle: FinancialBundle): Promise<void> {
  if (!idbAvailable()) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(bundle, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[persist] 保存に失敗しました', e)
  }
}

// 次回ロード時の復元用に読み込む（存在しなければ null）
export async function loadPersistedBundle(): Promise<FinancialBundle | null> {
  if (!idbAvailable()) return null
  try {
    const db = await openDb()
    const result = await new Promise<FinancialBundle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as FinancialBundle | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result
  } catch (e) {
    console.warn('[persist] 読み込みに失敗しました', e)
    return null
  }
}

// 「保存データをクリア」用
export async function clearPersistedBundle(): Promise<void> {
  if (!idbAvailable()) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[persist] 削除に失敗しました', e)
  }
}
