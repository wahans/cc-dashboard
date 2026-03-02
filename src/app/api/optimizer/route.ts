import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCardResults } from '@/lib/optimizer'

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  if (!category) {
    return NextResponse.json({ error: 'category query param required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: cards, error } = await supabase
    .from('cards')
    .select('*, card_categories(*)')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Strip inactive categories (e.g. Discover rotating promos not currently running)
  const active = (cards ?? []).map((card) => ({
    ...card,
    card_categories: card.card_categories.filter((cc: { active: boolean }) => cc.active !== false),
  }))

  const ranked = getCardResults(category, active)
  return NextResponse.json(ranked)
}
