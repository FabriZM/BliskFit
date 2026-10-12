import { Capacitor } from '@capacitor/core'
import { nativePlatform } from './native'
import type { Platform } from './types'
import { webPlatform } from './web'

/** One place that knows whether we're the installed Android app or the web/PWA build. */
export const platform: Platform = Capacitor.isNativePlatform() ? nativePlatform : webPlatform
export { NOTIFICATION_IDS } from './types'
export { GoogleAuthError } from './types'
export type { PermissionState, Platform, ScheduledNotification } from './types'
