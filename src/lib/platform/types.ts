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

export interface Platform {
  readonly isNative: boolean
  /** Short buzz for feedback while the app is in the foreground. */
  vibrate(pattern?: number[]): void
  /** Keep the screen on (live workout). */
  keepAwake(on: boolean): Promise<void>
  /**
   * Hands a file to the user: a download in the browser, Android's share sheet in the app (save to Files or Drive,
   * send it, ...). Resolves false if the user dismissed the share sheet.
   */
  saveFile(name: string, data: Blob): Promise<boolean>
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
