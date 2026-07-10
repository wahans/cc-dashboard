import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getPeriodKey } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

export async function GET() {
  const benefits = await sql`select * from amex_benefits where active = true order by sort_order`
  const usage = await sql`select * from benefit_usage`

  const now = new Date()
  const annotated = (benefits ?? []).map((b) => {
    const periodKey = getPeriodKey(b.reset_period as ResetPeriod, now)
    const periodUsage = usage.filter((u) => u.benefit_id === b.id && u.period_key === periodKey)
    const usedCents = periodUsage.reduce((sum, u) => sum + Number(u.amount_used_cents), 0)
    return {
      ...b,
      benefit_usage: undefined,
      current_period_key: periodKey,
      used_cents: usedCents,
      remaining_cents: Math.max(0, Number(b.amount_cents) - usedCents),
    }
  })

  return NextResponse.json(annotated)
}
