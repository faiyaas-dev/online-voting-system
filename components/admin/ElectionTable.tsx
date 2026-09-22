'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Election } from '@/lib/supabase/types'

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['nomination_open'],
  nomination_open: ['voting_open', 'draft'],
  voting_open: ['closed'],
  closed: [],
}

const STATUS_CHIP: Record<string, string> = {
  draft: 'border-white/20 text-zinc-400 bg-white/5',
  nomination_open: 'border-yellow-400/50 text-yellow-300 bg-yellow-400/10',
  voting_open: 'border-green-400/50 text-green-300 bg-green-400/10',
  closed: 'border-white/20 text-zinc-500 bg-transparent',
}

export default function ElectionTable({ elections }: { elections: Election[] }) {
  const supabase = createClient()
  const [updating, setUpdating] = useState<string | null>(null)
  const [localElections, setLocalElections] = useState(elections)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Sync when the server list changes (e.g. election just created in the form above).
  useEffect(() => {
    setLocalElections(elections)
  }, [elections])

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    setError('')
    const { error } = await supabase.from('elections').update({ status }).eq('id', id)
    if (!error) {
      setLocalElections(prev => prev.map(e => e.id === id ? { ...e, status: status as any } : e))
      setConfirmKey(null)
    } else {
      // Surface failure — stale UI was the prior defect; keep the row and explain.
      setError(`Could not move election to "${status.replace('_', ' ')}": ${error.message}`)
    }
    setUpdating(null)
  }

  if (localElections.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-zinc-500">No elections yet.</p>
        <p className="mt-1 text-xs text-zinc-600">Create one below — it will appear here with its schedule.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {error && <p role="alert" className="text-red-400 text-sm mb-2">{error}</p>}
      <table className="w-full min-w-[640px] text-sm border-collapse text-white">
        <caption className="sr-only">Elections with schedule, status, and state transitions</caption>
        <thead>
          <tr className="border-b border-white/10 text-left text-zinc-400 text-xs uppercase tracking-widest">
            <th scope="col" className="py-2 px-2 font-bold">Title</th>
            <th scope="col" className="py-2 px-2 font-bold">Scope</th>
            <th scope="col" className="py-2 px-2 font-bold">Schedule</th>
            <th scope="col" className="py-2 px-2 font-bold">Status</th>
            <th scope="col" className="py-2 px-2 font-bold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {localElections.map(e => (
            <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
              <td className="py-3 px-2 text-white font-semibold">{e.title}</td>
              <td className="py-3 px-2 text-zinc-400 text-xs whitespace-nowrap">
                {e.scope_department ?? 'All depts'} · {e.scope_year ?? 'All years'}
              </td>
              <td className="py-3 px-2 text-zinc-400 text-xs font-mono whitespace-nowrap" title={`Opens ${new Date(e.opens_at).toLocaleString()} · Closes ${new Date(e.closes_at).toLocaleString()}`}>
                {new Date(e.opens_at).toLocaleDateString()} → {new Date(e.closes_at).toLocaleDateString()}
              </td>
              <td className="py-3 px-2">
                <span className={`inline-block whitespace-nowrap text-[10px] px-2.5 py-1 uppercase font-bold tracking-widest border rounded-full ${STATUS_CHIP[e.status] ?? STATUS_CHIP.draft}`}>
                  {e.status.replace('_', ' ')}
                </span>
              </td>
              <td className="py-3 px-2 flex gap-2 flex-wrap">
                {STATUS_TRANSITIONS[e.status]?.map(next => {
                  const key = `${e.id}:${next}`
                  if (confirmKey === key) {
                    return (
                      <span key={next} className="inline-flex gap-1 items-center">
                        <span className="text-xs text-zinc-400">→ {next.replace('_', ' ')}?</span>
                        <button
                          disabled={updating === e.id}
                          onClick={() => updateStatus(e.id, next)}
                          className="min-h-[44px] min-w-[44px] text-xs font-bold border border-yellow-400 bg-yellow-400 text-black px-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200"
                        >
                          Confirm
                        </button>
                        <button
                          disabled={updating === e.id}
                          onClick={() => setConfirmKey(null)}
                          className="min-h-[44px] min-w-[44px] text-xs border border-white/20 text-zinc-300 px-2 hover:bg-white/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                        >
                          Cancel
                        </button>
                      </span>
                    )
                  }
                  return (
                    <button
                      key={next}
                      disabled={updating === e.id}
                      onClick={() => { setError(''); setConfirmKey(key) }}
                      className="min-h-[44px] min-w-[44px] text-xs border border-white/20 text-white px-2 hover:border-white/50 hover:bg-white/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                    >
                      → {next.replace('_', ' ')}
                    </button>
                  )
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
