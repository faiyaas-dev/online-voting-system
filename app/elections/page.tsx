import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Election, Profile } from '@/lib/supabase/types'
import LiveCountdown from '@/components/LiveCountdown'

function statusBadge(status: Election['status']) {
  const map: Record<string, string> = {
    draft: 'border-gray-700 text-gray-500',
    nomination_open: 'border-yellow-500 text-yellow-500',
    voting_open: 'border-green-500 text-green-500',
    closed: 'border-red-500 text-red-500',
  }
  return map[status] || 'border-gray-700 text-gray-500'
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
  const { data: elections } = await supabase
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
    <main className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        {searchParams?.from && (
          <div className="border border-yellow-900 bg-yellow-950/20 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
              You were redirected from {searchParams.from} — your role lands here. Manage elections from your admin dashboard instead.
            </p>
          </div>
        )}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-extrabold uppercase tracking-widest">Elections</h1>
        </header>

        {(!elections || elections.length === 0) ? (
          <div className="py-12 text-center text-gray-500 uppercase tracking-widest text-sm font-bold border border-gray-900 border-dashed">
            No elections currently available.
          </div>
        ) : (
          <ul className="space-y-6">
            {(elections ?? []).map((e: Election) => (
              <li key={e.id} className="border border-gray-800 bg-transparent p-6 sm:p-8 hover:border-gray-600 transition-colors">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-2">
                    <h2 className="font-bold text-2xl uppercase tracking-wider">{e.title}</h2>
                    <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-gray-400 font-bold">
                      <span>{e.scope_department ? `Dept: ${e.scope_department}` : 'Institution-wide'}{e.scope_year ? ` · Year ${e.scope_year}` : ''}</span>
                      <span>{new Date(e.opens_at).toLocaleDateString()} — {new Date(e.closes_at).toLocaleDateString()}</span>
                      {e.status === 'voting_open' && (
                        <span className="text-green-400">
                          <LiveCountdown closesAt={e.closes_at} />
                        </span>
                      )}
                      {e.status === 'nomination_open' && (
                        <span className="text-yellow-400">
                          <LiveCountdown closesAt={e.closes_at} label="Nominations close in" closedLabel="Nominations closed" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] px-3 py-1 uppercase font-bold tracking-widest border ${statusBadge(e.status)}`}>
                      {e.status.replace('_', ' ')}
                    </span>
                    {e.status === 'closed' && turnoutMap[e.id] && (
                      <span className="text-[10px] px-3 py-1 uppercase font-bold tracking-widest border border-gray-700 text-gray-300">
                        {turnoutMap[e.id]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={`/elections/${e.id}/candidates`} className="inline-flex items-center min-h-[44px] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white border border-gray-700 hover:border-white transition-colors">
                    View Candidates
                  </Link>
                  {e.status === 'nomination_open' && (
                    <Link href={`/elections/${e.id}/nominate`} className="inline-flex items-center min-h-[44px] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-yellow-500 border border-yellow-900 hover:border-yellow-500 transition-colors">
                      Self-Nominate
                    </Link>
                  )}
                  {e.status === 'voting_open' && (
                    <Link href={`/elections/${e.id}/vote`} className="inline-flex items-center min-h-[44px] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-green-500 border border-green-900 hover:border-green-500 transition-colors">
                      Vote Now
                    </Link>
                  )}
                  {e.status === 'closed' && (
                    <Link href={`/elections/${e.id}/results`} className="inline-flex items-center min-h-[44px] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 border border-gray-800 hover:text-white hover:border-white transition-colors">
                      Results
                    </Link>
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
