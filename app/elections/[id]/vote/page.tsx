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
  const [confirming, setConfirming] = useState(false)
  const selectedCandidate = candidates.find(c => c.id === selected) ?? null

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
    // Step 1 → review screen first; only seal from the confirm step.
    if (!confirming) {
      setConfirming(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
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
    <main className="max-w-lg mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
      <div className="flex items-center gap-3 text-zinc-400">
        <span className="live-pulse-dot h-2 w-2 rounded-full bg-yellow-400" />
        <p className="text-sm">Preparing ballot arena…</p>
      </div>
    </main>
  )

  if (!election || election.status !== 'voting_open') return (
    <main className="max-w-lg mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
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
      <main className="max-w-lg mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
        <VoteCelebration electionTitle={election?.title ?? 'Election'} />
      </main>
    )
  }

  if (alreadyVoted) return (
    <main className="max-w-lg mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-4">
        <div className="text-4xl">🛡️</div>
        <h2 className="text-xl font-bold">One Student, One Vote!</h2>
        <p className="text-sm text-zinc-400">
          You have already cast your vote in <span className="font-semibold text-white">{election.title}</span>. Anonymized and counted in the public tally — no ballot content exposed.
        </p>
        <p className="font-mono text-[11px] text-zinc-500">Your ballot is sealed · View results after close</p>
        <div className="pt-4">
          <Link href="/elections" className="inline-block rounded-full bg-white/[0.06] border border-white/15 hover:border-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all">← Back to Elections</Link>
        </div>
      </div>
    </main>
  )

  return (
    <main className="max-w-lg mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
      <Link href={`/elections/${electionId}/candidates`} className="text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white border-b border-transparent hover:border-white pb-1 transition-colors mb-6 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">← Candidates</Link>

      <h1 className="font-display text-2xl font-extrabold tracking-tight mb-4">Vote: {election.title}</h1>

      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={confirming ? 'Ballot progress: step 2 of 2' : 'Ballot progress: step 1 of 2'} aria-valuenow={confirming ? 2 : 1} aria-valuemin={1} aria-valuemax={2}>
        <div className={`h-full rounded-full bg-yellow-400 transition-all ${confirming ? 'w-full' : 'w-1/2'}`} />
      </div>
      <p className="mb-6 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
        {confirming ? 'Step 2 of 2 — Confirm your choice' : 'Step 1 of 2 — Select candidate'}
      </p>

      <div className="mb-8">
        <LiveCountdown closesAt={election.closes_at} />
      </div>

      {candidates.length === 0 ? (
        <div className="py-12 px-6 text-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02]">
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-300">No approved candidates yet</p>
          <p className="mt-2 text-xs text-zinc-500">Check back soon — nominations may still be under review.</p>
        </div>
      ) : confirming && selectedCandidate ? (
        <form onSubmit={castVote} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/[0.06] p-6 text-center space-y-3" aria-live="polite">
            <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-300">You are voting for</p>
            <p className="text-2xl font-extrabold text-white">{selectedCandidate.profiles?.full_name ?? 'Unknown'}</p>
            <p className="text-xs uppercase tracking-widest text-zinc-400">{selectedCandidate.profiles?.roll_no} · {selectedCandidate.profiles?.department}</p>
            <p className="text-xs text-zinc-500">One vote per election — this cannot be changed after sealing.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-400 text-sm font-medium" role="alert">
              ⚠️ {error}
            </div>
          )}

          <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0A0A0B]/95 backdrop-blur p-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-yellow-400 text-black font-bold uppercase tracking-widest py-4 shadow-neon-yellow hover:bg-yellow-300 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="live-pulse-dot h-2 w-2 rounded-full bg-black" />
                  Sealing your ballot…
                </span>
              ) : (
                '🗳️ Confirm & Seal Vote'
              )}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setError('') }}
              disabled={submitting}
              className="min-h-[44px] text-xs text-zinc-400 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded"
            >
              ← Back — change my choice
            </button>
          </div>
        </form>
      ) : (
      <form onSubmit={castVote} className="flex flex-col gap-8">
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Select your candidate</legend>
          <div className="flex flex-col gap-4">
            {candidates.map(c => {
              const isSel = selected === c.id
              const expanded = expandedId === c.id
              return (
                <div
                  key={c.id}
                  className={`candidate-card-interactive rounded-2xl border ${isSel ? 'candidate-card-selected bg-white/[0.05]' : 'border-white/10 bg-white/[0.02]'} p-5`}
                >
                  <label className="flex cursor-pointer items-start gap-4">
                    <input
                      type="radio"
                      name="candidate"
                      value={c.id}
                      checked={isSel}
                      onChange={() => setSelected(c.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#FFD700] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                    />
                    <span className="flex-1">
                      <span className="font-bold text-lg text-white flex items-center justify-between gap-2">
                        {c.profiles?.full_name ?? 'Unknown'}
                        {isSel && <span className="shrink-0 text-xs font-bold bg-yellow-400 text-black px-2 py-0.5 rounded-full">Selected</span>}
                      </span>
                      <span className="block text-xs uppercase tracking-wider text-zinc-500 mt-1">{c.profiles?.roll_no} · {c.profiles?.department}</span>
                    </span>
                  </label>
                  {c.manifesto && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/60">
                      <p className={`text-sm text-zinc-300 leading-relaxed ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>{c.manifesto}</p>
                      {c.manifesto.length > 120 && (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                          className="mt-2 min-h-[44px] px-1 py-2 text-xs font-semibold text-yellow-300 underline hover:text-yellow-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded"
                        >
                          {expanded ? '↑ Show less' : '↓ Read full manifesto'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-400 text-sm font-medium" role="alert">
            ⚠️ {error}
          </div>
        )}

        <div className="sticky bottom-4 rounded-2xl border border-white/10 bg-[#0A0A0B]/95 backdrop-blur p-4">
          <button
            type="submit"
            disabled={!selected || submitting}
            className="w-full rounded-full bg-yellow-400 text-black font-bold uppercase tracking-widest py-4 shadow-neon-yellow hover:bg-yellow-300 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Review ballot →
          </button>
        </div>
      </form>
      )}
    </main>
  )
}
