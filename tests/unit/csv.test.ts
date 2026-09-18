import { parseCSV, analyzeRosterCSV, diffFixedRows } from '../../lib/csv'

describe('parseCSV (RFC 4180)', () => {
  it('parses simple rows and headers', () => {
    expect(parseCSV('email,roll_no\ntest@test.com,123\n')).toEqual([
      ['email', 'roll_no'],
      ['test@test.com', '123'],
    ])
  })

  it('handles quoted fields containing commas', () => {
    expect(parseCSV('full_name,department\n"Doe, John",CSE\n')).toEqual([
      ['full_name', 'department'],
      ['Doe, John', 'CSE'],
    ])
  })

  it('handles escaped double quotes', () => {
    expect(parseCSV('full_name\n"Say ""hi"""\n')).toEqual([
      ['full_name'],
      ['Say "hi"'],
    ])
  })

  it('handles newlines inside quoted fields', () => {
    expect(parseCSV('full_name,year\n"Line one\nLine two",3\nnext,4\n')).toEqual([
      ['full_name', 'year'],
      ['Line one\nLine two', '3'],
      ['next', '4'],
    ])
  })

  it('handles CRLF line endings and strips a BOM', () => {
    expect(parseCSV('﻿email,roll_no\r\ntest@test.com,123\r\n')).toEqual([
      ['email', 'roll_no'],
      ['test@test.com', '123'],
    ])
  })

  it('skips fully-blank lines', () => {
    expect(parseCSV('email\n\ntest@test.com\n\n')).toEqual([
      ['email'],
      ['test@test.com'],
    ])
  })
})

describe('analyzeRosterCSV (full-file pre-scan)', () => {
  const header = 'email,roll_no,department,year,full_name'

  it('flags missing required columns', () => {
    const scan = analyzeRosterCSV('email,department\ntest@test.com,CSE\n')
    expect(scan.missingColumns).toEqual(['roll_no', 'year'])
    expect(scan.totalDataRows).toBe(1)
  })

  it('counts every data row in the file, not just the preview window', () => {
    const body = Array.from({ length: 25 }, (_, i) => `u${i}@t.com,R${i},CSE,3,Name ${i}`).join('\n')
    const scan = analyzeRosterCSV(`${header}\n${body}\n`)
    expect(scan.missingColumns).toEqual([])
    expect(scan.totalDataRows).toBe(25)
  })

  it('detects in-batch duplicate emails and roll numbers with row numbers', () => {
    const scan = analyzeRosterCSV(
      `${header}\n` +
        'dup@t.com,R1,CSE,3,One\n' +
        'other@t.com,R2,CSE,3,Two\n' +
        'DUP@t.com,R3,CSE,3,Three\n' +
        'fourth@t.com,R2,CSE,3,Four\n',
    )
    // Email match is case-insensitive: data rows 1 and 3.
    expect(scan.duplicateEmailRows).toEqual([1, 3])
    // Roll number match is exact: data rows 2 and 4.
    expect(scan.duplicateRollNoRows).toEqual([2, 4])
  })

  it('reports an empty file with all columns missing', () => {
    const scan = analyzeRosterCSV('')
    expect(scan.totalDataRows).toBe(0)
    expect(scan.missingColumns).toEqual(['email', 'roll_no', 'department', 'year'])
  })
})

describe('diffFixedRows (re-upload loop)', () => {
  const header = 'email,roll_no,department,year,full_name'

  it('counts corrected rows as fixed and still-broken rows as remaining', () => {
    const baseline = ['bad-email', 'missing-dept@t.com', 'gone@t.com']
    const diff = diffFixedRows(
      baseline,
      `${header}\n` +
        'fixed@t.com,R1,CSE,3,Fixed\n' +
        'missing-dept@t.com,R2,,3,Still Broken\n',
    )
    // 'bad-email' is absent entirely (removed, not fixed) -> remaining.
    // valid rows never seen before are irrelevant to the diff.
    expect(diff.totalBaseline).toBe(3)
    expect(diff.fixed).toBe(0)
    expect(diff.remaining).toBe(3)
    expect(diff.remainingEmails).toEqual(['bad-email', 'missing-dept@t.com', 'gone@t.com'])
  })

  it('marks a baseline email fixed when its row now validates clean', () => {
    const diff = diffFixedRows(
      ['typo@t.com'],
      `${header}\ntypo@t.com,R9,CSE,3,Now Valid\n`,
    )
    expect(diff.fixed).toBe(1)
    expect(diff.fixedEmails).toEqual(['typo@t.com'])
    expect(diff.remaining).toBe(0)
  })

  it('mirrors server semantics: a duplicate of a failed row is not a false duplicate', () => {
    // Row 1 fails (bad year) so it must NOT poison row 2's duplicate check —
    // exactly like the Edge Function, which only tracks valid rows.
    const diff = diffFixedRows(
      ['dup@t.com'],
      `${header}\n` +
        'dup@t.com,R1,CSE,notayear,Bad Year\n' +
        'dup@t.com,R1,CSE,3,Good Row\n',
    )
    expect(diff.fixed).toBe(1)
    expect(diff.remaining).toBe(0)
  })

  it('flags in-batch duplicates in the corrected file as remaining', () => {
    const diff = diffFixedRows(
      ['dup@t.com'],
      `${header}\n` +
        'dup@t.com,R1,CSE,3,One\n' +
        'dup@t.com,R2,CSE,3,Two\n',
    )
    // First occurrence validates clean, second is a batch duplicate —
    // the email still has a failing row, but the clean occurrence counts.
    expect(diff.fixedEmails).toContain('dup@t.com')
  })
})
