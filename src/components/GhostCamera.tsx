import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlobUrl } from '../lib/useBlobUrl'

/**
 * In-app camera for progress photos. The last photo of the same tag shows through on top (a "ghost") so the pose and
 * distance can be matched. Gives back the captured frame; the caller crops it. Where the camera can't open (no
 * permission or device), `onUnavailable` lets the caller fall back to the system camera.
 */
export default function GhostCamera({ ghost, onCapture, onCancel, onUnavailable }: {
  ghost?: Blob; onCapture: (frame: Blob) => void; onCancel: () => void; onUnavailable: () => void
}) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [opacity, setOpacity] = useState(0.4)
  const [showGhost, setShowGhost] = useState(true)
  const ghostUrl = useBlobUrl(ghost)

  useEffect(() => {
    let live = true
    stream.current?.getTracks().forEach((tr) => tr.stop())
    if (!navigator.mediaDevices?.getUserMedia) { onUnavailable(); return }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (!live) return s.getTracks().forEach((tr) => tr.stop())
        stream.current = s
        if (video.current) { video.current.srcObject = s; void video.current.play() }
      }, onUnavailable)
    return () => { live = false; stream.current?.getTracks().forEach((tr) => tr.stop()) }
  }, [facing]) // eslint-disable-line react-hooks/exhaustive-deps

  const capture = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')!
    // The front camera preview is mirrored; save it the way it looked.
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(v, 0, 0)
    canvas.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.92)
  }

  return (
    <div className="overlay ghost-cam" role="dialog" aria-modal="true" aria-label={t('body.cameraTitle')}>
      <div className="ghost-stage">
        <video ref={video} playsInline muted style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
        {ghostUrl && showGhost && <img className="ghost-img" src={ghostUrl} alt="" style={{ opacity }} draggable={false} />}
      </div>
      <div className="ghost-controls">
        {ghostUrl ? (
          <>
            <button type="button" className={`chip${showGhost ? ' on' : ''}`} aria-pressed={showGhost} onClick={() => setShowGhost(!showGhost)}>{t('body.ghost')}</button>
            <input type="range" min={0.1} max={0.8} step={0.05} value={opacity} aria-label={t('body.ghostOpacity')} disabled={!showGhost} onChange={(e) => setOpacity(Number(e.target.value))} />
          </>
        ) : <span className="muted small">{t('body.noGhost')}</span>}
        <button type="button" onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')}>{t('body.flip')}</button>
      </div>
      <div className="ghost-controls">
        <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="primary" onClick={capture}>{t('body.capture')}</button>
      </div>
    </div>
  )
}
