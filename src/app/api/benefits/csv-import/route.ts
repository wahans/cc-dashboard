import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { parseAmexCSV, matchToBenefit, parseAmexDate } from '@/lib/csv-parser'
import { getPeriodKey } from '@/lib/benefits'

export async function POST(req: NextRequest) {
  const { csv } = await req.json()
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const transactions = parseAmexCSV(csv)
  const credits = transactions.filter((t) => t.is_credit)

  const benefits = await sql`select id, name, reset_period from amex_benefits`

  const matches: { benefit_name: string; amount: number; date: string }[] = []
  const inserts: { benefit_id: string; amount_used_cents: number; period_key: string; notes: string; source: string }[] = []

  for (const txn of credits) {
    const benefitName = matchToBenefit(txn.description, txn.amount)
    if (!benefitName) continue
    const benefit = benefits?.find((b) => b.name === benefitName)
    if (!benefit) continue

    const txnDate = parseAmexDate(txn.date)
    const periodKey = getPeriodKey(benefit.reset_period, txnDate)

    matches.push({ benefit_name: benefitName, amount: txn.amount, date: txn.date })
    inserts.push({
      benefit_id: benefit.id,
      amount_used_cents: Math.round(txn.amount * 100),
      period_key: periodKey,
      notes: txn.description,
      source: 'csv',
    })
  }

  for (const insert of inserts) {
    await sql`
      insert into benefit_usage (benefit_id, amount_used_cents, period_key, notes, source)
      values (${insert.benefit_id}, ${insert.amount_used_cents}, ${insert.period_key}, ${insert.notes}, ${insert.source})
    `
  }

  return NextResponse.json({ imported: matches.length, matches })
}
