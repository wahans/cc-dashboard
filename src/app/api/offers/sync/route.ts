import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { scrapeFrequentMilerOffers } from '@/lib/scraper'
import { persistOffers } from '@/lib/offer-store'

// Vercel cron sends GET requests; also support POST for manual triggers
export async function GET(req: NextRequest) {
  return handleSync(req)
}

export async function POST(req: NextRequest) {
  return handleSync(req)
}

async function handleSync(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    console.error('[sync] error:', err)
    try {
      await sql`insert into sync_log (type, records_processed, error) values ('offers_scrape', 0, ${String(err)})`
    } catch { /* ignore log failure */ }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
