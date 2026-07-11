import { sql } from '@/lib/db'
import { isOfferNoise } from './offer-display'

type OfferInput = {
  merchant: string
  description: string | null
  spend_min_cents: number | null
  reward_amount_cents: number | null
  reward_type: string | null
  expiration_date: string | null
}

export async function persistOffers(offers: OfferInput[]) {
  const scrapedAt = new Date().toISOString()
  for (const offer of offers.filter((item) => !isOfferNoise(item.merchant))) {
    await sql`
      insert into amex_offers
        (merchant, description, spend_min_cents, reward_amount_cents, reward_type, expiration_date, active, scraped_at)
      values
        (${offer.merchant}, ${offer.description}, ${offer.spend_min_cents}, ${offer.reward_amount_cents},
         ${offer.reward_type}, ${offer.expiration_date}, true, ${scrapedAt})
      on conflict (merchant, expiration_date, reward_amount_cents)
      do update set description = excluded.description,
                    spend_min_cents = excluded.spend_min_cents,
                    reward_type = excluded.reward_type,
                    active = true,
                    scraped_at = excluded.scraped_at
    `
  }
  await sql`
    update amex_offers set active = false
    where lower(regexp_replace(merchant, '[^a-zA-Z0-9]', '', 'g')) = 'membershiprewardsbonuspointsoffer'
  `
  await sql`update amex_offers set active = false where expiration_date < current_date`
}
