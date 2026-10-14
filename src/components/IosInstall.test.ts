import { describe, expect, it } from 'vitest'
import { iosBrowser } from './IosInstall'

const ios = (tail: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${tail}`

describe('iPhone install steps', () => {
  it('tells Safari, other browsers and in-app browsers apart', () => {
    expect(iosBrowser(ios('Version/18.0 Mobile/15E148 Safari/604.1'))).toBe('safari')
    expect(iosBrowser(ios('CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1'))).toBe('other')
    expect(iosBrowser(ios('FxiOS/132.0 Mobile/15E148 Safari/605.1.15'))).toBe('other')
    expect(iosBrowser(ios('Mobile/22A3354 Instagram 350.0.0.0'))).toBe('inApp')
    expect(iosBrowser(ios('Mobile/22A3354 [FBAN/FBIOS;FBAV/480.0]'))).toBe('inApp')
    expect(iosBrowser(ios('GSA/340.0.689 Mobile/15E148 Safari/604.1'))).toBe('inApp')
  })
})
