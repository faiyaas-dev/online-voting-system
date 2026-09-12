'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Institution self-serve signup:
// 1. Enter institution name + admin email → send OTP
// 2. Verify OTP → create institution row + institution_admin profile
export default function SignupPage() {
  const supabase = createClient()
  const router = useRouter()

  const [institutionName, setInstitutionName] = useState('')
  const [slug, setSlug] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function toSlug(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!institutionName.trim() || !slug.trim()) { setError('Institution name and slug required'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email: adminEmail, options: { shouldCreateUser: true } })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  async function verifyAndCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: otpError } = await supabase.auth.verifyOtp({ email: adminEmail, token: otp, type: 'email' })
    if (otpError) { setError(otpError.message); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Auth failed'); setLoading(false); return }

    // F-01/F-10 fix: Use SECURITY DEFINER RPC — role is hardcoded server-side
    const { error: rpcError } = await supabase.rpc('create_institution_and_admin', {
      p_name: institutionName.trim(),
      p_slug: slug.trim(),
    })

    setLoading(false)
    if (rpcError) { setError(rpcError.message); return }
    router.push('/institution-admin')
  }

  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-sm p-6 bg-white border rounded shadow">
        <h1 className="text-xl font-bold mb-4">Register Institution</h1>
        {!sent ? (
          <form onSubmit={sendOtp} className="flex flex-col gap-3">
            <label className="text-sm font-medium">Institution Name</label>
            <input
              type="text"
              required
              value={institutionName}
              onChange={e => { setInstitutionName(e.target.value); setSlug(toSlug(e.target.value)) }}
              className="border rounded px-3 py-2 text-sm"
              placeholder="State University"
            />
            <label className="text-sm font-medium">Slug (URL-safe)</label>
            <input
              type="text"
              required
              value={slug}
              onChange={e => setSlug(e.target.value)}
              className="border rounded px-3 py-2 text-sm font-mono"
              placeholder="state-university"
            />
            <label className="text-sm font-medium">Admin Email</label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
              placeholder="admin@university.edu"
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
          <form onSubmit={verifyAndCreate} className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">OTP sent to <strong>{adminEmail}</strong></p>
            <label className="text-sm font-medium">OTP code</label>
            <input
              type="text"
              required
              value={otp}
              onChange={e => setOtp(e.target.value)}
              className="border rounded px-3 py-2 text-sm tracking-widest"
              placeholder="6-digit code"
              maxLength={6}
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Verify & Create Institution'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
