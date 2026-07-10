export type BenefitPriority = 'core' | 'good-fit' | 'optional' | 'skip'

export type BenefitGuidance = {
  priority: BenefitPriority
  label: string
  score: number
  action: string
  reason: string
  naturalSpend: boolean
}

const GUIDANCE: Array<{ match: RegExp; guidance: BenefitGuidance }> = [
  {
    match: /hotel/i,
    guidance: {
      priority: 'core',
      label: 'Highest value if traveling',
      score: 100,
      action: 'Use on a trip you already plan to take',
      reason: 'Large credit, but only valuable when the travel is already happening.',
      naturalSpend: true,
    },
  },
  {
    match: /digital entertainment|streaming/i,
    guidance: {
      priority: 'core',
      label: 'Easy recurring win',
      score: 95,
      action: 'Put eligible subscriptions on this card',
      reason: 'The credit can replace bills you already pay instead of creating new spend.',
      naturalSpend: true,
    },
  },
  {
    match: /resy/i,
    guidance: {
      priority: 'core',
      label: 'Good fit for planned dining',
      score: 90,
      action: 'Use for restaurants you would choose anyway',
      reason: 'High recurring value when it offsets normal dining, not an excuse to add dinners.',
      naturalSpend: true,
    },
  },
  {
    match: /uber cash/i,
    guidance: {
      priority: 'good-fit',
      label: 'Useful if you already use Uber',
      score: 80,
      action: 'Add the card to Uber and let the monthly credit apply',
      reason: 'Worth capturing for rides or food you would already buy.',
      naturalSpend: true,
    },
  },
  {
    match: /airline/i,
    guidance: {
      priority: 'good-fit',
      label: 'Easy travel offset',
      score: 78,
      action: 'Choose your airline and use it for incidental fees',
      reason: 'A reliable credit when you have an airline expense; do not buy extras just to trigger it.',
      naturalSpend: true,
    },
  },
  {
    match: /global entry|tsa/i,
    guidance: {
      priority: 'good-fit',
      label: 'Set-and-forget travel value',
      score: 75,
      action: 'Use when your next renewal comes due',
      reason: 'A strong four-year benefit if you or a family member needs it.',
      naturalSpend: true,
    },
  },
  {
    match: /clear/i,
    guidance: {
      priority: 'good-fit',
      label: 'Only if you use CLEAR',
      score: 65,
      action: 'Keep it only if the airport time savings matter to you',
      reason: 'Good offset for an existing membership; not worth changing your airport routine for.',
      naturalSpend: true,
    },
  },
  {
    match: /walmart/i,
    guidance: {
      priority: 'good-fit',
      label: 'Good if you already subscribe',
      score: 60,
      action: 'Use it for an existing Walmart+ membership',
      reason: 'A clean offset when it replaces a membership you already want.',
      naturalSpend: true,
    },
  },
  {
    match: /lulu|saks/i,
    guidance: {
      priority: 'optional',
      label: 'Use only for planned purchases',
      score: 35,
      action: 'Ignore unless you already have a purchase in mind',
      reason: 'The credit is not savings if it causes a shopping trip you would not otherwise make.',
      naturalSpend: false,
    },
  },
  {
    match: /dell|hp|raymour|oura|equinox|soulcycle|shopping/i,
    guidance: {
      priority: 'skip',
      label: 'Do not manufacture spending',
      score: 10,
      action: 'Skip unless this is already in your budget',
      reason: 'Buying something to unlock a discount does not pay down the annual fee.',
      naturalSpend: false,
    },
  },
]

const DEFAULT_GUIDANCE: BenefitGuidance = {
  priority: 'optional',
  label: 'Review for fit',
  score: 40,
  action: 'Use only when it replaces normal spending',
  reason: 'Treat the headline amount as a ceiling, not guaranteed value.',
  naturalSpend: false,
}

export function getBenefitGuidance(name: string): BenefitGuidance {
  return GUIDANCE.find(({ match }) => match.test(name))?.guidance ?? DEFAULT_GUIDANCE
}

export function sortByBenefitValue<T extends { name: string }>(benefits: T[]): T[] {
  return [...benefits].sort((a, b) => getBenefitGuidance(b.name).score - getBenefitGuidance(a.name).score)
}

export const ANNUAL_FEE_CENTS = 89500
