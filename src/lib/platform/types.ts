export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** Fixed ids so rescheduling replaces the previous notification instead of piling up. */
export const NOTIFICATION_IDS = { rest: 1001, forgotten: 1002 } as const

export interface ScheduledNotification {
  id: number
  /** Epoch ms. */
  at: number
  title: string
  body: string
}

export interface AppFile { name: string; mtime: number; size: number }

/** Files in the app's private storage (kept across app updates, removed with the app). */
export interface AppFiles {
  write(name: string, text: string): Promise<void>
  read(name: string): Promise<string>
  list(): Promise<AppFile[]>
  remove(name: string): Promise<void>
}

/**
 * Why getting a Google token failed: it would need the consent screen, the user closed it, the browser blocked
 * Google's pop-up (web), or something else broke.
 */
export class GoogleAuthError extends Error {
  constructor(public reason: 'consent' | 'canceled' | 'popup' | 'failed', message: string = reason) { super(message) }
}

/** Google sign-in for Drive backups (drive.file scope only). */
export interface GoogleAuth {
  /**
   * An access token. `interactive` may show Google's account picker and consent screen (needs a tap from the
   * user on the web); otherwise it only succeeds silently or rejects with GoogleAuthError('consent').
   */
  getToken(interactive: boolean): Promise<string>
  /** Forget a token Google rejected, so the next getToken fetches a fresh one. */
  clearToken(token: string): Promise<void>
  /** Withdraw the app's access to the user's Drive (on disconnect). */
  revoke(token?: string, email?: string): Promise<void>
}

export interface Platform {
  readonly isNative: boolean
  /** Short buzz for feedback while the app is in the foreground. */
  vibrate(pattern?: number[]): void
  /** Keep the screen on (live workout). */
  keepAwake(on: boolean): Promise<void>
  /**
   * Hands a file to the user: a download in the browser, Android's share sheet in the app (save to Files or Drive,
   * send it, ...). With `share`, the browser also offers its share sheet where it has one (phones), falling back to
   * a download. Resolves false if the user dismissed the share sheet.
   */
  saveFile(name: string, data: Blob, opts?: { share?: boolean }): Promise<boolean>
  /**
   * Links that opened the app (bliskfit://… or https://fabrizm.github.io/BliskFit/…), including the one it was
   * launched with. Only in the Android app. Returns an unsubscribe function.
   */
  onOpenUrl?(cb: (url: string) => void): () => void
  googleAuth: GoogleAuth
  /** Private file storage for automatic backups; only in the Android app. */
  appFiles?: AppFiles
  /** Shares a link through the system share sheet, or copies it where there's none. */
  shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'dismissed'>
  notifications: {
    permission(): Promise<PermissionState>
    request(): Promise<PermissionState>
    /** Android 12+ "alarms & reminders" access, needed for notifications that fire on time. */
    exactAlarms(): Promise<PermissionState>
    openExactAlarmSettings(): Promise<void>
    /**
     * Schedule (or replace) a notification. Resolves true only if the OS will deliver it even when the app is
     * closed or the screen is locked (native). The web version is best effort and resolves false.
     */
    schedule(n: ScheduledNotification): Promise<boolean>
    cancel(id: number): Promise<void>
  }
}
