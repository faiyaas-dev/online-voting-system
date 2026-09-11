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

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    const { error } = await supabase.from('elections').update({ status }).eq('id', id)
    if (!error) {
      setLocalElections(prev => prev.map(e => e.id === id ? { ...e, status: status as any } : e))
    }
    setUpdating(null)
  }

  if (localElections.length === 0) return <p className="text-gray-500 text-sm">No elections yet.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left bg-gray-50">
            <th className="py-2 px-2">Title</th>
            <th className="py-2 px-2">Scope</th>
            <th className="py-2 px-2">Status</th>
            <th className="py-2 px-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {localElections.map(e => (
            <tr key={e.id} className="border-b hover:bg-gray-50">
              <td className="py-2 px-2">{e.title}</td>
              <td className="py-2 px-2 text-gray-500 text-xs">
                {e.scope_department ?? 'All depts'} · {e.scope_year ?? 'All years'}
              </td>
              <td className="py-2 px-2">
                <span className="text-xs font-medium">{e.status.replace('_', ' ')}</span>
              </td>
              <td className="py-2 px-2 flex gap-2 flex-wrap">
                {STATUS_TRANSITIONS[e.status]?.map(next => (
                  <button
                    key={next}
                    disabled={updating === e.id}
                    onClick={() => updateStatus(e.id, next)}
                    className="text-xs border rounded px-2 py-0.5 hover:bg-gray-100 disabled:opacity-50"
                  >
                    → {next.replace('_', ' ')}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
