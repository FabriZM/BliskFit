import type { Point } from '../../lib/stats'

/** Tiny decorative line for pinned cards (the value and change are written next to it). */
export default function Sparkline({ points, width = 84, height = 28 }: { points: Point[]; width?: number; height?: number }) {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden />
  const vs = points.map((p) => p.value)
  const lo = Math.min(...vs), hi = Math.max(...vs)
  const t0 = points[0].at, t1 = points[points.length - 1].at
  const pad = 3
  const x = (at: number) => pad + ((at - t0) / (t1 - t0 || 1)) * (width - 2 * pad)
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo || 1)) * (height - 2 * pad)
  const last = points[points.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="sparkline">
      <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} fill="none" className="spark-line" />
      <circle cx={x(last.at)} cy={y(last.value)} r={2.5} className="spark-dot" />
    </svg>
  )
}
