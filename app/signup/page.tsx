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
    <main className="flex items-center justify-center min-h-screen bg-black text-white p-6">
      <div className="w-full max-w-md p-8 bg-black border border-gray-800 space-y-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-widest text-center">Register</h1>
        {!sent ? (
          <form onSubmit={sendOtp} className="flex flex-col gap-6 mt-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="institutionName" className="text-xs font-bold uppercase tracking-widest text-gray-400">Institution Name</label>
              <input
                id="institutionName"
                type="text"
                required
                value={institutionName}
                onChange={e => { setInstitutionName(e.target.value); setSlug(toSlug(e.target.value)) }}
                className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-lg outline-none transition-colors"
                placeholder="State University"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="slug" className="text-xs font-bold uppercase tracking-widest text-gray-400">Slug (URL-safe)</label>
              <input
                id="slug"
                type="text"
                required
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-sm font-mono outline-none transition-colors"
                placeholder="state-university"
              />
              <p className="text-xs text-gray-500">3–50 chars, lowercase letters, numbers, hyphens. If taken, you will be asked to pick another after verifying your OTP.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="adminEmail" className="text-xs font-bold uppercase tracking-widest text-gray-400">Admin Email</label>
              <input
                id="adminEmail"
                type="email"
                required
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-lg outline-none transition-colors"
                placeholder="admin@example.edu"
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
          <form onSubmit={verifyAndCreate} className="flex flex-col gap-6 mt-4">
            <p className="text-sm text-gray-400 text-center">OTP sent to <strong className="text-white">{adminEmail}</strong></p>
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
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Verify & Create Institution'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
