import { createHash, timingSafeEqual } from 'node:crypto'

export const SITE_AUTH_COOKIE = 'site-auth'

export function getSiteAuthToken(password: string): string {
  return createHash('sha256').update(`cards:${password}`).digest('hex')
}

export function hasValidSiteSession(
  cookieValue: string | undefined,
  password: string | undefined
): boolean {
  if (!password) return true
  if (!cookieValue) return false

  const expected = Buffer.from(getSiteAuthToken(password))
  const actual = Buffer.from(cookieValue)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
