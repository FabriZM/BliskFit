/**
 * Minimal Google Drive client for backups (REST over fetch, no SDK). With the `drive.file` scope the app only
 * sees files it created, so the backup folder is found by name among those, never among the user's own files.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const FOLDER_NAME = 'BliskFit backups'
export const KEEP_DRIVE_BACKUPS = 7

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export class DriveError extends Error {
  constructor(public status: number, message = `Drive ${status}`) { super(message) }
}

export interface DriveFile { id: string; name: string; size: number; createdTime: number }

type Fetch = typeof fetch

/** Calls the Drive API with the token; throws DriveError for anything but a 2xx. */
async function request(f: Fetch, token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await f(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new DriveError(res.status)
  return res
}

const q = (s: string) => encodeURIComponent(s)

export async function accountEmail(f: Fetch, token: string): Promise<string | undefined> {
  const res = await request(f, token, `${API}/about?fields=user(emailAddress)`)
  return ((await res.json()) as { user?: { emailAddress?: string } }).user?.emailAddress
}

/** The app's backup folder, created on first use. */
export async function ensureFolder(f: Fetch, token: string): Promise<string> {
  const query = `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`
  const found = await request(f, token, `${API}/files?q=${q(query)}&spaces=drive&fields=files(id)&orderBy=createdTime`)
  const id = ((await found.json()) as { files: { id: string }[] }).files[0]?.id
  if (id) return id
  const created = await request(f, token, `${API}/files?fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  })
  return ((await created.json()) as { id: string }).id
}

/** Resumable upload (works for any size; backups with photos can pass the 5 MB simple-upload limit). */
export async function uploadFile(f: Fetch, token: string, folderId: string, name: string, data: Blob): Promise<DriveFile> {
  const start = await request(f, token, `${UPLOAD}/files?uploadType=resumable&fields=id,name,size,createdTime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': data.type || 'application/json' },
    body: JSON.stringify({ name, parents: [folderId], mimeType: data.type || 'application/json' }),
  })
  const session = start.headers.get('Location')
  if (!session) throw new DriveError(0, 'No upload session')
  // The session URL carries its own authorization.
  const res = await f(session, { method: 'PUT', headers: { 'Content-Type': data.type || 'application/json' }, body: data })
  if (!res.ok) throw new DriveError(res.status)
  return toFile(await res.json())
}

const toFile = (j: { id: string; name: string; size?: string; createdTime?: string }): DriveFile =>
  ({ id: j.id, name: j.name, size: Number(j.size ?? 0), createdTime: j.createdTime ? Date.parse(j.createdTime) : 0 })

/** Backups in the folder, newest first. */
export async function listFiles(f: Fetch, token: string, folderId: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed=false`
  const res = await request(f, token, `${API}/files?q=${q(query)}&spaces=drive&orderBy=createdTime desc&pageSize=100&fields=files(id,name,size,createdTime)`)
  return ((await res.json()) as { files: Parameters<typeof toFile>[0][] }).files.map(toFile)
}

export async function downloadText(f: Fetch, token: string, fileId: string): Promise<string> {
  return (await request(f, token, `${API}/files/${q(fileId)}?alt=media`)).text()
}

export async function deleteFile(f: Fetch, token: string, fileId: string): Promise<void> {
  await request(f, token, `${API}/files/${q(fileId)}`, { method: 'DELETE' })
}

/** Deletes all but the newest `keep` backups; returns what's left. */
export async function prune(f: Fetch, token: string, folderId: string, keep = KEEP_DRIVE_BACKUPS): Promise<DriveFile[]> {
  const files = await listFiles(f, token, folderId)
  for (const file of files.slice(keep)) await deleteFile(f, token, file.id)
  return files.slice(0, keep)
}

export const DAY_MS = 24 * 60 * 60 * 1000
/** An automatic backup on launch is due once a day; finishing a workout always backs up. */
export const driveBackupDue = (lastAt: number | undefined, now: number) => lastAt === undefined || now - lastAt >= DAY_MS

const pad = (n: number) => String(n).padStart(2, '0')
export const driveBackupName = (now = new Date()) =>
  `bliskfit-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`
