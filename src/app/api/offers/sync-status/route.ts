import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  const [data] = await sql`select scraped_at from amex_offers order by scraped_at desc limit 1`

  return NextResponse.json({ lastSyncedAt: data?.scraped_at ?? null })
}
