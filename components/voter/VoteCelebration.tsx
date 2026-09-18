'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function VoteCelebration({ electionTitle }: { electionTitle: string }) {
  const [particles, setParticles] = useState<{ id: number; left: number; delay: number; emoji: string }[]>([])

  useEffect(() => {
    const emojis = ['🗳️', '✨', '🎉', '🌟', '🎖️', '🗽']
    const items = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 90 + 5,
      delay: Math.random() * 0.4,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }))
    setParticles(items)
  }, [])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-950/40 via-zinc-900 to-black p-8 text-center text-white shadow-2xl">
      {/* Floating Sparkles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute text-xl animate-bounce"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: '1.4s',
              top: '15%',
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <div className="relative z-10 space-y-4">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
          <span className="live-pulse-dot h-2 w-2 rounded-full bg-blue-400" />
          Ballot Sealed & Cryptographically Hashed
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          You made your voice heard! 🗳️
        </h2>

        <p className="text-zinc-400 max-w-md mx-auto text-sm leading-relaxed">
          Your vote for <span className="font-semibold text-white">{electionTitle}</span> has been irreversibly logged to the institution ledger.
        </p>

        {/* Shareable Badge */}
        <div className="my-6 inline-block rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-inner">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            I VOTED TODAY • 2026
          </div>
          <p className="text-xs text-zinc-500 mt-1">Official Collegiate Democratic Participant</p>
        </div>

        <div className="pt-2">
          <Link
            href="/elections"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-zinc-200 hover:scale-105 active:scale-95"
          >
            Back to Active Elections →
          </Link>
        </div>
      </div>
    </div>
  )
}
