import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getCardResults } from '@/lib/optimizer'

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  if (!category) {
    return NextResponse.json({ error: 'category query param required' }, { status: 400 })
  }

  const cards = await sql`select * from cards order by name`
  const categories = await sql`select * from card_categories where active = true`

  // Strip inactive categories (e.g. Discover rotating promos not currently running)
  const active = (cards ?? []).map((card) => ({
    ...card,
    card_categories: categories.filter((cc) => cc.card_id === card.id),
  })) as unknown as Parameters<typeof getCardResults>[1]

  const ranked = getCardResults(category, active)
  return NextResponse.json(ranked)
}
