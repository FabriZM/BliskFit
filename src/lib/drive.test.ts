import { describe, expect, it } from 'vitest'
import { DAY_MS, DriveError, FOLDER_NAME, driveBackupDue, driveBackupName, ensureFolder, listFiles, prune, uploadFile } from './drive'

interface Call { url: string; method: string; auth?: string; body?: unknown }

/** A fake Drive: records calls and answers from a small in-memory file list. */
function fakeDrive(files: { id: string; name: string; parents: string[]; createdTime: string; mimeType?: string }[] = []) {
  const calls: Call[] = []
  let next = 1
  const f = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    const method = init.method ?? 'GET'
    const headers = init.headers as Record<string, string> | undefined
    calls.push({ url, method, auth: headers?.Authorization, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body })
    const json = (v: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(v), { status: 200, headers: extra })
    const u = new URL(url)
    if (url.startsWith('https://upload.session/')) {
      const meta = JSON.parse(decodeURIComponent(u.searchParams.get('meta')!))
      const file = { id: `f${next++}`, name: meta.name, parents: meta.parents, createdTime: new Date(1000 * next).toISOString() }
      files.push(file)
      return json({ ...file, size: String((init.body as Blob).size) })
    }
    if (u.pathname.startsWith('/upload/')) {
      return json({}, { Location: `https://upload.session/?meta=${encodeURIComponent(init.body as string)}` })
    }
    if (method === 'DELETE') {
      const id = u.pathname.split('/').pop()!
      files.splice(files.findIndex((x) => x.id === id), 1)
      return new Response(null, { status: 204 })
    }
    if (method === 'POST') {
      const body = JSON.parse(init.body as string)
      const file = { id: `folder${next++}`, ...body, parents: [], createdTime: new Date().toISOString() }
      files.push(file)
      return json({ id: file.id })
    }
    const query = u.searchParams.get('q') ?? ''
    const inFolder = /'([^']+)' in parents/.exec(query)?.[1]
    const list = files
      .filter((x) => (inFolder ? x.parents.includes(inFolder) : x.mimeType === 'application/vnd.google-apps.folder' && query.includes(x.name)))
      .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
    return json({ files: list })
  }) as typeof fetch
  return { f, calls, files }
}

describe('Google Drive backups', () => {
  it('creates the backup folder once and then reuses it', async () => {
    const d = fakeDrive()
    const id = await ensureFolder(d.f, 'tok')
    expect(d.files[0]).toMatchObject({ id, name: FOLDER_NAME })
    expect(await ensureFolder(d.f, 'tok')).toBe(id)
    expect(d.files).toHaveLength(1)
    expect(d.calls.every((c) => c.auth === 'Bearer tok')).toBe(true)
  })

  it('uploads through a resumable session into the folder', async () => {
    const d = fakeDrive()
    const file = await uploadFile(d.f, 'tok', 'F', 'b.json', new Blob(['{"a":1}'], { type: 'application/json' }))
    expect(file).toMatchObject({ name: 'b.json', size: 7 })
    expect(d.calls[0]).toMatchObject({ method: 'POST', body: { name: 'b.json', parents: ['F'], mimeType: 'application/json' } })
    expect(d.calls[0].url).toContain('uploadType=resumable')
    expect(d.calls[1]).toMatchObject({ method: 'PUT', auth: undefined }) // the session URL is pre-authorized
  })

  it('keeps only the newest backups', async () => {
    const d = fakeDrive(Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, name: `b${i}`, parents: ['F'], createdTime: new Date(2026, 0, i + 1).toISOString() })))
    const left = await prune(d.f, 'tok', 'F', 7)
    expect(left.map((f) => f.id)).toEqual(['b9', 'b8', 'b7', 'b6', 'b5', 'b4', 'b3'])
    expect((await listFiles(d.f, 'tok', 'F')).length).toBe(7)
  })

  it('reports HTTP failures with their status', async () => {
    const f = (async () => new Response('nope', { status: 401 })) as typeof fetch
    await expect(listFiles(f, 'tok', 'F')).rejects.toEqual(new DriveError(401))
  })

  it('is due once a day and names files by date and time', () => {
    expect(driveBackupDue(undefined, 1)).toBe(true)
    expect(driveBackupDue(0, DAY_MS - 1)).toBe(false)
    expect(driveBackupDue(0, DAY_MS)).toBe(true)
    expect(driveBackupName(new Date(2026, 9, 11, 7, 5))).toBe('bliskfit-backup-2026-10-11-0705.json')
  })
})
