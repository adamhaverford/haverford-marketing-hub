'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const QUOTES = [
  { text: 'Marketing is no longer about the stuff you make, but the stories you tell.', author: 'Seth Godin' },
  { text: "The best marketing doesn't feel like marketing.", author: 'Tom Fishburne' },
  { text: 'Content is fire. Social media is gasoline.', author: 'Jay Baer' },
  { text: 'Do or do not. There is no try.', author: 'Yoda' },
  { text: "Your brand is what people say about you when you're not in the room.", author: 'Jeff Bezos' },
  { text: "If you're not embarrassed by the first version of your product, you've launched too late.", author: 'Reid Hoffman' },
  { text: "Stop interrupting what people are interested in and be what people are interested in.", author: 'Craig Davis' },
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'Make it simple. Make it memorable. Make it inviting to look at.', author: 'Leo Burnett' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{ backgroundColor: '#1B2B4B' }}
      >
        <div className="max-w-md text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{ backgroundColor: '#E8611A' }}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Haverford Marketing Hub
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Plan, approve, and track email campaigns across all your brands - in one place.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { label: 'Campaign Planning', desc: 'Organise monthly calendars' },
              { label: 'Approvals', desc: 'Streamline sign-off workflows' },
              { label: 'Design Reviews', desc: 'Visual feedback from stakeholders' },
              { label: 'Performance', desc: 'Track key email metrics' },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-xl p-4">
                <p className="text-white font-semibold text-sm">{item.label}</p>
                <p className="text-blue-200 text-xs mt-1">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Rotating quote */}
          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-blue-100/70 text-sm italic leading-relaxed">
              &ldquo;{quote.text}&rdquo;
            </p>
            <p className="text-blue-300/60 text-xs mt-2">- {quote.author}</p>
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
              style={{ backgroundColor: '#1B2B4B' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>
              Haverford Marketing Hub
            </h1>
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B2B4B' }}>
            Welcome back
          </h2>
          <p className="text-gray-500 mb-8">Sign in to your account</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 text-gray-900 bg-gray-50 placeholder-gray-400 transition"
                style={{ '--tw-ring-color': '#1B2B4B' } as React.CSSProperties}
                placeholder="you@haverford.com.au"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 text-gray-900 bg-gray-50 placeholder-gray-400 transition"
                style={{ '--tw-ring-color': '#1B2B4B' } as React.CSSProperties}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#E8611A' }}
            >
              {loading ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
