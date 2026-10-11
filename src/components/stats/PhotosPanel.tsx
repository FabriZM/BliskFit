import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProgressPhoto } from '../../db/types'
import { compareDefaults, photoTags, photosWithTag } from '../../lib/body'
import { cardId } from '../../lib/pinCards'
import Photo from '../Photo'
import PinButton from './PinButton'

const ALL = '\u0000all'

/** Slider compare: B sits on top of A and is revealed up to the handle. */
function Slider({ a, b, labels }: { a: ProgressPhoto; b: ProgressPhoto; labels: [string, string] }) {
  const [pos, setPos] = useState(50)
  return (
    <div className="cmp-slider">
      <div className="cmp-stack">
        <Photo blob={a.photo} alt={labels[0]} className="cmp-img" />
        <div className="cmp-top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><Photo blob={b.photo} alt={labels[1]} className="cmp-img" /></div>
        <i className="cmp-handle" style={{ left: `${pos}%` }} />
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={`${labels[0]} / ${labels[1]}`} />
      <div className="row cmp-labels small muted"><span>{labels[1]}</span><span>{labels[0]}</span></div>
    </div>
  )
}

/** Progress photos: timeline grid by tag, full-size view, compare two dates, and pin buttons. Read-only. */
export default function PhotosPanel({ photos }: { photos: ProgressPhoto[] }) {
  const { t, i18n } = useTranslation()
  const tags = photoTags(photos)
  const hasUntagged = photos.some((p) => !p.tag)
  const [filter, setFilter] = useState<string | undefined>(ALL)
  const [open, setOpen] = useState<ProgressPhoto>()
  const [mode, setMode] = useState<'side' | 'slider'>('side')
  const [pick, setPick] = useState<{ a?: string; b?: string }>({})

  const fmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
  // The filter may point at a tag that no longer exists (its last photo was deleted).
  const filterGone = filter !== ALL && (filter === undefined ? !hasUntagged : !tags.includes(filter))
  useEffect(() => { if (filterGone) setFilter(ALL) }, [filterGone])
  useEffect(() => { setPick({}) }, [filter])

  if (!photos.length) return null
  const cmpTag = filter !== ALL && !filterGone ? filter : tags[0]
  const list = (filter === ALL || filterGone ? photos : photos.filter((p) => p.tag === filter)).slice().sort((a, b) => b.date - a.date)
  const sameTag = photosWithTag(photos, cmpTag)
  const defaults = compareDefaults(photos, cmpTag)
  const A = sameTag.find((p) => p.id === pick.a) ?? defaults?.first
  const B = sameTag.find((p) => p.id === pick.b) ?? defaults?.latest
  const tagName = (tag?: string) => tag ?? t('body.untagged')

  return (
    <div className="card" id="card-photos">
      <h3>{t('stats.photos')}</h3>
      <div className="chips">
        <button className={`chip${filter === ALL ? ' on' : ''}`} aria-pressed={filter === ALL} onClick={() => setFilter(ALL)}>{t('stats.allPhotos')}</button>
        {tags.map((tag) => <button key={tag} className={`chip${filter === tag ? ' on' : ''}`} aria-pressed={filter === tag} onClick={() => setFilter(tag)}>{tag}</button>)}
        {hasUntagged && tags.length > 0 && <button className={`chip${filter === undefined ? ' on' : ''}`} aria-pressed={filter === undefined} onClick={() => setFilter(undefined)}>{t('body.untagged')}</button>}
      </div>

      <div className="photo-grid">
        {list.map((p) => (
          <button key={p.id} className="photo-tile" onClick={() => setOpen(p)} aria-label={`${fmt.format(p.date)}${p.tag ? ' · ' + p.tag : ''}`}>
            <Photo blob={p.photo} alt="" className="photo-thumb" />
            <small>{fmt.format(p.date)}</small>
          </button>
        ))}
      </div>

      <h4>{t('stats.compare')}{tags.length > 0 || hasUntagged ? ` · ${tagName(cmpTag)}` : ''}</h4>
      {!defaults || !A || !B ? <p className="muted small">{t('stats.compareNeedTwo')}</p> : (
        <>
          <div className="row cmp-pick">
            <label className="inline">{t('stats.before')}
              <select value={A.id} onChange={(e) => setPick((p) => ({ ...p, a: e.target.value }))}>{sameTag.map((p) => <option key={p.id} value={p.id}>{fmt.format(p.date)}</option>)}</select>
            </label>
            <label className="inline">{t('stats.after')}
              <select value={B.id} onChange={(e) => setPick((p) => ({ ...p, b: e.target.value }))}>{sameTag.map((p) => <option key={p.id} value={p.id}>{fmt.format(p.date)}</option>)}</select>
            </label>
          </div>
          <div className="segmented small-seg" role="group" aria-label={t('stats.compare')}>
            {(['side', 'slider'] as const).map((m) => <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(`stats.mode_${m}`)}</button>)}
          </div>
          {mode === 'side' ? (
            <div className="cmp-side">
              {[A, B].map((p) => <figure key={p.id}><Photo blob={p.photo} alt={fmt.format(p.date)} className="cmp-img" /><figcaption className="small muted">{fmt.format(p.date)}</figcaption></figure>)}
            </div>
          ) : <Slider a={A} b={B} labels={[fmt.format(A.date), fmt.format(B.date)]} />}
        </>
      )}

      <h4>{t('stats.pinPhotos')}</h4>
      <div className="pin-photo-row">
        <span className="small" id={cardId({ kind: 'photo', tag: cmpTag, photoMode: 'latest', range: 'all' })}>{t('stats.pinLatest')} <PinButton pin={{ kind: 'photo', tag: cmpTag, photoMode: 'latest', range: 'all' }} label={t('stats.pinLatest')} /></span>
        {defaults && <span className="small" id={cardId({ kind: 'photo', tag: cmpTag, photoMode: 'compare', range: 'all' })}>{t('stats.pinCompare')} <PinButton pin={{ kind: 'photo', tag: cmpTag, photoMode: 'compare', range: 'all' }} label={t('stats.pinCompare')} /></span>}
      </div>

      {open && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={fmt.format(open.date)} onClick={() => setOpen(undefined)}>
          <div className="modal-card photo-full" onClick={(e) => e.stopPropagation()}>
            <Photo blob={open.photo} alt={fmt.format(open.date)} className="full-img" />
            <p><strong>{fmt.format(open.date)}</strong>{open.tag && <> · {open.tag}</>}</p>
            {open.note && <p className="muted small">{open.note}</p>}
            <button className="primary wide" autoFocus onClick={() => setOpen(undefined)}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
