import { countDistinctOfferMerchants, isOfferNoise, selectDiverseOffers } from '@/lib/offer-display'

describe('selectDiverseOffers', () => {
  it('shows one row per merchant and counts additional variants', () => {
    const offers = [
      { id: 'delta-200', merchant: 'Delta Vacations', reward_amount_cents: 200000 },
      { id: 'delta-170', merchant: 'Delta Vacations', reward_amount_cents: 170000 },
      { id: 'empire', merchant: 'Empire Today', reward_amount_cents: 35000 },
      { id: 'resy', merchant: 'Resy', reward_amount_cents: 10000 },
    ]

    expect(selectDiverseOffers(offers, 10)).toEqual([
      expect.objectContaining({ id: 'delta-200', variant_count: 2 }),
      expect.objectContaining({ id: 'empire', variant_count: 1 }),
      expect.objectContaining({ id: 'resy', variant_count: 1 }),
    ])
  })

  it('limits results after merchant deduplication', () => {
    const offers = [
      { id: 'a1', merchant: 'A', reward_amount_cents: 500 },
      { id: 'a2', merchant: 'A', reward_amount_cents: 400 },
      { id: 'b1', merchant: 'B', reward_amount_cents: 300 },
      { id: 'c1', merchant: 'C', reward_amount_cents: 200 },
    ]

    expect(selectDiverseOffers(offers, 2).map((offer) => offer.id)).toEqual(['a1', 'b1'])
  })

  it('removes generic Membership Rewards scraper rows', () => {
    expect(isOfferNoise('Membership Rewards® Bonus Points Offer')).toBe(true)
    expect(isOfferNoise('Membership Rewards Bonus Points Offer')).toBe(true)
    expect(isOfferNoise('Marriott Bonvoy®')).toBe(false)

    const offers = [
      { id: 'noise', merchant: 'Membership Rewards® Bonus Points Offer' },
      { id: 'marriott-1', merchant: 'Marriott Bonvoy®' },
      { id: 'marriott-2', merchant: 'Marriott Bonvoy' },
      { id: 'delta', merchant: 'Delta Vacations' },
    ]
    expect(selectDiverseOffers(offers, 10).map((offer) => offer.id)).toEqual(['marriott-1', 'delta'])
    expect(countDistinctOfferMerchants(offers)).toBe(2)
  })
})
