import { useBlobUrl } from '../lib/useBlobUrl'

/** An <img> for a stored blob; the object URL is created and released with the component. */
export default function Photo({ blob, alt, className, onClick }: { blob: Blob; alt: string; className?: string; onClick?: () => void }) {
  const url = useBlobUrl(blob)
  if (!url) return <div className={className} />
  return <img src={url} alt={alt} className={className} onClick={onClick} draggable={false} />
}
