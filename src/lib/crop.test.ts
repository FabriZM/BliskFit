import { describe, expect, it } from 'vitest'
import { clampOffset, coverScale, sourceRect, zoomOffset } from './crop'

const img = { w: 4000, h: 3000 }
const frame = { w: 300, h: 400 }

describe('crop geometry', () => {
  it('covers the frame at zoom 1', () => {
    const s = coverScale(img, frame)
    expect(img.h * s).toBeCloseTo(400)
    expect(img.w * s).toBeGreaterThanOrEqual(300)
  })
  it('never lets the image leave a gap', () => {
    const s = coverScale(img, frame)
    expect(clampOffset({ x: 50, y: 50 }, img, frame, s)).toEqual({ x: 0, y: 0 })
    const far = clampOffset({ x: -99999, y: -99999 }, img, frame, s)
    expect(far.x).toBeCloseTo(frame.w - img.w * s)
    expect(far.y).toBeCloseTo(0)
  })
  it('crops a source rectangle with the frame\'s shape', () => {
    const s = coverScale(img, frame)
    const r = sourceRect(img, frame, s, { x: 0, y: 0 })
    expect(r.sw / r.sh).toBeCloseTo(3 / 4)
    expect(r.sx).toBeCloseTo(0)
  })
  it('keeps the centre when zooming', () => {
    const s = coverScale(img, frame)
    const before = sourceRect(img, frame, s, { x: -100, y: 0 })
    const o = zoomOffset({ x: -100, y: 0 }, img, frame, s, s * 2)
    const after = sourceRect(img, frame, s * 2, o)
    expect(after.sx + after.sw / 2).toBeCloseTo(before.sx + before.sw / 2)
  })
})
