import { DRIVE_SCOPE } from '../drive'
import { GoogleAuthError, type GoogleAuth } from './types'

/** OAuth web client (public identifier, not a secret). Allowed origins: fabrizm.github.io and localhost:5173. */
export const GOOGLE_WEB_CLIENT_ID = '542333675812-r0kqm28eec7qb9btgcrmmoie675ok2qr.apps.googleusercontent.com'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient {
  callback: (r: TokenResponse) => void
  error_callback: (e: { type?: string }) => void
  requestAccessToken(o?: { prompt?: string }): void
}
interface Gis {
  accounts: { oauth2: {
    initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void }): TokenClient
    revoke(token: string, done?: () => void): void
  } }
}
declare global { interface Window { google?: Gis } }

let gis: Promise<Gis> | undefined
const loadGis = () => (gis ??= new Promise<Gis>((resolve, reject) => {
  if (window.google?.accounts) return resolve(window.google)
  const s = document.createElement('script')
  s.src = GIS_SRC
  s.async = true
  s.onload = () => (window.google ? resolve(window.google) : reject(new GoogleAuthError('failed')))
  s.onerror = () => { gis = undefined; reject(new GoogleAuthError('failed', 'Could not load Google sign-in')) }
  document.head.append(s)
}))

// Web tokens last about an hour and can only be renewed with a popup, so they're kept in memory for this visit
// and automatic backups only run while one is valid.
let cached: { token: string; expiresAt: number } | undefined
let client: TokenClient | undefined

/** Google Identity Services token flow (popup), used by the web/PWA version. */
export const googleWebAuth: GoogleAuth = {
  async getToken(interactive) {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
    if (!interactive) throw new GoogleAuthError('consent')
    const g = await loadGis()
    return new Promise<string>((resolve, reject) => {
      const onToken = (r: TokenResponse) => {
        if (!r.access_token) return reject(new GoogleAuthError(r.error === 'access_denied' ? 'canceled' : 'failed', r.error))
        cached = { token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }
        resolve(r.access_token)
      }
      const onError = (e: { type?: string }) => reject(new GoogleAuthError(
        e.type === 'popup_closed' ? 'canceled' : e.type === 'popup_failed_to_open' ? 'popup' : 'failed', e.type))
      client ??= g.accounts.oauth2.initTokenClient({ client_id: GOOGLE_WEB_CLIENT_ID, scope: DRIVE_SCOPE, callback: onToken, error_callback: onError })
      client.callback = onToken
      client.error_callback = onError
      client.requestAccessToken({ prompt: '' })
    })
  },
  async clearToken(token) {
    if (cached?.token === token) cached = undefined
  },
  async revoke(token) {
    cached = undefined
    if (!token) return
    const g = await loadGis().catch(() => undefined)
    await new Promise<void>((resolve) => (g ? g.accounts.oauth2.revoke(token, resolve) : resolve()))
  },
}
