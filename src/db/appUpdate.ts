import { useCallback, useEffect, useState } from 'react'
import { db } from './db'
import { exportBackup } from './backup'
import { platform } from '../lib/platform'
import { RELEASES_API, offer, parseRelease, shouldCheck, type AppRelease } from '../lib/updates'

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

export async function fetchLatestRelease(): Promise<AppRelease | undefined> {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
  if (res.status === 404) return undefined // no release published yet
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return parseRelease(await res.json())
}

/** Outside the app's origin, so Capacitor hands it to the system browser, which downloads the APK. */
export const openDownload = (release: AppRelease) => { location.href = release.apkUrl }

export type CheckStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'failed'

/**
 * Update check for the Android app (the web version updates itself through its service worker). Runs on launch
 * at most once a day; `check()` forces one. `install()` saves an automatic backup, then opens the APK download
 * in the browser, from where Android's installer takes over (data is kept: same app, same signing key).
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

  useEffect(() => { if (auto) void check(false) }, [auto, check])

  return {
    status,
    /** The newest release, if it's newer than this build. */
    available: offer(state.release, __APP_BUILD__),
    check: () => check(true),
    /** Saves the automatic backup, then opens the download. Rejects if the backup failed, so the UI can ask. */
    install: async (release: AppRelease) => {
      await saveAutoBackup()
      openDownload(release)
    },
    openDownload,
  }
}
