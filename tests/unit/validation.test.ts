import { validateRosterRow } from '../../supabase/functions/roster-csv-validate/validation'

describe('validateRosterRow', () => {
  let seenEmails: Set<string>
  let seenRollNos: Set<string>

  beforeEach(() => {
    seenEmails = new Set()
    seenRollNos = new Set()
  })

  it('rejects missing email', () => {
    const row = { department: 'CS', roll_no: '123', year: '2023' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBe('missing_email')
  })

  it('rejects invalid email format', () => {
    const row = { email: 'notanemail', department: 'CS', roll_no: '123', year: '2023' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBe('invalid_email_format')
  })

  it('rejects missing department', () => {
    const row = { email: 'test@test.com', roll_no: '123', year: '2023' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBe('missing_department')
  })

  it('rejects missing roll no', () => {
    const row = { email: 'test@test.com', department: 'CS', year: '2023' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBe('missing_roll_no')
  })

  it('rejects invalid year', () => {
    const row = { email: 'test@test.com', department: 'CS', roll_no: '123', year: 'notayear' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBe('invalid_year')
  })

  it('rejects duplicate email in batch', () => {
    seenEmails.add('test@test.com')
    const row = { email: 'test@test.com', department: 'CS', roll_no: '123', year: '2023' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBe('duplicate_email_in_batch')
  })

  it('rejects duplicate roll no in batch', () => {
    seenRollNos.add('123')
    const row = { email: 'test2@test.com', department: 'CS', roll_no: '123', year: '2023' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBe('duplicate_roll_no_in_batch')
  })

  it('returns null for valid row', () => {
    const row = { email: 'test@test.com', department: 'CS', roll_no: '123', year: '2023' }
    expect(validateRosterRow(row, seenEmails, seenRollNos)).toBeNull()
  })
})
