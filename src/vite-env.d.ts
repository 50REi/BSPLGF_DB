/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 財務 JSON を fetch する URL（未設定時は `/financials.json`） */
  readonly VITE_FINANCIALS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
