'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const PENDING_KEY = 'ovs_login_pending'

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp_expired')) {
    return 'That code is expired or already used (email links are single-use). Tap “Resend code” for a fresh one — only the newest code works.'
  }
  return message
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, title: 'Enter email', sub: 'Any device' },
    { n: 2, title: 'Check email', sub: '6-digit code' },
    { n: 3, title: 'Verify & vote', sub: 'Pick college' },
  ]
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Sign-in progress">
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

interface InstitutionOption {
  id: string
  name: string
  slug: string
}

function LoginContent() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawUrlInstId = searchParams.get('institution') || searchParams.get('institutionId') || ''
  // Only honour well-formed IDs from the link — anything else is treated as absent
  // so we never render a raw-UUID textbox (P0-1).
  const urlInstId = UUID_RE.test(rawUrlInstId.trim()) ? rawUrlInstId.trim() : ''

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [institutionId, setInstitutionId] = useState(urlInstId)
  const [institutionName, setInstitutionName] = useState('')
  const [collegeQuery, setCollegeQuery] = useState('')
  const [votingLink, setVotingLink] = useState('')
  const [directory, setDirectory] = useState<InstitutionOption[]>([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<NodeJS.Timeout | null>(null)

  // Restore pending login after magic-link round-trip, and resume an
  // already-established session (link click) instead of a dead form.
  // A failed exchange (expired / prefetched / reused link) returns here with
  // ?error=auth_callback_failed — surface it instead of a silent blank form.
  useEffect(() => {
    if (searchParams.get('error') === 'auth_callback_failed') {
      setError('That email link expired or was already used — links work once and inbox scanners sometimes open them first. Enter your email and tap Send OTP for a fresh code.')
    }
    try {
      const raw = sessionStorage.getItem(PENDING_KEY)
      if (raw) {
        const p = JSON.parse(raw) as { email?: string; institutionId?: string; sent?: boolean }
        if (p.email) setEmail(p.email)
        if (p.institutionId && UUID_RE.test(p.institutionId)) setInstitutionId(p.institutionId)
        if (p.sent) {
          setSent(true)
          setInfo('Email confirmed — enter the 6-digit code, or Resend for a fresh one, then Verify & Sign in.')
        }
      }
    } catch { /* ignore */ }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      try {
        const raw = sessionStorage.getItem(PENDING_KEY)
        if (raw && JSON.parse(raw).sent) setSent(true)
      } catch { /* ignore */ }
    })
  }, [supabase, searchParams])

  useEffect(() => {
    if (cooldown <= 0) return
    cooldownRef.current = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current) }
  }, [cooldown])
  // College directory for the searchable dropdown, served by the public
  // get_public_institutions() RPC (id, name, slug only — no roster, email,
  // or voter PII). Works signed-out; the voting-link paste path below
  // always works as a fallback.
  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_public_institutions')
      .then(({ data }) => { if (!cancelled && data) setDirectory(data as InstitutionOption[]) })
    return () => { cancelled = true }
  }, [supabase])

  // Official institution NAME for the banner above the OTP step, resolved
  // from the directory (never a raw UUID on screen). Fails closed — never blocks.
  useEffect(() => {
    if (!UUID_RE.test(institutionId)) { setInstitutionName(''); return }
    const match = directory.find(o => o.id === institutionId)
    if (match) setInstitutionName(match.name)
  }, [institutionId, directory])

  const query = collegeQuery.trim().toLowerCase()
  const matches = query
    ? directory.filter(o => o.name.toLowerCase().includes(query) || o.slug.toLowerCase().includes(query)).slice(0, 8)
    : []

  function applyVotingLink() {
    setError('')
    const m = votingLink.match(/[?&](?:institution|institutionId)=([0-9a-fA-F-]{36})/)
    if (!m || !UUID_RE.test(m[1])) {
      setError('That link does not contain a college reference. Open the voting link from your college email, or pick your college from the list.')
      return
    }
    setInstitutionId(m[1])
    setVotingLink('')
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    // Preserve college context through the magic-link round-trip.
    const next = institutionId.trim() && UUID_RE.test(institutionId.trim())
      ? `/login?institution=${institutionId.trim()}`
      : '/login'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (error) { setError(friendlyAuthError(error.message)); return }
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email, institutionId, sent: true })) } catch { /* ignore */ }
    setSent(true)
    setCooldown(60)
    setInfo('Code sent! Enter the 6-digit code below. Only the newest code works.')
  }

  async function resendCode() {
    if (cooldown > 0 || resending) return
    setError('')
    setInfo('')
    setResending(true)
    const next = institutionId.trim() && UUID_RE.test(institutionId.trim())
      ? `/login?institution=${institutionId.trim()}`
      : '/login'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setResending(false)
    if (error) { setError(friendlyAuthError(error.message)); return }
    setCooldown(60)
    setInfo('Fresh code sent — older codes stop working.')
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    const { error: otpError } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'email' })
    if (otpError) { setError(friendlyAuthError(otpError.message)); setLoading(false); return }

    // Try to load existing profile
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Auth failed'); setLoading(false); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

    if (profile) {
      // Already has a profile — redirect by role
      try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
      if (profile.role === 'platform_admin') router.push('/platform-admin')
      else if (profile.role === 'institution_admin') router.push('/institution-admin')
      else if (profile.role === 'department_admin') router.push('/department-admin')
      else router.push('/elections')
      return
    }

    // No profile yet — voter first login: need institution_id to claim.
    // claim_voter_profile matches the exact (institution_id, email) roster row;
    // the ID is resolved from the college voting link or the college picker
    // above — the student never types or sees a raw UUID (P0-1).
    if (!institutionId.trim()) {
      setError('No profile found. Pick your college above, or open the voting link from your college email.')
      setLoading(false)
      return
    }
    if (!UUID_RE.test(institutionId.trim())) {
      setError('That college reference looks incomplete. Re-open the voting link from your college email, or pick your college from the list.')
      setLoading(false)
      return
    }

    const { error: claimError } = await supabase.rpc('claim_voter_profile', {
      p_institution_id: institutionId.trim(),
    })
    setLoading(false)
    if (claimError) { setError(claimError.message); return }
    try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
    router.push('/elections')
  }

  return (
    <div className="w-full max-w-md p-8 bg-black border border-gray-800 space-y-6">
      <h1 className="text-3xl font-extrabold uppercase tracking-widest text-center">Sign in</h1>
      <Steps step={sent ? 3 : 1} />

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
          {info && <p className="text-green-400 text-sm">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
          <p className="text-xs text-gray-500 text-center">Step 1 of 3 — we email you a 6-digit code. Enter it here; only click the email link if you can’t find the code.</p>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="flex flex-col gap-6 mt-4">
          <p className="text-sm text-gray-400 text-center">OTP sent to <strong className="text-white">{email}</strong></p>
          <p className="text-xs text-gray-500 text-center">Enter the 6-digit code from your email. Clicked the email link instead? You’re back here — just enter the code or resend.</p>
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
          {institutionId ? (
            <div className="border border-gray-800 bg-transparent px-4 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Voting at</p>
              <p className="mt-1 text-lg font-bold text-white">{institutionName || 'Your college'}</p>
              {!urlInstId && (
                <button
                  type="button"
                  onClick={() => { setInstitutionId(''); setInstitutionName('') }}
                  className="mt-1 min-h-[44px] w-full text-xs text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
                >
                  Not your college? Change
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="collegeSearch" className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Your college <span className="text-gray-600">(first login)</span>
              </label>
              <p className="text-xs text-gray-500">Find your college below, or open the voting link from your college email so this fills in automatically.</p>
              <input
                id="collegeSearch"
                type="text"
                value={collegeQuery}
                onChange={e => setCollegeQuery(e.target.value)}
                className="bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-base outline-none transition-colors"
                placeholder="Search by college name"
                autoComplete="off"
              />
              {query && (
                <div className="border border-gray-800" role="listbox" aria-label="Matching colleges">
                  {matches.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-500">No matches yet — paste your voting link below instead.</p>
                  ) : (
                    matches.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => { setInstitutionId(o.id); setInstitutionName(o.name); setCollegeQuery('') }}
                        className="flex min-h-[44px] w-full flex-col justify-center px-4 py-3 text-left hover:bg-gray-900 transition-colors"
                      >
                        <span className="text-sm font-bold text-white">{o.name}</span>
                        <span className="text-xs text-gray-500">{o.slug}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <label htmlFor="votingLink" className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                Or paste your voting link
              </label>
              <div className="flex gap-2">
                <input
                  id="votingLink"
                  type="text"
                  value={votingLink}
                  onChange={e => setVotingLink(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent border-b border-gray-700 focus:border-white px-0 py-3 text-sm outline-none transition-colors"
                  placeholder="https://…?institution=…"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={applyVotingLink}
                  className="min-h-[44px] min-w-[44px] shrink-0 border border-gray-700 px-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-gray-800 transition-colors"
                >
                  Use link
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {info && <p className="text-green-400 text-sm">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify & Sign in'}
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={cooldown > 0 || resending}
            className="min-h-[44px] text-xs text-gray-400 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
          >
            {resending ? 'Resending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <button type="button" onClick={() => { setSent(false); setError(''); setInfo('') }} className="min-h-[44px] text-xs text-gray-500 uppercase tracking-widest hover:text-white transition-colors mt-2 text-center w-full">
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
