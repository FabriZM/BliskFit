import { useEffect } from 'react'
import { platform } from './platform'

/** Keeps the screen on while `enabled` (Wake Lock in the browser, KeepAwake in the Android app). */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    void platform.keepAwake(true).catch(() => { /* non-critical */ })
    return () => { void platform.keepAwake(false).catch(() => {}) }
  }, [enabled])
}
