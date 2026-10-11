import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { BackupError, backupFileName, backupSummary, exportBackup, parseBackup, restoreBackup } from '../db/backup'
import { setsToCsv } from '../lib/csv'
import { platform } from '../lib/platform'
import type { AppFile } from '../lib/platform/types'
import { useSettings } from '../stores/settings'

const LAST_BACKUP = 'lastBackupAt'

/** Settings → Backup and data: JSON backup and restore, CSV export, persistent storage status. */
export default function Backup() {
  const { t, i18n } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const lastBackup = useLiveQuery(() => db.meta.get(LAST_BACKUP), [])?.value as number | undefined

  const [autoBackups, setAutoBackups] = useState<AppFile[]>()

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
    void platform.appFiles?.list().then((l) => setAutoBackups(l.filter((f) => f.name.startsWith('pre-update-')).sort((a, b) => b.mtime - a.mtime)))
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMessage(undefined)
    try { await fn() } catch (e) {
      setMessage(e instanceof BackupError ? t(`backup.error.${e.reason}`) : t('backup.error.failed'))
    } finally { setBusy(false) }
  }

  const backup = () => run(async () => {
    const now = Date.now()
    const file = await exportBackup(db, __APP_VERSION__, now)
    const saved = await platform.saveFile(backupFileName(new Date(now)), new Blob([JSON.stringify(file)], { type: 'application/json' }))
    if (!saved) return
    await db.meta.put({ key: LAST_BACKUP, value: now })
    setMessage(t('backup.saved'))
  })

  // From a chosen file or one of the automatic backups kept in the app.
  const restoreText = (text: () => Promise<string>) => run(async () => {
    const file = parseBackup(await text(), db.verno)
    const s = backupSummary(file)
    if (!confirm(t('backup.confirmRestore', {
      date: new Date(s.exportedAt).toLocaleString(i18n.language), workouts: s.workouts, routines: s.routines, photos: s.photos,
    }))) return
    await restoreBackup(db, file)
    // Start fresh so every screen, store and scheduled notification picks up the restored data.
    window.location.reload()
  })

  const csv = () => run(async () => {
    const [sessions, sets, exercises, routines, gyms] = await Promise.all([
      db.sessions.toArray(), db.setLogs.toArray(), db.exercises.toArray(), db.routines.toArray(), db.gyms.toArray(),
    ])
    const text = setsToCsv({
      sessions, sets, units,
      exercises: new Map(exercises.map((e) => [e.id, e])),
      routines: new Map(routines.map((r) => [r.id, r])),
      gyms: new Map(gyms.map((g) => [g.id, g])),
    })
    // BOM so spreadsheet apps read accented names as UTF-8.
    await platform.saveFile(backupFileName().replace('backup', 'sets').replace('.json', '.csv'), new Blob(['﻿' + text], { type: 'text/csv' }))
  })

  return (
    <section>
      <p><Link to="/profile/settings">← {t('profile.settings')}</Link></p>
      <h1>{t('backup.title')}</h1>

      <h2>{t('backup.backupTitle')}</h2>
      <p className="muted small help">{t('backup.backupHelp')}</p>
      <p className="row">
        <span className="muted small">
          {lastBackup ? t('backup.last', { date: new Date(lastBackup).toLocaleDateString(i18n.language) }) : t('backup.never')}
        </span>
        <button className="primary" disabled={busy} onClick={() => void backup()}>{t('backup.export')}</button>
      </p>

      <h2>{t('backup.restoreTitle')}</h2>
      <p className="muted small help">{t('backup.restoreHelp')}</p>
      <p>
        <label className={`btn file-btn${busy ? ' disabled' : ''}`}>
          {t('backup.choose')}
          <input type="file" accept="application/json,.json" hidden disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restoreText(() => f.text()) }} />
        </label>
      </p>
      {autoBackups && autoBackups.length > 0 && (
        <>
          <p className="muted small help">{t('backup.autoHelp')}</p>
          <ul className="list">
            {autoBackups.map((f) => (
              <li key={f.name} className="row">
                <span>{new Date(f.mtime).toLocaleString(i18n.language)} <span className="muted small">· {(f.size / 1048576).toFixed(1)} MB</span></span>
                <button disabled={busy} onClick={() => void restoreText(() => platform.appFiles!.read(f.name))}>{t('backup.restore')}</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>{t('backup.csvTitle')}</h2>
      <p className="muted small help">{t('backup.csvHelp')}</p>
      <p><button disabled={busy} onClick={() => void csv()}>{t('backup.csv')}</button></p>

      {message && <p role="status">{message}</p>}

      {/* The installed app's data is never evicted; only the browser version can lose it under storage pressure. */}
      {!platform.isNative && (
        <>
          <p className="row">
            {t('profile.persist')}
            <span className="muted">{persisted ? t('profile.persistGranted') : t('profile.persistDenied')}</span>
          </p>
          {persisted === false && <p className="muted small help">{t('backup.persistHelp')}</p>}
        </>
      )}
    </section>
  )
}
