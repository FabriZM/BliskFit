/** Best-effort PWA notifications. A web page can't schedule these while closed; the native wrapper (M3b) can. */
export const notificationsSupported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator
export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported'

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export async function showNotification(title: string, body: string, tag: string, vibrate?: number[]): Promise<void> {
  if (notificationPermission() !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  // `vibrate`/`renotify` are valid on Android but missing from the DOM typings.
  const options = { body, tag, icon: 'pwa-192.png', vibrate, renotify: true } as NotificationOptions
  await reg.showNotification(title, options)
}
