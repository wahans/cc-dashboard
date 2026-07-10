import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { offer_id } = await req.json()
  if (!offer_id) return NextResponse.json({ error: 'offer_id required' }, { status: 400 })

  const [existing] = await sql`select id from enrolled_offers where offer_id = ${offer_id} limit 1`

  if (existing) {
    await sql`delete from enrolled_offers where id = ${existing.id}`
    return NextResponse.json({ enrolled: false })
  }

  const [data] = await sql`insert into enrolled_offers (offer_id) values (${offer_id}) returning *`
  return NextResponse.json({ enrolled: true, enrollment: data })
}
