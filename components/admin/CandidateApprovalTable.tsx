'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CandidateStatus } from '@/lib/supabase/types'

interface CandidateRow {
  id: string
  status: CandidateStatus
  manifesto: string | null
  photo_path: string | null
  profiles: { full_name: string | null; roll_no: string | null; department: string | null } | null
  elections: { title: string | null } | null
}

interface UndoInfo {
  id: string
  timeout: NodeJS.Timeout | null
}

export default function CandidateApprovalTable({ candidates }: { candidates: CandidateRow[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState<CandidateRow[]>(candidates)
  const [processing, setProcessing] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [successNote, setSuccessNote] = useState<{ id: string; message: string } | null>(null)
  const [undo, setUndo] = useState<UndoInfo | null>(null)

  // Clear the success note after 5s. The Undo button lives inside the note,
  // so it stays available exactly as long as the note is visible.
  useEffect(() => {
    if (!successNote) return
    const id = successNote.id
    const timeout = setTimeout(async () => {
      setSuccessNote(prev => (prev?.id === id ? null : prev))
    }, 5000)
    setUndo({ id, timeout })
    return () => clearTimeout(timeout)
  }, [successNote])

  async function decide(id: string, status: 'approved' | 'rejected') {
    setProcessing(id)
    setError('')
    setSuccessNote(prev => prev?.id === id ? null : { id, message: '' })
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('candidates')
      .update({ status, approved_by: user?.id })
      .eq('id', id)
    if (!error) {
      // Move the decided row out of the pending section immediately so the
      // queue never shows stale state; Undo/Reinstate moves it back.
      setRows(prev => prev.map(c => (c.id === id ? { ...c, status } : c)))
      setSuccessNote({ id, message: `${status === 'approved' ? 'Approved' : 'Rejected'} successfully` })
      setConfirmId(null)
      setConfirmAction(null)
    } else {
      setError(`Could not ${status === 'approved' ? 'approve' : 'reject'} candidate: ${error.message}`)
      setSuccessNote(null)
    }
    setProcessing(null)
  }

  function requestConfirm(id: string, status: 'approved' | 'rejected') {
    setError('')
    setConfirmId(id)
    setConfirmAction(status)
  }

  async function reinstate(id: string) {
    setProcessing(id)
    setError('')
    try {
      const { error: updErr } = await supabase
        .from('candidates')
        .update({ status: 'pending', approved_by: null })
        .eq('id', id)
      if (updErr) throw updErr
      setRows(prev => prev.map(c => (c.id === id ? { ...c, status: 'pending' } : c)))
      setSuccessNote({ id, message: 'Reinstated to pending' })
      setUndo(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Failed to reinstate: ${msg}`)
    } finally {
      setProcessing(null)
    }
  }

  // Separate pending and decided rows for UI sections. Decided rows move
  // sections immediately (see decide); the rows effect below must NOT clear
  // the pending Undo — the success-note timeout owns that lifecycle.
  const electionTitles = Array.from(new Set(rows.map(r => r.elections?.title ?? '—')))
  const [electionFilter, setElectionFilter] = useState<string>('all')
  const visibleRows = rows.filter(r => electionFilter === 'all' || (r.elections?.title ?? '—') === electionFilter)
  const pendingRows = visibleRows.filter(r => r.status === 'pending')
  const rejectedRows = visibleRows.filter(r => r.status === 'rejected')

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-zinc-500">Queue clear — no pending candidates.</p>
        <p className="mt-1 text-xs text-zinc-600">New self-nominations will appear here for review.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      {electionTitles.length > 1 && (
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
          Election
          <select
            value={electionFilter}
            onChange={e => setElectionFilter(e.target.value)}
            className="min-h-[44px] bg-white/[0.03] border border-white/15 rounded-full px-4 text-xs font-bold uppercase tracking-widest text-white outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
          >
            <option value="all">All elections ({rows.length})</option>
            {electionTitles.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      )}

      {successNote && (
        <p role="alert" className="text-green-400 text-sm mb-3">
          {successNote.message}
          {undo?.timeout && (
            <button
              onClick={() => {
                clearTimeout(undo.timeout!)
                reinstate(undo.id)
                setSuccessNote(null)
                setUndo(null)
              }}
              className="underline text-green-300 hover:text-white text-sm"
            >
              Undo
            </button>
          )}
        </p>
      )}

      {/* Pending candidates section */}
      {pendingRows.length > 0 && (
        <div className="border-b border-white/10 pb-3 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Pending Candidates ({pendingRows.length})</h3>
          {pendingRows.map(c => (
            <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3 min-w-0">
                  <ApprovalPhoto path={c.photo_path} name={c.profiles?.full_name ?? 'Unknown'} />
                  <div className="min-w-0">
                    <p className="font-medium text-white">{c.profiles?.full_name ?? 'Unknown'}</p>
                    <p className="text-xs text-zinc-400">{c.profiles?.roll_no} · {c.profiles?.department}</p>
                    <p className="text-xs text-zinc-500">Election: {c.elections?.title ?? '—'}</p>
                  {c.manifesto && (
                    <div>
                      <p className={`mt-1 text-sm text-gray-300 ${expandedId === c.id ? 'whitespace-pre-line' : 'line-clamp-3'}`}>{c.manifesto}</p>
                      {c.manifesto.length > 140 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                          className="mt-1 min-h-[44px] text-xs text-gray-300 underline hover:text-white"
                        >
                          {expandedId === c.id ? 'Show less' : 'Read full manifesto'}
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  {confirmId === c.id ? (
                    <>
                      <span className="text-xs text-zinc-400 self-center">
                        {confirmAction === 'approved' ? 'Approve?' : 'Reject?'}
                      </span>
                      <button
                        disabled={processing === c.id}
                        onClick={() => confirmAction && decide(c.id, confirmAction)}
                        className="min-h-[44px] min-w-[44px] text-xs bg-green-600 text-white px-3 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        disabled={processing === c.id}
                        onClick={() => { setConfirmId(null); setConfirmAction(null) }}
                        className="min-h-[44px] min-w-[44px] text-xs border border-gray-700 text-gray-300 px-3 hover:bg-gray-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={processing === c.id}
                        onClick={() => requestConfirm(c.id, 'approved')}
                        className="min-h-[44px] min-w-[44px] text-xs bg-green-600 text-white px-3 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={processing === c.id}
                        onClick={() => requestConfirm(c.id, 'rejected')}
                        className="min-h-[44px] min-w-[44px] text-xs bg-red-600 text-white px-3 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejected candidates section */}
      {rejectedRows.length > 0 && (
        <div className="border-t border-white/10 pt-3 mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-2">Rejected Candidates</h3>
          {rejectedRows.map(c => (
            <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3 min-w-0">
                  <ApprovalPhoto path={c.photo_path} name={c.profiles?.full_name ?? 'Unknown'} />
                  <div className="min-w-0">
                    <p className="font-medium text-white">{c.profiles?.full_name ?? 'Unknown'}</p>
                    <p className="text-xs text-zinc-400">{c.profiles?.roll_no} · {c.profiles?.department}</p>
                    <p className="text-xs text-zinc-500">Election: {c.elections?.title ?? '—'}</p>
                  {c.manifesto && (
                    <div>
                      <p className={`mt-1 text-sm text-gray-300 ${expandedId === c.id ? 'whitespace-pre-line' : 'line-clamp-3'}`}>{c.manifesto}</p>
                      {c.manifesto.length > 140 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                          className="mt-1 min-h-[44px] text-xs text-gray-300 underline hover:text-white"
                        >
                          {expandedId === c.id ? 'Show less' : 'Read full manifesto'}
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  {confirmId === c.id ? (
                    <>
                      <span className="text-xs text-zinc-400 self-center">
                        {confirmAction === 'approved' ? 'Reinstate?' : 'Reject?'}
                      </span>
                      <button
                        disabled={processing === c.id}
                        onClick={() => confirmAction && decide(c.id, confirmAction)}
                        className="min-h-[44px] min-w-[44px] text-xs bg-green-600 text-white px-3 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        disabled={processing === c.id}
                        onClick={() => { setConfirmId(null); setConfirmAction(null) }}
                        className="min-h-[44px] min-w-[44px] text-xs border border-gray-700 text-gray-300 px-3 hover:bg-gray-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={processing === c.id}
                        onClick={() => requestConfirm(c.id, 'rejected')}
                        className="min-h-[44px] min-w-[44px] text-xs bg-red-600 text-white px-3 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      {c.status === 'rejected' && (
                        <button
                          disabled={processing === c.id}
                          onClick={() => reinstate(c.id)}
                          className="min-h-[44px] min-w-[44px] text-xs bg-yellow-600 text-white px-3 disabled:opacity-50"
                        >
                          Reinstate
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Approval photo: signed URL thumbnail so admins review the actual ballot
// photo, not just the manifesto. Falls back to an initial on signed-URL miss.
function ApprovalPhoto({ path, name }: { path: string | null; name: string }) {
  const supabase = createClient()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!path) return
    let live = true
    supabase.storage.from('candidate-photos').createSignedUrl(path, 3600).then(({ data }) => {
      if (live) setUrl(data?.signedUrl ?? null)
    })
    return () => { live = false }
  }, [path, supabase])

  if (!path || !url) {
    const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
    return (
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 font-display text-lg font-extrabold text-zinc-500">
        {initial}
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" aria-hidden="true" className="h-12 w-12 shrink-0 rounded-full border border-white/15 object-cover" />
}
