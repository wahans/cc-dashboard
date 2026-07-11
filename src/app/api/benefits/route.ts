import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getYearUsageCents } from '@/lib/benefits'

export async function GET() {
  const benefits = await sql`select * from amex_benefits where active = true order by sort_order`
  const usage = await sql`select * from benefit_usage`

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const annotated = (benefits ?? []).map((b) => {
    const usedCents = Math.min(
      Number(b.amount_cents),
      getYearUsageCents(
        b.id as string,
        usage as Array<{ benefit_id: string; period_key: string; amount_used_cents: number }>,
        currentYear
      )
    )
    return {
      ...b,
      benefit_usage: undefined,
      current_period_key: String(currentYear),
      usage_timeframe: 'year',
      used_cents: usedCents,
      remaining_cents: Math.max(0, Number(b.amount_cents) - usedCents),
    }
  })

  return NextResponse.json(annotated)
}
