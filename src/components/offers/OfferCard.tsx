'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type Offer = {
  id: string
  merchant: string
  description: string | null
  spend_min_cents: number | null
  reward_amount_cents: number | null
  reward_type: string
  expiration_date: string | null
  is_enrolled: boolean
}

type MerchantGroup = {
  merchant: string
  offers: Offer[]        // sorted by reward desc within group
  bestOffer: Offer       // highest reward offer
  earliestExpiry: string | null
  hasEnrolled: boolean
}

type SortKey = 'reward' | 'expiry' | 'merchant' | 'return'
type FilterKey = 'all' | 'enrolled' | 'expiring' | string

const CATEGORIES: Array<{ label: string; emoji: string; pattern: RegExp }> = [
  {
    label: 'Gas',
    emoji: '⛽',
    pattern: /gas pump|pay at the pump|cumberland farms|loaf.n.jug|quikstop|quiktrip|turkey hill|\bshell\b|\bexxon\b|\bchevron\b|\bmobil\b|sunoco|circle k|\bwawa\b/i,
  },
  {
    label: 'Delivery',
    emoji: '📦',
    pattern: /instacart|gopuff|\bshipt\b|postmates|uber eats|grubhub/i,
  },
  {
    label: 'Travel',
    emoji: '✈',
    pattern: /delta air lines|aer lingus|icelandair|qatar airways|virgin atlantic|singapore airlines|airbnb|alamo rent|avis car|budget car rental|cruise america|\bcunard\b|holland america|\bviator\b|\btrafalgar\b|vail resorts|sugarloaf|sunday river|alterra mountain|big sky resort|micato|\btumi\b|briggs.riley|shipskis|shipsticks|stoney clover lane|peak design|langham hotel|mandarin oriental|lotte hotel|lotte new york|terranea|wynn las vegas|green valley ranch casino|\braffles\b|\bfairmont\b|\bsofitel\b|carey international|golfbreaks|clear\+|ihg.*hotel|hilton resort|\bhertz\b|ski resort|lift ticket|\bturo\b|chauffeured|car rental|cruise ship|travelware|aka.*hotel|hotel.*residenc/i,
  },
  {
    label: 'Dining',
    emoji: '🍽',
    pattern: /restaurant|steakhouse|gastropub|\bcafe\b|pizza\b|burger\b|\bgrill\b|\bbistro\b|\bdiner\b|starbucks|dunkin|chipotle|subway|doordash|jamba\b|jimmy john|little caesars|pizza hut|schlotzsky|mcalister|cicis\b|shake shack|smashburger|el pollo|outback steak|moe.s southwest|mountain mike|auntie anne|five crowns|docks oyster|eddie merlot|il fornaio|magnolia bakery|nowak.s|paul martin|red heat|sarabeth|sullivan.s steak|succotash\b|rosa mexicano|mi vida\b|puesto\b|wagamama\b|boqueria\b|chef geoff|uchi\b|uchiko\b|\bnaya\b|hellofresh|home chef|green chef|marley spoon|sunbasket|gobble\b|hungryroot|cook unity|daily harvest|freshdirect|factor\b|spoonful of comfort|wild alaskan|misfits market|natural grocers|food lion|fruit center|nurture life|little spoon|ghirardelli|bluebottle|peets\.com|coffee bean|shopjura|america.s test kitchen|milkstreet|sur la table|zwilling|caraway\b|shopflavcity|wine\b|winery|vineyards|spirits\b|brewery|beverage|tapas\b|seafood\b|bakery\b|eatery\b|meal kit|meal delivery|gourmet food|food delivery/i,
  },
  {
    label: 'Beauty',
    emoji: '💄',
    pattern: /skincare|skin care|cosmetics?\b|fragrance\b|serum\b|moisturizer|sunscreen\b|haircare|hair care|aesop\b|biossance|c\.o\. bigelow|\bbigelow\b|colorescience|darphin|dior beauty|dollar shave|dennis gross|drunk elephant|glowbar\b|la prairie|manscaped|massage envy|musely\b|no7beauty|osea\b|peachy\b|r\+co\b|redken\b|shiseido|art of shaving|aroma360|credobeauty|davines\b|drsturm|dr sturm|elfcosmetics|elf cosmetics|eltamd\b|glowrecipe|glow recipe|grownalchemist|grown alchemist|murad\b|narscosmetics|nars cosmetics|obagi\b|olaplex\b|oribe\b|pcaskin|pca skin|philosophy\.com|proactiv\b|reviveskincare|revive skincare|skinbetter|solawave\b|tataharperskincare|tata harper|theouai\b|the ouai|ubeauty\b|u beauty\b|curology\b|drmtlgy|cl.{1,5}de peau|botox studio|facial\b|ancient baths|aire.*bath|salt.*stone|hum nutrition|formulations for skin/i,
  },
  {
    label: 'Home',
    emoji: '🏠',
    pattern: /simplisafe|\barlo\b|american home shield|renuity\b|mattress\b|avocado.*mattress|cocoon.*sealy|sleep outfitters|mattress firm|cozy earth|cuddledown|linensandhutch|linens.*hutch|little sleepies|lovetodream|love to dream|\bikea\b|crate.*barrel|ballard designs|blu dot\b|floor.*decor\b|tilebar|rugs\.com|lampsplus|lamps plus|jonathan adler|simplehuman|\bwhisker\b|litter.robot|irobot\b|\bbissell\b|charbroil\b|county tv|yudin|happiestbaby|happiest baby|gardyn\b|\bpura\b|laundrysauce|laundry sauce|rocco.*fridge|bed bath|bedbath|nuna baby|bugaboo\b|miraclebrand|miracle brand|home security|home warranty|home improvement|home decor|appliance|bedding\b|pillow\b|blanket\b|furniture\b/i,
  },
  {
    label: 'Entertainment',
    emoji: '🎭',
    pattern: /ticket\b|venue\b|concert\b|broadway|theater\b|theatre\b|goldenvoice|gametime\b|megaseats|todaytix|telecharge|bowery presents|peacock theater|eventticketscenter|ticketsmarter|nba store|nbastore|nhl shop|\bwwe\b|fanatics\b|delta center team|disney\+|hulu\b|hbo\b|directv|fubo\b|paramount\+|starz\b|youtube tv|fanduel sports|cnbc pro|\bcnn\b|the motley fool|the atlantic\b|ancestry\b|\blids\b|jdsports|jd sports|live.*music|live.*sport|streaming.*tv|sports.*network/i,
  },
  {
    label: 'Health',
    emoji: '💊',
    pattern: /pharmacy|\bcvs\b|walgreens|rite aid|betterhelp|hyperice|stretchlab|othership|oura\b|prenuvo|labcorp|glassesusa|lenscrafters|liquid i\.v|liquid iv\b|lineage provisions|vitamin shoppe|sports sciences|nativepath|native path|hylands\b|pureformulas|ritual.*vitamin|supplement\b|vitamin\b|fitness\b|wellness\b|medical\b|dental\b|vision care|health test|\bgym\b|yoga\b|pilates\b|physical therapy|chiropractic|nordictrack\b|tonal\b|bowflex\b|peloton|nobull\b/i,
  },
  {
    label: 'Tech',
    emoji: '💻',
    pattern: /adobe\b|microsoft\b|lenovo\b|sony electronics|netgear\b|harman kardon|harmankardon|zagg\b|slack\.com|\bdocusign\b|dropbox\b|quickbooks|squarespace|xero\.com|replit\b|lastpass|grasshopper.*phone|audiogo|callrail|indeed\.com|udemy\b|ooma\b|optimum internet|at&t wireless|straight talk|total wireless|tracfone|visible\b|turbotax|taxact\b|hrblock|legalzoom|trust.*will|vistaprint|pimsleur|astound\b|magnifi\b|nrg protects|software\b|electronics\b|wireless plan|internet service|prepaid.*plan|phone.*plan/i,
  },
  {
    label: 'Retail',
    emoji: '🛍',
    pattern: /clothing|apparel|fashion\b|footwear|outerwear|swimwear|eyewear|sunglasses|jewelry|jeweler|handbag|accessori|levi.s|lululemon|burberry|calvin klein|carhartt|cole haan|mizzen|mackage|stitch fix|rent the runway|\btheory\b|tory burch|toryburch|sandro paris|maje paris|\bmulberry\b|rebecca minkoff|allen edmonds|\bariat\b|tecovas|criquet|express\b|southern tide|\brails\b|paka apparel|on\.com|\bkuhl\b|faherty|rodd.*gunn|universalstandard|universal standard|splendid\b|maurices|lagence|frank.*eileen|robertgraham|robert graham|tnuck\b|saxx\b|staud\b|collars.*co|natori\b|harper wilde|vix swimwear|krewe\b|\brevo\b|oakley\b|freda salvador|bezel\b|brilliant earth|jennifer fisher|long.*jewel|manfredi jewel|happy jewel|ross.simons|swarovski|gorjana|pandora\b|vivrelle|kipling\b|ogio\b|radley london|vera bradley|mansur gavriel|rifle paper|printfresh|print fresh|crocs\b|fitflop|jins\b|steve madden|xero shoes|kickscrew|7forallmankind|aventon\b|sweetwater|musical instrument|golf club|nordstrom|michaels\b|sam.s club|barnesandnoble|barnes.*noble|aldoshoes|aldo shoes|\baldo\b|alexander wang|us polo|uspoloassn|intimissimi|heydude|hey dude|dridriss|thisisneeded|underwear\b/i,
  },
]

function getCategory(merchant: string): { label: string; emoji: string } {
  for (const cat of CATEGORIES) {
    if (cat.pattern.test(merchant)) return { label: cat.label, emoji: cat.emoji }
  }
  return { label: 'Other', emoji: '○' }
}

function formatReward(offer: Offer): { text: string; isPoints: boolean } {
  if (!offer.reward_amount_cents) return { text: '—', isPoints: false }
  if (offer.reward_type === 'points') {
    return { text: offer.reward_amount_cents.toLocaleString() + ' pts', isPoints: true }
  }
  const dollars = offer.reward_amount_cents / 100
  const formatted = dollars % 1 === 0
    ? dollars.toLocaleString('en-US')
    : dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return { text: `$${formatted} back`, isPoints: false }
}

function formatMinSpend(cents: number | null): string {
  if (!cents) return '—'
  return `$${Math.round(cents / 100).toLocaleString()}`
}

function computeReturn(offer: Offer): number | null {
  if (
    offer.reward_type === 'points' ||
    offer.spend_min_cents == null ||
    offer.reward_amount_cents == null ||
    offer.spend_min_cents === 0
  ) return null
  return Math.round((offer.reward_amount_cents / offer.spend_min_cents) * 100)
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatExpiry(dateStr: string | null): { text: string; urgent: boolean } | null {
  if (!dateStr) return null
  const days = daysUntil(dateStr)
  if (days < 0) return null
  const d = new Date(dateStr)
  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (days <= 7) return { text: `${formatted} · ${days}d`, urgent: true }
  return { text: formatted, urgent: false }
}

type RewardType = 'all' | 'points' | 'cash'
type MinReward = 'any' | '5k' | '25k'

const MIN_THRESHOLDS: Record<Exclude<MinReward, 'any'>, { points: number; cash: number }> = {
  '5k':  { points: 5000,  cash: 500 },
  '25k': { points: 25000, cash: 2500 },
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const days = daysUntil(dateStr)
  return days >= 0 && days <= 7
}

function compareExpiry(a: Offer, b: Offer): number {
  if (!a.expiration_date && !b.expiration_date) return 0
  if (!a.expiration_date) return 1
  if (!b.expiration_date) return -1
  return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()
}

function groupByMerchant(offers: Offer[]): MerchantGroup[] {
  // Preserve the order of first occurrence (which reflects the active sort)
  const map = new Map<string, Offer[]>()
  for (const offer of offers) {
    if (!map.has(offer.merchant)) map.set(offer.merchant, [])
    map.get(offer.merchant)!.push(offer)
  }
  return [...map.entries()].map(([merchant, list]) => {
    const sorted = [...list].sort((a, b) => (b.reward_amount_cents ?? 0) - (a.reward_amount_cents ?? 0))
    const expiries = list
      .map((o) => o.expiration_date)
      .filter((d): d is string => d !== null)
      .sort()
    return {
      merchant,
      offers: sorted,
      bestOffer: sorted[0],
      earliestExpiry: expiries[0] ?? null,
      hasEnrolled: list.some((o) => o.is_enrolled),
    }
  })
}

// ─── Grid column template ─────────────────────────────────────────────────────
// Merchant(flex) | Category(80) | Reward(100) | MinSpend(90) | %Return(70) | Expires(110) | Status(80) | Action(100)
const GRID = 'grid grid-cols-[minmax(160px,1fr)_80px_100px_90px_70px_110px_80px_100px]'

// ─── Column header ────────────────────────────────────────────────────────────
function ColHeader({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <div className={`${a} text-[11px] font-medium uppercase tracking-[0.8px] text-gray-400 py-2.5 px-2 whitespace-nowrap`}>
      {children}
    </div>
  )
}

// ─── Section divider row ──────────────────────────────────────────────────────
function GroupRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 select-none bg-gray-50/60">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.8px]">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}

// ─── Individual offer row ─────────────────────────────────────────────────────
function OfferRow({
  offer,
  onToggle,
  indent = false,
}: {
  offer: Offer
  onToggle: (id: string) => Promise<void>
  indent?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const category = getCategory(offer.merchant)
  const reward = formatReward(offer)
  const expiry = formatExpiry(offer.expiration_date)

  async function handleToggle() {
    setLoading(true)
    try {
      await onToggle(offer.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Desktop row (md+) ── */}
      <div
        className={[
          'hidden md:grid',
          GRID,
          'items-center h-[44px] border-b border-[#f3f4f6] transition-colors',
          offer.is_enrolled
            ? 'border-l-[3px] border-l-green-600 hover:bg-green-50/60'
            : 'border-l-[3px] border-l-transparent hover:bg-[#f9fafb]',
          indent ? 'bg-gray-50/40' : '',
        ].join(' ')}
      >
        {/* Merchant + description */}
        <div className={`min-w-0 ${indent ? 'px-2 pl-10' : 'px-2'}`}>
          <p className="text-[14px] font-semibold text-gray-900 truncate leading-snug">{offer.merchant}</p>
          {offer.description && (
            <p className="text-[11px] text-gray-400 truncate leading-snug">{offer.description}</p>
          )}
        </div>

        {/* Category chip */}
        <div className="flex justify-center px-1">
          <span className="text-[10px] font-medium border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 whitespace-nowrap leading-tight">
            {category.emoji} {category.label}
          </span>
        </div>

        {/* Reward */}
        <div className="px-2 text-right">
          <span
            className={[
              'font-[var(--font-geist-mono)] text-[13px] font-bold tabular-nums',
              reward.isPoints ? 'text-blue-600' : 'text-green-700',
            ].join(' ')}
          >
            {reward.text}
          </span>
        </div>

        {/* Min spend */}
        <div className="px-2 text-right">
          <span className="font-[var(--font-geist-mono)] text-[13px] text-gray-500 tabular-nums">
            {formatMinSpend(offer.spend_min_cents)}
          </span>
        </div>

        {/* % Return */}
        <div className="px-2 text-right">
          {(() => {
            const pct = computeReturn(offer)
            return pct !== null ? (
              <span className="font-[var(--font-geist-mono)] text-[13px] text-purple-700 font-semibold tabular-nums">
                {pct}%
              </span>
            ) : (
              <span className="font-[var(--font-geist-mono)] text-[13px] text-gray-300 tabular-nums">—</span>
            )
          })()}
        </div>

        {/* Expires */}
        <div className="px-2">
          {expiry ? (
            <span className={`text-[12px] tabular-nums ${expiry.urgent ? 'text-[#dc2626] font-bold' : 'text-gray-400'}`}>
              {expiry.text}
            </span>
          ) : (
            <span className="text-[12px] text-gray-300">—</span>
          )}
        </div>

        {/* Status */}
        <div className="flex justify-center">
          {offer.is_enrolled ? (
            <div className="flex items-center gap-1.5">
              <div className="w-[6px] h-[6px] rounded-full bg-green-500 shrink-0" />
              <span className="text-[11px] text-green-700 font-semibold">Enrolled</span>
            </div>
          ) : (
            <span className="text-[12px] text-gray-300">—</span>
          )}
        </div>

        {/* Action */}
        <div className="px-2 flex justify-end">
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className={[
              'text-[12px] font-semibold transition-colors disabled:opacity-30',
              offer.is_enrolled
                ? 'text-gray-400 hover:text-gray-700'
                : 'text-blue-600 hover:text-blue-800',
            ].join(' ')}
          >
            {loading ? '…' : offer.is_enrolled ? 'Unenroll' : 'Enroll'}
          </button>
        </div>
      </div>

      {/* ── Mobile card (<md) ── */}
      <div
        className={[
          'md:hidden px-3 py-2.5 border-b border-[#f3f4f6] transition-colors',
          offer.is_enrolled
            ? 'border-l-[3px] border-l-green-600 bg-green-50/30'
            : 'border-l-[3px] border-l-transparent',
          indent ? 'pl-7 bg-gray-50/40' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-gray-900 truncate flex-1">{offer.merchant}</p>
          <span
            className={[
              'font-[var(--font-geist-mono)] text-[14px] font-bold tabular-nums shrink-0',
              reward.isPoints ? 'text-blue-600' : 'text-green-700',
            ].join(' ')}
          >
            {reward.text}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[12px] text-gray-400">
            {expiry ? (
              <span className={expiry.urgent ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                {expiry.text}
              </span>
            ) : offer.is_enrolled ? (
              <span className="text-green-700 font-medium">Enrolled</span>
            ) : (
              '—'
            )}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className={[
              'text-[13px] font-semibold transition-colors disabled:opacity-30 py-1 pl-3',
              offer.is_enrolled
                ? 'text-gray-400 hover:text-gray-700'
                : 'text-blue-600 hover:text-blue-800',
            ].join(' ')}
          >
            {loading ? '…' : offer.is_enrolled ? 'Unenroll' : 'Enroll'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Merchant group row (collapsible) ─────────────────────────────────────────
function MerchantGroupRow({
  group,
  expanded,
  onToggle,
  onToggleEnroll,
}: {
  group: MerchantGroup
  expanded: boolean
  onToggle: () => void
  onToggleEnroll: (id: string) => Promise<void>
}) {
  const [enrolling, setEnrolling] = useState(false)
  const { bestOffer, offers, hasEnrolled, earliestExpiry } = group
  const category = getCategory(bestOffer.merchant)
  const reward = formatReward(bestOffer)
  const expiry = formatExpiry(earliestExpiry)
  const extra = offers.length - 1

  async function handleEnroll(e: React.MouseEvent) {
    e.stopPropagation()
    setEnrolling(true)
    try {
      await onToggleEnroll(bestOffer.id)
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <>
      {/* ── Desktop group header (md+) ── */}
      <div
        onClick={onToggle}
        className={[
          'hidden md:grid cursor-pointer select-none',
          GRID,
          'items-center h-[44px] border-b border-[#f3f4f6] transition-colors',
          hasEnrolled
            ? 'border-l-[3px] border-l-green-600 bg-green-50/10 hover:bg-green-50/40'
            : 'border-l-[3px] border-l-transparent hover:bg-[#f9fafb]',
        ].join(' ')}
      >
        {/* Merchant + chevron + count badge */}
        <div className="px-2 min-w-0 flex items-center gap-2">
          <span
            className={[
              'text-[9px] text-gray-400 transition-transform duration-150 inline-block shrink-0',
              expanded ? 'rotate-90' : '',
            ].join(' ')}
            style={{ lineHeight: 1 }}
          >
            ▶
          </span>
          <p className="text-[14px] font-semibold text-gray-900 truncate leading-snug">{group.merchant}</p>
          {extra > 0 && (
            <span className="text-[10px] font-medium text-gray-400 shrink-0 bg-gray-100 rounded px-1.5 py-0.5 leading-none">
              +{extra}
            </span>
          )}
        </div>

        {/* Category chip */}
        <div className="flex justify-center px-1">
          <span className="text-[10px] font-medium border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 whitespace-nowrap leading-tight">
            {category.emoji} {category.label}
          </span>
        </div>

        {/* Best reward */}
        <div className="px-2 text-right">
          <span
            className={[
              'font-[var(--font-geist-mono)] text-[13px] font-bold tabular-nums',
              reward.isPoints ? 'text-blue-600' : 'text-green-700',
            ].join(' ')}
          >
            {reward.text}
          </span>
        </div>

        {/* Best min spend */}
        <div className="px-2 text-right">
          <span className="font-[var(--font-geist-mono)] text-[13px] text-gray-500 tabular-nums">
            {formatMinSpend(bestOffer.spend_min_cents)}
          </span>
        </div>

        {/* % Return of best offer */}
        <div className="px-2 text-right">
          {(() => {
            const pct = computeReturn(bestOffer)
            return pct !== null ? (
              <span className="font-[var(--font-geist-mono)] text-[13px] text-purple-700 font-semibold tabular-nums">
                {pct}%
              </span>
            ) : (
              <span className="font-[var(--font-geist-mono)] text-[13px] text-gray-300 tabular-nums">—</span>
            )
          })()}
        </div>

        {/* Earliest expiry across all offers in group */}
        <div className="px-2">
          {expiry ? (
            <span className={`text-[12px] tabular-nums ${expiry.urgent ? 'text-[#dc2626] font-bold' : 'text-gray-400'}`}>
              {expiry.text}
            </span>
          ) : (
            <span className="text-[12px] text-gray-300">—</span>
          )}
        </div>

        {/* Enrolled status */}
        <div className="flex justify-center">
          {hasEnrolled ? (
            <div className="flex items-center gap-1.5">
              <div className="w-[6px] h-[6px] rounded-full bg-green-500 shrink-0" />
              <span className="text-[11px] text-green-700 font-semibold">Enrolled</span>
            </div>
          ) : (
            <span className="text-[12px] text-gray-300">—</span>
          )}
        </div>

        {/* Enroll best offer */}
        <div className="px-2 flex justify-end">
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling}
            className={[
              'text-[12px] font-semibold transition-colors disabled:opacity-30',
              bestOffer.is_enrolled
                ? 'text-gray-400 hover:text-gray-700'
                : 'text-blue-600 hover:text-blue-800',
            ].join(' ')}
          >
            {enrolling ? '…' : bestOffer.is_enrolled ? 'Unenroll' : 'Enroll'}
          </button>
        </div>
      </div>

      {/* ── Mobile group header (<md) ── */}
      <div
        onClick={onToggle}
        className={[
          'md:hidden px-3 py-2.5 border-b border-[#f3f4f6] cursor-pointer select-none transition-colors',
          hasEnrolled
            ? 'border-l-[3px] border-l-green-600 bg-green-50/20'
            : 'border-l-[3px] border-l-transparent',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={[
                'text-[9px] text-gray-400 shrink-0 inline-block transition-transform duration-150',
                expanded ? 'rotate-90' : '',
              ].join(' ')}
              style={{ lineHeight: 1 }}
            >
              ▶
            </span>
            <p className="text-[14px] font-semibold text-gray-900 truncate">{group.merchant}</p>
            {extra > 0 && (
              <span className="text-[10px] text-gray-400 shrink-0 bg-gray-100 rounded px-1.5 py-0.5 leading-none">
                +{extra}
              </span>
            )}
          </div>
          <span
            className={[
              'font-[var(--font-geist-mono)] text-[14px] font-bold tabular-nums shrink-0',
              reward.isPoints ? 'text-blue-600' : 'text-green-700',
            ].join(' ')}
          >
            {reward.text}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5 ml-5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 leading-tight shrink-0">
              {category.emoji} {category.label}
            </span>
            {expiry && (
              <span className={`text-[12px] tabular-nums ${expiry.urgent ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                {expiry.text}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling}
            className={[
              'text-[13px] font-semibold transition-colors disabled:opacity-30 pl-3',
              bestOffer.is_enrolled
                ? 'text-gray-400 hover:text-gray-700'
                : 'text-blue-600 hover:text-blue-800',
            ].join(' ')}
          >
            {enrolling ? '…' : bestOffer.is_enrolled ? 'Unenroll' : 'Enroll'}
          </button>
        </div>
      </div>

      {/* ── Expanded sub-rows ── */}
      {expanded && offers.map((offer) => (
        <OfferRow key={offer.id} offer={offer} onToggle={onToggleEnroll} indent />
      ))}
    </>
  )
}

// ─── Sort pill button ─────────────────────────────────────────────────────────
function SortPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'text-[12px] font-medium px-2.5 py-1 rounded transition-colors',
        active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ─── Filter chip button ───────────────────────────────────────────────────────
function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'text-[12px] font-medium px-2.5 py-1 rounded transition-colors',
        active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// ─── Main OffersTable component ───────────────────────────────────────────────
export function OffersTable({ offers: initial, lastSyncedAt }: { offers: Offer[]; lastSyncedAt?: string | null }) {
  const [offers, setOffers] = useState(initial)
  const [sortBy, setSortBy] = useState<SortKey>('reward')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [rewardType, setRewardType] = useState<RewardType>('all')
  const [minReward, setMinReward] = useState<MinReward>('any')
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Initialize expanded groups with merchants that have enrolled offers
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(initial.filter((o) => o.is_enrolled).map((o) => o.merchant))
  )

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/offers/sync-now', { method: 'POST' })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  const toggleEnroll = useCallback(async (offerId: string) => {
    const res = await fetch('/api/offers/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offerId }),
    })
    const data = await res.json()
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, is_enrolled: data.enrolled } : o))
    )
    // Auto-expand group when enrolling so the user can see it
    if (data.enrolled) {
      const offer = offers.find((o) => o.id === offerId)
      if (offer) setExpandedGroups((prev) => new Set([...prev, offer.merchant]))
    }
  }, [offers])

  const uniqueCategories = useMemo(() => {
    const cats = new Set(offers.map((o) => getCategory(o.merchant).label).filter((c) => c !== 'Other'))
    return [...cats].sort()
  }, [offers])

  const enrolledCount = useMemo(() => offers.filter((o) => o.is_enrolled).length, [offers])
  const expiringSoonCount = useMemo(
    () => offers.filter((o) => isExpiringSoon(o.expiration_date)).length,
    [offers]
  )

  const filtered = useMemo(() => {
    let result = offers.filter((o) => !o.expiration_date || daysUntil(o.expiration_date) >= 0)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          o.merchant.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false)
      )
    }
    if (filterBy === 'enrolled') result = result.filter((o) => o.is_enrolled)
    else if (filterBy === 'expiring') result = result.filter((o) => isExpiringSoon(o.expiration_date))
    else if (filterBy !== 'all')
      result = result.filter((o) => getCategory(o.merchant).label === filterBy)

    if (rewardType !== 'all')
      result = result.filter((o) => o.reward_type === rewardType)

    if (minReward !== 'any') {
      const thresh = MIN_THRESHOLDS[minReward]
      result = result.filter((o) => {
        if (!o.reward_amount_cents) return false
        return o.reward_type === 'points'
          ? o.reward_amount_cents >= thresh.points
          : o.reward_amount_cents >= thresh.cash
      })
    }

    return result
  }, [offers, filterBy, rewardType, minReward, searchQuery])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'reward') return (b.reward_amount_cents ?? 0) - (a.reward_amount_cents ?? 0)
      if (sortBy === 'expiry') return compareExpiry(a, b)
      if (sortBy === 'return') {
        const aRet = computeReturn(a) ?? -1
        const bRet = computeReturn(b) ?? -1
        return bRet - aRet
      }
      return a.merchant.localeCompare(b.merchant)
    })
  }, [filtered, sortBy])

  // Enrolled filter → flat list. All other filters → grouped view.
  const useFlat = filterBy === 'enrolled'

  const groups = useMemo(() => {
    if (useFlat) return null
    return groupByMerchant(sorted)
  }, [sorted, useFlat])

  const enrolledGroups = useMemo(() => groups?.filter((g) => g.hasEnrolled) ?? [], [groups])
  const regularGroups = useMemo(() => groups?.filter((g) => !g.hasEnrolled) ?? [], [groups])

  function toggleGroup(merchant: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(merchant)) next.delete(merchant)
      else next.add(merchant)
      return next
    })
  }

  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-6 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Amex Offers</h1>
          <span className="text-[13px] text-gray-400">
            {!useFlat && groups
              ? `${groups.length.toLocaleString()} merchants · ${filtered.length.toLocaleString()} offers`
              : `${filtered.length.toLocaleString()} offers`}
            {` · ${enrolledCount} enrolled`}
            {lastSyncedAt && ` · synced ${formatRelativeTime(lastSyncedAt)}`}
          </span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-[12px] font-medium border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-1.5 mb-3">
        {/* Row 1: sort pills + status filters */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-0.5">
            <SortPill active={sortBy === 'reward'} onClick={() => setSortBy('reward')}>Reward ↓</SortPill>
            <SortPill active={sortBy === 'expiry'} onClick={() => setSortBy('expiry')}>Expiry ↑</SortPill>
            <SortPill active={sortBy === 'merchant'} onClick={() => setSortBy('merchant')}>A–Z</SortPill>
            <SortPill active={sortBy === 'return'} onClick={() => setSortBy('return')}>% Return ↓</SortPill>
          </div>
          <div className="flex gap-0.5">
            <FilterChip active={filterBy === 'all'} onClick={() => setFilterBy('all')}>All</FilterChip>
            <FilterChip active={filterBy === 'enrolled'} onClick={() => setFilterBy('enrolled')}>
              Enrolled ({enrolledCount})
            </FilterChip>
            <FilterChip active={filterBy === 'expiring'} onClick={() => setFilterBy('expiring')}>
              Expiring ({expiringSoonCount})
            </FilterChip>
          </div>
        </div>
        {/* Row 2: reward type + min threshold */}
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            <FilterChip active={rewardType === 'all'} onClick={() => setRewardType('all')}>All</FilterChip>
            <FilterChip active={rewardType === 'points'} onClick={() => setRewardType('points')}>Points</FilterChip>
            <FilterChip active={rewardType === 'cash'} onClick={() => setRewardType('cash')}>Cash</FilterChip>
          </div>
          <div className="h-3 w-px bg-gray-200 shrink-0" />
          <div className="flex gap-0.5">
            <FilterChip active={minReward === 'any'} onClick={() => setMinReward('any')}>Any</FilterChip>
            <FilterChip active={minReward === '5k'} onClick={() => setMinReward('5k')}>5k pts · $5+</FilterChip>
            <FilterChip active={minReward === '25k'} onClick={() => setMinReward('25k')}>25k pts · $25+</FilterChip>
          </div>
        </div>
        {/* Row 3: category chips — horizontally scrollable */}
        <div className="flex gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {uniqueCategories.map((cat) => (
            <FilterChip key={cat} active={filterBy === cat} onClick={() => setFilterBy(cat)}>
              {cat}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search merchants…"
          className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-2 pr-8 focus:outline-none focus:border-gray-400 placeholder-gray-300"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[16px] leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className={`hidden md:grid ${GRID} border-b border-gray-200 bg-[#fafafa] border-l-[3px] border-l-transparent`}>
          <ColHeader>Merchant</ColHeader>
          <ColHeader align="center">Category</ColHeader>
          <ColHeader align="right">Reward</ColHeader>
          <ColHeader align="right">Min Spend</ColHeader>
          <ColHeader align="right">% Return</ColHeader>
          <ColHeader>Expires</ColHeader>
          <ColHeader align="center">Status</ColHeader>
          <ColHeader align="right">Action</ColHeader>
        </div>

        {useFlat ? (
          // ── Flat enrolled list ──
          sorted.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-gray-400">No enrolled offers.</div>
          ) : (
            sorted.map((o) => <OfferRow key={o.id} offer={o} onToggle={toggleEnroll} />)
          )
        ) : (
          // ── Grouped view ──
          !groups || groups.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-gray-400">No offers match this filter.</div>
          ) : (
            <>
              {/* Enrolled merchants pinned at top */}
              {enrolledGroups.length > 0 && (
                <>
                  <GroupRow
                    label={`Enrolled · ${enrolledGroups.length} ${enrolledGroups.length === 1 ? 'merchant' : 'merchants'}`}
                  />
                  {enrolledGroups.map((group) => (
                    <MerchantGroupRow
                      key={group.merchant}
                      group={group}
                      expanded={expandedGroups.has(group.merchant)}
                      onToggle={() => toggleGroup(group.merchant)}
                      onToggleEnroll={toggleEnroll}
                    />
                  ))}
                </>
              )}

              {/* All other merchants */}
              {regularGroups.length > 0 && (
                <>
                  {enrolledGroups.length > 0 && (
                    <GroupRow label={`All · ${regularGroups.length} merchants`} />
                  )}
                  {regularGroups.map((group) => (
                    <MerchantGroupRow
                      key={group.merchant}
                      group={group}
                      expanded={expandedGroups.has(group.merchant)}
                      onToggle={() => toggleGroup(group.merchant)}
                      onToggleEnroll={toggleEnroll}
                    />
                  ))}
                </>
              )}
            </>
          )
        )}
      </div>

      {/* ── Footer ── */}
      <div className="mt-3 text-center text-[12px] text-gray-400">
        {useFlat
          ? `${sorted.length.toLocaleString()} enrolled offers`
          : `${groups?.length.toLocaleString()} merchants · ${filtered.length.toLocaleString()} offers total`}
      </div>
    </div>
  )
}
