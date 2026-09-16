export function validateRosterRow(
  row: any,
  seenEmails: Set<string>,
  seenRollNos: Set<string>
): string | null {
  const email = row.email?.trim()
  const department = row.department?.trim()
  const roll_no = row.roll_no?.trim()
  const year = parseInt(row.year, 10)

  if (!email) return 'missing_email'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'invalid_email_format'
  if (!department) return 'missing_department'
  if (!roll_no) return 'missing_roll_no'
  if (isNaN(year)) return 'invalid_year'
  if (seenEmails.has(email.toLowerCase())) return 'duplicate_email_in_batch'
  if (seenRollNos.has(roll_no.toLowerCase())) return 'duplicate_roll_no_in_batch'

  return null
}
