import { describe, expect, it } from 'vitest'
import { canAccessAdmin, panelRedirect, resolvePanelRoute, toPanelErrorCode } from './panelRoute'

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

describe('canAccessAdmin (RT-12, F-23)', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')

  it.each([
    ['null (no PIN until S8)', null, false],
    ['expired', '2026-10-20T11:59:59Z', false],
    ['exactly now', '2026-10-20T12:00:00Z', false],
    ['unparseable', 'mañana', false],
    ['still open', '2026-10-20T12:04:59Z', true],
  ] as const)('%s → %s', (_label, adminUnlockedUntil, expected) => {
    expect(canAccessAdmin({ adminUnlockedUntil, now })).toBe(expected)
  })
})

describe('panelRedirect', () => {
  it.each([
    ['cashier', '/', null],
    ['cashier', '/inactiva', '/'],
    ['cashier', '/admin', null],
    ['cashier', '/admin/menu', null],
    ['cashier', '/administrar', '/'],
    ['inactive', '/admin/menu', '/inactiva'],
    ['inactive', '/inactiva', null],
    ['login', '/admin/menu', '/login'],
  ] as const)('%s at %s → %s', (route, pathname, expected) => {
    expect(panelRedirect(route, pathname)).toBe(expected)
  })
})
