'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Candidate } from '@/lib/supabase/types'
import LiveCountdown from '@/components/LiveCountdown'
import VoteCelebration from '@/components/voter/VoteCelebration'

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

  if (loading) return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <div className="flex items-center gap-3 text-zinc-400">
        <span className="live-pulse-dot h-2 w-2 rounded-full bg-blue-400" />
        <p className="text-sm">Preparing ballot arena…</p>
      </div>
    </main>
  )

  if (!election || election.status !== 'voting_open') return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-amber-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
          <span>🕊️</span> Voting is not currently open for this election.
        </p>
        <p className="text-xs text-zinc-400 mt-2">
          Polls open and close strictly according to the official timetable. Check back during voting hours!
        </p>
        <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-zinc-300 hover:text-white border-b border-zinc-700 hover:border-white pb-1 transition-colors mt-6 inline-block">← All Elections</Link>
      </div>
    </main>
  )

  if (success) {
    return (
      <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
        <VoteCelebration electionTitle={election?.title ?? 'Election'} />
      </main>
    )
  }

  if (alreadyVoted) return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center space-y-4">
        <div className="text-4xl">🛡️</div>
        <h2 className="text-xl font-bold">One Student, One Vote!</h2>
        <p className="text-sm text-zinc-400">
          Your ballot for <span className="font-semibold text-white">{election.title}</span> has already been securely cast and permanently sealed in the database.
        </p>
        <div className="pt-4">
          <Link href="/elections" className="inline-block rounded-lg bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all">← Back to Elections</Link>
        </div>
      </div>
    </main>
  )

  return (
    <main className="max-w-lg mx-auto p-6 bg-black text-white min-h-screen">
      <Link href={`/elections/${electionId}/candidates`} className="text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white border-b border-transparent hover:border-white pb-1 transition-colors mb-6 inline-block">← Candidates</Link>
      
      <h1 className="text-2xl font-extrabold tracking-tight mb-2">Vote: {election.title}</h1>
      
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs font-semibold text-green-400">
        <span className="live-pulse-dot h-2 w-2 rounded-full bg-green-400" />
        <LiveCountdown closesAt={election.closes_at} />
      </div>

      <form onSubmit={castVote} className="flex flex-col gap-8">
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Select your candidate</legend>
          <div className="flex flex-col gap-4">
            {candidates.map(c => {
              const isSel = selected === c.id
              return (
                <label
                  key={c.id}
                  className={`candidate-card-interactive relative flex items-start gap-4 rounded-xl border ${isSel ? 'candidate-card-selected bg-zinc-900/90' : 'border-zinc-800 bg-zinc-950'} p-5 cursor-pointer`}
                >
                  <input
                    type="radio"
                    name="candidate"
                    value={c.id}
                    checked={isSel}
                    onChange={() => setSelected(c.id)}
                    className="mt-1 h-4 w-4 accent-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="font-bold text-lg text-white flex items-center justify-between">
                      {c.profiles?.full_name ?? 'Unknown'}
                      {isSel && <span className="text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">Selected</span>}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mt-1">{c.profiles?.roll_no} · {c.profiles?.department}</p>
                    {c.manifesto && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/60">
                        <p className={`text-sm text-zinc-300 leading-relaxed ${expandedId === c.id ? 'whitespace-pre-line' : 'line-clamp-2'}`}>{c.manifesto}</p>
                        {c.manifesto.length > 120 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedId(prev => prev === c.id ? null : c.id)
                            }}
                            className="mt-2 min-h-[44px] px-1 py-2 text-xs font-semibold text-blue-400 underline hover:text-blue-300 transition-colors"
                          >
                            {expandedId === c.id ? '↑ Show less' : '↓ Read full manifesto'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </fieldset>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-400 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!selected || submitting}
          className="relative group overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold tracking-wide py-4 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="live-pulse-dot h-2 w-2 rounded-full bg-white" />
              Sealing your ballot…
            </span>
          ) : (
            '🗳️ Cast Ballot & Seal Vote'
          )}
        </button>
      </form>
    </main>
  )
}
