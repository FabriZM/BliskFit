import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShareError, androidAppIntent, decodeLinkData, linkDataFrom, validatePackage, type SharePackage } from '../lib/share'
import { importPackage, previewImport, type ImportPreview } from '../db/share'
import { useSettings } from '../stores/settings'
import { platform } from '../lib/platform'
import { BackLink } from '../components/PageHeader'

const isAndroidBrowser = () => !platform.isNative && /Android/i.test(navigator.userAgent)

/** Adds a routine or program someone shared, from a link (#/import?d=…), a pasted link or a file. */
export default function Import() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const [pkg, setPkg] = useState<SharePackage>()
  const [preview, setPreview] = useState<ImportPreview>()
  const [error, setError] = useState<string>()
  const [pasted, setPasted] = useState('')

  const show = async (load: () => Promise<SharePackage>) => {
    setError(undefined)
    try {
      const p = await load()
      setPreview(await previewImport(p))
      setPkg(p)
    } catch (e) {
      setPkg(undefined)
      setError(t(`share.error.${e instanceof ShareError ? e.reason : 'invalid'}`))
    }
  }

  const d = params.get('d')
  useEffect(() => { if (d) void show(() => decodeLinkData(d)) }, [d]) // eslint-disable-line react-hooks/exhaustive-deps

  const fromFile = (f: File) => show(async () => {
    let json: unknown
    try { json = JSON.parse(await f.text()) } catch { throw new ShareError('invalid') }
    return validatePackage(json)
  })
  const fromPaste = () => {
    const code = linkDataFrom(pasted)
    if (code) void show(() => decodeLinkData(code))
    else setError(t('share.error.invalid'))
  }

  const add = async () => {
    if (!pkg) return
    const res = await importPackage(pkg, weekStartDay)
    nav(res.kind === 'program' ? `/routines/programs/${res.id}` : `/routines/${res.id}`, { replace: true })
  }

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <h1>{t('share.importTitle')}</h1>
      {pkg && preview ? (
        <div className="card">
          <p><strong>{pkg.kind === 'program' ? pkg.program!.name : pkg.routines[0].name}</strong></p>
          <p className="muted">{pkg.kind === 'program'
            ? t('share.programSummary', { count: pkg.routines.length })
            : t('routines.exerciseCount', { count: pkg.routines[0].exercises.length })}</p>
          {pkg.kind === 'program' && <ul className="muted small">{pkg.routines.map((r, i) => <li key={i}>{r.name}</li>)}</ul>}
          {preview.newExercises.length > 0 && (
            <p className="small">{t('share.newExercises', { count: preview.newExercises.length, names: preview.newExercises.join(', ') })}</p>
          )}
          {preview.missing > 0 && <p className="small">{t('share.missing', { count: preview.missing })}</p>}
          <p className="muted small help">{t(pkg.kind === 'program' ? 'share.addProgramHelp' : 'share.addRoutineHelp')}</p>
          {d && isAndroidBrowser() && (
            // The web app and the Android app keep separate data, so app users want it added there.
            <p className="muted small help">{t('share.inAppHelp')} <a href={androidAppIntent(d)}>{t('share.openInApp')}</a></p>
          )}
          <div className="actions">
            <button className="primary" onClick={() => void add()}>{t(pkg.kind === 'program' ? 'share.addProgram' : 'share.addRoutine')}</button>
            <button onClick={() => { setPkg(undefined); nav('/import', { replace: true }) }}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted small help">{t('share.importHelp')}</p>
          <p>
            <label className="btn file-btn">
              {t('share.chooseFile')}
              <input type="file" accept="application/json,.json" hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void fromFile(f) }} />
            </label>
          </p>
          <div className="row">
            <input value={pasted} placeholder={t('share.pastePlaceholder')} aria-label={t('share.pastePlaceholder')}
              onChange={(e) => setPasted(e.target.value)} />
            <button disabled={!pasted.trim()} onClick={fromPaste}>{t('share.open')}</button>
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
