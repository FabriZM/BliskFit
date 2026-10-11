import type { PermissionState, Platform, ScheduledNotification } from './types'

/** Capacitor (Android) implementation. Plugins are imported lazily so the plain PWA never loads them. */
const CHANNEL = 'timers'
let channelReady: Promise<void> | undefined

/**
 * Returns the plugin wrapped in an object on purpose: Capacitor plugins are proxies, and resolving a promise
 * with one makes JS call `.then()` on it, which the native bridge rejects ("... is not implemented on android").
 */
async function localNotifications(): Promise<{ ln: (typeof import('@capacitor/local-notifications'))['LocalNotifications'] }> {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  // High importance so the rest-end alert sounds, vibrates and shows on the lock screen.
  channelReady ??= LocalNotifications.createChannel({
    id: CHANNEL, name: 'Timers and reminders', description: 'Rest timer and workout reminders',
    importance: 5, visibility: 1, vibration: true,
  })
  await channelReady
  return { ln: LocalNotifications }
}

async function blobToBase64(b: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
  return url.slice(url.indexOf(',') + 1)
}

const toState = (s: string): PermissionState =>
  s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt'

export const nativePlatform: Platform = {
  isNative: true,
  vibrate(pattern = [250, 120, 250]) {
    const duration = Math.min(600, pattern.reduce((a, b) => a + b, 0))
    void import('@capacitor/haptics').then(({ Haptics }) => Haptics.vibrate({ duration }))
  },
  async saveFile(name, data) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    // Written to the app's cache (no storage permission needed), then offered through the share sheet.
    const { uri } = await Filesystem.writeFile({ path: name, data: await blobToBase64(data), directory: Directory.Cache })
    try {
      await Share.share({ title: name, files: [uri] })
      return true
    } catch {
      return false // dismissed
    }
  },
  async keepAwake(on) {
    const { KeepAwake } = await import('@capacitor-community/keep-awake')
    if (on) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  },
  notifications: {
    async permission() {
      const { ln } = await localNotifications()
      return toState((await ln.checkPermissions()).display)
    },
    async request() {
      const { ln } = await localNotifications()
      return toState((await ln.requestPermissions()).display)
    },
    async exactAlarms() {
      const { ln } = await localNotifications()
      return toState((await ln.checkExactNotificationSetting()).exact_alarm)
    },
    async openExactAlarmSettings() {
      const { ln } = await localNotifications()
      await ln.changeExactNotificationSetting()
    },
    async schedule(n: ScheduledNotification) {
      const { ln } = await localNotifications()
      if ((await ln.checkPermissions()).display !== 'granted') return false
      await ln.cancel({ notifications: [{ id: n.id }] })
      if (n.at <= Date.now()) return false
      // With isExactNotification (the plugin default) a missing exact-alarm grant makes the plugin throw the user
      // into Android's settings on every schedule call. Only ask for exactness once it's already granted;
      // otherwise schedule normally (it can arrive a little late) and let ReminderSetup explain and ask.
      const exact = (await ln.checkExactNotificationSetting()).exact_alarm === 'granted'
      await ln.schedule({
        notifications: [{
          id: n.id, title: n.title, body: n.body, channelId: CHANNEL, isExactNotification: exact,
          schedule: { at: new Date(n.at), allowWhileIdle: true },
        }],
      })
      return true
    },
    async cancel(id) {
      const { ln } = await localNotifications()
      await ln.cancel({ notifications: [{ id }] })
    },
  },
}
