import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/supabase/types'

// Root page: redirect based on role, or show landing with login/signup links
export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>()

    if (!profile) redirect('/login')

    if (profile.role === 'platform_admin') redirect('/platform-admin')
    if (profile.role === 'institution_admin') redirect('/institution-admin')
    if (profile.role === 'department_admin') redirect('/department-admin')
    redirect('/elections')
  }

  // Proof row: colleges count from the only public RPC (get_public_institutions).
  // Elections/votes have no anon count RPC — rendered without numbers per spec.
  // Never loosens RLS, never exposes PII.
  let collegesCount: number | null = null
  try {
    const { data } = await supabase.rpc('get_public_institutions')
    if (Array.isArray(data)) collegesCount = data.length
  } catch {
    collegesCount = null
  }

  return (
    <main className="flex flex-col min-h-screen bg-black text-white">
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[80vh]">
        <div className="max-w-3xl text-center space-y-8">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter uppercase">
            Vote.
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 font-light tracking-wide">
            Secure, transparent, and purposeful elections for your institution.
          </p>
          <p className="text-base md:text-lg font-medium text-white tracking-wide">
            Students: sign in with your college email — no password, no ID to memorize.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
            <Link
              href="/login"
              className="min-h-[44px] px-8 py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center justify-center"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="min-h-[44px] px-8 py-4 border border-white text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center justify-center"
            >
              Register Institution
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky Sign In bar — Fogg:Prompt after hero fold, all viewports so
          desktop scrollers keep a CTA too (was md:hidden mobile-only). */}
      <div
        className="sticky bottom-0 z-40 flex items-center gap-3 border-t border-gray-800 bg-black p-4"
        aria-label="Quick sign in"
      >
        <Link
          href="/login"
          className="flex flex-1 min-h-[44px] items-center justify-center bg-white px-4 py-3 text-sm font-bold uppercase tracking-widest text-black hover:bg-gray-200 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="flex flex-1 min-h-[44px] items-center justify-center border border-white px-4 py-3 text-sm font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors"
        >
          Register Institution
        </Link>
      </div>

      {/* How voting works — 3 steps: college link → OTP → ballot in <2 min */}
      <section aria-label="How voting works" className="border-t border-gray-800 bg-black px-8 py-12 md:px-12 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-sm font-bold uppercase tracking-[0.2em] text-gray-500">How voting works</h2>
          <ol className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
            <li className="flex gap-4 md:flex-col md:items-center md:text-center">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white text-sm font-bold"
              >
                1
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">College link</h3>
                <p className="text-sm leading-relaxed text-gray-400">Open your college voting link or pick your college on Sign In.</p>
              </div>
            </li>
            <li className="flex gap-4 md:flex-col md:items-center md:text-center">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white text-sm font-bold"
              >
                2
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">OTP</h3>
                <p className="text-sm leading-relaxed text-gray-400">Enter your college email — we send a one-time code, no password needed.</p>
              </div>
            </li>
            <li className="flex gap-4 md:flex-col md:items-center md:text-center">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white text-sm font-bold"
              >
                3
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Ballot in &lt;2 min</h3>
                <p className="text-sm leading-relaxed text-gray-400">Verify code and vote. One vote per election — enforced by the database.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Proof row — Cialdini:Social Proof. Colleges from public RPC only; elections/votes without numbers per spec.
          Zero/unknown reads as "founding" copy + lock icons, never bare dashes that scan as "dead product". */}
      <section aria-label="Platform proof" className="border-y border-gray-800 bg-gray-900/40 px-8 py-8 md:py-10">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-3 gap-4 text-center md:gap-8">
            <div className="space-y-1">
              <p className="text-2xl font-extrabold tracking-tight text-white md:text-3xl" aria-label={`${collegesCount ?? 0} colleges`}>
                {collegesCount !== null && collegesCount > 0 ? collegesCount : '✦'}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Colleges</p>
              <p className="text-[11px] text-gray-600">{collegesCount !== null && collegesCount > 0 ? 'public colleges only' : 'founding colleges onboarding'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-extrabold tracking-tight text-white md:text-3xl" aria-hidden="true">
                🔒
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Elections</p>
              <p className="text-[11px] text-gray-600">sign in to view</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-extrabold tracking-tight text-white md:text-3xl" aria-hidden="true">
                🔒
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Votes</p>
              <p className="text-[11px] text-gray-600">aggregate only</p>
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-600">
            Live election &amp; vote totals shown after sign-in — no individual ballots ever exposed.
          </p>
        </div>
      </section>
      
      <div className="bg-gray-900 border-t border-gray-800 p-12 md:p-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold uppercase tracking-widest mb-4 text-center">Built for both sides of the ballot box</h2>
          <p className="text-center text-sm text-gray-500 mb-16">Students vote in under 2 minutes. Administrators run the whole election.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">For administrators</p>
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">1-Click CSV Roster</h3>
              <p className="text-gray-400 leading-relaxed">Instantly upload your student database. The system automatically restricts voting to verified emails, entirely eliminating unauthorized ballots.</p>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">For administrators</p>
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">Scoped Elections</h3>
              <p className="text-gray-400 leading-relaxed">Run institution-wide presidential elections alongside granular department and year-specific representative votes.</p>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">For students</p>
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">OTP Authentication</h3>
              <p className="text-gray-400 leading-relaxed">No passwords to lose or reset. Students authenticate securely via one-time magic links sent directly to their inbox.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
