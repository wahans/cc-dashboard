import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { benefit_id } = await req.json()
  if (!benefit_id) return NextResponse.json({ error: 'benefit_id required' }, { status: 400 })

  const [current] = await sql`select enrolled from amex_benefits where id = ${benefit_id}`

  if (!current) {
    return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })
  }

  await sql`update amex_benefits set enrolled = ${!current.enrolled} where id = ${benefit_id}`

  return NextResponse.json({ enrolled: !current.enrolled })
}
