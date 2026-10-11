import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { linkDataFrom } from '../lib/share'
import { platform } from '../lib/platform'

/** Android app: a shared routine/program link that opened the app goes straight to the import screen. */
export default function IncomingLinks() {
  const nav = useNavigate()
  useEffect(() => platform.onOpenUrl?.((url) => {
    const d = linkDataFrom(url)
    if (d) nav(`/import?d=${d}`)
  }), [nav])
  return null
}
