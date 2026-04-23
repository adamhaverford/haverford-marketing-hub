'use client'

import { useState, useTransition } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createCampaign } from '@/lib/actions/planning'
import { useToast } from '@/components/Toast'

interface Brand {
  id: string
  name: string
  color: string
}

interface Props {
  brands: Brand[]
  onClose: () => void
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2B4B] focus:border-transparent'

export default function NewCampaignModal({ brands, onClose }: Props) {
  const { addToast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    brand_id: brands[0]?.id ?? '',
    title: '',
    type: 'evergreen',
    month: '',
    subject_line: '',
    preview_text: '',
    notes: '',
  })

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    startTransition(async () => {
      try {
        await createCampaign(form)
        addToast('Campaign created successfully')
        onClose()
      } catch {
        addToast('Failed to create campaign', 'error')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Campaign</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Brand
            </label>
            <select
              className={inputCls}
              value={form.brand_id}
              onChange={(e) => set('brand_id', e.target.value)}
              required
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Campaign Title *
            </label>
            <input
              className={inputCls}
              placeholder="e.g. Summer Sale Announcement"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Type
              </label>
              <select
                className={inputCls}
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                <option value="evergreen">Evergreen</option>
                <option value="promotional">Promo/Newsletter</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Month
              </label>
              <input
                type="month"
                className={inputCls}
                value={form.month}
                onChange={(e) => set('month', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              className={inputCls}
              placeholder="Email subject line"
              value={form.subject_line}
              onChange={(e) => set('subject_line', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Preview Text
            </label>
            <input
              className={inputCls}
              placeholder="Email preview text"
              value={form.preview_text}
              onChange={(e) => set('preview_text', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              placeholder="Additional notes or context"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.title.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#E8611A' }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save as Idea
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
