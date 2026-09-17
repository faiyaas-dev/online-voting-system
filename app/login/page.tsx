'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlInstId = searchParams.get('institution') || searchParams.get('institutionId') || ''
  
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [institutionId, setInstitutionId] = useState(urlInstId)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: otpError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (otpError) { setError(otpError.message); setLoading(false); return }

    // Try to load existing profile
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Auth failed'); setLoading(false); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

    if (profile) {
      // Already has a profile — redirect by role
      if (profile.role === 'platform_admin') router.push('/platform-admin')
      else if (profile.role === 'institution_admin') router.push('/institution-admin')
      else if (profile.role === 'department_admin') router.push('/department-admin')
      else router.push('/elections')
      return
    }

    // No profile yet — voter first login: need institution_id to claim
    if (!institutionId.trim()) {
      setError('No profile found. Enter your institution ID to claim your voter profile.')
      setLoading(false)
      return
    }

    const { error: claimError } = await supabase.rpc('claim_voter_profile', {
      p_institution_id: institutionId.trim(),
    })
    setLoading(false)
    if (claimError) { setError(claimError.message); return }
    router.push('/elections')
  }

  return (
    <div className="w-full max-w-md p-8 bg-black border border-gray-800 space-y-6">
      <h1 className="text-3xl font-extrabold uppercase tracking-widest text-center">Sign in</h1>

      {!sent ? (
        <form onSubmit={sendOtp} className="flex flex-col gap-6 mt-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-gray-400">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-lg outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="flex flex-col gap-6 mt-4">
          <p className="text-sm text-gray-400 text-center">OTP sent to <strong className="text-white">{email}</strong></p>
          <div className="flex flex-col gap-2">
            <label htmlFor="otp" className="text-xs font-bold uppercase tracking-widest text-gray-400">OTP code</label>
            <input
              id="otp"
              type="text"
              required
              value={otp}
              onChange={e => setOtp(e.target.value)}
              className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-2xl tracking-widest outline-none transition-colors text-center"
              placeholder="------"
              maxLength={6}
            />
          </div>
          {!urlInstId && (
            <div className="flex flex-col gap-2">
              <label htmlFor="institutionId" className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Institution ID <span className="text-gray-600">(first login)</span>
              </label>
              <input
                id="institutionId"
                type="text"
                value={institutionId}
                onChange={e => setInstitutionId(e.target.value)}
                className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-sm font-mono outline-none transition-colors"
                placeholder="uuid of your institution"
              />
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify & Sign in'}
          </button>
          <button type="button" onClick={() => setSent(false)} className="text-xs text-gray-500 uppercase tracking-widest hover:text-white transition-colors mt-2 text-center w-full">
            ← Change email
          </button>
        </form>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-black text-white p-6">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <LoginContent />
      </Suspense>
    </main>
  )
}
