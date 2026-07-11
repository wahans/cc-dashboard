import type { SyncDetails } from '@/types/sync'

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function CreditRows({
  credits,
  showBenefit,
}: {
  credits: SyncDetails['matched_credits']
  showBenefit: boolean
}) {
  return (
    <div className="divide-y divide-gray-100">
      {credits.map((credit) => (
        <div key={credit.id} className="grid grid-cols-[72px_1fr_auto] gap-3 px-4 py-2.5 items-start">
          <span className="text-[11px] text-gray-400 tabular-nums">{credit.date.slice(5)}</span>
          <div className="min-w-0">
            {showBenefit && credit.benefit_name && (
              <p className="text-[12px] font-semibold text-gray-800 truncate">{credit.benefit_name}</p>
            )}
            <p className="text-[11px] text-gray-500 truncate">{credit.description}</p>
          </div>
          <span className="text-[12px] font-semibold text-gray-700 tabular-nums">
            {formatDollars(credit.amount_cents)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SyncDetailsPanel({
  details,
  syncedAt,
}: {
  details: SyncDetails | null
  syncedAt: string | null
}) {
  if (!details || !syncedAt) return null

  const capturedCents = details.matched_credits.reduce(
    (sum, credit) => sum + credit.amount_cents,
    0
  )

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-b border-gray-200">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-700 text-balance">Last Lucent Sync</h2>
          <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
            {details.matched_credits.length} captured · {formatDollars(capturedCents)}
          </p>
        </div>
        <span className="text-[11px] text-gray-400 tabular-nums">
          {new Date(syncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      <details>
        <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-blue-700 hover:text-blue-900">
          Review matched credits
        </summary>
        <CreditRows credits={details.matched_credits} showBenefit />
      </details>

      <details className="border-t border-gray-100">
        <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-gray-600 hover:text-gray-900">
          {details.unmatched_credits.length} unmatched credit{details.unmatched_credits.length === 1 ? '' : 's'} excluded from captured value
        </summary>
        {details.unmatched_credits.length > 0 ? (
          <CreditRows credits={details.unmatched_credits} showBenefit={false} />
        ) : (
          <p className="px-4 pb-3 text-[12px] text-gray-400">No unmatched credits need review.</p>
        )}
      </details>
    </div>
  )
}
