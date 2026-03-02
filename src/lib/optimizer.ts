export type EarnType = 'multiplier' | 'cashback' | 'percent'

type Category = {
  category_name: string
  earn_rate: number
  earn_type: EarnType
  notes: string | null
}

type Card = {
  id: string
  name: string
  reward_currency: string
  color?: string
  card_categories: Category[]
}

export type OtherCategory = {
  category_name: string
  earn_rate: number
  earn_type: EarnType
  effective_cpd: number
  notes: string | null
}

export type MatchReason = 'alias' | 'exact' | 'substring' | 'fuzzy' | 'fallback'

export type CardResult = {
  card: Card
  earn_rate: number
  earn_type: EarnType
  effective_cpd: number
  category_matched: string
  match_reason: MatchReason
  notes: string | null
  other_categories: OtherCategory[]
}

// ─── Points valuation (cents per point/mile) ──────────────────────────────────

// Industry-standard redemption valuations
const CPP: Record<string, number> = {
  'MR':        2.0,   // Amex Membership Rewards
  'Miles':     1.4,   // Alaska miles
  'Cash Back': 1.0,   // Cashback (1¢ per cent)
}

// Returns effective cents per dollar spent
function effectiveCPD(earn_rate: number, earn_type: EarnType, reward_currency: string): number {
  if (earn_type === 'multiplier') {
    const cpp = CPP[reward_currency] ?? 1.0
    return earn_rate * cpp
  }
  // percent / cashback: earn_rate is already in percent (e.g. 3 = 3%)
  return earn_rate
}

// ─── Merchant alias map ───────────────────────────────────────────────────────

const MERCHANT_ALIASES: Record<string, string> = {
  // Rideshare
  uber: 'rideshare',
  lyft: 'rideshare',
  'uber eats': 'rideshare',
  'lyft pink': 'rideshare',
  // Flights
  delta: 'flights',
  united: 'flights',
  american: 'flights',
  'american airlines': 'flights',
  southwest: 'flights',
  jetblue: 'flights',
  frontier: 'flights',
  'spirit airlines': 'flights',
  spirit: 'flights',
  hawaiian: 'flights',
  'hawaiian airlines': 'flights',
  // Alaska Airlines
  alaska: 'alaska_airlines',
  'alaska airlines': 'alaska_airlines',
  'alaska air': 'alaska_airlines',
  // Prepaid Hotels (AmexTravel.com)
  marriott: 'prepaid_hotels',
  hilton: 'prepaid_hotels',
  hyatt: 'prepaid_hotels',
  ihg: 'prepaid_hotels',
  airbnb: 'prepaid_hotels',
  'four seasons': 'prepaid_hotels',
  westin: 'prepaid_hotels',
  sheraton: 'prepaid_hotels',
  'w hotels': 'prepaid_hotels',
  ritz: 'prepaid_hotels',
  'ritz carlton': 'prepaid_hotels',
  intercontinental: 'prepaid_hotels',
  // Grocery
  'whole foods': 'grocery',
  safeway: 'grocery',
  kroger: 'grocery',
  albertsons: 'grocery',
  "trader joe's": 'grocery',
  'trader joes': 'grocery',
  sprouts: 'grocery',
  aldi: 'grocery',
  publix: 'grocery',
  heb: 'grocery',
  meijer: 'grocery',
  wegmans: 'grocery',
  'stop & shop': 'grocery',
  'stop and shop': 'grocery',
  'harris teeter': 'grocery',
  vons: 'grocery',
  ralphs: 'grocery',
  // Wholesale Clubs
  costco: 'wholesale_clubs',
  "sam's club": 'wholesale_clubs',
  'sams club': 'wholesale_clubs',
  "bj's": 'wholesale_clubs',
  'bjs wholesale': 'wholesale_clubs',
  'bj wholesale': 'wholesale_clubs',
  // Streaming
  netflix: 'streaming',
  spotify: 'streaming',
  hulu: 'streaming',
  'disney+': 'streaming',
  'disney plus': 'streaming',
  'apple tv+': 'streaming',
  'apple tv': 'streaming',
  'hbo max': 'streaming',
  max: 'streaming',
  peacock: 'streaming',
  'paramount+': 'streaming',
  'paramount plus': 'streaming',
  'youtube premium': 'streaming',
  'amazon prime video': 'streaming',
  // Restaurants
  'door dash': 'restaurants',
  doordash: 'restaurants',
  grubhub: 'restaurants',
  'instacart dine': 'restaurants',
  // Home Improvement
  'home depot': 'home_improvement',
  "lowe's": 'home_improvement',
  lowes: 'home_improvement',
  menards: 'home_improvement',
  'ace hardware': 'home_improvement',
  'true value': 'home_improvement',
  'floor & decor': 'home_improvement',
  // Utilities
  'pg&e': 'utilities',
  'con ed': 'utilities',
  'con edison': 'utilities',
  'pacific gas': 'utilities',
  // Amazon
  amazon: 'amazon',
  'amazon.com': 'amazon',
  'amazon fresh': 'amazon',
  'amazon prime': 'amazon',
  // Drugstores
  walgreens: 'drugstores',
  cvs: 'drugstores',
  'rite aid': 'drugstores',
  'duane reade': 'drugstores',
  'boots pharmacy': 'drugstores',
  // Gas
  chevron: 'gas',
  shell: 'gas',
  exxon: 'gas',
  mobil: 'gas',
  arco: 'gas',
  bp: 'gas',
  '76': 'gas',
  texaco: 'gas',
  sunoco: 'gas',
  marathon: 'gas',
  'circle k': 'gas',
  wawa: 'gas',
  // Transit
  amtrak: 'transit',
  bart: 'transit',
  muni: 'transit',
  metro: 'transit',
  caltrain: 'transit',
  mta: 'transit',
  // EV Charging
  tesla: 'ev_charging',
  'tesla supercharger': 'ev_charging',
  blink: 'ev_charging',
  chargepoint: 'ev_charging',
  electrify: 'ev_charging',
  evgo: 'ev_charging',
}

// ─── Fuzzy helpers ────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function strSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen
}

function bestFuzzyAlias(query: string): string | null {
  let bestCat: string | null = null
  let bestScore = 0
  for (const [alias, category] of Object.entries(MERCHANT_ALIASES)) {
    const score = strSimilarity(query, alias)
    if (score >= 0.75 && score > bestScore) {
      bestScore = score
      bestCat = category
    }
  }
  return bestCat
}

function bestFuzzyCategory(query: string, knownCategories: string[]): string | null {
  let bestCat: string | null = null
  let bestScore = 0
  for (const cat of knownCategories) {
    if (cat === 'everything_else') continue
    const score = strSimilarity(query, cat.replace(/_/g, ' '))
    if (score >= 0.7 && score > bestScore) {
      bestScore = score
      bestCat = cat
    }
  }
  return bestCat
}

// ─── Category resolution ─────────────────────────────────────────────────────

export function resolveCategory(
  query: string,
  knownCategories: string[]
): { category: string; reason: MatchReason } {
  const normalized = query.toLowerCase().trim()
  const readable = normalized.replace(/_/g, ' ')

  // 1. Exact alias match
  if (MERCHANT_ALIASES[normalized]) {
    return { category: MERCHANT_ALIASES[normalized], reason: 'alias' }
  }

  // 2. Exact category match
  const exact = knownCategories.find(
    (c) => c !== 'everything_else' && c.replace(/_/g, ' ') === readable
  )
  if (exact) return { category: exact, reason: 'exact' }

  // 3. Substring match — longest wins
  const subs = knownCategories
    .filter((c) => {
      if (c === 'everything_else') return false
      const cn = c.replace(/_/g, ' ')
      return cn.includes(readable) || readable.includes(cn)
    })
    .sort((a, b) => b.length - a.length)
  if (subs[0]) return { category: subs[0], reason: 'substring' }

  // 4. Fuzzy match on alias keys
  const fa = bestFuzzyAlias(normalized)
  if (fa) return { category: fa, reason: 'fuzzy' }

  // 5. Fuzzy match on category names
  const fc = bestFuzzyCategory(readable, knownCategories)
  if (fc) return { category: fc, reason: 'fuzzy' }

  return { category: 'everything_else', reason: 'fallback' }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function getCardResults(query: string, cards: Card[]): CardResult[] {
  const allCategories = [
    ...new Set(cards.flatMap((c) => c.card_categories.map((cc) => cc.category_name))),
  ]

  const { category: resolved, reason } = resolveCategory(query, allCategories)

  return cards
    .map((card) => {
      const matched =
        card.card_categories.find((c) => c.category_name === resolved) ??
        card.card_categories.find((c) => c.category_name === 'everything_else')

      if (!matched) return null

      const other_categories = card.card_categories
        .filter((c) => c.category_name !== matched.category_name)
        .map((c) => ({
          category_name: c.category_name,
          earn_rate: c.earn_rate,
          earn_type: c.earn_type,
          effective_cpd: effectiveCPD(c.earn_rate, c.earn_type, card.reward_currency),
          notes: c.notes,
        }))
        .sort((a, b) => b.effective_cpd - a.effective_cpd)

      return {
        card,
        earn_rate: matched.earn_rate,
        earn_type: matched.earn_type,
        effective_cpd: effectiveCPD(matched.earn_rate, matched.earn_type, card.reward_currency),
        category_matched: matched.category_name,
        match_reason: reason,
        notes: matched.notes,
        other_categories,
      }
    })
    .filter((r): r is CardResult => r !== null)
    .sort((a, b) => b.effective_cpd - a.effective_cpd)
}

export { getCardResults as getBestCard }
