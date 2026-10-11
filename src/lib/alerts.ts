let ctx: AudioContext | undefined

/** Call from a tap so the browser lets us play the rest-timer beep later. */
export function primeAudio(): void {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch { /* no audio available */ }
}

export function beep(times = 3): void {
  if (!ctx) return
  void ctx.resume() // the context can be suspended after the app was backgrounded
  for (let i = 0; i < times; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    const t = ctx.currentTime + i * 0.25
    osc.start(t)
    osc.stop(t + 0.15)
  }
}

export function vibrate(pattern: number | number[] = [250, 120, 250]): void {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}
