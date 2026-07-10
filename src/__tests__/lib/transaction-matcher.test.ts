import { matchBenefitsToTransactions } from '@/lib/transaction-matcher'

describe('matchBenefitsToTransactions', () => {
  const benefits = [
    {
      id: 'resy-id',
      name: 'Resy Credit',
      amount_cents: 40000,
      reset_period: 'quarterly' as const,
    },
    {
      id: 'hotel-id',
      name: 'Hotel Credit',
      amount_cents: 60000,
      reset_period: 'semi-annual' as const,
    },
    {
      id: 'walmart-id',
      name: 'Walmart+ Credit',
      amount_cents: 15600,
      reset_period: 'annual' as const,
    },
    {
      id: 'saks-id',
      name: 'Saks Fifth Avenue',
      amount_cents: 10000,
      reset_period: 'semi-annual' as const,
    },
    {
      id: 'digital-id',
      name: 'Digital Entertainment',
      amount_cents: 30000,
      reset_period: 'monthly' as const,
    },
    {
      id: 'lululemon-id',
      name: 'lululemon Credit',
      amount_cents: 30000,
      reset_period: 'quarterly' as const,
    },
  ]

  it('counts matching statement credits as captured value', () => {
    const matches = matchBenefitsToTransactions(benefits, [{
      id: 'credit-1',
      date: new Date('2026-07-10'),
      amount: 35,
      description: 'PLATINUM RESY CREDIT',
      type: 'CREDIT',
    }], 2026)

    expect(matches[0].amount_used_cents).toBe(3500)
  })

  it('does not mistake the restaurant charge for recovered value', () => {
    const matches = matchBenefitsToTransactions(benefits, [{
      id: 'debit-1',
      date: new Date('2026-07-10'),
      amount: 35,
      description: 'RESY RESTAURANT',
      type: 'DEBIT',
    }], 2026)

    expect(matches).toHaveLength(0)
  })

  it('matches the five known Platinum benefit credits from Lucent', () => {
    const matches = matchBenefitsToTransactions(benefits, [
      { id: '1', date: new Date('2026-06-25'), amount: 300, description: 'Platinum Hotel Credit', type: 'CREDIT' },
      { id: '2', date: new Date('2026-06-24'), amount: 14.16, description: 'Platinum Walmart+ Credit', type: 'CREDIT' },
      { id: '3', date: new Date('2026-06-17'), amount: 50, description: 'PLATINUM SAKS CREDIT', type: 'CREDIT' },
      { id: '4', date: new Date('2026-03-14'), amount: 2.99, description: 'Platinum Digital Entertainment Credit', type: 'CREDIT' },
      { id: '5', date: new Date('2026-02-16'), amount: 75, description: 'Platinum Lululemon Credit', type: 'CREDIT' },
    ], 2026)

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ benefit_name: 'Hotel Credit', period_key: '2026-H1', amount_used_cents: 30000 }),
      expect.objectContaining({ benefit_name: 'Walmart+ Credit', period_key: '2026', amount_used_cents: 1416 }),
      expect.objectContaining({ benefit_name: 'Saks Fifth Avenue', period_key: '2026-H1', amount_used_cents: 5000 }),
      expect.objectContaining({ benefit_name: 'Digital Entertainment', period_key: '2026-03', amount_used_cents: 299 }),
      expect.objectContaining({ benefit_name: 'lululemon Credit', period_key: '2026-Q1', amount_used_cents: 7500 }),
    ]))
    expect(matches.reduce((sum, match) => sum + match.amount_used_cents, 0)).toBe(44215)
  })

  it('does not count returns or card payments as benefit credits', () => {
    const matches = matchBenefitsToTransactions(benefits, [
      { id: 'return', date: new Date('2026-05-13'), amount: 208.76, description: 'TARGET 003210 REDWOOD CITY CA', type: 'CREDIT' },
      { id: 'payment', date: new Date('2026-06-09'), amount: 5021.85, description: 'AUTOPAY PAYMENT - THANK YOU', type: 'CREDIT' },
      { id: 'generic', date: new Date('2026-06-01'), amount: 50, description: 'Saks Fifth Avenue return', type: 'CREDIT' },
    ], 2026)

    expect(matches).toHaveLength(0)
  })

  it('groups recurring credits into their actual reset periods', () => {
    const matches = matchBenefitsToTransactions(benefits, [
      { id: 'march', date: new Date('2026-03-14'), amount: 2.99, description: 'Platinum Digital Entertainment Credit', type: 'CREDIT' },
      { id: 'july', date: new Date('2026-07-14'), amount: 12, description: 'Platinum Digital Entertainment Credit', type: 'CREDIT' },
    ], 2026)

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ period_key: '2026-03', amount_used_cents: 299 }),
      expect.objectContaining({ period_key: '2026-07', amount_used_cents: 1200 }),
    ]))
  })
})
