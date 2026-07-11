import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { OffersTable } from '@/components/offers/OfferCard'
import type { Offer } from '@/components/offers/OfferCard'

export const metadata: Metadata = { title: 'Offers' }

async function getOffers(): Promise<Offer[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cookieHeader = (await cookies()).toString()
  const res = await fetch(`${baseUrl}/api/offers`, {
    cache: 'no-store',
    headers: { cookie: cookieHeader },
  })
  if (!res.ok) return []
  return res.json()
}

async function getSyncStatus(): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cookieHeader = (await cookies()).toString()
  const res = await fetch(`${baseUrl}/api/offers/sync-status`, {
    cache: 'no-store',
    headers: { cookie: cookieHeader },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.lastSyncedAt ?? null
}

export default async function OffersPage() {
  const [offers, lastSyncedAt] = await Promise.all([getOffers(), getSyncStatus()])
  return <OffersTable offers={offers} lastSyncedAt={lastSyncedAt} />
}
