import { getSiteAuthToken, hasValidSiteSession } from '@/lib/auth'

describe('site authentication', () => {
  it('stores a derived token instead of the raw site password', () => {
    expect(getSiteAuthToken('secret-password')).not.toBe('secret-password')
    expect(getSiteAuthToken('secret-password')).toHaveLength(64)
  })

  it('accepts only the derived token for the configured password', () => {
    const token = getSiteAuthToken('secret-password')
    expect(hasValidSiteSession(token, 'secret-password')).toBe(true)
    expect(hasValidSiteSession('secret-password', 'secret-password')).toBe(false)
    expect(hasValidSiteSession(token, 'different-password')).toBe(false)
  })
})
