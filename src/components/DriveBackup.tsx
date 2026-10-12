import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  backupToDrive, connectDrive, deleteDriveBackup, disconnectDrive, downloadDriveBackup, listDriveBackups, useDriveState,
} from '../db/driveBackup'
import type { DriveFile } from '../lib/drive'
import { GoogleAuthError } from '../lib/platform'

/** Backup and data → Google Drive: connect, back up now, list and restore Drive backups, disconnect. */
export default function DriveBackup({ restore }: { restore: (text: () => Promise<string>) => Promise<void> }) {
  const { t, i18n } = useTranslation()
  const s = useDriveState()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const [files, setFiles] = useState<DriveFile[]>()

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true)
    setMessage(undefined)
    try {
      await fn()
      if (done) setMessage(done)
    } catch (e) {
      // Closing Google's screen is a choice, not an error.
      if (e instanceof GoogleAuthError && e.reason === 'canceled') return
      setMessage(t(e instanceof GoogleAuthError && e.reason === 'popup' ? 'drive.popupBlocked' : 'drive.failed'))
    } finally { setBusy(false) }
  }
  const fmt = (ms: number) => new Date(ms).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  if (!s.connected) {
    return (
      <>
        <h2>{t('drive.title')}</h2>
        <p className="muted small help">{t('drive.help')}</p>
        <p><button className="primary" disabled={busy} onClick={() => void run(connectDrive, t('drive.connected'))}>{t('drive.connect')}</button></p>
        {message && <p role="status">{message}</p>}
      </>
    )
  }

  return (
    <>
      <h2>{t('drive.title')}</h2>
      <p className="muted small help">{s.email ? t('drive.account', { email: s.email }) : t('drive.connectedShort')} {t('drive.autoHelp')}</p>
      {s.problem && <p className="small" role="alert">{t(`drive.problem.${s.problem}`)}</p>}
      <div className="row">
        <span className="muted small">{s.lastBackupAt ? t('backup.last', { date: fmt(s.lastBackupAt) }) : t('backup.never')}</span>
        <button className="primary" disabled={busy} onClick={() => void run(() => backupToDrive(true), t('backup.saved'))}>{t('drive.backupNow')}</button>
      </div>
      {files === undefined ? (
        <p><button disabled={busy} onClick={() => void run(async () => setFiles(await listDriveBackups(true)))}>{t('drive.show')}</button></p>
      ) : files.length === 0 ? (
        <p className="muted small">{t('drive.none')}</p>
      ) : (
        <ul className="list">
          {files.map((file) => (
            <li key={file.id} className="row">
              <span>{fmt(file.createdTime)} <span className="muted small">· {(file.size / 1048576).toFixed(1)} MB</span></span>
              <span>
                <button disabled={busy} onClick={() => void restore(() => downloadDriveBackup(file.id))}>{t('backup.restore')}</button>{' '}
                <button className="icon" aria-label={t('common.delete')} disabled={busy} onClick={() => {
                  if (!confirm(t('drive.confirmDelete', { date: fmt(file.createdTime) }))) return
                  void run(async () => { await deleteDriveBackup(file.id); setFiles(files.filter((x) => x.id !== file.id)) })
                }}>🗑</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        <button disabled={busy} onClick={() => { if (confirm(t('drive.confirmDisconnect'))) void run(async () => { await disconnectDrive(); setFiles(undefined) }) }}>
          {t('drive.disconnect')}
        </button>
      </p>
      {message && <p role="status">{message}</p>}
    </>
  )
}
