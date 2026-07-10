import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { scrapeFrequentMilerOffers } from '@/lib/scraper'
import { persistOffers } from '@/lib/offer-store'

export async function POST() {
  try {
    const offers = await scrapeFrequentMilerOffers()
    if (offers.length === 0) {
      await sql`insert into sync_log (type, records_processed, error) values ('offers_scrape', 0, 'No offers scraped')`
      return NextResponse.json(
        { synced: 0, message: 'No offers scraped', timestamp: new Date().toISOString() },
        { status: 200 }
      )
    }

    await persistOffers(offers)
    await sql`insert into sync_log (type, records_processed, error) values ('offers_scrape', ${offers.length}, null)`

    return NextResponse.json({
      synced: offers.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[sync-now] error:', err)
    try {
      await sql`insert into sync_log (type, records_processed, error) values ('offers_scrape', 0, ${String(err)})`
    } catch { /* ignore */ }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
