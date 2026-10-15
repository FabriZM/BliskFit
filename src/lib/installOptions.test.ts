import { describe, expect, it } from 'vitest'
import { dismissOffer, installOptions, offerDismissed } from './installOptions'

const store = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('install offer', () => {
  it('offers APK and PWA together only on Android when the browser can install the web app', () => {
    expect(installOptions({ androidWeb: true, canInstallPwa: true })).toEqual(['apk', 'pwa'])
    expect(installOptions({ androidWeb: true, canInstallPwa: false })).toEqual(['apk'])
    expect(installOptions({ androidWeb: false, canInstallPwa: true })).toEqual([])
  })

  it('one dismissal hides it for good, and so does either of the two older flags', () => {
    const s = store()
    expect(offerDismissed(s)).toBe(false)
    dismissOffer(s)
    expect(offerDismissed(s)).toBe(true)
    expect(offerDismissed(store({ 'bliskfit.apkOfferDismissed': '1' }))).toBe(true)
    expect(offerDismissed(store({ 'bliskfit.pwaOfferDismissed': '1' }))).toBe(true)
  })

  it('works when storage throws', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(offerDismissed(broken)).toBe(false)
    expect(() => dismissOffer(broken)).not.toThrow()
  })
})
