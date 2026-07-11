type OfferWithMerchant = {
  merchant: string
}

export function normalizeMerchantName(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function isOfferNoise(merchant: string): boolean {
  return normalizeMerchantName(merchant) === 'membershiprewardsbonuspointsoffer'
}

export function selectDiverseOffers<T extends OfferWithMerchant>(
  offers: T[],
  limit: number
): Array<T & { variant_count: number }> {
  const selected = new Map<string, T & { variant_count: number }>()

  for (const offer of offers) {
    if (isOfferNoise(offer.merchant)) continue
    const key = normalizeMerchantName(offer.merchant)
    const existing = selected.get(key)
    if (existing) {
      existing.variant_count += 1
    } else {
      selected.set(key, { ...offer, variant_count: 1 })
    }
  }

  return Array.from(selected.values()).slice(0, limit)
}

export function countDistinctOfferMerchants<T extends OfferWithMerchant>(offers: T[]): number {
  return new Set(
    offers
      .filter((offer) => !isOfferNoise(offer.merchant))
      .map((offer) => normalizeMerchantName(offer.merchant))
  ).size
}
