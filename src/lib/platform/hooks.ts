import { useCallback, useEffect, useState } from 'react'
import { platform } from '.'
import type { PermissionState } from './types'

/** Notification and exact-alarm permission, refreshed when the app returns from system settings. */
export function useNotificationState() {
  const [permission, setPermission] = useState<PermissionState | null>(null)
  const [exact, setExact] = useState<PermissionState | null>(null)
  const refresh = useCallback(async () => {
    setPermission(await platform.notifications.permission().catch(() => 'unsupported' as const))
    setExact(await platform.notifications.exactAlarms().catch(() => 'unsupported' as const))
  }, [])
  useEffect(() => {
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])
  const request = useCallback(async () => { await platform.notifications.request(); await refresh() }, [refresh])
  const openExactSettings = useCallback(async () => { await platform.notifications.openExactAlarmSettings() }, [])
  return { permission, exact, request, openExactSettings, refresh }
}
