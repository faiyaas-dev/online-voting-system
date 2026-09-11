'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CandidateStatus } from '@/lib/supabase/types'

interface CandidateRow {
  id: string
  status: CandidateStatus
  manifesto: string | null
  profiles: { full_name: string | null; roll_no: string | null; department: string | null } | null
  elections: { title: string | null } | null
}

export default function CandidateApprovalTable({ candidates }: { candidates: CandidateRow[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState(candidates)
  const [processing, setProcessing] = useState<string | null>(null)

  async function decide(id: string, status: 'approved' | 'rejected') {
    setProcessing(id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('candidates')
      .update({ status, approved_by: user?.id })
      .eq('id', id)
    if (!error) {
      setRows(prev => prev.filter(c => c.id !== id))
    }
    setProcessing(null)
  }

  if (rows.length === 0) return <p className="text-gray-500 text-sm">No pending candidates.</p>

  return (
    <div className="flex flex-col gap-3">
      {rows.map(c => (
        <div key={c.id} className="border rounded p-3 bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{c.profiles?.full_name ?? 'Unknown'}</p>
              <p className="text-xs text-gray-500">{c.profiles?.roll_no} · {c.profiles?.department}</p>
              <p className="text-xs text-gray-400">Election: {c.elections?.title ?? '—'}</p>
              {c.manifesto && (
                <p className="mt-1 text-sm text-gray-700 line-clamp-3">{c.manifesto}</p>
              )}
            </div>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <button
                disabled={processing === c.id}
                onClick={() => decide(c.id, 'approved')}
                className="text-xs bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={processing === c.id}
                onClick={() => decide(c.id, 'rejected')}
                className="text-xs bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                Reject
            </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
