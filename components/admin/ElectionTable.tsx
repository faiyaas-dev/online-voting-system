'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Election } from '@/lib/supabase/types'

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['nomination_open'],
  nomination_open: ['voting_open', 'draft'],
  voting_open: ['closed'],
  closed: [],
}

export default function ElectionTable({ elections }: { elections: Election[] }) {
  const supabase = createClient()
  const [updating, setUpdating] = useState<string | null>(null)
  const [localElections, setLocalElections] = useState(elections)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [error, setError] = useState('')

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

  if (localElections.length === 0) return <p className="text-gray-500 text-sm">No elections yet.</p>

  return (
    <div className="overflow-x-auto">
      {error && <p role="alert" className="text-red-400 text-sm mb-2">{error}</p>}
      <table className="w-full text-sm border-collapse text-white">
        <thead>
          <tr className="border-b border-gray-800 text-left text-gray-400">
            <th className="py-2 px-2 font-normal">Title</th>
            <th className="py-2 px-2 font-normal">Scope</th>
            <th className="py-2 px-2 font-normal">Status</th>
            <th className="py-2 px-2 font-normal">Actions</th>
          </tr>
        </thead>
        <tbody>
          {localElections.map(e => (
            <tr key={e.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
              <td className="py-2 px-2 text-white">{e.title}</td>
              <td className="py-2 px-2 text-gray-400 text-xs">
                {e.scope_department ?? 'All depts'} · {e.scope_year ?? 'All years'}
              </td>
              <td className="py-2 px-2">
                <span className="text-xs font-medium text-white">{e.status.replace('_', ' ')}</span>
              </td>
              <td className="py-2 px-2 flex gap-2 flex-wrap">
                {STATUS_TRANSITIONS[e.status]?.map(next => {
                  const key = `${e.id}:${next}`
                  if (confirmKey === key) {
                    return (
                      <span key={next} className="inline-flex gap-1 items-center">
                        <span className="text-xs text-gray-400">→ {next.replace('_', ' ')}?</span>
                        <button
                          disabled={updating === e.id}
                          onClick={() => updateStatus(e.id, next)}
                          className="min-h-[44px] min-w-[44px] text-xs border border-gray-700 bg-white text-black px-2 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          disabled={updating === e.id}
                          onClick={() => setConfirmKey(null)}
                          className="min-h-[44px] min-w-[44px] text-xs border border-gray-700 text-gray-300 px-2 hover:bg-gray-800 disabled:opacity-50"
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
                      className="min-h-[44px] min-w-[44px] text-xs border border-gray-700 text-white px-2 hover:bg-gray-800 disabled:opacity-50"
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
