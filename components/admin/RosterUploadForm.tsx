'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RosterImportError } from '@/lib/supabase/types'

// Error reason → human-readable label
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

interface UploadResult {
  inserted: number
  errors: number
}

export default function RosterUploadForm({ institutionId }: { institutionId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  // Full error rows fetched from roster_import_errors after upload
  const [errorRows, setErrorRows] = useState<RosterImportError[]>([])
  const [loadingErrors, setLoadingErrors] = useState(false)

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploadError('')
    setResult(null)
    setErrorRows([])
    setLoading(true)

    const supabase = createClient()
    // F-13: Use getUser() for auth verification, then get session for access_token
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadError('Not authenticated'); setLoading(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUploadError('No active session'); setLoading(false); return }

    const form = new FormData()
    form.append('file', file)
    form.append('institution_id', institutionId)

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roster-csv-validate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      }
    )
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setUploadError(json.error ?? 'Upload failed'); return }

    setResult({ inserted: json.inserted, errors: json.errors })

    // If there were errors, fetch full rows from roster_import_errors
    if (json.errors > 0) {
      await fetchErrors(supabase)
    }
  }

  async function fetchErrors(supabase: ReturnType<typeof createClient>) {
    setLoadingErrors(true)
    const { data } = await supabase
      .from('roster_import_errors')
      .select('*')
      .eq('institution_id', institutionId)
      .order('imported_at', { ascending: false })
      .limit(500)
    setErrorRows((data as RosterImportError[]) ?? [])
    setLoadingErrors(false)
  }

  // Group errors by reason
  const grouped = errorRows.reduce<Record<string, RosterImportError[]>>((acc, row) => {
    const key = row.error_reason
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  function downloadErrorCSV() {
    const headers = ['row_number', 'error_reason', 'email', 'roll_no', 'department', 'year', 'full_name', 'imported_at']
    const rows = errorRows.map(e => [
      e.row_number,
      e.error_reason,
      e.raw_row.email ?? '',
      e.raw_row.roll_no ?? '',
      e.raw_row.department ?? '',
      e.raw_row.year ?? '',
      e.raw_row.full_name ?? '',
      e.imported_at,
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roster-errors-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Upload form ── */}
      <form onSubmit={upload} className="flex flex-col gap-3">
        <label htmlFor="csv-file" className="sr-only">CSV File</label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          required
        />
        <p className="text-xs text-gray-500">
          Required columns: <code>email, roll_no, department, year, full_name</code> (full_name optional)
        </p>
        {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}
        {result && (
          <p className="text-sm">
            <span className="text-green-700">✓ Inserted: <strong>{result.inserted}</strong></span>
            {result.errors > 0 && (
              <span className="text-red-600 ml-3">✗ Errors: <strong>{result.errors}</strong></span>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !file}
          className="self-start bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Uploading…' : 'Upload CSV'}
        </button>
      </form>

      {/* ── Error report ── */}
      {loadingErrors && <p className="text-sm text-gray-500">Loading error details…</p>}

      {errorRows.length > 0 && (
        <div className="border border-red-200 rounded p-4 bg-red-50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-red-800">
              Import Errors — {errorRows.length} row{errorRows.length !== 1 ? 's' : ''}
            </h3>
            <button
              type="button"
              onClick={downloadErrorCSV}
              className="text-xs text-blue-700 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50"
            >
              ↓ Download error report
            </button>
          </div>

          {/* Grouped by error type */}
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([reason, rows]) => (
              <div key={reason}>
                <p className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wide">
                  {ERROR_LABELS[reason] ?? reason} ({rows.length})
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse bg-white">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="py-1 px-2 text-gray-600">Row</th>
                        <th className="py-1 px-2 text-gray-600">Email</th>
                        <th className="py-1 px-2 text-gray-600">Roll No</th>
                        <th className="py-1 px-2 text-gray-600">Dept</th>
                        <th className="py-1 px-2 text-gray-600">Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="py-1 px-2 font-mono">{r.row_number}</td>
                          <td className="py-1 px-2">{r.raw_row.email ?? <span className="text-gray-400 italic">—</span>}</td>
                          <td className="py-1 px-2">{r.raw_row.roll_no ?? <span className="text-gray-400 italic">—</span>}</td>
                          <td className="py-1 px-2">{r.raw_row.department ?? <span className="text-gray-400 italic">—</span>}</td>
                          <td className="py-1 px-2">{r.raw_row.year ?? <span className="text-gray-400 italic">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
