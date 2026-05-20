'use client'

import { useState, useRef, useEffect } from 'react'

interface Profile {
  id: string
  full_name: string | null
  email: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onMentionsChange: (mentionedIds: string[]) => void
  profiles: Profile[]
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
}

export default function MentionTextarea({
  value, onChange, onMentionsChange, profiles,
  placeholder = 'Add a comment... (type @ to mention someone)',
  rows = 2, className = '', disabled = false,
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownQuery, setDropdownQuery] = useState('')
  const [dropdownIndex, setDropdownIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredProfiles = profiles.filter(p => {
    const q = dropdownQuery.toLowerCase()
    return (p.full_name?.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }).slice(0, 6)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? 0
    onChange(val)

    const textUpToCursor = val.slice(0, cursor)
    const lastAt = textUpToCursor.lastIndexOf('@')
    if (lastAt !== -1) {
      const textAfterAt = textUpToCursor.slice(lastAt + 1)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAt)
        setDropdownQuery(textAfterAt)
        setShowDropdown(true)
        setDropdownIndex(0)
        return
      }
    }
    setShowDropdown(false)
    setMentionStart(null)
  }

  function selectProfile(profile: Profile) {
    if (mentionStart === null) return
    const displayName = profile.full_name ?? profile.email
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + 1 + dropdownQuery.length)
    const newValue = `${before}@${displayName} ${after}`
    onChange(newValue)
    const newIds = new Set(mentionedIds).add(profile.id)
    setMentionedIds(newIds)
    onMentionsChange(Array.from(newIds))
    setShowDropdown(false)
    setMentionStart(null)
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + displayName.length + 2
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || filteredProfiles.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIndex(i => Math.min(i + 1, filteredProfiles.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectProfile(filteredProfiles[dropdownIndex]) }
    if (e.key === 'Escape') { setShowDropdown(false) }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none ${className}`}
      />
      {showDropdown && filteredProfiles.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bottom-full mb-1 left-0 w-64 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden"
        >
          {filteredProfiles.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProfile(p)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${i === dropdownIndex ? 'bg-orange-50' : ''}`}
            >
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-orange-600">
                  {(p.full_name ?? p.email)[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.full_name ?? p.email}</p>
                <p className="text-xs text-gray-400 truncate">{p.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
