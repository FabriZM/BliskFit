import { useEffect, useState } from 'react'

/** Re-renders every `ms` and whenever the tab becomes visible again (timers are derived from timestamps). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [ms])
  return now
}
