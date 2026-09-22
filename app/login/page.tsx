'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const PENDING_KEY = 'ovs_login_pending'

// DEBUG MODE (until project finished): surface raw Supabase errors as-is.
// No friendly mapping — see console.error for full error objects.

function Steps({ step, intent }: { step: 1 | 2 | 3; intent: LoginIntent }) {
  const items =
    intent === 'voter'
      ? [
          { n: 1, title: 'Enter email', sub: 'Any device' },
          { n: 2, title: 'Check email', sub: 'verification code' },
          { n: 3, title: 'Verify & vote', sub: 'Pick college' },
        ]
      : intent === 'institution_admin'
        ? [
            { n: 1, title: 'Enter email', sub: 'Admin email' },
            { n: 2, title: 'Check email', sub: 'verification code' },
            { n: 3, title: 'Verify & manage', sub: 'Institution dashboard' },
          ]
        : [
            { n: 1, title: 'Enter email', sub: 'Invited email' },
            { n: 2, title: 'Check email', sub: 'verification code' },
            { n: 3, title: 'Verify & manage', sub: 'Department dashboard' },
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

type LoginIntent = 'voter' | 'institution_admin' | 'department_admin'

const INTENT_LABEL: Record<LoginIntent, string> = {
  voter: 'Voter',
  institution_admin: 'Institution Admin',
  department_admin: 'Department Admin',
}

function parseIntent(raw: string | null): LoginIntent {
  if (raw === 'institution_admin' || raw === 'institution-admin') return 'institution_admin'
  if (raw === 'department_admin' || raw === 'department-admin' || raw === 'dept') return 'department_admin'
  return 'voter'
}

function LoginContent() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawUrlInstId = searchParams.get('institution') || searchParams.get('institutionId') || ''
  const urlInstId = UUID_RE.test(rawUrlInstId.trim()) ? rawUrlInstId.trim() : ''
  const [intent, setIntent] = useState<LoginIntent>(() => parseIntent(searchParams.get('intent')))

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
  const [autoCompleting, setAutoCompleting] = useState(false)
  const cooldownRef = useRef<NodeJS.Timeout | null>(null)

  function persistPending(willSend: boolean) {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email, institutionId, intent, sent: willSend }))
    } catch { /* ignore */ }
  }

  function switchIntent(next: LoginIntent) {
    setIntent(next)
    setError('')
    setInfo(
      next === 'voter'
        ? ''
        : next === 'institution_admin'
          ? 'Signing in as Institution Admin — use the email you registered the college with. No college picker needed.'
          : 'Signing in as Department Admin — use your invited email. No college picker needed; your department is attached to your invite.'
    )
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('intent', next)
      window.history.replaceState(null, '', url.toString())
    } catch { /* ignore */ }
  }

  async function handleSessionPostLogin(currentInstId: string, activeIntent?: LoginIntent) {
    const effIntent = activeIntent ?? intent
    setAutoCompleting(true)
    setInfo('Signing you in…')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAutoCompleting(false); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

      if (profile) {
        try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
        if (profile.role === 'platform_admin') router.push('/platform-admin')
        else if (profile.role === 'institution_admin') router.push('/institution-admin')
        else if (profile.role === 'department_admin') router.push('/department-admin')
        else router.push('/elections')
        return
      }

      // No profile yet — only voters can self-provision via roster claim.
      // Admins must use signup (institution) or invite (department), never the voter claim path.
      if (effIntent === 'institution_admin') {
        setError('No Institution Admin account found for this email. Register the college first via “Register Institution”, then sign in here.')
        setInfo('')
        setAutoCompleting(false)
        return
      }
      if (effIntent === 'department_admin') {
        setError('No Department Admin account found for this email. Ask your Institution Admin to send you an invite, then open the invite link.')
        setInfo('')
        setAutoCompleting(false)
        return
      }

      if (!currentInstId.trim()) {
        setError('No profile found. Pick your college above, or open the voting link from your college email.')
        setInfo('')
        setAutoCompleting(false)
        return
      }
      if (!UUID_RE.test(currentInstId.trim())) {
        setError('That college reference looks incomplete. Re-open the voting link from your college email, or pick your college from the list.')
        setInfo('')
        setAutoCompleting(false)
        return
      }

      const { error: claimError } = await supabase.rpc('claim_voter_profile', {
        p_institution_id: currentInstId.trim(),
      })
      if (claimError) {
        setError(claimError.message)
        setInfo('')
        setAutoCompleting(false)
        return
      }
      try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
      router.push('/elections')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setInfo('')
      setAutoCompleting(false)
    }
  }

  useEffect(() => {
    if (searchParams.get('error') === 'auth_callback_failed') {
      // Strict code-only: no links are sent, so this should never happen.
      setError('auth_callback_failed: raw callback error (no link flow in strict code-only mode).')
    }
    let cancelled = false
    let pendingInstId = ''
    let pendingIntent: LoginIntent | null = null
    const urlIntent = parseIntent(searchParams.get('intent'))
    setIntent(urlIntent)
    try {
      const raw = sessionStorage.getItem(PENDING_KEY)
      if (raw) {
        const p = JSON.parse(raw) as { email?: string; institutionId?: string; intent?: LoginIntent; sent?: boolean }
        if (p.email) setEmail(p.email)
        if (p.intent === 'voter' || p.intent === 'institution_admin' || p.intent === 'department_admin') {
          pendingIntent = p.intent
          setIntent(searchParams.get('intent') ? urlIntent : p.intent)
        }
        if (p.institutionId && UUID_RE.test(p.institutionId)) {
          setInstitutionId(p.institutionId)
          pendingInstId = p.institutionId
        }
        if (p.sent) {
          setSent(true)
          setInfo('Session restored — enter the verification code, or Resend for a fresh one, then Verify & Sign in.')
        }
      }
    } catch { /* ignore */ }
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (!data.user) return
      let hasPending = false
      try {
        const raw = sessionStorage.getItem(PENDING_KEY)
        if (raw) hasPending = JSON.parse(raw).sent === true
      } catch { /* ignore */ }
      if (hasPending) {
        setSent(true)
        const effectiveInstId = pendingInstId || institutionId || urlInstId
        void handleSessionPostLogin(effectiveInstId, pendingIntent ?? urlIntent)
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

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_public_institutions')
      .then(({ data }) => { if (!cancelled && data) setDirectory(data as InstitutionOption[]) })
    return () => { cancelled = true }
  }, [supabase])

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
    if (loading) return
    setError('')
    setInfo('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        // No emailRedirectTo: pure OTP mode - prevents Gmail pre-fetch from consuming token.
        data: institutionName ? { institution_name: institutionName } : undefined,
      },
    })
    setLoading(false)
    if (error) { console.error('[login sendOtp raw error]', error); setError(error.message); return }
    persistPending(true)
    setSent(true)
    setCooldown(60)
    setInfo('Code sent! Enter the verification code below. Only the newest code works.')
  }

  async function resendCode() {
    if (cooldown > 0 || resending) return
    setError('')
    setInfo('')
    setResending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        // No emailRedirectTo: pure OTP mode - prevents Gmail pre-fetch from consuming token.
        data: institutionName ? { institution_name: institutionName } : undefined,
      },
    })
    setResending(false)
    if (error) { console.error('[login resend raw error]', error); setError(error.message); return }
    setOtp('')
    setCooldown(60)
    setInfo('Fresh code sent — older codes stop working.')
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')
    setInfo('')
    setLoading(true)
    const cleanOtp = otp.trim().replace(/\D/g, '')
    // Server OTP length is configurable (6-8 digits observed) — accept any
    // code of length >= 6 instead of hard-coding 6.
    if (cleanOtp.length < 6) {
      setError('Enter the verification code from your email.')
      setLoading(false)
      return
    }
    // Code-only OTP: unified email-type verification. Deprecated
    // signup/magiclink fallbacks removed to avoid burning attempts.
    const verifyEmail = email.trim().toLowerCase()
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token: cleanOtp,
      type: 'email',
    })
    if (otpError) { console.error('[login verifyOtp raw error type=email]', otpError); setError(`${otpError.message} Only the newest code works — tap Resend code if this one is old.`); setLoading(false); return }
    setLoading(false)
    void handleSessionPostLogin(institutionId || urlInstId, intent)
  }

  return (
    <div className="w-full max-w-md p-6 sm:p-8 bg-black border border-gray-800 space-y-6">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-widest text-center">Sign in</h1>
      <div role="tablist" aria-label="Sign in as" className="grid grid-cols-3 gap-2">
        {(Object.keys(INTENT_LABEL) as LoginIntent[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={intent === k}
            onClick={() => switchIntent(k)}
            className={`min-h-[44px] px-2 py-2 text-[11px] font-bold uppercase tracking-widest border rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              intent === k ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300' : 'border-gray-800 text-gray-500 hover:text-white'
            }`}
          >
            {INTENT_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 text-center">
        {intent === 'voter' && 'Students: use your college email + OTP. Pick your college after the code.'}
        {intent === 'institution_admin' && 'Institution Admins: use the email you registered the college with. New here? Register the institution first.'}
        {intent === 'department_admin' && 'Department Admins: use your invited email. You need an invite from your Institution Admin — you cannot self-register.'}
      </p>
      <Steps step={autoCompleting ? 3 : sent ? 2 : 1} intent={intent} />

      {autoCompleting ? (
        <div className="flex flex-col gap-6 mt-4 items-center">
          <div className="border border-gray-800 bg-transparent px-4 py-8 w-full text-center">
            <p className="text-sm text-gray-400">Signing you in…</p>
            <p className="mt-2 text-xs text-gray-500">Do not close this window.</p>
          </div>
          {info && <p className="text-green-400 text-sm">{info}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      ) : !sent ? (
        <form onSubmit={sendOtp} className="flex flex-col gap-6 mt-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-gray-400">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : info ? 'login-info' : undefined}
              className="bg-transparent border-b border-gray-700 focus:border-yellow-400 px-0 py-3 text-lg outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-colors"
              placeholder="you@example.com"
            />
          </div>
          {error && <p id="login-error" role="alert" className="text-red-400 text-sm">{error}</p>}
          {info && <p id="login-info" role="status" className="text-green-400 text-sm">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 min-h-[44px] rounded-full bg-yellow-400 text-black font-bold uppercase tracking-widest py-4 shadow-neon-yellow hover:bg-yellow-300 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
          <p className="text-xs text-gray-500 text-center">Step 1 of 3 — we email you a verification code. Enter it here.</p>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="flex flex-col gap-6 mt-4">
          <p className="text-sm text-gray-400 text-center">OTP sent to <strong className="text-white">{email}</strong></p>
          <p className="text-xs text-gray-500 text-center">Enter the verification code from your email.</p>
          <div className="flex flex-col gap-2">
            <label htmlFor="otp" className="text-xs font-bold uppercase tracking-widest text-gray-400">OTP code</label>
            <input
              id="otp"
              type="text"
              required
              value={otp}
              onChange={e => setOtp(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : info ? 'login-info' : undefined}
              className="bg-transparent border-b border-gray-700 focus:border-yellow-400 px-0 py-3 text-2xl tracking-widest tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-colors text-center"
              placeholder="--------"
              maxLength={10}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          {intent !== 'voter' ? (
            <div className="border border-gray-800 bg-transparent px-4 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                Signing in as {INTENT_LABEL[intent]}
              </p>
              <p className="mt-1 text-sm text-gray-300">
                {intent === 'institution_admin'
                  ? 'No college picker needed — your institution is attached to your admin account.'
                  : institutionName
                    ? `Voting at ${institutionName} — your department comes from your invite.`
                    : 'No college picker needed — your college and department come from your invite.'}
              </p>
            </div>
          ) : institutionId ? (
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
          {error && <p id="login-error" role="alert" className="text-red-400 text-sm">{error}</p>}
          {info && <p id="login-info" role="status" className="text-green-400 text-sm">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 min-h-[44px] rounded-full bg-yellow-400 text-black font-bold uppercase tracking-widest py-4 shadow-neon-yellow hover:bg-yellow-300 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
          <button type="button" onClick={() => { setSent(false); setError(''); setInfo(''); try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ } }} className="min-h-[44px] text-xs text-gray-500 uppercase tracking-widest hover:text-white transition-colors mt-2 text-center w-full">
            ← Change email
          </button>
        </form>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex items-start sm:items-center justify-center min-h-screen bg-[#0A0A0B] text-white px-6 py-10">
      <Suspense fallback={<div className="text-zinc-400 text-sm uppercase tracking-widest">Loading sign in…</div>}>
        <LoginContent />
      </Suspense>
    </main>
  )
}
