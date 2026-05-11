export type SeedEvent = {
  brand_name: string
  date: string
  event_name: string | null
  region: string | null
  campaign_name: string | null
  status: string | null
  type: string | null
  incentive: string | null
}

// ~20 events per brand, Jan–Dec spread, all types & statuses
export const CALENDAR_EVENTS: SeedEvent[] = [
  // ── Haverford AUS ────────────────────────────────────────────────
  { brand_name: 'Haverford AUS', date: '2026-01-05', event_name: "New Year's Week", region: 'AU', campaign_name: 'New Year, New Course — Golf Gear Refresh', status: 'Scheduled', type: 'Sale or Promotion', incentive: '15% off first order' },
  { brand_name: 'Haverford AUS', date: '2026-01-20', event_name: 'Australia Day', region: 'AU', campaign_name: 'Australia Day Course Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free shipping on orders $150+' },
  { brand_name: 'Haverford AUS', date: '2026-02-10', event_name: null, region: 'AU', campaign_name: 'Bird Netting Season Prep', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-02-28', event_name: null, region: 'AU', campaign_name: 'Autumn Golf Tips & Gear Guide', status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-03-15', event_name: 'Labour Day VIC', region: 'VIC', campaign_name: 'Labour Day Long Weekend Golf Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '20% off range accessories' },
  { brand_name: 'Haverford AUS', date: '2026-03-29', event_name: 'Easter', region: 'AU', campaign_name: 'Easter Cricket & Golf Bundle', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Buy 2 get 1 free' },
  { brand_name: 'Haverford AUS', date: '2026-04-18', event_name: null, region: 'AU', campaign_name: 'Shade Sails — Before Winter Campaign', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-05-10', event_name: "Mother's Day", region: 'AU', campaign_name: "Mother's Day Gift Guide — Outdoor Living", status: 'Scheduled', type: 'Brand Recall & Engagement', incentive: 'Gift wrapping included' },
  { brand_name: 'Haverford AUS', date: '2026-06-01', event_name: 'End of Financial Year', region: 'AU', campaign_name: 'EOFY Clearance — Custom Netting & Shade', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Up to 30% off EOFY deals' },
  { brand_name: 'Haverford AUS', date: '2026-06-20', event_name: null, region: 'AU', campaign_name: 'Winter Golf Range Maintenance Tips', status: 'Idea', type: 'Value or Content', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-07-14', event_name: null, region: 'AU', campaign_name: 'Mid-Year Netting Installation Guide', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-08-03', event_name: null, region: 'AU', campaign_name: 'Spring Prep — Bird & Shade Netting', status: 'Idea', type: 'Value or Content', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-09-07', event_name: 'Father\'s Day', region: 'AU', campaign_name: "Father's Day Golf Gift Pack", status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free tee set with orders $100+' },
  { brand_name: 'Haverford AUS', date: '2026-09-22', event_name: 'Spring Equinox', region: 'AU', campaign_name: 'Spring Season Cricket Launch', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-10-05', event_name: null, region: 'AU', campaign_name: 'Custom Netting — Spring Projects', status: 'Idea', type: 'Value or Content', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-10-26', event_name: 'Labour Day NSW', region: 'NSW', campaign_name: 'Long Weekend Golf Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '$25 off orders $200+' },
  { brand_name: 'Haverford AUS', date: '2026-11-11', event_name: 'Click Frenzy', region: 'AU', campaign_name: 'Click Frenzy — Golf & Cricket Clearance', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Flash deals every hour' },
  { brand_name: 'Haverford AUS', date: '2026-11-27', event_name: 'Black Friday', region: 'AU', campaign_name: 'Black Friday Golf & Netting Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '25% off sitewide' },
  { brand_name: 'Haverford AUS', date: '2026-12-01', event_name: null, region: 'AU', campaign_name: 'Christmas Gift Guide — Golf & Outdoors', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Haverford AUS', date: '2026-12-22', event_name: 'Christmas Week', region: 'AU', campaign_name: 'Christmas Last Chance Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free gift wrap + express shipping' },

  // ── Just Pro Tools ───────────────────────────────────────────────
  { brand_name: 'Just Pro Tools', date: '2026-01-07', event_name: "New Year's Week", region: 'AU', campaign_name: 'New Year Tradie Refresh — Storage & Cabinets', status: 'Scheduled', type: 'Sale or Promotion', incentive: '10% off first order' },
  { brand_name: 'Just Pro Tools', date: '2026-01-22', event_name: 'Australia Day', region: 'AU', campaign_name: 'Australia Day Tool Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free shipping on orders $200+' },
  { brand_name: 'Just Pro Tools', date: '2026-02-09', event_name: null, region: 'AU', campaign_name: 'Tradie Workshop Setup Guide', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-02-23', event_name: null, region: 'AU', campaign_name: 'Tool Cabinet Range Launch', status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-03-16', event_name: 'Labour Day VIC', region: 'VIC', campaign_name: 'Long Weekend Tool Sale — VIC', status: 'Scheduled', type: 'Sale or Promotion', incentive: '15% off selected ranges' },
  { brand_name: 'Just Pro Tools', date: '2026-03-30', event_name: 'Easter', region: 'AU', campaign_name: 'Easter Workshop Gear Bundle', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Bundle & save 20%' },
  { brand_name: 'Just Pro Tools', date: '2026-04-20', event_name: null, region: 'AU', campaign_name: 'Autumn Tool Storage Tips', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-05-11', event_name: "Mother's Day", region: 'AU', campaign_name: "Mother's Day — Tools for the Home", status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-06-02', event_name: 'End of Financial Year', region: 'AU', campaign_name: 'EOFY Tax Write-off Tool Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Instant asset write-off eligible' },
  { brand_name: 'Just Pro Tools', date: '2026-06-22', event_name: null, region: 'AU', campaign_name: 'Winter Workshop Organisation Series', status: 'Idea', type: 'Value or Content', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-07-15', event_name: null, region: 'AU', campaign_name: 'Mid-Year Cabinet Clearance', status: 'Scheduled', type: 'Sale or Promotion', incentive: '$50 off display units' },
  { brand_name: 'Just Pro Tools', date: '2026-08-04', event_name: null, region: 'AU', campaign_name: 'Spring Tradie Prep — Stock Up Sale', status: 'Drafted', type: 'Sale or Promotion', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-09-08', event_name: 'Father\'s Day', region: 'AU', campaign_name: "Father's Day — Pro Tool Gift Pack", status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free carry bag with $150+ orders' },
  { brand_name: 'Just Pro Tools', date: '2026-09-21', event_name: null, region: 'AU', campaign_name: 'Tool Range Spotlight — New Arrivals', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-10-06', event_name: null, region: 'AU', campaign_name: 'Workshop of the Month Feature', status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-10-27', event_name: 'Labour Day NSW', region: 'NSW', campaign_name: 'NSW Long Weekend Tool Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '$30 off orders $250+' },
  { brand_name: 'Just Pro Tools', date: '2026-11-12', event_name: 'Click Frenzy', region: 'AU', campaign_name: 'Click Frenzy — Tool Storage Deals', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Hourly flash deals' },
  { brand_name: 'Just Pro Tools', date: '2026-11-28', event_name: 'Black Friday', region: 'AU', campaign_name: 'Black Friday Cabinet & Storage Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Up to 30% off sitewide' },
  { brand_name: 'Just Pro Tools', date: '2026-12-03', event_name: null, region: 'AU', campaign_name: 'Christmas Tradie Gift Guide', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Just Pro Tools', date: '2026-12-21', event_name: 'Christmas Week', region: 'AU', campaign_name: 'Christmas Last Orders — Tool Gifts', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free next-day delivery' },

  // ── Catnets ──────────────────────────────────────────────────────
  { brand_name: 'Catnets', date: '2026-01-06', event_name: "New Year's Week", region: 'AU', campaign_name: 'New Year, New Enclosure — Catnets 2026', status: 'Scheduled', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Catnets', date: '2026-01-21', event_name: 'Australia Day', region: 'AU', campaign_name: 'Australia Day Cat-Safety Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '10% off all enclosures' },
  { brand_name: 'Catnets', date: '2026-02-08', event_name: null, region: 'AU', campaign_name: 'Fenceline Protector — Installation Guide', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Catnets', date: '2026-02-24', event_name: null, region: 'AU', campaign_name: 'Cat Enclosure Buyer\'s Guide 2026', status: 'Idea', type: 'Value or Content', incentive: null },
  { brand_name: 'Catnets', date: '2026-03-17', event_name: 'Labour Day VIC', region: 'VIC', campaign_name: 'Labour Day — Catio Build Weekend', status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Catnets', date: '2026-03-31', event_name: 'Easter', region: 'AU', campaign_name: 'Easter Havapet Bundle Deal', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Buy 1 get 1 50% off accessories' },
  { brand_name: 'Catnets', date: '2026-04-19', event_name: null, region: 'AU', campaign_name: 'Skywalk Installation Tips — Autumn Edition', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Catnets', date: '2026-05-12', event_name: "Mother's Day", region: 'AU', campaign_name: "Mother's Day — Gift a Catio for Your Cat Mum", status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free accessory pack' },
  { brand_name: 'Catnets', date: '2026-06-03', event_name: 'End of Financial Year', region: 'AU', campaign_name: 'EOFY — Enclosure Clearance', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Up to 25% off selected products' },
  { brand_name: 'Catnets', date: '2026-06-23', event_name: null, region: 'AU', campaign_name: 'Winter Cat Safety Tips', status: 'Idea', type: 'Value or Content', incentive: null },
  { brand_name: 'Catnets', date: '2026-07-16', event_name: null, region: 'AU', campaign_name: 'Mid-Year Skywalk Spotlight', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Catnets', date: '2026-08-08', event_name: 'International Cat Day', region: 'AU', campaign_name: 'International Cat Day — Celebrate with Catnets', status: 'Scheduled', type: 'Brand Recall & Engagement', incentive: 'Free cat toy with $100+ orders' },
  { brand_name: 'Catnets', date: '2026-09-09', event_name: 'Father\'s Day', region: 'AU', campaign_name: "Father's Day — Build a Catio Together", status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Catnets', date: '2026-09-23', event_name: null, region: 'AU', campaign_name: 'Spring Enclosure Setup — New Season Guide', status: 'Scheduled', type: 'Value or Content', incentive: null },
  { brand_name: 'Catnets', date: '2026-10-07', event_name: null, region: 'AU', campaign_name: 'Havapet Range — New Products Reveal', status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Catnets', date: '2026-10-28', event_name: 'Labour Day NSW', region: 'NSW', campaign_name: 'Long Weekend DIY Catio Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '$20 off orders $120+' },
  { brand_name: 'Catnets', date: '2026-11-13', event_name: 'Click Frenzy', region: 'AU', campaign_name: 'Click Frenzy — Catnets Enclosure Deals', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Up to 20% off sitewide' },
  { brand_name: 'Catnets', date: '2026-11-29', event_name: 'Black Friday', region: 'AU', campaign_name: 'Black Friday Catio & Skywalk Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '20% off all enclosures' },
  { brand_name: 'Catnets', date: '2026-12-04', event_name: null, region: 'AU', campaign_name: 'Christmas Gift Guide — Cat Lovers', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Catnets', date: '2026-12-23', event_name: 'Christmas Week', region: 'AU', campaign_name: 'Christmas — Last Chance Havapet Gifts', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free gift wrapping' },

  // ── Aussie Grazers ───────────────────────────────────────────────
  { brand_name: 'Aussie Grazers', date: '2026-01-08', event_name: "New Year's Week", region: 'AU', campaign_name: 'New Year Farm Planning — Grazing Gear', status: 'Scheduled', type: 'Value or Content', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-01-23', event_name: 'Australia Day', region: 'AU', campaign_name: 'Australia Day — Celebrate the Land', status: 'Scheduled', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-02-11', event_name: null, region: 'AU', campaign_name: 'Summer Grazing Management Tips', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-02-25', event_name: null, region: 'AU', campaign_name: 'Rotational Grazing Product Spotlight', status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-03-18', event_name: 'Labour Day VIC', region: 'VIC', campaign_name: 'Autumn Farm Prep Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free delivery on fencing orders' },
  { brand_name: 'Aussie Grazers', date: '2026-04-01', event_name: 'Easter', region: 'AU', campaign_name: 'Easter — Pastoral Gear Bundle', status: 'Scheduled', type: 'Sale or Promotion', incentive: '15% off livestock equipment' },
  { brand_name: 'Aussie Grazers', date: '2026-04-21', event_name: null, region: 'AU', campaign_name: 'Autumn Pasture Recovery Guide', status: 'Drafted', type: 'Value or Content', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-05-13', event_name: "Mother's Day", region: 'AU', campaign_name: "Mother's Day — Farm Life Celebration", status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-06-04', event_name: 'End of Financial Year', region: 'AU', campaign_name: 'EOFY Farm Equipment Tax Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Eligible for instant asset write-off' },
  { brand_name: 'Aussie Grazers', date: '2026-06-24', event_name: null, region: 'AU', campaign_name: 'Winter Livestock Care Series', status: 'Idea', type: 'Value or Content', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-07-17', event_name: null, region: 'AU', campaign_name: 'Mid-Winter Grazing Solutions', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-08-05', event_name: null, region: 'AU', campaign_name: 'Spring Pasture Preparation Guide', status: 'Scheduled', type: 'Value or Content', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-09-10', event_name: 'Father\'s Day', region: 'AU', campaign_name: "Father's Day — Farmer Gift Ideas", status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free branded hat with $300+ orders' },
  { brand_name: 'Aussie Grazers', date: '2026-09-24', event_name: 'Spring Equinox', region: 'AU', campaign_name: 'Spring Stocking Rate Planning Webinar', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-10-08', event_name: null, region: 'AU', campaign_name: 'New Season Grazing Product Drop', status: 'Idea', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-10-29', event_name: 'Labour Day NSW', region: 'NSW', campaign_name: 'NSW Long Weekend Farm Sale', status: 'Scheduled', type: 'Sale or Promotion', incentive: '$40 off orders $400+' },
  { brand_name: 'Aussie Grazers', date: '2026-11-14', event_name: 'Click Frenzy', region: 'AU', campaign_name: 'Click Frenzy — Grazing & Fencing Deals', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Sitewide flash sale' },
  { brand_name: 'Aussie Grazers', date: '2026-11-30', event_name: 'Black Friday', region: 'AU', campaign_name: 'Black Friday — Farm Gear Blowout', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Up to 25% off' },
  { brand_name: 'Aussie Grazers', date: '2026-12-05', event_name: null, region: 'AU', campaign_name: 'Christmas Gift Ideas for Farmers', status: 'Drafted', type: 'Brand Recall & Engagement', incentive: null },
  { brand_name: 'Aussie Grazers', date: '2026-12-24', event_name: 'Christmas Week', region: 'AU', campaign_name: 'Christmas Eve — Last Farm Orders', status: 'Scheduled', type: 'Sale or Promotion', incentive: 'Free express shipping' },
]
