import type { ID, SessionExercise, SetLog, TrackingType, Units } from '../db/types'
import type { PRKind } from './prs'
import { formatSet } from './format'
import { EYE_PATH, SLOGAN } from './brand'

/**
 * The shareable workout summary image: what goes on it (pure, tested) and how it's drawn (canvas). Only the
 * workout itself goes on it: no gym, notes, body data or photos.
 */
export interface SummaryCard {
  title: string
  date: string
  stats: { value: string; label: string }[]
  exercises: { name: string; sets: string[]; pr: boolean }[]
  /** Exercises left off to keep the image a sensible size. */
  more: number
}

export const MAX_CARD_EXERCISES = 10

export interface SummaryCardInput {
  title: string
  date: string
  stats: { value: string; label: string }[]
  items: SessionExercise[]
  sets: SetLog[]
  names: Map<ID, string>
  trackingOf: (exerciseId: ID) => TrackingType
  /** PR kinds per set id; empty when PR badges are turned off. */
  prs: Map<ID, PRKind[]>
  units: Units
}

/** Exercises in workout order with their working and drop sets (warm-ups left out), done sets only. */
export function buildSummaryCard(i: SummaryCardInput): SummaryCard {
  const exercises = i.items.flatMap((it) => {
    const done = i.sets.filter((s) => s.itemId === it.id && s.doneAt !== undefined).sort((a, b) => a.order - b.order)
    const shown = done.filter((s) => s.setType !== 'warmup')
    if (shown.length === 0) return []
    const t = i.trackingOf(it.exerciseId)
    return [{
      name: i.names.get(it.exerciseId) ?? '',
      sets: shown.map((s) => (s.setType === 'drop' ? 'D ' : '') + formatSet(s, t, i.units)),
      pr: done.some((s) => (i.prs.get(s.id)?.length ?? 0) > 0),
    }]
  })
  return {
    title: i.title, date: i.date, stats: i.stats,
    exercises: exercises.slice(0, MAX_CARD_EXERCISES),
    more: Math.max(0, exercises.length - MAX_CARD_EXERCISES),
  }
}

// --- Drawing (browser only) ---

const W = 1080
const PAD = 72
const C = { bg: '#0b1514', card: '#13211f', stone: '#252f2d', fg: '#e8f0ee', muted: '#8fa5a1', silver: '#c3cfcc', accent: '#45d0a0', onAccent: '#06261f' }
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Cuts text to fit `max` px, ending in an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(text.slice(0, mid) + '…').width <= max) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo).trimEnd() + '…'
}

/** Splits sets into at most two lines of whole sets; if some don't fit, the second line ends in "…". */
function setLines(ctx: CanvasRenderingContext2D, sets: string[], max: number): string[] {
  const sep = '  ·  '
  const fits = (t: string) => ctx.measureText(t).width <= max
  const lines: string[] = []
  let cur = ''
  for (let i = 0; i < sets.length; i++) {
    const next = cur ? cur + sep + sets[i] : sets[i]
    // On the last line, keep room for the "…" unless this is the final set.
    const room = lines.length === 1 && i < sets.length - 1 ? next + sep + '…' : next
    if (fits(room) || !cur) { cur = next; continue }
    if (lines.length === 1) return [lines[0], cur + sep + '…']
    lines.push(cur)
    cur = sets[i]
  }
  return [...lines, fit(ctx, cur, max)]
}

/** A tile of faint white noise (the stone grain), seeded so every image comes out the same. */
function grain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 128
  const g = tile.getContext('2d')!
  const img = g.createImageData(128, 128)
  let seed = 7
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
    img.data[i + 3] = (seed % 100) < 45 ? 10 : 0
  }
  g.putImageData(img, 0, 0)
  return ctx.createPattern(tile, 'repeat')
}

/** The basilisk's eye with a slit pupil, `size` px wide, top-left at (x, y). */
function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  const eye = new Path2D(EYE_PATH)
  ctx.fillStyle = C.accent
  ctx.globalAlpha = 0.22
  ctx.fill(eye)
  ctx.globalAlpha = 1
  ctx.strokeStyle = C.accent
  ctx.lineWidth = 1.4
  ctx.lineJoin = 'round'
  ctx.stroke(eye)
  ctx.beginPath()
  ctx.ellipse(12, 12, 0.9, 5.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

export function drawSummaryCard(card: SummaryCard, labels: { pr: string; more: string }): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const measure = canvas.getContext('2d')!
  const inner = W - PAD * 2
  const rowInner = inner - 64
  measure.font = `400 34px ${FONT}`
  const rows = card.exercises.map((e) => ({ ...e, lines: setLines(measure, e.sets, rowInner) }))

  // Height follows content: header, stats, one block per exercise, footer.
  const rowH = (lines: number) => 64 + lines * 44 + 28
  const height = PAD + 190 + 200 + 40 + rows.reduce((h, r) => h + rowH(r.lines.length) + 20, 0) + (card.more ? 60 : 0) + 110
  canvas.width = W
  canvas.height = Math.max(height, 1080)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, canvas.height)
  const noise = grain(ctx)
  ctx.textBaseline = 'alphabetic'

  let y = PAD + 64
  ctx.fillStyle = C.fg
  ctx.font = `700 64px ${FONT}`
  ctx.fillText(fit(ctx, card.title, inner), PAD, y)
  y += 60
  ctx.fillStyle = C.muted
  ctx.font = `400 36px ${FONT}`
  ctx.fillText(fit(ctx, card.date, inner), PAD, y)
  y += 66

  // Stat tiles, in stone: the finished workout, locked in.
  const gap = 20
  const tileW = (inner - gap * (card.stats.length - 1)) / card.stats.length
  card.stats.forEach((s, i) => {
    const x = PAD + i * (tileW + gap)
    ctx.fillStyle = C.stone
    roundRect(ctx, x, y, tileW, 170, 24)
    if (noise) { ctx.fillStyle = noise; roundRect(ctx, x, y, tileW, 170, 24) }
    ctx.fillStyle = C.fg
    // Numbers shrink to fit rather than being cut ("1:05:00", "10335 kg").
    let size = 52
    do ctx.font = `700 ${size}px ${FONT}`; while (ctx.measureText(s.value).width > tileW - 40 && (size -= 2) > 28)
    ctx.fillText(fit(ctx, s.value, tileW - 40), x + 20, y + 86)
    ctx.fillStyle = C.muted
    ctx.font = `400 30px ${FONT}`
    ctx.fillText(fit(ctx, s.label, tileW - 40), x + 20, y + 136)
  })
  y += 170 + 60

  for (const r of rows) {
    const h = rowH(r.lines.length)
    ctx.fillStyle = C.card
    roundRect(ctx, PAD, y, inner, h, 24)
    let nameMax = rowInner
    if (r.pr) {
      ctx.font = `700 28px ${FONT}`
      const bw = ctx.measureText(labels.pr).width + 32
      ctx.fillStyle = C.accent
      roundRect(ctx, PAD + inner - 32 - bw, y + 26, bw, 44, 22)
      ctx.fillStyle = C.onAccent
      ctx.fillText(labels.pr, PAD + inner - 32 - bw + 16, y + 58)
      nameMax -= bw + 20
    }
    ctx.fillStyle = C.fg
    ctx.font = `600 40px ${FONT}`
    ctx.fillText(fit(ctx, r.name, nameMax), PAD + 32, y + 62)
    ctx.fillStyle = C.muted
    ctx.font = `400 34px ${FONT}`
    r.lines.forEach((line, i) => ctx.fillText(line, PAD + 32, y + 62 + 50 + i * 44))
    y += h + 20
  }
  if (card.more) {
    ctx.fillStyle = C.muted
    ctx.font = `400 34px ${FONT}`
    ctx.fillText(labels.more, PAD, y + 36)
  }

  // Footer: the eye and name on the left, the slogan on the right.
  const base = canvas.height - PAD + 12
  drawEye(ctx, PAD, base - 38, 52)
  ctx.fillStyle = C.accent
  ctx.font = `700 36px ${FONT}`
  ctx.fillText('BliskFit', PAD + 66, base)
  ctx.fillStyle = C.silver
  ctx.font = `600 28px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(SLOGAN.toUpperCase(), W - PAD, base - 2)
  ctx.textAlign = 'left'
  return canvas
}

export const canvasToPng = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'))
