// RFC 4180 compliant CSV parsing shared by the roster uploader.
// Pure functions only (no I/O) so they are unit-testable under Jest.
import { validateRosterRow } from '../supabase/functions/roster-csv-validate/validation'

/**
 * Parse CSV text into rows of fields. Handles quoted fields containing
 * commas, embedded CR/LF newlines, escaped ("") quotes, CRLF line endings,
 * a leading BOM, and skips fully-blank lines. Returns ALL rows — callers
 * slice what they display.
 */
export function parseCSV(text: string): string[][] {
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

export interface RosterPreScan {
  /** Lowercased header names (first row), or [] when the file is empty. */
  headers: string[]
  /** Required columns absent from the header row. */
  missingColumns: string[]
  /** Data rows (header excluded). */
  dataRows: string[][]
  /** Total data-row count across the WHOLE file (not just the preview). */
  totalDataRows: number
  /** 1-based data-row numbers whose email duplicates another row in the file. */
  duplicateEmailRows: number[]
  /** 1-based data-row numbers whose roll_no duplicates another row in the file. */
  duplicateRollNoRows: number[]
}

const REQUIRED_COLUMNS = ['email', 'roll_no', 'department', 'year']

function columnIndex(headers: string[], name: string): number {
  return headers.indexOf(name)
}

/**
 * Full-file pre-upload scan: header gate plus whole-file duplicate
 * detection, so a poisoned row 4,000 is flagged BEFORE upload instead of
 * only surfacing in post-upload errors. Operates on parseCSV output.
 */
export function analyzeRosterCSV(text: string): RosterPreScan {
  const rows = parseCSV(text)
  if (rows.length === 0) {
    return {
      headers: [],
      missingColumns: [...REQUIRED_COLUMNS],
      dataRows: [],
      totalDataRows: 0,
      duplicateEmailRows: [],
      duplicateRollNoRows: [],
    }
  }
  const headers = rows[0].map(header => header.toLowerCase())
  const missingColumns = REQUIRED_COLUMNS.filter(column => !headers.includes(column))
  const dataRows = rows.slice(1)

  const emailIndex = columnIndex(headers, 'email')
  const rollNoIndex = columnIndex(headers, 'roll_no')

  // Map normalized value -> list of 1-based data-row numbers.
  const emails = new Map<string, number[]>()
  const rollNos = new Map<string, number[]>()
  dataRows.forEach((row, i) => {
    const rowNumber = i + 1
    if (emailIndex >= 0) {
      const email = (row[emailIndex] ?? '').trim().toLowerCase()
      if (email !== '') {
        const list = emails.get(email) ?? []
        list.push(rowNumber)
        emails.set(email, list)
      }
    }
    if (rollNoIndex >= 0) {
      const rollNo = (row[rollNoIndex] ?? '').trim()
      if (rollNo !== '') {
        const list = rollNos.get(rollNo) ?? []
        list.push(rowNumber)
        rollNos.set(rollNo, list)
      }
    }
  })

  const dupes = (groups: Map<string, number[]>): number[] =>
    Array.from(groups.values()).filter(list => list.length > 1).reduce<number[]>((acc, list) => acc.concat(list), []).sort((a, b) => a - b)

  return {
    headers,
    missingColumns,
    dataRows,
    totalDataRows: dataRows.length,
    duplicateEmailRows: dupes(emails),
    duplicateRollNoRows: dupes(rollNos),
  }
}

export interface FixedRowsDiff {
  /** Previously-failing emails that now validate clean (client-side). */
  fixed: number
  fixedEmails: string[]
  /** Previously-failing emails still failing or absent from the new file. */
  remaining: number
  remainingEmails: string[]
  totalBaseline: number
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Re-upload loop diff (P2-2): compare a corrected file against the emails
 * recorded as failed by the previous upload, using the SAME
 * validateRosterRow rules the server Edge Function applies, so the pre-check
 * mirrors upload semantics (header mapping + in-batch duplicate tracking).
 *
 * Honesty boundary: the server also rejects duplicates against rows already
 * in the roster (duplicate_email_existing), which no client pre-check can
 * see. This diff is advisory — the upload result stays the final truth.
 */
export function diffFixedRows(baselineEmails: string[], csvText: string): FixedRowsDiff {
  const baseline = baselineEmails.map(normalizeEmail).filter(Boolean)
  const scan = analyzeRosterCSV(csvText)

  // Map data rows to header-named objects, mirroring the server's row shape.
  const seenEmails = new Set<string>()
  const seenRollNos = new Set<string>()
  const cleanEmails = new Set<string>()
  for (const row of scan.dataRows) {
    const record: Record<string, string> = {}
    scan.headers.forEach((header, i) => {
      record[header] = row[i] ?? ''
    })
    const reason = validateRosterRow(record, seenEmails, seenRollNos)
    const email = normalizeEmail(record.email)
    if (reason === null) {
      // Mirror the server (index.ts:85-86): only VALID rows populate the
      // seen-sets, so a later duplicate of a failed row is not misflagged.
      if (email !== '') {
        seenEmails.add(email)
        cleanEmails.add(email)
      }
      const rollNo = (record.roll_no ?? '').trim()
      if (rollNo !== '') seenRollNos.add(rollNo.toLowerCase())
    }
  }

  const fixedEmails = baseline.filter(email => cleanEmails.has(email))
  const remainingEmails = baseline.filter(email => !cleanEmails.has(email))
  return {
    fixed: fixedEmails.length,
    fixedEmails,
    remaining: remainingEmails.length,
    remainingEmails,
    totalBaseline: baseline.length,
  }
}
