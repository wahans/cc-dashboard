export type SyncLogRow = {
  id: string
  type: 'offers_scrape' | 'budget_sync'
  ran_at: string
  records_processed: number
  records_updated: number | null
  error: string | null
  details?: SyncDetails | null
}

export type SyncCredit = {
  id: string
  date: string
  description: string
  amount_cents: number
  benefit_name?: string
}

export type SyncDetails = {
  matched_credits: SyncCredit[]
  unmatched_credits: SyncCredit[]
}
