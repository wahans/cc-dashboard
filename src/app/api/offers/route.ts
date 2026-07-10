import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const PAGE_SIZE = 1000

export async function GET(req: NextRequest) {
  const enrolledOnly = req.nextUrl.searchParams.get('enrolled') === 'true'
  const allData = await sql`
    select o.*, e.id as enrollment_id, e.enrolled_at, e.spent_amount_cents,
           e.threshold_met, e.completed_at
    from amex_offers o
    left join enrolled_offers e on e.offer_id = o.id
    where o.active = true
    order by o.reward_amount_cents desc
  `

  const offers = allData.map((o) => ({
    ...o,
    is_enrolled: Boolean(o.enrollment_id),
    enrollment: o.enrollment_id ? {
      id: o.enrollment_id,
      enrolled_at: o.enrolled_at,
      spent_amount_cents: o.spent_amount_cents,
      threshold_met: o.threshold_met,
      completed_at: o.completed_at,
    } : null,
  }))

  const result = enrolledOnly ? offers.filter((o) => o.is_enrolled) : offers
  return NextResponse.json(result)
}
