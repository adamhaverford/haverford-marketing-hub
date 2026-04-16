'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { inviteUser } from '@/lib/actions/users'
import { Edit2, Plus, X, Users, Tag, Check } from 'lucide-react'
import { useToast } from '@/components/Toast'

interface Brand {
  id: string
  name: string
  description: string | null
  color: string
  klaviyo_account_id: string | null
  active: boolean
}

interface UserProfile {
  id: string
  full_name: string | null
  role: string
  email: string | null
  created_at: string
}

interface Props {
  brands: Brand[]
  users: UserProfile[]
}

const PRESET_COLORS = [
  '#1B2B4B', '#E8611A', '#7B2D8B', '#10B981',
  '#3B82F6', '#EF4444', '#F59E0B', '#6366F1',
  '#EC4899', '#14B8A6', '#84CC16', '#64748B',
]

export default function SettingsClient({ brands: initialBrands, users: initialUsers }: Props) {
  const { addToast } = useToast()
  const supabase = createClient()

  const [brands, setBrands] = useState<Brand[]>(initialBrands)
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)

  // Brand modal state
  const [brandModal, setBrandModal] = useState<{ open: boolean; brand: Brand | null }>({
    open: false,
    brand: null,
  })
  const [brandForm, setBrandForm] = useState({
    name: '',
    description: '',
    color: '#1B2B4B',
    klaviyo_account_id: '',
  })
  const [savingBrand, setSavingBrand] = useState(false)

  // Invite modal state
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'marketing' })
  const [inviting, setInviting] = useState(false)

  function openAddBrand() {
    setBrandForm({ name: '', description: '', color: '#1B2B4B', klaviyo_account_id: '' })
    setBrandModal({ open: true, brand: null })
  }

  function openEditBrand(brand: Brand) {
    setBrandForm({
      name: brand.name,
      description: brand.description ?? '',
      color: brand.color,
      klaviyo_account_id: brand.klaviyo_account_id ?? '',
    })
    setBrandModal({ open: true, brand })
  }

  async function handleSaveBrand() {
    if (!brandForm.name.trim()) return
    setSavingBrand(true)
    try {
      const payload = {
        name: brandForm.name.trim(),
        description: brandForm.description.trim() || null,
        color: brandForm.color,
        klaviyo_account_id: brandForm.klaviyo_account_id.trim() || null,
      }

      if (brandModal.brand) {
        const { data, error } = await supabase
          .from('brands')
          .update(payload)
          .eq('id', brandModal.brand.id)
          .select()
          .single()
        if (error) throw error
        setBrands(prev => prev.map(b => (b.id === data.id ? data : b)))
        addToast(`${data.name} updated.`)
      } else {
        const { data, error } = await supabase
          .from('brands')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        setBrands(prev => [...prev, data])
        addToast(`${data.name} added.`)
      }
      setBrandModal({ open: false, brand: null })
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to save brand.', 'error')
    } finally {
      setSavingBrand(false)
    }
  }

  async function toggleBrandActive(brand: Brand) {
    const newActive = !brand.active
    const { error } = await supabase
      .from('brands')
      .update({ active: newActive })
      .eq('id', brand.id)
    if (error) {
      addToast('Failed to update brand status.', 'error')
      return
    }
    setBrands(prev => prev.map(b => (b.id === brand.id ? { ...b, active: newActive } : b)))
    addToast(`${brand.name} ${newActive ? 'activated' : 'deactivated'}.`)
  }

  async function handleInvite() {
    if (!inviteForm.email.trim() || !inviteForm.full_name.trim()) return
    setInviting(true)
    try {
      await inviteUser(inviteForm.email.trim(), inviteForm.full_name.trim(), inviteForm.role)
      addToast(`Invite sent to ${inviteForm.email}.`)
      setInviteModal(false)
      setInviteForm({ email: '', full_name: '', role: 'marketing' })
      // Refresh users list
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, email, created_at')
        .order('full_name')
      if (data) setUsers(data)
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to send invite.', 'error')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Settings</h2>
        <p className="text-gray-500">Manage brands and users.</p>
      </div>

      {/* ── Brands ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Brands
          </h3>
          <button
            onClick={openAddBrand}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#E8611A' }}
          >
            <Plus className="w-4 h-4" />
            Add Brand
          </button>
        </div>

        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          {brands.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No brands yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {brands.map(brand => (
                <div
                  key={brand.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: brand.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{brand.name}</p>
                    {brand.description && (
                      <p className="text-xs text-gray-400 truncate">{brand.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Active toggle */}
                    <button
                      onClick={() => toggleBrandActive(brand)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        brand.active ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                      title={brand.active ? 'Deactivate' : 'Activate'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          brand.active ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-xs font-medium ${brand.active ? 'text-green-600' : 'text-gray-400'}`}>
                      {brand.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => openEditBrand(brand)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Users ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </h3>
          <button
            onClick={() => setInviteModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#E8611A' }}
          >
            <Plus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No users found.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: '#1B2B4B' }}
                  >
                    {(user.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {user.full_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email ?? '—'}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'marketing'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Brand modal ── */}
      {brandModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setBrandModal({ open: false, brand: null })}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {brandModal.brand ? 'Edit Brand' : 'Add Brand'}
              </h3>
              <button
                onClick={() => setBrandModal({ open: false, brand: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Brand Name *
                </label>
                <input
                  type="text"
                  value={brandForm.name}
                  onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Haverford AUS"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={brandForm.description}
                  onChange={e => setBrandForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Brand Colour
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setBrandForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {brandForm.color === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandForm.color}
                    onChange={e => setBrandForm(f => ({ ...f, color: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <span className="text-sm font-mono text-gray-500">{brandForm.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Klaviyo Account ID
                </label>
                <input
                  type="text"
                  value={brandForm.klaviyo_account_id}
                  onChange={e => setBrandForm(f => ({ ...f, klaviyo_account_id: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveBrand}
                disabled={savingBrand || !brandForm.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#E8611A' }}
              >
                {savingBrand ? 'Saving...' : brandModal.brand ? 'Save Changes' : 'Add Brand'}
              </button>
              <button
                onClick={() => setBrandModal({ open: false, brand: null })}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite modal ── */}
      {inviteModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setInviteModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Invite User</h3>
              <button
                onClick={() => setInviteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              An email invite will be sent. The user will set their own password.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="marketing">Marketing</option>
                  <option value="stakeholder">Stakeholder</option>
                </select>
              </div>
            </div>

            <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-700">
                Requires <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in your environment variables.
              </p>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteForm.email.trim() || !inviteForm.full_name.trim()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#E8611A' }}
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
              <button
                onClick={() => setInviteModal(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
