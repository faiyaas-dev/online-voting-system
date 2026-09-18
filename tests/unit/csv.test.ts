import { parseCSV, analyzeRosterCSV } from '../../lib/csv'

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
