import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildSummaryCard, canvasToPng, drawSummaryCard, loadCardFonts, type SummaryCardInput } from '../../lib/summaryCard'
import { loadDiagram, type Sex } from '../../components/BodyFigure'
import { effectiveHeat, heatLevel } from '../../lib/muscleHeat'
import { useSettings } from '../../stores/settings'
import { toDateInput } from '../../lib/dates'
import { platform } from '../../lib/platform'
import { useBlobUrl } from '../../lib/useBlobUrl'

/** Preview of the workout summary image, with Share (share sheet, or a download where there's none). */
export default function SummaryImage({ input, onClose }: { input: SummaryCardInput; onClose: () => void }) {
  const { t } = useTranslation()
  const [png, setPng] = useState<Blob>()
  const [failed, setFailed] = useState(false)
  const sex: Sex = useSettings((s) => s.settings.bodyModel) === 'female' ? 'female' : 'male'
  const url = useBlobUrl(png)

  // Drawn once when opened; the workout can't change while the preview is up.
  useEffect(() => {
    const card = buildSummaryCard(input)
    const heat = input.heat
    const max = Math.max(0, ...(heat?.values() ?? []))
    const bodyP = heat && max > 0
      ? Promise.all([loadDiagram(sex, 'front'), loadDiagram(sex, 'back')]).then(([front, back]) => ({
        diagrams: { front, back }, level: (slug: string) => heatLevel(effectiveHeat(heat, `m:${slug}`), max),
      }))
      : Promise.resolve(undefined)
    void Promise.all([loadCardFonts(), bodyP])
      .then(([, body]) => canvasToPng(drawSummaryCard(card, { pr: t('summary.pr'), more: t('summary.moreExercises', { count: card.more }) }, body)))
      .then(setPng, () => setFailed(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    if (!png) return
    try { await platform.saveFile(`bliskfit-workout-${toDateInput(Date.now())}.png`, png, { share: true }) } catch { setFailed(true) }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('summary.shareImage')}>
      <div className="modal-card">
        {url ? <img className="summary-image" src={url} alt={t('summary.imageAlt')} /> : <p className="muted">{failed ? t('share.failed') : '…'}</p>}
        <p className="muted small help">{t('summary.imageHelp')}</p>
        <button className="primary" disabled={!png} onClick={() => void share()}>{t('summary.share')}</button>
        <button onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  )
}
