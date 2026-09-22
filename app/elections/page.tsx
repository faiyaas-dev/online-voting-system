import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Election, Profile } from '@/lib/supabase/types'
import LiveCountdown from '@/components/LiveCountdown'

function statusBadge(status: Election['status']) {
  const map: Record<string, string> = {
    draft: 'border-white/20 text-zinc-400 bg-white/5',
    nomination_open: 'border-yellow-400/50 text-yellow-300 bg-yellow-400/10 shadow-[0_0_12px_rgba(255,215,0,0.25)]',
    voting_open: 'border-green-400/50 text-green-300 bg-green-400/10 shadow-[0_0_12px_rgba(74,222,128,0.3)]',
    closed: 'border-white/20 text-zinc-400 bg-white/5',
  }
  return map[status] || 'border-white/20 text-zinc-400 bg-white/5'
}

function statusLabel(status: Election['status']) {
  const map: Record<string, string> = {
    draft: '■ Draft',
    nomination_open: '◷ Nominations',
    voting_open: '● Live',
    closed: '■ Closed',
  }
  return map[status] || status.replace('_', ' ')
}

export default async function ElectionsPage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?intent=voter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) redirect('/login?intent=voter')

  // RLS already filters elections by eligibility
  const { data: elections, error: electionsError } = await supabase
    .from('elections')
    .select('*')
    .order('opens_at', { ascending: false })

  // Compute turnout for closed elections via RPC
  const turnoutMap: Record<string, string> = {}
  const closedElections = (elections ?? []).filter((e: Election) => e.status === 'closed')

  if (closedElections.length > 0) {
    await Promise.all(
      closedElections.map(async (e: Election) => {
        const { data: results } = await supabase.rpc('get_election_results', { p_election_id: e.id })
        const votesCast = (results ?? []).reduce((sum: number, r: { vote_count: number | string }) => sum + Number(r.vote_count), 0)

        let voterQuery = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'voter')

        if (profile.institution_id) {
          voterQuery = voterQuery.eq('institution_id', profile.institution_id)
        }
        if (e.scope_department) {
          voterQuery = voterQuery.eq('department', e.scope_department)
        }
        if (e.scope_year) {
          voterQuery = voterQuery.eq('year', e.scope_year)
        }
        const { count: eligibleCount } = await voterQuery
        if (eligibleCount && eligibleCount > 0) {
          const pct = Math.min(100, Math.round((votesCast / eligibleCount) * 100))
          turnoutMap[e.id] = `${pct}% voted`
        } else {
          turnoutMap[e.id] = `${votesCast} ${votesCast === 1 ? 'vote' : 'votes'}`
        }
      })
    )
  }

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        {searchParams?.from && (
          <div className="rounded-2xl border border-yellow-900 bg-yellow-950/20 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
              You were redirected from {searchParams.from} — your role lands here. Manage elections from your admin dashboard instead.
            </p>
          </div>
        )}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-white/10 pb-6">
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-widest">Elections</h1>
        </header>

        {electionsError ? (
          <div className="py-10 px-6 text-center rounded-2xl border border-red-900 bg-red-950/20" role="alert">
            <p className="text-sm font-bold uppercase tracking-widest text-red-400">Couldn&apos;t load elections</p>
            <p className="mt-2 text-xs text-zinc-400">Check your connection and refresh. If this persists, your account may not be linked to a roster — contact your institution admin.</p>
          </div>
        ) : (!elections || elections.length === 0) ? (
          <div className="py-16 px-6 text-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02]">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-300">No elections for you right now</p>
            <p className="mt-2 text-xs text-zinc-500">None match your department and year, or none are open yet. Check back soon — or confirm your college email is on the roster.</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {(elections ?? []).map((e: Election) => (
              <li key={e.id} className={`relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-6 sm:p-8 hover:border-yellow-400/50 hover:shadow-neon-yellow transition-all ${e.status === 'voting_open' ? 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-l-2xl before:bg-green-400' : ''}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-2">
                    <h2 className="font-bold text-2xl uppercase tracking-wider">{e.title}</h2>
                    <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400 font-bold">
                      <span>{e.scope_department ? `Dept: ${e.scope_department}` : 'Institution-wide'}{e.scope_year ? ` · Year ${e.scope_year}` : ''}</span>
                      <span title={`Opens ${new Date(e.opens_at).toLocaleString()} · Closes ${new Date(e.closes_at).toLocaleString()}`}>{new Date(e.opens_at).toLocaleDateString()} — {new Date(e.closes_at).toLocaleDateString()}</span>
                      {e.status === 'voting_open' && (
                        <LiveCountdown closesAt={e.closes_at} />
                      )}
                      {e.status === 'nomination_open' && (
                        <LiveCountdown closesAt={e.closes_at} label="Nominations close in" closedLabel="Nominations closed" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] px-3 py-1 uppercase font-bold tracking-widest border rounded-full ${statusBadge(e.status)}`}>
                      {statusLabel(e.status)}
                    </span>
                    {e.status === 'closed' && turnoutMap[e.id] && (
                      <span className="text-[10px] px-3 py-1 uppercase font-bold tracking-widest border rounded-full border-white/15 bg-white/5 text-white font-mono">
                        {turnoutMap[e.id]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  {e.status === 'voting_open' ? (
                    <>
                      <Link href={`/elections/${e.id}/vote`} className="inline-flex items-center min-h-[44px] px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest bg-yellow-400 text-black hover:bg-yellow-300 shadow-neon-yellow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                        Vote Now
                      </Link>
                      <Link href={`/elections/${e.id}/candidates`} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-zinc-400 border border-white/10 hover:text-white hover:border-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
                        Meet the candidates
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href={`/elections/${e.id}/candidates`} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-white border border-white/20 hover:border-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
                        View Candidates
                      </Link>
                      {e.status === 'nomination_open' && (
                        <Link href={`/elections/${e.id}/nominate`} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-yellow-300 border border-yellow-400/40 bg-yellow-400/10 hover:border-yellow-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
                          Self-Nominate
                        </Link>
                      )}
                      {e.status === 'closed' && (
                        <Link href={`/elections/${e.id}/results`} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-zinc-300 border border-white/15 hover:text-white hover:border-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
                          Results
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
