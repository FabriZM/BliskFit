/** Best-effort PWA notifications. A web page can't schedule these while closed; the native wrapper (M3b) can. */
export const notificationsSupported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator
export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported'

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export async function showNotification(title: string, body: string, tag: string): Promise<void> {
  if (notificationPermission() !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(title, { body, tag, icon: 'pwa-192.png' })
}
