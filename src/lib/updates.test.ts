import { describe, expect, it } from 'vitest'
import { CHECK_INTERVAL_MS, apkName, newestRelease, offer, parseRelease, pickDownload, releaseTag, shouldCheck } from './updates'

const gh = (over: object = {}) => ({
  tag_name: 'v0.4.0-72', html_url: 'https://github.com/FabriZM/BliskFit/releases/tag/v0.4.0-72', body: ' Faster backups \n', draft: false, prerelease: false,
  assets: [{ name: 'notes.txt', browser_download_url: 'https://github.com/x/notes.txt' },
    { name: 'bliskfit-0.4.0-72.apk', browser_download_url: 'https://github.com/FabriZM/BliskFit/releases/download/v0.4.0-72/bliskfit-0.4.0-72.apk' }],
  ...over,
})

describe('app updates', () => {
  it('reads a release: version and build from the tag, the APK asset, notes', () => {
    expect(parseRelease(gh())).toEqual({
      version: '0.4.0', build: 72, notes: 'Faster backups',
      apkUrl: 'https://github.com/FabriZM/BliskFit/releases/download/v0.4.0-72/bliskfit-0.4.0-72.apk',
      pageUrl: 'https://github.com/FabriZM/BliskFit/releases/tag/v0.4.0-72',
    })
    expect(releaseTag('0.4.0', 72)).toBe('v0.4.0-72')
    expect(apkName('0.4.0', 72)).toBe('bliskfit-0.4.0-72.apk')
  })

  it('ignores releases it cannot use', () => {
    expect(parseRelease(gh({ tag_name: 'v0.4.0' }))).toBeUndefined()
    expect(parseRelease(gh({ prerelease: true }))).toBeUndefined()
    expect(parseRelease(gh({ assets: [] }))).toBeUndefined()
    expect(parseRelease(gh({ assets: [{ name: 'a.apk', browser_download_url: 'https://evil.example/a.apk' }] }))).toBeUndefined()
    expect(parseRelease({ message: 'Not Found' })).toBeUndefined()
    expect(parseRelease(null)).toBeUndefined()
  })

  it('offers only newer builds', () => {
    const r = parseRelease(gh())!
    expect(offer(r, 71)).toBe(r)
    expect(offer(r, 72)).toBeUndefined()
    expect(offer(r, 80)).toBeUndefined()
    expect(offer(undefined, 1)).toBeUndefined()
  })

  it('downloads the newer release if one appeared since the offer was shown', () => {
    const r = (build: number) => ({ version: '0.8.2', build, apkUrl: `https://github.com/x/${build}.apk`, pageUrl: 'https://github.com/x' })
    expect(pickDownload(r(100), r(101)).build).toBe(101)
    expect(pickDownload(r(100), r(100)).build).toBe(100)
    expect(pickDownload(r(100), r(90)).build).toBe(100)
    expect(pickDownload(r(100), undefined).build).toBe(100)
  })

  it('checks again after an hour', () => {
    expect(shouldCheck(undefined, 5)).toBe(true)
    expect(shouldCheck(0, CHECK_INTERVAL_MS - 1)).toBe(false)
    expect(shouldCheck(0, CHECK_INTERVAL_MS)).toBe(true)
  })

  it('serves the highest build, whatever order GitHub lists them in, skipping unusable ones', () => {
    const rel = (v: string, b: number, over: object = {}) => gh({
      tag_name: `v${v}-${b}`, assets: [{ name: `bliskfit-${v}-${b}.apk`, browser_download_url: `https://github.com/FabriZM/BliskFit/releases/download/v${v}-${b}/bliskfit-${v}-${b}.apk` }], ...over,
    })
    expect(newestRelease([rel('0.8.1', 99), rel('0.8.2', 100), rel('0.9.0', 120, { prerelease: true }), rel('0.7.0', 80)])?.build).toBe(100)
    expect(newestRelease([])).toBeUndefined()
    expect(newestRelease({ message: 'rate limited' })).toBeUndefined()
  })
})
