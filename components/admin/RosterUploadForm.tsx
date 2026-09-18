'use client'

import { useState } from 'react'
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

interface UploadResult {
  inserted: number
  errors: number
}

// Minimal RFC-4180-style parser: handles quoted commas, escaped ("") quotes,
// and multiline quoted fields. Returns all rows; callers slice what they show.
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  // Strip BOM so the first header compares cleanly.
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { value += '"'; i += 1 }
        else quoted = false
      } else value += char
    } else if (char === '"') {
      // An opening quote only starts quoting at a field boundary; otherwise literal.
      if (value === '') quoted = true
      else value += char
    } else if (char === ',') {
      row.push(value.trim())
      value = ''
    } else if (char === '\n') {
      row.push(value.trim())
      value = ''
      if (row.some(cell => cell !== '')) rows.push(row)
      row = []
    } else if (char === '\r') {
      // Ignore; \n handles the break.
    } else value += char
  }
  row.push(value.trim())
  if (row.some(cell => cell !== '')) rows.push(row)
  return rows
}

function parsePreview(text: string) {
  return parseCSV(text).slice(0, 6)
}

export default function RosterUploadForm({ institutionId }: { institutionId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [previewError, setPreviewError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [errorRows, setErrorRows] = useState<RosterImportError[]>([])
  const [loadingErrors, setLoadingErrors] = useState(false)

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    setPreview([])
    setPreviewError('')
    setConfirmed(false)
    if (!nextFile) return

    const reader = new FileReader()
    reader.onload = () => {
      const rows = parsePreview(String(reader.result ?? ''))
      const headers = rows[0]?.map(header => header.toLowerCase())
      const required = ['email', 'roll_no', 'department', 'year']
      const missing = required.filter(column => !headers?.includes(column))
      if (missing.length > 0) setPreviewError(`Missing required columns: ${missing.join(', ')}`)
      setPreview(rows)
    }
    reader.onerror = () => setPreviewError('Could not read this CSV file.')
    reader.readAsText(nextFile)
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !confirmed || previewError) return
    setUploadError('')
    setResult(null)
    setErrorRows([])
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadError('Not authenticated'); setLoading(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUploadError('No active session'); setLoading(false); return }

    const form = new FormData()
    form.append('file', file)
    form.append('institution_id', institutionId)
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roster-csv-validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form,
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setUploadError(json.error ?? 'Upload failed'); return }
    setResult({ inserted: json.inserted, errors: json.errors })
    if (json.errors > 0) await fetchErrors(supabase)
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

  const grouped = errorRows.reduce<Record<string, RosterImportError[]>>((acc, row) => {
    if (!acc[row.error_reason]) acc[row.error_reason] = []
    acc[row.error_reason].push(row)
    return acc
  }, {})

  function downloadErrorCSV() {
    const headers = ['row_number', 'error_reason', 'email', 'roll_no', 'department', 'year', 'full_name', 'imported_at']
    const rows = errorRows.map(e => [e.row_number, e.error_reason, e.raw_row.email ?? '', e.raw_row.roll_no ?? '', e.raw_row.department ?? '', e.raw_row.year ?? '', e.raw_row.full_name ?? '', e.imported_at])
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `roster-errors-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={upload} className="flex flex-col gap-3">
        <label htmlFor="csv-file" className="sr-only">CSV File</label>
        <input id="csv-file" type="file" accept=".csv,text/csv" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} required />
        <p className="text-xs text-gray-500">Required columns: <code>email, roll_no, department, year, full_name</code> (full_name optional)</p>
        {preview.length > 0 && (
          <div className="overflow-x-auto border border-gray-700 bg-gray-950 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Preview: first 5 data rows (headers + full file validated on upload)</p>
            <table className="w-full text-left text-xs">
              <tbody>
                {preview.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-gray-800 last:border-0">
                    {row.map((cell, cellIndex) => rowIndex === 0
                      ? <th key={cellIndex} className="px-2 py-2 text-gray-300">{cell}</th>
                      : <td key={cellIndex} className="px-2 py-2 text-gray-500">{cell || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewError && <p className="mt-3 text-sm text-red-400">{previewError}</p>}
            {!previewError && <label className="mt-3 flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I reviewed this preview and want to upload it.</label>}
          </div>
        )}
        {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}
        {result && <p className="text-sm"><span className="text-green-400">✓ Inserted: <strong>{result.inserted}</strong></span>{result.errors > 0 && <span className="ml-3 text-red-400">✗ Errors: <strong>{result.errors}</strong></span>}</p>}
        <button type="submit" disabled={loading || !file || !confirmed || Boolean(previewError)} className="self-start rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{loading ? 'Uploading…' : 'Confirm and upload CSV'}</button>
      </form>

      {loadingErrors && <p className="text-sm text-gray-500">Loading error details…</p>}
      {errorRows.length > 0 && (
        <div className="rounded border border-red-900 bg-red-950/30 p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-red-300">Import Errors — {errorRows.length} rows</h3><button type="button" onClick={downloadErrorCSV} className="rounded border border-blue-700 px-2 py-1 text-xs text-blue-300">↓ Download error report</button></div>
          {Object.entries(grouped).map(([reason, rows]) => (
            <div key={reason} className="mb-4 overflow-x-auto">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-300">{ERROR_LABELS[reason] ?? reason} ({rows.length})</p>
              <table className="w-full text-xs"><tbody>{rows.map(row => <tr key={row.id} className="border-b border-red-900"><td className="px-2 py-1">{row.row_number}</td><td className="px-2 py-1">{row.raw_row.email ?? '—'}</td><td className="px-2 py-1">{row.raw_row.roll_no ?? '—'}</td><td className="px-2 py-1">{row.raw_row.department ?? '—'}</td><td className="px-2 py-1">{row.raw_row.year ?? '—'}</td></tr>)}</tbody></table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
