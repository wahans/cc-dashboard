import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getPeriodKey } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { benefit_id, amount_used_cents, notes, source = 'manual' } = body

  if (!benefit_id || !amount_used_cents) {
    return NextResponse.json({ error: 'benefit_id and amount_used_cents required' }, { status: 400 })
  }

  const [benefit] = await sql`select reset_period from amex_benefits where id = ${benefit_id}`

  if (!benefit) {
    return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })
  }

  const period_key = getPeriodKey(benefit.reset_period as ResetPeriod)

  const [data] = await sql`
    insert into benefit_usage (benefit_id, amount_used_cents, period_key, notes, source)
    values (${benefit_id}, ${amount_used_cents}, ${period_key}, ${notes ?? null}, ${source})
    returning *
  `

  return NextResponse.json(data, { status: 201 })
}
