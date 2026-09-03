// lib/sync/google-identity.ts
// Google Identity Services (GIS) の client ライブラリを 1 回だけロードする。
// lib/embed/soundcloud-widget.ts と同じ「inject once + shared promise」パターン。

/** GIS code client の設定 (使うオプションだけ・popup 固定)。 */
export interface GoogleCodeClientConfig {
  client_id: string
  /** space 区切りのスコープ。 */
  scope: string
  ux_mode: 'popup'
  callback: (response: GoogleCodeResponse) => void
  error_callback?: (error: GoogleGsiError) => void
}

/** popup callback が受け取るオブジェクト。 */
export interface GoogleCodeResponse {
  code?: string
  scope?: string
  error?: string
  error_description?: string
}

/** error_callback が受け取るオブジェクト (ポップアップを閉じた等)。 */
export interface GoogleGsiError {
  type: string
  message?: string
}

export interface GoogleCodeClient {
  requestCode(): void
}

export interface GoogleOAuth2 {
  initCodeClient(config: GoogleCodeClientConfig): GoogleCodeClient
}

export interface GoogleGlobal {
  accounts: { oauth2: GoogleOAuth2 }
}

declare global {
  interface Window {
    google?: GoogleGlobal
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let loadPromise: Promise<GoogleGlobal> | null = null

/**
 * GIS の client script を注入し、`window.google` が使えるようになったら
 * resolve する。ページに 1 回だけ注入・同時呼び出しは同じ promise を共有。
 * 失敗時は `loadPromise` を null に戻すので、次の呼び出しでリトライできる。
 */
export function loadGoogleIdentityServices(): Promise<GoogleGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requires a browser environment'))
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<GoogleGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = (): void => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google)
      } else {
        loadPromise = null
        reject(new Error('GIS script loaded but window.google.accounts.oauth2 is missing'))
      }
    }
    script.onerror = (): void => {
      loadPromise = null
      reject(new Error('Failed to load the Google Identity Services script'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}
