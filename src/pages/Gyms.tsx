import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db/db'
import GymPlanEditor from '../components/GymPlanEditor'

/** Optional feature, reachable only from Profile. The app works fully without any gym. */
export default function Gyms() {
  const { t } = useTranslation()
  const gyms = useLiveQuery(() => db.gyms.toArray(), []) ?? []
  const [name, setName] = useState('')

  const add = async () => {
    if (!name.trim()) return
    await db.gyms.add({ id: newId(), name: name.trim() })
    setName('')
  }
  const remove = async (id: string) => {
    if (!confirm(t('gyms.confirmDelete'))) return
    await db.transaction('rw', db.gyms, db.exerciseGymNotes, async () => {
      // Notes survive as "any gym"; they are never lost with the gym.
      await db.exerciseGymNotes.where('gymId').equals(id).modify({ gymId: undefined })
      await db.gyms.delete(id)
    })
  }

  return (
    <section>
      <p><Link to="/profile/settings">← {t('profile.settings')}</Link></p>
      <h1>{t('gyms.title')}</h1>
      <p className="muted">{t('gyms.help')}</p>
      <ul className="list">
        {gyms.map((g) => (
          <li key={g.id}>
            <div className="row">
              <input defaultValue={g.name} onBlur={(e) => e.target.value.trim() && void db.gyms.update(g.id, { name: e.target.value.trim() })} />
              <button className="danger" onClick={() => void remove(g.id)}>{t('common.delete')}</button>
            </div>
            <GymPlanEditor key={`${g.id}-${g.allowance?.visits}-${g.allowance?.startDay}`} gym={g} />
          </li>
        ))}
      </ul>
      <div className="row">
        <input value={name} placeholder={t('gyms.name')} onChange={(e) => setName(e.target.value)} />
        <button className="primary" onClick={() => void add()}>{t('common.add')}</button>
      </div>
    </section>
  )
}
