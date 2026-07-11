type OfferWithMerchant = {
  merchant: string
}

function normalizeMerchantName(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function selectDiverseOffers<T extends OfferWithMerchant>(
  offers: T[],
  limit: number
): Array<T & { variant_count: number }> {
  const selected = new Map<string, T & { variant_count: number }>()

  for (const offer of offers) {
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
