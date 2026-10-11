import type { GymDB } from './db'
import { DEFAULT_SETTINGS } from './types'

/**
 * Full backup as one JSON file: every table, rows as stored, with blobs (exercise, gym-note and progress photos)
 * inlined as base64. Restoring replaces all data, so "wipe the app, restore, everything is back" holds.
 */
export const BACKUP_APP = 'bliskfit'
export const BACKUP_FORMAT = 1

export interface BackupFile {
  app: typeof BACKUP_APP
  format: number
  /** Dexie schema version of the app that wrote it; a newer one than ours can't be restored. */
  schemaVersion: number
  appVersion: string
  exportedAt: number
  tables: Record<string, unknown[]>
}

export class BackupError extends Error {
  constructor(public reason: 'invalid' | 'newer') { super(reason) }
}

interface EncodedBlob { $blob: string; data: string }

const isEncodedBlob = (v: unknown): v is EncodedBlob =>
  typeof v === 'object' && v !== null && typeof (v as EncodedBlob).$blob === 'string' && typeof (v as EncodedBlob).data === 'string'

async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

// Blobs only ever sit at the top level of a row (photo fields).
async function encodeRow(row: object): Promise<object> {
  const out: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Blob) out[k] = { $blob: v.type, data: await blobToBase64(v) } satisfies EncodedBlob
  }
  return out
}

function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  for (const [k, v] of Object.entries(out)) if (isEncodedBlob(v)) out[k] = base64ToBlob(v.data, v.$blob)
  return out
}

export async function exportBackup(db: GymDB, appVersion: string, now = Date.now()): Promise<BackupFile> {
  // Read everything in one consistent snapshot, then encode outside the transaction (awaiting blob reads
  // inside it would let IndexedDB commit it early).
  const raw = await db.transaction('r', db.tables, () =>
    Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()] as const)))
  const tables: Record<string, unknown[]> = {}
  for (const [name, rows] of raw) tables[name] = await Promise.all(rows.map((r) => encodeRow(r as object)))
  return { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: db.verno, appVersion, exportedAt: now, tables }
}

/** Parses and checks a backup file's text; throws BackupError if it isn't one we can restore. */
export function parseBackup(text: string, currentSchema: number): BackupFile {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new BackupError('invalid') }
  const f = data as Partial<BackupFile>
  if (!f || f.app !== BACKUP_APP || typeof f.format !== 'number' || typeof f.schemaVersion !== 'number'
    || typeof f.tables !== 'object' || f.tables === null) throw new BackupError('invalid')
  if (f.format > BACKUP_FORMAT || f.schemaVersion > currentSchema) throw new BackupError('newer')
  for (const rows of Object.values(f.tables)) if (!Array.isArray(rows)) throw new BackupError('invalid')
  return f as BackupFile
}

/**
 * Replaces everything with the backup's contents in one transaction (all or nothing). Tables the backup doesn't
 * have (written before they existed) end up empty; unknown tables are ignored.
 */
export async function restoreBackup(db: GymDB, file: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const rows = (file.tables[table.name] ?? []) as Record<string, unknown>[]
      await table.bulkPut(rows.map(decodeRow))
    }
    // Settings added after the backup was written get their defaults.
    const s = await db.settings.get('settings')
    await db.settings.put({ ...DEFAULT_SETTINGS, ...s })
  })
}

export const backupFileName = (now = new Date()) =>
  `bliskfit-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`

/** Rough count of what a backup holds, shown before restoring. */
export function backupSummary(file: BackupFile) {
  const n = (t: string) => file.tables[t]?.length ?? 0
  const sessions = (file.tables.sessions ?? []) as { status?: string }[]
  return {
    workouts: sessions.filter((s) => s.status === 'finished').length,
    routines: n('routines'),
    photos: n('progressPhotos'),
    exportedAt: file.exportedAt,
  }
}
