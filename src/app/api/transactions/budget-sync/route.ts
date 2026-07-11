import { NextRequest, NextResponse } from 'next/server'
// NextRequest used only for GET (cron auth)
import { sql } from '@/lib/db'
import { getAmexTransactions } from '@/lib/budget-db'
import { computeOfferSpend, getUnmatchedCreditsForReview, matchBenefitsToTransactions } from '@/lib/transaction-matcher'
import type { ResetPeriod } from '@/lib/benefits'
import { hasValidSiteSession, SITE_AUTH_COOKIE } from '@/lib/auth'

// Vercel cron sends GET — requires CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleSync()
}

// Manual trigger from dashboard UI. API routes bypass site auth middleware, so
// validate the same cookie here before allowing a database reconciliation.
export async function POST(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD
  if (!hasValidSiteSession(req.cookies.get(SITE_AUTH_COOKIE)?.value, sitePassword)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleSync()
}

async function handleSync() {

  if (!process.env.BUDGET_DATABASE_URL) {
    return NextResponse.json({ error: 'BUDGET_DATABASE_URL not configured' }, { status: 500 })
  }

  try {
    const syncedAt = new Date().toISOString()
    const syncYear = new Date(syncedAt).getUTCFullYear()

    // 1. Fetch all Amex transactions from the budget dashboard DB
    const transactions = await getAmexTransactions()

    // 2. Load enrolled offers (threshold not yet met)
    const enrolledRows = await sql`
      select e.id, e.offer_id, e.enrolled_at, e.spent_amount_cents,
             o.merchant, o.spend_min_cents
      from enrolled_offers e join amex_offers o on o.id = e.offer_id
      where e.threshold_met = false
    `

    // 3. Compute and update offer spend
    let offersUpdated = 0
    let offersCompleted = 0

    for (const row of enrolledRows) {
      if (!row.merchant || !row.enrolled_at) continue

      const spentCents = computeOfferSpend(
        row.merchant as string,
        row.enrolled_at as string,
        transactions
      )
      const minCents = row.spend_min_cents as number | null
      const thresholdMet = minCents != null && spentCents >= minCents

      await sql`
        update enrolled_offers
        set spent_amount_cents = ${spentCents},
            threshold_met = ${thresholdMet},
            completed_at = ${thresholdMet ? syncedAt : null}
        where id = ${row.id}
      `

      offersUpdated++
      if (thresholdMet) offersCompleted++
    }

    // 4. Load all active benefits. Credits remain captured value even when a
    // benefit is not currently marked as enrolled in the UI.
    const benefits = await sql`
      select id, name, amount_cents, reset_period
      from amex_benefits where active = true
    `

    // 5. Compute benefit usage from transactions
    const benefitMatches = matchBenefitsToTransactions(
      benefits.map((b) => ({
        id: b.id as string,
        name: b.name as string,
        amount_cents: b.amount_cents as number,
        reset_period: b.reset_period as ResetPeriod,
      })),
      transactions,
      syncYear
    )

    // 6. Rebuild auto-synced records for the year. Manual records are retained.
    await sql`
      delete from benefit_usage
      where source = 'budget_sync' and period_key like ${`${syncYear}%`}
    `

    let benefitsSynced = 0
    for (const match of benefitMatches) {
      await sql`
        insert into benefit_usage (benefit_id, amount_used_cents, period_key, notes, source)
        values (${match.benefit_id}, ${match.amount_used_cents}, ${match.period_key},
                'Auto-synced from Lucent', 'budget_sync')
      `
      benefitsSynced++
    }

    const creditsMatched = benefitMatches.reduce(
      (sum, match) => sum + match.transaction_count,
      0
    )
    const capturedCents = benefitMatches.reduce(
      (sum, match) => sum + match.amount_used_cents,
      0
    )
    const matchedCredits = benefitMatches.flatMap((match) =>
      match.matched_transactions.map((transaction) => ({
        ...transaction,
        benefit_name: match.benefit_name,
      }))
    ).sort((a, b) => b.date.localeCompare(a.date))
    const unmatchedCredits = getUnmatchedCreditsForReview(
      transactions,
      benefitMatches,
      syncYear
    )
    const details = {
      matched_credits: matchedCredits,
      unmatched_credits: unmatchedCredits,
    }

    await sql`
      insert into sync_log (type, records_processed, records_updated, error, details)
      values ('budget_sync', ${transactions.length}, ${offersUpdated + benefitsSynced}, null,
              ${JSON.stringify(details)}::jsonb)
    `

    return NextResponse.json({
      transactions_processed: transactions.length,
      offers_updated: offersUpdated,
      offers_completed: offersCompleted,
      benefits_synced: benefitsSynced,
      credits_matched: creditsMatched,
      captured_cents: capturedCents,
      details,
      synced_at: syncedAt,
    })
  } catch (err) {
    try {
      await sql`
        insert into sync_log (type, records_processed, error)
        values ('budget_sync', 0, ${String(err)})
      `
    } catch { /* ignore */ }
    console.error('[budget-sync] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
