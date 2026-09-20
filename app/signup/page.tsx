'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

const PENDING_KEY = 'ovs_signup_pending'

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp_expired')) {
    return 'That code is expired or already used (email links are single-use and Gmail sometimes pre-opens them). Tap “Resend code” below for a fresh one.'
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many codes were requested. Wait a minute, then try again.'
  }
  if (m.includes('sending') || m.includes('smtp') || m.includes('email provider')) {
    return 'Supabase could not send the email. Check Authentication → SMTP Settings in your Supabase project, then try again.'
  }
  if (m.includes('invalid api key') || m.includes('apikey')) {
    return 'Supabase is not configured correctly for this site. Set the public Supabase key and restart the app.'
  }
  return message
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, title: 'Enter details', sub: 'College + admin email' },
    { n: 2, title: 'Check email', sub: '6-digit code' },
    { n: 3, title: 'Verify & create', sub: 'Finish setup' },
  ]
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Registration progress">
      {items.map(o => {
        const active = o.n === step
        const done = o.n < step
        return (
          <li
            key={o.n}
            aria-current={active ? 'step' : undefined}
            className={`border px-3 py-2 text-center ${active ? 'border-white bg-gray-900' : done ? 'border-green-700' : 'border-gray-800'}`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-widest ${active ? 'text-white' : done ? 'text-green-400' : 'text-gray-500'}`}>
              Step {o.n}{done ? ' ✓' : ''}
            </p>
            <p className="mt-0.5 text-xs font-bold text-white">{o.title}</p>
            <p className="text-[11px] text-gray-500">{o.sub}</p>
          </li>
        )
      })}
    </ol>
  )
}

function SignupContent() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const searchParams = useSearchParams()

  const [institutionName, setInstitutionName] = useState('')
  const [slug, setSlug] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [slugTaken, setSlugTaken] = useState(false)
  const [slugAvailability, setSlugAvailability] = useState<'available' | 'taken' | null>(null)
  const [autoCompleting, setAutoCompleting] = useState(false)
  const slugTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cooldownRef = useRef<NodeJS.Timeout | null>(null)

  function toSlug(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  function persistPending(willSend: boolean) {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ institutionName, slug, adminEmail, sent: willSend }))
    } catch { /* private mode — non-blocking */ }
  }

  async function createInstitutionAndRedirect() {
    setAutoCompleting(true)
    setError('')
    setInfo('Completing setup — please wait…')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAutoCompleting(false); return }

      const { error: rpcError } = await supabase.rpc('create_institution_and_admin', {
        p_name: institutionName.trim(),
        p_slug: slug.trim(),
      })
      if (rpcError) {
        setError(rpcError.message)
        setInfo('')
        setAutoCompleting(false)
        return
      }
      try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
      router.push('/institution-admin')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed')
      setInfo('')
      setAutoCompleting(false)
    }
  }

  useEffect(() => {
    if (searchParams.get('error') === 'auth_callback_failed') {
      setError('That email link expired or was already used — links work once and inbox scanners sometimes open them first. Re-enter your details and tap Send OTP for a fresh code.')
    }
    let cancelled = false
    try {
      const raw = sessionStorage.getItem(PENDING_KEY)
      if (!raw) return
      const p = JSON.parse(raw) as { institutionName?: string; slug?: string; adminEmail?: string; sent?: boolean }
      if (p.institutionName) setInstitutionName(p.institutionName)
      if (p.slug) setSlug(p.slug)
      if (p.adminEmail) setAdminEmail(p.adminEmail)
      if (p.sent) {
        setSent(true)
        setInfo('Email confirmed — enter the 6-digit code from your email, or tap Resend code for a fresh one, then Verify & Create.')
      }
    } catch { /* corrupted storage — start fresh */ }
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (data.user) {
        let hasPending = false
        try {
          const raw = sessionStorage.getItem(PENDING_KEY)
          if (raw) hasPending = JSON.parse(raw).sent === true
        } catch { /* ignore */ }
        if (hasPending) {
          setSent(true)
          createInstitutionAndRedirect()
        }
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, searchParams])

  useEffect(() => {
    if (cooldown <= 0) return
    cooldownRef.current = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current) }
  }, [cooldown])

  const checkSlugAvailability = useCallback(async (value: string) => {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) { setSlugAvailability(null); setSlugTaken(false); return }
    try {
      const { data, error } = await supabase.rpc('get_public_institutions')
      if (error || !Array.isArray(data)) { setSlugAvailability(null); setSlugTaken(false); return }
      const exists = data.some((o: { slug: string }) => o.slug.toLowerCase() === trimmed)
      setSlugAvailability(exists ? 'taken' : 'available')
      setSlugTaken(exists)
    } catch {
      setSlugAvailability(null)
      setSlugTaken(false)
    }
  }, [supabase])

  useEffect(() => {
    if (slugTimeoutRef.current) clearTimeout(slugTimeoutRef.current)
    slugTimeoutRef.current = setTimeout(() => { void checkSlugAvailability(slug) }, 500)
    return () => { if (slugTimeoutRef.current) clearTimeout(slugTimeoutRef.current) }
  }, [slug, checkSlugAvailability])

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!institutionName.trim() || !slug.trim()) { setError('Institution name and slug required'); return }
    if (slugTaken) { setError('This slug is already taken. Please choose another.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: adminEmail.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) { setError(friendlyAuthError(error.message)); return }
    persistPending(true)
    setSent(true)
    setCooldown(60)
    setInfo('Code sent! Check your inbox for the 6-digit code and enter it below. Can’t find a code? Click the email link instead — it brings you back here.')
  }

  async function resendCode() {
    if (cooldown > 0 || resending) return
    setError('')
    setInfo('')
    setResending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: adminEmail.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setResending(false)
    if (error) { setError(friendlyAuthError(error.message)); return }
    persistPending(true)
    setCooldown(60)
    setInfo('Fresh code sent — only the newest code works, older ones stop working.')
  }

  async function verifyAndCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    const { error: otpError } = await supabase.auth.verifyOtp({ email: adminEmail, token: otp.trim(), type: 'email' })
    if (otpError) { setError(friendlyAuthError(otpError.message)); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Auth failed'); setLoading(false); return }

    const { error: rpcError } = await supabase.rpc('create_institution_and_admin', {
      p_name: institutionName.trim(),
      p_slug: slug.trim(),
    })

    setLoading(false)
    if (rpcError) { setError(rpcError.message); return }
    try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
    router.push('/institution-admin')
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-black text-white p-6">
      <div className="w-full max-w-md p-8 bg-black border border-gray-800 space-y-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-widest text-center">Register</h1>
        <Steps step={sent || autoCompleting ? 3 : 1} />
        {autoCompleting ? (
          <div className="flex flex-col gap-6 mt-4 items-center">
            <div className="border border-gray-800 bg-transparent px-4 py-8 w-full text-center">
              <p className="text-sm text-gray-400">Setting up <strong className="text-white">{institutionName || 'your institution'}</strong>…</p>
              <p className="mt-2 text-xs text-gray-500">This takes a few seconds. Do not close this window.</p>
            </div>
            {info && <p className="text-green-400 text-sm">{info}</p>}
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        ) : !sent ? (
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
                onChange={e => {
                  setSlug(e.target.value)
                }}
                className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-sm font-mono outline-none transition-colors"
                placeholder="state-university"
              />
              <p className="text-xs text-gray-500">3–50 chars, lowercase letters, numbers, hyphens.</p>
              {slugAvailability === 'taken' && (
                <p className="mt-1 text-xs text-red-400">This slug is already taken. Please choose another.</p>
              )}
              {slugAvailability === 'available' && (
                <p className="mt-1 text-xs text-green-400">This slug is available.</p>
              )}
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
            {info && <p className="text-green-400 text-sm">{info}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
            <p className="text-xs text-gray-500 text-center">Step 1 of 3 — we email you a 6-digit code. It expires in 1 hour; only the newest code works.</p>
          </form>
        ) : (
          <form onSubmit={verifyAndCreate} className="flex flex-col gap-6 mt-4">
            <p className="text-sm text-gray-400 text-center">OTP sent to <strong className="text-white">{adminEmail}</strong> for <strong className="text-white">{institutionName}</strong></p>
            <p className="text-xs text-gray-500 text-center">Enter the 6-digit code below. Only clicked the email link? Good — you are back here, just enter the code or resend.</p>
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
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {info && <p className="text-green-400 text-sm">{info}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Verify & Create Institution'}
            </button>
            <button
              type="button"
              onClick={resendCode}
              disabled={cooldown > 0 || resending}
              className="min-h-[44px] text-xs text-gray-400 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
            >
              {resending ? 'Resending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button" onClick={() => { setSent(false); setError(''); setInfo('') }} className="min-h-[44px] text-xs text-gray-500 uppercase tracking-widest hover:text-white transition-colors text-center w-full">
              ← Change details
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="flex items-center justify-center min-h-screen bg-black text-white p-6"><div>Loading...</div></main>}>
      <SignupContent />
    </Suspense>
  )
}
