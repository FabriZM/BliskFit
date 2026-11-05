import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PHOTO_ASPECT, clampOffset, coverScale, sourceRect, zoomOffset, type Offset, type Size } from '../lib/crop'
import { useBlobUrl } from '../lib/useBlobUrl'

const FRAME_W = 300
const FRAME: Size = { w: FRAME_W, h: FRAME_W / PHOTO_ASPECT }
const MAX_ZOOM = 4

/** Crops `image` to the photo shape: drag to move, slide to zoom. Gives the cropped JPEG back through `onDone`. */
export default function PhotoCropper({ image, onDone, onCancel, maxSide = 1280, quality = 0.8 }: {
  image: Blob; onDone: (cropped: Blob) => void; onCancel: () => void; maxSide?: number; quality?: number
}) {
  const { t } = useTranslation()
  const url = useBlobUrl(image)
  const [bitmap, setBitmap] = useState<ImageBitmap>()
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState<Offset>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ x: number; y: number; o: Offset } | null>(null)

  useEffect(() => {
    let live = true
    let made: ImageBitmap | undefined
    void createImageBitmap(image).then((b) => {
      made = b
      if (!live) return b.close()
      const img = { w: b.width, h: b.height }
      const s = coverScale(img, FRAME)
      setBitmap(b)
      setOff(clampOffset({ x: (FRAME.w - img.w * s) / 2, y: (FRAME.h - img.h * s) / 2 }, img, FRAME, s))
    })
    return () => { live = false; made?.close() }
  }, [image])

  const img: Size | undefined = bitmap && { w: bitmap.width, h: bitmap.height }
  const base = img ? coverScale(img, FRAME) : 1
  const scale = base * zoom

  const move = (e: React.PointerEvent) => {
    if (!drag.current || !img) return
    const d = drag.current
    setOff(clampOffset({ x: d.o.x + e.clientX - d.x, y: d.o.y + e.clientY - d.y }, img, FRAME, scale))
  }
  const changeZoom = (z: number) => {
    if (!img) return
    setOff(zoomOffset(off, img, FRAME, scale, base * z))
    setZoom(z)
  }

  const done = async () => {
    if (!bitmap || !img) return
    setBusy(true)
    try {
      const r = sourceRect(img, FRAME, scale, off)
      const out = Math.min(maxSide / Math.max(r.sw, r.sh) , 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(r.sw * out); canvas.height = Math.round(r.sh * out)
      canvas.getContext('2d')!.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('crop failed'))), 'image/jpeg', quality))
      onDone(blob)
    } finally { setBusy(false) }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('body.cropTitle')}>
      <div className="modal-card crop-card">
        <h2>{t('body.cropTitle')}</h2>
        <div className="crop-frame" style={{ width: FRAME.w, height: FRAME.h }}
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, o: off }; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
          {url && img && <img src={url} alt="" draggable={false} style={{ width: img.w * scale, height: img.h * scale, transform: `translate(${off.x}px, ${off.y}px)` }} />}
        </div>
        <label className="crop-zoom">{t('body.cropZoom')}
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} />
        </label>
        <p className="muted small">{t('body.cropHelp')}</p>
        <button className="primary" disabled={!bitmap || busy} onClick={() => void done()}>{t('body.cropDone')}</button>
        <button onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
