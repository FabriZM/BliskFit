import { beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in Google sign-in: hands out numbered tokens; can be told to need consent.
const auth = { needsConsent: false, issued: 0, cleared: [] as string[], revoked: [] as (string | undefined)[] }
vi.mock('../lib/platform', async () => {
  const { GoogleAuthError } = await import('../lib/platform/types')
  return {
    GoogleAuthError,
    platform: {
      isNative: true,
      googleAuth: {
        getToken: async (interactive: boolean) => {
          if (auth.needsConsent && !interactive) throw new GoogleAuthError('consent')
          return `tok${++auth.issued}`
        },
        clearToken: async (t: string) => { auth.cleared.push(t) },
        revoke: async (_t: string | undefined, email?: string) => { auth.revoked.push(email) },
      },
    },
  }
})

// A small fake Drive behind fetch: one folder, files in it, optional failures.
const drive = { folders: [] as string[], files: [] as { id: string; parent: string; name: string; t: number }[], rejectToken: '', uploads: 0 }
let n = 0
vi.stubGlobal('localStorage', (() => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() }
})())
vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage }))
vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
  const url = new URL(input)
  const method = init.method ?? 'GET'
  const authz = (init.headers as Record<string, string> | undefined)?.Authorization
  const json = (v: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(v), { status: 200, headers: h })
  if (url.host === 'upload.session') {
    const meta = JSON.parse(url.searchParams.get('m')!)
    if (!drive.folders.includes(meta.parents[0])) return new Response('', { status: 404 })
    drive.uploads++
    const f = { id: `f${++n}`, parent: meta.parents[0], name: meta.name, t: n }
    drive.files.push(f)
    return json({ id: f.id, name: f.name, size: '10', createdTime: new Date(n * 1000).toISOString() })
  }
  if (authz === `Bearer ${drive.rejectToken}`) return new Response('', { status: 401 })
  if (url.pathname.startsWith('/upload/')) return json({}, { Location: `https://upload.session/?m=${encodeURIComponent(init.body as string)}` })
  if (url.pathname.endsWith('/about')) return json({ user: { emailAddress: 'me@example.com' } })
  if (method === 'POST') { const id = `folder${++n}`; drive.folders.push(id); return json({ id }) }
  if (method === 'DELETE') { const id = url.pathname.split('/').pop(); drive.files = drive.files.filter((f) => f.id !== id); return new Response(null, { status: 204 }) }
  const q = url.searchParams.get('q') ?? ''
  const parent = /'([^']+)' in parents/.exec(q)?.[1]
  if (parent) return json({ files: drive.files.filter((f) => f.parent === parent).sort((a, b) => b.t - a.t).map((f) => ({ id: f.id, name: f.name, size: '10', createdTime: new Date(f.t * 1000).toISOString() })) })
  return json({ files: drive.folders.map((id) => ({ id })) })
})

const { autoBackupToDrive, backupToDrive, connectDrive, disconnectDrive, listDriveBackups, readDriveState } = await import('./driveBackup')
const { KEEP_DRIVE_BACKUPS } = await import('../lib/drive')

describe('Google Drive backup flow', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.assign(auth, { needsConsent: false, issued: 0, cleared: [], revoked: [] })
    Object.assign(drive, { folders: [], files: [], rejectToken: '', uploads: 0 })
  })

  it('connecting creates the folder, remembers the account and saves a first backup', async () => {
    await connectDrive()
    expect(readDriveState()).toMatchObject({ connected: true, email: 'me@example.com', folderId: drive.folders[0] })
    expect(readDriveState().lastBackupAt).toBeGreaterThan(0)
    expect(drive.files).toHaveLength(1)
  })

  it('keeps the newest backups only', async () => {
    await connectDrive()
    for (let i = 0; i < KEEP_DRIVE_BACKUPS + 2; i++) await backupToDrive(true)
    expect(await listDriveBackups(true)).toHaveLength(KEEP_DRIVE_BACKUPS)
  })

  it('retries once with a fresh token when Google rejects the current one', async () => {
    await connectDrive()
    drive.rejectToken = `tok${auth.issued + 1}`
    await backupToDrive(false)
    expect(auth.cleared).toEqual([drive.rejectToken])
    expect(drive.uploads).toBe(2)
  })

  it('makes a new folder if the old one was deleted in Drive', async () => {
    await connectDrive()
    drive.folders = []
    await backupToDrive(true)
    expect(readDriveState().folderId).toBe(drive.folders[0])
    expect(drive.uploads).toBe(2)
  })

  it('automatic runs: nothing when not connected, daily on launch, always after a workout', async () => {
    await autoBackupToDrive(true)
    expect(drive.uploads).toBe(0)
    await connectDrive()
    await autoBackupToDrive(false) // just backed up
    expect(drive.uploads).toBe(1)
    await autoBackupToDrive(true)
    expect(drive.uploads).toBe(2)
  })

  it('automatic runs never prompt; a needed sign-in is flagged only once backups are a few days old', async () => {
    await connectDrive()
    auth.needsConsent = true
    await autoBackupToDrive(true)
    expect(readDriveState().problem).toBeUndefined()
    localStorage.setItem('bliskfit.drive', JSON.stringify({ ...readDriveState(), lastBackupAt: Date.now() - 4 * 86400000 }))
    await autoBackupToDrive(true)
    expect(readDriveState().problem).toBe('signIn')
    auth.needsConsent = false
    await backupToDrive(true)
    expect(readDriveState().problem).toBeUndefined()
  })

  it('disconnecting revokes access and forgets the account, leaving the backups in Drive', async () => {
    await connectDrive()
    await disconnectDrive()
    expect(auth.revoked).toEqual(['me@example.com'])
    expect(readDriveState()).toEqual({ connected: false })
    expect(drive.files).toHaveLength(1)
  })
})
