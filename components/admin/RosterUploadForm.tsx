'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, analyzeRosterCSV, diffFixedRows, normalizeEmail, type FixedRowsDiff } from '@/lib/csv'
import RosterImportErrors from '@/components/admin/RosterImportErrors'

// Cap for the baseline fetch backing the re-upload diff (display stays
// paginated in RosterImportErrors; this is diff input only).
const BASELINE_FETCH_CAP = 2000
const BASELINE_PAGE_SIZE = 500

interface UploadResult {
  inserted: number
  errors: number
}

interface PreScanWarning {
  totalDataRows: number
  duplicateEmailRows: number[]
  duplicateRollNoRows: number[]
}

export default function RosterUploadForm({ institutionId }: { institutionId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [previewError, setPreviewError] = useState('')
  const [preScan, setPreScan] = useState<PreScanWarning | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadCount, setUploadCount] = useState(0)
  // Re-upload loop (P2-2): baseline = normalized emails recorded as failed
  // by the latest upload; a corrected file is diffed against it client-side
  // ("N fixed, M remaining") before the admin commits to re-uploading.
  const [baselineEmails, setBaselineEmails] = useState<string[]>([])
  const [baselineLoading, setBaselineLoading] = useState(false)
  const [recheckDiff, setRecheckDiff] = useState<FixedRowsDiff | null>(null)
  const [recheckFileName, setRecheckFileName] = useState('')
  const [recheckFile, setRecheckFile] = useState<File | null>(null)

  async function fetchBaselineEmails() {
    setBaselineLoading(true)
    try {
      const supabase = createClient()
      const emails: string[] = []
      for (let offset = 0; offset < BASELINE_FETCH_CAP; offset += BASELINE_PAGE_SIZE) {
        const { data, error } = await supabase
          .from('roster_import_errors')
          .select('raw_row')
          .eq('institution_id', institutionId)
          .order('imported_at', { ascending: false })
          .range(offset, offset + BASELINE_PAGE_SIZE - 1)
        if (error || !data || data.length === 0) break
        for (const row of data) {
          const email = normalizeEmail((row.raw_row as Record<string, string> | null)?.email)
          if (email !== '') emails.push(email)
        }
        if (data.length < BASELINE_PAGE_SIZE) break
      }
      setBaselineEmails(Array.from(new Set(emails)))
    } finally {
      setBaselineLoading(false)
    }
  }

  function handleRecheckFile(nextFile: File | null) {
    setRecheckDiff(null)
    setRecheckFile(nextFile)
    setRecheckFileName(nextFile?.name ?? '')
    if (!nextFile) return
    const reader = new FileReader()
    reader.onload = () => {
      setRecheckDiff(diffFixedRows(baselineEmails, String(reader.result ?? '')))
    }
    reader.onerror = () => setRecheckFileName('')
    reader.readAsText(nextFile)
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    setPreview([])
    setPreviewError('')
    setPreScan(null)
    setConfirmed(false)
    if (!nextFile) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      // Full-file scan (not just the first 6 lines): header gate plus
      // whole-file duplicate detection, so a poisoned row 4,000 is flagged
      // before upload instead of only in post-upload errors.
      const scan = analyzeRosterCSV(text)
      if (scan.missingColumns.length > 0) setPreviewError(`Missing required columns: ${scan.missingColumns.join(', ')}`)
      setPreview(parseCSV(text).slice(0, 6))
      setPreScan({
        totalDataRows: scan.totalDataRows,
        duplicateEmailRows: scan.duplicateEmailRows,
        duplicateRollNoRows: scan.duplicateRollNoRows,
      })
    }
    reader.onerror = () => setPreviewError('Could not read this CSV file.')
    reader.readAsText(nextFile)
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !confirmed || previewError) return
    setUploadError('')
    setResult(null)
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
    // Refresh the unified paginated error browser below (single source of
    // truth — the form no longer keeps its own 500-row error copy).
    setUploadCount(count => count + 1)
    // Reset the re-upload loop and snapshot the new failure baseline.
    setRecheckDiff(null)
    setRecheckFile(null)
    setRecheckFileName('')
    if (json.errors > 0) void fetchBaselineEmails()
    else setBaselineEmails([])
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={upload} className="flex flex-col gap-3">
        <label htmlFor="csv-file" className="sr-only">CSV File</label>
        <input id="csv-file" type="file" accept=".csv,text/csv" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} required />
        <p className="text-xs text-gray-500">Required columns: <code>email, roll_no, department, year, full_name</code> (full_name optional)</p>
        {preview.length > 0 && (
          <div className="overflow-x-auto border border-gray-700 bg-gray-950 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
              Preview: first 5 data rows
              {preScan && <span className="text-gray-500"> · {preScan.totalDataRows} data row{preScan.totalDataRows === 1 ? '' : 's'} in full file (headers + full file validated on upload)</span>}
            </p>
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
            {!previewError && preScan && (preScan.duplicateEmailRows.length > 0 || preScan.duplicateRollNoRows.length > 0) && (
              <p className="mt-3 text-xs text-yellow-400">
                Pre-upload check — duplicates in this file will be rejected on upload
                {preScan.duplicateEmailRows.length > 0 && <span>: duplicate email at file row{preScan.duplicateEmailRows.length === 1 ? '' : 's'} {preScan.duplicateEmailRows.join(', ')}</span>}
                {preScan.duplicateRollNoRows.length > 0 && <span>: duplicate roll number at file row{preScan.duplicateRollNoRows.length === 1 ? '' : 's'} {preScan.duplicateRollNoRows.join(', ')}</span>}
                . Fix them or leave the file — bad rows are isolated, never abort the import.
              </p>
            )}
            {!previewError && <label className="mt-3 flex min-h-[44px] items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I reviewed this preview and want to upload it.</label>}
          </div>
        )}
        {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}
        {result && <p className="text-sm"><span className="text-green-400">✓ Inserted: <strong>{result.inserted}</strong></span>{result.errors > 0 && <span className="ml-3 text-red-400">✗ Errors: <strong>{result.errors}</strong></span>}</p>}
        <button type="submit" disabled={loading || !file || !confirmed || Boolean(previewError)} className="min-h-[44px] self-start rounded-full bg-yellow-400 px-6 py-2 text-sm font-bold uppercase tracking-widest text-black shadow-neon-yellow hover:bg-yellow-300 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black">{loading ? 'Uploading…' : 'Confirm and upload CSV'}</button>
      </form>

      {result && result.errors > 0 && (
        <RosterImportErrors institutionId={institutionId} refreshKey={uploadCount} title="Import Errors — this upload" />
      )}

      {result && result.errors > 0 && (
        <div className="rounded border border-gray-700 bg-gray-950 p-4">
          <h3 className="text-sm font-semibold text-gray-200">Re-upload fixed rows</h3>
          <p className="mt-1 text-xs text-gray-500">
            Fix the failed rows in your CSV, then pre-check the corrected file here:
            we diff it against the {baselineEmails.length} recorded failure{baselineEmails.length === 1 ? '' : 's'} and report fixed vs remaining.
            Pre-check only — the upload result stays the final truth (rows already in the roster re-fail server-side).
          </p>
          {baselineLoading && <p className="mt-2 text-xs text-gray-500">Loading failure baseline…</p>}
          <label htmlFor="csv-recheck" className="sr-only">Corrected CSV file for pre-check</label>
          <input
            id="csv-recheck"
            type="file"
            accept=".csv,text/csv"
            disabled={baselineLoading || baselineEmails.length === 0}
            onChange={e => handleRecheckFile(e.target.files?.[0] ?? null)}
            className="mt-3 text-sm text-gray-300"
          />
          {recheckDiff && (
            <div className="mt-3 border-t border-gray-800 pt-3">
              <p className="text-sm">
                <span className="text-green-400">✓ Fixed: <strong>{recheckDiff.fixed}</strong></span>
                <span className="ml-3 text-red-400">✗ Remaining: <strong>{recheckDiff.remaining}</strong></span>
                <span className="ml-3 text-gray-500">of {recheckDiff.totalBaseline} previously failing</span>
              </p>
              {recheckDiff.remainingEmails.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Still failing or absent: {recheckDiff.remainingEmails.slice(0, 20).join(', ')}
                  {recheckDiff.remainingEmails.length > 20 && ` (+${recheckDiff.remainingEmails.length - 20} more)`}
                </p>
              )}
              {recheckFile && (
                <button
                  type="button"
                  onClick={() => handleFileChange(recheckFile)}
                  className="mt-3 min-h-[44px] rounded border border-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800 transition-colors"
                >
                  Use “{recheckFileName}” for upload ↑
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
