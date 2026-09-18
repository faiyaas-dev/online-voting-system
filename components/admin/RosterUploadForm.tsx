'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, analyzeRosterCSV } from '@/lib/csv'
import RosterImportErrors from '@/components/admin/RosterImportErrors'

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
        <button type="submit" disabled={loading || !file || !confirmed || Boolean(previewError)} className="min-h-[44px] self-start rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{loading ? 'Uploading…' : 'Confirm and upload CSV'}</button>
      </form>

      {result && result.errors > 0 && (
        <RosterImportErrors institutionId={institutionId} refreshKey={uploadCount} title="Import Errors — this upload" />
      )}
    </div>
  )
}
