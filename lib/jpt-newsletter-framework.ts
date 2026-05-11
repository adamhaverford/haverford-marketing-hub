export const JPT_MONTHLY_THEMES: Record<string, {
  theme: string
  heroSuggestion: string
  crossSellFocus: string
  tipSuggestion: string
  subjectLineExample: string
}> = {
  '2026-05': {
    theme: 'Winter Workshop Kickoff',
    heroSuggestion: 'Customer feature: winter garage project',
    crossSellFocus: 'Workbenches + pegboards',
    tipSuggestion: 'How to plan your garage layout',
    subjectLineExample: 'Matt from Penrith built this garage setup in a weekend',
  },
  '2026-06': {
    theme: 'Mid-Winter Build',
    heroSuggestion: 'Product spotlight: HD Storage Systems',
    crossSellFocus: 'Cabinet systems + mounting kits',
    tipSuggestion: 'Pegboard installation on plaster walls',
    subjectLineExample: 'The garage storage system Brisbane builders are choosing',
  },
  '2026-07': {
    theme: 'Workshop Transformation',
    heroSuggestion: 'Before/after customer feature',
    crossSellFocus: 'Roll cabinets + stainless tops',
    tipSuggestion: 'Choosing the right toolbox height',
    subjectLineExample: '[Customer] transformed his garage in a weekend',
  },
  '2026-08': {
    theme: "Father's Day Prep",
    heroSuggestion: "Gift guide: bundles under $500/$1K/$2K",
    crossSellFocus: 'Starter kits + socket organisers',
    tipSuggestion: 'Top 5 gifts for the workshop dad',
    subjectLineExample: "The workshop gift he actually wants this Father's Day",
  },
  '2026-09': {
    theme: "Father's Day + Spring Clean",
    heroSuggestion: "Customer spotlight: 'My dad's new setup'",
    crossSellFocus: 'Service carts + tool trays',
    tipSuggestion: 'Spring clean your toolbox: maintenance tips',
    subjectLineExample: "Dad's new workshop — built with Maxim",
  },
  '2026-10': {
    theme: 'Trade & Apprentice Focus',
    heroSuggestion: 'Apprentice kit launch / trade pricing',
    crossSellFocus: '42" roll cabinets + Stealth trays',
    tipSuggestion: 'Setting up your first workshop',
    subjectLineExample: 'Your first real workshop setup — start here',
  },
  '2026-11': {
    theme: 'Black Friday Lead-Up',
    heroSuggestion: 'Early access / VIP preview',
    crossSellFocus: 'Pro Series combos + bundles',
    tipSuggestion: 'Maximising drawer space with organisers',
    subjectLineExample: 'Early access: our biggest sale of the year starts soon',
  },
  '2026-12': {
    theme: 'Black Friday / Christmas',
    heroSuggestion: 'Biggest deals of the year',
    crossSellFocus: 'Gift cards + top sellers',
    tipSuggestion: 'Year in review: customer workshop gallery',
    subjectLineExample: "The workshop upgrade he's been waiting for",
  },
  '2027-01': {
    theme: 'New Year, New Workshop',
    heroSuggestion: 'Resolution content: transformation stories',
    crossSellFocus: 'Full garage systems',
    tipSuggestion: 'New year garage reset checklist',
    subjectLineExample: 'New year. New workshop. Start here.',
  },
  '2027-02': {
    theme: 'Back to Work',
    heroSuggestion: 'Trade/workshop content',
    crossSellFocus: 'Heavy-duty carts + benches',
    tipSuggestion: 'Tool organisation for trade vehicles',
    subjectLineExample: 'The trade setup that gets you sorted faster',
  },
  '2027-03': {
    theme: 'Autumn Prep',
    heroSuggestion: 'New product announcement',
    crossSellFocus: 'Pegboard kits + accessories',
    tipSuggestion: 'Protecting your toolbox finish long-term',
    subjectLineExample: 'New in: the product your workshop has been missing',
  },
  '2027-04': {
    theme: 'EOFY Lead-Up',
    heroSuggestion: 'Tax-time business purchase messaging',
    crossSellFocus: 'Full system bundles',
    tipSuggestion: 'Claiming workshop equipment at tax time',
    subjectLineExample: 'EOFY: claim your workshop upgrade before June 30',
  },
}

export const JPT_COPY_TIPS = {
  voice: [
    'Write like a knowledgeable mate, not a corporate brand',
    'Short sentences. No waffle.',
    'Lead with customer evidence wherever possible',
    'Specific details beat generic claims — dimensions, materials, real features',
  ],
  languageToUse: ['Heavy-duty', 'Solid', 'Built to last', 'Sorted', 'Workshop-ready', 'Real workshops', 'Priced right'],
  languageToAvoid: ['Revolutionary', 'World-class', 'Premium luxury', 'Game-changer', 'Unmatched', 'Perfect'],
  subjectLineTest: "Would I open this from a mate? If it sounds like a person wrote it, it'll get opened.",
}

export const JPT_HERO_TEMPLATES = {
  customer_feature: {
    headlineSuggestion: 'Real Workshop. Real Maxim.',
    bodyTemplate: "[Customer name] upgraded his garage with the Maxim [product]. '[Short review quote].' See what [name] built — and plan your own workshop upgrade.",
    ctaSuggestion: 'See the Setup →',
    imageTip: 'Use a photo review from Judge.me — real garages outperform studio shots',
  },
  seasonal_campaign: {
    headlineSuggestion: "This [Season], Build the Workshop You've Been Planning.",
    bodyTemplate: '[Season context]. [Long weekend/occasion hook]. Maxim Pro Series — heavy-duty quality, easy assembly, free metro shipping on orders over $1,500. 298 five-star reviews.',
    ctaSuggestion: 'Shop Workshop Storage →',
    imageTip: 'Lifestyle shot of a workshop setup — no white backgrounds',
  },
  product_launch: {
    headlineSuggestion: 'Meet the [Product Name].',
    bodyTemplate: '[What it is and why it matters — specific dimensions and features]. [How it connects to the existing range]. Available now with free metro shipping.',
    ctaSuggestion: 'Shop Now →',
    imageTip: 'Product in a workshop context — not on a white background',
  },
}
