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

/** The rest notification in the Android app: a countdown with the next set, and buttons that work without opening the app. */
export interface RestNotice {
  /** Epoch ms the rest began; with `endsAt` it sizes the notification's draining bar. */
  startedAt: number
  endsAt: number
  /** Title while counting down, and once the rest is over. */
  title: string
  overTitle: string
  /** The next set, e.g. "Next: Bench Press · Set 2 · 80×8". */
  text: string
  /** Button labels; there is a Done button only when there is a `payload` to log. */
  labels: { done: string; plus: string; skip: string }
  /** Handed back by Done: which set to log and with what (see RestAction), so a stale tap can't log something else. */
  payload?: string
  /** Shown after Done when the app isn't running to save it yet. */
  pendingText: string
}

/** A tap on the rest notification: its buttons, or the notification itself ('open'). */
export type RestAction = { action: 'done'; payload: string } | { action: 'plus' | 'skip' | 'open' }

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
  /** Only in the Android app; elsewhere rest uses the plain "rest over" notification. */
  restNotification?: {
    show(n: RestNotice): Promise<void>
    hide(): Promise<void>
    /** Taps on the notification, including ones made while the app wasn't running. Returns an unsubscribe function. */
    onAction(cb: (a: RestAction) => void): () => void
  }
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
