import { describe, expect, it, vi } from 'vitest'

// An in-memory stand-in for the app's private file storage (only the Android app has it).
const files = new Map<string, { text: string; mtime: number }>()
let clock = 1000
vi.mock('../lib/platform', () => ({
  platform: {
    isNative: true,
    appFiles: {
      write: async (name: string, text: string) => { files.set(name, { text, mtime: clock++ }) },
      read: async (name: string) => files.get(name)!.text,
      list: async () => [...files].map(([name, f]) => ({ name, mtime: f.mtime, size: f.text.length })),
      remove: async (name: string) => { files.delete(name) },
    },
  },
}))

const { KEEP_AUTO_BACKUPS, saveAutoBackup } = await import('./appUpdate')
const { parseBackup } = await import('./backup')
const { db } = await import('./db')

describe('automatic pre-update backups', () => {
  it('saves a restorable backup and keeps only the newest few, leaving other files alone', async () => {
    files.set('notes.txt', { text: 'x', mtime: 0 })
    for (let i = 0; i < KEEP_AUTO_BACKUPS + 2; i++) await saveAutoBackup()
    const names = [...files.keys()].filter((n) => n.startsWith('pre-update-'))
    expect(names).toHaveLength(KEEP_AUTO_BACKUPS)
    expect(files.has('notes.txt')).toBe(true)
    // The oldest two are gone: the remaining ones are the latest writes.
    expect(Math.min(...names.map((n) => files.get(n)!.mtime))).toBe(clock - KEEP_AUTO_BACKUPS)
    expect(parseBackup(files.get(names[0])!.text, db.verno).app).toBe('bliskfit')
  })
})
