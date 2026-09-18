'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RosterImportError } from '@/lib/supabase/types'

const ERROR_LABELS: Record<string, string> = {
  missing_email: 'Missing email',
  invalid_email_format: 'Invalid email format',
  missing_department: 'Missing department',
  missing_roll_no: 'Missing roll number',
  invalid_year: 'Invalid year',
  duplicate_email_in_batch: 'Duplicate email (within this upload)',
  duplicate_roll_no_in_batch: 'Duplicate roll number (within this upload)',
  duplicate_email_existing: 'Email already in roster',
}

/** Single page size shared by every import-error surface (P2-2). */
export const IMPORT_ERROR_PAGE_SIZE = 50

interface Props {
  institutionId: string
  /** Bump to re-fetch from the first page (e.g. after a fresh upload). */
  refreshKey?: number
  /** Heading rendered above the table. */
  title?: string
}

/**
 * Unified, paginated view over roster_import_errors — the single source of
 * truth for import failures. Replaces the old split-brain where the upload
 * form fetched 500 rows and the admin page showed 50.
 */
export default function RosterImportErrors({ institutionId, refreshKey = 0, title = 'Import Errors' }: Props) {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<RosterImportError[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setPage(0)
  }, [institutionId, refreshKey])

  useEffect(() => {
    let cancelled = false
    async function fetchPage() {
      setLoading(true)
      setError('')
      const from = page * IMPORT_ERROR_PAGE_SIZE
      const to = from + IMPORT_ERROR_PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('roster_import_errors')
        .select('*', { count: 'exact' })
        .eq('institution_id', institutionId)
        .order('imported_at', { ascending: false })
        .range(from, to)
      if (!cancelled) {
        if (error) setError(error.message)
        else {
          setRows((data as RosterImportError[]) ?? [])
          setTotal(count ?? 0)
        }
        setLoading(false)
      }
    }
    fetchPage()
    return () => { cancelled = true }
  }, [institutionId, refreshKey, page, supabase])

  const grouped = rows.reduce<Record<string, RosterImportError[]>>((acc, row) => {
    if (!acc[row.error_reason]) acc[row.error_reason] = []
    acc[row.error_reason].push(row)
    return acc
  }, {})

  function downloadPageCSV() {
    const headers = ['row_number', 'error_reason', 'email', 'roll_no', 'department', 'year', 'full_name', 'imported_at']
    const body = rows.map(e => [e.row_number, e.error_reason, e.raw_row.email ?? '', e.raw_row.roll_no ?? '', e.raw_row.department ?? '', e.raw_row.year ?? '', e.raw_row.full_name ?? '', e.imported_at])
    const csv = [headers, ...body].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `roster-errors-page-${page + 1}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const pageCount = Math.max(1, Math.ceil(total / IMPORT_ERROR_PAGE_SIZE))

  if (loading && rows.length === 0) return <p className="text-sm text-gray-500">Loading error details…</p>
  if (!loading && total === 0 && !error) return <p className="text-sm text-gray-500">No import errors recorded.</p>

  return (
    <div className="rounded border border-red-900 bg-red-950/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-red-300">
          {title} — {total} row{total === 1 ? '' : 's'}
          {pageCount > 1 && <span className="text-red-400/70"> · page {page + 1} of {pageCount}</span>}
        </h3>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={downloadPageCSV}
            className="min-h-[44px] rounded border border-blue-700 px-3 text-xs text-blue-300 hover:bg-blue-950"
          >
            ↓ Download this page
          </button>
        )}
      </div>
      {error && <p role="alert" className="mb-2 text-sm text-red-400">{error}</p>}
      {Object.entries(grouped).map(([reason, reasonRows]) => (
        <div key={reason} className="mb-4 overflow-x-auto last:mb-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-300">{ERROR_LABELS[reason] ?? reason} ({reasonRows.length})</p>
          <table className="w-full text-xs">
            <tbody>
              {reasonRows.map(row => (
                <tr key={row.id} className="border-b border-red-900 last:border-0">
                  <td className="px-2 py-1 text-gray-300">{row.row_number}</td>
                  <td className="px-2 py-1 text-gray-300">{row.raw_row.email ?? '—'}</td>
                  <td className="px-2 py-1 text-gray-300">{row.raw_row.roll_no ?? '—'}</td>
                  <td className="px-2 py-1 text-gray-300">{row.raw_row.department ?? '—'}</td>
                  <td className="px-2 py-1 text-gray-300">{row.raw_row.year ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {pageCount > 1 && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-red-900 pt-3">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="min-h-[44px] min-w-[44px] rounded border border-gray-700 px-4 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">Page {page + 1} of {pageCount}</span>
          <button
            type="button"
            disabled={page >= pageCount - 1 || loading}
            onClick={() => setPage(p => p + 1)}
            className="min-h-[44px] min-w-[44px] rounded border border-gray-700 px-4 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
