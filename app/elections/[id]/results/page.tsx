import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ElectionResult } from '@/lib/supabase/types'

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const electionId = params.id

  const { data: election } = await supabase
    .from('elections')
    .select('*')
    .eq('id', electionId)
    .single()

  if (!election) notFound()

  // Call RPC — returns error if not closed (unless caller is admin)
  const { data: results, error } = await supabase.rpc('get_election_results', {
    p_election_id: electionId,
  })

  if (error) {
    return (
      <main className="max-w-2xl mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
        <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-zinc-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mb-8 inline-block">← Elections</Link>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-widest mb-1">{election.title}</h1>
        <p className="text-xs uppercase tracking-widest text-zinc-400 mb-8 font-bold">Results</p>
        <div className="rounded-2xl border border-red-900 bg-red-950/20 p-4">
          <p className="text-xs uppercase tracking-widest font-bold text-red-400">{error.message}</p>
          <p className="mt-2 text-[11px] text-zinc-400">
            Results unlock automatically when the election closes — tallies stay sealed until then.
          </p>
        </div>
      </main>
    )
  }

  // Load all approved candidates to ensure complete display
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, profiles(full_name, roll_no)')
    .eq('election_id', electionId)
    .eq('status', 'approved')

  const candidateMap = new Map<string, string>()
  for (const c of (candidates ?? [])) {
    candidateMap.set(c.id, (c.profiles as any)?.full_name ?? 'Unknown')
  }

  const resultMap = new Map<string, number>()
  for (const r of ((results as ElectionResult[]) ?? [])) {
    resultMap.set(r.candidate_id, Number(r.vote_count))
  }

  const candidateIds = Array.from(new Set([...Array.from(candidateMap.keys()), ...Array.from(resultMap.keys())]))
  const sorted = candidateIds
    .map(id => ({
      candidate_id: id,
      name: candidateMap.get(id) ?? 'Unknown',
      vote_count: resultMap.get(id) ?? 0,
    }))
    .sort((a, b) => b.vote_count - a.vote_count)

  const totalVotes = sorted.reduce((sum, r) => sum + r.vote_count, 0)
  const topCount = sorted.length > 0 ? sorted[0].vote_count : 0
  const winners = totalVotes > 0 ? sorted.filter(r => r.vote_count === topCount) : []
  const isTie = winners.length > 1
  const winner = !isTie && winners.length === 1 ? winners[0] : null

  return (
    <main className="max-w-2xl mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
      <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-zinc-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mb-8 inline-block">← Elections</Link>
      <h1 className="font-display text-2xl font-extrabold uppercase tracking-widest mb-1">{election.title}</h1>
      <p className="text-xs uppercase tracking-widest text-zinc-400 mb-8 font-bold">Final Results</p>

      {isTie ? (
        <div className="rounded-2xl border border-blue-400/40 bg-blue-400/[0.07] p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-400 text-black px-2 py-0.5 rounded-full inline-block mb-2">
              Tie — {winners.length} candidates
            </span>
            <p className="text-xl font-extrabold text-white">
              {winners.map(w => w.name).join(' · ')}
            </p>
            <p className="text-xs uppercase tracking-widest text-zinc-400 mt-1 font-mono">
              {topCount} {topCount === 1 ? 'vote' : 'votes'} each — returning officer to break the tie
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Total Votes Cast</p>
            <p className="text-2xl font-extrabold text-white font-mono">{totalVotes}</p>
          </div>
        </div>
      ) : winner ? (
        <div className="rounded-2xl border border-yellow-400/40 bg-gradient-to-br from-yellow-400/15 via-transparent to-united-blue/15 shadow-neon-yellow p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest bg-yellow-400 text-black px-2 py-0.5 rounded-full inline-block mb-2">
              Winner Declared
            </span>
            <p className="text-xl font-extrabold text-white flex items-center gap-2">
              <span aria-hidden="true">🏆</span> {winner.name}
            </p>
            <p className="text-xs uppercase tracking-widest text-zinc-400 mt-1 font-mono">
              {winner.vote_count} {winner.vote_count === 1 ? 'vote' : 'votes'} · {totalVotes > 0 ? Math.round((winner.vote_count / totalVotes) * 100) : 0}% of total
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Total Votes Cast</p>
            <p className="text-2xl font-extrabold text-white font-mono">{totalVotes}</p>
          </div>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 uppercase tracking-widest text-sm font-bold border border-dashed border-white/15 rounded-2xl">
          No candidates or votes recorded.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Visual Bar Chart */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Vote Distribution</h2>
            <div className="space-y-5" role="region" aria-label="Vote distribution chart">
              {sorted.map(r => {
                const isWinner = winner && r.candidate_id === winner.candidate_id && r.vote_count > 0
                const pct = totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0
                return (
                  <div key={r.candidate_id} className="space-y-1.5">
                    <div className="flex justify-between items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <span className="flex min-w-0 items-center gap-1.5 text-white">
                        <span className="truncate">{r.name}</span>
                        {isWinner && <span title="Winner" aria-hidden="true" className="shrink-0">🏆</span>}
                      </span>
                      <span className="shrink-0 text-zinc-400 font-mono tabular-nums">
                        {r.vote_count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-white/10 border border-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isWinner ? 'bg-gradient-to-r from-yellow-400 to-amber-500 shadow-neon-yellow' : 'bg-blue-500/70'}`}
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={r.vote_count}
                        aria-valuemin={0}
                        aria-valuemax={totalVotes}
                        aria-label={`${r.name}: ${r.vote_count} votes (${pct}%)`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabular breakdown — audit ledger */}
          <table className="w-full text-xs border-collapse rounded-xl overflow-hidden border border-white/10 font-mono">
            <caption className="sr-only">Vote tally by candidate for {election.title}</caption>
            <thead>
              <tr className="border-b border-white/10 text-left bg-white/5 text-zinc-300 uppercase tracking-wider">
                <th scope="col" className="p-3">Candidate</th>
                <th scope="col" className="p-3 text-right">Votes</th>
                <th scope="col" className="p-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const isWinner = winner && r.candidate_id === winner.candidate_id && r.vote_count > 0
                const pct = totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0
                return (
                  <tr key={r.candidate_id} className={`border-b border-white/5 odd:bg-white/[0.02] ${isWinner ? 'bg-yellow-400/10 text-yellow-300 font-bold' : 'text-zinc-300'}`}>
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <span className="truncate">{r.name}</span>
                        {isWinner && <span aria-hidden="true">🏆</span>}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.vote_count}</td>
                    <td className="p-3 text-right tabular-nums">{pct}%</td>
                  </tr>
                )
              })}
              <tr className="bg-white/5 text-white font-bold">
                <td className="p-3">Total</td>
                <td className="p-3 text-right tabular-nums">{totalVotes}</td>
                <td className="p-3 text-right tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
          <p className="font-mono text-[11px] text-zinc-500 text-center">
            Aggregated tally only — no individual ballots exposed.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/elections" className="inline-flex items-center min-h-[44px] px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest bg-yellow-400 text-black hover:bg-yellow-300 shadow-neon-yellow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200">
              More elections
            </Link>
            <Link href={`/elections/${electionId}/candidates`} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-zinc-300 border border-white/15 hover:text-white hover:border-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
              Meet the candidates
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
