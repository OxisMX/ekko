import { describe, expect, it } from 'vitest'
import { parsePublicAppUrl, visitQrUrl } from './publicAppUrl'

describe('parsePublicAppUrl', () => {
  it.each(['http://localhost:5173', 'https://staging.ekko.oxis.mx', 'https://ekko.oxis.mx'])('accepts %s', (value) => {
    expect(parsePublicAppUrl(value)).toBe(value)
  })

  it.each([
    undefined,
    '',
    'ekko.oxis.mx',
    'https://ekko.oxis.mx/',
    'https://ekko.oxis.mx/v',
    'https://ekko.oxis.mx?x=1',
    'ftp://ekko.oxis.mx',
    'javascript:alert(1)',
  ])('rejects %j with a clear message', (value) => {
    expect(() => parsePublicAppUrl(value)).toThrow(/VITE_PUBLIC_APP_URL/)
  })
})

describe('visitQrUrl', () => {
  it('composes <origin>/v/<token> (TRD §6.4)', () => {
    expect(visitQrUrl('AbCdEfGhIjKlMnOpQrStU_', 'https://ekko.oxis.mx')).toBe('https://ekko.oxis.mx/v/AbCdEfGhIjKlMnOpQrStU_')
  })
})
