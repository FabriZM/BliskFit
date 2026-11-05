/** Progress photos are cropped to this portrait shape (width / height) so before and after photos line up. */
export const PHOTO_ASPECT = 3 / 4

export interface Size { w: number; h: number }
export interface Offset { x: number; y: number }

/** Pixels per source pixel that make the image just cover the frame at zoom 1. */
export const coverScale = (img: Size, frame: Size): number => Math.max(frame.w / img.w, frame.h / img.h)

/** Keeps the image covering the frame: its top-left (relative to the frame's) can't move past an edge. */
export function clampOffset(o: Offset, img: Size, frame: Size, scale: number): Offset {
  const minX = Math.min(0, frame.w - img.w * scale), minY = Math.min(0, frame.h - img.h * scale)
  return { x: Math.min(0, Math.max(minX, o.x)), y: Math.min(0, Math.max(minY, o.y)) }
}

/** The offset after zooming from `from` to `to` that keeps the frame's centre on the same part of the image. */
export function zoomOffset(o: Offset, img: Size, frame: Size, from: number, to: number): Offset {
  const cx = (frame.w / 2 - o.x) / from, cy = (frame.h / 2 - o.y) / from
  return clampOffset({ x: frame.w / 2 - cx * to, y: frame.h / 2 - cy * to }, img, frame, to)
}

/** The part of the source image that is inside the frame, in source pixels. */
export function sourceRect(img: Size, frame: Size, scale: number, o: Offset): { sx: number; sy: number; sw: number; sh: number } {
  const c = clampOffset(o, img, frame, scale)
  return { sx: -c.x / scale, sy: -c.y / scale, sw: frame.w / scale, sh: frame.h / scale }
}
