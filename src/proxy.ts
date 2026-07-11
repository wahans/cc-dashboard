import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasValidSiteSession, SITE_AUTH_COOKIE } from '@/lib/auth'

const PUBLIC_PATHS = new Set(['/login', '/api/login', '/api/logout'])
const CRON_PATHS = new Set(['/api/offers/sync', '/api/transactions/budget-sync'])

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'same-origin')
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.has(pathname)) {
    return withSecurityHeaders(NextResponse.next())
  }

  const cronAuthorized = CRON_PATHS.has(pathname)
    && process.env.CRON_SECRET
    && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  const siteAuthorized = hasValidSiteSession(
    request.cookies.get(SITE_AUTH_COOKIE)?.value,
    process.env.SITE_PASSWORD
  )

  if (cronAuthorized || siteAuthorized) {
    return withSecurityHeaders(NextResponse.next())
  }

  if (pathname.startsWith('/api/')) {
    return withSecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return withSecurityHeaders(NextResponse.redirect(url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
