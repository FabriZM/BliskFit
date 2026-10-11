import { useEffect } from 'react'

/** Keeps the screen on while `enabled`; the browser drops the lock when the tab hides, so re-acquire on return. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) void l.release()
        else lock = l
      } catch { /* denied or unsupported; non-critical */ }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', acquire); void lock?.release() }
  }, [enabled])
}
