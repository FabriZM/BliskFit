import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Guards a screen holding an unsaved draft. Leaving it by any route (back arrow, tab bar, links, the phone's back
 * gesture) asks `message` first, and closing or reloading the page gets the browser's own prompt.
 * `allow(path)`: destinations that don't need asking (the draft is kept for them). `onDiscard`: runs when the user
 * agrees to leave. Call `release()` right before leaving on purpose (after saving).
 */
export function useDraftGuard(dirty: boolean, message: string, opts: { allow?: (path: string) => boolean; onDiscard?: () => void } = {}) {
  const live = useRef({ dirty, ...opts })
  live.current = { dirty, ...opts }
  const released = useRef(false)

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !released.current && live.current.dirty && currentLocation.pathname !== nextLocation.pathname
    && !live.current.allow?.(nextLocation.pathname))
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(message)) { live.current.onDiscard?.(); blocker.proceed() } else blocker.reset()
  }, [blocker, message])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return { release: () => { released.current = true } }
}
