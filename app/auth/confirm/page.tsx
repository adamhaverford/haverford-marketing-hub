'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Stage = 'loading' | 'error' | 'form' | 'done'

export default function ConfirmPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('loading')
  const [tokenError, setTokenError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // PKCE / OTP flow: token_hash arrives as a query param
    const searchParams = new URLSearchParams(window.location.search)
    const tokenHash = searchParams.get('token_hash')
    if (tokenHash) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: 'invite' })
        .then(({ error }) => {
          if (error) {
            setTokenError(error.message)
            setStage('error')
          } else {
            setStage('form')
          }
        })
      return
    }

    // Implicit flow: tokens arrive in the URL hash fragment
    const hash = window.location.hash.slice(1)
    const hashParams = new URLSearchParams(hash)
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const type = hashParams.get('type')

    if (accessToken && refreshToken && type === 'invite') {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setTokenError(error.message)
            setStage('error')
          } else {
            setStage('form')
          }
        })
      return
    }

    setTokenError('Invalid or expired invite link.')
    setStage('error')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFormError(error.message)
      setSubmitting(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
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
          <h1 className="text-3xl font-bold text-white mb-4">Haverford Marketing Hub</h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            You&apos;ve been invited to collaborate. Set a password to get started.
          </p>
        </div>
      </div>

      {/* Right panel */}
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
            <h1 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>Haverford Marketing Hub</h1>
          </div>

          {stage === 'loading' && (
            <div className="text-center text-gray-500 text-sm">Verifying your invite&hellip;</div>
          )}

          {stage === 'error' && (
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B2B4B' }}>Invalid invite</h2>
              <p className="text-gray-500 mb-6">This invite link has expired or is invalid.</p>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-6">
                {tokenError}
              </div>
              <p className="text-sm text-gray-500">
                Contact your administrator to request a new invite.
              </p>
            </div>
          )}

          {stage === 'form' && (
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B2B4B' }}>Set your password</h2>
              <p className="text-gray-500 mb-8">Choose a password to activate your account.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 text-gray-900 bg-gray-50 placeholder-gray-400 transition"
                    style={{ '--tw-ring-color': '#1B2B4B' } as React.CSSProperties}
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 text-gray-900 bg-gray-50 placeholder-gray-400 transition"
                    style={{ '--tw-ring-color': '#1B2B4B' } as React.CSSProperties}
                    placeholder="••••••••"
                  />
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: '#E8611A' }}
                >
                  {submitting ? 'Setting password\u2026' : 'Set password & go to dashboard'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
