import { useTranslation } from 'react-i18next'
import type { ProgressPhoto } from '../db/types'
import { photoTags, photosWithTag } from '../lib/body'
import Photo from './Photo'

/** `ALL` shows every photo, `NONE` those without a tag; any other value is a tag. */
export const FOLDER_ALL = '*'
export const FOLDER_NONE = ''

/** One folder per tag (cover = its latest photo, with the count), plus all photos and untagged ones. */
export default function TagFolders({ photos, value, onChange }: { photos: ProgressPhoto[]; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const latest = (list: ProgressPhoto[]) => list.reduce<ProgressPhoto | undefined>((a, p) => (!a || p.date > a.date ? p : a), undefined)
  const folders = [
    { key: FOLDER_ALL, name: t('body.folderAll'), list: photos },
    ...photoTags(photos).map((tag) => ({ key: tag, name: tag, list: photosWithTag(photos, tag) })),
    ...(photosWithTag(photos, undefined).length ? [{ key: FOLDER_NONE, name: t('body.untagged'), list: photosWithTag(photos, undefined) }] : []),
  ]
  return (
    <div className="tag-folders" role="group" aria-label={t('body.folders')}>
      {folders.map((f) => {
        const cover = latest(f.list)
        return (
          <button key={f.key} type="button" className={`tag-folder${value === f.key ? ' on' : ''}`} aria-pressed={value === f.key} onClick={() => onChange(f.key)}>
            {cover ? <Photo blob={cover.photo} alt="" className="cover" /> : <div className="cover" />}
            <strong>{f.name}</strong>
            <small>{f.list.length}</small>
          </button>
        )
      })}
    </div>
  )
}
