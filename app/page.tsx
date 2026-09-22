import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/supabase/types'
import { getRoleHome, formatRole } from '@/lib/auth/getRoleHome'

// Root page: redirect based on role, or show landing with login/signup links
export default async function HomePage({
  searchParams,
}: {
  searchParams?: { from?: string; expected?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>()

    if (!profile) redirect('/login')

    redirect(getRoleHome(profile.role))
  }

  const fromPage = searchParams?.from
  const expectedRole = searchParams?.expected

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
    <main className="flex flex-col min-h-screen bg-[#0A0A0B] text-white">
      {fromPage && (
        <div className="border-b border-yellow-900 bg-yellow-950/30 px-6 py-3 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
            {expectedRole
              ? `That page (${fromPage}) needs ${formatRole(expectedRole)} access — you were sent home. Use Sign In below with the right tab.`
              : `That page (${fromPage}) isn't for your role — you were sent home.`}
          </p>
        </div>
      )}
      {/* Transparency ticker — UNITED24 trust strip: aggregate proof, always visible. */}
      <div className="border-b border-white/10 bg-yellow-400 text-black" role="status" aria-label="Platform transparency totals">
        <p className="mx-auto max-w-5xl px-6 py-2 text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
          {collegesCount !== null && collegesCount > 0 ? `${collegesCount} colleges` : 'Founding colleges onboarding'} · One vote per election · Results audited after close
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[80vh] bg-gradient-to-b from-yellow-400/[0.06] via-transparent to-transparent">
        <div className="max-w-3xl text-center space-y-8">
          <h1 className="font-display text-6xl md:text-8xl font-extrabold tracking-tighter uppercase">
            Vote<span className="text-yellow-400 text-glow-yellow">.</span>
          </h1>
          <p className="text-xl md:text-2xl text-zinc-300 font-light tracking-wide">
            Secure, transparent, and purposeful elections for your institution.
          </p>
          <p className="text-base md:text-lg font-medium text-white tracking-wide">
            Students: sign in with your college email — no password, no ID to memorize.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 pt-4">
            <Link
              href="/login?intent=voter"
              className="min-h-[44px] px-10 py-4 rounded-full bg-yellow-400 text-black font-bold uppercase tracking-widest shadow-neon-yellow hover:bg-yellow-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black flex items-center justify-center"
            >
              Sign In as Voter
            </Link>
            <p className="text-xs text-zinc-500 tracking-wide">
              <Link href="/login?intent=institution_admin" className="underline underline-offset-4 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">Admin sign in</Link>
              {' · '}
              <Link href="/signup" className="underline underline-offset-4 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">Register your institution</Link>
            </p>
          </div>
          <p className="text-xs text-zinc-500 tracking-wide">
            Voters use college email + OTP. Institution Admins register the college first. Department Admins join via invite email.
          </p>
        </div>
      </div>



      {/* How voting works — 3 steps: college link → OTP → ballot in <2 min */}
      <section id="how-it-works" aria-label="How voting works" className="border-t border-white/10 bg-[#0A0A0B] px-8 py-12 md:px-12 md:py-16 scroll-mt-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-sm font-bold uppercase tracking-[0.2em] text-yellow-400">How voting works</h2>
          <ol className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
            <li className="flex gap-4 md:flex-col md:items-center md:text-center">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black border border-yellow-400 text-sm font-black"
              >
                1
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">College link</h3>
                <p className="text-sm leading-relaxed text-zinc-300">Open your college voting link or pick your college on Sign In.</p>
              </div>
            </li>
            <li className="flex gap-4 md:flex-col md:items-center md:text-center">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black border border-yellow-400 text-sm font-black"
              >
                2
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">OTP</h3>
                <p className="text-sm leading-relaxed text-zinc-300">Enter your college email — we send a one-time code, no password needed.</p>
              </div>
            </li>
            <li className="flex gap-4 md:flex-col md:items-center md:text-center">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black border border-yellow-400 text-sm font-black"
              >
                3
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Ballot in &lt;2 min</h3>
                <p className="text-sm leading-relaxed text-zinc-300">Verify code and vote. One vote per election — enforced by the database.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Proof row — Cialdini:Social Proof. Colleges from public RPC only; elections/votes without numbers per spec.
          Zero/unknown reads as "founding" copy + lock icons, never bare dashes that scan as "dead product". */}
      <section id="transparency" aria-label="Platform proof" className="border-y border-white/10 bg-white/[0.02] px-8 py-8 md:py-10 scroll-mt-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3 md:gap-8">
            <div className="space-y-1">
              <p className="text-3xl font-extrabold tracking-tight text-white font-mono" aria-label={`${collegesCount ?? 0} colleges`}>
                {collegesCount !== null && collegesCount > 0 ? collegesCount : '✦'}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Colleges</p>
              <p className="text-[11px] text-zinc-500">{collegesCount !== null && collegesCount > 0 ? 'public colleges only' : 'founding colleges onboarding'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-extrabold tracking-tight text-white" aria-hidden="true">
                🔒
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Elections</p>
              <p className="text-[11px] text-zinc-500">sign in to view</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-extrabold tracking-tight text-white" aria-hidden="true">
                🔒
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Votes</p>
              <p className="text-[11px] text-zinc-500">aggregate only</p>
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500">
            Live election &amp; vote totals shown after sign-in — no individual ballots ever exposed.
          </p>
        </div>
      </section>
      
      <div className="bg-[#0A0A0B] border-t border-white/10 px-6 py-12 md:p-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl font-extrabold uppercase tracking-widest mb-4 text-center">Built for both sides of the ballot box</h2>
          <p className="text-center text-sm text-zinc-400 mb-10 md:mb-16">Students vote in under 2 minutes. Administrators run the whole election.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-400">For administrators</p>
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">1-Click CSV Roster</h3>
              <p className="text-zinc-300 leading-relaxed">Instantly upload your student database. The system automatically restricts voting to verified emails, entirely eliminating unauthorized ballots.</p>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-400">For administrators</p>
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">Scoped Elections</h3>
              <p className="text-zinc-300 leading-relaxed">Run institution-wide presidential elections alongside granular department and year-specific representative votes.</p>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-400">For students</p>
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">OTP Authentication</h3>
              <p className="text-zinc-300 leading-relaxed">No passwords to lose or reset. Students authenticate securely via one-time magic links sent directly to their inbox.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
