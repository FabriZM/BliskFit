import type { Diagram } from '../components/BodyFigure'
import { muscleOf } from '../components/BodyFigure'

/** What the canvas needs to draw the body map: both traced diagrams and each muscle's heat step 0..5. */
export interface CardBody {
  diagrams: { front: Diagram; back: Diagram }
  level: (slug: string) => number
}

export interface BodyColors {
  /** Body outline behind the muscles. */
  base: string
  /** Fill per heat step 0..5 (the app's --heat-0..5). */
  heat: string[]
  /** Thin line between muscles. */
  gap: string
}

/** The app's heat steps (--heat-0..5 in index.css). */
export const HEAT_COLORS = ['#24373a', '#5a2a2d', '#8a2f33', '#b83a3f', '#dc4b50', '#ff6a6e']

/** Front and back figures side by side, scaled to fit and centred in the box, shaded by `body.level`. */
export function drawBodyMap(ctx: CanvasRenderingContext2D, body: CardBody, box: { x: number; y: number; w: number; h: number }, colors: BodyColors, gapBetween = 80) {
  const views = [body.diagrams.front, body.diagrams.back]
  const size = views.map((d) => d.viewBox.split(/[\s,]+/).map(Number))
  const scale = Math.min(...size.map(([, , w, h]) => Math.min(box.h / h, (box.w - gapBetween) / 2 / w)))
  const total = size.reduce((sum, [, , w]) => sum + w * scale, 0) + gapBetween
  let x = box.x + (box.w - total) / 2
  views.forEach((d, i) => {
    const [vx, vy, w, h] = size[i]
    ctx.save()
    ctx.translate(x - vx * scale, box.y + (box.h - h * scale) / 2 - vy * scale)
    ctx.scale(scale, scale)
    ctx.fillStyle = colors.base
    ctx.fill(new Path2D(d.outline))
    for (const [part, path] of d.muscles) {
      const slug = muscleOf(part)
      ctx.fillStyle = colors.heat[slug ? body.level(slug) : 0] ?? colors.heat[0]
      ctx.fill(new Path2D(path))
      ctx.strokeStyle = colors.gap
      ctx.lineWidth = 1.5 / scale
      ctx.stroke(new Path2D(path))
    }
    ctx.restore()
    x += w * scale + gapBetween
  })
}
