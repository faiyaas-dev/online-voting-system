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
      <main className="max-w-2xl mx-auto p-6 bg-black text-white min-h-screen">
        <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mb-8 inline-block">← Elections</Link>
        <h1 className="text-2xl font-extrabold uppercase tracking-widest mb-1">{election.title}</h1>
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-8 font-bold">Results</p>
        <div className="border border-red-900 bg-red-950/20 p-4">
          <p className="text-xs uppercase tracking-widest font-bold text-red-400">{error.message}</p>
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
  const winner = totalVotes > 0 ? sorted[0] : null

  return (
    <main className="max-w-2xl mx-auto p-6 bg-black text-white min-h-screen">
      <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mb-8 inline-block">← Elections</Link>
      <h1 className="text-2xl font-extrabold uppercase tracking-widest mb-1">{election.title}</h1>
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-8 font-bold">Final Results</p>

      {winner && (
        <div className="border border-green-500/40 bg-green-950/20 p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-green-400 border border-green-500/50 px-2 py-0.5 inline-block mb-2">
              Winner Declared
            </span>
            <p className="text-xl font-extrabold text-white flex items-center gap-2">
              <span>🏆</span> {winner.name}
            </p>
            <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">
              {winner.vote_count} {winner.vote_count === 1 ? 'vote' : 'votes'} · {totalVotes > 0 ? Math.round((winner.vote_count / totalVotes) * 100) : 0}% of total
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">Total Votes Cast</p>
            <p className="text-2xl font-extrabold text-white">{totalVotes}</p>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="py-12 text-center text-gray-500 uppercase tracking-widest text-sm font-bold border border-gray-900 border-dashed">
          No candidates or votes recorded.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Visual Bar Chart */}
          <div className="border border-gray-800 bg-transparent p-6 space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Vote Distribution</h2>
            <div className="space-y-5" role="region" aria-label="Vote distribution chart">
              {sorted.map(r => {
                const isWinner = winner && r.candidate_id === winner.candidate_id && r.vote_count > 0
                const pct = totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0
                return (
                  <div key={r.candidate_id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 text-white">
                        {r.name}
                        {isWinner && <span title="Winner">🏆</span>}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {r.vote_count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-3 w-full bg-gray-900 border border-gray-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isWinner ? 'bg-emerald-500' : 'bg-gray-600'}`}
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

          {/* Tabular breakdown */}
          <table className="w-full text-xs border-collapse border border-gray-800 font-mono">
            <thead>
              <tr className="border-b border-gray-800 text-left bg-gray-950 text-gray-400 uppercase tracking-wider">
                <th className="p-3">Candidate</th>
                <th className="p-3 text-right">Votes</th>
                <th className="p-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const isWinner = winner && r.candidate_id === winner.candidate_id && r.vote_count > 0
                const pct = totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0
                return (
                  <tr key={r.candidate_id} className={`border-b border-gray-900 ${isWinner ? 'bg-green-950/20 text-white font-bold' : 'text-gray-300'}`}>
                    <td className="p-3 flex items-center gap-2">
                      {r.name}
                      {isWinner && ' 🏆'}
                    </td>
                    <td className="p-3 text-right">{r.vote_count}</td>
                    <td className="p-3 text-right">{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
