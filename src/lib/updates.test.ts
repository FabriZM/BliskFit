import { describe, expect, it } from 'vitest'
import { DAY_MS, apkName, offer, parseRelease, releaseTag, shouldCheck } from './updates'

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

  it('checks at most once a day', () => {
    expect(shouldCheck(undefined, 5)).toBe(true)
    expect(shouldCheck(0, DAY_MS - 1)).toBe(false)
    expect(shouldCheck(0, DAY_MS)).toBe(true)
  })
})
