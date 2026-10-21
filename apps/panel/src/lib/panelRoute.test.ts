import { describe, expect, it } from 'vitest'
import { reactivationRefetch, resolvePanelRoute, toPanelErrorCode } from './panelRoute'

const as = (role?: string) => ({ user: { app_metadata: role ? { role } : {} } }) as never

describe('resolvePanelRoute (F-20)', () => {
  it.each([
    ['no session', null, true, 'login'],
    ['customer role', as('customer'), true, 'login'],
    ['missing role', as(), true, 'login'],
    ['active merchant', as('merchant'), true, 'cashier'],
    ['inactive merchant', as('merchant'), false, 'inactive'],
  ] as const)('%s → %s', (_label, session, isActive, expected) => {
    expect(resolvePanelRoute({ session, merchantSession: { is_active: isActive } })).toBe(expected)
  })
})

describe('toPanelErrorCode', () => {
  it.each([
    [{ message: 'TypeError: Failed to fetch', code: '' }, 'E-01'],
    [{ message: 'E-19', code: 'P0001', details: null }, 'E-19'],
    [{ message: 'JWT expired', code: 'PGRST301' }, 'E-18'],
    [{ message: 'JWT expired', code: 'PGRST303' }, 'E-18'],
    [{ message: 'boom', code: 'PGRST116' }, 'E-99'],
  ])('%o → %s', (err, expected) => {
    expect(toPanelErrorCode(err)).toBe(expected)
  })
})

describe('reactivationRefetch (F-28)', () => {
  const q = (is_active?: boolean) => ({ state: { data: is_active === undefined ? undefined : { is_active } } })

  it('polls every 60 s and always refetches on focus while inactive', () => {
    expect(reactivationRefetch.refetchInterval(q(false))).toBe(60_000)
    expect(reactivationRefetch.refetchOnWindowFocus(q(false))).toBe('always')
  })

  it.each([true, undefined])('does not poll when is_active is %s', (isActive) => {
    expect(reactivationRefetch.refetchInterval(q(isActive))).toBe(false)
    expect(reactivationRefetch.refetchOnWindowFocus(q(isActive))).toBe(true)
  })
})
