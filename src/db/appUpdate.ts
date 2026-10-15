import { useCallback, useEffect, useState } from 'react'
import { db } from './db'
import { exportBackup } from './backup'
import { platform } from '../lib/platform'
import { RELEASES_API, newestRelease, offer, pickDownload, shouldCheck, type AppRelease } from '../lib/updates'

/** Automatic backups saved before installing an update; the newest few are kept. */
export const KEEP_AUTO_BACKUPS = 3
export const autoBackupName = (build: number, now = Date.now()) => `pre-update-${build}-${now}.json`

/** Newest first; the oldest beyond `keep` are deleted. */
export async function pruneAutoBackups(keep = KEEP_AUTO_BACKUPS): Promise<void> {
  const files = platform.appFiles
  if (!files) return
  const list = (await files.list()).filter((f) => f.name.startsWith('pre-update-')).sort((a, b) => b.mtime - a.mtime)
  for (const f of list.slice(keep)) await files.remove(f.name)
}

export async function saveAutoBackup(): Promise<void> {
  const files = platform.appFiles
  if (!files) return
  const file = await exportBackup(db, __APP_VERSION__)
  await files.write(autoBackupName(__APP_BUILD__, file.exportedAt), JSON.stringify(file))
  await pruneAutoBackups()
}

// Per-device state, so it lives in localStorage (not in the database, which backups copy between phones).
const STATE_KEY = 'bliskfit.update'
interface UpdateState { checkedAt?: number; release?: AppRelease }
const readState = (): UpdateState => { try { return JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}') as UpdateState } catch { return {} } }
const writeState = (s: UpdateState) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)) } catch { /* private mode etc. */ } }

/** The newest published release (highest build), fetched fresh. */
export async function fetchLatestRelease(): Promise<AppRelease | undefined> {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return newestRelease(await res.json())
}

/** Outside the app's origin, so Capacitor hands it to the system browser, which downloads the APK. */
export const openDownload = (release: AppRelease) => { location.href = release.apkUrl }

export type CheckStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'failed'

/**
 * Update check for the Android app (the web version updates itself through its service worker). Runs on launch
 * and when the app comes back to the foreground, at most once an hour; `check()` forces one. `install()` checks
 * once more for anything newer, saves an automatic backup, then opens the newest APK's download in the browser,
 * from where Android's installer takes over (data is kept: same app, same signing key).
 */
export function useAppUpdate(auto = false) {
  const [state, setState] = useState<UpdateState>(readState)
  const [status, setStatus] = useState<CheckStatus>('idle')

  const check = useCallback(async (force: boolean) => {
    if (!platform.isNative) return
    const current = readState()
    if (!force && !shouldCheck(current.checkedAt, Date.now())) return
    setStatus('checking')
    try {
      const release = await fetchLatestRelease()
      const next = { ...current, checkedAt: Date.now(), release }
      writeState(next)
      setState(next)
      setStatus(offer(release, __APP_BUILD__) ? 'available' : 'upToDate')
    } catch {
      setStatus('failed')
    }
  }, [])

  useEffect(() => {
    if (!auto) return
    void check(false)
    const onShow = () => { if (document.visibilityState === 'visible') void check(false) }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [auto, check])

  return {
    status,
    /** The newest release, if it's newer than this build. */
    available: offer(state.release, __APP_BUILD__),
    check: () => check(true),
    /** Saves the automatic backup, then opens the download. Rejects if the backup failed, so the UI can ask. */
    install: async (release: AppRelease) => {
      // The offer may be from an earlier check: download whatever is newest right now.
      const latest = await fetchLatestRelease().catch(() => undefined)
      const target = pickDownload(release, latest)
      await saveAutoBackup()
      openDownload(target)
    },
    openDownload,
  }
}
