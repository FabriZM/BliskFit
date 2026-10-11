import type { PermissionState, Platform, ScheduledNotification } from './types'

/** Browser/PWA implementation: Vibration API, Wake Lock API, and service-worker notifications while the page lives. */
const supported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let lock: WakeLockSentinel | null = null
let wantLock = false

const toState = (p: NotificationPermission): PermissionState => (p === 'default' ? 'prompt' : p)

async function acquire(): Promise<void> {
  if (!wantLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible' || lock) return
  try {
    lock = await navigator.wakeLock.request('screen')
    lock.addEventListener('release', () => { lock = null })
    if (!wantLock) void lock.release()
  } catch { /* denied or unsupported; non-critical */ }
}
// The browser drops the lock whenever the tab hides, so take it again on return.
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => void acquire())

export const webPlatform: Platform = {
  isNative: false,
  vibrate(pattern = [250, 120, 250]) {
    try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
  },
  async saveFile(name, data) {
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return true
  },
  async keepAwake(on) {
    wantLock = on
    if (on) await acquire()
    else { await lock?.release(); lock = null }
  },
  notifications: {
    permission: async () => (supported() ? toState(Notification.permission) : 'unsupported'),
    request: async () => (supported() ? toState(await Notification.requestPermission()) : 'unsupported'),
    exactAlarms: async () => 'unsupported',
    openExactAlarmSettings: async () => {},
    async schedule(n: ScheduledNotification) {
      clearTimeout(timers.get(n.id))
      if (!supported() || Notification.permission !== 'granted') return false
      // A page can only fire this while it is alive; it is shown only if the user isn't looking at the app.
      timers.set(n.id, setTimeout(async () => {
        if (!document.hidden) return
        const reg = await navigator.serviceWorker.ready
        await reg.showNotification(n.title, { body: n.body, tag: `n${n.id}`, icon: 'pwa-192.png', vibrate: [250, 120, 250], renotify: true } as NotificationOptions)
      }, Math.min(2_000_000_000, Math.max(0, n.at - Date.now()))))
      return false
    },
    async cancel(id) {
      clearTimeout(timers.get(id))
      timers.delete(id)
    },
  },
}
