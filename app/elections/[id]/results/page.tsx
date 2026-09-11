import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ElectionResult, Candidate } from '@/lib/supabase/types'

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
      <main className="max-w-lg mx-auto p-6">
        <Link href="/elections" className="text-sm text-blue-600 underline mb-4 inline-block">← Elections</Link>
        <h1 className="text-xl font-bold mb-2">{election.title} — Results</h1>
        <p className="text-orange-600">{error.message}</p>
      </main>
    )
  }

  // Load candidate names for display
  const candidateIds = (results as ElectionResult[]).map(r => r.candidate_id)
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, profiles(full_name, roll_no)')
    .in('id', candidateIds.length > 0 ? candidateIds : ['00000000-0000-0000-0000-000000000000'])

  const nameMap = Object.fromEntries(
    (candidates ?? []).map((c: any) => [c.id, c.profiles?.full_name ?? 'Unknown'])
  )

  const sorted = [...(results as ElectionResult[])].sort((a, b) => Number(b.vote_count) - Number(a.vote_count))
  const winner = sorted[0]

  return (
    <main className="max-w-lg mx-auto p-6">
      <Link href="/elections" className="text-sm text-blue-600 underline mb-4 inline-block">← Elections</Link>
      <h1 className="text-xl font-bold mb-1">{election.title}</h1>
      <p className="text-sm text-gray-500 mb-4">Final results</p>

      {sorted.length === 0 && <p className="text-gray-500">No votes cast.</p>}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">Candidate</th>
            <th className="py-2 text-right">Votes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.candidate_id} className={`border-b ${r.candidate_id === winner?.candidate_id ? 'font-bold bg-green-50' : ''}`}>
              <td className="py-2 pr-4">
                {nameMap[r.candidate_id]}
                {r.candidate_id === winner?.candidate_id && ' 🏆'}
              </td>
              <td className="py-2 text-right">{String(r.vote_count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
