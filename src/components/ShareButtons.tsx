import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { encodeLinkData, shareFileName, type SharePackage } from '../lib/share'
import { platform } from '../lib/platform'

/** Where shared links point: this page in the browser; the public web app from the Android app (its own origin is local). */
const PUBLIC_URL = 'https://fabrizm.github.io/BliskFit/'
const appUrl = () => (platform.isNative ? PUBLIC_URL : location.origin + location.pathname)

export async function shareLinkFor(p: SharePackage): Promise<string> {
  return `${appUrl()}#/import?d=${await encodeLinkData(p)}`
}

/** "Share link" and "Share file" for a routine or program; `pack` builds the package when tapped. */
export default function ShareButtons({ name, pack }: { name: string; pack: () => Promise<SharePackage | undefined> }) {
  const { t } = useTranslation()
  const [note, setNote] = useState<string>()

  const link = async () => {
    const p = await pack()
    if (!p) return
    const res = await platform.shareLink(t('share.linkTitle', { name }), await shareLinkFor(p))
    setNote(res === 'copied' ? t('share.copied') : undefined)
  }
  const file = async () => {
    const p = await pack()
    if (!p) return
    await platform.saveFile(shareFileName(name), new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }))
  }

  return (
    <>
      <button onClick={() => void link().catch(() => setNote(t('share.failed')))}>{t('share.link')}</button>
      <button onClick={() => void file().catch(() => setNote(t('share.failed')))}>{t('share.file')}</button>
      {note && <span className="muted small" role="status">{note}</span>}
    </>
  )
}
