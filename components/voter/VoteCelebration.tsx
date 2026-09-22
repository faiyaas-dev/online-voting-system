'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function VoteCelebration({ electionTitle }: { electionTitle: string }) {
  const [particles, setParticles] = useState<{ id: number; left: number; delay: number; emoji: string }[]>([])

  useEffect(() => {
    const emojis = ['🗳️', '💙', '💛', '✨']
    const items = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 90 + 5,
      delay: Math.random() * 0.4,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }))
    setParticles(items)
  }, [])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 bg-gradient-to-b from-yellow-400/15 via-zinc-900 to-black p-8 text-center text-white shadow-neon-yellow">
      {/* Floating particles — civic palette only, float-up motion */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute text-xl animate-float-up"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              top: '15%',
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <div className="relative z-10 space-y-4">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-yellow-300">
          <span className="live-pulse-dot h-2 w-2 rounded-full bg-yellow-400" />
          Ballot Sealed
        </div>

        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          You made your voice heard! 🗳️
        </h2>

        <p className="text-zinc-400 max-w-md mx-auto text-sm leading-relaxed">
          Your vote for <span className="font-semibold text-white">{electionTitle}</span> has been irreversibly logged to the institution ledger.
        </p>
        <p className="text-sm font-semibold text-yellow-300">Vote cast successfully.</p>

        {/* Shareable Badge */}
        <div className="my-6 inline-block rounded-xl border border-yellow-400/30 bg-zinc-950 p-4 shadow-inner">
          <div className="text-2xl font-bold bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent">
            I VOTED TODAY • 2026
          </div>
          <p className="text-xs text-zinc-500 mt-1">Verified Voter · Anonymized Ballot</p>
        </div>

        <p className="font-mono text-[11px] text-zinc-500">
          Sealed · Counted in public tally · No identity linked
        </p>

        <div className="pt-2">
          <Link
            href="/elections"
            className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-yellow-300 hover:shadow-neon-yellow hover:scale-105 active:scale-95"
          >
            Back to Active Elections →
          </Link>
        </div>
      </div>
    </div>
  )
}
