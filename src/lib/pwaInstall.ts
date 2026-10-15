import { useEffect, useState } from 'react'

/**
 * Chrome on Android offers a real install prompt for the web app, but only through an event that fires once,
 * early. It's captured when this module loads (imported from main.tsx) and kept until the user answers.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let saved: InstallPromptEvent | undefined
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); saved = e as InstallPromptEvent; notify() })
  window.addEventListener('appinstalled', () => { saved = undefined; notify() })
}

/** Whether the browser can show its install prompt right now, and a function that shows it. */
export function usePwaInstall(): { canInstall: boolean; install: () => Promise<void> } {
  const [, tick] = useState(0)
  useEffect(() => {
    const l = () => tick((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  return {
    canInstall: !!saved,
    install: async () => {
      const e = saved
      if (!e) return
      saved = undefined // the event can only be used once
      notify()
      await e.prompt()
      await e.userChoice
    },
  }
}
