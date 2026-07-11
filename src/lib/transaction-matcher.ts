import type { BudgetTransaction } from './budget-db'
import { getPeriodKey } from './benefits'
import type { ResetPeriod } from './benefits'

function normalizeMerchant(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ─── Offer matching ───────────────────────────────────────────────────────────

export function computeOfferSpend(
  offerMerchant: string,
  enrolledAt: string,
  transactions: BudgetTransaction[]
): number {
  const norm = normalizeMerchant(offerMerchant)
  if (!norm) return 0
  const enrolledDate = new Date(enrolledAt)
  return transactions
    .filter(
      (t) =>
        new Date(t.date) >= enrolledDate &&
        t.type === 'DEBIT' &&
        normalizeMerchant(t.description).includes(norm)
    )
    .reduce((sum, t) => sum + Math.round(t.amount * 100), 0)
}

// ─── Benefit matching ─────────────────────────────────────────────────────────

// Only explicit Amex benefit-credit labels belong here. Merchant refunds and
// card payments are credits too, so matching a merchant name alone is unsafe.
const BENEFIT_PATTERNS: Record<string, string[]> = {
  'Digital Entertainment': ['platinum digital entertainment credit'],
  'Resy Credit': ['platinum resy credit'],
  'lululemon Credit': ['platinum lululemon credit'],
  'Walmart+ Credit': ['platinum walmart credit'],
  'Walmart+': ['platinum walmart credit'],
  'Saks Fifth Avenue': ['platinum saks credit'],
  'Saks': ['platinum saks credit'],
  'Hotel Credit': ['platinum hotel credit'],
  'Airline Fee Credit': ['platinum airline fee credit'],
  'CLEAR+ Credit': ['platinum clear credit'],
  'CLEAR+': ['platinum clear credit'],
  'Equinox/SoulCycle': ['platinum equinox credit'],
  'Equinox': ['platinum equinox credit'],
  'Oura Ring Credit': ['platinum oura ring credit'],
  'Oura Ring': ['platinum oura ring credit'],
  'Global Entry / TSA': ['platinum global entry credit', 'platinum tsa precheck credit'],
}

export type BenefitMatchResult = {
  benefit_id: string
  benefit_name: string
  period_key: string
  amount_used_cents: number  // capped at benefit.amount_cents
  transaction_count: number
  matched_transactions: Array<{
    id: string
    date: string
    description: string
    amount_cents: number
  }>
}

type BenefitRow = {
  id: string
  name: string
  amount_cents: number
  reset_period: ResetPeriod
}

export type ReviewCredit = {
  id: string
  date: string
  description: string
  amount_cents: number
}

function isCardPayment(description: string): boolean {
  const normalized = description.toLowerCase()
  return normalized.includes('payment - thank you')
    || normalized.includes('autopay payment')
    || normalized.includes('online payment')
}

export function getUnmatchedCreditsForReview(
  transactions: BudgetTransaction[],
  matches: BenefitMatchResult[],
  year: number = new Date().getUTCFullYear()
): ReviewCredit[] {
  const matchedIds = new Set(
    matches.flatMap((match) => match.matched_transactions.map((transaction) => transaction.id))
  )

  return transactions
    .filter((transaction) => {
      const date = new Date(transaction.date)
      return transaction.type === 'CREDIT'
        && date.getUTCFullYear() === year
        && !matchedIds.has(transaction.id)
        && !isCardPayment(transaction.description)
    })
    .map((transaction) => ({
      id: transaction.id,
      date: new Date(transaction.date).toISOString().split('T')[0],
      description: transaction.description,
      amount_cents: Math.round(transaction.amount * 100),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function matchBenefitsToTransactions(
  benefits: BenefitRow[],
  transactions: BudgetTransaction[],
  year: number = new Date().getUTCFullYear()
): BenefitMatchResult[] {
  const results: BenefitMatchResult[] = []

  for (const benefit of benefits) {
    const patterns = BENEFIT_PATTERNS[benefit.name]
    if (!patterns) continue

    const matchesByPeriod = new Map<string, {
      cents: number
      transactions: BenefitMatchResult['matched_transactions']
    }>()
    for (const transaction of transactions) {
      const transactionDate = new Date(transaction.date)
      if (transactionDate.getUTCFullYear() !== year || transaction.type !== 'CREDIT') continue

      const description = normalizeMerchant(transaction.description)
      const isBenefitCredit = patterns.some((pattern) =>
        description.includes(normalizeMerchant(pattern))
      )
      if (!isBenefitCredit) continue

      const periodKey = getPeriodKey(benefit.reset_period, transactionDate)
      const existing = matchesByPeriod.get(periodKey) ?? { cents: 0, transactions: [] }
      const amountCents = Math.round(transaction.amount * 100)
      existing.cents += amountCents
      existing.transactions.push({
        id: transaction.id,
        date: transactionDate.toISOString().split('T')[0],
        description: transaction.description,
        amount_cents: amountCents,
      })
      matchesByPeriod.set(periodKey, existing)
    }

    for (const [periodKey, match] of matchesByPeriod) {
      results.push({
        benefit_id: benefit.id,
        benefit_name: benefit.name,
        period_key: periodKey,
        amount_used_cents: Math.min(match.cents, benefit.amount_cents),
        transaction_count: match.transactions.length,
        matched_transactions: match.transactions,
      })
    }
  }

  return results.sort((a, b) => a.period_key.localeCompare(b.period_key))
}
