'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Candidate } from '@/lib/supabase/types'
import LiveCountdown from '@/components/LiveCountdown'

export default function VotePage({ params }: { params: { id: string } }) {
  const [supabase] = useState(() => createClient())
  const electionId = params.id

  const [candidates, setCandidates] = useState<(Candidate & { profiles: any })[]>([])
  const [election, setElection] = useState<any>(null)
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alreadyVoted, setAlreadyVoted] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: el } = await supabase.from('elections').select('*').eq('id', electionId).single()
      setElection(el)

      const { data: cands } = await supabase
        .from('candidates')
        .select('*, profiles(full_name, roll_no, department)')
        .eq('election_id', electionId)
        .eq('status', 'approved')
      setCandidates((cands as any) ?? [])

      // Check if already voted
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('election_id', electionId)
        .eq('voter_id', user.id)
        .single()
      if (existingVote) setAlreadyVoted(true)

      setLoading(false)
    }
    load()
  }, [electionId, supabase])

  async function castVote(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setError('')
    setSubmitting(true)

    const { error } = await supabase.from('votes').insert({
      voter_id: userId,
      election_id: electionId,
      candidate_id: selected,
    })

    setSubmitting(false)
    if (error) {
      if (error.code === '23505') setError('You have already voted in this election.')
      else setError(error.message)
      return
    }
    setAlreadyVoted(true)
    setSuccess(true)
  }

  if (loading) return <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen"><p className="text-gray-400">Loading…</p></main>

  if (!election || election.status !== 'voting_open') return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <p className="text-red-500 font-bold uppercase tracking-widest text-sm">Voting is not currently open for this election.</p>
      <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mt-4 inline-block">← Elections</Link>
    </main>
  )

  if (alreadyVoted && !success) return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <p className="text-green-500 font-medium">You have already cast your vote in this election.</p>
      <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mt-4 inline-block">← Elections</Link>
    </main>
  )

  if (success) return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <p role="status" className="text-green-500 font-medium">✓ Vote cast successfully. Thank you!</p>
      <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mt-4 inline-block">← Elections</Link>
    </main>
  )

  return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <Link href={`/elections/${electionId}/candidates`} className="text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-white border-b border-transparent hover:border-white pb-1 transition-colors mb-8 inline-block">← Candidates</Link>
      <h1 className="text-2xl font-extrabold uppercase tracking-widest mb-8">Vote: {election.title}</h1>
      <p className="mb-8 text-xs font-bold uppercase tracking-widest text-green-400">
        <LiveCountdown closesAt={election.closes_at} />
      </p>
      <form onSubmit={castVote} className="flex flex-col gap-8">
        <fieldset>
          <legend className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Select one candidate</legend>
          <div className="flex flex-col gap-4">
            {candidates.map(c => (
              <label key={c.id} className={`flex items-start gap-4 border ${selected === c.id ? 'border-white bg-gray-900' : 'border-gray-800 bg-transparent'} p-4 cursor-pointer hover:border-gray-500 transition-colors`}>
                <input
                  type="radio"
                  name="candidate"
                  value={c.id}
                  checked={selected === c.id}
                  onChange={() => setSelected(c.id)}
                  className="mt-1"
                />
                <div>
                  <p className="font-bold text-lg">{c.profiles?.full_name ?? 'Unknown'}</p>
                  <p className="text-xs uppercase tracking-widest text-gray-500 mt-1">{c.profiles?.roll_no} · {c.profiles?.department}</p>
                  {c.manifesto && (
                    <div>
                      <p className={`text-sm text-gray-400 mt-3 ${expandedId === c.id ? 'whitespace-pre-line' : 'line-clamp-2'}`}>{c.manifesto}</p>
                      {c.manifesto.length > 120 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                          className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-300 underline"
                        >
                          {expandedId === c.id ? 'Show less' : 'Read full manifesto'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-red-500 text-sm font-bold uppercase tracking-wide">{error}</p>}
        <button
          type="submit"
          disabled={!selected || submitting}
          className="bg-white text-black font-bold uppercase tracking-widest py-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Casting vote…' : 'Cast Vote'}
        </button>
      </form>
    </main>
  )
}
