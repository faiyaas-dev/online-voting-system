import { notFound } from 'next/navigation'
import CandidateApprovalTable from '@/components/admin/CandidateApprovalTable'
import ElectionTable from '@/components/admin/ElectionTable'
import type { CandidateStatus, Election } from '@/lib/supabase/types'

/**
 * TEST-ONLY harness: renders the real governance client components with
 * canned props so Playwright can exercise the two-tap Confirm/Cancel flows
 * without a session (the real /institution-admin page is a server component
 * that redirects unauthenticated traffic — faking a session via page.route
 * is the wrong layer, see tests/e2e/fixtures.ts).
 *
 * Guards:
 * - Renders `notFound()` in production; never linked from any UI.
 * - Props are synthetic fixtures; no Supabase traffic happens until Confirm
 *   is clicked, and the spec never clicks Confirm (mutation counters prove it).
 */

const APPROVE_CANDIDATE: {
  id: string
  status: CandidateStatus
  manifesto: string | null
  photo_path: string | null
  profiles: { full_name: string | null; roll_no: string | null; department: string | null }
  elections: { title: string | null }
} = {
  id: 'c0000000-0000-4000-8000-000000000001',
  status: 'pending',
  manifesto: 'Harness manifesto for the approve arm.',
  photo_path: null,
  profiles: { full_name: 'Harness Approve', roll_no: 'H-001', department: 'CSE' },
  elections: { title: 'Harness Election' },
}

const REJECT_CANDIDATE: typeof APPROVE_CANDIDATE = {
  id: 'c0000000-0000-4000-8000-000000000002',
  status: 'pending',
  manifesto: 'Harness manifesto for the reject arm.',
  photo_path: null,
  profiles: { full_name: 'Harness Reject', roll_no: 'H-002', department: 'EEE' },
  elections: { title: 'Harness Election' },
}

const DRAFT_ELECTION: Election = {
  id: 'e0000000-0000-4000-8000-000000000001',
  institution_id: 'i0000000-0000-4000-8000-000000000001',
  title: 'Harness Draft Election',
  scope_department: null,
  scope_year: null,
  opens_at: new Date('2026-10-01T09:00:00Z').toISOString(),
  closes_at: new Date('2026-10-02T09:00:00Z').toISOString(),
  status: 'draft',
  created_by: null,
  created_at: new Date('2026-09-01T09:00:00Z').toISOString(),
}

export default function GovernanceHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-white p-6">
      <h1 className="text-xl font-bold uppercase tracking-widest">Governance harness</h1>
      <section aria-label="Approve candidate" className="mt-6">
        <CandidateApprovalTable candidates={[APPROVE_CANDIDATE]} />
      </section>
      <section aria-label="Reject candidate" className="mt-6">
        <CandidateApprovalTable candidates={[REJECT_CANDIDATE]} />
      </section>
      <section aria-label="Election lifecycle" className="mt-6">
        <ElectionTable elections={[DRAFT_ELECTION]} />
      </section>
    </main>
  )
}
