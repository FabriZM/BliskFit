import { useEffect, useState } from 'react'
import { db } from './db'
import { exportBackup } from './backup'
import { platform, GoogleAuthError } from '../lib/platform'
import {
  DriveError, KEEP_DRIVE_BACKUPS, accountEmail, deleteFile, downloadText, driveBackupDue, driveBackupName,
  ensureFolder, listFiles, prune, uploadFile, type DriveFile,
} from '../lib/drive'

/**
 * Backups to the user's own Google Drive (folder "BliskFit backups", newest 7 kept). Connected once by the user;
 * then a backup runs after every finished workout and on launch when the last one is a day old. Automatic runs
 * never show Google's screens: if a sign-in is needed (the web version, after about an hour) they wait for the
 * next manual "Back up now".
 */
export interface DriveState {
  connected: boolean
  email?: string
  folderId?: string
  lastBackupAt?: number
  /** Last automatic run's problem, shown in Backup and data until a backup succeeds. */
  problem?: 'signIn' | 'failed'
}

// Per device (which account this phone backs up to), so localStorage rather than the database a backup copies.
const KEY = 'bliskfit.drive'
const EVENT = 'bliskfit-drive'
export const readDriveState = (): DriveState => {
  try { return { connected: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DriveState> } } catch { return { connected: false } }
}
function writeState(patch: Partial<DriveState> | null) {
  const next = patch === null ? { connected: false } : { ...readDriveState(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT))
}

export function useDriveState(): DriveState {
  const [s, set] = useState(readDriveState)
  useEffect(() => {
    const on = () => set(readDriveState())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return s
}

const f: typeof fetch = (...a) => fetch(...a)

/** Runs `fn` with a token, retrying once with a fresh one if Google rejects it (revoked or expired). */
async function withToken<T>(interactive: boolean, fn: (token: string) => Promise<T>): Promise<T> {
  const auth = platform.googleAuth
  const token = await auth.getToken(interactive)
  try {
    return await fn(token)
  } catch (e) {
    if (!(e instanceof DriveError) || e.status !== 401) throw e
    await auth.clearToken(token)
    return fn(await auth.getToken(interactive))
  }
}

/** Shows Google's sign-in, finds or creates the folder, and makes the first backup. */
export async function connectDrive(): Promise<void> {
  await withToken(true, async (token) => {
    const [email, folderId] = await Promise.all([accountEmail(f, token).catch(() => undefined), ensureFolder(f, token)])
    writeState({ connected: true, email, folderId, problem: undefined })
  })
  await backupToDrive(true)
}

const SIGN_IN_NUDGE_MS = 3 * 24 * 60 * 60 * 1000

let running: Promise<void> | undefined

/** One backup now. Interactive runs may show Google's sign-in; automatic ones reject with GoogleAuthError('consent'). */
export function backupToDrive(interactive: boolean): Promise<void> {
  running ??= (async () => {
    try {
      await withToken(interactive, async (token) => {
        const file = await exportBackup(db, __APP_VERSION__)
        const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
        const name = driveBackupName(new Date(file.exportedAt))
        let folderId = readDriveState().folderId ?? await ensureFolder(f, token)
        try {
          await uploadFile(f, token, folderId, name, blob)
        } catch (e) {
          // The folder was deleted or trashed in Drive: make a new one.
          if (!(e instanceof DriveError) || e.status !== 404) throw e
          folderId = await ensureFolder(f, token)
          await uploadFile(f, token, folderId, name, blob)
        }
        await prune(f, token, folderId, KEEP_DRIVE_BACKUPS)
        writeState({ folderId, lastBackupAt: file.exportedAt, problem: undefined })
      })
    } finally {
      running = undefined
    }
  })()
  return running
}

/** Automatic backup: after a workout (`force`) or on launch once a day. Never prompts; records problems quietly. */
export async function autoBackupToDrive(force: boolean): Promise<void> {
  const s = readDriveState()
  if (!s.connected || (!force && !driveBackupDue(s.lastBackupAt, Date.now()))) return
  try {
    await backupToDrive(false)
  } catch (e) {
    if (!(e instanceof GoogleAuthError)) return writeState({ problem: 'failed' })
    // The web version can't renew a sign-in silently, so this is routine there: only speak up once backups are
    // a few days old.
    if (!s.lastBackupAt || Date.now() - s.lastBackupAt > SIGN_IN_NUDGE_MS) writeState({ problem: 'signIn' })
  }
}

export async function listDriveBackups(interactive: boolean): Promise<DriveFile[]> {
  return withToken(interactive, async (token) => {
    const folderId = readDriveState().folderId ?? await ensureFolder(f, token)
    return listFiles(f, token, folderId)
  })
}

export const downloadDriveBackup = (fileId: string) => withToken(true, (token) => downloadText(f, token, fileId))
export const deleteDriveBackup = (fileId: string) => withToken(true, (token) => deleteFile(f, token, fileId))

/** Stops backing up and withdraws the app's access; the backups already in Drive stay there. */
export async function disconnectDrive(): Promise<void> {
  const { email } = readDriveState()
  const token = await platform.googleAuth.getToken(false).catch(() => undefined)
  await platform.googleAuth.revoke(token, email).catch(() => undefined)
  writeState(null)
}
