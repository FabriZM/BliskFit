export type InstallOption = 'apk' | 'pwa'

/**
 * What an Android phone can install from the web version: the APK always, the web app (PWA) only when Chrome has
 * offered its install prompt (not when it's already installed, or in browsers without one). Nothing elsewhere.
 */
export function installOptions({ androidWeb, canInstallPwa }: { androidWeb: boolean; canInstallPwa: boolean }): InstallOption[] {
  if (!androidWeb) return []
  return canInstallPwa ? ['apk', 'pwa'] : ['apk']
}

// One dismissal covers the whole offer. The two earlier bars had a flag each; either one counts, so nobody who
// already closed one of them gets the offer again.
const KEY = 'bliskfit.installOfferDismissed'
const LEGACY_KEYS = ['bliskfit.apkOfferDismissed', 'bliskfit.pwaOfferDismissed']

export function offerDismissed(storage: Pick<Storage, 'getItem'>): boolean {
  try { return [KEY, ...LEGACY_KEYS].some((k) => storage.getItem(k) === '1') } catch { return false }
}

export function dismissOffer(storage: Pick<Storage, 'setItem'>): void {
  try { storage.setItem(KEY, '1') } catch { /* storage unavailable: it just comes back next visit */ }
}
