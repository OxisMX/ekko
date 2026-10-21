import { describe, expect, it } from 'vitest'
import { signOutNotice } from './sessionExpiry'

describe('signOutNotice (E-18, RR-3)', () => {
  it('shows E-18 when a live session ends without the user asking', () => {
    expect(signOutNotice({ event: 'SIGNED_OUT', hadSession: true, userSignedOut: false })).toBe('E-18')
  })

  it.each([
    ['user signed out (this or another tab)', { event: 'SIGNED_OUT', hadSession: true, userSignedOut: true }],
    ['there was no session to lose', { event: 'SIGNED_OUT', hadSession: false, userSignedOut: false }],
    ['other events', { event: 'TOKEN_REFRESHED', hadSession: true, userSignedOut: false }],
  ] as const)('shows nothing when %s', (_label, input) => {
    expect(signOutNotice(input)).toBeNull()
  })
})
