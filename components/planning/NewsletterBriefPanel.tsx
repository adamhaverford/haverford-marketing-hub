'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Sparkles, CheckCircle, Send, Plus, Trash2, Copy, Check } from 'lucide-react'
import {
  getNewsletterBrief,
  upsertNewsletterBrief,
  NewsletterBrief,
  CrossSellProduct,
} from '@/lib/actions/newsletter-brief'
import { JPT_MONTHLY_THEMES, JPT_COPY_TIPS, JPT_HERO_TEMPLATES } from '@/lib/jpt-newsletter-framework'

interface Props {
  brandId: string
  month: string
  role: 'marketing' | 'stakeholder'
}

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-500',
  ready: 'bg-green-100 text-green-700',
  sent:  'bg-blue-100 text-blue-700',
}

const SECTIONS = [
  { id: 'subject',   label: 'Subject Line' },
  { id: 'hero',      label: '1. Hero' },
  { id: 'crosssell', label: '2. Cross-Sell' },
  { id: 'tip',       label: '3. Workshop Tip' },
  { id: 'spotlight', label: '4. Spotlight' },
] as const

type SectionId = typeof SECTIONS[number]['id']

export default function NewsletterBriefPanel({ brandId, month }: Props) {
  const [brief, setBrief] = useState<NewsletterBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>('subject')
  const [copiedBrief, setCopiedBrief] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const briefRef = useRef<NewsletterBrief | null>(null)

  const theme = JPT_MONTHLY_THEMES[month] ?? null

  useEffect(() => {
    getNewsletterBrief(brandId, month).then(data => {
      if (data) {
        setBrief(data)
        briefRef.current = data
      } else {
        const initial: NewsletterBrief = {
          id: '',
          brand_id: brandId,
          month,
          hero_type: null,
          hero_headline: null,
          hero_body: null,
          hero_cta: null,
          hero_image_notes: null,
          crosssell_products: [],
          tip_headline: null,
          tip_body: null,
          tip_cta: null,
          spotlight_name: null,
          spotlight_location: null,
          spotlight_quote: null,
          spotlight_products: null,
          subject_line: null,
          preview_text: null,
          seasonal_theme: theme?.theme ?? null,
          status: 'draft',
        }
        setBrief(initial)
        briefRef.current = initial
      }
      setLoading(false)
    })
  }, [brandId, month, theme?.theme])

  function scheduleSave(updated: NewsletterBrief) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await upsertNewsletterBrief({ ...updated, brand_id: brandId, month })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } finally {
        setSaving(false)
      }
    }, 1500)
  }

  function updateField(field: keyof NewsletterBrief, value: unknown) {
    setBrief(prev => {
      if (!prev) return prev
      const updated = { ...prev, [field]: value }
      briefRef.current = updated
      scheduleSave(updated)
      return updated
    })
  }

  function addProduct() {
    const products = [...(brief?.crosssell_products ?? []), { name: '', oneliner: '', price: '', sku: '' }]
    updateField('crosssell_products', products)
  }

  function removeProduct(i: number) {
    const products = (brief?.crosssell_products ?? []).filter((_, idx) => idx !== i)
    updateField('crosssell_products', products)
  }

  function updateProduct(i: number, field: keyof CrossSellProduct, value: string) {
    const products = [...(brief?.crosssell_products ?? [])]
    products[i] = { ...products[i], [field]: value }
    updateField('crosssell_products', products)
  }

  function handleCopyBrief() {
    if (!brief) return
    const lines = [
      `NEWSLETTER BRIEF — Just Pro Tools — ${month}`,
      brief.seasonal_theme ? `Theme: ${brief.seasonal_theme}` : '',
      '',
      '## SUBJECT LINE',
      brief.subject_line ? `Subject: ${brief.subject_line}` : '(not set)',
      brief.preview_text ? `Preview: ${brief.preview_text}` : '',
      '',
      '## HERO',
      brief.hero_type ? `Type: ${brief.hero_type.replace('_', ' ')}` : '(not set)',
      brief.hero_headline ? `Headline: ${brief.hero_headline}` : '',
      brief.hero_body ? `Body: ${brief.hero_body}` : '',
      brief.hero_cta ? `CTA: ${brief.hero_cta}` : '',
      brief.hero_image_notes ? `Image: ${brief.hero_image_notes}` : '',
      '',
      '## CROSS-SELL PRODUCTS',
      ...(brief.crosssell_products ?? []).map((p, i) =>
        `${i + 1}. ${p.name} — ${p.oneliner} — ${p.price}${p.sku ? ` (${p.sku})` : ''}`
      ),
      '',
      '## WORKSHOP TIP',
      brief.tip_headline ? `Headline: ${brief.tip_headline}` : '(not set)',
      brief.tip_body ?? '',
      brief.tip_cta ? `CTA: ${brief.tip_cta}` : '',
      '',
      '## CUSTOMER SPOTLIGHT',
      brief.spotlight_name
        ? `${brief.spotlight_name}${brief.spotlight_location ? ` from ${brief.spotlight_location}` : ''}`
        : '(not set)',
      brief.spotlight_quote ? `"${brief.spotlight_quote}"` : '',
      brief.spotlight_products ?? '',
    ].filter(l => l !== undefined && l !== null)

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedBrief(true)
    setTimeout(() => setCopiedBrief(false), 2000)
  }

  if (loading) {
    return (
      <div className="px-5 py-4 text-sm text-gray-400">Loading newsletter brief…</div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-orange-50/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base">📧</span>
          <span className="text-sm font-semibold text-gray-800">Newsletter Brief</span>
          {brief?.status && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[brief.status as keyof typeof STATUS_STYLES]}`}>
              {brief.status.charAt(0).toUpperCase() + brief.status.slice(1)}
            </span>
          )}
          {theme && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
              {theme.theme}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </div>

      {expanded && brief && (
        <>
          {/* Section tabs */}
          <div className="flex border-b border-gray-100 px-5 gap-1 overflow-x-auto">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeSection === s.id
                    ? 'border-orange-500 text-orange-700'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-5 py-4">

            {/* Subject Line */}
            {activeSection === 'subject' && (
              <div className="space-y-4">
                <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 border border-amber-100">
                  <p className="font-medium mb-1">✍️ Subject line test:</p>
                  <p className="italic">&ldquo;{JPT_COPY_TIPS.subjectLineTest}&rdquo;</p>
                  {theme && (
                    <p className="mt-2 font-medium">
                      Example: <span className="italic">&ldquo;{theme.subjectLineExample}&rdquo;</span>
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Subject Line</label>
                  <input
                    value={brief.subject_line ?? ''}
                    onChange={e => updateField('subject_line', e.target.value)}
                    placeholder={theme?.subjectLineExample ?? 'e.g. Matt from Penrith built this garage setup in a weekend'}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Preview Text</label>
                  <input
                    value={brief.preview_text ?? ''}
                    onChange={e => updateField('preview_text', e.target.value)}
                    placeholder="e.g. Heavy-duty Maxim storage. Easy assembly. See his workshop →"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>
            )}

            {/* Hero */}
            {activeSection === 'hero' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Hero Type</label>
                  <div className="flex gap-2">
                    {(['customer_feature', 'seasonal_campaign', 'product_launch'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => updateField('hero_type', t)}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          brief.hero_type === t
                            ? 'border-orange-300 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {t === 'customer_feature' ? '👤 Customer Feature' : t === 'seasonal_campaign' ? '🗓 Seasonal' : '🆕 Product Launch'}
                      </button>
                    ))}
                  </div>
                </div>

                {brief.hero_type && (
                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 border border-blue-100 space-y-1">
                    <p className="font-medium">Template guidance:</p>
                    <p><span className="font-medium">Headline: </span>{JPT_HERO_TEMPLATES[brief.hero_type as keyof typeof JPT_HERO_TEMPLATES].headlineSuggestion}</p>
                    <p><span className="font-medium">Body: </span>{JPT_HERO_TEMPLATES[brief.hero_type as keyof typeof JPT_HERO_TEMPLATES].bodyTemplate}</p>
                    <p><span className="font-medium">CTA: </span>{JPT_HERO_TEMPLATES[brief.hero_type as keyof typeof JPT_HERO_TEMPLATES].ctaSuggestion}</p>
                    <p><span className="font-medium">Image: </span>{JPT_HERO_TEMPLATES[brief.hero_type as keyof typeof JPT_HERO_TEMPLATES].imageTip}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Headline</label>
                    <input
                      value={brief.hero_headline ?? ''}
                      onChange={e => updateField('hero_headline', e.target.value)}
                      placeholder={brief.hero_type ? JPT_HERO_TEMPLATES[brief.hero_type as keyof typeof JPT_HERO_TEMPLATES].headlineSuggestion : 'e.g. Real Workshop. Real Maxim.'}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Body Copy</label>
                    <textarea
                      rows={3}
                      value={brief.hero_body ?? ''}
                      onChange={e => updateField('hero_body', e.target.value)}
                      placeholder="2-3 sentences. Lead with customer proof if possible."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">CTA Text</label>
                      <input
                        value={brief.hero_cta ?? ''}
                        onChange={e => updateField('hero_cta', e.target.value)}
                        placeholder="e.g. See the Setup →"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Image Notes</label>
                      <input
                        value={brief.hero_image_notes ?? ''}
                        onChange={e => updateField('hero_image_notes', e.target.value)}
                        placeholder="e.g. Matt's Judge.me photo review"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cross-Sell */}
            {activeSection === 'crosssell' && (
              <div className="space-y-4">
                {theme && (
                  <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-700 border border-purple-100">
                    <p className="font-medium">This month&apos;s cross-sell focus:</p>
                    <p className="mt-0.5">{theme.crossSellFocus}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {(brief.crosssell_products ?? []).map((product, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Product {i + 1}</span>
                        <button
                          onClick={() => removeProduct(i)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={product.name}
                          onChange={e => updateProduct(i, 'name', e.target.value)}
                          placeholder="Product name"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 col-span-2"
                        />
                        <input
                          value={product.oneliner}
                          onChange={e => updateProduct(i, 'oneliner', e.target.value)}
                          placeholder="One-liner value statement"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 col-span-2"
                        />
                        <input
                          value={product.price}
                          onChange={e => updateProduct(i, 'price', e.target.value)}
                          placeholder="$XX.XX"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        />
                        <input
                          value={product.sku}
                          onChange={e => updateProduct(i, 'sku', e.target.value)}
                          placeholder="SKU (optional)"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        />
                      </div>
                    </div>
                  ))}
                  {(brief.crosssell_products ?? []).length < 3 && (
                    <button
                      onClick={addProduct}
                      className="w-full py-2 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-300 hover:text-orange-500 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Product Tile
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Workshop Tip */}
            {activeSection === 'tip' && (
              <div className="space-y-4">
                {theme && (
                  <div className="bg-teal-50 rounded-xl p-3 text-xs text-teal-700 border border-teal-100">
                    <p className="font-medium">Suggested tip this month:</p>
                    <p className="mt-0.5">{theme.tipSuggestion}</p>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Tip Headline</label>
                    <input
                      value={brief.tip_headline ?? ''}
                      onChange={e => updateField('tip_headline', e.target.value)}
                      placeholder={theme?.tipSuggestion ?? 'e.g. How to Install a Pegboard on a Plaster Wall'}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Tip Body (max 100 words)</label>
                    <textarea
                      rows={4}
                      value={brief.tip_body ?? ''}
                      onChange={e => updateField('tip_body', e.target.value)}
                      placeholder="Practical, specific advice. Source from support tickets and reviews."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">CTA (links to support article)</label>
                    <input
                      value={brief.tip_cta ?? ''}
                      onChange={e => updateField('tip_cta', e.target.value)}
                      placeholder="e.g. Read the Full Guide → (support.justprotools.com.au)"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Customer Spotlight */}
            {activeSection === 'spotlight' && (
              <div className="space-y-4">
                <div className="bg-green-50 rounded-xl p-3 text-xs text-green-700 border border-green-100">
                  <p className="font-medium">Source from 70 photo reviews on Judge.me</p>
                  <p className="mt-0.5">Look for: strong workshop photo, clear quote, identifiable location. Track which reviews you&apos;ve used to avoid repeats.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Customer First Name</label>
                    <input
                      value={brief.spotlight_name ?? ''}
                      onChange={e => updateField('spotlight_name', e.target.value)}
                      placeholder="e.g. Matt"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Location</label>
                    <input
                      value={brief.spotlight_location ?? ''}
                      onChange={e => updateField('spotlight_location', e.target.value)}
                      placeholder="e.g. Penrith"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Review Quote (max 15 words)</label>
                  <input
                    value={brief.spotlight_quote ?? ''}
                    onChange={e => updateField('spotlight_quote', e.target.value)}
                    placeholder="e.g. Solid as a rock. Had it assembled on Saturday arvo."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Products Featured</label>
                  <input
                    value={brief.spotlight_products ?? ''}
                    onChange={e => updateField('spotlight_products', e.target.value)}
                    placeholder='e.g. Maxim HD 72" Workbench + Pro Series 54" Roll Cabinet'
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 bg-gray-50/50 rounded-b-xl">
            <div className="flex items-center gap-2">
              {saving && <span className="text-xs text-gray-400">Saving…</span>}
              {!saving && saved && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyBrief}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white transition-colors"
              >
                {copiedBrief ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedBrief ? 'Copied!' : 'Copy Brief'}
              </button>
              {brief.status !== 'sent' && (
                <button
                  onClick={() => updateField('status', brief.status === 'ready' ? 'draft' : 'ready')}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                    brief.status === 'ready'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'text-white'
                  }`}
                  style={brief.status !== 'ready' ? { backgroundColor: '#E8611A', borderColor: '#E8611A' } : {}}
                >
                  {brief.status === 'ready'
                    ? <CheckCircle className="w-3.5 h-3.5" />
                    : <Sparkles className="w-3.5 h-3.5" />
                  }
                  {brief.status === 'ready' ? 'Marked Ready' : 'Mark as Ready'}
                </button>
              )}
              {brief.status === 'ready' && (
                <button
                  onClick={() => updateField('status', 'sent')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Mark as Sent
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
