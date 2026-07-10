import { matchBenefitsToTransactions } from '@/lib/transaction-matcher'

describe('matchBenefitsToTransactions', () => {
  const benefits = [{
    id: 'resy-id',
    name: 'Resy Credit',
    amount_cents: 40000,
    reset_period: 'quarterly' as const,
  }]

  it('counts matching statement credits as captured value', () => {
    const matches = matchBenefitsToTransactions(benefits, [{
      id: 'credit-1',
      date: new Date('2026-07-10'),
      amount: 35,
      description: 'AMEX RESY STATEMENT CREDIT',
      type: 'CREDIT',
    }])

    expect(matches[0].amount_used_cents).toBe(3500)
  })

  it('does not mistake the restaurant charge for recovered value', () => {
    const matches = matchBenefitsToTransactions(benefits, [{
      id: 'debit-1',
      date: new Date('2026-07-10'),
      amount: 35,
      description: 'RESY RESTAURANT',
      type: 'DEBIT',
    }])

    expect(matches).toHaveLength(0)
  })
})
