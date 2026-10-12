import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

/** Swipe or tap the arrows to move between images; never advances on its own. One image shows without controls. */
export default function ImageCarousel({ images, label }: { images: { src: string; alt?: string }[]; label: string }) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  if (!images.length) return null

  const go = (i: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: Math.max(0, Math.min(images.length - 1, i)) * el.clientWidth, behavior: 'smooth' })
  }
  const many = images.length > 1

  return (
    <div className="carousel" role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="carousel-track" ref={track} tabIndex={many ? 0 : undefined}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
          if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
        }}>
        {images.map((img, i) => (
          <div key={img.src} className="carousel-slide" role="group" aria-roledescription="slide"
            aria-label={t('carousel.slide', { n: i + 1, total: images.length })}>
            <img src={img.src} alt={img.alt ?? ''} loading={i ? 'lazy' : undefined} draggable={false} />
          </div>
        ))}
      </div>
      {many && (
        <>
          <button className="carousel-nav carousel-prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('carousel.prev')}><ChevronLeftIcon /></button>
          <button className="carousel-nav carousel-next" onClick={() => go(index + 1)} disabled={index === images.length - 1} aria-label={t('carousel.next')}><ChevronRightIcon /></button>
          <div className="carousel-dots">
            {images.map((img, i) => (
              <button key={img.src} className={i === index ? 'on' : ''} aria-current={i === index}
                aria-label={t('carousel.slide', { n: i + 1, total: images.length })} onClick={() => go(i)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
