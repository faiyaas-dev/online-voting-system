'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [institutionId, setInstitutionId] = useState('')
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
    <main className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-sm p-6 bg-white border rounded shadow">
        <h1 className="text-xl font-bold mb-4">Sign in</h1>
        {!sent ? (
          <form onSubmit={sendOtp} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-sm font-medium">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
              placeholder="you@university.edu"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">OTP sent to <strong>{email}</strong></p>
            <label htmlFor="otp" className="text-sm font-medium">OTP code</label>
            <input
              id="otp"
              type="text"
              required
              value={otp}
              onChange={e => setOtp(e.target.value)}
              className="border rounded px-3 py-2 text-sm tracking-widest"
              placeholder="6-digit code"
              maxLength={6}
            />
            <label htmlFor="institutionId" className="text-sm font-medium">
              Institution ID <span className="text-gray-400">(voter first login only)</span>
            </label>
            <input
              id="institutionId"
              type="text"
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
              className="border rounded px-3 py-2 text-sm font-mono"
              placeholder="uuid of your institution"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>
            <button type="button" onClick={() => setSent(false)} className="text-sm text-blue-600 underline">
              ← Change email
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
